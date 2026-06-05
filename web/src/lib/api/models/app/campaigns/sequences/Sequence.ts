import type { SequenceConditions } from "./Branching";

export default interface Sequence {
    id: string;
    name: string;

    subject: string;

    body_plain: string;
    body_html: string;
    body_sync: boolean;
    body_code: boolean;

    wait_after: number;

    // Conditional step routing. Absent when the step has no branches; a PATCH
    // with this field replaces the step's branch set wholesale.
    conditions?: SequenceConditions | null;

    updated_at: Date;
    created_at: Date;
}
