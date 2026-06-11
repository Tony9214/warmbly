package config

import "context"

type EmailConfig struct {
	EmailName      string
	EmailAddress   string
	TrackingDomain string
	// TrackingLinkSecret signs click-tracking redirects; the tracking service
	// verifies with the same value and refuses anything unsigned. Required:
	// there is no unsigned mode, and rotating it immediately invalidates
	// links signed with the old value.
	TrackingLinkSecret string
}

func (c *Config) LoadEmailConfig(ctx context.Context) (*EmailConfig, error) {
	emailName, err := c.GetStringRaw(ctx, "EMAIL_NAME", "email/name")
	if err != nil {
		return nil, err
	}

	emailAddress, err := c.GetStringRaw(ctx, "EMAIL_ADDRESS", "email/address")
	if err != nil {
		return nil, err
	}

	trackingDomain, err := c.GetStringRaw(ctx, "TRACKING_DOMAIN", "tracking_domain")
	if err != nil {
		return nil, err
	}

	trackingLinkSecret, err := c.GetStringRaw(ctx, "TRACKING_LINK_SECRET", "tracking/link_secret")
	if err != nil {
		return nil, err
	}

	return &EmailConfig{
		EmailName:          emailName,
		EmailAddress:       emailAddress,
		TrackingDomain:     trackingDomain,
		TrackingLinkSecret: trackingLinkSecret,
	}, nil
}
