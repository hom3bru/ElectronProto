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
const electron_1 = require("electron");
const path = __importStar(require("path"));
const ipc_1 = require("./ipc");
const browser_manager_1 = require("./browser-manager");
const isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
let mainWindow = null;
let browserManager = null;
async function createWindow() {
    mainWindow = new electron_1.BaseWindow({
        width: 1440,
        height: 900,
        title: 'Internal Agent Workspace',
        backgroundColor: '#09090b', // zinc-950
    });
    const uiView = new electron_1.WebContentsView({
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    mainWindow.contentView.addChildView(uiView);
    const resizeUI = () => {
        const bounds = mainWindow.getBounds();
        uiView.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height });
    };
    resizeUI();
    mainWindow.on('resize', resizeUI);
    if (isDev) {
        uiView.webContents.loadURL('http://localhost:3000');
    }
    else {
        uiView.webContents.loadFile(path.join(__dirname, '../../out/index.html'));
    }
    browserManager = new browser_manager_1.BrowserManager(mainWindow, uiView);
    // Restore saved tabs in the main process before the renderer gets to interact.
    const notify = (channel, ...args) => uiView.webContents.send(channel, ...args);
    browserManager.restoreFromDatabase(notify).catch(console.error);
    (0, ipc_1.setupIpcHandlers)(uiView.webContents, browserManager);
}
electron_1.app.whenReady().then(async () => {
    // Run migrations in the Electron process to ensure the DB stays in sync with ABI-matched drivers
    try {
        const { migrate } = require('drizzle-orm/better-sqlite3/migrator');
        const { db: database } = require('../db');
        await migrate(database, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
        console.log('[DB] Migrations applied successfully');
    }
    catch (e) {
        console.error('[DB] Migration failed:', e);
    }
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BaseWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
