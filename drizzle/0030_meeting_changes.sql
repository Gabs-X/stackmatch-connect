ALTER TABLE "meeting_requests" ADD COLUMN "proposed_by" text DEFAULT 'company' NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting_requests" ADD COLUMN "reschedules" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting_requests" ADD COLUMN "canceled_by" text;--> statement-breakpoint
ALTER TABLE "meeting_requests" ADD COLUMN "canceled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "meeting_requests" ADD COLUMN "update_message" text DEFAULT '' NOT NULL;