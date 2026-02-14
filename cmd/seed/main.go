package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/warmbly/warmbly/internal/pkg/argon2"
)

// Dev seed data — pre-existing user for testing login flow.
// Registration can be tested with any email since Mailpit catches everything.
const (
	seedEmail    = "dev@warmbly.com"
	seedPassword = "password123"
	seedFirst    = "Dev"
	seedLast     = "User"
	seedOrgName  = "Dev's Organization"
)

func main() {
	dsn := os.Getenv("PRIMARY_DB")
	if dsn == "" {
		dsn = "postgres://warmbly:warmbly@localhost:5432/warmbly_dev?sslmode=disable"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		log.Fatalf("connect: %v", err)
	}
	defer pool.Close()

	// Check if user already exists
	var exists bool
	err = pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)", seedEmail).Scan(&exists)
	if err != nil {
		log.Fatalf("query: %v", err)
	}
	if exists {
		fmt.Printf("User %s already exists, skipping seed.\n", seedEmail)
		return
	}

	// Hash password
	hash, err := argon2.Hash(seedPassword)
	if err != nil {
		log.Fatalf("hash: %v", err)
	}

	userID := uuid.New()
	orgID := uuid.New()

	tx, err := pool.Begin(ctx)
	if err != nil {
		log.Fatalf("begin tx: %v", err)
	}
	defer tx.Rollback(ctx)

	// Create user
	_, err = tx.Exec(ctx, `
		INSERT INTO users (id, first_name, last_name, email, password_hash)
		VALUES ($1, $2, $3, $4, $5)
	`, userID, seedFirst, seedLast, seedEmail, hash)
	if err != nil {
		log.Fatalf("insert user: %v", err)
	}

	// Create organization
	_, err = tx.Exec(ctx, `
		INSERT INTO organizations (id, name, slug, owner_user_id)
		VALUES ($1, $2, $3, $4)
	`, orgID, seedOrgName, "dev", userID)
	if err != nil {
		log.Fatalf("insert org: %v", err)
	}

	// Add user as org owner
	_, err = tx.Exec(ctx, `
		INSERT INTO organization_members (organization_id, user_id, role, accepted_at)
		VALUES ($1, $2, 'owner', NOW())
	`, orgID, userID)
	if err != nil {
		log.Fatalf("insert member: %v", err)
	}

	if err := tx.Commit(ctx); err != nil {
		log.Fatalf("commit: %v", err)
	}

	fmt.Println("Seed complete:")
	fmt.Printf("  Email:    %s\n", seedEmail)
	fmt.Printf("  Password: %s\n", seedPassword)
	fmt.Printf("  Org:      %s\n", seedOrgName)
}
