CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`details` text,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`originalPath` text NOT NULL,
	`sourceSrtPath` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`targetLanguages` text NOT NULL,
	`completedAt` integer,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updatedAt` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE `logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`jobId` integer NOT NULL,
	`message` text,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `system_credits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`available_units` real DEFAULT 0 NOT NULL,
	`updatedAt` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE `translatedFiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`jobId` integer NOT NULL,
	`language` text NOT NULL,
	`path` text NOT NULL,
	`subtitle_duration_seconds` integer NOT NULL,
	`credits_used` real NOT NULL,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `auditLogs_action_idx` ON `audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `auditLogs_actor_idx` ON `audit_logs` (`actor`);--> statement-breakpoint
CREATE INDEX `auditLogs_createdAt_idx` ON `audit_logs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `jobs_status_idx` ON `jobs` (`status`);--> statement-breakpoint
CREATE INDEX `jobs_createdAt_idx` ON `jobs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `translatedFiles_jobId_idx` ON `translatedFiles` (`jobId`);