import { BaseWindow, WebContentsView, session, WebContents } from 'electron';
import { db } from '../db';
import * as schema from '../db/schema';
import { eq, asc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

async function logNotebookEntry(
  entityType: string,
  entityId: string,
  entryType: string,
  message: string,
  opts?: {
    metadataJson?: any;
    parentEntityType?: string;
    parentEntityId?: string;
  }
) {
  try {
    await db.insert(schema.notebookEntries).values({
      id: uuidv4(),
      relatedEntityType: entityType,
      relatedEntityId: entityId,
      parentEntityType: opts?.parentEntityType,
      parentEntityId: opts?.parentEntityId,
      entryType,
      message,
      actorType: 'system',
      actorName: 'BrowserManager',
      metadataJson: opts?.metadataJson,
      createdAt: new Date(),
    });
  } catch (e) {
    console.error('Failed to log browser notebook entry', e);
  }
}

export interface BrowserTabState {
  id: string;
  url: string;
  title: string;
  loadingState: boolean;
  sessionPartition: string;
  active: boolean;
  tabOrder: number;
}

export interface BrowserState {
  tabs: BrowserTabState[];
  activeTabId: string | null;
}

export class BrowserManager {
  private views: Map<string, WebContentsView> = new Map();
  private state: BrowserState = { tabs: [], activeTabId: null };
  private window: BaseWindow;
  private uiView: WebContentsView;
  private currentBounds: Electron.Rectangle = { x: 0, y: 0, width: 0, height: 0 };
  private notifyRenderer: (channel: string, ...args: any[]) => void;

  constructor(
    window: BaseWindow, 
    uiView: WebContentsView, 
    notifyRenderer: (channel: string, ...args: any[]) => void
  ) {
    this.window = window;
    this.uiView = uiView;
    this.notifyRenderer = notifyRenderer;
  }

  public broadcastState() {
    this.notifyRenderer('browser:stateUpdated', this.state);
  }

  public getState() {
    return this.state;
  }

  async createTab(partition: string, url: string = 'https://google.com') {
    const id = uuidv4();
    const tabOrder = this.state.tabs.length;
    
    // Add to state
    this.state.tabs.push({
      id,
      url,
      title: 'New Tab',
      loadingState: false,
      sessionPartition: partition,
      active: false,
      tabOrder
    });

    // DB insert
    await db.insert(schema.browserTabs).values({
      id,
      sessionPartition: partition,
      url,
      title: 'New Tab',
      tabOrder,
      active: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const sess = session.fromPartition(`persist:${partition}`);
    const view = new WebContentsView({
      webPreferences: {
        session: sess,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    this.views.set(id, view);
    this.attachSecurityHandlers(view.webContents);
    view.webContents.loadURL(url);

    // Event capture
    view.webContents.on('did-finish-load', () => {
      this.updateTabState(id, { loadingState: false });
    });

    view.webContents.on('did-start-loading', () => {
      this.updateTabState(id, { loadingState: true });
    });

    view.webContents.on('page-title-updated', (e: any, title: string) => {
      this.updateTabState(id, { title });
    });

    view.webContents.on('did-navigate', (e: any, url: string) => {
      this.updateTabState(id, { url });
      logNotebookEntry('browser_tab', id, 'navigate', `Navigated to ${url}`, { metadataJson: { url } });
    });
    
    view.webContents.on('did-navigate-in-page', (e: any, url: string) => {
      this.updateTabState(id, { url });
      logNotebookEntry('browser_tab', id, 'navigate', `Navigated in-page to ${url}`, { metadataJson: { url } });
    });

    logNotebookEntry('browser_tab', id, 'created', `Tab created at ${url}`, { metadataJson: { url, partition } });
    
    await this.switchTab(id);
    return id;
  }

  private updateTabState(id: string, updates: Partial<BrowserTabState>) {
    const tab = this.state.tabs.find(t => t.id === id);
    if (!tab) return;
    
    Object.assign(tab, updates);
    this.broadcastState();

    // Persist volatile state
    if (updates.url !== undefined || updates.title !== undefined || updates.loadingState !== undefined) {
      db.update(schema.browserTabs)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.browserTabs.id, id))
        .catch(console.error);
    }
  }

  async switchTab(id: string) {
    const view = this.views.get(id);
    if (!view) {
      console.warn(`[BrowserManager] Cannot switch to non-existent tab: ${id}`);
      return;
    }

    if (this.state.activeTabId && this.views.has(this.state.activeTabId)) {
      const prevView = this.views.get(this.state.activeTabId);
      if (prevView) {
        try {
          this.window.contentView.removeChildView(prevView);
        } catch (e) {
          console.error('[BrowserManager] Failed to remove previous view', e);
        }
      }
      const prevTab = this.state.tabs.find(t => t.id === this.state.activeTabId);
      if (prevTab) prevTab.active = false;
    }
    
    try {
      this.window.contentView.addChildView(view);
      view.setBounds(this.currentBounds);
      this.state.activeTabId = id;
      const tab = this.state.tabs.find(t => t.id === id);
      if (tab) tab.active = true;

      // Atomic update of active state to prevent race conditions or massive DB locks
      await db.update(schema.browserTabs).set({ active: false }).where(eq(schema.browserTabs.active, true));
      await db.update(schema.browserTabs).set({ active: true, lastFocusedTimestamp: new Date(), updatedAt: new Date() }).where(eq(schema.browserTabs.id, id));
    } catch (e) {
      console.error('[BrowserManager] Failed to add new view', e);
      throw e;
    }
    
    this.broadcastState();
  }

  hideActiveTab() {
    if (this.state.activeTabId && this.views.has(this.state.activeTabId)) {
      const view = this.views.get(this.state.activeTabId);
      if (view) {
        try {
          this.window.contentView.removeChildView(view);
        } catch (e) {
          console.error('[BrowserManager] Failed to hide (remove) view', e);
        }
      }
    }
  }

  async closeTab(id: string) {
    const view = this.views.get(id);
    if (view) {
      if (this.state.activeTabId === id) {
        try {
          this.window.contentView.removeChildView(view);
        } catch (e) {
          console.error('[BrowserManager] Failed to remove view on close', e);
        }
        this.state.activeTabId = null;
      }
      try {
        (view.webContents as any).destroy();
      } catch (e) {
        console.error('[BrowserManager] Failed to destroy webContents', e);
      }
      this.views.delete(id);
      
      this.state.tabs = this.state.tabs.filter(t => t.id !== id);
      
      // Select last remaining tab
      if (this.state.activeTabId === null && this.state.tabs.length > 0) {
        await this.switchTab(this.state.tabs[this.state.tabs.length - 1].id);
      } else {
        this.broadcastState();
      }

      await db.delete(schema.browserTabs).where(eq(schema.browserTabs.id, id));
      logNotebookEntry('browser_tab', id, 'closed', `Tab closed`);
    }
  }

  setBounds(bounds: Electron.Rectangle) {
    const windowBounds = this.window.getBounds();
    // Clamp to ensure the tab isn't pushed entirely off-screen or rendered invisibly
    const clamped = {
      x: Math.max(0, Math.min(bounds.x, windowBounds.width)),
      y: Math.max(0, Math.min(bounds.y, windowBounds.height)),
      width: Math.max(0, Math.min(bounds.width, windowBounds.width)),
      height: Math.max(0, Math.min(bounds.height, windowBounds.height)),
    };
    this.currentBounds = clamped;
    if (this.state.activeTabId && this.views.has(this.state.activeTabId)) {
      this.views.get(this.state.activeTabId)!.setBounds(clamped);
    }
  }

  private attachSecurityHandlers(webContents: WebContents) {
    const isAllowedScheme = (url: string) => {
      try {
        const parsed = new URL(url);
        return ['https:', 'http:'].includes(parsed.protocol);
      } catch {
        return false;
      }
    };

    // Block navigation to non-http(s) schemes (e.g., file://, javascript:, chrome://)
    webContents.on('will-navigate', (event, navigationUrl) => {
      if (!isAllowedScheme(navigationUrl)) {
        console.warn(`[BrowserManager] Blocked disallowed navigation to: ${navigationUrl}`);
        event.preventDefault();
      }
    });

    // Block frame-level navigations to dangerous schemes
    webContents.on('will-frame-navigate', (event) => {
      if (!isAllowedScheme(event.url)) {
        console.warn(`[BrowserManager] Blocked disallowed frame navigation to: ${event.url}`);
        event.preventDefault();
      }
    });

    // Deny all window.open attempts from remote pages. 
    // They should be handled through the app's own tab system.
    webContents.setWindowOpenHandler(() => {
      return { action: 'deny' };
    });
  }

  navigate(id: string, url: string) {
    const view = this.views.get(id);
    if (view) {
      view.webContents.loadURL(url);
    }
  }

  goBack(id: string) {
    const view = this.views.get(id);
    if (view && view.webContents.canGoBack()) {
      view.webContents.goBack();
    }
  }

  goForward(id: string) {
    const view = this.views.get(id);
    if (view && view.webContents.canGoForward()) {
      view.webContents.goForward();
    }
  }

  reload(id: string) {
    const view = this.views.get(id);
    if (view) {
      view.webContents.reload();
    }
  }

  async restoreFromDatabase() {
    const savedTabs = await db.select().from(schema.browserTabs).orderBy(asc(schema.browserTabs.tabOrder));
    
    if (savedTabs.length === 0) {
      await this.createTab('browser-default', 'https://google.com');
      return;
    }

    for (const t of savedTabs) {
      this.state.tabs.push({
        id: t.id,
        url: t.url,
        title: t.title || 'New Tab',
        loadingState: !!t.loadingState,
        sessionPartition: t.sessionPartition,
        active: !!t.active,
        tabOrder: t.tabOrder || 0
      });

      const sess = session.fromPartition(`persist:${t.sessionPartition}`);
      const view = new WebContentsView({
        webPreferences: {
          session: sess,
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      });

      this.views.set(t.id, view);
      this.attachSecurityHandlers(view.webContents);
      view.webContents.loadURL(t.url);

      view.webContents.on('did-finish-load', () => this.updateTabState(t.id, { loadingState: false }));
      view.webContents.on('did-start-loading', () => this.updateTabState(t.id, { loadingState: true }));
      view.webContents.on('page-title-updated', (e: any, title: string) => this.updateTabState(t.id, { title }));
      view.webContents.on('did-navigate', (e: any, url: string) => {
        this.updateTabState(t.id, { url });
        logNotebookEntry('browser_tab', t.id, 'navigate', `Navigated to ${url}`, { metadataJson: { url } });
      });
      view.webContents.on('did-navigate-in-page', (e: any, url: string) => {
        this.updateTabState(t.id, { url });
        logNotebookEntry('browser_tab', t.id, 'navigate', `Navigated in-page to ${url}`, { metadataJson: { url } });
      });
    }

    const activeTab = savedTabs.find((t: any) => t.active) ?? savedTabs[0];
    if (activeTab) {
      await this.switchTab(activeTab.id);
    } else {
      this.broadcastState();
    }
  }
}
