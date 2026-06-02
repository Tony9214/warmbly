// Sales pipeline for inquiries submitted from the marketing site — left filter
// rail + server-driven sortable, cursor-paged table (mirrors OrganizationsPage).
// Status flow: pending → contacted → converted | declined, editable inline.

import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import {
    Explorer,
    FilterGroup,
    SearchFilter,
    SegmentedFilter,
    SelectFilter,
    ToggleFilter,
    DateRangeFilter,
    NumberRangeFilter,
} from "@/components/data/Explorer";
import { DataTable, type Column } from "@/components/data/DataTable";
import { useCursorPager } from "@/lib/useCursorPager";
import {
    emptyRange,
    rangeActive,
    rangeWithin,
    rangeAfter,
    rangeBefore,
    type DateRange,
} from "@/lib/dateRange";
import {
    listEnterpriseInquiries,
    updateEnterpriseInquiry,
} from "@/lib/api/client/admin/enterprise";
import type {
    AdminEnterpriseInquiry,
    AdminEnterpriseInquirySearch,
    EnterpriseInquiryStatus,
} from "@/lib/api/models/admin";

const STATUS_TONE: Record<EnterpriseInquiryStatus, string> = {
    pending: "border-amber-300 text-amber-700 bg-amber-50",
    contacted: "border-blue-300 text-blue-700 bg-blue-50",
    converted: "border-emerald-300 text-emerald-700 bg-emerald-50",
    declined: "border-zinc-300 text-zinc-600 bg-zinc-50",
};

const STATUSES: EnterpriseInquiryStatus[] = ["pending", "contacted", "converted", "declined"];

type StatusFilter = EnterpriseInquiryStatus | "all";

export default function EnterprisePage() {
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState<StatusFilter>("pending");
    const [assignment, setAssignment] = useState("");
    const [linkage, setLinkage] = useState("");
    const [hasNotes, setHasNotes] = useState(false);
    const [hasPhone, setHasPhone] = useState(false);
    const [processed, setProcessed] = useState(false);
    const [tsMin, setTsMin] = useState<number | undefined>();
    const [tsMax, setTsMax] = useState<number | undefined>();
    const [volMin, setVolMin] = useState<number | undefined>();
    const [volMax, setVolMax] = useState<number | undefined>();
    const [received, setReceived] = useState<DateRange>(emptyRange);
    const [updated, setUpdated] = useState<DateRange>(emptyRange);

    const [sort, setSort] = useState<{ by: string; desc: boolean }>({ by: "", desc: true });
    const pager = useCursorPager();
    const { reset } = pager;

    const filterKey = JSON.stringify({
        query, status, assignment, linkage, hasNotes, hasPhone, processed,
        tsMin, tsMax, volMin, volMax, received, updated, sort,
    });

    useEffect(() => {
        reset();
    }, [filterKey, reset]);

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["admin", "enterprise", "inquiries", filterKey, pager.cursor],
        queryFn: () =>
            listEnterpriseInquiries({
                q: query.trim() || undefined,
                status: status === "all" ? "" : status,
                assignment: (assignment || undefined) as AdminEnterpriseInquirySearch["assignment"],
                linkage: (linkage || undefined) as AdminEnterpriseInquirySearch["linkage"],
                has_notes: hasNotes || undefined,
                has_phone: hasPhone || undefined,
                processed: processed || undefined,
                team_size_min: tsMin,
                team_size_max: tsMax,
                estimated_volume_min: volMin,
                estimated_volume_max: volMax,
                created_within: rangeWithin(received),
                created_after: rangeAfter(received),
                created_before: rangeBefore(received),
                updated_after: rangeAfter(updated),
                updated_before: rangeBefore(updated),
                limit: 50,
                cursor: pager.cursor,
                sort_by: sort.by ? (sort.by as AdminEnterpriseInquirySearch["sort_by"]) : undefined,
                sort_desc: sort.by ? sort.desc : undefined,
            }),
        staleTime: 30_000,
        placeholderData: keepPreviousData,
    });

    const rows = data?.data ?? [];

    const bools = [hasNotes, hasPhone, processed];
    const ranges = [[tsMin, tsMax], [volMin, volMax]];
    const activeCount =
        (query ? 1 : 0) +
        (status !== "pending" ? 1 : 0) +
        (assignment ? 1 : 0) +
        (linkage ? 1 : 0) +
        bools.filter(Boolean).length +
        ranges.filter(([a, b]) => a !== undefined || b !== undefined).length +
        [received, updated].filter(rangeActive).length +
        (sort.by ? 1 : 0);

    function resetAll() {
        setQuery("");
        setStatus("pending");
        setAssignment("");
        setLinkage("");
        setHasNotes(false);
        setHasPhone(false);
        setProcessed(false);
        setTsMin(undefined);
        setTsMax(undefined);
        setVolMin(undefined);
        setVolMax(undefined);
        setReceived(emptyRange);
        setUpdated(emptyRange);
        setSort({ by: "", desc: true });
    }

    const columns: Column<AdminEnterpriseInquiry>[] = [
        {
            id: "company",
            header: "Company",
            sortable: true,
            sortKey: "company_name",
            cell: (i) => <span className="font-medium">{i.company_name}</span>,
            csv: (i) => i.company_name,
        },
        {
            id: "contact",
            header: "Contact",
            sortable: true,
            sortKey: "contact_email",
            cell: (i) => (
                <div className="text-xs">
                    <div>{i.contact_name}</div>
                    <div className="text-muted-foreground">{i.contact_email}</div>
                </div>
            ),
            csv: (i) => i.contact_email,
        },
        {
            id: "volume",
            header: "Volume",
            align: "right",
            sortable: true,
            sortKey: "estimated_volume",
            cell: (i) => (
                <span className="tabular-nums text-xs">{i.estimated_volume != null ? i.estimated_volume.toLocaleString() : "—"}</span>
            ),
            csv: (i) => i.estimated_volume ?? "",
        },
        {
            id: "team",
            header: "Team",
            align: "right",
            sortable: true,
            sortKey: "team_size",
            cell: (i) => <span className="tabular-nums text-xs">{i.team_size ?? "—"}</span>,
            csv: (i) => i.team_size ?? "",
        },
        {
            id: "linked",
            header: "Linked user",
            cell: (i) => (
                <span className="text-xs text-muted-foreground">{i.user?.email ?? "—"}</span>
            ),
            csv: (i) => i.user?.email ?? "",
        },
        {
            id: "assigned",
            header: "Assigned",
            cell: (i) =>
                i.assigned_admin ? (
                    <span className="text-xs">
                        {`${i.assigned_admin.first_name} ${i.assigned_admin.last_name}`.trim() || i.assigned_admin.email}
                    </span>
                ) : (
                    <span className="text-xs text-muted-foreground">Unassigned</span>
                ),
            csv: (i) => i.assigned_admin?.email ?? "",
        },
        {
            id: "status",
            header: "Status",
            sortable: true,
            sortKey: "status",
            cell: (i) => <StatusCell inquiry={i} />,
            csv: (i) => i.status,
        },
        {
            id: "received",
            header: "Received",
            sortable: true,
            sortKey: "created_at",
            cell: (i) => <span className="text-xs text-muted-foreground">{new Date(i.created_at).toLocaleDateString()}</span>,
            csv: (i) => i.created_at,
        },
        {
            id: "updated",
            header: "Updated",
            sortable: true,
            sortKey: "updated_at",
            defaultHidden: true,
            cell: (i) => <span className="text-xs text-muted-foreground">{new Date(i.updated_at).toLocaleDateString()}</span>,
            csv: (i) => i.updated_at,
        },
    ];

    return (
        <div>
            <PageHeader
                title="Enterprise inquiries"
                description="Talk-to-us submissions from the marketing site. Filter the pipeline by status, assignment, account linkage, size, and timeline; edit status inline."
            />
            <Explorer
                activeCount={activeCount}
                onReset={resetAll}
                filters={
                    <>
                        <FilterGroup label="Search">
                            <SearchFilter value={query} onChange={setQuery} placeholder="Company, contact, or email…" />
                        </FilterGroup>
                        <FilterGroup label="Status">
                            <SegmentedFilter
                                value={status}
                                onChange={setStatus}
                                options={[
                                    { value: "pending", label: "Pending" },
                                    { value: "contacted", label: "Contacted" },
                                    { value: "converted", label: "Converted" },
                                    { value: "declined", label: "Declined" },
                                    { value: "all", label: "All" },
                                ]}
                            />
                        </FilterGroup>
                        <FilterGroup label="Assignment">
                            <SelectFilter
                                value={assignment || "any"}
                                onChange={(v) => setAssignment(v === "any" ? "" : v)}
                                options={[
                                    { value: "any", label: "Any" },
                                    { value: "assigned", label: "Assigned" },
                                    { value: "unassigned", label: "Unassigned" },
                                ]}
                                placeholder="Any"
                            />
                        </FilterGroup>
                        <FilterGroup label="Account">
                            <SelectFilter
                                value={linkage || "any"}
                                onChange={(v) => setLinkage(v === "any" ? "" : v)}
                                options={[
                                    { value: "any", label: "Any" },
                                    { value: "linked", label: "Linked user" },
                                    { value: "anonymous", label: "Anonymous" },
                                ]}
                                placeholder="Any"
                            />
                        </FilterGroup>
                        <FilterGroup label="Flags">
                            <div className="flex flex-col gap-2">
                                <ToggleFilter checked={hasNotes} onChange={setHasNotes} label="Has notes" />
                                <ToggleFilter checked={hasPhone} onChange={setHasPhone} label="Has phone" />
                                <ToggleFilter checked={processed} onChange={setProcessed} label="Processed" />
                            </div>
                        </FilterGroup>
                        <FilterGroup label="Team size">
                            <NumberRangeFilter min={tsMin} max={tsMax} onMinChange={setTsMin} onMaxChange={setTsMax} />
                        </FilterGroup>
                        <FilterGroup label="Estimated volume">
                            <NumberRangeFilter min={volMin} max={volMax} onMinChange={setVolMin} onMaxChange={setVolMax} />
                        </FilterGroup>
                        <FilterGroup label="Received">
                            <DateRangeFilter value={received} onChange={setReceived} />
                        </FilterGroup>
                        <FilterGroup label="Last updated">
                            <DateRangeFilter value={updated} onChange={setUpdated} mode="custom" />
                        </FilterGroup>
                    </>
                }
            >
                <DataTable
                    columns={columns}
                    rows={rows}
                    getRowId={(i) => i.id}
                    loading={isLoading}
                    error={error}
                    onRetry={() => refetch()}
                    errorTitle="Failed to load inquiries"
                    sort={sort.by ? sort : undefined}
                    onSortChange={setSort}
                    storageKey="admin.enterprise"
                    csvName="warmbly-enterprise-inquiries"
                    noun="inquiries"
                    emptyTitle="No inquiries"
                    emptyHint="No inquiries match these filters."
                    pager={{
                        canPrev: pager.canPrev,
                        canNext: !!data?.pagination?.has_more,
                        onPrev: pager.prev,
                        onNext: () => pager.next(data?.pagination?.next_cursor),
                        page: pager.page,
                        shown: rows.length,
                        total: data?.pagination?.total ?? null,
                    }}
                />
            </Explorer>
        </div>
    );
}

function StatusCell({ inquiry }: { inquiry: AdminEnterpriseInquiry }) {
    const qc = useQueryClient();
    const mutation = useMutation({
        mutationFn: (next: EnterpriseInquiryStatus) =>
            updateEnterpriseInquiry(inquiry.id, { status: next }),
        onSuccess: () => {
            toast.success("Inquiry updated");
            qc.invalidateQueries({ queryKey: ["admin", "enterprise"] });
        },
        onError: (err: Error) => toast.error(err.message || "Update failed"),
    });

    return (
        <select
            value={inquiry.status}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => mutation.mutate(e.target.value as EnterpriseInquiryStatus)}
            disabled={mutation.isPending}
            className={`text-[10px] px-1.5 py-1 rounded border ${STATUS_TONE[inquiry.status]} font-medium`}
        >
            {STATUSES.map((s) => (
                <option key={s} value={s}>
                    {s}
                </option>
            ))}
        </select>
    );
}
