// Données de démonstration servies en mode aperçu (voir preview-mode.ts) —
// permet de visualiser le front-end sans backend ni session Supabase.
// Intercepté par api-client.ts avant tout appel réseau.
import type { Demande } from '@/hooks/useDemandes'
import type { Client } from '@/hooks/useClients'
import type { Prestataire } from '@/hooks/usePrestataires'
import type { Matching } from '@/hooks/useMatchings'
import type { CategorieService } from '@/hooks/useCategories'

function isoAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString()
}
// Négatif = dans le passé (delai_cible dépassé, pour exercer le badge "en retard").
function isoIn(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString()
}

let nextId = 1000
function genId(prefix: string): string {
  return `${prefix}-${nextId++}`
}

// ── Seed ─────────────────────────────────────────────────────────────────────

export const categories: CategorieService[] = [
  { id: 'cat-coiffure', libelle: 'Coiffure',    actif: true },
  { id: 'cat-taxi',     libelle: 'Taxi',        actif: true },
  { id: 'cat-onglerie', libelle: 'Onglerie',    actif: true },
  { id: 'cat-sim',      libelle: 'Carte SIM',   actif: true },
  { id: 'cat-menage',   libelle: 'Ménage',      actif: true },
  { id: 'cat-plomberie',libelle: 'Plomberie',   actif: true },
]

export const clients: Client[] = [
  { id: 'cli-1', profile_id: 'prof-c1', nom: 'Ariane Ngo Bell',   telephone: '+237 677 12 34 56', quartier: 'Bonapriso',    type_client: 'particulier',  niu: null,          whatsapp: '+237 677 12 34 56', email: null,                       source: 'whatsapp' },
  { id: 'cli-2', profile_id: 'prof-c2', nom: 'Jean-Paul Eyoum',   telephone: '+237 690 22 11 09', quartier: 'Akwa',         type_client: 'particulier',  niu: null,          whatsapp: null,                 email: 'jp.eyoum@example.cm',      source: 'ecommerce' },
  { id: 'cli-3', profile_id: 'prof-c3', nom: 'Fatima Oumarou',    telephone: '+237 655 88 77 66', quartier: 'Bonamoussadi', type_client: 'particulier',  niu: null,          whatsapp: '+237 655 88 77 66', email: null,                       source: 'appel' },
  { id: 'cli-4', profile_id: 'prof-c4', nom: 'Serge Kamdem',      telephone: '+237 699 33 44 55', quartier: 'Deido',        type_client: 'entreprise',   niu: 'M071523018745B', whatsapp: '+237 699 33 44 55', email: 'contact@kamdemsarl.cm',   source: 'referral' },
  { id: 'cli-5', profile_id: 'prof-c5', nom: 'Line Mbarga',       telephone: '+237 674 45 12 78', quartier: 'Makepe',       type_client: 'particulier',  niu: null,          whatsapp: null,                 email: null,                       source: 'whatsapp' },
]

export const prestataires: Prestataire[] = [
  { id: 'pre-1', profile_id: 'prof-p1', nom: 'Salon Belle Douala', telephone: '+237 677 90 10 20', categories: ['cat-coiffure', 'cat-onglerie'], quartier: 'Bonapriso',   geoloc_lat: 4.0296, geoloc_lng: 9.6931, statut: 'actif',      note_moyenne: '4.6', taux_commission: '15', date_recrutement: isoAgo(2400) },
  { id: 'pre-2', profile_id: 'prof-p2', nom: 'Moto Express Akwa',  telephone: '+237 690 11 22 33', categories: ['cat-taxi'],                          quartier: 'Akwa',        geoloc_lat: 4.0483, geoloc_lng: 9.7043, statut: 'actif',      note_moyenne: '4.2', taux_commission: '10', date_recrutement: isoAgo(1800) },
  { id: 'pre-3', profile_id: 'prof-p3', nom: 'Nails By Fifi',      telephone: '+237 655 44 55 66', categories: ['cat-onglerie'],                      quartier: 'Bonamoussadi',geoloc_lat: 4.0757, geoloc_lng: 9.7433, statut: 'en_attente', note_moyenne: '0.0', taux_commission: '15', date_recrutement: isoAgo(48) },
  { id: 'pre-4', profile_id: 'prof-p4', nom: 'MTN Point Deido',    telephone: '+237 699 66 77 88', categories: ['cat-sim'],                           quartier: 'Deido',       geoloc_lat: 4.0611, geoloc_lng: 9.7079, statut: 'actif',      note_moyenne: '4.8', taux_commission: '5',  date_recrutement: isoAgo(3200) },
  { id: 'pre-5', profile_id: 'prof-p5', nom: 'Clean Home Makepe',  telephone: '+237 674 12 90 34', categories: ['cat-menage'],                        quartier: 'Makepe',      geoloc_lat: 4.0813, geoloc_lng: 9.7521, statut: 'suspendu',   note_moyenne: '3.1', taux_commission: '12', date_recrutement: isoAgo(900) },
  { id: 'pre-6', profile_id: 'prof-p6', nom: 'Plomberie Rapide CM',telephone: '+237 677 55 21 09', categories: ['cat-plomberie'],                     quartier: 'Bonapriso',   geoloc_lat: 4.0301, geoloc_lng: 9.6889, statut: 'actif',      note_moyenne: '4.4', taux_commission: '12', date_recrutement: isoAgo(1500) },
]

export const demandes: Demande[] = [
  { id: 'dem-1', client_id: 'cli-1', categorie_id: 'cat-coiffure', description: 'Tresses box braids pour un mariage samedi',           localisation: 'Bonapriso, Douala',   canal: 'whatsapp', statut: 'matchee',       created_at: isoAgo(30),  niveau_urgence: 'urgent',    date_souhaitee: null,      delai_cible: isoIn(-5) },
  { id: 'dem-2', client_id: 'cli-2', categorie_id: 'cat-taxi',     description: 'Course de Akwa vers l\'aéroport, 3 personnes',        localisation: 'Akwa, Douala',        canal: 'web',       statut: 'realisee',      created_at: isoAgo(72),  niveau_urgence: 'immediate', date_souhaitee: null,      delai_cible: isoAgo(70) },
  { id: 'dem-3', client_id: 'cli-3', categorie_id: 'cat-onglerie', description: 'Pose de vernis semi-permanent',                        localisation: 'Bonamoussadi, Douala',canal: 'manuel',    statut: 'nouvelle',      created_at: isoAgo(3),   niveau_urgence: 'urgent',    date_souhaitee: null,      delai_cible: isoIn(21) },
  { id: 'dem-4', client_id: 'cli-4', categorie_id: 'cat-sim',      description: 'Nouvelle carte SIM MTN avec portabilité du numéro',    localisation: 'Deido, Douala',       canal: 'whatsapp',  statut: 'en_traitement', created_at: isoAgo(10),  niveau_urgence: 'planifie',  date_souhaitee: isoIn(48), delai_cible: isoIn(48) },
  { id: 'dem-5', client_id: 'cli-5', categorie_id: 'cat-menage',   description: 'Ménage complet appartement 3 pièces',                  localisation: 'Makepe, Douala',      canal: 'web',       statut: 'annulee',       created_at: isoAgo(150), niveau_urgence: 'urgent',    date_souhaitee: null,      delai_cible: isoAgo(120) },
  { id: 'dem-6', client_id: 'cli-1', categorie_id: 'cat-plomberie',description: 'Fuite sous l\'évier de la cuisine',                    localisation: 'Bonapriso, Douala',   canal: 'manuel',    statut: 'realisee',      created_at: isoAgo(200), niveau_urgence: 'immediate', date_souhaitee: null,      delai_cible: isoAgo(195) },
  { id: 'dem-7', client_id: 'cli-3', categorie_id: 'cat-coiffure', description: 'Coupe et brushing avant entretien d\'embauche',        localisation: 'Bonamoussadi, Douala',canal: 'web',       statut: 'nouvelle',      created_at: isoAgo(1),   niveau_urgence: 'immediate', date_souhaitee: null,      delai_cible: isoIn(-1) },
]

export const matchings: Matching[] = [
  { id: 'mat-1', demande_id: 'dem-1', prestataire_id: 'pre-1', operateur_id: 'op-1', statut: 'accepte', motif_echec: null, proposed_at: isoAgo(28), closed_at: null },
  { id: 'mat-2', demande_id: 'dem-2', prestataire_id: 'pre-2', operateur_id: 'op-1', statut: 'realise', motif_echec: null, proposed_at: isoAgo(70), closed_at: isoAgo(68) },
  { id: 'mat-3', demande_id: 'dem-6', prestataire_id: 'pre-6', operateur_id: 'op-1', statut: 'realise', motif_echec: null, proposed_at: isoAgo(199), closed_at: isoAgo(195) },
  { id: 'mat-4', demande_id: 'dem-5', prestataire_id: 'pre-5', operateur_id: 'op-1', statut: 'echoue',  motif_echec: 'Client injoignable', proposed_at: isoAgo(149), closed_at: isoAgo(145) },
]

// ── Requêtes ─────────────────────────────────────────────────────────────────

function parseQuery(path: string): { base: string; params: URLSearchParams } {
  const [base, qs] = path.split('?')
  return { base, params: new URLSearchParams(qs ?? '') }
}

// Retourne `undefined` si la route n'est pas reconnue — l'appelant décide alors
// de retomber sur un vrai appel réseau plutôt que d'échouer silencieusement.
export function mockRequest(method: string, path: string, body?: unknown): { data: unknown } | undefined {
  const { base, params } = parseQuery(path)
  const segs = base.split('/').filter(Boolean) // ['api', 'demandes', ':id', ...]

  // /api/categories_services
  if (method === 'GET' && base === '/api/categories_services') {
    return { data: categories }
  }

  // /api/clients
  if (segs[0] === 'api' && segs[1] === 'clients' && segs.length === 2) {
    if (method === 'GET') {
      const quartier = params.get('quartier')
      return { data: quartier ? clients.filter((c) => c.quartier === quartier) : clients }
    }
    if (method === 'POST') {
      const input = body as {
        nom: string; telephone: string; quartier?: string | null
        type_client?: Client['type_client']; niu?: string | null
        whatsapp?: string | null; email?: string | null; source?: Client['source']
      }
      const created: Client = {
        id: genId('cli'), profile_id: genId('prof'),
        nom: input.nom, telephone: input.telephone, quartier: input.quartier ?? null,
        type_client: input.type_client ?? 'particulier', niu: input.niu ?? null,
        whatsapp: input.whatsapp ?? null, email: input.email ?? null,
        source: input.source ?? 'whatsapp',
      }
      clients.push(created)
      return { data: created }
    }
  }

  // /api/prestataires
  if (segs[0] === 'api' && segs[1] === 'prestataires') {
    if (segs.length === 2) {
      if (method === 'GET') {
        let result = prestataires
        const categorie = params.get('categorie')
        const quartier  = params.get('quartier')
        const statut    = params.get('statut')
        if (categorie) result = result.filter((p) => p.categories.includes(categorie))
        if (quartier)  result = result.filter((p) => p.quartier === quartier)
        if (statut)    result = result.filter((p) => p.statut === statut)
        return { data: result }
      }
      if (method === 'POST') {
        const input = body as { nom: string; telephone: string; categories: string[]; quartier?: string | null }
        const created: Prestataire = {
          id: genId('pre'), profile_id: genId('prof'),
          nom: input.nom, telephone: input.telephone, categories: input.categories,
          quartier: input.quartier ?? null, geoloc_lat: null, geoloc_lng: null,
          statut: 'en_attente', note_moyenne: '0.0', taux_commission: '15',
          date_recrutement: new Date().toISOString(),
        }
        prestataires.push(created)
        return { data: created }
      }
    }
    if (segs.length === 4 && segs[3] === 'statut' && method === 'PATCH') {
      const p = prestataires.find((pp) => pp.id === segs[2])
      if (!p) return { data: null }
      p.statut = (body as { statut: Prestataire['statut'] }).statut
      return { data: p }
    }
  }

  // /api/demandes
  if (segs[0] === 'api' && segs[1] === 'demandes') {
    if (segs.length === 2) {
      if (method === 'GET') {
        let result = demandes
        const statut    = params.get('statut')
        const categorie = params.get('categorie')
        const canal     = params.get('canal')
        const urgence   = params.get('urgence')
        if (statut)    result = result.filter((d) => d.statut === statut)
        if (categorie) result = result.filter((d) => d.categorie_id === categorie)
        if (canal)     result = result.filter((d) => d.canal === canal)
        if (urgence)   result = result.filter((d) => d.niveau_urgence === urgence)
        return { data: [...result].sort((a, b) => b.created_at.localeCompare(a.created_at)) }
      }
      if (method === 'POST') {
        const input = body as {
          client_id?: string; categorie_id: string; description: string
          localisation?: string | null; canal: Demande['canal']
          niveau_urgence: Demande['niveau_urgence']; date_souhaitee?: string | null
        }
        // Approximation du trigger DB (0015_demandes_delai_cible_trigger.sql) pour l'aperçu :
        // planifie → date_souhaitee telle quelle, sinon délai par niveau d'urgence.
        const DELAI_HEURES: Record<Demande['niveau_urgence'], number> = { immediate: 2, urgent: 24, planifie: 72 }
        const delaiCible = input.niveau_urgence === 'planifie' && input.date_souhaitee
          ? input.date_souhaitee
          : new Date(Date.now() + DELAI_HEURES[input.niveau_urgence] * 3_600_000).toISOString()
        const created: Demande = {
          id: genId('dem'), client_id: input.client_id ?? '', categorie_id: input.categorie_id,
          description: input.description, localisation: input.localisation ?? null,
          canal: input.canal, statut: 'nouvelle', created_at: new Date().toISOString(),
          niveau_urgence: input.niveau_urgence, date_souhaitee: input.date_souhaitee ?? null,
          delai_cible: delaiCible,
        }
        demandes.push(created)
        return { data: created }
      }
    }
    if (segs.length === 3 && method === 'GET') {
      const d = demandes.find((dd) => dd.id === segs[2])
      return { data: d ?? null }
    }
    if (segs.length === 4 && segs[3] === 'statut' && method === 'PATCH') {
      const d = demandes.find((dd) => dd.id === segs[2])
      if (!d) return { data: null }
      d.statut = (body as { statut: Demande['statut'] }).statut
      return { data: d }
    }
  }

  // /api/matchings
  if (segs[0] === 'api' && segs[1] === 'matchings') {
    if (segs.length === 2) {
      if (method === 'GET') {
        let result = matchings
        const demandeId = params.get('demande_id')
        const statut    = params.get('statut')
        if (demandeId) result = result.filter((m) => m.demande_id === demandeId)
        if (statut)    result = result.filter((m) => m.statut === statut)
        return { data: result }
      }
      if (method === 'POST') {
        const input = body as { demande_id: string; prestataire_id: string }
        const created: Matching = {
          id: genId('mat'), demande_id: input.demande_id, prestataire_id: input.prestataire_id,
          operateur_id: 'op-preview', statut: 'propose', motif_echec: null,
          proposed_at: new Date().toISOString(), closed_at: null,
        }
        matchings.push(created)
        const d = demandes.find((dd) => dd.id === input.demande_id)
        if (d && d.statut === 'nouvelle') d.statut = 'en_traitement'
        return { data: created }
      }
    }
    if (segs.length === 4 && method === 'PATCH') {
      const m = matchings.find((mm) => mm.id === segs[2])
      if (!m) return { data: null }
      const action = segs[3]
      if (action === 'accepter') {
        m.statut = 'accepte'
      } else if (action === 'refuser') {
        m.statut = 'refuse'
        m.motif_echec = (body as { motif_echec?: string | null }).motif_echec ?? null
      } else if (action === 'cloturer') {
        const input = body as { issue: 'realise' | 'echoue'; motif_echec?: string | null }
        m.statut = input.issue
        m.motif_echec = input.motif_echec ?? null
        m.closed_at = new Date().toISOString()
        if (input.issue === 'realise') {
          const d = demandes.find((dd) => dd.id === m.demande_id)
          if (d) d.statut = 'realisee'
        }
      }
      return { data: m }
    }
  }

  return undefined
}
