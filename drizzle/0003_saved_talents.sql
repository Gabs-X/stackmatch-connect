CREATE TABLE "saved_talents" (
	"company_id" text NOT NULL,
	"developer_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_talents_company_id_developer_id_pk" PRIMARY KEY("company_id","developer_id")
);
--> statement-breakpoint
ALTER TABLE "saved_talents" ADD CONSTRAINT "saved_talents_company_id_users_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;