# CLAUDE.md — Contexte MAIDERES

## Projet
MAIDERES est une marketplace d'intermédiation de services multi-prestataires
(Cameroun, Douala). Un client formule un besoin (ex : coiffure, taxi, onglerie,
carte SIM) ; la plateforme identifie un prestataire de son réseau selon la
catégorie et la localisation, et organise la mise en relation. Un opérateur
humain peut faire le matching manuellement ; la plateforme l'outille et
l'automatise progressivement.

## Deux surfaces
- Vitrine publique + espaces client/prestataire (apps/shop, Next.js).
- Console 360 back-office pour opérateurs/admin (apps/web, React/Vite).

## Socle réutilisé (ex-ERP Tafdil, propriété du fondateur)
On réutilise l'INFRA, jamais le domaine métier de l'ancien ERP.
Garder : auth Supabase + OTP-SMS, NotchPay (paiement), Africa's Talking (SMS),
packages/ui, packages/ai, config monorepo pnpm/turbo, CI/CD, middleware api.
Jeté (Phase 0, complété) : production, machines, paie/RH, stocks, comptabilité,
IoT, sécurité/EPI, equipements, catalogue e-commerce mono-vendeur.

## Stack
pnpm 10 + turbo. Node 20+. Supabase/Postgres + Drizzle. apps: api, web, shop.
apps/mobile et apps/desktop gelés jusqu'au post-MVP (non touchés, non
dépendants du domaine métier retiré).

## Règles de travail
- Migrations SQL versionnées, jamais de schéma modifié à la main.
- RLS Supabase activée par rôle (admin, opérateur, prestataire, client) —
  à mettre en place en Phase 1. Le système RBAC legacy (rbac_roles/modules
  hérité de Tafdil) reste en place tel quel jusque-là, voir le rapport Phase 0.
- Tests exigés à chaque phase touchant l'API ou le schéma.
- Modèle économique NON figé : taux de commission et logique de captation
  restent paramétrables (commission vs abonnement non tranché).
- Français pour l'UI. Devise FCFA.

## État d'avancement
Voir `MAIDERES-PLAN-CLAUDE-CODE.md` pour le plan complet par phases.
Phase 0 (nettoyage + rebranding) complétée — voir le rapport de fin de phase
pour le détail des suppressions et les points en suspens.
