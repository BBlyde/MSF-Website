import { verifySignedPayload, parseCookies, COOKIE_SESSION } from '../lib/oauth.js'
import { isDiscordAdmin } from '../lib/adminAuth.js'

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).end('Method Not Allowed')
    return
  }

  const secret = process.env.AUTH_JWT_SECRET
  if (!secret) {
    res.status(500).json({ user: null, error: 'not_configured' })
    return
  }

  const cookies = parseCookies(req.headers.cookie)
  const raw = cookies[COOKIE_SESSION]
  const payload = verifySignedPayload(raw, secret)

  if (!payload || !payload.id) {
    res.status(200).json({ user: null, isAdmin: false })
    return
  }

  res.status(200).json({
    user: {
      id: payload.id,
      username: payload.username,
      globalName: payload.globalName,
      avatar: payload.avatar,
    },
    isAdmin: isDiscordAdmin(payload.id),
  })
}
