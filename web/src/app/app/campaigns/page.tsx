import HeadButton from "@/components/app/head/HeadButton";
import HeadMenu from "@/components/app/head/HeadMenu";
import HeadSearch from "@/components/app/head/HeadSearch";
import HeadSelectMenu from "@/components/app/head/HeadSelectMenu";
import HeadSeparator from "@/components/app/head/HeadSeparator";
import HeadWrapper from "@/components/app/head/HeadWrapper";
import SelectOption from "@/components/app/popup/select/SelectOption";
import { useUserProfile } from "@/hooks/context/user";
import useCampaigns from "@/lib/api/hooks/app/campaigns/useCampaigns";
import type Folder from "@/lib/api/models/app/Folder";
import { RiAddLine, RiFolderLine, RiMegaphoneLine, RiSendPlaneLine, RiSoundModuleLine } from "@remixicon/react";
import React, { useMemo } from "react";
import { Link } from "react-router-dom";

const DefaultFolder = {
    title: "Show All",
    color: "#c4c8cf"
} as Folder;

export default function CampaignsPage() {
    const [folder, setFolder] = React.useState<string>("");

    const [query, setQuery] = React.useState<string>("")
    const campaignsData = useCampaigns({
        query,
        folder,
    });

    const p = useUserProfile();

    const sfolder = useMemo(() => {
        if (!p) return DefaultFolder;
        const f = p.user.folders.find((f) => f.id === folder);
        if (!f) return DefaultFolder;
        return f
    }, [folder, p])

    return (
        <div className="flex flex-col sm:flex-row justify-between gap-10 items-center lg:px-5">
            <div className="w-full">
                <HeadWrapper>
                    <HeadSearch
                        loading={campaignsData.isLoading}
                        onSubmit={async (e, search) => {
                            e.preventDefault();
                            setQuery(search)
                        }}
                    />

                    <HeadMenu>
                        <HeadSelectMenu
                            icon={<RiFolderLine className="w-4" />}
                            title={sfolder.title}
                        >

                            {p?.user.folders.map((fo) => (
                                <SelectOption
                                    key={fo.id}
                                    onClick={async () => {
                                        if (folder !== fo.id) {
                                            setFolder(fo.id);
                                        } else {
                                            setFolder("")
                                        }
                                    }}
                                    color={fo.color}
                                    selected={folder === fo.id}>
                                    <RiFolderLine className="w-4" />
                                    <span className="truncate">{fo.title}</span>
                                </SelectOption>
                            ))}
                            <SelectOption onClick={() => {
                                p?.setFoldersEdit(true);
                            }}>
                                <RiSoundModuleLine className="w-4" />
                                <span className="truncate">Manage Folders</span>
                            </SelectOption>
                        </HeadSelectMenu>
                        <HeadSeparator />
                        <HeadButton onClick={() => { }}>
                            <RiAddLine className="w-4" />
                            <div>New Campaign</div>
                        </HeadButton>
                    </HeadMenu>
                </HeadWrapper>
                {
                    !campaignsData.data ? (
                        <div className="animate-pulse space-y-3 mt-10 w-full">
                            <div className="bg-gray-300 h-[86px] rounded-lg" />
                            <div className="bg-gray-300 h-[86px] rounded-lg" />
                            <div className="bg-gray-300 h-[86px] rounded-lg" />
                            <div className="bg-gray-300 h-[86px] rounded-lg" />
                        </div>
                    ) : (
                        <>
                            {campaignsData.campaigns.length === 0 ? (
                                <div className="py-30 flex items-center justify-center gap-9 w-full flex-col">
                                    <RiMegaphoneLine className="w-20 h-20 rotate-10 text-slate-300" />
                                    <h1 className="font-inter font-bold text-3xl text-gray-600">It looks empty here! </h1>
                                    <p className="text-slate-500 max-w-lg text-lg text-center">Start growing your audience by creating a new campaign. Click "New Campaign" to begin.</p>
                                </div>
                            ) : (
                                <div className="grid gap-2 mt-10">
                                    {campaignsData.campaigns.map((c) => (
                                        <Link to={`/app/campaigns/${c.id}`} key={c.id} className="bg-white overflow-hidden rounded-md cursor-pointer hover:shadow-sm transition border border-slate-200 p-4 flex justify-between">
                                            <div className="overflow-hidden max-w-2xl">
                                                <div>
                                                    <div className="flex flex-1 gap-7 items-center">
                                                        <RiSendPlaneLine className="w-7 h-7 shrink-0 text-slate-600" />
                                                        <div className="flex-1 min-w-0 overflow-hidden">
                                                            <h1 className="truncate text-slate-600 text-lg font-inter font-bold">{c.name}</h1>
                                                            <p className="text-gray-400 truncate font-inter">{c.description}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="shrink-0 w-10"></div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </>
                    )
                }
            </div >
        </div >
    )
}
