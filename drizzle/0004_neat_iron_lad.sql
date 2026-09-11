CREATE TABLE `request_limits` (
	`owner` text NOT NULL,
	`bucket` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`reset_at` integer NOT NULL,
	PRIMARY KEY(`owner`, `bucket`)
);
