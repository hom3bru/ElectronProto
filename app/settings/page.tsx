export default function SettingsPage() {
  return (
    <div className="p-8 h-full overflow-y-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight mb-8">Settings</h1>
      
      <div className="space-y-8">
        <section>
          <h2 className="text-lg font-medium mb-4">Mail Provider</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <p className="text-sm text-zinc-400 mb-4">Configure your inbound and outbound mail providers.</p>
            <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-md text-sm font-medium transition-colors">
              Connect Gmail
            </button>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-medium mb-4">Browser Sessions</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <p className="text-sm text-zinc-400 mb-4">Manage isolated browser partitions.</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center p-3 bg-zinc-950 rounded border border-zinc-800">
                <span className="text-sm font-medium">browser-default</span>
                <button className="text-xs text-zinc-500 hover:text-zinc-300">Clear Data</button>
              </div>
              <div className="flex justify-between items-center p-3 bg-zinc-950 rounded border border-zinc-800">
                <span className="text-sm font-medium">inbox</span>
                <button className="text-xs text-zinc-500 hover:text-zinc-300">Clear Data</button>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-medium mb-4">Developer Tools</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <button className="px-4 py-2 bg-red-950/30 text-red-400 hover:bg-red-900/50 rounded-md text-sm font-medium transition-colors">
              Reset Mock Data
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
