import { db } from '../../db';
import * as schema from '../../db/schema';
import { eq, desc, and, or } from 'drizzle-orm';

export class OutreachRepository {
  static async getDrafts() {
    return db.select().from(schema.drafts).orderBy(desc(schema.drafts.createdAt));
  }

  static async getDraft(draftId: string) {
    const [draft] = await db.select().from(schema.drafts).where(eq(schema.drafts.id, draftId));
    return draft ?? null;
  }

  static async getDraftsByThread(threadId: string) {
    return db.select().from(schema.drafts)
      .where(eq(schema.drafts.linkedInboxThreadId, threadId))
      .orderBy(desc(schema.drafts.createdAt));
  }

  static async getDraftsByCompany(companyId: string) {
    const links = await db.select({ sourceId: schema.entityLinks.sourceId })
      .from(schema.entityLinks)
      .where(and(
        eq(schema.entityLinks.sourceType, 'draft'),
        eq(schema.entityLinks.targetType, 'company'),
        eq(schema.entityLinks.targetId, companyId)
      ));

    if (links.length === 0) return [];
    
    return db.select().from(schema.drafts)
      .where(or(...links.map(l => eq(schema.drafts.id, l.sourceId))))
      .orderBy(desc(schema.drafts.createdAt));
  }
}
