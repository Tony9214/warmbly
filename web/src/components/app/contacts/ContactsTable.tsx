import { RiAddLine, RiEqualizer3Line, RiTeamLine } from "@remixicon/react";
import React from "react";
import { Loading } from "../../loader";
import { useConfirm } from "@/hooks/context/confirm";
import Checkbox from "../Checkbox";
import { twColors } from "tailwindv4-colors";
import useSearchContacts from "@/lib/api/hooks/app/contacts/useSearchContacts";
import type SearchContacts from "@/lib/api/models/app/contacts/SearchContacts";
import HeadSearch from "../head/HeadSearch";
import HeadMenu from "../head/HeadMenu";
import HeadButton from "../head/HeadButton";
import useDeleteContacts from "@/lib/api/hooks/app/contacts/useDeleteContacts";
import toast from "react-hot-toast";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import ContactFilters from "./ContactFilters";
import ContactEntry from "./ContactEntry";
import ContactEdit from "./ContactEdit";
import type MiniCampaign from "@/lib/api/models/app/campaigns/MiniCampaign";
import ContactsEditBulk from "./ContactsEditBulk";


export default function ContactsTable({
    current_campaign,
}: {
    current_campaign?: MiniCampaign,
}) {
    const confirm = useConfirm();
    const [selected, setSelected] = React.useState<string[]>([]);
    const [del, setDelete] = React.useState<boolean>(false);
    const [filters, setFilters] = React.useState<boolean>(false);
    const [edit, setEdit] = React.useState<string>("");
    const [bulkEdit, setBulkEdit] = React.useState<boolean>(false);

    const [searchProps, setSearchProps] = React.useState<SearchContacts>({
        query: "",
        filters: [],
        campaign_ids: current_campaign ? [current_campaign.id] : [],
        sort_by: 'created_at',
        reverse: false,
    })
    const contactsData = useSearchContacts({
        options: searchProps,
    });
    const contactsBulkDelete = useDeleteContacts();


    const isSelectedAll = React.useMemo(() => {
        if (!contactsData) return false;
        return !contactsData.contacts?.some((v) => !selected.some((s) => s === v.id))
    }, [selected, contactsData])

    async function BulkDelete() {
        if (selected.length === 0) return;
        try {
            confirm?.setLoading(true);
            const cselected = selected;
            try {
                setDelete(true);
                await toast.promise(
                    contactsBulkDelete.mutateAsync(cselected),
                    {
                        loading: `Deleting ${cselected.length} contacts...`,
                        success: "Contacts successfully deleted.",
                        error: (err: AppError) => buildError(err),
                    }
                )
            } finally {
                setDelete(false);
            }
        } finally {
            confirm?.setLoading(false)
            confirm?.setShow(false)
        }
    }

    return (<>
        <div className={`${current_campaign ? "px-0" : "lg:px-5"} w-full`}>
            <div className="flex flex-col xl:flex-row justify-between w-full gap-4 min-w-0 overflow-x-hidden">
                <HeadSearch
                    loading={contactsData.isLoading}
                    onSubmit={async (e, search) => {
                        e.preventDefault();
                        setSearchProps(props => ({
                            ...props,
                            search,
                        }))
                    }}
                />
                <HeadMenu>
                    <HeadButton white onClick={() => { }}>
                        <RiEqualizer3Line className="w-4" />
                        Filters
                    </HeadButton>
                    <HeadButton onClick={() => { }}>
                        <RiAddLine className="w-4" />
                        <div>New Contact</div>
                    </HeadButton>
                </HeadMenu>
            </div>
            {!contactsData.contacts ? (
                <div className="animate-pulse space-y-3 mt-10 w-full">
                    <div className="bg-gray-300 h-[86px] rounded-lg" />
                    <div className="bg-gray-300 h-[86px] rounded-lg" />
                    <div className="bg-gray-300 h-[86px] rounded-lg" />
                    <div className="bg-gray-300 h-[86px] rounded-lg" />
                </div>
            ) : (
                <>
                    {contactsData.contacts?.length === 0 ? (
                        <div className="py-30 flex items-center justify-center gap-9 w-full flex-col">
                            <RiTeamLine className="w-20 h-20 text-slate-300" />
                            <h1 className="font-inter font-bold text-3xl text-gray-600">It looks empty here! </h1>
                            <p className="text-slate-500 max-w-lg text-lg text-center">Start building your contact list by adding or uploading new contacts. Add your contacts to get started.</p>
                        </div>
                    ) : (<>
                        <p className="text-slate-400 mt-6 px-4 leading-8 flex gap-3 items-center">Showing {contactsData.contacts.length} of {contactsData.data?.pages[0]?.pagination.total ?? 0}{selected.length > 0 && <>
                            {` (${selected.length} selected)`}
                            <button
                                className={`bg-slate-200 ripple hover:bg-slate-300 shrink-0 rounded-lg text-slate-500 flex items-center justify-center w-21 transition cursor-pointer`}
                                onClick={() => setBulkEdit(true)}>
                                Bulk Edit
                            </button>
                            <button
                                className={`${del ? "bg-red-200" : "bg-red-100 hover:bg-red-200"} shrink-0 ripple rounded-lg text-red-500 flex items-center justify-center w-16 cursor-pointer transition`}
                                onClick={() => confirm?.show(`Are you sure you want to delete ${selected.length} selected contacts?`, BulkDelete)}>
                                {del ? <Loading className="h-5" /> : "Delete"}
                            </button>
                        </>}</p>
                        <div className="grid grid-cols-1 overflow-x-auto whitespace-nowrap">
                            <table className="text-sm text-left rtl:text-right text-gray-500">
                                <thead className="text-xs text-gray-700 uppercase">
                                    <tr>
                                        <th scope="col" className="p-4">
                                            <div className="flex items-center">
                                                <input
                                                    id="checkbox-all-contacts"
                                                    type="checkbox"
                                                    className="hidden"
                                                    onChange={() => {
                                                        if (isSelectedAll) {
                                                            setSelected([])
                                                        } else {
                                                            if (!contactsData.contacts) {
                                                                setSelected([])
                                                            } else {
                                                                setSelected(contactsData.contacts.map((c) => c.id))
                                                            }
                                                        }
                                                    }}
                                                />
                                                <label className="cursor-pointer" htmlFor="checkbox-all-contacts">
                                                    <Checkbox
                                                        checked={isSelectedAll}
                                                    />
                                                </label>
                                            </div>
                                        </th>
                                        <th scope="col" className="px-6 py-3 whitespace-nowrap">
                                            First Name
                                        </th>
                                        <th scope="col" className="px-6 py-3 whitespace-nowrap">
                                            Last Name
                                        </th>
                                        <th scope="col" className="px-6 py-3 whitespace-nowrap">
                                            Email
                                        </th>
                                        <th scope="col" className="px-6 py-3 whitespace-nowrap">
                                            Company
                                        </th>
                                        <th scope="col" className="px-6 py-3 whitespace-nowrap">
                                            Phone
                                        </th>
                                        <th scope="col" className="px-6 py-3 whitespace-nowrap">
                                            Subscribed
                                        </th>
                                        <th scope="col" className="px-6 py-3 whitespace-nowrap">
                                            Campaigns
                                        </th>
                                        <th scope="col" className="px-6 py-3 whitespace-nowrap">
                                            Custom Fields
                                        </th>
                                        <th scope="col" className="px-6 py-3 whitespace-nowrap">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {contactsData.contacts.map((contact, index) => {
                                        const isSelected = selected.some((s) => s === contact.id)
                                        return (
                                            <ContactEntry
                                                key={index}
                                                contact={contact}
                                                index={index}
                                                isSelected={isSelected}
                                                onSelection={() => {
                                                    if (isSelected) {
                                                        setSelected(bef => bef.filter((s) => s !== contact.id))
                                                    } else {
                                                        setSelected(bef => [...bef, contact.id])
                                                    }
                                                }}
                                                onEdit={() => { }}
                                            />
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {contactsData.hasNextPage &&
                            <div className="flex w-full justify-center py-4">
                                <button className={`h-10 w-30 rounded-lg cursor-pointer transition ${contactsData.isLoading ? "bg-blue-200" : "bg-blue-100 hover:bg-blue-200"} flex items-center justify-center text-blue-500`}>
                                    {contactsData.isLoading ? <Loading className="h-5" color={twColors.blue[500]} /> : "Load More"}
                                </button>
                            </div>}
                    </>)}
                </>
            )}
        </div>
        <ContactFilters
            active={filters}
            setActive={setFilters}
            filters={searchProps}
            setFilters={setSearchProps}
            activeCampaign={current_campaign}
            loading={contactsData.isLoading}
        />
        <ContactEdit
            contacts={contactsData.contacts ?? []}
            active={edit}
            setActive={setEdit}
        />
        <ContactsEditBulk
            active={bulkEdit}
            setActive={setBulkEdit}
            selected={selected}
        />
    </>)
}
