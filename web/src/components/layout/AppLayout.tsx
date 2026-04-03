import { Outlet } from 'react-router-dom'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from './AppSidebar'
import { ThemeProvider } from './ThemeProvider'
import { useAppStore } from '@/stores'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { ShortcutsModal } from '@/components/shared/ShortcutsModal'
import { CommandPalette } from '@/components/shared/CommandPalette'
import { DynamicBreadcrumb } from './DynamicBreadcrumb'
import { ConnectionIndicator } from '@/components/shared/ConnectionIndicator'
import { SearchIcon } from 'lucide-react'

export function AppLayout() {
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed)
  const setCommandPaletteOpen = useAppStore((state) => state.setCommandPaletteOpen)

  useKeyboardShortcuts()

  return (
    <ThemeProvider>
      <SidebarProvider defaultOpen={!sidebarCollapsed}>
        <AppSidebar />
        <SidebarInset>
          {/* Header — clean breadcrumb bar like ex1/ex2 */}
          <header className="flex h-[46px] shrink-0 items-center gap-3 border-b border-zinc-200 px-5">
            <DynamicBreadcrumb />
            <div className="ml-auto flex items-center gap-3">
              <ConnectionIndicator />
              <button
                onClick={() => setCommandPaletteOpen(true)}
                className="hidden sm:flex items-center gap-2 text-zinc-400 hover:text-zinc-600 transition-colors duration-100 text-[13px]"
              >
                <SearchIcon className="w-4 h-4" />
                <span className="hidden md:inline">Search</span>
                <kbd className="hidden lg:inline-flex h-5 items-center px-1.5 rounded border border-zinc-200 bg-zinc-50 font-mono text-[10px] text-zinc-400 ml-1">
                  &#8984;K
                </kbd>
              </button>
              <button
                className="sm:hidden p-1 text-zinc-400 hover:text-zinc-600 transition-colors duration-100"
                onClick={() => setCommandPaletteOpen(true)}
              >
                <SearchIcon className="w-4 h-4" />
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-auto bg-zinc-50/50">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>

      <ShortcutsModal />
      <CommandPalette />
    </ThemeProvider>
  )
}
