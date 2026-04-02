import { app, BrowserWindow, BaseWindow, WebContentsView } from 'electron';
import * as path from 'path';
import { setupIpcHandlers } from './ipc';
import { BrowserManager } from './browser-manager';
import { VerificationService } from '../packages/services/verification.service';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow: BaseWindow | null = null;
let browserManager: BrowserManager | null = null;

async function createWindow() {
  mainWindow = new BaseWindow({
    width: 1440,
    height: 900,
    title: 'Internal Agent Workspace',
    backgroundColor: '#09090b', // zinc-950
  });

  const uiView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.contentView.addChildView(uiView);
  
  const resizeUI = () => {
    const bounds = mainWindow!.getBounds();
    uiView.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height });
  };
  
  resizeUI();
  mainWindow.on('resize', resizeUI);

  if (isDev) {
    uiView.webContents.loadURL('http://localhost:3000');
  } else {
    uiView.webContents.loadFile(path.join(__dirname, '../../out/index.html'));
  }

  // Restore saved tabs in the main process before the renderer gets to interact.
  const notify = (channel: string, ...args: any[]) => uiView.webContents.send(channel, ...args);
  browserManager = new BrowserManager(mainWindow, uiView, notify);
  browserManager.restoreFromDatabase().catch(console.error);

  setupIpcHandlers(uiView.webContents, browserManager);
  
  // Initialize Background Verification Service
  VerificationService.init(mainWindow).catch(console.error);
}

app.whenReady().then(async () => {
  // Run migrations in the Electron process to ensure the DB stays in sync with ABI-matched drivers
  try {
    const { migrate } = require('drizzle-orm/better-sqlite3/migrator');
    const { db: database } = require('../db');
    const migrationsFolder = isDev
      ? path.join(process.cwd(), 'drizzle')
      : path.join(app.getAppPath(), 'drizzle');

    await migrate(database, { migrationsFolder });
    console.log(`[DB] Migrations applied from ${migrationsFolder}`);
  } catch (e) {
    console.error('[DB] Migration failed:', e);
  }

  createWindow();

  app.on('activate', () => {
    if (BaseWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
