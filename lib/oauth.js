import crypto from 'crypto'

export const COOKIE_SESSION = 'msf_discord_session'
export const COOKIE_STATE = 'msf_oauth_state'

export function signPayload(obj, secret) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url')
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifySignedPayload(token, secret) {
  if (!token || typeof token !== 'string') return null
  const i = token.lastIndexOf('.')
  if (i === -1) return null
  const body = token.slice(0, i)
  const sig = token.slice(i + 1)
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url')
  try {
    if (sig.length !== expected.length) return null
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expected, 'utf8'))) return null
  } catch {
    return null
  }
  try {
    const obj = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (obj.exp && Date.now() / 1000 > obj.exp) return null
    return obj
  } catch {
    return null
  }
}

export function parseCookies(header) {
  const out = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const k = part.slice(0, idx).trim()
    const v = part.slice(idx + 1).trim()
    if (k) out[k] = decodeURIComponent(v)
  }
  return out
}

export function cookieAttrs({ maxAge, secure }) {
  const parts = ['Path=/', 'HttpOnly', 'SameSite=Lax']
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`)
  if (secure) parts.push('Secure')
  return parts.join('; ')
}
