DO $$ BEGIN
 CREATE TYPE "public"."demande_canal" AS ENUM('web', 'whatsapp', 'manuel');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."demande_statut" AS ENUM('nouvelle', 'en_traitement', 'matchee', 'realisee', 'annulee');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."matching_statut" AS ENUM('propose', 'accepte', 'refuse', 'realise', 'echoue');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."notif_canal" AS ENUM('sms', 'whatsapp', 'email');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."notif_statut" AS ENUM('en_attente', 'envoye', 'echoue');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."paiement_statut" AS ENUM('en_attente', 'paye', 'echoue', 'rembourse');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."prestataire_statut" AS ENUM('en_attente', 'actif', 'suspendu');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."reversement_statut" AS ENUM('en_attente', 'traite', 'echoue');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."role" AS ENUM('admin', 'superviseur', 'operateur', 'apprenant');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "avis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matching_id" uuid NOT NULL,
	"note" integer NOT NULL,
	"commentaire" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "avis_matching_id_unique" UNIQUE("matching_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "categories_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"libelle" text NOT NULL,
	"actif" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"nom" text NOT NULL,
	"telephone" text NOT NULL,
	"quartier" text,
	CONSTRAINT "clients_profile_id_unique" UNIQUE("profile_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "demandes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"categorie_id" uuid NOT NULL,
	"description" text NOT NULL,
	"localisation" text,
	"canal" "demande_canal" DEFAULT 'web' NOT NULL,
	"statut" "demande_statut" DEFAULT 'nouvelle' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "matchings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"demande_id" uuid NOT NULL,
	"prestataire_id" uuid NOT NULL,
	"operateur_id" uuid,
	"statut" "matching_statut" DEFAULT 'propose' NOT NULL,
	"motif_echec" text,
	"proposed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cible" uuid NOT NULL,
	"canal" "notif_canal" NOT NULL,
	"contenu" text NOT NULL,
	"statut" "notif_statut" DEFAULT 'en_attente' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prestataires" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"nom" text NOT NULL,
	"telephone" text NOT NULL,
	"categories" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
	"quartier" text,
	"geoloc_lat" double precision,
	"geoloc_lng" double precision,
	"statut" "prestataire_statut" DEFAULT 'en_attente' NOT NULL,
	"note_moyenne" numeric(3, 2) DEFAULT '0' NOT NULL,
	"taux_commission" numeric(5, 2) DEFAULT '0' NOT NULL,
	"date_recrutement" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prestataires_profile_id_unique" UNIQUE("profile_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"nom" text NOT NULL,
	"role" "role" DEFAULT 'operateur' NOT NULL,
	"telephone" text,
	"avatar_url" text,
	"actif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reversements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prestataire_id" uuid NOT NULL,
	"montant" integer NOT NULL,
	"statut" "reversement_statut" DEFAULT 'en_attente' NOT NULL,
	"ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matching_id" uuid NOT NULL,
	"montant_service" integer NOT NULL,
	"commission_taux" numeric(5, 2) DEFAULT '0' NOT NULL,
	"commission_montant" integer DEFAULT 0 NOT NULL,
	"statut_paiement" "paiement_statut" DEFAULT 'en_attente' NOT NULL,
	"ref_notchpay" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_matching_id_unique" UNIQUE("matching_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "avis" ADD CONSTRAINT "avis_matching_id_matchings_id_fk" FOREIGN KEY ("matching_id") REFERENCES "public"."matchings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clients" ADD CONSTRAINT "clients_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "demandes" ADD CONSTRAINT "demandes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "demandes" ADD CONSTRAINT "demandes_categorie_id_categories_services_id_fk" FOREIGN KEY ("categorie_id") REFERENCES "public"."categories_services"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "matchings" ADD CONSTRAINT "matchings_demande_id_demandes_id_fk" FOREIGN KEY ("demande_id") REFERENCES "public"."demandes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "matchings" ADD CONSTRAINT "matchings_prestataire_id_prestataires_id_fk" FOREIGN KEY ("prestataire_id") REFERENCES "public"."prestataires"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "matchings" ADD CONSTRAINT "matchings_operateur_id_profiles_id_fk" FOREIGN KEY ("operateur_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications_log" ADD CONSTRAINT "notifications_log_cible_profiles_id_fk" FOREIGN KEY ("cible") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prestataires" ADD CONSTRAINT "prestataires_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reversements" ADD CONSTRAINT "reversements_prestataire_id_prestataires_id_fk" FOREIGN KEY ("prestataire_id") REFERENCES "public"."prestataires"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_matching_id_matchings_id_fk" FOREIGN KEY ("matching_id") REFERENCES "public"."matchings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
