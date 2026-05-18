export function discordAvatarUrl(id, avatarHash) {
  if (avatarHash) {
    const ext = String(avatarHash).startsWith('a_') ? 'gif' : 'png'
    return `https://cdn.discordapp.com/avatars/${id}/${avatarHash}.${ext}?size=64`
  }
  const n = Number((BigInt(id) >> 22n) % 6n)
  return `https://cdn.discordapp.com/embed/avatars/${n}.png`
}

export function discordDisplayName(user) {
  if (!user) return ''
  return user.globalName || user.username || ''
}
