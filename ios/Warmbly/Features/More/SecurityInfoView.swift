import SwiftUI

@MainActor
@Observable
final class MoreSecurityStore {
    var twoFAEnabled: Bool?
    var passkeys: [PasskeyCredential] = []
    var loadedOnce = false
    var isLoading = false
    var errorMessage: String?

    func load(_ api: APIClient) async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil
        do {
            let status: MoreTwoFAStatus = try await api.get("auth/2fa/status")
            twoFAEnabled = status.enabled ?? false
            // Bare array.
            passkeys = try await api.get("auth/passkey/credentials")
            loadedOnce = true
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

/// Read-only security overview: 2FA state and enrolled passkeys.
/// Enrollment flows live on the web dashboard.
struct SecurityInfoView: View {
    @Environment(AppEnvironment.self) private var env
    @State private var store = MoreSecurityStore()

    var body: some View {
        content
            .navigationTitle("Security")
            .navigationBarTitleDisplayMode(.inline)
            .task { await store.load(env.api) }
            .onChange(of: env.realtime.pulse(for: .me)) {
                Task { await store.load(env.api) }
            }
    }

    @ViewBuilder
    private var content: some View {
        if !store.loadedOnce {
            if let message = store.errorMessage {
                ErrorStateView(title: "Couldn't load security settings", message: message) {
                    await store.load(env.api)
                }
            } else {
                SkeletonRows(rows: 4)
            }
        } else {
            List {
                twoFASection
                passkeysSection
                Section {
                    Text("Two-factor enrollment and passkey registration are managed on the web dashboard.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .listStyle(.insetGrouped)
            .refreshable { await store.load(env.api) }
        }
    }

    private var twoFASection: some View {
        Section("Two-factor authentication") {
            HStack(spacing: 12) {
                IconTile(
                    symbol: "lock.shield.fill",
                    tone: store.twoFAEnabled == true ? .emerald : .slate,
                    size: 34
                )
                VStack(alignment: .leading, spacing: 2) {
                    Text("Authenticator app")
                        .font(.body.weight(.medium))
                    Text("Time-based one-time codes")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                StatusPill(
                    text: store.twoFAEnabled == true ? "Enabled" : "Off",
                    tone: store.twoFAEnabled == true ? .emerald : .slate
                )
            }
            .padding(.vertical, 4)
        }
    }

    private var passkeysSection: some View {
        Section("Passkeys") {
            if store.passkeys.isEmpty {
                Text("No passkeys yet. Add one from the web dashboard for phishing-resistant sign-in.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            ForEach(store.passkeys) { credential in
                passkeyRow(credential)
            }
        }
    }

    private func passkeyRow(_ credential: PasskeyCredential) -> some View {
        HStack(spacing: 12) {
            IconTile(symbol: "key.fill", tone: .indigo, size: 34)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 5) {
                    Text(credential.name?.isEmpty == false ? credential.name! : "Passkey")
                        .font(.body.weight(.medium))
                        .lineLimit(1)
                    if credential.backupState == true {
                        Image(systemName: "icloud.fill")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                Text(passkeyDetail(credential))
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
            if let created = credential.createdAt {
                Text(WFormat.relative(created))
                    .font(.footnote)
                    .monospacedDigit()
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 4)
    }

    private func passkeyDetail(_ credential: PasskeyCredential) -> String {
        var parts: [String] = []
        if let provider = credential.provider, !provider.isEmpty {
            parts.append(provider)
        }
        if let transports = credential.transports, !transports.isEmpty {
            parts.append(transports.joined(separator: ", "))
        }
        if let lastUsed = credential.lastUsedAt {
            parts.append("used \(WFormat.relative(lastUsed))")
        } else {
            parts.append("never used")
        }
        return parts.joined(separator: " · ")
    }
}
