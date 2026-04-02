'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, X, ChevronLeft, ChevronRight, RotateCw, Bookmark, Shield, Link2, FileText, CheckSquare } from 'lucide-react';
import { clsx } from 'clsx';
import { EntityPicker } from '@/components/entity-picker';

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
