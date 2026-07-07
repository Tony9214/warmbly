import SwiftUI

/// Sending-schedule editor. Mobile edits the common case — pick days, one
/// daily window, timezone — and writes it as `schedule_windows` (the
/// authoritative shape the web editor also writes). Schedules with multiple
/// or per-day-differing windows can't round-trip through this UI, so they
/// render read-only with a web handoff instead of being silently flattened.
struct CampaignSchedulePage: View {
    @Environment(AppEnvironment.self) private var env

    let store: CampaignDetailStore

    @State private var days: Set<Int> = Set(0...4)
    @State private var start = CampaignSchedulePage.date(minutes: 9 * 60)
    @State private var end = CampaignSchedulePage.date(minutes: 17 * 60)
    @State private var timezone: String = TimeZone.current.identifier
    @State private var seeded = false
    @State private var isSaving = false

    private var campaign: Campaign { store.campaign }
    private var canManage: Bool { env.session.can(.manageCampaigns) }
    private var editable: Bool { !campaign.hasCustomWindows }

    var body: some View {
        List {
            if editable {
                daysSection
                windowSection
                timezoneSection
            } else {
                customWindowsSection
            }
            datesSection
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Schedule")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if editable, canManage, dirty {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await save() }
                    } label: {
                        if isSaving {
                            ProgressView().controlSize(.small)
                        } else {
                            Text("Save").fontWeight(.semibold)
                        }
                    }
                    .disabled(!valid || isSaving)
                }
            }
        }
        .onAppear { seedOnce() }
    }

    // MARK: Seeding + state

    private static func date(minutes: Int) -> Date {
        Calendar.current.date(bySettingHour: minutes / 60, minute: minutes % 60, second: 0, of: Date()) ?? Date()
    }

    private static func minutes(of date: Date) -> Int {
        let parts = Calendar.current.dateComponents([.hour, .minute], from: date)
        return (parts.hour ?? 0) * 60 + (parts.minute ?? 0)
    }

    private func seedOnce() {
        guard !seeded else { return }
        seeded = true
        if let simple = campaign.simpleSchedule {
            days = simple.days
            start = Self.date(minutes: simple.startMinutes)
            end = Self.date(minutes: simple.endMinutes)
        }
        if let tz = campaign.timezone, !tz.isEmpty {
            timezone = tz
        }
    }

    private var edited: CampaignSimpleSchedule {
        CampaignSimpleSchedule(
            days: days,
            startMinutes: Self.minutes(of: start),
            endMinutes: Self.minutes(of: end)
        )
    }

    private var dirty: Bool {
        edited != campaign.simpleSchedule || timezone != (campaign.timezone ?? timezone)
    }

    private var valid: Bool {
        !days.isEmpty && edited.endMinutes > edited.startMinutes
    }

    // MARK: Days

    private var daysSection: some View {
        Section {
            HStack(spacing: 8) {
                ForEach(0..<7, id: \.self) { day in
                    dayChip(day)
                }
            }
            .padding(.vertical, 6)
        } header: {
            Text("Sending days")
        } footer: {
            if days.isEmpty {
                Text("Pick at least one day.")
                    .foregroundStyle(WTheme.negative)
            } else {
                Text(edited.daysLabel)
            }
        }
    }

    private func dayChip(_ day: Int) -> some View {
        let selected = days.contains(day)
        return Button {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                if selected { days.remove(day) } else { days.insert(day) }
            }
        } label: {
            Text(CampaignSimpleSchedule.dayLetters[day])
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(selected ? .white : Color.primary)
                .frame(maxWidth: .infinity)
                .frame(height: 38)
                .background(
                    selected ? AnyShapeStyle(WTheme.accent) : AnyShapeStyle(Color(.tertiarySystemFill)),
                    in: Circle()
                )
        }
        .buttonStyle(TapScaleStyle())
        .disabled(!canManage)
        .accessibilityLabel(CampaignSimpleSchedule.dayNames[day])
    }

    // MARK: Window

    private var windowSection: some View {
        Section {
            DatePicker("Starts", selection: $start, displayedComponents: .hourAndMinute)
                .disabled(!canManage)
            DatePicker("Ends", selection: $end, displayedComponents: .hourAndMinute)
                .disabled(!canManage)
        } header: {
            Text("Daily window")
        } footer: {
            if !days.isEmpty, edited.endMinutes <= edited.startMinutes {
                Text("The window must end after it starts.")
                    .foregroundStyle(WTheme.negative)
            } else {
                Text("Emails spread out across this window with natural gaps.")
            }
        }
    }

    // MARK: Timezone

    private var timezoneSection: some View {
        Section {
            NavigationLink {
                TimezonePicker(selection: $timezone)
            } label: {
                HStack {
                    Text("Timezone")
                    Spacer()
                    Text(Self.cityName(timezone))
                        .foregroundStyle(.secondary)
                }
            }
            .disabled(!canManage)
        }
    }

    static func cityName(_ identifier: String) -> String {
        (identifier.split(separator: "/").last.map(String.init) ?? identifier)
            .replacingOccurrences(of: "_", with: " ")
    }

    // MARK: Custom windows (read-only)

    private var customWindowsSection: some View {
        Section {
            // Wire order is Sun-first; render Monday-first like the web grid.
            ForEach(0..<7, id: \.self) { day in
                let intervals = campaign.windows[(day + 1) % 7]
                HStack(alignment: .firstTextBaseline) {
                    Text(CampaignSimpleSchedule.dayNames[day])
                    Spacer()
                    Text(
                        intervals.isEmpty
                            ? "Off"
                            : intervals
                                .map {
                                    "\(CampaignSimpleSchedule.minutesLabel($0.start))–\(CampaignSimpleSchedule.minutesLabel($0.end))"
                                }
                                .joined(separator: ", ")
                    )
                    .font(.subheadline)
                    .monospacedDigit()
                    .foregroundStyle(intervals.isEmpty ? .tertiary : .secondary)
                }
            }
            WebHandoffBanner(text: "This campaign uses a custom per-day schedule. Fine-tune the windows in Warmbly on the web.")
                .listRowInsets(EdgeInsets(top: 10, leading: 6, bottom: 6, trailing: 6))
                .listRowBackground(Color.clear)
        } header: {
            Text("Sending days")
        } footer: {
            if let tz = campaign.timezone, !tz.isEmpty {
                Text("Times are in \(Self.cityName(tz)) time.")
            }
        }
    }

    // MARK: Run dates (read-only context)

    @ViewBuilder
    private var datesSection: some View {
        if campaign.startDate != nil || campaign.endDate != nil {
            Section {
                if let startDate = campaign.startDate {
                    HStack {
                        Text("Starts")
                        Spacer()
                        Text(startDate.formatted(date: .abbreviated, time: .omitted))
                            .foregroundStyle(.secondary)
                    }
                }
                if let endDate = campaign.endDate {
                    HStack {
                        Text("Ends")
                        Spacer()
                        Text(endDate.formatted(date: .abbreviated, time: .omitted))
                            .foregroundStyle(.secondary)
                    }
                }
            } header: {
                Text("Run dates")
            } footer: {
                Text("Set or clear run dates in Warmbly on the web.")
            }
        }
    }

    // MARK: Save

    private func save() async {
        isSaving = true
        let schedule = edited
        let tz = timezone
        await store.update(
            env.api,
            body: CampaignUpdateBody(timezone: tz, scheduleWindows: schedule.wireWindows)
        ) {
            $0.timezone = tz
            $0.scheduleWindows = schedule.wireWindows.map { Optional($0) }
        }
        isSaving = false
    }
}

/// Searchable timezone list; identifiers grouped as the system knows them.
private struct TimezonePicker: View {
    @Binding var selection: String
    @Environment(\.dismiss) private var dismiss

    @State private var search = ""

    private var identifiers: [String] {
        let all = TimeZone.knownTimeZoneIdentifiers
        guard !search.isEmpty else { return all }
        let needle = search.lowercased().replacingOccurrences(of: " ", with: "_")
        return all.filter { $0.lowercased().contains(needle) }
    }

    private func offsetLabel(_ identifier: String) -> String {
        guard let zone = TimeZone(identifier: identifier) else { return "" }
        let seconds = zone.secondsFromGMT()
        let hours = seconds / 3600
        let minutes = abs(seconds % 3600) / 60
        return String(format: "GMT%+d%@", hours, minutes == 0 ? "" : String(format: ":%02d", minutes))
    }

    var body: some View {
        List(identifiers, id: \.self) { identifier in
            Button {
                selection = identifier
                dismiss()
            } label: {
                HStack {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(CampaignSchedulePage.cityName(identifier))
                            .foregroundStyle(Color.primary)
                        Text(identifier)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Text(offsetLabel(identifier))
                        .font(.footnote)
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                    if identifier == selection {
                        Image(systemName: "checkmark")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(WTheme.accent)
                    }
                }
            }
        }
        .listStyle(.plain)
        .searchable(text: $search, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search timezones")
        .navigationTitle("Timezone")
        .navigationBarTitleDisplayMode(.inline)
    }
}
