package worker

import (
	"context"
	"time"

	"github.com/warmbly/warmbly/internal/infrastructure/eventbus"
	"github.com/warmbly/warmbly/internal/models"
)

// Receive is the eventbus.Handler that drives the worker's event loop. It
// decodes the wire payload via the injected codec.Codec and dispatches to
// HandleEvent.
func (w *WorkerService) Receive(ctx context.Context, msg eventbus.Message) error {
	var event models.WorkerEvent
	if err := w.Codec.Deserialize(ctx, msg.Topic, msg.Payload, &event); err != nil {
		return err
	}

	hctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	return w.HandleEvent(hctx, &event)
}
