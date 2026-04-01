'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Clock, User } from 'lucide-react';
import { format } from 'date-fns';

export default function NotebookPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const electron = typeof window !== 'undefined' ? (window as any).electron : null;

  useEffect(() => {
    if (electron) {
      electron.db.query('notebookEntries', 'findMany', { orderBy: { createdAt: 'desc' } }).then(setEntries);
    }
  }, [electron]);

  return (
    <div className="p-8 h-full overflow-y-auto max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-zinc-400" />
          System Notebook
        </h1>
      </div>

      <div className="space-y-4">
        {entries.map((entry) => (
          <div key={entry.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-300 uppercase tracking-wider">
                  {entry.relatedEntityType}
                </span>
                <span className="text-sm font-medium text-zinc-200">{entry.entryType}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-zinc-500">
                <Clock className="w-3 h-3" />
                {format(new Date(entry.createdAt), 'MMM d, yyyy h:mm a')}
              </div>
            </div>
            <p className="text-sm text-zinc-400 mb-3">{entry.message}</p>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <User className="w-3 h-3" />
              {entry.actorName} ({entry.actorType})
            </div>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="p-8 text-center text-sm text-zinc-500 border border-zinc-800/50 rounded-lg border-dashed">
            No notebook entries found. Actions taken in the system will be logged here.
          </div>
        )}
      </div>
    </div>
  );
}
