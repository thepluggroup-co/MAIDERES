/**
 * notification.service.test.ts
 *
 * `notifier()` (master prompt §30/§32) : écrit toujours notifications_log,
 * tente l'envoi SMS si canal='sms' et qu'un téléphone est fourni, et ne
 * lève jamais d'exception vers l'appelant (fire-and-forget — un échec de
 * notification ne doit jamais faire échouer l'action métier qui l'a
 * déclenchée).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@maideres/db', () => ({ supabaseAdmin: { from: vi.fn() } }))
vi.mock('../services/sms.service', () => ({ sendSms: vi.fn() }))

import { supabaseAdmin } from '@maideres/db'
import { sendSms } from '../services/sms.service'
import { notifier } from '../services/notification.service'

type MockFn = ReturnType<typeof vi.fn>
const db = supabaseAdmin as unknown as { from: MockFn }
const sendSmsMock = sendSms as unknown as MockFn

function insertChain(insertResult: { data: unknown; error: unknown }) {
  const updateCalls: Array<{ statut: string }> = []
  const chain: Record<string, unknown> = {}
  chain['insert'] = () => chain
  chain['select'] = () => chain
  chain['single']  = () => Promise.resolve(insertResult)
  chain['update']  = (patch: { statut: string }) => { updateCalls.push(patch); return chain }
  chain['eq']      = () => Promise.resolve({ error: null })
  return { chain, updateCalls }
}

beforeEach(() => {
  db.from.mockReset()
  sendSmsMock.mockReset()
})

describe('notifier — notifications_log toujours écrit', () => {
  it('canal sms + téléphone valide + envoi réussi → statut passe à envoye', async () => {
    const { chain, updateCalls } = insertChain({ data: { id: 'log-1' }, error: null })
    db.from.mockReturnValue(chain)
    sendSmsMock.mockResolvedValue({ ok: true, provider: 'africastalking' })

    await notifier({ profileId: 'profile-1', telephone: '+237690000001', message: 'Test' })

    expect(db.from).toHaveBeenCalledWith('notifications_log')
    expect(sendSmsMock).toHaveBeenCalledWith('+237690000001', 'Test')
    expect(updateCalls).toEqual([{ statut: 'envoye' }])
  })

  it('canal sms + échec envoi → statut passe à echoue, ne lève pas', async () => {
    const { chain, updateCalls } = insertChain({ data: { id: 'log-2' }, error: null })
    db.from.mockReturnValue(chain)
    sendSmsMock.mockResolvedValue({ ok: false, error: 'provider down' })

    await expect(notifier({ profileId: 'profile-1', telephone: '+237690000001', message: 'Test' })).resolves.toBeUndefined()
    expect(updateCalls).toEqual([{ statut: 'echoue' }])
  })

  it('canal sms sans téléphone → statut echoue, sendSms jamais appelé', async () => {
    const { chain, updateCalls } = insertChain({ data: { id: 'log-3' }, error: null })
    db.from.mockReturnValue(chain)

    await notifier({ profileId: 'profile-1', telephone: null, message: 'Test' })

    expect(sendSmsMock).not.toHaveBeenCalled()
    expect(updateCalls).toEqual([{ statut: 'echoue' }])
  })

  it('canal whatsapp/email → notifications_log écrit, sendSms jamais appelé (aucun fournisseur câblé)', async () => {
    const { chain, updateCalls } = insertChain({ data: { id: 'log-4' }, error: null })
    db.from.mockReturnValue(chain)

    await notifier({ profileId: 'profile-1', telephone: '+237690000001', message: 'Test', canal: 'whatsapp' })

    expect(sendSmsMock).not.toHaveBeenCalled()
    expect(updateCalls).toEqual([]) // pas de mise à jour de statut pour un canal non câblé
  })

  it('échec d\'écriture notifications_log → ne lève pas, sendSms jamais appelé', async () => {
    const { chain } = insertChain({ data: null, error: { message: 'connection reset' } })
    db.from.mockReturnValue(chain)

    await expect(notifier({ profileId: 'profile-1', telephone: '+237690000001', message: 'Test' })).resolves.toBeUndefined()
    expect(sendSmsMock).not.toHaveBeenCalled()
  })

  it('sendSms qui lève une exception → capturée, ne remonte jamais à l\'appelant', async () => {
    const { chain } = insertChain({ data: { id: 'log-5' }, error: null })
    db.from.mockReturnValue(chain)
    sendSmsMock.mockRejectedValue(new Error('network error'))

    await expect(notifier({ profileId: 'profile-1', telephone: '+237690000001', message: 'Test' })).resolves.toBeUndefined()
  })
})
