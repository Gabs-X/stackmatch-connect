ALTER TABLE "jobs" ADD COLUMN "listed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "jobs_listed_idx" ON "jobs" USING btree ("listed","status","created_at");