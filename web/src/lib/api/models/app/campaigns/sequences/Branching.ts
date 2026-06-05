// Step branching — conditional routing between steps. Each branch fires when its
// conditions match (recipient opened / clicked / replied, optionally within N
// days) and routes to a target step, or stops the sequence when the target is
// null.
//
// Shipped on the sequence PATCH body as `conditions: { branches: [...] }`
// (PATCH /campaigns/:id/sequences/:seqId), so it rides the existing
// useUpdateSequence mutation.

export type BranchField = "opened" | "clicked" | "replied" | "random";
export type BranchOperator = "within_days" | "always" | "chance";

export interface BranchCondition {
    field: BranchField;
    operator: BranchOperator;
    // For `within_days`: the number of days the event must fall within. For
    // `random`/`chance`: the percentage (1-99) of contacts that take this branch
    // (deterministic per contact). Omitted/ignored for `always`.
    value?: number;
}

export interface SequenceBranch {
    branch_id: string;
    // null = stop the sequence when this branch matches.
    target_sequence_id: string | null;
    conditions: BranchCondition[];
}

// The full conditions payload carried on the sequence record + PATCH body.
export interface SequenceConditions {
    branches: SequenceBranch[];
}

export const BRANCH_FIELD_LABELS: Record<BranchField, string> = {
    opened: "opened the email",
    clicked: "clicked a link",
    replied: "replied",
    random: "random split",
};
