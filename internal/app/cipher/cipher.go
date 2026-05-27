package cipher

import (
	"context"

	"github.com/getsentry/sentry-go"
	"github.com/google/uuid"
)

type Cipher struct {
	plainDEK []byte
}

func (s *cipherService) Cipher(ctx context.Context, userID uuid.UUID) (*Cipher, error) {
	key, err := s.getDecryptedKey(ctx, userID)
	if err != nil {
		return nil, err
	}

	encDEKB64, err := s.encryptedKeys.Get(ctx, userID)
	if err != nil {
		return nil, err
	}

	if encDEKB64 == "" {
		var encryptedDEK string
		key, encryptedDEK, err = s.kms.GenerateDataKey(ctx)
		if err != nil {
			return nil, err
		}

		if err := s.encryptedKeys.Put(ctx, userID, encryptedDEK); err != nil {
			return nil, err
		}
	} else {
		key, err = s.kms.GetDecryptedKey(ctx, encDEKB64)
		if err != nil {
			return nil, err
		}
	}

	if err := s.saveDecryptedKey(ctx, userID, key); err != nil {
		sentry.CaptureException(err)
	}

	return &Cipher{
		plainDEK: key,
	}, nil
}
