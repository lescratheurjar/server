const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
app.use(cors());
const io = new Server(server, { cors: { origin: "*" } });

const MAP = { width:800, height:600, walls:[
  {x:200,y:150,w:400,h:20},
  {x:200,y:430,w:400,h:20},
]};
const POWERUPS = [];
const MAX_POWERUPS = 5;
const POWERUP_TYPES = ["hp","speed"];

let players = {};
let bullets = [];

// collision helper
function rectCollide(x,y,w,h, rx,ry,rw,rh){
  return x < rx+rw && x+w > rx && y < ry+rh && y+h > ry;
}

io.on("connection", socket => {
  players[socket.id] = {
    x:400, y:300, vx:0, vy:0, angle:0,
    health:100, score:0, speed:3
  };
  socket.emit("init", socket.id);

  socket.on("move", input => {
    const p = players[socket.id];
    if(!p||p.health<=0) return;
    const acc=0.5,fric=0.85;
    if(input.up) p.vy-=acc;
    if(input.down) p.vy+=acc;
    if(input.left) p.vx-=acc;
    if(input.right) p.vx+=acc;
    // apply friction
    p.vx*=fric; p.vy*=fric;
    // apply speed cap
    const sp = p.speed;
    p.vx = Math.max(-sp,Math.min(sp,p.vx));
    p.vy = Math.max(-sp,Math.min(sp,p.vy));
    // new tentative pos
    let nx=p.x+p.vx, ny=p.y+p.vy;
    // collide walls
    for(let w of MAP.walls){
      if(rectCollide(nx-12,ny-12,24,24, w.x,w.y,w.w,w.h)){
        nx = p.x; ny = p.y;
        break;
      }
    }
    // stay inside map
    nx=Math.max(12,Math.min(MAP.width-12,nx));
    ny=Math.max(12,Math.min(MAP.height-12,ny));
    p.x=nx; p.y=ny;
  });

  socket.on("aim", a => {
    if(players[socket.id]) players[socket.id].angle=a;
  });

  socket.on("shoot", () => {
    const p=players[socket.id];
    if(!p||p.health<=0) return;
    bullets.push({
      x:p.x, y:p.y,
      dx:Math.cos(p.angle)*6,
      dy:Math.sin(p.angle)*6,
      owner:socket.id
    });
  });

  socket.on("disconnect", ()=>{ delete players[socket.id]; });
});

setInterval(()=>{
  // update bullets
  bullets.forEach(b=>{
    b.x+=b.dx; b.y+=b.dy;
  });
  // bullet collisions & damage
  bullets = bullets.filter(b=>{
    // map bounds
    if(b.x<0||b.x>MAP.width||b.y<0||b.y>MAP.height) return false;
    // wall collision
    for(let w of MAP.walls){
      if(b.x> w.x && b.x< w.x+w.w && b.y> w.y && b.y< w.y+w.h)
        return false;
    }
    // hit players
    for(let id in players){
      const p=players[id];
      if(p.health>0 && id!==b.owner){
        if(Math.hypot(b.x-p.x,b.y-p.y)<16){
          p.health-=20;
          if(p.health<=0){
            players[b.owner].score++;
            // respawn dead
            setTimeout(()=>{
              p.x=400; p.y=300; p.health=100; p.speed=3;
            },2000);
          }
          return false;
        }
      }
    }
    return true;
  });

  // spawn power-ups
  if(POWERUPS.length<MAX_POWERUPS && Math.random()<0.01){
    POWERUPS.push({
      x:50+Math.random()*(MAP.width-100),
      y:50+Math.random()*(MAP.height-100),
      type: POWERUP_TYPES[Math.floor(Math.random()*POWERUP_TYPES.length)]
    });
  }
  // pickup power-ups
  for(let i=POWERUPS.length-1;i>=0;i--){
    const pu=POWERUPS[i];
    for(let id in players){
      const p=players[id];
      if(p.health>0 && Math.hypot(pu.x-p.x,pu.y-p.y)<20){
        if(pu.type==="hp") p.health=Math.min(100,p.health+30);
        if(pu.type==="speed") p.speed=5;
        // speed boost lasts 5s
        setTimeout(()=>{ if(players[id]) players[id].speed=3; },5000);
        POWERUPS.splice(i,1);
        break;
      }
    }
  }

  io.emit("state", { players, bullets, MAP, POWERUPS });
},1000/60);

app.get("/",(_,res)=>res.send("Server OK"));
server.listen(process.env.PORT||3000);
