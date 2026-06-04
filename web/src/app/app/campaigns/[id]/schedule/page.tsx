import React from "react";
import { ClockIcon, GlobeIcon } from "lucide-react";
import DateSelect from "@/components/app/campaigns/schedule/ScheduleDateSelect";
import WeekdayBitmask from "@/components/app/campaigns/schedule/WeekdayBitmask";
import { Loading } from "@/components/loader";
import { Label } from "@/components/ui/field";
import {
    PopoverMenu,
    PopoverMenuContent,
    PopoverMenuItem,
    PopoverMenuTrigger,
    SelectButton,
} from "@/components/ui/popover-menu";
import { useCampaign } from "@/hooks/context/campaign";
import type Campaign from "@/lib/api/models/app/campaigns/Campaign";
import useUpdateCampaign from "@/lib/api/hooks/app/campaigns/useUpdateCampaign";
import toast from "react-hot-toast";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import { useUserProfile } from "@/hooks/context/user";
import { timeOptions, to12Hour } from "@/lib/core/time";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <PopoverMenu>
            <PopoverMenuTrigger asChild>
                <SelectButton
                    icon={<ClockIcon className="w-3.5 h-3.5" />}
                    label={to12Hour(value)}
                    className="w-full justify-between"
                />
            </PopoverMenuTrigger>
            <PopoverMenuContent minWidth={160} className="max-h-64 overflow-y-auto">
                {timeOptions.map((t) => (
                    <PopoverMenuItem
                        key={t.value}
                        selected={t.value === value}
                        onSelect={() => onChange(t.value)}
                    >
                        {t.name}
                    </PopoverMenuItem>
                ))}
            </PopoverMenuContent>
        </PopoverMenu>
    );
}

export default function CampaignSchedule() {
    const campaign = useCampaign();
    if (!campaign) {
        throw new Error("CampaignSchedule cannot be rendered without a campaign");
    }

    const u = useUserProfile();
    const updateCampaign = useUpdateCampaign(campaign.id);

    const [loading, setLoading] = React.useState(false);
    const [newData, setNewData] = React.useState<Campaign>(campaign);

    React.useEffect(() => {
        if (!campaign) return;
        setNewData(campaign);
    }, [campaign]);

    const getChanges = (): Partial<Campaign> => {
        if (!newData || !campaign) return {};
        return {
            ...(newData.start_date !== campaign.start_date && { start_date: newData.start_date }),
            ...(newData.end_date !== campaign.end_date && { end_date: newData.end_date }),
            ...(newData.timezone !== campaign.timezone && { timezone: newData.timezone }),
            ...(newData.days !== campaign.days && { days: newData.days }),
            ...(newData.start_time !== campaign.start_time && { start_time: newData.start_time }),
            ...(newData.end_time !== campaign.end_time && { end_time: newData.end_time }),
        };
    };

    async function submit() {
        if (loading || !campaign) return;
        if (newData.days === 0) {
            toast.error("Pick at least one active day.");
            return;
        }
        try {
            setLoading(true);
            await toast.promise(updateCampaign.mutateAsync(getChanges()), {
                loading: "Saving…",
                success: "Campaign successfully updated.",
                error: (err: AppError) => buildError(err),
            });
        } finally {
            setLoading(false);
        }
    }

    if (!campaign || !newData) return null;

    const hasChanges = Object.keys(getChanges()).length > 0;
    const tzLabel =
        u.timezones.find((tz) => tz.name === newData.timezone)?.display_name ?? newData.timezone;

    return (
        <div>
            <div className="space-y-7 max-w-[640px]">
                {/* Timezone */}
                <div>
                    <Label>Sending timezone</Label>
                    <PopoverMenu>
                        <PopoverMenuTrigger asChild>
                            <SelectButton
                                icon={<GlobeIcon className="w-3.5 h-3.5" />}
                                label={tzLabel}
                                className="w-full max-w-[340px] justify-between"
                            />
                        </PopoverMenuTrigger>
                        <PopoverMenuContent minWidth={280} className="max-h-72 overflow-y-auto">
                            {u.timezones.map((tz) => (
                                <PopoverMenuItem
                                    key={tz.name}
                                    selected={tz.name === newData.timezone}
                                    onSelect={() =>
                                        setNewData((bef) => ({ ...bef, timezone: tz.name }))
                                    }
                                >
                                    {tz.display_name}
                                </PopoverMenuItem>
                            ))}
                        </PopoverMenuContent>
                    </PopoverMenu>
                    <p className="text-[11px] text-slate-400 mt-1.5">
                        Sends are scheduled in this zone. Worker IPs spread distribution naturally.
                    </p>
                </div>

                <hr className="border-slate-200/60" />

                {/* Active days */}
                <div>
                    <Label>Active days</Label>
                    <WeekdayBitmask
                        weekdays={WEEKDAYS}
                        value={newData.days}
                        setValue={(v) => setNewData((bef) => ({ ...bef, days: v }))}
                    />
                    <p className="text-[11px] text-slate-400 mt-1.5">
                        Pick at least one day. Defaults to Monday–Friday.
                    </p>
                </div>

                <hr className="border-slate-200/60" />

                {/* Sending window */}
                <div>
                    <Label>Sending window</Label>
                    <div className="grid grid-cols-2 gap-3 max-w-[360px]">
                        <div>
                            <span className="block text-[11px] text-slate-500 mb-1">Start time</span>
                            <TimePicker
                                value={newData.start_time}
                                onChange={(v) => setNewData((bef) => ({ ...bef, start_time: v }))}
                            />
                        </div>
                        <div>
                            <span className="block text-[11px] text-slate-500 mb-1">End time</span>
                            <TimePicker
                                value={newData.end_time}
                                onChange={(v) => setNewData((bef) => ({ ...bef, end_time: v }))}
                            />
                        </div>
                    </div>
                </div>

                <hr className="border-slate-200/60" />

                {/* Run window */}
                <div>
                    <Label>Run window</Label>
                    <div className="grid grid-cols-2 gap-3 max-w-[360px]">
                        <DateSelect
                            title="Start date"
                            value={newData.start_date ?? null}
                            onChange={(v) => setNewData((bef) => ({ ...bef, start_date: v }))}
                        />
                        <DateSelect
                            title="End date"
                            value={newData.end_date ?? null}
                            onChange={(v) => setNewData((bef) => ({ ...bef, end_date: v }))}
                        />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5">
                        Optional bounds for when the campaign may send. Leave blank to run open-ended.
                    </p>
                </div>
            </div>

            <div
                className={`flex justify-end gap-2 mt-6 pt-4 border-t border-slate-200/60 transition-opacity duration-100 ${
                    hasChanges ? "opacity-100" : "opacity-40 pointer-events-none"
                }`}
            >
                <button
                    className="h-7 px-3 text-[12px] font-medium text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-md transition-colors"
                    onClick={() => setNewData(campaign)}
                >
                    Reset
                </button>
                <button
                    className="h-7 px-3 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-[12px] font-medium transition-colors min-w-[110px] inline-flex items-center justify-center"
                    onClick={submit}
                >
                    {loading ? <Loading className="h-4" /> : "Save changes"}
                </button>
            </div>
        </div>
    );
}
