CREATE TABLE IF NOT EXISTS "offres" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prestataire_id" uuid NOT NULL,
	"categorie" text NOT NULL,
	"titre" text NOT NULL,
	"description" text,
	"prestations" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"prix" integer NOT NULL,
	"unite_prix" text DEFAULT 'forfait' NOT NULL,
	"delai_heures" integer,
	"publie" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prestataire_id" uuid NOT NULL,
	"offre_id" uuid,
	"titre" text NOT NULL,
	"description" text,
	"remise_pct" numeric(5, 2) NOT NULL,
	"debut" timestamp with time zone DEFAULT now() NOT NULL,
	"fin" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "realisations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prestataire_id" uuid NOT NULL,
	"titre" text,
	"description" text,
	"image_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prestataires" ADD COLUMN "ville" text;--> statement-breakpoint
ALTER TABLE "prestataires" ADD COLUMN "metier" text;--> statement-breakpoint
ALTER TABLE "prestataires" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "prestataires" ADD COLUMN "disponible" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "prestataires" ADD COLUMN "zones_couverture" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "offres" ADD CONSTRAINT "offres_prestataire_id_prestataires_id_fk" FOREIGN KEY ("prestataire_id") REFERENCES "public"."prestataires"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "promotions" ADD CONSTRAINT "promotions_prestataire_id_prestataires_id_fk" FOREIGN KEY ("prestataire_id") REFERENCES "public"."prestataires"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "promotions" ADD CONSTRAINT "promotions_offre_id_offres_id_fk" FOREIGN KEY ("offre_id") REFERENCES "public"."offres"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "realisations" ADD CONSTRAINT "realisations_prestataire_id_prestataires_id_fk" FOREIGN KEY ("prestataire_id") REFERENCES "public"."prestataires"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "offres_prestataire_id_idx" ON "offres" USING btree ("prestataire_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "promotions_prestataire_id_idx" ON "promotions" USING btree ("prestataire_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "realisations_prestataire_id_idx" ON "realisations" USING btree ("prestataire_id");