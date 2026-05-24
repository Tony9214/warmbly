package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID uuid.UUID `json:"id"`

	FirstName string      `json:"first_name"`
	LastName  string      `json:"last_name"`
	Email     string      `json:"email"`
	Roles     []uuid.UUID `json:"roles"`

	MaxOrganizations int  `json:"max_organizations"`
	FreeTrialUsed    bool `json:"free_trial_used"`

	// Set when the user has scheduled their own account for deletion.
	// While these are populated the account is "pending deletion" and
	// gets hard-deleted at DeletionScheduledFor unless cancelled.
	DeletionScheduledAt  *time.Time `json:"deletion_scheduled_at,omitempty"`
	DeletionScheduledFor *time.Time `json:"deletion_scheduled_for,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// IsPendingDeletion reports whether the user has a pending account deletion.
func (u *User) IsPendingDeletion() bool {
	return u.DeletionScheduledFor != nil
}
