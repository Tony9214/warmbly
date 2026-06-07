package advanced

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"github.com/warmbly/warmbly/internal/models"
	"github.com/warmbly/warmbly/internal/repository"
)

// maxInstantReplyChain bounds how many action nodes a single reply event can run
// in one walk, so a malformed loop in the flow graph (a chain that routes back
// into itself) can never spin. The flow editor links chains linearly, so a real
// reply automation is far shorter than this.
const maxInstantReplyChain = 32

// fireInstantReplyActions runs the matched reply branch's action chain for a
// single contact the moment their reply is classified, instead of waiting for
// the contact's next scheduled step boundary. It is the instant, contact-targeted
// half of the reply-branch system: the scheduler still handles engagement
// branches (opened/clicked) and the email steps; this only short-circuits the
// reply_* branches so "on reply, do X then Y" happens immediately.
//
// Everything here is best-effort and swallows errors (logging only): reply
// detection runs in the consumer's inbox hot path, so a CRM hiccup must never
// block ingest. Exactly-once is enforced by ClaimReplyActionFire before any side
// effect runs, so a redelivered reply event (or an auto-reply followed by a human
// reply on the same step) cannot double-fire the chain.
func (s *service) fireInstantReplyActions(ctx context.Context, campaignID, contactID, currentStepID uuid.UUID, replyClass string) {
	// Load the campaign's steps with routing fields (kind/action/conditions).
	steps, err := s.campaignRepo.GetSequencesRoutingByCampaignID(ctx, campaignID)
	if err != nil {
		log.Warn().Err(err).Str("campaign_id", campaignID.String()).Msg("instant reply actions: failed to load campaign steps")
		return
	}
	if len(steps) == 0 {
		return
	}
	byID := make(map[uuid.UUID]*models.Sequence, len(steps))
	for i := range steps {
		byID[steps[i].ID] = &steps[i]
	}

	current, ok := byID[currentStepID]
	if !ok {
		return
	}

	// Decode the current step's branching tree and find the matched reply branch.
	var bc models.BranchConditions
	if len(current.Conditions) > 0 {
		if uerr := json.Unmarshal(current.Conditions, &bc); uerr != nil {
			log.Warn().Err(uerr).Str("campaign_id", campaignID.String()).Str("step_id", currentStepID.String()).Msg("instant reply actions: bad conditions json")
			return
		}
	}
	// REUSE the scheduler's matchers (replyClassMatches / conditionState) via the
	// exported MatchReplyBranchTarget: first reply_* branch in declared order whose
	// conditions all hold wins. prog carries the just-classified reply class.
	prog := &repository.CampaignContactProgress{
		CampaignID: campaignID,
		ContactID:  contactID,
		SequenceID: currentStepID,
		ReplyClass: replyClass,
	}
	matched, target := repository.MatchReplyBranchTarget(&bc, prog)
	if !matched {
		return // no reply branch on this step matches this reply
	}
	if target == nil {
		return // matched a STOP branch: nothing to execute instantly
	}

	// IDEMPOTENCY: claim the one-time fire right BEFORE any side effect. If another
	// reply event already fired this step's chain, stop here.
	claimed, cerr := s.campaignProgressRepo.ClaimReplyActionFire(ctx, campaignID, contactID, currentStepID)
	if cerr != nil {
		log.Warn().Err(cerr).Str("campaign_id", campaignID.String()).Str("contact_id", contactID.String()).Msg("instant reply actions: claim failed")
		return
	}
	if !claimed {
		return // already fired for this step (or no progress row): no-op
	}

	// Load the contact once for templating / activity records.
	contact, xerr := s.contactRepo.GetByID(ctx, contactID)
	if xerr != nil || contact == nil {
		log.Warn().Str("campaign_id", campaignID.String()).Str("contact_id", contactID.String()).Msg("instant reply actions: contact load failed")
		return
	}
	campaign, cmErr := s.campaignRepo.GetByID(ctx, campaignID)
	if cmErr != nil || campaign == nil {
		log.Warn().Str("campaign_id", campaignID.String()).Msg("instant reply actions: campaign load failed")
		return
	}

	// Walk the linear ACTION chain from the matched branch's target. Stop at a
	// non-action node (an email step resumes via the normal scheduler), an "end",
	// or a "wait" (a wait means "not instant" — hand back to the scheduler).
	stepID := *target
	for hops := 0; hops < maxInstantReplyChain; hops++ {
		node, live := byID[stepID]
		if !live {
			return // deleted / dangling target ends the instant chain
		}
		if node.Kind != "action" {
			return // email step (or unknown kind): resumes at the step boundary
		}
		var cfg models.ActionConfig
		if len(node.Action) > 0 {
			if uerr := json.Unmarshal(node.Action, &cfg); uerr != nil {
				log.Warn().Err(uerr).Str("campaign_id", campaignID.String()).Str("step_id", node.ID.String()).Msg("instant reply actions: bad action json")
				return
			}
		}
		// A "wait" node means "not instant" — stop here and let the normal
		// scheduler resume the contact after the wait. "end" terminates the chain.
		if cfg.Type == "wait" {
			return
		}
		if cfg.Type == "end" || cfg.Type == "" {
			return
		}

		s.executeReplyActionNode(ctx, campaign, contact, &cfg)

		// Stamp this action node as "sent" for the contact. The scheduler's
		// FindNextRoutedPair loop-guard (sentIDs) skips steps with sent_at set, so
		// this is what stops the scheduler from re-running the very same chain when
		// it later routes the contact through the reply branch at the next step
		// boundary. Without it the chain would double-fire (deals/tasks/webhooks)
		// whenever stop_on_reply is off or the reply was automated. Mirrors the
		// scheduler's own action-node bookkeeping (tasks.campaign_task).
		if rerr := s.campaignProgressRepo.RecordEmailSent(ctx, campaignID, contactID, node.ID); rerr != nil {
			log.Warn().Err(rerr).Str("campaign_id", campaignID.String()).Str("step_id", node.ID.String()).Msg("instant reply actions: failed to stamp action node sent")
		}

		// Advance to the next node in the chain by following this action node's
		// own unconditional onward branch (the editor links action chains with a
		// single catch-all connection). Anything reply-conditional or engagement-
		// conditional past here is left to the scheduler.
		next, ok := nextChainTarget(node)
		if !ok {
			return
		}
		stepID = next
	}
	log.Warn().Str("campaign_id", campaignID.String()).Str("contact_id", contactID.String()).Msg("instant reply actions: chain exceeded max hops; stopping")
}

// nextChainTarget returns the single unconditional onward target of an action
// node (the catch-all branch the editor draws between chained action steps), so
// the instant walker can follow "action -> action -> ..." without re-evaluating
// reply/engagement predicates. A node with no unconditional branch ends the
// instant chain (any conditional routing past it is the scheduler's job).
func nextChainTarget(node *models.Sequence) (uuid.UUID, bool) {
	if len(node.Conditions) == 0 {
		return uuid.Nil, false
	}
	var bc models.BranchConditions
	if err := json.Unmarshal(node.Conditions, &bc); err != nil {
		return uuid.Nil, false
	}
	for i := range bc.Branches {
		b := &bc.Branches[i]
		if len(b.Conditions) == 0 && b.TargetSequenceID != nil {
			return *b.TargetSequenceID, true
		}
	}
	return uuid.Nil, false
}

// executeReplyActionNode runs one action node's control-plane side effect for a
// contact, NOW, in response to a reply. It mirrors tasks.executeActionNode but
// stays inside the advanced service (advanced cannot import tasks — tasks imports
// advanced), reusing the same repos and the CreateContactDeal / MoveContactDealStage
// methods. Best-effort: each action logs and continues so one bad node never
// aborts the rest of the chain or blocks inbox ingest.
func (s *service) executeReplyActionNode(ctx context.Context, campaign *models.Campaign, contact *models.Contact, cfg *models.ActionConfig) {
	switch cfg.Type {
	case "add_tag":
		if cfg.CategoryID == nil {
			return
		}
		if _, xerr := s.contactRepo.Update(ctx, campaign.UserID, contact.ID.String(), &models.UpdateContact{
			AddCategories: []string{cfg.CategoryID.String()},
		}); xerr != nil {
			s.logActionErr(campaign, contact, cfg.Type, xerr)
		}
	case "remove_tag":
		if cfg.CategoryID == nil {
			return
		}
		if _, xerr := s.contactRepo.Update(ctx, campaign.UserID, contact.ID.String(), &models.UpdateContact{
			RemoveCategories: []string{cfg.CategoryID.String()},
		}); xerr != nil {
			s.logActionErr(campaign, contact, cfg.Type, xerr)
		}
	case "unsubscribe":
		if xerr := s.Unsubscribe(ctx, campaign.ID, contact.ID); xerr != nil {
			s.logActionErr(campaign, contact, cfg.Type, xerr)
		}
	case "notify":
		if campaign.OrganizationID == nil {
			return
		}
		event := models.WebhookEventCampaignAction
		if cfg.NotifyEvent != "" {
			event = models.WebhookEventType(cfg.NotifyEvent)
		}
		data := map[string]any{
			"campaign_id":   campaign.ID.String(),
			"contact_id":    contact.ID.String(),
			"contact_email": contact.Email,
			"trigger":       "reply",
		}
		for k, v := range cfg.NotifyData {
			data[k] = v
		}
		s.EmitCampaignEvent(ctx, *campaign.OrganizationID, event, data)
	case "create_task":
		if campaign.OrganizationID == nil {
			return
		}
		owner, perr := uuid.Parse(campaign.UserID)
		if perr != nil {
			return
		}
		title := strings.TrimSpace(cfg.TaskTitle)
		if title == "" {
			title = "Follow up: " + contactDisplayName(contact)
		}
		assignee := cfg.TaskAssignedTo
		if assignee == nil {
			assignee = &owner
		}
		cid := contact.ID
		data := &models.CreateCRMTask{
			ContactID:  &cid,
			Title:      title,
			Type:       cfg.TaskType,
			Priority:   cfg.TaskPriority,
			AssignedTo: assignee,
		}
		if cfg.TaskDueOffsetDays != nil {
			due := time.Now().UTC().AddDate(0, 0, *cfg.TaskDueOffsetDays)
			data.DueDate = &due
		}
		if _, xerr := s.CreateContactTask(ctx, *campaign.OrganizationID, owner, data); xerr != nil {
			s.logActionErr(campaign, contact, cfg.Type, xerr)
		}
	case "create_deal":
		if campaign.OrganizationID == nil {
			return
		}
		if cfg.DealPipelineID == nil || cfg.DealStageID == nil {
			return // misconfigured node: skip rather than abort the chain
		}
		owner, perr := uuid.Parse(campaign.UserID)
		if perr != nil {
			return
		}
		name := renderContactTemplate(strings.TrimSpace(cfg.DealName), contact)
		if name == "" {
			name = "Deal: " + contactDisplayName(contact)
		}
		currency := strings.TrimSpace(cfg.DealCurrency)
		if currency == "" {
			currency = "USD"
		}
		cid := contact.ID
		cmpID := campaign.ID
		data := &models.CreateDeal{
			PipelineID: *cfg.DealPipelineID,
			StageID:    *cfg.DealStageID,
			ContactID:  &cid,
			Name:       name,
			Value:      cfg.DealValue,
			Currency:   currency,
			CampaignID: &cmpID,
			AssignedTo: &owner,
		}
		if _, xerr := s.CreateContactDeal(ctx, *campaign.OrganizationID, owner, data); xerr != nil {
			s.logActionErr(campaign, contact, cfg.Type, xerr)
		}
	case "move_deal_stage":
		if campaign.OrganizationID == nil {
			return
		}
		if cfg.DealPipelineID == nil || cfg.DealStageID == nil {
			return
		}
		if _, xerr := s.MoveContactDealStage(ctx, *campaign.OrganizationID, contact.ID, *cfg.DealPipelineID, *cfg.DealStageID); xerr != nil {
			s.logActionErr(campaign, contact, cfg.Type, xerr)
		}
	default:
		// "wait" / "end" are handled by the chain walker (they stop the walk);
		// unknown types are ignored.
	}
}

func (s *service) logActionErr(campaign *models.Campaign, contact *models.Contact, action string, err error) {
	log.Warn().
		Str("campaign_id", campaign.ID.String()).
		Str("contact_id", contact.ID.String()).
		Str("action", action).
		Str("trigger", "reply").
		Msg(fmt.Sprintf("instant reply action failed: %v", err))
}

func contactDisplayName(contact *models.Contact) string {
	name := strings.TrimSpace(contact.FirstName + " " + contact.LastName)
	if name == "" {
		return contact.Email
	}
	return name
}

// renderContactTemplate substitutes {{.FirstName}}-style placeholders in a deal
// name. It mirrors the naive substitution path of tasks.RenderTemplate (the same
// {{.Field}} contract used on the canvas) without importing tasks, which would
// cycle (tasks imports advanced). Standard fields plus custom fields are
// supported; unknown tokens are left untouched.
func renderContactTemplate(tmpl string, contact *models.Contact) string {
	if tmpl == "" || contact == nil {
		return tmpl
	}
	out := tmpl
	out = strings.ReplaceAll(out, "{{.FirstName}}", contact.FirstName)
	out = strings.ReplaceAll(out, "{{.LastName}}", contact.LastName)
	out = strings.ReplaceAll(out, "{{.Email}}", contact.Email)
	out = strings.ReplaceAll(out, "{{.Company}}", contact.Company)
	out = strings.ReplaceAll(out, "{{.Phone}}", contact.Phone)
	for k, v := range contact.CustomFields {
		out = strings.ReplaceAll(out, "{{."+k+"}}", v)
	}
	return out
}
