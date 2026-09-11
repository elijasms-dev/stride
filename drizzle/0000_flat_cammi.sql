CREATE TABLE `athlete_state` (
	`owner` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`data` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `connections` (
	`owner` text PRIMARY KEY NOT NULL,
	`encrypted_key` text NOT NULL,
	`athlete_name` text NOT NULL,
	`connected_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `deliveries` (
	`owner` text NOT NULL,
	`workout_id` text NOT NULL,
	`version` integer NOT NULL,
	`remote_id` text,
	`status` text NOT NULL,
	`message` text,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner`, `workout_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_delivery_owner_status` ON `deliveries` (`owner`,`status`);--> statement-breakpoint
CREATE TABLE `revisions` (
	`owner` text NOT NULL,
	`version` integer NOT NULL,
	`data` text NOT NULL,
	`label` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`owner`, `version`)
);
