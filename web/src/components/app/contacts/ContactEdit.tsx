import type Contact from "@/lib/api/models/app/contacts/Contact";
import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RiAddLine, RiCloseLine } from "@remixicon/react";
import MiniTitle from "../text/MiniTitle";
import MiniInput from "../popup/MiniInput";
import MiniTextArea from "../popup/MiniTextArea";
import CampaignSelector from "../popup/select/CampaignSelector";
import toast from "react-hot-toast";
import useUpdateContact from "@/lib/api/hooks/app/contacts/useUpdateContact";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import BoolField from "../inputs/BoolField";
import BoolFieldTitle from "../inputs/BoolFieldTitle";
import { Loading } from "@/components/loader";

interface CustomField {
    name: string;
    value: string;
}

export default function ContactEdit({
    contacts,
    active,
    setActive,
}: {
    contacts: Contact[],
    active: string,
    setActive: React.Dispatch<React.SetStateAction<string>>,
}) {

    const [body, setBody] = React.useState<Contact | null>(null)
    const [customFields, setCustomFields] = React.useState<CustomField[]>([])
    const [loading, setLoading] = React.useState<boolean>(false)

    const [mouseDownOnButton, setMouseDownOnButton] = React.useState(false);
    const handleMouseDown = () => setMouseDownOnButton(true);
    const handleMouseUp = () => {
        if (mouseDownOnButton) {
            setActive("");
        }
        setMouseDownOnButton(false);
    };

    const contact = React.useMemo(
        () => {
            return contacts.find(c => c.id === active)
        },
        [contacts, active]
    )

    const contactUpdate = useUpdateContact(contact?.id ?? "");

    const ResetBody = React.useCallback(() => {
        setBody(contact ? contact : null)
        setCustomFields(contact ? Object.entries(contact.custom_fields).map(([n, v]) => ({
            name: n,
            value: v,
        })) : [])
    }, [contact])

    React.useEffect(() => {
        ResetBody()
    }, [contact, ResetBody])


    function MakeRecordFromCustomFields(custom_fields: CustomField[]) {
        const newData: Record<string, string> = {}
        custom_fields.forEach(f => {
            newData[f.name] = f.value
        })
        return newData
    }

    const isChangedCustomFields = React.useMemo(() => {
        const newData = MakeRecordFromCustomFields(customFields)
        if (JSON.stringify(newData) !== JSON.stringify(contact?.custom_fields)) {
            return true
        } else {
            return false
        }
    }, [customFields, contact])

    const isChangedCampaigns = React.useMemo(() => {
        if (body?.campaigns.some(c => !contact?.campaigns.some(ca => ca.id === c.id)) || contact?.campaigns.some(c => !body?.campaigns.some(ca => ca.id === c.id))) {
            return true
        } else {
            return false
        }
    }, [contact?.campaigns, body?.campaigns])

    async function SaveChanges() {
        if (!body || !contact) return;
        try {
            setLoading(true)
            const data = {
                ...(contact.first_name !== body.first_name && ({ first_name: body.first_name })),
                ...(contact.last_name !== body.last_name && ({ last_name: body.last_name })),
                ...(contact.email !== body.email && ({ email: body.email })),
                ...(contact.company !== body.company && ({ company: body.company })),
                ...(contact.phone !== body.phone && ({ phone: body.phone })),
                ...(contact.subscribed !== body.subscribed && ({ subscribed: body.subscribed })),
                ...(isChangedCustomFields && (MakeRecordFromCustomFields(customFields))),
                ...(isChangedCampaigns && ({ campaigns: body?.campaigns.map(c => c.id) }))
            }
            await toast.promise(
                contactUpdate.mutateAsync(data),
                {
                    loading: `Updating contact... (${contact.email})`,
                    success: `Contact successfully updated. (${contact.email})`,
                    error: (err: AppError) => buildError(err),
                }
            )
        } finally {
            setLoading(false)
        }
    }

    return (
        <AnimatePresence>
            {(contact && body) &&
                <motion.div
                    key="overlay"
                    onMouseDown={handleMouseDown}
                    onMouseUp={handleMouseUp}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="fixed inset-0 z-[100] flex justify-end bg-slate-950/45"
                >
                    <motion.div
                        key="panel"
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                        initial={{ x: "100%" }}
                        animate={{ x: "0%" }}
                        exit={{ x: "100%" }}
                        transition={{ type: "tween", ease: "easeInOut", duration: 0.35 }}
                        className="flex flex-col p-10 bg-white relative w-[50rem] max-w-[95%] h-full overflow-y-scroll shadow-xl"
                    >
                        <div className="space-y-5">
                            <div className="flex justify-between gap-4 items-center">
                                <h1 className="font-semibold font-poppins text-slate-600 text-lg">Edit Contact ({contact.email})</h1>
                                <button
                                    className="shrink-0 px-2 cursor-pointer text-slate-400 hover:text-slate-300"
                                    onClick={() => {
                                        setActive("");
                                    }}>
                                    <RiCloseLine className="w-5 h-5" />
                                </button>
                            </div>
                            <hr className="text-slate-200" />
                            <div>
                                <MiniTitle>First Name</MiniTitle>
                                <MiniInput
                                    value={body.first_name}
                                    placeholder="e.g. John"
                                    onChange={(e) => {
                                        setBody(bef => bef ? ({
                                            ...bef,
                                            first_name: e.target.value,
                                        }) : null)
                                    }} />
                            </div>
                            <div>
                                <MiniTitle>Last Name</MiniTitle>
                                <MiniInput
                                    value={body.last_name}
                                    placeholder="e.g. Doe"
                                    onChange={(e) => {
                                        setBody(bef => bef ? ({
                                            ...bef,
                                            last_name: e.target.value,
                                        }) : null)
                                    }} />
                            </div>
                            <div>
                                <MiniTitle>Email</MiniTitle>
                                <MiniInput
                                    value={body.email}
                                    placeholder="e.g. name@example.com"
                                    onChange={(e) => {
                                        setBody(bef => bef ? ({
                                            ...bef,
                                            email: e.target.value,
                                        }) : null)
                                    }} />
                            </div>
                            <div>
                                <MiniTitle>Company</MiniTitle>
                                <MiniInput
                                    value={body.company}
                                    placeholder="e.g. Acme Inc."
                                    onChange={(e) => {
                                        setBody(bef => bef ? ({
                                            ...bef,
                                            company: e.target.value,
                                        }) : null)
                                    }} />
                            </div>
                            <div>
                                <MiniTitle>Phone</MiniTitle>
                                <MiniInput
                                    value={body.phone}
                                    placeholder="e.g. +1 (123) 456-7890"
                                    onChange={(e) => {
                                        setBody(bef => bef ? ({
                                            ...bef,
                                            phone: e.target.value,
                                        }) : null)
                                    }} />
                            </div>
                            <div>
                                <MiniTitle>
                                    Custom Fields
                                    <button
                                        onClick={() => {
                                            setCustomFields(bef => [...bef, {
                                                name: "",
                                                value: "",
                                            }])
                                        }}
                                        className="px-2 rounded-lg shrink-0 bg-blue-100 text-blue-600 hover:bg-blue-200 ripple cursor-pointer transition">
                                        <RiAddLine className="w-4" />
                                    </button>
                                </MiniTitle>
                                {customFields.length === 0 ? <>
                                    <p className="text-slate-400 font-poppins">No fields added yet.</p>
                                </> : <>
                                    <div className="space-y-3">
                                        {customFields.map((f, ind) => {
                                            return (
                                                <div className="space-y-2" key={ind}>
                                                    <div className="flex gap-2">
                                                        <MiniInput
                                                            value={f.name}
                                                            placeholder="Field Name"
                                                            onChange={(e) => {
                                                                setCustomFields(bef => bef.map((m, i) => i === ind ? ({
                                                                    ...m,
                                                                    name: e.target.value,
                                                                }) : m
                                                                ))
                                                            }}
                                                        />
                                                        <button
                                                            onClick={() => {
                                                                setCustomFields(bef => bef.filter((_, i) => i !== ind))
                                                            }}
                                                            className="shrink-0 px-2 cursor-pointer ripple transition bg-red-100 hover:bg-red-200 rounded-lg text-red-600">
                                                            <RiCloseLine className="w-4" />
                                                        </button>
                                                    </div>
                                                    <MiniTextArea
                                                        value={f.value}
                                                        onChange={(e) => {
                                                            setCustomFields(bef => bef.map((m, i) => i === ind ? ({
                                                                ...m,
                                                                value: e.target.value,
                                                            }) : m
                                                            ))
                                                        }}
                                                        placeholder="Field Value" />
                                                </div>
                                            )
                                        })}
                                    </div>
                                </>}
                            </div>
                            <div>
                                <MiniTitle>Campaigns</MiniTitle>
                                <CampaignSelector
                                    onAdd={(id, name) => {
                                        setBody(bef => bef ? ({
                                            ...bef, campaigns: [...bef.campaigns, {
                                                id,
                                                name: name ?? "",
                                            }]
                                        }) : null)
                                    }}
                                    onRemove={(id) => {
                                        setBody(bef => bef ? ({ ...bef, campaigns: bef.campaigns.filter(v => v.id !== id) }) : null)
                                    }}
                                    selected={body.campaigns}
                                />
                            </div>
                            <div>
                                <MiniTitle>Additional Fields</MiniTitle>
                                <div className="space-y-3">
                                    <BoolField
                                        name="subscribed"
                                        value={body.subscribed}
                                        onChange={() => {
                                            setBody(bef => bef ? ({
                                                ...bef, subscribed: !bef.subscribed,
                                            }) : null);
                                        }}>
                                        <BoolFieldTitle>Subscribed</BoolFieldTitle>
                                    </BoolField>
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <div className="flex gap-2 relative">
                                    <button
                                        className="bg-slate-200 hover:bg-slate-300 px-3 h-10 text-slate-500 cursor-pointer transition flex items-center justify-center rounded-lg"
                                        onClick={ResetBody}>
                                        Clear
                                    </button>
                                    <button
                                        className={`flex h-10 w-32 ${loading ? "bg-blue-600" : "bg-blue-500 hover:bg-blue-600"} ripple text-white flex items-center justify-center rounded-lg cursor-pointer transition`}
                                        onClick={SaveChanges}>
                                        {loading ? <Loading className="h-5" /> : "Save Changes"}
                                    </button>
                                    {(!isChangedCampaigns && !isChangedCustomFields && contact.first_name === body.first_name && contact.last_name === body.last_name && contact.company === body.company && contact.phone === body.phone && contact.email === body.email && contact.subscribed === body.subscribed) &&
                                        <div className="absolute top-0 left-0 w-full h-full bg-white opacity-40 cursor-not-allowed" />}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            }
        </AnimatePresence>
    )
}
