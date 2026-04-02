// ─── Command Result Envelope ─────────────────────────────────────────────────
// Every service method should return CommandResult<T> so callers (IPC handlers,
// agents) can reason about success/failure without catching exceptions.

export type CommandResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: CommandError };

export interface CommandError {
  code: string;       // Machine-readable: 'NOT_FOUND', 'VALIDATION_ERROR', etc.
  message: string;    // Human-readable explanation
  field?: string;     // Optional: which field failed validation
}

export function ok<T>(data: T): CommandResult<T> {
  return { ok: true, data };
}

export function okVoid(): CommandResult<void> {
  return { ok: true, data: undefined };
}

export function fail(code: string, message: string, field?: string): CommandResult<never> {
  return { ok: false, error: { code, message, field } };
}

// ─── Domain Enums ─────────────────────────────────────────────────────────────
// Canonical allowed values for status fields.
// These are used in service validation guards.

export const TASK_STATUS = ['queued', 'in-progress', 'needs-review', 'completed', 'cancelled'] as const;
export type TaskStatus = typeof TASK_STATUS[number];

export const TASK_PRIORITY = ['low', 'normal', 'high', 'critical'] as const;
export type TaskPriority = typeof TASK_PRIORITY[number];

export const TASK_TYPE = [
  'review-inbox-item',
  'review-browser-tab',
  'review-evidence',
  'outreach-followup',
  'crm-update',
  'manual',
] as const;
export type TaskType = typeof TASK_TYPE[number];

export const DRAFT_STATUS = ['draft', 'pending_approval', 'approved', 'sent', 'blocked'] as const;
export type DraftStatus = typeof DRAFT_STATUS[number];

export const REVIEW_QUEUE_STATE = ['pending_review', 'approved', 'rejected', 'blocked'] as const;
export type ReviewQueueState = typeof REVIEW_QUEUE_STATE[number];

export const MESSAGE_ROUTE_STATUS = ['inbox', 'escalated', 'archived', 'ignored', 'quarantined'] as const;
export type MessageRouteStatus = typeof MESSAGE_ROUTE_STATUS[number];

export const RELATIONSHIP_TYPE = ['mentions', 'belongs_to', 'linked_to', 'replied_to', 'evidence_for'] as const;
export type RelationshipType = typeof RELATIONSHIP_TYPE[number];

export const ENTITY_TYPE = [
  'message', 'thread', 'company', 'contact',
  'evidence', 'task', 'draft', 'browser_tab', 'notebook_entry',
] as const;
export type EntityType = typeof ENTITY_TYPE[number];

export const SYNC_STATUS = ['idle', 'syncing', 'error'] as const;
export type SyncStatus = typeof SYNC_STATUS[number];

// ─── Validation Helpers ───────────────────────────────────────────────────────

export function validateId(id: unknown, fieldName: string): CommandResult<string> {
  if (typeof id !== 'string' || id.trim().length === 0) {
    return fail('VALIDATION_ERROR', `${fieldName} must be a non-empty string`, fieldName);
  }
  return ok(id.trim());
}

export function validateEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fieldName: string,
): CommandResult<T> {
  if (!allowed.includes(value as T)) {
    return fail(
      'VALIDATION_ERROR',
      `${fieldName} must be one of: ${allowed.join(', ')}`,
      fieldName,
    );
  }
  return ok(value as T);
}

export function validateNonEmpty(value: unknown, fieldName: string, maxLen = 2000): CommandResult<string> {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return fail('VALIDATION_ERROR', `${fieldName} must be a non-empty string`, fieldName);
  }
  if (value.length > maxLen) {
    return fail('VALIDATION_ERROR', `${fieldName} exceeds maximum length of ${maxLen}`, fieldName);
  }
  return ok(value.trim());
}
