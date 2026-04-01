import { BaseWindow, WebContentsView, session } from 'electron';

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
    });

    view.webContents.on('did-start-loading', () => {
      notifyRenderer('tab-updated', { id, loadingState: true });
    });

    view.webContents.on('page-title-updated', (e, title) => {
      notifyRenderer('tab-updated', { id, title });
    });

    view.webContents.on('did-navigate', (e, url) => {
      notifyRenderer('tab-updated', { id, url });
    });
    
    view.webContents.on('did-navigate-in-page', (e, url) => {
      notifyRenderer('tab-updated', { id, url });
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
}
