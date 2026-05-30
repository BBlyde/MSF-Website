import { useState, useEffect } from 'react'
import axios from 'axios'
import './LeaderboardDraftout.css'

const API_URL = '/api/draftout/stats'

function formatTime(ms) {
  if (!ms) return '-'
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function LeaderboardDraftout() {
  const [players, setPlayers] = useState([])
  const [filteredPlayers, setFilteredPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchLeaderboard()
  }, [])

  useEffect(() => {
    const filtered = players.filter(player =>
      player.username.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredPlayers(filtered)
  }, [searchTerm, players])

  const fetchLeaderboard = async () => {
    try {
      setLoading(true)
      const response = await axios.get(API_URL)
      setPlayers(response.data.rows)
      setLoading(false)
    } catch (err) {
      setError('Erreur de récupération du classement')
      setLoading(false)
    }
  }

  return (
    <div className="leaderboard-draftout">
      <div className="leaderboard-container">
        <div className="leaderboard-header">
          <h1><span className="draftout-title">CLASSEMENT DRAFTOUT</span></h1>
          <span className="info">Mode de jeu <a href="https://draftoutmc.com/" target="_blank" rel="noopener noreferrer">Draftout</a> 26.1</span>
        </div>

        <div className="section-divider" />

        {loading && <div className="loading">Chargement du classement...<br />C'est normal si c'est long</div>}
        {error && <div className="error">{error}</div>}

        {!loading && !error && (
          <>
            <div className="search-container">
              <div className="search-wrapper">
                <input
                  type="text"
                  placeholder="Rechercher un joueur..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                <svg className="search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
            </div>

            <div className="leaderboard-list">
              {filteredPlayers.length === 0 ? (
                <p className="no-data">
                  {searchTerm ? `Aucun joueur trouvé pour "${searchTerm}"` : 'Aucune donnée disponible'}
                </p>
              ) : (
                <table className="leaderboard-table">
                  <thead>
                    <tr>
                      <th className="rank">#</th>
                      <th className="player-name">Runner</th>
                      <th className="score">Elo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlayers.map((player, index) => (
                      <tr
                        key={player.uuid}
                        className="rank-row"
                        style={{ animationDelay: `${index * 30}ms`, cursor: 'pointer' }}
                        onClick={() => window.open(`https://draftoutmc.com/leaderboard/${player.username}?metric=elo&filter=competitive`, '_blank')}
                      >
                        <td className="rank">
                          <span className={`rank-number rank-${player.rank}`}>{player.rank}</span>
                        </td>
                        <td className="player-name">
                          <span className="player-name-inner">
                            <img
                              src={`https://mc-heads.net/avatar/${player.username}/24`}
                              alt={player.username}
                              className="player-head"
                            />
                            <span className="player-username">{player.username}</span>
                          </span>
                        </td>
                        <td className="score">
                          <div className="score-inner">
                            <span className="rank-badge-tooltip">
                              <span className="elo-value" style={{ color: player.rankColor }}>{player.elo}</span>
                              <span className="rank-tooltip-text">{player.rankName}</span>
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default LeaderboardDraftout