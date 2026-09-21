import { describe, it, expect } from 'vitest'
import { calculerPaliers } from '@maideres/contracts'

describe('calculerPaliers (dossier prestataire provisoire)', () => {
  const base = { nom: 'Salon', telephone: '+237690000000', categories: ['c1'], metier_id: null, quartier: 'Akwa', ville: null, zones_couverture: null }
  it('palier 1 exige une offre', () => {
    expect(calculerPaliers(base, 0, null).palier1.manquants).toContain('Au moins une offre avec prix')
    expect(calculerPaliers(base, 1, null).palier_atteint).toBe(1)
  })
  it('un palier supérieur ne compte pas si un précédent manque', () => {
    const d = { mm_operateur: 'mtn' as const, mm_numero: '1', mm_titulaire: 'x', statut_fiscal: 'x', commission_convenue_at: 'now' }
    const r = calculerPaliers(base, 1, d)
    expect(r.palier3.complet).toBe(true)
    expect(r.palier_atteint).toBe(1)
  })
  it('palier 2 : adresse « Mobile » accepte l\u2019absence d\u2019adresse ; RCCM/NIU requis seulement pour une entreprise', () => {
    const d = { identite_type: 'cni' as const, doc_identite_path: 'a/identite.pdf', identite_verifiee_at: 'now', adresse_mobile: true,
      realisations_verifiees: true, references_contacts: [{ nom: 'A', telephone: '123456' }], conditions_acceptees_at: 'now' }
    expect(calculerPaliers(base, 1, d).palier2.complet).toBe(true)
    const ent = calculerPaliers(base, 1, { ...d, est_entreprise: true }).palier2
    expect(ent.manquants).toEqual(['RCCM (PDF)', 'NIU (PDF)'])
  })
})
