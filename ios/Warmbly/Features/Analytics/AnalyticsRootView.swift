import SwiftUI
import Charts

// MARK: - Tabs

/// Swipeable analytics pages under the sky hero.
enum AnalyticsTab: String, CaseIterable, Identifiable {
    case overview, deliverability, warmup, accounts

    var id: String { rawValue }

    var title: String {
        switch self {
        case .overview: "Overview"
        case .deliverability: "Deliverability"
        case .warmup: "Warmup"
        case .accounts: "Accounts"
        }
    }

    var icon: String {
        switch self {
        case .overview: "chart.bar.fill"
        case .deliverability: "checkmark.shield.fill"
        case .warmup: "flame.fill"
        case .accounts: "envelope.fill"
        }
    }
}

// MARK: - Trend metric

/// Chart metric, driven by tapping the stat strip cells (bounces are not in
/// the daily trend payload, so the bounced cell is display-only).
enum AnalyticsTrendMetric: String, CaseIterable {
    case sent, opens, clicks, replies

    var title: String {
        switch self {
        case .sent: "Sent"
        case .opens: "Opens"
        case .clicks: "Clicks"
        case .replies: "Replies"
        }
    }

    var color: Color {
        switch self {
        case .sent: WTheme.accent
        case .opens: WTheme.positive
        case .clicks: Tone.indigo.color
        case .replies: Tone.emerald.color
        }
    }

    func value(_ point: AnalyticsTrendPoint) -> Int {
        switch self {
        case .sent: point.sent ?? 0
        case .opens: point.opens ?? 0
        case .clicks: point.clicks ?? 0
        case .replies: point.replies ?? 0
        }
    }
}

struct AnalyticsChartPoint: Identifiable {
    let id: Int
    let day: Date
    let value: Int
}

// MARK: - View

/// Org-wide analytics hub: sky hero with period picker + headline chips, and
/// swipeable Overview / Deliverability / Warmup / Accounts tabs. Pushed from
/// Home and from the More tab.
struct AnalyticsRootView: View {
    @Environment(AppEnvironment.self) private var env
    @State private var store = AnalyticsStore()
    @State private var tab: AnalyticsTab = .overview
    @State private var metric: AnalyticsTrendMetric = .sent

    var body: some View {
        Group {
            if !env.session.can(.viewAnalytics) {
                EmptyStateView(
                    title: "No access",
                    message: "You need the view analytics permission to see this page."
                )
                .navigationTitle("Analytics")
                .navigationBarTitleDisplayMode(.inline)
            } else {
                scaffold
            }
        }
        .task { await store.load(env.api) }
        .onChange(of: env.realtime.pulse(for: .analytics)) {
            Task { await store.load(env.api) }
        }
        .onChange(of: store.period) {
            Task { await store.load(env.api) }
        }
    }

    private var scaffold: some View {
        AirDetailScaffold(
            tabs: AnalyticsTab.allCases.map { AirTabItem(id: $0.rawValue, title: $0.title, icon: $0.icon) },
            selection: Binding(
                get: { tab.rawValue },
                set: { tab = AnalyticsTab(rawValue: $0) ?? .overview }
            )
        ) {
            hero
        } content: {
            TabView(selection: $tab) {
                overviewTab
                    .tag(AnalyticsTab.overview)
                deliverabilityTab
                    .tag(AnalyticsTab.deliverability)
                warmupTab
                    .tag(AnalyticsTab.warmup)
                accountsTab
                    .tag(AnalyticsTab.accounts)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .animation(.snappy, value: tab)
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .sensoryFeedback(.selection, trigger: store.period)
        .sensoryFeedback(.selection, trigger: metric)
    }

    // MARK: Hero

    private var hero: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                Text("Analytics")
                    .font(.title2.bold())
                    .foregroundStyle(.white)
                Spacer()
                periodPicker
            }
            heroStats
        }
        .padding(.horizontal, 20)
        .padding(.top, 2)
        .padding(.bottom, 18)
    }

    /// White-glass capsule row bound to the store period; every load reacts.
    private var periodPicker: some View {
        HStack(spacing: 7) {
            ForEach(AnalyticsPeriod.allCases) { period in
                let selected = store.period == period
                Button {
                    withAnimation(.snappy) { store.period = period }
                } label: {
                    Text(period.rawValue)
                        .font(.footnote.weight(selected ? .semibold : .medium))
                        .monospacedDigit()
                        .foregroundStyle(selected ? .white : .white.opacity(0.7))
                        .padding(.horizontal, 13)
                        .padding(.vertical, 6)
                        .background(.white.opacity(selected ? 0.22 : 0.10), in: Capsule())
                }
                .buttonStyle(TapScaleStyle())
            }
        }
    }

    private var heroStats: some View {
        let stats = store.dashboard?.overallStats
        return HStack(spacing: 10) {
            AirStatChip(
                value: stats.map { WFormat.compact($0.totalEmailsSent ?? 0) } ?? "–",
                label: "Sent",
                symbol: "paperplane.fill"
            )
            AirStatChip(
                value: stats?.openRate.map { String(format: "%.0f%%", $0) } ?? "–",
                label: "Open rate",
                symbol: "envelope.open.fill"
            )
            AirStatChip(
                value: stats.map { WFormat.compact($0.totalReplies ?? 0) } ?? "–",
                label: "Replies",
                symbol: "arrowshape.turn.up.left.fill"
            )
        }
    }

    // MARK: Overview tab

    @ViewBuilder
    private var overviewTab: some View {
        if store.dashboard != nil {
            List {
                Section {
                    statStrip
                    activeRow
                    chartSection
                }
                .listRowSeparator(.hidden)
                .listRowInsets(EdgeInsets())

                AnalyticsTopCampaignsSection(campaigns: store.dashboard?.topCampaigns ?? [])
                AnalyticsActivitySection(items: store.dashboard?.recentActivity ?? [])
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .refreshable { await store.load(env.api) }
        } else if let error = store.dashboardError {
            ErrorStateView(title: "Couldn't load analytics", message: error) {
                await store.load(env.api)
            }
        } else {
            SkeletonRows(rows: 10)
        }
    }

    // MARK: Deliverability tab

    private var deliverabilityTab: some View {
        List {
            AnalyticsDeliverabilitySection(summary: store.deliverability, error: store.deliverabilityError)
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .refreshable { await store.load(env.api) }
    }

    // MARK: Warmup tab

    private var warmupTab: some View {
        List {
            AnalyticsWarmupSection(warmup: store.warmup, error: store.warmupError, periodLabel: store.period.rawValue)
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .refreshable { await store.load(env.api) }
    }

    // MARK: Accounts tab

    private var accountsTab: some View {
        List {
            AnalyticsAccountsSection(
                accounts: store.accounts,
                counts: store.dashboard?.accountHealth,
                error: store.accountsError,
                isLoading: store.isLoading
            )
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .refreshable { await store.load(env.api) }
    }

    // MARK: Stat strip

    private var statStrip: some View {
        let stats = store.dashboard?.overallStats
        let sent = stats?.totalEmailsSent ?? 0
        let opens = stats?.totalOpens ?? 0
        let machine = stats?.machineOpens ?? 0
        let clicks = stats?.totalClicks ?? 0
        let replies = stats?.totalReplies ?? 0
        let bounces = stats?.totalBounces ?? 0
        let bounceRate = stats?.bounceRate ?? 0

        var openCaption = WFormat.percent(opens, of: sent)
        if machine > 0 { openCaption += " · \(WFormat.compact(machine)) auto" }

        return ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 0) {
                statButton(.sent, label: "Sent", value: WFormat.compact(sent), caption: "last \(store.period.rawValue)")
                stripDivider
                statButton(.opens, label: "Opened", value: WFormat.compact(opens), caption: openCaption)
                stripDivider
                statButton(.clicks, label: "Clicked", value: WFormat.compact(clicks), caption: WFormat.percent(clicks, of: sent))
                stripDivider
                statButton(.replies, label: "Replied", value: WFormat.compact(replies), caption: WFormat.percent(replies, of: sent))
                stripDivider
                AnalyticsStatCell(
                    label: "Bounced",
                    value: WFormat.compact(bounces),
                    caption: WFormat.percent(bounces, of: sent),
                    tone: bounceRate >= 5 ? .rose : (bounceRate >= 2 ? .amber : nil)
                )
            }
        }
    }

    private func statButton(_ target: AnalyticsTrendMetric, label: String, value: String, caption: String) -> some View {
        Button {
            withAnimation(.snappy) { metric = target }
        } label: {
            AnalyticsStatCell(label: label, value: value, caption: caption, selected: metric == target)
        }
        .buttonStyle(.plain)
    }

    private var stripDivider: some View {
        Divider().frame(height: 40)
    }

    private var activeRow: some View {
        let stats = store.dashboard?.overallStats
        return Text("\(stats?.activeCampaigns ?? 0) active campaigns · \(stats?.activeAccounts ?? 0) sending accounts")
            .font(.footnote.weight(.medium))
            .monospacedDigit()
            .foregroundStyle(.secondary)
            .padding(.horizontal, 16)
            .padding(.top, 10)
    }

    // MARK: Trend chart

    private var chartPoints: [AnalyticsChartPoint] {
        let trend = store.dashboard?.dailyTrend ?? []
        return trend.enumerated().compactMap { index, point in
            guard let day = AnalyticsDay.parse(point.date) else { return nil }
            return AnalyticsChartPoint(id: index, day: day, value: metric.value(point))
        }
    }

    /// Catmull-Rom line + gradient area, matching the Home trend card.
    private var chartSection: some View {
        let points = chartPoints
        return VStack(alignment: .leading, spacing: 10) {
            EyebrowLabel("\(metric.title) per day")
                .padding(.horizontal, 16)
            if points.count > 1 {
                Chart(points) { point in
                    AreaMark(
                        x: .value("Day", point.day),
                        y: .value(metric.title, point.value)
                    )
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(
                        LinearGradient(
                            colors: [metric.color.opacity(0.32), metric.color.opacity(0.02)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    LineMark(
                        x: .value("Day", point.day),
                        y: .value(metric.title, point.value)
                    )
                    .interpolationMethod(.catmullRom)
                    .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round))
                    .foregroundStyle(metric.color)
                }
                .chartXAxis {
                    AxisMarks(values: .automatic(desiredCount: 4)) { _ in
                        AxisGridLine().foregroundStyle(Color(.separator).opacity(0.4))
                        AxisValueLabel(format: .dateTime.month(.abbreviated).day())
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(Color.secondary)
                    }
                }
                .chartYAxis {
                    AxisMarks(position: .trailing, values: .automatic(desiredCount: 3)) { _ in
                        AxisGridLine().foregroundStyle(Color(.separator).opacity(0.4))
                        AxisValueLabel()
                            .font(.system(size: 10))
                            .foregroundStyle(Color.secondary)
                    }
                }
                .frame(height: 180)
                .padding(.horizontal, 16)
            } else {
                Text("Not enough activity to chart yet.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 120)
            }
        }
        .padding(.top, 14)
        .padding(.bottom, 14)
    }
}

// MARK: - Stat strip cell

/// StatCell plus a rate caption and a selected underline (acts as the chart
/// metric filter).
struct AnalyticsStatCell: View {
    let label: String
    let value: String
    let caption: String
    var tone: Tone? = nil
    var selected: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            EyebrowLabel(label)
            Text(value)
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(tone?.color ?? Color.primary)
                .contentTransition(.numericText())
            Text(caption)
                .font(.caption.weight(.medium))
                .monospacedDigit()
                .foregroundStyle(.secondary)
                .contentTransition(.numericText())
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .frame(minWidth: 96, alignment: .leading)
        .overlay(alignment: .bottom) {
            if selected {
                RoundedRectangle(cornerRadius: 1)
                    .fill(WTheme.accent)
                    .frame(height: 2)
                    .padding(.horizontal, 14)
            }
        }
        .contentShape(Rectangle())
    }
}

/// Compact labeled number used inside the section grids.
struct AnalyticsMiniStat: View {
    let label: String
    let value: String
    var tone: Tone? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            EyebrowLabel(label)
            Text(value)
                .font(.system(size: 18, weight: .semibold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(tone?.color ?? Color.primary)
                .contentTransition(.numericText())
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
