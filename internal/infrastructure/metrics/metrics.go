package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// Email sending metrics
	EmailsSentTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "warmbly",
		Name:      "emails_sent_total",
		Help:      "Total number of emails sent",
	}, []string{"type"}) // type: campaign, warmup, user_email

	EmailSendErrors = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "warmbly",
		Name:      "email_send_errors_total",
		Help:      "Total number of email send errors",
	}, []string{"type", "reason"})

	EmailSendDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "warmbly",
		Name:      "email_send_duration_seconds",
		Help:      "Duration of email send operations",
		Buckets:   []float64{0.1, 0.5, 1, 2, 5, 10, 30, 60},
	}, []string{"type"})

	// Task metrics
	TasksProcessed = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "warmbly",
		Name:      "tasks_processed_total",
		Help:      "Total number of tasks processed",
	}, []string{"type", "status"}) // status: completed, failed, skipped, dead_lettered

	TaskQueueDepth = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: "warmbly",
		Name:      "task_queue_depth",
		Help:      "Current number of pending tasks",
	}, []string{"type"})

	// DLQ metrics
	DLQSize = promauto.NewGauge(prometheus.GaugeOpts{
		Namespace: "warmbly",
		Name:      "dlq_pending_count",
		Help:      "Number of pending dead-lettered tasks",
	})

	DLQRetriesTotal = promauto.NewCounter(prometheus.CounterOpts{
		Namespace: "warmbly",
		Name:      "dlq_retries_total",
		Help:      "Total number of DLQ retry attempts",
	})

	// Warmup pool metrics
	WarmupPoolSize = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: "warmbly",
		Name:      "warmup_pool_participants",
		Help:      "Number of participants in warmup pools",
	}, []string{"pool", "state"}) // pool: free, premium; state: healthy, watch, throttled, quarantined, blocked

	WarmupHealthEvaluations = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "warmbly",
		Name:      "warmup_health_evaluations_total",
		Help:      "Total warmup health evaluations performed",
	}, []string{"result"}) // result: healthy, watch, throttled, quarantined, blocked

	// Campaign metrics
	CampaignsSentToday = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: "warmbly",
		Name:      "campaigns_emails_sent_today",
		Help:      "Emails sent today per campaign",
	}, []string{"campaign_id"})

	// API metrics
	APIRequestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "warmbly",
		Name:      "api_request_duration_seconds",
		Help:      "Duration of API requests",
		Buckets:   prometheus.DefBuckets,
	}, []string{"method", "path", "status"})

	APIRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "warmbly",
		Name:      "api_requests_total",
		Help:      "Total number of API requests",
	}, []string{"method", "path", "status"})

	// Deliverability metrics
	DeliverabilityEvents = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "warmbly",
		Name:      "deliverability_events_total",
		Help:      "Total deliverability events received",
	}, []string{"event_type"}) // bounce, complaint, unsubscribe, open, click, reply

	// Consumer metrics
	KafkaMessagesProcessed = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "warmbly",
		Name:      "kafka_messages_processed_total",
		Help:      "Total Kafka messages processed",
	}, []string{"topic", "status"})

	// Organization budget metrics
	OrgDailyBudgetUsage = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: "warmbly",
		Name:      "org_daily_budget_usage_ratio",
		Help:      "Ratio of daily email budget used (0-1)",
	}, []string{"org_id"})
)
