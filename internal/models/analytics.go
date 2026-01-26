package models

import (
	"time"

	"github.com/google/uuid"
)

type DateRange struct {
	From time.Time `json:"from"`
	To   time.Time `json:"to"`
}

// Warmup Analytics

type WarmupAnalytics struct {
	EmailAccountID uuid.UUID          `json:"email_account_id"`
	Email          string             `json:"email"`
	DateRange      DateRange          `json:"date_range"`
	Summary        WarmupSummary      `json:"summary"`
	DailyStats     []WarmupDailyStats `json:"daily_stats"`
}

type WarmupSummary struct {
	TotalSent      int     `json:"total_sent"`
	TotalReplied   int     `json:"total_replied"`
	AverageDaily   float64 `json:"average_daily"`
	ReplyRate      float64 `json:"reply_rate"`      // percentage
	TargetProgress float64 `json:"target_progress"` // percentage to max
	DaysActive     int     `json:"days_active"`
}

type WarmupDailyStats struct {
	Date          string `json:"date"` // YYYY-MM-DD
	EmailsSent    int    `json:"emails_sent"`
	EmailsReplied int    `json:"emails_replied"`
	TargetVolume  int    `json:"target_volume"`
}

// Campaign Analytics

type CampaignAnalytics struct {
	CampaignID uuid.UUID            `json:"campaign_id"`
	Name       string               `json:"name"`
	Status     string               `json:"status"`
	DateRange  DateRange            `json:"date_range"`
	Summary    CampaignSummary      `json:"summary"`
	Sequences  []SequenceStats      `json:"sequences"`
	DailyStats []CampaignDailyStats `json:"daily_stats,omitempty"`
}

type CampaignSummary struct {
	TotalContacts int `json:"total_contacts"`
	EmailsSent    int `json:"emails_sent"`
	EmailsPending int `json:"emails_pending"`
	UniqueOpens   int `json:"unique_opens"`
	UniqueClicks  int `json:"unique_clicks"`
	Replies       int `json:"replies"`
	Bounces       int `json:"bounces"`
	Unsubscribes  int `json:"unsubscribes"`

	OpenRate   float64 `json:"open_rate"`   // percentage
	ClickRate  float64 `json:"click_rate"`  // percentage
	ReplyRate  float64 `json:"reply_rate"`  // percentage
	BounceRate float64 `json:"bounce_rate"` // percentage
}

type SequenceStats struct {
	SequenceID uuid.UUID `json:"sequence_id"`
	Name       string    `json:"name"`
	Position   int       `json:"position"`
	EmailsSent int       `json:"emails_sent"`
	Opens      int       `json:"opens"`
	Clicks     int       `json:"clicks"`
	Replies    int       `json:"replies"`
	Bounces    int       `json:"bounces"`
}

type CampaignDailyStats struct {
	Date    string `json:"date"`
	Sent    int    `json:"sent"`
	Opens   int    `json:"opens"`
	Clicks  int    `json:"clicks"`
	Replies int    `json:"replies"`
}

// Email Account Status

type EmailAccountStatus struct {
	ID           uuid.UUID         `json:"id"`
	Email        string            `json:"email"`
	Provider     string            `json:"provider"`
	Status       string            `json:"status"`
	LastSyncedAt *time.Time        `json:"last_synced_at"`
	Health       AccountHealth     `json:"health"`
	Errors       []AccountError    `json:"errors"`
	DailyUsage   AccountDailyUsage `json:"daily_usage"`
	WarmupStatus *WarmupStatusInfo `json:"warmup_status,omitempty"`
}

type AccountHealth struct {
	Status string   `json:"status"` // healthy, warning, error
	Score  int      `json:"score"`  // 0-100
	Issues []string `json:"issues,omitempty"`
}

type AccountError struct {
	ID             uuid.UUID `json:"id"`
	ErrorCode      string    `json:"error_code"`
	Severity       string    `json:"severity"`
	Title          string    `json:"title"`
	Message        string    `json:"message"`
	ActionRequired *string   `json:"action_required,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

type AccountDailyUsage struct {
	Date          string `json:"date"`
	CampaignSent  int    `json:"campaign_sent"`
	CampaignLimit int    `json:"campaign_limit"`
	WarmupSent    int    `json:"warmup_sent,omitempty"`
	WarmupLimit   int    `json:"warmup_limit,omitempty"`
}

type WarmupStatusInfo struct {
	Enabled       bool      `json:"enabled"`
	StartedAt     time.Time `json:"started_at"`
	CurrentVolume int       `json:"current_volume"`
	TargetVolume  int       `json:"target_volume"`
	MaxVolume     int       `json:"max_volume"`
	ReplyRate     int       `json:"reply_rate"`
	DaysActive    int       `json:"days_active"`
}

// Usage Overview

type UsageOverview struct {
	UserID uuid.UUID `json:"user_id"`
	Period string    `json:"period"` // day, week, month

	EmailAccounts AccountsUsage  `json:"email_accounts"`
	Campaigns     CampaignsUsage `json:"campaigns"`
	Contacts      ContactsUsage  `json:"contacts"`
	API           APIUsage       `json:"api"`
}

type AccountsUsage struct {
	Total      int `json:"total"`
	Active     int `json:"active"`
	InWarmup   int `json:"in_warmup"`
	WithErrors int `json:"with_errors"`
}

type CampaignsUsage struct {
	Total      int `json:"total"`
	Active     int `json:"active"`
	Paused     int `json:"paused"`
	Draft      int `json:"draft"`
	EmailsSent int `json:"emails_sent"`
}

type ContactsUsage struct {
	Total      int `json:"total"`
	Subscribed int `json:"subscribed"`
	AddedToday int `json:"added_today"`
}

type APIUsage struct {
	TotalCalls   int             `json:"total_calls"`
	DailyLimit   int             `json:"daily_limit"`
	TopEndpoints []EndpointUsage `json:"top_endpoints"`
}

type EndpointUsage struct {
	Endpoint string `json:"endpoint"`
	Calls    int    `json:"calls"`
}
