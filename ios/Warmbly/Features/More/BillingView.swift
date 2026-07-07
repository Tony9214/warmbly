import SwiftUI

/// Read-only billing surface: current plan, trial state, and workspace usage
/// against plan limits. Changing plans stays on the web dashboard.
struct BillingView: View {
    @Environment(AppEnvironment.self) private var env

    @State private var subscription: SubscriptionInfo?
    @State private var trial: TrialInfo?
    @State private var loaded = false
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if !loaded, subscription == nil, errorMessage == nil {
                loadingPlaceholder
            } else if let errorMessage, subscription == nil {
                ErrorStateView(title: "Couldn't load billing", message: errorMessage) {
                    await load()
                }
            } else {
                content
            }
        }
        .navigationTitle("Billing")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if !loaded { await load() }
        }
        .refreshable { await load() }
        .onChange(of: env.realtime.pulse(for: .billing)) { _, _ in
            Task { await load() }
        }
    }

    // MARK: - Content

    private var content: some View {
        List {
            planSection
            if let trial, isTrialing {
                trialSection(trial)
            }
            usageSection
            manageSection
        }
        .listStyle(.insetGrouped)
    }

    private var planSection: some View {
        Section {
            HStack(spacing: 12) {
                IconTile(symbol: "creditcard.fill", tone: .indigo, size: 34)
                VStack(alignment: .leading, spacing: 2) {
                    Text(planName)
                        .font(.body.weight(.semibold))
                    if let period = renewalText {
                        Text(period)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
                MorePlanPill(subscription: subscription)
            }
            .padding(.vertical, 4)

            if let price = subscription?.plan?.price, price > 0 {
                LabeledContent {
                    Text(priceText(price))
                        .font(.subheadline.weight(.medium))
                        .monospacedDigit()
                } label: {
                    Text("Price")
                }
            }
            if subscription?.cancelAtPeriodEnd == true {
                Label("Cancels at the end of the current period", systemImage: "exclamationmark.circle")
                    .font(.footnote)
                    .foregroundStyle(WTheme.warning)
            }
        } header: {
            EyebrowLabel("Plan")
        }
    }

    private func trialSection(_ trial: TrialInfo) -> some View {
        Section {
            HStack {
                Label("Free trial", systemImage: "clock.badge.fill")
                    .font(.body.weight(.medium))
                Spacer()
                if trial.isExpired == true {
                    StatusPill(text: "Expired", tone: .rose)
                } else if let days = trial.daysRemaining {
                    StatusPill(text: days == 1 ? "1 day left" : "\(days) days left", tone: days <= 3 ? .amber : .emerald)
                }
            }
            .padding(.vertical, 2)
            if let ends = trial.trialEndsAt {
                LabeledContent("Ends") {
                    Text(ends, format: .dateTime.month().day().year())
                        .font(.subheadline)
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                }
            }
        } header: {
            EyebrowLabel("Trial")
        }
    }

    private var usageSection: some View {
        Section {
            let counts = env.session.currentOrg?.counts
            let limits = env.session.currentOrg?.limits
            MoreUsageBar(label: "Email accounts", used: counts?.emailAccounts, limit: limits?.maxEmailAccounts)
            MoreUsageBar(label: "Active campaigns", used: counts?.activeCampaigns, limit: limits?.maxActiveCampaigns)
            MoreUsageBar(label: "Contacts", used: counts?.totalContacts, limit: limits?.maxContacts)
            MoreUsageBar(label: "Team members", used: counts?.totalMembers, limit: limits?.maxTeamMembers)
        } header: {
            EyebrowLabel("Usage this workspace")
        } footer: {
            Text("Usage reflects the current workspace against your plan limits.")
        }
    }

    private var manageSection: some View {
        Section {
            Link(destination: URL(string: "https://app.warmbly.com/app/settings/billing")!) {
                HStack(spacing: 12) {
                    IconTile(symbol: "safari.fill", tone: .sky, size: 34)
                    Text("Manage billing on the web")
                        .font(.body.weight(.medium))
                        .foregroundStyle(.primary)
                    Spacer()
                    Image(systemName: "arrow.up.forward.square")
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(.tertiary)
                }
                .padding(.vertical, 2)
            }
        } footer: {
            Text("Change plan, update payment method, and download invoices from the web dashboard.")
        }
    }

    private var loadingPlaceholder: some View {
        VStack(spacing: 16) {
            SkeletonRows(rows: 5)
        }
        .padding(.top, 8)
    }

    // MARK: - Derived

    private var planName: String {
        let raw = subscription?.plan?.name ?? "Free"
        return raw.isEmpty ? "Free" : raw.capitalized
    }

    private var isTrialing: Bool {
        subscription?.status == "trialing" || trial?.isInTrial == true
    }

    private var renewalText: String? {
        guard let end = subscription?.currentPeriodEnd else { return nil }
        let formatted = end.formatted(.dateTime.month().day().year())
        return subscription?.cancelAtPeriodEnd == true ? "Access until \(formatted)" : "Renews \(formatted)"
    }

    private func priceText(_ price: Double) -> String {
        let unit = subscription?.plan?.duration.map { "/\($0)" } ?? ""
        return String(format: "$%.0f%@", price, unit)
    }

    // MARK: - Load

    private func load() async {
        errorMessage = nil
        do {
            async let sub: SubscriptionInfo = env.api.get("subscription")
            async let tr: TrialInfo = env.api.get("subscription/trial")
            subscription = try await sub
            trial = try? await tr
            await env.session.refreshCurrentOrg()
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        loaded = true
    }
}
