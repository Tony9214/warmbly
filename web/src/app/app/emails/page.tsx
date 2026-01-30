import { RiAddLine, RiFireLine, RiMoreLine, RiPriceTag3Line, RiSoundModuleLine } from "@remixicon/react";
import React, { useMemo } from "react";
import useEmails from "@/lib/api/hooks/app/emails/useEmails";
import { useUserProfile } from "@/hooks/context/user";
import InboxDetails from "@/components/app/emails/InboxDetails";
import HeadWrapper from "@/components/app/head/HeadWrapper";
import HeadSearch from "@/components/app/head/HeadSearch";
import HeadMenu from "@/components/app/head/HeadMenu";
import SelectOption from "@/components/app/popup/select/SelectOption";
import HeadSelectMenu from "@/components/app/head/HeadSelectMenu";
import HeadSeparator from "@/components/app/head/HeadSeparator";
import HeadButton from "@/components/app/head/HeadButton";
import type Tag from "@/lib/api/models/app/Tag";

const DefaultFolder = {
    title: "Show All",
    color: "#c4c8cf"
} as Tag;

export default function AddressesPage() {
    const p = useUserProfile();

    const [query, setQuery] = React.useState<string>("");
    const [tag, setTag] = React.useState<string>("");
    const emailsData = useEmails({
        query,
        tag,
    })
    const [selected, setSelected] = React.useState<string[]>([]);
    const [view, setView] = React.useState<string>("");

    function isSelectedAll(): boolean {
        return emailsData.emails ? emailsData.emails ? emailsData.emails.length > 0 && selected.length === emailsData.emails.length : false : false
    }

    const stag = useMemo(() => {
        if (!p) return DefaultFolder;
        const f = p.user.folders.find((f) => f.id === tag);
        if (!f) return DefaultFolder;
        return f
    }, [tag, p])

    return <>
        <HeadWrapper>
            <HeadSearch
                loading={emailsData.isLoading}
                onSubmit={async (e, search) => {
                    e.preventDefault();
                    setQuery(search)
                }}
            />
            <HeadMenu>
                <HeadSelectMenu
                    icon={<RiPriceTag3Line className="w-4" />}
                    title={stag.title}
                >

                    {p?.user.folders.map((fo) => (
                        <SelectOption
                            key={fo.id}
                            onClick={async () => {
                                if (tag !== fo.id) {
                                    setTag(fo.id);
                                } else {
                                    setTag("")
                                }
                            }}
                            color={fo.color}
                            selected={tag === fo.id}>
                            <RiPriceTag3Line className="w-4" />
                            <span className="truncate">{fo.title}</span>
                        </SelectOption>
                    ))}
                    <SelectOption onClick={() => {
                        p?.setTagsEdit(true);
                    }}>
                        <RiSoundModuleLine className="w-4" />
                        <span className="truncate">Manage Tags</span>
                    </SelectOption>
                </HeadSelectMenu>
                <HeadSeparator />
                <HeadButton onClick={() => p?.setAddEmail(true)}>
                    <RiAddLine className="w-4" />
                    <div>Add Email</div>
                </HeadButton>
            </HeadMenu>
        </HeadWrapper>
        {emailsData.emails && emailsData.emails.length === 0 ? <>
            <div className="flex justify-center mt-10">
                <div>
                    <div className="flex justify-center">
                        <svg
                            width="240"
                            viewBox="0 0 200 200"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                        >
                            <path
                                d="M20 60 L100 110 L180 60 L180 150 L20 150 Z"
                                stroke="#a1a1aa"
                                strokeWidth="2"
                            />
                            <path
                                d="M20 60 L100 110 L180 60"
                                stroke="#a1a1aa"
                                strokeWidth="2"
                            />
                            <text
                                x="100"
                                y="115"
                                fontSize="110"
                                fontFamily="Arial, Helvetica, sans-serif"
                                fill="#a1a1aa"
                                textAnchor="middle"
                                dominantBaseline="middle"
                            >
                                ?
                            </text>
                            <ellipse cx="100" cy="165" rx="75" ry="10" fill="#e4e4e7" opacity=".4" />
                        </svg>
                    </div>
                    <h1 className="text-center font-sans font-medium mb-4 text-lg">No Email Added Yet</h1>
                    <p className="max-w-xl text-center text-gray-500">Looks like you haven’t connected an email address yet. Tap ‘Add new’ above to link one and start receiving messages.</p>
                </div>
            </div>
        </> : emailsData.isLoading ? <>
            <div className="animate-pulse lg:px-5 mt-10 grid space-y-1">
                <div className="bg-gray-300 h-7 rounded-lg mb-4" />
                <div className="bg-gray-300 h-12 rounded-lg" />
                <div className="bg-gray-300 h-12 rounded-lg" />
                <div className="bg-gray-300 h-12 rounded-lg" />
                <div className="bg-gray-300 h-12 rounded-lg" />
            </div>
        </> : <>

            <div className="overflow-x-scroll lg:px-5 mt-5 py-2">
                <table className="w-full min-w-[640px] text-sm text-left text-gray-700 border-separate border-spacing-y-1">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wider">
                        <tr>
                            <th className="p-3 w-10">
                                <input
                                    type="checkbox"
                                    className="w-3.5 h-3.5 text-blue-600 bg-gray-100 border-gray-300 rounded-sm focus:ring-blue-500 focus:ring-2"
                                    checked={isSelectedAll()}
                                    onChange={() => {
                                        if (isSelectedAll()) {
                                            const newEmails: string[] = []
                                            emailsData.emails.map((email) => {
                                                newEmails.push(email.id)
                                            })
                                            setSelected(bef => bef.filter((e) => !newEmails.includes(e)))
                                        } else {
                                            const newEmails: string[] = []
                                            emailsData.emails.map((email) => {
                                                if (!selected.includes(email.id)) {
                                                    newEmails.push(email.id)
                                                }
                                            })
                                            setSelected(bef => [...bef, ...newEmails])
                                        }
                                    }}
                                />
                            </th>
                            <th className="p-3 font-semibold text-gray-500 whitespace-nowrap">Name</th>
                            <th className="p-3 font-semibold text-gray-500 whitespace-nowrap">Emails Sent</th>
                            <th className="p-3 font-semibold text-gray-500 whitespace-nowrap">Warmup Emails</th>
                            <th className="p-3 font-semibold text-gray-500 whitespace-nowrap">Health Score</th>
                            <th className="p-3 w-20"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {emailsData.emails.map((box) => (
                            <tr key={box.id} className="shadow-xl">
                                <td className="p-3 bg-white rounded-l-lg border-t border-l border-b border-gray-200">
                                    <input
                                        type="checkbox"
                                        className="w-3.5 h-3.5 text-blue-600 bg-gray-100 border-gray-300 rounded-sm focus:ring-blue-500 focus:ring-2"
                                        checked={selected.includes(box.id)}
                                        onChange={() => {
                                            if (selected.includes(box.id)) {
                                                setSelected(bef => bef.filter(i => i !== box.id))
                                            } else {
                                                setSelected(bef => [...bef, box.id])
                                            }
                                        }}
                                    />
                                </td>
                                <td className="p-3 font-medium bg-white border-t border-b border-gray-200">{box.email}</td>
                                <td className="p-3 bg-white border-t border-b border-gray-200">0</td>
                                <td className="p-3 bg-white border-t border-b border-gray-200">{box.warmup_base}</td>
                                <td className="p-3 bg-white border-t border-b border-gray-200">
                                    <span
                                        className={`px-2 py-0.5 rounded-full text-xs ${box.status === 'healthy'
                                            ? 'bg-green-100 text-green-700'
                                            : box.status === 'warming'
                                                ? 'bg-yellow-100 text-yellow-700'
                                                : 'bg-red-100 text-red-700'
                                            }`}
                                    >
                                        {box.status}
                                    </span>
                                </td>
                                <td className="py-2 flex gap-2 bg-white rounded-r-lg border-t border-r border-b border-gray-200">
                                    <button className="text-blue-600 hover:text-blue-800">
                                        <RiFireLine size={20} />
                                    </button>
                                    <button className="ripple text-gray-600 hover:bg-gray-100 px-2 cursor-pointer py-1 rounded-md" onClick={() => {
                                        setView(box.id)
                                    }}>
                                        <RiMoreLine size={20} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>}
        <InboxDetails
            emails={emailsData.emails}
            view={view}
            setView={setView}
        />
    </>
}
