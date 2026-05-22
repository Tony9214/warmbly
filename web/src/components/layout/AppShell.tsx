// The new app shell.
//
// Layout:
//   ┌──────────────────────────────────────────────────────┐
//   │  [logo]  >  [org]  >  [section]               [⌘K ●] │  AppHeader
//   ├──────────┬───────────────────────────────────────────┤
//   │          │ ╭─── content ──────────────────────────╮  │
//   │  AppNav  │ │                                      │  │
//   │          │ │                                      │  │
//   │          │ │                                      │  │
//   └──────────┴───────────────────────────────────────────┘
//
// The header + sidebar share one sky-coloured chrome layer (SkyChrome).
// The content panel sits in the bottom-right with a rounded top-left
// where it meets the chrome's inner corner. Reads as one continuous
// frame around a clean work surface.

import { Outlet } from "react-router-dom";
import { SkyChrome } from "./SkyChrome";
import { AppHeader } from "./AppHeader";
import { AppNav } from "./AppNav";
import { ShortcutsModal } from "@/components/shared/ShortcutsModal";
import { CommandPalette } from "@/components/shared/CommandPalette";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

export function AppShell() {
    useKeyboardShortcuts();

    return (
        <div className="fixed inset-0 flex flex-col">
            <SkyChrome />

            <div className="relative z-10 flex flex-col h-full">
                <AppHeader />

                <div className="flex-1 flex min-h-0">
                    <AppNav />

                    {/* Content panel — white work surface "tucked" into the
                        inner corner of the L-shape. A 14px right/bottom inset
                        gives the chrome a deliberate window-frame band of
                        visible sky. The soft shadow + top-edge highlight
                        make the panel feel suspended rather than glued on.
                        rounded-tl-3xl (24px) is intentional architecture —
                        smaller radii read as accidental. */}
                    <main
                        className="flex-1 min-w-0 mr-3.5 mb-3.5 rounded-tl-3xl bg-white overflow-hidden relative"
                        style={{
                            boxShadow:
                                "0 -1px 0 0 rgba(255,255,255,0.18) inset, 1px 0 0 0 rgba(255,255,255,0.18) inset, 0 24px 60px -16px rgba(2,32,71,0.55)",
                        }}
                    >
                        <div className="h-full overflow-auto">
                            <Outlet />
                        </div>
                    </main>
                </div>
            </div>

            <ShortcutsModal />
            <CommandPalette />
        </div>
    );
}
