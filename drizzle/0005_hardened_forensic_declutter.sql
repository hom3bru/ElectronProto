-- 0005_hardened_forensic_declutter.sql

-- 1. Drop unused tables identified in audit
DROP TABLE IF EXISTS `attachments`;
DROP TABLE IF EXISTS `source_profiles`;
DROP TABLE IF EXISTS `tags`;
DROP TABLE IF EXISTS `entity_tags`;
DROP TABLE IF EXISTS `mailboxes`;

-- 2. Harden browser_tabs (Remove linked_company_id)
CREATE TABLE `browser_tabs_new` (
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

INSERT INTO `browser_tabs_new` 
SELECT `id`, `session_partition`, `url`, `title`, `loading_state`, `pinned_flag`, `active`, `tab_order`, `last_focused_timestamp`, `created_at`, `updated_at` 
FROM `browser_tabs`;

DROP TABLE `browser_tabs`;
ALTER TABLE `browser_tabs_new` RENAME TO `browser_tabs`;

-- 3. Harden evidence_fragments (Remove company_id)
CREATE TABLE `evidence_fragments_new` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`claim_summary` text NOT NULL,
	`quote` text,
	`url` text,
	`inbox_message_id` text REFERENCES `messages`(`id`),
	`browser_tab_id` text REFERENCES `browser_tabs`(`id`),
	`timestamp` integer NOT NULL,
	`confidence` real,
	`contradiction_flag` integer DEFAULT false,
	`extracted_by` text,
	`reviewer_status` text
);

INSERT INTO `evidence_fragments_new` 
SELECT `id`, `type`, `source_type`, `source_id`, `claim_summary`, `quote`, `url`, `inbox_message_id`, `browser_tab_id`, `timestamp`, `confidence`, `contradiction_flag`, `extracted_by`, `reviewer_status` 
FROM `evidence_fragments`;

DROP TABLE `evidence_fragments`;
ALTER TABLE `evidence_fragments_new` RENAME TO `evidence_fragments`;

-- 4. Re-apply performance indexes on the new evidence_fragments table
CREATE INDEX `evidence_reviewer_status_idx` ON `evidence_fragments` (`reviewer_status`);
CREATE INDEX `evidence_contradiction_idx` ON `evidence_fragments` (`contradiction_flag`);
CREATE INDEX `evidence_source_idx` ON `evidence_fragments` (`source_type`, `source_id`);
CREATE INDEX `evidence_timestamp_idx` ON `evidence_fragments` (`timestamp`);
