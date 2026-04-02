CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`content_id` text,
	`storage_path` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `drafts` ADD `review_queue_state` text;--> statement-breakpoint
ALTER TABLE `drafts` ADD `provenance_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `entity_links_unique` ON `entity_links` (`source_type`,`source_id`,`target_type`,`target_id`,`relationship`);--> statement-breakpoint
ALTER TABLE `messages` DROP COLUMN `labels`;