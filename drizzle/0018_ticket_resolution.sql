ALTER TABLE "support_tickets" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "closed_by" text;--> statement-breakpoint
CREATE INDEX "support_tickets_status_created_at_idx" ON "support_tickets" USING btree ("status","created_at");