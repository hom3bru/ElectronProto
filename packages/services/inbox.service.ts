import { db } from '../../db';
import * as schema from '../../db/schema';
import { v4 as uuidv4 } from 'uuid';
import { eq, and } from 'drizzle-orm';
import { LoggerService } from './logger.service';
import {
  CommandResult, ok, okVoid, fail,
  validateId, validateNonEmpty,
} from '../shared/command';

export class InboxService {

  /** Get the current mail sync state for the agent to inspect before triggering sync. */
  static async getSyncStatus(): Promise<CommandResult<typeof schema.mailSyncState.$inferSelect | null>> {
    const rows = await db.select().from(schema.mailSyncState).limit(1);
    return ok(rows[0] ?? null);
  }

  /** Fetch a single message by ID — required for agent to read message bodies. */
  static async getMessage(messageId: string): Promise<CommandResult<typeof schema.messages.$inferSelect | null>> {
    const idV = validateId(messageId, 'messageId');
    if (!idV.ok) return idV;

    const [msg] = await db.select().from(schema.messages).where(eq(schema.messages.id, idV.data));
    return ok(msg ?? null);
  }

  static async createEvidenceFromMessage(
    messageId: string,
    claimSummary?: string,
    quote?: string,
  ): Promise<CommandResult<string>> {
    const idV = validateId(messageId, 'messageId');
    if (!idV.ok) return idV;

    const id = uuidv4();
    // Try to find if message is linked to a company
    const [link] = await db.select({ targetId: schema.entityLinks.targetId })
      .from(schema.entityLinks)
      .where(and(eq(schema.entityLinks.sourceType, 'message'), eq(schema.entityLinks.sourceId, idV.data), eq(schema.entityLinks.targetType, 'company')))
      .limit(1);

    await db.insert(schema.evidenceFragments).values({
      id,
      type: 'claim',
      sourceType: 'inbox_message',
      sourceId: idV.data,
      inboxMessageId: idV.data,
      claimSummary: claimSummary?.trim() || 'Evidence automatically extracted from email',
      quote: quote?.trim() || null,
      timestamp: new Date(),
    });
    
    await LoggerService.logNotebookEntry('evidence', id, 'created', `Evidence extracted from message ${idV.data}`, { 
      parentEntityType: link ? 'company' : undefined, 
      parentEntityId: link?.targetId ?? undefined,
      actorType: 'system' 
    });
    return ok(id);
  }

  static async createEvidenceFromBrowserTab(
    tabId: string,
    url: string,
    title?: string,
    claimSummary?: string,
    quote?: string,
  ): Promise<CommandResult<string>> {
    const tabV = validateId(tabId, 'tabId');
    if (!tabV.ok) return tabV;

    const urlV = validateNonEmpty(url, 'url', 2048);
    if (!urlV.ok) return urlV;

    // Validate url is parseable
    try { new URL(urlV.data); } catch {
      return fail('VALIDATION_ERROR', 'url must be a valid URL', 'url');
    }

    const id = uuidv4();
    const [tab] = await db.select({ title: schema.browserTabs.title })
      .from(schema.browserTabs).where(eq(schema.browserTabs.id, tabV.data));

    await db.insert(schema.evidenceFragments).values({
      id,
      type: 'claim',
      sourceType: 'browser_tab',
      sourceId: tabV.data,
      browserTabId: tabV.data,
      url: urlV.data,
      claimSummary: claimSummary?.trim() || `Evidence captured from ${title?.trim() || tab?.title || 'browser session'}`,
      quote: quote?.trim() || null,
      timestamp: new Date(),
    });
    
    await LoggerService.logNotebookEntry('evidence', id, 'created', `Evidence saved from browser tab ${tabV.data}`, {
      actorType: 'system'
    });
    return ok(id);
  }

  static async escalateMessage(messageId: string, reason?: string): Promise<CommandResult<string>> {
    const idV = validateId(messageId, 'messageId');
    if (!idV.ok) return idV;

    const [msg] = await db.select({ id: schema.messages.id, routeStatus: schema.messages.routeStatus })
      .from(schema.messages).where(eq(schema.messages.id, idV.data));
    if (!msg) return fail('NOT_FOUND', `Message ${messageId} not found`);
    if (msg.routeStatus === 'escalated') return fail('CONFLICT', `Message ${messageId} is already escalated`);

    const defaultReason = reason?.trim() || 'Manual escalation from inbox';
    await db.update(schema.messages)
      .set({ routeStatus: 'escalated' })
      .where(eq(schema.messages.id, idV.data));

    // Try to find if message is linked to a company for parent context
    const [link] = await db.select({ targetId: schema.entityLinks.targetId })
      .from(schema.entityLinks)
      .where(and(eq(schema.entityLinks.sourceType, 'message'), eq(schema.entityLinks.sourceId, idV.data), eq(schema.entityLinks.targetType, 'company')))
      .limit(1);

    const taskId = uuidv4();
    await db.insert(schema.tasks).values({
      id: taskId,
      title: `Review escalated message`,
      type: 'review-inbox-item',
      status: 'needs-review',
      priority: 'high',
      relatedEntityType: 'message',
      relatedEntityId: idV.data,
      escalationReason: defaultReason,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    await LoggerService.logNotebookEntry('message', idV.data, 'escalated', `Message escalated: ${defaultReason}`, {
      parentEntityType: link ? 'company' : undefined,
      parentEntityId: link?.targetId ?? undefined,
      actorType: 'human'
    });
    return ok(taskId);
  }

  static async quarantineMessage(messageId: string, reason?: string): Promise<CommandResult<void>> {
    const idV = validateId(messageId, 'messageId');
    if (!idV.ok) return idV;

    const [msg] = await db.select({ id: schema.messages.id })
      .from(schema.messages).where(eq(schema.messages.id, idV.data));
    if (!msg) return fail('NOT_FOUND', `Message ${messageId} not found`);

    await db.update(schema.messages)
      .set({ routeStatus: 'quarantined' })
      .where(eq(schema.messages.id, idV.data));
    await LoggerService.logNotebookEntry('message', idV.data, 'quarantined',
      reason?.trim() || 'Message quarantined by agent');
    return okVoid();
  }

  static async markThreadRead(threadId: string): Promise<CommandResult<void>> {
    const idV = validateId(threadId, 'threadId');
    if (!idV.ok) return idV;

    await db.update(schema.messages).set({ readState: true })
      .where(eq(schema.messages.threadId, idV.data));
    return okVoid();
  }

  static async archiveThread(threadId: string): Promise<CommandResult<void>> {
    const idV = validateId(threadId, 'threadId');
    if (!idV.ok) return idV;

    const [thread] = await db.select({ id: schema.threads.id })
      .from(schema.threads).where(eq(schema.threads.id, idV.data));
    if (!thread) return fail('NOT_FOUND', `Thread ${threadId} not found`);

    await db.update(schema.threads)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(schema.threads.id, idV.data));
    await LoggerService.logNotebookEntry('thread', idV.data, 'archived', 'Thread archived');
    return okVoid();
  }

  static async markMessageRead(messageId: string): Promise<CommandResult<void>> {
    const idV = validateId(messageId, 'messageId');
    if (!idV.ok) return idV;
    await db.update(schema.messages).set({ readState: true })
      .where(eq(schema.messages.id, idV.data));
    return okVoid();
  }

  static async archiveMessage(messageId: string): Promise<CommandResult<void>> {
    const idV = validateId(messageId, 'messageId');
    if (!idV.ok) return idV;
    await db.update(schema.messages).set({ routeStatus: 'archived' })
      .where(eq(schema.messages.id, idV.data));
    return okVoid();
  }

  static async markMessageIgnored(messageId: string): Promise<CommandResult<void>> {
    const idV = validateId(messageId, 'messageId');
    if (!idV.ok) return idV;
    await db.update(schema.messages).set({ routeStatus: 'ignored' })
      .where(eq(schema.messages.id, idV.data));
    return okVoid();
  }

  /** Create a label — deduplicates on name. Returns existing ID if already exists. */
  static async createLabel(name: string, color?: string): Promise<CommandResult<string>> {
    const nameV = validateNonEmpty(name, 'name', 100);
    if (!nameV.ok) return nameV;

    // Dedup check
    const [existing] = await db.select({ id: schema.labels.id })
      .from(schema.labels).where(eq(schema.labels.name, nameV.data));
    if (existing) return ok(existing.id); // idempotent — return existing

    const id = uuidv4();
    await db.insert(schema.labels).values({
      id,
      name: nameV.data,
      color: color?.trim() || '#888888',
      createdAt: new Date(),
    });
    return ok(id);
  }

  static async addLabelToMessage(messageId: string, labelId: string): Promise<CommandResult<void>> {
    const msgV = validateId(messageId, 'messageId');
    if (!msgV.ok) return msgV;
    const lblV = validateId(labelId, 'labelId');
    if (!lblV.ok) return lblV;

    await db.insert(schema.messageLabels).values({ messageId: msgV.data, labelId: lblV.data })
      .onConflictDoNothing();
    return okVoid();
  }

  static async removeLabelFromMessage(messageId: string, labelId: string): Promise<CommandResult<void>> {
    const msgV = validateId(messageId, 'messageId');
    if (!msgV.ok) return msgV;
    const lblV = validateId(labelId, 'labelId');
    if (!lblV.ok) return lblV;

    await db.delete(schema.messageLabels).where(
      and(
        eq(schema.messageLabels.messageId, msgV.data),
        eq(schema.messageLabels.labelId, lblV.data),
      ),
    );
    return okVoid();
  }
}
