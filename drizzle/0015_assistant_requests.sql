CREATE TABLE "assistant_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"ip" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "assistant_requests_ip_created_at_idx" ON "assistant_requests" USING btree ("ip","created_at");