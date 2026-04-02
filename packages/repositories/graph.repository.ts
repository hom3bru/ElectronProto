import { db } from '../../db';
import * as schema from '../../db/schema';
import { eq, and, or } from 'drizzle-orm';
import { CommandResult, ok, fail, validateId, validateNonEmpty } from '../shared/command';

/**
 * 360-Degree View of an Entity.
 * Aggregates the core entity and all its neighbors from the forensic graph.
 */
export interface EntityGraphContext {
  entity: any;
  links: any[];
  neighbors: {
    evidence: any[];
    tabs: any[];
    tasks: any[];
    companies: any[];
    contacts: any[];
  };
}

export class GraphRepository {
  /**
   * Fetches an entity and its immediate graph neighbors.
   * Optimized for UI context-switching.
   */
  static async getGraphContext(
    entityType: string,
    entityId: string
  ): Promise<CommandResult<EntityGraphContext>> {
    const idV = validateId(entityId, 'entityId');
    if (!idV.ok) return idV;

    const typeV = validateNonEmpty(entityType, 'entityType');
    if (!typeV.ok) return typeV;

    // 1. Fetch links for this entity (both as source and target)
    const links = await db.select()
      .from(schema.entityLinks)
      .where(
        or(
          and(eq(schema.entityLinks.sourceType, entityType), eq(schema.entityLinks.sourceId, entityId)),
          and(eq(schema.entityLinks.targetType, entityType), eq(schema.entityLinks.targetId, entityId))
        )
      );

    const neighbors = {
      evidence: [] as any[],
      tabs: [] as any[],
      tasks: [] as any[],
      companies: [] as any[],
      contacts: [] as any[],
    };

    // 2. Hydrate neighbors based on link targets/sources
    // Note: This pattern avoids a massive single join to keep the SQL simple and robust 
    // for a local workstation database.
    for (const link of links) {
      const isTarget = link.targetType === entityType && link.targetId === entityId;
      const neighborType = isTarget ? link.sourceType : link.targetType;
      const neighborId = isTarget ? link.sourceId : link.targetId;

      switch (neighborType) {
        case 'evidence': {
          const [item] = await db.select().from(schema.evidenceFragments).where(eq(schema.evidenceFragments.id, neighborId));
          if (item) neighbors.evidence.push(item);
          break;
        }
        case 'browser_tab': {
          const [item] = await db.select().from(schema.browserTabs).where(eq(schema.browserTabs.id, neighborId));
          if (item) neighbors.tabs.push(item);
          break;
        }
        case 'task': {
          const [item] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, neighborId));
          if (item) neighbors.tasks.push(item);
          break;
        }
        case 'company': {
          const [item] = await db.select().from(schema.companies).where(eq(schema.companies.id, neighborId));
          if (item) neighbors.companies.push(item);
          break;
        }
        case 'contact': {
          const [item] = await db.select().from(schema.contacts).where(eq(schema.contacts.id, neighborId));
          if (item) neighbors.contacts.push(item);
          break;
        }
      }
    }

    // 3. Fetch the primary entity itself (if not already fetched as a neighbor)
    let entity: any = null;
    switch (entityType) {
      case 'company':
        [entity] = await db.select().from(schema.companies).where(eq(schema.companies.id, entityId));
        break;
      case 'contact':
        [entity] = await db.select().from(schema.contacts).where(eq(schema.contacts.id, entityId));
        break;
      case 'evidence':
        [entity] = await db.select().from(schema.evidenceFragments).where(eq(schema.evidenceFragments.id, entityId));
        break;
      case 'task':
        [entity] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, entityId));
        break;
    }

    if (!entity) return fail('NOT_FOUND', `Primary entity ${entityType}:${entityId} not found`);

    return ok({
      entity,
      links,
      neighbors
    });
  }
}
