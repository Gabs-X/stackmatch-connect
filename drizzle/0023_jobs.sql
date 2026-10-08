CREATE TABLE "job_candidates" (
	"job_id" text NOT NULL,
	"developer_id" text NOT NULL,
	"stage" text NOT NULL,
	"stage_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_candidates_job_id_developer_id_pk" PRIMARY KEY("job_id","developer_id")
);
--> statement-breakpoint
CREATE TABLE "job_skills" (
	"job_id" text NOT NULL,
	"skill_id" integer NOT NULL,
	"required" boolean NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "job_skills_job_id_skill_id_pk" PRIMARY KEY("job_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"seniority" text[] DEFAULT '{}' NOT NULL,
	"work_modes" text[] DEFAULT '{}' NOT NULL,
	"hiring_types" text[] DEFAULT '{}' NOT NULL,
	"availability" text[] DEFAULT '{}' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"compensation_min" integer,
	"compensation_max" integer,
	"compensation_period" text DEFAULT 'month' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_candidates" ADD CONSTRAINT "job_candidates_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_candidates" ADD CONSTRAINT "job_candidates_developer_id_users_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_skills" ADD CONSTRAINT "job_skills_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_skills" ADD CONSTRAINT "job_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_users_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_candidates_developer_id_idx" ON "job_candidates" USING btree ("developer_id");--> statement-breakpoint
CREATE INDEX "jobs_company_id_idx" ON "jobs" USING btree ("company_id");