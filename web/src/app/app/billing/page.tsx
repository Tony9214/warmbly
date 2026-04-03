import { SparklesIcon, ArrowUpRightIcon } from "lucide-react"

export default function BillingPage() {
  return (
    <div className="p-5 max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Billing</h1>
        <p className="text-[13px] text-zinc-400 mt-1">Manage your subscription and billing.</p>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200">
        <div className="p-5 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-[13.5px] font-medium text-zinc-900">Free Plan</h2>
              <span className="inline-flex items-center text-[11px] rounded-full px-1.5 py-0.5 bg-zinc-100 text-zinc-500">
                Current
              </span>
            </div>
            <p className="text-xs text-zinc-400">Basic features for getting started.</p>
          </div>
          <button className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors duration-100 flex items-center gap-1.5">
            <SparklesIcon className="w-3.5 h-3.5" />
            Upgrade
          </button>
        </div>
        <div className="border-t border-zinc-200 p-4">
          <div className="flex items-center gap-1 text-xs text-zinc-400">
            <ArrowUpRightIcon className="w-3.5 h-3.5" />
            <span>View all plans and pricing</span>
          </div>
        </div>
      </div>
    </div>
  )
}
