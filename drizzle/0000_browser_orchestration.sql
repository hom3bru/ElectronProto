-- Browser Orchestration subsystem migration
-- Adds machine browser contexts, run tracking, sync links, site profiles, and training data tables.

CREATE TABLE IF NOT EXISTS `browser_contexts` (
  `id` text PRIMARY KEY NOT NULL,
  `browser_type` text NOT NULL,
  `context_key` text NOT NULL,
  `visibility` text NOT NULL,
  `session_partition` text,
  `status` text NOT NULL DEFAULT 'idle',
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `last_activity_at` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `browser_contexts_status_idx` ON `browser_contexts` (`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `browser_contexts_type_idx` ON `browser_contexts` (`browser_type`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `browser_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `run_type` text NOT NULL,
  `mode` text NOT NULL,
  `leader_browser_type` text NOT NULL,
  `leader_context_id` text,
  `follower_browser_type` text,
  `follower_context_id` text,
  `watch_enabled` integer DEFAULT false,
  `watch_surface_type` text,
  `status` text NOT NULL DEFAULT 'pending',
  `linked_company_id` text,
  `linked_task_id` text,
  `linked_thread_id` text,
  `linked_message_id` text,
  `target_url` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `started_at` integer,
  `completed_at` integer,
  `error` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `browser_runs_status_idx` ON `browser_runs` (`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `browser_runs_leader_context_idx` ON `browser_runs` (`leader_context_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `browser_runs_run_type_idx` ON `browser_runs` (`run_type`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `browser_runs_created_at_idx` ON `browser_runs` (`created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `browser_run_events` (
  `id` text PRIMARY KEY NOT NULL,
  `browser_run_id` text NOT NULL REFERENCES `browser_runs`(`id`),
  `event_type` text NOT NULL,
  `context_id` text,
  `actor_type` text NOT NULL,
  `payload_json` text,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `browser_run_events_run_id_idx` ON `browser_run_events` (`browser_run_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `browser_run_events_created_at_idx` ON `browser_run_events` (`created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `browser_sync_links` (
  `id` text PRIMARY KEY NOT NULL,
  `browser_run_id` text NOT NULL REFERENCES `browser_runs`(`id`),
  `source_context_id` text NOT NULL,
  `target_context_id` text NOT NULL,
  `sync_direction` text NOT NULL,
  `sync_granularity` text NOT NULL,
  `sync_status` text NOT NULL DEFAULT 'active',
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `browser_sync_links_run_id_idx` ON `browser_sync_links` (`browser_run_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `site_profiles` (
  `id` text PRIMARY KEY NOT NULL,
  `domain` text NOT NULL UNIQUE,
  `site_type` text,
  `trust_status` text NOT NULL DEFAULT 'unreviewed',
  `approved_by_user` integer DEFAULT false,
  `notes` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `site_profiles_trust_status_idx` ON `site_profiles` (`trust_status`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `field_profiles` (
  `id` text PRIMARY KEY NOT NULL,
  `site_profile_id` text REFERENCES `site_profiles`(`id`),
  `field_name` text NOT NULL,
  `description` text,
  `detection_type` text NOT NULL,
  `keyword_rules_json` text,
  `selector_rules_json` text,
  `extraction_hints_json` text,
  `confidence_rules_json` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `field_profiles_site_profile_idx` ON `field_profiles` (`site_profile_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `automation_recipes` (
  `id` text PRIMARY KEY NOT NULL,
  `site_profile_id` text REFERENCES `site_profiles`(`id`),
  `name` text NOT NULL,
  `description` text,
  `trigger_type` text NOT NULL,
  `steps_json` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `automation_recipes_site_profile_idx` ON `automation_recipes` (`site_profile_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `browser_annotations` (
  `id` text PRIMARY KEY NOT NULL,
  `site_profile_id` text REFERENCES `site_profiles`(`id`),
  `browser_run_id` text REFERENCES `browser_runs`(`id`),
  `page_url` text NOT NULL,
  `annotation_type` text NOT NULL,
  `selection_data_json` text NOT NULL,
  `note` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `browser_annotations_page_url_idx` ON `browser_annotations` (`page_url`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `browser_annotations_site_profile_idx` ON `browser_annotations` (`site_profile_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `browser_action_buttons` (
  `id` text PRIMARY KEY NOT NULL,
  `site_profile_id` text REFERENCES `site_profiles`(`id`),
  `label` text NOT NULL,
  `description` text,
  `action_type` text NOT NULL,
  `action_payload_json` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `browser_action_buttons_site_profile_idx` ON `browser_action_buttons` (`site_profile_id`);
