/**
 * prestataires-paliers.test.ts
 *
 * Dossier prestataire en 3 paliers (0035, PROVISOIRE) : réservé au staff,
 * palier atteint calculé (jamais stocké), un palier exige les précédents,
 * et rien de tout cela ne bloque l'activation d'un prestataire.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import type { FakeSupabase } from './fakeSupabase'
import { authHeaders } from './helpers'

vi.mock('@maideres/db/supabase', async () => {
  const { createFakeSupabase } = await import('./fakeSupabase')
  const client = createFakeSupabase()
  ;(globalThis as unknown as { __fakeDb: FakeSupabase }).__fakeDb = client
  return { supabase: client, supabaseAdmin: client }
})

import app from '../app'

const fakeDb = () => (globalThis as unknown as { __fakeDb: FakeSupabase }).__fakeDb

const STAFF_USER_ID  = 'c1111111-1111-4111-8111-111111111111'
const PRESTA_USER_ID = 'c2222222-2222-4222-8222-222222222222'
const PRESTA_ID      = 'c3333333-3333-4333-8333-333333333333'
const PRESTA_VIDE_ID = 'c4444444-4444-4444-8444-444444444444'
const CATEGORIE_ID   = 'c5555555-5555-4555-8555-555555555555'

beforeAll(() => {
  const db = fakeDb()
  db.seed('profiles', [
    { id: STAFF_USER_ID, email: 'staff@maideres.cm', nom: 'Staff', role: 'operateur', actif: true },
    { id: PRESTA_USER_ID, email: 'presta@maideres.cm', nom: 'Presta', role: 'apprenant', actif: true },
  ])
  db.seed('prestataires', [
    { id: PRESTA_ID, profile_id: PRESTA_USER_ID, nom: 'Salon Akwa', telephone: '+237690000020', categories: [CATEGORIE_ID], quartier: 'Akwa', statut: 'en_attente' },
    { id: PRESTA_VIDE_ID, profile_id: STAFF_USER_ID, nom: 'Presta vide', telephone: '+237690000021', categories: [], quartier: null, statut: 'en_attente' },
  ])
  db.seed('offres', [
    { id: 'c6666666-6666-4666-8666-666666666666', prestataire_id: PRESTA_ID, categorie: 'Beauté', titre: 'Coupe', prix: 3000, unite_prix: 'forfait', publie: true, prestations: [] },
  ])
})

const get = (id: string, role: Parameters<typeof authHeaders>[0], uid: string) =>
  app.request(`/api/prestataires/${id}/paliers`, { headers: authHeaders(role, uid) })
const put = (id: string, body: unknown, role: Parameters<typeof authHeaders>[0], uid: string) =>
  app.request(`/api/prestataires/${id}/paliers`, { method: 'PUT', headers: authHeaders(role, uid), body: JSON.stringify(body) })

const PDF = (taille = 64) => new File([new TextEncoder().encode('%PDF-1.4\n' + 'x'.repeat(taille))], 'piece.pdf', { type: 'application/pdf' })
const upload = (id: string, type: string, fichier: Blob | null, role: Parameters<typeof authHeaders>[0] = 'operateur', uid = STAFF_USER_ID) => {
  const form = new FormData()
  if (fichier) form.set('file', fichier, 'piece.pdf')
  const { 'Content-Type': _ct, ...entetes } = authHeaders(role, uid)
  return app.request(`/api/prestataires/${id}/paliers/documents/${type}`, { method: 'POST', headers: entetes, body: form })
}

type Reponse = { data: { dossier: Record<string, unknown> | null; paliers: { palier_atteint: number; palier1: { complet: boolean; manquants: string[] }; palier2: { complet: boolean; manquants: string[] }; palier3: { complet: boolean; manquants: string[] } } } }

describe('Dossier prestataire — 3 paliers (provisoire)', () => {
  it('palier 1 calculé depuis prestataire + offres, sans dossier stocké', async () => {
    const res = await get(PRESTA_ID, 'operateur', STAFF_USER_ID)
    expect(res.status).toBe(200)
    const { data } = await res.json() as Reponse
    expect(data.dossier).toBeNull()
    expect(data.paliers.palier1.complet).toBe(true)
    expect(data.paliers.palier_atteint).toBe(1)
    expect(data.paliers.palier2.manquants).toContain("Pièce d'identité (PDF)")
  })

  it('un prestataire incomplet liste ce qui manque au palier 1', async () => {
    const { data } = await (await get(PRESTA_VIDE_ID, 'operateur', STAFF_USER_ID)).json() as Reponse
    expect(data.paliers.palier_atteint).toBe(0)
    expect(data.paliers.palier1.manquants).toEqual(expect.arrayContaining(['Catégorie de service', 'Au moins une offre avec prix']))
  })

  it('palier 2 complet : PDF identité déposé + vérifié + adresse → trace de vérification', async () => {
    expect((await upload(PRESTA_ID, 'identite', PDF())).status).toBe(201)
    const res = await put(PRESTA_ID, {
      identite_type: 'cni', identite_verifiee: true,
      adresse_activite: 'Akwa, face pharmacie', realisations_verifiees: true,
      references_contacts: [{ nom: 'Cliente Rose', telephone: '+237690111111' }],
      conditions_acceptees: true,
    }, 'operateur', STAFF_USER_ID)
    expect(res.status).toBe(200)
    const { data } = await res.json() as Reponse
    expect(data.paliers.palier2.complet).toBe(true)
    expect(data.paliers.palier_atteint).toBe(2)
    expect(data.dossier?.verifie_par).toBe(STAFF_USER_ID)
    expect(data.dossier?.verifie_at).toBeTruthy()
  })

  it('palier 3 complet → palier atteint = 3', async () => {
    const res = await put(PRESTA_ID, {
      mm_operateur: 'mtn', mm_numero: '+237670000000', mm_titulaire: 'Salon Akwa',
      statut_fiscal: 'Impôt libératoire', commission_convenue: true,
    }, 'operateur', STAFF_USER_ID)
    const { data } = await res.json() as Reponse
    expect(data.paliers.palier_atteint).toBe(3)
  })

  it('décocher une vérification efface la trace et fait retomber le palier', async () => {
    const res = await put(PRESTA_ID, { identite_verifiee: false }, 'operateur', STAFF_USER_ID)
    const { data } = await res.json() as Reponse
    expect(data.paliers.palier2.complet).toBe(false)
    expect(data.dossier?.verifie_par).toBeNull()
    // Le palier 3 est rempli mais ne compte pas sans le palier 2 : pas de trou.
    expect(data.paliers.palier3.complet).toBe(true)
    expect(data.paliers.palier_atteint).toBe(1)
  })

  it("ne bloque pas l'activation : le statut reste modifiable par le staff sans palier 2", async () => {
    const res = await app.request(`/api/prestataires/${PRESTA_VIDE_ID}/statut`, {
      method: 'PATCH', headers: authHeaders('operateur', STAFF_USER_ID), body: JSON.stringify({ statut: 'actif' }),
    })
    expect(res.status).toBe(200)
  })

  it('refuse un prestataire (non-staff), en lecture comme en écriture', async () => {
    expect((await get(PRESTA_ID, 'apprenant', PRESTA_USER_ID)).status).toBe(403)
    expect((await put(PRESTA_ID, { identite_verifiee: true }, 'apprenant', PRESTA_USER_ID)).status).toBe(403)
  })

  it('valide les entrées (opérateur Mobile Money inconnu → 400)', async () => {
    expect((await put(PRESTA_ID, { mm_operateur: 'wave' }, 'operateur', STAFF_USER_ID)).status).toBe(400)
  })
})

describe('Palier 2 — pièces PDF, adresse « Mobile », entreprise (0038)', () => {
  const ID = 'c7777777-7777-4777-8777-777777777777'
  beforeAll(() => {
    fakeDb().seed('prestataires', [
      { id: ID, profile_id: PRESTA_USER_ID, nom: 'Taxi Moto Douala', telephone: '+237690000030', categories: [CATEGORIE_ID], ville: 'Douala', statut: 'en_attente' },
    ])
    fakeDb().seed('offres', [
      { id: 'c8888888-8888-4888-8888-888888888888', prestataire_id: ID, categorie: 'Transport', titre: 'Course', prix: 1000, unite_prix: 'forfait', publie: true, prestations: [] },
    ])
  })

  it("« Mobile » remplace l'adresse d'activité", async () => {
    const avant = await (await get(ID, 'operateur', STAFF_USER_ID)).json() as Reponse
    expect(avant.data.paliers.palier2.manquants.join(' ')).toMatch(/Adresse d'activité \(ou « Mobile »\)/)
    const { data } = await (await put(ID, { adresse_mobile: true }, 'operateur', STAFF_USER_ID)).json() as Reponse
    expect(data.paliers.palier2.manquants.join(' ')).not.toMatch(/Adresse/)
  })

  it('dépôt PDF : stocké en privé, chemin et date enregistrés', async () => {
    const res = await upload(ID, 'identite', PDF())
    expect(res.status).toBe(201)
    const { data } = await res.json() as Reponse
    expect(data.dossier?.doc_identite_path).toBe(`${ID}/identite.pdf`)
    expect(data.dossier?.doc_identite_at).toBeTruthy()
    expect((fakeDb() as unknown as { dumpObjets: () => string[] }).dumpObjets()).toContain(`prestataire-documents/${ID}/identite.pdf`)
    expect(data.paliers.palier2.manquants).not.toContain("Pièce d'identité (PDF)")
  })

  it('RCCM et NIU ne sont requis que pour une entreprise', async () => {
    const indiv = await (await get(ID, 'operateur', STAFF_USER_ID)).json() as Reponse
    expect(indiv.data.paliers.palier2.manquants).not.toContain('RCCM (PDF)')
    const { data } = await (await put(ID, { est_entreprise: true }, 'operateur', STAFF_USER_ID)).json() as Reponse
    expect(data.paliers.palier2.manquants).toEqual(expect.arrayContaining(['RCCM (PDF)', 'NIU (PDF)']))
    expect((await upload(ID, 'rccm', PDF())).status).toBe(201)
    const fin = await (await upload(ID, 'niu', PDF())).json() as Reponse
    expect(fin.data.paliers.palier2.manquants).not.toEqual(expect.arrayContaining(['RCCM (PDF)']))
    expect(fin.data.paliers.palier2.manquants).not.toEqual(expect.arrayContaining(['NIU (PDF)']))
  })

  it('consultation par URL signée de courte durée', async () => {
    const res = await app.request(`/api/prestataires/${ID}/paliers/documents/identite`, { headers: authHeaders('operateur', STAFF_USER_ID) })
    expect(res.status).toBe(200)
    const { data } = await res.json() as { data: { url: string; expire_dans: number } }
    expect(data.url).toContain(`${ID}/identite.pdf`)
    expect(data.expire_dans).toBeLessThanOrEqual(300)
  })

  it('refuse un fichier qui n\u2019est pas un PDF (même avec le bon type MIME déclaré)', async () => {
    const faux = new File([new TextEncoder().encode('<html>pas un pdf</html>')], 'piece.pdf', { type: 'application/pdf' })
    expect((await upload(ID, 'niu', faux)).status).toBe(415)
  })

  it('refuse un fichier trop gros, vide, absent ou un type inconnu', async () => {
    expect((await upload(ID, 'niu', PDF(5 * 1024 * 1024 + 10))).status).toBe(413)
    expect((await upload(ID, 'niu', new File([], 'vide.pdf'))).status).toBe(400)
    expect((await upload(ID, 'niu', null)).status).toBe(400)
    expect((await upload(ID, 'passeport-secret', PDF())).status).toBe(400)
  })

  it('refuse un non-staff (dépôt, consultation, suppression)', async () => {
    expect((await upload(ID, 'identite', PDF(), 'apprenant', PRESTA_USER_ID)).status).toBe(403)
    const h = authHeaders('apprenant', PRESTA_USER_ID)
    expect((await app.request(`/api/prestataires/${ID}/paliers/documents/identite`, { headers: h })).status).toBe(403)
    expect((await app.request(`/api/prestataires/${ID}/paliers/documents/identite`, { method: 'DELETE', headers: h })).status).toBe(403)
  })

  it('suppression : objet retiré, champs vidés, le palier retombe', async () => {
    const res = await app.request(`/api/prestataires/${ID}/paliers/documents/identite`, { method: 'DELETE', headers: authHeaders('operateur', STAFF_USER_ID) })
    expect(res.status).toBe(200)
    const { data } = await res.json() as Reponse
    expect(data.dossier?.doc_identite_path).toBeNull()
    expect(data.paliers.palier2.manquants).toContain("Pièce d'identité (PDF)")
    expect((fakeDb() as unknown as { dumpObjets: () => string[] }).dumpObjets()).not.toContain(`prestataire-documents/${ID}/identite.pdf`)
  })
})
