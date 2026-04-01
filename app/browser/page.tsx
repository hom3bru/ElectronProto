'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, X, ChevronLeft, ChevronRight, RotateCw, Bookmark, Shield } from 'lucide-react';
import { clsx } from 'clsx';

interface Tab {
  id: string;
  url: string;
  title: string;
  loadingState: boolean;
  sessionPartition: string;
}

export default function BrowserPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [partition, setPartition] = useState('browser-default');

  const electron = typeof window !== 'undefined' ? (window as any).electron : null;

  useEffect(() => {
    if (!electron) return;

    const loadTabs = async () => {
      const dbTabs = await electron.db.query('browserTabs', 'findMany', {});
      
      // Restore tabs in the backend
      for (const t of dbTabs) {
        await electron.browser.restoreTab(t.id, t.sessionPartition, t.url);
      }

      setTabs(dbTabs.map((t: any) => ({ 
        id: t.id, 
        url: t.url, 
        title: t.title || 'New Tab', 
        loadingState: !!t.loadingState,
        sessionPartition: t.sessionPartition
      })));

      if (dbTabs.length > 0) {
        setActiveTabId(dbTabs[0].id);
        electron.browser.switchTab(dbTabs[0].id);
        setUrlInput(dbTabs[0].url);
      }
    };
    loadTabs();
  }, [electron]);

  useEffect(() => {
    if (!electron) return;

    const cleanup = electron.browser.onTabUpdated((data: any) => {
      setTabs((prev) => prev.map((t) => (t.id === data.id ? { ...t, ...data } : t)));
      if (data.id === activeTabId && data.url) {
        setUrlInput(data.url);
      }
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [electron, activeTabId]);

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
    return () => window.removeEventListener('resize', updateBounds);
  }, [electron, activeTabId]);

  const handleCreateTab = async () => {
    if (!electron) return;
    const url = 'https://google.com';
    const id = await electron.browser.createTab(partition, url);
    setTabs([...tabs, { id, url, title: 'New Tab', loadingState: false, sessionPartition: partition }]);
    setActiveTabId(id);
    electron.browser.switchTab(id);
    setUrlInput(url);
  };

  const handleSwitchTab = (id: string) => {
    if (!electron) return;
    setActiveTabId(id);
    electron.browser.switchTab(id);
    const tab = tabs.find(t => t.id === id);
    if (tab) setUrlInput(tab.url);
  };

  const handleCloseTab = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!electron) return;
    await electron.browser.closeTab(id);
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) {
      if (newTabs.length > 0) {
        handleSwitchTab(newTabs[newTabs.length - 1].id);
      } else {
        setActiveTabId(null);
        setUrlInput('');
      }
    }
  };

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!electron || !activeTabId) return;
    let targetUrl = urlInput;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`;
    }
    electron.browser.navigate(activeTabId, targetUrl);
  };

  const activeTab = tabs.find(t => t.id === activeTabId);

  // Actions
  const handleAction = async (command: string) => {
    if (!electron || !activeTab) return;
    await electron.cmd.execute(command, { tabId: activeTab.id, url: activeTab.url, title: activeTab.title });
    alert(`Executed ${command} for ${activeTab.title}`);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Tab Strip */}
      <div className="flex items-center bg-zinc-900 border-b border-zinc-800 h-10 px-2 gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => handleSwitchTab(tab.id)}
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 max-w-[200px] min-w-[120px] rounded-t-md cursor-pointer border-r border-zinc-800 text-xs shrink-0',
              activeTabId === tab.id ? 'bg-zinc-800 text-zinc-100' : 'bg-transparent text-zinc-400 hover:bg-zinc-800/50'
            )}
          >
            <div className={clsx("w-2 h-2 rounded-full", tab.sessionPartition === 'inbox' ? 'bg-blue-500' : tab.sessionPartition === 'crm' ? 'bg-emerald-500' : 'bg-zinc-500')} />
            <span className="truncate flex-1">{tab.title}</span>
            <button onClick={(e) => handleCloseTab(e, tab.id)} className="hover:bg-zinc-700 rounded p-0.5">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2 ml-2 shrink-0">
          <select 
            value={partition} 
            onChange={e => setPartition(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 rounded px-2 py-1 outline-none"
          >
            <option value="browser-default">Default Session</option>
            <option value="inbox">Inbox Session</option>
            <option value="crm">CRM Session</option>
            <option value="agent-sandbox">Agent Sandbox</option>
          </select>
          <button onClick={handleCreateTab} className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Address Bar */}
      <div className="flex items-center gap-2 p-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-1">
          <button onClick={() => activeTabId && electron?.browser.goBack(activeTabId)} className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => activeTabId && electron?.browser.goForward(activeTabId)} className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={() => activeTabId && electron?.browser.reload(activeTabId)} className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md">
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
        <div className="w-64 border-l border-zinc-800 bg-zinc-900 p-4 flex flex-col gap-4 shrink-0 overflow-y-auto">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Page Actions</h3>
          
          <div className="space-y-2">
            <button 
              onClick={() => handleAction('createEvidenceFromBrowserTab')}
              className="w-full text-left px-3 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors border border-zinc-700"
            >
              Extract as Evidence
            </button>
            <button 
              onClick={() => handleAction('linkBrowserTabToCompany')}
              className="w-full text-left px-3 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors border border-zinc-700"
            >
              Link to Company
            </button>
            <button 
              onClick={() => handleAction('createTaskFromBrowserTab')}
              className="w-full text-left px-3 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors border border-zinc-700"
            >
              Create Follow-up Task
            </button>
          </div>

          <div className="mt-4 pt-4 border-t border-zinc-800">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Tab Metadata</h3>
            {activeTab ? (
              <div className="space-y-3 text-xs text-zinc-400">
                <div>
                  <span className="block text-zinc-500 mb-1">Partition</span>
                  <span className="text-zinc-200 bg-zinc-800 px-2 py-1 rounded">{activeTab.sessionPartition}</span>
                </div>
                <div>
                  <span className="block text-zinc-500 mb-1">Title</span>
                  <span className="text-zinc-200 line-clamp-2">{activeTab.title}</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-zinc-600">No active tab</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
