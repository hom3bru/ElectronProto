import { BaseWindow, WebContentsView, session } from 'electron';
import { db } from '../db';
import * as schema from '../db/schema';
import { eq, asc } from 'drizzle-orm';

export class BrowserManager {
  private views: Map<string, WebContentsView> = new Map();
  private activeTabId: string | null = null;
  private window: BaseWindow;
  private uiView: WebContentsView;
  private currentBounds: Electron.Rectangle = { x: 0, y: 0, width: 0, height: 0 };

  constructor(window: BaseWindow, uiView: WebContentsView) {
    this.window = window;
    this.uiView = uiView;
  }

  createTab(id: string, partition: string, url: string, notifyRenderer: (event: string, ...args: any[]) => void) {
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
    view.webContents.loadURL(url);

    // Event capture
    view.webContents.on('did-finish-load', () => {
      notifyRenderer('tab-updated', { id, loadingState: false });
      db.update(schema.browserTabs).set({ loadingState: false, updatedAt: new Date() }).where(eq(schema.browserTabs.id, id)).catch(console.error);
    });

    view.webContents.on('did-start-loading', () => {
      notifyRenderer('tab-updated', { id, loadingState: true });
      db.update(schema.browserTabs).set({ loadingState: true, updatedAt: new Date() }).where(eq(schema.browserTabs.id, id)).catch(console.error);
    });

    view.webContents.on('page-title-updated', (e: any, title: string) => {
      notifyRenderer('tab-updated', { id, title });
      db.update(schema.browserTabs).set({ title, updatedAt: new Date() }).where(eq(schema.browserTabs.id, id)).catch(console.error);
    });

    view.webContents.on('did-navigate', (e: any, url: string) => {
      notifyRenderer('tab-updated', { id, url });
      db.update(schema.browserTabs).set({ url, updatedAt: new Date() }).where(eq(schema.browserTabs.id, id)).catch(console.error);
    });
    
    view.webContents.on('did-navigate-in-page', (e: any, url: string) => {
      notifyRenderer('tab-updated', { id, url });
      db.update(schema.browserTabs).set({ url, updatedAt: new Date() }).where(eq(schema.browserTabs.id, id)).catch(console.error);
    });
  }

  switchTab(id: string) {
    if (this.activeTabId && this.views.has(this.activeTabId)) {
      this.window.contentView.removeChildView(this.views.get(this.activeTabId)!);
    }
    const view = this.views.get(id);
    if (view) {
      this.window.contentView.addChildView(view);
      view.setBounds(this.currentBounds);
      this.activeTabId = id;
    } else {
      this.activeTabId = null;
    }
  }

  closeTab(id: string) {
    const view = this.views.get(id);
    if (view) {
      if (this.activeTabId === id) {
        this.window.contentView.removeChildView(view);
        this.activeTabId = null;
      }
      (view.webContents as any).destroy();
      this.views.delete(id);
    }
  }

  setBounds(bounds: Electron.Rectangle) {
    this.currentBounds = bounds;
    if (this.activeTabId && this.views.has(this.activeTabId)) {
      this.views.get(this.activeTabId)!.setBounds(bounds);
    }
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

  async restoreFromDatabase(notifyRenderer: (event: string, ...args: any[]) => void) {
    const savedTabs = await db.select().from(schema.browserTabs).orderBy(asc(schema.browserTabs.tabOrder));
    if (savedTabs.length === 0) return;
    for (const tab of savedTabs) {
      this.createTab(tab.id, tab.sessionPartition, tab.url, notifyRenderer);
    }
    const activeTab = savedTabs.find((t: any) => t.active) ?? savedTabs[0];
    if (activeTab) {
      this.switchTab(activeTab.id);
    }
  }
}
