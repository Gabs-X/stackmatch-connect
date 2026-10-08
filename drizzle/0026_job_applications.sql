ALTER TABLE "job_candidates" ADD COLUMN "applied_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "job_candidates" ADD COLUMN "application_message" text DEFAULT '' NOT NULL;