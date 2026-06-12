// Shared email content editor: a subject field with variable insert, and a body
// with an Edit/Preview toggle that renders {{variables}}, conditionals, and
// spintax through the real send engine (with an instant local fallback) plus
// template-validity warnings. Used by BOTH the step composer (SequenceView) and
// each A/B variant (StepEmailArms), so a variant is edited and previewed exactly
// like the main email.

import React from "react";
import { AlertCircleIcon, EyeIcon, PencilLineIcon } from "lucide-react";
import RichTextEditor, { VariableMenu } from "./RichTextEditor";
import { useTemplatePreview } from "@/lib/api/hooks/app/campaigns/useTemplatePreview";
import type { TemplatePreview } from "@/lib/api/client/app/campaigns/previewTemplate";
import { Label, TextInput } from "@/components/ui/field";
import { VARIABLES, SAMPLE, htmlToPlain, renderPreview, templateIssue } from "./emailPreview";

export default function EmailContentEditor({
    subject,
    onSubjectChange,
    bodyHtml,
    onBodyChange,
    subjectPlaceholder = "Quick question, {{.FirstName}}",
    bodyPlaceholder = "Hi {{.FirstName}}, …",
}: {
    subject: string;
    onSubjectChange: (value: string) => void;
    bodyHtml: string;
    onBodyChange: (html: string, plain: string) => void;
    subjectPlaceholder?: string;
    bodyPlaceholder?: string;
}) {
    const [tab, setTab] = React.useState<"edit" | "preview">("edit");

    const previewMut = useTemplatePreview();
    const runPreview = previewMut.mutateAsync;
    const [serverPreview, setServerPreview] = React.useState<TemplatePreview | null>(null);
    React.useEffect(() => {
        if (tab !== "preview") return;
        const t = setTimeout(() => {
            runPreview({ subject, body_html: bodyHtml, body_plain: htmlToPlain(bodyHtml) })
                .then(setServerPreview)
                .catch(() => setServerPreview(null));
        }, 250);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, subject, bodyHtml]);

    const tplIssue = templateIssue(subject) || templateIssue(bodyHtml) || templateIssue(htmlToPlain(bodyHtml));

    return (
        <>
            <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                    <Label className="mb-0">Subject</Label>
                    <VariableMenu variables={VARIABLES} onPick={(v) => onSubjectChange(subject + v)} />
                </div>
                <TextInput value={subject} onChange={onSubjectChange} placeholder={subjectPlaceholder} />
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
                        html={bodyHtml}
                        onChange={(html) => onBodyChange(html, htmlToPlain(html))}
                        variables={VARIABLES}
                        placeholder={bodyPlaceholder}
                    />
                ) : (
                    <div className="rounded-md border border-slate-200 bg-white">
                        <div className="border-b border-slate-200/70 px-3 py-2 text-[12.5px]">
                            <span className="text-slate-400">Subject: </span>
                            <span className="text-slate-800">{(serverPreview?.subject ?? renderPreview(subject)) || "—"}</span>
                        </div>
                        <div
                            className="tiptap-body min-h-[200px] px-3 py-2.5 text-[13px] leading-relaxed text-slate-800"
                            dangerouslySetInnerHTML={{
                                __html: (serverPreview?.body_html ?? renderPreview(bodyHtml)) || '<p class="text-slate-300">Nothing to preview yet.</p>',
                            }}
                        />
                        <p className="border-t border-slate-200/70 px-3 py-1.5 text-[10.5px] text-slate-400">
                            Rendered with the real send engine against sample data ({SAMPLE.FirstName} at {SAMPLE.Company}) — conditionals, functions, and spintax all run.
                        </p>
                    </div>
                )}
                {(serverPreview?.errors?.length ?? 0) > 0 ? (
                    <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-rose-600">
                        <AlertCircleIcon className="mt-px w-3.5 h-3.5 shrink-0" />
                        <span>{serverPreview!.errors!.join(" · ")} — fix before sending.</span>
                    </p>
                ) : tplIssue ? (
                    <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-amber-600">
                        <AlertCircleIcon className="w-3.5 h-3.5 shrink-0" />
                        {tplIssue} It&apos;ll fall back to plain text — fix it before sending.
                    </p>
                ) : null}
                {(serverPreview?.unresolved?.length ?? 0) > 0 && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-600">
                        <AlertCircleIcon className="mt-px w-3.5 h-3.5 shrink-0" />
                        <span>
                            These won&apos;t resolve and would send literally:{" "}
                            <span className="font-mono">{serverPreview!.unresolved!.join(", ")}</span>
                        </span>
                    </p>
                )}
            </div>
        </>
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
