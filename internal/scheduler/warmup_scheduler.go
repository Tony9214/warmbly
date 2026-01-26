package scheduler

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// CalculateNextWarmupTime calculates the next best time to send a warmup email
// This implements the progressive warmup algorithm with anti-spam patterns
func (s *schedulerService) CalculateNextWarmupTime(ctx context.Context, accountID uuid.UUID) (time.Time, error) {
	// STEP 1: Load email account details
	account, xerr := s.emailRepo.GetByID(ctx, accountID)
	if xerr != nil {
		return time.Time{}, xerr
	}

	if account.Warmup == nil {
		return time.Time{}, ErrWarmupNotEnabled
	}

	// STEP 2: Calculate target volume for today based on progression
	daysSinceStart := time.Since(*account.Warmup).Hours() / 24
	targetVolume := min(
		account.WarmupBase+int(daysSinceStart)*account.WarmupIncrease,
		account.WarmupMax,
	)

	// STEP 3: Count emails already sent today
	emailsSentToday, err := s.taskRepo.CountEmailsSentToday(ctx, accountID)
	if err != nil {
		return time.Time{}, err
	}

	// STEP 4: Check if we've hit today's limit
	if emailsSentToday >= targetVolume {
		// Move to tomorrow's first slot (8am-9am local time)
		return calculateFirstSlotTomorrow(account.Timezone), nil
	}

	// STEP 5: Calculate ideal spacing
	// Distribute remaining emails across remaining business hours
	remainingSlots := targetVolume - emailsSentToday
	hoursRemaining := calculateBusinessHoursRemaining(account.Timezone)

	// If business hours are over, move to tomorrow
	if hoursRemaining <= 0 {
		return calculateFirstSlotTomorrow(account.Timezone), nil
	}

	idealIntervalHours := hoursRemaining / float64(remainingSlots)

	// STEP 6: Get last email time and apply min_wait_time
	lastEmailTime, err := s.taskRepo.GetLastEmailTime(ctx, accountID)
	if err != nil {
		return time.Time{}, err
	}

	now := time.Now()
	earliestNext := now

	if lastEmailTime != nil {
		minWait := time.Second * time.Duration(account.MinWaitTime)
		earliestNext = lastEmailTime.Add(minWait)
	}

	// If earliestNext is in the past, use now
	if earliestNext.Before(now) {
		earliestNext = now
	}

	// STEP 7: Add ideal interval to last email time
	if lastEmailTime != nil && idealIntervalHours > 0 {
		idealNext := lastEmailTime.Add(time.Duration(idealIntervalHours * float64(time.Hour)))
		if idealNext.After(earliestNext) {
			earliestNext = idealNext
		}
	}

	// STEP 8: Add human-like jitter (±15 minutes)
	jitter := randomJitter(-15, 15)
	candidateTime := earliestNext.Add(time.Minute * time.Duration(jitter))

	// STEP 9: Avoid exact round times (10:00, 11:00)
	candidateTime = avoidRoundTimes(candidateTime)

	// STEP 10: Ensure within business hours (8am-8pm)
	candidateTime = ensureBusinessHours(candidateTime, account.Timezone)

	// STEP 11: Check conflicts with other tasks on this account
	scheduledTasks, err := s.taskRepo.GetScheduledTasksToday(ctx, accountID)
	if err != nil {
		return time.Time{}, err
	}

	candidateTime = resolveConflicts(candidateTime, scheduledTasks, account.MinWaitTime)

	// STEP 12: Apply human-like distribution curve
	loc := loadLocation(account.Timezone)
	candidateTime = applyDistributionCurve(candidateTime, loc)

	return candidateTime, nil
}
