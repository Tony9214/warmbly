import SwiftUI
import Charts

// MARK: - Tone maps

enum AnalyticsToneMap {
    /// Deliverability band -> chip tone.
    static func band(_ raw: String?) -> Tone {
        switch raw {
        case "healthy": .emerald
        case "warning": .amber
        case "quarantine": .orange
        case "blocked": .rose
        default: .slate
        }
    }

    /// Account health status -> chip tone.
    static func health(_ raw: String?) -> Tone {
        switch raw {
        case "healthy": .emerald
        case "warning": .amber
        case "error": .rose
        default: .slate
        }
    }

    /// Warmup pool state -> chip tone.
    static func warmupState(_ raw: String?) -> Tone {
        switch raw {
        case "healthy": .emerald
        case "watch": .amber
        case "throttled": .amber
        case "quarantined": .orange
        case "blocked": .rose
        default: .slate
        }
    }
}

/// Redacted stat grid shown while a section's endpoint is still loading.
struct AnalyticsSectionLoading: View {
    var body: some View {
        LazyVGrid(
            columns: [GridItem(.flexible(), alignment: .leading), GridItem(.flexible(), alignment: .leading), GridItem(.flexible(), alignment: .leading)],
            alignment: .leading,
            spacing: 14
        ) {
            ForEach(0 ..< 3, id: \.self) { _ in
                AnalyticsMiniStat(label: "Loading", value: "0000")
            }
        }
        .redacted(reason: .placeholder)
        .padding(.vertical, 8)
    }
}

/// Inline section failure row; the rest of the screen keeps working.
struct AnalyticsSectionError: View {
    let text: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle")
                .font(.footnote)
                .foregroundStyle(WTheme.negative)
            Text(text)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 6)
    }
}

// MARK: - Deliverability

struct AnalyticsDeliverabilitySection: View {
    let summary: DeliverabilitySummary?
    let error: String?

    private let columns = [
        GridItem(.flexible(), alignment: .leading),
        GridItem(.flexible(), alignment: .leading),
        GridItem(.flexible(), alignment: .leading),
    ]

    var body: some View {
        Section {
            if let summary {
                LazyVGrid(columns: columns, alignment: .leading, spacing: 14) {
                    AnalyticsMiniStat(label: "Sent", value: AnalyticsFmt.count(summary.emailsSent))
                    AnalyticsMiniStat(
                        label: "Bounce rate",
                        value: AnalyticsFmt.rate(summary.bounceRate),
                        tone: (summary.bounceRate ?? 0) >= 5 ? .rose : ((summary.bounceRate ?? 0) >= 2 ? .amber : nil)
                    )
                    AnalyticsMiniStat(
                        label: "Complaints",
                        value: AnalyticsFmt.rate(summary.complaintRate),
                        tone: (summary.complaintRate ?? 0) >= 0.10 ? .rose : ((summary.complaintRate ?? 0) >= 0.03 ? .amber : nil)
                    )
                    AnalyticsMiniStat(
                        label: "Spam placement",
                        value: summary.spamPlacementRate.map { AnalyticsFmt.rate($0) } ?? "no samples",
                        tone: (summary.spamPlacementRate ?? 0) >= 20 ? .rose : ((summary.spamPlacementRate ?? 0) >= 10 ? .amber : nil)
                    )
                    AnalyticsMiniStat(label: "Suppressed", value: AnalyticsFmt.count(summary.suppressedRecipients))
                    AnalyticsMiniStat(label: "Unsubscribes", value: AnalyticsFmt.count(summary.unsubscribeCount))
                }
                .padding(.vertical, 8)
                .listRowSeparator(.hidden)
                if let pending = summary.dlqPending, pending > 0 {
                    HStack(spacing: 8) {
                        Image(systemName: "clock.badge.exclamationmark")
                            .font(.footnote)
                            .foregroundStyle(WTheme.warning)
                        Text("\(pending) deliverability events pending retry")
                            .font(.footnote)
                            .monospacedDigit()
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                    .listRowSeparator(.hidden)
                }
            } else if let error {
                AnalyticsSectionError(text: error)
                    .listRowSeparator(.hidden)
            } else {
                AnalyticsSectionLoading()
                    .listRowSeparator(.hidden)
            }
        } header: {
            HStack {
                EyebrowLabel("Deliverability")
                Spacer()
                if let band = summary?.band {
                    StatusPill(text: band, tone: AnalyticsToneMap.band(band))
                }
            }
        }
    }
}

// MARK: - Warmup

struct AnalyticsWarmupSection: View {
    let warmup: WarmupAnalytics?
    let error: String?
    let periodLabel: String

    private let columns = [
        GridItem(.flexible(), alignment: .leading),
        GridItem(.flexible(), alignment: .leading),
        GridItem(.flexible(), alignment: .leading),
    ]

    private var chartDays: [(id: Int, day: Date, sent: Int, target: Int)] {
        (warmup?.dailyStats ?? []).enumerated().compactMap { index, day in
            guard let date = AnalyticsDay.parse(day.date) else { return nil }
            return (id: index, day: date, sent: day.emailsSent ?? 0, target: day.targetVolume ?? 0)
        }
    }

    var body: some View {
        Section {
            if let summary = warmup?.summary {
                LazyVGrid(columns: columns, alignment: .leading, spacing: 14) {
                    AnalyticsMiniStat(label: "Warmup sent", value: AnalyticsFmt.count(summary.totalSent), tone: .orange)
                    AnalyticsMiniStat(label: "Replies", value: AnalyticsFmt.count(summary.totalReplied))
                    AnalyticsMiniStat(label: "Reply rate", value: AnalyticsFmt.rate(summary.replyRate))
                    AnalyticsMiniStat(label: "Avg / day", value: String(format: "%.1f", summary.averageDaily ?? 0))
                    AnalyticsMiniStat(label: "Days active", value: "\(summary.daysActive ?? 0)")
                    AnalyticsMiniStat(label: "To target", value: String(format: "%.0f%%", summary.targetProgress ?? 0))
                }
                .padding(.vertical, 8)
                .listRowSeparator(.hidden)

                if (summary.totalSent ?? 0) > 0, chartDays.count > 1 {
                    Chart(chartDays, id: \.id) { day in
                        BarMark(
                            x: .value("Day", day.day),
                            y: .value("Sent", day.sent)
                        )
                        .foregroundStyle(Tone.orange.color.opacity(0.75))
                        LineMark(
                            x: .value("Day", day.day),
                            y: .value("Target", day.target)
                        )
                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [3, 3]))
                        .foregroundStyle(WTheme.paused)
                    }
                    .chartXAxis {
                        AxisMarks(values: .automatic(desiredCount: 4)) { _ in
                            AxisGridLine()
                            AxisValueLabel(format: .dateTime.month(.abbreviated).day())
                        }
                    }
                    .chartYAxis {
                        AxisMarks(position: .trailing, values: .automatic(desiredCount: 3))
                    }
                    .frame(height: 120)
                    .padding(.vertical, 6)
                    .listRowSeparator(.hidden)
                } else if (summary.totalSent ?? 0) == 0 {
                    Text("No warmup activity in the last \(periodLabel).")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .padding(.vertical, 4)
                        .listRowSeparator(.hidden)
                }
            } else if let error {
                AnalyticsSectionError(text: error)
                    .listRowSeparator(.hidden)
            } else {
                AnalyticsSectionLoading()
                    .listRowSeparator(.hidden)
            }
        } header: {
            HStack(spacing: 5) {
                Image(systemName: "flame")
                    .font(.caption2)
                    .foregroundStyle(Tone.orange.color)
                EyebrowLabel("Warmup")
            }
        }
    }
}

// MARK: - Account health

struct AnalyticsAccountsSection: View {
    let accounts: [AccountHealthRow]
    let counts: AnalyticsAccountHealthCounts?
    let error: String?
    var isLoading: Bool = false

    var body: some View {
        Section {
            if let error, accounts.isEmpty {
                AnalyticsSectionError(text: error)
                    .listRowSeparator(.hidden)
            } else if accounts.isEmpty, isLoading {
                // First load in flight; don't flash the empty message.
                AnalyticsSectionLoading()
                    .listRowSeparator(.hidden)
            } else if accounts.isEmpty {
                Text("No mailboxes connected yet.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 6)
                    .listRowSeparator(.hidden)
            } else {
                ForEach(accounts) { account in
                    NavigationLink {
                        AnalyticsAccountDetailView(account: account)
                    } label: {
                        AnalyticsAccountRowView(account: account)
                    }
                }
            }
        } header: {
            HStack {
                EyebrowLabel("Account health")
                Spacer()
                if let counts {
                    HStack(spacing: 6) {
                        if let healthy = counts.healthyAccounts, healthy > 0 {
                            StatusPill(text: "\(healthy)", tone: .emerald)
                        }
                        if let warning = counts.warningAccounts, warning > 0 {
                            StatusPill(text: "\(warning)", tone: .amber)
                        }
                        if let bad = counts.errorAccounts, bad > 0 {
                            StatusPill(text: "\(bad)", tone: .rose)
                        }
                    }
                }
            }
        }
    }
}

struct AnalyticsAccountRowView: View {
    let account: AccountHealthRow

    private var usage: String {
        guard let usage = account.dailyUsage else { return "" }
        var parts: [String] = []
        if let limit = usage.campaignLimit, limit > 0 {
            parts.append("\(usage.campaignSent ?? 0) of \(limit) / day")
        }
        if let warmupLimit = usage.warmupLimit, warmupLimit > 0 {
            parts.append("warmup \(usage.warmupSent ?? 0) of \(warmupLimit)")
        }
        return parts.joined(separator: " · ")
    }

    var body: some View {
        HStack(spacing: 12) {
            IconTile(symbol: "envelope", tone: AnalyticsToneMap.health(account.health?.status), size: 38)
            VStack(alignment: .leading, spacing: 3) {
                Text(account.email ?? "mailbox")
                    .font(.body.weight(.medium))
                    .lineLimit(1)
                HStack(spacing: 4) {
                    if let provider = account.provider, !provider.isEmpty {
                        Text(provider)
                    }
                    if !usage.isEmpty {
                        if account.provider?.isEmpty == false { Text("·") }
                        Text(usage).monospacedDigit()
                    }
                }
                .font(.footnote)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            }
            Spacer()
            StatusPill(
                text: account.health?.status ?? "unknown",
                tone: AnalyticsToneMap.health(account.health?.status)
            )
            if let score = account.health?.score {
                HealthRing(score: score, tone: AnalyticsToneMap.health(account.health?.status), size: 34)
            }
        }
        .padding(.vertical, 6)
    }
}

// MARK: - Top campaigns

struct AnalyticsTopCampaignsSection: View {
    let campaigns: [AnalyticsTopCampaign]

    private func statusTone(_ raw: String?) -> Tone {
        switch raw {
        case "active": .emerald
        case "paused": .amber
        case "draft": .slate
        default: .slate
        }
    }

    var body: some View {
        if !campaigns.isEmpty {
            Section {
                ForEach(campaigns) { campaign in
                    HStack(spacing: 12) {
                        IconTile(symbol: "megaphone", tone: statusTone(campaign.status), size: 36)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(campaign.name ?? "Untitled campaign")
                                .font(.body.weight(.medium))
                                .lineLimit(1)
                            Text("\(WFormat.compact(campaign.emailsSent ?? 0)) sent · \(AnalyticsFmt.rate(campaign.openRate)) open · \(AnalyticsFmt.rate(campaign.replyRate)) reply")
                                .font(.footnote)
                                .monospacedDigit()
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                        Spacer()
                        StatusPill(
                            text: campaign.status ?? "unknown",
                            tone: statusTone(campaign.status),
                            pulsing: campaign.status == "active"
                        )
                    }
                    .padding(.vertical, 6)
                }
            } header: {
                EyebrowLabel("Top campaigns")
            }
        }
    }
}

// MARK: - Recent activity

struct AnalyticsActivitySection: View {
    let items: [AnalyticsActivityItem]

    private func icon(_ type: String?) -> String {
        switch type {
        case "sent": "paperplane"
        case "opened": "envelope.open"
        case "clicked": "link"
        case "replied": "arrowshape.turn.up.left"
        case "bounced": "exclamationmark.triangle"
        default: "bolt"
        }
    }

    private func tone(_ type: String?) -> Tone {
        switch type {
        case "sent": .slate
        case "opened": .sky
        case "clicked": .indigo
        case "replied": .emerald
        case "bounced": .rose
        default: .slate
        }
    }

    var body: some View {
        if !items.isEmpty {
            Section {
                ForEach(Array(items.prefix(12).enumerated()), id: \.offset) { _, item in
                    HStack(spacing: 12) {
                        IconTile(symbol: icon(item.type), tone: tone(item.type), size: 34)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(item.contactEmail ?? "unknown recipient")
                                .font(.body.weight(.medium))
                                .lineLimit(1)
                            Text("\(item.type ?? "event") · \(item.campaignName ?? "campaign")")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                        Spacer()
                        if let timestamp = item.timestamp {
                            Text(WFormat.relative(timestamp))
                                .font(.footnote)
                                .monospacedDigit()
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                }
            } header: {
                EyebrowLabel("Recent activity")
            }
        }
    }
}
