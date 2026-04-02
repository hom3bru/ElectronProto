'use client';

import { useEffect, useState, useCallback } from 'react';
import { Eye, Square, ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';

export default function WatchPage() {
  const electron = typeof window !== 'undefined' ? (window as any).electron : null;
  const [runId, setRunId] = useState<string | null>(null);
  const [watchState, setWatchState] = useState<any>(null);
  const [run, setRun] = useState<any>(null);

  // Read runId from URL search params (Next.js static export uses window.location)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get('runId');
    setRunId(id);
  }, []);

  const loadSnapshot = useCallback(async () => {
    if (!electron || !runId) return;
    const [snapRes, runRes] = await Promise.all([
      electron.browserRun.watchSnapshot(runId),
      electron.browserRun.get(runId),
    ]);
    if (snapRes?.ok) setWatchState(snapRes.data);
    if (runRes?.ok) setRun(runRes.data);
  }, [electron, runId]);

  useEffect(() => {
    if (!runId) return;
    loadSnapshot();
    const unsub = electron?.browserRun.onWatchUpdate((state: any) => {
      if (state.runId === runId) setWatchState(state);
    });
    return () => unsub?.();
  }, [electron, runId, loadSnapshot]);

  const stopRun = async () => {
    if (!runId) return;
    await electron?.browserRun.stop(runId);
    await loadSnapshot();
  };

  if (!runId) {
    return (
      <div className="flex items-center justify-center h-full bg-zinc-950 text-zinc-500 text-sm">
        No run ID specified. Open this page from a run.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-y-auto">
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-3">
        <a href="/browser/runs" className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-md">
          <ArrowLeft className="w-4 h-4" />
        </a>
        <Eye className="w-5 h-5 text-emerald-400" />
        <h1 className="text-base font-semibold text-zinc-100">Watch Surface</h1>
        {run && (
          <span className={clsx('ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded',
            run.status === 'running' ? 'text-emerald-300 bg-emerald-500/20' :
            run.status === 'failed' ? 'text-red-300 bg-red-500/20' : 'text-zinc-400 bg-zinc-800'
          )}>{run.status}</span>
        )}
        <button onClick={loadSnapshot} className="ml-auto p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-md">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 flex gap-0 min-h-0">
        {/* Main watch area */}
        <div className="flex-1 p-6 flex flex-col gap-5 overflow-y-auto">
          {/* Current URL */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Current URL</div>
            <div className="font-mono text-sm text-zinc-200 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 break-all">
              {watchState?.currentUrl || '—'}
            </div>
          </div>

          {/* Page title + current action */}
          {watchState?.title && (
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Page Title</div>
              <div className="text-sm text-zinc-300">{watchState.title}</div>
            </div>
          )}
          {watchState?.currentAction && (
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Current Action</div>
              <div className="text-sm text-zinc-400 italic">{watchState.currentAction}</div>
            </div>
          )}

          {/* Screenshot */}
          {watchState?.screenshotDataUrl && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Screenshot</div>
              <img src={watchState.screenshotDataUrl} alt="Machine browser view" className="w-full rounded-lg border border-zinc-800 shadow-xl" />
            </div>
          )}

          {/* Run meta */}
          {run && (
            <div className="grid grid-cols-2 gap-3 text-xs border-t border-zinc-800 pt-5">
              <div><span className="text-zinc-600">Type:</span> <span className="text-zinc-300">{run.runType}</span></div>
              <div><span className="text-zinc-600">Mode:</span> <span className="text-zinc-300">{run.mode}</span></div>
              <div><span className="text-zinc-600">Leader:</span> <span className="text-zinc-300">{run.leaderBrowserType}</span></div>
              <div><span className="text-zinc-600">Watch:</span> <span className={run.watchEnabled ? 'text-emerald-400' : 'text-zinc-500'}>{run.watchEnabled ? 'enabled' : 'disabled'}</span></div>
              {run.linkedCompanyId && <div className="col-span-2"><span className="text-zinc-600">Company:</span> <span className="text-zinc-400 font-mono text-[10px]">{run.linkedCompanyId}</span></div>}
              {run.error && <div className="col-span-2 text-red-400 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />{run.error}</div>}
            </div>
          )}

          {/* Controls */}
          {run && ['running', 'pending', 'paused'].includes(run.status) && (
            <div className="flex gap-3 border-t border-zinc-800 pt-5">
              <button onClick={stopRun} className="flex items-center gap-2 text-sm px-4 py-2 rounded-md border border-red-800 text-red-400 hover:bg-red-900/20 transition-colors">
                <Square className="w-4 h-4" /> Stop Run
              </button>
              <div className="text-xs text-zinc-600 flex items-center">Closing this view does not stop the run.</div>
            </div>
          )}
        </div>

        {/* Event log sidebar */}
        <div className="w-64 border-l border-zinc-800 bg-zinc-900 p-4 overflow-y-auto shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-3">Event Log</div>
          {(watchState?.events ?? run?.events ?? []).length === 0 ? (
            <div className="text-xs text-zinc-700">No events yet</div>
          ) : (
            <div className="space-y-2">
              {(watchState?.events ?? run?.events ?? []).slice(0, 40).map((ev: any, i: number) => (
                <div key={ev.id ?? i} className="text-[10px] space-y-0.5">
                  <div className={clsx('font-semibold', ev.actorType === 'machine' ? 'text-amber-500' : ev.actorType === 'human' ? 'text-blue-400' : 'text-zinc-500')}>
                    {ev.eventType}
                  </div>
                  <div className="text-zinc-600 font-mono">{ev.createdAt ? new Date(ev.createdAt).toLocaleTimeString() : ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
