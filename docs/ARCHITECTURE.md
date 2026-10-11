# 🏗️ Architecture

## 🔨 Source layout & build

เกมมาจาก `src/` (แก้โค้ดที่นี่) → `node scripts/build.js` รวมเป็น
`index.html` + `multiplayer/deploy/multiplayer.html` ไฟล์เดียว (build output
ถูก commit ไว้ด้วยเพื่อแจกง่าย — CI เช็คว่าไม่ล้าสมัยด้วย `--check`)

```
src/head.html + style.css + mid.html + src/js/*.js (เรียงตามเลข) + tail.html
  → scripts/build.js → index.html (≡ multiplayer/deploy/multiplayer.html)
```

โมดูล JS (ตามลำดับในไฟล์ build):
| ไฟล์ | เนื้อหา |
|------|---------|
| 010-config | CFG, block IDs, save system + RLE |
| 020-atlas | procedural texture atlas (Canvas 2D) |
| 030-world | world gen, biomes, structures |
| 040-mesh | chunked meshes + dirty tracking + frustum culling |
| 050-render-input | WebGL setup, camera/math, input, mobile touch, game loop |
| 060-gameplay | sounds, day/night, hunger, mobs, inventory, crafting, chests, redstone |
| 070-multiplayer | WS client, chat, remote players, world sync |
| 080-editor-ai | block editor, executor, AI generator, world browser, PWA |

## 📁 File Layout

```
SJ88_Block_code_creater/
├── index.html              # BUILD OUTPUT (single-file game)
├── src/                    # source of truth (ดูตารางด้านบน)
├── scripts/build.js        # src/ → single HTML
├── tests/run.js            # unit tests (รันโค้ดจริงจาก src/)
├── .github/workflows/ci.yml# build + stale check + tests

## 🎮 Game Architecture (index.html)

### Layer Breakdown

| Layer | Responsibility |
|-------|---------------|
| **CFG** | Game configuration constants |
| **Atlas** | Procedural texture generation (Canvas 2D) |
| **Renderer** | WebGL setup, shaders, buffers |
| **World** | Chunk data, block storage |
| **Player** | Movement, collision, physics |
| **Mobs** | AI, pathfinding, spawning |
| **Inventory** | Items, hotbar, save/load |
| **Recipes** | Crafting (now data-driven via ModManager) |
| **Multiplayer** | WS protocol, remote players |

### Data Flow

```
User Input → Player → Physics (collision) → World update
                                  ↓
                         Render (WebGL)
                                  ↓
                          Atlas textures
                                  ↓
                         HUD overlay
```

### Mod System (v3.0+)

```
┌─────────────────┐
│   User Input    │  (paste JSON, URL, sample)
└────────┬────────┘
         ↓
┌─────────────────┐
│   ModManager    │  install / remove / save
└────────┬────────┘
         ↓
┌─────────────────┐
│   mods[] array  │  [VANILLA_MOD, user_mod1, ...]
└────────┬────────┘
         ↓
┌─────────────────┐
│  getRecipes()   │  query at runtime (data-driven)
│  getItems()     │
└────────┬────────┘
         ↓
┌─────────────────┐
│  Crafting UI    │  categories + mod tags
└─────────────────┘
```

### Rendering Pipeline

1. **Frame start** → clear screen
2. **Opaque pass** → render visible block faces (backface culling)
3. **Transparent pass** → water, glass, leaves (alpha blending)
4. **Mobs** → render entities
5. **Remote players** (MP only) → render with solid-color shader
6. **HUD** → 2D overlay (crosshair, hotbar, HP, etc.)

### Block Storage

- `world[]` - flat `Uint8Array` indexed `[x + W * (z + D * y)]`
- `biomeMap[]` - separate `Uint8Array` for biome data
- `meshData` - cached vertex buffers (rebuilt only when dirty)

## 🌐 Multiplayer Architecture

### Server (server.js — unified)

```
Client 1 ─┐                ┌─→ Client 1
           ├─ WebSocket ──┤
Client 2 ─┘   server.js   └─→ Client 2
                │
                ├─ worlds/<CODE>/meta.json + data.bin + chests.json (disk)
                └─ REST: GET /api/worlds (open), DELETE/rename (admin token)
```

- World blocks sync as **RLE+base64** (`worldRB64`) — typically tens of KB
  instead of the old ~300-500KB JSON array
- **Every player's block/chest edits persist** (server applies them to the
  room world and debounces a disk save every 5s)
- **Host migration**: when the host disconnects, the longest-connected player
  is promoted (`host_migrated`) and autosaving continues through them
- Per-connection rate limiting + message validation; room codes use
  `crypto.randomInt`

### Message Protocol

```js
// Client → Server
{ type: 'hello', name, color, room? }
{ type: 'create_room', resumeCode? }        // resumeCode = revive a saved world
{ type: 'join_room', code }
{ type: 'move', x, y, z, yaw, pitch, hp, fly }
{ type: 'block', action: 'place'|'break', x, y, z, block }
{ type: 'chest_update', x, y, z, items }    // any player
{ type: 'world_state', world: { W, D, H, worldRB64, chests } }  // host share
{ type: 'world_save', world: { ... } }      // host autosave (30s)
{ type: 'chat', text }
{ type: 'bot' / 'bot_stop', ... }
{ type: 'pong' }

// Server → Client
{ type: 'room_created', code, id, hostId, resumed }
{ type: 'joined', id, code, players, world: { worldRB64, chests } }
{ type: 'world_sync', world: { worldRB64, chests } }
{ type: 'player_joined' / 'player_left', ... }
{ type: 'player_move', id, x, y, z, yaw, pitch, hp, fly }
{ type: 'block_change', id, action, x, y, z, block }
{ type: 'chest_update', x, y, z, items }
{ type: 'host_migrated', id, name }         // host left → new host promoted
{ type: 'chat', id, name, text }
{ type: 'world_saved', meta }
{ type: 'error', message }
```

### Sync Rate

- Position: 10 Hz (every 100ms)
- Block change: instant (event-driven)
- Chat: instant
- Ping/pong: 5s heartbeat

## 🔑 Key Design Decisions

1. **Vanilla WebGL** - true offline, no library, no CDN
2. **Procedural textures** - all assets generated in-browser
3. **localStorage** - no cloud, no account
4. **Combined HTTP+WS** - single port for game + WebSocket
5. **Host = authoritative** - host owns world, broadcasts changes
6. **4-char room codes** - human-friendly, no DB needed
7. **Data-driven recipes** - mods can add without code changes
