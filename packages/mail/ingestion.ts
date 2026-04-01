import { db } from '../../db';
import * as schema from '../../db/schema';
import { eq, inArray, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { MailProvider } from './provider';

export class MailIngestionService {
  private provider: MailProvider;

  constructor(provider: MailProvider) {
    this.provider = provider;
  }

  async ingest() {
    const rawMessages = await this.provider.fetchMessages();
    
    for (const raw of rawMessages) {
      // Dedupe
      const existing = await db.select().from(schema.messages).where(eq(schema.messages.providerId, raw.providerId));
      if (existing.length > 0) continue;

      // Thread grouping logic
      let threadId = raw.threadId;
      if (!threadId) {
        // Try to find thread by subject (naive grouping for mock)
        const existingThreadMsg = await db.select().from(schema.messages).where(eq(schema.messages.subject, raw.subject));
        if (existingThreadMsg.length > 0 && existingThreadMsg[0].threadId) {
          threadId = existingThreadMsg[0].threadId;
        } else {
          threadId = uuidv4();
          await db.insert(schema.threads).values({
            id: threadId,
            subject: raw.subject,
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }

      const messageId = uuidv4();
      
      // Basic classification placeholder
      let routeStatus = 'raw';
      if (raw.subject?.toLowerCase().includes('urgent')) routeStatus = 'escalated';
      else if (raw.from.includes('founder')) routeStatus = 'candidate';

      await db.insert(schema.messages).values({
        id: messageId,
        providerId: raw.providerId,
        threadId: threadId,
        from: raw.from,
        to: raw.to,
        subject: raw.subject,
        snippet: raw.snippet,
        plainTextBody: raw.plainTextBody,
        receivedAt: raw.receivedAt || new Date(),
        readState: false,
        routeStatus,
        sourceClassification: 'inbound_email',
      }).onConflictDoNothing({ target: schema.messages.providerId });

      // Update thread timestamp
      await db.update(schema.threads)
        .set({ updatedAt: new Date() })
        .where(eq(schema.threads.id, threadId));
    }
  }
}
