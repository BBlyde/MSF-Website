import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import './MrmPrediction.css'
import groupe1Baseline from '../Mrm/groupe1.json'
import groupe2Baseline from '../Mrm/groupe2.json'
import { reconcileOrder } from '../Mrm/mrmPredictionStorage'
import MrmPronosLeaderboard from '../Mrm/MrmPronosLeaderboard'
import { predictionApiUrl } from '../../utils/predictionApi'

const mrmPredictionApiUrl = predictionApiUrl('/prediction/mrm')

const DEFAULT_HEAD = 'https://mc-heads.net/avatar/0385/48'
const DEFAULT_LOCK_STATE = {
  global: { locked: false, lockAt: null },
  group1: { locked: false, lockAt: null },
  group2: { locked: false, lockAt: null },
  playoffs: { locked: false, lockAt: null },
  serverNow: null,
}
const DEFAULT_FINISHED_STATE = {
  group1: false,
  group2: false,
  semi1: false,
  semi2: false,
  thirdPlace: false,
  final: false,
}

function normalizeLockEntry(rawLock, fallbackLocked = false, fallbackLockAt = null) {
  const raw = rawLock && typeof rawLock === 'object' ? rawLock : null
  const lockAtCandidate = raw?.lockAt ?? fallbackLockAt
  return {
    locked: raw?.locked === true || fallbackLocked === true,
    lockAt: typeof lockAtCandidate === 'string' && lockAtCandidate.trim() !== '' ? lockAtCandidate : null,
  }
}

function normalizeFinishedState(rawFinished) {
  const data = rawFinished && typeof rawFinished === 'object' ? rawFinished : {}
  return {
    group1: data.group1 === true || data.group1Finished === true,
    group2: data.group2 === true || data.group2Finished === true,
    semi1: data.semi1 === true || data.semi1Finished === true,
    semi2: data.semi2 === true || data.semi2Finished === true,
    thirdPlace: data.thirdPlace === true || data.thirdPlaceFinished === true,
    final: data.final === true || data.finalFinished === true,
  }
}

function normalizeOfficialState(rawOfficial) {
  const data = rawOfficial && typeof rawOfficial === 'object' ? rawOfficial : null
  if (!data) return null
  return {
    group1: Array.isArray(data.group1) ? data.group1 : null,
    group2: Array.isArray(data.group2) ? data.group2 : null,
    semi1Winner: data.semi1Winner ?? null,
    semi2Winner: data.semi2Winner ?? null,
    thirdPlaceWinner: data.thirdPlaceWinner ?? null,
    finalWinner: data.finalWinner ?? null,
  }
}

function buildBaselineLookup(baseline) {
  const byUuid = new Map()
  const byName = new Map()
  baseline.forEach((p, i) => {
    if (typeof p?.uuid === 'string' && p.uuid.trim() !== '') {
      byUuid.set(p.uuid.trim().toLowerCase(), i)
    }
    if (typeof p?.name === 'string' && p.name.trim() !== '') {
      byName.set(p.name.trim().toLowerCase(), i)
    }
  })
  return { byUuid, byName }
}

function parseRowTotal(row) {
  if (!row || typeof row !== 'object') return 0
  const t = row.total
  if (typeof t === 'number' && Number.isFinite(t)) return t
  if (typeof t === 'string' && t.trim() !== '') {
    const n = Number(t)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

/** Classement officiel dérivé de group1/2 : tri par total décroissant (même règle que le backend). */
function rankMapFromOfficialGroupRowsByTotal(rows, baselineLookup) {
  if (!Array.isArray(rows) || !baselineLookup) return {}
  const decorated = rows
    .map((row, sourceIndex) => {
      if (!row || typeof row !== 'object') return null
      let baselineIdx = null
      const rawUuid = typeof row.uuid === 'string' ? row.uuid.trim().toLowerCase() : ''
      const rawName = typeof row.name === 'string' ? row.name.trim().toLowerCase() : ''
      if (rawUuid && baselineLookup.byUuid.has(rawUuid)) baselineIdx = baselineLookup.byUuid.get(rawUuid)
      else if (rawName && baselineLookup.byName.has(rawName)) baselineIdx = baselineLookup.byName.get(rawName)
      if (baselineIdx == null) return null
      return { baselineIdx, total: parseRowTotal(row), sourceIndex }
    })
    .filter(Boolean)
  decorated.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total
    return a.sourceIndex - b.sourceIndex
  })
  const out = {}
  const used = new Set()
  let rank = 0
  for (const e of decorated) {
    if (used.has(e.baselineIdx)) continue
    used.add(e.baselineIdx)
    out[e.baselineIdx] = rank
    rank += 1
  }
  return out
}

function normalizeIdentity(value) {
  if (typeof value !== 'string') return ''
  return value.trim().toLowerCase()
}

function rowIdentityCandidates(row) {
  if (!row || typeof row !== 'object') return []
  const candidates = [
    row.uuid,
    row.id,
    row.playerId,
    row.runnerId,
    row.name,
    row.runner,
    row.playerName,
    row.username,
  ]
  return candidates.map(normalizeIdentity).filter(Boolean)
}

function playerIdentityCandidates(player) {
  if (!player || typeof player !== 'object') return []
  return [player.uuid, player.name].map(normalizeIdentity).filter(Boolean)
}

function hasComparableOfficialRows(rows) {
  if (!Array.isArray(rows)) return false
  return rows.some((row) => rowIdentityCandidates(row).length > 0)
}

function resolveWinnerPid(rawWinner, pairIds, playerMap) {
  if (rawWinner == null) return null
  const candidate = String(rawWinner).trim()
  if (candidate === '') return null
  if (pairIds.includes(candidate)) return candidate
  const needle = candidate.toLowerCase()
  const byPair = pairIds.find((pid) => {
    const p = playerMap.get(pid)
    if (!p) return false
    const uuid = typeof p.uuid === 'string' ? p.uuid.trim().toLowerCase() : ''
    const name = typeof p.name === 'string' ? p.name.trim().toLowerCase() : ''
    return (uuid && uuid === needle) || (name && name === needle)
  })
  return byPair ?? null
}

/** @param {[number, number]} scores */
function winnerPidFromBoNScores(scores, max, pid0, pid1) {
  if (pid0 == null || pid1 == null) return null
  const [a, b] = scores
  if (a >= max && a > b) return pid0
  if (b >= max && b > a) return pid1
  return null
}

/** @param {[number, number]} scores */
function tryIncrementBoN(scores, side, max) {
  const [a, b] = scores
  const decidedA = a >= max && a > b
  const decidedB = b >= max && b > a

  // Match déjà gagné : le vainqueur ne peut plus prendre de jeu ; le perdant peut
  // monter tant qu’on n’arrive pas à un score impossible (ex. 2-2, 3-3).
  if (decidedA) {
    if (side === 0) return scores
    const nb = b + 1
    if (nb > max) return scores
    if (a >= max && nb >= max) return scores
    return [a, nb]
  }
  if (decidedB) {
    if (side === 1) return scores
    const na = a + 1
    if (na > max) return scores
    if (na >= max && b >= max) return scores
    return [na, b]
  }

  const na = side === 0 ? a + 1 : a
  const nb = side === 1 ? b + 1 : b
  if (na >= max && nb >= max) return scores
  return [na, nb]
}

/**
 * Actions prioritaires pour un clic sur toute la ligne d’un joueur (même logique que l’ancien « clic chiffre »).
 * À 2-1 / 3-2 : ligne du vainqueur → reset 0-0 ; ligne du perdant → inverse (1-2 / 2-3).
 * @param {[number, number]} score
 * @param {0 | 1} side joueur dont la ligne est cliquée
 */
function applyScoreDigitClick(score, side, max) {
  const [a, b] = score
  if (a === max && a > b) {
    if (side === 0) return [0, 0]
    if (side === 1 && b === max - 1) return [max - 1, max]
  }
  if (b === max && b > a) {
    if (side === 1) return [0, 0]
    if (side === 0 && a === max - 1) return [max, max - 1]
  }
  return score
}

/** @param {unknown} raw */
function parseSavedPairScore(raw, max) {
  if (!Array.isArray(raw) || raw.length !== 2) return null
  const a = Number(raw[0])
  const b = Number(raw[1])
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a > max || b > max) return null
  if (a >= max && b >= max) return null
  return [a, b]
}

function minimalScoreFromWinnerPid(winnerPid, pid0, pid1, max) {
  if (winnerPid == null || pid0 == null || pid1 == null) return [0, 0]
  if (winnerPid === pid0) return [max, 0]
  if (winnerPid === pid1) return [0, max]
  return [0, 0]
}

function mcHeadUrl(uuid) {
  if (uuid != null && String(uuid).trim() !== '') {
    return `https://mc-heads.net/avatar/${uuid}/48`
  }
  return DEFAULT_HEAD
}

/** @param {1 | 2} group */
function playerId(group, baselineIndex) {
  return `g${group}:${baselineIndex}`
}

function semi1PairIds(order1, order2) {
  return [playerId(1, order1[0]), playerId(2, order2[1])]
}

function semi2PairIds(order1, order2) {
  return [playerId(2, order2[0]), playerId(1, order1[1])]
}

function matchLoserId([a, b], winner) {
  if (!winner || !a || !b) return null
  if (winner === a) return b
  if (winner === b) return a
  return null
}

function formatLockDateLabel(lockAt) {
  if (typeof lockAt !== 'string' || lockAt.trim() === '') return null
  try {
    const isoLocalMatch = lockAt.match(
      /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/,
    )
    const date = isoLocalMatch
      ? new Date(
        Number(isoLocalMatch[1]),
        Number(isoLocalMatch[2]) - 1,
        Number(isoLocalMatch[3]),
        Number(isoLocalMatch[4]),
        Number(isoLocalMatch[5]),
        Number(isoLocalMatch[6] ?? '0'),
      )
      : new Date(lockAt)

    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'full',
      timeStyle: 'medium',
    }).format(date)
  } catch {
    return null
  }
}

function SortableGroupRow({ id, qualify, dragDisabled, resultClass = '', children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: dragDisabled,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  const rowClass = [
    qualify ? 'row-qualify' : '',
    resultClass,
    dragDisabled ? 'mrm-sortable-row--locked' : 'mrm-sortable-row',
    isDragging ? 'mrm-sortable-row--dragging' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={rowClass}
      {...attributes}
      {...(dragDisabled ? {} : listeners)}
    >
      {children}
    </tr>
  )
}

function SortableGroupTable({
  groupNum,
  baseline,
  order,
  onOrderChange,
  titleClassName,
  groupTitle,
  interactionsEnabled,
  isLocked = false,
  getRowResultClass = null,
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const sortableIds = useMemo(() => order.map((idx) => playerId(groupNum, idx)), [order, groupNum])

  const onDragEnd = useCallback(
    (event) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const a = String(active.id)
      const b = String(over.id)
      const oldIndex = sortableIds.indexOf(a)
      const newIndex = sortableIds.indexOf(b)
      if (oldIndex < 0 || newIndex < 0) return
      onOrderChange(arrayMove(order, oldIndex, newIndex))
    },
    [onOrderChange, order, sortableIds],
  )

  return (
    <div className={`group-table group-table-${groupNum} ${isLocked ? 'mrm-group-table--locked' : ''}`}>
      <div className="group-table-scroll">
        <div className={`group-title ${titleClassName}`}>{groupTitle}</div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <table>
            <thead>
              <tr>
                <th className="col-rank">#</th>
                <th className="col-player">Runner</th>
                <th>S1</th>
                <th>S2</th>
                <th>S3</th>
                <th>S4</th>
                <th>S5</th>
                <th>S6</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                {order.map((baselineIdx, rank) => {
                  const p = baseline[baselineIdx]
                  const sid = playerId(groupNum, baselineIdx)
                  const resultClass =
                    typeof getRowResultClass === 'function' ? getRowResultClass(baselineIdx, rank, p) : ''
                  return (
                    <SortableGroupRow
                      key={sid}
                      id={sid}
                      qualify={rank < 2}
                      dragDisabled={!interactionsEnabled}
                      resultClass={resultClass}
                    >
                      <td className="col-rank">{rank + 1}</td>
                      <td className="col-player">
                        <img src={mcHeadUrl(p.uuid)} alt="" className="player-head" />
                        &nbsp; &nbsp;
                        {p.name}
                      </td>
                      <td>{p.s1}</td>
                      <td>{p.s2}</td>
                      <td>{p.s3}</td>
                      <td>{p.s4}</td>
                      <td>{p.s5}</td>
                      <td>{p.s6}</td>
                      <td className="col-pts">{p.total}</td>
                    </SortableGroupRow>
                  )
                })}
              </SortableContext>
            </tbody>
          </table>
        </DndContext>
      </div>
    </div>
  )
}

function BracketScoredPlayerRow({
  pid,
  player,
  side,
  scoreValue,
  matchScores,
  maxScore,
  winnerPid,
  pickable,
  onIncrement,
  onScoreDigit,
  comparisonClass = '',
}) {
  const isWinner = pid != null && winnerPid === pid
  const isTbd =
    pid == null ||
    !player ||
    !player.name ||
    String(player.name).trim() === '' ||
    player.name === 'TBD'
  if (isTbd) {
    return (
      <div className={['player', 'tbd', comparisonClass].filter(Boolean).join(' ')}>
        <div className="player-info">
          <img src={DEFAULT_HEAD} alt="" className="player-head" width={24} height={24} />
          <span>TBD</span>
        </div>
        <span className="player-score">{scoreValue}</span>
      </div>
    )
  }
  const isLoser = winnerPid != null && !isWinner
  const rowCls = ['mrm-bracket-scored-row']
  if (comparisonClass) rowCls.push(comparisonClass)
  if (isWinner) rowCls.push('mrm-match-winner')
  else if (isLoser) rowCls.push('mrm-match-loser')
  if (!pickable) rowCls.push('mrm-bracket-scored-row--disabled')

  const handleRowClick = () => {
    if (!pickable || !Array.isArray(matchScores) || matchScores.length !== 2) return
    const [a, b] = matchScores
    const next = applyScoreDigitClick(matchScores, side, maxScore)
    if (next[0] !== a || next[1] !== b) {
      onScoreDigit(side)
      return
    }
    onIncrement(side)
  }

  return (
    <button
      type="button"
      className={rowCls.filter(Boolean).join(' ')}
      disabled={!pickable}
      onClick={handleRowClick}
      aria-label={`${player.name}, ${scoreValue} jeu(x)`}
    >
      <img src={mcHeadUrl(player.uuid)} alt="" className="player-head mrm-bracket-head" width={24} height={24} />
      <span className="mrm-bracket-name">{player.name}</span>
      <span className="mrm-bracket-score-area player-score">{scoreValue}</span>
    </button>
  )
}

function MrmPrediction() {
  const location = useLocation()
  const g1 = groupe1Baseline
  const g2 = groupe2Baseline

  const [discordUser, setDiscordUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)

  const [order1, setOrder1] = useState(() => Array.from({ length: g1.length }, (_, i) => i))
  const [order2, setOrder2] = useState(() => Array.from({ length: g2.length }, (_, i) => i))
  const [semi1Score, setSemi1Score] = useState(() => [0, 0])
  const [semi2Score, setSemi2Score] = useState(() => [0, 0])
  const [thirdPlaceScore, setThirdPlaceScore] = useState(() => [0, 0])
  const [finalScore, setFinalScore] = useState(() => [0, 0])
  const [hydrated, setHydrated] = useState(false)
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false)
  const [isScoringOpen, setIsScoringOpen] = useState(false)
  const [lockInfo, setLockInfo] = useState(DEFAULT_LOCK_STATE)
  const [finishedInfo, setFinishedInfo] = useState(DEFAULT_FINISHED_STATE)
  const [officialInfo, setOfficialInfo] = useState(null)

  /** Payload JSON dernier aligné serveur / dernier POST réussi — pas de POST si identique à l’état courant. */
  const baselinePredictionPayloadRef = useRef(null)
  /** Après GET : une capture de baseline depuis l’état React (post-effets de réconciliation), puis false. */
  const captureBaselineAfterHydrateRef = useRef(false)
  const semi1PairKeyRef = useRef('')
  const semi2PairKeyRef = useRef('')
  const thirdPairKeyRef = useRef('')
  const finalPairKeyRef = useRef('')

  const isGlobalLocked = lockInfo.global.locked === true
  const isGroup1Locked = isGlobalLocked || lockInfo.group1.locked === true
  const isGroup2Locked = isGlobalLocked || lockInfo.group2.locked === true
  const isPlayoffsLocked = isGlobalLocked || lockInfo.playoffs.locked === true
  const groupsStatusText =
    isGroup1Locked && isGroup2Locked
      ? 'Les groupes sont verrouillés : le classement n’est plus modifiable.'
      : isGroup1Locked
        ? 'Le groupe 1 est verrouillé ; seul le groupe 2 reste modifiable.'
        : isGroup2Locked
          ? 'Le groupe 2 est verrouillé ; seul le groupe 1 reste modifiable.'
          : 'Fais glisser les lignes pour définir ton classement'

  const globalLockAtLabel = useMemo(() => formatLockDateLabel(lockInfo.global.lockAt), [lockInfo.global.lockAt])
  const group1LockAtLabel = useMemo(() => formatLockDateLabel(lockInfo.group1.lockAt), [lockInfo.group1.lockAt])
  const group2LockAtLabel = useMemo(() => formatLockDateLabel(lockInfo.group2.lockAt), [lockInfo.group2.lockAt])
  const playoffsLockAtLabel = useMemo(() => formatLockDateLabel(lockInfo.playoffs.lockAt), [lockInfo.playoffs.lockAt])

  const canEditGroup1 = !isGroup1Locked && authChecked && discordUser != null && hydrated
  const canEditGroup2 = !isGroup2Locked && authChecked && discordUser != null && hydrated
  const canEditPlayoffs = !isPlayoffsLocked && authChecked && discordUser != null && hydrated
  const canSyncPrediction = authChecked && discordUser != null && hydrated

  const playerMap = useMemo(() => {
    const m = new Map()
    g1.forEach((p, i) => m.set(playerId(1, i), p))
    g2.forEach((p, i) => m.set(playerId(2, i), p))
    return m
  }, [g1, g2])

  /** Tant que les deux groupes ne sont pas verrouillés, le bracket n’affiche pas les qualifiés (TBD). */
  const showPlayoffBracketMatchups = isGroup1Locked && isGroup2Locked
  const bracketRowPickable = canEditPlayoffs && showPlayoffBracketMatchups
  const bracketDisplayPid = (id) => (showPlayoffBracketMatchups ? id : null)
  const bracketDisplayPlayer = (id) =>
    showPlayoffBracketMatchups && id != null ? playerMap.get(id) : null

  const s1Ids = useMemo(() => semi1PairIds(order1, order2), [order1, order2])
  const s2Ids = useMemo(() => semi2PairIds(order1, order2), [order1, order2])

  const semi1Winner = useMemo(
    () => winnerPidFromBoNScores(semi1Score, 2, s1Ids[0], s1Ids[1]),
    [semi1Score, s1Ids[0], s1Ids[1]],
  )
  const semi2Winner = useMemo(
    () => winnerPidFromBoNScores(semi2Score, 2, s2Ids[0], s2Ids[1]),
    [semi2Score, s2Ids[0], s2Ids[1]],
  )

  const finalistIds = useMemo(() => {
    const a = [semi1Winner, semi2Winner].filter(Boolean)
    return a.length === 2 ? a : [null, null]
  }, [semi1Winner, semi2Winner])

  const finalWinner = useMemo(
    () => winnerPidFromBoNScores(finalScore, 3, finalistIds[0], finalistIds[1]),
    [finalScore, finalistIds[0], finalistIds[1]],
  )

  const petiteFinaleIds = useMemo(() => {
    const loser1 = matchLoserId(s1Ids, semi1Winner)
    const loser2 = matchLoserId(s2Ids, semi2Winner)
    return loser1 && loser2 ? [loser1, loser2] : [null, null]
  }, [s1Ids, s2Ids, semi1Winner, semi2Winner])

  const thirdPlaceWinner = useMemo(
    () => winnerPidFromBoNScores(thirdPlaceScore, 2, petiteFinaleIds[0], petiteFinaleIds[1]),
    [thirdPlaceScore, petiteFinaleIds[0], petiteFinaleIds[1]],
  )

  const predictionStateRef = useRef({
    order1,
    order2,
    semi1Score,
    semi2Score,
    thirdPlaceScore,
    finalScore,
    semi1Winner: null,
    semi2Winner: null,
    thirdPlaceWinner: null,
    finalWinner: null,
  })

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        try {
          const res = await fetch('/api/auth/me', { credentials: 'include' })
          const data = res.ok ? await res.json() : { user: null }
          if (!cancelled) setDiscordUser(data.user ?? null)
        } catch {
          if (!cancelled) setDiscordUser(null)
        } finally {
          if (!cancelled) setAuthChecked(true)
        }
      })()
    return () => {
      cancelled = true
    }
  }, [location.pathname])

  useEffect(() => {
    if (!authChecked) return

    baselinePredictionPayloadRef.current = null
    captureBaselineAfterHydrateRef.current = false
    semi1PairKeyRef.current = ''
    semi2PairKeyRef.current = ''
    thirdPairKeyRef.current = ''
    finalPairKeyRef.current = ''
    setHydrated(false)
    let cancelled = false
      ; (async () => {
        const defaultOrder1 = Array.from({ length: g1.length }, (_, i) => i)
        const defaultOrder2 = Array.from({ length: g2.length }, (_, i) => i)

        try {
          const res = await fetch(mrmPredictionApiUrl, { credentials: 'include' })
          const data = await res.json().catch(() => ({}))
          if (!cancelled) {
            const rawLocks = data?.locks && typeof data.locks === 'object' ? data.locks : {}
            setFinishedInfo(normalizeFinishedState(data?.finished ?? data?.scoringPhases))
            setOfficialInfo(normalizeOfficialState(data?.official))
            setLockInfo({
              global: normalizeLockEntry(rawLocks.global, data?.locked === true, data?.lockAt),
              group1: normalizeLockEntry(
                rawLocks.group1,
                data?.lockedGroup1 === true || data?.group1Locked === true,
                data?.lockAtGroup1 ?? data?.group1LockAt,
              ),
              group2: normalizeLockEntry(
                rawLocks.group2,
                data?.lockedGroup2 === true || data?.group2Locked === true,
                data?.lockAtGroup2 ?? data?.group2LockAt,
              ),
              playoffs: normalizeLockEntry(
                rawLocks.playoffs,
                data?.lockedPlayoffs === true || data?.playoffsLocked === true,
                data?.lockAtPlayoffs ?? data?.playoffsLockAt,
              ),
              serverNow: typeof data?.serverNow === 'string' ? data.serverNow : null,
            })
          }
          const pred = discordUser && data?.prediction && typeof data.prediction === 'object' ? data.prediction : null
          if (cancelled) return

          if (pred) {
            const o1 = reconcileOrder(g1.length, pred.order1)
            const o2 = reconcileOrder(g2.length, pred.order2)
            setOrder1(o1)
            setOrder2(o2)
            const s1 = semi1PairIds(o1, o2)
            const s2 = semi2PairIds(o1, o2)
            const sc1 =
              parseSavedPairScore(pred.semi1Score, 2) ??
              minimalScoreFromWinnerPid(
                pred.semi1Winner && s1.includes(pred.semi1Winner) ? pred.semi1Winner : null,
                s1[0],
                s1[1],
                2,
              )
            const sc2 =
              parseSavedPairScore(pred.semi2Score, 2) ??
              minimalScoreFromWinnerPid(
                pred.semi2Winner && s2.includes(pred.semi2Winner) ? pred.semi2Winner : null,
                s2[0],
                s2[1],
                2,
              )
            setSemi1Score(sc1)
            setSemi2Score(sc2)
            const w1 = winnerPidFromBoNScores(sc1, 2, s1[0], s1[1])
            const w2 = winnerPidFromBoNScores(sc2, 2, s2[0], s2[1])
            const thirdPlaceFinalists = [matchLoserId(s1, w1), matchLoserId(s2, w2)].filter(Boolean)
            const pf0 = thirdPlaceFinalists[0] ?? null
            const pf1 = thirdPlaceFinalists[1] ?? null
            const thirdPlaceWinnerRaw = pred.thirdPlaceWinner ?? pred.petiteFinaleWinner ?? pred.smallFinalWinner ?? null
            const tpResolved =
              thirdPlaceWinnerRaw &&
                thirdPlaceFinalists.length === 2 &&
                thirdPlaceFinalists.includes(thirdPlaceWinnerRaw)
                ? thirdPlaceWinnerRaw
                : null
            const scThird =
              parseSavedPairScore(pred.thirdPlaceScore ?? pred.petiteFinaleScore, 2) ??
              minimalScoreFromWinnerPid(tpResolved, pf0, pf1, 2)
            setThirdPlaceScore(scThird)
            const finalists = [w1, w2].filter(Boolean)
            const f0 = finalists[0] ?? null
            const f1 = finalists[1] ?? null
            const fwResolved =
              pred.finalWinner && finalists.length === 2 && finalists.includes(pred.finalWinner)
                ? pred.finalWinner
                : null
            const scFinal =
              parseSavedPairScore(pred.finalScore, 3) ?? minimalScoreFromWinnerPid(fwResolved, f0, f1, 3)
            setFinalScore(scFinal)
          } else {
            setOrder1(defaultOrder1)
            setOrder2(defaultOrder2)
            setSemi1Score([0, 0])
            setSemi2Score([0, 0])
            setThirdPlaceScore([0, 0])
            setFinalScore([0, 0])
          }
        } catch {
          if (!cancelled) {
            setFinishedInfo(DEFAULT_FINISHED_STATE)
            setOfficialInfo(null)
            setOrder1(defaultOrder1)
            setOrder2(defaultOrder2)
            setSemi1Score([0, 0])
            setSemi2Score([0, 0])
            setThirdPlaceScore([0, 0])
            setFinalScore([0, 0])
          }
        } finally {
          if (!cancelled) {
            captureBaselineAfterHydrateRef.current = true
            setHydrated(true)
          }
        }
      })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- g1/g2 lengths follow imports
  }, [authChecked, discordUser, location.pathname])

  useEffect(() => {
    if (!hydrated) return
    const k = `${s1Ids[0] ?? ''}|${s1Ids[1] ?? ''}`
    if (semi1PairKeyRef.current === '') {
      semi1PairKeyRef.current = k
      return
    }
    if (semi1PairKeyRef.current !== k) {
      semi1PairKeyRef.current = k
      setSemi1Score([0, 0])
    }
  }, [hydrated, s1Ids[0], s1Ids[1]])

  useEffect(() => {
    if (!hydrated) return
    const k = `${s2Ids[0] ?? ''}|${s2Ids[1] ?? ''}`
    if (semi2PairKeyRef.current === '') {
      semi2PairKeyRef.current = k
      return
    }
    if (semi2PairKeyRef.current !== k) {
      semi2PairKeyRef.current = k
      setSemi2Score([0, 0])
    }
  }, [hydrated, s2Ids[0], s2Ids[1]])

  useEffect(() => {
    if (!hydrated) return
    const k = `${petiteFinaleIds[0] ?? ''}|${petiteFinaleIds[1] ?? ''}`
    if (thirdPairKeyRef.current === '') {
      thirdPairKeyRef.current = k
      return
    }
    if (thirdPairKeyRef.current !== k) {
      thirdPairKeyRef.current = k
      setThirdPlaceScore([0, 0])
    }
  }, [hydrated, petiteFinaleIds[0], petiteFinaleIds[1]])

  useEffect(() => {
    if (!hydrated) return
    const k = `${finalistIds[0] ?? ''}|${finalistIds[1] ?? ''}`
    if (finalPairKeyRef.current === '') {
      finalPairKeyRef.current = k
      return
    }
    if (finalPairKeyRef.current !== k) {
      finalPairKeyRef.current = k
      setFinalScore([0, 0])
    }
  }, [hydrated, finalistIds[0], finalistIds[1]])

  /** Après GET + effets de réconciliation : figer la baseline sans POST (état lu après le prochain tick). */
  useEffect(() => {
    if (!hydrated || !canSyncPrediction || !captureBaselineAfterHydrateRef.current) return
    const t = setTimeout(() => {
      if (!captureBaselineAfterHydrateRef.current) return
      const s = predictionStateRef.current
      baselinePredictionPayloadRef.current = JSON.stringify({
        order1: s.order1,
        order2: s.order2,
        semi1Score: s.semi1Score,
        semi2Score: s.semi2Score,
        thirdPlaceScore: s.thirdPlaceScore,
        finalScore: s.finalScore,
        semi1Winner: s.semi1Winner ?? null,
        semi2Winner: s.semi2Winner ?? null,
        thirdPlaceWinner: s.thirdPlaceWinner ?? null,
        finalWinner: s.finalWinner ?? null,
      })
      captureBaselineAfterHydrateRef.current = false
    }, 0)
    return () => clearTimeout(t)
  }, [
    hydrated,
    canSyncPrediction,
    order1,
    order2,
    semi1Score,
    semi2Score,
    thirdPlaceScore,
    finalScore,
    semi1Winner,
    semi2Winner,
    thirdPlaceWinner,
    finalWinner,
  ])

  useEffect(() => {
    if (!hydrated || !canSyncPrediction) return
    if (captureBaselineAfterHydrateRef.current) return

    const payload = {
      order1,
      order2,
      semi1Score,
      semi2Score,
      thirdPlaceScore,
      finalScore,
      semi1Winner: semi1Winner ?? null,
      semi2Winner: semi2Winner ?? null,
      thirdPlaceWinner: thirdPlaceWinner ?? null,
      finalWinner: finalWinner ?? null,
    }
    const payloadStr = JSON.stringify(payload)
    if (baselinePredictionPayloadRef.current !== null && payloadStr === baselinePredictionPayloadRef.current) {
      return
    }

    const syncTimer = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(mrmPredictionApiUrl, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: payloadStr,
          })
          if (!res.ok) {
            const errText = await res.text().catch(() => '')
            console.warn('[MRM prediction sync]', res.status, errText)
          } else {
            baselinePredictionPayloadRef.current = payloadStr
          }
        } catch (e) {
          console.warn('[MRM prediction sync]', e)
        }
      })()
    }, 450)
    return () => clearTimeout(syncTimer)
  }, [
    hydrated,
    canSyncPrediction,
    order1,
    order2,
    semi1Score,
    semi2Score,
    thirdPlaceScore,
    finalScore,
    semi1Winner,
    semi2Winner,
    thirdPlaceWinner,
    finalWinner,
  ])

  const g1Lookup = useMemo(() => buildBaselineLookup(g1), [g1])
  const g2Lookup = useMemo(() => buildBaselineLookup(g2), [g2])

  const officialGroup1Ranks = useMemo(() => {
    if (!finishedInfo.group1) return {}
    return rankMapFromOfficialGroupRowsByTotal(officialInfo?.group1, g1Lookup)
  }, [finishedInfo.group1, officialInfo?.group1, g1Lookup])

  const officialGroup2Ranks = useMemo(() => {
    if (!finishedInfo.group2) return {}
    return rankMapFromOfficialGroupRowsByTotal(officialInfo?.group2, g2Lookup)
  }, [finishedInfo.group2, officialInfo?.group2, g2Lookup])

  const officialGroup1Rows = useMemo(
    () => (Array.isArray(officialInfo?.group1) ? officialInfo.group1 : []),
    [officialInfo],
  )
  const officialGroup2Rows = useMemo(
    () => (Array.isArray(officialInfo?.group2) ? officialInfo.group2 : []),
    [officialInfo],
  )

  const officialSemi1WinnerPid = useMemo(
    () => resolveWinnerPid(officialInfo?.semi1Winner, s1Ids, playerMap),
    [officialInfo, s1Ids, playerMap],
  )
  const officialSemi2WinnerPid = useMemo(
    () => resolveWinnerPid(officialInfo?.semi2Winner, s2Ids, playerMap),
    [officialInfo, s2Ids, playerMap],
  )
  const officialThirdPlaceWinnerPid = useMemo(
    () => resolveWinnerPid(officialInfo?.thirdPlaceWinner, petiteFinaleIds.filter(Boolean), playerMap),
    [officialInfo, petiteFinaleIds, playerMap],
  )

  const runnerUpId = useMemo(() => {
    if (!finalWinner || finalistIds[0] == null) return null
    const [x, y] = finalistIds
    if (x === finalWinner) return y
    if (y === finalWinner) return x
    return null
  }, [finalWinner, finalistIds])

  const firstPlayer =
    showPlayoffBracketMatchups && finalWinner ? playerMap.get(finalWinner) : null
  const secondPlayer =
    showPlayoffBracketMatchups && runnerUpId ? playerMap.get(runnerUpId) : null
  const thirdPlayer =
    showPlayoffBracketMatchups && thirdPlaceWinner ? playerMap.get(thirdPlaceWinner) : null
  const officialFinalWinnerPid = useMemo(
    () => resolveWinnerPid(officialInfo?.finalWinner, finalistIds.filter(Boolean), playerMap),
    [officialInfo, finalistIds, playerMap],
  )

  const groupRowResultClass = useCallback((baselineIdx, rank, rankMap, enabled, player, officialRows = []) => {
    if (!enabled) return ''
    const hasRankMap = rankMap && Object.keys(rankMap).length > 0
    const hasComparableRows = hasComparableOfficialRows(officialRows)
    if (!hasRankMap && !hasComparableRows) return 'mrm-group-row-result-neutral'
    const officialRank = rankMap[baselineIdx]
    if (typeof officialRank === 'number') {
      const delta = Math.abs(rank - officialRank)
      if (delta === 0) return 'mrm-group-row-result-correct'
      if (delta === 1) return 'mrm-group-row-result-near'
      return 'mrm-group-row-result-wrong'
    }
    const playerIds = playerIdentityCandidates(player)
    if (playerIds.length === 0) return 'mrm-group-row-result-neutral'
    const matchDeltas = []
    officialRows.forEach((row, officialPos) => {
      const rowIds = rowIdentityCandidates(row)
      if (rowIds.length === 0) return
      if (playerIds.some((id) => rowIds.includes(id))) {
        matchDeltas.push(Math.abs(rank - officialPos))
      }
    })
    if (matchDeltas.length === 0) return 'mrm-group-row-result-neutral'
    const delta = Math.min(...matchDeltas)
    if (delta === 0) return 'mrm-group-row-result-correct'
    if (delta === 1) return 'mrm-group-row-result-near'
    return 'mrm-group-row-result-wrong'
  }, [])

  const bracketResultClass = useCallback((pid, pickedWinner, officialWinner, enabled) => {
    if (!enabled || pid == null) return ''
    if (!officialWinner) return 'mrm-match-result-neutral'
    if (pickedWinner === officialWinner) {
      return pid === officialWinner ? 'mrm-match-result-correct' : 'mrm-match-result-neutral'
    }
    if (pickedWinner && pid === pickedWinner) return 'mrm-match-result-wrong-selected'
    if (pid === officialWinner) return 'mrm-match-result-official'
    return 'mrm-match-result-neutral'
  }, [])

  predictionStateRef.current = {
    order1,
    order2,
    semi1Score,
    semi2Score,
    thirdPlaceScore,
    finalScore,
    semi1Winner,
    semi2Winner,
    thirdPlaceWinner,
    finalWinner,
  }

  return (
    <div className="d-flex flex-column align-items-center text-white mrm-container mrm-prediction">
      <div className="mrm-header">
        <div className="mrm-title-row">
          <span className="mrm-title">PRONOSTIQUES MRM </span>
          <span className="mrm-season">S10</span>
        </div>
        <span className="mrm-subtitle">Prédis les résultats et gagne des points dans le classement</span>
      </div>

      <div className="section-divider" />

      {authChecked && !discordUser ? (
        <div className="mrm-prediction-auth-banner" role="status">
          <span>
            Connecte-toi pour enregistrer et modifier tes prédictions
          </span>
          <a className="mrm-prediction-auth-link" href="/api/auth/discord">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 127.14 96.36" fill="currentColor" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
              <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
            </svg>
            Discord
          </a>
        </div>
      ) : null}
      {isGlobalLocked ? (
        <div className="mrm-prediction-auth-banner mrm-prediction-auth-banner--locks" role="status">
          <span>
            Tous les pronostiques sont verrouillés
            {globalLockAtLabel ? ` depuis le ${globalLockAtLabel}` : ''}. La modification n&apos;est plus possible.
          </span>
        </div>
      ) : isGroup1Locked || isGroup2Locked || isPlayoffsLocked ? (
        <div className="mrm-prediction-auth-banner mrm-prediction-auth-banner--locks" role="status">
          <div>
            <strong>Sections verrouillees :</strong>
            <ul className="mrm-prediction-lock-list">
              {isGroup1Locked ? <li>Groupe 1{group1LockAtLabel ? ` (depuis ${group1LockAtLabel})` : ''}</li> : null}
              {isGroup2Locked ? <li>Groupe 2{group2LockAtLabel ? ` (depuis ${group2LockAtLabel})` : ''}</li> : null}
              {isPlayoffsLocked ? <li>Playoffs{playoffsLockAtLabel ? ` (depuis ${playoffsLockAtLabel})` : ''}</li> : null}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="mrm-prediction-content-wrap">
        <aside className="mrm-prediction-scoring-shell" aria-label="Barème des pronostics">
          <button
            type="button"
            className="mrm-prediction-scoring-toggle"
            aria-expanded={isScoringOpen}
            aria-controls="mrm-prediction-scoring-panel"
            aria-label={isScoringOpen ? 'Masquer le barème pronos' : 'Afficher le barème pronos'}
            onClick={() => setIsScoringOpen((open) => !open)}
          >
            {isScoringOpen ? 'Masquer le barème' : 'Barème pronos'}
          </button>
          <div
            id="mrm-prediction-scoring-panel"
            className={[
              'mrm-prediction-scoring-panel',
              isScoringOpen ? 'mrm-prediction-scoring-panel--open' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="mrm-prediction-scoring-card">
              <div className="mrm-prediction-scoring-header">BARÈME PRONOS</div>
              <div className="mrm-prediction-scoring-body">
                <p className="mrm-prediction-scoring-section">Phase de groupes</p>
                <ul className="mrm-prediction-scoring-list">
                  <li>Position exacte: +4</li>
                  <li>Écart d'une place: +2</li>
                </ul>
                <p className="mrm-prediction-scoring-section">Phase finale</p>
                <ul className="mrm-prediction-scoring-list">
                  <li>Finale correcte: +14</li>
                  <li>Petite finale correcte: +8</li>
                  <li>Demi-finale correcte: +8</li>
                  <li>Score match correct: +4</li>
                </ul>
              </div>
            </div>
          </div>
        </aside>
        <aside className="mrm-prediction-leaderboard-shell">
          <button
            type="button"
            className="mrm-prediction-leaderboard-toggle"
            aria-expanded={isLeaderboardOpen}
            aria-controls="mrm-prediction-leaderboard-panel"
            aria-label={
              isLeaderboardOpen
                ? 'Masquer le classement des pronostics'
                : 'Afficher le classement des pronostics'
            }
            onClick={() => setIsLeaderboardOpen((open) => !open)}
          >
            {isLeaderboardOpen ? 'Masquer le classement' : 'Classement pronos'}
          </button>
          <div
            id="mrm-prediction-leaderboard-panel"
            className={[
              'mrm-prediction-leaderboard-panel',
              isLeaderboardOpen ? 'mrm-prediction-leaderboard-panel--open' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <MrmPronosLeaderboard highlightUserId={discordUser?.id ?? null} />
          </div>
        </aside>
        <div className="container">
          <div className="container-first">
            <div className={`mrm-playoffs ${isPlayoffsLocked ? 'mrm-playoffs--locked' : ''}`}>
              <div className="mrm-prediction-playoffs-head">
                <h2 className="playoffs-title">PHASE FINALE</h2>
              </div>
              <div className="bracket">
                <div className="bracket-labels">
                  <div className="round-label">DEMI-FINALE 1</div>
                  <div className="round-label-spacer" />
                  <div className="round-label round-label-finale">FINALE</div>
                  <div className="round-label-spacer" />
                  <div className="round-label">DEMI-FINALE 2</div>
                </div>
                <div className="bracket-matches">
                  <div className="match">
                    <BracketScoredPlayerRow
                      pid={bracketDisplayPid(s1Ids[0])}
                      player={bracketDisplayPlayer(s1Ids[0])}
                      side={0}
                      scoreValue={semi1Score[0]}
                      matchScores={semi1Score}
                      maxScore={2}
                      winnerPid={semi1Winner}
                      pickable={bracketRowPickable}
                      onIncrement={(side) => setSemi1Score((s) => tryIncrementBoN(s, side, 2))}
                      onScoreDigit={(side) => setSemi1Score((s) => applyScoreDigitClick(s, side, 2))}
                      comparisonClass={bracketResultClass(
                        bracketDisplayPid(s1Ids[0]),
                        semi1Winner,
                        officialSemi1WinnerPid,
                        finishedInfo.semi1,
                      )}
                    />
                    <BracketScoredPlayerRow
                      pid={bracketDisplayPid(s1Ids[1])}
                      player={bracketDisplayPlayer(s1Ids[1])}
                      side={1}
                      scoreValue={semi1Score[1]}
                      matchScores={semi1Score}
                      maxScore={2}
                      winnerPid={semi1Winner}
                      pickable={bracketRowPickable}
                      onIncrement={(side) => setSemi1Score((s) => tryIncrementBoN(s, side, 2))}
                      onScoreDigit={(side) => setSemi1Score((s) => applyScoreDigitClick(s, side, 2))}
                      comparisonClass={bracketResultClass(
                        bracketDisplayPid(s1Ids[1]),
                        semi1Winner,
                        officialSemi1WinnerPid,
                        finishedInfo.semi1,
                      )}
                    />
                  </div>
                  <div className="connector connector-left" />
                  <div className={`match match-final ${isPlayoffsLocked ? 'match-final--locked' : ''}`}>
                    <BracketScoredPlayerRow
                      pid={bracketDisplayPid(finalistIds[0])}
                      player={bracketDisplayPlayer(finalistIds[0])}
                      side={0}
                      scoreValue={finalScore[0]}
                      matchScores={finalScore}
                      maxScore={3}
                      winnerPid={finalWinner}
                      pickable={bracketRowPickable && finalistIds[0] != null && finalistIds[1] != null}
                      onIncrement={(side) => setFinalScore((s) => tryIncrementBoN(s, side, 3))}
                      onScoreDigit={(side) => setFinalScore((s) => applyScoreDigitClick(s, side, 3))}
                      comparisonClass={bracketResultClass(
                        bracketDisplayPid(finalistIds[0]),
                        finalWinner,
                        officialFinalWinnerPid,
                        finishedInfo.final,
                      )}
                    />
                    <BracketScoredPlayerRow
                      pid={bracketDisplayPid(finalistIds[1])}
                      player={bracketDisplayPlayer(finalistIds[1])}
                      side={1}
                      scoreValue={finalScore[1]}
                      matchScores={finalScore}
                      maxScore={3}
                      winnerPid={finalWinner}
                      pickable={bracketRowPickable && finalistIds[0] != null && finalistIds[1] != null}
                      onIncrement={(side) => setFinalScore((s) => tryIncrementBoN(s, side, 3))}
                      onScoreDigit={(side) => setFinalScore((s) => applyScoreDigitClick(s, side, 3))}
                      comparisonClass={bracketResultClass(
                        bracketDisplayPid(finalistIds[1]),
                        finalWinner,
                        officialFinalWinnerPid,
                        finishedInfo.final,
                      )}
                    />
                  </div>
                  <div className="connector connector-right" />
                  <div className="match">
                    <BracketScoredPlayerRow
                      pid={bracketDisplayPid(s2Ids[0])}
                      player={bracketDisplayPlayer(s2Ids[0])}
                      side={0}
                      scoreValue={semi2Score[0]}
                      matchScores={semi2Score}
                      maxScore={2}
                      winnerPid={semi2Winner}
                      pickable={bracketRowPickable}
                      onIncrement={(side) => setSemi2Score((s) => tryIncrementBoN(s, side, 2))}
                      onScoreDigit={(side) => setSemi2Score((s) => applyScoreDigitClick(s, side, 2))}
                      comparisonClass={bracketResultClass(
                        bracketDisplayPid(s2Ids[0]),
                        semi2Winner,
                        officialSemi2WinnerPid,
                        finishedInfo.semi2,
                      )}
                    />
                    <BracketScoredPlayerRow
                      pid={bracketDisplayPid(s2Ids[1])}
                      player={bracketDisplayPlayer(s2Ids[1])}
                      side={1}
                      scoreValue={semi2Score[1]}
                      matchScores={semi2Score}
                      maxScore={2}
                      winnerPid={semi2Winner}
                      pickable={bracketRowPickable}
                      onIncrement={(side) => setSemi2Score((s) => tryIncrementBoN(s, side, 2))}
                      onScoreDigit={(side) => setSemi2Score((s) => applyScoreDigitClick(s, side, 2))}
                      comparisonClass={bracketResultClass(
                        bracketDisplayPid(s2Ids[1]),
                        semi2Winner,
                        officialSemi2WinnerPid,
                        finishedInfo.semi2,
                      )}
                    />
                  </div>
                </div>
                <div className="third-place-wrapper">
                  <svg className="third-place-connectors" width="546" height="95" viewBox="0 0 546 95" xmlns="http://www.w3.org/2000/svg">
                    <path d="M 173 0 L 174 88 L 198 88" stroke="#3a3a3a" strokeWidth="2" strokeDasharray="5 3" fill="none" />
                    <path d="M 373 0 L 372 88 L 348 88" stroke="#3a3a3a" strokeWidth="2" strokeDasharray="5 3" fill="none" />
                  </svg>
                  <div className="bracket-third-place">
                    <div className="round-label round-label-third">PETITE FINALE</div>
                    <div className="match match-third-place">
                      <BracketScoredPlayerRow
                        pid={bracketDisplayPid(petiteFinaleIds[0])}
                        player={bracketDisplayPlayer(petiteFinaleIds[0])}
                        side={0}
                        scoreValue={thirdPlaceScore[0]}
                        matchScores={thirdPlaceScore}
                        maxScore={2}
                        winnerPid={thirdPlaceWinner}
                        pickable={bracketRowPickable && petiteFinaleIds[0] != null && petiteFinaleIds[1] != null}
                        onIncrement={(side) => setThirdPlaceScore((s) => tryIncrementBoN(s, side, 2))}
                        onScoreDigit={(side) => setThirdPlaceScore((s) => applyScoreDigitClick(s, side, 2))}
                        comparisonClass={bracketResultClass(
                          bracketDisplayPid(petiteFinaleIds[0]),
                          thirdPlaceWinner,
                          officialThirdPlaceWinnerPid,
                          finishedInfo.thirdPlace,
                        )}
                      />
                      <BracketScoredPlayerRow
                        pid={bracketDisplayPid(petiteFinaleIds[1])}
                        player={bracketDisplayPlayer(petiteFinaleIds[1])}
                        side={1}
                        scoreValue={thirdPlaceScore[1]}
                        matchScores={thirdPlaceScore}
                        maxScore={2}
                        winnerPid={thirdPlaceWinner}
                        pickable={bracketRowPickable && petiteFinaleIds[0] != null && petiteFinaleIds[1] != null}
                        onIncrement={(side) => setThirdPlaceScore((s) => tryIncrementBoN(s, side, 2))}
                        onScoreDigit={(side) => setThirdPlaceScore((s) => applyScoreDigitClick(s, side, 2))}
                        comparisonClass={bracketResultClass(
                          bracketDisplayPid(petiteFinaleIds[1]),
                          thirdPlaceWinner,
                          officialThirdPlaceWinnerPid,
                          finishedInfo.thirdPlace,
                        )}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mrm-podium">
              <h2 className="podium-title">PODIUM</h2>
              <div className="podium-wrapper">
                <div className="podium-player podium-second">
                  <div className="podium-head">
                    <img src={secondPlayer ? mcHeadUrl(secondPlayer.uuid) : DEFAULT_HEAD} className="player-head" alt="" />
                  </div>
                  <div className="podium-name">{secondPlayer?.name ?? 'TBD'}</div>
                  <div className="podium-block podium-block-second">
                    <span className="podium-rank">2</span>
                  </div>
                </div>
                <div className="podium-player podium-first">
                  <div className="podium-head">
                    <img src={firstPlayer ? mcHeadUrl(firstPlayer.uuid) : DEFAULT_HEAD} className="player-head" alt="" />
                  </div>
                  <div className="podium-name">{firstPlayer?.name ?? 'TBD'}</div>
                  <div className="podium-block podium-block-first">
                    <span className="podium-rank">1</span>
                  </div>
                </div>
                <div className="podium-player podium-third">
                  <div className="podium-head">
                    <img src={thirdPlayer ? mcHeadUrl(thirdPlayer.uuid) : DEFAULT_HEAD} className="player-head" alt="" />
                  </div>
                  <div className="podium-name">{thirdPlayer?.name ?? 'TBD'}</div>
                  <div className="podium-block podium-block-third">
                    <span className="podium-rank">3</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="container-second">
            <div className="mrm-groups">
              <div className="mrm-prediction-groups-head">
                <h2 className="playoffs-title">PHASE DE GROUPES</h2>
                <div className="mrm-prediction-hint-slot">
                  <p className="mrm-prediction-hint">
                    {groupsStatusText}
                  </p>
                </div>
              </div>
              <div className="groups-wrapper">
                <SortableGroupTable
                  groupNum={1}
                  baseline={g1}
                  order={order1}
                  onOrderChange={setOrder1}
                  titleClassName="group-title-1"
                  groupTitle="GROUPE 1"
                  interactionsEnabled={canEditGroup1}
                  isLocked={isGroup1Locked}
                  getRowResultClass={(baselineIdx, rank, player) =>
                    groupRowResultClass(
                      baselineIdx,
                      rank,
                      officialGroup1Ranks,
                      finishedInfo.group1,
                      player,
                      officialGroup1Rows,
                    )}
                />
                <SortableGroupTable
                  groupNum={2}
                  baseline={g2}
                  order={order2}
                  onOrderChange={setOrder2}
                  titleClassName="group-title-2"
                  groupTitle="GROUPE 2"
                  interactionsEnabled={canEditGroup2}
                  isLocked={isGroup2Locked}
                  getRowResultClass={(baselineIdx, rank, player) =>
                    groupRowResultClass(
                      baselineIdx,
                      rank,
                      officialGroup2Ranks,
                      finishedInfo.group2,
                      player,
                      officialGroup2Rows,
                    )}
                />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

export default MrmPrediction
