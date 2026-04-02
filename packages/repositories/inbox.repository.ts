import { db } from '../../db';
import * as schema from '../../db/schema';
import { eq, desc, asc, and, inArray } from 'drizzle-orm';

export class InboxRepository {
  static async getThreads(archived: boolean = false) {
    const threadStatus = archived ? 'archived' : 'active';
    const threads = await db.select().from(schema.threads)
      .where(eq(schema.threads.status, threadStatus))
      .orderBy(desc(schema.threads.updatedAt));
    
    return Promise.all(threads.map(async (thread) => {
      const messages = await db.select().from(schema.messages).where(eq(schema.messages.threadId, thread.id)).orderBy(desc(schema.messages.receivedAt));
      const latestMsg = messages[0];
      const unreadCount = messages.filter(m => !m.readState).length;
      return { ...thread, latestMsg, unreadCount };
    })).then(res => res.filter(t => t.latestMsg));
  }

  static async search(query: string) {
    const { like, or } = require('drizzle-orm');
    return db.select({
      id: schema.messages.id,
      threadId: schema.messages.threadId,
      subject: schema.messages.subject,
      snippet: schema.messages.snippet,
      from: schema.messages.from,
      receivedAt: schema.messages.receivedAt
    }).from(schema.messages).where(
      or(
        like(schema.messages.subject, `%${query}%`),
        like(schema.messages.snippet, `%${query}%`),
        like(schema.messages.from, `%${query}%`)
      )
    ).orderBy(desc(schema.messages.receivedAt)).limit(50);
  }

  static async getThreadContext(threadId: string) {
    const [thread] = await db.select().from(schema.threads).where(eq(schema.threads.id, threadId));
    if (!thread) return null;

    const messages = await db.select().from(schema.messages).where(eq(schema.messages.threadId, threadId)).orderBy(asc(schema.messages.receivedAt));
    const msgIds = messages.map(m => m.id);

    const links = await db.select().from(schema.entityLinks).where(and(eq(schema.entityLinks.sourceType, 'message'), inArray(schema.entityLinks.sourceId, msgIds)));
    const companyIds = [...new Set(links.filter(l => l.targetType === 'company').map(l => l.targetId))];
    const companies = companyIds.length > 0 ? await db.select().from(schema.companies).where(inArray(schema.companies.id, companyIds)) : [];

    const evidence = msgIds.length > 0 ? await db.select().from(schema.evidenceFragments).where(inArray(schema.evidenceFragments.inboxMessageId, msgIds)) : [];
    const drafts = await db.select().from(schema.drafts).where(eq(schema.drafts.linkedInboxThreadId, threadId));
    const labels = msgIds.length > 0 ? await db.select().from(schema.messageLabels).where(inArray(schema.messageLabels.messageId, msgIds)) : [];

    return { thread, messages, companies, evidence, drafts, messageLabels: labels };
  }

  static async getMessageLabels() {
    return db.select().from(schema.messageLabels);
  }

  static async getLabels() {
    return db.select().from(schema.labels);
  }
}
