CREATE TABLE "translation_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "translation_requests" ADD CONSTRAINT "translation_requests_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "translation_requests_owner_id_created_at_idx" ON "translation_requests" USING btree ("owner_id","created_at");