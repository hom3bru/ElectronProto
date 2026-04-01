import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const companies = sqliteTable('companies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  domain: text('domain'),
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
  linkedSourceCount: integer('linked_source_count').default(0),
  linkedEvidenceCount: integer('linked_evidence_count').default(0),
  lastTouched: integer('last_touched', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const contacts = sqliteTable('contacts', {
  id: text('id').primaryKey(),
  companyId: text('company_id').references(() => companies.id),
  name: text('name').notNull(),
  email: text('email'),
  role: text('role'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const threads = sqliteTable('threads', {
  id: text('id').primaryKey(),
  subject: text('subject'),
  status: text('status'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  providerId: text('provider_id'),
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
  labels: text('labels', { mode: 'json' }),
  routeStatus: text('route_status'),
  trustScore: real('trust_score'),
  sourceClassification: text('source_classification'),
});

export const labels = sqliteTable('labels', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const messageLabels = sqliteTable('message_labels', {
  messageId: text('message_id').references(() => messages.id).notNull(),
  labelId: text('label_id').references(() => labels.id).notNull(),
});

export const sourceProfiles = sqliteTable('source_profiles', {
  id: text('id').primaryKey(),
  companyId: text('company_id').references(() => companies.id),
  contactId: text('contact_id').references(() => contacts.id),
  platform: text('platform').notNull(), // e.g., 'linkedin', 'twitter', 'github'
  url: text('url').notNull(),
  handle: text('handle'),
  scrapedData: text('scraped_data'), // JSON
  lastScrapedAt: integer('last_scraped_at', { mode: 'timestamp' }),
});

export const entityLinks = sqliteTable('entity_links', {
  id: text('id').primaryKey(),
  sourceType: text('source_type').notNull(), // e.g., 'message', 'evidence', 'task'
  sourceId: text('source_id').notNull(),
  targetType: text('target_type').notNull(), // e.g., 'company', 'contact'
  targetId: text('target_id').notNull(),
  relationship: text('relationship'), // e.g., 'mentions', 'belongs_to'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  color: text('color'),
});

export const entityTags = sqliteTable('entity_tags', {
  entityType: text('entity_type').notNull(), // e.g., 'company', 'contact', 'message'
  entityId: text('entity_id').notNull(),
  tagId: text('tag_id').references(() => tags.id).notNull(),
});

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
  linkedCompanyId: text('linked_company_id').references(() => companies.id),
  linkedInboxItemId: text('linked_inbox_item_id').references(() => messages.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const evidenceFragments = sqliteTable('evidence_fragments', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  sourceType: text('source_type').notNull(),
  sourceId: text('source_id').notNull(),
  companyId: text('company_id').references(() => companies.id),
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
});

export const notebookEntries = sqliteTable('notebook_entries', {
  id: text('id').primaryKey(),
  relatedEntityType: text('related_entity_type'),
  relatedEntityId: text('related_entity_id'),
  entryType: text('entry_type').notNull(),
  message: text('message').notNull(),
  actorType: text('actor_type'),
  actorName: text('actor_name'),
  metadataJson: text('metadata_json', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  type: text('type').notNull(),
  status: text('status').notNull(),
  priority: text('priority').notNull(),
  relatedEntityType: text('related_entity_type'),
  relatedEntityId: text('related_entity_id'),
  escalationReason: text('escalation_reason'),
  recommendedNextAction: text('recommended_next_action'),
  owner: text('owner'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

export const drafts = sqliteTable('drafts', {
  id: text('id').primaryKey(),
  companyId: text('company_id').references(() => companies.id),
  contactId: text('contact_id').references(() => contacts.id),
  subject: text('subject'),
  body: text('body'),
  status: text('status').notNull(),
  approvalStatus: text('approval_status'),
  blockedReason: text('blocked_reason'),
  linkedInboxThreadId: text('linked_inbox_thread_id').references(() => threads.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  sentAt: integer('sent_at', { mode: 'timestamp' }),
});
