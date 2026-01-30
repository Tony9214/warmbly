import { useCampaign } from "@/hooks/context/campaign";
import TaskPreview from "@/components/app/campaigns/TaskPreview";

export default function CampaignPreview() {
    const campaign = useCampaign();

    if (!campaign) {
        return (
            <div className="animate-pulse space-y-4">
                <div className="bg-gray-200 h-64 rounded-xl" />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content - Analytics placeholder */}
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Campaign Analytics</h2>
                    <p className="text-gray-500 text-sm">Analytics coming soon...</p>
                </div>
            </div>

            {/* Sidebar - Live Task Preview */}
            <div className="lg:col-span-1">
                <TaskPreview
                    campaignId={campaign.id}
                    campaignStatus={campaign.status}
                />
            </div>
        </div>
    );
}
