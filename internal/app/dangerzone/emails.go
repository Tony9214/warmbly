package dangerzone

import (
	"fmt"
	"html"
	"strings"
	"time"

	"github.com/warmbly/warmbly/internal/models"
)

// The danger-zone emails deliberately repeat the same essentials in every
// message: what's being deleted, when it will happen (absolute UTC date),
// and a single one-click cancel link. People skim, especially on phones.

const emailWrapperOpen = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f6f7f9;margin:0;padding:24px;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;border:1px solid #e5e7eb;">
<tr><td style="padding:32px;">`

const emailWrapperClose = `<p style="color:#6b7280;font-size:12px;margin-top:32px;border-top:1px solid #e5e7eb;padding-top:16px;">
You're receiving this because a destructive action was scheduled on your account. If you didn't request this, cancel it right away and reset your password.
</p></td></tr></table></body></html>`

func orgScheduledHTML(org *models.Organization, d *models.ScheduledDeletion, baseURL string) string {
	link := baseURL + "/organization/settings/danger-zone"
	var b strings.Builder
	b.WriteString(emailWrapperOpen)
	fmt.Fprintf(&b, `<h2 style="color:#b91c1c;margin:0 0 16px;font-size:22px;">Organization scheduled for deletion</h2>`)
	fmt.Fprintf(&b, `<p style="font-size:16px;color:#111827;line-height:24px;">Your organization <strong>%s</strong> has been scheduled for permanent deletion.</p>`, html.EscapeString(org.Name))
	b.WriteString(deletionDetailsBlock(d))
	b.WriteString(`<h3 style="color:#111827;margin:24px 0 12px;">What happens now</h3>`)
	b.WriteString(`<ul style="font-size:15px;color:#374151;line-height:22px;padding-left:20px;">
		<li>Campaigns continue running until the deletion date.</li>
		<li>All members keep access during the grace period.</li>
		<li>On the deletion date, the organization and all associated data are permanently removed. This cannot be undone.</li>
	</ul>`)
	fmt.Fprintf(&b, `<p style="text-align:center;margin:32px 0;"><a href="%s" style="background:#111827;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600;">Cancel deletion</a></p>`, html.EscapeString(link))
	b.WriteString(emailWrapperClose)
	return b.String()
}

func orgCancelledHTML(org *models.Organization, d *models.ScheduledDeletion) string {
	var b strings.Builder
	b.WriteString(emailWrapperOpen)
	fmt.Fprintf(&b, `<h2 style="color:#047857;margin:0 0 16px;font-size:22px;">Deletion cancelled</h2>`)
	fmt.Fprintf(&b, `<p style="font-size:16px;color:#111827;line-height:24px;">The scheduled deletion for <strong>%s</strong> has been cancelled. Your organization is safe and operating normally.</p>`, html.EscapeString(org.Name))
	fmt.Fprintf(&b, `<p style="font-size:14px;color:#6b7280;">Originally scheduled for: %s</p>`, formatUTC(d.ExecuteAfter))
	b.WriteString(emailWrapperClose)
	return b.String()
}

func userScheduledHTML(user *models.User, d *models.ScheduledDeletion, baseURL string) string {
	link := baseURL + "/account/danger-zone"
	var b strings.Builder
	b.WriteString(emailWrapperOpen)
	fmt.Fprintf(&b, `<h2 style="color:#b91c1c;margin:0 0 16px;font-size:22px;">Account scheduled for deletion</h2>`)
	fmt.Fprintf(&b, `<p style="font-size:16px;color:#111827;line-height:24px;">Hi %s, your Warmbly account has been scheduled for permanent deletion.</p>`, html.EscapeString(firstNameOrEmail(user)))
	b.WriteString(deletionDetailsBlock(d))
	b.WriteString(`<h3 style="color:#111827;margin:24px 0 12px;">What happens now</h3>`)
	b.WriteString(`<ul style="font-size:15px;color:#374151;line-height:22px;padding-left:20px;">
		<li>You can keep using your account during the grace period.</li>
		<li>Cancelling at any time before the deletion date keeps your account intact.</li>
		<li>On the deletion date, your account and all owned data are permanently removed.</li>
	</ul>`)
	fmt.Fprintf(&b, `<p style="text-align:center;margin:32px 0;"><a href="%s" style="background:#111827;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600;">Cancel deletion</a></p>`, html.EscapeString(link))
	b.WriteString(emailWrapperClose)
	return b.String()
}

func userCancelledHTML(user *models.User, d *models.ScheduledDeletion) string {
	var b strings.Builder
	b.WriteString(emailWrapperOpen)
	fmt.Fprintf(&b, `<h2 style="color:#047857;margin:0 0 16px;font-size:22px;">Account deletion cancelled</h2>`)
	fmt.Fprintf(&b, `<p style="font-size:16px;color:#111827;line-height:24px;">Hi %s, the scheduled deletion of your account has been cancelled. Your account is active and back to normal.</p>`, html.EscapeString(firstNameOrEmail(user)))
	fmt.Fprintf(&b, `<p style="font-size:14px;color:#6b7280;">Originally scheduled for: %s</p>`, formatUTC(d.ExecuteAfter))
	b.WriteString(emailWrapperClose)
	return b.String()
}

func reminderHTML(resourceName string, d *models.ScheduledDeletion, baseURL string) string {
	link := baseURL + "/account/danger-zone"
	if d.ResourceType == models.DeletionResourceOrganization {
		link = baseURL + "/organization/settings/danger-zone"
	}

	remaining := time.Until(d.ExecuteAfter)
	hours := int(remaining.Hours())
	var window string
	switch {
	case hours <= 24:
		window = "less than 24 hours"
	case hours <= 24*8:
		window = fmt.Sprintf("about %d days", hours/24)
	default:
		window = fmt.Sprintf("%d days", hours/24)
	}

	var b strings.Builder
	b.WriteString(emailWrapperOpen)
	fmt.Fprintf(&b, `<h2 style="color:#b45309;margin:0 0 16px;font-size:22px;">Deletion in %s</h2>`, window)
	fmt.Fprintf(&b, `<p style="font-size:16px;color:#111827;line-height:24px;"><strong>%s</strong> is scheduled to be permanently deleted on <strong>%s</strong>.</p>`, html.EscapeString(resourceName), formatUTC(d.ExecuteAfter))
	b.WriteString(`<p style="font-size:15px;color:#374151;line-height:22px;">If you didn't mean to do this, cancel now while you still can. After the deletion runs, recovery is not possible.</p>`)
	fmt.Fprintf(&b, `<p style="text-align:center;margin:32px 0;"><a href="%s" style="background:#b45309;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600;">Cancel deletion</a></p>`, html.EscapeString(link))
	b.WriteString(emailWrapperClose)
	return b.String()
}

func completionHTML(d *models.ScheduledDeletion) string {
	var b strings.Builder
	b.WriteString(emailWrapperOpen)
	fmt.Fprintf(&b, `<h2 style="color:#111827;margin:0 0 16px;font-size:22px;">Deletion completed</h2>`)
	fmt.Fprintf(&b, `<p style="font-size:16px;color:#111827;line-height:24px;">The scheduled deletion has been completed. All associated data has been permanently removed.</p>`)
	fmt.Fprintf(&b, `<p style="font-size:14px;color:#6b7280;">Scheduled at: %s<br/>Executed at: %s</p>`, formatUTC(d.ScheduledAt), formatUTC(time.Now()))
	b.WriteString(emailWrapperClose)
	return b.String()
}

func deletionDetailsBlock(d *models.ScheduledDeletion) string {
	var b strings.Builder
	b.WriteString(`<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;margin:16px 0;">
		<tr><td style="padding:16px;">`)
	fmt.Fprintf(&b, `<p style="margin:0 0 8px;font-size:14px;color:#7f1d1d;"><strong>Will be deleted on:</strong></p>`)
	fmt.Fprintf(&b, `<p style="margin:0;font-size:18px;color:#111827;font-weight:600;">%s</p>`, formatUTC(d.ExecuteAfter))
	fmt.Fprintf(&b, `<p style="margin:12px 0 0;font-size:13px;color:#7f1d1d;">Grace period: %d days. You can cancel anytime before that date.</p>`, d.GraceDays)
	b.WriteString(`</td></tr></table>`)
	return b.String()
}

func formatUTC(t time.Time) string {
	return t.UTC().Format("Monday, 02 January 2006 at 15:04 UTC")
}

func firstNameOrEmail(u *models.User) string {
	if strings.TrimSpace(u.FirstName) != "" {
		return u.FirstName
	}
	return u.Email
}
