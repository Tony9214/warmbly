package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/warmbly/warmbly/internal/app/tz"
	"github.com/warmbly/warmbly/internal/bitmask"
	"github.com/warmbly/warmbly/internal/config"
	"github.com/warmbly/warmbly/internal/errx"
	"github.com/warmbly/warmbly/internal/infrastructure/db"
	"github.com/warmbly/warmbly/internal/models"
	"github.com/warmbly/warmbly/internal/utils/validate"
)

type CampaignRepository interface {
	Create(ctx context.Context, userID string, orgID *uuid.UUID, data *models.CreateCampaign) (*models.Campaign, *errx.Error)
	Get(ctx context.Context, userID, id string) (*models.Campaign, error)
	GetByID(ctx context.Context, campaignID uuid.UUID) (*models.Campaign, error)
	GetSequenceByID(ctx context.Context, sequenceID uuid.UUID) (*models.Sequence, error)
	GetSequencesByCampaignID(ctx context.Context, campaignID uuid.UUID) ([]models.Sequence, error)
	Search(ctx context.Context, userID, query string, cursor, folder *string, limit int32) (*models.CampaignsResult, error)
	Update(ctx context.Context, userID, query string, data *models.UpdateCampaign) (*models.Campaign, *errx.Error)
	UpdateStatus(ctx context.Context, campaignID uuid.UUID, status string) error
	UpdateStatusWithLock(ctx context.Context, campaignID uuid.UUID, status string) error
	PauseAllByUserID(ctx context.Context, userID uuid.UUID, reason string) error
	Delete(ctx context.Context, userID, id string) error

	// Campaign start/stop
	StartCampaign(ctx context.Context, campaignID uuid.UUID) error
	StopCampaign(ctx context.Context, campaignID uuid.UUID) error
	ValidateCampaignReady(ctx context.Context, campaignID uuid.UUID) error
	GetPendingCampaignTasks(ctx context.Context, campaignID uuid.UUID) ([]Task, error)
	CountActiveForOrganization(ctx context.Context, orgID uuid.UUID) (int, error)
	AccountHasActiveCampaign(ctx context.Context, accountID uuid.UUID) (bool, error)
}

type campaignRepository struct {
	DB *db.DB
}

func NewCampaignRepostory(db *db.DB) CampaignRepository {
	return &campaignRepository{
		DB: db,
	}
}

const CAMPAIGN_SELECT = `id, name, description, status,
		  stop_on_reply, open_tracking, link_tracking,
		  text_only, daily_limit, unsubscribe_header, risky_emails,
		  cc_addr, bcc_addr, start_date, end_date, timezone, days,
		  start_time, end_time,
		  contact_order_by, contact_order_dir, contact_order_field,
		  updated_at, created_at`

func getCampaign(rows db.Scannable, campaign *models.Campaign, extra ...any) error {
	var dest []any = []any{
		&campaign.ID, &campaign.Name, &campaign.Description, &campaign.Status,
		&campaign.StopOnReply, &campaign.OpenTracking, &campaign.LinkTracking,
		&campaign.TextOnly, &campaign.DailyLimit, &campaign.UnsubscribeHeader, &campaign.RiskyEmails,
		&campaign.CC, &campaign.BCC, &campaign.StartDate, &campaign.EndDate, &campaign.Timezone, &campaign.Days,
		&campaign.StartTime, &campaign.EndTime,
		&campaign.ContactOrderBy, &campaign.ContactOrderDir, &campaign.ContactOrderField,
		&campaign.UpdatedAt, &campaign.CreatedAt,
	}
	dest = append(dest, extra...)
	return rows.Scan(
		dest...,
	)
}

const CAMPAIGN_SELECT_FULL = `
	c.id, c.name, c.description, c.status,
	c.stop_on_reply, c.open_tracking, c.link_tracking,
	c.text_only, c.daily_limit, c.unsubscribe_header, c.risky_emails,
	c.cc_addr, c.bcc_addr, c.start_date, c.end_date, c.timezone, c.days,
	c.start_time, c.end_time,
	c.contact_order_by, c.contact_order_dir, c.contact_order_field,
	c.updated_at, c.created_at,
	COALESCE(array_agg(cet.tag_id) FILTER (WHERE cet.tag_id IS NOT NULL), '{}') AS email_tag_ids,
	COALESCE(array_agg(cec.folder_id) FILTER (WHERE cec.folder_id IS NOT NULL), '{}') AS email_folder_ids
`

func getCampaignFull(rows db.Scannable, campaign *models.Campaign) error {
	return getCampaign(rows, campaign, &campaign.EmailTags, &campaign.Folders)
}

// Create inserts a new campaign and, in the same transaction, applies every
// optional bit of initial config the caller sent (schedule, tracking flags,
// sender pool, initial sequences, A/B variants, advanced overrides). The
// previous version omitted updated_at/created_at which are NOT NULL and have
// no DEFAULT, so any call returned a 500.
func (r *campaignRepository) Create(ctx context.Context, userID string, orgID *uuid.UUID, data *models.CreateCampaign) (*models.Campaign, *errx.Error) {
	// Validate all optional inputs up front so we don't open a tx for a
	// payload we'll reject. Required fields are validated by the service.
	days := bitmask.DefaultDays()
	if data.Days != nil {
		if err := validate.CampaignDays(*data.Days); err != nil {
			return nil, err
		}
		days = *data.Days
	}
	timezone := "Europe/London"
	if data.Timezone != nil {
		if !tz.Valid(*data.Timezone) {
			return nil, errx.ErrTimezone
		}
		timezone = *data.Timezone
	}
	startTime := "08:00"
	if data.StartTime != nil {
		if err := validate.CampaignTime(*data.StartTime); err != nil {
			return nil, err
		}
		startTime = *data.StartTime
	}
	endTime := "18:00"
	if data.EndTime != nil {
		if err := validate.CampaignTime(*data.EndTime); err != nil {
			return nil, err
		}
		endTime = *data.EndTime
	}
	if data.StartDate != nil {
		if err := validate.CampaignStartDate(*data.StartDate); err != nil {
			return nil, err
		}
	}
	if data.EndDate != nil {
		if err := validate.CampaignEndDate(*data.EndDate); err != nil {
			return nil, err
		}
	}
	dailyLimit := config.CampaignLimitDefault
	if data.DailyLimit != nil {
		if err := validate.CampaignDailyLimit(*data.DailyLimit); err != nil {
			return nil, err
		}
		dailyLimit = *data.DailyLimit
	}
	if data.CC != nil && !validate.EmailBulk(data.CC) {
		return nil, errx.ErrEmail
	}
	if data.BCC != nil && !validate.EmailBulk(data.BCC) {
		return nil, errx.ErrEmail
	}
	for i, seq := range data.Sequences {
		if len(seq.Name) > 50 {
			return nil, errx.ErrSequenceName
		}
		if len(seq.Subject) > config.SequenceSubjectLimit {
			return nil, errx.ErrSequenceSubject
		}
		if len(seq.BodyPlain) > config.SequenceBodyLimit || len(seq.BodyHTML) > config.SequenceBodyLimit {
			return nil, errx.ErrSequenceBody
		}
		if seq.Name == "" {
			data.Sequences[i].Name = fmt.Sprintf("Step %d", i+1)
		}
	}
	for _, v := range data.Variants {
		if v.Name == "" {
			return nil, errx.New(errx.BadRequest, "A/B variant name is required")
		}
		if len(v.Subject) > config.SequenceSubjectLimit {
			return nil, errx.ErrSequenceSubject
		}
		if len(v.BodyPlain) > config.SequenceBodyLimit || len(v.BodyHTML) > config.SequenceBodyLimit {
			return nil, errx.ErrSequenceBody
		}
	}

	cc := data.CC
	if cc == nil {
		cc = []string{}
	}
	bcc := data.BCC
	if bcc == nil {
		bcc = []string{}
	}

	stopOnReply := false
	if data.StopOnReply != nil {
		stopOnReply = *data.StopOnReply
	}
	openTracking := false
	if data.OpenTracking != nil {
		openTracking = *data.OpenTracking
	}
	linkTracking := false
	if data.LinkTracking != nil {
		linkTracking = *data.LinkTracking
	}
	textOnly := false
	if data.TextOnly != nil {
		textOnly = *data.TextOnly
	}
	unsubHeader := true
	if data.UnsubscribeHeader != nil {
		unsubHeader = *data.UnsubscribeHeader
	}
	riskyEmails := true
	if data.RiskyEmails != nil {
		riskyEmails = *data.RiskyEmails
	}

	tx, err := r.DB.Begin(ctx)
	if err != nil {
		db.CaptureError(err, "", nil, "begin")
		return nil, errx.InternalError()
	}
	var committed bool
	defer func() {
		if !committed {
			tx.Rollback(ctx)
		}
	}()

	var campaign models.Campaign

	insertSQL := fmt.Sprintf(`
		INSERT INTO campaigns (
			id, name, description, user_id, organization_id,
			stop_on_reply, open_tracking, link_tracking, text_only,
			daily_limit, unsubscribe_header, risky_emails,
			cc_addr, bcc_addr,
			start_date, end_date, timezone, days, start_time, end_time,
			created_at, updated_at
		) VALUES (
			gen_random_uuid(), $1, $2, $3, $4,
			$5, $6, $7, $8,
			$9, $10, $11,
			$12, $13,
			$14, $15, $16, $17, $18, $19,
			NOW(), NOW()
		)
		RETURNING %s
	`, CAMPAIGN_SELECT)

	params := []any{
		data.Name,        // $1
		data.Description, // $2
		userID,           // $3
		orgID,            // $4 (nullable)
		stopOnReply,      // $5
		openTracking,     // $6
		linkTracking,     // $7
		textOnly,         // $8
		dailyLimit,       // $9
		unsubHeader,      // $10
		riskyEmails,      // $11
		cc,               // $12
		bcc,              // $13
		data.StartDate,   // $14
		data.EndDate,     // $15
		timezone,         // $16
		days,             // $17
		startTime,        // $18
		endTime,          // $19
	}

	row := tx.QueryRow(ctx, insertSQL, params...)
	if err := getCampaign(row, &campaign); err != nil {
		db.CaptureError(err, insertSQL, params, "queryrow")
		return nil, errx.InternalError()
	}
	if orgID != nil {
		campaign.OrganizationID = orgID
	}

	// Sender pool — email tag links.
	campaign.EmailTags = make([]string, 0)
	if len(data.EmailTagIDs) > 0 {
		tags, xerr := SyncCampaignEmailTags(ctx, tx, campaign.ID.String(), data.EmailTagIDs)
		if xerr != nil {
			return nil, xerr
		}
		campaign.EmailTags = tags
	}

	// Folder links.
	campaign.Folders = make([]string, 0)
	if len(data.FolderIDs) > 0 {
		folders, xerr := SyncCampaignFolders(ctx, tx, campaign.ID.String(), data.FolderIDs)
		if xerr != nil {
			return nil, xerr
		}
		campaign.Folders = folders
	}

	// Initial sequences. Position is the array index; wait_after defaults
	// to 0 for the first step and 3 days for any follow-ups so a default
	// wizard run still produces something usable.
	if len(data.Sequences) > 0 {
		for i, seq := range data.Sequences {
			waitAfter := 0
			if i > 0 {
				waitAfter = 3
			}
			if seq.WaitAfter != nil {
				waitAfter = *seq.WaitAfter
			}
			bodySync := true
			if seq.BodySync != nil {
				bodySync = *seq.BodySync
			}
			bodyCode := false
			if seq.BodyCode != nil {
				bodyCode = *seq.BodyCode
			}
			bodyHTML := seq.BodyHTML
			if bodyHTML == "" {
				bodyHTML = "<div></div>"
			}
			seqInsert := `
				INSERT INTO sequences (
					campaign_id, organization_id, name, subject,
					body_plain, body_html, body_sync, body_code,
					wait_after, position
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
			`
			seqParams := []any{
				campaign.ID, orgID, seq.Name, seq.Subject,
				seq.BodyPlain, bodyHTML, bodySync, bodyCode,
				waitAfter, i + 1,
			}
			if _, err := tx.Exec(ctx, seqInsert, seqParams...); err != nil {
				db.CaptureError(err, seqInsert, seqParams, "exec")
				return nil, errx.InternalError()
			}
		}
	}

	// A/B variants.
	for _, v := range data.Variants {
		weight := v.Weight
		if weight <= 0 {
			weight = 100
		}
		isActive := true
		if v.IsActive != nil {
			isActive = *v.IsActive
		}
		metaBytes, mErr := json.Marshal(v.Metadata)
		if mErr != nil {
			metaBytes = []byte(`{}`)
		}
		variantInsert := `
			INSERT INTO campaign_ab_variants (
				campaign_id, name, weight, subject, body_html, body_plain,
				is_control, is_active, metadata, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
		`
		variantParams := []any{
			campaign.ID, v.Name, weight, v.Subject, v.BodyHTML, v.BodyPlain,
			v.IsControl, isActive, metaBytes,
		}
		if _, err := tx.Exec(ctx, variantInsert, variantParams...); err != nil {
			db.CaptureError(err, variantInsert, variantParams, "exec")
			return nil, errx.InternalError()
		}
	}

	// Advanced overrides (bounce policy, intent rules, dashboard toggles).
	if data.AdvancedOverrides != nil {
		settingsJSON, mErr := json.Marshal(data.AdvancedOverrides)
		if mErr != nil {
			settingsJSON = []byte(`{}`)
		}
		settingsSQL := `
			INSERT INTO campaign_advanced_settings (campaign_id, settings, updated_at)
			VALUES ($1, $2, NOW())
			ON CONFLICT (campaign_id) DO UPDATE
			  SET settings = EXCLUDED.settings, updated_at = NOW()
		`
		if _, err := tx.Exec(ctx, settingsSQL, campaign.ID, settingsJSON); err != nil {
			db.CaptureError(err, settingsSQL, []any{campaign.ID}, "exec")
			return nil, errx.InternalError()
		}
	}

	if err := tx.Commit(ctx); err != nil {
		db.CaptureError(err, "", nil, "commit")
		return nil, errx.InternalError()
	}
	committed = true

	return &campaign, nil
}

func (r *campaignRepository) Get(ctx context.Context, userID, id string) (*models.Campaign, error) {
	var campaign models.Campaign

	query := fmt.Sprintf(
		`SELECT %s
		 FROM campaigns c
		 LEFT JOIN campaign_email_tags cet ON cet.campaign_id = c.id
		 LEFT JOIN campaign_folders cec ON cec.campaign_id = c.id
		 WHERE c.user_id = $1 AND c.id = $2
		 GROUP BY c.id`,
		CAMPAIGN_SELECT_FULL,
	)

	params := []any{
		userID,
		id,
	}

	row := r.DB.QueryRow(
		ctx,
		query,
		params...,
	)
	err := getCampaignFull(row, &campaign)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errx.ErrResourceNotFound
		}
		db.CaptureError(err, query, params, "queryrow")
		return nil, err
	}

	return &campaign, nil
}

func (r *campaignRepository) Search(ctx context.Context, userID, query string, cursor, folder *string, limit int32) (*models.CampaignsResult, error) {
	tx, err := r.DB.Begin(ctx)
	if err != nil {
		db.CaptureError(err, "", nil, "begin")
		return nil, err
	}
	defer tx.Rollback(ctx)
	campaigns := make([]models.Campaign, 0, limit+1)

	sql := fmt.Sprintf(`
		SELECT %s
		FROM campaigns c
		LEFT JOIN campaign_email_tags cet ON cet.campaign_id = c.id
		LEFT JOIN campaign_folders cec ON cec.campaign_id = c.id
		WHERE user_id = $1
		 AND ($2::uuid IS NULL OR (c.created_at, c.id) < (
		  SELECT created_at, id
		  FROM campaigns
		  WHERE id = $2
		 ))
		 AND ($3 = '' OR c.name ILIKE '%%' || $3 || '%%')
		 AND ($4::uuid IS NULL OR EXISTS (
		  SELECT 1 FROM campaign_folders cf WHERE cf.campaign_id = c.id AND cf.folder_id = $4
		 ))
		GROUP BY c.id
		ORDER BY created_at DESC
		LIMIT %d`,
		CAMPAIGN_SELECT_FULL, limit,
	)

	var countSQL string
	if cursor == nil {
		countSQL = `
			SELECT COUNT(DISTINCT c.id)
			FROM campaigns c
			LEFT JOIN campaign_folders cec ON cec.campaign_id = c.id
			WHERE user_id = $1
			  AND ($2 = '' OR c.name ILIKE '%%' || $2 || '%%')
			  AND ($3::uuid IS NULL OR EXISTS (
				SELECT 1 FROM campaign_folders cf WHERE cf.campaign_id = c.id AND cf.folder_id = $3
			  ))
		`
	}

	params := []any{
		userID,
		cursor,
		query,
		folder,
	}

	rows, err := tx.Query(
		ctx,
		sql,
		params...,
	)
	if err != nil {
		db.CaptureError(err, sql, params, "query")
		return nil, err
	}
	defer rows.Close()

	// campaigns is a 0-length slice with capacity limit+1 — append (not
	// index assignment) is required, otherwise the first iteration panics
	// "index out of range". That bug blanked the Campaigns page for any
	// user who actually had campaigns.
	for rows.Next() {
		var campaign models.Campaign
		err = getCampaignFull(rows, &campaign)
		if err != nil {
			db.CaptureError(err, "", nil, "scan")
			return nil, err
		}
		campaigns = append(campaigns, campaign)
	}

	var total *int64
	var nextCursor *uuid.UUID
	var hasMore bool
	if len(campaigns) > int(limit) {
		hasMore = true
		nextCursor = &campaigns[limit].ID
		campaigns = campaigns[:limit]
	}

	if cursor == nil && countSQL != "" {
		params := []any{
			userID,
			query,
			folder,
		}
		var tmp int64
		err = tx.QueryRow(ctx, countSQL, userID, query, folder).Scan(&tmp)
		if err != nil {
			db.CaptureError(err, countSQL, params, "queryrow")
			return nil, err
		}
		total = &tmp
	}

	return &models.CampaignsResult{
		Data: campaigns,
		Pagination: models.Pagination{
			Total:      total,
			NextCursor: nextCursor,
			HasMore:    hasMore,
		},
	}, nil
}

func (r *campaignRepository) Delete(ctx context.Context, userID, campaignID string) error {
	query := `
		DELETE FROM campaigns WHERE user_id = $1 AND id = $2
	`

	params := []any{
		userID,
		campaignID,
	}

	cmd, err := r.DB.Exec(
		ctx,
		query,
		params...,
	)
	if err != nil {
		db.CaptureError(err, query, params, "exec")
		return err
	}

	if cmd.RowsAffected() == 0 {
		return errx.ErrResourceNotFound
	}

	return nil
}

func (r *campaignRepository) Update(ctx context.Context, userID, campaignID string, data *models.UpdateCampaign) (*models.Campaign, *errx.Error) {
	setClauses := []string{}
	args := []any{userID, campaignID}
	argPos := 3

	if data.Name != nil {
		if err := validate.CampaignName(*data.Name); err != nil {
			return nil, err
		}
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", "name", argPos))
		args = append(args, *data.Name)
		argPos++
	}
	if data.Description != nil {
		if err := validate.CampaignDescription(*data.Description); err != nil {
			return nil, err
		}
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", "description", argPos))
		args = append(args, *data.Description)
		argPos++
	}
	if data.Status != nil {
		// Valid statuses: draft, active, paused, completed, paused_trial_expired
		status := *data.Status
		validStatuses := map[string]bool{
			"draft": true, "active": true, "paused": true,
			"completed": true, "paused_trial_expired": true,
			"paused_no_accounts": true,
		}
		if !validStatuses[status] {
			return nil, errx.ErrInvalid
		}
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", "status", argPos))
		args = append(args, status)
		argPos++
	}
	if data.StopOnReply != nil {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", "stop_on_reply", argPos))
		args = append(args, *data.StopOnReply)
		argPos++
	}
	if data.OpenTracking != nil {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", "open_tracking", argPos))
		args = append(args, *data.OpenTracking)
		argPos++
	}
	if data.LinkTracking != nil {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", "link_tracking", argPos))
		args = append(args, *data.LinkTracking)
		argPos++
	}
	if data.TextOnly != nil {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", "text_only", argPos))
		args = append(args, *data.TextOnly)
		argPos++
	}
	if data.DailyLimit != nil {
		if err := validate.CampaignDailyLimit(*data.DailyLimit); err != nil {
			return nil, err
		}
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", "daily_limit", argPos))
		args = append(args, *data.DailyLimit)
		argPos++
	}
	if data.UnsubscribeHeader != nil {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", "unsubscribe_header", argPos))
		args = append(args, *data.UnsubscribeHeader)
		argPos++
	}
	if data.RiskyEmails != nil {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", "risky_emails", argPos))
		args = append(args, *data.RiskyEmails)
		argPos++
	}
	if data.CC != nil {
		if !validate.EmailBulk(data.CC) {
			return nil, errx.ErrEmail
		}
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", "cc_addr", argPos))
		args = append(args, data.CC)
		argPos++
	}
	if data.BCC != nil {
		if !validate.EmailBulk(data.BCC) {
			return nil, errx.ErrEmail
		}
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", "bcc_addr", argPos))
		args = append(args, data.BCC)
		argPos++
	}
	if data.StartDate != nil {
		if err := validate.CampaignStartDate(*data.StartDate); err != nil {
			return nil, err
		}
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", "start_date", argPos))
		args = append(args, *data.StartDate)
		argPos++
	}
	if data.EndDate != nil {
		if err := validate.CampaignEndDate(*data.EndDate); err != nil {
			return nil, err
		}
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", "end_date", argPos))
		args = append(args, *data.EndDate)
		argPos++
	}
	if data.Timezone != nil {
		if !tz.Valid(*data.Timezone) {
			return nil, errx.ErrTimezone
		}
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", "timezone", argPos))
		args = append(args, *data.Timezone)
		argPos++
	}
	if data.Days != nil {
		if err := validate.CampaignDays(*data.Days); err != nil {
			return nil, err
		}
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", "days", argPos))
		args = append(args, *data.Days)
		argPos++
	}
	if data.StartTime != nil {
		if err := validate.CampaignTime(*data.StartTime); err != nil {
			return nil, err
		}
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", "start_time", argPos))
		args = append(args, *data.StartTime)
		argPos++
	}
	if data.EndTime != nil {
		if err := validate.CampaignTime(*data.EndTime); err != nil {
			return nil, err
		}
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", "end_time", argPos))
		args = append(args, *data.EndTime)
		argPos++
	}
	if data.ContactOrderBy != nil {
		validOrderBy := map[string]bool{
			"created_at": true, "email": true, "name": true,
			"custom_field": true, "manual": true,
		}
		if !validOrderBy[*data.ContactOrderBy] {
			return nil, errx.ErrInvalid
		}
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", "contact_order_by", argPos))
		args = append(args, *data.ContactOrderBy)
		argPos++
	}
	if data.ContactOrderDir != nil {
		if *data.ContactOrderDir != "asc" && *data.ContactOrderDir != "desc" {
			return nil, errx.ErrInvalid
		}
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", "contact_order_dir", argPos))
		args = append(args, *data.ContactOrderDir)
		argPos++
	}
	if data.ContactOrderField != nil {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", "contact_order_field", argPos))
		args = append(args, *data.ContactOrderField)
		argPos++
	}

	if argPos == 3 && data.EmailTags == nil {
		return nil, errx.ErrNotEnough
	}

	setClauses = append(setClauses, "updated_at = now()")

	tx, err := r.DB.Begin(ctx)
	if err != nil {
		db.CaptureError(err, "", nil, "begin")
		return nil, errx.InternalError()
	}

	var committed bool
	defer func() {
		if !committed {
			tx.Rollback(ctx)
		}
	}()

	var query string
	if argPos > 3 {
		query = fmt.Sprintf(`
			UPDATE campaigns
			SET %s
			WHERE user_id = $1 AND id = $2
			RETURNING %s
		`, strings.Join(setClauses, ", "), CAMPAIGN_SELECT)
	} else {
		query = fmt.Sprintf(`
			SELECT %s 
			FROM campaigns
			WHERE user_id = $1 AND id = $2
		`, CAMPAIGN_SELECT)
	}

	var campaign models.Campaign

	row := tx.QueryRow(ctx, query, args...)
	err = getCampaign(row, &campaign)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errx.ErrNotFound
		}
		db.CaptureError(err, query, args, "queryrow")
		return nil, errx.InternalError()
	}

	campaign.EmailTags = make([]string, 0)
	if data.EmailTags != nil {
		var err *errx.Error
		campaign.EmailTags, err = SyncCampaignEmailTags(ctx, tx, campaignID, data.EmailTags)
		if err != nil {
			return nil, err
		}
	}

	campaign.Folders = make([]string, 0)
	if data.Folders != nil {
		var err *errx.Error
		campaign.Folders, err = SyncCampaignFolders(ctx, tx, campaignID, data.Folders)
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		db.CaptureError(err, "", nil, "commit")
		return nil, errx.InternalError()
	}
	committed = true

	return &campaign, nil
}

// GetByID retrieves a campaign by ID without requiring userID (for internal service use)
func (r *campaignRepository) GetByID(ctx context.Context, campaignID uuid.UUID) (*models.Campaign, error) {
	var campaign models.Campaign

	query := fmt.Sprintf(
		`SELECT c.user_id, %s
		 FROM campaigns c
		 LEFT JOIN campaign_email_tags cet ON cet.campaign_id = c.id
		 LEFT JOIN campaign_folders cec ON cec.campaign_id = c.id
		 WHERE c.id = $1
		 GROUP BY c.id`,
		CAMPAIGN_SELECT_FULL,
	)

	row := r.DB.QueryRow(ctx, query, campaignID)
	err := row.Scan(
		&campaign.UserID,
		&campaign.ID, &campaign.Name, &campaign.Description, &campaign.Status,
		&campaign.StopOnReply, &campaign.OpenTracking, &campaign.LinkTracking,
		&campaign.TextOnly, &campaign.DailyLimit, &campaign.UnsubscribeHeader, &campaign.RiskyEmails,
		&campaign.CC, &campaign.BCC, &campaign.StartDate, &campaign.EndDate, &campaign.Timezone, &campaign.Days,
		&campaign.StartTime, &campaign.EndTime,
		&campaign.ContactOrderBy, &campaign.ContactOrderDir, &campaign.ContactOrderField,
		&campaign.UpdatedAt, &campaign.CreatedAt,
		&campaign.EmailTags, &campaign.Folders,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errx.ErrResourceNotFound
		}
		db.CaptureError(err, query, []any{campaignID}, "queryrow")
		return nil, err
	}

	return &campaign, nil
}

// GetSequenceByID retrieves a sequence by ID
func (r *campaignRepository) GetSequenceByID(ctx context.Context, sequenceID uuid.UUID) (*models.Sequence, error) {
	query := `
		SELECT id, name, subject, body_plain, body_html, body_sync, body_code, wait_after, updated_at, created_at
		FROM sequences
		WHERE id = $1
	`

	var seq models.Sequence
	err := r.DB.QueryRow(ctx, query, sequenceID).Scan(
		&seq.ID, &seq.Name, &seq.Subject, &seq.BodyPlain, &seq.BodyHTML,
		&seq.BodySync, &seq.BodyCode, &seq.WaitAfter, &seq.UpdatedAt, &seq.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errx.ErrResourceNotFound
		}
		db.CaptureError(err, query, []any{sequenceID}, "queryrow")
		return nil, err
	}

	return &seq, nil
}

// GetSequencesByCampaignID retrieves all sequences for a campaign ordered by position
func (r *campaignRepository) GetSequencesByCampaignID(ctx context.Context, campaignID uuid.UUID) ([]models.Sequence, error) {
	query := `
		SELECT id, name, subject, body_plain, body_html, body_sync, body_code, wait_after, position, updated_at, created_at
		FROM sequences
		WHERE campaign_id = $1
		ORDER BY position ASC, created_at ASC
	`

	rows, err := r.DB.Query(ctx, query, campaignID)
	if err != nil {
		db.CaptureError(err, query, []any{campaignID}, "query")
		return nil, err
	}
	defer rows.Close()

	var sequences []models.Sequence
	for rows.Next() {
		var seq models.Sequence
		err := rows.Scan(
			&seq.ID, &seq.Name, &seq.Subject, &seq.BodyPlain, &seq.BodyHTML,
			&seq.BodySync, &seq.BodyCode, &seq.WaitAfter, &seq.Position, &seq.UpdatedAt, &seq.CreatedAt,
		)
		if err != nil {
			db.CaptureError(err, "", nil, "scan")
			return nil, err
		}
		sequences = append(sequences, seq)
	}

	return sequences, rows.Err()
}

// validCampaignTransitions defines which status transitions are allowed.
// Key is the current status, values are the statuses it can transition to.
var validCampaignTransitions = map[string]map[string]bool{
	"draft":                {"active": true},
	"active":               {"paused": true, "completed": true, "paused_no_accounts": true, "paused_trial_expired": true},
	"paused":               {"active": true, "draft": true},
	"paused_no_accounts":   {"active": true, "paused": true},
	"paused_trial_expired": {"active": true, "paused": true},
	"completed":            {}, // terminal state
}

// UpdateStatus updates only the status of a campaign with state machine validation
func (r *campaignRepository) UpdateStatus(ctx context.Context, campaignID uuid.UUID, status string) error {
	query := `UPDATE campaigns SET status = $1, updated_at = NOW() WHERE id = $2 AND status != $1`

	// Validate that the transition is allowed
	var currentStatus string
	if err := r.DB.QueryRow(ctx, `SELECT status FROM campaigns WHERE id = $1`, campaignID).Scan(&currentStatus); err != nil {
		return err
	}
	allowed, ok := validCampaignTransitions[currentStatus]
	if !ok || !allowed[status] {
		return fmt.Errorf("invalid campaign transition from %q to %q", currentStatus, status)
	}

	_, err := r.DB.Exec(ctx, query, status, campaignID)
	return err
}

// PauseAllByUserID pauses all active campaigns for a user
func (r *campaignRepository) PauseAllByUserID(ctx context.Context, userID uuid.UUID, reason string) error {
	query := `UPDATE campaigns SET status = $1, updated_at = NOW() WHERE user_id = $2 AND status = 'active'`
	_, err := r.DB.Exec(ctx, query, reason, userID)
	return err
}

// StartCampaign sets campaign status to active and updates last_status_change_at
func (r *campaignRepository) StartCampaign(ctx context.Context, campaignID uuid.UUID) error {
	query := `UPDATE campaigns SET status = 'active', last_status_change_at = NOW(), updated_at = NOW() WHERE id = $1`
	_, err := r.DB.Exec(ctx, query, campaignID)
	return err
}

// StopCampaign sets campaign status to paused and updates last_status_change_at
func (r *campaignRepository) StopCampaign(ctx context.Context, campaignID uuid.UUID) error {
	query := `UPDATE campaigns SET status = 'paused', last_status_change_at = NOW(), updated_at = NOW() WHERE id = $1`
	_, err := r.DB.Exec(ctx, query, campaignID)
	return err
}

// ValidateCampaignReady checks if a campaign has sequences, contacts, and email tags
func (r *campaignRepository) ValidateCampaignReady(ctx context.Context, campaignID uuid.UUID) error {
	// Check sequences
	var seqCount int
	err := r.DB.QueryRow(ctx, `SELECT COUNT(*) FROM sequences WHERE campaign_id = $1`, campaignID).Scan(&seqCount)
	if err != nil {
		return err
	}
	if seqCount == 0 {
		return errx.New(errx.BadRequest, "campaign must have at least one sequence")
	}

	// Check contacts
	var contactCount int
	err = r.DB.QueryRow(ctx, `SELECT COUNT(*) FROM campaign_leads WHERE campaign_id = $1`, campaignID).Scan(&contactCount)
	if err != nil {
		return err
	}
	if contactCount == 0 {
		return errx.New(errx.BadRequest, "campaign must have at least one contact")
	}

	// Check email tags
	var tagCount int
	err = r.DB.QueryRow(ctx, `SELECT COUNT(*) FROM campaign_email_tags WHERE campaign_id = $1`, campaignID).Scan(&tagCount)
	if err != nil {
		return err
	}
	if tagCount == 0 {
		return errx.New(errx.BadRequest, "campaign must have at least one email tag")
	}

	return nil
}

// GetPendingCampaignTasks returns all pending tasks for a campaign
func (r *campaignRepository) GetPendingCampaignTasks(ctx context.Context, campaignID uuid.UUID) ([]Task, error) {
	query := `
		SELECT t.id, t.task_type, t.email_account_id, t.status, t.message_id,
		       t.scheduled_at, t.completed_at, t.cloud_task_name, t.created_at, t.updated_at
		FROM tasks t
		JOIN campaign_tasks ct ON ct.task_id = t.id
		WHERE ct.campaign_id = $1 AND t.status = 'pending'
	`

	rows, err := r.DB.Query(ctx, query, campaignID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []Task
	for rows.Next() {
		var task Task
		err := rows.Scan(
			&task.ID, &task.TaskType, &task.EmailAccountID, &task.Status, &task.MessageID,
			&task.ScheduledAt, &task.CompletedAt, &task.CloudTaskName, &task.CreatedAt, &task.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}

	return tasks, rows.Err()
}

func (r *campaignRepository) CountActiveForOrganization(ctx context.Context, orgID uuid.UUID) (int, error) {
	query := `SELECT COUNT(*) FROM campaigns WHERE organization_id = $1 AND status = 'active'`
	var count int
	err := r.DB.QueryRow(ctx, query, orgID).Scan(&count)
	return count, err
}

func (r *campaignRepository) AccountHasActiveCampaign(ctx context.Context, accountID uuid.UUID) (bool, error) {
	query := `
		SELECT EXISTS (
			SELECT 1
			FROM email_accounts ea
			JOIN email_tags et ON et.email_id = ea.id
			JOIN campaign_email_tags cet ON cet.tag_id = et.tag_id
			JOIN campaigns c ON c.id = cet.campaign_id
			WHERE ea.id = $1
			  AND ea.status = 'active'
			  AND c.status = 'active'
		)
	`
	var exists bool
	err := r.DB.QueryRow(ctx, query, accountID).Scan(&exists)
	return exists, err
}

// UpdateStatusWithLock updates campaign status using a PostgreSQL advisory lock to prevent concurrent updates.
// The WHERE clause guards against races: only updates if the campaign is currently 'active'.
func (r *campaignRepository) UpdateStatusWithLock(ctx context.Context, campaignID uuid.UUID, status string) error {
	tx, err := r.DB.Begin(ctx)
	if err != nil {
		db.CaptureError(err, "", nil, "begin")
		return err
	}

	var committed bool
	defer func() {
		if !committed {
			tx.Rollback(ctx)
		}
	}()

	// Acquire advisory lock scoped to this campaign's status updates
	_, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext('campaign_status_' || $1::text))`, campaignID)
	if err != nil {
		db.CaptureError(err, "", nil, "advisory_lock")
		return err
	}

	query := `UPDATE campaigns SET status = $1, last_status_change_at = NOW(), updated_at = NOW() WHERE id = $2 AND status = 'active'`
	_, err = tx.Exec(ctx, query, status, campaignID)
	if err != nil {
		db.CaptureError(err, query, []any{status, campaignID}, "exec")
		return err
	}

	err = tx.Commit(ctx)
	if err == nil {
		committed = true
	}
	return err
}
