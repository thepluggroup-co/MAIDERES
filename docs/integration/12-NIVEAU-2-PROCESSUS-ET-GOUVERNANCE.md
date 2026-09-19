# 12 — Niveau 2 : Processus, acteurs, règles et gouvernance

**Statut : premier jet, à réviser après chaque décision terrain.**
Dernière mise à jour : 17 septembre 2026.

## Pourquoi ce document

La note de vision de MAIDERES décrit trois niveaux : (1) une personne joue le
rôle de plateforme, (2) le processus est documenté — acteurs, règles,
profils, scénarios, responsabilités —, (3) la plateforme numérique
automatise ce processus. Ce document est le niveau 2. **Il décrit ce qui
existe réellement dans le système aujourd'hui, pas la version cible.** Ce
qui est provisoire est marqué comme tel ; ce qui est une vraie décision
validée est marqué comme tel. Ne pas mélanger les deux est le seul but de
ce document.

Constat de départ, à ne pas perdre de vue en le lisant : **le système
décrit ci-dessous a déjà atteint le niveau 3 sur le plan technique
(plateforme automatisée), sans qu'aucun vrai client, prestataire ou
demande n'y soit encore passé.** Ce document décrit une machine qui tourne
à vide. La priorité qui suit ce document n'est pas d'ajouter une
fonctionnalité de plus : c'est de faire entrer les premières vraies
personnes dedans.

## 1. Les acteurs et leurs profils réels

Le système distingue quatre rôles (`role` : `admin`, `superviseur`,
`operateur`, `apprenant`). Les trois premiers sont le staff MAIDERES ; le
quatrième — nommé `apprenant` dans la base pour des raisons historiques
(héritage du fork TAFDIL-ERP, jamais renommé) — désigne tout utilisateur
non-staff, qu'il soit client ou prestataire. Ce qui distingue un client
d'un prestataire n'est pas le rôle mais l'existence d'une ligne associée
dans la table `clients` ou dans la table `prestataires`.

- **Staff (admin / superviseur / opérateur)** — console ERP
  (`maideres-erp.vercel.app`). Peut voir et agir sur tout : dispatcher une
  demande vers un prestataire, valider ou suspendre un compte prestataire,
  suivre toutes les interventions, gérer les catégories de service.
- **Prestataire** — espace pro (`maidere-connect.vercel.app/pro`). Auto-
  inscription libre, mais **démarre au statut `en_attente`, invisible du
  public, jusqu'à validation par le staff** (`PATCH /prestataires/:id/statut`).
  Une fois `actif` : publie ses offres, reçoit des propositions de mission,
  les accepte ou refuse, pilote sa propre intervention de bout en bout
  (check-in, statuts, check-out, clôture), répond aux avis clients.
- **Client** — espace client (`maidere-connect.vercel.app/espace`).
  Auto-inscription libre, actif immédiatement. Peut décrire un besoin
  générique (dispatché ensuite par le staff), ou sélectionner directement
  une offre précise sur la fiche d'un prestataire (le système propose
  alors ce prestataire automatiquement, sans dispatch manuel — le
  prestataire garde la main pour accepter/refuser). Suit sa demande, laisse
  un avis une fois la mission terminée.
- **Système** (automatisé, sans intervention humaine) : crée la ligne de
  suivi d'intervention à l'acceptation d'un matching ; notifie par SMS à
  chaque étape (proposition, acceptation, fin de mission, avis reçu) ;
  calcule le reversement prestataire à la clôture réussie d'une mission.

## 2. Le parcours réel d'une demande, état par état

**Demande** (`demande_statut`) : `nouvelle` → `en_traitement` →
`matchee` → `en_cours` → `realisee` (ou `annulee` à tout moment).

**Matching** (`matching_statut`) : `propose` → `accepte` (ou `refuse`) →
`realise` (ou `echoue`). Deux façons d'arriver à `propose` :

1. **Dispatch staff** (parcours d'origine) : le client décrit un besoin
   générique ; un opérateur choisit un prestataire et crée la proposition
   manuellement.
2. **Sélection directe** (ajoutée depuis) : le client choisit une offre
   précise sur une fiche prestataire publique ; le système crée la
   proposition automatiquement vers ce prestataire, sans dispatch staff.

Dans les deux cas, **le prestataire garde toujours la décision finale**
(accepter/refuser) — la sélection directe raccourcit le chemin, elle ne
retire aucun contrôle à personne.

**Intervention** (`statut_intervention`, créée uniquement à l'acceptation
d'un matching — pas avant) : `planifiee` → `en_route` → `sur_site` →
`en_cours` → `realisee` (ou `echouee`), avec `reportee` et `annulee`
possibles à plusieurs étapes. La clôture d'un matching (réussie ou non)
ferme aussi l'intervention liée et déclenche, si réussie, le calcul du
reversement prestataire.

**Avis** : possible côté client une fois le matching `realise`. Le
prestataire peut répondre à un avis reçu.

## 3. Qui décide quoi, aujourd'hui

| Décision | Qui | Comment |
|---|---|---|
| Activer un prestataire | Staff uniquement | `PATCH /prestataires/:id/statut` |
| Choisir un prestataire pour une demande générique | Staff (opérateur) | Dispatch manuel |
| Choisir un prestataire via une offre précise | Client | Sélection directe |
| Accepter/refuser une mission proposée | Prestataire uniquement | Toujours, quel que soit le chemin d'origine |
| Faire avancer le statut d'une intervention | Prestataire (ou staff) | Check-in/statuts/check-out |
| Clore une mission (réussie/échouée) | Prestataire (ou staff) | Déclenche le reversement si réussie |
| Ajouter/modifier une catégorie de service | Staff uniquement | Écran "Paramètres Métier" |

## 4. Décidé vs provisoire — à ne pas confondre

**Décisions confirmées** (au 17/09/2026) :
- Modèle économique : **commission**, maintenu pour l'instant.
- Gouvernance du dépôt de code : le travail se fait sur les branches
  `integration/*` ; `main` sera le point de bascule au passage en
  production. Tant que ce choix tient, toute nouvelle fonctionnalité doit
  partir de l'intégration à jour, pas de `main`.

**Provisoire, en attente de la descente de terrain** :
- Taux de commission (15 %) : **une valeur par défaut**, jamais validée
  par un prestataire réel.
- Les 13 catégories de service actuelles : **un point de départ pour
  tester**, aucune n'a encore reçu de demande réelle, aucune n'a de
  preuve de pertinence.
- Modèle par souscription : non implémenté du tout dans le système —
  si l'expérimentation devait finalement le préférer à la commission, une
  vraie partie du système de reversement serait à repenser.

## 5. Ce qui manque pour que ce document mérite pleinement son nom

Au 17 septembre 2026 : **zéro donnée réelle** — aucun vrai client, aucun
vrai prestataire, aucune vraie demande n'est encore passée par ce système.
Ce document décrit un processus outillé, pas un processus vécu. Il ne
deviendra un vrai "niveau 2" que lorsque les sections 3 et 4 ci-dessus
auront été corrigées à partir de ce qui se sera réellement passé sur le
terrain — pas avant.

## 6. Prochaine étape concrète

Un pilote réel, minuscule, sur une seule catégorie : quelques prestataires
réellement activés (le filtre `en_attente` → `actif` existe déjà), quelques
clients réels, un parcours complet observé jusqu'au bout (demande →
intervention → clôture → avis). Pas de nouvelle fonctionnalité tant que
ce test n'a pas eu lieu au moins une fois.
