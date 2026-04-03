import { Separator } from "@/components/ui/separator"

export default function SettingsPage() {
  return (
    <div className="p-5 max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Settings</h1>
        <p className="text-[13px] text-zinc-400 mt-1">Manage your account settings.</p>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 divide-y divide-zinc-200">
        <div className="p-5">
          <h2 className="text-[13.5px] font-medium text-zinc-900 mb-0.5">Profile</h2>
          <p className="text-xs text-zinc-400">Update your personal information.</p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[13px] text-zinc-500 block mb-1.5">Email</label>
            <input
              type="email"
              placeholder="your@email.com"
              disabled
              className="w-full h-8 px-3 rounded-lg border border-zinc-200 bg-zinc-50 text-[13px] text-zinc-400"
            />
          </div>
          <Separator />
          <button className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors duration-100">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}
