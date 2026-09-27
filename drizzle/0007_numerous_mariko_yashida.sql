CREATE TABLE `journal_mutations` (
	`owner` text NOT NULL,
	`epoch` integer NOT NULL,
	`id` text NOT NULL,
	`request_hash` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`owner`, `epoch`, `id`)
);
