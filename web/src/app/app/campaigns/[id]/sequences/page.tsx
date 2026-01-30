import React from "react";
import { useCampaign } from "@/hooks/context/campaign";
import { RiDiscussLine } from "@remixicon/react";
import { Loading } from "@/components/loader";
import SequenceBox from "@/components/app/campaigns/sequences/SequenceBox";
import SequenceView from "@/components/app/campaigns/sequences/SequenceView";
import useSequences from "@/lib/api/hooks/app/campaigns/sequences/useSequences";
import useCreateSequence from "@/lib/api/hooks/app/campaigns/sequences/useCreateSequence";
import toast from "react-hot-toast";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import type Sequence from "@/lib/api/models/app/campaigns/sequences/Sequence";

export default function CampaignSequences() {
    const campaign = useCampaign();
    if (!campaign) {
        throw new Error("CampaignSequences cannot be rendered without a campaign")
    }

    const [load, setLoad] = React.useState<boolean>(false);
    const [select, setSelect] = React.useState<string>("");
    const [newSequences, setNewSequences] = React.useState<Sequence[] | null>()
    const sequencesData = useSequences(campaign.id);

    const createSequence = useCreateSequence(campaign.id);

    async function CreateSequence() {
        if (load) return;
        setLoad(true);
        try {
            const resp = await toast.promise(
                createSequence.mutateAsync,
                {
                    loading: "Creating sequence...",
                    success: "Sequence successfully created.",
                    error: (err: AppError) => buildError(err),
                }
            )
            setNewSequences(bef => bef ? [...bef, resp] : [resp])
        } finally {
            setLoad(false);
        }
    }

    return !sequencesData.isLoading ? (
        <div className="flex flex-col md:flex-row mt-3 gap-10">
            <div className="md:w-60 xl:w-80 shrink-0 space-y-3">
                {sequencesData.data.map((seq, i) => {
                    if (!campaign.sequences || !newSequences || campaign.sequences.length !== newSequences.length) return null;
                    return (
                        <SequenceBox
                            key={seq.id}
                            next={i !== campaign.sequences.length - 1}
                            active={seq.id === select}
                            def_wait={seq.wait_after}
                            wait={newSequences[i].wait_after}
                            setWait={(v) => setNewSequences(bef => bef ? bef.map((s) => s.id === seq.id ? {
                                ...s,
                                wait_after: v,
                            } : s) : null)}
                            onClick={() => setSelect(seq.id)}
                        >{seq.name}</SequenceBox>
                    )
                })}
                {sequencesData.data.length === 0 && (
                    <SequenceBox
                        next={false}
                        active
                        def_wait={10}
                        wait={10}
                        setWait={() => { }}
                        onClick={() => { }}
                    >New Sequence</SequenceBox>
                )}
                {sequencesData.data.length < 5 && (
                    <button
                        className={`flex rounded-lg transition text-blue-700 items-center justify-center w-full p-2.5 ${load ? "bg-blue-200" : "bg-blue-100 hover:bg-blue-200 cursor-pointer"}`}
                        onClick={CreateSequence}
                    >
                        {load ? <Loading className="h-6" /> : "New Sequence"}
                    </button>
                )}
            </div>
            <div className="grow">
                {(() => {
                    const seq = sequencesData.data.find((v) => v.id === select)
                    const seq2 = newSequences?.find((v) => v.id === select)
                    if (!seq || !seq2 || !campaign.sequences) {
                        return (
                            <div className="min-h-100 flex items-center justify-center">
                                <div className="flex flex-col items-center gap-10">
                                    <RiDiscussLine className="w-20 h-20 text-slate-200" />
                                    <h1 className="text-slate-600 font-bold text-3xl max-w-lg">Let's create your first sequence</h1>
                                    <button
                                        className={`flex items-center justify-center py-2.5 px-3 font-sans w-30 rounded-lg text-slate-50 transition ${load ? "bg-blue-600" : "bg-blue-500 hover:bg-blue-600 cursor-pointer"}`}
                                        onClick={CreateSequence}
                                    >
                                        {load ? <Loading className="h-6" /> : "Create Now"}
                                    </button>
                                </div>
                            </div>
                        )
                    }
                    return <SequenceView
                        campaign_id={campaign.id}
                        def_sequence={seq}
                        sequence={seq2}
                        setName={(v) => setNewSequences(bef => bef ? bef.map((s) => s.id === select ? {
                            ...s,
                            name: v,
                        } : s) : null)}
                        setSubject={(v) => setNewSequences(bef => bef ? bef.map((s) => s.id === select ? {
                            ...s,
                            subject: v,
                        } : s) : null)}
                        setBodyPlain={(v) => setNewSequences(bef => bef ? bef.map((s) => s.id === select ? {
                            ...s,
                            body_plain: v,
                        } : s) : null)}
                        setBodyHTML={(v) => setNewSequences(bef => bef ? bef.map((s) => s.id === select ? {
                            ...s,
                            body_html: v,
                        } : s) : null)}
                        setBodySync={(v) => setNewSequences(bef => bef ? bef.map((s) => s.id === select ? {
                            ...s,
                            body_sync: v,
                        } : s) : null)}
                        setBodyCode={(v) => setNewSequences(bef => bef ? bef.map((s) => s.id === select ? {
                            ...s,
                            body_code: v,
                        } : s) : null)}
                        onUpdate={(s) => setNewSequences(bef => bef ? bef.map((seq) => seq.id === s.id ? s : seq) : null)}
                    />
                })()}
            </div>
        </div>
    ) : (
        <div className="mt-3 animate-pulse space-y-3">
            <div className="bg-gray-300 h-40 rounded-lg" />
        </div>
    )
}


