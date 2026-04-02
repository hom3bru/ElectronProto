import { db } from '../../db';
import * as schema from '../../db/schema';
import { eq, desc, and, like, or, SQL, inArray, sql } from 'drizzle-orm';

export interface EvidenceFilters {
  companyId?: string;
  sourceType?: string;
  reviewerStatus?: string;
  contradictionFlag?: boolean;
  type?: string;
  search?: string;
  limit?: number;
}

export class EvidenceRepository {

  static async getFragments(filters: EvidenceFilters = {}) {
    const conditions: SQL[] = [];

    if (filters.companyId) {
      // Query the graph to find links between evidence and this company.
      // We use an EXISTS subquery to keep the query clean and leverage the index on entity_links.
      conditions.push(sql`EXISTS (
        SELECT 1 FROM ${schema.entityLinks} 
        WHERE ${schema.entityLinks.sourceType} = 'evidence'
        AND ${schema.entityLinks.sourceId} = ${schema.evidenceFragments.id}
        AND ${schema.entityLinks.targetType} = 'company'
        AND ${schema.entityLinks.targetId} = ${filters.companyId}
      )`);
    }
    if (filters.sourceType)
      conditions.push(eq(schema.evidenceFragments.sourceType, filters.sourceType));
    if (filters.reviewerStatus)
      conditions.push(eq(schema.evidenceFragments.reviewerStatus, filters.reviewerStatus));
    if (filters.contradictionFlag !== undefined)
      conditions.push(eq(schema.evidenceFragments.contradictionFlag, filters.contradictionFlag));
    if (filters.type)
      conditions.push(eq(schema.evidenceFragments.type, filters.type));
    if (filters.search) {
      const term = `%${filters.search.trim().toLowerCase()}%`;
      conditions.push(
        or(
          like(schema.evidenceFragments.claimSummary, term),
          like(schema.evidenceFragments.quote, term),
        ) as SQL,
      );
    }

    const query = db.select().from(schema.evidenceFragments);

    const result = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(schema.evidenceFragments.timestamp))
      : await query.orderBy(desc(schema.evidenceFragments.timestamp));

    return filters.limit ? result.slice(0, filters.limit) : result;
  }

  static async getFragment(fragmentId: string) {
    const [frag] = await db.select().from(schema.evidenceFragments)
      .where(eq(schema.evidenceFragments.id, fragmentId));
    return frag ?? null;
  }

  static async getFragmentsByCompany(companyId: string) {
    return db.select({
      id: schema.evidenceFragments.id,
      type: schema.evidenceFragments.type,
      sourceType: schema.evidenceFragments.sourceType,
      sourceId: schema.evidenceFragments.sourceId,
      claimSummary: schema.evidenceFragments.claimSummary,
      quote: schema.evidenceFragments.quote,
      url: schema.evidenceFragments.url,
      inboxMessageId: schema.evidenceFragments.inboxMessageId,
      browserTabId: schema.evidenceFragments.browserTabId,
      timestamp: schema.evidenceFragments.timestamp,
      confidence: schema.evidenceFragments.confidence,
      contradictionFlag: schema.evidenceFragments.contradictionFlag,
      extractedBy: schema.evidenceFragments.extractedBy,
      reviewerStatus: schema.evidenceFragments.reviewerStatus,
    })
      .from(schema.evidenceFragments)
      .innerJoin(schema.entityLinks, eq(schema.evidenceFragments.id, schema.entityLinks.sourceId))
      .where(and(
        eq(schema.entityLinks.sourceType, 'evidence'),
        eq(schema.entityLinks.targetType, 'company'),
        eq(schema.entityLinks.targetId, companyId)
      ))
      .orderBy(desc(schema.evidenceFragments.timestamp));
  }

  static async getFragmentsBySource(sourceType: string, sourceId: string) {
    return db.select().from(schema.evidenceFragments)
      .where(and(
        eq(schema.evidenceFragments.sourceType, sourceType),
        eq(schema.evidenceFragments.sourceId, sourceId),
      ))
      .orderBy(desc(schema.evidenceFragments.timestamp));
  }

  static async getContradicted() {
    return db.select().from(schema.evidenceFragments)
      .where(eq(schema.evidenceFragments.contradictionFlag, true))
      .orderBy(desc(schema.evidenceFragments.timestamp));
  }

  static async getPendingReview() {
    return db.select().from(schema.evidenceFragments)
      .where(eq(schema.evidenceFragments.reviewerStatus, 'pending'))
      .orderBy(desc(schema.evidenceFragments.timestamp));
  }
}
