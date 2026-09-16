/**
 * Notifications de workflow (master prompt §30/§32) — jusqu'ici seule
 * `notifyWorkflow()` (workflow-notifications.service.ts, broadcast Realtime
 * éphémère, jamais persisté) existait, et n'était appelée nulle part.
 *
 * `notifier()` est la contrepartie durable : écrit toujours une ligne dans
 * `notifications_log` (trace pour l'utilisateur ciblé, quel que soit le
 * canal), puis tente l'envoi effectif — SMS via sms.service.ts aujourd'hui,
 * seul canal réellement câblé à un fournisseur (Africa's Talking).
 * whatsapp/email : la ligne notifications_log est créée (traçabilité), mais
 * aucun envoi n'est encore tenté — pas de fournisseur configuré pour ces
 * canaux dans ce projet (cf. .env.example) ; ajouter l'adaptateur quand l'un
 * d'eux existe, jamais réimplémenté au coup par coup dans chaque route.
 *
 * Fire-and-forget : ne lève jamais d'exception vers l'appelant — un échec
 * de notification ne doit jamais faire échouer l'action métier qui l'a
 * déclenchée (mêmes principes que auditMiddleware).
 */
import { supabaseAdmin } from '@maideres/db'
import { sendSms } from './sms.service'
import type { NotifCanal } from '@maideres/contracts'

function getDb() {
  if (!supabaseAdmin) throw new Error('notification.service: supabaseAdmin non initialisé')
  return supabaseAdmin
}

export type NotifierParams = {
  /** profiles.id de la cible — jamais un id métier (client_id/prestataire_id) directement. */
  profileId: string
  telephone?: string | null
  message: string
  canal?: NotifCanal
}

export async function notifier({ profileId, telephone, message, canal = 'sms' }: NotifierParams): Promise<void> {
  const db = getDb()

  const { data: log, error: logError } = await db
    .from('notifications_log')
    .insert({ cible: profileId, canal, contenu: message, statut: 'en_attente' })
    .select('id')
    .single()

  if (logError) {
    console.error('[notification] échec écriture notifications_log:', logError.message)
    return
  }
  const logId = (log as { id: string }).id

  if (canal !== 'sms') {
    // whatsapp/email : traçabilité seule pour l'instant, voir docstring.
    return
  }

  try {
    if (!telephone) {
      await db.from('notifications_log').update({ statut: 'echoue' }).eq('id', logId)
      return
    }
    const result = await sendSms(telephone, message)
    await db.from('notifications_log').update({ statut: result.ok ? 'envoye' : 'echoue' }).eq('id', logId)
  } catch (e) {
    console.error('[notification] échec envoi SMS:', e instanceof Error ? e.message : e)
  }
}
