// Sky chrome — the painted backdrop behind sidebar + header.
//
// Design intent: the work surface (white content panel) is the focus;
// the chrome is the sky around the window. Light should pull the eye
// toward the work, not away from it.
//
// What's painted, in order from back to front:
//
//   1. Base gradient. Rich evening sky on the upper-left (where the
//      logo sits), brightening toward the bottom-right where the
//      content panel's corner is. The brightness gradient = a soft
//      directional cue.
//
//   2. Warm bloom near the inner corner. Like late sun reflecting off
//      the white panel back into the chrome.
//
//   3. Cool wash over the sidebar mid-section. Adds depth without
//      changing perceived hue.
//
//   4. Faint noise overlay. Stops the gradient from looking like
//      plastic / a Tailwind hello-world. Just enough texture for the
//      eye to register without reading as "grain."
//
// All layers are absolutely positioned + pointer-events-none so they
// never interfere with input.

import React from "react";

export function SkyChrome() {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* 1. Base gradient — rich top-left → bright bottom-right. */}
            <div
                className="absolute inset-0"
                style={{
                    background:
                        "linear-gradient(135deg, #0c4a6e 0%, #0b3b5a 12%, #075985 28%, #0369a1 50%, #0284c7 72%, #38bdf8 100%)",
                }}
            />

            {/* 2. Warm bloom near the inner corner — pulls light onto the
                content panel. Big, soft, low opacity so it reads as ambient
                rather than a spotlight. */}
            <div
                className="absolute"
                style={{
                    bottom: "-200px",
                    right: "-160px",
                    width: "780px",
                    height: "780px",
                    background:
                        "radial-gradient(circle, rgba(254,243,199,0.18) 0%, rgba(186,230,253,0.10) 30%, rgba(56,189,248,0.04) 55%, transparent 75%)",
                    filter: "blur(20px)",
                }}
            />

            {/* 3. Cool wash over the upper-left — depth in the dark zone
                without changing the apparent colour. */}
            <div
                className="absolute"
                style={{
                    top: "-140px",
                    left: "-140px",
                    width: "520px",
                    height: "520px",
                    background:
                        "radial-gradient(circle, rgba(15,23,42,0.35) 0%, rgba(15,23,42,0.10) 50%, transparent 75%)",
                    filter: "blur(40px)",
                }}
            />

            {/* 4. A single very faint cloud suggestion drifting between
                the two extremes. Don't add more; the auth page is the
                cinematic version, this is its quiet sibling. */}
            <div
                className="absolute"
                style={{
                    top: "32%",
                    left: "18%",
                    width: "320px",
                    height: "140px",
                    background: "rgba(255,255,255,0.55)",
                    borderRadius: "50% 50% 12% 12%",
                    filter: "blur(36px)",
                    opacity: 0.18,
                }}
            />

            {/* 5. Hairline noise — pure CSS, no asset. Keeps the gradient
                from feeling synthetic at large sizes. */}
            <div
                className="absolute inset-0"
                style={{
                    backgroundImage:
                        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.04 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
                    backgroundSize: "180px 180px",
                    opacity: 0.55,
                    mixBlendMode: "overlay",
                }}
            />
        </div>
    );
}
