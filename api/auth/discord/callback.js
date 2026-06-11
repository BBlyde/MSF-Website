import {
  verifySignedPayload,
  signPayload,
  parseCookies,
  COOKIE_SESSION,
  COOKIE_STATE,
  cookieAttrs,
} from '../../../lib/oauth.js'

function siteOrigin(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost'
  const proto = req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).end('Method Not Allowed')
    return
  }

  const clientId = process.env.DISCORD_CLIENT_ID
  const clientSecret = process.env.DISCORD_CLIENT_SECRET
  const redirectUri = process.env.DISCORD_REDIRECT_URI
  const secret = process.env.AUTH_JWT_SECRET

  if (!clientId || !clientSecret || !redirectUri || !secret) {
    res.status(500).send('OAuth Discord non configuré.')
    return
  }

  const code = req.query.code
  const qState = req.query.state
  const err = req.query.error

  const isProd = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'
  const clearStateCookie = `${COOKIE_STATE}=; ${cookieAttrs({ maxAge: 0, secure: isProd })}`

  if (err || !code || !qState) {
    res.setHeader('Set-Cookie', clearStateCookie)
    res.redirect(302, `${siteOrigin(req)}/?auth=error`)
    return
  }

  const cookies = parseCookies(req.headers.cookie)
  const rawState = cookies[COOKIE_STATE]
  const statePayload = verifySignedPayload(rawState, secret)
  if (!statePayload || statePayload.state !== qState) {
    res.setHeader('Set-Cookie', clearStateCookie)
    res.redirect(302, `${siteOrigin(req)}/?auth=error`)
    return
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code: String(code),
    redirect_uri: redirectUri,
  })

  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })

  if (!tokenRes.ok) {
    res.setHeader('Set-Cookie', clearStateCookie)
    res.redirect(302, `${siteOrigin(req)}/?auth=error`)
    return
  }

  const tokens = await tokenRes.json()
  const accessToken = tokens.access_token

  const meRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!meRes.ok) {
    res.setHeader('Set-Cookie', clearStateCookie)
    res.redirect(302, `${siteOrigin(req)}/?auth=error`)
    return
  }

  const me = await meRes.json()
  const sessionWeek = 60 * 60 * 24 * 7
  const sessionToken = signPayload(
    {
      id: me.id,
      username: me.username,
      globalName: me.global_name || null,
      avatar: me.avatar || null,
      exp: Math.floor(Date.now() / 1000) + sessionWeek,
    },
    secret,
  )

  const sessionCookie = `${COOKIE_SESSION}=${encodeURIComponent(sessionToken)}; ${cookieAttrs({ maxAge: sessionWeek, secure: isProd })}`

  res.setHeader('Set-Cookie', [clearStateCookie, sessionCookie])
  res.redirect(302, `${siteOrigin(req)}/?auth=ok`)
}
