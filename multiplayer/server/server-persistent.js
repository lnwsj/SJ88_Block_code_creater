// MiniCraft 3D Multiplayer Server - PERSISTENT VERSION
// HTTP + WebSocket + Persistent world storage
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3109;
const HOST = '0.0.0.0';
const GAME_FILE = path.join(__dirname, 'multiplayer.html');
const WORLDS_DIR = path.join(__dirname, 'worlds');

// Ensure worlds dir exists
if (!fs.existsSync(WORLDS_DIR)) fs.mkdirSync(WORLDS_DIR, { recursive: true });

// Generate 4-char room code
function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const rooms = new Map();
const playerToRoom = new WeakMap();
let nextPlayerId = 1;

// Pending save timers (debounce)
const saveTimers = new Map(); // code -> timer

function send(ws, data) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}
function broadcastRoom(room, data, exceptId = null) {
  for (const [id, p] of room.players) {
    if (id === exceptId) continue;
    send(p.ws, data);
  }
}

// ======================================================================
// WORLD PERSISTENCE
// ======================================================================
function worldDir(code) {
  return path.join(WORLDS_DIR, code);
}

function countNonAir(blocks) {
  let n = 0;
  for (let i = 0; i < blocks.length; i++) if (blocks[i] !== 0) n++;
  return n;
}

function saveWorld(code, worldData, hostName = 'Host') {
  try {
    const dir = worldDir(code);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // Compute stats
    const blocks = worldData.array || worldData.blocks;
    const W = worldData.W, D = worldData.D, H = worldData.H;
    const nonAir = countNonAir(blocks);
    const meta = {
      code,
      name: worldData.name || 'World ' + code,
      seed: worldData.seed || 0,
      W, D, H,
      blockCount: nonAir,
      createdAt: worldData.createdAt || Date.now(),
      lastSaved: Date.now(),
      lastHost: hostName,
    };
    // Load existing meta if present (preserve createdAt + name)
    const metaPath = path.join(dir, 'meta.json');
    if (fs.existsSync(metaPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        meta.createdAt = existing.createdAt || meta.createdAt;
        if (existing.name) meta.name = existing.name;
      } catch(e) {}
    }
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    // Save binary blocks
    const dataPath = path.join(dir, 'data.bin');
    const buf = Buffer.from(blocks);
    fs.writeFileSync(dataPath, buf);
    console.log(`[world] saved ${code} (${nonAir} blocks, ${(buf.length/1024).toFixed(1)}KB)`);
    return { ok: true, meta };
  } catch(e) {
    console.error(`[world] save error ${code}:`, e.message);
    return { ok: false, error: e.message };
  }
}

function loadWorld(code) {
  try {
    const dir = worldDir(code);
    const metaPath = path.join(dir, 'meta.json');
    const dataPath = path.join(dir, 'data.bin');
    if (!fs.existsSync(metaPath) || !fs.existsSync(dataPath)) return null;
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    const blocks = new Uint8Array(fs.readFileSync(dataPath));
    return {
      ...meta,
      array: Array.from(blocks),
    };
  } catch(e) {
    console.error(`[world] load error ${code}:`, e.message);
    return null;
  }
}

function listWorlds() {
  const worlds = [];
  try {
    const entries = fs.readdirSync(WORLDS_DIR, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const metaPath = path.join(WORLDS_DIR, e.name, 'meta.json');
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
          worlds.push({
            code: meta.code,
            name: meta.name,
            seed: meta.seed,
            W: meta.W, D: meta.D, H: meta.H,
            blockCount: meta.blockCount,
            createdAt: meta.createdAt,
            lastSaved: meta.lastSaved,
            lastHost: meta.lastHost,
          });
        } catch(e) {}
      }
    }
  } catch(e) {}
  return worlds.sort((a, b) => (b.lastSaved || 0) - (a.lastSaved || 0));
}

function deleteWorld(code) {
  try {
    const dir = worldDir(code);
    if (!fs.existsSync(dir)) return false;
    const files = fs.readdirSync(dir);
    for (const f of files) fs.unlinkSync(path.join(dir, f));
    fs.rmdirSync(dir);
    return true;
  } catch(e) {
    return false;
  }
}

function renameWorld(code, newName) {
  try {
    const dir = worldDir(code);
    const metaPath = path.join(dir, 'meta.json');
    if (!fs.existsSync(metaPath)) return false;
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    meta.name = newName;
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    return true;
  } catch(e) {
    return false;
  }
}

function scheduleSave(code, delayMs = 5000) {
  // Debounce: cancel existing timer, set new one
  if (saveTimers.has(code)) clearTimeout(saveTimers.get(code));
  saveTimers.set(code, setTimeout(() => {
    saveTimers.delete(code);
    const room = rooms.get(code);
    if (room && room.world) {
      const host = Array.from(room.players.values()).find(p => p.id === room.hostId);
      saveWorld(code, room.world, host?.name || 'Host');
    }
  }, delayMs));
}

function saveRoomNow(code) {
  if (saveTimers.has(code)) {
    clearTimeout(saveTimers.get(code));
    saveTimers.delete(code);
  }
  const room = rooms.get(code);
  if (room && room.world) {
    const host = Array.from(room.players.values()).find(p => p.id === room.hostId);
    return saveWorld(code, room.world, host?.name || 'Host');
  }
  return { ok: false, error: 'No world in room' };
}

// ======================================================================
// HTTP server (game + REST API)
// ======================================================================
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  // Serve game
  if (req.url === '/' || req.url === '/index.html' || req.url === '/multiplayer.html') {
    fs.readFile(GAME_FILE, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Game file not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }
  // Health
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }
  // List worlds
  if (req.url === '/api/worlds' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(listWorlds()));
    return;
  }
  // Get specific world
  const getMatch = req.url.match(/^\/api\/worlds\/([A-Z0-9]{4})$/);
  if (getMatch && req.method === 'GET') {
    const w = loadWorld(getMatch[1]);
    if (!w) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(w));
    return;
  }
  // Delete world
  const delMatch = req.url.match(/^\/api\/worlds\/([A-Z0-9]{4})$/);
  if (delMatch && req.method === 'DELETE') {
    const ok = deleteWorld(delMatch[1]);
    res.writeHead(ok ? 200 : 404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok }));
    return;
  }
  // Rename world
  const renameMatch = req.url.match(/^\/api\/worlds\/([A-Z0-9]{4})\/rename$/);
  if (renameMatch && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { name } = JSON.parse(body);
        const ok = renameWorld(renameMatch[1], name);
        res.writeHead(ok ? 200 : 400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok }));
      } catch(e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  let playerId = null;
  let playerName = 'Player';
  let myRoom = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch(e) { return; }
    const t = msg.type;

    if (t === 'create_room') {
      if (myRoom) return send(ws, { type: 'error', msg: 'Already in a room' });
      // Check if resuming a saved world
      let code = genCode();
      let initialWorld = null;
      let initialSeed = msg.seed || null;
      if (msg.resumeCode) {
        const saved = loadWorld(msg.resumeCode);
        if (saved) {
          code = msg.resumeCode;
          initialWorld = saved;
          initialSeed = saved.seed;
          console.log(`[${code}] resumed from disk (${saved.blockCount} blocks)`);
        } else {
          return send(ws, { type: 'error', msg: 'Saved world not found: ' + msg.resumeCode });
        }
      }
      myRoom = { code, host: ws, hostId: null, players: new Map(), world: initialWorld, createdAt: Date.now(), lastSave: Date.now() };
      rooms.set(code, myRoom);
      playerId = nextPlayerId++;
      myRoom.hostId = playerId;
      myRoom.players.set(playerId, { ws, name: msg.name || 'Host', x: 0, y: 30, z: 0, yaw: 0, pitch: 0, hp: 20, color: msg.color || '#4a9eff' });
      console.log(`[${code}] created by ${msg.name || 'Host'} (player #${playerId})`);
      send(ws, { type: 'room_created', code, id: playerId, seed: initialSeed, resumed: !!initialWorld });
      // If resumed, send the world to the host immediately
      if (initialWorld) {
        send(ws, { type: 'world_sync', world: initialWorld, seed: initialSeed });
        console.log(`[${code}] world sent to host on resume`);
      }
    }
    else if (t === 'join_room') {
      if (myRoom) return send(ws, { type: 'error', msg: 'Already in a room' });
      const code = (msg.code || '').toUpperCase();
      let room = rooms.get(code);
      // If room not active, check if saved
      if (!room) {
        const saved = loadWorld(code);
        if (saved) {
          // Auto-revive room from saved world
          room = { code, host: null, hostId: null, players: new Map(), world: saved, createdAt: Date.now(), lastSave: Date.now() };
          rooms.set(code, room);
          console.log(`[${code}] revived from disk for joiner`);
        } else {
          return send(ws, { type: 'error', msg: 'Room not found' });
        }
      }
      if (room.players.size >= 8) return send(ws, { type: 'error', msg: 'Room is full' });
      myRoom = room;
      playerId = nextPlayerId++;
      room.players.set(playerId, { ws, name: msg.name || 'Guest', x: 0, y: 30, z: 0, yaw: 0, pitch: 0, hp: 20, color: msg.color || '#ff6b6b' });
      const playerList = [];
      for (const [id, p] of room.players) {
        playerList.push({ id, name: p.name, x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, hp: p.hp, color: p.color });
      }
      send(ws, { type: 'joined', code: room.code, id: playerId, players: playerList, world: room.world, seed: room.world?.seed || null });
      const newP = room.players.get(playerId);
      broadcastRoom(room, { type: 'player_joined', player: { id: playerId, name: newP.name, x: 0, y: 30, z: 0, yaw: 0, pitch: 0, hp: 20, color: newP.color } }, playerId);
      console.log(`[${room.code}] ${newP.name} joined as #${playerId} (${room.players.size} total)`);
    }
    else if (t === 'move' && myRoom) {
      const p = myRoom.players.get(playerId);
      if (!p) return;
      p.x = msg.x; p.y = msg.y; p.z = msg.z; p.yaw = msg.yaw; p.pitch = msg.pitch; p.hp = msg.hp;
      broadcastRoom(myRoom, { type: 'player_move', id: playerId, x: msg.x, y: msg.y, z: msg.z, yaw: msg.yaw, pitch: msg.pitch, hp: msg.hp, fly: msg.fly }, playerId);
      // Forward bot state if host
      if (myRoom.hostId === playerId && msg.botVisible) {
        broadcastRoom(myRoom, {
          type: 'bot',
          id: playerId,
          name: p.name,
          color: p.color,
          x: msg.botX, y: msg.botY, z: msg.botZ, yaw: msg.botYaw,
          visible: msg.botVisible, say: msg.botSay,
        }, playerId);
      }
    }
    else if (t === 'block' && myRoom) {
      // Update world state (only host's changes count)
      if (myRoom.hostId === playerId) {
        if (!myRoom.world) {
          // No world yet (host hasn't shared state) - just broadcast
        } else if (myRoom.world.array) {
          const idx = msg.x + msg.y * myRoom.world.W + msg.z * myRoom.world.W * myRoom.world.D;
          if (idx >= 0 && idx < myRoom.world.array.length) {
            if (msg.action === 'place') myRoom.world.array[idx] = msg.block;
            else if (msg.action === 'break') myRoom.world.array[idx] = 0;
            // Schedule debounced save
            scheduleSave(myRoom.code, 5000);
          }
        }
      }
      broadcastRoom(myRoom, { type: 'block_change', id: playerId, action: msg.action, x: msg.x, y: msg.y, z: msg.z, block: msg.block });
    }
    else if (t === 'world_state' && myRoom) {
      // Host shares world state
      if (myRoom.hostId === playerId) {
        myRoom.world = msg.world;
        for (const [, p] of myRoom.players) {
          send(p.ws, { type: 'world_sync', world: msg.world, seed: msg.seed });
        }
        // Save immediately
        const p = myRoom.players.get(playerId);
        saveWorld(myRoom.code, msg.world, p?.name || 'Host');
        console.log(`[${myRoom.code}] world state shared (${msg.world.array?.length || 0} blocks)`);
      }
    }
    else if (t === 'world_save' && myRoom) {
      // Manual save request from client
      if (myRoom.hostId === playerId && msg.world) {
        const p = myRoom.players.get(playerId);
        const result = saveWorld(myRoom.code, msg.world, p?.name || 'Host');
        send(ws, { type: 'world_saved', code: myRoom.code, meta: result.meta, when: Date.now() });
      }
    }
    else if (t === 'world_meta_update' && myRoom) {
      // Update name/etc
      if (myRoom.hostId === playerId && msg.name) {
        renameWorld(myRoom.code, msg.name);
      }
    }
    else if (t === 'chat' && myRoom) {
      broadcastRoom(myRoom, { type: 'chat', id: playerId, name: msg.name, msg: msg.msg, color: msg.color }, playerId);
      send(ws, { type: 'chat', id: playerId, name: msg.name, msg: msg.msg, color: msg.color });
    }
    else if (t === 'bot' && myRoom) {
      const p = myRoom.players.get(playerId);
      broadcastRoom(myRoom, {
        type: 'bot',
        id: playerId,
        name: p?.name || 'Player',
        color: p?.color || '#ff8800',
        x: msg.x, y: msg.y, z: msg.z, yaw: msg.yaw,
        visible: msg.visible,
        say: msg.say,
      }, playerId);
    }
    else if (t === 'bot_stop' && myRoom) {
      broadcastRoom(myRoom, { type: 'bot_stop', id: playerId }, playerId);
    }
    else if (t === 'ping') {
      send(ws, { type: 'pong', t: msg.t });
    }
  });

  ws.on('close', () => {
    if (playerId && myRoom) {
      const p = myRoom.players.get(playerId);
      const isHost = myRoom.hostId === playerId;
      myRoom.players.delete(playerId);
      broadcastRoom(myRoom, { type: 'player_left', id: playerId });
      broadcastRoom(myRoom, { type: 'bot_stop', id: playerId });
      console.log(`[${myRoom.code}] ${p?.name || '?'} left (${myRoom.players.size} left)${isHost ? ' [HOST]' : ''}`);
      // If host left, save world immediately
      if (isHost && myRoom.world) {
        saveRoomNow(myRoom.code);
      }
      if (myRoom.players.size === 0) {
        // Save one more time before close
        if (myRoom.world) saveRoomNow(myRoom.code);
        rooms.delete(myRoom.code);
        console.log(`[${myRoom.code}] room closed (empty)`);
      }
    }
    console.log(`WS closed (player #${playerId || '?'})`);
  });

  ws.on('error', (e) => { console.error('WS error:', e.message); });

  send(ws, { type: 'hello', server: 'MiniCraft MP Persistent', version: '2.0' });
});

// ======================================================================
// PERIODIC AUTO-SAVE (every 30s for active rooms)
// ======================================================================
setInterval(() => {
  for (const room of rooms.values()) {
    if (room.world && room.hostId && room.players.size > 0) {
      const host = room.players.get(room.hostId);
      saveWorld(room.code, room.world, host?.name || 'Host');
    }
  }
}, 30000);

// Cleanup empty rooms after 5 min
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (room.players.size === 0 && now - (room.lastActivity || room.createdAt) > 5 * 60 * 1000) {
      // Already saved on player_left
      rooms.delete(code);
      console.log(`[${code}] cleaned up inactive room`);
    }
  }
}, 60000);

server.listen(PORT, HOST, () => {
  console.log(`MiniCraft MP Persistent server listening on http://${HOST}:${PORT}`);
  console.log(`Worlds dir: ${WORLDS_DIR}`);
  console.log(`Saved worlds: ${listWorlds().length}`);
});

setInterval(() => {
  let total = 0;
  for (const r of rooms.values()) total += r.players.size;
  console.log(`[${new Date().toISOString()}] ${rooms.length} active rooms, ${total} players, ${listWorlds().length} saved worlds`);
}, 60000);
