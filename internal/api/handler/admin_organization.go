package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/warmbly/warmbly/internal/errx"
	"github.com/warmbly/warmbly/internal/models"
)

// AdminListOrganizations returns the paginated admin org listing.
func (h *Handler) AdminListOrganizations(c *gin.Context) {
	var search models.AdminOrgSearch
	if err := c.ShouldBindQuery(&search); err != nil {
		errx.JSON(c, errx.New(errx.BadRequest, "invalid query parameters"))
		return
	}

	result, xerr := h.OrganizationService.SearchOrganizationsForAdmin(c.Request.Context(), &search)
	if xerr != nil {
		errx.JSON(c, xerr)
		return
	}
	c.JSON(http.StatusOK, result)
}

// AdminGetOrganization returns the detail payload for a single org.
func (h *Handler) AdminGetOrganization(c *gin.Context) {
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		errx.JSON(c, errx.New(errx.BadRequest, "invalid organization ID"))
		return
	}

	detail, xerr := h.OrganizationService.GetOrganizationAdminDetail(c.Request.Context(), orgID)
	if xerr != nil {
		errx.JSON(c, xerr)
		return
	}
	c.JSON(http.StatusOK, detail)
}

// AdminGetOrganizationMembers returns the members of an org with users.
func (h *Handler) AdminGetOrganizationMembers(c *gin.Context) {
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		errx.JSON(c, errx.New(errx.BadRequest, "invalid organization ID"))
		return
	}

	members, xerr := h.OrganizationService.GetOrganizationMembersForAdmin(c.Request.Context(), orgID)
	if xerr != nil {
		errx.JSON(c, xerr)
		return
	}
	c.JSON(http.StatusOK, &models.AdminOrgMembersResult{Data: members})
}
