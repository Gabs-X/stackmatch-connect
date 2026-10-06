CREATE TABLE "login_failures" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "login_failures_key_created_at_idx" ON "login_failures" USING btree ("key","created_at");