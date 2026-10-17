// ======================================================================
// TIER 1: SOUND SYSTEM (Web Audio API procedural)
// ======================================================================
let audioCtx = null;
let soundEnabled = true;
function initAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch(e) { soundEnabled = false; }
}
function playSound(type) {
  if (!soundEnabled || !audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  // Different waveform + envelope per sound
  switch(type) {
    case 'break': {
      // noise-like square wave burst
      osc.type = 'square';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now); osc.stop(now + 0.1);
      break;
    }
    case 'place': {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(360, now + 0.07);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now); osc.stop(now + 0.08);
      break;
    }
    case 'step': {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(80 + Math.random() * 40, now);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now); osc.stop(now + 0.05);
      break;
    }
    case 'hurt': {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.25);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now); osc.stop(now + 0.3);
      break;
    }
    case 'jump': {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(360, now + 0.1);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now); osc.stop(now + 0.12);
      break;
    }
    case 'splash': {
      // water entry - white noise burst
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now); osc.stop(now + 0.22);
      break;
    }
    case 'click': {
      osc.type = 'square';
      osc.frequency.value = 800;
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.start(now); osc.stop(now + 0.04);
      break;
    }
    case 'achievement': {
      // happy 3-note arpeggio
      const notes = [523, 659, 784]; // C5, E5, G5
      notes.forEach((freq, i) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.connect(g); g.connect(audioCtx.destination);
        o.type = 'sine';
        o.frequency.value = freq;
        const t0 = now + i * 0.08;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.15, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25);
        o.start(t0); o.stop(t0 + 0.25);
      });
      return; // no osc.start needed
    }
    case 'explode': {
      // low rumble with quick drop
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(20, now + 0.5);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.start(now); osc.stop(now + 0.5);
      break;
    }
    case 'door': {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(400, now + 0.1);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now); osc.stop(now + 0.15);
      break;
    }
    case 'lever': {
      osc.type = 'square';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(330, now + 0.05);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now); osc.stop(now + 0.1);
      break;
    }
    case 'sword': {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.12);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.start(now); osc.stop(now + 0.14);
      break;
    }
    case 'eat': {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.setValueAtTime(120, now + 0.06);
      osc.frequency.setValueAtTime(180, now + 0.12);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now); osc.stop(now + 0.18);
      break;
    }
    default: osc.start(now); osc.stop(now + 0.05);
  }
}

// Step timer for footstep sounds
let stepTimer = 0;

// ======================================================================
// TIER 1: TIME + DAY/NIGHT
// ======================================================================
// gameTime declared earlier (line ~273) to avoid TDZ
// Convention: gameTime 0-24000 = 1 day
// 0 = dawn (6am), 6000 = noon, 12000 = dusk (6pm), 18000 = midnight
function timeOfDay() { return (gameTime / 24000); } // 0..1
function isNight() {
  const t = timeOfDay();
  // night from ~7pm (0.54) to ~5am (0.79)
  return t > 0.54 || t < 0.04;
}
function getTimeLabel() {
  const t = timeOfDay();
  // t=0=dawn, t=0.25=noon, t=0.5=dusk, t=0.75=midnight
  if (t < 0.05) return 'เช้าตรู่';
  if (t < 0.18) return 'เช้า';
  if (t < 0.22) return 'สาย';
  if (t < 0.35) return 'เที่ยง';
  if (t < 0.48) return 'บ่าย';
  if (t < 0.55) return 'เย็น';
  if (t < 0.65) return 'ค่ำ';
  if (t < 0.80) return 'กลางคืน';
  return 'เที่ยงคืน';
}
function getTimeIcon() {
  const t = timeOfDay();
  if (t < 0.05) return '🌅';  // dawn
  if (t < 0.45) return '☀️';   // day
  if (t < 0.55) return '🌇';  // dusk
  if (t < 0.75) return '🌆';  // evening
  return '🌙';                  // night
}
function getSkyColor() {
  // returns [r,g,b] for sky/fog based on time
  // t=0 dawn, t=0.25 noon, t=0.5 dusk, t=0.75 night
  const t = timeOfDay();
  if (t < 0.20) { // night (early)
    return [0.05, 0.07, 0.18];
  } else if (t < 0.23) { // dawn
    const k = (t - 0.20) / 0.03;
    return [0.05 + k*0.6, 0.07 + k*0.4, 0.18 + k*0.55];
  } else if (t < 0.45) { // day
    return [0.55, 0.78, 0.95];
  } else if (t < 0.55) { // dusk
    const k = (t - 0.45) / 0.10;
    return [0.55 - k*0.4, 0.78 - k*0.55, 0.95 - k*0.7];
  } else { // night
    const k = Math.min(1, (t - 0.55) / 0.20);
    return [0.15 - k*0.1, 0.23 - k*0.16, 0.25 - k*0.07];
  }
}
function getSunDir() {
  // sun rises in east, peaks at noon, sets in west
  const t = timeOfDay();
  // Map t to angle: 0 = dawn, 0.5 = dusk
  const angle = (t - 0.25) * Math.PI * 2; // -pi/2 at midnight, pi/2 at noon
  return [Math.cos(angle) * 0.5, Math.sin(angle), Math.sin(angle) * 0.4];
}
function updateTimeUI() {
  const t = timeOfDay();
  const tint = document.getElementById('day-tint');
  if (t < 0.20) tint.className = 'night';
  else if (t < 0.24) tint.className = 'dawn';
  else if (t < 0.45) tint.className = 'day';
  else if (t < 0.55) tint.className = 'dusk';
  else tint.className = 'night';
  document.getElementById('time-icon').textContent = getTimeIcon();
  document.getElementById('time-text').textContent = getTimeLabel();
  // Day count
  const days = Math.floor(gameTime / 24000);
  if (days > 0) document.getElementById('time-text').textContent += ` (วันที่ ${days + 1})`;
}

// ======================================================================
// TIER 1: HUNGER
// ======================================================================
// hunger, MAX_HUNGER declared earlier (line ~271) to avoid TDZ

function updateHungerUI() {
  const el = document.getElementById('hud-hunger');
  let html = '';
  for (let i = 0; i < MAX_HUNGER; i += 2) {
    const filled = i < hunger;
    const half = i === hunger - 1;
    if (filled) html += '<span class="hunger-icon">🍗</span>';
    else if (half) html += '<span class="hunger-icon" style="opacity:.5">🍗</span>';
    else html += '<span class="hunger-icon" style="opacity:.15">🍗</span>';
  }
  el.innerHTML = html;
}

// ======================================================================
// TIER 1: HP + HURT
// ======================================================================
function updateHPUI() {
  const el = document.getElementById('hud-hp');
  let html = '';
  for (let i = 0; i < CFG.MAX_HP; i += 2) {
    const filled = i < player.hp;
    const half = i === player.hp - 1;
    if (filled) html += '<span class="heart">❤️</span>';
    else if (half) html += '<span class="heart" style="opacity:.5">❤️</span>';
    else html += '<span class="heart" style="opacity:.15">❤️</span>';
  }
  el.innerHTML = html;
}

// Air bubbles — hidden while full, shown while the head is underwater
function updateAirUI() {
  const el = document.getElementById('hud-air');
  if (!el) return;
  if (air >= MAX_AIR) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  const bubbles = Math.ceil(air);
  let html = '';
  for (let i = 0; i < MAX_AIR; i++) {
    html += `<span style="opacity:${i < bubbles ? 1 : 0.2}">🫧</span>`;
  }
  el.innerHTML = html;
}

function damagePlayer(amount, source) {
  if (player.flyMode) return; // can't die in creative
  player.hp = Math.max(0, player.hp - amount);
  playSound('hurt');
  flashHurt();
  updateHPUI();
  if (player.hp <= 0) {
    respawnPlayer();
  }
}
function flashHurt() {
  const f = document.getElementById('hurt-flash');
  f.classList.add('show');
  setTimeout(() => f.classList.remove('show'), 200);
}
function healPlayer(amount) {
  player.hp = Math.min(CFG.MAX_HP, player.hp + amount);
  updateHPUI();
}
function respawnPlayer() {
  toast('💀 คุณตาย! กลับจุดเกิด');
  player.hp = CFG.MAX_HP;
  hunger = 20;
  const sp = findSpawn();
  player.x = sp.x; player.y = sp.y; player.z = sp.z;
  player.vx = player.vy = player.vz = 0;
  updateHPUI();
  updateHungerUI();
}

let lastY = 0, fallStart = 0;
function trackFall() {
  if (player.vy < -2 && !player.onGround && !player.flyMode) {
    if (fallStart === 0) fallStart = player.y;
  } else if (player.onGround) {
    if (fallStart > 0) {
      const dist = fallStart - player.y;
      if (dist > CFG.FALL_DAMAGE_THRESHOLD) {
        const dmg = Math.floor(dist - CFG.FALL_DAMAGE_THRESHOLD);
        if (dmg > 0) damagePlayer(dmg, 'fall');
      }
      fallStart = 0;
    }
  }
}

// ======================================================================
// TIER 1: MOB SYSTEM
// ======================================================================
// mobs, MOB_TYPES declared earlier (lines ~274, 285) to avoid TDZ

function spawnMob(type, x, y, z) {
  if (mobs.length >= CFG.MAX_MOBS) return;
  const def = MOB_TYPES[type];
  if (!def) return;
  mobs.push({
    type, x, y, z,
    vx: 0, vy: 0, vz: 0,
    hp: def.hp,
    w: def.w, h: def.h,
    lastDamage: 0,
    wanderDir: Math.random() * Math.PI * 2,
    wanderTime: 2 + Math.random() * 3,
    target: null,
    fuse: 0,
    dead: false,
  });
}

function spawnMobs() {
  // Initial mob population (only hostiles at night, peacefuls anytime)
  for (let i = 0; i < 18; i++) {
    const x = 4 + Math.random() * (W - 8);
    const z = 4 + Math.random() * (D - 8);
    const y = findSurface(x, z);
    if (y < 2) continue;
    const r = Math.random();
    const type = r < 0.4 ? 'pig' : r < 0.7 ? 'cow' : r < 0.85 ? 'zombie' : 'creeper';
    spawnMob(type, x, y + 0.1, z);
  }
}

function findSurface(x, z) {
  for (let y = H-1; y > 0; y--) {
    if (getBlock(x, y, z) !== B.AIR && getBlock(x, y, z) !== B.WATER && getBlock(x, y, z) !== B.LEAVES) {
      return y + 1;
    }
  }
  return 0;
}

function updateMobs(dt) {
  const t = timeOfDay();
  const night = isNight();
  for (let i = mobs.length - 1; i >= 0; i--) {
    const m = mobs[i];
    if (m.dead) {
      mobs.splice(i, 1);
      continue;
    }
    const def = MOB_TYPES[m.type];
    const dx = player.x - m.x, dy = (player.y + 1) - m.y, dz = player.z - m.z;
    const dist2 = dx*dx + dy*dy + dz*dz;
    // Despawn if too far
    if (dist2 > CFG.MOB_DESPAWN_RADIUS * CFG.MOB_DESPAWN_RADIUS) {
      m.dead = true;
      continue;
    }
    // Aggro: hostiles within range, only at night for zombies
    if (def.hostile && (m.type === 'zombie' ? night : true) && dist2 < CFG.MOB_AGGRO_RADIUS * CFG.MOB_AGGRO_RADIUS) {
      m.target = player;
    } else if (def.hostile && dist2 > CFG.MOB_AGGRO_RADIUS * CFG.MOB_AGGRO_RADIUS * 1.5) {
      m.target = null;
    } else if (!def.hostile) {
      // peacefuls run if player is very close
      m.target = dist2 < 4 ? player : null;
    }
    // Movement
    let mx = 0, mz = 0;
    if (m.target) {
      // chase (or flee for passive)
      const len = Math.sqrt(dx*dx + dz*dz) || 1;
      const speed = def.hostile ? 2.4 : 3.5;
      mx = (dx/len) * speed;
      mz = (dz/len) * speed;
      // Jumping if blocked
      const ahead = getBlock(Math.floor(m.x + (dx/len) * 0.6), Math.floor(m.y), Math.floor(m.z + (dz/len) * 0.6));
      if (ahead !== B.AIR && ahead !== B.WATER && ahead !== B.LEAVES) m.vy = CFG.JUMP_VEL * 0.8;
    } else {
      // wander
      m.wanderTime -= dt;
      if (m.wanderTime <= 0) {
        m.wanderDir = Math.random() * Math.PI * 2;
        m.wanderTime = 2 + Math.random() * 4;
      }
      mx = Math.cos(m.wanderDir) * 1.2;
      mz = Math.sin(m.wanderDir) * 1.2;
    }
    m.vx = mx;
    m.vz = mz;
    // Gravity
    m.vy += CFG.GRAVITY * dt;
    if (m.vy < -30) m.vy = -30;
    // Move with AABB collision
    moveMobAxis(m, 'x', m.vx * dt);
    moveMobAxis(m, 'z', m.vz * dt);
    moveMobAxis(m, 'y', m.vy * dt);
    if (m.y < -10) m.dead = true;
    // Creeper: explode near player
    if (m.type === 'creeper' && dist2 < 4) {
      m.fuse += dt;
      if (m.fuse > 1.8) {
        explodeAt(m.x, m.y, m.z);
        damagePlayer(8, 'creeper');
        playSound('explode');
        m.dead = true;
      }
    } else {
      m.fuse = Math.max(0, m.fuse - dt);
    }
    // Damage player if touching
    if (dist2 < 1.3 && def.hostile) {
      if (performance.now() / 1000 - m.lastDamage > CFG.MOB_DAMAGE_COOLDOWN) {
        m.lastDamage = performance.now() / 1000;
        damagePlayer(CFG.MOB_HOSTILE_DAMAGE, m.type);
      }
    }
  }
  // Spawn new mobs at night
  if (night && mobs.length < CFG.MAX_MOBS && Math.random() < dt * 0.5) {
    const ang = Math.random() * Math.PI * 2;
    const r = 15 + Math.random() * 10;
    const x = player.x + Math.cos(ang) * r;
    const z = player.z + Math.sin(ang) * r;
    if (x < 2 || x >= W-2 || z < 2 || z >= D-2) return;
    const y = findSurface(x, z);
    if (y > 2) {
      const t = Math.random() < 0.5 ? 'zombie' : 'creeper';
      spawnMob(t, x, y + 0.1, z);
    }
  }
}

function moveMobAxis(m, axis, delta) {
  const newPos = m[axis] + delta;
  const hw = m.w / 2;
  // Compute AABB in the relevant axis
  let minA, maxA, minB, maxB, minC, maxC;
  if (axis === 'x') {
    minA = Math.floor(newPos - hw); maxA = Math.floor(newPos + hw);
    minB = Math.floor(m.y); maxB = Math.floor(m.y + m.h);
    minC = Math.floor(m.z - hw); maxC = Math.floor(m.z + hw);
  } else if (axis === 'y') {
    minA = Math.floor(newPos); maxA = Math.floor(newPos + m.h);
    minB = Math.floor(m.x - hw); maxB = Math.floor(m.x + hw);
    minC = Math.floor(m.z - hw); maxC = Math.floor(m.z + hw);
  } else {
    minA = Math.floor(newPos - hw); maxA = Math.floor(newPos + hw);
    minB = Math.floor(m.y); maxB = Math.floor(m.y + m.h);
    minC = Math.floor(m.x - hw); maxC = Math.floor(m.x + hw);
  }
  for (let b = minB; b <= maxB; b++) {
    for (let c = minC; c <= maxC; c++) {
      for (let a = minA; a <= maxA; a++) {
        let x, y, z;
        if (axis === 'x') { x = a; y = b; z = c; }
        else if (axis === 'y') { x = c; y = a; z = b; }
        else { x = c; y = b; z = a; }
        if (isSolid(x, y, z)) {
          if (axis === 'x') {
            m.x = delta > 0 ? x - hw - 0.001 : x + 1 + hw + 0.001;
            m.vx = 0;
          } else if (axis === 'y') {
            m.y = delta > 0 ? y - m.h - 0.001 : y + 1 + 0.001;
            m.vy = 0;
            if (delta > 0) m.onGround = true;
          } else {
            m.z = delta > 0 ? z - hw - 0.001 : z + 1 + hw + 0.001;
            m.vz = 0;
          }
          return;
        }
      }
    }
  }
  m[axis] = newPos;
  if (axis === 'y' && delta > 0) m.onGround = false;
}

function explodeAt(x, y, z) {
  // damage blocks in radius 3
  const r = 3;
  for (let dy = -r; dy <= r; dy++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (dist > r) continue;
        const xx = Math.floor(x) + dx, yy = Math.floor(y) + dy, zz = Math.floor(z) + dz;
        if (!inBounds(xx, yy, zz)) continue;
        const b = getBlock(xx, yy, zz);
        if (b !== B.AIR && b !== B.BEDROCK && b !== B.WATER && dist > 0.5) {
          if (Math.random() < (1 - dist / r) * 0.8) {
            setBlock(xx, yy, zz, B.AIR);
            meshRebuildNeeded = true;
          }
        }
      }
    }
  }
}

function damageMob(m, amount) {
  m.hp -= amount;
  // knockback
  const dx = m.x - player.x, dz = m.z - player.z;
  const len = Math.sqrt(dx*dx + dz*dz) || 1;
  m.vx = (dx/len) * 4;
  m.vz = (dz/len) * 4;
  m.vy = 4;
  if (m.hp <= 0) {
    // drop item
    const def = MOB_TYPES[m.type];
    addToInventory(def.drops, 1 + (Math.random() < 0.5 ? 1 : 0));
    playSound('hurt');
    m.dead = true;
    stats.mobsKilled++; // feeds the 'monster hunter' achievement (was never counted before)
    if (def.hostile) {
      awardAchievement('monster_hunter');
    }
  }
}

// ---- Combat: left-click hits the mob under the crosshair ----
// Damage by held item (pure — unit-tested)
function attackDamageFor(item) {
  if (typeof item !== 'string') return 1;      // fist
  if (item === 'wooden_sword') return 3;
  if (item === 'stone_sword') return 4;
  if (item.endsWith('_sword')) return 4;      // modded swords (ruby_sword, ...)
  return 1;                                    // any other item = fist damage
}
// Closest live mob whose center is within reach and roughly under the crosshair
function mobUnderCrosshair() {
  const ex = player.x, ey = player.y + CFG.PLAYER_EYE, ez = player.z;
  const cp = Math.cos(player.pitch), sp = Math.sin(player.pitch);
  const cy = Math.cos(player.yaw), sy = Math.sin(player.yaw);
  const dx = -sy * cp, dy = sp, dz = -cy * cp;
  let best = null, bestT = CFG.REACH;
  for (const m of mobs) {
    if (m.dead) continue;
    const ox = m.x - ex, oy = (m.y + m.h / 2) - ey, oz = m.z - ez;
    const t = ox * dx + oy * dy + oz * dz; // distance along the view ray
    if (t < 0 || t > bestT) continue;
    const px2 = ox - t * dx, py2 = oy - t * dy, pz2 = oz - t * dz;
    const dist2 = px2 * px2 + py2 * py2 + pz2 * pz2; // miss distance
    const radius = Math.max(m.w, m.h) / 2 + 0.4;
    if (dist2 <= radius * radius) { best = m; bestT = t; }
  }
  return best;
}
function attackMob(m) {
  const dmg = attackDamageFor(handSlots[selectedSlot]);
  damageMob(m, dmg);
  playSound('sword');
  addParticles(m.x, m.y + m.h / 2, m.z, '#ff5555', 5);
}

// ======================================================================
// TIER 2: INVENTORY
// ======================================================================
// item = {name, blockId|itemId, count}
// itemId for non-blocks: 'stick', 'pork', 'leather', 'rotten_flesh', 'gunpowder', 'coal', 'iron_ingot', 'gold_ingot', 'diamond', 'wooden_pickaxe', 'stone_pickaxe', 'iron_pickaxe', 'wooden_sword', 'stone_sword', 'torch_item', 'bread'
// inventory declared earlier (line ~275) to avoid TDZ
function addToInventory(name, count = 1) {
  // find existing
  for (const it of inventory) {
    if (it.name === name) { it.count += count; updateInventoryUI(); updateHotbarUI(); return true; }
  }
  inventory.push({ name, count });
  autoFillHandSlots(); // newly picked-up blocks occupy empty hand slots
  updateInventoryUI();
  updateHotbarUI();
  return true;
}

// Blocks in the inventory automatically claim empty hand slots (max 8 kinds)
function autoFillHandSlots() {
  for (const it of inventory) {
    if (!it.name.startsWith('block:')) continue;
    if (handSlots.includes(it.name)) continue;
    const empty = handSlots.indexOf(null);
    if (empty < 0) break;
    handSlots[empty] = it.name;
  }
}

// Edible items → hunger restored (right-click with food in hand, or
// right-click the item inside the inventory modal)
const FOODS = { pork: 3, cooked_pork: 5, bread: 4, rotten_flesh: 1 };
function eatItem(name) {
  const val = FOODS[name];
  if (!val) { toast('🚫 กินไม่ได้'); return; }
  if (hunger >= MAX_HUNGER) { toast('😋 ยังไม่หิว'); return; }
  if (!removeFromInventory(name, 1)) return;
  hunger = Math.min(MAX_HUNGER, hunger + val);
  updateHungerUI();
  playSound('eat');
  toast('🍽 กิน ' + itemDisplayName(name) + ' (ความหิว +' + val + ')');
}
function hasItem(name, count = 1) {
  for (const it of inventory) {
    if (it.name === name) return it.count >= count;
  }
  return false;
}
function removeFromInventory(name, count = 1) {
  for (let i = 0; i < inventory.length; i++) {
    if (inventory[i].name === name) {
      if (inventory[i].count >= count) {
        inventory[i].count -= count;
        if (inventory[i].count <= 0) inventory.splice(i, 1);
        updateInventoryUI();
        return true;
      }
    }
  }
  return false;
}

// Item visual info (for inventory icons + crafting)
const ITEMS = {
  stick: { name: 'ไม้ขีด', icon: null, color: '#8c5a2c' },
  pork: { name: 'หมูดิบ', icon: null, color: '#ec8a8a' },
  leather: { name: 'หนัง', icon: null, color: '#6a4818' },
  rotten_flesh: { name: 'เนื้อเน่า', icon: null, color: '#5a6a30' },
  gunpowder: { name: 'ดินปืน', icon: null, color: '#888' },
  coal: { name: 'ถ่าน', icon: null, color: '#1a1a1a' },
  iron_ingot: { name: 'เหล็ก', icon: null, color: '#c8c8c8' },
  gold_ingot: { name: 'ทอง', icon: null, color: '#ffd800' },
  diamond: { name: 'เพชร', icon: null, color: '#5cd0e8' },
  wooden_pickaxe: { name: 'พลั่วไม้', icon: null, color: '#9c6a30' },
  stone_pickaxe: { name: 'พลั่วหิน', icon: null, color: '#7a7a82' },
  iron_pickaxe: { name: 'พลั่วเหล็ก', icon: null, color: '#c8c8c8' },
  wooden_sword: { name: 'ดาบไม้', icon: null, color: '#9c6a30' },
  stone_sword: { name: 'ดาบหิน', icon: null, color: '#7a7a82' },
  torch_item: { name: 'คบไฟ (ไอเทม)', icon: null, color: '#ff7a00' },
  bread: { name: 'ขนมปัง', icon: null, color: '#c89060' },
  cooked_pork: { name: 'หมูสุก', icon: null, color: '#c8704a' },
};

function drawItemIcon(ctx, name, x, y, size) {
  // simple colored shape based on type
  ctx.fillStyle = '#2a2a3a';
  ctx.fillRect(x, y, size, size);
  // Check if modded item with shape
  const items = getItems ? getItems() : null;
  const info = items ? items.get(name) : null;
  if (info && info.shape) {
    drawItemShape(ctx, info.shape, info.color, x, y, size);
    ctx.strokeStyle = 'rgba(0,0,0,.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
    return;
  }
  if (name.startsWith('wooden_') || name === 'stick') {
    ctx.fillStyle = '#8c5a2c';
    ctx.fillRect(x + size*0.2, y + size*0.5, size*0.6, size*0.15);
    ctx.fillStyle = '#5a3818';
    ctx.fillRect(x + size*0.35, y + size*0.2, size*0.3, size*0.3);
  } else if (name.startsWith('stone_')) {
    ctx.fillStyle = '#7a7a82';
    ctx.fillRect(x + size*0.15, y + size*0.3, size*0.5, size*0.35);
    ctx.fillStyle = '#5a3818';
    ctx.fillRect(x + size*0.45, y + size*0.6, size*0.1, size*0.3);
  } else if (name.startsWith('iron_')) {
    ctx.fillStyle = '#c8c8c8';
    ctx.fillRect(x + size*0.15, y + size*0.3, size*0.5, size*0.35);
    ctx.fillStyle = '#8c5a2c';
    ctx.fillRect(x + size*0.45, y + size*0.6, size*0.1, size*0.3);
  } else if (name === 'torch_item') {
    ctx.fillStyle = '#ff7a00';
    ctx.fillRect(x + size*0.4, y + size*0.2, size*0.2, size*0.3);
    ctx.fillStyle = '#ffd800';
    ctx.fillRect(x + size*0.4, y + size*0.1, size*0.2, size*0.15);
    ctx.fillStyle = '#8c5a2c';
    ctx.fillRect(x + size*0.45, y + size*0.5, size*0.1, size*0.4);
  } else if (name === 'bread') {
    ctx.fillStyle = '#c89060';
    ctx.fillRect(x + size*0.15, y + size*0.4, size*0.7, size*0.35);
    ctx.fillStyle = '#a06030';
    for (let i = 0; i < 3; i++) ctx.fillRect(x + size*0.2 + i*size*0.2, y + size*0.5, size*0.05, size*0.1);
  } else if (name === 'pork' || name === 'cooked_pork') {
    ctx.fillStyle = name === 'cooked_pork' ? '#c8704a' : '#ec8a8a';
    ctx.fillRect(x + size*0.15, y + size*0.3, size*0.7, size*0.45);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + size*0.5, y + size*0.4, size*0.1, size*0.1);
  } else if (name === 'coal') {
    ctx.fillStyle = '#1a1a1a';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(x + size*0.15 + (i%2)*size*0.3, y + size*0.3 + Math.floor(i/2)*size*0.25, size*0.25, size*0.2);
    }
  } else if (name === 'iron_ingot') {
    ctx.fillStyle = '#c8c8c8';
    ctx.fillRect(x + size*0.1, y + size*0.4, size*0.8, size*0.35);
    ctx.fillStyle = '#888';
    ctx.fillRect(x + size*0.1, y + size*0.4, size*0.8, size*0.05);
  } else if (name === 'gold_ingot') {
    ctx.fillStyle = '#ffd800';
    ctx.fillRect(x + size*0.1, y + size*0.4, size*0.8, size*0.35);
    ctx.fillStyle = '#a08020';
    ctx.fillRect(x + size*0.1, y + size*0.4, size*0.8, size*0.05);
  } else if (name === 'diamond') {
    ctx.fillStyle = '#5cd0e8';
    ctx.beginPath();
    ctx.moveTo(x + size*0.5, y + size*0.15);
    ctx.lineTo(x + size*0.85, y + size*0.4);
    ctx.lineTo(x + size*0.5, y + size*0.85);
    ctx.lineTo(x + size*0.15, y + size*0.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#a0f0ff';
    ctx.fillRect(x + size*0.45, y + size*0.3, size*0.1, size*0.15);
  } else if (name === 'gunpowder') {
    ctx.fillStyle = '#555';
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(x + size*0.2 + (i%3)*size*0.18, y + size*0.4 + Math.floor(i/3)*size*0.18, size*0.12, size*0.12);
    }
  } else if (name === 'rotten_flesh') {
    ctx.fillStyle = '#5a6a30';
    ctx.fillRect(x + size*0.2, y + size*0.35, size*0.6, size*0.4);
    ctx.fillStyle = '#7a8a40';
    for (let i = 0; i < 4; i++) ctx.fillRect(x + size*0.25 + (i%2)*size*0.3, y + size*0.4 + Math.floor(i/2)*size*0.2, size*0.08, size*0.08);
  } else if (name === 'leather') {
    ctx.fillStyle = '#6a4818';
    ctx.fillRect(x + size*0.2, y + size*0.3, size*0.6, size*0.5);
    ctx.fillStyle = '#3a2410';
    for (let i = 0; i < 3; i++) ctx.fillRect(x + size*0.25, y + size*0.4 + i*size*0.15, size*0.5, size*0.03);
  } else {
    // generic or modded item
    const items = getItems();
    const info = items.get(name) || { color: '#888', shape: null };
    if (info.shape) {
      drawItemShape(ctx, info.shape, info.color, x, y, size);
    } else {
      ctx.fillStyle = info.color;
      ctx.fillRect(x + size*0.25, y + size*0.25, size*0.5, size*0.5);
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
}

function drawItemShape(ctx, shape, color, x, y, size) {
  ctx.fillStyle = color;
  switch(shape) {
    case 'gem':
      ctx.beginPath();
      ctx.moveTo(x + size*0.5, y + size*0.1);
      ctx.lineTo(x + size*0.9, y + size*0.4);
      ctx.lineTo(x + size*0.5, y + size*0.9);
      ctx.lineTo(x + size*0.1, y + size*0.4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.fillRect(x + size*0.45, y + size*0.25, size*0.1, size*0.15);
      break;
    case 'ingot':
      ctx.fillRect(x + size*0.1, y + size*0.45, size*0.8, size*0.35);
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.fillRect(x + size*0.1, y + size*0.45, size*0.8, size*0.06);
      break;
    case 'stick':
      ctx.fillRect(x + size*0.3, y + size*0.5, size*0.4, size*0.15);
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.fillRect(x + size*0.3, y + size*0.5, size*0.4, size*0.05);
      break;
    case 'powder':
      for (let i = 0; i < 4; i++) {
        const px = x + size*0.2 + (i%2)*size*0.3;
        const py = y + size*0.4 + Math.floor(i/2)*size*0.18;
        ctx.fillRect(px, py, size*0.18, size*0.14);
      }
      break;
    case 'food':
      ctx.fillRect(x + size*0.15, y + size*0.35, size*0.7, size*0.45);
      ctx.fillStyle = 'rgba(255,255,255,.4)';
      ctx.fillRect(x + size*0.2, y + size*0.4, size*0.6, size*0.08);
      break;
    case 'leather':
      ctx.fillRect(x + size*0.2, y + size*0.3, size*0.6, size*0.5);
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      for (let i = 0; i < 3; i++) ctx.fillRect(x + size*0.25, y + size*0.45 + i*size*0.1, size*0.5, size*0.04);
      break;
    case 'tool_pickaxe':
      ctx.fillStyle = color;
      ctx.fillRect(x + size*0.25, y + size*0.3, size*0.35, size*0.3);
      ctx.fillRect(x + size*0.45, y + size*0.55, size*0.08, size*0.4);
      break;
    case 'tool_sword':
      ctx.fillStyle = color;
      ctx.fillRect(x + size*0.4, y + size*0.15, size*0.2, size*0.55);
      ctx.fillRect(x + size*0.3, y + size*0.7, size*0.4, size*0.1);
      ctx.fillStyle = '#5a3818';
      ctx.fillRect(x + size*0.45, y + size*0.8, size*0.1, size*0.15);
      break;
    case 'potion':
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + size*0.5, y + size*0.6, size*0.2, 0, Math.PI*2);
      ctx.fill();
      ctx.fillRect(x + size*0.45, y + size*0.25, size*0.1, size*0.25);
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.beginPath();
      ctx.arc(x + size*0.5, y + size*0.55, size*0.1, 0, Math.PI*2);
      ctx.fill();
      break;
    case 'coin':
      ctx.beginPath();
      ctx.arc(x + size*0.5, y + size*0.5, size*0.3, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.3)';
      ctx.beginPath();
      ctx.arc(x + size*0.45, y + size*0.4, size*0.15, 0, Math.PI*2);
      ctx.fill();
      break;
    default:
      ctx.fillRect(x + size*0.25, y + size*0.25, size*0.5, size*0.5);
  }
}

function updateInventoryUI() {
  const el = document.getElementById('inv-content');
  if (!el) return;
  if (inventory.length === 0) {
    el.innerHTML = '<p style="color:var(--muted)">คลังว่าง — ทุบบล็อกเพื่อเก็บของ</p>';
    return;
  }
  // Item names/counts can come from installed mods or MP-synced chests — escape
  // everything user-visible, and use index-based canvas ids so odd names can
  // neither inject HTML nor break the icon lookup below.
  let html = '';
  inventory.forEach((it, i) => {
    const label = it.name.startsWith('block:')
      ? (BLOCK_NAMES[parseInt(it.name.slice(6))] || it.name)
      : ((getItems().get(it.name) || { name: it.name }).name);
    html += `<div class="inv-row"><div class="lbl">${escapeHTML(label)}</div><div class="slots"><div class="inv-slot" data-name="${escapeHTML(it.name)}"><canvas id="inv-${i}" width="32" height="32"></canvas><span class="count">${escapeHTML(String(it.count))}</span></div></div></div>`;
  });
  el.innerHTML = html;
  // draw icons
  inventory.forEach((it, i) => {
    const c = document.getElementById(`inv-${i}`);
    if (c) {
      const ctx = c.getContext('2d');
      if (it.name.startsWith('block:')) {
        drawBlockIcon(ctx, parseInt(it.name.slice(6)), 2, 2, 28);
      } else {
        drawItemIcon(ctx, it.name, 2, 2, 28);
      }
    }
  });
  // Left-click: hold in the selected hand slot. Right-click: eat food.
  // (data-name is entity-escaped in the HTML above; dataset returns the
  // decoded value, so names round-trip exactly.)
  el.querySelectorAll('.inv-slot').forEach(s => {
    s.addEventListener('click', () => {
      const name = s.dataset.name;
      if (!name) return;
      handSlots[selectedSlot] = name;
      updateHotbarUI();
      toast('✋ ถือ ' + itemDisplayName(name));
    });
    s.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const name = s.dataset.name;
      if (name && FOODS[name]) eatItem(name);
      else toast('คลิกซ้ายเพื่อถือ • อาหารกินด้วยคลิกขวา');
    });
  });
  updateHotbarUI();
}

// ======================================================================
// TIER 2: CRAFTING (data-driven via ModManager)
// ======================================================================
// Recipe format:
//   { id, mod, name?, category?, result: {name, count}, ingredients: [{name, count}] }
// Item format (mods can add custom items):
//   { id, name, color, shape? }  -- shape is 'gem'|'stick'|'ingot'|'food'|'tool_pickaxe'|'tool_sword'|'leather'|'powder'
// Block format (mods can add custom blocks - up to 32 total in 8x4 atlas):
//   { id, name, color, drops?, hardness? }

// Built-in vanilla mod (always loaded)
const VANILLA_MOD = {
  id: 'vanilla',
  name: 'Vanilla',
  version: '1.0.0',
  author: 'MiniCraft',
  builtin: true,
  items: [
    { id: 'stick', name: 'ไม้ขีด', color: '#8c5a2c', shape: 'stick' },
    { id: 'pork', name: 'หมูดิบ', color: '#ec8a8a', shape: 'food' },
    { id: 'leather', name: 'หนัง', color: '#6a4818', shape: 'leather' },
    { id: 'rotten_flesh', name: 'เนื้อเน่า', color: '#5a6a30', shape: 'food' },
    { id: 'gunpowder', name: 'ดินปืน', color: '#888', shape: 'powder' },
    { id: 'coal', name: 'ถ่าน', color: '#1a1a1a', shape: 'powder' },
    { id: 'iron_ingot', name: 'เหล็ก', color: '#c8c8c8', shape: 'ingot' },
    { id: 'gold_ingot', name: 'ทอง', color: '#ffd800', shape: 'ingot' },
    { id: 'diamond', name: 'เพชร', color: '#5cd0e8', shape: 'gem' },
    { id: 'wooden_pickaxe', name: 'พลั่วไม้', color: '#9c6a30', shape: 'tool_pickaxe' },
    { id: 'stone_pickaxe', name: 'พลั่วหิน', color: '#7a7a82', shape: 'tool_pickaxe' },
    { id: 'iron_pickaxe', name: 'พลั่วเหล็ก', color: '#c8c8c8', shape: 'tool_pickaxe' },
    { id: 'wooden_sword', name: 'ดาบไม้', color: '#9c6a30', shape: 'tool_sword' },
    { id: 'stone_sword', name: 'ดาบหิน', color: '#7a7a82', shape: 'tool_sword' },
    { id: 'torch_item', name: 'คบไฟ', color: '#ff7a00', shape: 'stick' },
    { id: 'bread', name: 'ขนมปัง', color: '#c89060', shape: 'food' },
    { id: 'cooked_pork', name: 'หมูสุก', color: '#c8704a', shape: 'food' },
  ],
  recipes: [
    { id: 'planks', category: 'basic', name: 'ไม้แปรรูป', result: { name: 'block:' + B.PLANKS, count: 4 }, ingredients: [{ name: 'block:' + B.WOOD, count: 1 }] },
    { id: 'stick', category: 'basic', name: 'ไม้ขีด', result: { name: 'stick', count: 4 }, ingredients: [{ name: 'block:' + B.PLANKS, count: 2 }] },
    { id: 'torch', category: 'basic', name: 'คบไฟ', result: { name: 'torch_item', count: 4 }, ingredients: [{ name: 'stick', count: 1 }, { name: 'coal', count: 1 }] },
    { id: 'crafting_table', category: 'basic', name: 'โต๊ะคราฟต์', result: { name: 'block:' + B.CRAFTING_TABLE, count: 1 }, ingredients: [{ name: 'block:' + B.PLANKS, count: 4 }] },
    // ===== Tier 2: 3x3 recipes (need crafting table) =====
    { id: 'chest', category: 'building', name: 'หีบ', needTable: true, result: { name: 'block:' + B.CHEST, count: 1 }, shape: [
      {item:'block:' + B.PLANKS},{item:'block:' + B.PLANKS},{item:'block:' + B.PLANKS},
      {item:'block:' + B.PLANKS},{item:'block:' + B.PLANKS},{item:'block:' + B.PLANKS},
      {item:'block:' + B.PLANKS},{item:'block:' + B.PLANKS},{item:'block:' + B.PLANKS},
    ] },
    { id: 'furnace', category: 'building', name: 'เตา', needTable: true, result: { name: 'block:' + B.FURNACE, count: 1 }, shape: [
      {item:'block:' + B.COBBLE},{item:'block:' + B.COBBLE},{item:'block:' + B.COBBLE},
      {item:'block:' + B.COBBLE},null,{item:'block:' + B.COBBLE},
      {item:'block:' + B.COBBLE},{item:'block:' + B.COBBLE},{item:'block:' + B.COBBLE},
    ] },
    { id: 'wood_door_3x3', category: 'building', name: 'ประตูไม้ (x3)', needTable: true, result: { name: 'block:' + B.DOOR, count: 3 }, shape: [
      {item:'block:' + B.PLANKS},null,{item:'block:' + B.PLANKS},
      {item:'block:' + B.PLANKS},null,{item:'block:' + B.PLANKS},
      {item:'block:' + B.PLANKS},null,{item:'block:' + B.PLANKS},
    ] },
    { id: 'glass_3x3', category: 'basic', name: 'กระจก', needTable: true, result: { name: 'block:' + B.GLASS, count: 1 }, shape: [
      {item:'block:' + B.SAND},null,{item:'block:' + B.SAND},
      null,{item:'coal',count:1},null,
      {item:'block:' + B.SAND},null,{item:'block:' + B.SAND},
    ] },
    { id: 'stone_brick_3x3', category: 'building', name: 'อิฐ', needTable: true, result: { name: 'block:' + B.BRICK, count: 4 }, shape: [
      {item:'block:' + B.STONE},{item:'block:' + B.STONE},null,
      {item:'block:' + B.STONE},{item:'block:' + B.STONE},null,
      null,null,null,
    ] },
    { id: 'glass', category: 'basic', name: 'กระจก', result: { name: 'block:' + B.GLASS, count: 1 }, ingredients: [{ name: 'block:' + B.SAND, count: 1 }, { name: 'coal', count: 1 }] },
    { id: 'brick', category: 'basic', name: 'อิฐ', result: { name: 'block:' + B.BRICK, count: 4 }, ingredients: [{ name: 'block:' + B.COBBLE, count: 4 }] },
    { id: 'wooden_pickaxe', category: 'tools', name: 'พลั่วไม้', result: { name: 'wooden_pickaxe', count: 1 }, ingredients: [{ name: 'block:' + B.PLANKS, count: 3 }, { name: 'stick', count: 2 }] },
    { id: 'stone_pickaxe', category: 'tools', name: 'พลั่วหิน', result: { name: 'stone_pickaxe', count: 1 }, ingredients: [{ name: 'block:' + B.COBBLE, count: 3 }, { name: 'stick', count: 2 }] },
    { id: 'iron_pickaxe', category: 'tools', name: 'พลั่วเหล็ก', result: { name: 'iron_pickaxe', count: 1 }, ingredients: [{ name: 'iron_ingot', count: 3 }, { name: 'stick', count: 2 }] },
    { id: 'wooden_sword', category: 'tools', name: 'ดาบไม้', result: { name: 'wooden_sword', count: 1 }, ingredients: [{ name: 'block:' + B.PLANKS, count: 2 }, { name: 'stick', count: 1 }] },
    { id: 'cooked_pork', category: 'food', name: 'หมูสุก', result: { name: 'cooked_pork', count: 1 }, ingredients: [{ name: 'pork', count: 1 }, { name: 'coal', count: 1 }] },
    { id: 'stone_sword', category: 'tools', name: 'ดาบหิน', result: { name: 'stone_sword', count: 1 }, ingredients: [{ name: 'block:' + B.COBBLE, count: 2 }, { name: 'stick', count: 1 }] },
  ],
};

// ModManager - loads/saves/applies mods
const ModManager = {
  mods: [VANILLA_MOD],         // active mods (vanilla always first)
  userMods: [],                 // user-installed mods
  STORAGE_KEY: 'minicraft_mods_v1',
  RECIPE_KEY: 'minicraft_recipes_v1', // legacy key for migration

  // Initialize: load user mods from localStorage
  init() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const loaded = JSON.parse(raw);
        if (Array.isArray(loaded)) {
          for (const m of loaded) {
            if (m && m.id && m.id !== 'vanilla') {
              this.userMods.push(m);
              this.mods.push(m);
            }
          }
        }
      } else {
        // Try legacy recipe key for migration
        const legacy = localStorage.getItem(this.RECIPE_KEY);
        if (legacy) {
          try {
            const oldRecipes = JSON.parse(legacy);
            // Migrate to vanilla mod (no-op for now)
            localStorage.removeItem(this.RECIPE_KEY);
          } catch(e) {}
        }
      }
    } catch(e) {
      console.warn('Mod load failed:', e);
    }
    return this;
  },

  // Get all recipes across all mods
  getAllRecipes() {
    const recipes = [];
    for (const m of this.mods) {
      if (Array.isArray(m.recipes)) {
        for (const r of m.recipes) {
          recipes.push({ ...r, mod: m.id, modName: m.name });
        }
      }
    }
    return recipes;
  },

  // Get all items across all mods
  getAllItems() {
    const items = new Map();
    for (const m of this.mods) {
      if (Array.isArray(m.items)) {
        for (const it of m.items) {
          items.set(it.id, it);
        }
      }
    }
    return items;
  },

  // Get recipes by category
  getRecipesByCategory() {
    const cats = {};
    for (const r of this.getAllRecipes()) {
      const cat = r.category || 'other';
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push(r);
    }
    return cats;
  },

  // Install a mod from JSON string
  installFromJson(jsonStr) {
    let mod;
    try { mod = JSON.parse(jsonStr); } catch(e) {
      return { ok: false, error: 'JSON ไม่ถูกต้อง: ' + e.message };
    }
    return this.install(mod);
  },

  // Install a mod from URL
  async installFromUrl(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return { ok: false, error: 'HTTP ' + res.status };
      const text = await res.text();
      return this.installFromJson(text);
    } catch(e) {
      return { ok: false, error: 'โหลดไม่ได้: ' + e.message };
    }
  },

  // Install a mod object
  install(mod) {
    if (!mod || !mod.id) return { ok: false, error: 'ต้องมี id' };
    if (mod.id === 'vanilla') return { ok: false, error: 'ไม่สามารถติดตั้ง vanilla ทับได้' };
    if (!mod.name) mod.name = mod.id;
    if (!mod.version) mod.version = '1.0';
    if (!Array.isArray(mod.recipes)) mod.recipes = [];
    if (!Array.isArray(mod.items)) mod.items = [];
    if (!Array.isArray(mod.blocks)) mod.blocks = [];
    // Remove existing mod with same id (update)
    this.userMods = this.userMods.filter(m => m.id !== mod.id);
    this.mods = this.mods.filter(m => m.id !== mod.id);
    this.userMods.push(mod);
    this.mods.push(mod);
    this.save();
    return { ok: true, mod };
  },

  // Remove a user mod
  remove(modId) {
    this.userMods = this.userMods.filter(m => m.id !== modId);
    this.mods = this.mods.filter(m => m.id !== modId);
    this.save();
  },

  // Save to localStorage
  save() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.userMods));
    } catch(e) {
      console.warn('Mod save failed:', e);
    }
  },

  // Export a mod to JSON string (for sharing)
  export(modId) {
    const m = this.mods.find(x => x.id === modId);
    if (!m) return null;
    return JSON.stringify(m, null, 2);
  },

  // Get stats
  stats() {
    return {
      modCount: this.mods.length,
      userModCount: this.userMods.length,
      recipeCount: this.getAllRecipes().length,
      itemCount: this.getAllItems().size,
    };
  },
};

// Initialize on load
ModManager.init();

// BC: keep RECIPES name for legacy code
function getRecipes() { return ModManager.getAllRecipes(); }
function getItems() { return ModManager.getAllItems(); }

function buildCraftUI() {
  const el = document.getElementById('craft-content');
  if (!el) return;
  let html = '';
  // Group by category
  const recipes = getRecipes();
  const byCat = {};
  for (const r of recipes) {
    // 3x3 shape recipes (chest/furnace/door/…) belong to the crafting TABLE UI;
    // they carry `shape` instead of `ingredients` and used to crash this quick list.
    if (r.needTable || !r.ingredients) continue;
    const cat = r.category || 'other';
    if (!byCat[cat]) byCat[cat] = [];
    byCat[cat].push(r);
  }
  // Render categories in order
  const catOrder = ['basic', 'tools', 'building', 'food', 'other'];
  const catNames = { basic: '🪵 พื้นฐาน', tools: '⛏ เครื่องมือ', building: '🏠 ก่อสร้าง', food: '🍞 อาหาร', other: '📦 อื่นๆ' };
  const allItems = getItems();
  for (const cat of catOrder) {
    if (!byCat[cat] || byCat[cat].length === 0) continue;
    html += `<div style="grid-column:1/-1;margin-top:8px;color:#7cda24;font-weight:700;font-size:13px;border-bottom:1px solid rgba(124,218,36,.3);padding-bottom:2px">${catNames[cat] || cat}</div>`;
    for (const r of byCat[cat]) {
      const canCraft = r.ingredients.every(ing => hasItem(ing.name, ing.count));
      const resultName = r.result.name.startsWith('block:') ?
        BLOCK_NAMES[parseInt(r.result.name.slice(6))] : (allItems.get(r.result.name)?.name || r.result.name);
      const ingText = r.ingredients.map(ing => {
        const n = ing.name.startsWith('block:') ?
          BLOCK_NAMES[parseInt(ing.name.slice(6))] : (allItems.get(ing.name)?.name || ing.name);
        return `${escapeHTML(String(n))} x${escapeHTML(String(ing.count))}`;
      }).join(' + ');
      // Mod-supplied names flow into innerHTML — escape display text and attributes
      const resNameAttr = escapeHTML(r.result.name);
      const modTag = r.mod && r.mod !== 'vanilla' ? `<span style="color:#ffd800;font-size:9px"> [${escapeHTML(String(r.mod))}]</span>` : '';
      html += `<div class="craft-item" data-recipe="${escapeHTML(String(r.id))}" data-result="${resNameAttr}" data-count="${escapeHTML(String(r.result.count))}" ${canCraft ? '' : 'style="opacity:.5"'}>
        <canvas data-item="${resNameAttr}" width="36" height="36"></canvas>
        <div class="info">
          <div class="name">${escapeHTML(String(resultName))} x${escapeHTML(String(r.result.count))}${modTag}</div>
          <div class="recipe">${ingText}</div>
        </div>
      </div>`;
    }
  }
  el.innerHTML = html;
  // draw icons
  el.querySelectorAll('canvas[data-item]').forEach(c => {
    const ctx = c.getContext('2d');
    const name = c.dataset.item;
    if (name.startsWith('block:')) {
      drawBlockIcon(ctx, parseInt(name.slice(6)), 2, 2, 32);
    } else {
      drawItemIcon(ctx, name, 2, 2, 32);
    }
  });
  // attach click handlers
  el.querySelectorAll('.craft-item').forEach(el => {
    el.addEventListener('click', () => {
      // Look up by recipe id — result name+count is NOT unique (glass 2x2 vs 3x3)
      const recipe = getRecipes().find(r => r.id === el.dataset.recipe);
      if (!recipe || !recipe.ingredients) return;
      const resultName = recipe.result.name;
      const count = recipe.result.count;
      // check ingredients again
      if (!recipe.ingredients.every(ing => hasItem(ing.name, ing.count))) {
        toast('❌ ของไม่พอ');
        return;
      }
      // remove ingredients
      for (const ing of recipe.ingredients) {
        removeFromInventory(ing.name, ing.count);
      }
      // add result
      addToInventory(resultName, count);
      playSound('click');
      buildCraftUI(); // refresh
      awardAchievement('crafty');
    });
  });
}

// ======================================================================
// TIER 2: ACHIEVEMENTS
// ======================================================================
const ACHIEVEMENTS = [
  { id: 'first_step', name: 'ก้าวแรก', desc: 'เดินครบ 100 บล็อก', check: () => stats.stepsWalked >= 100 },
  { id: 'lumberjack', name: 'คนตัดไม้', desc: 'ทุบไม้ 10 ครั้ง', check: () => stats.blocksBroken[B.WOOD] >= 10 },
  { id: 'miner', name: 'ขุดแร่', desc: 'ทุบหิน 50 ครั้ง', check: () => stats.blocksBroken[B.STONE] >= 50 },
  { id: 'builder', name: 'ช่างก่อสร้าง', desc: 'วางบล็อก 50 ครั้ง', check: () => stats.blocksPlaced >= 50 },
  { id: 'first_night', name: 'รอดคืนแรก', desc: 'มีชีวิตรอดจนถึงเช้า', check: () => stats.nightsSurvived >= 1 },
  { id: 'crafty', name: 'ช่างฝีมือ', desc: 'คราฟต์ของสำเร็จ 1 ชิ้น', check: () => stats.crafted >= 1 },
  { id: 'explorer', name: 'นักสำรวจ', desc: 'เดิน 500 บล็อกจากจุดเกิด', check: () => stats.maxDistance >= 500 },
  { id: 'monster_hunter', name: 'นักล่ามอนสเตอร์', desc: 'ฆ่ามอนสเตอร์ 5 ตัว', check: () => stats.mobsKilled >= 5 },
  { id: 'diamond_finder', name: 'นักขุดเพชร', desc: 'พบแร่เพชร', check: () => stats.diamondsFound >= 1 },
  { id: 'home_sweet_home', name: 'บ้านแสนรัก', desc: 'วางประตู 1 บาน', check: () => stats.doorsPlaced >= 1 },
];

// unlockedAch declared earlier (line ~276) to avoid TDZ
function awardAchievement(id) {
  if (unlockedAch.has(id)) return;
  const ach = ACHIEVEMENTS.find(a => a.id === id);
  if (!ach) return;
  unlockedAch.add(id);
  playSound('achievement');
  const el = document.getElementById('ach-popup');
  document.getElementById('ach-name').textContent = ach.name;
  document.getElementById('ach-desc').textContent = ach.desc;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3500);
  toast('🏆 ' + ach.name);
}
function checkAchievements() {
  for (const a of ACHIEVEMENTS) {
    if (!unlockedAch.has(a.id) && a.check()) {
      awardAchievement(a.id);
    }
  }
}

// ======================================================================
// TIER 2: STATS (used for achievements + tracking)
// ======================================================================
// stats declared earlier (line ~277) to avoid TDZ
function initStats() {
  stats.spawnX = player.x;
  stats.spawnZ = player.z;
  stats.lastWasNight = isNight();
}
function trackStats(dt) {
  // walking distance
  const dx = player.x - stats.spawnX, dz = player.z - stats.spawnZ;
  stats.maxDistance = Math.max(stats.maxDistance, Math.sqrt(dx*dx + dz*dz));
  // night transition
  const night = isNight();
  if (stats.lastWasNight && !night) {
    // just became day
    if (player.hp > 0) {
      stats.nightsSurvived++;
      awardAchievement('first_night');
    }
  }
  stats.lastWasNight = night;
  // hunger
  if (!player.flyMode) {
    hunger -= CFG.HUNGER_DECAY * dt;
    if (hunger < 0) {
      hunger = 0;
      damagePlayer(CFG.STARVE_DAMAGE * dt, 'starve');
    } else if (hunger > MAX_HUNGER) hunger = MAX_HUNGER;
    updateHungerUI();
  }
  // check achievements periodically
  if (Math.random() < dt * 0.5) checkAchievements();
}

// ======================================================================
// TIER 2: MINIMAP
// ======================================================================
const mmCanvas = document.getElementById('mmcanvas');
const mmCtx = mmCanvas.getContext('2d');
const MM_SIZE = 120;
const MM_SCALE = 4; // each pixel = 4 blocks
let minimapMode = 0; // 0=top-down, 1=angled

// Per-block flat colors (minimap + break particles)
const BLOCK_COLORS = {
  [B.GRASS]: '#5fb02a', [B.DIRT]: '#8c6438', [B.STONE]: '#909098', [B.SAND]: '#e8d090',
  [B.WOOD]: '#6a4820', [B.LEAVES]: '#3a8a25', [B.PLANKS]: '#c8a065', [B.COBBLE]: '#7a7a82',
  [B.BEDROCK]: '#404048', [B.SNOW]: '#fafaff', [B.BRICK]: '#a04028', [B.PUMPKIN]: '#ec8424',
  [B.WATER]: '#3060c0', [B.GLASS]: '#a0c0e0', [B.ICE]: '#9cc0d8', [B.SANDSTONE]: '#d4b870',
  [B.CACTUS]: '#3a8a25', [B.ORE_COAL]: '#404048', [B.ORE_IRON]: '#a08878',
  [B.ORE_GOLD]: '#d4b030', [B.ORE_DIAMOND]: '#40c0d0', [B.GLOWSTONE]: '#f0c850',
  [B.CRAFTING_TABLE]: '#9c6a30', [B.DOOR]: '#8c5a2c', [B.TORCH]: '#ffd800',
  [B.CHEST]: '#a06830', [B.FURNACE]: '#7a7a82', [B.FLOWER]: '#ec5cd0', [B.SAPLING]: '#3a8a25',
};

function drawMinimap() {
  mmCtx.fillStyle = '#000';
  mmCtx.fillRect(0, 0, MM_SIZE, MM_SIZE);
  // Show blocks in a small radius around player
  const px = Math.floor(player.x), pz = Math.floor(player.z);
  const half = Math.floor(MM_SIZE / 2);
  const heightLevel = Math.floor(player.y);
  const blockColors = BLOCK_COLORS;
  for (let dy = 0; dy < MM_SIZE; dy++) {
    for (let dx = 0; dx < MM_SIZE; dx++) {
      const wx = px + (dx - half) * MM_SCALE;
      const wz = pz + (dy - half) * MM_SCALE;
      if (wx < 0 || wx >= W || wz < 0 || wz >= D) continue;
      // find topmost block at this column
      let foundY = -1, foundB = 0;
      for (let y = H-1; y >= 0; y--) {
        const b = getBlock(wx, y, wz);
        if (b !== B.AIR && b !== B.LEAVES) {
          foundY = y; foundB = b; break;
        }
      }
      if (foundB === 0) continue;
      const c = blockColors[foundB] || '#666';
      mmCtx.fillStyle = c;
      mmCtx.fillRect(dx, dy, 1, 1);
    }
  }
  // player marker (center, yellow dot)
  mmCtx.fillStyle = '#ff0';
  mmCtx.fillRect(half - 2, half - 2, 4, 4);
  mmCtx.fillStyle = '#000';
  mmCtx.fillRect(half - 1, half - 1, 2, 2);
  // direction indicator
  const fwdX = -Math.sin(player.yaw) * 8;
  const fwdZ = -Math.cos(player.yaw) * 8;
  mmCtx.strokeStyle = '#ff0';
  mmCtx.beginPath();
  mmCtx.moveTo(half, half);
  mmCtx.lineTo(half + fwdX, half + fwdZ);
  mmCtx.stroke();
  // mob dots
  for (const m of mobs) {
    const mx = Math.floor((m.x - px) / MM_SCALE) + half;
    const my = Math.floor((m.z - pz) / MM_SCALE) + half;
    if (mx < 0 || mx >= MM_SIZE || my < 0 || my >= MM_SIZE) continue;
    const isHostile = MOB_TYPES[m.type].hostile;
    mmCtx.fillStyle = isHostile ? '#f00' : '#0f0';
    mmCtx.fillRect(mx - 1, my - 1, 3, 3);
  }
}

// ======================================================================
// TIER 3: REDSTONE LITE
// ======================================================================
// meta bits:
//   bit 0: powered (redstone active)
//   bit 1: door open
//   bit 2: lever on
function isPowered(x, y, z) {
  return (meta[idx(x, y, z)] & 1) !== 0;
}
function setPowered(x, y, z, v) {
  if (v) meta[idx(x, y, z)] |= 1;
  else meta[idx(x, y, z)] &= ~1;
}
function updateRedstone() {
  // Doors auto-open/close based on lever or pressure plate nearby
  for (let z = 0; z < D; z++) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const b = getBlock(x, y, z);
        if (b === B.DOOR) {
          const open = hasPowerNear(x, y, z);
          const wasOpen = (meta[idx(x, y, z)] & 2) !== 0;
          if (open !== wasOpen) {
            if (open) {
              meta[idx(x, y, z)] |= 2;
              // hide the block (set as air in world, remember it was door in meta)
              // For simplicity: keep block as DOOR, just mark as not-solid
            } else {
              meta[idx(x, y, z)] &= ~2;
            }
            meshRebuildNeeded = true;
          }
        }
      }
    }
  }
}
function hasPowerNear(x, y, z) {
  // Check adjacent + same column for power source
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) > 1) continue;
        const xx = x + dx, yy = y + dy, zz = z + dz;
        if (!inBounds(xx, yy, zz)) continue;
        const nb = getBlock(xx, yy, zz);
        const nm = meta[idx(xx, yy, zz)];
        if (nb === B.LEVER && (nm & 4) !== 0) return true;
        if (nb === B.PRESSURE_PLATE) {
          // check if player is on it
          const px = Math.floor(player.x), pz = Math.floor(player.z);
          const py = Math.floor(player.y);
          if (px === xx && pz === zz && (py === yy + 1 || py === yy)) return true;
        }
      }
    }
  }
  return false;
}

// Handle right-click on special blocks
function interactBlock() {
  const r = raycast();
  if (!r) return;
  const b = getBlock(r.x, r.y, r.z);
  if (b === B.CHEST) {
    openChest(r.x, r.y, r.z);
    return;
  }
  if (b === B.CRAFTING_TABLE) {
    openCraftTable();
    return;
  }
  if (b === B.LEVER) {
    const m = meta[idx(r.x, r.y, r.z)];
    if (m & 4) {
      meta[idx(r.x, r.y, r.z)] &= ~4;
      toast('🔧 คาน: ปิด');
    } else {
      meta[idx(r.x, r.y, r.z)] |= 4;
      toast('🔧 คาน: เปิด');
    }
    playSound('lever');
    meshRebuildNeeded = true;
  } else if (b === B.PRESSURE_PLATE) {
    // toggle
    meta[idx(r.x, r.y, r.z)] ^= 4;
    playSound('click');
    toast('🟨 แผ่นเหยียบ');
  } else if (b === B.CRAFTING_TABLE) {
    openCrafting();
  }
}

// ======================================================================
// MODAL HELPERS
// ======================================================================
let invOpen = false, craftOpen = false;
function openInventory() {
  invOpen = true;
  document.getElementById('inv-modal').classList.add('show');
  unlockPointer();
  updateInventoryUI();
}
function closeInventory() {
  invOpen = false;
  document.getElementById('inv-modal').classList.remove('show');
  // Re-lock pointer so gameplay keys work
  lockPointer();
}
function openCrafting() {
  craftOpen = true;
  document.getElementById('craft-modal').classList.add('show');
  unlockPointer();
  buildCraftUI();
}
function closeCrafting() {
  craftOpen = false;
  document.getElementById('craft-modal').classList.remove('show');
  if (typeof mouseLocked !== 'undefined' && mouseLocked) lockPointer();
}

// ======================================================================
// 3x3 CRAFTING TABLE
// ======================================================================
let ctGrid = new Array(9).fill(null); // 9 slots
let ctOpen = false;
function openCraftTable() {
  ctOpen = true;
  document.getElementById('craft-table-modal').classList.add('show');
  unlockPointer();
  renderCraftTable();
}
function closeCraftTable() {
  ctOpen = false;
  document.getElementById('craft-table-modal').classList.remove('show');
  // Return items to inventory
  for (const item of ctGrid) {
    if (item) addToInventory(item.name, item.count);
  }
  ctGrid = new Array(9).fill(null);
  if (typeof mouseLocked !== 'undefined' && mouseLocked) lockPointer();
}
function renderCraftTable() {
  const grid = document.getElementById('ct-input-grid');
  grid.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const slot = document.createElement('div');
    slot.className = 'ct-slot' + (ctGrid[i] ? ' has-item' : '');
    slot.dataset.idx = i;
    if (ctGrid[i]) {
      const ic = document.createElement('canvas');
      ic.width = 48; ic.height = 48;
      drawItemIcon(ic.getContext('2d'), ctGrid[i].name, 0, 0, 48);
      slot.appendChild(ic);
      const cnt = document.createElement('div');
      cnt.className = 'item-count';
      cnt.textContent = 'x' + ctGrid[i].count;
      slot.appendChild(cnt);
    }
    slot.addEventListener('click', () => ctSlotClick(i));
    slot.addEventListener('contextmenu', (e) => { e.preventDefault(); ctSlotClick(i, true); });
    grid.appendChild(slot);
  }
  // Calculate output
  const outputSlot = document.getElementById('ct-output-slot');
  const recipe = matchCraftTableRecipe();
  outputSlot.innerHTML = '';
  if (recipe) {
    const ic = document.createElement('canvas');
    ic.width = 48; ic.height = 48;
    drawItemIcon(ic.getContext('2d'), recipe.result.name, 0, 0, 48);
    outputSlot.appendChild(ic);
    const cnt = document.createElement('div');
    cnt.className = 'item-count';
    cnt.textContent = 'x' + recipe.result.count;
    outputSlot.appendChild(cnt);
    outputSlot.style.cursor = 'pointer';
    outputSlot.style.borderColor = '#7cda24';
    outputSlot.onclick = () => craftTableOutput(recipe);
  } else {
    outputSlot.style.cursor = 'default';
    outputSlot.style.borderColor = '#fbbf24';
  }
}
function ctSlotClick(idx, isRight = false) {
  if (isRight) {
    // Remove 1 from slot
    if (ctGrid[idx]) {
      ctGrid[idx].count--;
      addToInventory(ctGrid[idx].name, 1);
      if (ctGrid[idx].count <= 0) ctGrid[idx] = null;
    }
  } else {
    // Take from inventory (first stackable)
    const invItem = inventory.find(it => it.count > 0);
    if (invItem) {
      if (ctGrid[idx] && ctGrid[idx].name === invItem.name) {
        ctGrid[idx].count++;
      } else if (!ctGrid[idx]) {
        ctGrid[idx] = { name: invItem.name, count: 1 };
      } else {
        return; // slot has different item
      }
      removeFromInventory(invItem.name, 1);
    }
  }
  renderCraftTable();
  updateInventoryUI();
}
function matchCraftTableRecipe() {
  // 3x3 pattern match: shape is a 3x3 array of {item, count}
  for (const r of getRecipes()) {
    if (!r.needTable) continue;
    if (!r.shape) continue; // skip recipes without 3x3 shape
    // Check if grid matches shape
    let matches = true;
    for (let i = 0; i < 9; i++) {
      const cell = r.shape[i]; // {item, count} or null
      const cur = ctGrid[i];
      if (cell) {
        if (!cur || cur.name !== cell.item || cur.count < cell.count) { matches = false; break; }
      } else {
        if (cur) { matches = false; break; }
      }
    }
    if (matches) return r;
  }
  return null;
}
function craftTableOutput(recipe) {
  // Consume 1 of each from grid
  for (let i = 0; i < 9; i++) {
    if (ctGrid[i] && recipe.shape[i]) {
      ctGrid[i].count -= recipe.shape[i].count;
      if (ctGrid[i].count <= 0) ctGrid[i] = null;
    }
  }
  // Add result
  addToInventory(recipe.result.name, recipe.result.count);
  toast('✅ คราฟต์ ' + recipe.name + ' สำเร็จ');
  renderCraftTable();
  updateInventoryUI();
}
function clearCraftTable() {
  for (const item of ctGrid) {
    if (item) addToInventory(item.name, item.count);
  }
  ctGrid = new Array(9).fill(null);
  renderCraftTable();
}
document.getElementById('ct-clear')?.addEventListener('click', clearCraftTable);
document.getElementById('craft-table-close')?.addEventListener('click', closeCraftTable);

// ======================================================================
// CHEST
// ======================================================================
let openChestRef = null; // currently open chest
let chestOpen = false;
function openChest(x, y, z) {
  const ch = getChest(x, y, z);
  openChestRef = ch;
  chestOpen = true;
  document.getElementById('chest-modal').classList.add('show');
  document.getElementById('chest-modal').dataset.cx = x;
  document.getElementById('chest-modal').dataset.cy = y;
  document.getElementById('chest-modal').dataset.cz = z;
  unlockPointer();
  renderChest();
}
function closeChest() {
  // Items STAY in the chest — it persists via saveGame (v3) and MP world sync.
  // (The old behavior dumped everything back to the inventory and wiped the
  // chest on close, which made chests pointless in single-player.)
  chestOpen = false;
  openChestRef = null;
  document.getElementById('chest-modal').classList.remove('show');
  if (typeof mouseLocked !== 'undefined' && mouseLocked) lockPointer();
}
function renderChest() {
  const grid = document.getElementById('chest-grid');
  grid.innerHTML = '';
  for (let i = 0; i < 27; i++) {
    const slot = document.createElement('div');
    slot.className = 'chest-slot' + (openChestRef.items[i] ? ' has-item' : '');
    slot.dataset.idx = i;
    if (openChestRef.items[i]) {
      const ic = document.createElement('canvas');
      ic.width = 44; ic.height = 44;
      drawItemIcon(ic.getContext('2d'), openChestRef.items[i].name, 0, 0, 44);
      slot.appendChild(ic);
      const cnt = document.createElement('div');
      cnt.className = 'item-count';
      cnt.textContent = 'x' + openChestRef.items[i].count;
      slot.appendChild(cnt);
    }
    slot.addEventListener('click', () => chestSlotClick(i));
    slot.addEventListener('contextmenu', (e) => { e.preventDefault(); chestSlotClick(i, true); });
    grid.appendChild(slot);
  }
}
function chestSlotClick(idx, isRight = false) {
  if (!openChestRef) return;
  if (isRight) {
    if (openChestRef.items[idx]) {
      openChestRef.items[idx].count--;
      addToInventory(openChestRef.items[idx].name, 1);
      if (openChestRef.items[idx].count <= 0) openChestRef.items[idx] = null;
    }
  } else {
    const invItem = inventory.find(it => it.count > 0);
    if (invItem) {
      if (openChestRef.items[idx] && openChestRef.items[idx].name === invItem.name) {
        openChestRef.items[idx].count++;
      } else if (!openChestRef.items[idx]) {
        openChestRef.items[idx] = { name: invItem.name, count: 1 };
      } else return;
      removeFromInventory(invItem.name, 1);
    }
  }
  renderChest();
  updateInventoryUI();
  // Broadcast chest update to other players in MP (any player — server
  // accepts chest edits from guests, not just the host)
  if (mp.connected && mp.roomCode) {
    sendMP({ type: 'chest_update', x: openChestRef.x, y: openChestRef.y, z: openChestRef.z, items: openChestRef.items });
  }
}
document.getElementById('chest-close')?.addEventListener('click', closeChest);

// ======================================================================
// BLOCK BREAK REWARDS (drop items)
// ======================================================================
const BLOCK_DROPS = {
  [B.STONE]: { name: 'block:' + B.COBBLE, count: 1 },
  [B.COBBLE]: { name: 'block:' + B.COBBLE, count: 1 },
  [B.GRASS]: { name: 'block:' + B.DIRT, count: 1 },
  [B.DIRT]: { name: 'block:' + B.DIRT, count: 1 },
  [B.SAND]: { name: 'block:' + B.SAND, count: 1 },
  [B.WOOD]: { name: 'block:' + B.WOOD, count: 1 },
  [B.LEAVES]: { name: 'block:' + B.SAPLING, count: 1, chance: 0.15 },
  [B.SNOW]: { name: null }, // drops nothing (shovel)
  [B.ORE_COAL]: { name: 'coal', count: 1 },
  [B.ORE_IRON]: { name: 'iron_ingot', count: 1 },
  [B.ORE_GOLD]: { name: 'gold_ingot', count: 1 },
  [B.ORE_DIAMOND]: { name: 'diamond', count: 1 },
  [B.PUMPKIN]: { name: 'block:' + B.PUMPKIN, count: 1 },
};

function dropBlock(blockType) {
  const drop = BLOCK_DROPS[blockType];
  if (!drop) return;
  if (drop.chance && Math.random() > drop.chance) return;
  if (!drop.name) return;
  addToInventory(drop.name, drop.count || 1);
  if (blockType === B.ORE_DIAMOND) {
    stats.diamondsFound++;
    awardAchievement('diamond_finder');
  }
}

const SOUND_BLOCKS = {
  [B.STONE]: 'break', [B.COBBLE]: 'break', [B.BEDROCK]: 'break',
  [B.DIRT]: 'break', [B.SAND]: 'break', [B.SNOW]: 'break',
  [B.GRASS]: 'break', [B.SANDSTONE]: 'break', [B.ICE]: 'break',
  [B.WOOD]: 'break', [B.PLANKS]: 'break', [B.BRICK]: 'break',
  [B.LEAVES]: 'break',
  [B.ORE_COAL]: 'break', [B.ORE_IRON]: 'break', [B.ORE_GOLD]: 'break', [B.ORE_DIAMOND]: 'break',
  [B.GLASS]: 'break', [B.PUMPKIN]: 'break',
};

const PLACE_SOUND = {
  [B.STONE]: 'place', [B.COBBLE]: 'place', [B.DIRT]: 'place', [B.SAND]: 'place',
  [B.WOOD]: 'place', [B.PLANKS]: 'place', [B.BRICK]: 'place', [B.GRASS]: 'place',
  [B.SANDSTONE]: 'place', [B.SNOW]: 'place', [B.ICE]: 'place', [B.LEAVES]: 'place',
  [B.BEDROCK]: 'place', [B.PUMPKIN]: 'place',
  [B.GLASS]: 'place', [B.CACTUS]: 'place',
  [B.ORE_COAL]: 'place', [B.ORE_IRON]: 'place', [B.ORE_GOLD]: 'place', [B.ORE_DIAMOND]: 'place',
  [B.GLOWSTONE]: 'place', [B.CRAFTING_TABLE]: 'place',
  [B.LEVER]: 'place', [B.PRESSURE_PLATE]: 'place', [B.TORCH]: 'place',
  [B.DOOR]: 'door',
};

// ======================================================================
// UPDATED PLAYER + INPUT
// ======================================================================
// Player now has hp (already in original) and hunger
player.hp = CFG.MAX_HP;
player.spawnX = 24; player.spawnZ = 24;

// Footstep tracker
let lastStepTime = 0;
function tryStepSound(dt) {
  if (player.flyMode || !player.onGround) return;
  const speed = Math.abs(player.vx) + Math.abs(player.vz);
  if (speed < 0.5) return;
  const now = performance.now() / 1000;
  if (now - lastStepTime > 0.45) {
    lastStepTime = now;
    playSound('step');
  }
}

// Update player to handle HP + fall damage
// (we'll modify updatePlayer later)

// ======================================================================
// KEY HANDLERS (E for inventory, C for craft, M for minimap, B for achievements, T for redstone interact)
// ======================================================================
document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyE' && mouseLocked) {
    e.preventDefault();
    openInventory();
  }
  if (e.code === 'KeyC' && mouseLocked) {
    e.preventDefault();
    openCrafting();
  }
  if (e.code === 'KeyT' && mouseLocked) {
    e.preventDefault();
    interactBlock();
  }
  if (e.code === 'KeyM' && mouseLocked) {
    e.preventDefault();
    minimapMode = (minimapMode + 1) % 2;
    toast('🗺 แผนที่: ' + (minimapMode === 0 ? 'มุมบน' : 'มุมเฉียง'));
  }
  if (e.code === 'KeyB' && mouseLocked) {
    e.preventDefault();
    showAchievements();
  }
  // (H-key debug heal removed — it was a leftover cheat in production)
});

// Achievement viewer
function showAchievements() {
  const panel = document.createElement('div');
  panel.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,.9);z-index:130;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px)';
  let html = '<div style="background:rgba(20,20,30,.95);border:2px solid var(--accent2);border-radius:10px;padding:20px;max-width:500px;width:90%;max-height:80vh;overflow-y:auto"><button class="inv-close" id="ach-close">✕</button><h2 style="color:var(--accent2);margin:0 0 14px">🏆 ความสำเร็จ (' + unlockedAch.size + '/' + ACHIEVEMENTS.length + ')</h2>';
  for (const a of ACHIEVEMENTS) {
    const done = unlockedAch.has(a.id);
    html += `<div style="padding:8px;margin:4px 0;background:rgba(60,60,80,${done ? '.4' : '.15'});border-radius:4px;border-left:3px solid ${done ? 'var(--accent)' : '#666'};opacity:${done ? '1' : '.6'}">
      <div style="font-weight:700;color:${done ? 'var(--accent)' : '#888'}">${done ? '✅' : '🔒'} ${a.name}</div>
      <div style="font-size:11px;color:var(--muted)">${a.desc}</div>
    </div>`;
  }
  html += '</div>';
  panel.innerHTML = html;
  document.body.appendChild(panel);
  document.getElementById('ach-close').addEventListener('click', () => {
    document.body.removeChild(panel);
    lockPointer();
  });
  panel.addEventListener('click', e => { if (e.target === panel) { document.body.removeChild(panel); lockPointer(); }});
  unlockPointer();
}

// Modal close handlers
document.getElementById('inv-close').addEventListener('click', closeInventory);
document.getElementById('craft-close').addEventListener('click', closeCrafting);
document.getElementById('inv-modal').addEventListener('click', e => { if (e.target.id === 'inv-modal') closeInventory(); });
document.getElementById('craft-modal').addEventListener('click', e => { if (e.target.id === 'craft-modal') closeCrafting(); });

// ======================================================================
// MOB RENDERING (3D boxes via the solid-color shader)
// ======================================================================
// Mobs used to be minimap-only — hostiles could chase and hit you while
// invisible. Each mob type renders as a lit box sized to its definition.
const _mobMeshCache = new Map();
function renderMobs() {
  if (mobs.length === 0) return;
  for (const m of mobs) {
    const def = MOB_TYPES[m.type];
    if (!def) continue;
    let cached = _mobMeshCache.get(m.type);
    if (!cached) {
      cached = { meshData: { color: def.color, vertices: makeBoxVerts(def.w, def.h) } };
      cached.glBuf = createGlBufferFor(cached.meshData);
      _mobMeshCache.set(m.type, cached);
    }
    const mvp = mat4Mult(getCurrentProjView(), mat4Translate(m.x - m.w / 2, m.y, m.z - m.w / 2));
    drawPlayerMesh(cached.glBuf, cached.meshData, mvp);
  }
}

// ======================================================================
// PARTICLES (block-break juice — also the addParticles() the agent's
// breakFront() has been calling all along; it used to not exist, which
// crashed bot scripts on the first block break)
// ======================================================================
const particles = []; // {x,y,z, vx,vy,vz, life, meshData}
let _particleVerts = null, _particleGlBuf = null;
function addParticles(x, y, z, colorHex, count = 8) {
  const hex = /^#[0-9a-fA-F]{6}$/.test(String(colorHex || '')) ? colorHex : '#cccccc';
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  for (let i = 0; i < count; i++) {
    if (particles.length >= 200) particles.shift();
    particles.push({
      x, y, z,
      vx: (Math.random() - 0.5) * 3.5,
      vy: Math.random() * 4 + 1.5,
      vz: (Math.random() - 0.5) * 3.5,
      life: 0.5 + Math.random() * 0.5,
      meshData: { color: [r, g, b], vertices: null }, // filled lazily in render
    });
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.vy += CFG.GRAVITY * 0.6 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}
function renderParticles() {
  if (particles.length === 0) return;
  if (!_particleVerts) {
    _particleVerts = makeBoxVerts(0.14, 0.14);
    _particleGlBuf = createGlBufferFor({ vertices: _particleVerts });
  }
  const pv = getCurrentProjView();
  for (const p of particles) {
    if (!p.meshData.vertices) p.meshData.vertices = _particleVerts;
    const mvp = mat4Mult(pv, mat4Translate(p.x - 0.07, p.y, p.z - 0.07));
    drawPlayerMesh(_particleGlBuf, p.meshData, mvp);
  }
}

// Init stats
initStats();
initAudio(); // might fail if no user gesture yet

// Init HUD
updateHPUI();
updateHungerUI();
updateTimeUI();
updateInventoryUI();

// Spawn initial mobs after world gen
spawnMobs();

// NOTE: breakBlock/placeBlock are finalized (with MP broadcast) in the
// MULTIPLAYER section below — no intermediate overrides needed anymore.

// Shift+right-click = interact with special blocks (lever, crafting table)
canvas.addEventListener('mousedown', (e) => {
  if (!mouseLocked) return;
  if (e.button === 2 && e.shiftKey) {
    interactBlock();
    e.stopPropagation();
    e.preventDefault();
  }
}, true); // capture phase, run before main handler

// Update start screen to show new features
document.querySelector('#start-screen .sub').textContent = '⛏ MiniCraft 3D — เล่นเดี่ยวออฟไลน์ได้ ไม่ต้องใช้เน็ต • ออนไลน์เล่นกับเพื่อนได้สูงสุด 8 คน (ต้องเปิดผ่าน http://103.253.75.161:3109/)';
// Add additional rows for new features
const startPanel = document.querySelector('#start-screen .panel');
if (startPanel) {
  const extra = document.createElement('div');
  extra.className = 'panel';
  extra.innerHTML = `
    <h3>🎮 ฟีเจอร์เพิ่มเติม</h3>
    <div class="row"><span>คลังของ</span><span class="key">E</span></div>
    <div class="row"><span>คราฟต์</span><span class="key">C</span></div>
    <div class="row"><span>ใช้ของ (คาน/โต๊ะ)</span><span class="key">Shift+คลิกขวา</span></div>
    <div class="row"><span>ดูความสำเร็จ</span><span class="key">B</span></div>
    <div class="row"><span>สลับโหมดแผนที่</span><span class="key">M</span></div>
    <div class="row"><span>รันสคริปต์บอท</span><span class="key">/คำสั่ง ในแชท</span></div>
  `;
  startPanel.parentNode.insertBefore(extra, startPanel.nextSibling);
}

// Add to "how to play" panel: jump + step sounds mention
const howPanel = document.querySelectorAll('#start-screen .panel')[0];
if (howPanel) {
  const extra = document.createElement('div');
  extra.style.cssText = 'margin-top:8px;font-size:11px;color:#666;text-align:center';
  extra.textContent = '🟢 เริ่มใหม่ • 📂 โหลดเซฟ • โหมดบิน F • เก็บเซฟอัตโนมัติ';
  howPanel.appendChild(extra);
}

