package models

import (
	"time"

	"github.com/google/uuid"
)

// AdminOutreachStatus mirrors the postgres enum from migration 000047.
type AdminOutreachStatus string

const (
	AdminOutreachStatusQueued AdminOutreachStatus = "queued"
	AdminOutreachStatusSent   AdminOutreachStatus = "sent"
	AdminOutreachStatusFailed AdminOutreachStatus = "failed"
)

// AdminOutreachMessage is one row of the admin-outreach audit log.
// to_user_id / to_org_id are nil when the admin types a raw email
// address; to_email is always populated.
type AdminOutreachMessage struct {
	ID        uuid.UUID           `json:"id"`
	SentBy    uuid.UUID           `json:"sent_by"`
	ToUserID  *uuid.UUID          `json:"to_user_id,omitempty"`
	ToOrgID   *uuid.UUID          `json:"to_org_id,omitempty"`
	ToEmail   string              `json:"to_email"`
	ReplyTo   *string             `json:"reply_to,omitempty"`
	Subject   string              `json:"subject"`
	Body      string              `json:"body"`
	Status    AdminOutreachStatus `json:"status"`
	Error     *string             `json:"error,omitempty"`
	SentAt    *time.Time          `json:"sent_at,omitempty"`
	CreatedAt time.Time           `json:"created_at"`

	// Joined data.
	SentByUser    *AdminUserSummary `json:"sent_by_user,omitempty"`
	ToUserSummary *AdminUserSummary `json:"to_user,omitempty"`
}

// SendAdminOutreachRequest is what the composer POSTs. Exactly one of
// to_user_id / to_org_id / to_email must be set; the service resolves
// the canonical recipient address from there.
type SendAdminOutreachRequest struct {
	ToUserID *uuid.UUID `json:"to_user_id,omitempty"`
	ToOrgID  *uuid.UUID `json:"to_org_id,omitempty"`
	ToEmail  string     `json:"to_email,omitempty"`
	ReplyTo  string     `json:"reply_to,omitempty"`
	Subject  string     `json:"subject" binding:"required,min=1,max=998"`
	Body     string     `json:"body" binding:"required,min=1"`
}
