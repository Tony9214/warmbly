import { Link, useNavigate } from 'react-router-dom'
import {
  LogOutIcon,
  SettingsIcon,
  CreditCardIcon,
  UsersIcon,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSidebar } from '@/components/ui/sidebar'
import { useAppStore } from '@/stores'

export function UserNav() {
  const { isMobile } = useSidebar()
  const navigate = useNavigate()
  const user = useAppStore((state) => state.user)
  const logout = useAppStore((state) => state.logout)

  if (!user) return null

  const handleLogout = () => {
    logout()
    localStorage.removeItem('token')
    navigate('/auth/login')
  }

  const initials = user.email.slice(0, 2).toUpperCase()
  const displayName = user.first_name && user.last_name
    ? `${user.first_name} ${user.last_name}`
    : user.email

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2.5 px-1 py-1 rounded-md hover:bg-zinc-50 transition-colors duration-150 w-full cursor-pointer">
          <div className="w-6 h-6 rounded-full bg-zinc-200 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-medium text-zinc-600 leading-none">{initials}</span>
          </div>
          <div className="flex-1 min-w-0 text-left group-data-[collapsible=icon]:hidden">
            <div className="text-sm text-zinc-900 truncate">{displayName}</div>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="min-w-56"
        side={isMobile ? 'top' : 'top'}
        align="start"
        sideOffset={4}
      >
        <div className="px-2 py-1.5">
          <div className="text-sm font-medium text-zinc-900">{displayName}</div>
          <div className="text-xs text-zinc-400">{user.email}</div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link to="/app/settings">
              <SettingsIcon className="w-4 h-4" />
              <span className="ml-2">Settings</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/app/billing">
              <CreditCardIcon className="w-4 h-4" />
              <span className="ml-2">Billing</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/app/team">
              <UsersIcon className="w-4 h-4" />
              <span className="ml-2">Team</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOutIcon className="w-4 h-4" />
          <span className="ml-2">Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
