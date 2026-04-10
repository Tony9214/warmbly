package worker

import (
	"context"

	"github.com/rs/zerolog/log"
	"github.com/warmbly/warmbly/internal/models"
)

func (w *WorkerService) HandleAddEmail(ctx context.Context, e *models.AddWorkerEmail) error {
	if e == nil {
		return nil
	}

	if w.mailManager.Has(e.ID) {
		// Already loaded - skip silently to keep handler idempotent
		return nil
	}

	if err := w.mailManager.AddWMail(ctx, e); err != nil {
		log.Error().Err(err).Str("email_id", e.ID.String()).Msg("failed to add email account to worker")
		return err
	}

	// Start the IMAP worker loop for non-Google providers
	if e.Type != models.InboxProviderGoogle && e.ImapSync {
		mail := w.mailManager.Get(e.ID)
		if mail != nil {
			go mail.StartImapWorker(ctx)
		}
	}

	log.Info().Str("email_id", e.ID.String()).Str("email", e.Email).Msg("email account added to worker")
	return nil
}
