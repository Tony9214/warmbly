package integration

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"github.com/warmbly/warmbly/internal/models"
	"github.com/warmbly/warmbly/internal/repository"
)

// Service exposes the generic CRUD surface the dashboard talks to.
// Provider-specific behaviour (inbound webhooks, scheduled pulls, DNS
// writes) lives in the per-provider files in this package.
type Service interface {
	Catalog() []models.IntegrationCatalogEntry
	ListConnections(ctx context.Context, orgID uuid.UUID) ([]models.IntegrationConnection, error)

	// Connect registers a new connection. The provider-specific config is
	// stored encrypted via the existing KMS envelope path; for the first
	// pass we accept the raw config map and serialize it into JSON, which
	// the storage layer hands to the encryption envelope.
	Connect(ctx context.Context, orgID uuid.UUID, provider models.IntegrationProvider, label string, config map[string]any) (*models.IntegrationConnection, error)
	Disconnect(ctx context.Context, orgID, id uuid.UUID) error

	// RotateInboundSecret regenerates the shared secret that providers
	// like Calendly use to address inbound webhooks to this org. Called
	// by the dashboard to refresh the URL after a leak.
	RotateInboundSecret(ctx context.Context, orgID, id uuid.UUID, provider models.IntegrationProvider) (string, error)

	// MarkSynced is the call-site every per-provider implementation makes
	// after a successful round-trip with the provider, so the dashboard's
	// "last sync" stamp stays accurate.
	MarkSynced(ctx context.Context, id uuid.UUID, status models.IntegrationStatus, displayFields map[string]any, errMsg string) error

	// Repo exposes the underlying repository so the per-provider files in
	// this package and the HTTP handlers can persist provider-specific
	// data (DMARC reports, Postmaster snapshots, bookings) without
	// dragging the repo through every method signature.
	Repo() repository.IntegrationRepository
}

type service struct {
	repo repository.IntegrationRepository
}

func NewService(repo repository.IntegrationRepository) Service {
	return &service{repo: repo}
}

func (s *service) Repo() repository.IntegrationRepository { return s.repo }

func (s *service) Catalog() []models.IntegrationCatalogEntry { return Catalog() }

func (s *service) ListConnections(ctx context.Context, orgID uuid.UUID) ([]models.IntegrationConnection, error) {
	return s.repo.ListConnections(ctx, orgID)
}

func (s *service) Connect(ctx context.Context, orgID uuid.UUID, provider models.IntegrationProvider, label string, config map[string]any) (*models.IntegrationConnection, error) {
	if !models.IsValidIntegrationProvider(string(provider)) {
		return nil, fmt.Errorf("unknown provider: %s", provider)
	}
	label = strings.TrimSpace(label)
	if label == "" {
		label = string(provider)
	}

	// Per-provider config validation. We do not enforce required fields
	// at the DB layer because OAuth flows finish in two steps: the first
	// call seeds the row with status=pending, the OAuth callback fills
	// the token. So validate only that the shape is plausible here.
	displayFields, err := buildDisplayFields(provider, config)
	if err != nil {
		return nil, err
	}

	// For providers that POST inbound, mint a secret immediately so the
	// dashboard can surface the URL on the same response.
	var inboundSecret string
	if provider == models.IntegrationCalendly ||
		provider == models.IntegrationCalCom ||
		provider == models.IntegrationDMARC {
		inboundSecret, err = generateInboundSecret(provider)
		if err != nil {
			return nil, err
		}
	}

	encrypted, err := encodeConfig(config)
	if err != nil {
		return nil, err
	}

	status := models.IntegrationStatusPending
	switch provider {
	case models.IntegrationCalendly, models.IntegrationCalCom, models.IntegrationDMARC:
		// Inbound webhook providers are "connected" the moment the URL
		// exists — the actual data arrives whenever the provider POSTs.
		status = models.IntegrationStatusConnected
	case models.IntegrationCloudflare, models.IntegrationGoDaddy, models.IntegrationNamecheap,
		models.IntegrationMicrosoftSNDS:
		// API-key providers: if the user provided a token, mark connected
		// optimistically and let the next round-trip downgrade to degraded
		// if the token is bad.
		if _, ok := config["api_token"]; ok {
			status = models.IntegrationStatusConnected
		}
	}

	df, _ := json.Marshal(displayFields)
	conn := &models.IntegrationConnection{
		OrganizationID: orgID,
		Provider:       provider,
		Label:          label,
		Status:         status,
		DisplayFields:  df,
	}
	if err := s.repo.UpsertConnection(ctx, conn, encrypted, inboundSecret); err != nil {
		return nil, err
	}

	if inboundSecret != "" {
		conn.InboundWebhookURL = BuildInboundURL(provider, inboundSecret)
	}
	return conn, nil
}

func (s *service) Disconnect(ctx context.Context, orgID, id uuid.UUID) error {
	return s.repo.DeleteConnection(ctx, orgID, id)
}

func (s *service) RotateInboundSecret(ctx context.Context, orgID, id uuid.UUID, provider models.IntegrationProvider) (string, error) {
	secret, err := generateInboundSecret(provider)
	if err != nil {
		return "", err
	}
	conn := &models.IntegrationConnection{
		ID:             id,
		OrganizationID: orgID,
		Provider:       provider,
		Status:         models.IntegrationStatusConnected,
	}
	if err := s.repo.UpsertConnection(ctx, conn, nil, secret); err != nil {
		return "", err
	}
	return BuildInboundURL(provider, secret), nil
}

func (s *service) MarkSynced(ctx context.Context, id uuid.UUID, status models.IntegrationStatus, displayFields map[string]any, errMsg string) error {
	df, _ := json.Marshal(displayFields)
	return s.repo.MarkConnectionSynced(ctx, id, status, df, errMsg)
}

// generateInboundSecret returns a 24-byte hex string. Long enough that
// guessing is infeasible, short enough to keep the URL pasteable.
func generateInboundSecret(provider models.IntegrationProvider) (string, error) {
	buf := make([]byte, 24)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	prefix := "wmint"
	switch provider {
	case models.IntegrationCalendly:
		prefix = "calendly"
	case models.IntegrationCalCom:
		prefix = "calcom"
	case models.IntegrationDMARC:
		prefix = "dmarc"
	}
	return prefix + "_" + hex.EncodeToString(buf), nil
}

// BuildInboundURL is exported so the routes file and the handler tests can
// generate the same URL the dashboard surfaces.
func BuildInboundURL(provider models.IntegrationProvider, secret string) string {
	switch provider {
	case models.IntegrationCalendly:
		return "/api/v1/integrations/inbound/calendly/" + secret
	case models.IntegrationCalCom:
		return "/api/v1/integrations/inbound/cal-com/" + secret
	case models.IntegrationDMARC:
		return "/api/v1/integrations/inbound/dmarc/" + secret
	}
	return ""
}

// encodeConfig serializes the per-provider config map to JSON. The bytes
// returned are what the persistence layer treats as the "encrypted blob"
// — the real encryption envelope hook lives one layer up in the KMS
// integration; for the first pass we accept the JSON-as-bytes shape and
// keep encrypt/decrypt as a future swap-in.
func encodeConfig(config map[string]any) ([]byte, error) {
	if len(config) == 0 {
		return nil, nil
	}
	return json.Marshal(config)
}

// buildDisplayFields extracts the public, non-secret bits of the config
// that the dashboard surfaces next to a connection card. Anything not
// listed here stays out of the API response.
func buildDisplayFields(provider models.IntegrationProvider, config map[string]any) (map[string]any, error) {
	df := map[string]any{}
	switch provider {
	case models.IntegrationCalendly, models.IntegrationCalCom:
		if v, ok := config["organization_uri"]; ok {
			df["organization_uri"] = v
		}
	case models.IntegrationGoogleSheets:
		if v, ok := config["sheet_id"]; ok {
			df["sheet_id"] = v
		}
		if v, ok := config["sheet_title"]; ok {
			df["sheet_title"] = v
		}
	case models.IntegrationGooglePostmaster:
		if v, ok := config["domain"]; ok {
			df["domain"] = v
		}
	case models.IntegrationMicrosoftSNDS:
		if v, ok := config["ip"]; ok {
			df["ip"] = v
		}
	case models.IntegrationCloudflare:
		if v, ok := config["zone_name"]; ok {
			df["zone_name"] = v
		}
		if _, ok := config["api_token"]; !ok {
			return nil, errors.New("cloudflare connection requires an api_token")
		}
	case models.IntegrationGoDaddy, models.IntegrationNamecheap:
		if v, ok := config["domain"]; ok {
			df["domain"] = v
		}
		if _, ok := config["api_token"]; !ok {
			return nil, errors.New("dns provider requires an api_token")
		}
	}
	return df, nil
}
