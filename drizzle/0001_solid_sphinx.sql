CREATE TABLE `profiles` (
	`owner` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`city` text NOT NULL,
	`units` text NOT NULL,
	`timezone` text NOT NULL,
	`accent` text NOT NULL,
	`updated_at` text NOT NULL
);
