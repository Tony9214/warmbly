// Package paging encodes keyset pagination cursors as opaque tokens.
//
// The wire value a client sees is a versioned base64url token, NOT the raw
// record id that happens to be the sort key. That keeps clients from coupling
// to the id being the cursor (or to it being a UUID at all), so the keyset can
// evolve without breaking callers. Decoding a malformed or wrong-version token
// is an error, which handlers surface as a 400 rather than silently ignoring.
package paging

import (
	"encoding/base64"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/warmbly/warmbly/internal/errx"
)

// prefix versions the token format. Bump it if the encoding ever changes so old
// tokens decode to a clear error instead of garbage.
const prefix = "c1_"

// ErrInvalid is returned for a malformed or wrong-version cursor token.
var ErrInvalid = errors.New("invalid cursor")

// EncodeUUID wraps a record id in an opaque token. Returns nil for the zero id
// (used to mean "no next page") so the JSON cursor field serializes as null.
func EncodeUUID(id uuid.UUID) *string {
	if id == uuid.Nil {
		return nil
	}
	tok := prefix + base64.RawURLEncoding.EncodeToString(id[:])
	return &tok
}

// UUIDString returns the record id as its plain canonical string for the keyset
// cursor field. Used by first-party admin endpoints, which keep transparent
// UUID cursors (their request structs bind ?cursor as a uuid.UUID directly).
// Public endpoints use EncodeUUID for opaque tokens instead.
func UUIDString(id uuid.UUID) *string {
	if id == uuid.Nil {
		return nil
	}
	s := id.String()
	return &s
}

// DecodeUUID reverses EncodeUUID. An empty token yields the zero id with no
// error (no cursor supplied = start from the beginning); any non-empty token
// that is not a valid current-version cursor returns ErrInvalid.
func DecodeUUID(token string) (uuid.UUID, error) {
	if token == "" {
		return uuid.Nil, nil
	}
	if !strings.HasPrefix(token, prefix) {
		return uuid.Nil, ErrInvalid
	}
	raw, err := base64.RawURLEncoding.DecodeString(strings.TrimPrefix(token, prefix))
	if err != nil || len(raw) != 16 {
		return uuid.Nil, ErrInvalid
	}
	var id uuid.UUID
	copy(id[:], raw)
	return id, nil
}

// DecodeCursor decodes an opaque cursor token into the canonical UUID string the
// repositories key on. It is a drop-in for validate.Uuid at list endpoints: an
// empty token yields (nil, nil) (start from the beginning); an invalid token
// returns a 400 instead of being silently ignored.
func DecodeCursor(token string) (*string, *errx.Error) {
	if token == "" {
		return nil, nil
	}
	id, err := DecodeUUID(token)
	if err != nil {
		return nil, errx.New(errx.BadRequest, "invalid cursor")
	}
	s := id.String()
	return &s, nil
}
