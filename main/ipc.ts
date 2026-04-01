import { ipcMain, WebContents } from 'electron';
import { BrowserManager } from './browser-manager';
import { db } from '../db';
import * as schema from '../db/schema';
import { eq, desc, asc, and, inArray } from 'drizzle-orm';
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

  // ---- Typed Reads ----

  ipcMain.handle('browser:getTabs', async () => {
    return db.select().from(schema.browserTabs).orderBy(asc(schema.browserTabs.tabOrder));
  });

  ipcMain.handle('browser:getActiveTab', async () => {
    const rows = await db.select().from(schema.browserTabs).where(eq(schema.browserTabs.active, true));
    return rows[0] ?? null;
  });

  ipcMain.handle('browser:getTabContext', async (e, tabId: string) => {
    const [tab] = await db.select().from(schema.browserTabs).where(eq(schema.browserTabs.id, tabId));
    if (!tab) return null;
    let linkedCompany = null;
    let recentEvidence: any[] = [];
    let recentTasks: any[] = [];
    
    if (tab.linkedCompanyId) {
      linkedCompany = (await db.select().from(schema.companies).where(eq(schema.companies.id, tab.linkedCompanyId)))[0] ?? null;
      if (linkedCompany) {
        recentEvidence = await db.select().from(schema.evidenceFragments)
          .where(eq(schema.evidenceFragments.companyId, linkedCompany.id))
          .orderBy(desc(schema.evidenceFragments.timestamp));
        recentTasks = await db.select().from(schema.tasks)
          .where(and(eq(schema.tasks.relatedEntityType, 'company'), eq(schema.tasks.relatedEntityId, linkedCompany.id)))
          .orderBy(desc(schema.tasks.createdAt));
      }
    }
    return { tab, linkedCompany, recentEvidence, recentTasks };
  });

  // Inbox
  ipcMain.handle('inbox:getThreads', async (e, archived) => {
    const threads = await db.select().from(schema.threads).orderBy(desc(schema.threads.updatedAt));
    
    // Enrich with latest message and unread count
    const enrichedThreads = await Promise.all(threads.map(async (thread) => {
      const messages = await db.select().from(schema.messages).where(eq(schema.messages.threadId, thread.id)).orderBy(desc(schema.messages.receivedAt));
      const latestMsg = messages[0];
      const unreadCount = messages.filter(m => !m.readState).length;
      return {
        ...thread,
        latestMsg,
        unreadCount
      };
    }));

    return enrichedThreads.filter(t => t.latestMsg);
  });

  ipcMain.handle('inbox:getThreadContext', async (e, threadId: string) => {
    const [thread] = await db.select().from(schema.threads).where(eq(schema.threads.id, threadId));
    if (!thread) return null;

    const messages = await db.select().from(schema.messages).where(eq(schema.messages.threadId, threadId)).orderBy(asc(schema.messages.receivedAt));
    const msgIds = messages.map(m => m.id);

    // Linked Companies
    const links = await db.select().from(schema.entityLinks).where(and(eq(schema.entityLinks.sourceType, 'message'), inArray(schema.entityLinks.sourceId, msgIds)));
    const companyIds = [...new Set(links.filter(l => l.targetType === 'company').map(l => l.targetId))];
    const companies = companyIds.length > 0 ? await db.select().from(schema.companies).where(inArray(schema.companies.id, companyIds)) : [];

    // Evidence
    const evidence = msgIds.length > 0 ? await db.select().from(schema.evidenceFragments).where(inArray(schema.evidenceFragments.inboxMessageId, msgIds)) : [];

    // Drafts
    const drafts = await db.select().from(schema.drafts).where(eq(schema.drafts.linkedInboxThreadId, threadId));

    // Message Labels
    const labels = msgIds.length > 0 ? await db.select().from(schema.messageLabels).where(inArray(schema.messageLabels.messageId, msgIds)) : [];

    return { thread, messages, companies, evidence, drafts, messageLabels: labels };
  });

  ipcMain.handle('inbox:getMessageLabels', async () => {
    return db.select().from(schema.messageLabels);
  });

  ipcMain.handle('inbox:getLabels', async () => {
    return db.select().from(schema.labels);
  });

  // CRM
  ipcMain.handle('crm:getCompanies', async () => {
    return db.select().from(schema.companies).orderBy(desc(schema.companies.updatedAt));
  });

  ipcMain.handle('crm:getCompanyDetail', async (e, companyId: string) => {
    const [company] = await db.select().from(schema.companies).where(eq(schema.companies.id, companyId));
    return company;
  });

  ipcMain.handle('crm:getCompanyLinks', async (e, companyId: string) => {
    return { 
      messages: await db.select().from(schema.messages).where(eq(schema.messages.threadId, companyId)), // simplified
      evidence: await db.select().from(schema.evidenceFragments).where(eq(schema.evidenceFragments.companyId, companyId)),
      tasks: await db.select().from(schema.tasks).where(eq(schema.tasks.relatedEntityId, companyId)),
      drafts: await db.select().from(schema.drafts).where(eq(schema.drafts.companyId, companyId)),
      browserTabs: await db.select().from(schema.browserTabs).where(eq(schema.browserTabs.linkedCompanyId, companyId)),
    };
  });

  // Tasks
  ipcMain.handle('tasks:getTasks', async () => {
    return db.select().from(schema.tasks).orderBy(desc(schema.tasks.createdAt));
  });

  // Outreach / Drafts
  ipcMain.handle('outreach:getDrafts', async () => {
    return db.select().from(schema.drafts).orderBy(desc(schema.drafts.createdAt));
  });

  // Notebook
  ipcMain.handle('notebook:getEntries', async () => {
    return db.select().from(schema.notebookEntries).orderBy(desc(schema.notebookEntries.createdAt));
  });

  // Evidence
  ipcMain.handle('evidence:getFragments', async () => {
    return db.select().from(schema.evidenceFragments).orderBy(desc(schema.evidenceFragments.timestamp));
  });


}
