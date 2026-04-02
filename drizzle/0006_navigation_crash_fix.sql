DROP TABLE `attachments`;--> statement-breakpoint
DROP TABLE `entity_tags`;--> statement-breakpoint
DROP TABLE `source_profiles`;--> statement-breakpoint
DROP TABLE `tags`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_browser_tabs` (
	`id` text PRIMARY KEY NOT NULL,
	`session_partition` text NOT NULL,
	`url` text NOT NULL,
	`title` text,
	`loading_state` integer DEFAULT false,
	`pinned_flag` integer DEFAULT false,
	`active` integer DEFAULT false,
	`tab_order` integer DEFAULT 0,
	`last_focused_timestamp` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_browser_tabs`("id", "session_partition", "url", "title", "loading_state", "pinned_flag", "active", "tab_order", "last_focused_timestamp", "created_at", "updated_at") SELECT "id", "session_partition", "url", "title", "loading_state", "pinned_flag", "active", "tab_order", "last_focused_timestamp", "created_at", "updated_at" FROM `browser_tabs`;--> statement-breakpoint
DROP TABLE `browser_tabs`;--> statement-breakpoint
ALTER TABLE `__new_browser_tabs` RENAME TO `browser_tabs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text,
	`subject` text,
	`body` text,
	`status` text NOT NULL,
	`approval_status` text,
	`review_queue_state` text,
	`blocked_reason` text,
	`provenance_id` text,
	`linked_inbox_thread_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`sent_at` integer,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`linked_inbox_thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_drafts`("id", "contact_id", "subject", "body", "status", "approval_status", "review_queue_state", "blocked_reason", "provenance_id", "linked_inbox_thread_id", "created_at", "updated_at", "sent_at") SELECT "id", "contact_id", "subject", "body", "status", "approval_status", "review_queue_state", "blocked_reason", "provenance_id", "linked_inbox_thread_id", "created_at", "updated_at", "sent_at" FROM `drafts`;--> statement-breakpoint
DROP TABLE `drafts`;--> statement-breakpoint
ALTER TABLE `__new_drafts` RENAME TO `drafts`;--> statement-breakpoint
CREATE INDEX `drafts_status_idx` ON `drafts` (`status`);--> statement-breakpoint
CREATE INDEX `drafts_updated_at_idx` ON `drafts` (`updated_at`);--> statement-breakpoint
CREATE TABLE `__new_evidence_fragments` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`claim_summary` text NOT NULL,
	`quote` text,
	`url` text,
	`inbox_message_id` text,
	`browser_tab_id` text,
	`timestamp` integer NOT NULL,
	`confidence` real,
	`contradiction_flag` integer DEFAULT false,
	`extracted_by` text,
	`reviewer_status` text,
	FOREIGN KEY (`inbox_message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`browser_tab_id`) REFERENCES `browser_tabs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_evidence_fragments`("id", "type", "source_type", "source_id", "claim_summary", "quote", "url", "inbox_message_id", "browser_tab_id", "timestamp", "confidence", "contradiction_flag", "extracted_by", "reviewer_status") SELECT "id", "type", "source_type", "source_id", "claim_summary", "quote", "url", "inbox_message_id", "browser_tab_id", "timestamp", "confidence", "contradiction_flag", "extracted_by", "reviewer_status" FROM `evidence_fragments`;--> statement-breakpoint
DROP TABLE `evidence_fragments`;--> statement-breakpoint
ALTER TABLE `__new_evidence_fragments` RENAME TO `evidence_fragments`;--> statement-breakpoint
CREATE INDEX `evidence_reviewer_status_idx` ON `evidence_fragments` (`reviewer_status`);--> statement-breakpoint
CREATE INDEX `evidence_contradiction_idx` ON `evidence_fragments` (`contradiction_flag`);--> statement-breakpoint
CREATE INDEX `evidence_source_idx` ON `evidence_fragments` (`source_type`,`source_id`);--> statement-breakpoint
CREATE INDEX `evidence_timestamp_idx` ON `evidence_fragments` (`timestamp`);--> statement-breakpoint
DROP INDEX `entity_links_unique`;--> statement-breakpoint
ALTER TABLE `entity_links` ADD `link_type` text NOT NULL;--> statement-breakpoint
ALTER TABLE `entity_links` ADD `metadata_json` text;--> statement-breakpoint
CREATE UNIQUE INDEX `entity_links_unique` ON `entity_links` (`source_type`,`source_id`,`target_type`,`target_id`,`link_type`);--> statement-breakpoint
ALTER TABLE `entity_links` DROP COLUMN `relationship`;--> statement-breakpoint
ALTER TABLE `tasks` ADD `blocked_reason` text;--> statement-breakpoint
CREATE INDEX `tasks_status_idx` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `tasks_related_entity_idx` ON `tasks` (`related_entity_type`,`related_entity_id`);--> statement-breakpoint
CREATE INDEX `tasks_updated_at_idx` ON `tasks` (`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `companies_domain_unique` ON `companies` (`domain`);--> statement-breakpoint
CREATE INDEX `companies_domain_idx` ON `companies` (`domain`);--> statement-breakpoint
CREATE INDEX `companies_lead_stage_idx` ON `companies` (`lead_stage`);--> statement-breakpoint
CREATE INDEX `companies_updated_at_idx` ON `companies` (`updated_at`);--> statement-breakpoint
ALTER TABLE `companies` DROP COLUMN `linked_source_count`;--> statement-breakpoint
ALTER TABLE `companies` DROP COLUMN `linked_evidence_count`;--> statement-breakpoint
CREATE INDEX `contacts_company_idx` ON `contacts` (`company_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `contacts_company_email_unique` ON `contacts` (`company_id`,`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `labels_name_unique` ON `labels` (`name`);--> statement-breakpoint
CREATE INDEX `mailboxes_account_idx` ON `mailboxes` (`account_id`);--> statement-breakpoint
CREATE INDEX `message_labels_message_idx` ON `message_labels` (`message_id`);--> statement-breakpoint
CREATE INDEX `messages_thread_idx` ON `messages` (`thread_id`);--> statement-breakpoint
CREATE INDEX `messages_received_at_idx` ON `messages` (`received_at`);--> statement-breakpoint
CREATE INDEX `messages_read_state_idx` ON `messages` (`read_state`);--> statement-breakpoint
CREATE INDEX `messages_route_status_idx` ON `messages` (`route_status`);--> statement-breakpoint
CREATE INDEX `notebook_parent_entity_idx` ON `notebook_entries` (`parent_entity_type`,`parent_entity_id`);--> statement-breakpoint
CREATE INDEX `notebook_related_entity_idx` ON `notebook_entries` (`related_entity_type`,`related_entity_id`);--> statement-breakpoint
CREATE INDEX `notebook_entry_type_idx` ON `notebook_entries` (`entry_type`);--> statement-breakpoint
CREATE INDEX `notebook_created_at_idx` ON `notebook_entries` (`created_at`);--> statement-breakpoint
CREATE INDEX `threads_status_idx` ON `threads` (`status`);