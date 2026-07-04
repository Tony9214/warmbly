package msgraph

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/rs/zerolog/log"
	"github.com/warmbly/warmbly/internal/errx"
)

// graphErrorEnvelope is Graph's standard error shape.
type graphErrorEnvelope struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

// HandleError maps a non-2xx Graph response to a MailError. It classifies by
// HTTP status so the send/sync retry loop can tell transient (retryable) from
// critical (needs re-auth / stop) failures:
//   - 401 -> authentication failed (token expired/revoked, re-consent)
//   - 403 -> authorization failed (missing scope / mailbox disabled)
//   - 429 -> sending too fast (throttled; Retry-After honored by the caller loop)
//   - 5xx / other -> server unreachable (retry)
func HandleError(resp *http.Response) *errx.MailError {
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
	var env graphErrorEnvelope
	_ = json.Unmarshal(body, &env)

	switch resp.StatusCode {
	case http.StatusUnauthorized:
		return errx.ErrMailAuthenticationFailed
	case http.StatusForbidden:
		return errx.ErrMailAuthorizationFailed
	case http.StatusTooManyRequests:
		return errx.ErrMailSendingTooFast
	default:
		log.Debug().
			Int("status", resp.StatusCode).
			Str("code", env.Error.Code).
			Str("message", env.Error.Message).
			Msg("Graph API error")
		return errx.ErrMailServerUnreachable
	}
}
