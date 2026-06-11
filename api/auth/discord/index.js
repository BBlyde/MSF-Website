import crypto from 'crypto'
import { signPayload, COOKIE_STATE, cookieAttrs } from '../../../lib/oauth.js'

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).end('Method Not Allowed')
    return
  }

  const clientId = process.env.DISCORD_CLIENT_ID
  const redirectUri = process.env.DISCORD_REDIRECT_URI
  const secret = process.env.AUTH_JWT_SECRET

  if (!clientId || !redirectUri || !secret) {
    res.status(500).send('OAuth Discord non configuré (variables d’environnement manquantes).')
    return
  }

  const state = crypto.randomBytes(24).toString('hex')
  const stateToken = signPayload(
    { state, exp: Math.floor(Date.now() / 1000) + 600 },
    secret,
  )

  const isProd = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_STATE}=${encodeURIComponent(stateToken)}; ${cookieAttrs({ maxAge: 600, secure: isProd })}`,
  )

  const url = new URL('https://discord.com/api/oauth2/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'identify')
  url.searchParams.set('state', state)

  res.redirect(302, url.toString())
}
