import type SearchContacts from "@/lib/api/models/app/contacts/SearchContacts";
import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RiAddLine, RiCloseLine, RiSearch2Line } from "@remixicon/react";
import MiniInput from "../popup/MiniInput";
import MiniTitle from "../text/MiniTitle";
import ContactsFilterField from "./filters/ContactsFilterField";
import ContactsSortBy from "./filters/ContactsSortBy";
import CheckFilterTime from "../inputs/CheckFilterTime";
import CheckFilter from "../inputs/CheckFilter";
import MiniNumberInput from "../popup/MiniNumberInput";
import Switch from "../Switch";
import CampaignSelector from "../popup/select/CampaignSelector";
import type MiniCampaign from "@/lib/api/models/app/campaigns/MiniCampaign";
import { Loading } from "@/components/loader";
import { twColors } from "tailwindv4-colors";


export default function ContactFilters({
    active,
    setActive,
    filters,
    setFilters,
    activeCampaign,
    loading,
}: {
    active: boolean,
    setActive: React.Dispatch<React.SetStateAction<boolean>>,
    filters: SearchContacts,
    setFilters: React.Dispatch<React.SetStateAction<SearchContacts>>,
    activeCampaign?: MiniCampaign,
    loading?: boolean,
}) {
    const [campaignsNames, setCampaignNames] = React.useState<Record<string, string>>({})
    const [props, setProps] = React.useState<SearchContacts>(filters);

    React.useEffect(() => {
        setProps(filters)
    }, [filters])

    const [mouseDownOnButton, setMouseDownOnButton] = React.useState(false);
    const handleMouseDown = () => setMouseDownOnButton(true);
    const handleMouseUp = (set: React.Dispatch<React.SetStateAction<boolean>>) => {
        if (mouseDownOnButton) {
            set(false)
        }
        setMouseDownOnButton(false);
    };

    return (
        <AnimatePresence>
            {active &&
                <motion.div
                    key="overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    onMouseDown={handleMouseDown}
                    onMouseUp={() => handleMouseUp(setActive)}
                    className="fixed inset-0 z-[100] flex justify-end bg-slate-950/45"
                >
                    {/* Sidebar panel */}
                    <motion.div
                        key="sidebar"
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", stiffness: 260, damping: 30 }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                        className="flex flex-col bg-white relative w-[50rem] max-w-[95%] h-full shadow-xl"
                    >
                        <div className="overflow-y-scroll p-10 grow">
                            <div className="mb-3 flex justify-between gap-5">
                                <h1 className="text-3xl text-slate-700 font-poppins font-medium">Search Filters</h1>
                                <div onClick={() => setActive(false)} className="flex px-2 items-center justify-center hover:opacity-80 cursor-pointer">
                                    <RiCloseLine className="w-5 text-slate-400" />
                                </div>
                            </div>
                            <hr className="my-5 text-slate-200" />
                            <div className="space-y-5">
                                <div>
                                    <MiniTitle>Query</MiniTitle>
                                    <MiniInput
                                        value={props.query}
                                        placeholder="Search..."
                                        onChange={(e) => setProps(s => ({
                                            ...s,
                                            query: e.target.value,
                                        }))}
                                    />
                                </div>
                                <div>
                                    <MiniTitle>
                                        Custom Field Filters
                                        {props.filters.length < 100 &&
                                            <button
                                                onClick={() => {
                                                    setProps(prev =>
                                                    ({
                                                        ...prev,
                                                        filters: [...prev.filters, {
                                                            name: "",
                                                            type: "contains",
                                                            value: "",
                                                        }]
                                                    })
                                                    )
                                                }}
                                                className='ripple bg-blue-100 hover:bg-blue-200 transition rounded-lg px-1 text-blue-600 cursor-pointer'>
                                                <RiAddLine className='w-4' />
                                            </button>}
                                    </MiniTitle>
                                    <div className="space-y-3">
                                        {props.filters.length > 0 ? <>
                                            {props.filters.map((f, i) => (
                                                <ContactsFilterField
                                                    key={i}
                                                    field={f}
                                                    onChange={(updated) =>
                                                        setProps(prev =>
                                                        ({
                                                            ...prev,
                                                            filters: prev.filters.map((item, ind) => (ind === i ? updated : item))
                                                        })
                                                        )
                                                    }
                                                    onDelete={() =>
                                                        setProps((prev) => ({
                                                            ...prev,
                                                            filters: prev.filters.filter((_, ind) => ind !== i),
                                                        }))
                                                    }
                                                />
                                            ))}
                                        </> : <>
                                            <div className=" text-slate-400 font-poppins">
                                                No filters added yet.
                                            </div>
                                        </>}
                                    </div>
                                </div>
                                <div>
                                    <MiniTitle>Sort By</MiniTitle>
                                    <ContactsSortBy
                                        search={props}
                                        setSearch={setProps}
                                    />
                                </div>
                                <div>
                                    <MiniTitle>Filter By</MiniTitle>
                                    <div className="space-y-3">
                                        <CheckFilterTime
                                            value={props.created_after}
                                            setValue={(v) => {
                                                setProps(bef => ({ ...bef, created_after: v }))
                                            }}
                                            label="Created After"
                                        />
                                        <CheckFilterTime
                                            value={props.updated_after}
                                            setValue={(v) => {
                                                setProps(bef => ({ ...bef, updated_after: v }))
                                            }}
                                            label="Updated After"
                                        />
                                        <CheckFilterTime
                                            value={props.created_before}
                                            setValue={(v) => {
                                                setProps(bef => ({ ...bef, created_before: v }))
                                            }}
                                            label="Created Before"
                                        />
                                        <CheckFilterTime
                                            value={props.updated_before}
                                            setValue={(v) => {
                                                setProps(bef => ({ ...bef, updated_before: v }))
                                            }}
                                            label="Updated Before"
                                        />
                                        <CheckFilter
                                            value={props.min_campaigns !== null}
                                            setValue={(v) => {
                                                if (v) {
                                                    setProps(bef => ({ ...bef, min_campaigns: 0 }))
                                                } else {
                                                    setProps(bef => ({ ...bef, min_campaigns: undefined }))
                                                }
                                            }}
                                            label="Min Campaigns"
                                        >
                                            {props.min_campaigns &&
                                                <MiniNumberInput
                                                    value={props.min_campaigns}
                                                    placeholder="0"
                                                    onChange={(e) => setProps(bef => ({ ...bef, min_campaigns: e.target.valueAsNumber }))}
                                                />}
                                        </CheckFilter>
                                        <CheckFilter
                                            value={props.max_campaigns !== null}
                                            setValue={(v) => {
                                                if (v) {
                                                    setProps(bef => ({ ...bef, max_campaigns: 0 }))
                                                } else {
                                                    setProps(bef => ({ ...bef, max_campaigns: undefined }))
                                                }
                                            }}
                                            label="Max Campaigns"
                                        >
                                            {props.max_campaigns &&
                                                <MiniNumberInput
                                                    value={props.max_campaigns}
                                                    placeholder="0"
                                                    onChange={(e) => setProps(bef => ({ ...bef, max_campaigns: e.target.valueAsNumber }))}
                                                />}
                                        </CheckFilter>
                                        <CheckFilter
                                            value={props.subscribed !== null}
                                            setValue={(v) => {
                                                if (v) {
                                                    setProps(bef => ({ ...bef, subscribed: true }))
                                                } else {
                                                    setProps(bef => ({ ...bef, subscribed: undefined }))
                                                }
                                            }}
                                            label="Subscribed"
                                        >
                                            {props.subscribed && (
                                                <Switch
                                                    id="contact-filter-subscribed"
                                                    value={props.subscribed}
                                                    onChange={(v) => setProps(bef => ({ ...bef, subscribed: v }))}
                                                />
                                            )}
                                        </CheckFilter>
                                    </div>
                                </div>
                                {!activeCampaign &&
                                    <div>
                                        <MiniTitle>Assoicated Campaigns</MiniTitle>
                                        <CampaignSelector
                                            onAdd={(id, name) => {
                                                setCampaignNames(bef => ({
                                                    ...bef,
                                                    [id]: name ?? id,
                                                }))
                                                setProps(bef => ({
                                                    ...bef,
                                                    campaign_ids: [...bef.campaign_ids, id]
                                                }))
                                            }}
                                            onRemove={(id) => {
                                                setProps(bef => ({
                                                    ...bef,
                                                    campaign_ids: bef.campaign_ids.filter((cm) => cm !== id)
                                                }))
                                            }}
                                            selected={props.campaign_ids.map((c_id) => {
                                                return {
                                                    name: campaignsNames[c_id] ?? c_id,
                                                    id: c_id,
                                                }
                                            })}
                                            reverse
                                        />
                                    </div>}
                                <div className="flex justify-end gap-2 mt-6">
                                    <button
                                        onClick={() => setActive(false)}
                                        className="ripple cursor-pointer px-4 h-10 text-slate-500 rounded-lg bg-slate-200 hover:bg-slate-300">
                                        Close
                                    </button>
                                    <button
                                        onClick={() => {
                                            setFilters(props);
                                            setActive(false);
                                        }}
                                        className='ripple w-27 h-10 gap-1 cursor-pointer text-white transition flex items-center justify-center bg-blue-500 hover:bg-blue-600 rounded-lg'
                                    >
                                        {loading ? <Loading className='h-5' color={twColors.slate[200]} /> : <>
                                            <RiSearch2Line className="w-4" />
                                            Search
                                        </>}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            }
        </AnimatePresence>
    )
}
