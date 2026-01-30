import type { StateCreator } from 'zustand'

export type Theme = 'light' | 'dark' | 'system'

export interface UISlice {
  // Sidebar
  sidebarCollapsed: boolean
  sidebarMobileOpen: boolean

  // Theme
  theme: Theme
  resolvedTheme: 'light' | 'dark'

  // Modals
  tagsModalOpen: boolean
  foldersModalOpen: boolean
  addEmailModalOpen: boolean
  shortcutsModalOpen: boolean
  commandPaletteOpen: boolean

  // Actions - Sidebar
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setSidebarMobileOpen: (open: boolean) => void

  // Actions - Theme
  setTheme: (theme: Theme) => void
  setResolvedTheme: (theme: 'light' | 'dark') => void

  // Actions - Modals
  setTagsModalOpen: (open: boolean) => void
  setFoldersModalOpen: (open: boolean) => void
  setAddEmailModalOpen: (open: boolean) => void
  setShortcutsModalOpen: (open: boolean) => void
  setCommandPaletteOpen: (open: boolean) => void
}

const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') return 'system'
  return (localStorage.getItem('theme') as Theme) || 'system'
}

const getResolvedTheme = (theme: Theme): 'light' | 'dark' => {
  if (theme === 'system') {
    if (typeof window === 'undefined') return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set, get) => ({
  // Sidebar
  sidebarCollapsed: false,
  sidebarMobileOpen: false,

  // Theme
  theme: getInitialTheme(),
  resolvedTheme: getResolvedTheme(getInitialTheme()),

  // Modals
  tagsModalOpen: false,
  foldersModalOpen: false,
  addEmailModalOpen: false,
  shortcutsModalOpen: false,
  commandPaletteOpen: false,

  // Actions - Sidebar
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  setSidebarMobileOpen: (sidebarMobileOpen) => set({ sidebarMobileOpen }),

  // Actions - Theme
  setTheme: (theme) => {
    localStorage.setItem('theme', theme)
    const resolvedTheme = getResolvedTheme(theme)
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
    set({ theme, resolvedTheme })
  },
  setResolvedTheme: (resolvedTheme) => set({ resolvedTheme }),

  // Actions - Modals
  setTagsModalOpen: (tagsModalOpen) => set({ tagsModalOpen }),
  setFoldersModalOpen: (foldersModalOpen) => set({ foldersModalOpen }),
  setAddEmailModalOpen: (addEmailModalOpen) => set({ addEmailModalOpen }),
  setShortcutsModalOpen: (shortcutsModalOpen) => set({ shortcutsModalOpen }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
})
