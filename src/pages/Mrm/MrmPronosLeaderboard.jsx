import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { discordAvatarUrl, discordDisplayName } from '../../utils/discordUser'
import { predictionApiUrl } from '../../utils/predictionApi'

const mrmPredictionLeaderboardUrl = predictionApiUrl('/prediction/mrm/leaderboard')

/**
 * @param {{ highlightUserId?: string | null }} props
 */
export default function MrmPronosLeaderboard({ highlightUserId = null }) {
  const location = useLocation()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    ;(async () => {
      try {
        const res = await fetch(mrmPredictionLeaderboardUrl)
        const data = res.ok ? await res.json() : { leaderboard: [] }
        const list = Array.isArray(data.leaderboard) ? data.leaderboard : []
        if (!cancelled) {
          setRows(list)
          if (!res.ok) setError(true)
        }
      } catch {
        if (!cancelled) {
          setRows([])
          setError(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <aside className="mrm-prediction-leaderboard" aria-label="Classement des pronostiques">
      <div className="mrm-prediction-leaderboard-header">CLASSEMENT PRONOS</div>
      <div className="mrm-prediction-leaderboard-body">
        {loading ? (
          <p className="mrm-prediction-leaderboard-status">Chargement…</p>
        ) : error ? (
          <p className="mrm-prediction-leaderboard-status mrm-prediction-leaderboard-status--error">
            Classement indisponible pour le moment.
          </p>
        ) : rows.length === 0 ? (
          <p className="mrm-prediction-leaderboard-status">Aucune entrée pour l&apos;instant.</p>
        ) : (
          <ul className="mrm-prediction-leaderboard-list">
            {rows.map((row, index) => {
              const isMe = highlightUserId != null && highlightUserId === row.discordId
              const label = discordDisplayName({
                username: row.username,
                globalName: row.globalName,
              })
              const name = label || row.username || '—'
              const profilePath = `/prediction/mrm/${encodeURIComponent(row.discordId)}`
              const isActive = location.pathname === profilePath
              return (
                <li key={`${row.discordId}-${index}`}>
                  <Link
                    to={profilePath}
                    state={{
                      viewProfile: {
                        discordId: row.discordId,
                        username: row.username,
                        globalName: row.globalName,
                        points: row.points,
                        avatar: row.avatar,
                      },
                    }}
                    className={[
                      'mrm-prediction-leaderboard-row',
                      isMe ? 'mrm-prediction-leaderboard-row--me' : '',
                      isActive ? 'mrm-prediction-leaderboard-row--active' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-current={isActive ? 'page' : undefined}
                    title={`Voir les pronostiques de ${name}`}
                  >
                    <span className="mrm-prediction-leaderboard-rank">{index + 1}</span>
                    <img
                      className="mrm-prediction-leaderboard-avatar"
                      src={discordAvatarUrl(row.discordId, row.avatar ?? null)}
                      alt=""
                      width={32}
                      height={32}
                      onError={(e) => {
                        const fallback = discordAvatarUrl(row.discordId, null)
                        if (e.currentTarget.src !== fallback) {
                          e.currentTarget.src = fallback
                        }
                      }}
                    />
                    <span className="mrm-prediction-leaderboard-name">{name}</span>
                    <span className="mrm-prediction-leaderboard-points">{row.points}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}
