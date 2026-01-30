export default interface Campaign {
    id: string;

    name: string;
    description: string;
    status: string;

    stop_on_reply: boolean;
    open_tracking: boolean;
    link_tracking: boolean;
    text_only: boolean;
    daily_limit: number;
    unsubscribe_header: boolean;
    risky_emails: boolean;

    cc: string[];
    bcc: string[];

    start_date?: Date | null;
    end_date?: Date | null;
    timezone: string;
    days: number;
    start_time: string;
    end_time: string;

    email_tags: string[];

    updated_at: Date;
    created_at: Date;

    // Extra
    analytics: null;
    sequences: Sequence[] | null;
}

