export function minecraftHeadUrl(identifier, size = 64) {
  if (!identifier) {
    return `https://minotar.net/helm/steve/${size}.png`
  }

  return `https://minotar.net/helm/${encodeURIComponent(identifier)}/${size}.png`
}