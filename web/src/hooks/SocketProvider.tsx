
import {
    useRef,
    useEffect,
    useState,
    useCallback,
} from 'react';
import type SocketProviderProps from "@/lib/socket/models/SocketProviderProps"
import type { ServerMessage } from '@/lib/socket/models/ServerMessage';
import useSocketURL from '@/lib/api/hooks/app/socket/useSocketURL';
import type { AppError } from '@/lib/api/client/normalizeError';
import { SocketContext, type Handler } from './context/socket';

/* ------------------------------------------------------------------ */
/*  Provider component                                                */
/* ------------------------------------------------------------------ */
export default function SocketProvider({
    children,
    onOpen,
    onClose,
    onError,
}: SocketProviderProps) {
    /* ----------------------- state ----------------------- */
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState<ServerMessage | null>(null);
    const [reconnectAttempt, setReconnectAttempt] = useState(0);

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
    const handlersRef = useRef<Map<string, Set<Handler<ServerMessage>>>>(new Map());

    /* ----------------------- fetch WS URL ---------------- */
    const fetchWsUrl = useSocketURL();

    /* ----------------------- subscribe API --------------- */
    const subscribe = useCallback(
        <T extends ServerMessage['type']>(
            type: T,
            handler: Handler<Extract<ServerMessage, { type: T }>>
        ): (() => void) => {
            const key = type;
            let set = handlersRef.current.get(key);

            if (!set) {
                set = new Set<Handler<ServerMessage>>();
                handlersRef.current.set(key, set);
            }

            // Safe: handler matches the expected shape
            set.add(handler as Handler<ServerMessage>);

            return () => {
                set.delete(handler as Handler<ServerMessage>);
                if (set.size === 0) {
                    handlersRef.current.delete(key);
                }
            };
        },
        []
    );

    /* ----------------------- dispatch -------------------------- */
    const dispatch = useCallback((payload: ServerMessage) => {
        const type = payload.type;
        const set = handlersRef.current.get(type);

        if (!set) return;

        // All handlers in this set are for `payload`
        set.forEach((handler) => {
            try {
                // TypeScript knows: handler expects `payload` type
                (handler as Handler<typeof payload>)(payload);
            } catch (err) {
                console.error('[WS] Handler error:', err);
            }
        });
    }, []);

    /* ----------------------- connect --------------------- */
    const connect = useCallback(async () => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        try {
            const url = await fetchWsUrl.mutateAsync();
            wsRef.current = new WebSocket(url.url);

            wsRef.current.onopen = (ev) => {
                setIsConnected(true);
                setReconnectAttempt(0);
                onOpen?.(ev);
            };

            wsRef.current.onmessage = (ev) => {
                let payload: ServerMessage;
                try {
                    payload = JSON.parse(ev.data) as ServerMessage;
                } catch {
                    // Fallback for non‑JSON (rare)
                    payload = { type: 'raw' } as unknown as ServerMessage;
                }

                setLastMessage(payload);
                dispatch(payload);
            };

            wsRef.current.onclose = (ev) => {
                setIsConnected(false);
                onClose?.(ev);

                if (!ev.wasClean) {
                    const delay = Math.min(1000 * 2 ** reconnectAttempt, 30_000);
                    reconnectTimerRef.current = setTimeout(() => {
                        setReconnectAttempt((a) => a + 1);
                        connect();
                    }, delay);
                }
            };

            wsRef.current.onerror = (ev) => {
                console.error('[WS] error', ev);
                onError?.(ev);
            };
        } catch (err) {
            const error = err as AppError;
            console.error('[WS] init failed', error);
            setTimeout(connect, 15_000);
        }
    }, [
        fetchWsUrl,
        reconnectAttempt,
        onOpen,
        onClose,
        onError,
        dispatch,
    ]);

    /* ----------------------- send ------------------------ */
    const sendMessage = useCallback((msg: unknown) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
            console.warn('[WS] not open – dropping message');
            return;
        }

        const raw =
            typeof msg === 'string' ? msg : JSON.stringify(msg);
        wsRef.current.send(raw);
    }, []);

    /* ----------------------- mount ----------------------- */
    useEffect(() => {
        connect();
        return () => {
            if (reconnectTimerRef.current)
                clearTimeout(reconnectTimerRef.current);
            wsRef.current?.close();
        };
    }, [connect]);

    return (
        <SocketContext.Provider value={{
            isConnected,
            sendMessage,
            subscribe,
            lastMessage,
        }}>
            {children}
        </SocketContext.Provider>
    );
};
