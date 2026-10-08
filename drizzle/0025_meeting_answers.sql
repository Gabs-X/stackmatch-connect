ALTER TABLE "meeting_requests" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting_requests" ADD COLUMN "responded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "meeting_requests" ADD COLUMN "language" text DEFAULT 'pt' NOT NULL;