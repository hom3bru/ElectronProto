import { db } from '../../db';
import * as schema from '../../db/schema';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, or, isNotNull } from 'drizzle-orm';
import { LoggerService } from './logger.service';
import {
  CommandResult, ok, okVoid, fail,
  validateId, validateNonEmpty,
} from '../shared/command';

export interface LinkMetadata {
  reason?: string;
  sourceContext?: any;
  [key: string]: any;
}

export class LinkService {
  /** Create a bi-directional or uni-directional link between two entities. */
  static async createLink(
    sourceType: string,
    sourceId: string,
    targetType: string,
    targetId: string,
    linkType: string,
    metadata?: LinkMetadata
  ): Promise<CommandResult<string>> {
    const srcV = validateId(sourceId, 'sourceId');
    if (!srcV.ok) return srcV;
    const tgtV = validateId(targetId, 'targetId');
    if (!tgtV.ok) return tgtV;

    // Prevention of self-linking
    if (sourceType === targetType && sourceId === targetId) {
      return fail('INVALID', 'Cannot link an entity to itself');
    }

    const id = uuidv4();
    try {
      await db.insert(schema.entityLinks).values({
        id,
        sourceType,
        sourceId: srcV.data,
        targetType,
        targetId: tgtV.data,
        linkType,
        metadataJson: metadata || {},
        createdAt: new Date(),
      });

      // Forensic Audit
      const auditMsg = `Linked ${sourceType}:${sourceId} → ${targetType}:${targetId} (${linkType})`;
      await LoggerService.logNotebookEntry(sourceType, sourceId, 'link_created', auditMsg, {
        parentEntityType: sourceType,
        parentEntityId: sourceId,
        metadataJson: { targetType, targetId, linkType, metadata }
      });

      // Mirror audit on target if it's a primary entity (like company)
      if (targetType === 'company') {
        await LoggerService.logNotebookEntry('company', targetId, 'link_received', `Received link from ${sourceType}:${sourceId} (${linkType})`, {
          parentEntityType: 'company',
          parentEntityId: targetId,
          metadataJson: { sourceType, sourceId, linkType, metadata }
        });
      }

      return ok(id);
    } catch (e: any) {
      if (e.message?.includes('UNIQUE')) {
        return fail('CONFLICT', 'This link already exists');
      }
      throw e;
    }
  }

  /** Remove a link. */
  static async removeLink(linkId: string): Promise<CommandResult<void>> {
    const idV = validateId(linkId, 'linkId');
    if (!idV.ok) return idV;

    const [existing] = await db.select().from(schema.entityLinks).where(eq(schema.entityLinks.id, idV.data));
    if (!existing) return fail('NOT_FOUND', 'Link not found');

    await db.delete(schema.entityLinks).where(eq(schema.entityLinks.id, idV.data));

    // Audit removal
    const auditMsg = `Unlinked ${existing.sourceType}:${existing.sourceId} from ${existing.targetType}:${existing.targetId}`;
    await LoggerService.logNotebookEntry(existing.sourceType, existing.sourceId, 'link_removed', auditMsg, {
      parentEntityType: existing.sourceType,
      parentEntityId: existing.sourceId,
      metadataJson: { ...existing }
    });

    return okVoid();
  }

  /** Get all links involving an entity (both incoming and outgoing). */
  static async getLinksForEntity(type: string, id: string): Promise<CommandResult<any[]>> {
    const idV = validateId(id, 'id');
    if (!idV.ok) return idV;

    const links = await db.select()
      .from(schema.entityLinks)
      .where(
        or(
          and(eq(schema.entityLinks.sourceType, type), eq(schema.entityLinks.sourceId, idV.data)),
          and(eq(schema.entityLinks.targetType, type), eq(schema.entityLinks.targetId, idV.data))
        )
      );

    return ok(links);
  }
}
