export default interface Session {
    session: string;
    access_token?: string;
    access_token_expires_at?: string;
    refresh_token?: string;
    refresh_token_expires_at?: string;
}
