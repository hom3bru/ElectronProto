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
exports.setupIpcHandlers = setupIpcHandlers;
const electron_1 = require("electron");
const db_1 = require("../db");
const schema = __importStar(require("../db/schema"));
const drizzle_orm_1 = require("drizzle-orm");
const uuid_1 = require("uuid");
const registry_1 = require("../packages/commands/registry");
function setupIpcHandlers(uiWebContents, browserManager) {
    const notify = (channel, ...args) => {
        uiWebContents.send(channel, ...args);
    };
    // Browser IPC
    electron_1.ipcMain.handle('browser:createTab', async (e, { partition, url }) => {
        const id = (0, uuid_1.v4)();
        browserManager.createTab(id, partition, url, notify);
        await db_1.db.insert(schema.browserTabs).values({
            id,
            sessionPartition: partition,
            url,
            title: 'New Tab',
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        return id;
    });
    electron_1.ipcMain.handle('browser:restoreTab', async (e, { id, partition, url }) => {
        browserManager.createTab(id, partition, url, notify);
    });
    electron_1.ipcMain.handle('browser:switchTab', async (e, id) => {
        browserManager.switchTab(id);
        await db_1.db.update(schema.browserTabs).set({ active: false });
        await db_1.db.update(schema.browserTabs).set({ active: true, lastFocusedTimestamp: new Date(), updatedAt: new Date() }).where((0, drizzle_orm_1.eq)(schema.browserTabs.id, id));
    });
    electron_1.ipcMain.handle('browser:closeTab', async (e, id) => {
        browserManager.closeTab(id);
        await db_1.db.delete(schema.browserTabs).where((0, drizzle_orm_1.eq)(schema.browserTabs.id, id));
    });
    electron_1.ipcMain.handle('browser:updateTabOrder', async (e, tabIds) => {
        for (let i = 0; i < tabIds.length; i++) {
            await db_1.db.update(schema.browserTabs).set({ tabOrder: i, updatedAt: new Date() }).where((0, drizzle_orm_1.eq)(schema.browserTabs.id, tabIds[i]));
        }
    });
    electron_1.ipcMain.handle('browser:setBounds', (e, bounds) => browserManager.setBounds(bounds));
    electron_1.ipcMain.handle('browser:navigate', async (e, { id, url }) => {
        browserManager.navigate(id, url);
        await db_1.db.update(schema.browserTabs).set({ url, updatedAt: new Date() }).where((0, drizzle_orm_1.eq)(schema.browserTabs.id, id));
    });
    electron_1.ipcMain.handle('browser:goBack', (e, id) => browserManager.goBack(id));
    electron_1.ipcMain.handle('browser:goForward', (e, id) => browserManager.goForward(id));
    electron_1.ipcMain.handle('browser:reload', (e, id) => browserManager.reload(id));
    // Command IPC
    const commandRegistry = new registry_1.CommandRegistry();
    electron_1.ipcMain.handle('cmd:execute', async (e, { commandName, payload }) => {
        return await commandRegistry.execute(commandName, payload);
    });
    // ---- Typed Reads ----
    electron_1.ipcMain.handle('browser:getTabs', async () => {
        return db_1.db.select().from(schema.browserTabs).orderBy((0, drizzle_orm_1.asc)(schema.browserTabs.tabOrder));
    });
    electron_1.ipcMain.handle('browser:getActiveTab', async () => {
        const rows = await db_1.db.select().from(schema.browserTabs).where((0, drizzle_orm_1.eq)(schema.browserTabs.active, true));
        return rows[0] ?? null;
    });
    electron_1.ipcMain.handle('browser:getTabContext', async (e, tabId) => {
        const [tab] = await db_1.db.select().from(schema.browserTabs).where((0, drizzle_orm_1.eq)(schema.browserTabs.id, tabId));
        if (!tab)
            return null;
        let linkedCompany = null;
        let recentEvidence = [];
        let recentTasks = [];
        if (tab.linkedCompanyId) {
            linkedCompany = (await db_1.db.select().from(schema.companies).where((0, drizzle_orm_1.eq)(schema.companies.id, tab.linkedCompanyId)))[0] ?? null;
            if (linkedCompany) {
                recentEvidence = await db_1.db.select().from(schema.evidenceFragments)
                    .where((0, drizzle_orm_1.eq)(schema.evidenceFragments.companyId, linkedCompany.id))
                    .orderBy((0, drizzle_orm_1.desc)(schema.evidenceFragments.timestamp));
                recentTasks = await db_1.db.select().from(schema.tasks)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.tasks.relatedEntityType, 'company'), (0, drizzle_orm_1.eq)(schema.tasks.relatedEntityId, linkedCompany.id)))
                    .orderBy((0, drizzle_orm_1.desc)(schema.tasks.createdAt));
            }
        }
        return { tab, linkedCompany, recentEvidence, recentTasks };
    });
    // Inbox
    electron_1.ipcMain.handle('inbox:getThreads', async (e, archived) => {
        const query = db_1.db.select().from(schema.threads);
        // Implement simplistic filter if needed, ignore archived for now
        return query.orderBy((0, drizzle_orm_1.desc)(schema.threads.updatedAt));
    });
    electron_1.ipcMain.handle('inbox:getThreadMessages', async (e, threadId) => {
        return db_1.db.select().from(schema.messages).where((0, drizzle_orm_1.eq)(schema.messages.threadId, threadId)).orderBy((0, drizzle_orm_1.asc)(schema.messages.receivedAt));
    });
    electron_1.ipcMain.handle('inbox:getThreadContext', async (e, threadId) => {
        const [thread] = await db_1.db.select().from(schema.threads).where((0, drizzle_orm_1.eq)(schema.threads.id, threadId));
        return { thread, linkedCompanies: [], drafts: [] }; // simplifications
    });
    electron_1.ipcMain.handle('inbox:getLabels', async () => {
        return db_1.db.select().from(schema.labels);
    });
    // CRM
    electron_1.ipcMain.handle('crm:getCompanies', async () => {
        return db_1.db.select().from(schema.companies).orderBy((0, drizzle_orm_1.desc)(schema.companies.updatedAt));
    });
    electron_1.ipcMain.handle('crm:getCompanyDetail', async (e, companyId) => {
        const [company] = await db_1.db.select().from(schema.companies).where((0, drizzle_orm_1.eq)(schema.companies.id, companyId));
        return company;
    });
    electron_1.ipcMain.handle('crm:getCompanyLinks', async (e, companyId) => {
        return { messages: [], evidence: [], tasks: [], drafts: [], browserTabs: [] }; // simplifications
    });
    // Generic DB Query IPC (for simple reads) - DEPRECATED
    electron_1.ipcMain.handle('db:query', async (e, { model, action, args }) => {
        console.warn(`[DEPRECATED] Generic db:query called for model ${model}`);
        const table = schema[model];
        if (!table)
            throw new Error(`Model ${model} not found`);
        if (action === 'findMany') {
            let query = db_1.db.select().from(table);
            if (args && args.where) {
                const conditions = [];
                for (const [key, val] of Object.entries(args.where)) {
                    if (typeof val === 'object' && val !== null && 'contains' in val) {
                        const { like } = require('drizzle-orm');
                        conditions.push(like(table[key], `%${val.contains}%`));
                    }
                    else {
                        conditions.push((0, drizzle_orm_1.eq)(table[key], val));
                    }
                }
                if (conditions.length > 0) {
                    const { and } = require('drizzle-orm');
                    query = query.where(and(...conditions));
                }
            }
            if (args && args.orderBy) {
                const [col, dir] = Object.entries(args.orderBy)[0];
                query = query.orderBy(dir === 'desc' ? (0, drizzle_orm_1.desc)(table[col]) : table[col]);
            }
            else {
                const defaultSortCol = table.createdAt || table.receivedAt || table.timestamp || table.id;
                if (defaultSortCol) {
                    query = query.orderBy((0, drizzle_orm_1.desc)(defaultSortCol));
                }
            }
            return await query;
        }
        if (action === 'findById') {
            const res = await db_1.db.select().from(table).where((0, drizzle_orm_1.eq)(table.id, args.id));
            return res[0] || null;
        }
        throw new Error(`Action ${action} not supported via generic query`);
    });
}
