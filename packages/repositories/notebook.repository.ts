import { db } from '../../db';
import * as schema from '../../db/schema';
import { eq, desc, and, or, SQL, like, inArray } from 'drizzle-orm';

export interface NotebookFilters {
  entityType?: string;
  entityId?: string;
  parentEntityId?: string; // Returns Activity for entity OR where entity is the parent
  entryType?: string;
  actorType?: string;
  search?: string;
  limit?: number;
}

export class NotebookRepository {
  static async getEntries(filters: NotebookFilters = {}) {
    const conditions: SQL[] = [];

    if (filters.entityType) {
      conditions.push(eq(schema.notebookEntries.relatedEntityType, filters.entityType));
    }
    
    // For entity timelines (e.g. CRM company notebook):
    // Match entries exactly for this entity, OR entries that declare this entity as their parent
    if (filters.entityId || filters.parentEntityId) {
      const eid = filters.entityId || filters.parentEntityId;
      conditions.push(
        or(
          eq(schema.notebookEntries.relatedEntityId, eid!),
          eq(schema.notebookEntries.parentEntityId, eid!)
        ) as SQL
      );
    }

    if (filters.entryType) {
      conditions.push(eq(schema.notebookEntries.entryType, filters.entryType));
    }

    if (filters.actorType) {
      conditions.push(eq(schema.notebookEntries.actorType, filters.actorType));
    }

    if (filters.search) {
      conditions.push(like(schema.notebookEntries.message, `%${filters.search}%`));
    }

    const query = db.select().from(schema.notebookEntries);
    const result = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(schema.notebookEntries.createdAt))
      : await query.orderBy(desc(schema.notebookEntries.createdAt));

    return filters.limit ? result.slice(0, filters.limit) : result;
  }

  static async getCommandLog(entityId: string) {
    // Legacy support, maps to new parent-aware query so CRM timeline works immediately
    return this.getEntries({ parentEntityId: entityId });
  }

  static async getEntriesByType(entryType: string) {
    return this.getEntries({ entryType });
  }
}

