import { app, BrowserWindow, BaseWindow, WebContentsView } from 'electron';
import * as path from 'path';
import { setupIpcHandlers } from './ipc';
import { BrowserManager } from './browser-manager';

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
    uiView.webContents.loadFile(path.join(__dirname, '../out/index.html'));
  }

  browserManager = new BrowserManager(mainWindow, uiView);
  setupIpcHandlers(uiView.webContents, browserManager);
}

app.whenReady().then(() => {
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
