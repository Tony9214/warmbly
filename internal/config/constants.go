package config

const (
	DefaultColor = "#c4c8cf"
	Domain       = "warmbly.com"
	LimitMin     = 10
	LimitMax     = 200

	CampaignLimitDefault  = 50
	MinWaitTimeDefault    = 600
	WarmupBaseDefault     = 10
	WarmupMaxDefault      = 40
	WarmupIncreaseDefault = 1

	MaxContactSize   = 10240
	MaxEmailBodySize = 200 * 1024 // 200 KB
	MaxEmailFolders  = 30

	// Sequences
	SequenceDefaultName  = "New Sequence"
	SequenceSubjectLimit = 100
	SequenceBodyLimit    = 30_000

	// Unibox
	UniboxLimitMin     = 1
	UniboxLimitMax     = 100
	UniboxLimitDefault = 50

	// WarmupVerifyHeader is the custom header carrying the warmup
	// verification token on outbound warmup mail. The name is intentionally
	// generic (not "X-Warmbly-*") so anti-spam vendors cannot trivially
	// cluster on the header name to fingerprint warmup traffic.
	WarmupVerifyHeader = "X-Mailtrace-Verify"

	// Product-level hard caps. These are the backstop for plans that
	// advertise "unlimited" — marketing can keep saying unlimited, but
	// the runtime never grants truly unbounded usage. Each cap is the
	// floor that GetEffectiveLimits falls back to when both the
	// per-org override and the plan column are unset.
	//
	// Admins can grant strictly larger caps per-org through the
	// override flow when there is a legitimate business reason. Growth
	// above these defaults goes through the limit-increase request
	// workflow so the decision is audited and the org has a paper trail
	// acknowledging the new ceiling.
	//
	// These numbers are deliberately generous enough that ordinary use
	// never trips them, and conservative enough that "I want to spin up
	// 5,000 mailboxes overnight" can't happen without explicit approval.
	HardCapMailboxes          = 200       // total connected mailboxes per org
	HardCapCampaignsTotal     = 500       // total campaigns ever created
	HardCapCampaignsActive    = 100       // simultaneously active campaigns
	HardCapTeamMembers        = 100       // seats per org
	HardCapContacts           = 1_000_000 // contacts per org
	HardCapDailyCampaignSends = 1000      // campaign emails per org per day

	// Daily creation throttles. The total caps above stop "you have
	// 5000 campaigns on this org" — the throttles below stop "you
	// created 1000 campaigns today on a fresh unlimited account."
	// Different shape: a per-(org, resource, day) Redis counter that
	// resets at UTC midnight, decoupled from any plan tier.
	//
	// These are creation-rate ceilings, not total caps; raising them
	// per-org is intentionally not exposed in the override editor
	// because the per-day shape protects abuse posture rather than
	// product utility.
	DailyThrottleNewCampaigns = 20 // new campaigns per org per day
	DailyThrottleNewMailboxes = 5  // newly connected mailboxes per org per day
	DailyThrottleNewOrgs      = 3  // new workspaces per owner per day
)
