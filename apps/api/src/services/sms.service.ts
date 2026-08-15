const DEFAULT_COUNTRY_CODE = process.env.SMS_DEFAULT_COUNTRY_CODE ?? '237'

export interface SmsResult {
  ok: boolean
  skipped?: boolean
  provider?: 'africastalking'
  error?: string
  response?: unknown
}

function cleanPhone(phone: string) {
  return phone.trim().replace(/[^\d+]/g, '')
}

export function normalizePhone(phone?: string | null) {
  if (!phone) return null
  const cleaned = cleanPhone(phone)
  if (!cleaned) return null
  if (cleaned.startsWith('+')) return cleaned
  if (cleaned.startsWith('00')) return `+${cleaned.slice(2)}`
  if (cleaned.startsWith(DEFAULT_COUNTRY_CODE)) return `+${cleaned}`
  if (cleaned.startsWith('6') && cleaned.length === 9) return `+${DEFAULT_COUNTRY_CODE}${cleaned}`
  return `+${cleaned}`
}

function smsEndpoint() {
  const env = (process.env.AFRICASTALKING_ENV ?? process.env.AT_ENV ?? '').toLowerCase()
  if (env === 'sandbox' || process.env.AFRICASTALKING_SANDBOX === 'true') {
    return 'https://api.sandbox.africastalking.com/version1/messaging'
  }
  return 'https://api.africastalking.com/version1/messaging'
}

function smsConfig() {
  const username = process.env.AFRICASTALKING_USERNAME ?? process.env.AT_USERNAME ?? ''
  const apiKey   = process.env.AFRICASTALKING_API_KEY ?? process.env.AT_API_KEY ?? ''
  const senderId = process.env.AFRICASTALKING_SENDER_ID ?? process.env.AT_SENDER_ID ?? ''
  return { username, apiKey, senderId }
}

export async function sendSms(to: string, message: string): Promise<SmsResult> {
  const phone = normalizePhone(to)
  if (!phone) return { ok: false, skipped: true, error: 'Telephone invalide' }

  const { username, apiKey, senderId } = smsConfig()
  if (!username || !apiKey) {
    console.info('[sms:africastalking:dry-run]', phone, message.slice(0, 120))
    return { ok: true, skipped: true, provider: 'africastalking' }
  }

  const body = new URLSearchParams({
    username,
    to:      phone,
    message: message.slice(0, 640),
  })
  if (senderId) body.set('from', senderId)

  try {
    const res = await fetch(smsEndpoint(), {
      method:  'POST',
      headers: {
        Accept:         'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        apiKey,
      },
      body,
    })

    const text = await res.text()
    let payload: unknown = text
    try { payload = JSON.parse(text) } catch { /* keep raw provider response */ }

    if (!res.ok) {
      console.warn('[sms:africastalking] non-OK response:', res.status, text.slice(0, 200))
      return { ok: false, provider: 'africastalking', error: `HTTP ${res.status}`, response: payload }
    }

    return { ok: true, provider: 'africastalking', response: payload }
  } catch (err) {
    const messageError = err instanceof Error ? err.message : String(err)
    console.error('[sms:africastalking] send error:', messageError)
    return { ok: false, provider: 'africastalking', error: messageError }
  }
}

