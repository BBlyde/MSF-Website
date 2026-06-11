import { COOKIE_SESSION, cookieAttrs } from '../../lib/oauth.js'

function siteOrigin(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost'
  const proto = req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

export default function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).end('Method Not Allowed')
    return
  }

  const isProd = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'
  res.setHeader('Set-Cookie', `${COOKIE_SESSION}=; ${cookieAttrs({ maxAge: 0, secure: isProd })}`)
  res.redirect(302, `${siteOrigin(req)}/`)
}
