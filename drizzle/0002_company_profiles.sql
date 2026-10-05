CREATE TABLE "company_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"website" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"about" text DEFAULT '' NOT NULL,
	"contact_name" text NOT NULL,
	"contact_role" text DEFAULT '' NOT NULL,
	"contact_email" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_profiles" ADD CONSTRAINT "company_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;