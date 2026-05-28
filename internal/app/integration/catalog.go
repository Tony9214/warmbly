// Package integration owns the third-party integrations surface: catalog
// metadata, per-provider connect/disconnect, inbound webhook handling,
// scheduled pulls (Postmaster/SNDS), DMARC ingestion, and DNS verification.
//
// Per-provider files (calendly.go, dmarc.go, etc) each handle the
// provider-specific request/response shape. The shared service.go ties
// them to the connections repo so the dashboard reads them uniformly.
package integration

import "github.com/warmbly/warmbly/internal/models"

// Catalog returns the static metadata for every integration the dashboard
// renders. Order is the catalog order.
func Catalog() []models.IntegrationCatalogEntry {
	return []models.IntegrationCatalogEntry{
		{
			Provider:    models.IntegrationCalendly,
			Name:        "Calendly",
			Tagline:     "Mark a campaign as converted when a recipient books a meeting.",
			Category:    models.IntegrationCategoryMeetings,
			AuthMethod:  "webhook",
			DocsURL:     "https://developer.calendly.com/api-docs/",
			WebhookHint: "Calendly POSTs invitee.created and invitee.canceled here.",
		},
		{
			Provider:    models.IntegrationCalCom,
			Name:        "Cal.com",
			Tagline:     "Open-source meeting booking. Same conversion attribution as Calendly.",
			Category:    models.IntegrationCategoryMeetings,
			AuthMethod:  "webhook",
			DocsURL:     "https://cal.com/docs/core-features/webhooks",
			WebhookHint: "Cal.com POSTs BOOKING_CREATED events here.",
		},
		{
			Provider:   models.IntegrationGoogleSheets,
			Name:       "Google Sheets",
			Tagline:    "Pull leads from a sheet and push reply / bounce / booked events back to it.",
			Category:   models.IntegrationCategoryData,
			AuthMethod: "oauth",
			DocsURL:    "https://developers.google.com/sheets/api",
			BetaFlag:   true,
		},
		{
			Provider:   models.IntegrationGooglePostmaster,
			Name:       "Google Postmaster",
			Tagline:    "Pull domain reputation + spam-rate signals straight from Google.",
			Category:   models.IntegrationCategoryDeliverability,
			AuthMethod: "oauth",
			DocsURL:    "https://developers.google.com/gmail/postmaster",
		},
		{
			Provider:   models.IntegrationMicrosoftSNDS,
			Name:       "Microsoft SNDS",
			Tagline:    "IP reputation + complaint rate for Outlook / Hotmail.",
			Category:   models.IntegrationCategoryDeliverability,
			AuthMethod: "api_key",
			DocsURL:    "https://sendersupport.olc.protection.outlook.com/snds/",
		},
		{
			Provider:    models.IntegrationDMARC,
			Name:        "DMARC reports",
			Tagline:     "Ingest aggregate (RUA) reports and flag misaligned senders.",
			Category:    models.IntegrationCategoryDeliverability,
			AuthMethod:  "webhook",
			WebhookHint: "POST RUA XML reports here; one report per request.",
		},
		{
			Provider:   models.IntegrationCloudflare,
			Name:       "Cloudflare",
			Tagline:    "One-click SPF / DKIM / DMARC + tracking-domain CNAME.",
			Category:   models.IntegrationCategoryDNS,
			AuthMethod: "api_key",
			DocsURL:    "https://developers.cloudflare.com/api/",
		},
		{
			Provider:   models.IntegrationGoDaddy,
			Name:       "GoDaddy",
			Tagline:    "Write SPF / DKIM / DMARC records from the dashboard.",
			Category:   models.IntegrationCategoryDNS,
			AuthMethod: "api_key",
			DocsURL:    "https://developer.godaddy.com/doc/endpoint/domains",
			BetaFlag:   true,
		},
		{
			Provider:   models.IntegrationNamecheap,
			Name:       "Namecheap",
			Tagline:    "Write SPF / DKIM / DMARC records from the dashboard.",
			Category:   models.IntegrationCategoryDNS,
			AuthMethod: "api_key",
			DocsURL:    "https://www.namecheap.com/support/api/intro/",
			BetaFlag:   true,
		},
	}
}
