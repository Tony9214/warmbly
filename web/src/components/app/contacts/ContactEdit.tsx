// Contact 360 slide-over.
//
// Density rules:
//   - 32rem wide right-side panel
//   - slate-900 primary action, hairline borders, 12.5px body text
//   - sticky header (avatar + name + email + unsaved pill + close)
//   - tab strip immediately under the header
//   - one scroll container per tab
//   - footer (Discard / Save) is only attached on the Details tab,
//     since the other tabs are read-only or have their own affordances
//
// Tabs:
//   - Overview  → engagement stats + suppression + profile snapshot
//   - Activity  → merged timeline (emails sent, opens, clicks,
//                 replies, deliverability, suppression, notes)
//   - Notes     → CRM notes CRUD
//   - Details   → identity / categories / campaigns / custom fields
//                 (the previous slide-over body)

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckIcon, Loader2Icon, XIcon } from "lucide-react";
import toast from "react-hot-toast";
import useUpdateContact from "@/lib/api/hooks/app/contacts/useUpdateContact";
import useContact from "@/lib/api/hooks/app/contacts/useContact";
import type Contact from "@/lib/api/models/app/contacts/Contact";
import type MiniCampaign from "@/lib/api/models/app/campaigns/MiniCampaign";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import OverviewTab from "./contact-edit/OverviewTab";
import ActivityTab from "./contact-edit/ActivityTab";
import NotesTab from "./contact-edit/NotesTab";
import DetailsTab, { type CustomField } from "./contact-edit/DetailsTab";
import {
    CONTACT_SLIDE_TABS,
    type ContactSlideTab,
} from "./contact-edit/tabs";

export default function ContactEdit({
    contacts,
    active,
    setActive,
}: {
    contacts: Contact[];
    active: string;
    setActive: React.Dispatch<React.SetStateAction<string>>;
}) {
    const contact = React.useMemo(
        () => contacts.find((c) => c.id === active),
        [contacts, active],
    );

    return (
        <AnimatePresence>
            {contact && (
                <ContactEditPanel
                    key={contact.id}
                    contact={contact}
                    onClose={() => setActive("")}
                />
            )}
        </AnimatePresence>
    );
}

function ContactEditPanel({
    contact,
    onClose,
}: {
    contact: Contact;
    onClose: () => void;
}) {
    const update = useUpdateContact(contact.id);

    // Hydrated detail used by Overview. Fetched on open; the Details
    // tab still works off the list-row Contact so it's editable
    // immediately even before /detail resolves.
    const detail = useContact(contact.id);

    const [tab, setTab] = React.useState<ContactSlideTab>("overview");

    // Edit form state — only mutated from the Details tab but kept
    // here so dirty-tracking + sticky save footer stay attached to the
    // panel chrome.
    const [firstName, setFirstName] = React.useState(contact.first_name);
    const [lastName, setLastName] = React.useState(contact.last_name);
    const [email, setEmail] = React.useState(contact.email);
    const [company, setCompany] = React.useState(contact.company);
    const [phone, setPhone] = React.useState(contact.phone);
    const [subscribed, setSubscribed] = React.useState(contact.subscribed);
    const [campaigns, setCampaigns] = React.useState<MiniCampaign[]>(contact.campaigns ?? []);
    const [categoryIds, setCategoryIds] = React.useState<string[]>(
        () => (contact.categories ?? []).map((c) => c.id),
    );
    const [customFields, setCustomFields] = React.useState<CustomField[]>(() =>
        Object.entries(contact.custom_fields ?? {}).map(([n, v]) => ({ name: n, value: v })),
    );

    function reset() {
        setFirstName(contact.first_name);
        setLastName(contact.last_name);
        setEmail(contact.email);
        setCompany(contact.company);
        setPhone(contact.phone);
        setSubscribed(contact.subscribed);
        setCampaigns(contact.campaigns ?? []);
        setCategoryIds((contact.categories ?? []).map((c) => c.id));
        setCustomFields(Object.entries(contact.custom_fields ?? {}).map(([n, v]) => ({ name: n, value: v })));
    }

    const recordFromCF = React.useCallback((fields: CustomField[]) => {
        const out: Record<string, string> = {};
        for (const f of fields) {
            if (!f.name.trim()) continue;
            out[f.name.trim()] = f.value;
        }
        return out;
    }, []);

    const dirty = React.useMemo(() => {
        if (firstName !== contact.first_name) return true;
        if (lastName !== contact.last_name) return true;
        if (email !== contact.email) return true;
        if (company !== contact.company) return true;
        if (phone !== contact.phone) return true;
        if (subscribed !== contact.subscribed) return true;
        if (JSON.stringify(recordFromCF(customFields)) !== JSON.stringify(contact.custom_fields ?? {})) return true;
        const curC = new Set(contact.campaigns.map((c) => c.id));
        const nextC = new Set(campaigns.map((c) => c.id));
        if (curC.size !== nextC.size) return true;
        for (const id of curC) if (!nextC.has(id)) return true;
        const curCat = new Set((contact.categories ?? []).map((c) => c.id));
        const nextCat = new Set(categoryIds);
        if (curCat.size !== nextCat.size) return true;
        for (const id of curCat) if (!nextCat.has(id)) return true;
        return false;
    }, [contact, firstName, lastName, email, company, phone, subscribed, customFields, campaigns, categoryIds, recordFromCF]);

    async function save() {
        if (!dirty) return;
        const data: Record<string, unknown> = {};
        if (firstName !== contact.first_name) data.first_name = firstName;
        if (lastName !== contact.last_name) data.last_name = lastName;
        if (email !== contact.email) data.email = email;
        if (company !== contact.company) data.company = company;
        if (phone !== contact.phone) data.phone = phone;
        if (subscribed !== contact.subscribed) data.subscribed = subscribed;
        const cf = recordFromCF(customFields);
        if (JSON.stringify(cf) !== JSON.stringify(contact.custom_fields ?? {})) data.custom_fields = cf;
        const cur = new Set(contact.campaigns.map((c) => c.id));
        const next = new Set(campaigns.map((c) => c.id));
        let campaignsChanged = cur.size !== next.size;
        if (!campaignsChanged) for (const id of cur) if (!next.has(id)) { campaignsChanged = true; break; }
        if (campaignsChanged) data.campaigns = campaigns.map((c) => c.id);

        const curCat = new Set((contact.categories ?? []).map((c) => c.id));
        const nextCat = new Set(categoryIds);
        let categoriesChanged = curCat.size !== nextCat.size;
        if (!categoriesChanged) for (const id of curCat) if (!nextCat.has(id)) { categoriesChanged = true; break; }
        if (categoriesChanged) data.categories = categoryIds;

        try {
            await toast.promise(update.mutateAsync(data), {
                loading: "Updating contact…",
                success: "Contact updated",
                error: (err: AppError) => buildError(err),
            });
            onClose();
        } catch {
            /* toast surfaced */
        }
    }

    // Esc to close, with a confirm if dirty.
    React.useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") {
                if (dirty && !window.confirm("Discard unsaved changes?")) return;
                onClose();
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [dirty, onClose]);

    return (
        <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[110] flex justify-end bg-slate-900/30 backdrop-blur-[2px]"
            onMouseDown={onClose}
        >
            <motion.aside
                key="panel"
                initial={{ x: 32, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 32, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                onMouseDown={(e) => e.stopPropagation()}
                className="flex flex-col w-[32rem] max-w-[95%] h-full bg-white border-l border-slate-200 shadow-[-12px_0_24px_-12px_rgba(15,23,42,0.08)]"
            >
                {/* Header */}
                <header className="h-12 px-4 border-b border-slate-200 flex items-center gap-2.5 shrink-0">
                    <div className="size-7 rounded-md bg-slate-900 text-white flex items-center justify-center text-[11px] font-semibold shrink-0">
                        {(contact.email || "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] text-slate-900 font-medium truncate leading-tight">
                            {firstName || lastName
                                ? `${firstName} ${lastName}`.trim()
                                : "Contact"}
                        </div>
                        <div className="text-[10.5px] text-slate-500 truncate font-mono leading-tight">
                            {contact.email}
                        </div>
                    </div>
                    {dirty && tab === "details" && (
                        <span className="text-[10px] uppercase tracking-[0.14em] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-sm font-medium border border-amber-100">
                            Unsaved
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={() => (dirty && !window.confirm("Discard unsaved changes?") ? undefined : onClose())}
                        aria-label="Close"
                        className="size-7 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center justify-center transition-colors"
                    >
                        <XIcon className="w-3.5 h-3.5" />
                    </button>
                </header>

                {/* Tab strip */}
                <nav className="h-9 px-3 border-b border-slate-200 flex items-center gap-0.5 shrink-0">
                    {CONTACT_SLIDE_TABS.map((t) => {
                        const active = tab === t.id;
                        return (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setTab(t.id)}
                                className={`relative h-7 px-2.5 rounded text-[11.5px] font-medium transition-colors ${
                                    active
                                        ? "text-slate-900 bg-slate-100"
                                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                                }`}
                            >
                                {t.label}
                            </button>
                        );
                    })}
                </nav>

                {/* Body — one scroller per tab. */}
                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5">
                    {tab === "overview" && (
                        <OverviewTab
                            contact={contact}
                            detail={detail.data}
                            detailLoading={detail.isLoading}
                        />
                    )}
                    {tab === "activity" && <ActivityTab contactId={contact.id} />}
                    {tab === "notes" && <NotesTab contactId={contact.id} />}
                    {tab === "details" && (
                        <DetailsTab
                            contact={contact}
                            firstName={firstName}
                            setFirstName={setFirstName}
                            lastName={lastName}
                            setLastName={setLastName}
                            email={email}
                            setEmail={setEmail}
                            company={company}
                            setCompany={setCompany}
                            phone={phone}
                            setPhone={setPhone}
                            subscribed={subscribed}
                            setSubscribed={setSubscribed}
                            campaigns={campaigns}
                            setCampaigns={setCampaigns}
                            categoryIds={categoryIds}
                            setCategoryIds={setCategoryIds}
                            customFields={customFields}
                            setCustomFields={setCustomFields}
                        />
                    )}
                </div>

                {/* Footer — only the Details tab needs the save bar.
                    Other tabs are read-only or carry their own
                    affordances (Notes has an inline composer). */}
                {tab === "details" && (
                    <footer className="h-12 px-3 border-t border-slate-200 flex items-center gap-1.5 shrink-0 bg-slate-50/30">
                        <button
                            type="button"
                            onClick={reset}
                            disabled={!dirty}
                            className="h-7 px-2.5 rounded-md text-[12px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
                        >
                            Discard
                        </button>
                        <button
                            type="button"
                            onClick={save}
                            disabled={!dirty || update.isPending}
                            className="ml-auto h-7 px-3 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                            {update.isPending ? (
                                <Loader2Icon className="w-3 h-3 animate-spin" />
                            ) : (
                                <CheckIcon className="w-3 h-3" />
                            )}
                            Save changes
                        </button>
                    </footer>
                )}
            </motion.aside>
        </motion.div>
    );
}
