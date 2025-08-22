import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer } from 'ws';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const rooms = {}; // roomId -> [ws1, ws2]

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
    } catch (err) {
      console.error('Invalid message', err);
    }
  });

  ws.on('close', () => {
    for (const roomId in rooms) {
      rooms[roomId] = rooms[roomId].filter(c => c !== ws);
      if (rooms[roomId].length === 0) delete rooms[roomId];
    }
  });
});


const __dirname = path.resolve();

// Serve all static files from the root folder
app.use(express.static(__dirname));

// For any other route, try to serve index.html in the root
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
