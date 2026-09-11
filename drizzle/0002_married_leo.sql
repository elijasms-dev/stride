PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_deliveries` (
	`owner` text NOT NULL,
	`workout_id` text NOT NULL,
	`provider_athlete_id` text DEFAULT '__legacy__' NOT NULL,
	`connection_generation` text,
	`attempt_id` text,
	`create_outcome` text DEFAULT 'unknown' NOT NULL,
	`attempted_start_local` text,
	`prescription_hash` text,
	`version` integer NOT NULL,
	`remote_id` text,
	`status` text NOT NULL,
	`message` text,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner`, `provider_athlete_id`, `workout_id`)
);
--> statement-breakpoint
INSERT INTO `__new_deliveries` (owner,workout_id,version,remote_id,status,message,updated_at) SELECT owner,workout_id,version,remote_id,'stale','Legacy receipt retained. Reconnect and reconcile before sending.',updated_at FROM deliveries;
--> statement-breakpoint
DROP TABLE `deliveries`;--> statement-breakpoint
ALTER TABLE `__new_deliveries` RENAME TO `deliveries`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_delivery_owner_status` ON `deliveries` (`owner`,`status`);--> statement-breakpoint
ALTER TABLE `connections` ADD `provider_athlete_id` text DEFAULT '__legacy__' NOT NULL;--> statement-breakpoint
ALTER TABLE `connections` ADD `generation` text DEFAULT '__legacy__' NOT NULL;
