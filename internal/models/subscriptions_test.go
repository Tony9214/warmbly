package models

import "testing"

func TestHasPaidSubscription(t *testing.T) {
	stripeID := "sub_test"
	for _, tc := range []struct {
		name string
		sub  Subscription
		want bool
	}{
		{"active stripe", Subscription{Status: SubscriptionStatusActive, StripeSubscriptionID: &stripeID}, true},
		{"active enterprise", Subscription{Status: SubscriptionStatusActive, IsEnterprise: true}, true},
		{"inactive enterprise", Subscription{Status: SubscriptionStatusCanceled, IsEnterprise: true}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := tc.sub.HasPaidSubscription(); got != tc.want {
				t.Fatalf("HasPaidSubscription() = %v, want %v", got, tc.want)
			}
		})
	}
}
