// On-theme primitives shared across the campaign settings tabs.
//
// Replaces the legacy off-theme Switch / Title / SubTitle usage. Everything
// here is slate/sky, rounded-md, 12.5px base, h-7 controls — matching the
// rebuilt analytics + campaign-overview chrome.

import React from "react";

/**
 * SettingRow — a labelled setting line. Title + helper text on the left,
 * an arbitrary control (Toggle, Segmented, NumberInput…) on the right.
 * Used for the boolean toggles and inline selects across the tabs.
 */
export function SettingRow({
    title,
    description,
    control,
    children,
}: {
    title: string;
    description?: React.ReactNode;
    control?: React.ReactNode;
    children?: React.ReactNode;
}) {
    return (
        <div className="flex items-start justify-between gap-5 min-w-0">
            <div className="min-w-0 flex-1">
                <p className="text-[12.5px] text-slate-900 font-medium">{title}</p>
                {description && (
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{description}</p>
                )}
                {children}
            </div>
            {control && <div className="shrink-0">{control}</div>}
        </div>
    );
}

/**
 * Legacy default export kept so any stray importer still compiles. Plain
 * justified flex row.
 */
export default function CampaignPreferenceBoolBox({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex justify-between gap-5 items-center min-w-0">
            {children}
        </div>
    );
}

/**
 * Toggle — our small on-theme switch. Sky-600 when on, slate when off.
 * 28px wide track, no library defaults.
 */
export function Toggle({
    value,
    onChange,
    disabled,
    id,
}: {
    value: boolean;
    onChange: (v: boolean) => void;
    disabled?: boolean;
    id?: string;
}) {
    return (
        <button
            type="button"
            id={id}
            role="switch"
            aria-checked={value}
            disabled={disabled}
            onClick={() => onChange(!value)}
            className={`relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sky-100 disabled:opacity-50 ${
                value ? "bg-sky-600" : "bg-slate-200"
            }`}
        >
            <span
                className={`inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform ${
                    value ? "translate-x-[15px]" : "translate-x-[2px]"
                }`}
            />
        </button>
    );
}

/**
 * Segmented — a small on-theme pill group. Active option = bg-sky-600 white;
 * the rest are muted slate. Generic over the option value.
 */
export function Segmented<T extends string>({
    value,
    onChange,
    options,
    className,
}: {
    value: T;
    onChange: (v: T) => void;
    options: { value: T; label: string }[];
    className?: string;
}) {
    return (
        <div
            className={`inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-white p-0.5 ${
                className ?? ""
            }`}
        >
            {options.map((o) => {
                const active = o.value === value;
                return (
                    <button
                        key={o.value}
                        type="button"
                        onClick={() => onChange(o.value)}
                        className={`h-6 px-2.5 rounded text-[11.5px] font-medium transition-colors ${
                            active ? "bg-sky-600 text-white" : "text-slate-500 hover:text-slate-900"
                        }`}
                    >
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
}

/**
 * EmailListInput — chip input for cc/bcc recipients, on-theme. Type an
 * address and press Enter/Tab/comma to add; backspace on an empty field
 * removes the last chip.
 */
export function EmailListInput({
    values,
    onChange,
    placeholder = "name@example.com — Enter to add",
}: {
    values: string[];
    onChange: (values: string[]) => void;
    placeholder?: string;
}) {
    const [draft, setDraft] = React.useState("");

    const commit = () => {
        const v = draft.trim().replace(/,$/, "").trim();
        if (!v) return;
        if (!values.includes(v)) onChange([...values, v]);
        setDraft("");
    };

    return (
        <div className="rounded-md border border-slate-200 bg-white min-h-[34px] px-2 py-1.5 flex flex-wrap items-center gap-1 focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100 transition-colors">
            {values.map((v, i) => (
                <span
                    key={`${v}-${i}`}
                    className="inline-flex items-center gap-1 h-5 pl-1.5 pr-1 rounded bg-sky-50 text-sky-700 text-[11px] font-medium max-w-[calc(100%-4rem)]"
                >
                    <span className="truncate">{v}</span>
                    <button
                        type="button"
                        onClick={() => onChange(values.filter((_, idx) => idx !== i))}
                        aria-label={`Remove ${v}`}
                        className="opacity-70 hover:opacity-100 shrink-0"
                    >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                    </button>
                </span>
            ))}
            <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Tab" || e.key === ",") {
                        if (draft.trim()) {
                            e.preventDefault();
                            commit();
                        }
                    } else if (e.key === "Backspace" && draft === "" && values.length > 0) {
                        e.preventDefault();
                        onChange(values.slice(0, -1));
                    }
                }}
                onBlur={commit}
                placeholder={values.length === 0 ? placeholder : ""}
                className="flex-1 min-w-[120px] h-5 bg-transparent text-[12.5px] text-slate-900 placeholder:text-slate-400 outline-none"
            />
        </div>
    );
}
