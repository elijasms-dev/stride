CREATE TABLE `accounts` (
	`owner` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`epoch` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`operation_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_account_id_unique` ON `accounts` (`account_id`);--> statement-breakpoint
CREATE TABLE `recovery_operations` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`kind` text NOT NULL,
	`digest` text NOT NULL,
	`epoch` integer NOT NULL,
	`revision` integer NOT NULL,
	`expires_at` text NOT NULL,
	`status` text DEFAULT 'preview' NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
--> statement-breakpoint
ALTER TABLE `athlete_state` ADD `write_token` text DEFAULT '' NOT NULL;
