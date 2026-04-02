import { sqliteTable, text, integer, real, index, primaryKey, unique } from 'drizzle-orm/sqlite-core';

export const companies = sqliteTable('companies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  domain: text('domain').unique(),
  hq: text('hq'),
  country: text('country'),
  sector: text('sector'),
  subsector: text('subsector'),
  status: text('status'),
  qualificationScore: real('qualification_score'),
  confidenceScore: real('confidence_score'),
  contradictionFlag: integer('contradiction_flag', { mode: 'boolean' }),
  websiteStatus: text('website_status'),
  leadStage: text('lead_stage'),
  outreachState: text('outreach_state'),
  lastTouched: integer('last_touched', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (t) => ({
  domainIdx: index('companies_domain_idx').on(t.domain),
  leadStageIdx: index('companies_lead_stage_idx').on(t.leadStage),
  updatedAtIdx: index('companies_updated_at_idx').on(t.updatedAt),
}));

export const contacts = sqliteTable('contacts', {
  id: text('id').primaryKey(),
  companyId: text('company_id').references(() => companies.id),
  name: text('name').notNull(),
  email: text('email'),
  role: text('role'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (t) => ({
  companyIdx: index('contacts_company_idx').on(t.companyId),
  uniqueCompanyEmail: unique('contacts_company_email_unique').on(t.companyId, t.email),
}));

export const threads = sqliteTable('threads', {
  id: text('id').primaryKey(),
  subject: text('subject'),
  status: text('status'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (t) => ({
  statusIdx: index('threads_status_idx').on(t.status),
}));

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  providerId: text('provider_id').unique(),
  threadId: text('thread_id').references(() => threads.id),
  mailboxId: text('mailbox_id'),
  from: text('from').notNull(),
  to: text('to').notNull(),
  cc: text('cc'),
  bcc: text('bcc'),
  subject: text('subject'),
  snippet: text('snippet'),
  plainTextBody: text('plain_text_body'),
  htmlBody: text('html_body'),
  receivedAt: integer('received_at', { mode: 'timestamp' }).notNull(),
  readState: integer('read_state', { mode: 'boolean' }).default(false),
  routeStatus: text('route_status'),
  trustScore: real('trust_score'),
  sourceClassification: text('source_classification'),
  remoteMessageId: text('remote_message_id'),
  inReplyTo: text('in_reply_to'),
  referencesHeader: text('references_header'),
}, (t) => ({
  threadIdx: index('messages_thread_idx').on(t.threadId),
  receivedAtIdx: index('messages_received_at_idx').on(t.receivedAt),
  readStateIdx: index('messages_read_state_idx').on(t.readState),
  routeStatusIdx: index('messages_route_status_idx').on(t.routeStatus),
}));

export const labels = sqliteTable('labels', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  color: text('color'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const messageLabels = sqliteTable('message_labels', {
  messageId: text('message_id').references(() => messages.id).notNull(),
  labelId: text('label_id').references(() => labels.id).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.messageId, t.labelId] }),
  messageIdx: index('message_labels_message_idx').on(t.messageId),
}));

/**
 * The core entity linking graph. 
 * Replaces all legacy many-to-many and soft links.
 */
export const entityLinks = sqliteTable('entity_links', {
  id: text('id').primaryKey(),
  sourceType: text('source_type').notNull(), 
  sourceId: text('source_id').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  linkType: text('link_type').notNull(), 
  metadataJson: text('metadata_json', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (t) => ({
  sourceIdx: index('entity_links_source_idx').on(t.sourceType, t.sourceId),
  targetIdx: index('entity_links_target_idx').on(t.targetType, t.targetId),
  uniqueLink: unique('entity_links_unique').on(t.sourceType, t.sourceId, t.targetType, t.targetId, t.linkType),
}));

export const browserTabs = sqliteTable('browser_tabs', {
  id: text('id').primaryKey(),
  sessionPartition: text('session_partition').notNull(),
  url: text('url').notNull(),
  title: text('title'),
  loadingState: integer('loading_state', { mode: 'boolean' }).default(false),
  pinnedFlag: integer('pinned_flag', { mode: 'boolean' }).default(false),
  active: integer('active', { mode: 'boolean' }).default(false),
  tabOrder: integer('tab_order').default(0),
  lastFocusedTimestamp: integer('last_focused_timestamp', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const evidenceFragments = sqliteTable('evidence_fragments', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  sourceType: text('source_type').notNull(),
  sourceId: text('source_id').notNull(),
  claimSummary: text('claim_summary').notNull(),
  quote: text('quote'),
  url: text('url'),
  inboxMessageId: text('inbox_message_id').references(() => messages.id),
  browserTabId: text('browser_tab_id').references(() => browserTabs.id),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  confidence: real('confidence'),
  contradictionFlag: integer('contradiction_flag', { mode: 'boolean' }).default(false),
  extractedBy: text('extracted_by'),
  reviewerStatus: text('reviewer_status'),
}, (t) => ({
  reviewerStatusIdx: index('evidence_reviewer_status_idx').on(t.reviewerStatus),
  contradictionIdx: index('evidence_contradiction_idx').on(t.contradictionFlag),
  sourceIdx: index('evidence_source_idx').on(t.sourceType, t.sourceId),
  timestampIdx: index('evidence_timestamp_idx').on(t.timestamp),
}));

export const notebookEntries = sqliteTable('notebook_entries', {
  id: text('id').primaryKey(),
  relatedEntityType: text('related_entity_type'),
  relatedEntityId: text('related_entity_id'),
  parentEntityType: text('parent_entity_type'),
  parentEntityId: text('parent_entity_id'),
  entryType: text('entry_type').notNull(),
  message: text('message').notNull(),
  actorType: text('actor_type'),
  actorName: text('actor_name'),
  metadataJson: text('metadata_json', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (t) => ({
  parentEntityIdx: index('notebook_parent_entity_idx').on(t.parentEntityType, t.parentEntityId),
  relatedEntityIdx: index('notebook_related_entity_idx').on(t.relatedEntityType, t.relatedEntityId),
  entryTypeIdx: index('notebook_entry_type_idx').on(t.entryType),
  createdAtIdx: index('notebook_created_at_idx').on(t.createdAt),
}));

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  type: text('type').notNull(),
  status: text('status').notNull(),
  priority: text('priority').notNull(),
  relatedEntityType: text('related_entity_type'), 
  relatedEntityId: text('related_entity_id'),
  escalationReason: text('escalation_reason'),
  blockedReason: text('blocked_reason'),
  notes: text('notes'),
  recommendedNextAction: text('recommended_next_action'),
  owner: text('owner'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
}, (t) => ({
  statusIdx: index('tasks_status_idx').on(t.status),
  relatedEntityIdx: index('tasks_related_entity_idx').on(t.relatedEntityType, t.relatedEntityId),
  updatedAtIdx: index('tasks_updated_at_idx').on(t.updatedAt),
}));

export const drafts = sqliteTable('drafts', {
  id: text('id').primaryKey(),
  contactId: text('contact_id').references(() => contacts.id),
  subject: text('subject'),
  body: text('body'),
  status: text('status').notNull(),
  approvalStatus: text('approval_status'),
  reviewQueueState: text('review_queue_state'),
  blockedReason: text('blocked_reason'),
  provenanceId: text('provenance_id'),
  linkedInboxThreadId: text('linked_inbox_thread_id').references(() => threads.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  sentAt: integer('sent_at', { mode: 'timestamp' }),
}, (t) => ({
  statusIdx: index('drafts_status_idx').on(t.status),
  updatedAtIdx: index('drafts_updated_at_idx').on(t.updatedAt),
}));

export const mailAccounts = sqliteTable('mail_accounts', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  email: text('email').notNull().unique(),
  displayName: text('display_name'),
  credentials: text('credentials'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const mailboxes = sqliteTable('mailboxes', {
  id: text('id').primaryKey(),
  accountId: text('account_id').references(() => mailAccounts.id).notNull(),
  name: text('name').notNull(),
  providerId: text('provider_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (t) => ({
  accountIdx: index('mailboxes_account_idx').on(t.accountId),
}));

export const mailSyncState = sqliteTable('mail_sync_state', {
  id: text('id').primaryKey(),
  accountId: text('account_id').references(() => mailAccounts.id).notNull().unique(),
  lastSyncedAt: integer('last_synced_at', { mode: 'timestamp' }),
  lastHistoryId: text('last_history_id'),
  syncStatus: text('sync_status').default('idle'),
  errorMessage: text('error_message'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
