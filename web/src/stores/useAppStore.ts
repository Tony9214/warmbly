import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { createUserSlice, type UserSlice } from './slices/userSlice'
import { createOrganizationSlice, type OrganizationSlice } from './slices/organizationSlice'
import { createUISlice, type UISlice } from './slices/uiSlice'
import { createShortcutSlice, type ShortcutSlice } from './slices/shortcutSlice'
import { createDataSlice, type DataSlice } from './slices/dataSlice'

export type AppStore = UserSlice & OrganizationSlice & UISlice & ShortcutSlice & DataSlice

export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      (...args) => ({
        ...createUserSlice(...args),
        ...createOrganizationSlice(...args),
        ...createUISlice(...args),
        ...createShortcutSlice(...args),
        ...createDataSlice(...args),
      }),
      {
        name: 'warmbly-storage',
        partialize: (state) => ({
          // Only persist UI preferences
          theme: state.theme,
          sidebarCollapsed: state.sidebarCollapsed,
          // Persist current organization selection
          currentOrganization: state.currentOrganization,
        }),
      }
    ),
    {
      name: 'Warmbly Store',
    }
  )
)

// Selectors for commonly used state combinations
export const useUser = () => useAppStore((state) => state.user)
export const useIsAuthenticated = () => useAppStore((state) => state.isAuthenticated)
export const useTheme = () => useAppStore((state) => ({ theme: state.theme, resolvedTheme: state.resolvedTheme }))
export const useSidebar = () =>
  useAppStore((state) => ({
    collapsed: state.sidebarCollapsed,
    mobileOpen: state.sidebarMobileOpen,
    toggle: state.toggleSidebar,
    setCollapsed: state.setSidebarCollapsed,
    setMobileOpen: state.setSidebarMobileOpen,
  }))
export const useCurrentOrg = () => useAppStore((state) => state.currentOrganization)
export const useOrganizations = () =>
  useAppStore((state) => ({
    organizations: state.organizations,
    current: state.currentOrganization,
    switch: state.switchOrganization,
  }))
export const useKeyboardNavigation = () =>
  useAppStore((state) => ({
    sequence: state.keySequence,
    addToSequence: state.addToSequence,
    clearSequence: state.clearSequence,
    selectedIndex: state.selectedIndex,
    setSelectedIndex: state.setSelectedIndex,
    listLength: state.listLength,
    setListLength: state.setListLength,
    moveSelection: state.moveSelection,
  }))
export const useCachedData = () =>
  useAppStore((state) => ({
    campaigns: state.campaigns,
    emails: state.emails,
    tags: state.tags,
    folders: state.folders,
    categories: state.categories,
  }))
