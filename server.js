const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const MAP = {
  walls: [
    { x: 100, y: 100, w: 600, h: 20 },
    { x: 100, y: 480, w: 600, h: 20 },
  ]
};

let players = {};

io.on('connection', socket => {
  players[socket.id] = { x: 200, y: 200 };
  socket.emit('state', { players, MAP });

  socket.on('disconnect', () => {
    delete players[socket.id];
  });
});

server.listen(3000, () => console.log("Server started on port 3000"));
