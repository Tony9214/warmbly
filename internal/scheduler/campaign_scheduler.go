package scheduler

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/warmbly/warmbly/internal/repository"
)

// CalculateNextCampaignTime calculates the next best time to send a campaign email
// Returns: nextTime, contactSequencePair, emailAccountID, error
func (s *schedulerService) CalculateNextCampaignTime(ctx context.Context, campaignID uuid.UUID) (time.Time, *repository.ContactSequencePair, uuid.UUID, error) {
	// STEP 1: Load campaign details
	campaign, err := s.campaignRepo.GetByID(ctx, campaignID)
	if err != nil {
		return time.Time{}, nil, uuid.Nil, err
	}

	if campaign.Status != "active" {
		return time.Time{}, nil, uuid.Nil, ErrCampaignNotActive
	}

	// STEP 2: Get all email accounts assigned to this campaign (via tags)
	accounts, err := s.emailRepo.GetByTags(ctx, campaign.UserID, campaign.EmailTags)
	if err != nil {
		return time.Time{}, nil, uuid.Nil, err
	}

	if len(accounts) == 0 {
		return time.Time{}, nil, uuid.Nil, ErrNoEmailAccounts
	}

	// STEP 3: Get campaign progress - find next contact/sequence to send
	nextPair, err := s.campaignProgressRepo.FindNextContactSequence(ctx, campaignID)
	if err != nil {
		return time.Time{}, nil, uuid.Nil, err
	}

	if nextPair == nil {
		return time.Time{}, nil, uuid.Nil, ErrCampaignCompleted
	}

	// STEP 4: Calculate base time from sequence wait_after
	baseTime := time.Now()

	// Check if this contact has already received emails in this campaign
	lastSentTime, err := s.campaignProgressRepo.GetContactLastSequenceTime(ctx, nextPair.ContactID, campaignID)
	if err != nil {
		return time.Time{}, nil, uuid.Nil, err
	}

	if lastSentTime != nil {
		// Get sequence details to know wait_after
		sequence, err := s.campaignRepo.GetSequenceByID(ctx, nextPair.SequenceID)
		if err != nil {
			return time.Time{}, nil, uuid.Nil, err
		}

		// Add wait_after days to last sent time
		waitDuration := time.Hour * 24 * time.Duration(sequence.WaitAfter)
		baseTime = lastSentTime.Add(waitDuration)
	}

	// STEP 5: Apply campaign schedule constraints
	campaignTZ := loadLocation(campaign.Timezone)
	candidateTime := baseTime

	// Check campaign date range
	if campaign.StartDate != nil && candidateTime.Before(*campaign.StartDate) {
		candidateTime = *campaign.StartDate
	}

	if campaign.EndDate != nil && candidateTime.After(*campaign.EndDate) {
		return time.Time{}, nil, uuid.Nil, ErrCampaignEnded
	}

	// STEP 6: Find next valid day of week (campaign.Days is bitmask)
	candidateTime = findNextValidDay(candidateTime, uint8(campaign.Days), campaignTZ)

	// STEP 7: Ensure within campaign time window (start_time to end_time)
	candidateTime = ensureTimeWindow(candidateTime, campaign.StartTime, campaign.EndTime, campaignTZ)

	// STEP 8: Select email account (round-robin or least loaded)
	account := selectAccountForSend(accounts, candidateTime)
	if account == nil {
		return time.Time{}, nil, uuid.Nil, ErrNoEmailAccounts
	}

	// STEP 9: Check account daily limits
	emailsSentToday, err := s.taskRepo.CountEmailsSentToday(ctx, account.ID)
	if err != nil {
		return time.Time{}, nil, uuid.Nil, err
	}

	accountLimit := min(account.CampaignLimit, campaign.DailyLimit)

	if emailsSentToday >= accountLimit {
		// Move to next day and retry time window
		candidateTime = candidateTime.Add(24 * time.Hour)
		candidateTime = findNextValidDay(candidateTime, uint8(campaign.Days), campaignTZ)
		candidateTime = ensureTimeWindow(candidateTime, campaign.StartTime, campaign.EndTime, campaignTZ)
	}

	// STEP 10: Respect minimum wait time from account's last email
	lastEmailTime, err := s.taskRepo.GetLastEmailTime(ctx, account.ID)
	if err != nil {
		return time.Time{}, nil, uuid.Nil, err
	}

	if lastEmailTime != nil {
		minWait := time.Second * time.Duration(account.MinWaitTime)
		earliestNext := lastEmailTime.Add(minWait)

		if candidateTime.Before(earliestNext) {
			candidateTime = earliestNext
			// Re-apply time window after adjusting for min wait
			candidateTime = ensureTimeWindow(candidateTime, campaign.StartTime, campaign.EndTime, campaignTZ)
		}
	}

	// STEP 11: Add jitter and round to nearest 5 minutes
	jitter := randomJitter(-20, 20)
	candidateTime = candidateTime.Add(time.Minute * time.Duration(jitter))
	candidateTime = roundToNearestMinute(candidateTime, 5)

	// STEP 12: Check conflicts with other scheduled tasks
	dateToCheck := candidateTime
	scheduledTasks, err := s.taskRepo.GetScheduledTasksForAccount(ctx, account.ID, dateToCheck)
	if err != nil {
		return time.Time{}, nil, uuid.Nil, err
	}

	candidateTime = resolveConflicts(candidateTime, scheduledTasks, account.MinWaitTime)

	// STEP 13: Apply human-like distribution (favor morning/afternoon peaks)
	candidateTime = applyDistributionCurve(candidateTime, campaignTZ)

	// STEP 14: Ensure still within campaign window after all adjustments
	candidateTime = ensureTimeWindow(candidateTime, campaign.StartTime, campaign.EndTime, campaignTZ)

	return candidateTime, nextPair, account.ID, nil
}
