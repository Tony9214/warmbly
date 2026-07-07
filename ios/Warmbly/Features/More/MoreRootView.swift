import SwiftUI

/// Lightweight state for the hub itself: the plan pill and the unread badge.
@MainActor
@Observable
final class MoreHubStore {
    var subscription: SubscriptionInfo?
    var unreadNotifications = 0
    private var isLoading = false

    func load(_ api: APIClient) async {
        guard !isLoading else { return }
        isLoading = true
        subscription = try? await api.get("subscription")
        if let feed: MoreNotificationFeed = try? await api.get(
            "auth/me/notifications",
            query: ["limit": "10", "unread": "1"]
        ) {
            unreadNotifications = feed.unread ?? 0
        }
        isLoading = false
    }
}

/// The More tab hub. Owns the tab's NavigationStack; every screen in this
/// module is pushed from here.
struct MoreRootView: View {
    @Environment(AppEnvironment.self) private var env
    @State private var store = MoreHubStore()
    @State private var showSwitcher = false
    @State private var confirmLogout = false

    var body: some View {
        NavigationStack {
            List {
                workspaceSection
                if env.session.can(.manageEmails) { sendingSection }
                if env.session.can(.viewAnalytics) { insightsSection }
                if env.session.can(.viewContacts) { crmSection }
                if env.session.can(.viewCampaigns) { resourcesSection }
                teamSection
                accountSection
                systemSection
            }
            .listStyle(.insetGrouped)
            .navigationTitle("More")
            .task { await store.load(env.api) }
            .onChange(of: env.realtime.pulse(for: .billing)) {
                Task { await store.load(env.api) }
            }
            .onChange(of: env.realtime.pulse(for: .notifications)) {
                Task { await store.load(env.api) }
            }
            .onChange(of: env.realtime.pulse(for: .team)) {
                Task { await env.session.refreshCurrentOrg() }
            }
            .onChange(of: env.session.currentOrgID) {
                Task { await store.load(env.api) }
            }
            .refreshable {
                await store.load(env.api)
                await env.session.refreshCurrentOrg()
            }
            .sheet(isPresented: $showSwitcher) {
                MoreWorkspaceSwitcherSheet()
            }
            .confirmationDialog("Log out of Warmbly?", isPresented: $confirmLogout, titleVisibility: .visible) {
                Button("Log out", role: .destructive) {
                    Task { await env.session.logout() }
                }
                Button("Cancel", role: .cancel) {}
            }
        }
    }

    // MARK: Workspace

    private var connectionLabel: String {
        switch env.realtime.connectionState {
        case .connected: return "Live"
        case .connecting: return "Connecting"
        case .disconnected: return "Offline"
        }
    }

    private var connectionTone: Tone {
        switch env.realtime.connectionState {
        case .connected: return .emerald
        case .connecting: return .amber
        case .disconnected: return .rose
        }
    }

    private var workspaceSection: some View {
        Section {
            Button {
                showSwitcher = true
            } label: {
                HStack(spacing: 12) {
                    if let org = env.session.currentOrg {
                        WAvatar(name: org.name, imageURL: org.avatarURL, seed: org.id, size: 46)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(org.name)
                                .font(.headline)
                                .foregroundStyle(.primary)
                                .lineLimit(1)
                            HStack(spacing: 6) {
                                MorePlanPill(subscription: store.subscription)
                                if let role = env.session.role {
                                    Text(role.capitalized)
                                        .font(.footnote)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    } else {
                        Text("Select workspace")
                            .font(.body.weight(.medium))
                    }
                    Spacer()
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.tertiary)
                }
                .padding(.vertical, 2)
            }
            .buttonStyle(.plain)

            HStack(spacing: 10) {
                StatusPill(
                    text: connectionLabel,
                    tone: connectionTone,
                    pulsing: env.realtime.connectionState == .connected
                )
                Spacer()
                PresenceAvatars()
                Text("\(env.realtime.presence.onlineCount) online")
                    .font(.footnote.weight(.medium))
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
                    .contentTransition(.numericText())
                    .animation(.default, value: env.realtime.presence.onlineCount)
            }
        }
    }

    // MARK: Sections

    private var sendingSection: some View {
        Section("Sending") {
            NavigationLink {
                MailboxesRootView()
            } label: {
                MoreHubRow(icon: "envelope.fill", title: "Mailboxes", subtitle: "Sender accounts and warmup", tone: .orange)
            }
        }
    }

    private var insightsSection: some View {
        Section("Insights") {
            NavigationLink {
                AnalyticsRootView()
            } label: {
                MoreHubRow(icon: "chart.bar.fill", title: "Analytics", subtitle: "Sends, opens, replies", tone: .sky)
            }
            NavigationLink {
                AuditLogView()
            } label: {
                MoreHubRow(icon: "clock.arrow.circlepath", title: "Activity", subtitle: "Audit log, last 90 days", tone: .indigo)
            }
        }
    }

    private var crmSection: some View {
        Section("CRM") {
            NavigationLink {
                CRMDealsView()
            } label: {
                MoreHubRow(icon: "briefcase.fill", title: "Deals", tone: .sky)
            }
            NavigationLink {
                CRMTasksView()
            } label: {
                MoreHubRow(icon: "checklist", title: "Tasks", tone: .emerald)
            }
            NavigationLink {
                CRMMeetingsView()
            } label: {
                MoreHubRow(icon: "calendar", title: "Meetings", tone: .orange)
            }
        }
    }

    private var resourcesSection: some View {
        Section("Resources") {
            NavigationLink {
                TemplatesListView()
            } label: {
                MoreHubRow(icon: "doc.on.doc.fill", title: "Templates", tone: .indigo)
            }
        }
    }

    private var teamSection: some View {
        Section("Team") {
            NavigationLink {
                TeamMembersView()
            } label: {
                MoreHubRow(
                    icon: "person.2.fill",
                    title: "Members",
                    subtitle: memberCountSubtitle,
                    tone: .sky
                )
            }
        }
    }

    private var memberCountSubtitle: String? {
        guard let count = env.session.currentOrg?.counts?.totalMembers else { return nil }
        return count == 1 ? "1 member" : "\(count) members"
    }

    private var accountSection: some View {
        Section("Account") {
            NavigationLink {
                ProfileSettingsView()
            } label: {
                MoreHubRow(icon: "person.crop.circle", title: "Profile", subtitle: env.session.user?.email, tone: .slate)
            }
            NavigationLink {
                NotificationsView()
            } label: {
                MoreHubRow(icon: "bell", title: "Notifications", tone: .amber)
            }
            .badge(store.unreadNotifications)
            NavigationLink {
                SecurityInfoView()
            } label: {
                MoreHubRow(icon: "lock.shield", title: "Security", subtitle: "2FA, passkeys, sessions", tone: .emerald)
            }
            if env.session.can(.manageBilling) {
                NavigationLink {
                    BillingView()
                } label: {
                    MoreHubRow(icon: "creditcard", title: "Billing", subtitle: "Plan and usage", tone: .indigo)
                }
            }
        }
    }

    private var systemSection: some View {
        Section {
            HStack(spacing: 12) {
                Image(systemName: "server.rack")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Tone.slate.color)
                    .frame(width: 28, height: 28)
                    .background(Tone.slate.background, in: RoundedRectangle(cornerRadius: 7))
                VStack(alignment: .leading, spacing: 1) {
                    Text("Server")
                        .font(.body.weight(.medium))
                    Text(AppConfig.serverOrigin)
                        .font(.footnote.monospaced())
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            Button(role: .destructive) {
                confirmLogout = true
            } label: {
                MoreHubRow(icon: "rectangle.portrait.and.arrow.right", title: "Log out", tone: .rose, titleTone: .rose)
            }
        }
    }
}

// MARK: - Workspace switcher

struct MoreWorkspaceSwitcherSheet: View {
    @Environment(AppEnvironment.self) private var env
    @Environment(\.dismiss) private var dismiss
    @State private var switchingID: String?
    @State private var creating = false
    @State private var newName = ""
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            List {
                Section("Workspaces") {
                    ForEach(env.session.memberships) { membership in
                        if let org = membership.organization {
                            workspaceRow(membership: membership, org: org)
                        }
                    }
                }
                Section("New workspace") {
                    TextField("Workspace name", text: $newName)
                        .font(.system(size: 14))
                    Button {
                        create()
                    } label: {
                        HStack {
                            Text("Create workspace")
                                .font(.system(size: 14, weight: .medium))
                            if creating {
                                Spacer()
                                ProgressView().controlSize(.small)
                            }
                        }
                    }
                    .disabled(newName.trimmingCharacters(in: .whitespaces).isEmpty || creating)
                }
            }
            .navigationTitle("Workspace")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .alert(
                "Couldn't switch workspace",
                isPresented: Binding(
                    get: { errorMessage != nil },
                    set: { if !$0 { errorMessage = nil } }
                )
            ) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func workspaceRow(membership: OrganizationMember, org: Organization) -> some View {
        Button {
            select(org.id)
        } label: {
            HStack(spacing: 12) {
                WAvatar(name: org.name, imageURL: org.avatarURL, seed: org.id, size: 32)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 4) {
                        Text(org.name)
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(.primary)
                            .lineLimit(1)
                        if membership.role == "owner" {
                            Image(systemName: "crown.fill")
                                .font(.system(size: 9))
                                .foregroundStyle(Tone.amber.color)
                        }
                    }
                    if let role = membership.role {
                        Text(role.capitalized)
                            .font(.system(size: 11.5))
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
                if switchingID == org.id {
                    ProgressView().controlSize(.small)
                } else if org.id == env.session.currentOrgID {
                    Image(systemName: "checkmark")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(WTheme.accent)
                }
            }
        }
        .buttonStyle(.plain)
        .disabled(switchingID != nil)
    }

    private func select(_ orgID: String) {
        guard switchingID == nil else { return }
        if orgID == env.session.currentOrgID {
            dismiss()
            return
        }
        switchingID = orgID
        Task {
            do {
                try await env.session.switchOrganization(orgID)
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
            switchingID = nil
        }
    }

    private func create() {
        let name = newName.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty, !creating else { return }
        creating = true
        Task {
            do {
                try await env.session.createOrganization(name: name)
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
            creating = false
        }
    }
}
