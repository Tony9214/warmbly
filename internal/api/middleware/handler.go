package middleware

import (
	"github.com/warmbly/warmbly/internal/app/apikey"
	"github.com/warmbly/warmbly/internal/app/ratelimit"
	"github.com/warmbly/warmbly/internal/app/token"
)

type Handler struct {
	TokenService     token.TokenService
	APIKeyService    apikey.APIKeyService
	RateLimitService ratelimit.RateLimitService
}
