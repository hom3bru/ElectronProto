CREATE TABLE `browser_tabs` (
	`id` text PRIMARY KEY NOT NULL,
	`session_partition` text NOT NULL,
	`url` text NOT NULL,
	`title` text,
	`loading_state` integer DEFAULT false,
	`pinned_flag` integer DEFAULT false,
	`active` integer DEFAULT false,
	`tab_order` integer DEFAULT 0,
	`last_focused_timestamp` integer,
	`linked_company_id` text,
	`linked_inbox_item_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`linked_company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`linked_inbox_item_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`domain` text,
	`hq` text,
	`country` text,
	`sector` text,
	`subsector` text,
	`status` text,
	`qualification_score` real,
	`confidence_score` real,
	`contradiction_flag` integer,
	`website_status` text,
	`lead_stage` text,
	`outreach_state` text,
	`linked_source_count` integer DEFAULT 0,
	`linked_evidence_count` integer DEFAULT 0,
	`last_touched` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text,
	`name` text NOT NULL,
	`email` text,
	`role` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text,
	`contact_id` text,
	`subject` text,
	`body` text,
	`status` text NOT NULL,
	`approval_status` text,
	`blocked_reason` text,
	`linked_inbox_thread_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`sent_at` integer,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`linked_inbox_thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `entity_links` (
	`id` text PRIMARY KEY NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`relationship` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `entity_links_source_idx` ON `entity_links` (`source_type`,`source_id`);--> statement-breakpoint
CREATE INDEX `entity_links_target_idx` ON `entity_links` (`target_type`,`target_id`);--> statement-breakpoint
CREATE TABLE `entity_tags` (
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`entity_type`, `entity_id`, `tag_id`),
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `evidence_fragments` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`company_id` text,
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
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`inbox_message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`browser_tab_id`) REFERENCES `browser_tabs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `labels` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mail_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`credentials` text,
	`is_active` integer DEFAULT true,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mail_accounts_email_unique` ON `mail_accounts` (`email`);--> statement-breakpoint
CREATE TABLE `mail_sync_state` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`last_synced_at` integer,
	`last_history_id` text,
	`sync_status` text DEFAULT 'idle',
	`error_message` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `mail_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mail_sync_state_account_id_unique` ON `mail_sync_state` (`account_id`);--> statement-breakpoint
CREATE TABLE `mailboxes` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`provider_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `mail_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `message_labels` (
	`message_id` text NOT NULL,
	`label_id` text NOT NULL,
	PRIMARY KEY(`message_id`, `label_id`),
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`label_id`) REFERENCES `labels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text,
	`thread_id` text,
	`mailbox_id` text,
	`from` text NOT NULL,
	`to` text NOT NULL,
	`cc` text,
	`bcc` text,
	`subject` text,
	`snippet` text,
	`plain_text_body` text,
	`html_body` text,
	`received_at` integer NOT NULL,
	`read_state` integer DEFAULT false,
	`labels` text,
	`route_status` text,
	`trust_score` real,
	`source_classification` text,
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `messages_provider_id_unique` ON `messages` (`provider_id`);--> statement-breakpoint
CREATE TABLE `notebook_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`related_entity_type` text,
	`related_entity_id` text,
	`entry_type` text NOT NULL,
	`message` text NOT NULL,
	`actor_type` text,
	`actor_name` text,
	`metadata_json` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `source_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text,
	`contact_id` text,
	`platform` text NOT NULL,
	`url` text NOT NULL,
	`handle` text,
	`scraped_data` text,
	`last_scraped_at` integer,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`priority` text NOT NULL,
	`related_entity_type` text,
	`related_entity_id` text,
	`escalation_reason` text,
	`notes` text,
	`recommended_next_action` text,
	`owner` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE TABLE `threads` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text,
	`status` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
