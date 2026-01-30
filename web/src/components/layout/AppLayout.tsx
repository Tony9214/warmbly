import { Outlet } from 'react-router-dom'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import { AppSidebar } from './AppSidebar'
import { ThemeProvider } from './ThemeProvider'
import { useAppStore } from '@/stores'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { ShortcutsModal } from '@/components/shared/ShortcutsModal'
import { CommandPalette } from '@/components/shared/CommandPalette'

interface AppLayoutProps {
  title?: string
}

export function AppLayout({ title }: AppLayoutProps) {
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed)

  // Initialize keyboard shortcuts
  useKeyboardShortcuts()

  return (
    <ThemeProvider>
      <SidebarProvider defaultOpen={!sidebarCollapsed}>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>{title || 'Dashboard'}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          <main className="flex-1 overflow-auto p-4">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>

      <ShortcutsModal />
      <CommandPalette />
    </ThemeProvider>
  )
}
