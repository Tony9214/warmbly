import HeadSelectMenu from "@/components/app/head/HeadSelectMenu";
import SelectOption from "@/components/app/popup/select/SelectOption";
import Search from "@/components/app/Search";
import { useUserProfile } from "@/hooks/context/user";
import useCampaigns from "@/lib/api/hooks/app/campaigns/useCampaigns";
import type Folder from "@/lib/api/models/app/Folder";
import { RiFolderLine, RiSoundModuleLine } from "@remixicon/react";
import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { MegaphoneIcon, PlusIcon, ChevronRightIcon, FilterIcon, CalendarIcon } from "lucide-react";

const DefaultFolder = {
    title: "All folders",
    color: "#c4c8cf"
} as Folder;

export default function CampaignsPage() {
    const [folder, setFolder] = React.useState<string>("");
    const [query, setQuery] = React.useState<string>("")
    const campaignsData = useCampaigns({ query, folder });
    const p = useUserProfile();

    const sfolder = useMemo(() => {
        if (!p) return DefaultFolder;
        const f = p.user.folders.find((f) => f.id === folder);
        if (!f) return DefaultFolder;
        return f
    }, [folder, p])

    return (
        <div className="p-5">
            {/* Page header — like ex3's "Apps" header */}
            <div className="mb-5">
                <h1 className="text-xl font-semibold text-zinc-900">Campaigns</h1>
                <p className="text-[13px] text-zinc-400 mt-1">Manage and monitor your outreach campaigns</p>
            </div>

            {/* Toolbar — search + filters + action */}
            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
                    <div className="flex items-center gap-2">
                        <Search value={query} onChange={(v) => setQuery(v)} />
                        <HeadSelectMenu
                            icon={<FilterIcon className="w-3.5 h-3.5" />}
                            title={sfolder.title}
                        >
                            {p?.user.folders.map((fo) => (
                                <SelectOption
                                    key={fo.id}
                                    onClick={async () => { folder !== fo.id ? setFolder(fo.id) : setFolder("") }}
                                    color={fo.color}
                                    selected={folder === fo.id}
                                >
                                    <RiFolderLine className="w-3.5 h-3.5" />
                                    <span className="truncate">{fo.title}</span>
                                </SelectOption>
                            ))}
                            <SelectOption onClick={() => p?.setFoldersEdit(true)}>
                                <RiSoundModuleLine className="w-3.5 h-3.5" />
                                <span className="truncate">Manage Folders</span>
                            </SelectOption>
                        </HeadSelectMenu>
                    </div>
                    <button
                        onClick={() => { }}
                        className="flex items-center gap-1.5 bg-zinc-900 text-white hover:bg-zinc-800 text-[13px] font-medium rounded-lg px-3 py-1.5 transition-colors duration-100"
                    >
                        <PlusIcon className="w-3.5 h-3.5" />
                        <span>New Campaign</span>
                    </button>
                </div>

                {/* Content */}
                {!campaignsData.data ? (
                    <div className="p-4 space-y-2">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-16 bg-zinc-100 animate-pulse rounded-lg" />
                        ))}
                    </div>
                ) : campaignsData.campaigns.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4">
                        <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center mb-3">
                            <MegaphoneIcon className="w-5 h-5 text-zinc-400" />
                        </div>
                        <h3 className="text-sm font-medium text-zinc-900 mb-1">No campaigns yet</h3>
                        <p className="text-xs text-zinc-400 text-center max-w-xs mb-4">
                            Create your first campaign to start reaching your audience.
                        </p>
                        <button className="flex items-center gap-1.5 bg-zinc-900 text-white hover:bg-zinc-800 text-[13px] font-medium rounded-lg px-3 py-1.5 transition-colors duration-100">
                            <PlusIcon className="w-3.5 h-3.5" />
                            New Campaign
                        </button>
                    </div>
                ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                        {campaignsData.campaigns.map((c) => (
                            <Link
                                to={`/app/campaigns/${c.id}`}
                                key={c.id}
                                className="rounded-xl border border-zinc-200 p-4 hover:border-zinc-300 hover:shadow-sm transition-all duration-100 group"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="w-9 h-9 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
                                        <MegaphoneIcon className="w-4 h-4 text-zinc-500" />
                                    </div>
                                    <ChevronRightIcon className="w-4 h-4 text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity duration-100 mt-1" />
                                </div>
                                <h3 className="text-sm font-medium text-zinc-900 truncate mb-1">{c.name}</h3>
                                {c.description && (
                                    <p className="text-xs text-zinc-400 truncate mb-3">{c.description}</p>
                                )}
                                <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                                    <span className="flex items-center gap-1">
                                        <CalendarIcon className="w-3 h-3" />
                                        {c.created_at ? new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '--'}
                                    </span>
                                    <span className={`flex items-center gap-1 ${
                                        c.status === 'active' ? 'text-emerald-500' :
                                        c.status === 'draft' ? 'text-zinc-400' : 'text-amber-500'
                                    }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${
                                            c.status === 'active' ? 'bg-emerald-500' :
                                            c.status === 'draft' ? 'bg-zinc-300' : 'bg-amber-500'
                                        }`} />
                                        {c.status || 'draft'}
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
