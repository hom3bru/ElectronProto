'use client';

import { useEffect, useState } from 'react';
import { Send, Check, Edit3, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function OutreachPage() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const electron = typeof window !== 'undefined' ? (window as any).electron : null;

  useEffect(() => {
    const loadDrafts = async () => {
      if (electron) {
        const drfts = await electron.outreach.getDrafts();
        setDrafts(drfts);
      }
    };
    loadDrafts();
  }, [electron]);

  const handleAction = async (command: string, draftId: string) => {
    if (!electron) return;
    await electron.cmd.execute(command, { draftId });
    const drfts = await electron.outreach.getDrafts();
    setDrafts(drfts);
  };

  return (
    <div className="p-8 h-full overflow-y-auto">
      <h1 className="text-2xl font-semibold tracking-tight mb-8">Outreach Drafts</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {drafts.map((draft) => (
          <div key={draft.id} className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden flex flex-col">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-[10px] font-medium uppercase tracking-wider ${
                  draft.status === 'sent' ? 'bg-emerald-500/10 text-emerald-400' :
                  draft.status === 'approved' ? 'bg-blue-500/10 text-blue-400' :
                  'bg-amber-500/10 text-amber-400'
                }`}>
                  {draft.status}
                </span>
                <span className="text-xs text-zinc-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date(draft.updatedAt), 'MMM d, yyyy h:mm a')}
                </span>
              </div>
            </div>
            
            <div className="p-5 flex-1">
              <div className="mb-4">
                <div className="text-xs text-zinc-500 mb-1">Subject</div>
                <div className="text-sm font-medium text-zinc-200">{draft.subject}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-1">Body</div>
                <div className="text-sm text-zinc-400 whitespace-pre-wrap bg-zinc-950 p-3 rounded border border-zinc-800/50">
                  {draft.body}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-zinc-800 bg-zinc-950/50 flex justify-end gap-2">
              {draft.status === 'draft' && (
                <>
                  <button className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-sm font-medium transition-colors flex items-center gap-2">
                    <Edit3 className="w-4 h-4" /> Edit
                  </button>
                  <button 
                    onClick={() => handleAction('approveDraft', draft.id)}
                    className="px-3 py-1.5 bg-blue-900/30 text-blue-400 hover:bg-blue-900/50 rounded text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" /> Approve
                  </button>
                </>
              )}
              {draft.status === 'approved' && (
                <button 
                  onClick={() => handleAction('sendDraft', draft.id)}
                  className="px-3 py-1.5 bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50 rounded text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <Send className="w-4 h-4" /> Send Now
                </button>
              )}
              {draft.status === 'sent' && (
                <div className="text-sm text-zinc-500 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" /> Sent successfully
                </div>
              )}
            </div>
          </div>
        ))}
        {drafts.length === 0 && (
          <div className="col-span-full p-8 text-center text-sm text-zinc-500 border border-zinc-800/50 rounded-lg border-dashed">
            No outreach drafts found. Create drafts from the Inbox or CRM.
          </div>
        )}
      </div>
    </div>
  );
}
