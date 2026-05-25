package models

import (
	"time"

	"github.com/google/uuid"
)

type Campaign struct {
	ID             uuid.UUID  `json:"id"`
	UserID         string     `json:"user_id"`
	OrganizationID *uuid.UUID `json:"organization_id,omitempty"`

	Name        string `json:"name"`
	Description string `json:"description"`
	Status      string `json:"status"`

	StopOnReply       bool `json:"stop_on_reply"`
	OpenTracking      bool `json:"open_tracking"`
	LinkTracking      bool `json:"link_tracking"`
	TextOnly          bool `json:"text_only"`
	DailyLimit        int  `json:"daily_limit"`
	UnsubscribeHeader bool `json:"unscrubscribe_header"`
	RiskyEmails       bool `json:"risky_emails"`

	CC  []string `json:"cc"`
	BCC []string `json:"bcc"`

	StartDate *time.Time `json:"start_date"`
	EndDate   *time.Time `json:"end_date"`
	Timezone  string     `json:"timezone"`
	Days      uint8      `json:"days"`
	StartTime string     `json:"start_time"`
	EndTime   string     `json:"end_time"`

	EmailTags []string `json:"email_tags"`
	Folders   []string `json:"folders"`

	ContactOrderBy    string  `json:"contact_order_by"`
	ContactOrderDir   string  `json:"contact_order_dir"`
	ContactOrderField *string `json:"contact_order_field,omitempty"`

	LastStatusChangeAt *time.Time `json:"last_status_change_at,omitempty"`

	UpdatedAt time.Time `json:"updated_at"`
	CreatedAt time.Time `json:"created_at"`
}

type MiniCampaign struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type CampaignsResult struct {
	Data       []Campaign `json:"data"`
	Pagination Pagination `json:"pagination"`
}

type UpdateCampaign struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Status      *string `json:"status,omitempty"`

	StopOnReply       *bool `json:"stop_on_reply"`
	OpenTracking      *bool `json:"open_tracking"`
	LinkTracking      *bool `json:"link_tracking"`
	TextOnly          *bool `json:"text_only"`
	DailyLimit        *int  `json:"daily_limit"`
	UnsubscribeHeader *bool `json:"unsubscribe_header"`
	RiskyEmails       *bool `json:"risky_emails"`

	CC  []string `json:"cc"`
	BCC []string `json:"bcc"`

	StartDate *time.Time `json:"start_date"`
	EndDate   *time.Time `json:"end_date"`
	Timezone  *string    `json:"timezone"`
	Days      *uint8     `json:"days"`
	StartTime *string    `json:"start_time"`
	EndTime   *string    `json:"end_time"`

	EmailTags []string `json:"email_tags"`
	Folders   []string `json:"folders"`

	ContactOrderBy    *string `json:"contact_order_by"`
	ContactOrderDir   *string `json:"contact_order_dir"`
	ContactOrderField *string `json:"contact_order_field"`
}

// CreateCampaign is the payload accepted by POST /campaigns. Name is required;
// every other field is optional and only applied if the caller sent a non-nil
// value. The wizard sends everything at once; the simple modal can still send
// just {name, description} and get sane defaults.
type CreateCampaign struct {
	Name        string `json:"name"`
	Description string `json:"description"`

	// Sending rules / tracking
	StopOnReply       *bool `json:"stop_on_reply,omitempty"`
	OpenTracking      *bool `json:"open_tracking,omitempty"`
	LinkTracking      *bool `json:"link_tracking,omitempty"`
	TextOnly          *bool `json:"text_only,omitempty"`
	DailyLimit        *int  `json:"daily_limit,omitempty"`
	UnsubscribeHeader *bool `json:"unsubscribe_header,omitempty"`
	RiskyEmails       *bool `json:"risky_emails,omitempty"`

	CC  []string `json:"cc,omitempty"`
	BCC []string `json:"bcc,omitempty"`

	// Schedule
	StartDate *time.Time `json:"start_date,omitempty"`
	EndDate   *time.Time `json:"end_date,omitempty"`
	Timezone  *string    `json:"timezone,omitempty"`
	Days      *uint8     `json:"days,omitempty"`
	StartTime *string    `json:"start_time,omitempty"`
	EndTime   *string    `json:"end_time,omitempty"`

	// Sender pool — accepts UUIDs already created by the user.
	EmailTagIDs []string `json:"email_tag_ids,omitempty"`
	FolderIDs   []string `json:"folder_ids,omitempty"`

	// Initial sequences (in order) — caller can also create them after.
	Sequences []CreateSequenceInput `json:"sequences,omitempty"`

	// A/B variants for the first sequence — useful for "create + test" in one shot.
	Variants []CreateCampaignABVariantRequest `json:"variants,omitempty"`

	// Advanced overrides (bounce/intent/dashboard/etc) — see AdvancedOutreachSettings.
	AdvancedOverrides *AdvancedOutreachSettings `json:"advanced_overrides,omitempty"`
}

// CreateSequenceInput is one step in a sequence. Used during initial campaign
// creation; matches UpdateSequence shape so the wizard can reuse the editor.
type CreateSequenceInput struct {
	Name      string `json:"name"`
	Subject   string `json:"subject"`
	BodyPlain string `json:"body_plain"`
	BodyHTML  string `json:"body_html"`
	BodySync  *bool  `json:"body_sync,omitempty"`
	BodyCode  *bool  `json:"body_code,omitempty"`
	WaitAfter *int   `json:"wait_after,omitempty"`
}
