// Serious, server-driven data table for the admin browsers.
//
//   - sortable column headers (server-side via onSortChange)
//   - cursor pagination (prev/next), driven by the parent's useCursorPager
//   - column show/hide + density, persisted per `storageKey`
//   - CSV export of the current page
//   - loading skeleton, ErrorState (full error + retry), and empty state
//
// The parent owns data fetching, filters, sort state, and the pager; this
// component is presentation + the table-level controls.

import { useEffect, useMemo, useRef, useState } from "react";
import {
    ArrowDown,
    ArrowUp,
    ChevronLeft,
    ChevronRight,
    ChevronsUpDown,
    Columns3,
    Download,
    Rows3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ErrorState";
import { exportCsv } from "@/lib/exportCsv";
import { cn } from "@/lib/utils";

export interface Column<T> {
    id: string;
    header: string;
    sortable?: boolean;
    sortKey?: string;
    align?: "left" | "right" | "center";
    cell: (row: T) => React.ReactNode;
    csv?: (row: T) => string | number;
    defaultHidden?: boolean;
    className?: string;
}

export interface Pager {
    canPrev: boolean;
    canNext: boolean;
    onPrev: () => void;
    onNext: () => void;
    page: number;
    shown: number;
    total?: number | null;
}

interface Props<T> {
    columns: Column<T>[];
    rows: T[];
    getRowId: (row: T) => string;
    loading?: boolean;
    error?: unknown;
    onRetry?: () => void;
    onRowClick?: (row: T) => void;
    sort?: { by: string; desc: boolean };
    onSortChange?: (s: { by: string; desc: boolean }) => void;
    pager?: Pager;
    toolbar?: React.ReactNode;
    storageKey?: string;
    emptyTitle?: string;
    emptyHint?: string;
    csvName?: string;
    errorTitle?: string;
}

function load(key: string | undefined, suffix: string): string | null {
    if (!key) return null;
    try {
        return localStorage.getItem(`${key}:${suffix}`);
    } catch {
        return null;
    }
}
function save(key: string | undefined, suffix: string, value: string) {
    if (!key) return;
    try {
        localStorage.setItem(`${key}:${suffix}`, value);
    } catch {
        /* ignore */
    }
}

export function DataTable<T>({
    columns,
    rows,
    getRowId,
    loading,
    error,
    onRetry,
    onRowClick,
    sort,
    onSortChange,
    pager,
    toolbar,
    storageKey,
    emptyTitle = "Nothing here",
    emptyHint = "No records match these filters.",
    csvName = "export",
    errorTitle = "Failed to load",
}: Props<T>) {
    const [hidden, setHidden] = useState<Set<string>>(() => {
        const stored = load(storageKey, "cols");
        if (stored) return new Set(stored.split(",").filter(Boolean));
        return new Set(columns.filter((c) => c.defaultHidden).map((c) => c.id));
    });
    const [compact, setCompact] = useState(() => load(storageKey, "density") === "compact");
    const [colMenu, setColMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!colMenu) return;
        const onDown = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setColMenu(false);
        };
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, [colMenu]);

    const visible = useMemo(() => columns.filter((c) => !hidden.has(c.id)), [columns, hidden]);

    function toggleCol(id: string) {
        setHidden((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            save(storageKey, "cols", [...next].join(","));
            return next;
        });
    }

    function setDensity(c: boolean) {
        setCompact(c);
        save(storageKey, "density", c ? "compact" : "comfortable");
    }

    function headerClick(c: Column<T>) {
        if (!c.sortable || !onSortChange) return;
        const key = c.sortKey ?? c.id;
        if (sort?.by === key) onSortChange({ by: key, desc: !sort.desc });
        else onSortChange({ by: key, desc: true });
    }

    function doExport() {
        const cols = visible.filter((c) => c.csv);
        exportCsv(
            csvName,
            cols.map((c) => c.header),
            rows.map((r) => cols.map((c) => c.csv!(r))),
        );
    }

    const pad = compact ? "px-3 py-1" : "px-3 py-2";
    const alignCls = (a?: string) => (a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left");

    return (
        <div>
            {/* Toolbar */}
            <div className="mb-3 flex items-center gap-2">
                <div className="flex-1">{toolbar}</div>

                <div className="relative" ref={menuRef}>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setColMenu((v) => !v)}>
                        <Columns3 className="size-3.5" />
                        Columns
                    </Button>
                    {colMenu && (
                        <div className="absolute right-0 z-20 mt-1 w-48 rounded-md border border-border bg-popover p-1 shadow-md">
                            {columns.map((c) => (
                                <label
                                    key={c.id}
                                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] hover:bg-muted/60"
                                >
                                    <input
                                        type="checkbox"
                                        checked={!hidden.has(c.id)}
                                        onChange={() => toggleCol(c.id)}
                                        className="accent-[var(--admin-accent)]"
                                    />
                                    {c.header}
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => setDensity(!compact)}
                    title={compact ? "Comfortable rows" : "Compact rows"}
                >
                    <Rows3 className="size-3.5" />
                    {compact ? "Compact" : "Comfortable"}
                </Button>

                <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={doExport} disabled={rows.length === 0}>
                    <Download className="size-3.5" />
                    CSV
                </Button>
            </div>

            {error ? (
                <ErrorState error={error} title={errorTitle} onRetry={onRetry} />
            ) : (
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 z-10 bg-muted/60 text-xs uppercase text-muted-foreground">
                                <tr>
                                    {visible.map((c) => {
                                        const key = c.sortKey ?? c.id;
                                        const active = sort?.by === key;
                                        return (
                                            <th
                                                key={c.id}
                                                className={cn(
                                                    "px-3 py-2 font-medium",
                                                    alignCls(c.align),
                                                    c.sortable && "cursor-pointer select-none hover:text-foreground",
                                                    c.className,
                                                )}
                                                onClick={() => headerClick(c)}
                                            >
                                                <span
                                                    className={cn(
                                                        "inline-flex items-center gap-1",
                                                        c.align === "right" && "flex-row-reverse",
                                                    )}
                                                >
                                                    {c.header}
                                                    {c.sortable &&
                                                        (active ? (
                                                            sort!.desc ? (
                                                                <ArrowDown className="size-3 text-[var(--admin-accent-strong)]" />
                                                            ) : (
                                                                <ArrowUp className="size-3 text-[var(--admin-accent-strong)]" />
                                                            )
                                                        ) : (
                                                            <ChevronsUpDown className="size-3 opacity-40" />
                                                        ))}
                                                </span>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {loading &&
                                    Array.from({ length: 8 }).map((_, i) => (
                                        <tr key={i} className="border-t border-border">
                                            {visible.map((c) => (
                                                <td key={c.id} className={pad}>
                                                    <Skeleton className="h-4 w-full" />
                                                </td>
                                            ))}
                                        </tr>
                                    ))}

                                {!loading &&
                                    rows.map((row) => (
                                        <tr
                                            key={getRowId(row)}
                                            onClick={onRowClick ? () => onRowClick(row) : undefined}
                                            className={cn(
                                                "border-t border-border",
                                                onRowClick && "cursor-pointer hover:bg-muted/40",
                                            )}
                                        >
                                            {visible.map((c) => (
                                                <td key={c.id} className={cn(pad, alignCls(c.align), c.className)}>
                                                    {c.cell(row)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}

                                {!loading && rows.length === 0 && (
                                    <tr>
                                        <td colSpan={visible.length} className="px-3 py-12 text-center">
                                            <div className="text-sm font-medium text-foreground">{emptyTitle}</div>
                                            <div className="mt-0.5 text-xs text-muted-foreground">{emptyHint}</div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Pager */}
            {pager && !error && (
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                        {pager.total != null
                            ? `${pager.shown} shown · ${pager.total.toLocaleString()} total`
                            : `${pager.shown} shown`}
                    </span>
                    <div className="flex items-center gap-1">
                        <span className="mr-1">Page {pager.page}</span>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 px-2"
                            disabled={!pager.canPrev || loading}
                            onClick={pager.onPrev}
                        >
                            <ChevronLeft className="size-3.5" />
                            Prev
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 px-2"
                            disabled={!pager.canNext || loading}
                            onClick={pager.onNext}
                        >
                            Next
                            <ChevronRight className="size-3.5" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
