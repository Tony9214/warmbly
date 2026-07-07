import SwiftUI

/// Shown when the session has no auto-resolvable workspace: zero orgs
/// (create one) or several (pick one).
struct OrgPickerView: View {
    @Environment(AppEnvironment.self) private var env
    @State private var busyOrgID: String?
    @State private var newOrgName = ""
    @State private var creating = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            List {
                if !env.session.memberships.isEmpty {
                    Section("Choose a workspace") {
                        ForEach(env.session.memberships) { membership in
                            Button {
                                Task { await select(membership.organizationID) }
                            } label: {
                                HStack(spacing: 12) {
                                    WAvatar(
                                        name: membership.organization?.name ?? "?",
                                        imageURL: membership.organization?.avatarURL,
                                        seed: membership.organizationID,
                                        size: 34
                                    )
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(membership.organization?.name ?? "Workspace")
                                            .font(.system(size: 14, weight: .medium))
                                            .foregroundStyle(.primary)
                                        if let role = membership.role {
                                            Text(role.capitalized)
                                                .font(.system(size: 11))
                                                .foregroundStyle(.secondary)
                                        }
                                    }
                                    Spacer()
                                    if busyOrgID == membership.organizationID {
                                        ProgressView()
                                    } else {
                                        Image(systemName: "chevron.right")
                                            .font(.system(size: 12))
                                            .foregroundStyle(.tertiary)
                                    }
                                }
                            }
                            .disabled(busyOrgID != nil)
                        }
                    }
                }

                Section(env.session.memberships.isEmpty ? "Create your workspace" : "Or create a new one") {
                    TextField("Workspace name", text: $newOrgName)
                    Button {
                        Task { await create() }
                    } label: {
                        if creating {
                            ProgressView()
                        } else {
                            Text("Create workspace")
                        }
                    }
                    .disabled(creating || newOrgName.trimmingCharacters(in: .whitespaces).isEmpty)
                }

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .font(.system(size: 12))
                            .foregroundStyle(WTheme.negative)
                    }
                }
            }
            .navigationTitle("Workspaces")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Log out") {
                        Task { await env.session.logout() }
                    }
                }
            }
        }
    }

    private func select(_ orgID: String) async {
        busyOrgID = orgID
        errorMessage = nil
        do {
            try await env.session.selectOrganization(orgID)
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        busyOrgID = nil
    }

    private func create() async {
        creating = true
        errorMessage = nil
        do {
            try await env.session.createOrganization(name: newOrgName.trimmingCharacters(in: .whitespaces))
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        creating = false
    }
}
