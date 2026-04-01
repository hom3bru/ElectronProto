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
exports.CommandRegistry = void 0;
const db_1 = require("../../db");
const schema = __importStar(require("../../db/schema"));
const uuid_1 = require("uuid");
const drizzle_orm_1 = require("drizzle-orm");
class CommandRegistry {
    async execute(commandName, payload) {
        console.log(`Executing command: ${commandName}`, payload);
        switch (commandName) {
            case 'createCompanyFromMessage': {
                const { messageId, name, domain } = payload;
                const id = (0, uuid_1.v4)();
                await db_1.db.insert(schema.companies).values({
                    id,
                    name: name || 'Unknown Company',
                    domain,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
                await db_1.db.insert(schema.entityLinks).values({
                    id: (0, uuid_1.v4)(),
                    sourceType: 'message',
                    sourceId: messageId,
                    targetType: 'company',
                    targetId: id,
                    relationship: 'mentions',
                    createdAt: new Date(),
                });
                // Log to notebook
                await this.logNotebookEntry('company', id, 'created', `Company created from message ${messageId}`, 'agent', 'System');
                return { success: true, id };
            }
            case 'linkMessageToCompany': {
                const { messageId, companyId } = payload;
                await db_1.db.insert(schema.entityLinks).values({
                    id: (0, uuid_1.v4)(),
                    sourceType: 'message',
                    sourceId: messageId,
                    targetType: 'company',
                    targetId: companyId,
                    relationship: 'mentions',
                    createdAt: new Date(),
                });
                await this.logNotebookEntry('message', messageId, 'linked', `Message linked to company ${companyId}`, 'agent', 'System');
                return { success: true };
            }
            case 'createEvidenceFromMessage': {
                const { messageId, claimSummary, quote } = payload;
                const id = (0, uuid_1.v4)();
                await db_1.db.insert(schema.evidenceFragments).values({
                    id,
                    type: 'claim',
                    sourceType: 'inbox_message',
                    sourceId: messageId,
                    inboxMessageId: messageId,
                    claimSummary,
                    quote,
                    timestamp: new Date(),
                });
                await this.logNotebookEntry('evidence', id, 'created', `Evidence extracted from message ${messageId}`, 'agent', 'System');
                return { success: true, id };
            }
            case 'createEvidenceFromBrowserTab': {
                const { tabId, url, title, claimSummary, quote } = payload;
                const id = (0, uuid_1.v4)();
                await db_1.db.insert(schema.evidenceFragments).values({
                    id,
                    type: 'claim',
                    sourceType: 'browser_tab',
                    sourceId: tabId,
                    browserTabId: tabId,
                    url,
                    claimSummary: claimSummary || `Evidence from ${title}`,
                    quote,
                    timestamp: new Date(),
                });
                await this.logNotebookEntry('evidence', id, 'created', `Evidence extracted from browser tab ${tabId}`, 'agent', 'System');
                return { success: true, id };
            }
            case 'linkBrowserTabToCompany': {
                let { tabId, companyId, url } = payload;
                if (!companyId) {
                    // If no companyId is provided, try to find one by domain or create a new one
                    try {
                        const domain = new URL(url).hostname.replace('www.', '');
                        const existing = await db_1.db.select().from(schema.companies).where((0, drizzle_orm_1.eq)(schema.companies.domain, domain));
                        if (existing.length > 0) {
                            companyId = existing[0].id;
                        }
                        else {
                            companyId = (0, uuid_1.v4)();
                            await db_1.db.insert(schema.companies).values({
                                id: companyId,
                                name: domain,
                                domain,
                                createdAt: new Date(),
                                updatedAt: new Date(),
                            });
                        }
                    }
                    catch (e) {
                        companyId = null;
                    }
                }
                if (companyId) {
                    await db_1.db.update(schema.browserTabs).set({ linkedCompanyId: companyId, updatedAt: new Date() }).where((0, drizzle_orm_1.eq)(schema.browserTabs.id, tabId));
                    await this.logNotebookEntry('browser_tab', tabId, 'linked', `Browser tab linked to company ${companyId}`, 'agent', 'System');
                }
                return { success: !!companyId, companyId };
            }
            case 'createTaskFromBrowserTab': {
                const { tabId, title, url } = payload;
                const id = (0, uuid_1.v4)();
                await db_1.db.insert(schema.tasks).values({
                    id,
                    title: title || `Review ${url}`,
                    type: 'review-browser-tab',
                    status: 'queued',
                    priority: 'normal',
                    relatedEntityType: 'browser_tab',
                    relatedEntityId: tabId,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
                await this.logNotebookEntry('task', id, 'created', `Task created from browser tab ${tabId}`, 'agent', 'System');
                return { success: true, id };
            }
            case 'appendNotebookEntryFromBrowserTab': {
                const { tabId, message } = payload;
                await this.logNotebookEntry('browser_tab', tabId, 'note', message, 'agent', 'System');
                return { success: true };
            }
            case 'createTask': {
                const { title, type, priority, relatedEntityType, relatedEntityId } = payload;
                const id = (0, uuid_1.v4)();
                await db_1.db.insert(schema.tasks).values({
                    id,
                    title,
                    type,
                    status: 'queued',
                    priority: priority || 'normal',
                    relatedEntityType,
                    relatedEntityId,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
                await this.logNotebookEntry('task', id, 'created', `Task created: ${title}`, 'agent', 'System');
                return { success: true, id };
            }
            case 'escalateMessage': {
                const { messageId, reason } = payload;
                await db_1.db.update(schema.messages).set({ routeStatus: 'escalated' }).where((0, drizzle_orm_1.eq)(schema.messages.id, messageId));
                const taskId = (0, uuid_1.v4)();
                await db_1.db.insert(schema.tasks).values({
                    id: taskId,
                    title: `Review escalated message`,
                    type: 'review-inbox-item',
                    status: 'needs-review',
                    priority: 'high',
                    relatedEntityType: 'message',
                    relatedEntityId: messageId,
                    escalationReason: reason,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
                await this.logNotebookEntry('message', messageId, 'escalated', `Message escalated: ${reason}`, 'agent', 'System');
                return { success: true, taskId };
            }
            case 'createDraftFromThread': {
                const { threadId, subject, body } = payload;
                const id = (0, uuid_1.v4)();
                await db_1.db.insert(schema.drafts).values({
                    id,
                    linkedInboxThreadId: threadId,
                    subject,
                    body,
                    status: 'draft',
                    approvalStatus: 'pending',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
                await this.logNotebookEntry('draft', id, 'created', `Draft created for thread ${threadId}`, 'agent', 'System');
                return { success: true, id };
            }
            case 'createDraftFromCompany': {
                const { companyId, subject, body } = payload;
                const id = (0, uuid_1.v4)();
                await db_1.db.insert(schema.drafts).values({
                    id,
                    companyId,
                    subject,
                    body,
                    status: 'draft',
                    approvalStatus: 'pending',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
                await this.logNotebookEntry('draft', id, 'created', `Draft created for company ${companyId}`, 'agent', 'System');
                return { success: true, id };
            }
            case 'updateDraft': {
                const { draftId, subject, body } = payload;
                await db_1.db.update(schema.drafts).set({ subject, body, updatedAt: new Date() }).where((0, drizzle_orm_1.eq)(schema.drafts.id, draftId));
                return { success: true };
            }
            case 'approveDraft': {
                const { draftId } = payload;
                await db_1.db.update(schema.drafts).set({ approvalStatus: 'approved', status: 'approved', updatedAt: new Date() }).where((0, drizzle_orm_1.eq)(schema.drafts.id, draftId));
                await this.logNotebookEntry('draft', draftId, 'approved', `Draft approved`, 'agent', 'System');
                return { success: true };
            }
            case 'sendDraft': {
                const { draftId } = payload;
                await db_1.db.update(schema.drafts).set({ status: 'sent', sentAt: new Date(), updatedAt: new Date() }).where((0, drizzle_orm_1.eq)(schema.drafts.id, draftId));
                await this.logNotebookEntry('draft', draftId, 'sent', `Draft sent`, 'agent', 'System');
                return { success: true };
            }
            case 'archiveThread': {
                const { threadId } = payload;
                await db_1.db.update(schema.threads).set({ status: 'archived', updatedAt: new Date() }).where((0, drizzle_orm_1.eq)(schema.threads.id, threadId));
                await this.logNotebookEntry('thread', threadId, 'archived', `Thread archived`, 'agent', 'System');
                return { success: true };
            }
            case 'markMessageRead': {
                const { messageId } = payload;
                await db_1.db.update(schema.messages).set({ readState: true }).where((0, drizzle_orm_1.eq)(schema.messages.id, messageId));
                return { success: true };
            }
            case 'markMessageIgnored': {
                const { messageId } = payload;
                await db_1.db.update(schema.messages).set({ routeStatus: 'ignored' }).where((0, drizzle_orm_1.eq)(schema.messages.id, messageId));
                await this.logNotebookEntry('message', messageId, 'ignored', `Message marked as ignored`, 'agent', 'System');
                return { success: true };
            }
            case 'updateTaskStatus': {
                const { taskId, status } = payload;
                await db_1.db.update(schema.tasks).set({ status, updatedAt: new Date() }).where((0, drizzle_orm_1.eq)(schema.tasks.id, taskId));
                await this.logNotebookEntry('task', taskId, 'updated', `Task status changed to ${status}`, 'agent', 'System');
                return { success: true };
            }
            case 'createLabel': {
                const { name, color } = payload;
                const id = (0, uuid_1.v4)();
                await db_1.db.insert(schema.labels).values({
                    id,
                    name,
                    color: color || '#888888',
                    createdAt: new Date(),
                });
                return { success: true, id };
            }
            case 'addLabelToMessage': {
                const { messageId, labelId } = payload;
                await db_1.db.insert(schema.messageLabels).values({ messageId, labelId });
                await this.logNotebookEntry('message', messageId, 'labeled', `Label ${labelId} added to message`, 'agent', 'System');
                return { success: true };
            }
            case 'removeLabelFromMessage': {
                const { messageId, labelId } = payload;
                await db_1.db.delete(schema.messageLabels).where(require('drizzle-orm').and((0, drizzle_orm_1.eq)(schema.messageLabels.messageId, messageId), (0, drizzle_orm_1.eq)(schema.messageLabels.labelId, labelId)));
                await this.logNotebookEntry('message', messageId, 'unlabeled', `Label ${labelId} removed from message`, 'agent', 'System');
                return { success: true };
            }
            case 'ingestMail': {
                const { MockMailProvider } = require('../mail/mock-provider');
                const { MailIngestionService } = require('../mail/ingestion');
                const provider = new MockMailProvider();
                const service = new MailIngestionService(provider);
                await service.ingest();
                await this.logNotebookEntry('system', 'mail', 'ingest', `Mail ingested from mock provider`, 'agent', 'System');
                return { success: true };
            }
            default:
                throw new Error(`Unknown command: ${commandName}`);
        }
    }
    async logNotebookEntry(entityType, entityId, entryType, message, actorType, actorName) {
        const id = (0, uuid_1.v4)();
        await db_1.db.insert(schema.notebookEntries).values({
            id,
            relatedEntityType: entityType,
            relatedEntityId: entityId,
            entryType,
            message,
            actorType,
            actorName,
            createdAt: new Date(),
        });
    }
}
exports.CommandRegistry = CommandRegistry;
