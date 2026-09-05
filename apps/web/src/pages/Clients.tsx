import React, { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ModuleHeader, Section, Table, Td, Vide } from '@/components/erp'
import { Champ, Txt, Sel } from '@/components/erp-form'
import { Button } from '@/components/ui/button'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { StatusBadge } from '@maideres/ui'
import { useClients, useCreateClient } from '@/hooks/useClients'
import type { Client, TypeClient, SourceClient } from '@/hooks/useClients'
import { useDemandes } from '@/hooks/useDemandes'
import { useCategories } from '@/hooks/useCategories'
import { DEMANDE_STATUS_MAP } from './Demandes'

const TYPES_CLIENT: { value: TypeClient; label: string }[] = [
  { value: 'particulier', label: 'Particulier' },
  { value: 'entreprise', label: 'Entreprise' },
  { value: 'organisation', label: 'Organisation' },
]

const SOURCES_CLIENT: { value: SourceClient; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'appel', label: 'Appel' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'referral', label: 'Recommandation' },
]

const libelle = (list: { value: string; label: string }[], v: string | null | undefined) =>
  v ? (list.find((x) => x.value === v)?.label ?? v) : '—'

const requiertNiu = (type: TypeClient) => type === 'entreprise' || type === 'organisation'

// ── Formulaire de création ────────────────────────────────────────────────────

const vide = {
  type_client: 'particulier' as TypeClient,
  nom: '',
  telephone: '',
  whatsapp: '',
  email: '',
  niu: '',
  quartier: '',
  source: 'whatsapp' as SourceClient,
}

function NouveauClientForm({ onCreated }: { onCreated: () => void }) {
  const [f, setF] = useState(vide)
  const creer = useCreateClient()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.nom.trim() || !f.telephone.trim()) {
      toast.error('Nom et téléphone obligatoires')
      return
    }
    if (requiertNiu(f.type_client) && !f.niu.trim()) {
      toast.error('Le NIU est requis pour une entreprise ou une organisation')
      return
    }

    await creer.mutateAsync({
      type_client: f.type_client,
      nom: f.nom.trim(),
      telephone: f.telephone.trim(),
      whatsapp: f.whatsapp.trim() || null,
      email: f.email.trim() || null,
      niu: f.niu.trim() || null,
      quartier: f.quartier.trim() || null,
      source: f.source,
    })
    toast.success('Client enregistré')
    setF(vide)
    // Nudge explicite : voir la note dans Clients() — dans cet environnement,
    // l'invalidation déclenchée par un composant tiers ne suffit pas toujours
    // à re-render la liste tant que le composant qui la lit ne reçoit pas
    // lui-même un changement d'état.
    onCreated()
  }

  return (
    <form className="grid gap-3 md:grid-cols-3" onSubmit={submit}>
      <Champ label="Type">
        <Sel value={f.type_client} onChange={(e) => setF({ ...f, type_client: e.target.value as TypeClient })}>
          {TYPES_CLIENT.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </Sel>
      </Champ>
      <Champ label="Nom / Raison sociale">
        <Txt value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} />
      </Champ>
      <Champ label="Téléphone">
        <Txt value={f.telephone} onChange={(e) => setF({ ...f, telephone: e.target.value })} />
      </Champ>
      <Champ label="WhatsApp">
        <Txt value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} />
      </Champ>
      <Champ label="Email">
        <Txt type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      </Champ>
      <Champ label={requiertNiu(f.type_client) ? 'NIU (obligatoire)' : 'NIU'}>
        <Txt
          value={f.niu}
          onChange={(e) => setF({ ...f, niu: e.target.value })}
          required={requiertNiu(f.type_client)}
        />
      </Champ>
      <Champ label="Quartier">
        <Txt value={f.quartier} onChange={(e) => setF({ ...f, quartier: e.target.value })} />
      </Champ>
      <Champ label="Source">
        <Sel value={f.source} onChange={(e) => setF({ ...f, source: e.target.value as SourceClient })}>
          {SOURCES_CLIENT.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </Sel>
      </Champ>
      <div className="flex items-end">
        <Button type="submit" size="sm" disabled={creer.isPending}>Enregistrer</Button>
      </div>
    </form>
  )
}

// ── Fiche client + historique ─────────────────────────────────────────────────

function FicheClient({ client }: { client: Client }) {
  const { data: demandes = [], isLoading } = useDemandes()
  const { data: categories = [] } = useCategories()
  const catLabel = useMemo(() => new Map(categories.map((c) => [c.id, c.libelle])), [categories])
  const historique = useMemo(
    () => demandes.filter((d) => d.client_id === client.id).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [demandes, client.id],
  )

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-muted-foreground">Type</span><p className="font-medium">{libelle(TYPES_CLIENT, client.type_client)}</p></div>
        <div><span className="text-muted-foreground">Source</span><p className="font-medium">{libelle(SOURCES_CLIENT, client.source)}</p></div>
        <div><span className="text-muted-foreground">Téléphone</span><p className="cell-num font-medium">{client.telephone}</p></div>
        <div><span className="text-muted-foreground">WhatsApp</span><p className="cell-num font-medium">{client.whatsapp ?? '—'}</p></div>
        <div><span className="text-muted-foreground">Email</span><p className="font-medium">{client.email ?? '—'}</p></div>
        <div><span className="text-muted-foreground">Quartier</span><p className="font-medium">{client.quartier ?? '—'}</p></div>
        {requiertNiu(client.type_client) && (
          <div className="col-span-2"><span className="text-muted-foreground">NIU</span><p className="font-medium">{client.niu ?? '—'}</p></div>
        )}
      </div>

      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Historique des demandes ({historique.length})
        </h3>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : historique.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune demande pour ce client.</p>
        ) : (
          <ul className="space-y-2">
            {historique.map((d) => (
              <li key={d.id} className="panel p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-medium">{catLabel.get(d.categorie_id) ?? d.categorie_id}</span>
                  <StatusBadge status={d.statut} map={DEMANDE_STATUS_MAP} />
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{d.description}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{new Date(d.created_at).toLocaleString('fr-FR')}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Clients() {
  const { data: clients = [], isLoading } = useClients()
  const [q, setQ] = useState('')
  // Nudge de re-render — voir le commentaire dans NouveauClientForm.onCreated.
  const [, forceRerender] = useState(0)
  const [selected, setSelected] = useState<Client | null>(null)

  const filtres = clients.filter((c) =>
    `${c.nom} ${c.telephone} ${c.quartier ?? ''}`.toLowerCase().includes(q.toLowerCase()),
  )

  return (
    <div className="space-y-5">
      <ModuleHeader titre="Clients" sous={`${clients.length} fiche${clients.length > 1 ? 's' : ''} enregistrée${clients.length > 1 ? 's' : ''}`} />

      <Section titre="Nouveau client">
        <NouveauClientForm onCreated={() => forceRerender((n) => n + 1)} />
      </Section>

      <Section
        titre="Fichier clients"
        actions={<Txt placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 w-52" />}
      >
        <Table head={['Nom', 'Type', 'Téléphone', 'Quartier', 'Source']}>
          {isLoading && <Vide texte="Chargement…" colSpan={5} />}
          {!isLoading && filtres.map((c) => (
            <tr key={c.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSelected(c)}>
              <Td className="font-medium">{c.nom}</Td>
              <Td>{libelle(TYPES_CLIENT, c.type_client)}</Td>
              <Td className="cell-num">{c.telephone}</Td>
              <Td>{c.quartier ?? '—'}</Td>
              <Td>{libelle(SOURCES_CLIENT, c.source)}</Td>
            </tr>
          ))}
          {!isLoading && filtres.length === 0 && <Vide texte="Aucun client." colSpan={5} />}
        </Table>
      </Section>

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{selected?.nom}</SheetTitle>
            <SheetDescription>Fiche client</SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            {selected && <FicheClient client={selected} />}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
