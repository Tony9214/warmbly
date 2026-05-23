// Advanced filter sheet for the unibox.
//
// Mirrors the params that GET /unibox actually supports today:
//   - free text (subject ILIKE)
//   - from
//   - account (one of the user's email_accounts)
//   - unseen only
//   - since / until date range
//   - sort: newest / oldest
//
// Sheet pattern matches ContactFilters (slim right-side panel,
// sticky header + footer, draft state mirrors parent until Apply
// so we don't refetch while the user is mid-build).

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
    Loader2Icon,
    RotateCcwIcon,
    SearchIcon,
    XIcon,
} from "lucide-react";
import { SearchInput, TextInput } from "@/components/ui/field";
import {
    PopoverMenu,
    PopoverMenuContent,
    PopoverMenuItem,
    PopoverMenuLabel,
    PopoverMenuTrigger,
    SelectButton,
} from "@/components/ui/popover-menu";
import { SectionBar } from "@/components/layout/Page";
import { useAppStore } from "@/stores";
import type { UniboxSearchParams } from "@/lib/api/models/app/unibox/UniboxSearch";

interface Props {
    open: boolean;
    setOpen: (o: boolean) => void;
    filters: UniboxSearchParams;
    setFilters: React.Dispatch<React.SetStateAction<UniboxSearchParams>>;
    loading?: boolean;
}

export function UniboxFilterSheet({ open, setOpen, filters, setFilters, loading }: Props) {
    const [draft, setDraft] = React.useState<UniboxSearchParams>(filters);
    const emails = useAppStore((s) => s.emails);

    React.useEffect(() => {
        if (open) setDraft(filters);
    }, [open, filters]);

    const activeCount = countActive(draft);

    const apply = () => {
        setFilters(draft);
        setOpen(false);
    };

    const reset = () => {
        setDraft({ sortBy: "newest" });
    };

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    key="overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    onClick={() => setOpen(false)}
                    className="fixed inset-0 z-[100] flex justify-end bg-slate-900/30 backdrop-blur-[2px]"
                >
                    <motion.aside
                        key="panel"
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", stiffness: 300, damping: 32 }}
                        onClick={(e) => e.stopPropagation()}
                        className="flex flex-col bg-white w-[420px] max-w-[95%] h-full border-l border-slate-200 shadow-[-8px_0_24px_-12px_rgba(15,23,42,0.12)]"
                    >
                        <div className="h-12 px-4 border-b border-slate-200 flex items-center gap-3 shrink-0">
                            <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">
                                Filters
                            </span>
                            <div className="h-4 w-px bg-slate-200" />
                            <span className="text-[12.5px] text-slate-700">
                                {activeCount === 0
                                    ? "No filters applied"
                                    : `${activeCount} ${activeCount === 1 ? "filter" : "filters"} active`}
                            </span>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                aria-label="Close"
                                className="ml-auto size-7 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center justify-center transition-colors"
                            >
                                <XIcon className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        <div className="flex-1 min-h-0 overflow-y-auto">
                            <SectionBar label="Search" />
                            <div className="px-4 py-3 space-y-2">
                                <SearchInput
                                    value={draft.query ?? ""}
                                    onChange={(v) => setDraft((s) => ({ ...s, query: v || undefined }))}
                                    placeholder="Subject, snippet, contents…"
                                />
                            </div>

                            <SectionBar label="Sender" />
                            <div className="px-4 py-3 space-y-2">
                                <TextInput
                                    value={draft.from ?? ""}
                                    onChange={(v) => setDraft((s) => ({ ...s, from: v || undefined }))}
                                    placeholder="name@company.com or substring"
                                    className="w-full"
                                />
                            </div>

                            <SectionBar label="Account" />
                            <div className="px-4 py-3 space-y-2">
                                <PopoverMenu align="start">
                                    <PopoverMenuTrigger asChild>
                                        <SelectButton
                                            label={
                                                draft.accountId
                                                    ? (emails.find((e) => e.id === draft.accountId)?.email ?? "Unknown")
                                                    : "All accounts"
                                            }
                                            className="w-full justify-between"
                                        />
                                    </PopoverMenuTrigger>
                                    <PopoverMenuContent minWidth={260}>
                                        <PopoverMenuLabel>Email accounts</PopoverMenuLabel>
                                        <PopoverMenuItem
                                            onSelect={() => setDraft((s) => ({ ...s, accountId: undefined }))}
                                            selected={!draft.accountId}
                                        >
                                            All accounts
                                        </PopoverMenuItem>
                                        {emails.map((e) => (
                                            <PopoverMenuItem
                                                key={e.id}
                                                onSelect={() =>
                                                    setDraft((s) => ({
                                                        ...s,
                                                        accountId: draft.accountId === e.id ? undefined : e.id,
                                                    }))
                                                }
                                                selected={draft.accountId === e.id}
                                            >
                                                {e.email}
                                            </PopoverMenuItem>
                                        ))}
                                    </PopoverMenuContent>
                                </PopoverMenu>
                            </div>

                            <SectionBar label="Status" />
                            <div className="px-4 py-3">
                                <Toggle3
                                    value={draft.unseen ?? undefined}
                                    onChange={(v) => setDraft((s) => ({ ...s, unseen: v }))}
                                    options={[
                                        { id: undefined, label: "Any" },
                                        { id: true, label: "Unread" },
                                        { id: false, label: "Read" },
                                    ]}
                                />
                            </div>

                            <SectionBar label="Dates" />
                            <div className="px-4 py-3 space-y-2">
                                <DateRow
                                    label="Since"
                                    value={draft.since}
                                    onChange={(v) => setDraft((s) => ({ ...s, since: v }))}
                                />
                                <DateRow
                                    label="Until"
                                    value={draft.until}
                                    onChange={(v) => setDraft((s) => ({ ...s, until: v }))}
                                />
                            </div>

                            <SectionBar label="Sort" />
                            <div className="px-4 py-3 space-y-2">
                                <Toggle3
                                    value={draft.sortBy ?? "newest"}
                                    onChange={(v) =>
                                        setDraft((s) => ({ ...s, sortBy: (v as "newest" | "oldest") ?? "newest" }))
                                    }
                                    options={[
                                        { id: "newest" as const, label: "Newest" },
                                        { id: "oldest" as const, label: "Oldest" },
                                    ]}
                                />
                            </div>
                        </div>

                        <div className="px-4 h-12 border-t border-slate-200 flex items-center gap-1.5 shrink-0">
                            <button
                                type="button"
                                onClick={reset}
                                className="h-7 px-2.5 rounded-md text-[12px] text-slate-500 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center gap-1.5 transition-colors"
                            >
                                <RotateCcwIcon className="w-3 h-3" />
                                Reset
                            </button>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="ml-auto h-7 px-2.5 rounded-md text-[12px] text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={apply}
                                disabled={loading}
                                className="h-7 px-2.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
                            >
                                {loading ? (
                                    <Loader2Icon className="w-3 h-3 animate-spin" />
                                ) : (
                                    <SearchIcon className="w-3 h-3" />
                                )}
                                Apply
                            </button>
                        </div>
                    </motion.aside>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

function Toggle3<T extends string | boolean | undefined>({
    value,
    onChange,
    options,
}: {
    value: T;
    onChange: (v: T) => void;
    options: Array<{ id: T; label: string }>;
}) {
    return (
        <div className="inline-flex items-center rounded-md border border-slate-200 bg-white p-0.5">
            {options.map((o) => (
                <button
                    key={String(o.id)}
                    type="button"
                    onClick={() => onChange(o.id)}
                    className={`h-6 px-2.5 rounded text-[11.5px] font-medium transition-colors ${
                        value === o.id ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
                    }`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

function DateRow({
    label,
    value,
    onChange,
}: {
    label: string;
    value?: Date;
    onChange: (v: Date | undefined) => void;
}) {
    const enabled = value !== undefined;
    const dateStr = value ? toIsoDate(value) : "";
    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={() => onChange(enabled ? undefined : new Date())}
                className={`size-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                    enabled
                        ? "bg-slate-900 border-slate-900 text-white"
                        : "border-slate-300 hover:border-slate-400"
                }`}
                aria-pressed={enabled}
                aria-label={`Toggle ${label}`}
            >
                {enabled && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M5 12l5 5L20 7" />
                    </svg>
                )}
            </button>
            <span className="text-[12px] text-slate-700 w-12 shrink-0">{label}</span>
            <input
                type="date"
                value={dateStr}
                onChange={(e) => {
                    const v = e.target.value;
                    if (!v) onChange(undefined);
                    else onChange(new Date(v));
                }}
                disabled={!enabled}
                className="flex-1 h-7 px-2.5 rounded-md border border-slate-200 bg-white text-[12.5px] text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50 disabled:text-slate-400 tabular-nums"
            />
        </div>
    );
}

function toIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function countActive(f: UniboxSearchParams): number {
    let n = 0;
    if (f.query) n++;
    if (f.from) n++;
    if (f.accountId) n++;
    if (f.unseen !== undefined) n++;
    if (f.since) n++;
    if (f.until) n++;
    return n;
}
