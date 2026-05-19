import { verifySignedPayload, parseCookies, COOKIE_SESSION } from './oauth.js'

/** Liste d’IDs Discord autorisés (séparés par des virgules). */
export function parseDiscordAdminIds() {
  const raw = process.env.DISCORD_ADMIN_IDS || ''
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function isDiscordAdmin(userId) {
  if (userId == null || userId === '') return false
  const ids = parseDiscordAdminIds()
  if (ids.length === 0) return false
  return ids.includes(String(userId))
}

export function getSessionFromRequest(req) {
  const secret = process.env.AUTH_JWT_SECRET
  if (!secret) return null
  const cookies = parseCookies(req.headers?.cookie)
  const raw = cookies[COOKIE_SESSION]
  return verifySignedPayload(raw, secret)
}

/**
 * Vérifie que la requête provient d’un admin Discord connecté.
 * @returns {{ ok: true, userId: string } | { ok: false, status: number, error: string }}
 */
export function checkAdminRequest(req) {
  const admins = parseDiscordAdminIds()
  if (admins.length === 0) {
    return { ok: false, status: 503, error: 'admin_not_configured' }
  }

  const payload = getSessionFromRequest(req)
  if (!payload?.id) {
    return { ok: false, status: 401, error: 'unauthorized' }
  }

  if (!isDiscordAdmin(payload.id)) {
    return { ok: false, status: 403, error: 'forbidden' }
  }

  return { ok: true, userId: String(payload.id) }
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {{ status: (n: number) => { json: (o: unknown) => void } }} res
 * @returns {boolean} true si la réponse d’erreur a été envoyée
 */
export function denyUnlessAdmin(req, res) {
  const result = checkAdminRequest(req)
  if (result.ok) return false
  res.status(result.status).json({ error: result.error })
  return true
}

export function tournamentWriteRequiresAdmin(method) {
  const m = (method || 'GET').toUpperCase()
  return m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS'
}
