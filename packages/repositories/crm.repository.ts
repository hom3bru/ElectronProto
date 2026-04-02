import { db } from '../../db';
import * as schema from '../../db/schema';
import { eq, desc, and } from 'drizzle-orm';

export class CrmRepository {
  static async getCompanies() {
    return db.select().from(schema.companies).orderBy(desc(schema.companies.updatedAt));
  }

  static async getCompanyDetail(companyId: string) {
    const [company] = await db.select().from(schema.companies).where(eq(schema.companies.id, companyId));
    return company;
  }

  static async getCompanyLinks(companyId: string) {
    return {
      messages: await db.select({
        id: schema.messages.id,
        threadId: schema.messages.threadId,
        from: schema.messages.from,
        subject: schema.messages.subject,
        snippet: schema.messages.snippet,
        receivedAt: schema.messages.receivedAt,
        linkId: schema.entityLinks.id
      })
      .from(schema.messages)
      .innerJoin(schema.entityLinks, eq(schema.messages.id, schema.entityLinks.sourceId))
      .where(and(
        eq(schema.entityLinks.targetId, companyId),
        eq(schema.entityLinks.targetType, 'company'),
        eq(schema.entityLinks.sourceType, 'message')
      )),
      evidence: (await db.select({
        id: schema.evidenceFragments.id,
        claimSummary: schema.evidenceFragments.claimSummary,
        quote: schema.evidenceFragments.quote,
        sourceType: schema.evidenceFragments.sourceType,
        sourceId: schema.evidenceFragments.sourceId,
        url: schema.evidenceFragments.url,
        confidence: schema.evidenceFragments.confidence,
        reviewerStatus: schema.evidenceFragments.reviewerStatus,
        contradictionFlag: schema.evidenceFragments.contradictionFlag,
        extractedBy: schema.evidenceFragments.extractedBy,
        linkId: schema.entityLinks.id
      })
      .from(schema.evidenceFragments)
      .innerJoin(schema.entityLinks, eq(schema.evidenceFragments.id, schema.entityLinks.sourceId))
      .where(and(
        eq(schema.entityLinks.targetId, companyId),
        eq(schema.entityLinks.targetType, 'company'),
        eq(schema.entityLinks.sourceType, 'evidence')
      ))),
      tasks: (await db.select({
        id: schema.tasks.id,
        title: schema.tasks.title,
        status: schema.tasks.status,
        type: schema.tasks.type,
        priority: schema.tasks.priority,
        owner: schema.tasks.owner,
        notes: schema.tasks.notes,
        blockedReason: schema.tasks.blockedReason,
        linkId: schema.entityLinks.id
      })
      .from(schema.tasks)
      .innerJoin(schema.entityLinks, eq(schema.tasks.id, schema.entityLinks.sourceId))
      .where(and(
        eq(schema.entityLinks.targetId, companyId),
        eq(schema.entityLinks.targetType, 'company'),
        eq(schema.entityLinks.sourceType, 'task')
      ))),
      drafts: (await db.select({
        id: schema.drafts.id,
        subject: schema.drafts.subject,
        body: schema.drafts.body,
        status: schema.drafts.status,
        blockedReason: schema.drafts.blockedReason,
        linkId: schema.entityLinks.id
      })
      .from(schema.drafts)
      .innerJoin(schema.entityLinks, eq(schema.drafts.id, schema.entityLinks.sourceId))
      .where(and(
        eq(schema.entityLinks.targetId, companyId),
        eq(schema.entityLinks.targetType, 'company'),
        eq(schema.entityLinks.sourceType, 'draft')
      ))),
      browserTabs: (await db.select({
        id: schema.browserTabs.id,
        title: schema.browserTabs.title,
        url: schema.browserTabs.url,
        linkId: schema.entityLinks.id
      })
      .from(schema.browserTabs)
      .innerJoin(schema.entityLinks, eq(schema.browserTabs.id, schema.entityLinks.sourceId))
      .where(and(
        eq(schema.entityLinks.targetId, companyId),
        eq(schema.entityLinks.targetType, 'company'),
        eq(schema.entityLinks.sourceType, 'browser_tab')
      ))),
    };
  }
}
