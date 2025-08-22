import { useState } from 'react';
import Game from './Game';

export default function App() {
  const [roomId,setRoomId] = useState<string>('');
  const [joined,setJoined] = useState(false);

  return (
    <div style={{width:'100vw',height:'100vh'}}>
      {!joined && <div style={{padding:20}}>
        <h2>Dragon Duo 🐉</h2>
        <input value={roomId} onChange={e=>setRoomId(e.target.value)} placeholder="Enter room code" />
        <button onClick={()=>roomId && setJoined(true)}>Join Room</button>
      </div>}
      {joined && <Game roomId={roomId} />}
    </div>
  );
}
