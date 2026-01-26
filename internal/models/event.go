package models

type WorkerEventType string

const (
	WorkerEventTypeSendEmail       WorkerEventType = "SEND_EMAIL"
	WorkerEventTypeAddEmail        WorkerEventType = "ADD_EMAIL"
	WorkerEventTypeRemoveEmail     WorkerEventType = "REMOVE_EMAIL"
	WorkerEventTypeEmailValidation WorkerEventType = "EMAIL_VALIDATION"
)

type WorkerEvent struct {
	Type WorkerEventType `json:"type"`
	Body any             `json:"body"`
}

type JobEventType string

const (
	JobEventTypeNewEmail      JobEventType = "NEW_EMAIL"
	JobEventTypeRemoveEmail   JobEventType = "REMOVE_EMAIL"
	JobEventTypeFlagsAdd      JobEventType = "FLAGS_ADD"
	JobEventTypeFlagsRemove   JobEventType = "FLAGS_REMOVE"
	JobEventTypeEmailUpdate   JobEventType = "UPDATE_EMAIL"
	JobEventTypeMailboxUpdate JobEventType = "UPDATE_MAILBOX"
	JobEventTypeMailboxDelete JobEventType = "DELETE_MAILBOX"

	JobEventTypeTokenUpdate     JobEventType = "TOKEN_UPDATE"
	JobEventTypeHistoryIDUpdate JobEventType = "HISTORY_ID_UPDATE"

	// Task result events from worker
	JobEventTypeEmailSent   JobEventType = "EMAIL_SENT"
	JobEventTypeEmailFailed JobEventType = "EMAIL_FAILED"

	// Error-specific events for worker -> jobsService
	JobEventTypeEmailAuthError   JobEventType = "EMAIL_AUTH_ERROR"     // Needs re-auth
	JobEventTypeEmailDisabled    JobEventType = "EMAIL_DISABLED"       // Account disabled
	JobEventTypeEmailRateLimited JobEventType = "EMAIL_RATE_LIMITED"   // Rate limit hit
	JobEventTypeEmailServerError JobEventType = "EMAIL_SERVER_ERROR"   // Temporary server error
)

type JobEvent struct {
	Type JobEventType `json:"type"`
	Body any          `json:"body"`
}

// EmailErrorEvent represents an email error event sent from worker to jobsService
type EmailErrorEvent struct {
	TaskID         string `json:"task_id"`
	EmailAccountID string `json:"email_account_id"`
	UserID         string `json:"user_id"`
	ErrorCode      string `json:"error_code"`
	ErrorType      string `json:"error_type"`
	ResolveMethod  string `json:"resolve_method"`
	Message        string `json:"message"`
	UserVisible    bool   `json:"user_visible"`
	UserTitle      string `json:"user_title,omitempty"`
	UserMessage    string `json:"user_message,omitempty"`
	ActionRequired string `json:"action_required,omitempty"`
	Timestamp      int64  `json:"timestamp"`
}
