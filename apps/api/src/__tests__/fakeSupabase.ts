/**
 * Fake client Supabase en mémoire pour les tests d'intégration qui doivent
 * traverser plusieurs requêtes HTTP successives avec un état cohérent
 * (POST demande → POST matching → PATCH accepter → PATCH clôturer), ce que
 * les mocks à réponse unique de helpers.ts (mkChain) ne permettent pas.
 *
 * Couvre le sous-ensemble de l'API PostgREST utilisé par les routes Phase 2 :
 * select/insert/update/delete, eq/in/contains, maybeSingle/single, et
 * l'attente directe du builder (équivalent à .then()).
 */
import { randomUUID } from 'node:crypto'

type Row = Record<string, unknown>
type Filter = (row: Row) => boolean

export function createFakeSupabase() {
  const tables = new Map<string, Map<string, Row>>()

  function table(name: string): Map<string, Row> {
    let t = tables.get(name)
    if (!t) { t = new Map(); tables.set(name, t) }
    return t
  }

  function seed(name: string, rows: Row[]) {
    const t = table(name)
    for (const row of rows) t.set(row.id as string, { ...row })
  }

  function from(name: string) {
    const store = table(name)
    const filters: Filter[] = []
    let mode: 'select' | 'insert' | 'update' | 'delete' = 'select'
    let insertPayload: Row[] = []
    let updatePayload: Row = {}

    function apply(): Row[] {
      if (mode === 'insert') {
        return insertPayload.map((payload) => {
          const row: Row = { id: (payload.id as string) ?? randomUUID(), ...payload }
          store.set(row.id as string, row)
          return { ...row }
        })
      }
      const matched = [...store.values()].filter((row) => filters.every((f) => f(row)))
      if (mode === 'update') {
        for (const row of matched) Object.assign(row, updatePayload)
        return matched.map((r) => ({ ...r }))
      }
      if (mode === 'delete') {
        for (const row of matched) store.delete(row.id as string)
        return matched
      }
      return matched.map((r) => ({ ...r }))
    }

    const builder = {
      select(_cols?: string) {
        if (mode === 'select') mode = 'select'
        return builder
      },
      insert(payload: Row | Row[]) {
        mode = 'insert'
        insertPayload = Array.isArray(payload) ? payload : [payload]
        return builder
      },
      update(payload: Row) {
        mode = 'update'
        updatePayload = payload
        return builder
      },
      delete() {
        mode = 'delete'
        return builder
      },
      eq(col: string, val: unknown) {
        filters.push((row) => row[col] === val)
        return builder
      },
      neq(col: string, val: unknown) {
        filters.push((row) => row[col] !== val)
        return builder
      },
      in(col: string, vals: unknown[]) {
        filters.push((row) => vals.includes(row[col] as unknown))
        return builder
      },
      contains(col: string, vals: unknown[]) {
        filters.push((row) => {
          const arr = row[col]
          return Array.isArray(arr) && vals.every((v) => arr.includes(v))
        })
        return builder
      },
      ilike(col: string, pattern: string) {
        // Traduit le pattern PostgREST/Supabase ("%texte%") en regex
        // insensible à la casse — suffisant pour les tests de recherche
        // par nom (0027, public.ts).
        const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')
        const regex = new RegExp(`^${escaped}$`, 'i')
        filters.push((row) => typeof row[col] === 'string' && regex.test(row[col] as string))
        return builder
      },
      order(_col?: string) { return builder },
      limit(_n?: number) { return builder },
      maybeSingle: async () => {
        const rows = apply()
        return { data: rows[0] ?? null, error: null }
      },
      single: async () => {
        const rows = apply()
        if (!rows.length) return { data: null, error: { message: 'Row not found', code: 'PGRST116' } }
        return { data: rows[0], error: null }
      },
      then(resolve: (v: { data: Row[]; error: null; count: number }) => unknown) {
        const rows = apply()
        return Promise.resolve({ data: rows, error: null, count: rows.length }).then(resolve)
      },
    }

    return builder
  }

  // Stockage d'objets en mémoire (Supabase Storage) : suffisant pour tester
  // dépôt / URL signée / suppression sans réseau.
  const objets = new Map<string, { octets: Uint8Array; contentType?: string }>()
  const storage = {
    from(bucket: string) {
      return {
        async upload(path: string, octets: Uint8Array, opts?: { contentType?: string; upsert?: boolean }) {
          const cle = `${bucket}/${path}`
          if (objets.has(cle) && !opts?.upsert) return { data: null, error: { message: 'The resource already exists' } }
          objets.set(cle, { octets, contentType: opts?.contentType })
          return { data: { path }, error: null }
        },
        async createSignedUrl(path: string, _secondes: number) {
          if (!objets.has(`${bucket}/${path}`)) return { data: null, error: { message: 'Object not found' } }
          return { data: { signedUrl: `https://fake.storage/${bucket}/${path}?token=test` }, error: null }
        },
        async remove(paths: string[]) {
          for (const p of paths) objets.delete(`${bucket}/${p}`)
          return { data: [], error: null }
        },
      }
    },
  }

  return {
    from,
    seed,
    storage,
    dump(name: string) { return [...table(name).values()] },
    dumpObjets() { return [...objets.keys()] },
  }
}

export type FakeSupabase = ReturnType<typeof createFakeSupabase>
