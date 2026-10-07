CREATE TABLE "text_translations" (
	"owner_id" text NOT NULL,
	"hash" text NOT NULL,
	"language" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "text_translations_owner_id_hash_language_pk" PRIMARY KEY("owner_id","hash","language")
);
--> statement-breakpoint
ALTER TABLE "text_translations" ADD CONSTRAINT "text_translations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;