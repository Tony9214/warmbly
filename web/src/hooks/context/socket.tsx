import { useContext, createContext } from "react";
import type { ServerMessage } from "@/lib/socket/models/ServerMessage";

export type SocketStatus = "CONNECTED" | "CONNECTING" | "FAILED" | "NOT_AVAILABLE"

export type Handler<T extends ServerMessage> = (msg: T) => void;

interface SocketContextValue {
    isConnected: boolean;
    sendMessage: (msg: unknown) => void;
    error?: string;
    subscribe: <T extends ServerMessage>(
        type: T['type'],
        handler: Handler<Extract<ServerMessage, { type: T['type'] }>>
    ) => () => void;
    lastMessage: ServerMessage | null;
}

export const SocketContext = createContext<SocketContextValue | undefined>(
    undefined
);

export const useSocket = (): SocketContextValue => {
    const ctx = useContext(SocketContext);
    if (!ctx) {
        throw new Error(
            'useWebSocket must be used within a <WebSocketProvider />'
        );
    }
    return ctx;
};

// Usage
//
// useEffect(() => {
//     const unsubscribe = subscribe('chat', (msg: ChatMessage) => {
//       setMessages((prev) => [...prev, msg]);
//     });
//     return unsubscribe;
//   }, [subscribe]);
