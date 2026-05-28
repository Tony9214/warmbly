package handler

import (
	"context"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/warmbly/warmbly/internal/app/integration"
	"github.com/warmbly/warmbly/internal/models"
)

// ListIntegrationCatalog returns the static metadata for every integration
// Warmbly supports — used by the dashboard to render the "available
// integrations" grid even when nothing is connected yet.
func (h *Handler) ListIntegrationCatalog(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"catalog": h.IntegrationService.Catalog(),
	})
}

// ListIntegrationConnections returns this org's connection rows. Plain
// status snapshot — no secrets, no encrypted config.
func (h *Handler) ListIntegrationConnections(c *gin.Context) {
	orgID, ok := requireOrgID(c)
	if !ok {
		return
	}
	conns, err := h.IntegrationService.ListConnections(c.Request.Context(), orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list connections"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"connections": conns})
}

// integrationConnectPayload is the create-connection request body. The
// `config` map is per-provider — see integration.buildDisplayFields for
// which keys are recognized per provider.
type integrationConnectPayload struct {
	Provider string         `json:"provider"`
	Label    string         `json:"label"`
	Config   map[string]any `json:"config"`
}

// ConnectIntegration creates / updates a connection. For inbound-webhook
// providers (Calendly, Cal.com, DMARC) the response includes the URL the
// user pastes into the provider — visible exactly once.
func (h *Handler) ConnectIntegration(c *gin.Context) {
	orgID, ok := requireOrgID(c)
	if !ok {
		return
	}
	var p integrationConnectPayload
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	provider := models.IntegrationProvider(strings.TrimSpace(p.Provider))
	if !models.IsValidIntegrationProvider(string(provider)) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unknown provider"})
		return
	}

	// For Cloudflare connections, verify the API token before persisting.
	// The user types the token, hits "connect" — and learns immediately
	// whether it's valid. The same pattern can be extended to GoDaddy /
	// Namecheap once their client wrappers land.
	if provider == models.IntegrationCloudflare {
		token, _ := p.Config["api_token"].(string)
		if token == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "api_token is required"})
			return
		}
		if err := integration.NewCloudflareClient(token).VerifyToken(c.Request.Context()); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}

	conn, err := h.IntegrationService.Connect(c.Request.Context(), orgID, provider, p.Label, p.Config)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, conn)
}

// DisconnectIntegration removes a connection row. Cascading FKs handle
// dependent data (bookings, reports) per the migration.
func (h *Handler) DisconnectIntegration(c *gin.Context) {
	orgID, ok := requireOrgID(c)
	if !ok {
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := h.IntegrationService.Disconnect(c.Request.Context(), orgID, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "delete failed"})
		return
	}
	c.Status(http.StatusNoContent)
}

// ─── Inbound webhooks ──────────────────────────────────────────────────
//
// Per-provider inbound endpoints. All take a secret in the URL path — the
// secret was minted on connect and is unique per (org, provider). No
// org context comes from the auth middleware here because providers POST
// from their own infrastructure with no Warmbly bearer.

// InboundCalendly handles invitee.created webhooks. The secret in the URL
// routes the event to the right org.
func (h *Handler) InboundCalendly(c *gin.Context) {
	h.handleInboundBooking(c, models.IntegrationCalendly)
}

func (h *Handler) InboundCalCom(c *gin.Context) {
	h.handleInboundBooking(c, models.IntegrationCalCom)
}

// handleInboundBooking is shared between Calendly and Cal.com. The
// per-provider parsing logic differs (different JSON shapes) but the
// routing (secret → org → save booking → fire webhook) is identical.
func (h *Handler) handleInboundBooking(c *gin.Context, provider models.IntegrationProvider) {
	secret := strings.TrimSpace(c.Param("secret"))
	if secret == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "secret required"})
		return
	}
	conn, err := h.IntegrationService.Repo().GetConnectionByInboundSecret(c.Request.Context(), provider, secret)
	if err != nil || conn == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "unknown secret"})
		return
	}
	body, err := io.ReadAll(io.LimitReader(c.Request.Body, 1<<20))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "read body failed"})
		return
	}

	matcher := integration.NewBookingMatcher(func(ctx context.Context, orgID uuid.UUID, email string) (*uuid.UUID, error) {
		if h.ContactRepo == nil {
			return nil, nil
		}
		contact, xerr := h.ContactRepo.GetByEmailAndOrganization(ctx, orgID, email)
		if xerr != nil {
			return nil, xerr
		}
		if contact == nil {
			return nil, nil
		}
		return &contact.ID, nil
	})

	var booking *models.MeetingBooking
	switch provider {
	case models.IntegrationCalendly:
		booking, err = integration.HandleCalendlyEvent(c.Request.Context(), h.IntegrationService.Repo(), matcher, conn.OrganizationID, body)
	case models.IntegrationCalCom:
		booking, err = integration.HandleCalComEvent(c.Request.Context(), h.IntegrationService.Repo(), matcher, conn.OrganizationID, body)
	}

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if booking != nil && h.WebhookService != nil {
		_, _ = h.WebhookService.Dispatch(c.Request.Context(), conn.OrganizationID, models.WebhookEventCampaignReplyReceived, map[string]any{
			"source":        booking.Source,
			"invitee_email": booking.InviteeEmail,
			"event_name":    booking.EventName,
			"scheduled_for": booking.ScheduledFor,
			"contact_id":    booking.ContactID,
			"booking_id":    booking.ID,
			"trigger":       "meeting_booked",
		})
	}
	c.JSON(http.StatusOK, gin.H{"received": true})
}

// InboundDMARC accepts a single RUA XML report. Mailbox providers typically
// email these to a rua= address; the dashboard exposes a forwarder URL the
// user can either POST to directly or hook up to a mail-to-HTTP relay.
func (h *Handler) InboundDMARC(c *gin.Context) {
	secret := strings.TrimSpace(c.Param("secret"))
	if secret == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "secret required"})
		return
	}
	conn, err := h.IntegrationService.Repo().GetConnectionByInboundSecret(c.Request.Context(), models.IntegrationDMARC, secret)
	if err != nil || conn == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "unknown secret"})
		return
	}
	body, err := io.ReadAll(io.LimitReader(c.Request.Body, 5<<20))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "read body failed"})
		return
	}
	report, err := integration.IngestDMARCReport(c.Request.Context(), h.IntegrationService.Repo(), conn.OrganizationID, body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"report_id": report.ID, "domain": report.Domain})
}

// ─── Reads for the dashboard ───────────────────────────────────────────

// ListDMARCReports surfaces ingested DMARC reports for the dashboard
// "deliverability" tab.
func (h *Handler) ListDMARCReports(c *gin.Context) {
	orgID, ok := requireOrgID(c)
	if !ok {
		return
	}
	domain := c.Query("domain")
	reports, err := h.IntegrationService.Repo().ListDMARCReports(c.Request.Context(), orgID, domain, 100)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"reports": reports})
}

// ListPostmasterSnapshots surfaces Postmaster + SNDS rows. The dashboard
// uses this to render the deliverability trend graph.
func (h *Handler) ListPostmasterSnapshots(c *gin.Context) {
	orgID, ok := requireOrgID(c)
	if !ok {
		return
	}
	source := c.Query("source")
	target := c.Query("target")
	rows, err := h.IntegrationService.Repo().ListPostmasterSnapshots(c.Request.Context(), orgID, source, target, 30)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"snapshots": rows})
}

// ListMeetingBookings surfaces booked meetings for the integrations page.
func (h *Handler) ListMeetingBookings(c *gin.Context) {
	orgID, ok := requireOrgID(c)
	if !ok {
		return
	}
	rows, err := h.IntegrationService.Repo().ListMeetingBookings(c.Request.Context(), orgID, 50)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"bookings": rows})
}

// ─── DNS verification ──────────────────────────────────────────────────

type dnsVerifyPayload struct {
	Domain        string `json:"domain"`
	DKIMSelector  string `json:"dkim_selector"`
	TrackingCNAME string `json:"tracking_cname"`
}

// VerifyDNS runs a live SPF/DKIM/DMARC + tracking-CNAME check for a
// domain and persists the snapshot. Returns the verification row so the
// dashboard can render it without a second request.
func (h *Handler) VerifyDNS(c *gin.Context) {
	orgID, ok := requireOrgID(c)
	if !ok {
		return
	}
	var p dnsVerifyPayload
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	v, err := integration.VerifyDNS(c.Request.Context(), h.IntegrationService.Repo(), orgID, integration.DNSVerifyRequest{
		Domain:        p.Domain,
		DKIMSelector:  p.DKIMSelector,
		TrackingCNAME: p.TrackingCNAME,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, v)
}

// ListDNSVerifications returns the latest verification per domain.
func (h *Handler) ListDNSVerifications(c *gin.Context) {
	orgID, ok := requireOrgID(c)
	if !ok {
		return
	}
	rows, err := h.IntegrationService.Repo().ListDNSVerifications(c.Request.Context(), orgID, 50)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"verifications": rows})
}

// ApplyCloudflareRecords is the one-click "set up SPF/DKIM/DMARC on
// Cloudflare" endpoint. Uses the stored API token for the configured
// Cloudflare connection.
type applyDNSPayload struct {
	ConnectionID  uuid.UUID `json:"connection_id"`
	Domain        string    `json:"domain"`
	DKIMSelector  string    `json:"dkim_selector"`
	DKIMPublicKey string    `json:"dkim_public_key"`
	APIToken      string    `json:"api_token"` // optional: override
}

func (h *Handler) ApplyCloudflareRecords(c *gin.Context) {
	orgID, ok := requireOrgID(c)
	if !ok {
		return
	}
	var p applyDNSPayload
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	token := strings.TrimSpace(p.APIToken)
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "api_token is required (or persist via Connect)"})
		return
	}
	client := integration.NewCloudflareClient(token)
	records := integration.RecommendedRecords(p.Domain, p.DKIMSelector, p.DKIMPublicKey)
	if err := client.ApplyRecords(c.Request.Context(), p.Domain, records); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// Mark the connection as synced so the dashboard reflects the action.
	if p.ConnectionID != uuid.Nil {
		_ = h.IntegrationService.MarkSynced(c.Request.Context(), p.ConnectionID, models.IntegrationStatusConnected,
			map[string]any{"last_action": "applied_records", "domain": p.Domain}, "")
	}
	_ = orgID // referenced for symmetry; future per-org rate limiting hooks
	c.JSON(http.StatusOK, gin.H{"applied": len(records), "records": records})
}
