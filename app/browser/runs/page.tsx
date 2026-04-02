'use client';

import { useEffect, useState } from 'react';
import { Activity, Eye, Square, ChevronDown, ChevronRight, AlertTriangle, Clock, Globe } from 'lucide-react';
import { clsx } from 'clsx';
import { formatDistanceToNow } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-zinc-400 bg-zinc-800',
  running: 'text-emerald-300 bg-emerald-500/20',
  paused: 'text-amber-300 bg-amber-500/20',
  completed: 'text-blue-300 bg-blue-500/20',
  failed: 'text-red-300 bg-red-500/20',
  cancelled: 'text-zinc-500 bg-zinc-800',
};

const RUN_TYPE_COLORS: Record<string, string> = {
  'autonomous-automation': 'text-amber-400',
  'visible-agent-control': 'text-violet-400',
  'human-training': 'text-blue-400',
  'extraction': 'text-cyan-400',
  'verification': 'text-teal-400',
  'site-learning': 'text-blue-300',
};

export default function BrowserRunsPage() {
  const electron = typeof window !== 'undefined' ? (window as any).electron : null;
  const [runs, setRuns] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [runDetails, setRunDetails] = useState<Record<string, any>>({});

  const load = async () => {
    const res = await electron?.browserRun.list();
    if (res?.ok) setRuns(res.data ?? []);
  };

  useEffect(() => { load(); }, [electron]);

  const toggleExpand = async (runId: string) => {
    const next = new Set(expanded);
    if (next.has(runId)) { next.delete(runId); }
    else {
      next.add(runId);
      if (!runDetails[runId]) {
        const res = await electron?.browserRun.get(runId);
        if (res?.ok) setRunDetails((prev) => ({ ...prev, [runId]: res.data }));
      }
    }
    setExpanded(next);
  };

  const stopRun = async (runId: string) => {
    await electron?.browserRun.stop(runId);
    await load();
  };

  const enableWatch = async (runId: string) => {
    await electron?.browserRun.enableWatch(runId);
    await load();
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-y-auto">
      <div className="px-6 py-5 border-b border-zinc-800 flex items-center gap-3">
        <Activity className="w-5 h-5 text-zinc-400" />
        <h1 className="text-lg font-semibold text-zinc-100">Browser Runs</h1>
        <button onClick={load} className="ml-auto text-xs px-3 py-1.5 rounded border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700">Refresh</button>
      </div>

      <div className="p-6 space-y-3">
        {runs.length === 0 && (
          <div className="text-center py-20 text-zinc-600 text-sm">No active runs. Start one from the Browser tab.</div>
        )}
        {runs.map((run) => (
          <div key={run.id} className="border border-zinc-800 rounded-lg bg-zinc-900 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-800/50" onClick={() => toggleExpand(run.id)}>
              {expanded.has(run.id) ? <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />}
              <span className={clsx('text-xs font-semibold', RUN_TYPE_COLORS[run.runType] ?? 'text-zinc-400')}>{run.runType}</span>
              <span className={clsx('text-[10px] font-bold uppercase px-1.5 py-0.5 rounded', STATUS_COLORS[run.status] ?? 'text-zinc-400 bg-zinc-800')}>{run.status}</span>
              <span className="text-xs text-zinc-500 truncate flex-1">{run.targetUrl ?? '—'}</span>
              <div className="flex items-center gap-1.5 text-xs text-zinc-600 shrink-0">
                <span className="font-mono">{run.leaderBrowserType?.replace('machine-', '')}</span>
                {run.watchEnabled && <Eye className="w-3.5 h-3.5 text-emerald-500" />}
              </div>
              {run.startedAt && (
                <span className="text-[10px] text-zinc-600 shrink-0">{formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}</span>
              )}
            </div>

            {expanded.has(run.id) && (
              <div className="border-t border-zinc-800 px-4 py-3 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><span className="text-zinc-600">Mode:</span> <span className="text-zinc-300">{run.mode}</span></div>
                  <div><span className="text-zinc-600">Leader:</span> <span className="text-zinc-300">{run.leaderBrowserType}</span></div>
                  {run.followerBrowserType && <div><span className="text-zinc-600">Follower:</span> <span className="text-zinc-300">{run.followerBrowserType}</span></div>}
                  {run.linkedCompanyId && <div><span className="text-zinc-600">Company:</span> <span className="text-zinc-300 font-mono text-[10px]">{run.linkedCompanyId}</span></div>}
                  {run.error && <div className="col-span-2"><span className="text-red-400">{run.error}</span></div>}
                </div>

                {runDetails[run.id]?.events?.length > 0 && (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    <div className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold mb-1">Events</div>
                    {runDetails[run.id].events.map((ev: any) => (
                      <div key={ev.id} className="flex items-center gap-2 text-[10px] text-zinc-500">
                        <span className="text-zinc-600 font-mono">{new Date(ev.createdAt).toLocaleTimeString()}</span>
                        <span className={clsx('font-semibold', ev.actorType === 'machine' ? 'text-amber-500' : ev.actorType === 'human' ? 'text-blue-400' : 'text-zinc-500')}>{ev.actorType}</span>
                        <span>{ev.eventType}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  {['running', 'pending', 'paused'].includes(run.status) && (
                    <button onClick={() => stopRun(run.id)} className="text-xs px-3 py-1.5 rounded border border-red-800 text-red-400 hover:bg-red-900/20 flex items-center gap-1.5">
                      <Square className="w-3 h-3" /> Stop
                    </button>
                  )}
                  {!run.watchEnabled && ['running', 'paused'].includes(run.status) && (
                    <button onClick={() => enableWatch(run.id)} className="text-xs px-3 py-1.5 rounded border border-zinc-700 text-zinc-400 hover:bg-zinc-800 flex items-center gap-1.5">
                      <Eye className="w-3 h-3" /> Enable Watch
                    </button>
                  )}
                  <a href={`/browser/watch?runId=${run.id}`} className="text-xs px-3 py-1.5 rounded border border-zinc-700 text-zinc-400 hover:bg-zinc-800 flex items-center gap-1.5">
                    <Globe className="w-3 h-3" /> Watch View
                  </a>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
