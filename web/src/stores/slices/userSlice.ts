import type { StateCreator } from 'zustand'
import type User from '@/lib/api/models/auth/User'
import type Access from '@/lib/api/models/app/admin/Access'
import type Timezone from '@/lib/api/models/app/Timezone'

export interface UserSlice {
  user: User | null
  access: Access | null
  timezones: Timezone[]
  isAuthenticated: boolean
  isLoading: boolean

  setUser: (user: User | null) => void
  setAccess: (access: Access | null) => void
  setTimezones: (timezones: Timezone[]) => void
  setIsLoading: (loading: boolean) => void
  logout: () => void
}

export const createUserSlice: StateCreator<UserSlice, [], [], UserSlice> = (set) => ({
  user: null,
  access: null,
  timezones: [],
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setAccess: (access) => set({ access }),
  setTimezones: (timezones) => set({ timezones }),
  setIsLoading: (isLoading) => set({ isLoading }),
  logout: () => set({ user: null, access: null, isAuthenticated: false }),
})
