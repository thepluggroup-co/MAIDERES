import { useState } from 'react'
import { Chip, TONE } from '@/components/erp'
import { Champ, Txt, Sel } from '@/components/erp-form'
import { Button } from '@/components/ui/button'
import { usePrestatairePaliers, useUpdatePrestatairePaliers } from '@/hooks/usePrestataires'
import type { PaliersReponse } from '@/hooks/usePrestataires'
import { IDENTITE_TYPES, MM_OPERATEURS } from '@maideres/contracts'

/**
 * Dossier prestataire en 3 paliers — VERSION PROVISOIRE (0035).
 * Informatif : ne bloque ni la validation du statut ni le dispatch.
 * Aucun numéro de pièce ni photo n'est saisi : le staff coche « pièce vue ».
 */
const IDENTITE_LABELS: Record<(typeof IDENTITE_TYPES)[number], string> = {
  cni: "Carte nationale d'identité", passeport: 'Passeport', recepisse: 'Récépissé', niu_rccm: 'NIU / RCCM (entreprise)',
}
const MM_LABELS: Record<(typeof MM_OPERATEURS)[number], string> = { mtn: 'MTN Mobile Money', orange: 'Orange Money' }

const cell = (ok: boolean) => (ok ? TONE.succes : TONE.attente)

function Case({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

function Formulaire({ id, data }: { id: string; data: PaliersReponse }) {
  const d = data.dossier
  const maj = useUpdatePrestatairePaliers(id)
  const [identiteType, setIdentiteType] = useState(d?.identite_type ?? '')
  const [identiteVue, setIdentiteVue] = useState(Boolean(d?.identite_verifiee_at))
  const [adresse, setAdresse] = useState(d?.adresse_activite ?? '')
  const [realisations, setRealisations] = useState(d?.realisations_verifiees ?? false)
  const [refs, setRefs] = useState<{ nom: string; telephone: string }[]>([
    d?.references_contacts?.[0] ?? { nom: '', telephone: '' },
    d?.references_contacts?.[1] ?? { nom: '', telephone: '' },
  ])
  const [cgu, setCgu] = useState(Boolean(d?.conditions_acceptees_at))
  const [mmOp, setMmOp] = useState(d?.mm_operateur ?? '')
  const [mmNum, setMmNum] = useState(d?.mm_numero ?? '')
  const [mmTit, setMmTit] = useState(d?.mm_titulaire ?? '')
  const [fiscal, setFiscal] = useState(d?.statut_fiscal ?? '')
  const [commission, setCommission] = useState(Boolean(d?.commission_convenue_at))

  const enregistrer = () =>
    maj.mutate({
      identite_type: (identiteType || null) as (typeof IDENTITE_TYPES)[number] | null,
      identite_verifiee: identiteVue,
      adresse_activite: adresse.trim() || null,
      realisations_verifiees: realisations,
      references_contacts: refs.filter((r) => r.nom.trim() && r.telephone.trim()),
      conditions_acceptees: cgu,
      mm_operateur: (mmOp || null) as (typeof MM_OPERATEURS)[number] | null,
      mm_numero: mmNum.trim() || null,
      mm_titulaire: mmTit.trim() || null,
      statut_fiscal: fiscal.trim() || null,
      commission_convenue: commission,
    })

  return (
    <div className="mt-3 grid gap-5 lg:grid-cols-2">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Palier 2 — Vérifié</p>
        <Champ label="Type de pièce vue">
          <Sel value={identiteType} onChange={(e) => setIdentiteType(e.target.value as typeof identiteType)}>
            <option value="">—</option>
            {IDENTITE_TYPES.map((t) => <option key={t} value={t}>{IDENTITE_LABELS[t]}</option>)}
          </Sel>
        </Champ>
        <Case label="Pièce d'identité vue par le staff (ni numéro ni photo conservés)" checked={identiteVue} onChange={setIdentiteVue} />
        <Champ label="Adresse d'activité / repère"><Txt value={adresse} onChange={(e) => setAdresse(e.target.value)} /></Champ>
        <Case label="Réalisations vérifiées (photos vues)" checked={realisations} onChange={setRealisations} />
        {refs.map((r, i) => (
          <div key={i} className="grid grid-cols-2 gap-2">
            <Champ label={`Référence ${i + 1} — nom`}>
              <Txt value={r.nom} onChange={(e) => setRefs(refs.map((x, j) => (j === i ? { ...x, nom: e.target.value } : x)))} />
            </Champ>
            <Champ label="Téléphone">
              <Txt value={r.telephone} onChange={(e) => setRefs(refs.map((x, j) => (j === i ? { ...x, telephone: e.target.value } : x)))} />
            </Champ>
          </div>
        ))}
        <Case label="Conditions et commission acceptées" checked={cgu} onChange={setCgu} />
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Palier 3 — Paiement</p>
        <Champ label="Opérateur Mobile Money">
          <Sel value={mmOp} onChange={(e) => setMmOp(e.target.value as typeof mmOp)}>
            <option value="">—</option>
            {MM_OPERATEURS.map((o) => <option key={o} value={o}>{MM_LABELS[o]}</option>)}
          </Sel>
        </Champ>
        <Champ label="Numéro Mobile Money"><Txt value={mmNum} onChange={(e) => setMmNum(e.target.value)} inputMode="tel" /></Champ>
        <Champ label="Titulaire du compte"><Txt value={mmTit} onChange={(e) => setMmTit(e.target.value)} /></Champ>
        <Champ label="Statut fiscal"><Txt value={fiscal} onChange={(e) => setFiscal(e.target.value)} /></Champ>
        <Case label="Taux de commission convenu avec le prestataire" checked={commission} onChange={setCommission} />
        <Button size="sm" onClick={enregistrer} disabled={maj.isPending}>
          {maj.isPending ? 'Enregistrement…' : 'Enregistrer le dossier'}
        </Button>
      </div>
    </div>
  )
}

export function PaliersPanel({ prestataireId }: { prestataireId: string }) {
  const { data, isLoading } = usePrestatairePaliers(prestataireId)
  if (isLoading || !data) return <p className="mt-4 text-sm text-muted-foreground">Chargement du dossier…</p>
  const { paliers } = data
  const items = [
    { n: 1, label: 'Matchable', s: paliers.palier1 },
    { n: 2, label: 'Vérifié', s: paliers.palier2 },
    { n: 3, label: 'Paiement', s: paliers.palier3 },
  ]
  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Dossier prestataire (provisoire)
        </span>
        {items.map(({ n, label, s }) => (
          <Chip key={n} tone={cell(s.complet)}>{`Palier ${n} · ${label} ${s.complet ? '✓' : '…'}`}</Chip>
        ))}
      </div>
      <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
        {items.filter(({ s }) => !s.complet).map(({ n, s }) => (
          <li key={n}>Palier {n} — manque : {s.manquants.join(', ')}</li>
        ))}
      </ul>
      <Formulaire key={prestataireId} id={prestataireId} data={data} />
    </div>
  )
}
