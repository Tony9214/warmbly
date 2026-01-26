package api

import (
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/warmbly/warmbly/internal/api/handler"
	"github.com/warmbly/warmbly/internal/api/handler/grouph"
	"github.com/warmbly/warmbly/internal/api/middleware"
	"github.com/warmbly/warmbly/internal/models"
)

func Run(
	h *handler.Handler,
	m *middleware.Handler,
	oidcm *middleware.OidcHandler,
	addr, ginMode string,
) {
	gin.SetMode(ginMode)

	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"POST", "GET", "PATCH", "OPTIONS", "DELETE"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	auth := r.Group("/auth")
	{
		r.POST("/login/start", h.LoginStart)
		r.POST("/login/confirm", h.LoginConfirm)
		r.POST("/register/start", h.RegistrationStart)
		r.POST("/register/confirm", h.RegistrationConfirm)
		r.POST("/refresh", h.RefreshToken)
		r.POST("/reset-password/start", h.ResetPasswordStart)
		r.POST("/reset-password/confirm", h.ResetPasswordStart)
	}

	protectedAuth := auth.Group("")
	protectedAuth.Use(m.AuthMiddleware())
	{
		r.POST("/logout", h.Logout)
		r.POST("/logout-all", h.LogoutAll)
		r.GET("/me", h.GetUser)
	}

	protected := r.Group("")
	protected.Use(m.AuthMiddleware())
	{
		emails := protected.Group("/emails")
		{
			emails.GET("", h.EmailsSearch)
			emails.GET("/:id", h.GetEmail)
			emails.PATCH("/:id", h.UpdateEmail)
			emails.PATCH("/:id/track", h.UpdateEmailTrackingDomain)
			emails.DELETE("/:id", h.DeleteEmail)
		}

		campaigns := protected.Group("/campaigns")
		{
			campaigns.GET("", h.SearchCampaigns)
			campaigns.POST("", h.CreateCampaign)
			campaigns.GET("/:id", h.GetCampaign)
			campaigns.PATCH("/:id", h.UpdateCampaign)
			campaigns.DELETE("/:id", h.DeleteCampaign)

			sequences := campaigns.Group("/:id/sequences")
			{
				sequences.GET("", h.GetSequences)
				sequences.POST("", h.CreateSequence)
				sequences.PATCH("/:sid", h.UpdateSequence)
				sequences.DELETE("/:sid", h.DeleteSequence)
			}
		}

		contacts := protected.Group("/contacts")
		{
			contacts.POST("/search", h.SearchContacts)
			contacts.POST("", h.AddContacts)
			contacts.DELETE("", h.DeleteContactBulk)
			contacts.PATCH("", h.UpdateContactBulk)
			contacts.PATCH("/:id", h.UpdateContact)
			contacts.DELETE("/:id", h.DeleteContact)
		}

		grouph.New(protected, h.FolderService, "folders")
		grouph.New(protected, h.TagService, "tags")
		grouph.New(protected, h.CategoryService, "categories")

		unibox := protected.Group("/unibox")
		{
			unibox.GET("", h.GetUniboxIncoming)
			unibox.GET("/count", h.GetUnseenCount)
			unibox.GET("/thread", h.GetUniboxThread)
			unibox.PATCH("/seen", h.UniboxMarkSeen)
			unibox.GET("/:id", h.GetUniboxEmail)
		}

		protected.POST("/getaway", h.GenerateWebsocket)

		// API Keys management
		apiKeys := protected.Group("/api-keys")
		apiKeys.Use(m.RateLimitMiddleware(models.RateLimitWrite))
		{
			apiKeys.GET("", h.ListAPIKeys)
			apiKeys.POST("", h.CreateAPIKey)
			apiKeys.GET("/permissions", h.ListAPIPermissions)
			apiKeys.GET("/:id", h.GetAPIKey)
			apiKeys.PATCH("/:id", h.UpdateAPIKey)
			apiKeys.DELETE("/:id", h.RevokeAPIKey)
		}

		// Analytics endpoints
		analytics := protected.Group("/analytics")
		analytics.Use(m.RateLimitMiddleware(models.RateLimitAnalytics))
		{
			analytics.GET("/warmup", h.GetWarmupAnalytics)
			analytics.GET("/campaigns/:id", h.GetCampaignAnalytics)
			analytics.GET("/campaigns/:id/daily", h.GetCampaignDailyStats)
			analytics.GET("/accounts", h.GetAllAccountStatuses)
			analytics.GET("/accounts/:id", h.GetAccountStatus)
			analytics.GET("/usage", h.GetUsageOverview)
		}

		// Audit logs
		auditLogs := protected.Group("/audit-logs")
		auditLogs.Use(m.RateLimitMiddleware(models.RateLimitRead))
		{
			auditLogs.GET("", h.GetAuditLogs)
		}

		// Realtime subscription info
		realtime := protected.Group("/realtime")
		{
			realtime.GET("/info", h.GetRealtimeInfo)
		}
	}

	// Admin routes (requires additional role check)
	admin := r.Group("/admin")
	admin.Use(m.AuthMiddleware())
	{
		admin.GET("/users/:id/rate-limits", h.GetUserRateLimits)
		admin.PATCH("/users/:id/rate-limits", h.UpdateUserRateLimits)
		admin.GET("/audit-logs", h.GetAdminAuditLogs)
	}

	webhook := r.Group("/webhook")
	protected.Use(oidcm.Middleware())
	{
		webhook.POST("/campaign", h.HandleCampaignTasks)
		webhook.POST("/email", h.HandleEmailTask)
	}

	r.Run(addr)
}
