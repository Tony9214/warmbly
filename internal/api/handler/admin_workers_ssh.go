// Admin endpoints for the SSH-managed worker lifecycle.
//
// Flow:
//   1. Admin POSTs to /admin/workers with host/port/user + name.
//      Backend generates an ed25519 keypair, encrypts the private key via the
//      cipher service under the platform identity, stores the row in
//      `pending` state, and returns the public key to paste into the VPS's
//      ~/.ssh/authorized_keys.
//   2. Admin pastes the pubkey, then POSTs /admin/workers/:id/test.
//      Backend opens an SSH session and runs `true`. First successful connect
//      pins the host fingerprint (TOFU).
//   3. Admin POSTs /admin/workers/:id/install. Backend uploads the project's
//      install-worker.sh + a per-worker env file and runs the installer.
//      install_state moves pending → provisioning → installed.
//   4. Admin can then restart / update / uninstall / rotate-keys / get logs /
//      get a live status snapshot.
//
// The encrypted private key is never returned over the API.

package handler

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/warmbly/warmbly/internal/api/middleware"
	"github.com/warmbly/warmbly/internal/app/worker_orchestrator"
	"github.com/warmbly/warmbly/internal/errx"
	"github.com/warmbly/warmbly/internal/models"
	"github.com/warmbly/warmbly/internal/repository"
)

// DTOs

type adminCreateWorkerRequest struct {
	Name              string `json:"name" binding:"required"`
	Notes             string `json:"notes"`
	WorkerType        string `json:"worker_type" binding:"required,oneof=shared dedicated"`
	FreeTier          bool   `json:"free_tier"`
	SSHHost           string `json:"ssh_host" binding:"required"`
	SSHPort           int    `json:"ssh_port"`
	SSHUser           string `json:"ssh_user"`
	GenerateEnrollURL bool   `json:"generate_enrollment_token"`
}

type adminCreateWorkerResponse struct {
	*models.Worker
	// SSHPublicKey is what the admin pastes into the VPS's authorized_keys.
	SSHPublicKey       string `json:"ssh_public_key"`
	EnrollmentToken    string `json:"enrollment_token,omitempty"`
	EnrollmentTokenTTL int    `json:"enrollment_token_ttl_seconds,omitempty"`
}

// handlers

// AdminCreateWorker creates a new SSH-managed worker.
//   POST /admin/workers
func (h *Handler) AdminCreateWorker(c *gin.Context) {
	if h.WorkerOrchestrator == nil || h.WorkerRepo == nil {
		errx.JSON(c, errx.New(errx.Internal, "worker orchestrator not configured"))
		return
	}

	var req adminCreateWorkerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errx.JSON(c, errx.New(errx.BadRequest, "invalid request body"))
		return
	}
	if req.SSHPort == 0 {
		req.SSHPort = 22
	}
	if req.SSHUser == "" {
		req.SSHUser = "root"
	}

	pub, priv, err := keypairGen()
	if err != nil {
		errx.JSON(c, errx.New(errx.Internal, "failed to generate keypair"))
		return
	}
	encPriv, err := h.WorkerOrchestrator.EncryptPrivateKey(c.Request.Context(), priv)
	if err != nil {
		errx.JSON(c, errx.New(errx.Internal, "failed to encrypt key"))
		return
	}

	workerID := uuid.New()

	var (
		enrollToken     string
		enrollHash      string
		enrollExpiresAt *time.Time
	)
	if req.GenerateEnrollURL {
		raw := make([]byte, 32)
		if _, err := rand.Read(raw); err != nil {
			errx.JSON(c, errx.New(errx.Internal, "failed to generate enrollment token"))
			return
		}
		enrollToken = hex.EncodeToString(raw)
		sum := sha256.Sum256([]byte(enrollToken))
		enrollHash = hex.EncodeToString(sum[:])
		exp := time.Now().Add(2 * time.Hour)
		enrollExpiresAt = &exp
	}

	if err := h.WorkerRepo.CreateWorker(c.Request.Context(), repository.CreateWorkerInput{
		ID:                     workerID,
		Name:                   req.Name,
		Notes:                  req.Notes,
		IPAddr:                 req.SSHHost,
		WorkerType:             models.WorkerType(req.WorkerType),
		FreeTier:               req.FreeTier,
		SSHHost:                req.SSHHost,
		SSHPort:                req.SSHPort,
		SSHUser:                req.SSHUser,
		SSHPublicKey:           pub,
		SSHPrivateKeyEncrypted: encPriv,
		EnrollmentTokenHash:    enrollHash,
		EnrollmentTokenExpires: enrollExpiresAt,
	}); err != nil {
		errx.JSON(c, errx.New(errx.Internal, "failed to create worker: "+err.Error()))
		return
	}

	w, xerr := h.fetchWorker(c, workerID)
	if xerr != nil {
		return
	}

	resp := adminCreateWorkerResponse{
		Worker:       w,
		SSHPublicKey: pub,
	}
	if enrollToken != "" {
		resp.EnrollmentToken = enrollToken
		resp.EnrollmentTokenTTL = int(2 * time.Hour / time.Second)
	}
	h.audit(c, models.AuditActionCreate, models.AuditEntityWorker, &workerID, map[string]string{
		"name":     req.Name,
		"ssh_host": req.SSHHost,
		"tier":     req.WorkerType,
	})
	c.JSON(http.StatusCreated, resp)
}

// AdminListSSHWorkers lists all workers with their install state and last_seen.
//   GET /admin/workers/managed
func (h *Handler) AdminListSSHWorkers(c *gin.Context) {
	if h.WorkerRepo == nil {
		errx.JSON(c, errx.New(errx.Internal, "worker repo not configured"))
		return
	}
	workers, err := h.WorkerRepo.ListWorkersDetail(c.Request.Context())
	if err != nil {
		errx.JSON(c, errx.New(errx.Internal, err.Error()))
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": workers})
}

// AdminGetSSHWorker returns full worker detail.
//   GET /admin/workers/:id/managed
func (h *Handler) AdminGetSSHWorker(c *gin.Context) {
	w, xerr := h.parseAndFetch(c)
	if xerr != nil {
		return
	}
	c.JSON(http.StatusOK, w)
}

// AdminTestWorker runs a no-op SSH command. Pins the host fingerprint on
// first success.
//   POST /admin/workers/:id/test
func (h *Handler) AdminTestWorker(c *gin.Context) {
	id, ok := h.parseID(c)
	if !ok {
		return
	}
	if err := h.WorkerOrchestrator.TestConnection(c.Request.Context(), id); err != nil {
		h.audit(c, models.AuditActionTest, models.AuditEntityWorker, &id, map[string]string{"ok": "false", "error": err.Error()})
		c.JSON(http.StatusOK, gin.H{"ok": false, "error": err.Error()})
		return
	}
	h.audit(c, models.AuditActionTest, models.AuditEntityWorker, &id, map[string]string{"ok": "true"})
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// AdminInstallWorker uploads installer + env file and runs it.
//   POST /admin/workers/:id/install
func (h *Handler) AdminInstallWorker(c *gin.Context) {
	id, ok := h.parseID(c)
	if !ok {
		return
	}
	if err := h.WorkerOrchestrator.Install(c.Request.Context(), id); err != nil {
		h.audit(c, models.AuditActionInstall, models.AuditEntityWorker, &id, map[string]string{"ok": "false", "error": err.Error()})
		errx.JSON(c, errx.New(errx.Internal, err.Error()))
		return
	}
	h.audit(c, models.AuditActionInstall, models.AuditEntityWorker, &id, nil)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) AdminRestartWorker(c *gin.Context) {
	id, ok := h.parseID(c)
	if !ok {
		return
	}
	if err := h.WorkerOrchestrator.Restart(c.Request.Context(), id); err != nil {
		errx.JSON(c, errx.New(errx.Internal, err.Error()))
		return
	}
	h.audit(c, models.AuditActionRestart, models.AuditEntityWorker, &id, nil)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) AdminUpdateWorkerImage(c *gin.Context) {
	id, ok := h.parseID(c)
	if !ok {
		return
	}
	if err := h.WorkerOrchestrator.Update(c.Request.Context(), id); err != nil {
		errx.JSON(c, errx.New(errx.Internal, err.Error()))
		return
	}
	h.audit(c, models.AuditActionUpgrade, models.AuditEntityWorker, &id, nil)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) AdminUninstallWorker(c *gin.Context) {
	id, ok := h.parseID(c)
	if !ok {
		return
	}
	if err := h.WorkerOrchestrator.Uninstall(c.Request.Context(), id); err != nil {
		errx.JSON(c, errx.New(errx.Internal, err.Error()))
		return
	}
	h.audit(c, models.AuditActionUninstall, models.AuditEntityWorker, &id, nil)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) AdminWorkerStatusLive(c *gin.Context) {
	id, ok := h.parseID(c)
	if !ok {
		return
	}
	st, err := h.WorkerOrchestrator.Status(c.Request.Context(), id)
	if err != nil {
		errx.JSON(c, errx.New(errx.Internal, err.Error()))
		return
	}
	c.JSON(http.StatusOK, st)
}

func (h *Handler) AdminWorkerLogs(c *gin.Context) {
	id, ok := h.parseID(c)
	if !ok {
		return
	}
	lines, _ := strconv.Atoi(c.Query("lines"))
	logs, err := h.WorkerOrchestrator.TailLogs(c.Request.Context(), id, lines)
	if err != nil {
		errx.JSON(c, errx.New(errx.Internal, err.Error()))
		return
	}
	c.JSON(http.StatusOK, gin.H{"logs": logs})
}

func (h *Handler) AdminRotateWorkerKeys(c *gin.Context) {
	id, ok := h.parseID(c)
	if !ok {
		return
	}
	newPub, err := h.WorkerOrchestrator.RotateKeys(c.Request.Context(), id)
	if err != nil {
		errx.JSON(c, errx.New(errx.Internal, err.Error()))
		return
	}
	h.audit(c, models.AuditActionRotateKeys, models.AuditEntityWorker, &id, nil)
	c.JSON(http.StatusOK, gin.H{"ssh_public_key": newPub})
}

func (h *Handler) AdminSystemUpdate(c *gin.Context) {
	id, ok := h.parseID(c)
	if !ok {
		return
	}
	r, err := h.WorkerOrchestrator.SystemUpdate(c.Request.Context(), id)
	if err != nil {
		// Return the partial output to the client so they can see what failed
		errx.JSON(c, errx.New(errx.Internal, err.Error()))
		return
	}
	meta := map[string]string{}
	if r != nil && r.RebootRequired {
		meta["reboot_required"] = "true"
	}
	h.audit(c, models.AuditActionSystemUpdate, models.AuditEntityWorker, &id, meta)
	c.JSON(http.StatusOK, r)
}

func (h *Handler) AdminRebootWorker(c *gin.Context) {
	id, ok := h.parseID(c)
	if !ok {
		return
	}
	if err := h.WorkerOrchestrator.RebootWorker(c.Request.Context(), id); err != nil {
		errx.JSON(c, errx.New(errx.Internal, err.Error()))
		return
	}
	h.audit(c, models.AuditActionReboot, models.AuditEntityWorker, &id, nil)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) AdminDeleteSSHWorker(c *gin.Context) {
	id, ok := h.parseID(c)
	if !ok {
		return
	}
	// Best-effort uninstall first. Ignore errors — the row deletion happens
	// regardless so an unreachable worker doesn't leave orphan records.
	_ = h.WorkerOrchestrator.Uninstall(c.Request.Context(), id)
	if err := h.WorkerRepo.DeleteWorker(c.Request.Context(), id); err != nil {
		errx.JSON(c, errx.New(errx.Internal, err.Error()))
		return
	}
	h.audit(c, models.AuditActionDelete, models.AuditEntityWorker, &id, nil)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// helpers

func (h *Handler) parseID(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		errx.JSON(c, errx.New(errx.BadRequest, "invalid worker ID"))
		return uuid.Nil, false
	}
	return id, true
}

// audit fires an audit log entry for the admin action. Fire-and-forget — the
// audit service spawns its own goroutine so this never blocks the response.
// Safe to call with nil entityID and/or nil metadata.
func (h *Handler) audit(c *gin.Context, action models.AuditAction, entity models.AuditEntityType, entityID *uuid.UUID, metadata map[string]string) {
	if h.AuditService == nil {
		return
	}
	adminID := middleware.GetAdminUserID(c)
	if adminID == nil {
		return
	}
	h.AuditService.LogAction(
		c.Request.Context(),
		*adminID,
		action,
		entity,
		entityID,
		c.ClientIP(),
		c.GetHeader("User-Agent"),
		nil,
		metadata,
	)
}

func (h *Handler) parseAndFetch(c *gin.Context) (*models.Worker, error) {
	id, ok := h.parseID(c)
	if !ok {
		return nil, errors.New("bad id")
	}
	return h.fetchWorker(c, id)
}

func (h *Handler) fetchWorker(c *gin.Context, id uuid.UUID) (*models.Worker, error) {
	w, err := h.WorkerRepo.GetWorkerDetail(c.Request.Context(), id)
	if err != nil {
		errx.JSON(c, errx.New(errx.Internal, err.Error()))
		return nil, err
	}
	if w == nil {
		errx.JSON(c, errx.New(errx.NotFound, "worker not found"))
		return nil, errors.New("not found")
	}
	return w, nil
}

func keypairGen() (pub, priv string, err error) {
	return worker_orchestrator.GenerateKeypair()
}
