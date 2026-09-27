CREATE TABLE `delivery_jobs` (
	`owner` text NOT NULL,
	`epoch` integer NOT NULL,
	`id` text NOT NULL,
	`workout_id` text NOT NULL,
	`version` integer NOT NULL,
	`action` text NOT NULL,
	`provider_athlete_id` text NOT NULL,
	`connection_generation` text NOT NULL,
	`prescription_hash` text,
	`status` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`available_at` text NOT NULL,
	`lease_token` text,
	`lease_until` text,
	`result` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner`, `epoch`, `id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_delivery_job_intent` ON `delivery_jobs` (`owner`,`epoch`,`connection_generation`,`workout_id`,`version`,`action`);--> statement-breakpoint
CREATE INDEX `idx_delivery_job_due` ON `delivery_jobs` (`owner`,`epoch`,`status`,`available_at`);