// ======================================================================
// WORLD GENERATION
// ======================================================================
const W = CFG.WORLD_W, D = CFG.WORLD_D, H = CFG.WORLD_H;
const world = new Uint8Array(W * D * H);
const meta = new Uint8Array(W * D * H); // light, etc.

function idx(x, y, z) { return x + y*W + z*W*D; }
function inBounds(x, y, z) { return x>=0 && x<W && y>=0 && y<H && z>=0 && z<D; }

// Chest inventories: chestKey (x_y_z) -> {items: [{name, count} x 27], viewers: [playerId]}
const chests = new Map();
function chestKey(x, y, z) { return x + '_' + y + '_' + z; }
function getChest(x, y, z) {
  const k = chestKey(x, y, z);
  if (!chests.has(k)) {
    chests.set(k, { items: new Array(27).fill(null), x, y, z });
  }
  return chests.get(k);
}
function getChestByKey(k) {
  if (!chests.has(k)) {
    const [x, y, z] = k.split('_').map(Number);
    chests.set(k, { items: new Array(27).fill(null), x, y, z });
  }
  return chests.get(k);
}
function getBlock(x, y, z) {
  if (!inBounds(x, y, z)) return B.AIR;
  return world[idx(x, y, z)];
}
function setBlock(x, y, z, t) {
  if (!inBounds(x, y, z)) return;
  world[idx(x, y, z)] = t;
  markChunkDirty(x, z); // per-chunk remesh (defined in the MESH BUILDING section)
}

function vnoise2(x, y, salt) {
  let n = ((x|0) * 374761393 + (y|0) * 668265263 + salt * 1610612741) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 0xffffffff;
}
function smooth2(x, y, salt) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf*xf*(3-2*xf), v = yf*yf*(3-2*yf);
  const a = vnoise2(xi, yi, salt), b = vnoise2(xi+1, yi, salt);
  const c2 = vnoise2(xi, yi+1, salt), d = vnoise2(xi+1, yi+1, salt);
  return a + (b-a)*u + (c2-a)*v + (a-b-c2+d)*u*v;
}
function fbm(x, y, octaves, salt) {
  let amp = 1, freq = 1, sum = 0, max = 0;
  for (let i = 0; i < octaves; i++) {
    sum += smooth2(x*freq, y*freq, salt+i) * amp;
    max += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / max;
}

function generateWorld(seed) {
  currentSeed = seed;
  world.fill(0);
  meta.fill(0);
  // meta: 0=default, bit 0=powered (redstone), bit 1=door-open, bit 2=lever-on
  biomeMap = new Uint8Array(W * D); // 0=plains, 1=forest, 2=desert, 3=snow, 4=mountain, 5=ocean

  const S = seed;
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      // Base terrain height - allow lower areas (below sea level) and higher hills
      const h1 = fbm(x*0.06, z*0.06, 4, S) * 22 + 4;  // range ~4-26
      const h2 = fbm(x*0.18, z*0.18, 2, S+99) * 3;
      let height = Math.floor(h1 + h2);
      height = Math.max(1, Math.min(H-6, height));

      // Temperature/moisture for biome
      const temp = fbm(x*0.04, z*0.04, 2, S+777);
      const moisture = fbm(x*0.05, z*0.05, 2, S+1234);

      // Determine biome
      let biome = 0; // plains
      if (height < CFG.SEA_LEVEL + 1) biome = 5; // ocean
      else if (height > 22 && temp < 0.5) biome = 4; // mountain
      else if (temp < 0.3) biome = 3; // snow
      else if (temp > 0.7 && moisture < 0.4) biome = 2; // desert
      else if (moisture > 0.65) biome = 1; // forest
      biomeMap[x + z*W] = biome;

      for (let y = 0; y < H; y++) {
        let b = B.AIR;
        if (y === 0) b = B.BEDROCK;
        else if (y < height - 4) {
          b = B.STONE;
          // Ores in stone layer
          if (y >= 2 && y < height - 5) {
            const oreR = vnoise2(x, y*3 + z, S+8888);
            if (oreR > 0.985) b = B.ORE_DIAMOND;
            else if (oreR > 0.965) b = B.ORE_GOLD;
            else if (oreR > 0.94) b = B.ORE_IRON;
            else if (oreR > 0.91) b = B.ORE_COAL;
          }
        }
        else if (y < height - 1) {
          // near surface
          if (y < CFG.SEA_LEVEL - 1) b = B.SAND;
          else b = B.DIRT;
        }
        else if (y === height - 1) {
          // surface block - biome dependent
          if (height <= CFG.SEA_LEVEL + 1) b = B.SAND;
          else if (biome === 3) b = B.SNOW;  // snow
          else if (biome === 2) b = B.SAND;  // desert surface
          else if (biome === 4 && y > 20) b = B.STONE; // mountain top
          else b = B.GRASS;
        }
        // Fill water from terrain up to sea level
        else if (y > height - 1 && y <= CFG.SEA_LEVEL) {
          b = B.WATER;
          // ice on top in snow biome
          if (biome === 3 && y === CFG.SEA_LEVEL) b = B.ICE;
        }
        world[idx(x, y, z)] = b;
      }
    }
  }

  // Decorate: trees, cacti, etc. based on biome
  for (let z = 2; z < D-2; z++) {
    for (let x = 2; x < W-2; x++) {
      const biome = biomeMap[x + z*W];
      for (let y = H-1; y > 0; y--) {
        const surface = getBlock(x, y, z);
        if (surface === B.AIR) continue;
        if (surface === B.GRASS) {
          const treeR = vnoise2(x*1.7, z*1.7, S+5000);
          if (biome === 1 && treeR > 0.92) plantTree(x, y+1, z);  // forest = dense
          else if (biome === 0 && treeR > 0.985) plantTree(x, y+1, z);  // plains = sparse
        }
        if (surface === B.SAND && biome === 2 && y > CFG.SEA_LEVEL + 1) {
          // desert cactus
          const cacR = vnoise2(x*2.1, z*2.1, S+6000);
          if (cacR > 0.985) plantCactus(x, y+1, z);
        }
        break;
      }
    }
  }

  // Generate structures
  generateStructures(S);
}

function plantCactus(x, y, z) {
  const h = 2 + ((vnoise2(x, z, 200) * 2) | 0);
  for (let i = 0; i < h; i++) {
    if (inBounds(x, y+i, z)) setBlock(x, y+i, z, B.CACTUS);
  }
}

let biomeMap = new Uint8Array(1);

function generateStructures(S) {
  // Villages - place 2-3 small houses
  const houseCount = 2 + (S % 2);
  for (let h = 0; h < houseCount; h++) {
    const hx = 8 + ((S * (h+1) * 7) % (W - 16));
    const hz = 8 + ((S * (h+1) * 11) % (D - 16));
    // find grass surface
    for (let y = H-1; y > 0; y--) {
      if (getBlock(hx, y, hz) === B.GRASS) {
        buildHouse(hx, y+1, hz, h % 4);
        break;
      }
    }
  }
}

function buildHouse(cx, y, cz, rot) {
  // 5x5x4 house: cobble base, wood walls, planks roof, door
  const W2 = 5, D2 = 5, H2 = 4;
  for (let dy = 0; dy < H2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const x = cx + dx, z = cz + dz;
        if (!inBounds(x, y+dy, z)) continue;
        const isEdge = Math.abs(dx) === 2 || Math.abs(dz) === 2;
        if (dy === 0) {
          setBlock(x, y, z, B.COBBLE);
        } else if (dy === H2 - 1) {
          // roof
          if (isEdge) setBlock(x, y+dy, z, B.PLANKS);
        } else if (isEdge) {
          // walls - leave 1-wide door opening
          if (dy < 3 && dz === -2 && Math.abs(dx) === 0) {
            // door slot - place door (meta bit 0 = closed)
            setBlock(x, y+dy, z, B.DOOR);
            meta[idx(x, y+dy, z)] = 0; // closed
          } else if (dy === 1 && Math.abs(dx) === 1 && Math.abs(dz) === 2) {
            // window (glass)
            setBlock(x, y+dy, z, B.GLASS);
          } else {
            setBlock(x, y+dy, z, B.WOOD);
          }
        } else {
          setBlock(x, y+dy, z, B.AIR); // interior empty
        }
      }
    }
  }
}

function plantTree(x, y, z) {
  const trunkH = 4 + ((vnoise2(x, z, 99) * 3) | 0);
  for (let i = 0; i < trunkH; i++) {
    if (inBounds(x, y+i, z)) setBlock(x, y+i, z, B.WOOD);
  }
  // Leaves crown
  const top = y + trunkH;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const xx = x+dx, yy = top+dy, zz = z+dz;
        if (!inBounds(xx, yy, zz)) continue;
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue; // corners
        if (getBlock(xx, yy, zz) === B.AIR) setBlock(xx, yy, zz, B.LEAVES);
      }
    }
  }
  // top leaf
  if (inBounds(x, top+1, z) && getBlock(x, top+1, z) === B.AIR) setBlock(x, top+1, z, B.LEAVES);
}

function findSpawn() {
  // Find a high grass spot
  let bestX = (W/2)|0, bestZ = (D/2)|0, bestY = H;
  for (let z = 4; z < D-4; z++) {
    for (let x = 4; x < W-4; x++) {
      for (let y = H-1; y > 0; y--) {
        if (getBlock(x, y, z) === B.GRASS) {
          if (y < bestY) { bestY = y; bestX = x; bestZ = z; }
          break;
        }
      }
    }
  }
  return { x: bestX + 0.5, y: bestY + 1.2, z: bestZ + 0.5 };
}

