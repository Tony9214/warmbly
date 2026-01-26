package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/warmbly/warmbly/internal/api/middleware"
	"github.com/warmbly/warmbly/internal/errx"
)

// GetWarmupAnalytics gets warmup statistics for the user
// GET /analytics/warmup
func (h *Handler) GetWarmupAnalytics(c *gin.Context) {
	userIDStr := middleware.GetUserID(c)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		errx.Handle(c, errx.ErrAuth)
		return
	}

	// Parse optional email_id filter
	var emailAccountID *uuid.UUID
	if emailIDStr := c.Query("email_id"); emailIDStr != "" {
		if id, err := uuid.Parse(emailIDStr); err == nil {
			emailAccountID = &id
		}
	}

	// Parse date range (required)
	fromStr := c.Query("from")
	toStr := c.Query("to")

	if fromStr == "" || toStr == "" {
		errx.Handle(c, errx.New(errx.BadRequest, "from and to date parameters are required"))
		return
	}

	from, err := time.Parse("2006-01-02", fromStr)
	if err != nil {
		errx.Handle(c, errx.New(errx.BadRequest, "Invalid from date format (expected YYYY-MM-DD)"))
		return
	}

	to, err := time.Parse("2006-01-02", toStr)
	if err != nil {
		errx.Handle(c, errx.New(errx.BadRequest, "Invalid to date format (expected YYYY-MM-DD)"))
		return
	}

	analytics, xerr := h.AnalyticsService.GetWarmupAnalytics(c.Request.Context(), userID, emailAccountID, from, to)
	if xerr != nil {
		errx.Handle(c, xerr)
		return
	}

	c.JSON(http.StatusOK, analytics)
}

// GetCampaignAnalytics gets analytics for a specific campaign
// GET /analytics/campaigns/:id
func (h *Handler) GetCampaignAnalytics(c *gin.Context) {
	userIDStr := middleware.GetUserID(c)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		errx.Handle(c, errx.ErrAuth)
		return
	}

	campaignIDStr := c.Param("id")
	campaignID, err := uuid.Parse(campaignIDStr)
	if err != nil {
		errx.Handle(c, errx.ErrNotFound)
		return
	}

	analytics, xerr := h.AnalyticsService.GetCampaignAnalytics(c.Request.Context(), userID, campaignID)
	if xerr != nil {
		errx.Handle(c, xerr)
		return
	}

	c.JSON(http.StatusOK, analytics)
}

// GetCampaignDailyStats gets daily statistics for a campaign
// GET /analytics/campaigns/:id/daily
func (h *Handler) GetCampaignDailyStats(c *gin.Context) {
	userIDStr := middleware.GetUserID(c)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		errx.Handle(c, errx.ErrAuth)
		return
	}

	campaignIDStr := c.Param("id")
	campaignID, err := uuid.Parse(campaignIDStr)
	if err != nil {
		errx.Handle(c, errx.ErrNotFound)
		return
	}

	// Parse date range
	fromStr := c.Query("from")
	toStr := c.Query("to")

	if fromStr == "" || toStr == "" {
		errx.Handle(c, errx.New(errx.BadRequest, "from and to date parameters are required"))
		return
	}

	from, err := time.Parse("2006-01-02", fromStr)
	if err != nil {
		errx.Handle(c, errx.New(errx.BadRequest, "Invalid from date format (expected YYYY-MM-DD)"))
		return
	}

	to, err := time.Parse("2006-01-02", toStr)
	if err != nil {
		errx.Handle(c, errx.New(errx.BadRequest, "Invalid to date format (expected YYYY-MM-DD)"))
		return
	}

	stats, xerr := h.AnalyticsService.GetCampaignDailyStats(c.Request.Context(), userID, campaignID, from, to)
	if xerr != nil {
		errx.Handle(c, xerr)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": stats})
}

// GetAllAccountStatuses gets status of all email accounts
// GET /analytics/accounts
func (h *Handler) GetAllAccountStatuses(c *gin.Context) {
	userIDStr := middleware.GetUserID(c)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		errx.Handle(c, errx.ErrAuth)
		return
	}

	statuses, xerr := h.AnalyticsService.GetAllAccountStatuses(c.Request.Context(), userID)
	if xerr != nil {
		errx.Handle(c, xerr)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": statuses})
}

// GetAccountStatus gets status of a specific email account
// GET /analytics/accounts/:id
func (h *Handler) GetAccountStatus(c *gin.Context) {
	userIDStr := middleware.GetUserID(c)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		errx.Handle(c, errx.ErrAuth)
		return
	}

	accountIDStr := c.Param("id")
	accountID, err := uuid.Parse(accountIDStr)
	if err != nil {
		errx.Handle(c, errx.ErrNotFound)
		return
	}

	status, xerr := h.AnalyticsService.GetAccountStatus(c.Request.Context(), userID, accountID)
	if xerr != nil {
		errx.Handle(c, xerr)
		return
	}

	c.JSON(http.StatusOK, status)
}

// GetUsageOverview gets usage overview for the user
// GET /analytics/usage
func (h *Handler) GetUsageOverview(c *gin.Context) {
	userIDStr := middleware.GetUserID(c)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		errx.Handle(c, errx.ErrAuth)
		return
	}

	period := c.DefaultQuery("period", "day")
	if period != "day" && period != "week" && period != "month" {
		period = "day"
	}

	overview, xerr := h.AnalyticsService.GetUsageOverview(c.Request.Context(), userID, period)
	if xerr != nil {
		errx.Handle(c, xerr)
		return
	}

	c.JSON(http.StatusOK, overview)
}

// GetRealtimeInfo returns WebSocket connection info
// GET /realtime/info
func (h *Handler) GetRealtimeInfo(c *gin.Context) {
	userIDStr := middleware.GetUserID(c)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		errx.Handle(c, errx.ErrAuth)
		return
	}

	// Get WebSocket host from request or config
	wsHost := c.Request.Header.Get("X-Forwarded-Host")
	if wsHost == "" {
		wsHost = c.Request.Host
	}
	wsHost = "wss://" + wsHost

	c.JSON(http.StatusOK, gin.H{
		"websocket_url": wsHost + "/socket",
		"topics": []string{
			"user:" + userID.String(),
			"campaign:*",
			"account:*",
		},
	})
}
