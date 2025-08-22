import express from 'express';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const rooms = {}; // roomId -> [ws1, ws2]

wss.on('connection', ws => {
  ws.on('message', msg => {
    try {
      const data = JSON.parse(msg);
      const { type, roomId, payload } = data;

      if (!rooms[roomId]) rooms[roomId] = [];
      if (!rooms[roomId].includes(ws)) rooms[roomId].push(ws);

      // broadcast to the other peer
      rooms[roomId].forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type, payload }));
        }
      });
    } catch (err) {
      console.error('Invalid message', err);
    }
  });

  ws.on('close', () => {
    // Remove ws from all rooms
    for (const roomId in rooms) {
      rooms[roomId] = rooms[roomId].filter(c => c !== ws);
      if (rooms[roomId].length === 0) delete rooms[roomId];
    }
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log('Signaling server running');
});
