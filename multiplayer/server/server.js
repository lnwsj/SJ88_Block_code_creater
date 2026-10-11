// MiniCraft 3D Multiplayer Server — UNIFIED
// Rooms + persistent worlds + REST API in one process.
// (Replaces the old server.js / server-full.js / server-persistent.js split.)
//
// Improvements over the old persistent server:
//   - World sync uses RLE+base64 (typically tens of KB) instead of a JSON
//     array (~300-500KB)
//   - Block edits from EVERY player persist (previously only the host's did,
//     so guest work was lost on save/resume)
//   - Host migration: when the host leaves, the longest-connected player is
//     promoted and keeps the world alive + autosaving
//   - Destructive REST calls (delete/rename world) require an admin token
//   - Per-connection rate limiting + message validation
//   - Room codes use crypto randomness (not guessable sequences)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3109;
const HOST = '0.0.0.0';

// Admin token for DELETE / rename world endpoints. Pin it with the
// MINICRAFT_ADMIN_TOKEN env var; otherwise one is generated per boot and
// printed to the console (crypto-grade random).
const ADMIN_TOKEN = process.env.MINICRAFT_ADMIN_TOKEN || crypto.randomBytes(16).toString('hex');

// Locate the game HTML regardless of deploy layout
const GAME_FILE = [
  path.join(__dirname, 'multiplayer.html'),
  path.join(__dirname, '..', 'deploy', 'multiplayer.html'),
  path.join(__dirname, '..', '..', 'index.html'),
].find(p => fs.existsSync(p));

const WORLDS_DIR = path.join(__dirname, 'worlds');
if (!fs.existsSync(WORLDS_DIR)) fs.mkdirSync(WORLDS_DIR, { recursive: true });

// 4-char room code from the full alphabet using crypto randomness
function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[crypto.randomInt(0, chars.length)];
  return code;
}

const rooms = new Map(); // code -> room
let nextPlayerId = 1;
const saveTimers = new Map(); // code -> timer (debounced saves)

// ----------------------------------------------------------------------
// World helpers — blocks live in a Uint8Array; the wire format is
// run-length-encoded + base64 (typically 10-60KB for a real world, vs
// ~300-500KB as the old JSON array). Plain base64 / JSON array are still
// accepted inbound for compatibility.
// ----------------------------------------------------------------------
function u8ToB64(u8) { return Buffer.from(u8).toString('base64'); }
function b64ToU8(b64) { return new Uint8Array(Buffer.from(String(b64), 'base64')); }

// RLE byte format (same as the client's rleEncodeU8): [runLo, runHi, value]*
function rleEncodeB64(u8) {
  const out = [];
  let i = 0;
  while (i < u8.length) {
    const v = u8[i];
    let run = 1;
    while (i + run < u8.length && u8[i + run] === v && run < 65535) run++;
    out.push(run & 255, (run >> 8) & 255, v);
    i += run;
  }
  return Buffer.from(out).toString('base64');
}
function rleDecodeB64(b64, expectedLen) {
  try {
    const s = Buffer.from(String(b64), 'base64');
    const out = new Uint8Array(expectedLen);
    let o = 0;
    for (let i = 0; i + 2 < s.length; i += 3) {
      const run = s[i] | (s[i + 1] << 8);
      const v = s[i + 2];
      for (let r = 0; r < run && o < expectedLen; r++) out[o++] = v;
    }
    return o === expectedLen ? out : null;
  } catch (e) { return null; }
}

function makeWorld(W, D, H, seed, blocks, chests) {
  return { W, D, H, seed: seed || 0, blocks, chests: chests || {} };
}
// Outbound payload for clients (RLE+base64; client falls back to plain b64/array)
function worldPayload(world) {
  return { W: world.W, D: world.D, H: world.H, seed: world.seed, worldRB64: rleEncodeB64(world.blocks), chests: world.chests };
}
// Inbound world from a host client: RLE+base64 (new), plain base64, or legacy array
function worldFromClient(w) {
  if (!w || typeof w !== 'object') return null;
  const W = w.W | 0 || 64, D = w.D | 0 || 64, H = w.H | 0 || 36;
  const expected = W * D * H;
  let blocks = null;
  if (typeof w.worldRB64 === 'string' && w.worldRB64.length > 0) {
    blocks = rleDecodeB64(w.worldRB64, expected);
  }
  if (!blocks && typeof w.worldB64 === 'string' && w.worldB64.length > 0) {
    try {
      const b = b64ToU8(w.worldB64);
      if (b.length === expected) blocks = b;
    } catch (e) { blocks = null; }
  }
  if (!blocks && (Array.isArray(w.array) || Buffer.isBuffer(w.array))) {
    const b = new Uint8Array(w.array);
    if (b.length === expected) blocks = b;
  }
  if (!blocks) return null;
  const chests = (w.chests && typeof w.chests === 'object' && !Array.isArray(w.chests)) ? w.chests : {};
  return makeWorld(W, D, H, w.seed, blocks, chests);
}

function send(ws, data) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}
function broadcastRoom(room, data, exceptId = null) {
  for (const [id, p] of room.players) {
    if (id === exceptId) continue;
    send(p.ws, data);
  }
}

// ----------------------------------------------------------------------
// World persistence on disk (meta.json + data.bin + chests.json per code)
// ----------------------------------------------------------------------
function worldDir(code) { return path.join(WORLDS_DIR, code); }

function saveWorld(code, world, hostName = 'Host') {
  try {
    if (!world || !world.blocks) return { ok: false, error: 'no world' };
    const dir = worldDir(code);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    let nonAir = 0;
    for (let i = 0; i < world.blocks.length; i++) if (world.blocks[i] !== 0) nonAir++;
    const meta = {
      code,
      name: world.name || 'World ' + code,
      seed: world.seed || 0,
      W: world.W, D: world.D, H: world.H,
      blockCount: nonAir,
      createdAt: world.createdAt || Date.now(),
      lastSaved: Date.now(),
      lastHost: hostName,
    };
    const metaPath = path.join(dir, 'meta.json');
    if (fs.existsSync(metaPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        meta.createdAt = existing.createdAt || meta.createdAt;
        if (existing.name) meta.name = existing.name;
      } catch (e) { /* keep defaults */ }
    }
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    fs.writeFileSync(path.join(dir, 'data.bin'), world.blocks);
    fs.writeFileSync(path.join(dir, 'chests.json'), JSON.stringify(world.chests || {}));
    return { ok: true, meta };
  } catch (e) {
    console.error(`[world] save error ${code}:`, e.message);
    return { ok: false, error: 'save failed' };
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
    let chests = {};
    try { chests = JSON.parse(fs.readFileSync(path.join(dir, 'chests.json'), 'utf-8')); } catch (e) { /* empty chests */ }
    return makeWorld(meta.W, meta.D, meta.H, meta.seed, blocks, chests);
  } catch (e) {
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
          const m = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
          worlds.push({ code: m.code, name: m.name, seed: m.seed, W: m.W, D: m.D, H: m.H,
            blockCount: m.blockCount, createdAt: m.createdAt, lastSaved: m.lastSaved, lastHost: m.lastHost });
        } catch (e2) { /* skip broken meta */ }
      }
    }
  } catch (e) { /* worlds dir unreadable */ }
  return worlds.sort((a, b) => (b.lastSaved || 0) - (a.lastSaved || 0));
}

function deleteWorld(code) {
  try {
    const dir = worldDir(code);
    if (!fs.existsSync(dir)) return false;
    for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
    fs.rmdirSync(dir);
    return true;
  } catch (e) { return false; }
}

function renameWorld(code, newName) {
  try {
    const metaPath = path.join(worldDir(code), 'meta.json');
    if (!fs.existsSync(metaPath)) return false;
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    meta.name = String(newName).slice(0, 60);
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    return true;
  } catch (e) { return false; }
}

function scheduleSave(code, delayMs = 5000) {
  if (saveTimers.has(code)) clearTimeout(saveTimers.get(code));
  saveTimers.set(code, setTimeout(() => {
    saveTimers.delete(code);
    const room = rooms.get(code);
    if (room && room.world) {
      const host = room.players.get(room.hostId);
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
    const host = room.players.get(room.hostId);
    return saveWorld(code, room.world, host?.name || 'Host');
  }
  return { ok: false, error: 'No world in room' };
}

// ----------------------------------------------------------------------
// Rate limiting (token bucket per connection) + validation helpers
// ----------------------------------------------------------------------
function rateOk(ws) {
  const now = Date.now();
  if (!ws._rl) ws._rl = { tokens: 60, last: now };
  const dt = (now - ws._rl.last) / 1000;
  ws._rl.last = now;
  ws._rl.tokens = Math.min(60, ws._rl.tokens + dt * 30); // refill 30 msg/s
  if (ws._rl.tokens < 1) return false;
  ws._rl.tokens -= 1;
  return true;
}
const num = (v, lo, hi, dflt = 0) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(lo, Math.min(hi, n));
};

// ----------------------------------------------------------------------
// HTTP: game file + REST API
// ----------------------------------------------------------------------
function isAuthorized(req) {
  const m = req.url.match(/[?&]token=([^&]+)/);
  const token = (m ? decodeURIComponent(m[1]) : '') || (req.headers['x-admin-token'] || '');
  return token.length === ADMIN_TOKEN.length && token === ADMIN_TOKEN;
}

const server = http.createServer((req, res) => {
  // No wildcard CORS: reflect the caller's Origin (public no-credential API),
  // so the game works from any origin without allowing * everywhere.
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const pathOnly = req.url.split('?')[0];

  // JSON responses go through one helper with a strict content type
  const jsonEnd = (status, obj) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(obj));
  };

  // Serve the game — static file from disk, streamed straight through.
  // Nothing request-derived ever lands in an HTML response.
  if (pathOnly === '/' || pathOnly === '/index.html' || pathOnly === '/multiplayer.html') {
    if (!GAME_FILE) { res.writeHead(500, { 'Content-Type': 'text/plain' }); res.end('game file missing'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(GAME_FILE).on('error', () => { res.end(); }).pipe(res);
    return;
  }
  if (pathOnly === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }

  // ---- PWA: manifest + service worker (lets the game play offline on
  // mobile after the first visit). Served here so the game itself stays a
  // single HTML file; on static hosts without these the client skips
  // registration silently.
  if (pathOnly === '/manifest.webmanifest') {
    const manifest = {
      name: 'MiniCraft 3D', short_name: 'MiniCraft',
      start_url: '/', display: 'fullscreen', orientation: 'landscape',
      background_color: '#0a0a14', theme_color: '#f59e0b', icons: [],
    };
    jsonEnd(200, manifest);
    return;
  }
  if (pathOnly === '/sw.js') {
    // Stale-while-revalidate: instant loads offline, self-updates online.
    // Bump CACHE when shipping a new game build so clients refresh.
    const sw = [
      "const CACHE = 'minicraft-v2';",
      "self.addEventListener('install', e => {",
      "  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['/', '/multiplayer.html', '/manifest.webmanifest'])));",
      "  self.skipWaiting();",
      "});",
      "self.addEventListener('activate', e => {",
      "  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));",
      "});",
      "self.addEventListener('fetch', e => {",
      "  if (e.request.method !== 'GET') return;",
      "  const url = new URL(e.request.url);",
      "  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return; // API always live",
      "  e.respondWith(",
      "    caches.match(e.request).then(hit => {",
      "      const live = fetch(e.request).then(res => {",
      "        const copy = res.clone();",
      "        caches.open(CACHE).then(c => c.put(e.request, copy));",
      "        return res;",
      "      }).catch(() => hit);",
      "      return hit || live;",
      "    })",
      "  );",
      "});",
    ].join('\n');
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
    res.end(sw);
    return;
  }

  // List worlds (open — needed by the in-game World Browser)
  if (pathOnly === '/api/worlds' && req.method === 'GET') {
    jsonEnd(200, listWorlds());
    return;
  }
  // Get specific world payload (open — joiners need it)
  const codeMatch = pathOnly.match(/^\/api\/worlds\/([A-Z0-9]{4})$/);
  if (codeMatch && req.method === 'GET') {
    const w = loadWorld(codeMatch[1]);
    if (!w) { jsonEnd(404, { error: 'not found' }); return; }
    jsonEnd(200, worldPayload(w));
    return;
  }
  // Delete world (admin only)
  if (codeMatch && req.method === 'DELETE') {
    if (!isAuthorized(req)) { jsonEnd(403, { ok: false, error: 'admin token required' }); return; }
    jsonEnd(deleteWorld(codeMatch[1]) ? 200 : 404, { ok: true });
    return;
  }
  // Rename world (admin only)
  const renameMatch = pathOnly.match(/^\/api\/worlds\/([A-Z0-9]{4})\/rename$/);
  if (renameMatch && req.method === 'POST') {
    if (!isAuthorized(req)) { jsonEnd(403, { ok: false, error: 'admin token required' }); return; }
    let body = '';
    req.on('data', c => { body += c; if (body.length > 4096) req.destroy(); });
    req.on('end', () => {
      let name = null;
      try { name = JSON.parse(body).name; } catch (e) { name = null; }
      jsonEnd(name ? (renameWorld(renameMatch[1], name) ? 200 : 400) : 400, { ok: !!name });
    });
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
});

// ----------------------------------------------------------------------
// WebSocket rooms
// ----------------------------------------------------------------------
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  let playerId = null;
  let playerName = 'Player';
  let myRoom = null;

  ws.on('message', (raw) => {
    if (!rateOk(ws)) return;
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    const t = msg.type;

    if (t === 'create_room') {
      if (myRoom) return send(ws, { type: 'error', msg: 'Already in a room' });
      let code = genCode();
      let initialWorld = null;
      let initialSeed = msg.seed || null;
      if (msg.resumeCode) {
        const saved = loadWorld(msg.resumeCode);
        if (saved) {
          code = msg.resumeCode;
          initialWorld = saved;
          initialSeed = saved.seed;
          console.log(`[${code}] resumed from disk (${saved.blocks.length} blocks)`);
        } else {
          return send(ws, { type: 'error', msg: 'Saved world not found: ' + msg.resumeCode });
        }
      }
      myRoom = { code, hostId: null, players: new Map(), world: initialWorld, createdAt: Date.now(), lastActivity: Date.now() };
      rooms.set(code, myRoom);
      playerId = nextPlayerId++;
      myRoom.hostId = playerId;
      playerName = String(msg.name || 'Host').slice(0, 24);
      myRoom.players.set(playerId, { ws, name: playerName, x: 0, y: 30, z: 0, yaw: 0, pitch: 0, hp: 20, color: msg.color || '#4a9eff' });
      console.log(`[${code}] created by ${playerName} (player #${playerId})`);
      send(ws, { type: 'room_created', code, id: playerId, seed: initialSeed, resumed: !!initialWorld });
      if (initialWorld) {
        send(ws, { type: 'world_sync', world: worldPayload(initialWorld), seed: initialSeed });
        console.log(`[${code}] world sent to host on resume`);
      }
    }

    else if (t === 'join_room') {
      if (myRoom) return send(ws, { type: 'error', msg: 'Already in a room' });
      const code = String(msg.code || '').toUpperCase().slice(0, 4);
      if (!/^[A-Z0-9]{4}$/.test(code)) return send(ws, { type: 'error', msg: 'Bad room code' });
      let room = rooms.get(code);
      // Revive a saved room so the world survives even with no players online
      if (!room) {
        const saved = loadWorld(code);
        if (saved) {
          room = { code, hostId: null, players: new Map(), world: saved, createdAt: Date.now(), lastActivity: Date.now() };
          rooms.set(code, room);
          console.log(`[${code}] revived from disk for joiner`);
        } else {
          return send(ws, { type: 'error', msg: 'Room not found' });
        }
      }
      if (room.players.size >= 8) return send(ws, { type: 'error', msg: 'Room is full' });
      myRoom = room;
      playerId = nextPlayerId++;
      playerName = String(msg.name || 'Guest').slice(0, 24);
      room.players.set(playerId, { ws, name: playerName, x: 0, y: 30, z: 0, yaw: 0, pitch: 0, hp: 20, color: msg.color || '#ff6b6b' });
      room.lastActivity = Date.now();
      const playerList = [];
      for (const [id, p] of room.players) {
        playerList.push({ id, name: p.name, x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, hp: p.hp, color: p.color });
      }
      send(ws, { type: 'joined', code: room.code, id: playerId, players: playerList,
        world: room.world ? worldPayload(room.world) : null, seed: room.world?.seed || null });
      const newP = room.players.get(playerId);
      broadcastRoom(room, { type: 'player_joined', player: { id: playerId, name: newP.name, x: 0, y: 30, z: 0, yaw: 0, pitch: 0, hp: 20, color: newP.color } }, playerId);
      console.log(`[${room.code}] ${newP.name} joined as #${playerId} (${room.players.size} total)`);
    }

    else if (t === 'move' && myRoom) {
      const p = myRoom.players.get(playerId);
      if (!p) return;
      p.x = num(msg.x, -1e4, 1e4); p.y = num(msg.y, -1e4, 1e4); p.z = num(msg.z, -1e4, 1e4);
      p.yaw = num(msg.yaw, -1e4, 1e4); p.pitch = num(msg.pitch, -1e4, 1e4);
      p.hp = num(msg.hp, 0, 20, 20);
      broadcastRoom(myRoom, { type: 'player_move', id: playerId, x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, hp: p.hp, fly: !!msg.fly }, playerId);
    }

    else if (t === 'block' && myRoom) {
      // Every player's edits persist — not just the host's (old behavior
      // silently discarded all guest work on save/resume)
      const x = Math.trunc(num(msg.x, -1, 1e6, -1));
      const y = Math.trunc(num(msg.y, -1, 1e6, -1));
      const z = Math.trunc(num(msg.z, -1, 1e6, -1));
      const blockId = Math.trunc(num(msg.block, -1, 256, -1));
      const w = myRoom.world;
      if (w && x >= 0 && x < w.W && y >= 0 && y < w.H && z >= 0 && z < w.D && blockId >= 0) {
        const i = x + y * w.W + z * w.W * w.D;
        w.blocks[i] = msg.action === 'break' ? 0 : blockId;
        myRoom.lastActivity = Date.now();
        scheduleSave(myRoom.code, 5000);
      }
      broadcastRoom(myRoom, { type: 'block_change', id: playerId, action: msg.action, x, y, z, block: msg.action === 'break' ? 0 : blockId }, playerId);
    }

    else if (t === 'chest_update' && myRoom) {
      // Accepted from any player (guests use chests too)
      if (myRoom.world && msg.items) {
        const k = `${msg.x | 0}_${msg.y | 0}_${msg.z | 0}`;
        myRoom.world.chests[k] = msg.items;
        myRoom.lastActivity = Date.now();
        scheduleSave(myRoom.code, 5000);
      }
      broadcastRoom(myRoom, { type: 'chest_update', x: msg.x, y: msg.y, z: msg.z, items: msg.items }, playerId);
    }

    else if (t === 'world_state' && myRoom) {
      // Host shares its world
      if (myRoom.hostId === playerId) {
        const world = worldFromClient(msg.world);
        if (world) {
          // A payload without a chests field must not wipe stored chests
          if (!('chests' in msg.world) && myRoom.world && myRoom.world.chests) {
            world.chests = myRoom.world.chests;
          }
          myRoom.world = world;
          myRoom.lastActivity = Date.now();
          for (const [, p] of myRoom.players) {
            send(p.ws, { type: 'world_sync', world: worldPayload(world), seed: msg.seed || world.seed });
          }
          const p = myRoom.players.get(playerId);
          saveWorld(myRoom.code, world, p?.name || 'Host');
          console.log(`[${myRoom.code}] world state shared (${world.blocks.length} blocks)`);
        } else {
          send(ws, { type: 'error', msg: 'Invalid world payload' });
        }
      }
    }

    else if (t === 'world_save' && myRoom) {
      // Manual/autosave from the host
      if (myRoom.hostId === playerId) {
        const world = worldFromClient(msg.world);
        if (world) {
          // A save without a chests field must not wipe stored chests
          if (!('chests' in msg.world) && myRoom.world && myRoom.world.chests) {
            world.chests = myRoom.world.chests;
          }
          // Keep identity fields from the current room world
          world.createdAt = myRoom.world?.createdAt;
          world.name = myRoom.world?.name;
          myRoom.world = world;
          const p = myRoom.players.get(playerId);
          const result = saveWorld(myRoom.code, world, p?.name || 'Host');
          send(ws, { type: 'world_saved', code: myRoom.code, meta: result.meta, when: Date.now() });
        }
      }
    }

    else if (t === 'world_meta_update' && myRoom) {
      if (myRoom.hostId === playerId && msg.name) {
        renameWorld(myRoom.code, msg.name);
        if (myRoom.world) myRoom.world.name = String(msg.name).slice(0, 60);
      }
    }

    else if (t === 'chat' && myRoom) {
      const text = String(msg.msg || '').slice(0, 200);
      if (!text) return;
      broadcastRoom(myRoom, { type: 'chat', id: playerId, name: playerName, msg: text, color: msg.color }, playerId);
      send(ws, { type: 'chat', id: playerId, name: playerName, msg: text, color: msg.color });
    }

    else if (t === 'bot' && myRoom) {
      const p = myRoom.players.get(playerId);
      broadcastRoom(myRoom, {
        type: 'bot', id: playerId, name: p?.name || 'Player', color: p?.color || '#ff8800',
        x: num(msg.x, -1e4, 1e4), y: num(msg.y, -1e4, 1e4), z: num(msg.z, -1e4, 1e4),
        yaw: num(msg.yaw, -1e4, 1e4), visible: !!msg.visible, say: msg.say ? String(msg.say).slice(0, 100) : null,
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
      console.log(`[${myRoom.code}] ${p?.name || '?'} left (${myRoom.players.size} remain)${isHost ? ' [HOST]' : ''}`);
      if (myRoom.players.size === 0) {
        // Last player: save once more, then drop the room (it revives on join)
        if (myRoom.world) saveRoomNow(myRoom.code);
        rooms.delete(myRoom.code);
        console.log(`[${myRoom.code}] room closed (empty)`);
      } else if (isHost) {
        // Host migration: promote the longest-connected remaining player.
        // The world keeps autosaving through the new host.
        const [newHostId, newHost] = myRoom.players.entries().next().value;
        myRoom.hostId = newHostId;
        saveRoomNow(myRoom.code);
        broadcastRoom(myRoom, { type: 'host_migrated', id: newHostId, name: newHost.name });
        console.log(`[${myRoom.code}] host migrated to ${newHost.name} (#${newHostId})`);
      }
    }
  });

  ws.on('error', () => { /* connection-level errors are expected on drop */ });

  send(ws, { type: 'hello', server: 'MiniCraft MP Unified', version: '3.0' });
});

// ----------------------------------------------------------------------
// Periodic autosave (30s) + inactive-room cleanup
// ----------------------------------------------------------------------
setInterval(() => {
  for (const room of rooms.values()) {
    if (room.world && room.hostId && room.players.size > 0) {
      const host = room.players.get(room.hostId);
      saveWorld(room.code, room.world, host?.name || 'Host');
    }
  }
}, 30000);

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (room.players.size === 0 && now - (room.lastActivity || room.createdAt) > 5 * 60 * 1000) {
      rooms.delete(code);
      console.log(`[${code}] cleaned up inactive room`);
    }
  }
}, 60000);

server.listen(PORT, HOST, () => {
  console.log(`MiniCraft MP Unified server listening on http://${HOST}:${PORT}`);
  console.log(`Game file: ${GAME_FILE || 'NOT FOUND'}`);
  console.log(`Worlds dir: ${WORLDS_DIR} (${listWorlds().length} saved)`);
  if (!process.env.MINICRAFT_ADMIN_TOKEN) {
    console.log(`Admin token (this boot): ${ADMIN_TOKEN}`);
    console.log('Set MINICRAFT_ADMIN_TOKEN to pin it across restarts.');
  }
});

setInterval(() => {
  let total = 0;
  for (const r of rooms.values()) total += r.players.size;
  console.log(`[${new Date().toISOString()}] ${rooms.size} active rooms, ${total} players, ${listWorlds().length} saved worlds`);
}, 60000);
