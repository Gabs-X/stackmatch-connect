ALTER TABLE "interests" ADD COLUMN "job_id" text;--> statement-breakpoint
ALTER TABLE "interests" ADD COLUMN "job" jsonb;--> statement-breakpoint
ALTER TABLE "meeting_requests" ADD COLUMN "job_id" text;--> statement-breakpoint
ALTER TABLE "meeting_requests" ADD COLUMN "job" jsonb;--> statement-breakpoint
ALTER TABLE "interests" ADD CONSTRAINT "interests_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_requests" ADD CONSTRAINT "meeting_requests_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;