import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer } from 'ws';
import { createClient } from '@supabase/supabase-js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// --- Supabase setup ---
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// --- In-memory cache for live updates ---
const rooms = {};     // roomId -> [ws1, ws2]
const roomState = {}; // roomId -> playerId -> { pos, lastMessage }

// --- Helper functions ---
async function loadRoomState(roomId) {
  if (roomState[roomId]) return roomState[roomId]; // cached

  const { data, error } = await supabase
    .from('room_state')
    .select('state')
    .eq('room_id', roomId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Supabase load error:', error);
  }

  roomState[roomId] = data ? data.state : {};
  return roomState[roomId];
}

async function saveRoomState(roomId) {
  const state = roomState[roomId] || {};
  const { error } = await supabase
    .from('room_state')
    .upsert({ room_id: roomId, state });

  if (error) console.error('Supabase save error:', error);
  else console.log(`💾 Saved state for room ${roomId}`);
}

// --- WebSocket signaling ---
wss.on('connection', ws => {
  ws.on('message', async msg => {
    try {
      const { type, roomId, playerId, payload, pos, text } = JSON.parse(msg);

      // --- Initialize room ---
      if (!rooms[roomId]) rooms[roomId] = [];
      if (!rooms[roomId].includes(ws)) rooms[roomId].push(ws);

      // --- Always hydrate from Supabase ---
      const currentState = await loadRoomState(roomId);
      console.log('Current roomState:', JSON.stringify(currentState, null, 2));

      // --- Ensure player has state (defaults only if brand new) ---
      if (!currentState[playerId]) {
        currentState[playerId] = { pos: { x: 400, y: 300 }, lastMessage: '' };
        await saveRoomState(roomId);
      }

      // --- Update state ---
      if (type === 'pos') {
        const newPos = payload?.pos || pos;
        if (newPos) {
          currentState[playerId].pos = newPos;
          await saveRoomState(roomId);
          console.log('Updated position:', currentState[playerId].pos);
        }
      } else if (type === 'chat') {
        const newText = payload?.text || text;
        if (newText !== undefined) {
          currentState[playerId].lastMessage = newText;
          await saveRoomState(roomId);
          console.log('Updated message:', currentState[playerId].lastMessage);
        }
      }

      // --- Handle join: send current state ---
      if (type === 'join') {
        console.log(`🔵 Player ${playerId} joined room ${roomId}`);
        ws.send(JSON.stringify({
          type: 'roomState',
          payload: currentState
        }));
      }

      // --- Broadcast to other clients ---
      rooms[roomId].forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type, playerId, payload: payload || { pos, text } }));
        }
      });

    } catch (err) {
      console.error('Invalid message', err);
    }
  });

  ws.on('close', () => {
    // Remove WS reference but keep state in memory / database
    for (const roomId in rooms) {
      rooms[roomId] = rooms[roomId].filter(c => c !== ws);
    }
  });
});

// --- Serve static files ---
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
