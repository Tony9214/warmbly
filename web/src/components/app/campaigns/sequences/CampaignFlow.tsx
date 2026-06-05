// Visual flow canvas for a campaign's steps (React Flow) — the single way to
// build a campaign's email steps and routing.
//
// - Each step is a node (subject, delay). The default path (step N -> N+1) is a
//   dashed "otherwise" arrow; branches are solid sky arrows to a target step or
//   the STOP node, labeled with their condition.
// - ADD A STEP: drag from a step's bottom dot onto empty canvas, or click
//   "+ Add step". ADD A BRANCH: drag from a step's dot onto another step, or
//   click a step's "+ branch" button. EDIT a branch: click its arrow. EDIT a
//   step's email: click the step.

import React from "react";
import {
    ReactFlow,
    Background,
    Controls,
    Panel,
    Handle,
    Position,
    useNodesState,
    useEdgesState,
    type Node,
    type Edge,
    type Connection,
    type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { useQueryClient } from "@tanstack/react-query";
import { FlagIcon, GitBranchIcon, Loader2Icon, MailIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import toast from "react-hot-toast";
import type Sequence from "@/lib/api/models/app/campaigns/sequences/Sequence";
import type {
    SequenceBranch,
    BranchField,
    BranchOperator,
} from "@/lib/api/models/app/campaigns/sequences/Branching";
import { BRANCH_FIELD_LABELS } from "@/lib/api/models/app/campaigns/sequences/Branching";
import useSequences from "@/lib/api/hooks/app/campaigns/sequences/useSequences";
import useCreateSequence from "@/lib/api/hooks/app/campaigns/sequences/useCreateSequence";
import updateSequence from "@/lib/api/client/app/campaigns/sequences/updateSequence";
import SequenceView from "./SequenceView";

const STOP_ID = "__stop__";
const NODE_W = 230;
const NODE_H = 96;

// Auto-lay-out the graph top-to-bottom so branches fan out visually instead of
// stacking in one column. Dagre gives node centers; React Flow wants top-left.
function layoutGraph(nodes: Node[], edges: Edge[]): Node[] {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: "TB", nodesep: 70, ranksep: 80 });
    nodes.forEach((n) => {
        const isStop = n.id === STOP_ID;
        g.setNode(n.id, { width: isStop ? 90 : NODE_W, height: isStop ? 40 : NODE_H });
    });
    edges.forEach((e) => g.setEdge(e.source, e.target));
    dagre.layout(g);
    return nodes.map((n) => {
        const p = g.node(n.id);
        return p ? { ...n, position: { x: p.x - p.width / 2, y: p.y - p.height / 2 } } : n;
    });
}

function newBranchId(): string {
    try {
        return crypto.randomUUID();
    } catch {
        return `b_${Math.floor(performance.now())}_${Math.random().toString(36).slice(2, 8)}`;
    }
}

function branchLabel(b: SequenceBranch): string {
    if (!b.conditions || b.conditions.length === 0) return "any time";
    return b.conditions
        .map((c) => {
            if (c.field === "random") return `${c.value ?? 50}% random`;
            const f = BRANCH_FIELD_LABELS[c.field] ?? c.field;
            return c.operator === "within_days" ? `${f} within ${c.value ?? 3}d` : f;
        })
        .join(" + ");
}

// ── Custom nodes ──────────────────────────────────────────────────────────
type StepNodeData = {
    label: string;
    subtitle: string;
    wait: string;
    index: number;
    branchCount: number;
    onAddBranch: () => void;
};

function StepNode({ data, selected }: NodeProps) {
    const d = data as StepNodeData;
    return (
        <div
            className={`w-[230px] rounded-md border bg-white shadow-sm transition-colors ${
                selected ? "border-sky-400 ring-2 ring-sky-100" : "border-slate-200"
            }`}
        >
            <Handle type="target" position={Position.Top} className="!bg-slate-300 !h-2 !w-2" />
            <div className="flex items-center gap-1.5 border-b border-slate-200/70 px-2.5 py-1.5">
                <MailIcon className="w-3 h-3 text-sky-600 shrink-0" />
                <span className="text-[10px] uppercase tracking-[0.12em] text-slate-400 font-medium">
                    Step {d.index + 1}
                </span>
                <span className="ml-auto text-[10px] text-slate-400">{d.wait}</span>
            </div>
            <div className="px-2.5 py-2">
                <div className="truncate text-[12.5px] font-medium text-slate-800">{d.label || `Step ${d.index + 1}`}</div>
                <div className="truncate text-[11px] text-slate-400">{d.subtitle || "No subject"}</div>
            </div>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    d.onAddBranch();
                }}
                className="nodrag flex w-full items-center justify-center gap-1 border-t border-slate-200/70 py-1 text-[10.5px] font-medium text-slate-500 hover:bg-sky-50 hover:text-sky-700 transition-colors"
            >
                <GitBranchIcon className="w-3 h-3" />
                {d.branchCount > 0 ? `${d.branchCount} branch${d.branchCount === 1 ? "" : "es"} · add` : "add branch"}
            </button>
            <Handle type="source" position={Position.Bottom} className="!bg-sky-500 !h-2.5 !w-2.5" />
        </div>
    );
}

function StopNode() {
    return (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11.5px] font-medium text-rose-600 inline-flex items-center gap-1.5">
            <Handle type="target" position={Position.Top} className="!bg-rose-300 !h-2 !w-2" />
            <FlagIcon className="w-3 h-3" />
            Stop
        </div>
    );
}

const nodeTypes = { step: StepNode, stop: StopNode };

export default function CampaignFlow({ campaignId }: { campaignId: string }) {
    const { data: sequences } = useSequences(campaignId);
    const createSequence = useCreateSequence(campaignId);
    const qc = useQueryClient();

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [selectedEdge, setSelectedEdge] = React.useState<{ sourceId: string; branchId: string } | null>(null);
    const [selectedElse, setSelectedElse] = React.useState<string | null>(null);
    const [editStepId, setEditStepId] = React.useState<string | null>(null);
    const [adding, setAdding] = React.useState(false);
    // Topology fingerprint of the last render; when it changes (a step or branch
    // was added/removed) we re-run the auto-layout instead of keeping stale
    // positions, so new branches fan out immediately without hitting "Tidy up".
    const structureSig = React.useRef("");

    const seqById = React.useMemo(() => {
        const m = new Map<string, Sequence>();
        for (const s of sequences) m.set(s.id, s);
        return m;
    }, [sequences]);

    const saveBranches = React.useCallback(
        async (sourceId: string, branches: SequenceBranch[]) => {
            try {
                await updateSequence(campaignId, sourceId, { conditions: { branches } });
                qc.invalidateQueries({ queryKey: ["campaigns", campaignId, "sequences"] });
            } catch {
                toast.error("Couldn't save the branch");
            }
        },
        [campaignId, qc],
    );

    // Set a step's "else" (fallback) path. `"default"` removes any explicit
    // catch-all so the step falls through to the linear next step; a step id or
    // null (Stop) writes a single empty-conditions branch kept LAST in the array
    // so it is evaluated after every conditional branch.
    const setElse = React.useCallback(
        (sourceId: string, target: string | null | "default") => {
            const src = seqById.get(sourceId);
            if (!src) return;
            const rest = (src.conditions?.branches ?? []).filter((b) => (b.conditions?.length ?? 0) > 0);
            if (target !== "default") {
                rest.push({ branch_id: newBranchId(), target_sequence_id: target, conditions: [] });
            }
            saveBranches(sourceId, rest);
        },
        [seqById, saveBranches],
    );

    const addStep = React.useCallback(async () => {
        if (adding) return;
        setAdding(true);
        try {
            await createSequence.mutateAsync();
            toast.success("Step added");
        } catch {
            toast.error("Couldn't add the step");
        } finally {
            setAdding(false);
        }
    }, [adding, createSequence]);

    // Add a branch from a step with a sensible default (opened within 3 days ->
    // the next step, or stop if none), then open the editor on it.
    const addBranch = React.useCallback(
        (sourceId: string) => {
            const idx = sequences.findIndex((s) => s.id === sourceId);
            const defaultTarget =
                sequences[idx + 1]?.id ?? sequences.find((s) => s.id !== sourceId)?.id ?? null;
            const branch: SequenceBranch = {
                branch_id: newBranchId(),
                target_sequence_id: defaultTarget,
                conditions: [{ field: "opened", operator: "within_days", value: 3 }],
            };
            const src = seqById.get(sourceId);
            saveBranches(sourceId, [...(src?.conditions?.branches ?? []), branch]);
            setSelectedEdge({ sourceId, branchId: branch.branch_id });
        },
        [sequences, seqById, saveBranches],
    );

    // Drag a step's dot onto empty canvas -> add a new step coming off that step.
    // The first/only path out of the last step is the plain unconditional "next"
    // (no branch); any additional path becomes a conditional branch, so only one
    // ever runs per contact.
    const handleDragOut = React.useCallback(
        async (sourceId: string) => {
            if (adding) return;
            const src = seqById.get(sourceId);
            const idx = sequences.findIndex((s) => s.id === sourceId);
            const isLast = idx === sequences.length - 1;
            const hasBranches = (src?.conditions?.branches ?? []).length > 0;
            setAdding(true);
            try {
                const created = (await createSequence.mutateAsync()) as Sequence;
                if (!(isLast && !hasBranches)) {
                    const branch: SequenceBranch = {
                        branch_id: newBranchId(),
                        target_sequence_id: created.id,
                        conditions: [{ field: "opened", operator: "within_days", value: 3 }],
                    };
                    await saveBranches(sourceId, [...(src?.conditions?.branches ?? []), branch]);
                    setSelectedEdge({ sourceId, branchId: branch.branch_id });
                }
                toast.success("Step added");
            } catch {
                toast.error("Couldn't add the step");
            } finally {
                setAdding(false);
            }
        },
        [adding, sequences, seqById, createSequence, saveBranches],
    );

    React.useEffect(() => {
        const stepNodes: Node[] = sequences.map((s, i) => ({
            id: s.id,
            type: "step",
            position: { x: 0, y: 0 },
            data: {
                label: s.name,
                subtitle: s.subject,
                wait: i === 0 ? "sends now" : `wait ${s.wait_after}d`,
                index: i,
                branchCount: (s.conditions?.branches ?? []).filter((b) => (b.conditions?.length ?? 0) > 0).length,
                onAddBranch: () => addBranch(s.id),
            },
        }));
        const hasStop = sequences.some((s) => (s.conditions?.branches ?? []).some((b) => b.target_sequence_id === null));
        if (hasStop) {
            stepNodes.push({
                id: STOP_ID,
                type: "stop",
                position: { x: 0, y: 0 },
                data: {},
            });
        }

        const flowEdges: Edge[] = [];
        sequences.forEach((s, i) => {
            const branches = s.conditions?.branches ?? [];
            const conditional = branches.filter((b) => (b.conditions?.length ?? 0) > 0);
            // A single empty-conditions branch is the explicit "else" (catch-all),
            // kept last on save so it is evaluated after every conditional branch.
            const catchAll = branches.find((b) => (b.conditions?.length ?? 0) === 0);
            for (const b of conditional) {
                const target = b.target_sequence_id ?? STOP_ID;
                flowEdges.push({
                    id: `br-${s.id}-${b.branch_id}`,
                    source: s.id,
                    target,
                    label: branchLabel(b),
                    reconnectable: true,
                    style: { stroke: "#0ea5e9", strokeWidth: 2 },
                    labelStyle: { fill: "#0369a1", fontSize: 10, fontWeight: 600 },
                    labelBgStyle: { fill: "#e0f2fe" },
                    labelBgPadding: [4, 2],
                    data: { sourceId: s.id, branchId: b.branch_id },
                });
            }
            // The "else" path: an explicit catch-all if set, otherwise the implicit
            // linear next step. Clickable + reconnectable so a step can fall back to
            // any step or to Stop — that is how a step becomes branch-only.
            const next = sequences[i + 1];
            if (catchAll) {
                flowEdges.push({
                    id: `else-${s.id}`,
                    source: s.id,
                    target: catchAll.target_sequence_id ?? STOP_ID,
                    label: "else",
                    reconnectable: true,
                    style: { stroke: "#cbd5e1", strokeDasharray: "4 4" },
                    labelStyle: { fill: "#94a3b8", fontSize: 10 },
                    labelBgStyle: { fill: "#fff" },
                    data: { sourceId: s.id, isElse: true, branchId: catchAll.branch_id },
                });
            } else if (next) {
                flowEdges.push({
                    id: `else-${s.id}`,
                    source: s.id,
                    target: next.id,
                    label: conditional.length > 0 ? "else" : "then",
                    reconnectable: true,
                    style: { stroke: "#cbd5e1", strokeDasharray: "4 4" },
                    labelStyle: { fill: "#94a3b8", fontSize: 10 },
                    labelBgStyle: { fill: "#fff" },
                    data: { sourceId: s.id, isElse: true },
                });
            }
        });

        const laid = layoutGraph(stepNodes, flowEdges);
        const sig =
            stepNodes.map((n) => n.id).sort().join(",") +
            "|" +
            flowEdges.map((e) => `${e.source}>${e.target}`).sort().join(",");
        const structureChanged = sig !== structureSig.current;
        structureSig.current = sig;
        setNodes((cur) => {
            // On a topology change (step/branch added or removed) re-flow from
            // scratch so branches fan out; otherwise keep manual drag positions.
            if (structureChanged) return laid;
            const pos = new Map(cur.map((n) => [n.id, n.position]));
            return laid.map((n) => (pos.has(n.id) ? { ...n, position: pos.get(n.id)! } : n));
        });
        setEdges(flowEdges);
    }, [sequences, setNodes, setEdges, addBranch]);

    const onConnect = React.useCallback(
        (c: Connection) => {
            if (!c.source || !c.target || c.source === c.target) return;
            const src = seqById.get(c.source);
            if (!src) return;
            const target = c.target === STOP_ID ? null : c.target;
            const branch: SequenceBranch = {
                branch_id: newBranchId(),
                target_sequence_id: target,
                conditions: [{ field: "opened", operator: "within_days", value: 3 }],
            };
            saveBranches(c.source, [...(src.conditions?.branches ?? []), branch]);
            setSelectedEdge({ sourceId: c.source, branchId: branch.branch_id });
        },
        [seqById, saveBranches],
    );

    const selectedBranch: { source: Sequence; branch: SequenceBranch } | null = React.useMemo(() => {
        if (!selectedEdge) return null;
        const src = seqById.get(selectedEdge.sourceId);
        const br = src?.conditions?.branches?.find((b) => b.branch_id === selectedEdge.branchId);
        return src && br ? { source: src, branch: br } : null;
    }, [selectedEdge, seqById]);

    const editStep = editStepId ? seqById.get(editStepId) : undefined;
    const editIndex = editStep ? sequences.findIndex((s) => s.id === editStep.id) : -1;

    return (
        <div className="relative h-[74vh] w-full rounded-md border border-slate-200 bg-slate-50/40 overflow-hidden">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onConnectEnd={(_, state) => {
                    // Dropped on empty canvas (no target node) -> add a step off the source.
                    if (state.fromNode && !state.toNode) handleDragOut(state.fromNode.id);
                }}
                onReconnect={(oldEdge, conn) => {
                    // Dragged an arrow's end onto a different step -> retarget it.
                    const d = oldEdge.data as { sourceId?: string; branchId?: string; isElse?: boolean } | undefined;
                    if (!d?.sourceId || !conn.target) return;
                    const src = seqById.get(d.sourceId);
                    if (!src) return;
                    const newTarget = conn.target === STOP_ID ? null : conn.target;
                    if (d.isElse) {
                        // Dragging the dashed "else" arrow makes the fallback explicit.
                        setElse(d.sourceId, newTarget);
                        return;
                    }
                    if (!d.branchId) return;
                    const branches = (src.conditions?.branches ?? []).map((b) =>
                        b.branch_id === d.branchId ? { ...b, target_sequence_id: newTarget } : b,
                    );
                    saveBranches(d.sourceId, branches);
                }}
                nodeTypes={nodeTypes}
                onEdgeClick={(_, edge) => {
                    const d = edge.data as { sourceId?: string; branchId?: string; isElse?: boolean } | undefined;
                    if (!d?.sourceId) return;
                    if (d.isElse) setSelectedElse(d.sourceId);
                    else if (d.branchId) setSelectedEdge({ sourceId: d.sourceId, branchId: d.branchId });
                }}
                onNodeClick={(_, node) => {
                    if (node.id !== STOP_ID) setEditStepId(node.id);
                }}
                fitView
                proOptions={{ hideAttribution: true }}
            >
                <Background color="#e2e8f0" gap={18} />
                <Controls showInteractive={false} />

                <Panel position="top-left">
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={addStep}
                            disabled={adding}
                            className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md bg-sky-600 text-[12px] font-medium text-white shadow-sm hover:bg-sky-700 transition-colors disabled:opacity-60"
                        >
                            {adding ? <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> : <PlusIcon className="w-3.5 h-3.5" />}
                            Add step
                        </button>
                        <button
                            type="button"
                            onClick={() => setNodes((ns) => layoutGraph(ns, edges))}
                            className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white text-[12px] font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900 transition-colors"
                        >
                            Tidy up
                        </button>
                    </div>
                </Panel>

                <Panel position="bottom-center">
                    <div className="rounded-md bg-white/95 px-3 py-1.5 text-[11px] text-slate-500 shadow-sm flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="inline-flex items-center gap-1">
                            <span className="inline-block h-0 w-4 border-t-2 border-dashed border-slate-300" /> else — click to send elsewhere or end
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <span className="inline-block h-0 w-4 border-t-2 border-sky-500" /> branch — first match wins, only one runs
                        </span>
                        <span className="text-slate-400">drag a step's bottom dot onto empty space or another step</span>
                    </div>
                </Panel>
            </ReactFlow>

            {selectedBranch && (
                <BranchEditor
                    source={selectedBranch.source}
                    branch={selectedBranch.branch}
                    steps={sequences}
                    onClose={() => setSelectedEdge(null)}
                    onSave={(updated) => {
                        const branches = (selectedBranch.source.conditions?.branches ?? []).map((b) =>
                            b.branch_id === updated.branch_id ? updated : b,
                        );
                        saveBranches(selectedBranch.source.id, branches);
                        setSelectedEdge(null);
                    }}
                    onDelete={() => {
                        const branches = (selectedBranch.source.conditions?.branches ?? []).filter(
                            (b) => b.branch_id !== selectedBranch.branch.branch_id,
                        );
                        saveBranches(selectedBranch.source.id, branches);
                        setSelectedEdge(null);
                    }}
                />
            )}

            {selectedElse &&
                (() => {
                    const src = seqById.get(selectedElse);
                    if (!src) return null;
                    const sIdx = sequences.findIndex((s) => s.id === src.id);
                    const branches = src.conditions?.branches ?? [];
                    const catchAll = branches.find((b) => (b.conditions?.length ?? 0) === 0);
                    const hasConditional = branches.some((b) => (b.conditions?.length ?? 0) > 0);
                    const current = catchAll ? catchAll.target_sequence_id ?? STOP_ID : "default";
                    return (
                        <ElseEditor
                            sourceId={src.id}
                            sourceIndex={sIdx}
                            hasConditional={hasConditional}
                            current={current}
                            steps={sequences}
                            onClose={() => setSelectedElse(null)}
                            onPick={(target) => {
                                setElse(src.id, target);
                                setSelectedElse(null);
                            }}
                        />
                    );
                })()}

            {editStep && (
                <div className="absolute inset-y-0 right-0 z-10 w-full max-w-[760px] xl:max-w-[880px] overflow-y-auto overflow-x-hidden border-l border-slate-200 bg-white shadow-[0_0_40px_-12px_rgba(15,23,42,0.25)]">
                    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2">
                        <span className="text-[12.5px] font-medium text-slate-700">Edit step</span>
                        <button
                            type="button"
                            onClick={() => setEditStepId(null)}
                            className="size-7 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100"
                        >
                            <XIcon className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="p-3">
                        <SequenceView campaignId={campaignId} sequence={editStep} index={editIndex} />
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Branch editor (plain-English condition editor for a selected arrow) ──────
function BranchEditor({
    source,
    branch,
    steps,
    onClose,
    onSave,
    onDelete,
}: {
    source: Sequence;
    branch: SequenceBranch;
    steps: Sequence[];
    onClose: () => void;
    onSave: (b: SequenceBranch) => void;
    onDelete: () => void;
}) {
    const c0 = branch.conditions?.[0] ?? { field: "opened", operator: "within_days", value: 3 };
    const [field, setField] = React.useState<BranchField>(c0.field);
    const [operator, setOperator] = React.useState<BranchOperator>(c0.operator);
    const [days, setDays] = React.useState<number>(c0.value ?? (c0.field === "random" ? 50 : 3));
    const sel =
        "h-7 rounded-md border border-slate-200 bg-white px-2 text-[12px] text-slate-800 focus:border-sky-400 focus:outline-none";
    const sourceIdx = steps.findIndex((s) => s.id === source.id);
    const targetIdx = steps.findIndex((s) => s.id === branch.target_sequence_id);
    const targetLabel =
        branch.target_sequence_id === null
            ? "Stop the sequence"
            : targetIdx >= 0
                ? `Step ${targetIdx + 1}${steps[targetIdx].name ? ` · ${steps[targetIdx].name}` : ""}`
                : "—";

    return (
        <div className="absolute right-3 top-12 z-20 w-[300px] rounded-md border border-slate-200 bg-white p-3 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.18)]">
            <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">
                    After step {sourceIdx + 1}
                </span>
                <button
                    type="button"
                    onClick={onClose}
                    className="size-6 inline-flex items-center justify-center rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100"
                >
                    <XIcon className="w-3.5 h-3.5" />
                </button>
            </div>
            <div className="space-y-2 text-[12px] text-slate-600">
                <div className="flex flex-wrap items-center gap-1.5">
                    <span>if the contact</span>
                    <select className={sel} value={field} onChange={(e) => setField(e.target.value as BranchField)}>
                        <option value="opened">opened the email</option>
                        <option value="clicked">clicked a link</option>
                        <option value="replied">replied</option>
                        <option value="random">is in a random split</option>
                    </select>
                </div>
                {field === "random" ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                        <input
                            type="number"
                            min={1}
                            max={99}
                            value={days}
                            onChange={(e) => setDays(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
                            className={`${sel} w-16 text-center`}
                        />
                        <span>% of contacts (chosen at random)</span>
                    </div>
                ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                        <select className={sel} value={operator} onChange={(e) => setOperator(e.target.value as BranchOperator)}>
                            <option value="within_days">within</option>
                            <option value="always">ever (any time)</option>
                        </select>
                        {operator === "within_days" && (
                            <>
                                <input
                                    type="number"
                                    min={1}
                                    max={60}
                                    value={days}
                                    onChange={(e) => setDays(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
                                    className={`${sel} w-16 text-center`}
                                />
                                <span>days</span>
                            </>
                        )}
                    </div>
                )}
                <div className="flex items-center gap-1.5">
                    <span>then go to</span>
                    <span className="font-medium text-slate-800">{targetLabel}</span>
                </div>
                <p className="text-[10.5px] text-slate-400">
                    Drag the arrow&apos;s end onto another step to change where this goes.
                </p>
            </div>
            <div className="mt-3 flex items-center gap-2">
                <button
                    type="button"
                    onClick={onDelete}
                    className="size-7 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    title="Delete branch"
                >
                    <Trash2Icon className="w-3.5 h-3.5" />
                </button>
                <button
                    type="button"
                    onClick={() =>
                        onSave({
                            branch_id: branch.branch_id,
                            target_sequence_id: branch.target_sequence_id,
                            conditions: [
                                field === "random"
                                    ? { field: "random", operator: "chance", value: days }
                                    : operator === "within_days"
                                        ? { field, operator, value: days }
                                        : { field, operator },
                            ],
                        })
                    }
                    className="ml-auto h-7 px-3 rounded-md bg-sky-600 text-[12px] font-medium text-white hover:bg-sky-700"
                >
                    Save
                </button>
            </div>
        </div>
    );
}

// ── Else editor (the fallback path when no branch matches) ───────────────────
// Picks where the contact goes when none of a step's branches fire: continue to
// the next step (default), end the sequence, or jump to a specific step. Setting
// it to "end" or another step is what turns a step branch-only.
function ElseEditor({
    sourceId,
    sourceIndex,
    hasConditional,
    current,
    steps,
    onClose,
    onPick,
}: {
    sourceId: string;
    sourceIndex: number;
    hasConditional: boolean;
    current: string; // "default" | STOP_ID | stepId
    steps: Sequence[];
    onClose: () => void;
    onPick: (target: string | null | "default") => void;
}) {
    const sel =
        "h-7 w-full rounded-md border border-slate-200 bg-white px-2 text-[12px] text-slate-800 focus:border-sky-400 focus:outline-none";
    return (
        <div className="absolute right-3 top-12 z-20 w-[300px] rounded-md border border-slate-200 bg-white p-3 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.18)]">
            <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">
                    After step {sourceIndex + 1} · else
                </span>
                <button
                    type="button"
                    onClick={onClose}
                    className="size-6 inline-flex items-center justify-center rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100"
                >
                    <XIcon className="w-3.5 h-3.5" />
                </button>
            </div>
            <p className="mb-2 text-[12px] text-slate-600">
                {hasConditional
                    ? "When none of the branches above match, the contact"
                    : "After this step, the contact"}
            </p>
            <select
                className={sel}
                value={current}
                onChange={(e) => {
                    const v = e.target.value;
                    if (v === "default") onPick("default");
                    else if (v === STOP_ID) onPick(null);
                    else onPick(v);
                }}
            >
                <option value="default">continues to the next step</option>
                <option value={STOP_ID}>stops here (end)</option>
                {steps.map((s, i) =>
                    s.id === sourceId ? null : (
                        <option key={s.id} value={s.id}>
                            goes to Step {i + 1}
                            {s.name ? ` · ${s.name}` : ""}
                        </option>
                    ),
                )}
            </select>
            <p className="mt-2 text-[10.5px] text-slate-400">
                Set this to “stops here” (or another step) to make this step branch-only. You can also drag the dashed
                arrow’s end onto another step.
            </p>
        </div>
    );
}
