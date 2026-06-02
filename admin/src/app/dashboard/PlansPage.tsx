// Plan catalog admin — left filter rail + server-driven sortable, cursor-paged
// table (mirrors OrganizationsPage). Click-to-edit dialog for the limit + price
// fields is preserved. Stripe IDs are surfaced but read-only — those must be
// edited in Stripe and synced back, never the other way around.

import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff, Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
import { searchPlans, updatePlan } from "@/lib/api/client/admin/plans";
import type { AdminPlanSearch, Plan, UpdatePlanRequest } from "@/lib/api/models/admin";

const planInterval = (p: Plan): string =>
    typeof p.duration === "string" ? p.duration : p.duration?.title ?? "";

export default function PlansPage() {
    const [query, setQuery] = useState("");
    const [visibility, setVisibility] = useState<"" | "public" | "private">("");
    const [duration, setDuration] = useState("");
    const [aiGen, setAiGen] = useState(false);
    const [hasStripe, setHasStripe] = useState(false);
    const [hasSubs, setHasSubs] = useState(false);
    const [priceMin, setPriceMin] = useState<number | undefined>();
    const [priceMax, setPriceMax] = useState<number | undefined>();
    const [dailyMin, setDailyMin] = useState<number | undefined>();
    const [dailyMax, setDailyMax] = useState<number | undefined>();
    const [accMin, setAccMin] = useState<number | undefined>();
    const [accMax, setAccMax] = useState<number | undefined>();
    const [created, setCreated] = useState<DateRange>(emptyRange);
    const [sort, setSort] = useState<{ by: string; desc: boolean }>({ by: "", desc: false });
    const pager = useCursorPager();
    const { reset } = pager;

    const [editing, setEditing] = useState<Plan | null>(null);

    const filterKey = JSON.stringify({
        query, visibility, duration, aiGen, hasStripe, hasSubs,
        priceMin, priceMax, dailyMin, dailyMax, accMin, accMax, created, sort,
    });

    useEffect(() => {
        reset();
    }, [filterKey, reset]);

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["admin", "plans", filterKey, pager.cursor],
        queryFn: () =>
            searchPlans({
                q: query.trim() || undefined,
                visibility: visibility || undefined,
                duration: duration || undefined,
                ai_generation: aiGen || undefined,
                has_stripe: hasStripe || undefined,
                has_subscribers: hasSubs || undefined,
                price_min: priceMin,
                price_max: priceMax,
                daily_emails_min: dailyMin,
                daily_emails_max: dailyMax,
                account_limit_min: accMin,
                account_limit_max: accMax,
                created_within: rangeWithin(created),
                created_after: rangeAfter(created),
                created_before: rangeBefore(created),
                limit: 50,
                cursor: pager.cursor,
                sort_by: sort.by ? (sort.by as AdminPlanSearch["sort_by"]) : undefined,
                sort_desc: sort.by ? sort.desc : undefined,
            }),
        staleTime: 30_000,
        placeholderData: keepPreviousData,
    });

    const rows = data?.data ?? [];

    const bools = [aiGen, hasStripe, hasSubs];
    const ranges = [[priceMin, priceMax], [dailyMin, dailyMax], [accMin, accMax]];
    const activeCount =
        (query ? 1 : 0) +
        (visibility ? 1 : 0) +
        (duration ? 1 : 0) +
        bools.filter(Boolean).length +
        ranges.filter(([a, b]) => a !== undefined || b !== undefined).length +
        [created].filter(rangeActive).length +
        (sort.by ? 1 : 0);

    function resetAll() {
        setQuery("");
        setVisibility("");
        setDuration("");
        setAiGen(false);
        setHasStripe(false);
        setHasSubs(false);
        setPriceMin(undefined);
        setPriceMax(undefined);
        setDailyMin(undefined);
        setDailyMax(undefined);
        setAccMin(undefined);
        setAccMax(undefined);
        setCreated(emptyRange);
        setSort({ by: "", desc: false });
    }

    const columns: Column<Plan>[] = [
        {
            id: "name",
            header: "Name",
            sortable: true,
            sortKey: "name",
            cell: (p) => (
                <div>
                    <div className="font-medium">{p.name ?? "(unnamed)"}</div>
                    {p.stripe_price_id && (
                        <div className="font-mono text-[10px] text-muted-foreground">{p.stripe_price_id}</div>
                    )}
                </div>
            ),
            csv: (p) => p.name ?? "",
        },
        {
            id: "visibility",
            header: "Visibility",
            cell: (p) =>
                p.public ? (
                    <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50">
                        <Eye className="size-2.5" /> public
                    </Badge>
                ) : (
                    <Badge variant="outline" className="text-[10px] border-purple-300 text-purple-700 bg-purple-50">
                        <EyeOff className="size-2.5" /> private
                    </Badge>
                ),
            csv: (p) => (p.public ? "public" : "private"),
        },
        {
            id: "price",
            header: "Price",
            align: "right",
            sortable: true,
            sortKey: "price",
            cell: (p) => (
                <span className="tabular-nums">
                    ${p.discounted_price.toFixed(2)}
                    {p.price !== p.discounted_price && (
                        <span className="text-muted-foreground line-through ml-1 text-[10px]">${p.price.toFixed(2)}</span>
                    )}
                </span>
            ),
            csv: (p) => p.discounted_price,
        },
        { id: "daily", header: "Daily", align: "right", sortable: true, sortKey: "daily_emails", cell: (p) => <span className="tabular-nums">{p.daily_emails}</span>, csv: (p) => p.daily_emails },
        { id: "accounts", header: "Accounts", align: "right", sortable: true, sortKey: "account_limit", cell: (p) => <span className="tabular-nums">{p.account_limit}</span>, csv: (p) => p.account_limit },
        { id: "mailboxes", header: "Mailboxes", align: "right", cell: (p) => <span className="tabular-nums">{p.max_email_accounts ?? "∞"}</span>, csv: (p) => p.max_email_accounts ?? "" },
        { id: "campaigns", header: "Campaigns", align: "right", cell: (p) => <span className="tabular-nums">{p.max_campaigns ?? "∞"}</span>, csv: (p) => p.max_campaigns ?? "" },
        { id: "contacts", header: "Contacts", align: "right", cell: (p) => <span className="tabular-nums">{p.max_contacts.toLocaleString()}</span>, csv: (p) => p.max_contacts },
        { id: "interval", header: "Interval", cell: (p) => <span className="text-xs text-muted-foreground">{planInterval(p) || "—"}</span>, csv: (p) => planInterval(p) },
        { id: "created", header: "Created", sortable: true, sortKey: "created_at", defaultHidden: true, cell: (p) => <span className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</span>, csv: (p) => p.created_at },
        {
            id: "actions",
            header: "",
            align: "right",
            cell: (p) => (
                <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                        e.stopPropagation();
                        setEditing(p);
                    }}
                    className="text-xs"
                >
                    <Pencil className="size-3" /> Edit
                </Button>
            ),
        },
    ];

    return (
        <div>
            <PageHeader
                title="Plans & Billing"
                description="Catalog of pricing tiers. Filter by visibility, interval, capability, price, and usage; public plans appear on the marketing site, private plans are reserved for enterprise contracts."
            />
            <Explorer
                activeCount={activeCount}
                onReset={resetAll}
                filters={
                    <>
                        <FilterGroup label="Search">
                            <SearchFilter value={query} onChange={setQuery} placeholder="Name or Stripe ID…" />
                        </FilterGroup>
                        <FilterGroup label="Visibility">
                            <SegmentedFilter
                                value={visibility}
                                onChange={setVisibility}
                                options={[
                                    { value: "", label: "Any" },
                                    { value: "public", label: "Public" },
                                    { value: "private", label: "Private" },
                                ]}
                            />
                        </FilterGroup>
                        <FilterGroup label="Interval">
                            <SelectFilter
                                value={duration || "any"}
                                onChange={(v) => setDuration(v === "any" ? "" : v)}
                                options={[
                                    { value: "any", label: "Any interval" },
                                    { value: "month", label: "Monthly" },
                                    { value: "year", label: "Yearly" },
                                ]}
                                placeholder="Any interval"
                            />
                        </FilterGroup>
                        <FilterGroup label="Capability">
                            <div className="flex flex-col gap-2">
                                <ToggleFilter checked={aiGen} onChange={setAiGen} label="AI generation" />
                                <ToggleFilter checked={hasStripe} onChange={setHasStripe} label="Has Stripe price" />
                                <ToggleFilter checked={hasSubs} onChange={setHasSubs} label="Has subscribers" />
                            </div>
                        </FilterGroup>
                        <FilterGroup label="Price">
                            <NumberRangeFilter min={priceMin} max={priceMax} onMinChange={setPriceMin} onMaxChange={setPriceMax} />
                        </FilterGroup>
                        <FilterGroup label="Daily emails">
                            <NumberRangeFilter min={dailyMin} max={dailyMax} onMinChange={setDailyMin} onMaxChange={setDailyMax} />
                        </FilterGroup>
                        <FilterGroup label="Account limit">
                            <NumberRangeFilter min={accMin} max={accMax} onMinChange={setAccMin} onMaxChange={setAccMax} />
                        </FilterGroup>
                        <FilterGroup label="Created">
                            <DateRangeFilter value={created} onChange={setCreated} />
                        </FilterGroup>
                    </>
                }
            >
                <DataTable
                    columns={columns}
                    rows={rows}
                    getRowId={(p) => p.id}
                    loading={isLoading}
                    error={error}
                    onRetry={() => refetch()}
                    errorTitle="Failed to load plans"
                    sort={sort.by ? sort : undefined}
                    onSortChange={setSort}
                    storageKey="admin.plans"
                    csvName="warmbly-plans"
                    noun="plans"
                    emptyTitle="No plans"
                    emptyHint="No plans match these filters."
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

            {editing && (
                <PlanEditDialog plan={editing} open onOpenChange={(v) => !v && setEditing(null)} />
            )}
        </div>
    );
}

interface FormState {
    name: string;
    price: string;
    discounted_price: string;
    max_email_accounts: string;
    max_campaigns: string;
    max_active_campaigns: string;
    max_team_members: string;
    max_contacts: string;
    daily_emails: string;
    daily_campaign_limit: string;
    account_limit: string;
    dedicated_workers: string;
    public: boolean;
}

type FormStringKey = Exclude<keyof FormState, "public">;

function seedForm(plan: Plan): FormState {
    return {
        name: plan.name ?? "",
        price: String(plan.price),
        discounted_price: String(plan.discounted_price),
        max_email_accounts: plan.max_email_accounts != null ? String(plan.max_email_accounts) : "",
        max_campaigns: plan.max_campaigns != null ? String(plan.max_campaigns) : "",
        max_active_campaigns: plan.max_active_campaigns != null ? String(plan.max_active_campaigns) : "",
        max_team_members: plan.max_team_members != null ? String(plan.max_team_members) : "",
        max_contacts: String(plan.max_contacts),
        daily_emails: String(plan.daily_emails),
        daily_campaign_limit: plan.daily_campaign_limit != null ? String(plan.daily_campaign_limit) : "",
        account_limit: String(plan.account_limit),
        dedicated_workers: String(plan.dedicated_workers),
        public: plan.public,
    };
}

function PlanEditDialog({
    plan,
    open,
    onOpenChange,
}: {
    plan: Plan;
    open: boolean;
    onOpenChange: (v: boolean) => void;
}) {
    const qc = useQueryClient();
    const [form, setForm] = useState<FormState>(() => seedForm(plan));

    const mutation = useMutation({
        mutationFn: (body: UpdatePlanRequest) => updatePlan(plan.id, body),
        onSuccess: () => {
            toast.success("Plan updated");
            qc.invalidateQueries({ queryKey: ["admin", "plans"] });
            onOpenChange(false);
        },
        onError: (err: Error) => toast.error(err.message || "Update failed"),
    });

    function submit() {
        const body: UpdatePlanRequest = {};
        const num = (key: FormStringKey): number | undefined => {
            const raw = form[key].trim();
            if (raw === "") return undefined;
            const n = Number(raw);
            if (Number.isNaN(n)) return undefined;
            return n;
        };
        if (form.name !== (plan.name ?? "")) body.name = form.name;
        const price = num("price");
        if (price != null && price !== plan.price) body.price = price;
        const disc = num("discounted_price");
        if (disc != null && disc !== plan.discounted_price) body.discounted_price = disc;
        const mailboxes = num("max_email_accounts");
        if (mailboxes != null) body.max_email_accounts = mailboxes;
        const campaigns = num("max_campaigns");
        if (campaigns != null) body.max_campaigns = campaigns;
        const active = num("max_active_campaigns");
        if (active != null) body.max_active_campaigns = active;
        const members = num("max_team_members");
        if (members != null) body.max_team_members = members;
        const contacts = num("max_contacts");
        if (contacts != null) body.max_contacts = contacts;
        const daily = num("daily_emails");
        if (daily != null) body.daily_emails = daily;
        const dailyCamp = num("daily_campaign_limit");
        if (dailyCamp != null) body.daily_campaign_limit = dailyCamp;
        const acc = num("account_limit");
        if (acc != null) body.account_limit = acc;
        const ded = num("dedicated_workers");
        if (ded != null) body.dedicated_workers = ded;
        if (form.public !== plan.public) body.public = form.public;

        if (Object.keys(body).length === 0) {
            toast.error("Nothing changed");
            return;
        }
        mutation.mutate(body);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit plan</DialogTitle>
                    <DialogDescription>
                        Changes affect every active subscriber on this plan. Stripe
                        IDs are not editable here — sync those through Stripe's
                        dashboard instead.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-3">
                    <Field label="Name" id="name" form={form} setForm={setForm} />
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Price" id="price" form={form} setForm={setForm} />
                        <Field
                            label="Discounted price"
                            id="discounted_price"
                            form={form}
                            setForm={setForm}
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <Field label="Mailboxes" id="max_email_accounts" form={form} setForm={setForm} />
                        <Field label="Campaigns" id="max_campaigns" form={form} setForm={setForm} />
                        <Field label="Active campaigns" id="max_active_campaigns" form={form} setForm={setForm} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <Field label="Team members" id="max_team_members" form={form} setForm={setForm} />
                        <Field label="Contacts" id="max_contacts" form={form} setForm={setForm} />
                        <Field label="Daily emails" id="daily_emails" form={form} setForm={setForm} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <Field label="Daily campaign limit" id="daily_campaign_limit" form={form} setForm={setForm} />
                        <Field label="Account limit" id="account_limit" form={form} setForm={setForm} />
                        <Field label="Dedicated workers" id="dedicated_workers" form={form} setForm={setForm} />
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs">
                        <input
                            type="checkbox"
                            checked={form.public}
                            onChange={(e) => setForm((s) => ({ ...s, public: e.target.checked }))}
                            className="accent-[var(--admin-accent)]"
                        />
                        Public (appears in the marketing-site plan list)
                    </label>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={submit}
                        disabled={mutation.isPending}
                        className="bg-[var(--admin-accent)] hover:bg-[var(--admin-accent-strong)] text-white"
                    >
                        {mutation.isPending ? "Saving…" : "Save"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function Field({
    label,
    id,
    form,
    setForm,
}: {
    label: string;
    id: FormStringKey;
    form: FormState;
    setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
    return (
        <div>
            <Label htmlFor={id} className="text-xs font-medium">
                {label}
            </Label>
            <Input
                id={id}
                value={form[id]}
                onChange={(e) => setForm((s) => ({ ...s, [id]: e.target.value }))}
                className="text-sm"
            />
        </div>
    );
}
