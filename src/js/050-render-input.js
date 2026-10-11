// ======================================================================
// WEBGL SETUP
// ======================================================================
const canvas = document.getElementById('c');
const gl = canvas.getContext('webgl', { antialias: false, alpha: false });

if (!gl) {
  alert('เบราว์เซอร์ไม่รองรับ WebGL — ลอง Chrome / Firefox / Edge เวอร์ชันใหม่');
  throw new Error('No WebGL');
}

function compileShader(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('Shader error:', gl.getShaderInfoLog(s), src);
    return null;
  }
  return s;
}

const VS_SRC = `
attribute vec3 aPos;
attribute vec3 aNormal;
attribute vec2 aUV;
uniform mat4 uMVP;
uniform mat4 uModel;
varying vec3 vNormal;
varying vec2 vUV;
varying float vDist;
void main() {
  vec4 wp = uModel * vec4(aPos, 1.0);
  vDist = length(wp.xyz);
  gl_Position = uMVP * vec4(aPos, 1.0);
  vNormal = aNormal;
  vUV = aUV;
}`;

const FS_SRC = `
precision mediump float;
uniform sampler2D uAtlas;
varying vec3 vNormal;
varying vec2 vUV;
varying float vDist;
uniform vec3 uSunDir;
uniform vec3 uFogColor;
uniform float uFogStart;
uniform float uFogEnd;
uniform float uTime;
uniform float uAmbient;
void main() {
  vec4 c = texture2D(uAtlas, vUV);
  if (c.a < 0.05) discard;
  vec3 n = normalize(vNormal);
  // Use absolute value of sun Y so we get light from above (sun or moon)
  float diff = max(dot(n, vec3(uSunDir.x, abs(uSunDir.y), uSunDir.z)), 0.0);
  float ambient = uAmbient;
  float skyAmb = (n.y * 0.5 + 0.5) * 0.15;
  float light = ambient + skyAmb + 0.55 * diff;
  vec3 col = c.rgb * light;
  float fogF = clamp((vDist - uFogStart) / (uFogEnd - uFogStart), 0.0, 1.0);
  col = mix(col, uFogColor, fogF);
  gl_FragColor = vec4(col, c.a);
}`;

const vs = compileShader(gl.VERTEX_SHADER, VS_SRC);
const fs = compileShader(gl.FRAGMENT_SHADER, FS_SRC);
const prog = gl.createProgram();
gl.attachShader(prog, vs);
gl.attachShader(prog, fs);
gl.linkProgram(prog);
if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
  console.error('Program link error:', gl.getProgramInfoLog(prog));
  alert('WebGL program error');
}
gl.useProgram(prog);

const aPos = gl.getAttribLocation(prog, 'aPos');
const aNormal = gl.getAttribLocation(prog, 'aNormal');
const aUV = gl.getAttribLocation(prog, 'aUV');
const uMVP = gl.getUniformLocation(prog, 'uMVP');
const uModel = gl.getUniformLocation(prog, 'uModel');
const uAtlas = gl.getUniformLocation(prog, 'uAtlas');
const uSunDir = gl.getUniformLocation(prog, 'uSunDir');
const uFogColor = gl.getUniformLocation(prog, 'uFogColor');
const uFogStart = gl.getUniformLocation(prog, 'uFogStart');
const uFogEnd = gl.getUniformLocation(prog, 'uFogEnd');
const uAmbient = gl.getUniformLocation(prog, 'uAmbient');

// Per-chunk GPU buffers: created once, refilled in place on rebuild
// (the old ensureBuffers() allocated fresh buffers on growth and never freed them)
function bindFill(buf, arr, ArrayType, target) {
  gl.bindBuffer(target, buf);
  gl.bufferData(target, new ArrayType(arr), gl.STATIC_DRAW);
}

function uploadChunk(ch) {
  if (!ch.buf) {
    ch.buf = {
      pos: gl.createBuffer(), norm: gl.createBuffer(), uv: gl.createBuffer(), idx: gl.createBuffer(),
      tPos: gl.createBuffer(), tNorm: gl.createBuffer(), tUv: gl.createBuffer(), tIdx: gl.createBuffer(),
    };
  }
  const b = ch.buf;
  bindFill(b.pos, ch.opaque.positions, Float32Array, gl.ARRAY_BUFFER);
  bindFill(b.norm, ch.opaque.normals, Float32Array, gl.ARRAY_BUFFER);
  bindFill(b.uv, ch.opaque.uvs, Float32Array, gl.ARRAY_BUFFER);
  bindFill(b.idx, ch.opaque.indices, Uint16Array, gl.ELEMENT_ARRAY_BUFFER);
  b.iCount = ch.opaque.indices.length;
  bindFill(b.tPos, ch.transp.positions, Float32Array, gl.ARRAY_BUFFER);
  bindFill(b.tNorm, ch.transp.normals, Float32Array, gl.ARRAY_BUFFER);
  bindFill(b.tUv, ch.transp.uvs, Float32Array, gl.ARRAY_BUFFER);
  bindFill(b.tIdx, ch.transp.indices, Uint16Array, gl.ELEMENT_ARRAY_BUFFER);
  b.tCount = ch.transp.indices.length;
}

// Frustum culling (Gribb–Hartmann plane extraction from the proj*view matrix)
let _currentPV = null;    // proj*view of this frame (shared with entity/label projection)
let _frameFrustum = null;
let drawnChunks = 0, drawnFaces = 0;

function extractFrustum(m) {
  const row = i => [m[i], m[4 + i], m[8 + i], m[12 + i]];
  const r0 = row(0), r1 = row(1), r2 = row(2), r3 = row(3);
  const planes = [];
  const push = (a, s) => {
    const p = [r3[0] + s * a[0], r3[1] + s * a[1], r3[2] + s * a[2], r3[3] + s * a[3]];
    const l = Math.hypot(p[0], p[1], p[2]) || 1;
    planes.push([p[0] / l, p[1] / l, p[2] / l, p[3] / l]);
  };
  push(r0, 1); push(r0, -1); push(r1, 1); push(r1, -1); push(r2, 1); push(r2, -1);
  return planes;
}
function chunkVisible(ch) {
  if (!_frameFrustum) return true;
  const x0 = ch.cx * CHUNK, z0 = ch.cz * CHUNK;
  const x1 = x0 + CHUNK, z1 = z0 + CHUNK;
  for (const [a, b, c, d] of _frameFrustum) {
    // Positive vertex test against the chunk's AABB
    const px = a >= 0 ? x1 : x0, py = b >= 0 ? H : 0, pz = c >= 0 ? z1 : z0;
    if (a * px + b * py + c * pz + d < 0) return false;
  }
  return true;
}

// Texture
let atlasTex;
function uploadAtlas(canvas) {
  if (atlasTex) gl.deleteTexture(atlasTex);
  atlasTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, atlasTex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

gl.enable(gl.DEPTH_TEST);
gl.enable(gl.CULL_FACE);
gl.cullFace(gl.BACK);

// ======================================================================
// MATH (matrices, etc.)
// ======================================================================
function mat4Identity() {
  return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
}
function mat4Mult(a, b) {
  const out = new Float32Array(16);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k*4+j] * b[i*4+k];
    out[i*4+j] = s;
  }
  return out;
}
function mat4Perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY/2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f/aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far+near)*nf, -1,
    0, 0, 2*far*near*nf, 0
  ]);
}
function mat4Translate(x, y, z) {
  const m = mat4Identity();
  m[12] = x; m[13] = y; m[14] = z;
  return m;
}
function mat4RotateX(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]);
}
function mat4RotateY(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]);
}

// ======================================================================
// PLAYER & CAMERA
// ======================================================================
const player = {
  x: 24, y: 30, z: 24,
  vx: 0, vy: 0, vz: 0,
  yaw: 0, pitch: 0,
  onGround: false,
  flyMode: false,
  hp: 20
};

let selectedSlot = 0;
const keys = {};
let mouseLocked = false;
let lastBreakTime = 0;
// Air supply for drowning (refills instantly when the head is above water)
const MAX_AIR = 10;
let air = MAX_AIR;
let _drownAcc = 0;

// ======================================================================
// INPUT
// ======================================================================
function lockPointer() { canvas.requestPointerLock(); }
function unlockPointer() { document.exitPointerLock(); }

document.addEventListener('pointerlockchange', () => {
  mouseLocked = document.pointerLockElement === canvas;
  if (mouseLocked) {
    document.body.classList.add('playing');
  } else {
    document.body.classList.remove('playing');
    if (player.yaw !== undefined) saveGame();
  }
});

document.addEventListener('mousemove', (e) => {
  if (!mouseLocked) return;
  player.yaw += e.movementX * CFG.MOUSE_SENS;
  player.pitch -= e.movementY * CFG.MOUSE_SENS;
  player.pitch = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, player.pitch));
});

document.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Space' && mouseLocked) {
    e.preventDefault();
    if (player.flyMode) {
      player.vy = CFG.FLY_SPEED;
    } else if (player.onGround) {
      player.vy = CFG.JUMP_VEL;
      player.onGround = false;
    }
  }
  if (e.code === 'KeyF' && mouseLocked) {
    toggleFly();
  }
  // Number keys 1-8 for hotbar
  if (e.code.startsWith('Digit')) {
    const n = parseInt(e.code.slice(5));
    if (n >= 1 && n <= handSlots.length) {
      selectedSlot = n - 1;
      updateHotbarUI();
    }
  }
  // Save
  if (e.code === 'KeyP' && mouseLocked) saveGame();
  if (e.code === 'KeyR' && mouseLocked) {
    if (confirm('รีโหลดโลกใหม่? (เซฟปัจจุบันจะหายไป)')) {
      startNewWorld();
    }
  }
  if (e.code === 'Escape') {
    if (invOpen) closeInventory();
    else if (craftOpen) closeCrafting();
    else if (ctOpen) closeCraftTable();
    else if (chestOpen) closeChest();
    else if (mouseLocked) {
      // pause
      document.getElementById('pause').classList.add('show');
      unlockPointer();
    }
  }
});

document.addEventListener('keyup', (e) => { keys[e.code] = false; });

// Mouse click for break/place
canvas.addEventListener('mousedown', (e) => {
  if (!mouseLocked) return;
  if (e.button === 0) breakBlock();
  else if (e.button === 2) placeBlock();
  else if (e.button === 1) {
    // middle = pick the looked-at block into the selected hand slot
    const r = raycast();
    if (r) {
      const name = 'block:' + r.block;
      if (player.flyMode || hasItem(name, 1)) {
        handSlots[selectedSlot] = name;
        updateHotbarUI();
      } else {
        toast('ไม่มี ' + (BLOCK_NAMES[r.block] || 'บล็อกนี้') + ' ในคลัง');
      }
    }
  }
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
// ======================================================================
// MOBILE TOUCH SUPPORT
// ======================================================================
const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
if (isTouchDevice) document.body.classList.add('touch');
// Prevent iOS double-tap zoom
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());

// Touch state
const touch = {
  joystick: null,    // { id, baseX, baseY, x, y }
  look: null,        // { id, lastX, lastY, dx, dy }
  buttons: new Map(), // id -> active
};

// Joystick
const joyEl = document.getElementById('mobile-joystick');
const joyBase = document.getElementById('mobile-joystick-base');
const joyThumb = document.getElementById('mobile-joystick-thumb');
let joyCenter = null;
function getJoyCenter() {
  if (!joyCenter) {
    const r = joyBase.getBoundingClientRect();
    joyCenter = { x: r.left + r.width/2, y: r.top + r.height/2 };
  }
  return joyCenter;
}
joyEl.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const t = e.changedTouches[0];
  const c = getJoyCenter();
  touch.joystick = { id: t.identifier, baseX: c.x, baseY: c.y, x: c.x, y: c.y };
  updateJoystickThumb(c.x - 27, c.y - 27);
}, { passive: false });
joyEl.addEventListener('touchmove', (e) => {
  if (!touch.joystick) return;
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === touch.joystick.id) {
      touch.joystick.x = t.clientX;
      touch.joystick.y = t.clientY;
      // Compute distance from base
      const dx = touch.joystick.x - touch.joystick.baseX;
      const dy = touch.joystick.y - touch.joystick.baseY;
      const dist = Math.min(45, Math.sqrt(dx*dx + dy*dy));
      const angle = Math.atan2(dy, dx);
      const tx = touch.joystick.baseX + Math.cos(angle) * dist;
      const ty = touch.joystick.baseY + Math.sin(angle) * dist;
      updateJoystickThumb(tx - 27, ty - 27);
    }
  }
}, { passive: false });
function endJoystick() {
  touch.joystick = null;
  updateJoystickThumb(-1000, -1000); // hide
}
joyEl.addEventListener('touchend', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === touch.joystick?.id) endJoystick();
  }
}, { passive: false });
joyEl.addEventListener('touchcancel', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === touch.joystick?.id) endJoystick();
  }
}, { passive: false });
function updateJoystickThumb(x, y) {
  if (x < -500) { joyThumb.style.opacity = '0'; return; }
  joyThumb.style.opacity = '0.9';
  joyThumb.style.left = x + 'px';
  joyThumb.style.top = y + 'px';
}
// Joystick -> movement keys
function updateJoystickMovement() {
  if (touch.joystick) {
    const dx = touch.joystick.x - touch.joystick.baseX;
    const dy = touch.joystick.y - touch.joystick.baseY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const deadzone = 12;
    if (dist > deadzone) {
      const nx = dx / dist;
      const ny = dy / dist;
      // Map to keys (relative to camera yaw)
      const yaw = player.yaw || 0;
      const cos = Math.cos(yaw), sin = Math.sin(yaw);
      // forward = (-sin, -cos) - player yaw is 0 facing -Z
      // but actually our movement uses sin/cos so let me match existing logic
      // From code: forward = (sin(yaw), 0, cos(yaw)) so:
      // In camera-relative: up on joystick (negative dy in screen) = forward
      // We'll just map directly
      keys['KeyW'] = (-ny > 0.3);   // up = forward
      keys['KeyS'] = (-ny < -0.3);  // down = back
      keys['KeyA'] = (-nx > 0.3);   // left = strafe left
      keys['KeyD'] = (-nx < -0.3);  // right = strafe right
    } else {
      keys['KeyW'] = keys['KeyS'] = keys['KeyA'] = keys['KeyD'] = false;
    }
  }
}

// Look (right side drag)
const lookEl = document.getElementById('mobile-look');
lookEl.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const t = e.changedTouches[0];
  touch.look = { id: t.identifier, lastX: t.clientX, lastY: t.clientY };
}, { passive: false });
lookEl.addEventListener('touchmove', (e) => {
  if (!touch.look) return;
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === touch.look.id) {
      const dx = t.clientX - touch.look.lastX;
      const dy = t.clientY - touch.look.lastY;
      // Apply look (scaled up for touch)
      player.yaw -= dx * 0.005;
      player.pitch -= dy * 0.005;
      if (player.pitch > 1.4) player.pitch = 1.4;
      if (player.pitch < -1.4) player.pitch = -1.4;
      touch.look.lastX = t.clientX;
      touch.look.lastY = t.clientY;
    }
  }
}, { passive: false });
lookEl.addEventListener('touchend', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === touch.look?.id) touch.look = null;
  }
}, { passive: false });
lookEl.addEventListener('touchcancel', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === touch.look?.id) touch.look = null;
  }
}, { passive: false });

// Action buttons
const actionHandlers = {
  // Jump directly: the Space-key path only fires from real keydown events,
  // which touch buttons never produce
  jump: () => {
    if (player.flyMode) player.vy = CFG.FLY_SPEED;
    else if (player.onGround) { player.vy = CFG.JUMP_VEL; player.onGround = false; }
  },
  fly: () => toggleFly(),
  break: () => breakBlock(),
  place: () => placeBlock(),
  inv: () => { if (typeof openInventory === 'function') openInventory(); else document.getElementById('inv-modal')?.classList.add('show'); },
  menu: () => { document.exitPointerLock?.(); document.getElementById('pause')?.classList.add('show'); },
};
document.querySelectorAll('.mob-btn').forEach(btn => {
  const action = btn.dataset.action;
  btn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (actionHandlers[action]) actionHandlers[action]();
    btn.style.transform = 'scale(0.85)';
  }, { passive: false });
  btn.addEventListener('touchend', (e) => {
    e.preventDefault();
    btn.style.transform = '';
  }, { passive: false });
});

// Hotbar touch: tap to select
document.getElementById('hotbar')?.addEventListener('touchstart', (e) => {
  const slot = e.target.closest('.hotbar-slot');
  if (!slot) return;
  const idx = parseInt(slot.dataset.idx);
  if (!isNaN(idx)) {
    selectedSlot = idx;
    updateHotbarUI();
  }
});

// Touch look for canvas: also allow tapping to break
canvas.addEventListener('touchstart', (e) => {
  if (!isTouchDevice) return;
  // If touch is on the canvas directly (not on UI), break
  if (e.target === canvas) {
    e.preventDefault();
    breakBlock();
  }
}, { passive: false });

// Joystick movement is polled from the main loop each frame

canvas.addEventListener('wheel', (e) => {
  if (!mouseLocked) return;
  if (e.deltaY > 0) selectedSlot = (selectedSlot + 1) % handSlots.length;
  else selectedSlot = (selectedSlot - 1 + handSlots.length) % handSlots.length;
  updateHotbarUI();
  e.preventDefault();
}, { passive: false });

// ======================================================================
// RAYCAST (for block break/place)
// ======================================================================
function raycast() {
  const ex = player.x, ey = player.y + CFG.PLAYER_EYE, ez = player.z;
  // Forward vector
  const cy = Math.cos(player.yaw), sy = Math.sin(player.yaw);
  const cp = Math.cos(player.pitch), sp = Math.sin(player.pitch);
  const dx = -sy * cp, dy = sp, dz = -cy * cp;

  let x = Math.floor(ex), y = Math.floor(ey), z = Math.floor(ez);
  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  const stepZ = dz > 0 ? 1 : -1;
  const tDeltaX = Math.abs(1/dx);
  const tDeltaY = Math.abs(1/dy);
  const tDeltaZ = Math.abs(1/dz);
  const fracX = dx > 0 ? (x+1 - ex) : (ex - x);
  const fracY = dy > 0 ? (y+1 - ey) : (ey - y);
  const fracZ = dz > 0 ? (z+1 - ez) : (ez - z);
  let tMaxX = isFinite(tDeltaX) ? fracX * tDeltaX : 1e9;
  let tMaxY = isFinite(tDeltaY) ? fracY * tDeltaY : 1e9;
  let tMaxZ = isFinite(tDeltaZ) ? fracZ * tDeltaZ : 1e9;

  let lastX = x, lastY = y, lastZ = z;
  let dist = 0;
  while (dist < CFG.REACH) {
    let b = getBlock(x, y, z);
    // Skip open doors for raycast
    if (b === B.DOOR && (meta[idx(x, y, z)] & 2) !== 0) b = B.AIR;
    if (b !== B.AIR && b !== B.LEAVES) {
      return { x, y, z, block: b, normal: [lastX, lastY, lastZ] };
    }
    if (b !== B.AIR && b === B.LEAVES) {
      return { x, y, z, block: b, normal: [lastX, lastY, lastZ] };
    }
    lastX = x; lastY = y; lastZ = z;
    if (tMaxX < tMaxY && tMaxX < tMaxZ) { dist = tMaxX; tMaxX += tDeltaX; x += stepX; }
    else if (tMaxY < tMaxZ) { dist = tMaxY; tMaxY += tDeltaY; y += stepY; }
    else { dist = tMaxZ; tMaxZ += tDeltaZ; z += stepZ; }
  }
  return null;
}

// Break a block OR attack the mob under the crosshair (left-click action).
// Returns { x, y, z, block } on a successful block break, else null —
// the MP layer (070) broadcasts whatever comes back.
function breakBlock() {
  const now = performance.now();
  if (now - lastBreakTime < 200) return null;
  // Attack takes priority: hit the mob under the crosshair, if any
  const target = mobUnderCrosshair();
  if (target) {
    lastBreakTime = now;
    attackMob(target);
    return null;
  }
  const r = raycast();
  if (!r) return null;
  lastBreakTime = now;
  const b = r.block;
  if (b === B.BEDROCK) { toast('⛏ หินฐานทุบไม่ได้'); return null; }
  setBlock(r.x, r.y, r.z, B.AIR); // marks the affected chunks dirty
  dropBlock(b);
  addParticles(r.x + 0.5, r.y + 0.5, r.z + 0.5, BLOCK_COLORS[b] || '#cccccc', 10);
  // Breaking a chest returns its contents to the inventory
  if (b === B.CHEST) {
    const k = chestKey(r.x, r.y, r.z);
    const ch = chests.get(k);
    if (ch) {
      for (const it of ch.items) if (it) addToInventory(it.name, it.count);
      chests.delete(k);
      toast('📦 หีบแตก — ของในหีบกลับเข้าคลัง');
    }
  }
  stats.blocksBroken[b] = (stats.blocksBroken[b] || 0) + 1;
  playSound(SOUND_BLOCKS[b] || 'break');
  // Mob aggro
  for (const m of mobs) {
    const dx = m.x - r.x, dz = m.z - r.z;
    if (Math.sqrt(dx*dx + dz*dz) < 8 && MOB_TYPES[m.type].hostile) m.target = player;
  }
  toast('⛏ ทุบ ' + BLOCK_NAMES[b]);
  return { x: r.x, y: r.y, z: r.z, block: b };
}

// Place the block held in the selected hand slot — or EAT when food is in
// hand. Returns { x, y, z, block } on success, else null (MP broadcasts it).
function placeBlock() {
  const handItem = handSlots[selectedSlot];
  // Right-click with food in hand = eat
  if (handItem && FOODS[handItem]) { eatItem(handItem); return null; }
  const r = raycast();
  if (!r) return null;
  if (!handItem || !handItem.startsWith('block:')) {
    toast(handItem ? '🚫 ' + itemDisplayName(handItem) + ' วางไม่ได้' : '🚫 ช่องมือว่าง — กด E แล้วคลิกซ้ายของเพื่อถือ');
    return null;
  }
  const blockId = parseInt(handItem.slice(6));
  // Survival must own the item; fly mode = creative, placement is free
  if (!player.flyMode && !hasItem(handItem, 1)) {
    toast('❌ ' + (BLOCK_NAMES[blockId] || 'บล็อกนี้') + ' หมดแล้ว');
    return null;
  }
  const nx = r.normal[0], ny = r.normal[1], nz = r.normal[2];
  const px = Math.floor(player.x), py = Math.floor(player.y), pz = Math.floor(player.z);
  const px2 = Math.floor(player.x + 0.3), py2 = Math.floor(player.y + 1.5), pz2 = Math.floor(player.z + 0.3);
  if ((nx === px && (ny === py || ny === py2) && nz === pz) ||
      (nx === px2 && (ny === py || ny === py2) && nz === pz2)) {
    toast('❌ วางตรงนี้ไม่ได้');
    return null;
  }
  setBlock(nx, ny, nz, blockId); // marks the affected chunks dirty
  if (!player.flyMode) removeFromInventory(handItem, 1);
  stats.blocksPlaced++;
  if (blockId === B.DOOR) stats.doorsPlaced++;
  playSound(PLACE_SOUND[blockId] || 'place');
  if (stats.blocksPlaced >= 1) awardAchievement('first_step');
  if (stats.blocksPlaced >= 50) awardAchievement('builder');
  toast('🧱 วาง ' + BLOCK_NAMES[blockId]);
  return { x: nx, y: ny, z: nz, block: blockId };
}

// ======================================================================
// PHYSICS / MOVEMENT
// ======================================================================
function isSolid(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const b = getBlock(xi, yi, zi);
  if (b === B.AIR || b === B.WATER) return false;
  if (b === B.DOOR) {
    // door is solid only when closed (meta bit 1 = 0)
    return (meta[idx(xi, yi, zi)] & 2) === 0;
  }
  return true;
}

function moveAxis(axis, delta) {
  const newPos = { x: player.x, y: player.y, z: player.z };
  newPos[axis] += delta;
  // AABB check
  const hw = CFG.PLAYER_W / 2;
  const minX = newPos.x - hw, maxX = newPos.x + hw;
  const minY = newPos.y, maxY = newPos.y + CFG.PLAYER_H;
  const minZ = newPos.z - hw, maxZ = newPos.z + hw;
  for (let by = Math.floor(minY); by <= Math.floor(maxY); by++) {
    for (let bz = Math.floor(minZ); bz <= Math.floor(maxZ); bz++) {
      for (let bx = Math.floor(minX); bx <= Math.floor(maxX); bx++) {
        if (isSolid(bx, by, bz)) {
          // Collision - reject
          if (axis === 'x') {
            if (delta > 0) player.x = bx - hw - 0.001;
            else player.x = bx + 1 + hw + 0.001;
            player.vx = 0;
          } else if (axis === 'y') {
            if (delta > 0) player.y = by - CFG.PLAYER_H - 0.001;
            else { player.y = by + 1 + 0.001; player.onGround = true; }
            player.vy = 0;
          } else {
            if (delta > 0) player.z = bz - hw - 0.001;
            else player.z = bz + 1 + hw + 0.001;
            player.vz = 0;
          }
          return;
        }
      }
    }
  }
  player[axis] = newPos[axis];
  if (axis === 'y' && delta > 0) player.onGround = false;
}

// "Actually playing" = inside a started world, not behind any modal/pause.
// Desktop keeps pointer-lock semantics through the modal/pause flags; mobile
// touch sessions (which can never pointer-lock) simulate properly now.
function anyModalOpen() {
  if (invOpen || craftOpen || ctOpen || chestOpen) return true;
  const ids = ['pause', 'code-modal', 'mods-modal', 'worlds-modal', 'ai-modal'];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el && el.classList.contains('show')) return true;
  }
  return false;
}
function isGameActive() {
  return gameStarted && !anyModalOpen();
}

// Fly = creative mode: free block placement, no hunger/fall damage, and
// empty hand slots fill with a starter palette for free building.
function toggleFly() {
  player.flyMode = !player.flyMode;
  player.vy = 0;
  if (player.flyMode) {
    for (let i = 0; i < handSlots.length; i++) {
      if (!handSlots[i]) handSlots[i] = 'block:' + HOTBAR[i];
    }
    if (air < MAX_AIR) { air = MAX_AIR; _drownAcc = 0; updateAirUI(); }
    updateHotbarUI();
    toast('🪽 โหมดบิน (ครีเอทีฟ) — วางบล็อกฟรี');
  } else {
    toast('🚶 โหมดเดิน (เซอร์ไววัล) — วางบล็อกต้องมีของ');
  }
}

function updatePlayer(dt) {
  if (!isGameActive()) return;
  // Movement input
  const forward = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
  const strafe = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);
  const speed = (keys['ShiftLeft'] || keys['ShiftRight']) ? CFG.RUN_SPEED : CFG.WALK_SPEED;

  const cy = Math.cos(player.yaw), sy = Math.sin(player.yaw);
  // forward = -sin(yaw), strafe = cos(yaw) in xz plane (negate sy)
  // Note: We want W to move in -Z (north)
  let mvx = 0, mvz = 0;
  if (forward) { mvx -= sy * forward; mvz -= cy * forward; }
  if (strafe)  { mvx += cy * strafe;  mvz -= sy * strafe; }
  const len = Math.sqrt(mvx*mvx + mvz*mvz);
  if (len > 0) { mvx /= len; mvz /= len; }

  if (player.flyMode) {
    player.vx = mvx * speed;
    player.vz = mvz * speed;
    player.vy = 0;
    if (keys['Space']) player.vy = CFG.FLY_SPEED;
    if (keys['ShiftLeft'] || keys['ShiftRight']) player.vy = -CFG.FLY_SPEED;
  } else {
    player.vx = mvx * speed;
    player.vz = mvz * speed;
    // --- Water physics: buoyancy, sluggish movement, no fall damage ---
    const feetIn = getBlock(Math.floor(player.x), Math.floor(player.y + 0.2), Math.floor(player.z)) === B.WATER;
    const headIn = getBlock(Math.floor(player.x), Math.floor(player.y + CFG.PLAYER_EYE), Math.floor(player.z)) === B.WATER;
    if (feetIn || headIn) {
      if (!player._inWater) {
        player._inWater = true;
        if (player.vy < -4) {
          playSound('splash');
          addParticles(player.x, player.y + 1, player.z, '#7ab8e8', 14);
        }
      }
      fallStart = 0; // entering water cancels accumulated fall damage
      player.vx *= 0.6;
      player.vz *= 0.6;
      player.vy += CFG.GRAVITY * 0.3 * dt; // gentle sinking
      if (player.vy < -2.5) player.vy = -2.5;
      if (keys['Space']) player.vy = Math.min(player.vy + 24 * dt, 3.0); // swim up
    } else {
      if (player._inWater) player._inWater = false;
      player.vy += CFG.GRAVITY * dt;
      if (player.vy < -30) player.vy = -30;
    }
    // --- Air / drowning ---
    if (headIn) {
      air -= dt / 1.4;
      if (air <= 0) {
        air = 0;
        _drownAcc += dt;
        if (_drownAcc >= 1) { _drownAcc = 0; damagePlayer(1, 'drown'); }
      }
    } else if (air < MAX_AIR) {
      air = MAX_AIR;
      _drownAcc = 0;
    }
    updateAirUI();
    player.onGround = false;
  }

  // Move
  moveAxis('x', player.vx * dt);
  moveAxis('z', player.vz * dt);
  moveAxis('y', player.vy * dt);

  // Out of world reset
  if (player.y < -10) {
    const sp = findSpawn();
    player.x = sp.x; player.y = sp.y; player.z = sp.z;
    player.vy = 0;
    toast('🌍 กลับจุดเกิด');
  }

  // Fall damage tracking
  trackFall();
  // Footstep sound
  tryStepSound(dt);
  // Walked-distance stat (feeds achievements)
  if (!player.flyMode && (Math.abs(player.vx) + Math.abs(player.vz)) > 0.5) {
    stats.stepsWalked += dt;
  }
}

// ======================================================================
// RENDER LOOP
// ======================================================================
let lastT = 0;
let fpsAvg = 0, fpsFrame = 0;
let mmLastDraw = 0;
function loop(t) {
  const dt = Math.min((t - lastT) / 1000, 0.1);
  lastT = t;

  // FPS
  if (dt > 0) {
    fpsAvg = fpsAvg * 0.9 + (1/dt) * 0.1;
    fpsFrame++;
    if (fpsFrame % 10 === 0) {
      document.getElementById('fps').textContent = fpsAvg.toFixed(0);
    }
  }

  // Resize
  if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  // Rebuild only dirty chunks (meshRebuildNeeded = rebuild everything once)
  if (meshRebuildNeeded) {
    for (const ch of chunks) ch.dirty = true;
    meshRebuildNeeded = false;
  }
  let totalFaces = 0, totalVerts = 0, rebuilt = 0;
  for (const ch of chunks) {
    if (ch.dirty) { buildChunkMesh(ch); rebuilt++; }
    totalFaces += ch.faces;
    totalVerts += (ch.opaque.positions.length + ch.transp.positions.length) / 3;
  }
  if (rebuilt > 0 && fpsFrame % 10 === 0) {
    document.getElementById('dfaces').textContent = totalFaces.toLocaleString();
    document.getElementById('dverts').textContent = totalVerts.toLocaleString();
  }
  document.getElementById('dchunk').textContent = `Chunks: ${drawnChunks}/${chunks.length} (rebuilt ${rebuilt})`;

  // Touch joystick feeds the same key map the keyboard uses
  if (isTouchDevice) updateJoystickMovement();

  updatePlayer(dt);

  // World simulation runs only while actually playing and not behind a modal.
  // (This gate is what makes mobile touch sessions work — pointer lock never
  // happens there, so the old mouseLocked gate froze the whole game.)
  if (isGameActive()) {
    const timeSpeed = player.flyMode ? 6 : 1; // creative = 6x
    gameTime += dt * (24000 / CFG.DAY_LENGTH_SEC) * timeSpeed;
    if (gameTime >= 24000) gameTime -= 24000;
    updateTimeUI();
    updateMobs(dt);
    trackStats(dt);
    if (Math.random() < dt * 2) updateRedstone();
    if (Math.random() < dt * 0.5) checkAchievements();
  }

  updateParticles(dt);

  render();
  renderMobs();            // mobs in 3D (previously minimap-only)
  renderParticles();       // block-break particles
  renderRemotePlayers();   // remote players + agent + bots + name labels

  if (mp.connected && mp.roomCode) sendMoveThrottled();

  // Minimap scans the world column-by-column — 4 fps is plenty
  if (t - mmLastDraw > 250) { drawMinimap(); mmLastDraw = t; }

  document.getElementById('pos').textContent =
    `${player.x.toFixed(1)}, ${player.y.toFixed(1)}, ${player.z.toFixed(1)}`;

  // Update looked-at block name
  if (mouseLocked || isTouchDevice) {
    const r = raycast();
    document.getElementById('bname').textContent = r ? BLOCK_NAMES[r.block] : '-';
  }

  requestAnimationFrame(loop);
}

function render() {
  // Clear with sky color
  // Clear with sky color based on time
  const sky = getSkyColor();
  gl.clearColor(sky[0], sky[1], sky[2], 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Camera matrices
  const aspect = canvas.width / canvas.height;
  const proj = mat4Perspective(Math.PI/3, aspect, 0.1, 500);
  // View matrix = inverse of (translate(player) * rotate(-pitch) * rotate(-yaw))
  const cy = Math.cos(player.yaw), sy = Math.sin(player.yaw);
  const cp = Math.cos(player.pitch), sp = Math.sin(player.pitch);
  // Forward
  const fx = -sy*cp, fy = sp, fz = -cy*cp;
  // Right
  const rx = cy, ry = 0, rz = -sy;
  // Up
  const ux = sy*sp, uy = cp, uz = cy*sp;
  // Look-at point
  const ex = player.x, ey = player.y + CFG.PLAYER_EYE, ez = player.z;
  const lx = ex + fx, ly = ey + fy, lz = ez + fz;
  // Build view matrix (lookAt)
  const fxv = lx-ex, fyv = ly-ey, fzv = lz-ez;
  const flen = Math.sqrt(fxv*fxv+fyv*fyv+fzv*fzv);
  const fnx = fxv/flen, fny = fyv/flen, fnz = fzv/flen;
  // s = f x up
  let sxv = fny*uz - fnz*uy, syv = fnz*ux - fnx*uz, szv = fnx*uy - fny*ux;
  const slen = Math.sqrt(sxv*sxv+syv*syv+szv*szv);
  sxv/=slen; syv/=slen; szv/=slen;
  // u = s x f
  const ux2 = syv*fnz - szv*fny, uy2 = szv*fnx - sxv*fnz, uz2 = sxv*fny - syv*fnx;
  const view = new Float32Array([
    sxv, ux2, -fnx, 0,
    syv, uy2, -fny, 0,
    szv, uz2, -fnz, 0,
    -(sxv*ex + syv*ey + szv*ez), -(ux2*ex + uy2*ey + uz2*ez), (fnx*ex + fny*ey + fnz*ez), 1
  ]);
  // Rotate world relative to camera (model = inverse of player rotation)
  // For simplicity, model = identity (world is static, camera moves)
  const model = mat4Identity();
  const mvp = mat4Mult(proj, view); // model is identity for the static world
  _currentPV = mvp;
  _frameFrustum = extractFrustum(mvp);

  gl.useProgram(prog);
  gl.uniformMatrix4fv(uMVP, false, mvp);
  gl.uniformMatrix4fv(uModel, false, model);
  // Dynamic sun direction and fog color based on time
  const sunDir = getSunDir();
  gl.uniform3f(uSunDir, sunDir[0], sunDir[1], sunDir[2]);
  gl.uniform3f(uFogColor, sky[0], sky[1], sky[2]);
  gl.uniform1f(uFogStart, 30);
  gl.uniform1f(uFogEnd, 90);
  // Ambient based on time of day (brighter during day)
  const ambient = isNight() ? 0.25 : 0.45;
  gl.uniform1f(uAmbient, ambient);

  if (atlasTex) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.uniform1i(uAtlas, 0);
  }

  // Opaque chunk pass, then transparent (water/glass) with blending
  drawnChunks = 0; drawnFaces = 0;
  for (const ch of chunks) {
    if (!ch.buf || !ch.buf.iCount) continue;
    if (!chunkVisible(ch)) continue;
    const b = ch.buf;
    gl.bindBuffer(gl.ARRAY_BUFFER, b.pos);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.norm);
    gl.enableVertexAttribArray(aNormal);
    gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.uv);
    gl.enableVertexAttribArray(aUV);
    gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.idx);
    gl.drawElements(gl.TRIANGLES, b.iCount, gl.UNSIGNED_SHORT, 0);
    drawnChunks++;
    drawnFaces += ch.faces;
  }

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false); // don't write to depth buffer for transparent
  for (const ch of chunks) {
    if (!ch.buf || !ch.buf.tCount) continue;
    if (!chunkVisible(ch)) continue;
    const b = ch.buf;
    gl.bindBuffer(gl.ARRAY_BUFFER, b.tPos);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.tNorm);
    gl.enableVertexAttribArray(aNormal);
    gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.tUv);
    gl.enableVertexAttribArray(aUV);
    gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.tIdx);
    gl.drawElements(gl.TRIANGLES, b.tCount, gl.UNSIGNED_SHORT, 0);
  }
  gl.depthMask(true);
  gl.disable(gl.BLEND);
}

// ======================================================================
// UI
// ======================================================================
function buildHotbarUI() {
  const hb = document.getElementById('hotbar');
  hb.innerHTML = '';
  for (let i = 0; i < handSlots.length; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot' + (i === selectedSlot ? ' active' : '');
    slot.dataset.idx = i;
    const icon = document.createElement('canvas');
    icon.width = icon.height = 32;
    slot.appendChild(icon);
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = (i + 1);
    slot.appendChild(num);
    const lbl = document.createElement('span');
    lbl.className = 'lbl';
    slot.appendChild(lbl);
    const cnt = document.createElement('span');
    cnt.className = 'hcount';
    slot.appendChild(cnt);
    slot.addEventListener('click', () => {
      selectedSlot = i;
      updateHotbarUI();
    });
    hb.appendChild(slot);
  }
  updateHotbarUI();
}

function drawBlockIcon(ctx, bid, x, y, s) {
  // Draw isometric-ish preview using FACE_TEX
  const top = FACE_TEX[bid]?.[0] ?? 3;
  const side = FACE_TEX[bid]?.[1] ?? 3;
  // simple 2D: top half = top texture, bottom half = side texture
  // Draw top face
  // Note: simple color preview (no atlas sampling for icons)
  // Can't easily draw sub-region of atlas in icon - use color
  const colors = {
    [B.GRASS]: ['#7ac828','#5da31e'], [B.DIRT]: ['#8c6438','#6e4a25'],
    [B.STONE]: ['#909098','#707078'], [B.SAND]: ['#e8d090','#d4b870'],
    [B.WOOD]: ['#9c7038','#6a4820'], [B.LEAVES]: ['#3a8a25','#1a5a0a'],
    [B.PLANKS]: ['#c8a065','#a88548'], [B.COBBLE]: ['#7a7a82','#5a5a62'],
    [B.BEDROCK]: ['#404048','#1a1a22'], [B.SNOW]: ['#fafaff','#dde0ee'],
    [B.BRICK]: ['#a04028','#6a2810'], [B.PUMPKIN]: ['#ec8424','#c8631a'],
    [B.GLASS]: ['#cce4f0','#88a8c0'], [B.TORCH]: ['#ffd800','#ff7a00'],
    [B.DOOR]: ['#9c6a30','#6e4818'], [B.CACTUS]: ['#3a8a25','#1a5a0a'],
    [B.SANDSTONE]: ['#d4b870','#a08850'], [B.ICE]: ['#9cc0d8','#6a90b0'],
    [B.ORE_COAL]: ['#707078','#0a0a0a'], [B.ORE_IRON]: ['#909098','#c8a878'],
    [B.ORE_GOLD]: ['#909098','#e8c040'], [B.ORE_DIAMOND]: ['#909098','#5cd0e8'],
    [B.GLOWSTONE]: ['#f0c850','#a08020'], [B.CRAFTING_TABLE]: ['#9c6a30','#5a3818'],
    [B.LEVER]: ['#c84020','#5a3818'], [B.PRESSURE_PLATE]: ['#e8c040','#a08020'],
    [B.FLOWER]: ['#ec5cd0','#3a8a25'], [B.SAPLING]: ['#3a8a25','#5a3818'],
  };
  const c = colors[bid] || ['#888','#555'];
  ctx.fillStyle = c[0];
  ctx.fillRect(x, y, s, s/2);
  ctx.fillStyle = c[1];
  ctx.fillRect(x, y + s/2, s, s/2);
  // Border
  ctx.strokeStyle = 'rgba(0,0,0,.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x+.5, y+.5, s-1, s-1);
}

// Human-readable name for any hand/inventory item ('block:N' or item id)
function itemDisplayName(name) {
  if (!name) return '';
  if (name.startsWith('block:')) {
    const bid = parseInt(name.slice(6));
    return BLOCK_NAMES[bid] || ('block:' + bid);
  }
  const items = getItems();
  return (items.get(name) || { name }).name;
}
function invCount(name) {
  for (const it of inventory) if (it.name === name) return it.count;
  return 0;
}

function updateHotbarUI() {
  const slots = document.querySelectorAll('#hotbar .slot');
  slots.forEach((s, i) => {
    s.className = 'slot' + (i === selectedSlot ? ' active' : '');
    const item = handSlots[i];
    const icon = s.querySelector('canvas');
    const lbl = s.querySelector('.lbl');
    const cnt = s.querySelector('.hcount');
    if (!icon || !lbl || !cnt) return;
    const ctx = icon.getContext('2d');
    ctx.clearRect(0, 0, 32, 32);
    if (!item) {
      lbl.textContent = '—';
      cnt.textContent = '';
      return;
    }
    if (item.startsWith('block:')) drawBlockIcon(ctx, parseInt(item.slice(6)), 2, 2, 28);
    else drawItemIcon(ctx, item, 2, 2, 28);
    lbl.textContent = itemDisplayName(item);
    const n = invCount(item);
    // Creative (fly) shows infinite for blocks; survival shows the real count
    cnt.textContent = (player.flyMode && item.startsWith('block:')) ? '∞' : 'x' + n;
  });
  const sel = handSlots[selectedSlot];
  document.getElementById('sel-name').textContent = sel ? itemDisplayName(sel) : 'ว่าง (กด E เลือกของ)';
}

let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1400);
}

// ======================================================================
// GAME FLOW
// ======================================================================
function startNewWorld(preview = false) {
  currentSeed = (Math.random() * 0x7fffffff) | 0;
  document.getElementById('seed-display').textContent = 'Seed: ' + currentSeed;
  document.getElementById('dseed').textContent = currentSeed;
  generateWorld(currentSeed);
  const sp = findSpawn();
  player.x = sp.x; player.y = sp.y; player.z = sp.z;
  player.yaw = 0; player.pitch = -0.3;
  player.vx = player.vy = player.vz = 0;
  player.flyMode = false;
  player.hp = CFG.MAX_HP;
  hunger = MAX_HUNGER;
  gameTime = 6000;
  inventory = [];
  handSlots = new Array(8).fill(null);
  air = MAX_AIR;
  _drownAcc = 0;
  mobs = [];
  // reset stats
  stats.stepsWalked = 0;
  stats.blocksPlaced = 0;
  stats.blocksBroken = {};
  stats.nightsSurvived = 0;
  stats.crafted = 0;
  stats.maxDistance = 0;
  stats.mobsKilled = 0;
  stats.diamondsFound = 0;
  stats.doorsPlaced = 0;
  unlockedAch = new Set();
  selectedSlot = 0;
  const atlas = makeAtlas();
  uploadAtlas(atlas);
  buildHotbarUI();
  updateHotbarUI();
  updateHPUI();
  updateHungerUI();
  updateInventoryUI();
  updateTimeUI();
  initStats();
  spawnMobs();
  meshRebuildNeeded = true;
  // preview=true = background world at page load — must NOT write over a real save
  if (!preview) saveGame();
}

function loadSavedWorld() {
  const data = loadGame();
  if (!data) { toast('❌ ไม่มีเซฟ'); return false; }
  currentSeed = data.seed;
  document.getElementById('seed-display').textContent = 'Seed: ' + currentSeed;
  document.getElementById('dseed').textContent = currentSeed;
  // Restore world + meta (v3 = RLE/base64, v2 = legacy JSON arrays)
  if (data.v >= 3 && typeof data.worldB64 === 'string') {
    if (!rleDecodeU8(data.worldB64, world) || !rleDecodeU8(data.metaB64 || '', meta)) {
      generateWorld(currentSeed);
    }
  } else if (data.world && data.world.length === world.length) {
    for (let i = 0; i < world.length; i++) world[i] = data.world[i];
    if (data.meta && data.meta.length === meta.length) {
      for (let i = 0; i < meta.length; i++) meta[i] = data.meta[i];
    } else {
      meta.fill(0);
    }
  } else {
    generateWorld(currentSeed);
  }
  // Restore chest contents
  chests.clear();
  if (data.chests) {
    for (const [k, items] of Object.entries(data.chests)) {
      getChestByKey(k).items = items;
    }
  }
  player.x = data.px; player.y = data.py; player.z = data.pz;
  player.yaw = data.yaw; player.pitch = data.pitch;
  player.flyMode = data.fly || false;
  player.hp = data.hp || CFG.MAX_HP;
  selectedSlot = Math.min(7, data.sel || 0);
  // Restore new state
  inventory = data.inv || [];
  // Hand slots (v3.1+): fall back to auto-filling from inventory blocks
  handSlots = (Array.isArray(data.hand) && data.hand.length === 8)
    ? data.hand.slice()
    : new Array(8).fill(null);
  autoFillHandSlots();
  air = MAX_AIR;
  _drownAcc = 0;
  hunger = data.hung || 20;
  gameTime = data.time || 6000;
  unlockedAch = new Set(data.ach || []);
  if (data.stat) {
    stats.stepsWalked = data.stat.steps || 0;
    stats.blocksPlaced = data.stat.placed || 0;
    stats.blocksBroken = data.stat.broken || {};
    stats.nightsSurvived = data.stat.nights || 0;
    stats.crafted = data.stat.crafted || 0;
    stats.maxDistance = data.stat.maxDist || 0;
    stats.mobsKilled = data.stat.mobs || 0;
    stats.diamondsFound = data.stat.dia || 0;
    stats.doorsPlaced = data.stat.doors || 0;
  }
  const atlas = makeAtlas();
  uploadAtlas(atlas);
  buildHotbarUI();
  updateHotbarUI();
  updateHPUI();
  updateHungerUI();
  updateInventoryUI();
  updateTimeUI();
  meshRebuildNeeded = true;
  spawnMobs();
  return true;
}

// ======================================================================
// INIT
// ======================================================================
// True once the player entered a world this session — btn-play then acts as "resume",
// so an accidental click mid-session can't wipe the current world with a fresh one.
let gameStarted = false;
document.getElementById('btn-play').addEventListener('click', () => {
  // Already in a world this session (or MP world loaded) → just resume, don't regenerate
  if (gameStarted || (mp.connected && mp.roomCode && world && world.length > 0)) {
    if (!isTouchDevice) lockPointer();
    else document.body.classList.add('playing'); // mobile: hide start screen without pointer lock
    return;
  }
  // A brand-new world destroys the existing single-slot save — confirm first
  if (hasSave() && !confirm('มีเซฟเก่าอยู่ — เริ่มโลกใหม่จะ "ทับ" เซฟเก่า ยืนยัน?')) return;
  startNewWorld();
  gameStarted = true;
  if (!isTouchDevice) lockPointer();
  else document.body.classList.add('playing'); // mobile
});
// Menu button on mobile: show pause modal
document.querySelector('.mob-menu')?.addEventListener('click', () => {
  document.getElementById('pause')?.classList.add('show');
});
// Resume from pause
document.getElementById('btn-resume')?.addEventListener('click', () => {
  document.getElementById('pause')?.classList.remove('show');
  if (!isTouchDevice) lockPointer();
});
// On mobile, allow tapping outside to resume
if (isTouchDevice) {
  document.getElementById('pause')?.addEventListener('click', (e) => {
    if (e.target.id === 'pause') {
      document.getElementById('pause').classList.remove('show');
    }
  });
}
document.getElementById('btn-load').addEventListener('click', () => {
  if (loadSavedWorld()) {
    gameStarted = true;
    lockPointer();
  } else {
    toast('❌ ไม่มีเซฟ — กด "เริ่มเล่นโลกใหม่" ก่อน');
  }
});
document.getElementById('btn-resume').addEventListener('click', () => {
  document.getElementById('pause').classList.remove('show');
  lockPointer();
});

// Initial world generation so the first frame isn't black
// preview=true: generate WITHOUT saving, so merely opening the page
// can no longer overwrite an existing save (old data-loss bug)
startNewWorld(true);

// Show load button only if save exists
if (!hasSave()) {
  document.getElementById('btn-load').style.opacity = '0.4';
  document.getElementById('btn-load').style.pointerEvents = 'none';
}

// Start the render loop
requestAnimationFrame(loop);

// Save on unload
window.addEventListener('beforeunload', () => {
  if (player.yaw !== undefined) saveGame();
});

