import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer } from 'ws';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// --- Room state ---
const rooms = {};      // roomId -> [ws1, ws2]
const roomState = {};  // roomId -> playerId -> { pos, lastMessage }

// WebSocket signaling
wss.on('connection', ws => {
  ws.on('message', msg => {
    try {
      const { type, roomId, playerId, payload } = JSON.parse(msg);

      // --- Initialize room ---
      if (!rooms[roomId]) rooms[roomId] = [];
      if (!rooms[roomId].includes(ws)) rooms[roomId].push(ws);

      if (!roomState[roomId]) roomState[roomId] = {};
      if (!roomState[roomId][playerId]) {
        roomState[roomId][playerId] = { pos: { x: 400, y: 300 }, lastMessage: '' };
      }

      // --- Update room state ---
      if (type === 'pos') {
        roomState[roomId][playerId].pos = payload.pos;
      } else if (type === 'chat') {
        roomState[roomId][playerId].lastMessage = payload.text;
      }

      // --- Handle join: send current state to new client ---
      if (type === 'join') {
        ws.send(JSON.stringify({
          type: 'roomState',
          payload: roomState[roomId]
        }));
      }

      // --- Broadcast to other clients ---
      rooms[roomId].forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type, playerId, payload }));
        }
      });

    } catch (err) {
      console.error('Invalid message', err);
    }
  });

  ws.on('close', () => {
    // Remove WS reference but keep player state
    for (const roomId in rooms) {
      rooms[roomId] = rooms[roomId].filter(c => c !== ws);
      // Do not delete roomState: allows reconnect
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
