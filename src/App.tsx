import { useState } from 'react';
import Game from './Game';

export default function App() {
  const [roomId, setRoomId] = useState<string>('');
  const [playerId, setPlayerId] = useState<'greg'|'shannon'>('greg');
  const [joined, setJoined] = useState(false);
  const allowedRoom = 'ILOVEYOU'; // Only this room code allowed

  const handleJoin = () => {
    if (roomId.toUpperCase() === allowedRoom) {
      setJoined(true);
    } else {
      alert('Invalid room code!');
    }
  };

  return (
    <div style={{width:'100vw',height:'100vh'}}>
      {!joined && (
        <div style={{padding:20}}>
          <h2>Dragon Duo 🐉</h2>
          <input
            placeholder="Enter room code"
            value={roomId}
            onChange={e => setRoomId(e.target.value)}
          />
          <select value={playerId} onChange={e => setPlayerId(e.target.value as 'greg'|'shannon')}>
            <option value="greg">Greg</option>
            <option value="shannon">Shannon</option>
          </select>
          <button onClick={handleJoin}>Join Room</button>
        </div>
      )}
      {joined && <Game roomId={roomId.toUpperCase()} playerId={playerId} />}
    </div>
  );
}
