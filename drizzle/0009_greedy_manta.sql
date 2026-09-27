CREATE TABLE `billing_events` (
	`id` text PRIMARY KEY NOT NULL,
	`subscription_id` text NOT NULL,
	`type` text NOT NULL,
	`event_created` integer NOT NULL,
	`payload_hash` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`received_at` integer NOT NULL,
	`processed_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_billing_event_queue` ON `billing_events` (`status`,`next_attempt_at`,`subscription_id`);--> statement-breakpoint
CREATE TABLE `billing_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text,
	`account_epoch` integer,
	`customer_id` text,
	`status` text DEFAULT 'unknown' NOT NULL,
	`period_end` integer DEFAULT 0 NOT NULL,
	`last_entitled_period_end` integer DEFAULT 0 NOT NULL,
	`grace_until` integer DEFAULT 0 NOT NULL,
	`cancel_at_period_end` integer DEFAULT 0 NOT NULL,
	`verified_at` integer DEFAULT 0 NOT NULL,
	`last_event_at` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`lease_token` text,
	`lease_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_billing_subscription_account` ON `billing_subscriptions` (`account_id`,`account_epoch`);