import { Link, useLocation } from 'react-router-dom'
import {
  SearchIcon,
  InboxIcon,
  HomeIcon,
  MailIcon,
  UsersIcon,
  MegaphoneIcon,
  BarChart3Icon,
  GitBranchIcon,
  CircleDollarSignIcon,
  CheckSquareIcon,
  FileTextIcon,
  KeyIcon,
  SettingsIcon,
  HelpCircleIcon,
  ChevronDownIcon,
  PlusIcon,
  MoreHorizontalIcon,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { OrgSwitcher } from './OrgSwitcher'
import { UserNav } from './UserNav'
import { useAppStore } from '@/stores'
import { cn } from '@/lib/utils'
import React from 'react'

/* ── Types ────────────────────────────────── */

interface NavItem {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavSection {
  label: string
  items: NavItem[]
}

/* ── Data ─────────────────────────────────── */

const topItems: NavItem[] = [
  { title: 'Home', url: '/app/emails', icon: HomeIcon },
  { title: 'Inbox', url: '/app/unibox', icon: InboxIcon },
  { title: 'Search', url: '#search', icon: SearchIcon },
]

const sections: NavSection[] = [
  {
    label: 'Email',
    items: [
      { title: 'Accounts', url: '/app/emails', icon: MailIcon },
      { title: 'Campaigns', url: '/app/campaigns', icon: MegaphoneIcon },
      { title: 'Contacts', url: '/app/contacts', icon: UsersIcon },
      { title: 'Analytics', url: '/app/analytics', icon: BarChart3Icon },
    ],
  },
  {
    label: 'CRM',
    items: [
      { title: 'Pipelines', url: '/app/crm/pipelines', icon: GitBranchIcon },
      { title: 'Deals', url: '/app/crm/deals', icon: CircleDollarSignIcon },
      { title: 'Tasks', url: '/app/crm/tasks', icon: CheckSquareIcon },
    ],
  },
  {
    label: 'Resources',
    items: [
      { title: 'Templates', url: '/app/templates', icon: FileTextIcon },
      { title: 'API Keys', url: '/app/api-keys', icon: KeyIcon },
    ],
  },
]

/* ── Components ───────────────────────────── */

function NavLink({ item, badge }: { item: NavItem; badge?: number }) {
  const location = useLocation()
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen)

  const isSearch = item.url === '#search'
  const isActive = !isSearch && (location.pathname === item.url || location.pathname.startsWith(item.url + '/'))

  return (
    <Link
      to={isSearch ? '#' : item.url}
      onClick={isSearch ? (e) => { e.preventDefault(); setCommandPaletteOpen(true) } : undefined}
      className={cn(
        'flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13.5px] transition-colors duration-100',
        isActive
          ? 'bg-zinc-100 text-zinc-900 font-medium'
          : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700'
      )}
    >
      <item.icon className="w-[18px] h-[18px] shrink-0" strokeWidth={isActive ? 2 : 1.75} />
      <span className="truncate group-data-[collapsible=icon]:hidden">{item.title}</span>
      {badge != null && badge > 0 && (
        <span className="ml-auto text-[11px] font-medium bg-blue-500 text-white rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 group-data-[collapsible=icon]:hidden">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  )
}

function SectionGroup({ section }: { section: NavSection }) {
  const [open, setOpen] = React.useState(true)

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2.5 mb-1 text-[11.5px] font-medium text-zinc-400 hover:text-zinc-500 transition-colors duration-100 cursor-pointer select-none"
      >
        <span>{section.label}</span>
        <ChevronDownIcon className={cn('w-3 h-3 transition-transform duration-100', !open && '-rotate-90')} />
      </button>
      {open && (
        <div className="space-y-px">
          {section.items.map((item) => (
            <NavLink key={item.url} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Main Sidebar ─────────────────────────── */

export function AppSidebar() {
  const unseenCount = useAppStore((s) => s.unseenCount)

  return (
    <Sidebar collapsible="icon" className="border-r border-zinc-200 bg-white">
      <SidebarHeader className="px-3 pt-4 pb-2">
        <OrgSwitcher />
      </SidebarHeader>

      <SidebarContent className="px-3 pt-1 overflow-y-auto">
        {/* Primary action — like Ghost's "New Task" button */}
        <Link
          to="/app/campaigns"
          className="flex items-center justify-center gap-2 w-full px-3 py-2 mb-3 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition-colors duration-100 group-data-[collapsible=icon]:p-2"
        >
          <PlusIcon className="w-4 h-4" />
          <span className="group-data-[collapsible=icon]:hidden">New Campaign</span>
        </Link>

        {/* Top nav — no section label */}
        <div className="space-y-px">
          {topItems.map((item) => (
            <NavLink
              key={item.url + item.title}
              item={item}
              badge={item.title === 'Inbox' ? unseenCount : undefined}
            />
          ))}
        </div>

        {/* Collapsible sections */}
        <div className="mt-6 space-y-5">
          {sections.map((section) => (
            <SectionGroup key={section.label} section={section} />
          ))}
        </div>

        <div className="flex-1" />

        {/* Bottom items */}
        <div className="mt-6 pt-3 border-t border-zinc-100 space-y-px">
          <NavLink item={{ title: 'Settings', url: '/app/settings', icon: SettingsIcon }} />
          <NavLink item={{ title: 'Support', url: '#', icon: HelpCircleIcon }} />
          <button className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13.5px] text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 transition-colors duration-100 w-full">
            <MoreHorizontalIcon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span className="group-data-[collapsible=icon]:hidden">More</span>
          </button>
        </div>
      </SidebarContent>

      <SidebarFooter className="px-3 py-3 border-t border-zinc-100">
        <UserNav />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
