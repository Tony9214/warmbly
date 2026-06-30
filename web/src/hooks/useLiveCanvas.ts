// useLiveCanvas — live collaboration for a shared @xyflow canvas. It composes the
// generic live-cursor transport (useLiveCursors) with a second ephemeral stream
// for card drags ("live:node"), so teammates see both each other's pointers and
// each other's nodes moving in real time. Coordinates are flow-space.

import React from "react";
import { useSocket } from "./context/socket";
import { useUserProfile } from "./context/user";
import { useAppStore } from "@/stores";
import { useLiveCursors, type LiveCursors } from "./useLiveCursors";

export { cursorColor } from "./useLiveCursors";
export type { RemoteCursor } from "./useLiveCursors";

// ~22 Hz, matching the cursor stream: smooth, well under the channel budget.
const NODE_INTERVAL_MS = 45;

export interface LiveCanvas extends LiveCursors {
    /** Broadcast a node position; dragging=false sends immediately (final spot). */
    pushNode: (id: string, x: number, y: number, dragging: boolean) => void;
}

export function useLiveCanvas(
    resource: string | null,
    opts: {
        enabled: boolean;
        onRemoteNode?: (id: string, x: number, y: number, dragging: boolean, by: string) => void;
    },
): LiveCanvas {
    const cursors = useLiveCursors(resource, { enabled: opts.enabled });

    const { isConnected, subscribeToChannel, pushToChannel } = useSocket();
    const orgId = useAppStore((s) => s.currentOrganization?.id ?? null);
    const { user } = useUserProfile();

    const resourceRef = React.useRef(resource);
    resourceRef.current = resource;
    const orgRef = React.useRef(orgId);
    orgRef.current = orgId;
    const activeRef = React.useRef(cursors.active);
    activeRef.current = cursors.active;
    const selfRef = React.useRef<string | null>(user?.id ?? null);
    selfRef.current = user?.id ?? null;
    const onRemoteNodeRef = React.useRef(opts.onRemoteNode);
    onRemoteNodeRef.current = opts.onRemoteNode;

    // Subscribe to teammates' node drags. (Cursor frames are handled by the
    // cursor hook; this only adds the node stream.) The server excludes the
    // sender, but a second tab of the same user would echo, so filter self.
    React.useEffect(() => {
        if (!isConnected || !orgId) return;
        const topic = `org:${orgId}`;
        return subscribeToChannel(topic, "LIVE_NODE", (p) => {
            const by = typeof p.user_id === "string" ? p.user_id : "";
            if (!by || by === selfRef.current) return;
            if (resourceRef.current && p.resource !== resourceRef.current) return;
            if (typeof p.id !== "string") return;
            onRemoteNodeRef.current?.(p.id, Number(p.x) || 0, Number(p.y) || 0, p.dragging === true, by);
        });
    }, [isConnected, orgId, subscribeToChannel]);

    const rawPush = React.useCallback(
        (event: string, payload: Record<string, unknown>) => {
            const o = orgRef.current;
            if (!o) return;
            pushToChannel(`org:${o}`, event, payload);
        },
        [pushToChannel],
    );

    // Node-drag throttle, keyed by node id so two nodes dragged in quick
    // succession don't drop each other's trailing frame.
    const nodeLastSent = React.useRef<Map<string, number>>(new Map());
    const nodeTimers = React.useRef<Map<string, number>>(new Map());

    const pushNode = React.useCallback(
        (id: string, x: number, y: number, dragging: boolean) => {
            if (!activeRef.current || !resourceRef.current) return;
            const send = () => {
                nodeLastSent.current.set(id, performance.now());
                rawPush("live:node", { resource: resourceRef.current, id, x, y, dragging });
            };
            // The drag's final frame must land exactly, so skip the throttle.
            if (!dragging) {
                const t = nodeTimers.current.get(id);
                if (t != null) {
                    clearTimeout(t);
                    nodeTimers.current.delete(id);
                }
                send();
                return;
            }
            const elapsed = performance.now() - (nodeLastSent.current.get(id) ?? 0);
            if (elapsed >= NODE_INTERVAL_MS) {
                const t = nodeTimers.current.get(id);
                if (t != null) {
                    clearTimeout(t);
                    nodeTimers.current.delete(id);
                }
                send();
            } else if (!nodeTimers.current.has(id)) {
                const handle = window.setTimeout(() => {
                    nodeTimers.current.delete(id);
                    send();
                }, NODE_INTERVAL_MS - elapsed);
                nodeTimers.current.set(id, handle);
            }
        },
        [rawPush],
    );

    React.useEffect(() => {
        const nodeTimerMap = nodeTimers.current;
        return () => {
            for (const t of nodeTimerMap.values()) clearTimeout(t);
            nodeTimerMap.clear();
        };
    }, []);

    return { ...cursors, pushNode };
}
