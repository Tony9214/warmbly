// Cursor — one teammate's live pointer, positioned in screen space by the layer
// that renders it (canvas or page). A short CSS transition smooths the gaps
// between throttled frames so movement reads as continuous.

import React from "react";

export default function Cursor({
    color,
    name,
    left,
    top,
}: {
    color: string;
    name: string | null;
    left: number;
    top: number;
}) {
    return (
        <div
            className="pointer-events-none absolute left-0 top-0 transition-transform duration-75 ease-linear will-change-transform"
            style={{ transform: `translate(${left}px, ${top}px)` }}
        >
            <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                style={{ filter: "drop-shadow(0 1px 1.5px rgba(15,23,42,0.25))" }}
            >
                <path
                    d="M2 2 L2 14 L5.6 10.6 L8 16 L10.6 14.9 L8.2 9.6 L13 9.6 Z"
                    fill={color}
                    stroke="white"
                    strokeWidth="1.1"
                    strokeLinejoin="round"
                />
            </svg>
            {name ? (
                <span
                    className="absolute left-3.5 top-3.5 max-w-[140px] truncate rounded-full px-1.5 py-0.5 text-[10.5px] font-medium text-white shadow-sm"
                    style={{ backgroundColor: color }}
                >
                    {name}
                </span>
            ) : null}
        </div>
    );
}
