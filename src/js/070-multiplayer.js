// ======================================================================
// TIER 4: MULTIPLAYER (WebSocket client + remote player rendering)
// ======================================================================
// Server URL: detect from page URL, default to a public relay
const MP_SERVER = (() => {
  const override = window.MP_SERVER_OVERRIDE;
  if (override) return override;
  const loc = window.location;
  const host = loc.hostname || '';
  // Served over http(s) by the game server itself: use the SAME origin (host
  // + serving port) so any custom PORT deployment works, not just 3109.
  if ((loc.protocol === 'https:' || loc.protocol === 'http:') && host) {
    if (host.endsWith('space.minimax.io')) {
      return "ws://103.253.75.161:3109/";
    }
    return (loc.protocol === 'https:' ? 'wss://' : 'ws://') + loc.host + '/';
  }
  // file:// (offline single file) — expect a local dev server on the default port
  return 'ws://localhost:3109/';
})();

let mp = {
  ws: null,
  connected: false,
  isHost: false,
  roomCode: null,
  myId: null,
  myColor: '#4a9eff',
  myName: 'Player',
  remotePlayers: new Map(), // id -> {name, x, y, z, yaw, pitch, hp, color, lastUpdate}
  remoteBots: new Map(),    // id -> {ownerName, x, y, z, yaw, visible, sayText, sayUntil, color}
  pendingBlockChanges: [],
  reconnectTimer: null,
  connectedAt: 0,
};

const CHAT_MAX = 50;
const chatLog = [];

function updateMPStatus(msg, color) {
  const el = document.getElementById('mp-status');
  const txt = document.getElementById('mp-status-text');
  if (txt) txt.textContent = msg;
  if (el && msg) {
    el.classList.add('show');
    if (color) el.style.borderColor = color;
  }
}
function hideMPStatus() {
  document.getElementById('mp-status')?.classList.remove('show');
}

function setPlayerName(name) {
  if (name && name.trim()) mp.myName = name.trim().substring(0, 16);
}

function connectMP() {
  if (mp.ws && (mp.ws.readyState === WebSocket.OPEN || mp.ws.readyState === WebSocket.CONNECTING)) return;
  console.log('Connecting to MP server:', MP_SERVER);
  updateMPStatus('กำลังเชื่อมต่อ ' + MP_SERVER + '...', '#4a9eff');
  try {
    mp.ws = new WebSocket(MP_SERVER);
  } catch(e) {
    console.error('WS connect failed:', e);
    updateMPStatus('เชื่อมต่อไม่ได้: ' + e.message, '#ef4444');
    return;
  }
  mp.ws.onopen = () => {
    mp.connected = true;
    mp.connectedAt = Date.now();
    console.log('MP connected');
    updateMPStatus('เชื่อมต่อแล้ว', '#4a9eff');
    setTimeout(hideMPStatus, 2000);
  };
  mp.ws.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch(e) { return; }
    handleMPMessage(msg);
  };
  mp.ws.onclose = (ev) => {
    mp.connected = false;
    mp.roomCode = null;
    mp.myId = null;
    mp.remotePlayers.clear();
    if (mp.remoteBots) mp.remoteBots.clear();
    updateMPUI();
    console.log('MP closed', ev.code, ev.reason);
    updateMPStatus('ขาดการเชื่อมต่อ — กำลังลองใหม่...', '#ef4444');
    // auto-reconnect after 3s
    if (mp.reconnectTimer) clearTimeout(mp.reconnectTimer);
    mp.reconnectTimer = setTimeout(connectMP, 3000);
  };
  mp.ws.onerror = (e) => {
    console.error('WS error:', e);
  };
}

function handleMPMessage(msg) {
  const t = msg.type;
  if (t === 'hello') {
    console.log('Server hello:', msg);
  }
  else if (t === 'room_created') {
    mp.roomCode = msg.code;
    mp.myId = msg.id;
    mp.isHost = true;
    gameStarted = true;
    updateMPStatus('สร้างห้อง ' + msg.code, '#7cda24');
    // Only share local world if not resumed (resumed world comes via world_sync)
    if (!msg.resumed) {
      shareWorldState();
    }
    setTimeout(hideMPStatus, 3000);
    updateMPUI();
  }
  else if (t === 'joined') {
    mp.roomCode = msg.code;
    mp.myId = msg.id;
    // Servers ≥ this build send hostId — the first joiner of a REVIVED room is
    // promoted to host so the world keeps autosaving (older servers: not host).
    mp.isHost = (msg.hostId !== undefined) ? (msg.hostId === msg.id) : false;
    gameStarted = true;
    // Apply world state
    if (msg.world) applyWorldState(msg.world, msg.seed);
    // Add existing players
    mp.remotePlayers.clear();
    for (const p of msg.players) {
      if (p.id !== mp.myId) {
        mp.remotePlayers.set(p.id, p);
      }
    }
    updateMPStatus('เข้าห้อง ' + msg.code, '#7cda24');
    setTimeout(hideMPStatus, 3000);
    updateMPUI();
  }
  else if (t === 'player_joined') {
    mp.remotePlayers.set(msg.player.id, msg.player);
    addChat('System', msg.player.name + ' เข้าห้อง', '#888');
    updateMPUI();
  }
  else if (t === 'player_left') {
    const p = mp.remotePlayers.get(msg.id);
    mp.remotePlayers.delete(msg.id);
    if (p) addChat('System', p.name + ' ออกจากห้อง', '#888');
    updateMPUI();
  }
  else if (t === 'host_migrated') {
    // Server promoted a remaining player after the host left
    if (mp.myId === msg.id) {
      mp.isHost = true;
      toast('👑 host ออก — คุณเป็น host คนใหม่ (โลกจะเซฟผ่านคุณ)');
      addChat('System', '👑 คุณได้เลื่อนเป็น host คนใหม่', '#ffd800');
    } else {
      addChat('System', '👑 ' + (msg.name || 'ผู้เล่นอื่น') + ' เป็น host คนใหม่', '#888');
    }
  }
  else if (t === 'player_move') {
    let p = mp.remotePlayers.get(msg.id);
    if (!p) {
      p = { id: msg.id, name: 'Player', hp: 20, color: '#888' };
      mp.remotePlayers.set(msg.id, p);
    }
    p.x = msg.x; p.y = msg.y; p.z = msg.z;
    p.yaw = msg.yaw; p.pitch = msg.pitch; p.hp = msg.hp;
    p.fly = msg.fly;
    p.lastUpdate = Date.now();
  }
  else if (t === 'bot') {
    // Remote bot update (code editor agent from another player)
    if (!mp.remoteBots) mp.remoteBots = new Map();
    let b = mp.remoteBots.get(msg.id);
    if (!b) {
      b = { id: msg.id, ownerName: msg.name || 'Player', color: msg.color || '#ff8800' };
      mp.remoteBots.set(msg.id, b);
      addChat('System', '🤖 Bot ของ ' + (msg.name || 'Player') + ' ปรากฏตัว', '#888');
    }
    b.x = msg.x; b.y = msg.y; b.z = msg.z;
    b.yaw = msg.yaw; b.visible = msg.visible;
    if (msg.say) {
      b.sayText = msg.say;
      b.sayUntil = Date.now() + 2000;
    }
    b.lastUpdate = Date.now();
  }
  else if (t === 'bot_stop') {
    if (mp.remoteBots) {
      const b = mp.remoteBots.get(msg.id);
      if (b) {
        addChat('System', '🤖 Bot ของ ' + (b.ownerName || 'Player') + ' หยุดทำงาน', '#888');
        mp.remoteBots.delete(msg.id);
      }
    }
  }
  else if (t === 'chest_update') {
    // Update chest from MP sync
    const k = chestKey(msg.x, msg.y, msg.z);
    chests.set(k, { items: msg.items, x: msg.x, y: msg.y, z: msg.z });
    if (openChestRef && openChestRef.x === msg.x && openChestRef.y === msg.y && openChestRef.z === msg.z) {
      renderChest();
    }
  }
  else if (t === 'block_change') {
    // Apply remote block change (setBlock marks the affected chunks dirty)
    if (inBounds(msg.x, msg.y, msg.z)) {
      if (msg.action === 'break') setBlock(msg.x, msg.y, msg.z, B.AIR);
      else if (msg.action === 'place') setBlock(msg.x, msg.y, msg.z, msg.block);
    }
  }
  else if (t === 'world_sync') {
    applyWorldState(msg.world, msg.seed);
  }
  else if (t === 'world_saved') {
    // Server confirmed save
    showSaveIndicator('saved');
    if (msg.meta) {
      console.log('World saved:', msg.meta.code, msg.meta.blockCount, 'blocks');
    }
  }
  else if (t === 'chat') {
    addChat(msg.name, msg.msg, msg.color);
  }
  else if (t === 'error') {
    toast('❌ ' + msg.msg);
  }
}

// Decode a plain-base64 world (fallback when a server sends worldB64 instead
// of the usual RLE+base64 worldRB64)
function b64ToU8(b64, target) {
  try {
    const s = atob(b64);
    if (s.length !== target.length) return false;
    for (let i = 0; i < s.length; i++) target[i] = s.charCodeAt(i);
    return true;
  } catch (e) { return false; }
}

function applyWorldState(w, seed) {
  if (!w) return;
  if (seed != null) currentSeed = seed;
  document.getElementById('seed-display').textContent = 'Seed: ' + currentSeed;
  document.getElementById('dseed').textContent = currentSeed;
  // v3 servers send RLE+base64; plain base64 and legacy arrays still accepted
  let applied = false;
  if (typeof w.worldRB64 === 'string') applied = rleDecodeU8(w.worldRB64, world);
  if (!applied && typeof w.worldB64 === 'string') applied = b64ToU8(w.worldB64, world);
  if (!applied && Array.isArray(w.array) && w.array.length === world.length) {
    for (let i = 0; i < world.length; i++) world[i] = w.array[i];
    applied = true;
  }
  if (!applied) generateWorld(currentSeed);
  // Restore chests
  if (w.chests) {
    chests.clear();
    for (const [k, items] of Object.entries(w.chests)) {
      const ch = getChestByKey(k);
      ch.items = items;
    }
  } else {
    chests.clear();
  }
  meshRebuildNeeded = true;
}

function shareWorldState() {
  if (!mp.connected || !mp.isHost) return;
  // Serialize chests (key -> items)
  const chestData = {};
  for (const [k, ch] of chests.entries()) {
    if (ch.items.some(it => it !== null)) {
      chestData[k] = ch.items;
    }
  }
  sendMP({ type: 'world_state', world: { W, D, H, worldRB64: rleEncodeU8(world), chests: chestData }, seed: currentSeed });
}

function sendMP(msg) {
  if (mp.ws && mp.ws.readyState === WebSocket.OPEN) {
    mp.ws.send(JSON.stringify(msg));
  } else {
    // queue block changes
    if (msg.type === 'block' || msg.type === 'move') {
      mp.pendingBlockChanges.push(msg);
    }
  }
}

// Send move every 100ms (10 times/sec)
let _lastMoveSent = 0;
function sendMoveThrottled() {
  if (!mp.connected || !mp.roomCode) return;
  const now = performance.now();
  if (now - _lastMoveSent < 100) return;
  _lastMoveSent = now;
  sendMP({
    type: 'move',
    x: player.x, y: player.y, z: player.z,
    yaw: player.yaw, pitch: player.pitch,
    hp: player.hp, fly: player.flyMode,
  });
  // Also send bot state if agent is visible
  if (agent.visible) {
    sendMP({
      type: 'bot',
      x: agent.x, y: agent.y, z: agent.z,
      yaw: agent.yaw, visible: agent.visible,
      say: agent.sayText && agent.sayUntil > performance.now() ? agent.sayText : null,
    });
  }
}

// UI Handlers
function showMPPanel(mode) {
  // mode = 'host' or 'join'
  const panel = document.getElementById('mp-panel');
  const title = document.getElementById('mp-panel-title');
  const code = document.getElementById('mp-code');
  const input = document.getElementById('mp-code-input');
  const info = document.getElementById('mp-info');
  const action = document.getElementById('btn-mp-action');
  const roomInfo = document.getElementById('mp-room-info');
  panel.classList.add('show');
  code.style.display = 'none';
  input.style.display = 'none';
  roomInfo.style.display = 'none';
  if (mode === 'host') {
    title.textContent = '🌐 สร้างห้องออนไลน์';
    info.textContent = 'กด "สร้าง" เพื่อสร้างห้อง แล้วแชร์รหัส 4 ตัวให้เพื่อน';
    action.textContent = 'สร้างห้อง';
    action.dataset.mode = 'host';
  } else {
    title.textContent = '🔑 เข้าห้อง';
    info.textContent = 'พิมพ์รหัส 4 ตัวที่เพื่อนส่งให้ แล้วกด "เข้าร่วม"';
    input.style.display = 'inline-block';
    input.value = '';
    setTimeout(() => input.focus(), 100);
    action.textContent = 'เข้าร่วม';
    action.dataset.mode = 'join';
  }
}

function hideMPPanel() {
  document.getElementById('mp-panel').classList.remove('show');
}

// Colors arriving from the network go straight into style="..." — only allow hex,
// anything else (e.g. an attribute-breaking quote) falls back to a safe default.
function sanitizeColor(c, fallback = '#888') {
  return /^#[0-9a-fA-F]{3,8}$/.test(String(c || '')) ? c : fallback;
}

function updateMPUI() {
  const playersEl = document.getElementById('mp-players');
  const listEl = document.getElementById('mp-player-list');
  const countEl = document.getElementById('mp-player-count');
  if (!mp.connected || !mp.roomCode) {
    playersEl.style.display = 'none';
    document.getElementById('chat-toggle').classList.remove('show');
    return;
  }
  playersEl.style.display = 'block';
  document.getElementById('chat-toggle').classList.add('show');
  const total = 1 + mp.remotePlayers.size; // me + others
  countEl.textContent = total;
  // Names/colors come from other players via the server — escape names, validate colors
  let html = `<div class="mp-player-row"><div class="mp-player-dot" style="background:${sanitizeColor(mp.myColor, '#4a9eff')}"></div>${escapeHTML(mp.myName)} <span style="color:#7cda24;font-size:10px">(คุณ)</span></div>`;
  for (const [, p] of mp.remotePlayers) {
    html += `<div class="mp-player-row"><div class="mp-player-dot" style="background:${sanitizeColor(p.color)}"></div>${escapeHTML(p.name)} <span style="color:#888">HP:${escapeHTML(String(p.hp || 20))}</span></div>`;
  }
  listEl.innerHTML = html;
}

// Render other players as simple colored boxes
function renderRemotePlayers() {
  // Build mesh for all remote players and render
  // For simplicity, we use a separate buffer per player
  for (const [id, p] of mp.remotePlayers) {
    if (!p.x) continue;
    if (!p.meshData) {
      p.meshData = buildPlayerBoxMesh(p.color || '#888');
      p.glBuf = createGlBufferFor(p.meshData);
    }
    // Position the player
    const mvp = mat4Mult(getCurrentProjView(), mat4Translate(p.x - 0.3, p.y, p.z - 0.3));
    drawPlayerMesh(p.glBuf, p.meshData, mvp);
    // Name label
    drawPlayerName(p.name, p.x, p.y + 1.9, p.z);
  }
  // Render agent (code editor bot) if visible
  renderAgent();
}

let _agentMeshData = null;
let _agentGlBuf = null;
function renderAgent() {
  if (!agent.visible) return;
  if (!_agentMeshData) {
    _agentMeshData = buildPlayerBoxMesh('#ff8800');
    _agentGlBuf = createGlBufferFor(_agentMeshData);
  }
  const mvp = mat4Mult(getCurrentProjView(), mat4Translate(agent.x - 0.3, agent.y, agent.z - 0.3));
  drawPlayerMesh(_agentGlBuf, _agentMeshData, mvp);
  drawPlayerName('🤖 Bot', agent.x, agent.y + 1.9, agent.z);
  // Floating "say" text
  if (agent.sayUntil && performance.now() < agent.sayUntil) {
    drawPlayerName('💬 ' + agent.sayText, agent.x, agent.y + 2.4, agent.z);
  }
  // Render remote bots too
  renderRemoteBots();
}

const _remoteBotMeshes = new Map(); // id -> {meshData, glBuf}
function renderRemoteBots() {
  if (!mp.remoteBots) return;
  for (const [id, b] of mp.remoteBots) {
    if (!b.visible) continue;
    let cached = _remoteBotMeshes.get(id);
    if (!cached) {
      // Pick color based on owner's color (use a complementary tint)
      const color = b.color || '#ff8800';
      cached = { meshData: buildPlayerBoxMesh(color), glBuf: null };
      cached.glBuf = createGlBufferFor(cached.meshData);
      _remoteBotMeshes.set(id, cached);
    }
    const mvp = mat4Mult(getCurrentProjView(), mat4Translate(b.x - 0.3, b.y, b.z - 0.3));
    drawPlayerMesh(cached.glBuf, cached.meshData, mvp);
    drawPlayerName('🤖 ' + (b.ownerName || 'Bot'), b.x, b.y + 1.9, b.z);
    if (b.sayUntil && Date.now() < b.sayUntil) {
      drawPlayerName('💬 ' + b.sayText, b.x, b.y + 2.4, b.z);
    }
  }
  // Cleanup stale (player disconnected)
  for (const id of _remoteBotMeshes.keys()) {
    if (!mp.remoteBots.has(id)) _remoteBotMeshes.delete(id);
  }
}

// Get current proj*view matrix (computed once per frame in render)
function getCurrentProjView() {
  return _currentPV || mat4Identity();
}

// Build a simple colored box mesh for a player (head + body)
function buildPlayerBoxMesh(color) {
  // Parse color to RGB
  const c = color.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  // Create a simple shader program for solid color (cached)
  // For simplicity, reuse main shader with white texture and tint via... no, simpler: a dedicated solid shader
  // Actually, just use the same shader with white texture and modify... let's create a quick solid color shader
  return { color: [r, g, b], vertices: makeBoxVerts(0.6, 1.7), w: 0.6, h: 1.7 };
}

function makeBoxVerts(w, h) {
  const hw = w / 2;
  // 6 faces, 4 vertices each (no indices, just triangle list)
  const positions = [];
  const normals = [];
  // +X
  positions.push(hw,0,0, hw,h,0, hw,0,hw, hw,h,hw);
  normals.push(1,0,0, 1,0,0, 1,0,0, 1,0,0);
  // -X
  positions.push(-hw,0,hw, -hw,h,hw, -hw,0,0, -hw,h,0);
  normals.push(-1,0,0, -1,0,0, -1,0,0, -1,0,0);
  // +Y (top)
  positions.push(-hw,h,hw, hw,h,hw, -hw,h,0, hw,h,0);
  normals.push(0,1,0, 0,1,0, 0,1,0, 0,1,0);
  // -Y (bottom)
  positions.push(-hw,0,0, hw,0,0, -hw,0,hw, hw,0,hw);
  normals.push(0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0);
  // +Z
  positions.push(hw,0,hw, hw,h,hw, -hw,0,hw, -hw,h,hw);
  normals.push(0,0,1, 0,0,1, 0,0,1, 0,0,1);
  // -Z
  positions.push(-hw,0,0, -hw,h,0, hw,0,0, hw,h,0);
  normals.push(0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1);
  return { positions, normals };
}

// Create a single program for solid color (lazy)
let _solidProg = null;
function getSolidProg() {
  if (_solidProg) return _solidProg;
  const vsSrc = `
    attribute vec3 aPos;
    attribute vec3 aNormal;
    uniform mat4 uMVP;
    uniform mat4 uModel;
    varying vec3 vNormal;
    void main() {
      vNormal = aNormal;
      gl_Position = uMVP * uModel * vec4(aPos, 1.0);
    }
  `;
  const fsSrc = `
    precision mediump float;
    uniform vec3 uColor;
    uniform vec3 uSunDir;
    varying vec3 vNormal;
    void main() {
      vec3 n = normalize(vNormal);
      float diff = max(dot(n, uSunDir), 0.0);
      float ambient = 0.5;
      vec3 col = uColor * (ambient + 0.5 * diff);
      gl_FragColor = vec4(col, 1.0);
    }
  `;
  const vs = compileShader(gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl.FRAGMENT_SHADER, fsSrc);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  _solidProg = {
    prog,
    aPos: gl.getAttribLocation(prog, 'aPos'),
    aNormal: gl.getAttribLocation(prog, 'aNormal'),
    uMVP: gl.getUniformLocation(prog, 'uMVP'),
    uModel: gl.getUniformLocation(prog, 'uModel'),
    uColor: gl.getUniformLocation(prog, 'uColor'),
    uSunDir: gl.getUniformLocation(prog, 'uSunDir'),
  };
  return _solidProg;
}

function createGlBufferFor(mesh) {
  const buf = {
    pos: gl.createBuffer(),
    norm: gl.createBuffer(),
    idx: gl.createBuffer(),
    indexCount: mesh.vertices.positions.length / 3,
  };
  gl.bindBuffer(gl.ARRAY_BUFFER, buf.pos);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.vertices.positions), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf.norm);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.vertices.normals), gl.STATIC_DRAW);
  return buf;
}

function drawPlayerMesh(buf, mesh, mvp) {
  if (!buf) return;
  const sp = getSolidProg();
  gl.useProgram(sp.prog);
  gl.uniformMatrix4fv(sp.uMVP, false, mvp);
  gl.uniformMatrix4fv(sp.uModel, false, mat4Identity());
  gl.uniform3f(sp.uColor, mesh.color[0], mesh.color[1], mesh.color[2]);
  const sun = getSunDir();
  gl.uniform3f(sp.uSunDir, sun[0], sun[1], sun[2]);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf.pos);
  gl.enableVertexAttribArray(sp.aPos);
  gl.vertexAttribPointer(sp.aPos, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf.norm);
  gl.enableVertexAttribArray(sp.aNormal);
  gl.vertexAttribPointer(sp.aNormal, 3, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, buf.indexCount);
  // Restore main program
  gl.useProgram(prog);
}

// Draw a name label above the player (using canvas overlay)
// This uses the 2D canvas as overlay after WebGL renders
const _nameCanvas = document.createElement('canvas');
const _nameCtx = _nameCanvas.getContext('2d');
_nameCanvas.width = 256; _nameCanvas.height = 32;
function drawPlayerName(name, wx, wy, wz) {
  if (!wx) return;
  // Project 3D to screen
  const ex = player.x, ey = player.y + CFG.PLAYER_EYE, ez = player.z;
  const cy = Math.cos(player.yaw), sy = Math.sin(player.yaw);
  const cp = Math.cos(player.pitch), sp = Math.sin(player.pitch);
  const fx = -sy*cp, fy = sp, fz = -cy*cp;
  const flen = Math.sqrt(fx*fx + fy*fy + fz*fz);
  const fnx = fx/flen, fny = fy/flen, fnz = fz/flen;
  // View matrix
  const view = mat4LookAt(ex, ey, ez, ex+fnx, ey+fny, ez+fnz, 0, 1, 0);
  const proj = mat4Perspective(Math.PI/3, canvas.width/canvas.height, 0.1, 500);
  const mvp = mat4Mult(proj, mat4Mult(view, mat4Translate(wx, wy, wz)));
  // Manually apply MVP to (0,0,0)
  const m = mvp;
  // Transform world coords
  const x = wx, y = wy, z = wz;
  const cx2 = m[0]*x + m[4]*y + m[8]*z + m[12];
  const cy2 = m[1]*x + m[5]*y + m[9]*z + m[13];
  const cz2 = m[2]*x + m[6]*y + m[10]*z + m[14];
  const cw = m[3]*x + m[7]*y + m[11]*z + m[15];
  if (cw <= 0) return;
  const ndcX = cx2 / cw, ndcY = cy2 / cw;
  const sx = (ndcX + 1) * 0.5 * canvas.width;
  const sy2 = (1 - ndcY) * 0.5 * canvas.height;
  // Draw name on 2D overlay (we use HUD element)
  // Simplest: add a div dynamically (expensive). Better: keep a small list
  ensureNameLabel(name, sx, sy2);
}

function mat4LookAt(eyeX, eyeY, eyeZ, centerX, centerY, centerZ, upX, upY, upZ) {
  const fx = centerX - eyeX, fy = centerY - eyeY, fz = centerZ - eyeZ;
  const flen = Math.sqrt(fx*fx+fy*fy+fz*fz) || 1;
  const fnx = fx/flen, fny = fy/flen, fnz = fz/flen;
  let sx = fny*upZ - fnz*upY, sy = fnz*upX - fnx*upZ, sz = fnx*upY - fny*upX;
  const slen = Math.sqrt(sx*sx+sy*sy+sz*sz) || 1;
  sx /= slen; sy /= slen; sz /= slen;
  const ux2 = sy*fnz - sz*fny, uy2 = sz*fnx - sx*fnz, uz2 = sx*fny - sy*fnx;
  return new Float32Array([
    sx, ux2, -fnx, 0,
    sy, uy2, -fny, 0,
    sz, uz2, -fnz, 0,
    -(sx*eyeX + sy*eyeY + sz*eyeZ), -(ux2*eyeX + uy2*eyeY + uz2*eyeZ), (fnx*eyeX + fny*eyeY + fnz*eyeZ), 1
  ]);
}

const nameLabels = new Map();
function ensureNameLabel(name, x, y) {
  let el = nameLabels.get(name);
  if (!el) {
    el = document.createElement('div');
    el.style.cssText = 'position:absolute;color:#fff;background:rgba(0,0,0,.6);padding:2px 6px;border-radius:3px;font-size:11px;pointer-events:none;z-index:60;transform:translate(-50%,-100%);white-space:nowrap;border:1px solid rgba(255,255,255,.2)';
    el.textContent = name;
    document.body.appendChild(el);
    nameLabels.set(name, el);
  }
  // Only show if close enough
  if (y < 0 || y > canvas.height || x < 0 || x > canvas.width) {
    el.style.display = 'none';
    return;
  }
  el.style.display = 'block';
  el.style.left = x + 'px';
  el.style.top = (y - 8) + 'px';
}

// Remote players are drawn by the main loop (renderRemotePlayers) right after
// render(), using _currentPV computed there — no render() override needed.

// CHAT
function addChat(name, msg, color) {
  chatLog.push({ name, msg, color, t: Date.now() });
  if (chatLog.length > CHAT_MAX) chatLog.shift();
  const log = document.getElementById('chat-log');
  if (!log) return;
  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.innerHTML = `<span class="chat-name" style="color:${sanitizeColor(color, '#4a9eff')}">${escapeHTML(name)}:</span> ${escapeHTML(msg)}`;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function sendChat() {
  const input = document.getElementById('chat-input');
  if (!input || !input.value.trim()) return;
  const msg = input.value.trim();
  input.value = '';
  // "/command" runs the matching on_chat script from the Block Editor
  if (msg.startsWith('/')) {
    const cmd = msg.slice(1).split(/\s+/)[0];
    triggerChatScript(cmd);
    addChat('🧩 Script', '▶ รันคำสั่ง /' + cmd, '#f59e0b');
    return;
  }
  sendMP({ type: 'chat', name: mp.myName, msg, color: mp.myColor });
  addChat(mp.myName, msg, mp.myColor);
}

// UI: Chat input
document.getElementById('chat-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    sendChat();
    e.preventDefault();
  }
});

document.getElementById('chat-toggle')?.addEventListener('click', () => {
  const chat = document.getElementById('mp-chat');
  chat.classList.toggle('show');
  if (chat.classList.contains('show')) {
    setTimeout(() => document.getElementById('chat-input').focus(), 100);
  }
});

// T key to toggle chat
document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyT' && mouseLocked && mp.connected) {
    e.preventDefault();
    document.getElementById('mp-chat').classList.toggle('show');
    if (document.getElementById('mp-chat').classList.contains('show')) {
      setTimeout(() => document.getElementById('chat-input').focus(), 100);
    }
  }
});

// UI: MP buttons
document.getElementById('btn-mp-host')?.addEventListener('click', () => {
  showMPPanel('host');
});
document.getElementById('btn-mp-join')?.addEventListener('click', () => {
  showMPPanel('join');
});
document.getElementById('btn-mp-back')?.addEventListener('click', hideMPPanel);
document.getElementById('btn-mp-action')?.addEventListener('click', () => {
  const action = document.getElementById('btn-mp-action');
  const mode = action.dataset.mode;
  if (mode === 'host') {
    // Connect, then create
    if (!mp.connected) connectMP();
    setTimeout(() => {
      if (!mp.connected) {
        toast('❌ เชื่อมต่อเซิร์ฟไม่ได้');
        return;
      }
      // Show code immediately
      const code = Math.random().toString(36).substring(2, 6).toUpperCase();
      // Actually let server generate
      sendMP({ type: 'create_room', name: mp.myName, color: mp.myColor });
      // Will be filled by room_created
      const codeEl = document.getElementById('mp-code');
      const info = document.getElementById('mp-info');
      codeEl.textContent = '....';
      codeEl.style.display = 'block';
      info.textContent = 'กำลังสร้างห้อง...';
    }, 200);
  } else {
    const input = document.getElementById('mp-code-input');
    const code = input.value.toUpperCase().trim();
    if (code.length !== 4) {
      toast('❌ รหัส 4 ตัว');
      return;
    }
    if (!mp.connected) connectMP();
    setTimeout(() => {
      if (!mp.connected) { toast('❌ เชื่อมต่อเซิร์ฟไม่ได้'); return; }
      sendMP({ type: 'join_room', code, name: mp.myName, color: mp.myColor });
      const info = document.getElementById('mp-info');
      info.textContent = 'กำลังเข้าห้อง ' + code + '...';
    }, 200);
  }
});

// Display code once received
const _origHandle = handleMPMessage;
// Override the join handler to show code (host)
function updateRoomCodeDisplay(code) {
  const codeEl = document.getElementById('mp-code');
  const info = document.getElementById('mp-info');
  const roomInfo = document.getElementById('mp-room-info');
  codeEl.textContent = code;
  codeEl.style.display = 'block';
  info.textContent = 'แชร์รหัสนี้ให้เพื่อน:';
  roomInfo.textContent = 'ห้องเปิดแล้ว — รอเพื่อนเข้าร่วม...';
  roomInfo.style.display = 'block';
  roomInfo.style.color = '#7cda24';
}

// Patch the handle function to also update the panel display
const _oldHandleMPMessage = handleMPMessage;
handleMPMessage = function(msg) {
  _oldHandleMPMessage(msg);
  if (msg.type === 'room_created') {
    updateRoomCodeDisplay(msg.code);
  }
};

// Broadcast successful block edits. All gameplay logic (mob attack, drops,
// chest contents, hand-item consumption) lives in the base breakBlock/
// placeBlock in 050 — these wrappers only relay the result to the room.
const _origBreakMP = breakBlock;
breakBlock = function() {
  const hit = _origBreakMP();
  if (hit && mp.connected && mp.roomCode) {
    sendMP({ type: 'block', action: 'break', x: hit.x, y: hit.y, z: hit.z, block: 0 });
  }
  return hit;
};

const _origPlaceMP = placeBlock;
placeBlock = function() {
  const placed = _origPlaceMP();
  if (placed && mp.connected && mp.roomCode) {
    sendMP({ type: 'block', action: 'place', x: placed.x, y: placed.y, z: placed.z, block: placed.block });
  }
  return placed;
};

// Cleanup on disconnect
window.addEventListener('beforeunload', () => {
  if (mp.ws) mp.ws.close();
});

// Connect on load (try, but don't block offline play)
connectMP();

// Generate a random color for the player
mp.myColor = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
mp.myName = 'Player' + Math.floor(Math.random() * 1000);

// ======================================================================
// MOD MANAGER UI
// ======================================================================
const SAMPLE_RUBY_MOD = {
  id: 'ruby_mod',
  name: 'Ruby Mod (ตัวอย่าง)',
  version: '1.0.0',
  author: 'MiniCraft',
  items: [
    { id: 'ruby', name: 'ทับทิม', color: '#c83030', shape: 'gem' },
    { id: 'ruby_pickaxe', name: 'พลั่วทับทิม', color: '#c83030', shape: 'tool_pickaxe' },
    { id: 'ruby_sword', name: 'ดาบทับทิม', color: '#c83030', shape: 'tool_sword' },
  ],
  recipes: [
    { id: 'ruby_pickaxe', name: 'พลั่วทับทิม', category: 'tools', result: { name: 'ruby_pickaxe', count: 1 }, ingredients: [{ name: 'ruby', count: 3 }, { name: 'stick', count: 2 }] },
    { id: 'ruby_sword', name: 'ดาบทับทิม', category: 'tools', result: { name: 'ruby_sword', count: 1 }, ingredients: [{ name: 'ruby', count: 2 }, { name: 'stick', count: 1 }] },
  ],
};

function openModsModal() {
  document.getElementById('mods-modal').classList.add('show');
  updateModsUI();
  unlockPointer();
}
function closeModsModal() {
  document.getElementById('mods-modal').classList.remove('show');
  lockPointer();
}
function updateModsUI() {
  // Update mod count badge
  const badge = document.getElementById('mod-count');
  if (badge) badge.textContent = `(${ModManager.mods.length})`;
  // Stats
  const stats = ModManager.stats();
  document.getElementById('mods-stats').innerHTML =
    `<b>📦 ${stats.modCount} mods</b> • 🍳 ${stats.recipeCount} recipes • 🧱 ${stats.itemCount} items<br><span style="color:#888;font-size:11px">Mods: ${ModManager.mods.map(m => escapeHTML(m.name)).join(', ')}</span>`;
  // List
  let html = '';
  for (const m of ModManager.mods) {
    const recipeCount = (m.recipes || []).length;
    const itemCount = (m.items || []).length;
    html += `<div class="mod-row">
      <div class="mod-head">
        <div>
          <div class="mod-name">${escapeHTML(m.name)}${m.builtin ? '<span class="builtin-tag">BUILT-IN</span>' : ''}</div>
          <div class="mod-meta">v${escapeHTML(m.version || '1.0')} • by ${escapeHTML(m.author || '?')} • ${recipeCount} recipes • ${itemCount} items</div>
        </div>
        <div class="mod-actions">
          ${!m.builtin ? `
            <button class="mod-export" data-id="${escapeHTML(m.id)}">📤</button>
            <button class="mod-remove" data-id="${escapeHTML(m.id)}">🗑</button>
          ` : '<span style="color:#7cda24;font-size:11px">⭐ required</span>'}
        </div>
      </div>
    </div>`;
  }
  document.getElementById('mods-list').innerHTML = html;
  // Hook actions
  document.querySelectorAll('.mod-export').forEach(b => {
    b.addEventListener('click', () => exportMod(b.dataset.id));
  });
  document.querySelectorAll('.mod-remove').forEach(b => {
    b.addEventListener('click', () => {
      if (confirm('ลบ mod ' + b.dataset.id + ' ?')) {
        ModManager.remove(b.dataset.id);
        updateModsUI();
        buildCraftUI();
        updateInventoryUI();
        toast('🗑 ลบ mod แล้ว');
      }
    });
  });
}

function installModFromJson(jsonStr) {
  const result = ModManager.installFromJson(jsonStr);
  if (result.ok) {
    toast('✅ ติดตั้ง mod "' + result.mod.name + '" แล้ว');
    updateModsUI();
    buildCraftUI();
    return true;
  } else {
    toast('❌ ' + result.error);
    return false;
  }
}

async function installModFromUrl(url) {
  toast('⏳ กำลังโหลด...');
  const result = await ModManager.installFromUrl(url);
  if (result.ok) {
    toast('✅ ติดตั้ง mod "' + result.mod.name + '" แล้ว');
    updateModsUI();
    buildCraftUI();
  } else {
    toast('❌ ' + result.error);
  }
}

function exportMod(modId) {
  const json = ModManager.export(modId);
  if (!json) return;
  // Copy to clipboard
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(json).then(() => {
      toast('📋 คัดลอก mod ไปยัง clipboard แล้ว');
    }).catch(() => {
      prompt('คัดลอก mod นี้ (Ctrl+A, Ctrl+C):', json);
    });
  } else {
    prompt('คัดลอก mod นี้ (Ctrl+A, Ctrl+C):', json);
  }
}

// Hook buttons
document.getElementById('btn-mods')?.addEventListener('click', openModsModal);
document.getElementById('mods-close')?.addEventListener('click', closeModsModal);
document.getElementById('mods-modal')?.addEventListener('click', e => {
  if (e.target.id === 'mods-modal') closeModsModal();
});
document.getElementById('btn-install-mod')?.addEventListener('click', () => {
  const json = document.getElementById('mod-json-input').value.trim();
  if (!json) { toast('⚠ วาง JSON mod'); return; }
  if (installModFromJson(json)) {
    document.getElementById('mod-json-input').value = '';
  }
});
document.getElementById('btn-install-mod-url')?.addEventListener('click', () => {
  const url = document.getElementById('mod-url-input').value.trim();
  if (!url) { toast('⚠ ใส่ URL'); return; }
  installModFromUrl(url);
});
document.getElementById('btn-load-sample-mod')?.addEventListener('click', () => {
  document.getElementById('mod-name-input').value = 'Ruby Mod (ตัวอย่าง)';
  document.getElementById('mod-json-input').value = JSON.stringify(SAMPLE_RUBY_MOD, null, 2);
  toast('📝 โหลดตัวอย่าง — กดติดตั้งเพื่อลอง');
});

// Update mod count badge
updateModsUI();

