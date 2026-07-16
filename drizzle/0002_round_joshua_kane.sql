CREATE TABLE `claimRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`winnerId` int NOT NULL,
	`winnerName` varchar(200) NOT NULL,
	`status` enum('pending','claimed') NOT NULL DEFAULT 'pending',
	`claimedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `claimRecords_id` PRIMARY KEY(`id`)
);
