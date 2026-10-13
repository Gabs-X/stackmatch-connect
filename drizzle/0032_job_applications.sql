CREATE TABLE "job_applications" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text,
	"company_id" text NOT NULL,
	"developer_id" text NOT NULL,
	"job" jsonb NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"language" text DEFAULT 'pt' NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "job_candidate_events" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text,
	"company_id" text NOT NULL,
	"developer_id" text NOT NULL,
	"application_id" text,
	"kind" text NOT NULL,
	"from_stage" text,
	"to_stage" text,
	"actor" text NOT NULL,
	"visible_to_developer" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_candidates" ADD COLUMN "note" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_company_id_users_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_developer_id_users_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_candidate_events" ADD CONSTRAINT "job_candidate_events_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_candidate_events" ADD CONSTRAINT "job_candidate_events_company_id_users_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_candidate_events" ADD CONSTRAINT "job_candidate_events_developer_id_users_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_candidate_events" ADD CONSTRAINT "job_candidate_events_application_id_job_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."job_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "job_applications_job_developer_idx" ON "job_applications" USING btree ("job_id","developer_id");--> statement-breakpoint
CREATE INDEX "job_applications_developer_applied_idx" ON "job_applications" USING btree ("developer_id","applied_at","id");--> statement-breakpoint
CREATE INDEX "job_applications_company_id_idx" ON "job_applications" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "job_candidate_events_job_developer_idx" ON "job_candidate_events" USING btree ("job_id","developer_id","created_at");--> statement-breakpoint
CREATE INDEX "job_candidate_events_application_idx" ON "job_candidate_events" USING btree ("application_id");--> statement-breakpoint
-- Existing offers become applications, with the job as it is now and the status their stage gives.
INSERT INTO "job_applications" ("id", "job_id", "company_id", "developer_id", "job", "message", "status", "applied_at", "updated_at")
SELECT
	gen_random_uuid()::text,
	c."job_id",
	j."company_id",
	c."developer_id",
	jsonb_build_object(
		'title', j."title",
		'description', j."description",
		'requiredSkills', COALESCE((SELECT jsonb_agg(s."name" ORDER BY js."position") FROM "job_skills" js JOIN "skills" s ON s."id" = js."skill_id" WHERE js."job_id" = j."id" AND js."required"), '[]'::jsonb),
		'desiredSkills', COALESCE((SELECT jsonb_agg(s."name" ORDER BY js."position") FROM "job_skills" js JOIN "skills" s ON s."id" = js."skill_id" WHERE js."job_id" = j."id" AND NOT js."required"), '[]'::jsonb),
		'seniority', to_jsonb(j."seniority"),
		'workModes', to_jsonb(j."work_modes"),
		'hiringTypes', to_jsonb(j."hiring_types"),
		'availability', to_jsonb(j."availability"),
		'location', j."location",
		'compensationMin', j."compensation_min",
		'compensationMax', j."compensation_max",
		'compensationPeriod', j."compensation_period"
	),
	c."application_message",
	CASE WHEN c."stage" IN ('contacted', 'meeting') THEN 'in_progress' ELSE 'submitted' END,
	c."applied_at",
	c."applied_at"
FROM "job_candidates" c
JOIN "jobs" j ON j."id" = c."job_id"
WHERE c."applied_at" IS NOT NULL;--> statement-breakpoint
INSERT INTO "job_candidate_events" ("id", "job_id", "company_id", "developer_id", "application_id", "kind", "actor", "visible_to_developer", "created_at")
SELECT gen_random_uuid()::text, a."job_id", a."company_id", a."developer_id", a."id", 'applied', 'developer', true, a."applied_at"
FROM "job_applications" a;
