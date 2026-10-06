CREATE TABLE "interest_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"developer_id" text NOT NULL,
	"notified" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interest_events" ADD CONSTRAINT "interest_events_company_id_users_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interest_events" ADD CONSTRAINT "interest_events_developer_id_users_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interest_events_company_created_at_idx" ON "interest_events" USING btree ("company_id","created_at");