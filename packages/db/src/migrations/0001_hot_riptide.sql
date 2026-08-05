CREATE TABLE `category` (
	`id` text PRIMARY KEY NOT NULL,
	`map_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`map_id`) REFERENCES `map`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `category_map_name_uidx` ON `category` (`map_id`,`name`);--> statement-breakpoint
CREATE TABLE `map` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `map_member` (
	`id` text PRIMARY KEY NOT NULL,
	`map_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`map_id`) REFERENCES `map`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `map_member_map_user_uidx` ON `map_member` (`map_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `place` (
	`id` text PRIMARY KEY NOT NULL,
	`map_id` text NOT NULL,
	`google_place_id` text NOT NULL,
	`resolution_status` text DEFAULT 'resolved' NOT NULL,
	`confidence` text,
	`latitude` real,
	`longitude` real,
	`coords_cached_at` integer,
	`user_display_name` text,
	`user_formatted_address` text,
	`notes` text,
	`image` text,
	`created_by_user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`map_id`) REFERENCES `map`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `place_map_google_place_uidx` ON `place` (`map_id`,`google_place_id`);--> statement-breakpoint
CREATE TABLE `place_category` (
	`id` text PRIMARY KEY NOT NULL,
	`place_id` text NOT NULL,
	`category_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`place_id`) REFERENCES `place`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `place_category_place_category_uidx` ON `place_category` (`place_id`,`category_id`);--> statement-breakpoint
CREATE TABLE `place_source` (
	`id` text PRIMARY KEY NOT NULL,
	`place_id` text NOT NULL,
	`source_url` text NOT NULL,
	`job_id` text,
	`created_by_user_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`place_id`) REFERENCES `place`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`job_id`) REFERENCES `job`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `place_source_place_url_uidx` ON `place_source` (`place_id`,`source_url`);--> statement-breakpoint
CREATE TABLE `job` (
	`id` text PRIMARY KEY NOT NULL,
	`map_id` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`source_url` text NOT NULL,
	`canonical_source_url` text NOT NULL,
	`share_id` text,
	`status` text DEFAULT 'processing' NOT NULL,
	`stage` text DEFAULT 'queued' NOT NULL,
	`error_message` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`map_id`) REFERENCES `map`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `job_share_id_uidx` ON `job` (`share_id`);--> statement-breakpoint
CREATE INDEX `job_map_id_idx` ON `job` (`map_id`);--> statement-breakpoint
CREATE INDEX `job_map_canonical_creator_idx` ON `job` (`map_id`,`canonical_source_url`,`created_by_user_id`);--> statement-breakpoint
CREATE TABLE `job_candidate` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`google_place_id` text,
	`display_name` text,
	`formatted_address` text,
	`latitude` real,
	`longitude` real,
	`confidence` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `job`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `job_candidate_job_id_idx` ON `job_candidate` (`job_id`);