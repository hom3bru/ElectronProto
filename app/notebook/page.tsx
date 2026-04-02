'use client';

import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Filter, Search } from 'lucide-react';

export default function NotebookPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    entityType: 'all',
    actorType: 'all',
    search: '',
  });

  const electron = typeof window !== 'undefined' ? (window as any).electron : null;

  const loadEntries = useCallback(async () => {
    if (!electron) return;
    
    // Build IPC filter object
    const ipcFilters: any = { limit: 500 };
    if (filters.entityType !== 'all') ipcFilters.entityType = filters.entityType;
    if (filters.actorType !== 'all') ipcFilters.actorType = filters.actorType;
    if (filters.search.length > 2) ipcFilters.search = filters.search;

    const res = await electron.notebook.getEntries(ipcFilters);
    if (res.ok) {
      setEntries(res.data);
    }
  }, [electron, filters]);

  useEffect(() => {
    // Debounce search slightly
    const timer = setTimeout(() => {
      loadEntries();
    }, 300);
    return () => clearTimeout(timer);
  }, [loadEntries]);

  // Derived unique entity types from current payload (would ideally be a schema enum fetch, but this works for simple UI)
  const knownEntityTypes = ['company', 'contact', 'task', 'evidence', 'browser_tab', 'message', 'thread', 'draft', 'account'];

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <div className="flex items-center gap-2 text-zinc-100 font-medium">
          <BookOpen size={18} />
          <span>Notebook Audit Log</span>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1.5 text-zinc-500" />
            <input 
              type="text"
              placeholder="Search log..."
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
              className="bg-zinc-900 border border-zinc-800 rounded pl-8 pr-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-zinc-600 w-48"
            />
          </div>
          
          <select 
            value={filters.actorType}
            onChange={(e) => setFilters({...filters, actorType: e.target.value})}
            className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-zinc-600"
          >
            <option value="all">All Actors</option>
            <option value="human">Human Operator</option>
            <option value="agent">Autonomous Agent</option>
            <option value="system">System Subsystems</option>
          </select>

          <select 
            value={filters.entityType}
            onChange={(e) => setFilters({...filters, entityType: e.target.value})}
            className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-zinc-600"
          >
            <option value="all">All Entities</option>
            {knownEntityTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {entries.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-sm">
              No matching notebook entries.
            </div>
          ) : (
            entries.map(entry => (
              <div key={entry.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-zinc-800 rounded text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                      {entry.relatedEntityType}
                    </span>
                    <span className="px-2 py-0.5 border border-zinc-700 bg-zinc-800/50 rounded text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                      {entry.entryType}
                    </span>
                    {entry.parentEntityType && (
                       <span className="text-[10px] text-zinc-500 ml-2">
                         in {entry.parentEntityType} {entry.parentEntityId?.substring(0,6)}
                       </span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500">
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-zinc-200 whitespace-pre-wrap">{entry.message}</p>
                <div className="mt-2 flex justify-between items-end">
                  <div className="text-xs text-zinc-500">
                    By <span className="text-zinc-400 font-medium">{entry.actorName}</span> 
                    <span className="ml-1 opacity-60">({entry.actorType})</span>
                  </div>
                  {entry.metadataJson && (
                    <div className="text-[10px] font-mono text-zinc-600 bg-zinc-950 px-2 py-1 rounded">
                      {JSON.stringify(entry.metadataJson)}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
