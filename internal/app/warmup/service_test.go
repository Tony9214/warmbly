package warmup

import (
	"testing"
	"time"

	"github.com/warmbly/warmbly/internal/models"
)

func TestEvaluateMetricsInvalidAttemptsBlock(t *testing.T) {
	now := time.Date(2026, 4, 3, 12, 0, 0, 0, time.UTC)

	decision := evaluateMetrics(&models.WarmupHealthMetrics{
		SentLast7d:            5,
		SpamReportsLast7d:     0,
		SpamPlacementRate:     0,
		InvalidAttemptsLast24: 3,
	}, now)

	if decision.State != models.WarmupHealthBlocked {
		t.Fatalf("expected blocked state, got %s", decision.State)
	}
	if decision.BlockedUntil == nil || !decision.BlockedUntil.Equal(now.Add(warmupBlockDuration)) {
		t.Fatalf("expected 30d block, got %#v", decision.BlockedUntil)
	}
}

func TestEvaluateMetricsSpamThresholds(t *testing.T) {
	now := time.Date(2026, 4, 3, 12, 0, 0, 0, time.UTC)

	tests := []struct {
		name        string
		rate        float64
		wantState   models.WarmupHealthState
		wantBlocked time.Duration
	}{
		{name: "watch", rate: 10, wantState: models.WarmupHealthWatch},
		{name: "quarantine", rate: 20, wantState: models.WarmupHealthQuarantined, wantBlocked: warmupQuarantineDuration},
		{name: "block", rate: 40, wantState: models.WarmupHealthBlocked, wantBlocked: warmupBlockDuration},
		{name: "catastrophic", rate: 80, wantState: models.WarmupHealthBlocked, wantBlocked: warmupCatastrophicBlock},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			decision := evaluateMetrics(&models.WarmupHealthMetrics{
				SentLast7d:        20,
				SpamReportsLast7d: 4,
				SpamPlacementRate: tc.rate,
			}, now)

			if decision.State != tc.wantState {
				t.Fatalf("expected %s, got %s", tc.wantState, decision.State)
			}
			if tc.wantBlocked == 0 {
				if decision.BlockedUntil != nil {
					t.Fatalf("expected no block, got %#v", decision.BlockedUntil)
				}
				return
			}
			if decision.BlockedUntil == nil || !decision.BlockedUntil.Equal(now.Add(tc.wantBlocked)) {
				t.Fatalf("expected blocked until %s, got %#v", now.Add(tc.wantBlocked), decision.BlockedUntil)
			}
		})
	}
}

func TestEvaluateMetricsIgnoresSmallSamples(t *testing.T) {
	now := time.Date(2026, 4, 3, 12, 0, 0, 0, time.UTC)

	decision := evaluateMetrics(&models.WarmupHealthMetrics{
		SentLast7d:        19,
		SpamReportsLast7d: 19,
		SpamPlacementRate: 100,
	}, now)

	if decision.State != models.WarmupHealthHealthy {
		t.Fatalf("expected healthy for undersampled account, got %s", decision.State)
	}
	if decision.BlockedUntil != nil {
		t.Fatalf("expected no block, got %#v", decision.BlockedUntil)
	}
}
