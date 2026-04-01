import { ipcMain, WebContents } from 'electron';
import { BrowserManager } from './browser-manager';
import { db } from '../db';
import * as schema from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export function setupIpcHandlers(uiWebContents: WebContents, browserManager: BrowserManager) {
  const notify = (channel: string, ...args: any[]) => {
    uiWebContents.send(channel, ...args);
  };

  ipcMain.handle('browser:createTab', async (e, { partition, url }) => {
    const id = uuidv4();
    browserManager.createTab(id, partition, url, notify);
    await db.insert(schema.browserTabs).values({
      id,
      sessionPartition: partition,
      url,
      title: 'New Tab',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return id;
  });

  ipcMain.handle('browser:switchTab', (e, id) => {
    browserManager.switchTab(id);
  });

  ipcMain.handle('browser:closeTab', async (e, id) => {
    browserManager.closeTab(id);
    await db.delete(schema.browserTabs).where(eq(schema.browserTabs.id, id));
  });

  ipcMain.handle('browser:setBounds', (e, bounds) => {
    browserManager.setBounds(bounds);
  });

  ipcMain.handle('browser:navigate', async (e, { id, url }) => {
    browserManager.navigate(id, url);
    await db.update(schema.browserTabs).set({ url, updatedAt: new Date() }).where(eq(schema.browserTabs.id, id));
  });

  ipcMain.handle('browser:goBack', (e, id) => browserManager.goBack(id));
  ipcMain.handle('browser:goForward', (e, id) => browserManager.goForward(id));
  ipcMain.handle('browser:reload', (e, id) => browserManager.reload(id));

  ipcMain.handle('db:getTabs', async () => {
    return await db.select().from(schema.browserTabs).orderBy(desc(schema.browserTabs.createdAt));
  });
  
  ipcMain.handle('db:getCompanies', async () => {
    return await db.select().from(schema.companies).orderBy(desc(schema.companies.createdAt));
  });

  ipcMain.handle('db:getInboxItems', async () => {
    return await db.select().from(schema.messages).orderBy(desc(schema.messages.receivedAt));
  });
  
  ipcMain.handle('db:getTasks', async () => {
    return await db.select().from(schema.tasks).orderBy(desc(schema.tasks.createdAt));
  });

  ipcMain.handle('db:getEvidence', async () => {
    return await db.select().from(schema.evidenceFragments).orderBy(desc(schema.evidenceFragments.timestamp));
  });

  ipcMain.handle('db:getNotebook', async () => {
    return await db.select().from(schema.notebookEntries).orderBy(desc(schema.notebookEntries.createdAt));
  });

  ipcMain.handle('db:getDrafts', async () => {
    return await db.select().from(schema.drafts).orderBy(desc(schema.drafts.createdAt));
  });

  ipcMain.handle('cmd:createCompany', async (e, data) => {
    const id = uuidv4();
    await db.insert(schema.companies).values({
      id,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return id;
  });
  
  ipcMain.handle('cmd:createTask', async (e, data) => {
    const id = uuidv4();
    await db.insert(schema.tasks).values({
      id,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return id;
  });

  ipcMain.handle('cmd:createEvidence', async (e, data) => {
    const id = uuidv4();
    await db.insert(schema.evidenceFragments).values({
      id,
      ...data,
      timestamp: new Date(),
    });
    return id;
  });
}
