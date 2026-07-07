import SwiftUI

/// Interactive weekly sending-schedule board, reimagined for mobile: each day
/// is its own full-width horizontal 24h track (not a cramped column). Tap + to
/// add a window, drag a bar sideways to move it, drag its left/right handle to
/// resize, tap × to remove, long-press a day to copy it everywhere or clear it.
/// Everything snaps to 30 minutes. Writes the authoritative `schedule_windows`.
struct CampaignSchedulePage: View {
    @Environment(AppEnvironment.self) private var env

    let store: CampaignDetailStore

    @State private var windows: [[ScheduleInterval]] = Array(repeating: [], count: 7)
    @State private var baseline: [[ScheduleInterval]] = Array(repeating: [], count: 7)
    @State private var timezone: String = TimeZone.current.identifier
    @State private var baselineTZ: String = TimeZone.current.identifier
    @State private var seeded = false
    @State private var isSaving = false
    @State private var saveError: String?

    private var campaign: Campaign { store.campaign }
    private var canManage: Bool { env.session.can(.manageCampaigns) }

    private var totalWindows: Int { windows.reduce(0) { $0 + $1.count } }
    private var activeDays: Int { windows.filter { !$0.isEmpty }.count }
    private var dirty: Bool { windows != baseline || timezone != baselineTZ }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                summaryBar
                presetsBar
                CampaignScheduleBoard(windows: $windows, editable: canManage)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 14)
                    .background(
                        RoundedRectangle(cornerRadius: 22, style: .continuous)
                            .fill(Color(.secondarySystemGroupedBackground))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 22, style: .continuous)
                            .strokeBorder(Color(.separator).opacity(0.22), lineWidth: 1)
                    )
                    .padding(.horizontal, 12)
                    .padding(.top, 4)
                footer
            }
        }
        .scrollBounceBehavior(.basedOnSize)
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Schedule")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if canManage, dirty {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await save() }
                    } label: {
                        if isSaving { ProgressView().controlSize(.small) }
                        else { Text("Save").fontWeight(.semibold) }
                    }
                    .disabled(isSaving || totalWindows == 0)
                }
            }
        }
        .onAppear(perform: seedOnce)
        .alert("Couldn't save schedule", isPresented: Binding(
            get: { saveError != nil }, set: { if !$0 { saveError = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: { Text(saveError ?? "") }
    }

    // MARK: Header

    private var summaryBar: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 1) {
                EyebrowLabel("Weekly sending windows")
                if totalWindows == 0 {
                    Text("No windows yet — tap + on a day.")
                        .font(.footnote)
                        .foregroundStyle(WTheme.negative)
                } else {
                    Text("\(totalWindows) window\(totalWindows == 1 ? "" : "s") across \(activeDays) day\(activeDays == 1 ? "" : "s")")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                }
            }
            Spacer(minLength: 8)
            Menu {
                Picker("Timezone", selection: $timezone) {
                    ForEach(commonTimezones, id: \.self) { tz in
                        Text(CampaignSchedulePage.cityName(tz)).tag(tz)
                    }
                }
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "globe")
                        .font(.system(size: 11, weight: .semibold))
                    Text(CampaignSchedulePage.cityName(timezone))
                        .font(.subheadline)
                        .lineLimit(1)
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.system(size: 10, weight: .semibold))
                }
                .foregroundStyle(WTheme.accent)
            }
            .disabled(!canManage)
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
        .padding(.bottom, 8)
    }

    /// The member's timezone folded in with a short common list so the picker is
    /// useful without a 400-row wall; the current value is always present.
    private var commonTimezones: [String] {
        var list = [
            "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York",
            "America/Sao_Paulo", "Europe/London", "Europe/Berlin", "Europe/Athens",
            "Africa/Johannesburg", "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore",
            "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland", TimeZone.current.identifier,
        ]
        if !list.contains(timezone) { list.append(timezone) }
        var seen = Set<String>()
        return list.filter { seen.insert($0).inserted }
    }

    private var presetsBar: some View {
        HStack(spacing: 8) {
            EyebrowLabel("Presets")
            presetChip("Weekdays 9–5") { weekdayWindows(start: 540, end: 1020) }
            presetChip("Every day 9–5") { Array(repeating: [ScheduleInterval(start: 540, end: 1020)], count: 7) }
            presetChip("Clear") { Array(repeating: [], count: 7) }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 6)
    }

    private func presetChip(_ title: String, build: @escaping () -> [[ScheduleInterval]]) -> some View {
        Button {
            withAnimation(.snappy) { windows = build() }
        } label: {
            Text(title)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 12)
                .frame(height: 30)
                .background(Color(.secondarySystemGroupedBackground), in: Capsule())
                .overlay(Capsule().strokeBorder(Color(.separator).opacity(0.4), lineWidth: 1))
        }
        .buttonStyle(TapScaleStyle())
        .disabled(!canManage)
    }

    private func weekdayWindows(start: Int, end: Int) -> [[ScheduleInterval]] {
        (0..<7).map { $0 < 5 ? [ScheduleInterval(start: start, end: end)] : [] }
    }

    private var footer: some View {
        Text("Each day is independent. Sends spread across its windows in \(CampaignSchedulePage.cityName(timezone)) time. Run dates are set on the web.")
            .font(.caption)
            .foregroundStyle(.tertiary)
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: State

    private func seedOnce() {
        guard !seeded else { return }
        seeded = true
        let seed = campaign.seedDisplayWindows()
        windows = seed
        baseline = seed
        if let tz = campaign.timezone, !tz.isEmpty {
            timezone = tz
            baselineTZ = tz
        }
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }
        let wire = Campaign.wireWindows(fromDisplay: windows)
        let tz = timezone
        let previous = store.campaign
        await store.update(
            env.api,
            body: CampaignUpdateBody(timezone: tz, scheduleWindows: wire)
        ) {
            $0.timezone = tz
            $0.scheduleWindows = wire.map { Optional($0) }
        }
        if store.actionError != nil {
            saveError = store.actionError
            store.actionError = nil
        } else if store.campaign.updatedAt != previous.updatedAt || store.campaign.timezone == tz {
            baseline = windows
            baselineTZ = tz
        }
    }

    static func cityName(_ identifier: String) -> String {
        (identifier.split(separator: "/").last.map(String.init) ?? identifier)
            .replacingOccurrences(of: "_", with: " ")
    }
}

// MARK: - The board

private let kDay = 1440
private let kSnap = 30
private let kMinDur = 30

struct CampaignScheduleBoard: View {
    @Binding var windows: [[ScheduleInterval]]
    let editable: Bool

    private static let dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    private static let dayShort = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    private static let hourMarks = [0, 6, 12, 18, 24]
    private static let labelW: CGFloat = 46
    private static let rowH: CGFloat = 54
    private static let barH: CGFloat = 38
    private static let minBar: CGFloat = 38

    private var todayIndex: Int { (Calendar.current.component(.weekday, from: Date()) + 5) % 7 }

    @State private var active: BlockDrag?

    var body: some View {
        VStack(spacing: 8) {
            axisHeader
            VStack(spacing: 8) {
                ForEach(0..<7, id: \.self) { day in
                    dayRow(day)
                }
            }
        }
    }

    // MARK: Axis header (time labels across the track)

    private var axisHeader: some View {
        HStack(spacing: 8) {
            Color.clear.frame(width: Self.labelW)
            GeometryReader { geo in
                let W = geo.size.width
                ZStack(alignment: .topLeading) {
                    ForEach(Self.hourMarks, id: \.self) { h in
                        Text(hourLabel(h))
                            .font(.system(size: 9))
                            .monospacedDigit()
                            .foregroundStyle(.tertiary)
                            .fixedSize()
                            .frame(width: 24, alignment: alignFor(h))
                            .offset(x: clampF(x(h * 60, W) - 12, 0, max(0, W - 24)))
                    }
                }
            }
            .frame(height: 12)
        }
    }

    private func alignFor(_ h: Int) -> Alignment {
        if h == 0 { return .leading }
        if h == 24 { return .trailing }
        return .center
    }

    // MARK: One day = one full-width track

    private func dayRow(_ day: Int) -> some View {
        let on = !windows[day].isEmpty
        let isToday = day == todayIndex
        return HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 4) {
                    Text(Self.dayShort[day])
                        .font(.system(size: 13, weight: on ? .semibold : .medium))
                        .foregroundStyle(on ? AnyShapeStyle(Color.primary) : AnyShapeStyle(Color.secondary))
                    if isToday {
                        Circle().fill(WTheme.accent).frame(width: 4, height: 4)
                    }
                }
                if editable {
                    Button { addWindow(day) } label: {
                        Image(systemName: "plus")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(WTheme.accent)
                            .frame(width: 26, height: 20)
                            .background(Tone.sky.background, in: RoundedRectangle(cornerRadius: 6, style: .continuous))
                    }
                    .buttonStyle(TapScaleStyle())
                }
            }
            .frame(width: Self.labelW, alignment: .leading)
            .contentShape(Rectangle())
            .contextMenu {
                if editable {
                    Button { copyToAll(day) } label: { Label("Copy \(Self.dayNames[day]) to all days", systemImage: "doc.on.doc") }
                    if on {
                        Button(role: .destructive) { clearDay(day) } label: { Label("Clear \(Self.dayNames[day])", systemImage: "xmark") }
                    }
                }
            }

            GeometryReader { geo in
                track(day: day, W: geo.size.width, isToday: isToday)
            }
            .frame(height: Self.rowH)
        }
        .frame(height: Self.rowH)
    }

    private func track(day: Int, W: CGFloat, isToday: Bool) -> some View {
        let on = !windows[day].isEmpty
        return ZStack(alignment: .leading) {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(isToday ? AnyShapeStyle(WTheme.accent.opacity(0.05)) : AnyShapeStyle(Color(.systemBackground).opacity(0.7)))
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .strokeBorder(Color(.separator).opacity(0.3), lineWidth: 1)
                )
            // hour gridlines
            ForEach(Self.hourMarks.dropFirst().dropLast(), id: \.self) { h in
                Rectangle()
                    .fill(Color(.separator).opacity(0.4))
                    .frame(width: 0.5)
                    .frame(maxHeight: .infinity)
                    .offset(x: x(h * 60, W))
            }
            if !on, editable {
                Text("Tap + to add a window")
                    .font(.system(size: 10))
                    .foregroundStyle(.tertiary)
                    .frame(maxWidth: .infinity)
            }
            ForEach(Array(windows[day].enumerated()), id: \.offset) { idx, iv in
                bar(day: day, idx: idx, iv: iv, W: W)
            }
        }
        .frame(height: Self.rowH)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    // MARK: A window bar

    private func bar(day: Int, idx: Int, iv: ScheduleInterval, W: CGFloat) -> some View {
        let left = x(iv.start, W)
        let raw = x(iv.end, W) - left
        let w = max(raw, Self.minBar)
        let wide = w >= 78
        return ZStack {
            RoundedRectangle(cornerRadius: 9, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [WTheme.accent.opacity(0.95), WTheme.accent.opacity(0.72)],
                        startPoint: .top, endPoint: .bottom
                    )
                )
                .shadow(color: WTheme.accent.opacity(0.3), radius: 3, y: 1)

            Text(wide ? "\(fmt(iv.start)) – \(fmt(iv.end))" : fmt(iv.start))
                .font(.system(size: 10.5, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .padding(.horizontal, 16)

            if editable {
                Button { removeWindow(day, idx) } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 8, weight: .bold))
                        .foregroundStyle(WTheme.accent)
                        .frame(width: 15, height: 15)
                        .background(.white.opacity(0.92), in: Circle())
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                .padding(3)
            }
        }
        .frame(width: w, height: Self.barH)
        .contentShape(Rectangle())
        .conditionalGesture(editable, moveGesture(day: day, idx: idx, W: W))
        .overlay(alignment: .leading) {
            if editable { edgeHandle(day: day, idx: idx, mode: .resizeStart, W: W) }
        }
        .overlay(alignment: .trailing) {
            if editable { edgeHandle(day: day, idx: idx, mode: .resizeEnd, W: W) }
        }
        .offset(x: left)
    }

    private func edgeHandle(day: Int, idx: Int, mode: BlockDrag.Mode, W: CGFloat) -> some View {
        Capsule()
            .fill(.white.opacity(0.9))
            .frame(width: 3, height: 16)
            .frame(width: 18, height: Self.barH)
            .contentShape(Rectangle())
            .highPriorityGesture(resizeGesture(day: day, idx: idx, mode: mode, W: W))
    }

    // MARK: Gestures (horizontal)

    // Global coordinate space so translation stays stable while the bar
    // re-lays-out under the finger (local space would feed back and jitter).
    private func moveGesture(day: Int, idx: Int, W: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 4, coordinateSpace: .global)
            .onChanged { g in applyDrag(day: day, idx: idx, mode: .move, delta: g.translation.width, span: W) }
            .onEnded { _ in endDrag(day: day) }
    }

    private func resizeGesture(day: Int, idx: Int, mode: BlockDrag.Mode, W: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 2, coordinateSpace: .global)
            .onChanged { g in applyDrag(day: day, idx: idx, mode: mode, delta: g.translation.width, span: W) }
            .onEnded { _ in endDrag(day: day) }
    }

    private func applyDrag(day: Int, idx: Int, mode: BlockDrag.Mode, delta: CGFloat, span W: CGFloat) {
        guard W > 0, idx < windows[day].count else { return }
        if active == nil {
            let iv = windows[day][idx]
            active = BlockDrag(day: day, idx: idx, mode: mode, origStart: iv.start, origEnd: iv.end)
        }
        guard let a = active, a.day == day, a.idx == idx else { return }
        let deltaMin = Int((delta / W) * CGFloat(kDay))
        var start = a.origStart
        var end = a.origEnd
        switch mode {
        case .move:
            let dur = a.origEnd - a.origStart
            start = clampInt(snap(a.origStart + deltaMin), 0, kDay - dur)
            end = start + dur
        case .resizeStart:
            start = clampInt(snap(a.origStart + deltaMin), 0, a.origEnd - kMinDur)
            end = a.origEnd
        case .resizeEnd:
            start = a.origStart
            end = clampInt(snap(a.origEnd + deltaMin), a.origStart + kMinDur, kDay)
        }
        windows[day][idx] = ScheduleInterval(start: start, end: end)
    }

    private func endDrag(day: Int) {
        active = nil
        withAnimation(.snappy) { windows[day] = merge(windows[day]) }
    }

    // MARK: Mutations

    private func addWindow(_ day: Int) {
        // Default 9–5, or stack a 2h block after the last one if the day is busy.
        let candidate: ScheduleInterval
        if let last = windows[day].map(\.end).max(), last <= kDay - 60 {
            candidate = ScheduleInterval(start: last, end: min(last + 120, kDay))
        } else {
            candidate = ScheduleInterval(start: 9 * 60, end: 17 * 60)
        }
        withAnimation(.snappy) { windows[day] = merge(windows[day] + [candidate]) }
    }

    private func removeWindow(_ day: Int, _ idx: Int) {
        guard idx < windows[day].count else { return }
        withAnimation(.snappy) { windows[day].remove(at: idx) }
    }

    private func clearDay(_ day: Int) {
        withAnimation(.snappy) { windows[day] = [] }
    }

    private func copyToAll(_ day: Int) {
        let src = windows[day]
        withAnimation(.snappy) { windows = Array(repeating: src, count: 7) }
    }

    // MARK: Geometry helpers

    private func x(_ minutes: Int, _ W: CGFloat) -> CGFloat {
        CGFloat(minutes) / CGFloat(kDay) * W
    }

    private func hourLabel(_ h: Int) -> String {
        let hh = h % 24
        let ampm = hh < 12 ? "a" : "p"
        let h12 = hh % 12 == 0 ? 12 : hh % 12
        return "\(h12)\(ampm)"
    }
}

private func clampF(_ n: CGFloat, _ lo: CGFloat, _ hi: CGFloat) -> CGFloat { max(lo, min(hi, n)) }

private struct BlockDrag {
    enum Mode { case move, resizeStart, resizeEnd }
    let day: Int
    let idx: Int
    let mode: Mode
    let origStart: Int
    let origEnd: Int
}

private extension View {
    @ViewBuilder
    func conditionalGesture<G: Gesture>(_ enabled: Bool, _ gesture: G) -> some View {
        if enabled { self.gesture(gesture) } else { self }
    }
}

// MARK: - Interval math

private func snap(_ n: Int) -> Int { Int((Double(n) / Double(kSnap)).rounded()) * kSnap }
private func clampInt(_ n: Int, _ lo: Int, _ hi: Int) -> Int { max(lo, min(hi, n)) }

private func fmt(_ min: Int) -> String {
    let h = min / 60
    let m = min % 60
    let ampm = h < 12 ? "a" : "p"
    let h12 = h % 12 == 0 ? 12 : h % 12
    return m == 0 ? "\(h12)\(ampm)" : "\(h12):\(String(format: "%02d", m))\(ampm)"
}

/// Sort and coalesce touching/overlapping windows within one day.
private func merge(_ ivs: [ScheduleInterval]) -> [ScheduleInterval] {
    let sorted = ivs.filter { $0.end > $0.start }.sorted { $0.start < $1.start }
    var out: [ScheduleInterval] = []
    for iv in sorted {
        if var last = out.last, iv.start <= last.end {
            last.end = max(last.end, iv.end)
            out[out.count - 1] = last
        } else {
            out.append(iv)
        }
    }
    return out
}
