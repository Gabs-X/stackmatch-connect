CREATE TABLE "meeting_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"developer_id" text NOT NULL,
	"developer_name" text NOT NULL,
	"date" date NOT NULL,
	"time" text NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"company_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"reply_to_email" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meeting_requests" ADD CONSTRAINT "meeting_requests_company_id_users_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meeting_requests_company_id_idx" ON "meeting_requests" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "meeting_requests_developer_id_idx" ON "meeting_requests" USING btree ("developer_id");