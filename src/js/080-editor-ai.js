// ======================================================================
// VISUAL BLOCK PROGRAMMING (Scratch-like)
// ======================================================================
// Block = { id, type, params: {...}, next: Block | null, children: [Block] | null }
// Hat block: top of a script (no parent)
// Stack block: regular block
// C block: control block with children (repeat, if)

// Block definitions (data-driven)
const BLOCK_DEFS = {
  // Hat blocks (event handlers)
  on_start: { kind: 'hat', category: 'events', label: '🏁 เมื่อเริ่ม', params: [] },
  on_chat: { kind: 'hat', category: 'events', label: '💬 เมื่อพูด', params: [{ name: 'command', type: 'string', default: 'go' }] },
  on_key: { kind: 'hat', category: 'events', label: '⌨ เมื่อกด', params: [{ name: 'key', type: 'select', options: ['w','a','s','d','space','up','down','left','right'], default: 'w' }] },

  // Motion
  walk: { kind: 'stack', category: 'motion', label: '🚶 เดิน', params: [
    { name: 'direction', type: 'select', options: ['forward','back','left','right'], default: 'forward' },
    { name: 'count', type: 'number', default: 3, min: 1, max: 20 },
  ]},
  turn: { kind: 'stack', category: 'motion', label: '🔄 หมุน', params: [
    { name: 'degrees', type: 'number', default: 90, min: -360, max: 360 },
  ]},
  jump: { kind: 'stack', category: 'motion', label: '🦘 กระโดด' },
  fly_up: { kind: 'stack', category: 'motion', label: '✈ บินขึ้น', params: [{ name: 'height', type: 'number', default: 3, min: 1, max: 20 }]},
  fly_down: { kind: 'stack', category: 'motion', label: '⬇ บินลง', params: [{ name: 'height', type: 'number', default: 3, min: 1, max: 20 }]},
  teleport: { kind: 'stack', category: 'motion', label: '🌀 วาร์ป', params: [{ name: 'distance', type: 'number', default: 10, min: 1, max: 50 }]},

  // Action
  break_block: { kind: 'stack', category: 'action', label: '⛏ ทุบ' },
  place: { kind: 'stack', category: 'action', label: '🧱 วาง', params: [
    { name: 'block', type: 'select_block', default: 1 /* GRASS */ },
  ]},
  say: { kind: 'stack', category: 'action', label: '💬 พูด', params: [{ name: 'text', type: 'string', default: 'Hello!' }]},
  // Coordinates below are RELATIVE to the player's position when the script
  // runs: (0,0,0) = the player's feet, +y = up.
  spawn: { kind: 'stack', category: 'action', label: '🌀 เกิดที่ (สัมพัทธ์)', params: [
    { name: 'x', type: 'number', default: 0, min: -50, max: 50 },
    { name: 'y', type: 'number', default: 0, min: -20, max: 30 },
    { name: 'z', type: 'number', default: 0, min: -50, max: 50 },
  ]},
  place_at: { kind: 'stack', category: 'action', label: '🎯 วางที่ (สัมพัทธ์)', params: [
    { name: 'x', type: 'number', default: 0, min: -50, max: 50 },
    { name: 'y', type: 'number', default: 0, min: -20, max: 30 },
    { name: 'z', type: 'number', default: 0, min: -50, max: 50 },
    { name: 'block', type: 'select_block', default: 1 },
  ]},
  fill: { kind: 'stack', category: 'action', label: '🧱 เติมพื้นที่', params: [
    { name: 'x1', type: 'number', default: 0, min: -50, max: 50 },
    { name: 'y1', type: 'number', default: 0, min: -20, max: 30 },
    { name: 'z1', type: 'number', default: 0, min: -50, max: 50 },
    { name: 'x2', type: 'number', default: 3, min: -50, max: 50 },
    { name: 'y2', type: 'number', default: 0, min: -20, max: 30 },
    { name: 'z2', type: 'number', default: 3, min: -50, max: 50 },
    { name: 'block', type: 'select_block', default: 8 },
  ]},

  // Control
  repeat: { kind: 'c', category: 'control', label: '🔁 วนซ้ำ', params: [{ name: 'count', type: 'number', default: 5, min: 1, max: 100 }], hasChildren: true },
  if_block: { kind: 'c', category: 'control', label: '❓ ถ้า', params: [
    { name: 'condition', type: 'select', options: ['block_ahead','ground_below','is_day','is_night'], default: 'block_ahead' },
  ], hasChildren: true },
  wait: { kind: 'stack', category: 'control', label: '⏱ รอ', params: [{ name: 'seconds', type: 'number', default: 1, min: 0.1, max: 10 }]},
  while_block: { kind: 'c', category: 'control', label: '🔁 ทำซ้ำเมื่อ', params: [
    { name: 'condition', type: 'select', options: ['block_ahead','ground_below','is_day','is_night'], default: 'block_ahead' },
  ], hasChildren: true },

  // Variables
  set_var: { kind: 'stack', category: 'vars', label: '💜 ตั้งค่า', params: [
    { name: 'name', type: 'string', default: 'score' },
    { name: 'value', type: 'number', default: 0 },
  ]},
  change_var: { kind: 'stack', category: 'vars', label: '💜 เปลี่ยน', params: [
    { name: 'name', type: 'string', default: 'score' },
    { name: 'delta', type: 'number', default: 1 },
  ]},
};

const BLOCK_CATEGORIES = {
  events:  { name: '📢 เหตุการณ์',   color: '#ffbf00' },
  motion:  { name: '🚶 เคลื่อนไหว',  color: '#4c97ff' },
  action:  { name: '🎬 แอคชั่น',     color: '#e64c4c' },
  control: { name: '⚙ ควบคุม',       color: '#fbc100' },
  vars:    { name: '💜 ตัวแปร',      color: '#cf63cf' },
};

// Agent (bot) - separate entity that runs scripts
class Agent {
  constructor() {
    this.x = 0; this.y = 30; this.z = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.active = true;
    this.visible = false;
    this.name = '🤖 Bot';
  }
  
  // Position helpers
  getBlockPos() {
    return [Math.floor(this.x), Math.floor(this.y), Math.floor(this.z)];
  }
  getForwardPos() {
    const rad = this.yaw * Math.PI / 180;
    return [Math.floor(this.x + Math.sin(rad)), Math.floor(this.y), Math.floor(this.z + Math.cos(rad))];
  }
  
  // Movement (smooth tween over 200ms)
  async moveTo(nx, ny, nz, duration = 200) {
    const sx = this.x, sy = this.y, sz = this.z;
    const start = performance.now();
    return new Promise(resolve => {
      const step = () => {
        if (!this.active) return resolve();
        const t = Math.min(1, (performance.now() - start) / duration);
        this.x = sx + (nx - sx) * t;
        this.y = sy + (ny - sy) * t;
        this.z = sz + (nz - sz) * t;
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      step();
    });
  }
  
  async walk(direction, count) {
    const rad = this.yaw * Math.PI / 180;
    let dx = 0, dz = 0;
    switch (direction) {
      case 'forward': dx = Math.sin(rad); dz = Math.cos(rad); break;
      case 'back':    dx = -Math.sin(rad); dz = -Math.cos(rad); break;
      case 'left':    dx = Math.cos(rad); dz = -Math.sin(rad); break;
      case 'right':   dx = -Math.cos(rad); dz = Math.sin(rad); break;
    }
    for (let i = 0; i < count; i++) {
      const nx = this.x + dx, nz = this.z + dz;
      // check block ahead
      const bx = Math.floor(nx), by = Math.floor(this.y), bz = Math.floor(nz);
      if (getBlock(bx, by, bz) !== B.AIR) {
        // try to step up if there's a block in front
        if (getBlock(bx, by + 1, bz) === B.AIR) {
          await this.moveTo(nx, this.y + 1, nz, 200);
        } else {
          break; // blocked
        }
      } else {
        await this.moveTo(nx, this.y, nz, 200);
      }
      await sleep(20);
    }
  }
  
  async jump() {
    await this.moveTo(this.x, this.y + 1.2, this.z, 150);
    await sleep(50);
    await this.moveTo(this.x, this.y, this.z, 150);
  }
  
  async flyUp(h) {
    await this.moveTo(this.x, this.y + h, this.z, 300);
  }
  
  async flyDown(h) {
    await this.moveTo(this.x, this.y - h, this.z, 300);
  }
  
  async teleport(d) {
    const rad = this.yaw * Math.PI / 180;
    await this.moveTo(this.x + Math.sin(rad) * d, this.y, this.z + Math.cos(rad) * d, 100);
  }
  
  async turn(degrees) {
    const start = this.yaw;
    const target = start + degrees;
    const dur = 200;
    const startT = performance.now();
    return new Promise(resolve => {
      const step = () => {
        if (!this.active) return resolve();
        const t = Math.min(1, (performance.now() - startT) / dur);
        this.yaw = start + (target - start) * t;
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      step();
    });
  }
  
  async breakFront() {
    const [bx, by, bz] = this.getForwardPos();
    if (by < 0 || by >= H) return;
    const blk = getBlock(bx, by, bz);
    if (blk === B.AIR) return;
    setBlock(bx, by, bz, B.AIR); // marks the affected chunks dirty
    playSound('break');
    addParticles(bx + 0.5, by + 0.5, bz + 0.5, BLOCK_COLORS[blk] || '#ffffff', 8);
  }

  async placeFront(blockId) {
    const [bx, by, bz] = this.getForwardPos();
    if (by < 0 || by >= H) return;
    if (getBlock(bx, by, bz) !== B.AIR) return;
    setBlock(bx, by, bz, blockId); // marks the affected chunks dirty
    playSound('place');
  }

  // Place a block at ABSOLUTE world coords (Executor converts relative→absolute)
  async placeAt(x, y, z, blockId) {
    const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
    if (!inBounds(bx, by, bz)) return;
    setBlock(bx, by, bz, blockId);
    playSound('place');
    addParticles(bx + 0.5, by + 0.5, bz + 0.5, BLOCK_COLORS[blockId] || '#ffffff', 4);
  }

  // Fill a rectangular region (ABSOLUTE coords). Volume capped for safety.
  async fillRegion(x1, y1, z1, x2, y2, z2, blockId) {
    const ax = Math.min(x1, x2) | 0, bx2 = Math.max(x1, x2) | 0;
    const ay = Math.min(y1, y2) | 0, by2 = Math.max(y1, y2) | 0;
    const az = Math.min(z1, z2) | 0, bz2 = Math.max(z1, z2) | 0;
    const vol = (bx2 - ax + 1) * (by2 - ay + 1) * (bz2 - az + 1);
    if (vol > 8000) {
      await this.say(`⚠️ เติมได้สูงสุด 8000 บล็อก (ต้องการ ${vol})`);
      return;
    }
    let n = 0;
    for (let y = ay; y <= by2; y++) {
      for (let z = az; z <= bz2; z++) {
        for (let x = ax; x <= bx2; x++) {
          if (!inBounds(x, y, z)) continue;
          if (world[idx(x, y, z)] !== blockId) { setBlock(x, y, z, blockId); n++; }
        }
      }
    }
    playSound('place');
    await this.say(`🧱 เติม ${n} บล็อก`);
  }
  
  async say(text) {
    // Float text above agent for 2 seconds
    this.sayText = text;
    this.sayUntil = performance.now() + 2000;
    toast('🤖 ' + text);
  }
  
  async spawn(x, y, z) {
    await this.moveTo(x, y, z, 100);
  }
  
  // Conditions for if-block
  checkCondition(cond) {
    switch (cond) {
      case 'block_ahead': {
        const [bx, by, bz] = this.getForwardPos();
        return getBlock(bx, by, bz) !== B.AIR;
      }
      case 'ground_below': {
        const [bx, by, bz] = this.getBlockPos();
        return getBlock(bx, by - 1, bz) !== B.AIR;
      }
      case 'is_day':   return gameTime < 12000;
      case 'is_night': return gameTime >= 12000;
      default: return false;
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Executor - runs block trees
class Executor {
  constructor(agent) {
    this.agent = agent;
    this.vars = {};
    this.origin = { x: 0, y: 0, z: 0 }; // set at Run: player's block position.
    // All x/y/z in spawn/place_at/fill are relative to this origin.
    this.running = true; // start running by default
    this.handles = new Map(); // hat block id -> running script
  }
  
  async run(scripts) {
    this.running = true;
    this.agent.active = true;
    for (const s of scripts) {
      this.execBlock(s);
    }
  }
  
  stop() {
    this.running = false;
    this.agent.active = false;
    this.handles.clear();
  }
  
  async execBlock(block) {
    if (!block || !this.running) return;
    const def = BLOCK_DEFS[block.type];
    if (!def) return;
    try {
      switch (block.type) {
        case 'on_start':
          await this.execBlock(block.next);
          break;
        case 'on_chat':
          // attach to chat handler (registered separately)
          break;
        case 'on_key':
          // attach to key handler
          break;
        case 'walk':
          await this.agent.walk(block.params.direction, block.params.count);
          await this.execBlock(block.next);
          break;
        case 'turn':
          await this.agent.turn(block.params.degrees);
          await this.execBlock(block.next);
          break;
        case 'jump':
          await this.agent.jump();
          await this.execBlock(block.next);
          break;
        case 'fly_up':
          await this.agent.flyUp(block.params.height);
          await this.execBlock(block.next);
          break;
        case 'fly_down':
          await this.agent.flyDown(block.params.height);
          await this.execBlock(block.next);
          break;
        case 'teleport':
          await this.agent.teleport(block.params.distance);
          await this.execBlock(block.next);
          break;
        case 'break_block':
          await this.agent.breakFront();
          await this.execBlock(block.next);
          break;
        case 'place':
          await this.agent.placeFront(block.params.block);
          await this.execBlock(block.next);
          break;
        case 'say':
          await this.agent.say(block.params.text);
          await this.execBlock(block.next);
          break;
        case 'spawn': {
          // Relative → absolute: (0,0,0) = player's feet at Run time
          const o = this.origin;
          await this.agent.spawn(o.x + block.params.x + 0.5, o.y + block.params.y, o.z + block.params.z + 0.5);
          await this.execBlock(block.next);
          break;
        }
        case 'place_at': {
          const o = this.origin;
          await this.agent.placeAt(o.x + block.params.x, o.y + block.params.y, o.z + block.params.z, block.params.block);
          await sleep(20);
          await this.execBlock(block.next);
          break;
        }
        case 'fill': {
          const o = this.origin;
          await this.agent.fillRegion(
            o.x + block.params.x1, o.y + block.params.y1, o.z + block.params.z1,
            o.x + block.params.x2, o.y + block.params.y2, o.z + block.params.z2,
            block.params.block);
          await this.execBlock(block.next);
          break;
        }
        case 'repeat': {
          for (let i = 0; i < block.params.count && this.running; i++) {
            for (const child of (block.children || [])) {
              await this.execBlock(child);
              if (!this.running) return;
            }
          }
          await this.execBlock(block.next);
          break;
        }
        case 'if_block': {
          if (this.agent.checkCondition(block.params.condition)) {
            for (const child of (block.children || [])) {
              await this.execBlock(child);
              if (!this.running) return;
            }
          }
          await this.execBlock(block.next);
          break;
        }
        case 'while_block': {
          // Guard cap keeps a never-true-exit loop from freezing the game
          let guard = 0;
          while (this.running && guard++ < 200 && this.agent.checkCondition(block.params.condition)) {
            for (const child of (block.children || [])) {
              await this.execBlock(child);
              if (!this.running) return;
            }
          }
          if (guard >= 200) this.agent.say('⚠️ ลูปเกิน 200 รอบ — หยุดกันค้าง');
          await this.execBlock(block.next);
          break;
        }
        case 'wait':
          await sleep(block.params.seconds * 1000);
          await this.execBlock(block.next);
          break;
        case 'set_var':
          this.vars[block.params.name] = block.params.value;
          await this.execBlock(block.next);
          break;
        case 'change_var':
          this.vars[block.params.name] = (this.vars[block.params.name] || 0) + block.params.delta;
          await this.execBlock(block.next);
          break;
      }
    } catch (e) {
      console.error('Block exec error:', block.type, e);
    }
  }
  
  // Trigger a hat block (e.g. on_chat with 'go')
  async trigger(hatType, params = {}) {
    for (const script of this.scripts || []) {
      if (script.type !== hatType) continue;
      if (hatType === 'on_chat' && script.params.command !== params.command) continue;
      if (hatType === 'on_key' && script.params.key !== params.key) continue;
      this.execBlock(script);
    }
  }
}

// Global agent
const agent = new Agent();
let executor = null;
let savedScripts = []; // array of hat block trees
let scriptName = 'My Program';

const CODE_STORAGE_KEY = 'minicraft_code_v1';

function loadScripts() {
  try {
    const raw = localStorage.getItem(CODE_STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      savedScripts = data.scripts || [];
      scriptName = data.name || 'My Program';
    }
  } catch(e) {}
}

function saveScripts() {
  try {
    localStorage.setItem(CODE_STORAGE_KEY, JSON.stringify({ name: scriptName, scripts: savedScripts }));
  } catch(e) {}
}

loadScripts();

// Code Editor UI
function openCodeEditor() {
  document.getElementById('code-modal').classList.add('show');
  renderCodeEditor();
  unlockPointer();
}
function closeCodeEditor() {
  document.getElementById('code-modal').classList.remove('show');
  if (executor) executor.stop();
  agent.visible = false;
  lockPointer();
}

let currentScript = null; // currently selected script (hat block)
let currentFocus = null;  // currently focused C-block (for adding nested children)

function renderCodeEditor() {
  const list = document.getElementById('code-blocks-list');
  const workspace = document.getElementById('code-workspace');
  if (!list || !workspace) return;
  // Render block palette
  let html = '';
  for (const [catId, cat] of Object.entries(BLOCK_CATEGORIES)) {
    html += `<div class="code-cat" style="--cat-color:${cat.color}">
      <div class="code-cat-name">${cat.name}</div>`;
    for (const [type, def] of Object.entries(BLOCK_DEFS)) {
      if (def.category !== catId) continue;
      const preview = renderBlockPreview(type, def);
      html += `<div class="code-pal-block" data-type="${type}" draggable="true">${preview}</div>`;
    }
    html += `</div>`;
  }
  list.innerHTML = html;
  // Render scripts
  renderScripts();
  // Add event listeners for palette
  list.querySelectorAll('.code-pal-block').forEach(el => {
    el.addEventListener('click', () => {
      const type = el.dataset.type;
      addBlockToCurrent(type);
    });
  });
}

function renderBlockPreview(type, def) {
  const cat = BLOCK_CATEGORIES[def.category];
  const params = def.params || [];
  let pHtml = '';
  for (const p of params) {
    pHtml += renderParamInput(type, p, { [p.name]: p.default });
  }
  return `<div class="code-block kind-${def.kind}" style="--bc:${cat.color}"><span class="code-block-label">${def.label}</span>${pHtml}</div>`;
}

function renderParamInput(blockType, p, params) {
  const val = params[p.name] !== undefined ? params[p.name] : p.default;
  if (p.type === 'number') {
    return `<input class="code-param num" type="number" title="${p.name}" value="${val}" min="${p.min||0}" max="${p.max||9999}" data-block="${blockType}" data-param="${p.name}" />`;
  } else if (p.type === 'string') {
    return `<input class="code-param str" type="text" title="${p.name}" value="${escapeHTML(String(val))}" data-block="${blockType}" data-param="${p.name}" />`;
  } else if (p.type === 'select') {
    let opts = p.options.map(o => `<option value="${o}" ${o===val?'selected':''}>${o}</option>`).join('');
    return `<select class="code-param sel" data-block="${blockType}" data-param="${p.name}">${opts}</select>`;
  } else if (p.type === 'select_block') {
    let opts = '';
    for (let i = 1; i < 30; i++) {
      opts += `<option value="${i}" ${i===val?'selected':''}>${BLOCK_NAMES[i] || i}</option>`;
    }
    return `<select class="code-param sel" data-block="${blockType}" data-param="${p.name}">${opts}</select>`;
  }
  return '';
}

function renderScripts() {
  const wrap = document.getElementById('code-scripts');
  if (!wrap) return;
  let html = '';
  // Compute total blocks
  let totalBlocks = 0;
  for (const s of savedScripts) totalBlocks += countBlocks(s);
  // Update stats
  const statScripts = document.getElementById('code-stat-scripts');
  const statBlocks = document.getElementById('code-stat-blocks');
  if (statScripts) statScripts.textContent = savedScripts.length;
  if (statBlocks) statBlocks.textContent = totalBlocks;
  for (let i = 0; i < savedScripts.length; i++) {
    const s = savedScripts[i];
    const def = BLOCK_DEFS[s.type];
    html += `<div class="code-script ${i===currentScript?.__idx?'active':''}" data-idx="${i}">
      <div class="code-script-head">
        <span class="code-script-title">📜 SCRIPT ${i + 1} • <span style="color:${BLOCK_CATEGORIES[def.category].color}">${def.label}</span></span>
        <div class="code-script-actions">
          <button class="code-script-export" data-idx="${i}" title="Export script นี้">📤</button>
          <button class="code-script-del" data-idx="${i}" title="ลบ script">🗑</button>
        </div>
      </div>
      ${renderBlockTree(s, s)}
    </div>`;
  }
  // New script button
  html += `<div class="code-add-script">
    <div class="code-add-script-title">➕ เพิ่ม script ใหม่ (hat block):</div>
    <button data-hat="on_start" class="code-add-hat"><span style="font-size:16px">🏁</span><span><b>เมื่อเริ่ม</b><br><span style="font-size:10px;opacity:.7">ทำงานครั้งเดียวตอนเปิดเกม</span></span></button>
    <button data-hat="on_chat" class="code-add-hat"><span style="font-size:16px">💬</span><span><b>เมื่อพูด</b><br><span style="font-size:10px;opacity:.7">ทำงานเมื่อพิมพ์คำสั่ง</span></span></button>
    <button data-hat="on_key" class="code-add-hat"><span style="font-size:16px">⌨️</span><span><b>เมื่อกดปุ่ม</b><br><span style="font-size:10px;opacity:.7">ทำงานเมื่อกดปุ่มที่กำหนด</span></span></button>
  </div>`;
  // Show current focus indicator
  if (currentFocus) {
    const focusDef = BLOCK_DEFS[currentFocus.type];
    html += `<div id="code-focus-indicator">
      <span style="font-size:18px">📍</span>
      <span class="focus-label">กำลังเพิ่มบล็อกภายใน:</span>
      <span style="background:${BLOCK_CATEGORIES[focusDef.category].color};color:#fff;padding:4px 10px;border-radius:4px;font-weight:700">${focusDef?.label || currentFocus.type}</span>
      <button id="code-focus-out">← ออก</button>
    </div>`;
  }
  // Bottom action bar
  html += `<div class="code-bottom-bar">
    <button class="code-btn code-btn-undo" id="code-undo" title="Ctrl+Z">↩ Undo</button>
    <button class="code-btn code-btn-export" id="code-export-all">📤 Export ทั้งหมด</button>
    <button class="code-btn code-btn-import" id="code-import-btn">📥 Import</button>
    <button class="code-btn code-btn-clear" id="code-clear-all">🗑 ลบทั้งหมด</button>
  </div>`;
  wrap.innerHTML = html;
  // Hook delete
  wrap.querySelectorAll('.code-script-del').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      const idx = parseInt(b.dataset.idx);
      pushUndo();
      savedScripts.splice(idx, 1);
      saveScripts();
      renderScripts();
    });
  });
  // Per-block delete (the ✕ button — previously never wired!). Hat block = delete whole script.
  wrap.querySelectorAll('.code-block-del').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      const id = b.dataset.blockId;
      const sIdx = savedScripts.findIndex(s => s.id === id);
      pushUndo();
      if (sIdx >= 0) {
        savedScripts.splice(sIdx, 1);
      } else {
        for (const s of savedScripts) if (removeBlockNode(s, id)) break;
      }
      saveScripts();
      renderScripts();
    });
  });
  // Duplicate a block (with its nested children, without the rest of the chain)
  wrap.querySelectorAll('.code-block-dup').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      const target = findBlockById(savedScripts, b.dataset.blockId);
      if (!target) return;
      const copy = JSON.parse(JSON.stringify(cleanBlockForExport(target)));
      copy.next = null;
      reassignIds(copy);
      pushUndo();
      if (BLOCK_DEFS[target.type].kind === 'hat' || !insertAfterBlock(target, copy)) {
        savedScripts.push(copy);
      }
      saveScripts();
      renderScripts();
    });
  });
  // Hook export
  wrap.querySelectorAll('.code-script-export').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      const idx = parseInt(b.dataset.idx);
      const s = savedScripts[idx];
      const exportData = {
        id: 'code_' + Date.now(),
        name: scriptName || 'My Program',
        version: '1.0',
        format: 'minicraft_code_v1',
        scripts: [cleanBlockForExport(s)],
      };
      const json = JSON.stringify(exportData, null, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(json).then(() => {
          toast('📤 Export script — คัดลอกไปยัง clipboard');
        }).catch(() => promptExport(json));
      } else {
        promptExport(json);
      }
    });
  });
  // Hook add hat
  wrap.querySelectorAll('.code-add-hat').forEach(b => {
    b.addEventListener('click', () => {
      const type = b.dataset.hat;
      pushUndo();
      savedScripts.push({ id: 'b_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), type, params: paramDefaults(BLOCK_DEFS[type]), next: null, children: null });
      saveScripts();
      renderScripts();
    });
  });
  // Param inputs
  wrap.querySelectorAll('.code-param').forEach(input => {
    input.addEventListener('change', e => {
      const el = e.target;
      const blockId = el.closest('[data-block-id]')?.dataset.blockId;
      const param = el.dataset.param;
      const block = findBlockById(savedScripts, blockId);
      if (!block) return;
      let val = el.value;
      if (el.classList.contains('num')) val = parseFloat(val) || 0;
      pushUndo();
      if (block.params) block.params[param] = val;
      saveScripts();
    });
    input.addEventListener('click', e => e.stopPropagation());
  });
  // Block-level click: focus this script (and clear C-block focus)
  wrap.querySelectorAll('.code-script').forEach(s => {
    s.addEventListener('click', () => {
      currentScript = savedScripts[parseInt(s.dataset.idx)];
      currentScript.__idx = parseInt(s.dataset.idx);
      currentFocus = null;  // exit C-block focus
      wrap.querySelectorAll('.code-script').forEach(x => x.classList.toggle('active', parseInt(x.dataset.idx) === currentScript.__idx));
      renderScripts();
    });
  });
  // C-block click: focus it for nested children
  wrap.querySelectorAll('.code-cblock-head').forEach(c => {
    c.addEventListener('click', e => {
      e.stopPropagation();
      const blockId = c.dataset.blockId;
      const block = findBlockById(savedScripts, blockId);
      if (block) {
        currentFocus = block;
        currentScript = findScriptOfBlock(savedScripts, block);
        renderScripts();
      }
    });
  });
  // Focus-out button
  document.getElementById('code-focus-out')?.addEventListener('click', () => {
    currentFocus = null;
    renderScripts();
  });
  // Keep the undo button's disabled state in sync
  updateUndoBtn();
}

function findScriptOfBlock(scripts, block) {
  // Find which hat-block script contains this block
  for (const s of scripts) {
    if (walkBlocks(s, b => b === block)) return s;
  }
  return null;
}

function findBlockById(scripts, id) {
  for (const s of scripts) {
    const found = walkBlocks(s, b => b.id === id);
    if (found) return found;
  }
  return null;
}
function walkBlocks(block, fn) {
  if (!block) return null;
  if (fn(block)) return block;
  if (block.next) {
    const r = walkBlocks(block.next, fn);
    if (r) return r;
  }
  if (Array.isArray(block.children)) {
    for (const c of block.children) {
      const r = walkBlocks(c, fn);
      if (r) return r;
    }
  }
  return null;
}

function renderBlockTree(rootBlock, current) {
  // Render the chain of next + children
  let html = '';
  let block = rootBlock;
  // First pass: collect all blocks in chain to find last
  const chain = [];
  let b = rootBlock;
  while (b) {
    chain.push(b);
    if (!b.next) break;
    b = b.next;
  }
  for (let i = 0; i < chain.length; i++) {
    const blk = chain[i];
    const def = BLOCK_DEFS[blk.type];
    const isLastInChain = (i === chain.length - 1) && !blk.next && (!def || !def.hasChildren);
    html += renderBlockNode(blk, isLastInChain);
  }
  return html;
}

function countBlocks(block) {
  if (!block) return 0;
  let n = 1;
  if (block.next) n += countBlocks(block.next);
  if (Array.isArray(block.children)) {
    for (const c of block.children) n += countBlocks(c);
  }
  return n;
}

function renderBlockNode(block, isLast = false) {
  const def = BLOCK_DEFS[block.type];
  if (!def) return '';
  const cat = BLOCK_CATEGORIES[def.category];
  const isFocused = currentFocus === block;
  // Compute kind class: hat, stack, stack-last, c
  let kindClass = `kind-${def.kind}`;
  if (def.kind === 'stack' && isLast) kindClass = 'kind-stack-last';
  let html = `<div class="code-block-row ${isFocused ? 'focused' : ''}" data-block-id="${block.id}">`;
  // For C-blocks, wrap the head in a clickable div for focus
  if (def.hasChildren) {
    html += `<div class="code-cblock-head" data-block-id="${block.id}" title="คลิกเพื่อเพิ่มบล็อกภายใน">`;
  }
  html += `<div class="code-block ${kindClass}" style="--bc:${cat.color}">`;
  html += `<span class="code-block-label">${def.label}</span>`;
  if (block.params) {
    for (const p of def.params) {
      html += renderParamInput(block.type, p, block.params);
    }
  }
  html += `<button class="code-block-dup" data-block-id="${block.id}" title="ทำซ้ำบล็อกนี้ (พร้อมของข้างใน)">⧉</button>`;
  html += `<button class="code-block-del" data-block-id="${block.id}" title="ลบบล็อก">✕</button>`;
  html += `</div>`;
  if (def.hasChildren) {
    html += `</div>`; // close code-cblock-head
    html += `<div class="code-block-children" data-parent-id="${block.id}">`;
    if (block.children && block.children.length) {
      // Render each child's FULL next-chain — imported/AI scripts chain blocks
      // inside children, and previously only the first block of each chain
      // was visible in the editor.
      for (const c of block.children) {
        html += renderBlockTree(c);
      }
    } else {
      html += `<div class="code-block-empty">${isFocused ? '👆 คลิกบล็อกใน palette ด้านซ้าย เพื่อเพิ่มที่นี่' : '⌨ คลิกที่บล็อกด้านบนเพื่อเพิ่มข้างใน'}</div>`;
    }
    html += `</div>`;
  }
  html += `</div>`;
  return html;
}

// ---- Undo + block-tree helpers ----
const UNDO_MAX = 50;
let undoStack = [];
function genBlockId() {
  return 'b_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}
function pushUndo() {
  try {
    undoStack.push(JSON.stringify(savedScripts, (k, v) => (k === '__idx' ? undefined : v)));
    if (undoStack.length > UNDO_MAX) undoStack.shift();
  } catch (e) {}
  updateUndoBtn();
}
function undoScripts() {
  if (undoStack.length === 0) { toast('⚠ ไม่มีอะไรให้ undo แล้ว'); return; }
  savedScripts = JSON.parse(undoStack.pop());
  currentFocus = null;
  saveScripts();
  renderScripts();
  updateUndoBtn();
}
function updateUndoBtn() {
  const b = document.getElementById('code-undo');
  if (b) b.disabled = undoStack.length === 0;
}
// Insert `node` right after `target` in whatever chain/array holds it.
// Returns false when target is a script root (hat) — caller decides.
function insertAfterBlock(target, node) {
  const walk = (blk) => {
    if (!blk) return false;
    if (blk.next === target) { node.next = target.next; target.next = node; return true; }
    if (Array.isArray(blk.children)) {
      const i = blk.children.indexOf(target);
      if (i >= 0) { blk.children.splice(i + 1, 0, node); return true; }
      for (const c of blk.children) if (walk(c)) return true;
    }
    return walk(blk.next);
  };
  for (const s of savedScripts) if (walk(s)) return true;
  return false;
}
// Detach a block by id from a script tree (hat blocks handled by the caller)
function removeBlockNode(block, targetId) {
  if (block.next) {
    if (block.next.id === targetId) { block.next = block.next.next; return true; }
    if (removeBlockNode(block.next, targetId)) return true;
  }
  if (Array.isArray(block.children)) {
    for (let i = 0; i < block.children.length; i++) {
      if (block.children[i].id === targetId) { block.children.splice(i, 1); return true; }
      if (removeBlockNode(block.children[i], targetId)) return true;
    }
  }
  return false;
}

// Add a new block under the currently focused script (or as next of last)
function addBlockToCurrent(type) {
  const def = BLOCK_DEFS[type];
  if (!def) return;
  pushUndo();
  if (def.kind === 'hat') {
    // New script
    savedScripts.push({ id: 'b_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), type, params: paramDefaults(def), next: null, children: null });
    saveScripts();
    renderScripts();
    return;
  }
  // Determine target for new block:
  // - If currentFocus points to a C-block, add to its children
  // - Else if currentScript is a script (hat block), add to end of its main chain
  let target = currentFocus;
  if (!target) target = currentScript || savedScripts[0];
  if (!target) {
    // No script, create on_start first
    savedScripts.push({ id: 'b_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), type: 'on_start', params: {}, next: null, children: null });
    target = savedScripts[0];
    currentScript = target;
  }
  const newBlock = { id: 'b_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), type, params: paramDefaults(def), next: null, children: def.hasChildren ? [] : null };
  // If target is a script (hat), add to end of main chain
  const targetDef = BLOCK_DEFS[target.type];
  if (targetDef && targetDef.kind === 'hat') {
    let last = target;
    while (last.next) last = last.next;
    last.next = newBlock;
  } else if (targetDef && targetDef.hasChildren) {
    // Target is a C-block, add to its children
    if (!target.children) target.children = [];
    target.children.push(newBlock);
    // If new block is a C-block, focus it for further nesting
    if (newBlock.type && BLOCK_DEFS[newBlock.type].hasChildren) {
      currentFocus = newBlock;
    } else {
      // Stay focused on this C-block
      currentFocus = target;
    }
  } else {
    // Stack block in chain - append after it
    let last = target;
    while (last.next) last = last.next;
    last.next = newBlock;
  }
  saveScripts();
  renderScripts();
}

// Export/Import scripts
function exportScripts() {
  if (savedScripts.length === 0) {
    toast('⚠ ไม่มี script ให้ export');
    return;
  }
  const exportData = {
    id: 'code_' + Date.now(),
    name: scriptName || 'My Program',
    version: '1.0',
    format: 'minicraft_code_v1',
    scripts: savedScripts.map(cleanBlockForExport),
  };
  const json = JSON.stringify(exportData, null, 2);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(json).then(() => {
      toast('📤 Export สำเร็จ — คัดลอก JSON ไปยัง clipboard');
    }).catch(() => promptExport(json));
  } else {
    promptExport(json);
  }
}

function promptExport(json) {
  // Fallback: show modal
  document.getElementById('code-export-textarea').value = json;
  document.getElementById('code-export-modal').classList.add('show');
}

function importScripts(jsonStr, mode = 'merge') {
  let data;
  try { data = JSON.parse(jsonStr); } catch(e) {
    toast('❌ JSON ไม่ถูกต้อง: ' + e.message);
    return false;
  }
  if (!data || !Array.isArray(data.scripts)) {
    toast('❌ ไม่พบ scripts array');
    return false;
  }
  pushUndo();
  if (mode === 'replace') {
    savedScripts = [];
  }
  for (const s of data.scripts) {
    // Assign new IDs to avoid conflicts
    const cloned = JSON.parse(JSON.stringify(s));
    reassignIds(cloned);
    savedScripts.push(cloned);
  }
  saveScripts();
  renderScripts();
  toast('📥 Import สำเร็จ — เพิ่ม ' + data.scripts.length + ' script');
  return true;
}

function reassignIds(block) {
  block.id = 'b_' + Date.now() + '_' + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2,4);
  if (block.next) reassignIds(block.next);
  if (Array.isArray(block.children)) {
    for (const c of block.children) reassignIds(c);
  }
}

function cleanBlockForExport(block) {
  // Remove internal __idx if present
  const b = { ...block };
  delete b.__idx;
  if (b.next) b.next = cleanBlockForExport(b.next);
  if (b.children) b.children = b.children.map(cleanBlockForExport);
  return b;
}

function paramDefaults(def) {
  const p = {};
  for (const pp of def.params || []) p[pp.name] = pp.default;
  return p;
}

// Run/Stop
function runProgram() {
  if (executor) executor.stop();
  if (savedScripts.length === 0) {
    toast('⚠ ไม่มี script — เพิ่มบล็อกก่อน');
    return;
  }
  // Spawn agent at player position
  agent.x = player.x;
  agent.y = player.y;
  agent.z = player.z;
  agent.yaw = player.yaw;
  agent.visible = true;
  agent.active = true;
  executor = new Executor(agent);
  // All script coordinates are relative to where the player stands at Run
  executor.origin = {
    x: Math.floor(player.x), y: Math.floor(player.y), z: Math.floor(player.z),
  };
  executor.scripts = savedScripts;
  // Process hat blocks: on_start → run immediately, on_chat/on_key → register
  for (const s of savedScripts) {
    if (s.type === 'on_start') {
      executor.execBlock(s);
    } else if (s.type === 'on_chat' && s.next) {
      // Register chat trigger
      const cmd = s.params.command;
      if (!executor.chatHandlers) executor.chatHandlers = new Map();
      if (!executor.chatHandlers.has(cmd)) executor.chatHandlers.set(cmd, []);
      executor.chatHandlers.get(cmd).push(s);
    } else if (s.type === 'on_key' && s.next) {
      const key = s.params.key;
      if (!executor.keyHandlers) executor.keyHandlers = new Map();
      if (!executor.keyHandlers.has(key)) executor.keyHandlers.set(key, []);
      executor.keyHandlers.get(key).push(s);
    }
  }
  toast('▶ รัน script — Bot กำลังทำงาน');
}

function stopProgram() {
  if (executor) {
    executor.stop();
    executor = null;
  }
  agent.active = false;
  // Notify other players
  if (mp.connected && mp.roomCode) {
    sendMP({ type: 'bot_stop' });
  }
  setTimeout(() => { agent.visible = false; }, 1000);
  toast('⏹ หยุด script แล้ว');
}

// Auto-save world state to server every 30s
let _lastAutoSave = 0;
function autoSaveIfHost() {
  if (!mp.connected || !mp.isHost || !mp.roomCode) return;
  const now = Date.now();
  if (now - _lastAutoSave < 30000) return;
  _lastAutoSave = now;
  if (typeof world === 'undefined' || !world) return;
  showSaveIndicator('saving');
  // Autosave carries chest contents too, so the resumed world keeps them
  const chestData = {};
  for (const [k, ch] of chests.entries()) {
    if (ch.items && ch.items.some(it => it !== null)) chestData[k] = ch.items;
  }
  sendMP({
    type: 'world_save',
    world: { W, D, H, worldRB64: rleEncodeU8(world), chests: chestData, seed: typeof currentSeed !== 'undefined' ? currentSeed : null }
  });
}
// Hook auto-save into the game loop (run every frame, throttled inside)
let _origRenderForSave = null;
// We'll call autoSaveIfHost from a simple interval
setInterval(autoSaveIfHost, 5000);

// Trigger a chat script (called from chat input)
function triggerChatScript(cmd) {
  if (!executor || !executor.chatHandlers) return;
  const scripts = executor.chatHandlers.get(cmd);
  if (scripts) {
    for (const s of scripts) executor.execBlock(s);
  }
}

// Trigger a key script (called from key handler)
function triggerKeyScript(key) {
  if (!executor || !executor.keyHandlers) return;
  const scripts = executor.keyHandlers.get(key);
  if (scripts) {
    for (const s of scripts) executor.execBlock(s);
  }
}

// on_key scripts fire on discrete key presses (repeat-filtered). Arrow keys
// are offered as trigger keys because WASD double as movement.
document.addEventListener('keydown', (e) => {
  if (e.repeat || !isGameActive()) return;
  const map = {
    KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', Space: 'space',
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  };
  const k = map[e.code];
  if (k) triggerKeyScript(k);
});

// Render agent (called from renderRemotePlayers) - implemented below

// Hook up UI
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-code')?.addEventListener('click', openCodeEditor);
  document.getElementById('code-close')?.addEventListener('click', closeCodeEditor);
  document.getElementById('code-modal')?.addEventListener('click', e => {
    if (e.target.id === 'code-modal') closeCodeEditor();
  });
  document.getElementById('code-run')?.addEventListener('click', runProgram);
  document.getElementById('code-stop')?.addEventListener('click', stopProgram);
  document.getElementById('code-load-sample')?.addEventListener('click', loadSampleProgram);
  document.getElementById('code-ai')?.addEventListener('click', openAIModal);
  // Allow Enter to trigger AI in textarea (Shift+Enter for newline)
  document.getElementById('ai-prompt')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      runAI();
    }
  });
  document.getElementById('code-export-all')?.addEventListener('click', exportScripts);
  document.getElementById('code-import-btn')?.addEventListener('click', () => {
    document.getElementById('code-import-modal').classList.add('show');
  });
  document.getElementById('code-import-close')?.addEventListener('click', () => {
    document.getElementById('code-import-modal').classList.remove('show');
  });
  document.getElementById('code-import-merge')?.addEventListener('click', () => {
    const url = document.getElementById('code-import-url').value.trim();
    const json = document.getElementById('code-import-textarea').value.trim();
    if (url) {
      importScriptsFromUrl(url, 'merge');
    } else if (json) {
      if (importScripts(json, 'merge')) {
        document.getElementById('code-import-modal').classList.remove('show');
        document.getElementById('code-import-textarea').value = '';
      }
    } else {
      toast('⚠ วาง JSON หรือใส่ URL');
    }
  });
  document.getElementById('code-import-replace')?.addEventListener('click', () => {
    if (!confirm('ลบ scripts เดิมทั้งหมดแล้วแทนที่ด้วยของใหม่?')) return;
    const url = document.getElementById('code-import-url').value.trim();
    const json = document.getElementById('code-import-textarea').value.trim();
    if (url) {
      importScriptsFromUrl(url, 'replace');
    } else if (json) {
      if (importScripts(json, 'replace')) {
        document.getElementById('code-import-modal').classList.remove('show');
        document.getElementById('code-import-textarea').value = '';
      }
    } else {
      toast('⚠ วาง JSON หรือใส่ URL');
    }
  });
  document.getElementById('code-export-close')?.addEventListener('click', () => {
    document.getElementById('code-export-modal').classList.remove('show');
  });
  document.getElementById('code-export-copy')?.addEventListener('click', () => {
    const ta = document.getElementById('code-export-textarea');
    ta.select();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(ta.value).then(() => toast('📋 คัดลอกแล้ว'));
    } else {
      document.execCommand('copy');
      toast('📋 คัดลอกแล้ว');
    }
  });
  document.getElementById('code-clear-all')?.addEventListener('click', () => {
    if (!confirm('ลบ scripts ทั้งหมด?')) return;
    pushUndo();
    savedScripts = [];
    saveScripts();
    renderScripts();
    toast('🗑 ลบ scripts ทั้งหมด');
  });
  // Undo button + Ctrl/Cmd+Z while the editor is open
  document.getElementById('code-undo')?.addEventListener('click', undoScripts);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' &&
        document.getElementById('code-modal')?.classList.contains('show')) {
      e.preventDefault();
      undoScripts();
    }
  });
  // Drag & drop: palette → workspace. Dropping ON a block inserts after it
  // (or into a C-block's children zone); dropping on empty space appends.
  const paletteEl = document.getElementById('code-blocks-list');
  const scriptsEl = document.getElementById('code-scripts');
  if (paletteEl && scriptsEl) {
    paletteEl.addEventListener('dragstart', (e) => {
      const el = e.target.closest('.code-pal-block');
      if (!el) return;
      e.dataTransfer.setData('text/blocktype', el.dataset.type);
      e.dataTransfer.effectAllowed = 'copy';
    });
    const clearDropHints = () =>
      scriptsEl.querySelectorAll('.drop-after,.drop-into').forEach(el => el.classList.remove('drop-after', 'drop-into'));
    scriptsEl.addEventListener('dragover', (e) => {
      if (!Array.from(e.dataTransfer.types).includes('text/blocktype')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      clearDropHints();
      const childZone = e.target.closest('.code-block-children');
      const row = e.target.closest('.code-block-row');
      if (childZone) childZone.classList.add('drop-into');
      else if (row) row.classList.add('drop-after');
    });
    scriptsEl.addEventListener('dragleave', (e) => { if (e.target === scriptsEl) clearDropHints(); });
    scriptsEl.addEventListener('drop', (e) => {
      const type = e.dataTransfer.getData('text/blocktype');
      clearDropHints();
      if (!type || !BLOCK_DEFS[type]) return;
      e.preventDefault();
      const def = BLOCK_DEFS[type];
      const node = { id: genBlockId(), type, params: paramDefaults(def), next: null, children: def.hasChildren ? [] : null };
      const childZone = e.target.closest('.code-block-children');
      const row = e.target.closest('.code-block-row');
      if (childZone) {
        const parent = findBlockById(savedScripts, childZone.dataset.parentId);
        if (parent) {
          pushUndo();
          if (!Array.isArray(parent.children)) parent.children = [];
          parent.children.push(node);
          currentFocus = parent;
          saveScripts(); renderScripts();
          return;
        }
      }
      if (row) {
        const target = findBlockById(savedScripts, row.dataset.blockId);
        if (target) {
          pushUndo();
          if (BLOCK_DEFS[target.type].kind === 'hat' || !insertAfterBlock(target, node)) {
            // Hat block (or not found in any chain): append to its chain end
            let last = target;
            while (last.next) last = last.next;
            last.next = node;
          }
          saveScripts(); renderScripts();
          return;
        }
      }
      // Dropped on empty space → behave like a palette click (append)
      addBlockToCurrent(type);
    });
    paletteEl.addEventListener('dragend', clearDropHints);
  }
});

async function importScriptsFromUrl(url, mode) {
  toast('⏳ กำลังโหลด...');
  try {
    const res = await fetch(url);
    if (!res.ok) { toast('❌ HTTP ' + res.status); return; }
    const text = await res.text();
    if (importScripts(text, mode)) {
      document.getElementById('code-import-modal').classList.remove('show');
      document.getElementById('code-import-textarea').value = '';
      document.getElementById('code-import-url').value = '';
    }
  } catch(e) {
    toast('❌ โหลดไม่ได้: ' + e.message);
  }
}

function loadSampleProgram() {
  pushUndo();
  savedScripts = [
    {
      id: 'b_sample_1',
      type: 'on_start',
      params: {},
      next: {
        id: 'b_sample_2',
        type: 'spawn',
        params: { x: 0, y: 0, z: 0 },
        next: {
          id: 'b_sample_3',
          type: 'say',
          params: { text: 'สวัสดี! เริ่มสร้างบ้าน' },
          next: {
            id: 'b_sample_4',
            type: 'repeat',
            params: { count: 5 },
            children: [
              { id: 'b_sample_5', type: 'place', params: { block: 1 }, next: { id: 'b_sample_5b', type: 'walk', params: { direction: 'forward', count: 1 }, next: null }, children: null }
            ],
            next: {
              id: 'b_sample_6',
              type: 'say',
              params: { text: 'เสร็จแล้ว!' },
              next: null,
              children: null,
            }
          }
        }
      }
    }
  ];
  saveScripts();
  renderScripts();
  toast('📝 โหลดตัวอย่าง — กด Run เพื่อดู Bot ทำงาน');
}

// ======================================================================
// AI SCRIPT GENERATOR
// ======================================================================
// Local pattern-based AI (offline, always works)
// + Optional online LLM API (OpenAI-compatible, user provides key)

const AI_STORAGE_KEY = 'minicraft_ai_v1';
const aiSettings = {
  mode: 'local',         // 'local' | 'online'
  apiUrl: 'https://api.openai.com/v1/chat/completions',
  apiKey: '',
  model: 'gpt-4o-mini',
};
// Load saved settings
try {
  const saved = JSON.parse(localStorage.getItem(AI_STORAGE_KEY) || '{}');
  Object.assign(aiSettings, saved);
} catch(e) {}

// ======================================================================
// LOCAL PATTERN-BASED AI (offline)
// ======================================================================
const LOCAL_AI_PATTERNS = [
  // === Houses ===
  {
    keywords: ['บ้าน', 'house', 'home'],
    defaults: { size: 5, block: 8, withRoof: true, withDoor: true, withWindows: true },
    build(p, ctx) {
      const s = p.size, blk = p.block;
      const mid = Math.floor(s / 2);
      // Compact build with RELATIVE coords + fill: (0,0,0) = player's feet.
      const script = {
        type: 'on_start', params: {},
        next: { type: 'say', params: { text: `🏠 กำลังสร้างบ้าน ${s}x${s} จาก${ctx.blockNames[blk] || 'หิน'}` }, next: null, children: null }
      };
      let last = script.next;
      const push = (type, params) => {
        last.next = { type, params, next: null, children: null };
        last = last.next;
      };
      // 4 walls row by row (front wall at z = s-1, split around the door gap)
      for (let y = 0; y < 3; y++) {
        push('fill', { x1: 0, y1: y, z1: 0, x2: s - 1, y2: y, z2: 0, block: blk });         // back
        push('fill', { x1: 0, y1: y, z1: 1, x2: 0, y2: y, z2: s - 1, block: blk });         // left
        push('fill', { x1: s - 1, y1: y, z1: 1, x2: s - 1, y2: y, z2: s - 1, block: blk }); // right
        push('fill', { x1: 1, y1: y, z1: s - 1, x2: mid - 1, y2: y, z2: s - 1, block: blk });   // front (left of door)
        push('fill', { x1: mid + 1, y1: y, z1: s - 1, x2: s - 1, y2: y, z2: s - 1, block: blk }); // front (right of door)
        if (!p.withDoor || y >= 2) push('fill', { x1: mid, y1: y, z1: s - 1, x2: mid, y2: y, z2: s - 1, block: blk }); // above door
      }
      // Windows (glass) in the middle row
      if (p.withWindows) {
        push('place_at', { x: mid, y: 1, z: 0, block: 14 });
        push('place_at', { x: 0, y: 1, z: mid, block: 14 });
        push('place_at', { x: s - 1, y: 1, z: mid, block: 14 });
      }
      // Roof (planks)
      if (p.withRoof) {
        push('fill', { x1: 0, y1: 3, z1: 0, x2: s - 1, y2: 3, z2: s - 1, block: 7 });
      }
      push('say', { text: '🏠 เสร็จแล้ว!' });
      return script;
    }
  },
  // === Wall ===
  {
    keywords: ['กำแพง', 'wall', 'fence'],
    build(p, ctx) {
      const len = p.length || 10;
      const blk = p.block || 8;
      const script = {
        type: 'on_start', params: {},
        next: { type: 'spawn', params: { x: 0, y: 0, z: 0 }, next: null, children: null }
      };
      let last = script.next;
      last.next = { type: 'say', params: { text: `🧱 สร้างกำแพงยาว ${len}` }, next: null, children: null };
      last = last.next;
      for (let i = 0; i < len; i++) {
        last.next = { type: 'spawn', params: { x: i, y: 0, z: 0 }, next: null, children: null };
        last = last.next;
        last.next = { type: 'place', params: { block: blk }, next: null, children: null };
        last = last.next;
      }
      last.next = { type: 'say', params: { text: '✅ กำแพงเสร็จ!' }, next: null, children: null };
      return script;
    }
  },
  // === Tower ===
  {
    keywords: ['หอคอย', 'tower'],
    build(p, ctx) {
      const h = p.height || 10;
      const s = 3;
      const blk = p.block || 8;
      const script = {
        type: 'on_start', params: {},
        next: { type: 'spawn', params: { x: 0, y: 0, z: 0 }, next: null, children: null }
      };
      let last = script.next;
      last.next = { type: 'say', params: { text: `🏗 สร้างหอคอยสูง ${h}` }, next: null, children: null };
      last = last.next;
      for (let y = 0; y < h; y++) {
        for (let i = 0; i < s; i++) {
          for (let j = 0; j < s; j++) {
            if (i === 0 || i === s-1 || j === 0 || j === s-1) {
              last.next = { type: 'spawn', params: { x: i, y: y, z: j }, next: null, children: null };
              last = last.next;
              last.next = { type: 'place', params: { block: blk }, next: null, children: null };
              last = last.next;
            }
          }
        }
      }
      last.next = { type: 'say', params: { text: '🗼 หอคอยเสร็จ!' }, next: null, children: null };
      return script;
    }
  },
  // === Bridge ===
  {
    keywords: ['สะพาน', 'bridge'],
    build(p, ctx) {
      const len = p.length || 15;
      const script = {
        type: 'on_start', params: {},
        next: { type: 'spawn', params: { x: 0, y: 0, z: 0 }, next: null, children: null }
      };
      let last = script.next;
      last.next = { type: 'say', params: { text: `🌉 สร้างสะพานยาว ${len}` }, next: null, children: null };
      last = last.next;
      for (let i = 0; i < len; i++) {
        last.next = { type: 'spawn', params: { x: i, y: 0, z: 0 }, next: null, children: null };
        last = last.next;
        last.next = { type: 'place', params: { block: 7 }, next: null, children: null }; // planks
        last = last.next;
      }
      last.next = { type: 'say', params: { text: '🌉 สะพานเสร็จ!' }, next: null, children: null };
      return script;
    }
  },
  // === Floor / Platform ===
  {
    keywords: ['พื้น', 'platform', 'floor', 'แท่น'],
    build(p, ctx) {
      const w = p.width || 10, d = p.depth || 10;
      const blk = p.block || 7;
      const script = {
        type: 'on_start', params: {},
        next: { type: 'spawn', params: { x: 0, y: 0, z: 0 }, next: null, children: null }
      };
      let last = script.next;
      last.next = { type: 'say', params: { text: `⬜ สร้างพื้น ${w}x${d}` }, next: null, children: null };
      last = last.next;
      for (let i = 0; i < w; i++) {
        for (let j = 0; j < d; j++) {
          last.next = { type: 'spawn', params: { x: i, y: 0, z: j }, next: null, children: null };
          last = last.next;
          last.next = { type: 'place', params: { block: blk }, next: null, children: null };
          last = last.next;
        }
      }
      last.next = { type: 'say', params: { text: '✅ พื้นเสร็จ!' }, next: null, children: null };
      return script;
    }
  },
  // === Pyramid ===
  {
    keywords: ['พีระมิด', 'pyramid'],
    build(p, ctx) {
      const size = p.size || 5;
      const blk = p.block || 4; // sand
      const script = {
        type: 'on_start', params: {},
        next: { type: 'spawn', params: { x: 0, y: 0, z: 0 }, next: null, children: null }
      };
      let last = script.next;
      last.next = { type: 'say', params: { text: `🔺 สร้างพีระมิด ${size}x${size}` }, next: null, children: null };
      last = last.next;
      for (let y = 0; y < size; y++) {
        const layerSize = size - y;
        const offset = y;
        for (let i = 0; i < layerSize; i++) {
          for (let j = 0; j < layerSize; j++) {
            last.next = { type: 'spawn', params: { x: i + offset, y: y, z: j + offset }, next: null, children: null };
            last = last.next;
            last.next = { type: 'place', params: { block: blk }, next: null, children: null };
            last = last.next;
          }
        }
      }
      last.next = { type: 'say', params: { text: '🔺 พีระมิดเสร็จ!' }, next: null, children: null };
      return script;
    }
  },
  // === Pool ===
  {
    keywords: ['สระ', 'pool', 'บ่อน้ำ'],
    build(p, ctx) {
      const w = p.width || 5, d = p.depth || 5;
      const script = {
        type: 'on_start', params: {},
        next: { type: 'spawn', params: { x: 0, y: 0, z: 0 }, next: null, children: null }
      };
      let last = script.next;
      last.next = { type: 'say', params: { text: `🏊 สร้างสระ ${w}x${d}` }, next: null, children: null };
      last = last.next;
      // Dig a hole
      for (let i = 0; i < w; i++) {
        for (let j = 0; j < d; j++) {
          last.next = { type: 'spawn', params: { x: i, y: 0, z: j }, next: null, children: null };
          last = last.next;
          last.next = { type: 'break_block', params: {}, next: null, children: null };
          last = last.next;
          last.next = { type: 'place', params: { block: 13 }, next: null, children: null }; // water
          last = last.next;
        }
      }
      last.next = { type: 'say', params: { text: '🏊 สระเสร็จ!' }, next: null, children: null };
      return script;
    }
  },
  // === Circle ===
  {
    keywords: ['วงกลม', 'circle', 'ring'],
    build(p, ctx) {
      const r = p.radius || 5;
      const blk = p.block || 8;
      const script = {
        type: 'on_start', params: {},
        next: { type: 'spawn', params: { x: 0, y: 0, z: 0 }, next: null, children: null }
      };
      let last = script.next;
      last.next = { type: 'say', params: { text: `⭕ วงกลมรัศมี ${r}` }, next: null, children: null };
      last = last.next;
      for (let i = 0; i < 360; i += 10) {
        const rad = (i * Math.PI) / 180;
        const x = Math.round(r * Math.cos(rad));
        const z = Math.round(r * Math.sin(rad));
        last.next = { type: 'spawn', params: { x, y: 0, z }, next: null, children: null };
        last = last.next;
        last.next = { type: 'place', params: { block: blk }, next: null, children: null };
        last = last.next;
      }
      last.next = { type: 'say', params: { text: '⭕ วงกลมเสร็จ!' }, next: null, children: null };
      return script;
    }
  },
  // === Dig ===
  {
    keywords: ['ขุด', 'dig', 'หลุม'],
    build(p, ctx) {
      const w = p.width || 3, d = p.depth || 3, depth = p.depth2 || 3;
      const script = {
        type: 'on_start', params: {},
        next: { type: 'spawn', params: { x: 0, y: 0, z: 0 }, next: null, children: null }
      };
      let last = script.next;
      last.next = { type: 'say', params: { text: `⛏ ขุดหลุม ${w}x${d}x${depth}` }, next: null, children: null };
      last = last.next;
      for (let y = 0; y < depth; y++) {
        for (let i = 0; i < w; i++) {
          for (let j = 0; j < d; j++) {
            last.next = { type: 'spawn', params: { x: i, y: -y, z: j }, next: null, children: null };
            last = last.next;
            last.next = { type: 'break_block', params: {}, next: null, children: null };
            last = last.next;
          }
        }
      }
      last.next = { type: 'say', params: { text: '⛏ ขุดเสร็จ!' }, next: null, children: null };
      return script;
    }
  },
  // === Move test ===
  {
    keywords: ['เดิน', 'เคลื่อนที่', 'move', 'walk'],
    build(p, ctx) {
      const dir = p.direction || 'forward';
      const count = p.count || 10;
      const script = {
        type: 'on_start', params: {},
        next: { type: 'spawn', params: { x: 0, y: 0, z: 0 }, next: null, children: null }
      };
      let last = script.next;
      last.next = { type: 'walk', params: { direction: dir, count }, next: null, children: null };
      last = last.next;
      last.next = { type: 'say', params: { text: '🚶 เดินเสร็จ!' }, next: null, children: null };
      return script;
    }
  },
  // === Greeting ===
  {
    keywords: ['สวัสดี', 'hello', 'ทักทาย', 'greet'],
    build(p, ctx) {
      const script = {
        type: 'on_start', params: {},
        next: { type: 'spawn', params: { x: 0, y: 0, z: 0 }, next: null, children: null }
      };
      let last = script.next;
      last.next = { type: 'say', params: { text: 'สวัสดีครับ! 👋' }, next: null, children: null };
      last = last.next;
      last.next = { type: 'jump', params: {}, next: null, children: null };
      last = last.next;
      last.next = { type: 'say', params: { text: 'ยินดีต้อนรับสู่ MiniCraft 3D!' }, next: null, children: null };
      return script;
    }
  },
  // === Tree (decoration) ===
  {
    keywords: ['ต้นไม้', 'tree'],
    build(p, ctx) {
      const h = p.height || 5;
      const script = {
        type: 'on_start', params: {},
        next: { type: 'spawn', params: { x: 0, y: 0, z: 0 }, next: null, children: null }
      };
      let last = script.next;
      last.next = { type: 'say', params: { text: '🌳 ปลูกต้นไม้' }, next: null, children: null };
      last = last.next;
      // Trunk
      for (let y = 0; y < h; y++) {
        last.next = { type: 'spawn', params: { x: 0, y, z: 0 }, next: null, children: null };
        last = last.next;
        last.next = { type: 'place', params: { block: 5 }, next: null, children: null }; // wood
        last = last.next;
      }
      // Leaves (3x3 around top)
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          for (let dy = 0; dy < 2; dy++) {
            if (Math.abs(i) + Math.abs(j) > 1 && dy === 0) continue;
            last.next = { type: 'spawn', params: { x: i, y: h + dy, z: j }, next: null, children: null };
            last = last.next;
            last.next = { type: 'place', params: { block: 6 }, next: null, children: null }; // leaves
            last = last.next;
          }
        }
      }
      last.next = { type: 'say', params: { text: '🌳 ต้นไม้เสร็จ!' }, next: null, children: null };
      return script;
    }
  },
];

function localAIGenerate(prompt) {
  const lower = prompt.toLowerCase();
  const ctx = { blockNames: window.BLOCK_NAMES || {} };
  for (const pattern of LOCAL_AI_PATTERNS) {
    for (const kw of pattern.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        // Parse simple params from prompt
        const params = parseSimpleParams(prompt, pattern.defaults || {});
        const tree = pattern.build(params, ctx);
        return {
          ok: true,
          source: 'local',
          pattern: kw,
          params,
          script: { id: 'ai_' + Date.now(), name: 'AI: ' + prompt, scripts: [tree] },
          description: `Matched pattern "${kw}" (offline)`
        };
      }
    }
  }
  // No match - return greeting
  return {
    ok: true,
    source: 'local',
    pattern: 'fallback',
    script: {
      id: 'ai_' + Date.now(),
      name: 'AI: ' + prompt.slice(0, 30),
      scripts: [{
        type: 'on_start', params: {},
        next: { type: 'say', params: { text: '🤖 ขออภัย ผมยังไม่เข้าใจคำสั่ง: "' + prompt + '"\nลอง: บ้าน, หอคอย, กำแพง, พีระมิด, ต้นไม้, สะพาน, ขุด, สระ, วงกลม' }, next: null, children: null }
      }]
    },
    description: 'ไม่พบ pattern ที่ตรงกัน (local AI)'
  };
}

function parseSimpleParams(prompt, defaults) {
  const params = { ...defaults };
  // Extract numbers
  const numMatches = prompt.match(/(\d+)/g);
  if (numMatches && numMatches.length > 0) {
    // Try to match keywords to params
    const lower = prompt.toLowerCase();
    if (lower.includes('size') || lower.includes('ขนาด') || /\d+\s*x\s*\d+/.test(prompt)) {
      const dim = prompt.match(/(\d+)\s*[x×*]\s*(\d+)/);
      if (dim) {
        params.size = parseInt(dim[1]);
        params.width = parseInt(dim[1]);
        params.depth = parseInt(dim[2]);
      }
    } else if (lower.includes('ยาว') || lower.includes('long') || lower.includes('length')) {
      params.length = parseInt(numMatches[0]);
    } else if (lower.includes('สูง') || lower.includes('tall') || lower.includes('high') || lower.includes('height')) {
      params.height = parseInt(numMatches[0]);
    } else if (lower.includes('รัศมี') || lower.includes('radius')) {
      params.radius = parseInt(numMatches[0]);
    } else if (numMatches.length >= 1) {
      // Default: use first number as size/length
      const n = parseInt(numMatches[0]);
      if (params.size) params.size = n;
      if (params.length) params.length = n;
      if (params.height) params.height = n;
    }
  }
  // Extract block type
  const blockKeywords = {
    'หญ้า': 1, 'grass': 1, 'ดิน': 2, 'dirt': 2,
    'หิน': 3, 'หินก้อน': 3, 'stone': 3,
    'หินก่อ': 8, 'cobble': 8, 'cobblestone': 8,
    'ไม้': 5, 'wood': 5,
    'ไม้แปรรูป': 7, 'plank': 7, 'planks': 7,
    'ทราย': 4, 'sand': 4,
    'อิฐ': 11, 'brick': 11,
    'หิมะ': 10, 'snow': 10,
    'กระจก': 14, 'glass': 14,
    'น้ำ': 13, 'water': 13,
    'ฟักทอง': 12, 'pumpkin': 12,
  };
  for (const [kw, id] of Object.entries(blockKeywords)) {
    if (prompt.toLowerCase().includes(kw)) {
      params.block = id;
      break;
    }
  }
  return params;
}

// ======================================================================
// ONLINE LLM API (OpenAI-compatible)
// ======================================================================
const AI_SYSTEM_PROMPT = `You are a script generator for MiniCraft 3D's Visual Block Programming system.

Generate a JSON script that the game can execute. Output ONLY valid JSON, no other text.

# Coordinate system (IMPORTANT):
All x/y/z coordinates in spawn/place_at/fill are RELATIVE to the player's
position when the script runs: (0,0,0) = the player's feet, +y = up.
Keep builds near the origin (roughly -20..20).

# Block types:
- Hat blocks (start of each script):
  - on_start: runs when Run is pressed
  - on_chat <command:string>: runs when the player types "/<command>" in chat
  - on_key <key:w|a|s|d|space|up|down|left|right>: runs on key press

- Motion:
  - spawn <x> <y> <z>                            (teleport agent, relative)
  - walk <direction:forward|back|left|right> <count:1-20>
  - turn <degrees:-360-360>
  - jump
  - fly_up <height:1-20> / fly_down <height:1-20>
  - teleport <distance:1-50>

- Action:
  - place <block_id>                             (place in front of agent)
  - place_at <x> <y> <z> <block_id>              (place at relative coords)
  - fill <x1> <y1> <z1> <x2> <y2> <z2> <block_id>  (fill a region, max 8000 blocks)
  - say <text>
  - break_block

- Control:
  - repeat <count:1-100> with children: [...]
  - while_block <condition> with children: [...] (max 200 loops)
  - if_block <condition> with children: [...]
  - wait <seconds:0.1-10>
  (conditions: block_ahead | ground_below | is_day | is_night)

- Variables:
  - set_var <name> <value>
  - change_var <name> <delta>

# Block IDs:
0=AIR, 1=GRASS, 2=DIRT, 3=STONE, 4=SAND, 5=WOOD, 6=LEAVES,
7=PLANKS, 8=COBBLE, 9=BEDROCK, 10=SNOW, 11=BRICK, 12=PUMPKIN,
13=WATER, 14=GLASS, 15=TORCH, 16=DOOR, 17=CACTUS, 18=SANDSTONE,
19=ICE, 20=ORE_COAL, 21=ORE_IRON, 22=ORE_GOLD, 23=ORE_DIAMOND,
24=GLOWSTONE, 25=CRAFTING_TABLE, 26=LEVER, 27=PRESSURE_PLATE,
28=FLOWER, 29=SAPLING, 30=CHEST, 31=FURNACE

# Format:
{
  "id": "ai_<timestamp>",
  "name": "<short name>",
  "scripts": [
    {
      "id": "s_<unique>",
      "type": "on_start",
      "params": {},
      "next": {
        "id": "b_<unique>",
        "type": "fill",
        "params": { "x1": 0, "y1": 0, "z1": 0, "x2": 4, "y2": 0, "z2": 4, "block": 7 },
        "next": null,
        "children": null
      },
      "children": null
    }
  ]
}

# Rules:
- Every script starts with a hat block (on_start, on_chat, on_key)
- "next" chains blocks together; "children" is for repeat/if/while
- PREFER fill over repeated place_at for floors/walls/roofs (1 block vs many)
- Houses: fill 4 walls (leave a door gap), glass windows, fill roof
- Keep scripts reasonable (under ~60 blocks)
- Use say blocks to communicate progress

User request: `;

async function onlineAIGenerate(prompt) {
  if (!aiSettings.apiKey) {
    return { ok: false, error: 'ต้องใส่ API Key ก่อน (Settings → AI)' };
  }
  try {
    const res = await fetch(aiSettings.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + aiSettings.apiKey
      },
      body: JSON.stringify({
        model: aiSettings.model,
        messages: [
          { role: 'system', content: AI_SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: 'API ' + res.status + ': ' + errText.slice(0, 200) };
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    // Extract JSON from response (might have markdown code block)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { ok: false, error: 'ไม่พบ JSON ในคำตอบ: ' + content.slice(0, 200) };
    }
    let parsed;
    try { parsed = JSON.parse(jsonMatch[0]); } catch(e) {
      return { ok: false, error: 'JSON parse error: ' + e.message };
    }
    const validated = validateAIScript(parsed);
    if (!validated.ok) return validated;
    return {
      ok: true,
      source: 'online',
      pattern: 'llm',
      script: validated.script,
      description: 'Generated by LLM'
    };
  } catch(e) {
    return { ok: false, error: 'Network error: ' + e.message };
  }
}

function validateAIScript(data) {
  if (!data || typeof data !== 'object') return { ok: false, error: 'ไม่ใช่ object' };
  if (!Array.isArray(data.scripts)) return { ok: false, error: 'ไม่มี scripts array' };
  // Validate each script
  for (let i = 0; i < data.scripts.length; i++) {
    const s = data.scripts[i];
    if (!BLOCK_DEFS[s.type]) return { ok: false, error: `Script ${i+1}: invalid type "${s.type}"` };
    if (BLOCK_DEFS[s.type].kind !== 'hat') return { ok: false, error: `Script ${i+1}: ต้องเริ่มด้วย hat block` };
    // Validate recursively
    const checkBlocks = (block, path) => {
      if (!block || typeof block !== 'object') return;
      if (!BLOCK_DEFS[block.type]) throw new Error(`${path}: invalid type "${block.type}"`);
      // Validate params
      const def = BLOCK_DEFS[block.type];
      for (const p of def.params || []) {
        if (block.params && block.params[p.name] !== undefined) {
          const v = block.params[p.name];
          if (p.type === 'number') {
            const n = parseFloat(v);
            if (isNaN(n)) throw new Error(`${path}.${p.name}: not a number`);
            block.params[p.name] = n;
            if (p.min !== undefined && n < p.min) block.params[p.name] = p.min;
            if (p.max !== undefined && n > p.max) block.params[p.name] = p.max;
          } else if (p.type === 'string') {
            block.params[p.name] = String(v).slice(0, 200);
          }
        } else if (block.params) {
          block.params[p.name] = p.default;
        }
      }
      if (!block.params) block.params = {};
      if (!block.id) block.id = 'b_ai_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      if (block.next) checkBlocks(block.next, path + '.next');
      if (Array.isArray(block.children)) {
        for (let j = 0; j < block.children.length; j++) {
          checkBlocks(block.children[j], path + `.children[${j}]`);
        }
      } else {
        block.children = null;
      }
    };
    try {
      checkBlocks(s, `script ${i+1}`);
    } catch(e) {
      return { ok: false, error: e.message };
    }
  }
  return { ok: true, script: data };
}

function aiGenerateScript(prompt) {
  if (aiSettings.mode === 'online') {
    return onlineAIGenerate(prompt);
  } else {
    // Local is synchronous, wrap in promise for consistency
    return Promise.resolve(localAIGenerate(prompt));
  }
}

// AI Modal UI
function openAIModal() {
  document.getElementById('ai-modal').classList.add('show');
  document.getElementById('ai-prompt').value = '';
  document.getElementById('ai-result').style.display = 'none';
  document.getElementById('ai-prompt').focus();
  // Load saved settings
  document.getElementById('ai-mode').value = aiSettings.mode;
  document.getElementById('ai-apikey').value = aiSettings.apiKey;
  document.getElementById('ai-apiurl').value = aiSettings.apiUrl;
  document.getElementById('ai-model').value = aiSettings.model;
  updateAIModeUI();
}
function closeAIModal() {
  document.getElementById('ai-modal').classList.remove('show');
  // Save settings
  aiSettings.mode = document.getElementById('ai-mode').value;
  aiSettings.apiKey = document.getElementById('ai-apikey').value.trim();
  aiSettings.apiUrl = document.getElementById('ai-apiurl').value.trim() || aiSettings.apiUrl;
  aiSettings.model = document.getElementById('ai-model').value.trim() || 'gpt-4o-mini';
  try { localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(aiSettings)); } catch(e) {}
}
function updateAIModeUI() {
  const mode = document.getElementById('ai-mode').value;
  document.getElementById('ai-online-settings').style.display = mode === 'online' ? 'block' : 'none';
  document.getElementById('ai-mode-desc').textContent = mode === 'online' ?
    '🌐 ใช้ LLM API (ต้องใส่ key) — ยืดหยุ่นกว่า แต่ต้องต่อเน็ต' :
    '⚡ ใช้ pattern matching ในเครื่อง — เร็ว ไม่ต้องต่อเน็ต แต่จำกัดคำสั่ง';
}

let _aiLastResult = null;
async function runAI() {
  const prompt = document.getElementById('ai-prompt').value.trim();
  if (!prompt) { toast('⚠ พิมพ์คำสั่งก่อน'); return; }
  // Save settings
  aiSettings.mode = document.getElementById('ai-mode').value;
  aiSettings.apiKey = document.getElementById('ai-apikey').value.trim();
  aiSettings.apiUrl = document.getElementById('ai-apiurl').value.trim() || aiSettings.apiUrl;
  aiSettings.model = document.getElementById('ai-model').value.trim() || 'gpt-4o-mini';
  // Show loading
  document.getElementById('ai-loading').style.display = 'block';
  document.getElementById('ai-result').style.display = 'none';
  const btn = document.getElementById('ai-run');
  btn.disabled = true;
  btn.textContent = '⏳ กำลังสร้าง...';
  const result = await aiGenerateScript(prompt);
  btn.disabled = false;
  btn.textContent = '🤖 Generate';
  document.getElementById('ai-loading').style.display = 'none';
  if (!result.ok) {
    toast('❌ ' + result.error);
    return;
  }
  _aiLastResult = result;
  // Show result
  const resEl = document.getElementById('ai-result');
  resEl.style.display = 'block';
  // Count blocks
  let blockCount = 0;
  for (const s of result.script.scripts) blockCount += countBlocks(s);
  document.getElementById('ai-result-info').innerHTML =
    `<b>✅ สร้างสำเร็จ!</b><br>` +
    `📍 Source: ${result.source} | Pattern: ${result.pattern}<br>` +
    `📊 ${result.script.scripts.length} script(s), ${blockCount} block(s)<br>` +
    `<span style="color:#888">${result.description}</span>`;
  document.getElementById('ai-result-json').textContent = JSON.stringify(result.script, null, 2);
  toast('🤖 AI สร้าง script สำเร็จ');
}

function applyAIResult(mode) {
  if (!_aiLastResult) return;
  const newScripts = _aiLastResult.script.scripts;
  pushUndo();
  if (mode === 'replace') {
    savedScripts = [];
  }
  for (const s of newScripts) {
    reassignIds(s);
    savedScripts.push(s);
  }
  saveScripts();
  renderScripts();
  closeAIModal();
  toast('✅ เพิ่ม script แล้ว (' + newScripts.length + ' ตัว)');
}

// ======================================================================
// WORLD BROWSER (Persistent Worlds)
// ======================================================================
function getMPBaseURL() {
  // Returns base URL for MP server (same as WebSocket but with http/https)
  const loc = window.location;
  const host = loc.hostname;
  if (host.endsWith('space.minimax.io')) {
    return 'http://103.253.75.161:3109';
  }
  return loc.protocol + '//' + loc.hostname + ':3109';
}

async function fetchWorlds() {
  try {
    const res = await fetch(getMPBaseURL() + '/api/worlds');
    if (!res.ok) return [];
    return await res.json();
  } catch(e) {
    console.warn('fetchWorlds:', e);
    return [];
  }
}

async function fetchWorld(code) {
  try {
    const res = await fetch(getMPBaseURL() + '/api/worlds/' + code);
    if (!res.ok) return null;
    return await res.json();
  } catch(e) {
    return null;
  }
}

async function deleteWorldReq(code) {
  try {
    const res = await fetch(getMPBaseURL() + '/api/worlds/' + code, { method: 'DELETE' });
    return res.ok;
  } catch(e) {
    return false;
  }
}

async function openWorldsModal() {
  document.getElementById('worlds-modal').classList.add('show');
  await renderWorldsList();
  unlockPointer();
}

function closeWorldsModal() {
  document.getElementById('worlds-modal').classList.remove('show');
  // Only re-lock pointer if we were already in-game
  if (typeof mouseLocked !== 'undefined' && mouseLocked) {
    lockPointer();
  }
}

async function renderWorldsList() {
  const list = document.getElementById('worlds-list');
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;padding:20px;color:#888">⏳ Loading...</div>';
  const worlds = await fetchWorlds();
  // Update count badge
  const badge = document.getElementById('world-count');
  if (badge) badge.textContent = `(${worlds.length})`;
  if (worlds.length === 0) {
    list.innerHTML = `<div class="world-empty">
      <div class="empty-icon">🌍</div>
      <div style="font-size:14px;margin-bottom:6px;color:#aaa">ยังไม่มีโลกที่บันทึก</div>
      <div style="font-size:11px;color:#666">สร้างห้อง → เล่น → เมื่อ host ออก โลกจะถูก save อัตโนมัติ</div>
    </div>`;
    return;
  }
  let html = '';
  for (const w of worlds) {
    const sizeStr = `${w.W}×${w.D}×${w.H}`;
    const blocksStr = (w.blockCount || 0).toLocaleString();
    const timeAgo = timeSince(w.lastSaved);
    const dateStr = new Date(w.lastSaved).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
    html += `<div class="world-row" data-code="${w.code}">
      <div class="world-icon">🌍</div>
      <div class="world-info">
        <div class="world-name">${escapeHTML(w.name || 'World ' + w.code)}</div>
        <div class="world-meta">
          <span>🆔 ${w.code}</span>
          <span>📐 ${sizeStr}</span>
          <span>🧱 ${blocksStr} blocks</span>
          <span>👤 ${escapeHTML(w.lastHost || 'Unknown')}</span>
          <span>⏰ ${timeAgo}</span>
        </div>
        <div class="world-meta" style="margin-top:2px">
          <span style="color:#666">📅 ${dateStr}</span>
        </div>
      </div>
      <div class="world-actions">
        <button class="btn-resume" data-code="${w.code}">▶ Resume</button>
        <button class="btn-rename" data-code="${w.code}" title="เปลี่ยนชื่อ">✏️</button>
        <button class="btn-delete" data-code="${w.code}" title="ลบ">🗑</button>
      </div>
    </div>`;
  }
  list.innerHTML = html;
  // Hook actions
  list.querySelectorAll('.btn-resume').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      resumeWorld(b.dataset.code);
    });
  });
  list.querySelectorAll('.btn-rename').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      renameWorldPrompt(b.dataset.code);
    });
  });
  list.querySelectorAll('.btn-delete').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      if (confirm('ลบโลก ' + b.dataset.code + '? (ไม่สามารถกู้คืนได้)')) {
        deleteWorldReq(b.dataset.code).then(ok => {
          if (ok) {
            toast('🗑 ลบโลกแล้ว');
            renderWorldsList();
          } else {
            toast('❌ ลบไม่สำเร็จ');
          }
        });
      }
    });
  });
}

function timeSince(ts) {
  if (!ts) return 'ไม่ทราบ';
  const diff = Date.now() - ts;
  if (diff < 60000) return Math.floor(diff/1000) + 's ที่แล้ว';
  if (diff < 3600000) return Math.floor(diff/60000) + 'นาที ที่แล้ว';
  if (diff < 86400000) return Math.floor(diff/3600000) + 'ชม. ที่แล้ว';
  return Math.floor(diff/86400000) + 'วัน ที่แล้ว';
}

function escapeHTML(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function renameWorldPrompt(code) {
  const newName = prompt('เปลี่ยนชื่อโลก ' + code + ':');
  if (!newName) return;
  // Rename/delete are admin-only on the unified server — ask for the token
  const token = prompt('Admin token ของ server (ปรากฏใน console/journal ของ server):');
  if (!token) return;
  try {
    const res = await fetch(getMPBaseURL() + '/api/worlds/' + code + '/rename?token=' + encodeURIComponent(token), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName })
    });
    if (res.ok) {
      toast('✏️ เปลี่ยนชื่อแล้ว');
      renderWorldsList();
    } else {
      toast(res.status === 403 ? '❌ token ไม่ถูกต้อง' : '❌ เปลี่ยนชื่อไม่สำเร็จ');
    }
  } catch(e) {
    toast('❌ ' + e.message);
  }
}

// Resume a saved world: create a new room with that world preloaded
async function resumeWorld(code) {
  closeWorldsModal();
  toast('🌍 กำลังโหลดโลก ' + code + '...');
  // Show MP panel UI
  showMPPanel('host');
  document.getElementById('mp-info').textContent = '🌍 กำลัง Resume โลก ' + code + '...';
  // Reset state
  mp.connected = false;
  mp.roomCode = null;
  mp.isHost = true;
  // Clear any pending reconnect timer (race condition)
  if (mp.reconnectTimer) {
    clearTimeout(mp.reconnectTimer);
    mp.reconnectTimer = null;
  }
  // Force close existing WS
  if (mp.ws) {
    try { mp.ws.close(); } catch(e) {}
    mp.ws = null;
  }
  // Wait for the close to actually complete
  await new Promise(r => setTimeout(r, 500));
  // Reconnect WS
  if (typeof connectMP === 'function') {
    connectMP();
    // Wait for WS to be open
    for (let i = 0; i < 100; i++) {
      if (mp.ws && mp.ws.readyState === WebSocket.OPEN) {
        // Send create_room with resumeCode
        sendMP({ type: 'create_room', name: mp.myName, color: mp.myColor, resumeCode: code });
        return;
      }
      await new Promise(r => setTimeout(r, 100));
    }
    toast('❌ ไม่สามารถเชื่อมต่อ WebSocket');
  }
}

function updateWorldCount() {
  fetchWorlds().then(worlds => {
    const badge = document.getElementById('world-count');
    if (badge) badge.textContent = `(${worlds.length})`;
  });
}

// Save indicator (HUD)
let _saveIndicatorTimer = null;
function showSaveIndicator(state) {
  const el = document.getElementById('save-indicator');
  if (!el) return;
  if (_saveIndicatorTimer) clearTimeout(_saveIndicatorTimer);
  if (state === 'saving') {
    el.innerHTML = '<span style="animation:spin 1s linear infinite">⏳</span> <span>Saving...</span>';
    el.className = 'show saving';
  } else if (state === 'saved') {
    el.innerHTML = '<span>✓</span> <span>Saved</span>';
    el.className = 'show saved';
    _saveIndicatorTimer = setTimeout(() => el.classList.remove('show'), 2000);
  } else if (state === 'host-left') {
    el.innerHTML = '<span>💾</span> <span>Host ออก — โลกถูก save แล้ว</span>';
    el.className = 'show saved';
    _saveIndicatorTimer = setTimeout(() => el.classList.remove('show'), 4000);
  } else {
    el.classList.remove('show');
  }
}
// Add spin keyframe
const _spinCSS = document.createElement('style');
_spinCSS.textContent = '@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}';
document.head.appendChild(_spinCSS);

// Hook up world browser
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-worlds')?.addEventListener('click', openWorldsModal);
  document.getElementById('worlds-close')?.addEventListener('click', closeWorldsModal);
  document.getElementById('worlds-refresh')?.addEventListener('click', renderWorldsList);
  document.getElementById('worlds-modal')?.addEventListener('click', e => {
    if (e.target.id === 'worlds-modal') closeWorldsModal();
  });
  // Update count on load
  setTimeout(updateWorldCount, 1000);
  setInterval(updateWorldCount, 30000);
});

// PWA offline support: the unified Node server also serves /sw.js and
// /manifest.webmanifest. Registration is skipped silently on file:// or on
// hosts that don't provide them (plain static hosting still works fine).
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  try { navigator.serviceWorker.register('/sw.js').catch(() => {}); } catch (e) { /* ignore */ }
}

