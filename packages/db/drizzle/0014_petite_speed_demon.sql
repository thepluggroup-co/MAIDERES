ALTER TABLE "demandes" ADD COLUMN "niveau_urgence" "niveau_urgence" DEFAULT 'urgent' NOT NULL;--> statement-breakpoint
ALTER TABLE "demandes" ADD COLUMN "date_souhaitee" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "demandes" ADD COLUMN "delai_cible" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "demandes_delai_cible_idx" ON "demandes" USING btree ("delai_cible");