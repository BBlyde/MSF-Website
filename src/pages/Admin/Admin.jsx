import './Admin.css'
import PlayerForm from './components/PlayerForm'

function buildPlayersPayload(formDataObj) {
  const players = {};
  for (const [key, value] of Object.entries(formDataObj)) {
    const match = key.match(/^(player\d+)-(.+)$/);
    if (!match) continue;
    const [, playerKey, field] = match;
    if (!players[playerKey]) players[playerKey] = {};
    players[playerKey][field] = value;
  }
  return Object.values(players);
}

function buildBracketPayload(formDataObj) {
  const matches = {};
  for (const [key, value] of Object.entries(formDataObj)) {
    const match = key.match(/^(player\d+)-(semi|lower|final)-(name|id|score)$/);
    if (!match) continue;
    const [, playerKey, matchType, field] = match;
    if (!matches[matchType]) matches[matchType] = {};
    if (!matches[matchType][playerKey]) matches[matchType][playerKey] = {};
    matches[matchType][playerKey][field] = value;
  }
  return Object.fromEntries(
    Object.entries(matches).map(([matchType, players]) => [matchType, Object.values(players)])
  );
}

async function formGroup1(formData) {
  const formDataObj = Object.fromEntries(formData.entries());
  const payload = buildPlayersPayload(formDataObj);

  const res = await fetch('/api/tournament/mrm/group1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error('Erreur envoi groupe 1', await res.text());
  }
}

async function formGroup2(formData) {
  const formDataObj = Object.fromEntries(formData.entries());
  const payload = buildPlayersPayload(formDataObj);

  const res = await fetch('https://msf.mcsr-game.com/tournament/mrm/group2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error('Erreur envoi groupe 2', await res.text());
  }
}

async function formBracket(formData) {
  const formDataObj = Object.fromEntries(formData.entries());
  const payload = buildBracketPayload(formDataObj);

  const res = await fetch('https://msf.mcsr-game.com/tournament/mrm/bracket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error('Erreur envoi bracket', await res.text());
  }
}

const playerFields = [1, 2, 3, 4, 5, 6, 7, 8]

function Admin() {
  return (
    <div className="d-flex flex-column align-items-center text-white home-container">
      <h1 className="home-title">MSF ADMIN</h1>
      <span className="info">Page d'administration générale</span>

      <div className="section-divider" />

      <div className='group-section'>
        <div className="group-header">
          <span>Groupe 1</span>
          <span>Nom</span>
          <span>Id</span>
          <span>Seed 1</span>
          <span>Seed 2</span>
          <span>Seed 3</span>
          <span>Seed 4</span>
          <span>Seed 5</span>
          <span>Seed 6</span>
          <span>Total</span>
        </div>
        <form action={formGroup1} className='form-mrm-1'>
          {playerFields.map((playerNumber) => (
            <PlayerForm key={playerNumber} playerNumber={playerNumber} />
          ))}
          <button type="submit">Valider</button>
        </form>
      </div>

      <div className="group-section">
        <div className="group-header">
          <span>Groupe 2</span>
          <span>Nom</span>
          <span>Id</span>
          <span>Seed 1</span>
          <span>Seed 2</span>
          <span>Seed 3</span>
          <span>Seed 4</span>
          <span>Seed 5</span>
          <span>Seed 6</span>
          <span>Total</span>
        </div>
        <form action={formGroup2} className='form-mrm-2'>
          {playerFields.map((playerNumber) => (
            <PlayerForm key={playerNumber} playerNumber={playerNumber} />
          ))}
          <button type="submit">Valider</button>
        </form>
      </div>

      <div className='bracket-section'>
        <form action={formBracket} className='form-bracket'>
          <div className='admin-match'>
            <span className='match-label'>DEMIE 1</span>
            <div className='player-name'>
              <input id="player1-semi-name" name="player1-semi-name" className='player-field' placeholder="Player 1" />
            </div>
            <div className='player-id'>
              <input id="player1-semi-id" name="player1-semi-id" className='player-field' placeholder="ID 1" />
            </div>
            <input type="number" min="0" max="2" id="player1-semi-score" name="player1-semi-score" placeholder='0'></input>
            VS
            <div className='player-name'>
              <input id="player2-semi-name" name="player2-semi-name" className='player-field' placeholder="Player 2" />
            </div>
            <div className='player-id'>
              <input id="player2-semi-id" name="player2-semi-id" className='player-field' placeholder="ID 2" />
            </div>
            <input type="number" min="0" max="2" id="player2-semi-score" name="player2-semi-score" placeholder='0'></input>
          </div>

          <div className='admin-match'>
            <span className='match-label'>DEMIE 2</span>
            <div className='player-name'>
              <input id="player3-semi-name" name="player3-semi-name" className='player-field' placeholder="Player 3" />
            </div>
            <div className='player-id'>
              <input id="player3-semi-id" name="player3-semi-id" className='player-field' placeholder="ID 3" />
            </div>
            <input type="number" min="0" max="2" id="player3-semi-score" name="player3-semi-score" placeholder='0'></input>
            VS
            <div className='player-name'>
              <input id="player4-semi-name" name="player4-semi-name" className='player-field' placeholder="Player 4" />
            </div>
            <div className='player-id'>
              <input id="player4-semi-id" name="player4-semi-id" className='player-field' placeholder="ID 4" />
            </div>
            <input type="number" min="0" max="2" id="player4-semi-score" name="player4-semi-score" placeholder='0'></input>
          </div>

          <div className='admin-match'>
            <span className='match-label'>LOWER</span>
            <div className='player-name'>
              <input id="player3-lower-name" name="player3-lower-name" className='player-field' placeholder="Player 3" />
            </div>
            <div className='player-id'>
              <input id="player3-lower-id" name="player3-lower-id" className='player-field' placeholder="ID 3" />
            </div>
            <input type="number" min="0" max="2" id="player3-lower-score" name="player3-lower-score" placeholder='0'></input>
            VS
            <div className='player-name'>
              <input id="player4-lower-name" name="player4-lower-name" className='player-field' placeholder="Player 4" />
            </div>
            <div className='player-id'>
              <input id="player4-lower-id" name="player4-lower-id" className='player-field' placeholder="ID 4" />
            </div>
            <input type="number" min="0" max="2" id="player4-lower-score" name="player4-lower-score" placeholder='0'></input>
          </div>

          <div className='admin-match'>
            <span className='match-label'>FINALE</span>
            <div className='player-name'>
              <input id="player3-final-name" name="player3-final-name" className='player-field' placeholder="Player 3" />
            </div>
            <div className='player-id'>
              <input id="player3-final-id" name="player3-final-id" className='player-field' placeholder="ID 3" />
            </div>
            <input type="number" min="0" max="3" id="player3-final-score" name="player3-final-score" placeholder='0'></input>
            VS
            <div className='player-name'>
              <input id="player4-final-name" name="player4-final-name" className='player-field' placeholder="Player 4" />
            </div>
            <div className='player-id'>
              <input id="player4-final-id" name="player4-final-id" className='player-field' placeholder="ID 4" />
            </div>
            <input type="number" min="0" max="3" id="player4-final-score" name="player4-final-score" placeholder='0'></input>
          </div>
          <button type="submit">Valider</button>
        </form>
      </div>
    </div >
  )
}

export default Admin
