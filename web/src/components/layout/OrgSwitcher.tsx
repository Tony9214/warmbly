import { ChevronDownIcon, PlusIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSidebar } from '@/components/ui/sidebar'
import { useAppStore } from '@/stores'

export function OrgSwitcher() {
  const { isMobile } = useSidebar()
  const organizations = useAppStore((state) => state.organizations)
  const currentOrganization = useAppStore((state) => state.currentOrganization)
  const switchOrganization = useAppStore((state) => state.switchOrganization)

  const name = currentOrganization?.name || 'Warmbly'

  const getInitials = (name: string) =>
    name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-1 py-0.5 rounded-md hover:bg-zinc-50 transition-colors duration-150 w-full group cursor-pointer">
          {/* Small workspace icon — like the reference's colored icon */}
          <div className="w-5 h-5 rounded bg-zinc-900 flex items-center justify-center shrink-0">
            <span className="text-[9px] font-bold text-white leading-none">{getInitials(name)}</span>
          </div>
          <span className="text-sm font-semibold text-zinc-900 truncate group-data-[collapsible=icon]:hidden">
            {name}
          </span>
          <ChevronDownIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0 group-data-[collapsible=icon]:hidden" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="min-w-56"
        side={isMobile ? 'bottom' : 'bottom'}
        align="start"
        sideOffset={4}
      >
        <DropdownMenuLabel className="text-xs text-zinc-400 font-normal">
          Organizations
        </DropdownMenuLabel>
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => switchOrganization(org.id)}
            className={org.id === currentOrganization?.id ? 'bg-zinc-50' : ''}
          >
            <div className="w-4 h-4 rounded bg-zinc-200 flex items-center justify-center shrink-0">
              <span className="text-[8px] font-bold text-zinc-600">{getInitials(org.name)}</span>
            </div>
            <span className="ml-2 text-sm">{org.name}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <PlusIcon className="w-4 h-4" />
          <span className="ml-2 text-sm">Create Organization</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
