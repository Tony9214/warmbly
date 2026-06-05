// The campaign Step composer (right pane). A full email editor: rich TipTap
// body, subject with variable insert, a template picker + save-as-template
// (reusing the org template library), an Edit/Preview toggle that renders
// {{variables}} + spintax with sample data, and the advisory content score.

import React from "react";
import {
    BookmarkPlusIcon,
    EyeIcon,
    GitBranchIcon,
    Loader2Icon,
    PencilLineIcon,
    SparklesIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import type Sequence from "@/lib/api/models/app/campaigns/sequences/Sequence";
import RichTextEditor, { VariableMenu } from "./RichTextEditor";
import WriteWithAI from "./WriteWithAI";
import ContentScore from "../ContentScore";
import { Label, TextInput } from "@/components/ui/field";
import {
    PopoverMenu,
    PopoverMenuContent,
    PopoverMenuTrigger,
    SelectButton,
} from "@/components/ui/popover-menu";
import useUpdateSequence from "@/lib/api/hooks/app/campaigns/sequences/useUpdateSequence";
import useTemplates from "@/lib/api/hooks/app/templates/useTemplates";
import useCreateTemplate from "@/lib/api/hooks/app/templates/useCreateTemplate";
import { useConfirm } from "@/hooks/context/confirm";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";

const VARIABLES = ["{{.FirstName}}", "{{.LastName}}", "{{.Email}}", "{{.Company}}", "{{.Phone}}"];
const SAMPLE: Record<string, string> = {
    FirstName: "Alex",
    LastName: "Rivera",
    Email: "alex@acme.com",
    Company: "Acme",
    Phone: "+1 555-0100",
};

// Body fields the composer owns. body_sync/body_code are legacy editor-only
// flags (they don't affect sending), so the new composer keeps HTML + plain in
// lockstep and leaves them alone.
type Draft = Pick<Sequence, "name" | "subject" | "body_plain" | "body_html">;

function toDraft(s: Sequence): Draft {
    return { name: s.name, subject: s.subject, body_plain: s.body_plain, body_html: s.body_html };
}

// Derive plain text from the editor HTML so both alternatives ship populated.
function htmlToPlain(html: string): string {
    const withBreaks = html
        .replace(/<\s*br\s*\/?>/gi, "\n")
        .replace(/<\/\s*(p|div|h[1-6]|li|tr)\s*>/gi, "\n");
    if (typeof document === "undefined") return withBreaks.replace(/<[^>]+>/g, "");
    const tmp = document.createElement("div");
    tmp.innerHTML = withBreaks;
    return (tmp.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}

// Preview: expand spintax {a|b} to the first option and fill {{.Vars}} with
// sample values (unknown → empty), matching the send-time render shape.
function renderPreview(s: string): string {
    return s
        .replace(/\{([^{}|]+(?:\|[^{}]+)+)\}/g, (_, g: string) => g.split("|")[0])
        .replace(/\{\{\.(\w+)\}\}/g, (_, k: string) => SAMPLE[k] ?? "");
}

export default function SequenceView({
    campaignId,
    sequence,
    index,
}: {
    campaignId: string;
    sequence: Sequence;
    index: number;
}) {
    const updateSequence = useUpdateSequence(campaignId, sequence.id);
    const createTemplate = useCreateTemplate();
    const confirm = useConfirm();
    const { data: templates } = useTemplates("");

    const [load, setLoad] = React.useState(false);
    const [tab, setTab] = React.useState<"edit" | "preview">("edit");
    const [saveTplOpen, setSaveTplOpen] = React.useState(false);
    const [tplName, setTplName] = React.useState("");

    const [draft, setDraft] = React.useState<Draft>(() => toDraft(sequence));
    React.useEffect(() => {
        setDraft(toDraft(sequence));
        setTab("edit");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sequence.id]);

    const baseline = toDraft(sequence);
    const savable = React.useMemo(
        () => JSON.stringify(baseline) !== JSON.stringify(draft),
        [baseline, draft],
    );
    const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
    const setBody = (htmlText: string) => patch({ body_html: htmlText, body_plain: htmlToPlain(htmlText) });

    async function submit() {
        if (load || !savable) return;
        setLoad(true);
        try {
            const data: Partial<Sequence> = {
                ...(draft.name !== baseline.name && { name: draft.name }),
                ...(draft.subject !== baseline.subject && { subject: draft.subject }),
                ...(draft.body_plain !== baseline.body_plain && { body_plain: draft.body_plain }),
                ...(draft.body_html !== baseline.body_html && { body_html: draft.body_html }),
            };
            await toast.promise(updateSequence.mutateAsync(data), {
                loading: "Saving step…",
                success: "Step saved.",
                error: (err: AppError) => buildError(err),
            });
        } finally {
            setLoad(false);
        }
    }

    function applyTemplate(t: { name: string; subject: string; body_html: string; body_plain: string }) {
        const apply = () => {
            patch({
                subject: t.subject || draft.subject,
                body_html: t.body_html || (t.body_plain ? `<p>${t.body_plain.replace(/\n/g, "</p><p>")}</p>` : ""),
                body_plain: t.body_plain || htmlToPlain(t.body_html),
            });
            toast.success(`Applied "${t.name}"`);
        };
        const dirty = draft.subject.trim() || htmlToPlain(draft.body_html).trim();
        if (dirty) {
            confirm.show(`Replace this step's content with the "${t.name}" template?`, apply);
        } else {
            apply();
        }
    }

    async function saveAsTemplate() {
        const name = tplName.trim();
        if (!name) return;
        await toast.promise(
            createTemplate.mutateAsync({
                name,
                subject: draft.subject,
                body_html: draft.body_html,
                body_plain: draft.body_plain,
            }),
            { loading: "Saving template…", success: "Saved to template library.", error: (e: AppError) => buildError(e) },
        );
        setSaveTplOpen(false);
        setTplName("");
    }

    return (
        <div className="rounded-md border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">
                        Step {index + 1}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-slate-400">Compose the email this step sends.</p>
                </div>
                <div className="flex flex-wrap shrink-0 items-center gap-2">
                    {/* Template picker */}
                    <PopoverMenu>
                        <PopoverMenuTrigger asChild>
                            <SelectButton icon={<SparklesIcon className="w-3.5 h-3.5" />} label="Templates" />
                        </PopoverMenuTrigger>
                        <PopoverMenuContent minWidth={260} className="max-h-72 overflow-y-auto p-1">
                            {(templates ?? []).length === 0 ? (
                                <div className="px-2.5 py-3 text-center text-[11.5px] text-slate-400">
                                    No templates yet. Save one below.
                                </div>
                            ) : (
                                (templates ?? []).map((t) => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => applyTemplate(t)}
                                        className="block w-full rounded px-2.5 py-1.5 text-left hover:bg-slate-100"
                                    >
                                        <div className="truncate text-[12.5px] font-medium text-slate-800">{t.name}</div>
                                        <div className="truncate text-[11px] text-slate-400">{t.subject || "No subject"}</div>
                                    </button>
                                ))
                            )}
                        </PopoverMenuContent>
                    </PopoverMenu>

                    {/* Save as template */}
                    <PopoverMenu open={saveTplOpen} onOpenChange={setSaveTplOpen}>
                        <PopoverMenuTrigger asChild>
                            <button
                                type="button"
                                title="Save this step as a reusable template"
                                className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white text-[12px] font-medium text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900"
                            >
                                <BookmarkPlusIcon className="w-3.5 h-3.5" />
                                Save as template
                            </button>
                        </PopoverMenuTrigger>
                        <PopoverMenuContent minWidth={240} className="p-2">
                            <Label>Template name</Label>
                            <div className="flex items-center gap-1.5">
                                <TextInput
                                    value={tplName}
                                    onChange={setTplName}
                                    placeholder="e.g. Cold intro v1"
                                    className="flex-1"
                                />
                                <button
                                    type="button"
                                    onClick={saveAsTemplate}
                                    disabled={!tplName.trim() || createTemplate.isPending}
                                    className="h-7 px-2.5 rounded-md bg-sky-600 text-[12px] font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                                >
                                    {createTemplate.isPending ? <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> : "Save"}
                                </button>
                            </div>
                        </PopoverMenuContent>
                    </PopoverMenu>

                    <WriteWithAI
                        onInsert={(text) => {
                            const html = `<p>${text
                                .replace(/&/g, "&amp;")
                                .replace(/</g, "&lt;")
                                .replace(/>/g, "&gt;")
                                .replace(/\n{2,}/g, "</p><p>")
                                .replace(/\n/g, "<br />")}</p>`;
                            setBody(draft.body_html ? `${draft.body_html}${html}` : html);
                        }}
                    />
                    <div className="h-4 w-px bg-slate-200" />
                    <button
                        type="button"
                        onClick={() => setDraft(toDraft(sequence))}
                        disabled={!savable || load}
                        className="h-7 px-2.5 rounded-md border border-slate-200 bg-white text-[12px] font-medium text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900 disabled:opacity-40"
                    >
                        Reset
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={!savable || load}
                        className="h-7 px-3 rounded-md bg-sky-600 text-[12px] font-medium text-white transition-colors hover:bg-sky-700 inline-flex items-center gap-1.5 disabled:opacity-40"
                    >
                        {load && <Loader2Icon className="w-3 h-3 animate-spin" />}
                        Save changes
                    </button>
                </div>
            </div>

            <div className="space-y-4 p-3">
                <div>
                    <Label>Step name</Label>
                    <TextInput value={draft.name} onChange={(v) => patch({ name: v })} placeholder={`Step ${index + 1}`} />
                    <p className="mt-1.5 text-[10.5px] text-slate-400">Internal label only — recipients never see it.</p>
                </div>

                <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                        <Label className="mb-0">Subject</Label>
                        <VariableMenu variables={VARIABLES} onPick={(v) => patch({ subject: draft.subject + v })} />
                    </div>
                    <TextInput value={draft.subject} onChange={(v) => patch({ subject: v })} placeholder="Quick question, {{.FirstName}}" />
                </div>

                <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                        <Label className="mb-0">Body</Label>
                        <div className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 p-0.5">
                            <TabBtn active={tab === "edit"} onClick={() => setTab("edit")} icon={<PencilLineIcon className="w-3 h-3" />}>
                                Edit
                            </TabBtn>
                            <TabBtn active={tab === "preview"} onClick={() => setTab("preview")} icon={<EyeIcon className="w-3 h-3" />}>
                                Preview
                            </TabBtn>
                        </div>
                    </div>
                    {tab === "edit" ? (
                        <RichTextEditor
                            key={sequence.id}
                            html={draft.body_html}
                            onChange={setBody}
                            variables={VARIABLES}
                            placeholder="Hi {{.FirstName}}, …"
                        />
                    ) : (
                        <div className="rounded-md border border-slate-200 bg-white">
                            <div className="border-b border-slate-200/70 px-3 py-2 text-[12.5px]">
                                <span className="text-slate-400">Subject: </span>
                                <span className="text-slate-800">{renderPreview(draft.subject) || "—"}</span>
                            </div>
                            <div
                                className="tiptap-body min-h-[200px] px-3 py-2.5 text-[13px] leading-relaxed text-slate-800"
                                dangerouslySetInnerHTML={{ __html: renderPreview(draft.body_html) || '<p class="text-slate-300">Nothing to preview yet.</p>' }}
                            />
                            <p className="border-t border-slate-200/70 px-3 py-1.5 text-[10.5px] text-slate-400">
                                Preview uses sample data ({SAMPLE.FirstName} at {SAMPLE.Company}); spintax shows the first option.
                            </p>
                        </div>
                    )}
                </div>

                {index > 0 && (
                    <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                        <GitBranchIcon className="mt-0.5 w-3.5 h-3.5 shrink-0 text-slate-400" />
                        <p className="text-[11px] leading-relaxed text-slate-500">
                            Follow-ups thread on the previous step&apos;s subject. Change this subject and the follow-up
                            starts a new thread instead of replying in the existing one.
                        </p>
                    </div>
                )}

                <ContentScore subject={draft.subject} bodyHtml={draft.body_html} bodyPlain={draft.body_plain} />
            </div>
        </div>
    );
}

function TabBtn({
    active,
    onClick,
    icon,
    children,
}: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`h-6 px-2 inline-flex items-center gap-1 rounded text-[11.5px] font-medium transition-colors ${
                active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
        >
            {icon}
            {children}
        </button>
    );
}
