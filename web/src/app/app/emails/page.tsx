import { RiFireLine, RiMoreLine, RiPriceTag3Line, RiSoundModuleLine } from "@remixicon/react";
import React, { useMemo } from "react";
import useEmails from "@/lib/api/hooks/app/emails/useEmails";
import { useUserProfile } from "@/hooks/context/user";
import InboxDetails from "@/components/app/emails/InboxDetails";
import HeadSelectMenu from "@/components/app/head/HeadSelectMenu";
import SelectOption from "@/components/app/popup/select/SelectOption";
import type Tag from "@/lib/api/models/app/Tag";
import { MailIcon, PlusIcon, ShieldCheckIcon, FlameIcon, AlertCircleIcon, FilterIcon } from "lucide-react";
import Search from "@/components/app/Search";

const DefaultFolder = {
    title: "All accounts",
    color: "#c4c8cf"
} as Tag;

export default function AddressesPage() {
    const p = useUserProfile();

    const [query, setQuery] = React.useState<string>("");
    const [tag, setTag] = React.useState<string>("");
    const emailsData = useEmails({ query, tag })
    const [selected, setSelected] = React.useState<string[]>([]);
    const [view, setView] = React.useState<string>("");

    function isSelectedAll(): boolean {
        return emailsData.emails ? emailsData.emails.length > 0 && selected.length === emailsData.emails.length : false
    }

    const stag = useMemo(() => {
        if (!p) return DefaultFolder;
        const f = p.user.folders.find((f) => f.id === tag);
        if (!f) return DefaultFolder;
        return f
    }, [tag, p])

    // Compute stats from emails
    const stats = useMemo(() => {
        if (!emailsData.emails) return { total: 0, healthy: 0, warming: 0, issues: 0 }
        return {
            total: emailsData.emails.length,
            healthy: emailsData.emails.filter(e => e.status === 'healthy').length,
            warming: emailsData.emails.filter(e => e.status === 'warming').length,
            issues: emailsData.emails.filter(e => e.status !== 'healthy' && e.status !== 'warming').length,
        }
    }, [emailsData.emails])

    return (
        <div>
            {/* Stat cards — like ex2's overview */}
            <div className="px-5 pt-5 pb-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-white rounded-xl border border-zinc-200 p-4">
                        <div className="flex items-center gap-2.5 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                                <MailIcon className="w-4 h-4 text-blue-600" />
                            </div>
                            <span className="text-[13px] text-zinc-500">Total Accounts</span>
                        </div>
                        <div className="text-2xl font-semibold text-zinc-900 tracking-tight">{stats.total}</div>
                    </div>
                    <div className="bg-white rounded-xl border border-zinc-200 p-4">
                        <div className="flex items-center gap-2.5 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                                <ShieldCheckIcon className="w-4 h-4 text-emerald-600" />
                            </div>
                            <span className="text-[13px] text-zinc-500">Healthy</span>
                        </div>
                        <div className="text-2xl font-semibold text-zinc-900 tracking-tight">{stats.healthy}</div>
                    </div>
                    <div className="bg-white rounded-xl border border-zinc-200 p-4">
                        <div className="flex items-center gap-2.5 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                                <FlameIcon className="w-4 h-4 text-amber-600" />
                            </div>
                            <span className="text-[13px] text-zinc-500">Warming Up</span>
                        </div>
                        <div className="text-2xl font-semibold text-zinc-900 tracking-tight">{stats.warming}</div>
                    </div>
                    <div className="bg-white rounded-xl border border-zinc-200 p-4">
                        <div className="flex items-center gap-2.5 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                                <AlertCircleIcon className="w-4 h-4 text-red-500" />
                            </div>
                            <span className="text-[13px] text-zinc-500">Issues</span>
                        </div>
                        <div className="text-2xl font-semibold text-zinc-900 tracking-tight">{stats.issues}</div>
                    </div>
                </div>
            </div>

            {/* Accounts table card — like ex2's integrations section */}
            <div className="px-5 pb-5">
                <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
                    {/* Table toolbar */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
                        <div className="flex items-center gap-2">
                            <h2 className="text-[13.5px] font-semibold text-zinc-900">Email Accounts</h2>
                            {emailsData.emails && (
                                <span className="text-xs text-zinc-400">{emailsData.emails.length}</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <form onSubmit={(e) => { e.preventDefault(); setQuery((e.target as HTMLFormElement).querySelector('input')?.value || '') }} className="hidden sm:block">
                                <Search value={query} onChange={(v) => setQuery(v)} />
                            </form>
                            <HeadSelectMenu
                                icon={<FilterIcon className="w-3.5 h-3.5" />}
                                title={stag.title}
                            >
                                {p?.user.folders.map((fo) => (
                                    <SelectOption
                                        key={fo.id}
                                        onClick={async () => { tag !== fo.id ? setTag(fo.id) : setTag("") }}
                                        color={fo.color}
                                        selected={tag === fo.id}
                                    >
                                        <RiPriceTag3Line className="w-3.5 h-3.5" />
                                        <span className="truncate">{fo.title}</span>
                                    </SelectOption>
                                ))}
                                <SelectOption onClick={() => p?.setTagsEdit(true)}>
                                    <RiSoundModuleLine className="w-3.5 h-3.5" />
                                    <span className="truncate">Manage Tags</span>
                                </SelectOption>
                            </HeadSelectMenu>
                            <button
                                onClick={() => p?.setAddEmail(true)}
                                className="flex items-center gap-1.5 bg-zinc-900 text-white hover:bg-zinc-800 text-[13px] font-medium rounded-lg px-3 py-1.5 transition-colors duration-100"
                            >
                                <PlusIcon className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Add Account</span>
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    {emailsData.emails && emailsData.emails.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4">
                            <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center mb-3">
                                <MailIcon className="w-5 h-5 text-zinc-400" />
                            </div>
                            <h3 className="text-sm font-medium text-zinc-900 mb-1">No email accounts yet</h3>
                            <p className="text-xs text-zinc-400 text-center max-w-xs mb-4">
                                Connect your first email address to start warming up and sending campaigns.
                            </p>
                            <button
                                onClick={() => p?.setAddEmail(true)}
                                className="flex items-center gap-1.5 bg-zinc-900 text-white hover:bg-zinc-800 text-[13px] font-medium rounded-lg px-3 py-1.5 transition-colors duration-100"
                            >
                                <PlusIcon className="w-3.5 h-3.5" />
                                Add Account
                            </button>
                        </div>
                    ) : emailsData.isLoading ? (
                        <div className="p-4 space-y-2">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="h-12 bg-zinc-100 animate-pulse rounded-lg" />
                            ))}
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-zinc-100">
                                    <th className="pl-4 pr-2 py-2.5 w-10">
                                        <input
                                            type="checkbox"
                                            className="w-3.5 h-3.5 rounded accent-zinc-900"
                                            checked={isSelectedAll()}
                                            onChange={() => {
                                                if (isSelectedAll()) {
                                                    setSelected(bef => bef.filter((e) => !emailsData.emails.map(em => em.id).includes(e)))
                                                } else {
                                                    setSelected(bef => [...bef, ...emailsData.emails.filter(em => !selected.includes(em.id)).map(em => em.id)])
                                                }
                                            }}
                                        />
                                    </th>
                                    <th className="px-3 py-2.5 text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Account</th>
                                    <th className="px-3 py-2.5 text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Sent</th>
                                    <th className="px-3 py-2.5 text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Warmup</th>
                                    <th className="px-3 py-2.5 text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Status</th>
                                    <th className="px-3 py-2.5 w-20"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {emailsData.emails.map((box) => (
                                    <tr key={box.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/80 transition-colors duration-100 group">
                                        <td className="pl-4 pr-2 py-3">
                                            <input
                                                type="checkbox"
                                                className="w-3.5 h-3.5 rounded accent-zinc-900"
                                                checked={selected.includes(box.id)}
                                                onChange={() => {
                                                    selected.includes(box.id)
                                                        ? setSelected(bef => bef.filter(i => i !== box.id))
                                                        : setSelected(bef => [...bef, box.id])
                                                }}
                                            />
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
                                                    <span className="text-[10px] font-medium text-zinc-500">{box.email.slice(0, 2).toUpperCase()}</span>
                                                </div>
                                                <span className="text-[13.5px] font-medium text-zinc-900">{box.email}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 text-[13px] text-zinc-500">0</td>
                                        <td className="px-3 py-3 text-[13px] text-zinc-500">{box.warmup_base}</td>
                                        <td className="px-3 py-3">
                                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                                                box.status === 'healthy' ? 'text-emerald-600' :
                                                box.status === 'warming' ? 'text-amber-600' : 'text-red-500'
                                            }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${
                                                    box.status === 'healthy' ? 'bg-emerald-500' :
                                                    box.status === 'warming' ? 'bg-amber-500' : 'bg-red-500'
                                                }`} />
                                                {box.status}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
                                                <button className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors duration-100">
                                                    <RiFireLine className="w-4 h-4" />
                                                </button>
                                                <button
                                                    className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors duration-100 cursor-pointer"
                                                    onClick={() => setView(box.id)}
                                                >
                                                    <RiMoreLine className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <InboxDetails
                emails={emailsData.emails}
                view={view}
                setView={setView}
            />
        </div>
    )
}
