import { backendAbsoluteUrlFromBrowserRequest } from '../lib/backendApiProxy.js'
import { getJsonBody } from '../lib/getJsonBody.js'

function backendPredictionUrl() {
  return backendAbsoluteUrlFromBrowserRequest('/api/prediction/mrm')
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {boolean} withJson
 */
function upstreamHeaders(req, withJson = false) {
  const headers = { Accept: 'application/json' }
  const cookie = req.headers.cookie
  if (cookie) headers.Cookie = cookie
  if (withJson) headers['Content-Type'] = 'application/json; charset=utf-8'
  return headers
}

async function relayUpstreamResponse(upstream, res) {
  const contentType = upstream.headers.get('content-type') || ''
  const status = upstream.status
  if (contentType.includes('application/json')) {
    const payload = await upstream.json().catch(() => null)
    res.status(status).json(payload ?? {})
    return
  }
  const body = await upstream.text().catch(() => '')
  if (contentType) res.setHeader('Content-Type', contentType)
  res.status(status).send(body)
}

/**
 * @param {unknown} raw
 */
function normalizeOfficial(raw) {
  const data = raw && typeof raw === 'object' ? raw : null
  if (!data) return null
  const out = {}
  if (Array.isArray(data.group1)) out.group1 = data.group1
  if (Array.isArray(data.group2)) out.group2 = data.group2
  if (data.semi1Winner != null) out.semi1Winner = data.semi1Winner
  if (data.semi2Winner != null) out.semi2Winner = data.semi2Winner
  if (data.thirdPlaceWinner != null) out.thirdPlaceWinner = data.thirdPlaceWinner
  if (data.finalWinner != null) out.finalWinner = data.finalWinner
  return out
}

export default async function handler(req, res) {
  const upstreamUrl = backendPredictionUrl()

  if (req.method === 'GET') {
    try {
      const upstream = await fetch(upstreamUrl, {
        method: 'GET',
        headers: upstreamHeaders(req),
      })
      const contentType = upstream.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        await relayUpstreamResponse(upstream, res)
        return
      }

      const basePayload = (await upstream.json().catch(() => null)) ?? {}
      const payload = basePayload && typeof basePayload === 'object' ? { ...basePayload } : {}

      const existingOfficial =
        payload.official && typeof payload.official === 'object' ? normalizeOfficial(payload.official) : null
      payload.official = {
        ...(existingOfficial ?? {}),
      }

      res.status(upstream.status).json(payload)
    } catch (e) {
      console.error('[predictions/mrm] upstream GET error', e)
      res.status(502).json({ error: 'upstream_unreachable' })
    }
    return
  }

  if (req.method !== 'POST') {
    res.status(405).end('Method Not Allowed')
    return
  }

  let body
  try {
    body = await getJsonBody(req)
  } catch {
    res.status(400).json({ error: 'invalid_json' })
    return
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: upstreamHeaders(req, true),
      body: JSON.stringify(body),
    })
    await relayUpstreamResponse(upstream, res)
  } catch (e) {
    console.error('[predictions/mrm] upstream POST error', e)
    res.status(502).json({ error: 'upstream_unreachable' })
  }
}
