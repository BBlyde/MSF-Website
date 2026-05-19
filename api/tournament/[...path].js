import { proxyBrowserApiToBackendAdapter } from '../lib/backendApiProxy.js'
import { denyUnlessAdmin, tournamentWriteRequiresAdmin } from '../lib/adminAuth.js'

export const config = {
  api: {
    bodyParser: false,
  },
}

function tournamentPathWithQuery(req) {
  const segments = req.query?.path
  const sub = Array.isArray(segments) ? segments.join('/') : String(segments || '')
  const rawUrl = req.url || ''
  const qIdx = rawUrl.indexOf('?')
  const qs = qIdx >= 0 ? rawUrl.slice(qIdx) : ''
  return `/api/tournament/${sub}${qs}`
}

export default async function handler(req, res) {
  if (tournamentWriteRequiresAdmin(req.method)) {
    if (denyUnlessAdmin(req, res)) return
  }

  const pathWithQuery = tournamentPathWithQuery(req)
  await proxyBrowserApiToBackendAdapter(req, pathWithQuery, res)
}
