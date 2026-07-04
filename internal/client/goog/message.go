package goog

import (
	"encoding/base64"
	"fmt"
	"net/mail"
	"strings"
	"time"

	"github.com/warmbly/warmbly/internal/config"
	"github.com/warmbly/warmbly/internal/models"
	"google.golang.org/api/gmail/v1"
)

func getAddressList(headers []*gmail.MessagePartHeader, name string) []string {
	var result []string
	for _, h := range headers {
		if h.Name == name && h.Value != "" {
			// Parse multiple addresses in the header
			addrs, err := mail.ParseAddressList(h.Value)
			if err != nil {
				// fallback: just split by comma
				for v := range strings.SplitSeq(h.Value, ",") {
					result = append(result, strings.TrimSpace(v))
				}
				continue
			}

			// Format as "Name <email@example.com>"
			for _, addr := range addrs {
				if addr.Name != "" {
					result = append(result, fmt.Sprintf("%s <%s>", addr.Name, addr.Address))
				} else {
					result = append(result, addr.Address)
				}
			}
		}
	}
	return result
}

func getSingleHeader(headers []*gmail.MessagePartHeader, name string) string {
	for _, h := range headers {
		// RFC 5322 header names are case-insensitive; match accordingly so the
		// warmup token (and other headers) resolve regardless of provider casing.
		if strings.EqualFold(h.Name, name) {
			return h.Value
		}
	}
	return ""
}

func extractBody(parts []*gmail.MessagePart) (plain, html string) {
	for _, p := range parts {
		if p.MimeType == "text/plain" && p.Body != nil && p.Body.Data != "" {
			decoded, _ := base64.URLEncoding.DecodeString(p.Body.Data)
			plain += string(decoded)
		} else if p.MimeType == "text/html" && p.Body != nil && p.Body.Data != "" {
			decoded, _ := base64.URLEncoding.DecodeString(p.Body.Data)
			html += string(decoded)
		} else if len(p.Parts) > 0 {
			pPlain, pHTML := extractBody(p.Parts)
			plain += pPlain
			html += pHTML
		}
	}
	return
}

func parseGmailDate(dateText string) time.Time {
	date, err := mail.ParseDate(dateText)
	if err != nil {
		return time.Time{}
	}
	return date
}

func GmailMessageToEmailData(msg *gmail.Message) *models.EmailMessageData {
	headers := msg.Payload.Headers

	return &models.EmailMessageData{
		GmailID:  msg.Id,
		UID:      0, // Gmail has no IMAP UID
		ThreadID: msg.ThreadId,
		Flags: func() []string {
			flags := []string{}
			for _, label := range msg.LabelIds {
				switch label {
				case "UNREAD":
					flags = append(flags, "\\Seen")
				case "STARRED":
					flags = append(flags, "\\Flagged")
				case "IMPORTANT":
					flags = append(flags, "\\Important")
				case "DRAFT":
					flags = append(flags, "\\Draft")
				}
			}
			// Surface the warmup verification token as a pseudo-flag so the
			// consumer can categorize warmup mail into the Warmbly folder.
			if tok := getSingleHeader(headers, config.WarmupVerifyHeader); tok != "" {
				flags = append(flags, config.WarmupVerifyHeader+":"+tok)
			}
			// Surface machine-reply / DSN-bounce markers so the consumer's
			// reply/bounce classifier can read them.
			for _, name := range config.InboundClassificationHeaders {
				if v := strings.TrimSpace(getSingleHeader(headers, name)); v != "" {
					flags = append(flags, name+":"+v)
				}
			}
			return flags
		}(),
		BCC:          getAddressList(headers, "Bcc"),
		CC:           getAddressList(headers, "Cc"),
		Date:         parseGmailDate(getSingleHeader(headers, "Date")),
		From:         getAddressList(headers, "From"),
		InReplyTo:    getAddressList(headers, "In-Reply-To"),
		MessageID:    getSingleHeader(headers, "Message-ID"),
		ReplyTo:      getAddressList(headers, "Reply-To"),
		Sender:       getAddressList(headers, "Sender"),
		Subject:      getSingleHeader(headers, "Subject"),
		To:           getAddressList(headers, "To"),
		Size:         msg.SizeEstimate,
		InternalDate: time.Unix(msg.InternalDate/1000, 0),
		ModSeq:       msg.HistoryId,
		BodyPlain: func() string {
			plain, _ := extractBody(msg.Payload.Parts)
			return plain
		}(),
		BodyHTML: func() string {
			_, html := extractBody(msg.Payload.Parts)
			return html
		}(),
	}
}
