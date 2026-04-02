import { db } from '../../db';
import * as schema from '../../db/schema';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import { LoggerService } from './logger.service';
import { LinkService } from './link.service';
import {
  CommandResult, ok, okVoid, fail,
  validateId, validateNonEmpty,
} from '../shared/command';

export class OutreachService {

  static async createDraftFromThread(
    threadId: string,
    subject?: string,
    body?: string,
  ): Promise<CommandResult<string>> {
    const idV = validateId(threadId, 'threadId');
    if (!idV.ok) return idV;

    // Verify thread exists
    const [thread] = await db.select({ id: schema.threads.id })
      .from(schema.threads).where(eq(schema.threads.id, idV.data));
    if (!thread) return fail('NOT_FOUND', `Thread ${threadId} not found`);

    const id = uuidv4();
    await db.insert(schema.drafts).values({
      id,
      linkedInboxThreadId: idV.data,
      subject: subject?.trim() || 'Reply',
      body: body?.trim() || '',
      status: 'draft',
      approvalStatus: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await LoggerService.logNotebookEntry('draft', id, 'created',
      `Draft created for thread ${idV.data}`);
    return ok(id);
  }

  static async createDraftFromCompany(
    companyId: string,
    subject?: string,
    body?: string,
  ): Promise<CommandResult<string>> {
    const idV = validateId(companyId, 'companyId');
    if (!idV.ok) return idV;

    const [company] = await db.select({ id: schema.companies.id })
      .from(schema.companies).where(eq(schema.companies.id, idV.data));
    if (!company) return fail('NOT_FOUND', `Company ${companyId} not found`);

    const id = uuidv4();
    await db.insert(schema.drafts).values({
      id,
      subject: subject?.trim() || 'Initial Outreach',
      body: body?.trim() || '',
      status: 'draft',
      approvalStatus: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Write graph link immediately — new drafts are now in entity_links from birth.
    await LinkService.createLink('draft', id, 'company', idV.data, 'related', {
      source: 'outreach_draft',
    });

    await LoggerService.logNotebookEntry('draft', id, 'created',
      `Draft created for company ${idV.data}`,
      { parentEntityType: 'company', parentEntityId: idV.data });
    return ok(id);
  }

  static async updateDraft(
    draftId: string,
    subject: string,
    body: string,
  ): Promise<CommandResult<void>> {
    const idV = validateId(draftId, 'draftId');
    if (!idV.ok) return idV;

    const subjectV = validateNonEmpty(subject, 'subject', 500);
    if (!subjectV.ok) return subjectV;

    // body can be empty but must be string
    if (typeof body !== 'string') return fail('VALIDATION_ERROR', 'body must be a string', 'body');
    if (body.length > 100_000) return fail('VALIDATION_ERROR', 'body exceeds maximum length', 'body');

    const [draft] = await db.select({ status: schema.drafts.status })
      .from(schema.drafts).where(eq(schema.drafts.id, idV.data));
    if (!draft) return fail('NOT_FOUND', `Draft ${draftId} not found`);
    if (draft.status === 'sent') return fail('CONFLICT', `Cannot edit a sent draft`);
    if (draft.status === 'approved') return fail('CONFLICT', `Cannot edit an approved draft — retract approval first`);

    await db.update(schema.drafts).set({
      subject: subjectV.data,
      body,
      updatedAt: new Date(),
    }).where(eq(schema.drafts.id, idV.data));
    return okVoid();
  }

  static async approveDraft(draftId: string): Promise<CommandResult<void>> {
    const idV = validateId(draftId, 'draftId');
    if (!idV.ok) return idV;

    const [draft] = await db.select({ status: schema.drafts.status, approvalStatus: schema.drafts.approvalStatus })
      .from(schema.drafts).where(eq(schema.drafts.id, idV.data));
    if (!draft) return fail('NOT_FOUND', `Draft ${draftId} not found`);
    if (draft.status === 'sent') return fail('CONFLICT', `Draft ${draftId} is already sent`);
    if (draft.status === 'approved') return fail('CONFLICT', `Draft ${draftId} is already approved`);
    if (draft.status === 'blocked') return fail('CONFLICT', `Draft ${draftId} is blocked — resolve blocker first`);

    await db.update(schema.drafts).set({
      approvalStatus: 'approved',
      status: 'approved',
      updatedAt: new Date(),
    }).where(eq(schema.drafts.id, idV.data));
    await LoggerService.logNotebookEntry('draft', idV.data, 'approved', 'Draft approved');
    return okVoid();
  }

  static async submitDraftForReview(draftId: string): Promise<CommandResult<void>> {
    const idV = validateId(draftId, 'draftId');
    if (!idV.ok) return idV;

    const [draft] = await db.select({ status: schema.drafts.status })
      .from(schema.drafts).where(eq(schema.drafts.id, idV.data));
    if (!draft) return fail('NOT_FOUND', `Draft ${draftId} not found`);
    if (draft.status !== 'draft') return fail('CONFLICT', `Only drafts in 'draft' state can be submitted for review`);

    await db.update(schema.drafts).set({
      status: 'pending_approval',
      approvalStatus: 'pending_review',
      updatedAt: new Date(),
    }).where(eq(schema.drafts.id, idV.data));
    await LoggerService.logNotebookEntry('draft', idV.data, 'submitted_for_review', 'Draft submitted for human review');
    return okVoid();
  }

  /** Agent veto — block a draft before send, requiring a reason. */
  static async blockDraft(draftId: string, reason: string): Promise<CommandResult<void>> {
    const idV = validateId(draftId, 'draftId');
    if (!idV.ok) return idV;

    const reasonV = validateNonEmpty(reason, 'reason', 1000);
    if (!reasonV.ok) return reasonV;

    const [draft] = await db.select({ status: schema.drafts.status })
      .from(schema.drafts).where(eq(schema.drafts.id, idV.data));
    if (!draft) return fail('NOT_FOUND', `Draft ${draftId} not found`);
    if (draft.status === 'sent') return fail('CONFLICT', `Cannot block a sent draft`);

    await db.update(schema.drafts).set({
      status: 'blocked',
      blockedReason: reasonV.data,
      updatedAt: new Date(),
    }).where(eq(schema.drafts.id, idV.data));
    await LoggerService.logNotebookEntry('draft', idV.data, 'blocked', `Draft blocked: ${reasonV.data}`);
    return okVoid();
  }

  /** Retract agent approval, reverting an approved draft back to 'draft' state. */
  static async retractDraft(draftId: string): Promise<CommandResult<void>> {
    const idV = validateId(draftId, 'draftId');
    if (!idV.ok) return idV;

    const [draft] = await db.select({ status: schema.drafts.status })
      .from(schema.drafts).where(eq(schema.drafts.id, idV.data));
    if (!draft) return fail('NOT_FOUND', `Draft ${draftId} not found`);
    if (draft.status === 'sent') return fail('CONFLICT', `Cannot retract a sent draft`);
    if (draft.status === 'draft') return fail('CONFLICT', `Draft is already in draft state`);

    await db.update(schema.drafts).set({
      status: 'draft',
      approvalStatus: 'pending',
      blockedReason: null,
      updatedAt: new Date(),
    }).where(eq(schema.drafts.id, idV.data));
    await LoggerService.logNotebookEntry('draft', idV.data, 'retracted', 'Draft approval retracted');
    return okVoid();
  }

  static async resolveDraftBlocker(draftId: string, resolution: string): Promise<CommandResult<void>> {
    const idV = validateId(draftId, 'draftId');
    if (!idV.ok) return idV;

    const resV = validateNonEmpty(resolution, 'resolution', 1000);
    if (!resV.ok) return resV;

    const [draft] = await db.select({ status: schema.drafts.status })
      .from(schema.drafts).where(eq(schema.drafts.id, idV.data));
    if (!draft) return fail('NOT_FOUND', `Draft ${draftId} not found`);
    if (draft.status !== 'blocked') return fail('CONFLICT', `Draft ${draftId} is not blocked`);

    await db.update(schema.drafts).set({
      status: 'draft',
      blockedReason: null,
      updatedAt: new Date(),
    }).where(eq(schema.drafts.id, idV.data));
    await LoggerService.logNotebookEntry('draft', idV.data, 'unblocked', `Draft blocker resolved: ${resV.data}`);
    return okVoid();
  }

  /** Called by SyncEngine after transport succeeds to mark draft as sent. */
  static async markDraftSent(draftId: string): Promise<CommandResult<void>> {
    const idV = validateId(draftId, 'draftId');
    if (!idV.ok) return idV;

    await db.update(schema.drafts).set({
      status: 'sent',
      sentAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(schema.drafts.id, idV.data));
    await LoggerService.logNotebookEntry('draft', idV.data, 'sent', 'Draft dispatched via provider');
    return okVoid();
  }

  /** Called by SyncEngine after transport rejection. */
  static async markDraftRejected(draftId: string, reason: string): Promise<CommandResult<void>> {
    const idV = validateId(draftId, 'draftId');
    if (!idV.ok) return idV;

    await db.update(schema.drafts).set({
      status: 'blocked',
      blockedReason: reason,
      updatedAt: new Date(),
    }).where(eq(schema.drafts.id, idV.data));
    await LoggerService.logNotebookEntry('draft', idV.data, 'rejected', `Provider rejected: ${reason}`);
    return okVoid();
  }
}
