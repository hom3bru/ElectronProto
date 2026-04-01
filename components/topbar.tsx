import { Search } from 'lucide-react';

export function Topbar() {
  return (
    <div className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center px-4 justify-between shrink-0">
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Command or search... (Cmd+K)"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-700 text-zinc-200 placeholder:text-zinc-500"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
          <span className="text-xs text-zinc-400 font-medium">System Online</span>
        </div>
      </div>
    </div>
  );
}
