'use strict';

// ======================================================================
// CONFIG
// ======================================================================
const CFG = {
  WORLD_W: 64,
  WORLD_D: 64,
  WORLD_H: 36,
  SEA_LEVEL: 12,
  GRAVITY: -28,
  JUMP_VEL: 9.5,
  WALK_SPEED: 4.8,
  RUN_SPEED: 8.2,
  FLY_SPEED: 12,
  PLAYER_W: 0.6,
  PLAYER_H: 1.75,
  PLAYER_EYE: 1.55,
  REACH: 6.0,
  ATLAS: 8,        // 8 cols x 5 rows = 40 textures
  ATLAS_H: 5,      // height in tiles
  TILE: 16,        // each tile 16x16
  MOUSE_SENS: 0.0022,
  // Tier 1: day/night
  DAY_LENGTH_SEC: 600,         // 10 minutes per full day
  NIGHT_START: 0.5,            // fraction of day when night begins
  NIGHT_END: 0.85,             // fraction of day when night ends
  // Tier 1: survival
  MAX_HP: 20,
  FALL_DAMAGE_THRESHOLD: 4,    // blocks fallen before damage
  HUNGER_DECAY: 1 / 1200,      // hunger bar / sec
  STARVE_DAMAGE: 1,            // hp/sec when starving
  MOB_HOSTILE_DAMAGE: 1,       // hp per hit
  // Tier 1: mob
  MAX_MOBS: 30,
  MOB_SPAWN_RADIUS: 20,
  MOB_DESPAWN_RADIUS: 40,
  MOB_AGGRO_RADIUS: 12,
  MOB_DAMAGE_COOLDOWN: 1.0,    // sec between hits
  // Tier 3: redstone
  POWER_RANGE: 8,
};

// Forward declarations for new systems (avoids TDZ errors from later init code)
let hunger = 20;
const MAX_HUNGER = 20;
let gameTime = 6000;
let mobs = [];
let inventory = [];
let unlockedAch = new Set();
const stats = {
  stepsWalked: 0, blocksPlaced: 0, blocksBroken: {},
  nightsSurvived: 0, crafted: 0, maxDistance: 0,
  mobsKilled: 0, diamondsFound: 0, doorsPlaced: 0,
  spawnX: 24, spawnZ: 24, lastWasNight: false,
};
// MOB_TYPES, ITEMS, RECIPES, ACHIEVEMENTS forward-declared (defined later, used by init)
const MOB_TYPES = {
  pig:    { hp: 10, w: 0.9, h: 0.9, hostile: false, color: [0.9, 0.7, 0.7], drops: 'pork' },
  cow:    { hp: 12, w: 0.9, h: 1.0, hostile: false, color: [0.4, 0.25, 0.15], drops: 'leather' },
  zombie: { hp: 16, w: 0.6, h: 1.85, hostile: true, color: [0.3, 0.55, 0.3], drops: 'rotten_flesh' },
  creeper:{ hp: 14, w: 0.6, h: 1.7, hostile: true, color: [0.3, 0.7, 0.3], drops: 'gunpowder' },
};

// Block IDs (16 base + 16 expansion = 32 total in 8x4 atlas)
const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4,
  WOOD: 5, LEAVES: 6, PLANKS: 7, COBBLE: 8,
  BEDROCK: 9, SNOW: 10, BRICK: 11, PUMPKIN: 12,
  WATER: 13,
  // Tier 1 additions
  GLASS: 14, TORCH: 15, DOOR: 16, CACTUS: 17,
  SANDSTONE: 18, ICE: 19, ORE_COAL: 20, ORE_IRON: 21,
  ORE_GOLD: 22, ORE_DIAMOND: 23, GLOWSTONE: 24, CRAFTING_TABLE: 25,
  LEVER: 26, PRESSURE_PLATE: 27, FLOWER: 28, SAPLING: 29,
  // Tier 2 additions
  CHEST: 30, FURNACE: 31
};

const TRANSPARENT = new Set([B.AIR, B.WATER, B.LEAVES, B.GLASS, B.FLOWER, B.SAPLING, B.ICE, B.TORCH]);

// Atlas is 8x4 = 32 tiles (16 base + 16 new). Each tile still 16x16 = 128x64 atlas
const ATLAS_W = CFG.ATLAS, ATLAS_H = CFG.ATLAS_H;

// Atlas tile index for each block face
// [top, side, bottom]
const FACE_TEX = {
  [B.GRASS]:    [1, 0, 2],
  [B.DIRT]:     [2, 2, 2],
  [B.STONE]:    [3, 3, 3],
  [B.SAND]:     [4, 4, 4],
  [B.WOOD]:     [5, 5, 5],
  [B.LEAVES]:   [7, 7, 7],
  [B.PLANKS]:   [8, 8, 8],
  [B.COBBLE]:   [9, 9, 9],
  [B.BEDROCK]:  [10, 10, 10],
  [B.SNOW]:     [11, 11, 11],
  [B.BRICK]:    [12, 12, 12],
  [B.PUMPKIN]:  [13, 14, 13],
  [B.WATER]:    [15, 15, 15],
  [B.GLASS]:    [16, 16, 16],
  [B.TORCH]:    [17, 17, 17],
  [B.DOOR]:     [19, 18, 19],
  [B.CACTUS]:   [20, 20, 20],
  [B.SANDSTONE]:[21, 21, 21],
  [B.ICE]:      [22, 22, 22],
  [B.ORE_COAL]: [3, 23, 3],
  [B.ORE_IRON]: [3, 24, 3],
  [B.ORE_GOLD]: [3, 25, 3],
  [B.ORE_DIAMOND]:[3, 26, 3],
  [B.GLOWSTONE]:[27, 27, 27],
  [B.CRAFTING_TABLE]:[28, 29, 28],
  [B.LEVER]:    [30, 30, 30],
  [B.PRESSURE_PLATE]:[31, 31, 31],
  [B.FLOWER]:   [6, 6, 6],
  [B.SAPLING]:  [6, 6, 6],
  // Atlas row 4 (indexes 32-39)
  [B.CHEST]:    [33, 32, 34],   // top, side, bottom (different for visual variety)
  [B.FURNACE]:  [36, 35, 37],   // top, side (furnace front), bottom
};

const BLOCK_NAMES = {
  [B.GRASS]:'หญ้า', [B.DIRT]:'ดิน', [B.STONE]:'หิน', [B.SAND]:'ทราย',
  [B.WOOD]:'ไม้', [B.LEAVES]:'ใบไม้', [B.PLANKS]:'ไม้แปรรูป', [B.COBBLE]:'หินก่อ',
  [B.BEDROCK]:'หินฐาน', [B.SNOW]:'หิมะ', [B.BRICK]:'อิฐ', [B.PUMPKIN]:'ฟักทอง',
  [B.WATER]:'น้ำ', [B.GLASS]:'กระจก', [B.TORCH]:'คบไฟ', [B.DOOR]:'ประตู',
  [B.CACTUS]:'กระบองเพชร', [B.SANDSTONE]:'หินทราย', [B.ICE]:'น้ำแข็ง',
  [B.ORE_COAL]:'แร่ถ่าน', [B.ORE_IRON]:'แร่เหล็ก', [B.ORE_GOLD]:'แร่ทอง',
  [B.ORE_DIAMOND]:'แร่เพชร', [B.GLOWSTONE]:'หินเรืองแสง', [B.CRAFTING_TABLE]:'โต๊ะคราฟต์',
  [B.LEVER]:'คาน', [B.PRESSURE_PLATE]:'แผ่นเหยียบ',
  [B.FLOWER]:'ดอกไม้', [B.SAPLING]:'ต้นกล้า',
  [B.CHEST]:'หีบ', [B.FURNACE]:'เตา'
};

// Hotbar order (also the creative palette shown when fly mode is enabled)
const HOTBAR = [B.GRASS, B.DIRT, B.STONE, B.SAND, B.WOOD, B.PLANKS, B.COBBLE, B.BRICK];
// Hand slots: what the player actually holds. Each slot holds an item name
// ('block:8', 'stone_sword', 'bread', ...) or null. The hotbar UI renders
// from this array; placing consumes the item unless fly (creative) is on.
let handSlots = new Array(8).fill(null);

// ======================================================================
// SAVE SYSTEM
// ======================================================================
const SAVE_KEY = 'minicraft3d_v1';
let currentSeed = Date.now() & 0x7fffffff;
let dirty = false;

function saveGame() {
  // Never auto-persist while inside an MP room — that world belongs to the host's
  // room; writing it here would overwrite the player's own single-player save.
  // (try/catch: saveGame may be reached before `mp` is initialized)
  try { if (mp && mp.connected && mp.roomCode) return; } catch (e) {}
  try {
    // Chest contents travel with the save (key "x_y_z" -> 27 slots)
    const chestData = {};
    for (const [k, ch] of chests.entries()) {
      if (ch.items && ch.items.some(it => it !== null)) chestData[k] = ch.items;
    }
    const data = {
      v: 3,  // save version (3 = RLE/base64 world+meta + chests)
      seed: currentSeed,
      px: player.x, py: player.y, pz: player.z,
      yaw: player.yaw, pitch: player.pitch,
      fly: player.flyMode,
      hp: player.hp,
      worldB64: rleEncodeU8(world),
      metaB64: rleEncodeU8(meta),
      chests: chestData,
      sel: selectedSlot,
      hand: handSlots,
      inv: inventory,
      hung: hunger,
      time: gameTime,
      ach: Array.from(unlockedAch),
      stat: {
        steps: stats.stepsWalked,
        placed: stats.blocksPlaced,
        broken: stats.blocksBroken,
        nights: stats.nightsSurvived,
        crafted: stats.crafted,
        maxDist: stats.maxDistance,
        mobs: stats.mobsKilled,
        dia: stats.diamondsFound,
        doors: stats.doorsPlaced,
      },
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch(e) { toast('❌ บันทึกไม่ได้: ' + e.message); }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch(e) { return null; }
}

function hasSave() { return !!localStorage.getItem(SAVE_KEY); }

// Compact save encoding: run-length encode a Uint8Array, then base64.
// The old format stored every block as a JSON number (~300KB per save);
// RLE+base64 typically shrinks world+meta to a small fraction of that.
function rleEncodeU8(arr) {
  const out = [];
  let i = 0;
  while (i < arr.length) {
    const v = arr[i];
    let run = 1;
    while (i + run < arr.length && arr[i + run] === v && run < 65535) run++;
    out.push(run & 255, (run >> 8) & 255, v);
    i += run;
  }
  let s = '';
  for (let j = 0; j < out.length; j += 8192) {
    s += String.fromCharCode.apply(null, out.slice(j, j + 8192));
  }
  return btoa(s);
}
function rleDecodeU8(b64, target) {
  try {
    const s = atob(b64);
    let o = 0;
    for (let i = 0; i + 2 < s.length; i += 3) {
      const run = s.charCodeAt(i) | (s.charCodeAt(i + 1) << 8);
      const v = s.charCodeAt(i + 2);
      for (let r = 0; r < run && o < target.length; r++) target[o++] = v;
    }
    return o === target.length;
  } catch (e) { return false; }
}

