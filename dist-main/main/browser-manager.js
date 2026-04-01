"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserManager = void 0;
const electron_1 = require("electron");
const db_1 = require("../db");
const schema = __importStar(require("../db/schema"));
const drizzle_orm_1 = require("drizzle-orm");
class BrowserManager {
    views = new Map();
    activeTabId = null;
    window;
    uiView;
    currentBounds = { x: 0, y: 0, width: 0, height: 0 };
    constructor(window, uiView) {
        this.window = window;
        this.uiView = uiView;
    }
    createTab(id, partition, url, notifyRenderer) {
        const sess = electron_1.session.fromPartition(`persist:${partition}`);
        const view = new electron_1.WebContentsView({
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
            db_1.db.update(schema.browserTabs).set({ loadingState: false, updatedAt: new Date() }).where((0, drizzle_orm_1.eq)(schema.browserTabs.id, id)).catch(console.error);
        });
        view.webContents.on('did-start-loading', () => {
            notifyRenderer('tab-updated', { id, loadingState: true });
            db_1.db.update(schema.browserTabs).set({ loadingState: true, updatedAt: new Date() }).where((0, drizzle_orm_1.eq)(schema.browserTabs.id, id)).catch(console.error);
        });
        view.webContents.on('page-title-updated', (e, title) => {
            notifyRenderer('tab-updated', { id, title });
            db_1.db.update(schema.browserTabs).set({ title, updatedAt: new Date() }).where((0, drizzle_orm_1.eq)(schema.browserTabs.id, id)).catch(console.error);
        });
        view.webContents.on('did-navigate', (e, url) => {
            notifyRenderer('tab-updated', { id, url });
            db_1.db.update(schema.browserTabs).set({ url, updatedAt: new Date() }).where((0, drizzle_orm_1.eq)(schema.browserTabs.id, id)).catch(console.error);
        });
        view.webContents.on('did-navigate-in-page', (e, url) => {
            notifyRenderer('tab-updated', { id, url });
            db_1.db.update(schema.browserTabs).set({ url, updatedAt: new Date() }).where((0, drizzle_orm_1.eq)(schema.browserTabs.id, id)).catch(console.error);
        });
    }
    switchTab(id) {
        if (this.activeTabId && this.views.has(this.activeTabId)) {
            this.window.contentView.removeChildView(this.views.get(this.activeTabId));
        }
        const view = this.views.get(id);
        if (view) {
            this.window.contentView.addChildView(view);
            view.setBounds(this.currentBounds);
            this.activeTabId = id;
        }
        else {
            this.activeTabId = null;
        }
    }
    closeTab(id) {
        const view = this.views.get(id);
        if (view) {
            if (this.activeTabId === id) {
                this.window.contentView.removeChildView(view);
                this.activeTabId = null;
            }
            view.webContents.destroy();
            this.views.delete(id);
        }
    }
    setBounds(bounds) {
        this.currentBounds = bounds;
        if (this.activeTabId && this.views.has(this.activeTabId)) {
            this.views.get(this.activeTabId).setBounds(bounds);
        }
    }
    navigate(id, url) {
        const view = this.views.get(id);
        if (view) {
            view.webContents.loadURL(url);
        }
    }
    goBack(id) {
        const view = this.views.get(id);
        if (view && view.webContents.canGoBack()) {
            view.webContents.goBack();
        }
    }
    goForward(id) {
        const view = this.views.get(id);
        if (view && view.webContents.canGoForward()) {
            view.webContents.goForward();
        }
    }
    reload(id) {
        const view = this.views.get(id);
        if (view) {
            view.webContents.reload();
        }
    }
    async restoreFromDatabase(notifyRenderer) {
        const savedTabs = await db_1.db.select().from(schema.browserTabs).orderBy((0, drizzle_orm_1.asc)(schema.browserTabs.tabOrder));
        if (savedTabs.length === 0)
            return;
        for (const tab of savedTabs) {
            this.createTab(tab.id, tab.sessionPartition, tab.url, notifyRenderer);
        }
        const activeTab = savedTabs.find((t) => t.active) ?? savedTabs[0];
        if (activeTab) {
            this.switchTab(activeTab.id);
        }
    }
}
exports.BrowserManager = BrowserManager;
