import LinkProvider from "@/hooks/LinkProvider";
import SocketProvider from "@/hooks/SocketProvider";
import { UserProvider } from "@/hooks/UserProvider";
import ConfirmProvider from "@/hooks/ConfirmProvider";
import { AppLayout } from "@/components/layout/AppLayout";
import { Toaster } from "@/components/ui/sonner";

export default function RootAppLayout() {
    return <UserProvider>
        <ConfirmProvider>
            <LinkProvider>
                <SocketProvider>
                    <AppLayout />
                    <Toaster />
                </SocketProvider>
            </LinkProvider>
        </ConfirmProvider>
    </UserProvider>
}
