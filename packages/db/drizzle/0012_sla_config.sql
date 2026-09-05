DO $$ BEGIN
 CREATE TYPE "public"."niveau_urgence" AS ENUM('immediate', 'urgent', 'planifie');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sla_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"niveau_urgence" "niveau_urgence" NOT NULL,
	"delai_heures" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sla_config_niveau_urgence_unique" UNIQUE("niveau_urgence")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "demandes_categorie_id_idx" ON "demandes" USING btree ("categorie_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "demandes_statut_idx" ON "demandes" USING btree ("statut");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "matchings_demande_id_idx" ON "matchings" USING btree ("demande_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prestataires_categories_gin_idx" ON "prestataires" USING gin ("categories");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prestataires_quartier_idx" ON "prestataires" USING btree ("quartier");