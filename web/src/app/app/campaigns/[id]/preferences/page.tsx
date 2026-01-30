import React from "react";
import { Loading } from "@/components/loader";
import { useCampaign } from "@/hooks/context/campaign";
import type Campaign from "@/lib/api/models/app/campaigns/Campaign";
import CampaignAppearance from "@/components/app/campaigns/preferences/CampaignAppearance";
import useUpdateCampaign from "@/lib/api/hooks/app/campaigns/useUpdateCampaign";
import toast from "react-hot-toast";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import CampaignEmails from "@/components/app/campaigns/preferences/CampaignEmails";
import CampaignContactOrder from "@/components/app/campaigns/preferences/CampaignContactOrder";

export default function CampaignPreferences() {
    const campaign = useCampaign()
    if (!campaign) {
        throw new Error("CampaignPreferences cannot be rendered without a campaign")
    }

    const updateCampaign = useUpdateCampaign(campaign.id);

    const [loading, setLoading] = React.useState<boolean>(false);
    const [activeTab, setActiveTab] = React.useState<string>("tab1");
    const [newData, setNewData] = React.useState<Campaign>(campaign);

    React.useEffect(() => {
        if (!campaign) return;
        setNewData(campaign);
    }, [campaign])

    const tabData = {
        ...(campaign && {
            tab1: {
                title: "Appearance",
                content: <CampaignAppearance campaign={campaign} newCampaign={newData} setNewCampaign={setNewData} />,
            },
            tab2: {
                title: "Campaign Emails",
                content: <CampaignEmails campaign={campaign} newCampaign={newData} setNewCampaign={setNewData} />,
            },
            tab3: {
                title: "Contact Order",
                content: <CampaignContactOrder campaign={campaign} newCampaign={newData} setNewCampaign={setNewData} />,
            },
        }),
    };

    const getChanges = () => {
        if (!newData) return {};
        return {
            ...(newData.name !== campaign.name && { name: newData.name }),
            ...(newData.description !== campaign.description && { description: newData.description }),

            ...(newData.text_only !== campaign.text_only && { text_only: newData.text_only }),
            ...(newData.open_tracking !== campaign.open_tracking && { open_tracking: newData.open_tracking }),
            ...(newData.link_tracking !== campaign.link_tracking && { link_tracking: newData.link_tracking }),

            ...(newData.email_tags !== campaign.email_tags && { email_tags: newData.email_tags }),
            ...(newData.daily_limit !== campaign.daily_limit && { daily_limit: newData.daily_limit }),

            ...(newData.unsubscribe_header !== campaign.unsubscribe_header && { unsubscribe_header: newData.unsubscribe_header }),
            ...(newData.risky_emails !== campaign.risky_emails && { risky_emails: newData.risky_emails }),

            ...(newData.cc !== campaign.cc && { cc: newData.cc }),
            ...(newData.bcc !== campaign.bcc && { cc: newData.bcc }),

            ...(newData.contact_order_by !== campaign.contact_order_by && { contact_order_by: newData.contact_order_by }),
            ...(newData.contact_order_dir !== campaign.contact_order_dir && { contact_order_dir: newData.contact_order_dir }),
            ...(newData.contact_order_field !== campaign.contact_order_field && { contact_order_field: newData.contact_order_field }),
        }
    }

    async function submit() {
        if (loading) return;
        try {
            setLoading(true)
            const data = getChanges();
            toast.promise(
                updateCampaign.mutateAsync(data),
                {
                    loading: "Saving...",
                    success: "Campaign successfully updated.",
                    error: (err: AppError) => buildError(err),
                }
            )
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="block overflow-hidden">
            <div className="flex flex-col md:flex-row overflow-hidden">
                <div className="pr-4 pb-3 md:pb-0 mb-4 md:mb-0 flex md:flex-col items-center justify-center border-b md:border-b-0 md:justify-start md:border-r w-full md:w-70 border-slate-200 space-y-2 md:shrink-0">
                    {Object.keys(tabData).map((key) => (
                        <button
                            key={key}
                            onClick={() => setActiveTab(key)}
                            className={`py-2 m-0 px-3 md:w-full select-none text-left font-medium cursor-pointer transition ${activeTab === key ? "text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
                        >
                            {tabData[key as keyof typeof tabData]?.title}
                        </button>
                    ))}
                </div>
                <div className="grow md:px-8">
                    {tabData[activeTab as keyof typeof tabData]?.content}
                </div>
            </div>
            <div className="flex relative justify-end gap-2 md:px-8 mt-4">
                <button
                    className={`bg-slate-200 select-none ripple transition flex justify-center items-center cursor-pointer ${!loading && "hover:bg-slate-300"} px-3 py-2 rounded-lg text-slate-600`}
                    onClick={() => {
                        setNewData(campaign)
                    }}
                >
                    Reset
                </button>
                <button
                    className={`bg-blue-500 select-none ripple transition w-33 flex justify-center items-center cursor-pointer ${!loading && "hover:bg-blue-600"} px-3 py-2 rounded-lg text-slate-50`}
                    onClick={submit}
                >
                    {loading ? <Loading className="h-6" /> : "Save Changes"}
                </button>
                <div className={`bg-gray-50 absolute transition select-none left-0 top-0 w-full h-full ${Object.keys(getChanges()).length === 0 ? "opacity-60 visible" : "opacity-0 invisible"}`} />
            </div>
        </div>
    )
}



