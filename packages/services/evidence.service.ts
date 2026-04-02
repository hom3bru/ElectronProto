import { db } from '../../db';
import * as schema from '../../db/schema';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, like, or, sql } from 'drizzle-orm';
import { LoggerService } from './logger.service';
import { LinkService } from './link.service';
import {
  CommandResult, ok, okVoid, fail,
  validateId, validateNonEmpty,
} from '../shared/command';

export const EVIDENCE_REVIEWER_STATUS = ['pending', 'confirmed', 'disputed', 'retracted'] as const;
export type EvidenceReviewerStatus = typeof EVIDENCE_REVIEWER_STATUS[number];

export const EVIDENCE_TYPES = ['claim', 'quote', 'screenshot', 'document', 'data_point', 'attribute'] as const;
export type EvidenceType = typeof EVIDENCE_TYPES[number];

export const EVIDENCE_SOURCE_TYPES = ['inbox_message', 'browser_tab', 'manual', 'agent_extraction', 'sync'] as const;

export class EvidenceService {

  /** Direct evidence creation — for manual capture and agent use. */
  static async createFragment(
    claimSummary: string,
    sourceType: string,
    sourceId: string,
    opts?: {
      quote?: string;
      url?: string;
      type?: string;
      companyId?: string;
      inboxMessageId?: string;
      browserTabId?: string;
      confidence?: number;
      extractedBy?: string;
    },
  ): Promise<CommandResult<string>> {
    const claimV = validateNonEmpty(claimSummary, 'claimSummary', 5000);
    if (!claimV.ok) return claimV;

    const srcTypeV = validateNonEmpty(sourceType, 'sourceType', 100);
    if (!srcTypeV.ok) return srcTypeV;

    const srcIdV = validateId(sourceId, 'sourceId');
    if (!srcIdV.ok) return srcIdV;

    if (opts?.confidence !== undefined && (opts.confidence < 0 || opts.confidence > 1)) {
      return fail('VALIDATION_ERROR', 'confidence must be between 0 and 1', 'confidence');
    }

    const id = uuidv4();
    await db.insert(schema.evidenceFragments).values({
      id,
      type: opts?.type ?? 'claim',
      sourceType: srcTypeV.data,
      sourceId: srcIdV.data,
      claimSummary: claimV.data,
      quote: opts?.quote?.trim() || null,
      url: opts?.url?.trim() || null,
      inboxMessageId: opts?.inboxMessageId ?? null,
      browserTabId: opts?.browserTabId ?? null,
      confidence: opts?.confidence ?? null,
      extractedBy: opts?.extractedBy ?? 'human',
      reviewerStatus: 'pending',
      contradictionFlag: false,
      timestamp: new Date(),
    });

    // Write graph link immediately so new evidence appears in entity_links from birth.
    if (opts?.companyId) {
      await LinkService.createLink('evidence', id, 'company', opts.companyId, 'evidence_for', {
        source: 'evidence_create',
        extractedBy: opts?.extractedBy ?? 'human',
      });
    }

    await LoggerService.logNotebookEntry('evidence', id, 'created',
      `Evidence fragment created: "${claimV.data.slice(0, 100)}"`,
      { parentEntityType: 'company', parentEntityId: opts?.companyId, actorType: 'system' });
    return ok(id);
  }

  /** Set the reviewer status — the core of the review lifecycle.
   *  Valid transitions: pending → confirmed | disputed | retracted */
  static async review(
    fragmentId: string,
    status: string,
  ): Promise<CommandResult<void>> {
    const idV = validateId(fragmentId, 'fragmentId');
    if (!idV.ok) return idV;

    if (!EVIDENCE_REVIEWER_STATUS.includes(status as EvidenceReviewerStatus)) {
      return fail(
        'VALIDATION_ERROR',
        `status must be one of: ${EVIDENCE_REVIEWER_STATUS.join(', ')}`,
        'status',
      );
    }

    const [frag] = await db.select({ id: schema.evidenceFragments.id, reviewerStatus: schema.evidenceFragments.reviewerStatus })
      .from(schema.evidenceFragments).where(eq(schema.evidenceFragments.id, idV.data));
    if (!frag) return fail('NOT_FOUND', `Evidence fragment ${fragmentId} not found`);

    await db.update(schema.evidenceFragments)
      .set({ reviewerStatus: status })
      .where(eq(schema.evidenceFragments.id, idV.data));

    // Resolve parent company via the graph for logging context
    const [link] = await db.select({ targetId: schema.entityLinks.targetId })
      .from(schema.entityLinks)
      .where(and(
        eq(schema.entityLinks.sourceType, 'evidence'),
        eq(schema.entityLinks.sourceId, idV.data),
        eq(schema.entityLinks.targetType, 'company')
      )).limit(1);

    await LoggerService.logNotebookEntry('evidence', idV.data, 'reviewed',
      `Evidence review: ${frag.reviewerStatus ?? 'unset'} → ${status}`,
      { parentEntityType: 'company', parentEntityId: link?.targetId ?? undefined, actorType: 'human' });
    return okVoid();
  }

  /** Flag or clear a contradiction. Sets the boolean on the fragment and logs why. */
  static async setContradiction(
    fragmentId: string,
    contradicts: boolean,
    reason?: string,
  ): Promise<CommandResult<void>> {
    const idV = validateId(fragmentId, 'fragmentId');
    if (!idV.ok) return idV;

    const [frag] = await db.select({ id: schema.evidenceFragments.id })
      .from(schema.evidenceFragments).where(eq(schema.evidenceFragments.id, idV.data));
    if (!frag) return fail('NOT_FOUND', `Evidence fragment ${fragmentId} not found`);

    await db.update(schema.evidenceFragments)
      .set({ contradictionFlag: contradicts })
      .where(eq(schema.evidenceFragments.id, idV.data));

    // Resolve parent company via the graph
    const [link] = await db.select({ targetId: schema.entityLinks.targetId })
      .from(schema.entityLinks)
      .where(and(
        eq(schema.entityLinks.sourceType, 'evidence'),
        eq(schema.entityLinks.sourceId, idV.data),
        eq(schema.entityLinks.targetType, 'company')
      )).limit(1);

    await LoggerService.logNotebookEntry('evidence', idV.data,
      contradicts ? 'contradiction_flagged' : 'contradiction_cleared',
      reason?.trim() || (contradicts ? 'Contradiction flag set' : 'Contradiction flag cleared'),
      { parentEntityType: 'company', parentEntityId: link?.targetId ?? undefined, actorType: 'human' });
    return okVoid();
  }

  /** Update extracted confidence score (0–1). For agent feedback loops. */
  static async updateConfidence(
    fragmentId: string,
    confidence: number,
  ): Promise<CommandResult<void>> {
    const idV = validateId(fragmentId, 'fragmentId');
    if (!idV.ok) return idV;

    if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
      return fail('VALIDATION_ERROR', 'confidence must be a number between 0 and 1', 'confidence');
    }

    const [frag] = await db.select({ id: schema.evidenceFragments.id })
      .from(schema.evidenceFragments).where(eq(schema.evidenceFragments.id, idV.data));
    if (!frag) return fail('NOT_FOUND', `Evidence fragment ${fragmentId} not found`);

    await db.update(schema.evidenceFragments)
      .set({ confidence })
      .where(eq(schema.evidenceFragments.id, idV.data));

    // Resolve parent company via the graph
    const [link] = await db.select({ targetId: schema.entityLinks.targetId })
      .from(schema.entityLinks)
      .where(and(
        eq(schema.entityLinks.sourceType, 'evidence'),
        eq(schema.entityLinks.sourceId, idV.data),
        eq(schema.entityLinks.targetType, 'company')
      )).limit(1);

    await LoggerService.logNotebookEntry('evidence', idV.data, 'confidence_updated',
      `Confidence set to ${(confidence * 100).toFixed(0)}%`,
      { parentEntityType: 'company', parentEntityId: link?.targetId ?? undefined, actorType: 'system' });
    return okVoid();
  }

  /** Edit claim text in place. Logs the old → new transition for provenance. */
  static async updateClaim(
    fragmentId: string,
    claimSummary: string,
  ): Promise<CommandResult<void>> {
    const idV = validateId(fragmentId, 'fragmentId');
    if (!idV.ok) return idV;

    const claimV = validateNonEmpty(claimSummary, 'claimSummary', 5000);
    if (!claimV.ok) return claimV;

    const [frag] = await db.select({ id: schema.evidenceFragments.id, claimSummary: schema.evidenceFragments.claimSummary })
      .from(schema.evidenceFragments).where(eq(schema.evidenceFragments.id, idV.data));
    if (!frag) return fail('NOT_FOUND', `Evidence fragment ${fragmentId} not found`);

    await db.update(schema.evidenceFragments)
      .set({ claimSummary: claimV.data })
      .where(eq(schema.evidenceFragments.id, idV.data));

    // Resolve parent company via the graph
    const [link] = await db.select({ targetId: schema.entityLinks.targetId })
      .from(schema.entityLinks)
      .where(and(
        eq(schema.entityLinks.sourceType, 'evidence'),
        eq(schema.entityLinks.sourceId, idV.data),
        eq(schema.entityLinks.targetType, 'company')
      )).limit(1);

    await LoggerService.logNotebookEntry('evidence', idV.data, 'claim_updated',
      `Claim: "${(frag.claimSummary ?? '').slice(0, 60)}" → "${claimV.data.slice(0, 60)}"`,
      { parentEntityType: 'company', parentEntityId: link?.targetId ?? undefined, actorType: 'human' });
    return okVoid();
  }

  /** Hard-delete a fragment. Logs the deletion for audit trail (notebook entry persists). */
  static async deleteFragment(fragmentId: string): Promise<CommandResult<void>> {
    const idV = validateId(fragmentId, 'fragmentId');
    if (!idV.ok) return idV;

    const [frag] = await db.select({
      id: schema.evidenceFragments.id,
      claimSummary: schema.evidenceFragments.claimSummary,
    })
      .from(schema.evidenceFragments).where(eq(schema.evidenceFragments.id, idV.data));
    if (!frag) return fail('NOT_FOUND', `Evidence fragment ${fragmentId} not found`);

    // Resolve parent company via the graph
    const [link] = await db.select({ targetId: schema.entityLinks.targetId })
      .from(schema.entityLinks)
      .where(and(
        eq(schema.entityLinks.sourceType, 'evidence'),
        eq(schema.entityLinks.sourceId, idV.data),
        eq(schema.entityLinks.targetType, 'company')
      )).limit(1);

    await db.delete(schema.evidenceFragments)
      .where(eq(schema.evidenceFragments.id, idV.data));

    await LoggerService.logNotebookEntry('evidence', idV.data, 'deleted',
      `Fragment retracted: "${(frag.claimSummary ?? '').slice(0, 80)}"`,
      { parentEntityType: 'company', parentEntityId: link?.targetId ?? undefined, actorType: 'human' });
    return okVoid();
  }
}
