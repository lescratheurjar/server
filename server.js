const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const players = {};
let bullets = [];

io.on("connection", (socket) => {
  players[socket.id] = { x: 400, y: 300, angle: 0 };
  socket.emit("init", socket.id);

  socket.on("move", (input) => {
    const p = players[socket.id];
    if (!p) return;
    const speed = 3;
    if (input.up) p.y -= speed;
    if (input.down) p.y += speed;
    if (input.left) p.x -= speed;
    if (input.right) p.x += speed;
  });

  socket.on("aim", (a) => {
    if (players[socket.id]) players[socket.id].angle = a;
  });

  socket.on("shoot", () => {
    const p = players[socket.id];
    if (!p) return;
    bullets.push({
      x: p.x, y: p.y,
      dx: Math.cos(p.angle) * 6,
      dy: Math.sin(p.angle) * 6
    });
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
  });
});

setInterval(() => {
  bullets.forEach(b => { b.x += b.dx; b.y += b.dy; });
  bullets = bullets.filter(b => b.x >= 0 && b.x <= 800 && b.y >= 0 && b.y <= 600);
  io.emit("state", { players, bullets });
}, 1000 / 60);

app.use(cors());
app.get("/", (req, res) => res.send("Server OK"));
server.listen(process.env.PORT || 3000);
