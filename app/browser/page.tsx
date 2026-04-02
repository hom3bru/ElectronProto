'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Plus, X, ChevronLeft, ChevronRight, RotateCw, Bookmark, Shield, Link2,
  FileText, CheckSquare, BookOpen, Bot, Eye, Zap, Globe, Tag, Crosshair,
  AlertTriangle, Play, Square, Activity } from 'lucide-react';
import { clsx } from 'clsx';
import { EntityPicker } from '@/components/entity-picker';

type BrowserMode = 'normal' | 'training' | 'assist' | 'autonomous' | 'watch';

interface BrowserTabState {
  id: string;
  url: string;
  title: string;
  loadingState: boolean;
  sessionPartition: string;
  active: boolean;
  tabOrder: number;
}

interface BrowserState {
  tabs: BrowserTabState[];
  activeTabId: string | null;
}

export default function BrowserPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Single source of truth from Main Process
  const [browserState, setBrowserState] = useState<BrowserState>({ tabs: [], activeTabId: null });
  const [urlInput, setUrlInput] = useState('');
  const [partition, setPartition] = useState('browser-default');

  const electron = typeof window !== 'undefined' ? (window as any).electron : null;

  // ─── Mode & Orchestration State ────────────────────────────────────────────
  const [browserMode, setBrowserMode] = useState<BrowserMode>('normal');
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [watchState, setWatchState] = useState<any>(null);
  const [siteProfile, setSiteProfile] = useState<any>(null);

  // ─── Training Panel State ───────────────────────────────────────────────────
  const [trainingTab, setTrainingTab] = useState<'site' | 'field' | 'recipe' | 'annotate'>('site');
  const [fieldName, setFieldName] = useState('');
  const [fieldSelector, setFieldSelector] = useState('');
  const [fieldKeywords, setFieldKeywords] = useState('');
  const [recipeName, setRecipeName] = useState('');
  const [annotationNote, setAnnotationNote] = useState('');
  const [trainingMsg, setTrainingMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!electron) return;

    // Load initial state
    electron.browser.getState().then((state: BrowserState) => {
      setBrowserState(state);
      const activeTab = state.tabs.find(t => t.id === state.activeTabId);
      if (activeTab) setUrlInput(activeTab.url);
    });

    // Subscribe to all state modifications
    const cleanup = electron.browser.onStateUpdated((state: BrowserState) => {
      setBrowserState(state);
      const activeTab = state.tabs.find(t => t.id === state.activeTabId);
      if (activeTab && activeTab.url) {
        setUrlInput(activeTab.url);
      }
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [electron]);

  useEffect(() => {
    if (!electron || !containerRef.current) return;

    const updateBounds = () => {
      const rect = containerRef.current!.getBoundingClientRect();
      electron.browser.setBounds({
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    };

    updateBounds();
    window.addEventListener('resize', updateBounds);
    
    // Cleanup: Hide the native browser view when navigating away from this route.
    // Also update bounds anytime active tab changes to ensure size sync
    return () => {
      window.removeEventListener('resize', updateBounds);
      if (electron) {
        electron.browser.hide();
      }
    };
  }, [electron, browserState.activeTabId]);

  const handleCreateTab = async () => {
    if (!electron) return;
    await electron.browser.createTab(partition, 'https://google.com');
  };

  const handleSwitchTab = (id: string) => {
    if (!electron) return;
    electron.browser.switchTab(id);
  };

  const handleCloseTab = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!electron) return;
    await electron.browser.closeTab(id);
  };

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!electron || !browserState.activeTabId) return;
    let targetUrl = urlInput;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`;
    }
    electron.browser.navigate(browserState.activeTabId, targetUrl);
  };

  const activeTab = browserState.tabs.find(t => t.id === browserState.activeTabId);

  // Side Panel Context Hook
  const [linkedCompany, setLinkedCompany] = useState<any>(null);
  const [relatedEvidence, setRelatedEvidence] = useState<any[]>([]);
  const [relatedTasks, setRelatedTasks] = useState<any[]>([]);
  const [noteInput, setNoteInput] = useState('');

  const reloadContext = async () => {
    if (!electron || !activeTab) return;
    try {
      const response = await electron.browser.getTabContext(activeTab.id);
      if (response && response.ok && response.data) {
        const { linkedCompany, recentEvidence, recentTasks } = response.data;
        setLinkedCompany(linkedCompany);
        setRelatedEvidence(recentEvidence || []);
        setRelatedTasks(recentTasks || []);
      } else {
        setLinkedCompany(null);
        setRelatedEvidence([]);
        setRelatedTasks([]);
      }
    } catch (e) {
      console.error("Failed to load related data", e);
    }
  };

  useEffect(() => {
    reloadContext();
  }, [electron, activeTab?.id]);

  // Load site profile when in training mode and URL changes
  useEffect(() => {
    if (!electron || browserMode !== 'training' || !activeTab?.url) return;
    electron.training.getSiteProfileForUrl(activeTab.url).then((res: any) => {
      if (res?.ok) setSiteProfile(res.data);
    }).catch(() => {});
  }, [electron, browserMode, activeTab?.url]);

  // Subscribe to watch updates
  useEffect(() => {
    if (!electron || !activeRunId) return;
    const unsub = electron.browserRun.onWatchUpdate((state: any) => {
      if (state.runId === activeRunId) setWatchState(state);
    });
    // Load initial snapshot
    electron.browserRun.watchSnapshot(activeRunId).then((res: any) => {
      if (res?.ok) setWatchState(res.data);
    }).catch(() => {});
    return () => unsub?.();
  }, [electron, activeRunId]);

  const enterMode = async (mode: BrowserMode) => {
    if (mode === browserMode) { setBrowserMode('normal'); return; }
    setBrowserMode(mode);
    if (mode === 'training' && activeTab?.url) {
      // Ensure a site profile exists / load it
      const res = await electron?.training.getSiteProfileForUrl(activeTab.url);
      if (res?.ok) setSiteProfile(res.data);
    }
    if (mode === 'autonomous' && activeTab?.url) {
      const res = await electron?.browserRun.start({
        runType: 'autonomous-automation', mode: 'autonomous',
        leaderBrowserType: 'machine-playwright', targetUrl: activeTab.url, watchEnabled: true,
      });
      if (res?.ok) { setActiveRunId(res.data?.id ?? null); setBrowserMode('watch'); }
    }
    if (mode === 'assist' && activeTab?.url) {
      const res = await electron?.browserRun.start({
        runType: 'visible-agent-control', mode: 'assist',
        leaderBrowserType: 'visible-electron', targetUrl: activeTab.url,
      });
      if (res?.ok) setActiveRunId(res.data?.id ?? null);
    }
  };

  const doAction = async (action: () => Promise<any>) => {
    if (!electron || !activeTab) return;
    try {
      await action();
      await reloadContext();
    } catch (e) {
      console.error(e);
    }
  };

  // Group tabs by partition
  const partitions = Array.from(new Set(browserState.tabs.map(t => t.sessionPartition)));

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Contextual Tab Strip */}
      <div className="flex flex-col bg-zinc-900 border-b border-zinc-800">
        {partitions.map((part) => {
          const partTabs = browserState.tabs.filter(t => t.sessionPartition === part).sort((a,b) => a.tabOrder - b.tabOrder);
          if (partTabs.length === 0) return null;
          
          return (
            <div key={part} className="flex items-center px-1 border-b border-zinc-800/50 last:border-0 h-9">
              <div className="px-2 py-1 text-[10px] font-bold tracking-widest text-zinc-500 uppercase w-32 shrink-0 flex items-center gap-1.5">
                <div className={clsx("w-1.5 h-1.5 rounded-full", part === 'inbox' ? 'bg-blue-500' : part === 'crm' ? 'bg-emerald-500' : 'bg-zinc-500')} />
                {part.replace('browser-', '')}
              </div>
              
              <div className="flex items-center gap-1 overflow-x-auto">
                {partTabs.map((tab) => (
                  <div
                    key={tab.id}
                    onClick={() => handleSwitchTab(tab.id)}
                    className={clsx(
                      'flex items-center gap-2 px-3 py-1 max-w-[200px] min-w-[120px] rounded-t-md cursor-pointer border border-b-0 border-zinc-800 text-xs shrink-0 mt-1',
                      browserState.activeTabId === tab.id ? 'bg-zinc-800 text-zinc-100' : 'bg-transparent text-zinc-400 hover:bg-zinc-800/50'
                    )}
                  >
                    <span className="truncate flex-1">{tab.title}</span>
                    <button onClick={(e) => handleCloseTab(e, tab.id)} className="hover:bg-zinc-700 rounded p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div className="flex items-center h-10 px-3 bg-zinc-900/50 gap-2">
          <select 
            value={partition} 
            onChange={e => setPartition(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 text-xs text-zinc-400 rounded px-2 py-1.5 outline-none hover:text-zinc-200"
          >
            <option value="browser-default">Default Context</option>
            <option value="inbox">Inbox Context</option>
            <option value="crm">CRM Context</option>
            <option value="agent-sandbox">Agent Sandbox</option>
          </select>
          <button onClick={handleCreateTab} className="flex items-center gap-1 text-xs px-2 py-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border border-transparent hover:border-zinc-700 rounded-md transition-all">
            <Plus className="w-3.5 h-3.5" />
            <span>New Tab</span>
          </button>
        </div>
      </div>

      {/* Address Bar */}
      <div className="flex items-center gap-2 p-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-1">
          <button onClick={() => browserState.activeTabId && electron?.browser.goBack(browserState.activeTabId)} className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => browserState.activeTabId && electron?.browser.goForward(browserState.activeTabId)} className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={() => browserState.activeTabId && electron?.browser.reload(browserState.activeTabId)} className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md">
            <RotateCw className={clsx("w-4 h-4", activeTab?.loadingState && "animate-spin")} />
          </button>
        </div>
        <form onSubmit={handleNavigate} className="flex-1 flex items-center">
          <div className="relative w-full flex items-center">
            <Shield className="w-3 h-3 absolute left-3 text-zinc-500" />
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-8 pr-3 py-1 text-sm focus:outline-none focus:border-zinc-700 text-zinc-200"
              placeholder="Enter URL..."
            />
          </div>
        </form>
        <button className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md">
          <Bookmark className="w-4 h-4" />
        </button>
      </div>

      {/* Mode Bar */}
      <div className="flex items-center gap-1 px-3 py-1.5 bg-zinc-900/80 border-b border-zinc-800">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mr-2">Mode</span>
        {([
          { mode: 'training' as BrowserMode, icon: BookOpen, label: 'Train', color: 'blue' },
          { mode: 'assist' as BrowserMode, icon: Bot, label: 'Assist', color: 'violet' },
          { mode: 'autonomous' as BrowserMode, icon: Zap, label: 'Auto', color: 'amber' },
          { mode: 'watch' as BrowserMode, icon: Eye, label: 'Watch', color: 'emerald' },
        ] as const).map(({ mode, icon: Icon, label, color }) => (
          <button
            key={mode}
            onClick={() => enterMode(mode)}
            className={clsx(
              'flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border transition-all',
              browserMode === mode
                ? `bg-${color}-500/20 border-${color}-500/50 text-${color}-300`
                : 'border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 bg-transparent'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
        {activeRunId && (
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Run active
            </div>
            <button
              onClick={() => electron?.browserRun.stop(activeRunId).then(() => { setActiveRunId(null); setWatchState(null); })}
              className="text-xs px-2 py-0.5 rounded border border-red-800 text-red-400 hover:bg-red-900/30"
            >
              Stop
            </button>
          </div>
        )}
      </div>

      {/* Browser Content Area */}
      <div className="flex-1 flex min-h-0">
        <div ref={containerRef} className="flex-1 bg-zinc-950 relative">
          {!electron && (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-sm">
              Desktop environment required to render WebContentsView.
            </div>
          )}
        </div>
        
        {/* Side Drawer for Actions */}
        <div className="w-72 border-l border-zinc-800 bg-zinc-900 flex flex-col shrink-0 overflow-y-auto">

          {/* ── Training Panel ───────────────────────────────────────────── */}
          {browserMode === 'training' && activeTab && (
            <div className="p-4 flex flex-col gap-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-blue-400">Training Mode</span>
              </div>
              {trainingMsg && <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-1">{trainingMsg}</div>}

              {/* Site approval */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Domain:</span>
                  <span className="text-xs font-mono text-zinc-300">{new URL(activeTab.url).hostname}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Trust:</span>
                  <span className={clsx('text-xs font-semibold', siteProfile?.trustStatus === 'trusted' ? 'text-emerald-400' : siteProfile?.trustStatus === 'blocked' ? 'text-red-400' : 'text-zinc-500')}>
                    {siteProfile?.trustStatus ?? 'unreviewed'}
                  </span>
                </div>
                <button
                  onClick={async () => {
                    const res = await electron?.training.approveSite(activeTab.url);
                    if (res?.ok) { setSiteProfile(res.data); setTrainingMsg('Site approved as trusted'); setTimeout(() => setTrainingMsg(null), 3000); }
                  }}
                  className="w-full text-xs py-1.5 rounded-md border border-emerald-800 text-emerald-400 hover:bg-emerald-900/20 transition-colors"
                >
                  Approve & Trust Site
                </button>
              </div>

              {/* Sub-tabs */}
              <div className="flex gap-1 text-xs">
                {(['site', 'field', 'recipe', 'annotate'] as const).map((t) => (
                  <button key={t} onClick={() => setTrainingTab(t)}
                    className={clsx('px-2 py-1 rounded capitalize', trainingTab === t ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300')}
                  >{t}</button>
                ))}
              </div>

              {trainingTab === 'field' && (
                <div className="space-y-2">
                  <input value={fieldName} onChange={e => setFieldName(e.target.value)} placeholder="Field name (e.g. company-name)" className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700" />
                  <input value={fieldSelector} onChange={e => setFieldSelector(e.target.value)} placeholder="CSS selector" className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700" />
                  <textarea value={fieldKeywords} onChange={e => setFieldKeywords(e.target.value)} placeholder="Keywords (comma-separated)" className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200 resize-none h-16 focus:outline-none focus:border-zinc-700" />
                  <button
                    disabled={!fieldName.trim()}
                    onClick={async () => {
                      const res = await electron?.training.createFieldProfile({
                        siteProfileId: siteProfile?.id, fieldName: fieldName.trim(),
                        detectionType: fieldSelector ? 'selector' : fieldKeywords ? 'keyword' : 'combined',
                        selectorRules: fieldSelector ? { primary: fieldSelector } : null,
                        keywordRules: fieldKeywords ? fieldKeywords.split(',').map((k: string) => k.trim()) : null,
                      });
                      if (res?.ok) { setFieldName(''); setFieldSelector(''); setFieldKeywords(''); setTrainingMsg('Field profile created'); setTimeout(() => setTrainingMsg(null), 3000); }
                    }}
                    className="w-full text-xs py-1.5 rounded-md border border-blue-800 text-blue-400 hover:bg-blue-900/20 disabled:opacity-50 transition-colors"
                  >
                    Create Field Profile
                  </button>
                </div>
              )}

              {trainingTab === 'recipe' && (
                <div className="space-y-2">
                  <input value={recipeName} onChange={e => setRecipeName(e.target.value)} placeholder="Recipe name" className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700" />
                  <button
                    disabled={!recipeName.trim()}
                    onClick={async () => {
                      const res = await electron?.training.createAutomationRecipe({
                        siteProfileId: siteProfile?.id, name: recipeName.trim(), triggerType: 'manual',
                      });
                      if (res?.ok) { setRecipeName(''); setTrainingMsg('Recipe created'); setTimeout(() => setTrainingMsg(null), 3000); }
                    }}
                    className="w-full text-xs py-1.5 rounded-md border border-blue-800 text-blue-400 hover:bg-blue-900/20 disabled:opacity-50 transition-colors"
                  >
                    Create Recipe
                  </button>
                </div>
              )}

              {trainingTab === 'annotate' && (
                <div className="space-y-2">
                  <textarea value={annotationNote} onChange={e => setAnnotationNote(e.target.value)} placeholder="Annotation note about this page or element..." className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200 resize-none h-20 focus:outline-none focus:border-zinc-700" />
                  <button
                    onClick={async () => {
                      const res = await electron?.training.createAnnotation({
                        siteProfileId: siteProfile?.id, pageUrl: activeTab.url,
                        annotationType: 'page', selectionData: { url: activeTab.url, title: activeTab.title },
                        note: annotationNote,
                      });
                      if (res?.ok) { setAnnotationNote(''); setTrainingMsg('Annotation saved'); setTimeout(() => setTrainingMsg(null), 3000); }
                    }}
                    className="w-full text-xs py-1.5 rounded-md border border-blue-800 text-blue-400 hover:bg-blue-900/20 transition-colors"
                  >
                    Save Annotation
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Watch Panel ──────────────────────────────────────────────── */}
          {(browserMode === 'watch' || browserMode === 'autonomous') && (
            <div className="p-4 flex flex-col gap-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">Watch</span>
                {watchState && (
                  <span className={clsx('ml-auto text-xs px-1.5 py-0.5 rounded', watchState.status === 'running' ? 'bg-emerald-500/20 text-emerald-300' : watchState.status === 'failed' ? 'bg-red-500/20 text-red-300' : 'bg-zinc-700 text-zinc-400')}>
                    {watchState.status}
                  </span>
                )}
              </div>
              {watchState ? (
                <div className="space-y-2">
                  <div className="text-xs font-mono text-zinc-300 bg-zinc-950 rounded px-2 py-1.5 break-all border border-zinc-800">{watchState.currentUrl || '—'}</div>
                  {watchState.title && <div className="text-xs text-zinc-400 truncate">{watchState.title}</div>}
                  {watchState.currentAction && <div className="text-xs text-zinc-500 italic">{watchState.currentAction}</div>}
                  {watchState.screenshotDataUrl && (
                    <img src={watchState.screenshotDataUrl} alt="Machine browser" className="w-full rounded border border-zinc-800" />
                  )}
                  {watchState.events?.length > 0 && (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {watchState.events.slice(0, 10).map((ev: any, i: number) => (
                        <div key={i} className="text-[10px] text-zinc-500 flex gap-1.5">
                          <span className="text-zinc-600">{ev.eventType}</span>
                          <span>{ev.actorType}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-zinc-600">No active machine run</div>
              )}
              {activeRunId && (
                <div className="flex gap-2">
                  <button onClick={() => electron?.browserRun.stop(activeRunId).then(() => { setActiveRunId(null); setWatchState(null); setBrowserMode('normal'); })}
                    className="flex-1 text-xs py-1.5 rounded border border-red-800 text-red-400 hover:bg-red-900/20">
                    Stop Run
                  </button>
                  <a href={`/browser/watch?runId=${activeRunId}`}
                    className="flex-1 text-center text-xs py-1.5 rounded border border-zinc-700 text-zinc-400 hover:bg-zinc-800">
                    Full View
                  </a>
                </div>
              )}
            </div>
          )}

          {activeTab ? (
            <div className="p-5 flex flex-col gap-5">
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Active Tab Info</h3>
                <div className="bg-zinc-950 rounded-md border border-zinc-800 p-3">
                   <div className="text-sm font-medium text-zinc-200 line-clamp-2">{activeTab.title}</div>
                   <div className="text-xs text-zinc-500 mt-2 flex items-center gap-1.5">
                     <Shield className="w-3 h-3" />
                     {activeTab.sessionPartition}
                   </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Capture & Tasking</h3>
                <div className="space-y-2">
                  <button 
                    onClick={() => doAction(() => electron.inbox.createEvidenceFromBrowserTab(activeTab.id, activeTab.url, activeTab.title))}
                    className="w-full text-left px-3 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors border border-zinc-700 flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4 text-zinc-400" />
                    Extract as Evidence
                  </button>
                  <button 
                    onClick={() => doAction(() => electron.tasks.createTask({ title: `Review ${activeTab.url}`, type: 'review-browser-tab', priority: 'normal', relatedEntityType: 'browser_tab', relatedEntityId: activeTab.id }))}
                    className="w-full text-left px-3 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors border border-zinc-700 flex items-center gap-2"
                  >
                    <CheckSquare className="w-4 h-4 text-zinc-400" />
                    Create Follow-up Task
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                 <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Graph Link</h3>
                 {/* <EntityPicker 
                   sourceType="browser_tab"
                   sourceId={activeTab.id}
                 /> */}
              </div>

              <div className="space-y-3 border-t border-zinc-800 pt-5">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Active Note Stream</h3>
                <div className="flex flex-col gap-2">
                  <textarea 
                    value={noteInput}
                    onChange={e => setNoteInput(e.target.value)}
                    placeholder="Capture thoughts..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-3 text-sm text-zinc-200 resize-none h-24 focus:outline-none focus:border-zinc-700"
                  />
                  <button 
                    onClick={() => {
                      doAction(() => electron.tasks.appendNotebookEntryFromBrowserTab(activeTab.id, noteInput));
                      setNoteInput('');
                    }}
                    disabled={!noteInput.trim()}
                    className="w-full px-3 py-2 text-sm font-medium bg-zinc-100 text-zinc-900 hover:bg-white rounded-md transition-colors disabled:opacity-50"
                  >
                    Save Note
                  </button>
                </div>
              </div>

              {linkedCompany && (
                <div className="space-y-3 border-t border-zinc-800 pt-5">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Bound Pipeline</h3>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-md p-3">
                    <div className="font-medium text-sm text-emerald-400 flex items-center gap-2">
                      <Link2 className="w-4 h-4" />
                      {linkedCompany.name}
                    </div>
                  </div>
                  
                  {relatedTasks.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-xs font-semibold text-zinc-400 mb-2">Imminent Tasks</h4>
                      <div className="space-y-1">
                        {relatedTasks.slice(0, 3).map(task => (
                          <div key={task.id} className="text-xs text-zinc-300 truncate pl-2 border-l-2 border-zinc-700">• {task.title}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {relatedEvidence.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-xs font-semibold text-zinc-400 mb-2">Related Evidence Cache</h4>
                      <div className="space-y-1">
                        {relatedEvidence.slice(0, 3).map(ev => (
                          <div key={ev.id} className="text-xs text-zinc-300 truncate pl-2 border-l-2 border-zinc-700 italic">&quot;{ev.claimSummary}&quot;</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
             <div className="p-8 text-center text-sm text-zinc-500 mt-20">
                Select or create a tab<br/>to view subsystem context.
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
