package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/warmbly/warmbly/internal/api/middleware"
	"github.com/warmbly/warmbly/internal/errx"
	"github.com/warmbly/warmbly/internal/models"
)

// AdminSendOutreach is POST /admin/outreach.
func (h *Handler) AdminSendOutreach(c *gin.Context) {
	if h.AdminOutreachService == nil {
		errx.JSON(c, errx.New(errx.Internal, "admin outreach service not available"))
		return
	}
	adminID := middleware.GetAdminUserID(c)
	if adminID == nil {
		errx.JSON(c, errx.ErrUnauthorized)
		return
	}

	var req models.SendAdminOutreachRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errx.JSON(c, errx.New(errx.BadRequest, "invalid request body"))
		return
	}

	msg, xerr := h.AdminOutreachService.Send(c.Request.Context(), *adminID, &req)
	if xerr != nil {
		errx.JSON(c, xerr)
		return
	}

	// Audit log entry uses the message id as the target so admin
	// audit + outreach log can be joined.
	h.AdminService.LogAdminAction(
		c.Request.Context(),
		*adminID,
		"send_admin_outreach",
		"admin_outreach_message",
		&msg.ID,
		map[string]any{
			"to_email": msg.ToEmail,
			"subject":  msg.Subject,
			"reply_to": req.ReplyTo,
		},
		c.ClientIP(),
		c.Request.UserAgent(),
	)
	c.JSON(http.StatusCreated, msg)
}

// AdminListOutreach is GET /admin/outreach?limit=50.
func (h *Handler) AdminListOutreach(c *gin.Context) {
	if h.AdminOutreachService == nil {
		errx.JSON(c, errx.New(errx.Internal, "admin outreach service not available"))
		return
	}
	limit, _ := strconv.Atoi(c.Query("limit"))
	rows, xerr := h.AdminOutreachService.List(c.Request.Context(), limit)
	if xerr != nil {
		errx.JSON(c, xerr)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}
