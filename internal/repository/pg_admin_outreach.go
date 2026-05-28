package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/warmbly/warmbly/internal/models"
)

// AdminOutreachRepository is the persistence layer for the
// admin-outreach audit log. Writes happen in two phases:
//   1. Insert the row with status='queued' so the audit story exists
//      even if the SMTP/SES call hangs or panics.
//   2. After the send returns, MarkSent / MarkFailed transitions the
//      row to its terminal state and records the error if any.
type AdminOutreachRepository interface {
	Insert(ctx context.Context, m *models.AdminOutreachMessage) error
	MarkSent(ctx context.Context, id uuid.UUID) error
	MarkFailed(ctx context.Context, id uuid.UUID, errMsg string) error
	List(ctx context.Context, limit int) ([]models.AdminOutreachMessage, error)
}

type adminOutreachRepository struct {
	db *pgxpool.Pool
}

func NewAdminOutreachRepository(db *pgxpool.Pool) AdminOutreachRepository {
	return &adminOutreachRepository{db: db}
}

func (r *adminOutreachRepository) Insert(ctx context.Context, m *models.AdminOutreachMessage) error {
	const q = `
		INSERT INTO admin_outreach_messages
			(id, sent_by, to_user_id, to_org_id, to_email, reply_to, subject, body, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'queued', NOW())
		RETURNING created_at`
	return r.db.QueryRow(ctx, q,
		m.ID, m.SentBy, m.ToUserID, m.ToOrgID, m.ToEmail, m.ReplyTo, m.Subject, m.Body,
	).Scan(&m.CreatedAt)
}

func (r *adminOutreachRepository) MarkSent(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `UPDATE admin_outreach_messages SET status = 'sent', sent_at = NOW() WHERE id = $1`, id)
	return err
}

func (r *adminOutreachRepository) MarkFailed(ctx context.Context, id uuid.UUID, errMsg string) error {
	_, err := r.db.Exec(ctx, `UPDATE admin_outreach_messages SET status = 'failed', error = $2 WHERE id = $1`, id, errMsg)
	return err
}

func (r *adminOutreachRepository) List(ctx context.Context, limit int) ([]models.AdminOutreachMessage, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	const q = `
		SELECT m.id, m.sent_by, m.to_user_id, m.to_org_id, m.to_email, m.reply_to,
			m.subject, m.body, m.status, m.error, m.sent_at, m.created_at,
			s.id, s.first_name, s.last_name, s.email,
			COALESCE(u.id, '00000000-0000-0000-0000-000000000000'::uuid),
			COALESCE(u.first_name, ''), COALESCE(u.last_name, ''), COALESCE(u.email, '')
		FROM admin_outreach_messages m
		JOIN users s ON s.id = m.sent_by
		LEFT JOIN users u ON u.id = m.to_user_id
		ORDER BY m.created_at DESC
		LIMIT $1`

	rows, err := r.db.Query(ctx, q, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.AdminOutreachMessage{}
	for rows.Next() {
		var m models.AdminOutreachMessage
		var sender models.AdminUserSummary
		var toUserID uuid.UUID
		var toFN, toLN, toEmail string
		if err := rows.Scan(
			&m.ID, &m.SentBy, &m.ToUserID, &m.ToOrgID, &m.ToEmail, &m.ReplyTo,
			&m.Subject, &m.Body, &m.Status, &m.Error, &m.SentAt, &m.CreatedAt,
			&sender.ID, &sender.FirstName, &sender.LastName, &sender.Email,
			&toUserID, &toFN, &toLN, &toEmail,
		); err != nil {
			return nil, err
		}
		m.SentByUser = &sender
		if m.ToUserID != nil {
			m.ToUserSummary = &models.AdminUserSummary{
				ID: toUserID, FirstName: toFN, LastName: toLN, Email: toEmail,
			}
		}
		out = append(out, m)
	}
	return out, nil
}

// compile-time check
var _ = pgx.ErrNoRows
