CREATE TABLE "interests" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"developer_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interests" ADD CONSTRAINT "interests_company_id_users_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "interests_company_developer_idx" ON "interests" USING btree ("company_id","developer_id");--> statement-breakpoint
CREATE INDEX "interests_developer_id_idx" ON "interests" USING btree ("developer_id");