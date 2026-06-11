/**
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<unknown>}
 */
export function getJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        if (!raw || !raw.trim()) {
          resolve(null)
          return
        }
        resolve(JSON.parse(raw))
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}
