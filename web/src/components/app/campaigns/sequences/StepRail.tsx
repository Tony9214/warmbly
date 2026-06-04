import React from "react";
import { CheckIcon, ClockIcon, Loader2Icon, PlusIcon, SendIcon } from "lucide-react";
import toast from "react-hot-toast";
import { NumberInput } from "@/components/ui/field";
import SequenceBox from "./SequenceBox";
import type Sequence from "@/lib/api/models/app/campaigns/sequences/Sequence";
import useUpdateSequence from "@/lib/api/hooks/app/campaigns/sequences/useUpdateSequence";
import useDeleteSequence from "@/lib/api/hooks/app/campaigns/sequences/useDeleteSequence";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import { useConfirm } from "@/hooks/context/confirm";

const MAX_STEPS = 5;

// WaitConnector — the vertical line between two steps. Step 1 has no preceding
// connector (it sends immediately); every later step is preceded by a "Wait N
// days" control whose NumberInput persists wait_after on the step it gates.
function WaitConnector({
    campaignId,
    sequence,
}: {
    campaignId: string;
    sequence: Sequence;
}) {
    const update = useUpdateSequence(campaignId, sequence.id);
    // `draft` is the live edited value; it only persists on a commit point
    // (blur / Enter / stepper) — never on every keystroke — so an in-flight
    // save can't snap the field back mid-typing.
    const [draft, setDraft] = React.useState<number>(sequence.wait_after);
    const [savedAt, setSavedAt] = React.useState(0);

    // Keep the local draft in lockstep with the canonical value when the cache
    // updates (e.g. after a save elsewhere).
    React.useEffect(() => {
        setDraft(sequence.wait_after);
    }, [sequence.wait_after]);

    const commit = (v: number) => {
        const next = Math.max(0, Math.round(v));
        setDraft(next);
        if (next === sequence.wait_after) return; // no change → nothing to save
        update.mutate(
            { wait_after: next },
            {
                onSuccess: () => setSavedAt((n) => n + 1),
                onError: (err) => {
                    setDraft(sequence.wait_after);
                    toast.error(buildError(err as unknown as AppError));
                },
            },
        );
    };

    // Briefly flash a "saved" tick after a successful commit.
    const [showSaved, setShowSaved] = React.useState(false);
    React.useEffect(() => {
        if (savedAt === 0) return;
        setShowSaved(true);
        const t = setTimeout(() => setShowSaved(false), 1400);
        return () => clearTimeout(t);
    }, [savedAt]);

    return (
        <div className="flex items-stretch gap-2 pl-2.5">
            <div className="flex flex-col items-center">
                <span className="w-px flex-1 bg-slate-200" />
                <span className="size-1.5 rounded-full bg-slate-300" />
                <span className="w-px flex-1 bg-slate-200" />
            </div>
            <div className="flex-1 py-1.5">
                <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50/60 px-2 py-1.5">
                    <ClockIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-[11px] text-slate-500">Wait</span>
                    <NumberInput
                        value={draft}
                        onChange={setDraft}
                        onCommit={commit}
                        min={0}
                        max={60}
                        className="w-20"
                        align="center"
                    />
                    <span className="text-[11px] text-slate-500">days</span>
                    {update.isPending ? (
                        <Loader2Icon className="w-3 h-3 text-slate-300 animate-spin" />
                    ) : showSaved ? (
                        <span className="inline-flex items-center gap-0.5 text-[10.5px] font-medium text-emerald-600">
                            <CheckIcon className="w-3 h-3" />
                            Saved
                        </span>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

export default function StepRail({
    campaignId,
    sequences,
    selectedId,
    onSelect,
    onCreate,
    creating,
}: {
    campaignId: string;
    sequences: Sequence[];
    selectedId: string;
    onSelect: (id: string) => void;
    onCreate: () => void;
    creating: boolean;
}) {
    const confirm = useConfirm();
    const deleteSequence = useDeleteSequence(campaignId);

    function requestDelete(seq: Sequence, index: number) {
        const name = seq.name || `Step ${index + 1}`;
        confirm.show(
            `Delete step ${index + 1}? "${name}" and its content will be removed from this campaign. This can't be undone.`,
            async () => {
                try {
                    await deleteSequence.mutateAsync(seq.id);
                    toast.success("Step removed.");
                    if (selectedId === seq.id) {
                        const remaining = sequences.filter((s) => s.id !== seq.id);
                        onSelect(remaining[0]?.id ?? "");
                    }
                } catch (err) {
                    toast.error(buildError(err as AppError));
                }
            },
        );
    }

    return (
        <div className="space-y-0">
            {sequences.map((seq, i) => (
                <React.Fragment key={seq.id}>
                    {i === 0 ? (
                        <div className="flex items-center gap-2 pl-2.5 pb-1.5 text-[11px] text-slate-400">
                            <SendIcon className="w-3.5 h-3.5 text-slate-400" />
                            Sends immediately
                        </div>
                    ) : (
                        <WaitConnector campaignId={campaignId} sequence={seq} />
                    )}
                    <SequenceBox
                        index={i}
                        name={seq.name}
                        subject={seq.subject}
                        active={seq.id === selectedId}
                        onClick={() => onSelect(seq.id)}
                        onDelete={() => requestDelete(seq, i)}
                    />
                </React.Fragment>
            ))}

            {sequences.length < MAX_STEPS && (
                <div className="pt-3">
                    <button
                        type="button"
                        onClick={onCreate}
                        disabled={creating}
                        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-slate-300 bg-white px-3 py-2 text-[12px] font-medium text-slate-500 transition-colors hover:border-sky-300 hover:text-sky-700 disabled:opacity-60"
                    >
                        {creating ? (
                            <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <PlusIcon className="w-3.5 h-3.5" />
                        )}
                        Add step
                    </button>
                    <p className="mt-2 px-0.5 text-[10.5px] leading-relaxed text-slate-400">
                        Up to {MAX_STEPS} steps. Follow-ups thread on the same subject line.
                    </p>
                </div>
            )}

        </div>
    );
}
