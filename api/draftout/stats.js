// UUIDs de runners draftout non présents dans le classement ranked MSF
const DRAFTOUT_WHITELIST = [
  '6f98b3f3-38ea-43a7-b113-93395fbaee3f',
]

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).end('Method Not Allowed')
    return
  }

  try {
    // Récupére la liste des runners MSF
    const leaderboardRes = await fetch('https://back.mcsr-game.com/leaderboard')
    if (!leaderboardRes.ok) {
      res.status(leaderboardRes.status).end('Failed to fetch MSF leaderboard')
      return
    }
    const runners = await leaderboardRes.json()

    // Récupère les stats de chaque runner (ranked + whitelist)
    const rankedUuids = new Set(runners.map(r => r.uuid))
    const whitelistExtra = DRAFTOUT_WHITELIST.filter(uuid => !rankedUuids.has(uuid))

    const allQueries = [
      ...runners.map(runner => ({ key: runner.username })),
      ...whitelistExtra.map(uuid => ({ key: uuid })),
    ]

    const results = await Promise.allSettled(
      allQueries.map(({ key }) =>
        fetch(`https://draftoutmc.com/api/stats/${key}`)
          .then(r => r.ok ? r.json() : null)
      )
    )

    // Ajout liste drafout ssi compte draftout (player non null) et au moins une partie jouée (matches != 0)
    const players = []
    for (const result of results) {
      if (result.status !== 'fulfilled' || !result.value) continue
      const { player, record } = result.value
      if (!player) continue
      if ((record?.matches ?? 0) === 0) continue
      players.push({
        uuid: player.uuid,
        username: player.username,
        elo: player.elo,
        rankName: player.rankName ?? 'Unranked',
        rankColor: player.rankColor,
        wins: record?.wins ?? 0,
        losses: record?.losses ?? 0,
        winRate: record?.winRate ?? 0,
        averageFinishTime: record?.averageFinishTime ?? null,
      })
    }

    // Trie par elo décroissant et ajout du rang
    players.sort((a, b) => b.elo - a.elo)
    players.forEach((p, i) => { p.rank = i + 1 })

    res.status(200).json({ rows: players })
  } catch (err) {
    console.error('[draftout/stats]', err)
    res.status(502).end('Bad Gateway')
  }
}
