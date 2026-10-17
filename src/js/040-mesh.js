// ======================================================================
// MESH BUILDING
// ======================================================================
// Chunked mesh storage: the world is split into CHUNK x CHUNK full-height
// column chunks. Only dirty chunks are rebuilt (one block edit = 1-2 chunk
// rebuilds instead of a whole-world rescan), and per-chunk vertex counts stay
// far below the Uint16 index limit — the old single whole-world mesh reached
// ~100k+ vertices and its indices silently wrapped past 65535 (corrupted faces).
const CHUNK = 16;
const CHUNKS_X = Math.ceil(W / CHUNK);
const CHUNKS_Z = Math.ceil(D / CHUNK);
let meshRebuildNeeded = true; // true = mark every chunk dirty on the next frame

const chunks = [];
for (let cz = 0; cz < CHUNKS_Z; cz++) {
  for (let cx = 0; cx < CHUNKS_X; cx++) {
    chunks.push({
      cx, cz, dirty: true, faces: 0, buf: null,
      opaque: { positions: [], normals: [], uvs: [], indices: [], ao: [] },
      transp: { positions: [], normals: [], uvs: [], indices: [], ao: [] },
    });
  }
}
function chunkAt(cx, cz) {
  return (cx < 0 || cz < 0 || cx >= CHUNKS_X || cz >= CHUNKS_Z) ? null : chunks[cz * CHUNKS_X + cx];
}
function markChunkDirty(x, z) {
  const cx = x >> 4, cz = z >> 4;
  const c = chunkAt(cx, cz);
  if (c) c.dirty = true;
  // Editing a border block changes face culling in the neighboring chunk too
  if ((x & (CHUNK - 1)) === 0) { const n = chunkAt(cx - 1, cz); if (n) n.dirty = true; }
  if ((x & (CHUNK - 1)) === CHUNK - 1) { const n = chunkAt(cx + 1, cz); if (n) n.dirty = true; }
  if ((z & (CHUNK - 1)) === 0) { const n = chunkAt(cx, cz - 1); if (n) n.dirty = true; }
  if ((z & (CHUNK - 1)) === CHUNK - 1) { const n = chunkAt(cx, cz + 1); if (n) n.dirty = true; }
}

// Face directions: 0=+X, 1=-X, 2=+Y, 3=-Y, 4=+Z, 5=-Z
// Each face: 4 vertices (CCW when viewed from outside)
const FACE_VERTS = [
  // +X (right)
  [[1,1,0],[1,0,0],[1,1,1],[1,0,1]],
  // -X (left)
  [[0,1,1],[0,0,1],[0,1,0],[0,0,0]],
  // +Y (top)
  [[0,1,1],[1,1,1],[0,1,0],[1,1,0]],
  // -Y (bottom)
  [[0,0,0],[1,0,0],[0,0,1],[1,0,1]],
  // +Z (front)
  [[1,1,1],[0,1,1],[1,0,1],[0,0,1]],
  // -Z (back)
  [[0,1,0],[1,1,0],[0,0,0],[1,0,0]],
];
const FACE_NORMALS = [
  [1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]
];
const FACE_UVS = [
  [0,0],[1,0],[0,1],[1,1]
];

function addFace(target, bx, by, bz, face, blockType) {
  const verts = FACE_VERTS[face];
  const n = FACE_NORMALS[face];
  // Get tex for this face
  let texIdx;
  if (face === 2) texIdx = FACE_TEX[blockType]?.[0] ?? 3;
  else if (face === 3) texIdx = FACE_TEX[blockType]?.[2] ?? 2;
  else texIdx = FACE_TEX[blockType]?.[1] ?? 3;

  const u0 = (texIdx % CFG.ATLAS) / CFG.ATLAS;
  const v0 = Math.floor(texIdx / CFG.ATLAS) / CFG.ATLAS_H;
  const du = 1 / CFG.ATLAS;
  const dv = 1 / CFG.ATLAS_H;
  let uvCoords;
  if (face === 2) {
    uvCoords = [[u0, v0+dv],[u0+du, v0+dv],[u0, v0],[u0+du, v0]];
  } else if (face === 3) {
    uvCoords = [[u0, v0],[u0+du, v0],[u0, v0+dv],[u0+du, v0+dv]];
  } else {
    uvCoords = [[u0, v0+dv],[u0+du, v0+dv],[u0, v0],[u0+du, v0]];
  }

  // ---- Per-vertex ambient occlusion (classic 0fps method) ----
  // For each face vertex, sample the two edge-adjacent neighbors and the
  // corner neighbor in the plane one step along the face normal.
  // ao 3 = fully open, 0 = corner pinched by blocks on both sides.
  const na = n[0] !== 0 ? 0 : (n[1] !== 0 ? 1 : 2); // normal axis
  const ua = na === 0 ? 1 : 0;                      // first in-plane axis
  const wa = na === 2 ? 1 : 2;                      // second in-plane axis
  const occl = (x, y, z) => {
    const b = getBlock(x, y, z);
    return b !== B.AIR && !TRANSPARENT.has(b) && b !== B.DOOR ? 1 : 0;
  };
  const aoVals = new Array(4);
  for (let i = 0; i < 4; i++) {
    const v = verts[i];
    const du = v[ua] === 1 ? 1 : -1;
    const dw = v[wa] === 1 ? 1 : -1;
    const base = [bx + n[0], by + n[1], bz + n[2]];
    const s1 = [...base]; s1[ua] += du;
    const s2 = [...base]; s2[wa] += dw;
    const cn = [...base]; cn[ua] += du; cn[wa] += dw;
    const o1 = occl(s1[0], s1[1], s1[2]);
    const o2 = occl(s2[0], s2[1], s2[2]);
    const oc = occl(cn[0], cn[1], cn[2]);
    const ao = (o1 && o2) ? 0 : 3 - (o1 + o2 + oc);
    aoVals[i] = 0.58 + 0.14 * ao; // 1.0 open … 0.58 pinched
  }

  const baseIdx = target.positions.length / 3;
  for (let i = 0; i < 4; i++) {
    target.positions.push(bx + verts[i][0], by + verts[i][1], bz + verts[i][2]);
    target.normals.push(n[0], n[1], n[2]);
    target.uvs.push(uvCoords[i][0], uvCoords[i][1]);
    if (target.ao) target.ao.push(aoVals[i]);
  }
  // Flip the quad diagonal along the brighter pair to avoid AO gradient artifacts
  if (aoVals[0] + aoVals[3] > aoVals[1] + aoVals[2]) {
    target.indices.push(baseIdx, baseIdx+1, baseIdx+3, baseIdx, baseIdx+3, baseIdx+2);
  } else {
    target.indices.push(baseIdx, baseIdx+1, baseIdx+2, baseIdx+1, baseIdx+3, baseIdx+2);
  }
}

function buildChunkMesh(ch) {
  const o = ch.opaque, t = ch.transp;
  o.positions.length = o.normals.length = o.uvs.length = o.indices.length = o.ao.length = 0;
  t.positions.length = t.normals.length = t.uvs.length = t.indices.length = t.ao.length = 0;
  let faces = 0;
  const x0 = ch.cx * CHUNK, z0 = ch.cz * CHUNK;
  for (let z = z0; z < z0 + CHUNK; z++) {
    for (let y = 0; y < H; y++) {
      for (let x = x0; x < x0 + CHUNK; x++) {
        const b = world[idx(x, y, z)];
        if (b === B.AIR) continue;
        // Skip open doors (treat as air visually)
        if (b === B.DOOR && (meta[idx(x, y, z)] & 2) !== 0) continue;
        const isT = TRANSPARENT.has(b) && b !== B.LEAVES; // water, glass, ice
        const target = isT ? t : o;
        for (let f = 0; f < 6; f++) {
          const nx = x + FACE_NORMALS[f][0];
          const ny = y + FACE_NORMALS[f][1];
          const nz = z + FACE_NORMALS[f][2];
          const nb = getBlock(nx, ny, nz);
          const isOpenDoor = nb === B.DOOR && inBounds(nx, ny, nz) && (meta[idx(nx, ny, nz)] & 2) !== 0;
          // For opaque: face visible if neighbor is air or transparent
          // For transparent: face visible if neighbor is air
          if (isT ? (nb === B.AIR || isOpenDoor) : (TRANSPARENT.has(nb) || isOpenDoor)) {
            addFace(target, x, y, z, f, b);
            faces++;
          }
        }
      }
    }
  }
  ch.faces = faces;
  uploadChunk(ch);
  ch.dirty = false;
}

