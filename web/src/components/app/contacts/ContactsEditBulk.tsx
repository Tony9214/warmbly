import MiniInput from '@/components/app/popup/MiniInput';
import CampaignSelector from '@/components/app/popup/select/CampaignSelector';
import Selector from '@/components/app/popup/select/Selector';
import { RiAddLine, RiCloseLine } from '@remixicon/react';
import React from 'react';
import useClickOutside from '@/hooks/useClickOutside';
import SelectMenu from '@/components/app/popup/select/SelectMenu';
import SelectOption from '@/components/app/popup/select/SelectOption';
import MiniTextArea from '@/components/app/popup/MiniTextArea';
import Switch from '@/components/app/Switch';
import { Loading } from '@/components/loader';
import type MiniCampaign from '@/lib/api/models/app/campaigns/MiniCampaign';
import useUpdateContactsBulk from '@/lib/api/hooks/app/contacts/useUpdateContactsBulk';
import toast from 'react-hot-toast';
import type { AppError } from '@/lib/api/client/normalizeError';
import buildError from '@/lib/helper/buildError';
import { AnimatePresence, motion } from 'framer-motion';
import CheckFilter from '../inputs/CheckFilter';

type FieldType = 'ADD' | 'EDIT' | 'DELETE' | 'RENAME'

const FieldTypes: FieldType[] = ["ADD", "EDIT", "DELETE", "RENAME"]

interface Field {
    type: FieldType;
    key: string;
    value: string;
}

function MiniTitle({ children }: { children: React.ReactNode }) {
    return <h1 className="text-slate-500 font-semibold font-sans mb-3 uppercase tracking-wider text-sm flex items-center gap-2">{children}</h1>
}

export default function ContactsEditBulk({
    active,
    setActive,
    selected,
}: {
    active: boolean,
    setActive: React.Dispatch<React.SetStateAction<boolean>>,
    selected: string[],
}) {
    const [campaignsAdd, setCampaignsAdd] = React.useState<MiniCampaign[]>([]);
    const [campaignsRemove, setCampaignsRemove] = React.useState<MiniCampaign[]>([]);
    const [fields, setFields] = React.useState<Field[]>([]);
    const [subscribe, setSubscribe] = React.useState<boolean | null>(null);
    const [loading, setLoading] = React.useState<boolean>(false);

    const updateContactsBulk = useUpdateContactsBulk()

    const [mouseDownOnButton, setMouseDownOnButton] = React.useState(false);
    const handleMouseDown = () => setMouseDownOnButton(true);
    const handleMouseUp = () => {
        if (mouseDownOnButton) {
            setActive(false)
        }
        setMouseDownOnButton(false);
    }

    async function Submit() {
        try {
            setLoading(true)
            const cselected = selected;
            const ccampaignsAdd = campaignsAdd;
            const ccampaignsRemove = campaignsRemove;
            const csubscribe = subscribe;
            const cfields = fields;
            const data = {
                contacts: cselected,
                add_campaigns: ccampaignsAdd.map((c) => c.id),
                remove_campaigns: ccampaignsRemove.map((c) => c.id),
                fields: cfields,
                subscribe: csubscribe ?? undefined,
            }
            await toast.promise(
                updateContactsBulk.mutateAsync(data),
                {
                    loading: "Loading...",
                    success: "Contacts successfully updated.",
                    error: (err: AppError) => buildError(err),
                }
            )
            setActive(false);
        } finally {
            setLoading(false)
        }
    }

    return (
        <AnimatePresence>
            {active && (
                <motion.div
                    key="backdrop"
                    onMouseDown={handleMouseDown}
                    onMouseUp={handleMouseUp}
                    className="fixed inset-0 z-[900] flex justify-end bg-slate-950/45"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                >
                    <motion.div
                        key="panel"
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                        className="flex p-10 flex-col bg-white relative w-200 max-w-[95%] h-full"
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", stiffness: 200, damping: 25 }}
                    >
                        <div onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} className={`fixed inset-0 z-[900] flex justify-end bg-slate-950/45 transition ${selected ? "visible opacity-100" : "invisible opacity-0"}`}>
                            <div onMouseDown={(e) => e.stopPropagation()} onMouseUp={(e) => e.stopPropagation()} className={`flex p-10 flex-col bg-white relative w-200 max-w-[95%] h-full transition-transform ${selected ? "translate-x-0" : "translate-x-100"}`}>
                                <div className='space-y-5'>
                                    <div>
                                        <h1 className='text-lg text-slate-600 font-poppins mb-8 font-semibold'>Edit {selected ? selected.length : 0} selected contact(s)</h1>
                                    </div>
                                    <div>
                                        <MiniTitle>Campaigns to add</MiniTitle>
                                        <CampaignSelector
                                            onAdd={(id, name) => {
                                                setCampaignsAdd(bef => [...bef, {
                                                    id,
                                                    name: name ?? "",
                                                }])
                                            }}
                                            onRemove={(id) => {
                                                setCampaignsAdd(bef => bef.filter(v => v.id !== id))
                                            }}
                                            selected={campaignsAdd}
                                        />
                                    </div>
                                    <div>
                                        <MiniTitle>Campaigns to remove</MiniTitle>
                                        <CampaignSelector
                                            onAdd={(id, name) => {
                                                setCampaignsRemove(bef => [...bef, {
                                                    id,
                                                    name: name ?? "",
                                                }])
                                            }}
                                            onRemove={(id) => {
                                                setCampaignsRemove(bef => bef.filter(v => v.id !== id))
                                            }}
                                            selected={campaignsRemove}
                                        />
                                    </div>
                                    <div>
                                        <MiniTitle>
                                            Custom Fields
                                            {fields.length < 100 &&
                                                <button
                                                    onClick={() => {
                                                        setFields(bef => [...bef, {
                                                            key: "",
                                                            type: "ADD",
                                                            value: "",
                                                        }])
                                                    }}
                                                    className='ripple bg-blue-100 hover:bg-blue-200 transition rounded-lg px-1 text-blue-600 cursor-pointer'>
                                                    <RiAddLine className='w-4' />
                                                </button>}
                                        </MiniTitle>
                                        {fields.length > 0 ?
                                            <div className='space-y-1'>
                                                {fields.map((f, i) => {
                                                    return (
                                                        <FieldEdit
                                                            key={i}
                                                            field={f}
                                                            index={i}
                                                            setFields={setFields}
                                                        />
                                                    )
                                                })}
                                            </div> : <div>
                                                <p className='text-slate-400'>
                                                    No fields added yet.
                                                </p>
                                            </div>}
                                    </div>
                                    <div>
                                        <MiniTitle>
                                            Fields
                                        </MiniTitle>
                                        <CheckFilter
                                            value={subscribe !== null}
                                            setValue={(v) => {
                                                if (v) {
                                                    setSubscribe(true)
                                                } else {
                                                    setSubscribe(null)
                                                }
                                            }}
                                            label="Subscribed"
                                        >
                                            {subscribe !== null && (
                                                <Switch
                                                    id="contact-edit-subscribed"
                                                    value={subscribe}
                                                    onChange={(v) => setSubscribe(v)}
                                                />
                                            )}
                                        </CheckFilter>
                                    </div>
                                    <div className='flex justify-end'>
                                        <div className='relative flex gap-2 items-center'>
                                            <button
                                                className={`bg-slate-200 hover:bg-slate-300 transition w-20 h-10 flex items-center justify-center text-slate-500 rounded-lg cursor-pointer`}
                                                onClick={() => {
                                                    setCampaignsAdd([])
                                                    setCampaignsRemove([])
                                                    setSubscribe(null)
                                                    setFields([])
                                                }}>
                                                Clear
                                            </button>
                                            <button
                                                className={`${loading ? "bg-blue-600" : "bg-blue-500 hover:bg-blue-600"} transition w-32 h-10 flex items-center justify-center text-white rounded-lg cursor-pointer`}
                                                onClick={Submit}>
                                                {loading ? <Loading className='h-4' /> : "Make Changes"}
                                            </button>
                                            {(campaignsAdd.length === 0 && campaignsRemove.length === 0 && fields.length === 0 && subscribe === null) && <div className='bg-white opacity-40 absolute top-0 left-0 w-full h-full cursor-not-allowed' />}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
};

function FieldEdit({
    field,
    setFields,
    index
}: {
    field: Field,
    setFields: React.Dispatch<React.SetStateAction<Field[]>>,
    index: number,
}) {
    const [show, setShow] = React.useState<boolean>(false);
    const dropRef = React.useRef<HTMLDivElement>(null)

    useClickOutside(dropRef, () => setShow(false))
    return (
        <div className='space-y-2'>
            <div className='flex gap-2'>
                <div className='grid grid-cols-2 gap-2 grow'>
                    <MiniInput
                        value={field.key}
                        placeholder='Key'
                        onChange={(e) => {
                            setFields(bef => bef.map((f, i) => i === index ? ({
                                ...f,
                                key: e.target.value,
                            }) : f))
                        }}
                    />
                    <div className='relative' ref={dropRef}>
                        <Selector
                            show={show}
                            setShow={setShow}
                            caret
                        >
                            {field.type}
                        </Selector>
                        <SelectMenu
                            show={show}
                        >
                            {FieldTypes.map((v, ind) => {
                                return (
                                    <SelectOption
                                        key={ind}
                                        selected={field.type === v}
                                        onClick={() => {
                                            setFields(bef => bef.map((x, i) => i === index ? ({
                                                ...x,
                                                type: v,
                                            }) : x));
                                            setShow(false);
                                        }}
                                    >
                                        {v}
                                    </SelectOption>
                                )
                            })}
                        </SelectMenu>
                    </div>
                </div>
                <button
                    className='ripple shrink-0 w-10 flex border border-transparent rounded-lg items-center justify-center bg-red-100 hover:bg-red-200 transition cursor-pointer text-red-500'
                    onClick={() => setFields(bef => bef.filter((_, ind) => ind !== index))}>
                    <RiCloseLine className='w-4' />
                </button>
            </div>
            <MiniTextArea
                value={field.type !== "DELETE" ? field.value : ""}
                disabled={field.type === "DELETE"}
                placeholder='Value'
                onChange={(e) => {
                    setFields(bef => bef.map((v, i) => i === index ? ({
                        ...v,
                        value: e.target.value
                    }) : v))
                }} />
        </div>
    )
}
