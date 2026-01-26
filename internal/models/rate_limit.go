package models

import (
	"time"

	"github.com/google/uuid"
)

type RateLimitCategory string

const (
	RateLimitRead      RateLimitCategory = "read"
	RateLimitWrite     RateLimitCategory = "write"
	RateLimitBulk      RateLimitCategory = "bulk"
	RateLimitUnibox    RateLimitCategory = "unibox"
	RateLimitAnalytics RateLimitCategory = "analytics"
)

type UserRateLimits struct {
	UserID uuid.UUID `json:"user_id"`

	LimitReadPM      int `json:"limit_read_pm"`
	LimitWritePM     int `json:"limit_write_pm"`
	LimitBulkPM      int `json:"limit_bulk_pm"`
	LimitUniboxPM    int `json:"limit_unibox_pm"`
	LimitAnalyticsPM int `json:"limit_analytics_pm"`

	LimitAPICallsDaily int `json:"limit_api_calls_daily"`
	LimitBulkOpsDaily  int `json:"limit_bulk_ops_daily"`

	BurstMultiplier float64 `json:"burst_multiplier"`

	Notes     *string    `json:"notes,omitempty"`
	UpdatedBy *uuid.UUID `json:"updated_by,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type PlanRateLimits struct {
	PlanID uuid.UUID `json:"plan_id"`

	LimitReadPM      int `json:"limit_read_pm"`
	LimitWritePM     int `json:"limit_write_pm"`
	LimitBulkPM      int `json:"limit_bulk_pm"`
	LimitUniboxPM    int `json:"limit_unibox_pm"`
	LimitAnalyticsPM int `json:"limit_analytics_pm"`

	LimitAPICallsDaily int `json:"limit_api_calls_daily"`
	LimitBulkOpsDaily  int `json:"limit_bulk_ops_daily"`

	BurstMultiplier float64 `json:"burst_multiplier"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type UpdateUserRateLimits struct {
	LimitReadPM      *int `json:"limit_read_pm,omitempty"`
	LimitWritePM     *int `json:"limit_write_pm,omitempty"`
	LimitBulkPM      *int `json:"limit_bulk_pm,omitempty"`
	LimitUniboxPM    *int `json:"limit_unibox_pm,omitempty"`
	LimitAnalyticsPM *int `json:"limit_analytics_pm,omitempty"`

	LimitAPICallsDaily *int `json:"limit_api_calls_daily,omitempty"`
	LimitBulkOpsDaily  *int `json:"limit_bulk_ops_daily,omitempty"`

	BurstMultiplier *float64 `json:"burst_multiplier,omitempty"`
	Notes           *string  `json:"notes,omitempty"`
}

type RateLimitStatus struct {
	Category     RateLimitCategory `json:"category"`
	Limit        int               `json:"limit"`
	Remaining    int               `json:"remaining"`
	ResetAt      time.Time         `json:"reset_at"`
	RetryAfterMs *int64            `json:"retry_after_ms,omitempty"`
}

// DefaultRateLimits returns the default rate limits
func DefaultRateLimits() *UserRateLimits {
	return &UserRateLimits{
		LimitReadPM:        300,
		LimitWritePM:       60,
		LimitBulkPM:        10,
		LimitUniboxPM:      120,
		LimitAnalyticsPM:   60,
		LimitAPICallsDaily: 50000,
		LimitBulkOpsDaily:  100,
		BurstMultiplier:    1.5,
	}
}

// GetLimitForCategory returns the per-minute limit for a given category
func (r *UserRateLimits) GetLimitForCategory(category RateLimitCategory) int {
	switch category {
	case RateLimitRead:
		return r.LimitReadPM
	case RateLimitWrite:
		return r.LimitWritePM
	case RateLimitBulk:
		return r.LimitBulkPM
	case RateLimitUnibox:
		return r.LimitUniboxPM
	case RateLimitAnalytics:
		return r.LimitAnalyticsPM
	default:
		return r.LimitReadPM
	}
}
