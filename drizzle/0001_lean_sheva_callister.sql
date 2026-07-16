CREATE TABLE `prizes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `prizes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`status` enum('active','closed') NOT NULL DEFAULT 'active',
	`code` varchar(20) NOT NULL,
	`maxNumber` int NOT NULL DEFAULT 100,
	`ownerOpenId` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`closedAt` timestamp,
	CONSTRAINT `rooms_id` PRIMARY KEY(`id`),
	CONSTRAINT `rooms_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `winners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`prizeId` int NOT NULL,
	`number` int NOT NULL,
	`markedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `winners_id` PRIMARY KEY(`id`)
);
