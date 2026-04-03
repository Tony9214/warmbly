import { PlusIcon, CircleDollarSignIcon } from "lucide-react"

export default function DealsPage() {
  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Deals</h1>
          <p className="text-[13px] text-zinc-400 mt-1">Manage your deal flow.</p>
        </div>
        <button className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors duration-100 flex items-center gap-1.5">
          <PlusIcon className="w-3.5 h-3.5" />
          New Deal
        </button>
      </div>

      <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-zinc-200">
        <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center mb-3">
          <CircleDollarSignIcon className="w-4 h-4 text-zinc-400" />
        </div>
        <h2 className="text-sm font-medium text-zinc-900 mb-1">No deals</h2>
        <p className="text-xs text-zinc-400 text-center max-w-xs">
          Create your first deal to start tracking opportunities.
        </p>
      </div>
    </div>
  )
}
