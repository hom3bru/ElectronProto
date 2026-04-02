import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { clsx } from 'clsx';

interface EntityPickerProps {
  type: 'company' | 'task' | 'thread';
  onClose: () => void;
  onSelect: (id: string, name: string) => void;
  electron: any;
}

export function EntityPicker({ type, onClose, onSelect, electron }: EntityPickerProps) {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!electron) return;
    const loadData = async () => {
      setLoading(true);
      try {
        if (type === 'company') {
          const res = await electron.crm.getCompanies();
          if (res.ok) {
            setItems(res.data.map((c: any) => ({ id: c.id, label: c.name, subLabel: c.domain })));
          }
        } else if (type === 'task') {
          const res = await electron.tasks.getTasks();
          if (res.ok) {
            setItems(res.data.map((t: any) => ({ id: t.id, label: t.title, subLabel: t.status })));
          }
        } else if (type === 'thread') {
          const res = await electron.inbox.getThreads();
          if (res.ok) {
            setItems(res.data.map((t: any) => ({ id: t.id, label: t.subject || 'No Subject', subLabel: t.latestMsg?.from })));
          }
        }
      } catch (e) {
        console.error("Failed to load picker data", e);
      }
      setLoading(false);
    };
    loadData();
  }, [type, electron]);

  const filtered = items.filter(i => 
    i.label?.toLowerCase().includes(search.toLowerCase()) || 
    i.subLabel?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="absolute inset-0 z-50 flex items-start justify-center pt-20 bg-black/50 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[70vh]">
        <div className="flex items-center px-3 py-2 border-b border-zinc-800">
          <Search className="w-4 h-4 text-zinc-500 mr-2" />
          <input 
            type="text"
            autoFocus
            placeholder={`Search ${type}s...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-sm text-zinc-200 placeholder-zinc-500 py-1"
          />
          <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded text-zinc-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="overflow-y-auto flex-1 p-2">
          {loading ? (
            <div className="p-4 text-center text-zinc-500 text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-center text-zinc-500 text-sm">No results found.</div>
          ) : (
            <div className="flex flex-col gap-1">
              {filtered.map(item => (
                <button
                  key={item.id}
                  onClick={() => onSelect(item.id, item.label)}
                  className="flex flex-col text-left px-3 py-2 rounded-md hover:bg-zinc-800 transition-colors"
                >
                  <span className="text-zinc-200 text-sm font-medium truncate w-full">{item.label}</span>
                  <span className="text-zinc-500 text-xs truncate w-full">{item.subLabel}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
