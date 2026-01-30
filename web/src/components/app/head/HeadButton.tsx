import type React from "react";

export default function HeadButton({
    children,
    onClick,
    white,
}: {
    children: React.ReactNode,
    onClick: () => Promise<void> | void,
    white?: boolean,
}) {
    return (
        <button onClick={onClick} className={`ripple px-4 py-2 cursor-pointer shadow-md rounded-md font-sans transition flex item-center gap-1 select-none ${white ? "border border-gray-200 bg-white hover:bg-slate-50 text-slate-600" : "text-gray-50 bg-blue-500 hover:bg-blue-600"}`}>
            {children}
        </button>
    )
}
