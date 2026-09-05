DO $$ BEGIN
 CREATE TYPE "public"."statut_intervention" AS ENUM('planifiee', 'en_route', 'sur_site', 'en_cours', 'realisee', 'echouee', 'reportee', 'annulee');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."type_evenement" AS ENUM('changement_statut', 'note', 'checkin', 'checkout', 'retard');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "intervention_evenements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"intervention_id" uuid NOT NULL,
	"type" "type_evenement" NOT NULL,
	"ancien_statut" "statut_intervention",
	"nouveau_statut" "statut_intervention",
	"commentaire" text,
	"localisation" text,
	"operateur_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "interventions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matching_id" uuid NOT NULL,
	"statut" "statut_intervention" DEFAULT 'planifiee' NOT NULL,
	"date_planifiee" timestamp with time zone,
	"creneau_fin" timestamp with time zone,
	"date_debut" timestamp with time zone,
	"date_fin" timestamp with time zone,
	"checkin_at" timestamp with time zone,
	"checkout_at" timestamp with time zone,
	"localisation_checkin" text,
	"preuve" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interventions_matching_id_unique" UNIQUE("matching_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "intervention_evenements" ADD CONSTRAINT "intervention_evenements_intervention_id_interventions_id_fk" FOREIGN KEY ("intervention_id") REFERENCES "public"."interventions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "intervention_evenements" ADD CONSTRAINT "intervention_evenements_operateur_id_profiles_id_fk" FOREIGN KEY ("operateur_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "interventions" ADD CONSTRAINT "interventions_matching_id_matchings_id_fk" FOREIGN KEY ("matching_id") REFERENCES "public"."matchings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
