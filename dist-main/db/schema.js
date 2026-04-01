"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mailSyncState = exports.mailboxes = exports.mailAccounts = exports.drafts = exports.tasks = exports.notebookEntries = exports.evidenceFragments = exports.browserTabs = exports.entityTags = exports.tags = exports.entityLinks = exports.sourceProfiles = exports.messageLabels = exports.labels = exports.messages = exports.threads = exports.contacts = exports.companies = void 0;
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
exports.companies = (0, sqlite_core_1.sqliteTable)('companies', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    name: (0, sqlite_core_1.text)('name').notNull(),
    domain: (0, sqlite_core_1.text)('domain'),
    hq: (0, sqlite_core_1.text)('hq'),
    country: (0, sqlite_core_1.text)('country'),
    sector: (0, sqlite_core_1.text)('sector'),
    subsector: (0, sqlite_core_1.text)('subsector'),
    status: (0, sqlite_core_1.text)('status'),
    qualificationScore: (0, sqlite_core_1.real)('qualification_score'),
    confidenceScore: (0, sqlite_core_1.real)('confidence_score'),
    contradictionFlag: (0, sqlite_core_1.integer)('contradiction_flag', { mode: 'boolean' }),
    websiteStatus: (0, sqlite_core_1.text)('website_status'),
    leadStage: (0, sqlite_core_1.text)('lead_stage'),
    outreachState: (0, sqlite_core_1.text)('outreach_state'),
    linkedSourceCount: (0, sqlite_core_1.integer)('linked_source_count').default(0),
    linkedEvidenceCount: (0, sqlite_core_1.integer)('linked_evidence_count').default(0),
    lastTouched: (0, sqlite_core_1.integer)('last_touched', { mode: 'timestamp' }),
    createdAt: (0, sqlite_core_1.integer)('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: (0, sqlite_core_1.integer)('updated_at', { mode: 'timestamp' }).notNull(),
});
exports.contacts = (0, sqlite_core_1.sqliteTable)('contacts', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    companyId: (0, sqlite_core_1.text)('company_id').references(() => exports.companies.id),
    name: (0, sqlite_core_1.text)('name').notNull(),
    email: (0, sqlite_core_1.text)('email'),
    role: (0, sqlite_core_1.text)('role'),
    createdAt: (0, sqlite_core_1.integer)('created_at', { mode: 'timestamp' }).notNull(),
});
exports.threads = (0, sqlite_core_1.sqliteTable)('threads', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    subject: (0, sqlite_core_1.text)('subject'),
    status: (0, sqlite_core_1.text)('status'),
    createdAt: (0, sqlite_core_1.integer)('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: (0, sqlite_core_1.integer)('updated_at', { mode: 'timestamp' }).notNull(),
});
exports.messages = (0, sqlite_core_1.sqliteTable)('messages', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    providerId: (0, sqlite_core_1.text)('provider_id').unique(),
    threadId: (0, sqlite_core_1.text)('thread_id').references(() => exports.threads.id),
    mailboxId: (0, sqlite_core_1.text)('mailbox_id'),
    from: (0, sqlite_core_1.text)('from').notNull(),
    to: (0, sqlite_core_1.text)('to').notNull(),
    cc: (0, sqlite_core_1.text)('cc'),
    bcc: (0, sqlite_core_1.text)('bcc'),
    subject: (0, sqlite_core_1.text)('subject'),
    snippet: (0, sqlite_core_1.text)('snippet'),
    plainTextBody: (0, sqlite_core_1.text)('plain_text_body'),
    htmlBody: (0, sqlite_core_1.text)('html_body'),
    receivedAt: (0, sqlite_core_1.integer)('received_at', { mode: 'timestamp' }).notNull(),
    readState: (0, sqlite_core_1.integer)('read_state', { mode: 'boolean' }).default(false),
    labels: (0, sqlite_core_1.text)('labels', { mode: 'json' }), // DEPRECATED: use messageLabels join table
    routeStatus: (0, sqlite_core_1.text)('route_status'),
    trustScore: (0, sqlite_core_1.real)('trust_score'),
    sourceClassification: (0, sqlite_core_1.text)('source_classification'),
});
exports.labels = (0, sqlite_core_1.sqliteTable)('labels', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    name: (0, sqlite_core_1.text)('name').notNull(),
    color: (0, sqlite_core_1.text)('color'),
    createdAt: (0, sqlite_core_1.integer)('created_at', { mode: 'timestamp' }).notNull(),
});
exports.messageLabels = (0, sqlite_core_1.sqliteTable)('message_labels', {
    messageId: (0, sqlite_core_1.text)('message_id').references(() => exports.messages.id).notNull(),
    labelId: (0, sqlite_core_1.text)('label_id').references(() => exports.labels.id).notNull(),
}, (t) => ({
    pk: (0, sqlite_core_1.primaryKey)({ columns: [t.messageId, t.labelId] }),
}));
exports.sourceProfiles = (0, sqlite_core_1.sqliteTable)('source_profiles', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    companyId: (0, sqlite_core_1.text)('company_id').references(() => exports.companies.id),
    contactId: (0, sqlite_core_1.text)('contact_id').references(() => exports.contacts.id),
    platform: (0, sqlite_core_1.text)('platform').notNull(), // e.g., 'linkedin', 'twitter', 'github'
    url: (0, sqlite_core_1.text)('url').notNull(),
    handle: (0, sqlite_core_1.text)('handle'),
    scrapedData: (0, sqlite_core_1.text)('scraped_data'), // JSON
    lastScrapedAt: (0, sqlite_core_1.integer)('last_scraped_at', { mode: 'timestamp' }),
});
exports.entityLinks = (0, sqlite_core_1.sqliteTable)('entity_links', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    sourceType: (0, sqlite_core_1.text)('source_type').notNull(), // e.g., 'message', 'evidence', 'task'
    sourceId: (0, sqlite_core_1.text)('source_id').notNull(),
    targetType: (0, sqlite_core_1.text)('target_type').notNull(), // e.g., 'company', 'contact'
    targetId: (0, sqlite_core_1.text)('target_id').notNull(),
    relationship: (0, sqlite_core_1.text)('relationship'), // e.g., 'mentions', 'belongs_to'
    createdAt: (0, sqlite_core_1.integer)('created_at', { mode: 'timestamp' }).notNull(),
}, (t) => ({
    sourceIdx: (0, sqlite_core_1.index)('entity_links_source_idx').on(t.sourceType, t.sourceId),
    targetIdx: (0, sqlite_core_1.index)('entity_links_target_idx').on(t.targetType, t.targetId),
}));
exports.tags = (0, sqlite_core_1.sqliteTable)('tags', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    name: (0, sqlite_core_1.text)('name').notNull().unique(),
    color: (0, sqlite_core_1.text)('color'),
});
exports.entityTags = (0, sqlite_core_1.sqliteTable)('entity_tags', {
    entityType: (0, sqlite_core_1.text)('entity_type').notNull(), // e.g., 'company', 'contact', 'message'
    entityId: (0, sqlite_core_1.text)('entity_id').notNull(),
    tagId: (0, sqlite_core_1.text)('tag_id').references(() => exports.tags.id).notNull(),
}, (t) => ({
    pk: (0, sqlite_core_1.primaryKey)({ columns: [t.entityType, t.entityId, t.tagId] }),
}));
exports.browserTabs = (0, sqlite_core_1.sqliteTable)('browser_tabs', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    sessionPartition: (0, sqlite_core_1.text)('session_partition').notNull(),
    url: (0, sqlite_core_1.text)('url').notNull(),
    title: (0, sqlite_core_1.text)('title'),
    loadingState: (0, sqlite_core_1.integer)('loading_state', { mode: 'boolean' }).default(false),
    pinnedFlag: (0, sqlite_core_1.integer)('pinned_flag', { mode: 'boolean' }).default(false),
    active: (0, sqlite_core_1.integer)('active', { mode: 'boolean' }).default(false),
    tabOrder: (0, sqlite_core_1.integer)('tab_order').default(0),
    lastFocusedTimestamp: (0, sqlite_core_1.integer)('last_focused_timestamp', { mode: 'timestamp' }),
    linkedCompanyId: (0, sqlite_core_1.text)('linked_company_id').references(() => exports.companies.id),
    linkedInboxItemId: (0, sqlite_core_1.text)('linked_inbox_item_id').references(() => exports.messages.id),
    createdAt: (0, sqlite_core_1.integer)('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: (0, sqlite_core_1.integer)('updated_at', { mode: 'timestamp' }).notNull(),
});
exports.evidenceFragments = (0, sqlite_core_1.sqliteTable)('evidence_fragments', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    type: (0, sqlite_core_1.text)('type').notNull(),
    sourceType: (0, sqlite_core_1.text)('source_type').notNull(),
    sourceId: (0, sqlite_core_1.text)('source_id').notNull(),
    companyId: (0, sqlite_core_1.text)('company_id').references(() => exports.companies.id),
    claimSummary: (0, sqlite_core_1.text)('claim_summary').notNull(),
    quote: (0, sqlite_core_1.text)('quote'),
    url: (0, sqlite_core_1.text)('url'),
    inboxMessageId: (0, sqlite_core_1.text)('inbox_message_id').references(() => exports.messages.id),
    browserTabId: (0, sqlite_core_1.text)('browser_tab_id').references(() => exports.browserTabs.id),
    timestamp: (0, sqlite_core_1.integer)('timestamp', { mode: 'timestamp' }).notNull(),
    confidence: (0, sqlite_core_1.real)('confidence'),
    contradictionFlag: (0, sqlite_core_1.integer)('contradiction_flag', { mode: 'boolean' }).default(false),
    extractedBy: (0, sqlite_core_1.text)('extracted_by'),
    reviewerStatus: (0, sqlite_core_1.text)('reviewer_status'),
});
exports.notebookEntries = (0, sqlite_core_1.sqliteTable)('notebook_entries', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    relatedEntityType: (0, sqlite_core_1.text)('related_entity_type'),
    relatedEntityId: (0, sqlite_core_1.text)('related_entity_id'),
    entryType: (0, sqlite_core_1.text)('entry_type').notNull(),
    message: (0, sqlite_core_1.text)('message').notNull(),
    actorType: (0, sqlite_core_1.text)('actor_type'),
    actorName: (0, sqlite_core_1.text)('actor_name'),
    metadataJson: (0, sqlite_core_1.text)('metadata_json', { mode: 'json' }),
    createdAt: (0, sqlite_core_1.integer)('created_at', { mode: 'timestamp' }).notNull(),
});
exports.tasks = (0, sqlite_core_1.sqliteTable)('tasks', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    title: (0, sqlite_core_1.text)('title').notNull(),
    type: (0, sqlite_core_1.text)('type').notNull(),
    status: (0, sqlite_core_1.text)('status').notNull(),
    priority: (0, sqlite_core_1.text)('priority').notNull(),
    relatedEntityType: (0, sqlite_core_1.text)('related_entity_type'),
    relatedEntityId: (0, sqlite_core_1.text)('related_entity_id'),
    escalationReason: (0, sqlite_core_1.text)('escalation_reason'),
    notes: (0, sqlite_core_1.text)('notes'),
    recommendedNextAction: (0, sqlite_core_1.text)('recommended_next_action'),
    owner: (0, sqlite_core_1.text)('owner'),
    createdAt: (0, sqlite_core_1.integer)('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: (0, sqlite_core_1.integer)('updated_at', { mode: 'timestamp' }).notNull(),
    completedAt: (0, sqlite_core_1.integer)('completed_at', { mode: 'timestamp' }),
});
exports.drafts = (0, sqlite_core_1.sqliteTable)('drafts', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    companyId: (0, sqlite_core_1.text)('company_id').references(() => exports.companies.id),
    contactId: (0, sqlite_core_1.text)('contact_id').references(() => exports.contacts.id),
    subject: (0, sqlite_core_1.text)('subject'),
    body: (0, sqlite_core_1.text)('body'),
    status: (0, sqlite_core_1.text)('status').notNull(),
    approvalStatus: (0, sqlite_core_1.text)('approval_status'),
    blockedReason: (0, sqlite_core_1.text)('blocked_reason'),
    linkedInboxThreadId: (0, sqlite_core_1.text)('linked_inbox_thread_id').references(() => exports.threads.id),
    createdAt: (0, sqlite_core_1.integer)('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: (0, sqlite_core_1.integer)('updated_at', { mode: 'timestamp' }).notNull(),
    sentAt: (0, sqlite_core_1.integer)('sent_at', { mode: 'timestamp' }),
});
exports.mailAccounts = (0, sqlite_core_1.sqliteTable)('mail_accounts', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    provider: (0, sqlite_core_1.text)('provider').notNull(), // 'gmail', 'mock', etc.
    email: (0, sqlite_core_1.text)('email').notNull().unique(),
    displayName: (0, sqlite_core_1.text)('display_name'),
    credentials: (0, sqlite_core_1.text)('credentials'), // JSON, encrypted in production
    isActive: (0, sqlite_core_1.integer)('is_active', { mode: 'boolean' }).default(true),
    createdAt: (0, sqlite_core_1.integer)('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: (0, sqlite_core_1.integer)('updated_at', { mode: 'timestamp' }).notNull(),
});
exports.mailboxes = (0, sqlite_core_1.sqliteTable)('mailboxes', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    accountId: (0, sqlite_core_1.text)('account_id').references(() => exports.mailAccounts.id).notNull(),
    name: (0, sqlite_core_1.text)('name').notNull(), // 'INBOX', 'Sent', etc.
    providerId: (0, sqlite_core_1.text)('provider_id'), // provider-specific mailbox ID
    createdAt: (0, sqlite_core_1.integer)('created_at', { mode: 'timestamp' }).notNull(),
});
exports.mailSyncState = (0, sqlite_core_1.sqliteTable)('mail_sync_state', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    accountId: (0, sqlite_core_1.text)('account_id').references(() => exports.mailAccounts.id).notNull().unique(),
    lastSyncedAt: (0, sqlite_core_1.integer)('last_synced_at', { mode: 'timestamp' }),
    lastHistoryId: (0, sqlite_core_1.text)('last_history_id'), // for Gmail incremental sync
    syncStatus: (0, sqlite_core_1.text)('sync_status').default('idle'), // 'idle', 'syncing', 'error'
    errorMessage: (0, sqlite_core_1.text)('error_message'),
    updatedAt: (0, sqlite_core_1.integer)('updated_at', { mode: 'timestamp' }).notNull(),
});
