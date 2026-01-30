import { Link, Outlet, useLocation, useParams } from "react-router-dom";
import useCampaign from "@/lib/api/hooks/app/campaigns/useCampaign";
import { CampaignContext } from "@/hooks/context/campaign";

export default function CampaignLayout() {
    const location = useLocation()
    const { id } = useParams()
    const { pathname } = location;
    const campaignData = useCampaign(id ?? "")

    const tabData = {
        "Analytics": "",
        "Leads": "/leads",
        "Sequences": "/sequences",
        "Schedule": "/schedule",
        "Preferences": "/preferences"
    }

    return (
        <>
            {!campaignData.isLoading ? (
                <div className="animate-pulse w-full space-y-3 md:px-4">
                    <div className="bg-gray-300 h-7 rounded-lg mb-4" />
                    <div className="bg-gray-300 h-12 rounded-lg" />
                    <div className="bg-gray-300 h-12 rounded-lg" />
                    <div className="bg-gray-300 h-12 rounded-lg" />
                    <div className="bg-gray-300 h-12 rounded-lg" />
                </div>
            ) : (
                <CampaignContext.Provider value={campaignData.data}>
                    <div className="md:px-4">
                        <div className="mb-5">
                            <h1 className="text-slate-600 font-bold font-inter text-2xl mb-4">{campaignData.data.name}</h1>
                            <p className="text-slate-400 text-sm font-inter">ID: {campaignData.data.id}</p>
                        </div>
                        <div className="flex space-x-4 pb-3 border-b border-gray-200 mb-4 overflow-x-scroll no-scrollbar">
                            {Object.entries(tabData).map((key) => {
                                const fullPath = `/app/campaigns/${id}${key[1]}`;
                                const isActive = pathname.replaceAll("/", "") === fullPath.replaceAll("/", "");
                                return (
                                    <Link
                                        key={key[1]}
                                        to={fullPath}
                                        className={`py-1 px-3 font-medium cursor-pointer rounded-lg transition ${isActive
                                            ? "bg-blue-100 text-blue-600"
                                            : "hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                                            }`}
                                    >
                                        {key[0]}
                                    </Link>
                                );
                            })}
                        </div>
                        <Outlet />
                    </div>
                </CampaignContext.Provider>
            )}
        </>
    )
}
