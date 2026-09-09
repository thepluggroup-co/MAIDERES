import { serve } from '@hono/node-server'
import { supabaseAdmin } from '@maideres/db'
import app from './app'

const configuredPort = process.env.PORT ?? '3001'
const port = Number(configuredPort)

if (!Number.isInteger(port) || port <= 0) {
  throw new Error(`PORT invalide: ${configuredPort}`)
}

// Startup diagnostics
console.log('[boot] SUPABASE_URL        :', process.env.SUPABASE_URL ? 'SET' : 'MISSING')
console.log('[boot] SUPABASE_ANON_KEY   :', process.env.SUPABASE_ANON_KEY ? 'SET' : 'MISSING')
console.log('[boot] SERVICE_ROLE_KEY    :', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING')
console.log('[boot] supabaseAdmin       :', supabaseAdmin ? 'INITIALIZED' : 'NULL — routes will all 500')

serve({ fetch: app.fetch, hostname: '0.0.0.0', port }, (info) => {
  console.log(`MAIDERES API  →  http://localhost:${info.port}`)
})

export default app
