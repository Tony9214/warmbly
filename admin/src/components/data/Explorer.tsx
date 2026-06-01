// Two-pane data-explorer layout: a sticky left filter rail + a results pane.
// Pair with <DataTable> on the right. Filter primitives below keep every
// browser's controls visually identical.

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function Explorer({ filters, children }: { filters: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-5">
            <aside className="lg:w-60 lg:shrink-0 lg:sticky lg:top-4">
                <div className="space-y-4 rounded-lg border border-border bg-card p-3">{filters}</div>
            </aside>
            <div className="min-w-0 flex-1">{children}</div>
        </div>
    );
}

export function FilterGroup({ label, children }: { label?: string; children: React.ReactNode }) {
    return (
        <div>
            {label && (
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {label}
                </div>
            )}
            <div className="space-y-1.5">{children}</div>
        </div>
    );
}

export function SearchFilter({
    value,
    onChange,
    placeholder = "Search…",
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
}) {
    return (
        <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="h-9 pl-8"
            />
        </div>
    );
}

export function SegmentedFilter<T extends string>({
    value,
    onChange,
    options,
}: {
    value: T;
    onChange: (v: T) => void;
    options: { value: T; label: string }[];
}) {
    return (
        <div className="inline-flex w-full rounded-md border border-border bg-card p-0.5 text-xs">
            {options.map((o) => (
                <button
                    key={o.value}
                    type="button"
                    onClick={() => onChange(o.value)}
                    className={cn(
                        "flex-1 rounded px-2 py-1 transition-colors",
                        value === o.value
                            ? "bg-[var(--admin-accent)] text-white"
                            : "text-muted-foreground hover:text-foreground",
                    )}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

export function ToggleFilter({
    checked,
    onChange,
    label,
}: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
}) {
    return (
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="accent-[var(--admin-accent)]"
            />
            {label}
        </label>
    );
}
