package encryptedkeys

import (
	"fmt"
	"os"

	"github.com/warmbly/warmbly/internal/infrastructure/db"
	"github.com/warmbly/warmbly/internal/infrastructure/dynamo"
)

// Deps bundles the dependencies the factory might need. Each is only consulted
// when the matching provider is selected — callers may pass nil for any
// dependency they don't have available (e.g. workers pass nil for db).
type Deps struct {
	DB     *db.DB
	Dynamo *dynamo.Client
}

// FromEnv constructs the active encrypted-keys store from environment vars.
//
//	ENCRYPTED_KEYS_PROVIDER=postgres   (default for backend in self-host mode)
//	ENCRYPTED_KEYS_PROVIDER=dynamodb   (AWS DynamoDB or ScyllaDB Alternator)
//	  ENCRYPTED_KEYS_DYNAMO_TABLE      (optional; defaults to "UserEncryptedKeys")
//	ENCRYPTED_KEYS_PROVIDER=http       (worker-side: calls backend over HTTPS)
//	  ENCRYPTED_KEYS_BACKEND_URL       (required, e.g. https://api.warmbly.example.com)
//	  ENCRYPTED_KEYS_WORKER_TOKEN      (required, bearer token)
//
// fallback selects a default provider when ENCRYPTED_KEYS_PROVIDER is unset.
// Backend processes should pass "postgres"; workers should pass "http".
func FromEnv(deps Deps, fallback string) (Store, error) {
	provider := os.Getenv("ENCRYPTED_KEYS_PROVIDER")
	if provider == "" {
		provider = fallback
	}
	switch provider {
	case "postgres", "pg":
		if deps.DB == nil {
			return nil, fmt.Errorf("encryptedkeys: postgres provider requires a *db.DB")
		}
		return NewPostgres(deps.DB), nil
	case "dynamodb", "dynamo":
		if deps.Dynamo == nil {
			return nil, fmt.Errorf("encryptedkeys: dynamodb provider requires a *dynamo.Client")
		}
		return NewDynamo(deps.Dynamo, os.Getenv("ENCRYPTED_KEYS_DYNAMO_TABLE")), nil
	case "http":
		baseURL := os.Getenv("ENCRYPTED_KEYS_BACKEND_URL")
		token := os.Getenv("ENCRYPTED_KEYS_WORKER_TOKEN")
		return NewHTTP(baseURL, token)
	default:
		return nil, fmt.Errorf("encryptedkeys: unknown ENCRYPTED_KEYS_PROVIDER %q (want: postgres, dynamodb, http)", provider)
	}
}

// Compile-time interface assertions.
var (
	_ Store = (*PostgresStore)(nil)
	_ Store = (*DynamoStore)(nil)
	_ Store = (*HTTPStore)(nil)
)
