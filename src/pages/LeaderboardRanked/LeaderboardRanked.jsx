import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import './LeaderboardRanked.css'
import coal1Img from '../../assets/coal1.png'
import coal2Img from '../../assets/coal2.png'
import coal3Img from '../../assets/coal3.png'
import iron1Img from '../../assets/iron1.png'
import iron2Img from '../../assets/iron2.png'
import iron3Img from '../../assets/iron3.png'
import gold1Img from '../../assets/gold1.png'
import gold2Img from '../../assets/gold2.png'
import gold3Img from '../../assets/gold3.png'
import emerald1Img from '../../assets/emerald1.png'
import emerald2Img from '../../assets/emerald2.png'
import emerald3Img from '../../assets/emerald3.png'
import diamond1Img from '../../assets/diamond1.png'
import diamond2Img from '../../assets/diamond2.png'
import diamond3Img from '../../assets/diamond3.png'
import netheriteImg from '../../assets/netherite.png'

const DEFAULT_SEASON = 11

function LeaderboardRanked() {
  const [players, setPlayers] = useState([])
  const [filteredPlayers, setFilteredPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [timeLeft, setTimeLeft] = useState('')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const season = parseInt(searchParams.get('season') || DEFAULT_SEASON, 10)

  const API_URL = 'https://back.mcsr-game.com/leaderboard'

  const getRankImg = (elo) => {
    if (elo >= 2000) return { src: netheriteImg, label: 'Netherite' }
    if (elo >= 1800) return { src: diamond3Img, label: 'Diamond III' }
    if (elo >= 1650) return { src: diamond2Img, label: 'Diamond II' }
    if (elo >= 1500) return { src: diamond1Img, label: 'Diamond I' }
    if (elo >= 1400) return { src: emerald3Img, label: 'Emerald III' }
    if (elo >= 1300) return { src: emerald2Img, label: 'Emerald II' }
    if (elo >= 1200) return { src: emerald1Img, label: 'Emerald I' }
    if (elo >= 1100) return { src: gold3Img, label: 'Gold III' }
    if (elo >= 1000) return { src: gold2Img, label: 'Gold II' }
    if (elo >= 900) return { src: gold1Img, label: 'Gold I' }
    if (elo >= 800) return { src: iron3Img, label: 'Iron III' }
    if (elo >= 700) return { src: iron2Img, label: 'Iron II' }
    if (elo >= 600) return { src: iron1Img, label: 'Iron I' }
    if (elo >= 500) return { src: coal3Img, label: 'Coal III' }
    if (elo >= 400) return { src: coal2Img, label: 'Coal II' }
    return { src: coal1Img, label: 'Coal I' }
  }

  const countryToFlag = (countryCode) => {
    if (!countryCode) return ''
    return `https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`
  }

  const formatTimeLeft = () => {
    const targetDate = 1777507200 * 1000
    const now = new Date().getTime()
    const difference = targetDate - now

    if (difference <= 0) {
      return 'SAISON TERMINÉE'
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24))
    const hours = Math.floor((difference / (1000 * 60 * 60)) % 24)
    const minutes = Math.floor((difference / 1000 / 60) % 60)
    const seconds = Math.floor((difference / 1000) % 60)

    return `${days}j ${hours}h ${minutes}m ${seconds}s`
  }

  useEffect(() => {
    fetchLeaderboard()
  }, [])

  useEffect(() => {
    setTimeLeft(formatTimeLeft())
    const timer = setInterval(() => {
      setTimeLeft(formatTimeLeft())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const filtered = players.filter(player =>
      (player.name || player.username || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredPlayers(filtered)
  }, [searchTerm, players])

  const fetchLeaderboard = async () => {
    try {
      setLoading(true)
      const response = await axios.get(API_URL)

      setPlayers(response.data)
      setLoading(false)
    } catch (err) {
      setError("Erreur de récupération du classement, c'est la faute de phili..")
      setLoading(false)
    }
  }

  return (
    <div className="leaderboard-ranked">
      <div className="leaderboard-container">
        <div className="leaderboard-header">
          <h1>CLASSEMENT RANKED S10</h1>
          <span className="info">Top 16 qualifié au <Link to="/mrm" className='info-link'>MSF Ranked Masters</Link></span>
        </div>

        <div className="section-divider" />

        <div className="season-nav">
          <button
            className="season-arrow"
            onClick={() => season > 1 && navigate(`/ranked?season=${season - 1}`)}
            disabled={season <= 1}
            aria-label="Saison précédente"
          >&lt;</button>
          <div className="countdown">
            <p className="countdown-label">FIN DE SAISON</p>
            <div className="countdown-timer">{timeLeft}</div>
            <p className="countdown-date">30 Avril 2026</p>
          </div>
          <button
            className="season-arrow"
            onClick={() => season < 11 && navigate(`/ranked?season=${season + 1}`)}
            disabled={season >= 11}
            aria-label="Saison suivante"
          >&gt;</button>
        </div>

        {loading && <div className="loading">Chargement du classement...</div>}
        {error && <div className="error">{error}</div>}

        {!loading && !error && (
          <>
            <div className="search-container">
              <div className="search-wrapper">
                <input
                  type="text"
                  placeholder="Rechercher un runner..."
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
                  {searchTerm ? `Aucun runner trouvé pour "${searchTerm}"` : 'Aucune donnée disponible'}
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
                      <>
                        <tr
                          className={`rank-row${player.placement > 16 ? ' rank-row--unqualified' : ''}`}
                          key={`${player.id || player.username}-${searchTerm}`}
                          onClick={() => window.open(`https://mcsrranked.com/stats/${player.username}`, '_blank')}
                          style={{ cursor: 'pointer', animationDelay: `${index * 30}ms` }}
                        >
                          <td className="rank">
                            <span className={`rank-number rank-${player.placement}`}>{player.placement}</span>
                          </td>
                          <td className="player-name">
                            <span className="player-name-inner">
                              {player.country && (
                                <img
                                  src={countryToFlag(player.country)}
                                  alt={player.country}
                                  style={{ width: '20px', height: '15px' }}
                                />
                              )}
                              <span className="player-username">{player.username}</span>
                            </span>
                          </td>
                          <td className="score">
                            <div className="score-inner">
                              <span className="rank-badge-tooltip">
                                <img src={getRankImg(player.elo).src} alt={getRankImg(player.elo).label} className="rank-badge-img" />
                                <span className="rank-tooltip-text">{getRankImg(player.elo).label}</span>
                              </span>
                              <span className="elo-value">{player.elo}</span>
                            </div>
                          </td>
                        </tr>
                        {player.placement === 16 && (
                          <tr className="qualification-threshold">
                            <td colSpan="3">
                              <div className="threshold-line">
                                <span className="threshold-text">Seuil de qualification</span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
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

export default LeaderboardRanked