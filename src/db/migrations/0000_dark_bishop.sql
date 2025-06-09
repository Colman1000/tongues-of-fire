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
	`creditsUsed` integer,
	`message` text,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `translatedFiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`jobId` integer NOT NULL,
	`language` text NOT NULL,
	`path` text NOT NULL,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
