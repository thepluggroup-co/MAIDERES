import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { supabaseAdmin } from '@forge/db'
import type { HonoVariables } from './types'
import { authMiddleware } from './middleware/auth'
import { auditMiddleware } from './middleware/audit'
import { rateLimitMiddleware } from './middleware/rateLimit'
import { adminRouter } from './routes/admin'
import { profileRouter } from './routes/profile'
import { categoriesRouter } from './routes/categories'
import { prestatairesRouter } from './routes/prestataires'
import { clientsRouter } from './routes/clients'
import { demandesRouter } from './routes/demandes'
import { matchingsRouter } from './routes/matchings'
import { avisRouter } from './routes/avis'
import { HTTPException } from 'hono/http-exception'

const app = new Hono<{ Variables: HonoVariables }>()

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
  'http://localhost:3002',
  ...(process.env.FRONTEND_URL?.split(',').map((u) => u.trim()) ?? []),
  process.env.TAURI_URL,
].filter(Boolean) as string[]

app.use('*', logger())

app.use('*', cors({
  origin: (origin) => {
    if (!origin) return origin
    if (ALLOWED_ORIGINS.includes(origin)) return origin
    // Dev: allow any localhost port (Vite may shift to 5174, 5175, etc.)
    if (process.env.NODE_ENV !== 'production' && /^https?:\/\/localhost(:\d+)?$/.test(origin)) return origin
    return null
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'],
  credentials: true,
  maxAge: 86400,
}))

app.use('*', rateLimitMiddleware)

app.get('/health', (c) =>
  c.json({
    status: 'ok',
    version: '1.0.0',
    app: 'MAIDERES API',
    timestamp: new Date().toISOString(),
  }),
)

// Diagnostic endpoint — tests DB connection without requiring a session
app.get('/health/db', async (c) => {
  if (!supabaseAdmin) {
    return c.json({ ok: false, error: 'supabaseAdmin is null — SERVICE_ROLE_KEY missing' }, 503)
  }
  try {
    const { data, error } = await supabaseAdmin.from('profiles' as never).select('id').limit(1)
    if (error) return c.json({ ok: false, error: error.message, code: error.code }, 500)
    return c.json({ ok: true, db: 'connected', rows_sampled: (data as unknown[]).length })
  } catch (err) {
    return c.json({ ok: false, error: String(err) }, 500)
  }
})

// Diagnostic endpoint — shows which env vars are loaded
app.get('/health/env', (c) =>
  c.json({
    supabase_url:       process.env.SUPABASE_URL ?? '(not set)',
    service_key_set:    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    jwt_secret_set:     Boolean(process.env.SUPABASE_JWT_SECRET),
    node_env:           process.env.NODE_ENV ?? '(not set)',
    supabaseAdmin_null: supabaseAdmin === null,
  }),
)

const api = new Hono<{ Variables: HonoVariables }>()

api.use('*', authMiddleware)
api.use('*', auditMiddleware)

api.route('/admin',   adminRouter)
api.route('/profile', profileRouter)
api.route('/categories_services', categoriesRouter)
api.route('/prestataires',        prestatairesRouter)
api.route('/clients',             clientsRouter)
api.route('/demandes',            demandesRouter)
api.route('/matchings',           matchingsRouter)
api.route('/avis',                avisRouter)

app.route('/api', api)

app.onError((err, c) => {
  // HTTPException : erreurs métier intentionnelles (422, 404, etc.)
  if (err instanceof HTTPException) {
    return err.getResponse()
  }

  // Erreurs avec code métier attaché (throw Object.assign(new Error(...), { code, httpStatus }))
  const e = err as Error & { code?: string; httpStatus?: number }
  if (e.httpStatus && e.httpStatus >= 400 && e.httpStatus < 500) {
    return c.json({ error: e.message, code: e.code ?? 'CLIENT_ERROR' }, e.httpStatus as 400)
  }

  console.error(`[error] ${c.req.method} ${c.req.url}`, err)
  return c.json(
    {
      error: 'Erreur serveur interne',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    },
    500,
  )
})

app.notFound((c) =>
  c.json({ error: `Route ${c.req.method} ${c.req.path} introuvable`, code: 'NOT_FOUND' }, 404),
)

export default app
