ALTER TABLE `connections` ADD `activity_check` text;--> statement-breakpoint
ALTER TABLE `connections` ADD `activity_attempt` text;--> statement-breakpoint
ALTER TABLE `connections` ADD `activity_imported_at` text;--> statement-breakpoint
ALTER TABLE `connections` ADD `activity_import_count` integer DEFAULT 0 NOT NULL;
