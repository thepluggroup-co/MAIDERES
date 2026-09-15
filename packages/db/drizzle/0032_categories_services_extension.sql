-- 0032_categories_services_extension.sql
--
-- Extension du catalogue categories_services : les 5 catégories initiales
-- (Coiffure, Taxi, Onglerie, Carte SIM, Ménage) sont conservées telles
-- quelles ; 8 nouvelles catégories sont ajoutées, portant le total à 13.
-- Idempotent (ON CONFLICT DO NOTHING sur id) — rejouable sans dupliquer.
-- Les mêmes ids sont utilisés dans packages/db/src/seed.ts (environnement
-- dev/local) pour rester cohérent entre seed et migration.

BEGIN;

INSERT INTO categories_services (id, libelle, actif) VALUES
  ('2a81d073-2c5c-4552-ad94-efb65125df84', 'Plomberie',               true),
  ('e087848e-9c9f-44f0-9709-ca9389004f06', 'Bricolage et rénovation', true),
  ('2137cb2e-9afe-4f17-b552-3440e34a7fef', 'Shopping',                true),
  ('613e7e83-b3d7-4a92-bc20-5dcf0855df5a', 'Restauration',            true),
  ('81fc49e4-2eb5-4ab5-aac5-3ac6106494b4', 'Hébergement',             true),
  ('850fdc8f-c087-492b-bce6-b93aeff4a74c', 'Transport',               true),
  ('a402db16-db85-4459-a025-b4d1579a8d02', 'Immobilier',              true),
  ('0fb8981b-64b3-4250-8ac5-3dfbfceef2fd', 'Couture',                 true)
ON CONFLICT (id) DO NOTHING;

COMMIT;
