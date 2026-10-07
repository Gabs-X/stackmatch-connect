CREATE TABLE "email_sends" (
	"id" serial PRIMARY KEY NOT NULL,
	"ip" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "email_sends_ip_created_at_idx" ON "email_sends" USING btree ("ip","created_at");