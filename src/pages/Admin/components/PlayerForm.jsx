import { useMemo, useState } from 'react'
import SeedSelect from './SeedSelect'

const seedFields = [1, 2, 3, 4, 5, 6]

function PlayerForm({ playerNumber, player }) {
  const [seeds, setSeeds] = useState(
    () => Object.fromEntries(seedFields.map((n) => [n, String(player?.['s' + n] ?? 0)]))
  )

  const total = useMemo(
    () => Object.values(seeds).reduce((sum, value) => sum + Number(value), 0),
    [seeds],
  )

  const handleSeedChange = (seedNumber, value) => {
    setSeeds((currentSeeds) => ({
      ...currentSeeds,
      [seedNumber]: value,
    }))
  }

  return (
    <div className='form-player'>
      <div className='player-name'>
        <input id={`player${playerNumber}-name`} name={`player${playerNumber}-name`} className='player-field' placeholder="Name" defaultValue={player?.name ?? ''}/>
      </div>
      <div className='player-id'>
        <input id={`player${playerNumber}-uuid`} name={`player${playerNumber}-uuid`} className='player-field' placeholder={`ID ${playerNumber}`} defaultValue={player?.uuid ?? ''}/>
      </div>
      {seedFields.map((seedNumber) => (
        <SeedSelect
          key={`${playerNumber}-${seedNumber}`}
          seedNumber={seedNumber}
          value={seeds[seedNumber]}
          onChange={handleSeedChange}
          id={`player${playerNumber}-s${seedNumber}`}
          name={`player${playerNumber}-s${seedNumber}`}
        />
      ))}
      <div className='total'>
        <input
          id={`player${playerNumber}-total`}
          name={`player${playerNumber}-total`}
          className='total-field'
          value={total}
          readOnly
        />
        <br></br>
      </div>
    </div>
  )
}

export default PlayerForm
