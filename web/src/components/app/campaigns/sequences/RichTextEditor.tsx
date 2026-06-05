// Rich email-body editor for campaign Steps, built on TipTap (no deprecated
// execCommand). Controlled by an HTML string; emits HTML on change. Ships a
// house-theme toolbar (headings, bold/italic/underline/strike, lists, link), a
// one-click {{variable}} inserter, and a spintax `{a|b}` helper. Personalization
// tokens are just text, so they survive serialization untouched.

import React from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Underline from "@tiptap/extension-underline";
import Strike from "@tiptap/extension-strike";
import Heading from "@tiptap/extension-heading";
import Link from "@tiptap/extension-link";
import { BulletList, OrderedList, ListItem } from "@tiptap/extension-list";
import {
    BoldIcon,
    ItalicIcon,
    UnderlineIcon,
    StrikethroughIcon,
    Heading2Icon,
    ListIcon,
    ListOrderedIcon,
    Link2Icon,
    BracesIcon,
    ShuffleIcon,
    CheckIcon,
    XIcon,
    ChevronDownIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import useClickOutside from "@/hooks/useClickOutside";

export default function RichTextEditor({
    html,
    onChange,
    variables,
    placeholder,
}: {
    html: string;
    onChange: (html: string) => void;
    variables: string[];
    placeholder?: string;
}) {
    const editor = useEditor({
        extensions: [
            Document,
            Paragraph,
            Text,
            Bold,
            Italic,
            Underline,
            Strike,
            Heading.configure({ levels: [2, 3] }),
            BulletList,
            OrderedList,
            ListItem,
            Link.configure({ openOnClick: false, autolink: true }),
        ],
        content: html || "",
        editorProps: {
            attributes: {
                class: "tiptap-body min-h-[260px] px-3 py-2.5 text-[13px] leading-relaxed text-slate-800 focus:outline-none",
            },
        },
        onUpdate: ({ editor }) => onChange(editor.getHTML()),
    });

    // Keep the editor in sync when the value changes from outside (template
    // applied, step switched, reset) without clobbering the user's caret on
    // their own edits.
    React.useEffect(() => {
        if (!editor) return;
        const current = editor.getHTML();
        if (html !== current) {
            editor.commands.setContent(html || "", { emitUpdate: false });
        }
    }, [html, editor]);

    if (!editor) return null;

    return (
        <div className="rounded-md border border-slate-200 bg-white focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100 transition-colors">
            <Toolbar editor={editor} variables={variables} />
            <div className="relative">
                <EditorContent editor={editor} />
                {placeholder && editor.isEmpty && (
                    <p className="pointer-events-none absolute left-3 top-2.5 text-[13px] text-slate-300 select-none">
                        {placeholder}
                    </p>
                )}
            </div>
        </div>
    );
}

function Toolbar({ editor, variables }: { editor: Editor; variables: string[] }) {
    const [linkOpen, setLinkOpen] = React.useState(false);
    const [linkUrl, setLinkUrl] = React.useState("");

    const applyLink = () => {
        const url = linkUrl.trim();
        if (url) {
            editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
        } else {
            editor.chain().focus().unsetLink().run();
        }
        setLinkOpen(false);
        setLinkUrl("");
    };

    return (
        <div className="relative flex flex-wrap items-center gap-0.5 border-b border-slate-200/70 px-1.5 py-1">
            <Btn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
                <BoldIcon className="w-3.5 h-3.5" />
            </Btn>
            <Btn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
                <ItalicIcon className="w-3.5 h-3.5" />
            </Btn>
            <Btn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
                <UnderlineIcon className="w-3.5 h-3.5" />
            </Btn>
            <Btn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
                <StrikethroughIcon className="w-3.5 h-3.5" />
            </Btn>
            <Divider />
            <Btn
                active={editor.isActive("heading", { level: 2 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                title="Heading"
            >
                <Heading2Icon className="w-3.5 h-3.5" />
            </Btn>
            <Btn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">
                <ListIcon className="w-3.5 h-3.5" />
            </Btn>
            <Btn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">
                <ListOrderedIcon className="w-3.5 h-3.5" />
            </Btn>
            <Btn
                active={editor.isActive("link")}
                onClick={() => {
                    setLinkUrl(editor.getAttributes("link").href ?? "");
                    setLinkOpen((o) => !o);
                }}
                title="Link"
            >
                <Link2Icon className="w-3.5 h-3.5" />
            </Btn>
            <Divider />
            <VariableMenu onPick={(v) => editor.chain().focus().insertContent(v).run()} variables={variables} />
            <Btn
                onClick={() => editor.chain().focus().insertContent("{option one|option two}").run()}
                title="Insert spintax — randomly picks one option per send"
            >
                <ShuffleIcon className="w-3.5 h-3.5" />
            </Btn>

            <AnimatePresence>
                {linkOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.12 }}
                        className="absolute left-1.5 top-full z-20 mt-1 flex items-center gap-1 rounded-md border border-slate-200 bg-white p-1 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.18)]"
                    >
                        <input
                            autoFocus
                            value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    applyLink();
                                } else if (e.key === "Escape") {
                                    setLinkOpen(false);
                                }
                            }}
                            placeholder="https://…"
                            className="h-7 w-56 rounded border border-slate-200 px-2 text-[12px] text-slate-800 outline-none focus:border-sky-400"
                        />
                        <button
                            type="button"
                            onClick={applyLink}
                            className="size-7 inline-flex items-center justify-center rounded text-emerald-600 hover:bg-emerald-50"
                            title="Apply"
                        >
                            <CheckIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setLinkOpen(false)}
                            className="size-7 inline-flex items-center justify-center rounded text-slate-400 hover:bg-slate-100"
                            title="Cancel"
                        >
                            <XIcon className="w-3.5 h-3.5" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function Btn({
    active,
    onClick,
    title,
    children,
}: {
    active?: boolean;
    onClick: () => void;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            title={title}
            aria-pressed={active}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
            className={`size-7 inline-flex items-center justify-center rounded transition-colors ${
                active ? "bg-sky-50 text-sky-700" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            }`}
        >
            {children}
        </button>
    );
}

function Divider() {
    return <span className="mx-0.5 h-4 w-px bg-slate-200" />;
}

// Shared variable inserter — a compact menu of personalization tokens.
export function VariableMenu({ onPick, variables }: { onPick: (token: string) => void; variables: string[] }) {
    const [open, setOpen] = React.useState(false);
    const ref = React.useRef<HTMLDivElement>(null);
    useClickOutside(ref, () => setOpen(false));
    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setOpen((o) => !o)}
                title="Insert a personalization variable"
                className="h-7 px-1.5 inline-flex items-center gap-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
                <BracesIcon className="w-3.5 h-3.5" />
                <ChevronDownIcon className="w-3 h-3" />
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.12 }}
                        className="absolute left-0 top-full z-20 mt-1 w-44 rounded-md border border-slate-200 bg-white py-1 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.18)]"
                    >
                        {variables.map((v) => (
                            <button
                                key={v}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                    onPick(v);
                                    setOpen(false);
                                }}
                                className="block w-full px-2.5 py-1.5 text-left font-mono text-[11.5px] text-slate-700 hover:bg-slate-100"
                            >
                                {v}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
