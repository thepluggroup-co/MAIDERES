import { z } from 'zod'
import { NotifCanalSchema, NotifStatutSchema } from './enums'

export const NotificationLogSchema = z.object({
  id: z.string().uuid(),
  cible: z.string().uuid(),
  canal: NotifCanalSchema,
  contenu: z.string(),
  statut: NotifStatutSchema,
  created_at: z.string(),
})
export type NotificationLog = z.infer<typeof NotificationLogSchema>
