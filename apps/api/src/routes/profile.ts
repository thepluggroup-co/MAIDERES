import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { supabaseAdmin } from '@maideres/db'
import type { HonoVariables } from '../types'
import { isStaff, ownClientId, ownPrestataireId } from '../services/identity.service'

export const profileRouter = new Hono<{ Variables: HonoVariables }>()

if (!supabaseAdmin) {
  profileRouter.all('*', (c) => c.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, 503))
}
const db = supabaseAdmin!

// ── GET /api/profile/me ───────────────────────────────────────────────────────
// Inclut l'identité métier dérivée (is_staff/client_id/prestataire_id) en
// plus du profil brut — un seul appel pour qu'un frontend (apps/web comme
// maidere-connect) sache de quel côté de la plateforme se trouve
// l'utilisateur, sans réimplémenter la logique de identity.service.ts.
profileRouter.get('/me', async (c) => {
  const user = c.get('user')

  const { data, error } = await db
    .from('profiles')
    .select('id, email, nom, role, telephone, adresse, actif, created_at')
    .eq('id', user.id)
    .single()

  if (error) return c.json({ error: error.message }, 500)

  const staff = isStaff(user.role)
  const [clientId, prestataireId] = staff
    ? [null, null]
    : await Promise.all([ownClientId(user.id), ownPrestataireId(user.id)])

  return c.json({
    data: {
      ...data,
      is_staff: staff,
      client_id: clientId,
      prestataire_id: prestataireId,
    },
  })
})

// ── PATCH /api/profile/me ─────────────────────────────────────────────────────
const patchProfileSchema = z.object({
  nom:       z.string().min(1).max(100).optional(),
  telephone: z.string().max(30).nullable().optional(),
  adresse:   z.string().max(200).nullable().optional(),
})

profileRouter.patch(
  '/me',
  zValidator('json', patchProfileSchema),
  async (c) => {
    const user = c.get('user')
    const body = c.req.valid('json')

    const update: Record<string, unknown> = {}
    if (body.nom       !== undefined) update.nom       = body.nom.trim()
    if (body.telephone !== undefined) update.telephone = body.telephone
    if (body.adresse   !== undefined) update.adresse   = body.adresse

    if (!Object.keys(update).length) return c.json({ success: true })

    const { error } = await db
      .from('profiles')
      .update(update)
      .eq('id', user.id)

    if (error) return c.json({ error: error.message }, 500)
    return c.json({ success: true })
  },
)
