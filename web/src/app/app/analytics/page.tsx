import { BarChart3Icon, MailIcon, MousePointerClickIcon, ReplyIcon, AlertTriangleIcon, TrendingUpIcon, ArrowUpRightIcon } from "lucide-react"

const stats = [
  { label: 'Total Sent', value: '--', icon: MailIcon, color: 'bg-blue-50 text-blue-600' },
  { label: 'Open Rate', value: '--%', icon: MousePointerClickIcon, color: 'bg-emerald-50 text-emerald-600' },
  { label: 'Reply Rate', value: '--%', icon: ReplyIcon, color: 'bg-violet-50 text-violet-600' },
  { label: 'Bounce Rate', value: '--%', icon: AlertTriangleIcon, color: 'bg-amber-50 text-amber-600' },
]

export default function AnalyticsPage() {
  return (
    <div className="p-5 space-y-4">
      {/* Stat cards row */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-zinc-200 p-4">
            <div className="flex items-center gap-2.5 mb-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stat.color.split(' ')[0]}`}>
                <stat.icon className={`w-4 h-4 ${stat.color.split(' ')[1]}`} />
              </div>
              <span className="text-[13px] text-zinc-500">{stat.label}</span>
            </div>
            <div className="text-2xl font-semibold text-zinc-900 tracking-tight">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Charts area — two-column like ex2 */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Main chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-zinc-200 p-5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-[13.5px] font-semibold text-zinc-900">Email Performance</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Daily sends and engagement over time</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button className="text-xs text-zinc-500 bg-zinc-100 rounded-md px-2.5 py-1 font-medium">7 days</button>
              <button className="text-xs text-zinc-400 hover:text-zinc-600 rounded-md px-2.5 py-1 transition-colors duration-100">30 days</button>
              <button className="text-xs text-zinc-400 hover:text-zinc-600 rounded-md px-2.5 py-1 transition-colors duration-100">90 days</button>
            </div>
          </div>
          {/* Chart placeholder */}
          <div className="h-52 flex items-end gap-1 px-2">
            {[...Array(28)].map((_, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <div
                  className="w-full rounded-sm bg-zinc-100"
                  style={{ height: `${15 + Math.sin(i * 0.5) * 30 + Math.random() * 20}%` }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 px-2">
            <span className="text-[10px] text-zinc-300">7 days ago</span>
            <span className="text-[10px] text-zinc-300">Today</span>
          </div>
        </div>

        {/* Side panel */}
        <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-5">
          <h2 className="text-[13.5px] font-semibold text-zinc-900">Quick Stats</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[13px] text-zinc-600">Delivered</span>
              </div>
              <span className="text-[13px] font-medium text-zinc-900">--</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-[13px] text-zinc-600">Opened</span>
              </div>
              <span className="text-[13px] font-medium text-zinc-900">--</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-violet-500" />
                <span className="text-[13px] text-zinc-600">Replied</span>
              </div>
              <span className="text-[13px] font-medium text-zinc-900">--</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-[13px] text-zinc-600">Bounced</span>
              </div>
              <span className="text-[13px] font-medium text-zinc-900">--</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-[13px] text-zinc-600">Spam</span>
              </div>
              <span className="text-[13px] font-medium text-zinc-900">--</span>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-100">
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
              <TrendingUpIcon className="w-3.5 h-3.5" />
              <span>Start sending to see analytics</span>
            </div>
          </div>
        </div>
      </div>

      {/* Warmup overview — like ex2's integrations */}
      <div className="bg-white rounded-xl border border-zinc-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13.5px] font-semibold text-zinc-900">Warmup Overview</h2>
          <button className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 transition-colors duration-100">
            <span>View all accounts</span>
            <ArrowUpRightIcon className="w-3 h-3" />
          </button>
        </div>
        <div className="flex items-center justify-center py-10">
          <div className="text-center">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center mx-auto mb-3">
              <BarChart3Icon className="w-5 h-5 text-zinc-400" />
            </div>
            <p className="text-[13px] text-zinc-400">Add email accounts to see warmup progress here.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
