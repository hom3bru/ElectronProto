'use client';

import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Filter } from 'lucide-react';

export default function NotebookPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [filterType, setFilterType] = useState<string>('all');

  const electron = typeof window !== 'undefined' ? (window as any).electron : null;

  const loadEntries = useCallback(async () => {
    if (electron) {
      const data = await electron.db.query('notebookEntries', 'findMany', { orderBy: { createdAt: 'desc' } });
      setEntries(data);
    }
  }, [electron]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEntries();
  }, [loadEntries]);

  const filteredEntries = filterType === 'all' 
    ? entries 
    : entries.filter(e => e.relatedEntityType === filterType);

  const entityTypes = Array.from(new Set(entries.map(e => e.relatedEntityType)));

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <div className="flex items-center gap-2 text-zinc-100 font-medium">
          <BookOpen size={18} />
          <span>Notebook</span>
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-zinc-500" />
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-zinc-600"
          >
            <option value="all">All Entries</option>
            {entityTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {filteredEntries.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-sm">
              No notebook entries found.
            </div>
          ) : (
            filteredEntries.map(entry => (
              <div key={entry.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-zinc-800 rounded text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                      {entry.relatedEntityType}
                    </span>
                    <span className="px-2 py-0.5 bg-zinc-800 rounded text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                      {entry.entryType}
                    </span>
                  </div>
                  <span className="text-xs text-zinc-500">
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-zinc-300 whitespace-pre-wrap">{entry.message}</p>
                <div className="mt-2 text-xs text-zinc-500">
                  By {entry.actorName} ({entry.actorType})
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
