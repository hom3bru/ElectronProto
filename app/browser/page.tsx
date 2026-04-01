'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, X, ChevronLeft, ChevronRight, RotateCw, Bookmark } from 'lucide-react';
import { clsx } from 'clsx';

interface Tab {
  id: string;
  url: string;
  title: string;
  loadingState: boolean;
}

export default function BrowserPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');

  const electron = typeof window !== 'undefined' ? (window as any).electron : null;

  useEffect(() => {
    if (!electron) return;

    const loadTabs = async () => {
      const dbTabs = await electron.db.getTabs();
      setTabs(dbTabs.map((t: any) => ({ id: t.id, url: t.url, title: t.title || 'New Tab', loadingState: !!t.loadingState })));
      if (dbTabs.length > 0) {
        setActiveTabId(dbTabs[0].id);
        electron.browser.switchTab(dbTabs[0].id);
      }
    };
    loadTabs();

    electron.browser.onTabUpdated((data: any) => {
      setTabs((prev) => prev.map((t) => (t.id === data.id ? { ...t, ...data } : t)));
      if (data.id === activeTabId && data.url) {
        setUrlInput(data.url);
      }
    });
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
    return () => window.removeEventListener('resize', updateBounds);
  }, [electron, activeTabId]);

  const handleCreateTab = async () => {
    if (!electron) return;
    const id = await electron.browser.createTab('browser-default', 'https://google.com');
    setTabs([...tabs, { id, url: 'https://google.com', title: 'New Tab', loadingState: false }]);
    setActiveTabId(id);
    electron.browser.switchTab(id);
    setUrlInput('https://google.com');
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

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Tab Strip */}
      <div className="flex items-center bg-zinc-900 border-b border-zinc-800 h-10 px-2 gap-1">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => handleSwitchTab(tab.id)}
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 max-w-[200px] min-w-[120px] rounded-t-md cursor-pointer border-r border-zinc-800 text-xs',
              activeTabId === tab.id ? 'bg-zinc-800 text-zinc-100' : 'bg-transparent text-zinc-400 hover:bg-zinc-800/50'
            )}
          >
            <span className="truncate flex-1">{tab.title}</span>
            <button onClick={(e) => handleCloseTab(e, tab.id)} className="hover:bg-zinc-700 rounded p-0.5">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        <button onClick={handleCreateTab} className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md ml-1">
          <Plus className="w-4 h-4" />
        </button>
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
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleNavigate} className="flex-1 flex items-center">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1 text-sm focus:outline-none focus:border-zinc-700 text-zinc-200"
            placeholder="Enter URL..."
          />
        </form>
        <button className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md">
          <Bookmark className="w-4 h-4" />
        </button>
      </div>

      {/* Browser Content Area */}
      <div className="flex-1 flex">
        <div ref={containerRef} className="flex-1 bg-zinc-950 relative">
          {!electron && (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-sm">
              Desktop environment required to render WebContentsView.
            </div>
          )}
        </div>
        
        {/* Side Drawer for Actions */}
        <div className="w-64 border-l border-zinc-800 bg-zinc-900 p-4 flex flex-col gap-4 shrink-0">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Page Actions</h3>
          <button className="w-full text-left px-3 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors">
            Save page to notebook
          </button>
          <button className="w-full text-left px-3 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors">
            Extract as evidence
          </button>
          <button className="w-full text-left px-3 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors">
            Link to company
          </button>
          <button className="w-full text-left px-3 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors">
            Create follow-up task
          </button>
        </div>
      </div>
    </div>
  );
}
