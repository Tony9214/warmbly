package scheduler

import (
	"math"
	"math/rand"
	"sort"
	"time"

	"github.com/warmbly/warmbly/internal/models"
	"github.com/warmbly/warmbly/internal/repository"
)

// findNextValidDay finds the next valid day based on campaign days bitmask
// Bit 0 = Sunday, Bit 1 = Monday, ..., Bit 6 = Saturday
func findNextValidDay(from time.Time, daysBitmask uint8, tz *time.Location) time.Time {
	if daysBitmask == 0 {
		// If no days specified, allow all days
		return from
	}

	candidate := from.In(tz)

	// Try up to 7 days
	for i := 0; i < 7; i++ {
		dayOfWeek := int(candidate.Weekday())
		if (daysBitmask & (1 << dayOfWeek)) != 0 {
			return candidate
		}
		candidate = candidate.Add(24 * time.Hour)
	}

	// If no valid day found in 7 days, just return the input
	return from
}

// ensureTimeWindow ensures time is within the allowed window (start_time to end_time)
func ensureTimeWindow(t time.Time, startTime, endTime string, tz *time.Location) time.Time {
	start := parseTimeOfDay(startTime) // Minutes since midnight
	end := parseTimeOfDay(endTime)

	if start == 0 && end == 0 {
		// No time window specified, allow any time
		return t
	}

	tLocal := t.In(tz)
	minutesOfDay := tLocal.Hour()*60 + tLocal.Minute()

	if minutesOfDay < start {
		// Too early, move to start time today
		return time.Date(tLocal.Year(), tLocal.Month(), tLocal.Day(),
			start/60, start%60, 0, 0, tz)
	}

	if minutesOfDay > end {
		// Too late, move to tomorrow's start time
		next := tLocal.Add(24 * time.Hour)
		return time.Date(next.Year(), next.Month(), next.Day(),
			start/60, start%60, 0, 0, tz)
	}

	return t
}

// ensureBusinessHours ensures time is within business hours (8am-8pm)
func ensureBusinessHours(t time.Time, timezone string) time.Time {
	loc := loadLocation(timezone)
	return ensureTimeWindow(t, "08:00", "20:00", loc)
}

// avoidRoundTimes adds randomness to avoid exact round times (10:00, 11:00)
func avoidRoundTimes(t time.Time) time.Time {
	if t.Minute() == 0 {
		// Move to random minute between 3-12
		offset := randomJitter(3, 12)
		return t.Add(time.Minute * time.Duration(offset))
	}
	return t
}

// applyDistributionCurve applies human-like distribution patterns
// Favors morning (9-11am) and afternoon (2-4pm) peaks
func applyDistributionCurve(t time.Time, tz *time.Location) time.Time {
	hour := t.In(tz).Hour()

	// Avoid lunch hour (12-1pm) - 30% chance to push to 1:15pm
	if hour == 12 {
		if rand.Float64() < 0.3 {
			minutes := 75 + randomJitter(0, 30)
			return t.Add(time.Minute * time.Duration(minutes))
		}
	}

	// Slightly avoid very early (before 9am) and very late (after 6pm)
	// Add small random delays to push toward peak hours
	if hour < 9 {
		// Small chance to push to 9am
		if rand.Float64() < 0.2 {
			target := time.Date(t.Year(), t.Month(), t.Day(), 9, 0, 0, 0, tz)
			if target.After(t) {
				offset := randomJitter(0, 30)
				return target.Add(time.Minute * time.Duration(offset))
			}
		}
	}

	return t
}

// resolveConflicts resolves scheduling conflicts with existing tasks
// Ensures minimum spacing between emails from the same account
func resolveConflicts(desired time.Time, scheduled []repository.Task, minWait int) time.Time {
	if len(scheduled) == 0 {
		return desired
	}

	// Sort tasks by scheduled time
	sort.Slice(scheduled, func(i, j int) bool {
		if scheduled[i].ScheduledAt == nil || scheduled[j].ScheduledAt == nil {
			return false
		}
		return scheduled[i].ScheduledAt.Before(*scheduled[j].ScheduledAt)
	})

	candidate := desired
	maxAttempts := 100

	for attempt := 0; attempt < maxAttempts; attempt++ {
		hasConflict := false

		for _, task := range scheduled {
			if task.ScheduledAt == nil {
				continue
			}

			diff := math.Abs(candidate.Sub(*task.ScheduledAt).Seconds())

			if diff < float64(minWait) {
				// Conflict! Move candidate after this task
				hasConflict = true
				candidate = task.ScheduledAt.Add(time.Second * time.Duration(minWait))

				// Add small random jitter to avoid creating a new conflict
				jitterMinutes := randomJitter(1, 5)
				candidate = candidate.Add(time.Minute * time.Duration(jitterMinutes))
				break
			}
		}

		if !hasConflict {
			return candidate
		}
	}

	// If still conflicts after 100 attempts, push to next hour
	return candidate.Add(time.Hour)
}

// selectAccountForSend selects an email account for sending (round-robin or least loaded)
func selectAccountForSend(accounts []models.Email, currentTime time.Time) *models.Email {
	if len(accounts) == 0 {
		return nil
	}

	// For now, use simple round-robin based on current minute
	index := currentTime.Minute() % len(accounts)
	return &accounts[index]
}
