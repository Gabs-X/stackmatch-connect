CREATE TYPE "public"."email_code_purpose" AS ENUM('VERIFY_EMAIL', 'RESET_PASSWORD');--> statement-breakpoint
CREATE TABLE "email_codes" (
	"user_id" text NOT NULL,
	"purpose" "email_code_purpose" NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_codes_user_id_purpose_pk" PRIMARY KEY("user_id","purpose")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_codes" ADD CONSTRAINT "email_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Accounts created before e-mail verification existed count as verified.
UPDATE "users" SET "email_verified_at" = "created_at" WHERE "email_verified_at" IS NULL;
