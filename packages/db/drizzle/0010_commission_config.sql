DO $$ BEGIN
 CREATE TYPE "public"."type_commission" AS ENUM('pourcentage', 'montant_fixe');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "commission_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"categorie_id" uuid,
	"type" "type_commission" DEFAULT 'pourcentage' NOT NULL,
	"valeur" numeric(10, 2) NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prestataires" ALTER COLUMN "taux_commission" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "prestataires" ALTER COLUMN "taux_commission" DROP NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commission_config" ADD CONSTRAINT "commission_config_categorie_id_categories_services_id_fk" FOREIGN KEY ("categorie_id") REFERENCES "public"."categories_services"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
