-- 0004_schema_hardening.sql
-- Schema hardening: drop dead columns, add unique constraints, add performance indexes.
-- All CREATE INDEX / CREATE UNIQUE INDEX statements use IF NOT EXISTS for safety.
-- SQLite 3.35+ supports DROP COLUMN; Electron ships Chromium's SQLite which meets this threshold.

--> statement-breakpoint
-- ─── Drop dead columns ──────────────────────────────────────────────────────
ALTER TABLE `companies` DROP COLUMN `linked_source_count`;
--> statement-breakpoint
ALTER TABLE `companies` DROP COLUMN `linked_evidence_count`;
--> statement-breakpoint
ALTER TABLE `browser_tabs` DROP COLUMN `linked_inbox_item_id`;
--> statement-breakpoint
ALTER TABLE `drafts` DROP COLUMN `review_queue_state`;

--> statement-breakpoint
-- ─── Upgrade entity_links: rename relationship → link_type, add metadata ───
-- SQLite cannot rename columns directly in old versions, but we can ADD the new
-- columns alongside the old one. We add link_type (copy of relationship) and metadataJson,
-- then leave relationship in place so old rows are not broken. Services now write link_type.
ALTER TABLE `entity_links` ADD `link_type` text;
--> statement-breakpoint
ALTER TABLE `entity_links` ADD `metadata_json` text;
--> statement-breakpoint
-- Back-fill link_type from relationship for all existing rows
UPDATE `entity_links` SET `link_type` = COALESCE(`relationship`, 'related') WHERE `link_type` IS NULL;
--> statement-breakpoint
-- Drop the old unique index that referenced 'relationship' and rebuild on 'link_type'
DROP INDEX IF EXISTS `entity_links_unique`;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `entity_links_unique` ON `entity_links` (`source_type`,`source_id`,`target_type`,`target_id`,`link_type`);

--> statement-breakpoint
-- ─── Unique constraints ──────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS `companies_domain_unique` ON `companies` (`domain`) WHERE `domain` IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `contacts_company_email_unique` ON `contacts` (`company_id`, `email`) WHERE `email` IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `mailboxes_account_name_unique` ON `mailboxes` (`account_id`, `name`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `source_profiles_platform_url_unique` ON `source_profiles` (`platform`, `url`);

--> statement-breakpoint
-- ─── Performance indexes: companies ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS `companies_domain_idx` ON `companies` (`domain`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `companies_lead_stage_idx` ON `companies` (`lead_stage`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `companies_updated_at_idx` ON `companies` (`updated_at`);

--> statement-breakpoint
-- ─── Performance indexes: contacts ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS `contacts_company_idx` ON `contacts` (`company_id`);

--> statement-breakpoint
-- ─── Performance indexes: threads ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS `threads_status_idx` ON `threads` (`status`);

--> statement-breakpoint
-- ─── Performance indexes: messages ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS `messages_thread_idx` ON `messages` (`thread_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `messages_received_at_idx` ON `messages` (`received_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `messages_read_state_idx` ON `messages` (`read_state`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `messages_route_status_idx` ON `messages` (`route_status`);

--> statement-breakpoint
-- ─── Performance indexes: attachments ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS `attachments_message_idx` ON `attachments` (`message_id`);

--> statement-breakpoint
-- ─── Performance indexes: message_labels ────────────────────────────────────
CREATE INDEX IF NOT EXISTS `message_labels_message_idx` ON `message_labels` (`message_id`);

--> statement-breakpoint
-- ─── Performance indexes: source_profiles ───────────────────────────────────
CREATE INDEX IF NOT EXISTS `source_profiles_company_idx` ON `source_profiles` (`company_id`);

--> statement-breakpoint
-- ─── Performance indexes: entity_tags ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS `entity_tags_entity_idx` ON `entity_tags` (`entity_type`, `entity_id`);

--> statement-breakpoint
-- ─── Performance indexes: browser_tabs ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS `browser_tabs_linked_company_idx` ON `browser_tabs` (`linked_company_id`);

--> statement-breakpoint
-- ─── Performance indexes: evidence_fragments ────────────────────────────────
CREATE INDEX IF NOT EXISTS `evidence_company_idx` ON `evidence_fragments` (`company_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `evidence_reviewer_status_idx` ON `evidence_fragments` (`reviewer_status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `evidence_contradiction_idx` ON `evidence_fragments` (`contradiction_flag`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `evidence_source_idx` ON `evidence_fragments` (`source_type`, `source_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `evidence_timestamp_idx` ON `evidence_fragments` (`timestamp`);

--> statement-breakpoint
-- ─── Performance indexes: notebook_entries (CRITICAL — grows unboundedly) ───
CREATE INDEX IF NOT EXISTS `notebook_parent_entity_idx` ON `notebook_entries` (`parent_entity_type`, `parent_entity_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `notebook_related_entity_idx` ON `notebook_entries` (`related_entity_type`, `related_entity_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `notebook_entry_type_idx` ON `notebook_entries` (`entry_type`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `notebook_created_at_idx` ON `notebook_entries` (`created_at`);

--> statement-breakpoint
-- ─── Performance indexes: tasks ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS `tasks_status_idx` ON `tasks` (`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `tasks_related_entity_idx` ON `tasks` (`related_entity_type`, `related_entity_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `tasks_updated_at_idx` ON `tasks` (`updated_at`);

--> statement-breakpoint
-- ─── Performance indexes: drafts ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS `drafts_status_idx` ON `drafts` (`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `drafts_company_idx` ON `drafts` (`company_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `drafts_updated_at_idx` ON `drafts` (`updated_at`);
