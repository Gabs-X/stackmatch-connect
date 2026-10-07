ALTER TYPE "public"."email_code_purpose" ADD VALUE 'CHANGE_EMAIL';--> statement-breakpoint
ALTER TABLE "email_codes" ADD COLUMN "target_email" text;