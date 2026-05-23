// Parameters for the inbox search endpoint (GET /unibox).
// Mirrors backend models.MailSearchParams. Empty / undefined fields are
// stripped before serialization so the URL stays clean.

export interface UniboxSearchParams {
    query?: string;        // Free text — currently matched as subject ILIKE
    from?: string;         // Sender substring
    accountId?: string;    // Filter by an email_accounts row id (server-side filter; reserved)
    unseen?: boolean;      // Only unread
    since?: Date;          // From date
    until?: Date;          // To date
    sortBy?: "newest" | "oldest";
    cursor?: string;
    limit?: number;
}
