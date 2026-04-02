ALTER TABLE `messages` ADD `remote_message_id` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `in_reply_to` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `references_header` text;