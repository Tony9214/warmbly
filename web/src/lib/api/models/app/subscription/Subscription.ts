export default interface Subscription {
    id: string
    plan_id: string
    // The API returns the selected plan as a nested object. Keep plan_name as
    // an optional compatibility field for older deployments.
    plan_name?: string
    plan?: {
        name?: string
    }
    status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete'
    current_period_start: Date
    current_period_end: Date
    cancel_at_period_end: boolean
}
