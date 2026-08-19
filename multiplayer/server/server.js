// MiniCraft 3D Multiplayer Server
// Signaling + State relay
const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 3109;
const HOST = '0.0.0.0';

// Generate 4-char room code (avoiding confusable chars)
function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Room = { code, host: ws, players: Map<id, {ws, name, x, y, z, yaw, pitch, hp, color}>, world: object }
const rooms = new Map();
const playerToRoom = new WeakMap();

const http_server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
  res.end('MiniCraft MP server is running. Connect via WebSocket.');
});

const wss = new WebSocket.Server({ server: http_server });

let nextPlayerId = 1;

function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcastRoom(room, data, exceptId = null) {
  for (const [id, p] of room.players) {
    if (id === exceptId) continue;
    send(p.ws, data);
  }
}

function leaveRoom(playerId) {
  const room = findPlayerRoom(playerId);
  if (!room) return;
  const p = room.players.get(playerId);
  if (!p) return;
  room.players.delete(playerId);
  broadcastRoom(room, { type: 'player_left', id: playerId });
  console.log(`[${room.code}] ${p.name} left (${room.players.size} left)`);
  if (room.players.size === 0) {
    rooms.delete(room.code);
    console.log(`[${room.code}] room closed (empty)`);
  }
}

function findPlayerRoom(playerId) {
  for (const room of rooms.values()) {
    if (room.players.has(playerId)) return room;
  }
  return null;
}

wss.on('connection', (ws) => {
  let playerId = null;
  let playerName = 'Player';
  let myRoom = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch(e) { return; }
    const t = msg.type;

    if (t === 'create_room') {
      // Host: create new room
      if (myRoom) return send(ws, { type: 'error', msg: 'Already in a room' });
      const code = genCode();
      myRoom = { code, host: ws, players: new Map(), world: msg.world || null, createdAt: Date.now() };
      rooms.set(code, myRoom);
      playerId = nextPlayerId++;
      myRoom.players.set(playerId, { ws, name: msg.name || 'Host', x: 0, y: 30, z: 0, yaw: 0, pitch: 0, hp: 20, color: msg.color || '#4a9eff' });
      console.log(`[${code}] created by ${msg.name || 'Host'} (player #${playerId})`);
      send(ws, { type: 'room_created', code, id: playerId, seed: msg.seed || null });
    }
    else if (t === 'join_room') {
      // Client: join existing room
      if (myRoom) return send(ws, { type: 'error', msg: 'Already in a room' });
      const room = rooms.get((msg.code || '').toUpperCase());
      if (!room) return send(ws, { type: 'error', msg: 'Room not found' });
      if (room.players.size >= 8) return send(ws, { type: 'error', msg: 'Room is full' });
      myRoom = room;
      playerId = nextPlayerId++;
      room.players.set(playerId, { ws, name: msg.name || 'Guest', x: 0, y: 30, z: 0, yaw: 0, pitch: 0, hp: 20, color: msg.color || '#ff6b6b' });

      // Send current room state to the new player
      const playerList = [];
      for (const [id, p] of room.players) {
        playerList.push({ id, name: p.name, x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, hp: p.hp, color: p.color });
      }
      send(ws, { type: 'joined', code: room.code, id: playerId, players: playerList, world: room.world, seed: room.world?.seed || null });

      // Notify others
      const newP = room.players.get(playerId);
      broadcastRoom(room, { type: 'player_joined', player: { id: playerId, name: newP.name, x: 0, y: 30, z: 0, yaw: 0, pitch: 0, hp: 20, color: newP.color } }, playerId);
      console.log(`[${room.code}] ${newP.name} joined as #${playerId} (${room.players.size} total)`);
    }
    else if (t === 'move' && myRoom) {
      // Player position update
      const p = myRoom.players.get(playerId);
      if (!p) return;
      p.x = msg.x; p.y = msg.y; p.z = msg.z; p.yaw = msg.yaw; p.pitch = msg.pitch; p.hp = msg.hp;
      broadcastRoom(myRoom, { type: 'player_move', id: playerId, x: msg.x, y: msg.y, z: msg.z, yaw: msg.yaw, pitch: msg.pitch, hp: msg.hp, fly: msg.fly }, playerId);
    }
    else if (t === 'block' && myRoom) {
      // Block break/place
      // msg = { action: 'break'|'place', x, y, z, block }
      if (msg.action === 'place') {
        if (myRoom.world && myRoom.world.array) {
          const idx = msg.x + msg.y * myRoom.world.W + msg.z * myRoom.world.W * myRoom.world.D;
          if (idx >= 0 && idx < myRoom.world.array.length) {
            myRoom.world.array[idx] = msg.block;
          }
        }
      } else if (msg.action === 'break') {
        if (myRoom.world && myRoom.world.array) {
          const idx = msg.x + msg.y * myRoom.world.W + msg.z * myRoom.world.W * myRoom.world.D;
          if (idx >= 0 && idx < myRoom.world.array.length) {
            myRoom.world.array[idx] = 0; // air
          }
        }
      }
      // Broadcast to all (including sender for confirmation)
      broadcastRoom(myRoom, { type: 'block_change', id: playerId, action: msg.action, x: msg.x, y: msg.y, z: msg.z, block: msg.block });
    }
    else if (t === 'world_state' && myRoom) {
      // Host sends initial world state (after generation)
      myRoom.world = msg.world;
      // Send to all current players
      for (const [, p] of myRoom.players) {
        send(p.ws, { type: 'world_sync', world: msg.world, seed: msg.seed });
      }
      console.log(`[${myRoom.code}] world state shared (${msg.world.array.length} blocks)`);
    }
    else if (t === 'chat' && myRoom) {
      broadcastRoom(myRoom, { type: 'chat', id: playerId, name: msg.name, msg: msg.msg, color: msg.color }, playerId);
      // also send to sender
      send(ws, { type: 'chat', id: playerId, name: msg.name, msg: msg.msg, color: msg.color });
    }
    else if (t === 'ping') {
      send(ws, { type: 'pong', t: msg.t });
    }
  });

  ws.on('close', () => {
    if (playerId) leaveRoom(playerId);
    console.log(`WS closed (player #${playerId || '?'})`);
  });

  ws.on('error', (e) => {
    console.error('WS error:', e.message);
  });

  // Send welcome
  send(ws, { type: 'hello', server: 'MiniCraft MP', version: '1.0' });
});

http_server.listen(PORT, HOST, () => {
  console.log(`MiniCraft MP server listening on ws://${HOST}:${PORT}`);
  console.log(`Stats: ${rooms.size} active rooms`);
});

// Periodic stats
setInterval(() => {
  let total = 0;
  for (const r of rooms.values()) total += r.players.size;
  console.log(`[${new Date().toISOString()}] ${rooms.size} rooms, ${total} players`);
}, 60000);
