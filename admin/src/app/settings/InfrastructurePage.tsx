// Settings → Infrastructure. One read-only page consolidating the platform's
// pluggable backends (KMS, blob storage, encrypted-keys store, event bus,
// transports). Previously these were five near-identical pages that each
// advertised an "activate" action they never performed; they're folded into
// this single honest read-only surface.

import { PageHeader } from "@/components/layout/PageHeader";
import { BackendSection } from "./BackendsPage";

export default function InfrastructurePage() {
    return (
        <div className="space-y-4">
            <PageHeader
                title="Infrastructure"
                description="The pluggable backends the platform runs on. Chosen via environment configuration at boot and shown here read-only."
            />

            <BackendSection
                kind="kms"
                title="Encryption (KMS)"
                description="The platform's envelope-encryption root of trust. KMS issues per-user 32-byte DEKs that are AES-256-GCM sealed."
                notes="Encrypted DEK blobs live in the user_encrypted_keys Postgres table; the plaintext DEK is only ever held in the cache and in process memory. Existing DEKs stay readable so long as the previous provider keeps the wrapping key alive."
            />

            <BackendSection
                kind="blob"
                title="Storage — Blob"
                description="Object storage backing email attachments, exports, and other binary payloads. Today S3-compatible."
                notes="Workers receive pre-signed URLs to read/write encrypted payloads directly; they never see backend credentials, in line with the worker-as-execution-plane rule."
            />

            <BackendSection
                kind="encrypted_keys"
                title="Storage — Encrypted Keys"
                description="Postgres-backed table (user_encrypted_keys) that holds the encrypted DEK blobs produced by the KMS layer. Workers read it over the backend's internal API rather than via direct SQL."
            />

            <BackendSection
                kind="eventbus"
                title="Messaging (EventBus)"
                description="Kafka-style event bus shared by backend → consumer → worker. Workers receive commands on worker-specific topics and publish results back through the same bus."
                notes="Workers don't depend on direct PostgreSQL access; Kafka is the line of communication into and out of the execution plane."
            />

            <BackendSection
                kind="transport"
                title="Transports (SMTP / OAuth)"
                description="Outbound SMTP defaults, OAuth client registration for Gmail and Outlook, and other mailbox-side transport credentials workers need to send mail."
                notes="Mailbox-level send budgets stay the source of truth; transport defaults set ceilings, not floors."
            />
        </div>
    );
}
