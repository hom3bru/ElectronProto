'use client';

import { useEffect, useState } from 'react';
import { EvidenceFragment } from '@/packages/shared/types';
import { FileSearch, Link as LinkIcon, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

export default function EvidencePage() {
  const [evidence, setEvidence] = useState<EvidenceFragment[]>([]);
  const electron = typeof window !== 'undefined' ? (window as any).electron : null;

  useEffect(() => {
    if (electron) {
      electron.evidence.getFragments().then(setEvidence);
    }
  }, [electron]);

  return (
    <div className="p-8 h-full overflow-y-auto">
      <h1 className="text-2xl font-semibold tracking-tight mb-8">Evidence Store</h1>
      
      <div className="space-y-4">
        {evidence.length === 0 ? (
          <div className="text-zinc-500 text-sm">No evidence fragments found.</div>
        ) : (
          evidence.map((item) => (
            <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <FileSearch className="w-4 h-4 text-zinc-400" />
                  <span className="text-sm font-medium text-zinc-300 uppercase tracking-wider">{item.type}</span>
                </div>
                <span className="text-xs text-zinc-500">{format(new Date(item.timestamp), 'MMM d, yyyy')}</span>
              </div>
              <p className="text-sm text-zinc-200 mb-4">{item.claimSummary}</p>
              {item.quote && (
                <blockquote className="border-l-2 border-zinc-700 pl-4 py-1 text-sm text-zinc-400 italic mb-4">
                  &quot;{item.quote}&quot;
                </blockquote>
              )}
              <div className="flex items-center gap-4 text-xs text-zinc-500">
                {item.url && (
                  <a href={item.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-zinc-300 transition-colors">
                    <LinkIcon className="w-3 h-3" /> Source URL
                  </a>
                )}
                {item.contradictionFlag && (
                  <div className="flex items-center gap-1 text-amber-500">
                    <AlertTriangle className="w-3 h-3" /> Contradiction Flagged
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
