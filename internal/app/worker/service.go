package worker

import (
	"context"

	"github.com/warmbly/warmbly/internal/app/cipher"
	"github.com/warmbly/warmbly/internal/app/worker/mailmanager"
	"github.com/warmbly/warmbly/internal/infrastructure/cache"
	"github.com/warmbly/warmbly/internal/infrastructure/codec"
	"github.com/warmbly/warmbly/internal/infrastructure/eventbus"
	"github.com/warmbly/warmbly/internal/infrastructure/storage"
	"github.com/warmbly/warmbly/internal/models"
	"github.com/warmbly/warmbly/internal/repository"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

type WorkerService struct {
	ID                        string
	CipherService             cipher.CipherService
	Bus                       eventbus.EventBus
	Codec                     codec.Codec
	QueueURL                  string
	Cache                     *cache.Cache
	Storage                   storage.Store
	EmailMessageMapRepository repository.EmailMessageMapRepository

	mailManager *mailmanager.MailManager

	errorEvents   chan zapcore.Entry
	logger        *zap.Logger
	eventHandlers map[models.WorkerEventType]func(ctx context.Context, body any) error
}

func (s *WorkerService) Init() error {
	s.errorEvents = make(chan zapcore.Entry)
	var err error
	s.logger, err = NewLoggerWithHandler(s.HandleError)
	if err != nil {
		return err
	}

	s.mailManager = mailmanager.NewMailManager(
		s.Produce,
		s.Cache,
		s.Storage,
		s.EmailMessageMapRepository,
		s.CipherService,
	)

	return nil
}
