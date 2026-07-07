import SwiftUI

/// Campaign settings: everything mobile can safely edit (name, description,
/// delivery toggles) edits in place via PATCH; the desk-sized knobs (rotation,
/// ramp-up, ESP matching, lead flow, tracking domain) show their current
/// values read-only with a web handoff. Delete lives here too, iOS-style.
struct CampaignSettingsPage: View {
    @Environment(AppEnvironment.self) private var env
    @Environment(\.dismiss) private var dismiss

    let store: CampaignDetailStore
    let onDeleted: () -> Void

    @State private var name = ""
    @State private var description = ""
    @State private var isSaving = false
    @State private var confirmDelete = false
    @State private var deleteError: String?

    private var campaign: Campaign { store.campaign }
    private var canManage: Bool { env.session.can(.manageCampaigns) }

    private var trimmedName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var nameDirty: Bool {
        trimmedName != campaign.name || description != (campaign.description ?? "")
    }
    private var nameValid: Bool { (3...50).contains(trimmedName.count) }

    var body: some View {
        List {
            identitySection
            deliverySection
            advancedSection
            if canManage {
                dangerSection
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if nameDirty, canManage {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await saveIdentity() }
                    } label: {
                        if isSaving {
                            ProgressView().controlSize(.small)
                        } else {
                            Text("Save").fontWeight(.semibold)
                        }
                    }
                    .disabled(!nameValid || isSaving)
                }
            }
        }
        .onAppear {
            name = campaign.name
            description = campaign.description ?? ""
        }
        .confirmationDialog("Delete campaign?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete \(campaign.name)", role: .destructive) {
                Task { await deleteCampaign() }
            }
        } message: {
            Text("Leads stay in your contacts. This can't be undone.")
        }
        .alert("Couldn't delete campaign", isPresented: Binding(
            get: { deleteError != nil },
            set: { if !$0 { deleteError = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(deleteError ?? "")
        }
    }

    // MARK: Name + description

    private var identitySection: some View {
        Section {
            TextField("Campaign name", text: $name)
                .disabled(!canManage)
            TextField("Description (optional)", text: $description, axis: .vertical)
                .lineLimit(2...5)
                .disabled(!canManage)
        } header: {
            Text("Campaign")
        } footer: {
            if !nameValid, nameDirty {
                Text("Name must be 3–50 characters.")
                    .foregroundStyle(WTheme.negative)
            }
        }
    }

    private func saveIdentity() async {
        isSaving = true
        let newName = trimmedName
        let newDescription = description
        await store.update(
            env.api,
            body: CampaignUpdateBody(name: newName, description: newDescription)
        ) {
            $0.name = newName
            $0.description = newDescription
        }
        name = store.campaign.name
        description = store.campaign.description ?? ""
        isSaving = false
    }

    // MARK: Delivery toggles

    private var deliverySection: some View {
        Section {
            deliveryToggle(
                "Plain-text only",
                subtitle: "Send without HTML formatting",
                icon: "textformat",
                value: campaign.textOnly ?? false,
                body: { CampaignUpdateBody(textOnly: $0) },
                mutate: { c, v in c.textOnly = v }
            )
            deliveryToggle(
                "Unsubscribe header",
                subtitle: "One-click list-unsubscribe (recommended)",
                icon: "hand.wave.fill",
                value: campaign.unsubscribeHeader ?? false,
                body: { CampaignUpdateBody(unsubscribeHeader: $0) },
                mutate: { c, v in c.unsubscribeHeader = v }
            )
            deliveryToggle(
                "Risky addresses",
                subtitle: "Send to leads with risky verification",
                icon: "exclamationmark.shield.fill",
                value: campaign.riskyEmails ?? false,
                body: { CampaignUpdateBody(riskyEmails: $0) },
                mutate: { c, v in c.riskyEmails = v }
            )
        } header: {
            Text("Delivery")
        } footer: {
            Text("Risky addresses raise bounce risk; keep this off unless you know the list.")
        }
    }

    private func deliveryToggle(
        _ title: String,
        subtitle: String,
        icon: String,
        value: Bool,
        body: @escaping (Bool) -> CampaignUpdateBody,
        mutate: @escaping (inout Campaign, Bool) -> Void
    ) -> some View {
        Toggle(isOn: Binding(
            get: { value },
            set: { newValue in
                Task {
                    await store.update(env.api, body: body(newValue)) { mutate(&$0, newValue) }
                }
            }
        )) {
            HStack(spacing: 12) {
                IconTile(symbol: icon, tone: .slate, size: 30)
                VStack(alignment: .leading, spacing: 1) {
                    Text(title)
                    Text(subtitle)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .tint(WTheme.accent)
        .disabled(!canManage)
    }

    // MARK: Advanced (read-only, tuned on the web)

    private var rampLine: String {
        guard campaign.rampEnabled == true else { return "Off" }
        let start = campaign.rampStart ?? 0
        let ceiling = campaign.rampCeiling ?? 0
        let increment = campaign.rampIncrement ?? 0
        var line = "\(start) → \(ceiling), +\(increment)/day"
        if let level = campaign.rampLevel, level > 0 {
            line += " (now \(level))"
        }
        return line
    }

    private var leadFlowLine: String {
        let cap = campaign.maxNewLeadsPerDay ?? 0
        var line = cap == 0 ? "Unlimited new leads" : "\(cap) new leads/day"
        if campaign.prioritizeNewLeads == true {
            line += ", new first"
        }
        return line
    }

    private var advancedSection: some View {
        Section {
            advancedRow(
                "Sender strategy",
                value: campaign.senderStrategy == "tags" ? "By tags" : "Explicit list"
            )
            advancedRow("Rotation", value: (campaign.rotationMode ?? "balanced").capitalized)
            advancedRow("Ramp-up", value: rampLine)
            advancedRow("ESP matching", value: (campaign.espMatchMode ?? "off").capitalized)
            advancedRow("Lead flow", value: leadFlowLine)
            if let cc = campaign.cc, !cc.isEmpty {
                advancedRow("CC", value: cc.joined(separator: ", "))
            }
            if let bcc = campaign.bcc, !bcc.isEmpty {
                advancedRow("BCC", value: bcc.joined(separator: ", "))
            }
            if let domain = campaign.trackingDomain, !domain.isEmpty {
                advancedRow(
                    "Tracking domain",
                    value: campaign.trackingDomainVerified == true ? domain : "\(domain) (unverified)"
                )
            }
        } header: {
            Text("Advanced")
        } footer: {
            Text("Rotation, ramp-up, ESP matching, lead flow and tracking domains are tuned in the campaign preferences in Warmbly on the web.")
        }
    }

    private func advancedRow(_ title: String, value: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
            Spacer()
            Text(value)
                .font(.subheadline)
                .monospacedDigit()
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.trailing)
        }
    }

    // MARK: Danger

    private var dangerSection: some View {
        Section {
            Button(role: .destructive) {
                confirmDelete = true
            } label: {
                HStack {
                    Spacer()
                    Text("Delete campaign")
                    Spacer()
                }
            }
        } footer: {
            Text("Only the campaign creator can delete a campaign.")
        }
    }

    private func deleteCampaign() async {
        do {
            try await store.delete(env.api)
            // Dismissing the hub pops this page with it.
            onDeleted()
        } catch {
            deleteError = error.localizedDescription
        }
    }
}
