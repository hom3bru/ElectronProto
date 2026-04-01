import { ipcMain, WebContents } from 'electron';
import { BrowserManager } from './browser-manager';
import { db } from '../db';
import * as schema from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { CommandRegistry } from '../packages/commands/registry';

export function setupIpcHandlers(uiWebContents: WebContents, browserManager: BrowserManager) {
  const notify = (channel: string, ...args: any[]) => {
    uiWebContents.send(channel, ...args);
  };

  // Browser IPC
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

  ipcMain.handle('browser:restoreTab', async (e, { id, partition, url }) => {
    browserManager.createTab(id, partition, url, notify);
  });

  ipcMain.handle('browser:switchTab', async (e, id) => {
    browserManager.switchTab(id);
    await db.update(schema.browserTabs).set({ active: false });
    await db.update(schema.browserTabs).set({ active: true, lastFocusedTimestamp: new Date(), updatedAt: new Date() }).where(eq(schema.browserTabs.id, id));
  });
  
  ipcMain.handle('browser:closeTab', async (e, id) => {
    browserManager.closeTab(id);
    await db.delete(schema.browserTabs).where(eq(schema.browserTabs.id, id));
  });

  ipcMain.handle('browser:updateTabOrder', async (e, tabIds: string[]) => {
    for (let i = 0; i < tabIds.length; i++) {
      await db.update(schema.browserTabs).set({ tabOrder: i, updatedAt: new Date() }).where(eq(schema.browserTabs.id, tabIds[i]));
    }
  });

  ipcMain.handle('browser:setBounds', (e, bounds) => browserManager.setBounds(bounds));
  
  ipcMain.handle('browser:navigate', async (e, { id, url }) => {
    browserManager.navigate(id, url);
    await db.update(schema.browserTabs).set({ url, updatedAt: new Date() }).where(eq(schema.browserTabs.id, id));
  });

  ipcMain.handle('browser:goBack', (e, id) => browserManager.goBack(id));
  ipcMain.handle('browser:goForward', (e, id) => browserManager.goForward(id));
  ipcMain.handle('browser:reload', (e, id) => browserManager.reload(id));

  // Command IPC
  const commandRegistry = new CommandRegistry();
  ipcMain.handle('cmd:execute', async (e, { commandName, payload }) => {
    return await commandRegistry.execute(commandName, payload);
  });

  // Generic DB Query IPC (for simple reads)
  ipcMain.handle('db:query', async (e, { model, action, args }) => {
    const table = (schema as any)[model];
    if (!table) throw new Error(`Model ${model} not found`);
    
    if (action === 'findMany') {
      let query = db.select().from(table);
      
      if (args && args.where) {
        const conditions = [];
        for (const [key, val] of Object.entries(args.where)) {
          if (typeof val === 'object' && val !== null && 'contains' in val) {
            const { like } = require('drizzle-orm');
            conditions.push(like(table[key], `%${(val as any).contains}%`));
          } else {
            conditions.push(eq(table[key], val));
          }
        }
        if (conditions.length > 0) {
          const { and } = require('drizzle-orm');
          query = query.where(and(...conditions)) as any;
        }
      }
      
      if (args && args.orderBy) {
        const [col, dir] = Object.entries(args.orderBy)[0];
        query = query.orderBy(dir === 'desc' ? desc(table[col]) : table[col]) as any;
      } else {
        const defaultSortCol = table.createdAt || table.receivedAt || table.timestamp || table.id;
        if (defaultSortCol) {
          query = query.orderBy(desc(defaultSortCol)) as any;
        }
      }
      
      return await query;
    }
    if (action === 'findById') {
      const res = await db.select().from(table).where(eq(table.id, args.id));
      return res[0] || null;
    }
    throw new Error(`Action ${action} not supported via generic query`);
  });
}
