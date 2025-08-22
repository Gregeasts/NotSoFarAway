import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer } from 'ws';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const rooms = {}; // roomId -> [ws1, ws2]
const roomState = {}; 

// WebSocket signaling
wss.on('connection', ws => {
  ws.on('message', msg => {
    try {
      const { type, roomId, payload } = JSON.parse(msg);

      if (!rooms[roomId]) rooms[roomId] = [];
      if (!rooms[roomId].includes(ws)) rooms[roomId].push(ws);

      rooms[roomId].forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type, payload }));
        }
      });
       if (type === 'pos' || type === 'chat') {
        // 📝 store latest state
        roomState[roomId][playerId] = {
          ...roomState[roomId][playerId],
          ...payload
        };
      }
      if (type === 'join') {
        // 📝 send current room state only to the joining client
        ws.send(JSON.stringify({
          type: 'roomState',
          payload: roomState[roomId]
        }));
      }
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
    for (const roomId in rooms) {
      rooms[roomId] = rooms[roomId].filter(c => c !== ws);
      
    }
  });
});


const __dirname = path.resolve();

// Serve all static files from the root folder
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});
// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
