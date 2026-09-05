DO $$ BEGIN
 CREATE TYPE "public"."source_client" AS ENUM('whatsapp', 'appel', 'ecommerce', 'referral');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."type_client" AS ENUM('particulier', 'entreprise', 'organisation');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "type_client" "type_client" DEFAULT 'particulier' NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "niu" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "whatsapp" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "source" "source_client" DEFAULT 'whatsapp' NOT NULL;