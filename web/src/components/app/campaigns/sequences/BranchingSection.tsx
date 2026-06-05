// Step branching editor (lives under the Step composer). Lets you add
// conditional routes off this step: "if the recipient opened / clicked /
// replied (optionally within N days) -> go to step X, or stop the sequence".
//
// Branches are persisted as the step's `conditions: { branches: [...] }` via the
// existing useUpdateSequence PATCH. The editor keeps a local draft and saves the
// whole branch set at once (the PATCH replaces it wholesale).

import React from "react";
import {
    GitBranchIcon,
    PlusIcon,
    Loader2Icon,
    Trash2Icon,
    XIcon,
    ArrowRightIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import type Sequence from "@/lib/api/models/app/campaigns/sequences/Sequence";
import type {
    SequenceBranch,
    BranchField,
    BranchOperator,
} from "@/lib/api/models/app/campaigns/sequences/Branching";
import { Label, NumberInput } from "@/components/ui/field";
import {
    PopoverMenu,
    PopoverMenuContent,
    PopoverMenuTrigger,
    PopoverMenuItem,
    SelectButton,
} from "@/components/ui/popover-menu";
import useUpdateSequence from "@/lib/api/hooks/app/campaigns/sequences/useUpdateSequence";
import useSequences from "@/lib/api/hooks/app/campaigns/sequences/useSequences";
import { useConfirm } from "@/hooks/context/confirm";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";

const FIELD_OPTIONS: { value: BranchField; label: string }[] = [
    { value: "opened", label: "opened the email" },
    { value: "clicked", label: "clicked a link" },
    { value: "replied", label: "replied" },
];

function newBranch(): SequenceBranch {
    return {
        branch_id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `branch-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        target_sequence_id: null,
        conditions: [{ field: "opened", operator: "within_days", value: 3 }],
    };
}

function fieldLabel(f: BranchField): string {
    return FIELD_OPTIONS.find((o) => o.value === f)?.label ?? f;
}

export default function BranchingSection({
    campaignId,
    sequence,
}: {
    campaignId: string;
    sequence: Sequence;
}) {
    const update = useUpdateSequence(campaignId, sequence.id);
    // The campaign's full ordered step list — used to render branch targets.
    // Reads the same cached query the composer already loaded (Suspense parent).
    const { data: sequences } = useSequences(campaignId);
    const confirm = useConfirm();

    const [branches, setBranches] = React.useState<SequenceBranch[]>(
        () => sequence.conditions?.branches ?? [],
    );

    // Re-seed when this step's record changes (switched step, saved elsewhere).
    React.useEffect(() => {
        setBranches(sequence.conditions?.branches ?? []);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sequence.id, sequence.updated_at]);

    const dirty = React.useMemo(
        () => JSON.stringify(sequence.conditions?.branches ?? []) !== JSON.stringify(branches),
        [sequence.conditions, branches],
    );

    // Steps other than this one are valid branch targets.
    const targets = sequences.filter((s) => s.id !== sequence.id);
    const targetIndex = (id: string) => sequences.findIndex((s) => s.id === id);

    const patchBranch = (id: string, p: Partial<SequenceBranch>) =>
        setBranches((bs) => bs.map((b) => (b.branch_id === id ? { ...b, ...p } : b)));

    const patchCondition = (
        branchId: string,
        idx: number,
        p: Partial<SequenceBranch["conditions"][number]>,
    ) =>
        setBranches((bs) =>
            bs.map((b) =>
                b.branch_id === branchId
                    ? { ...b, conditions: b.conditions.map((c, i) => (i === idx ? { ...c, ...p } : c)) }
                    : b,
            ),
        );

    const addCondition = (branchId: string) =>
        setBranches((bs) =>
            bs.map((b) =>
                b.branch_id === branchId
                    ? {
                          ...b,
                          conditions: [
                              ...b.conditions,
                              { field: "clicked", operator: "always" } as SequenceBranch["conditions"][number],
                          ],
                      }
                    : b,
            ),
        );

    const removeCondition = (branchId: string, idx: number) =>
        setBranches((bs) =>
            bs.map((b) =>
                b.branch_id === branchId
                    ? { ...b, conditions: b.conditions.filter((_, i) => i !== idx) }
                    : b,
            ),
        );

    const addBranch = () => setBranches((bs) => [...bs, newBranch()]);

    const removeBranch = (id: string) =>
        setBranches((bs) => bs.filter((b) => b.branch_id !== id));

    const save = async () => {
        if (!dirty || update.isPending) return;
        await toast.promise(update.mutateAsync({ conditions: { branches } }), {
            loading: "Saving branches…",
            success: "Branches saved.",
            error: (e: AppError) => buildError(e),
        });
    };

    const reset = () => {
        if (!dirty) return;
        confirm.show("Discard unsaved branch changes for this step?", () => {
            setBranches(sequence.conditions?.branches ?? []);
        });
    };

    return (
        <div className="rounded-md border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                    <GitBranchIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">
                            Branching
                        </div>
                        <p className="truncate text-[11px] text-slate-400">
                            {branches.length === 0
                                ? "Route recipients to another step based on how they react."
                                : `${branches.length} branch${branches.length === 1 ? "" : "es"}, checked top to bottom.`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {dirty && (
                        <button
                            type="button"
                            onClick={reset}
                            disabled={update.isPending}
                            className="h-7 px-2.5 rounded-md border border-slate-200 bg-white text-[12px] font-medium text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900 disabled:opacity-40"
                        >
                            Reset
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={save}
                        disabled={!dirty || update.isPending}
                        className="h-7 px-3 rounded-md bg-sky-600 text-[12px] font-medium text-white transition-colors hover:bg-sky-700 inline-flex items-center gap-1.5 disabled:opacity-40"
                    >
                        {update.isPending && <Loader2Icon className="w-3 h-3 animate-spin" />}
                        Save
                    </button>
                </div>
            </div>

            <div className="space-y-3 p-3">
                {branches.length === 0 ? (
                    <p className="text-[11.5px] text-slate-400">
                        No branches. After this step, recipients continue to the next step in order.
                    </p>
                ) : (
                    branches.map((b, bi) => (
                        <div key={b.branch_id} className="rounded-md border border-slate-200 bg-slate-50/60 p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">
                                    {bi === 0 ? "If" : "Else if"}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => removeBranch(b.branch_id)}
                                    title="Remove branch"
                                    className="size-6 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                >
                                    <Trash2Icon className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <div className="space-y-2">
                                {b.conditions.map((c, ci) => (
                                    <div key={ci} className="flex flex-wrap items-center gap-2">
                                        {ci > 0 && (
                                            <span className="text-[11px] font-medium text-slate-400">and</span>
                                        )}
                                        <span className="text-[12px] text-slate-500">recipient</span>

                                        {/* field */}
                                        <PopoverMenu>
                                            <PopoverMenuTrigger asChild>
                                                <SelectButton label={fieldLabel(c.field)} />
                                            </PopoverMenuTrigger>
                                            <PopoverMenuContent minWidth={200}>
                                                {FIELD_OPTIONS.map((o) => (
                                                    <PopoverMenuItem
                                                        key={o.value}
                                                        selected={o.value === c.field}
                                                        onSelect={() =>
                                                            patchCondition(b.branch_id, ci, { field: o.value })
                                                        }
                                                    >
                                                        {o.label}
                                                    </PopoverMenuItem>
                                                ))}
                                            </PopoverMenuContent>
                                        </PopoverMenu>

                                        {/* operator */}
                                        <PopoverMenu>
                                            <PopoverMenuTrigger asChild>
                                                <SelectButton
                                                    label={c.operator === "within_days" ? "within" : "ever"}
                                                />
                                            </PopoverMenuTrigger>
                                            <PopoverMenuContent minWidth={160}>
                                                <PopoverMenuItem
                                                    selected={c.operator === "within_days"}
                                                    onSelect={() =>
                                                        patchCondition(b.branch_id, ci, {
                                                            operator: "within_days" as BranchOperator,
                                                            value: c.value ?? 3,
                                                        })
                                                    }
                                                >
                                                    within N days
                                                </PopoverMenuItem>
                                                <PopoverMenuItem
                                                    selected={c.operator === "always"}
                                                    onSelect={() =>
                                                        patchCondition(b.branch_id, ci, {
                                                            operator: "always" as BranchOperator,
                                                        })
                                                    }
                                                >
                                                    ever (any time)
                                                </PopoverMenuItem>
                                            </PopoverMenuContent>
                                        </PopoverMenu>

                                        {c.operator === "within_days" && (
                                            <>
                                                <NumberInput
                                                    value={c.value ?? 1}
                                                    onChange={(v) => patchCondition(b.branch_id, ci, { value: v })}
                                                    min={1}
                                                    max={60}
                                                    className="w-24"
                                                />
                                                <span className="text-[12px] text-slate-500">days</span>
                                            </>
                                        )}

                                        {b.conditions.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeCondition(b.branch_id, ci)}
                                                title="Remove condition"
                                                className="size-6 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                            >
                                                <XIcon className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                ))}

                                <button
                                    type="button"
                                    onClick={() => addCondition(b.branch_id)}
                                    className="inline-flex items-center gap-1 text-[11.5px] font-medium text-sky-600 hover:text-sky-700"
                                >
                                    <PlusIcon className="w-3 h-3" />
                                    Add condition
                                </button>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200/70 pt-3">
                                <ArrowRightIcon className="w-3.5 h-3.5 text-slate-400" />
                                <Label className="mb-0">then</Label>
                                <PopoverMenu>
                                    <PopoverMenuTrigger asChild>
                                        <SelectButton
                                            label={
                                                b.target_sequence_id === null
                                                    ? "stop the sequence"
                                                    : (() => {
                                                          const idx = targetIndex(b.target_sequence_id);
                                                          const t = sequences[idx];
                                                          return idx >= 0
                                                              ? `go to step ${idx + 1}${t?.name ? ` · ${t.name}` : ""}`
                                                              : "go to step…";
                                                      })()
                                            }
                                        />
                                    </PopoverMenuTrigger>
                                    <PopoverMenuContent minWidth={240} className="max-h-60 overflow-y-auto">
                                        <PopoverMenuItem
                                            selected={b.target_sequence_id === null}
                                            onSelect={() => patchBranch(b.branch_id, { target_sequence_id: null })}
                                        >
                                            Stop the sequence
                                        </PopoverMenuItem>
                                        {targets.map((s) => {
                                            const idx = sequences.findIndex((x) => x.id === s.id);
                                            return (
                                                <PopoverMenuItem
                                                    key={s.id}
                                                    selected={b.target_sequence_id === s.id}
                                                    onSelect={() =>
                                                        patchBranch(b.branch_id, { target_sequence_id: s.id })
                                                    }
                                                >
                                                    {`Step ${idx + 1}${s.name ? ` · ${s.name}` : ""}`}
                                                </PopoverMenuItem>
                                            );
                                        })}
                                    </PopoverMenuContent>
                                </PopoverMenu>
                            </div>
                        </div>
                    ))
                )}

                <button
                    type="button"
                    onClick={addBranch}
                    className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white text-[12px] font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900"
                >
                    <PlusIcon className="w-3.5 h-3.5" />
                    Add branch
                </button>
            </div>
        </div>
    );
}
