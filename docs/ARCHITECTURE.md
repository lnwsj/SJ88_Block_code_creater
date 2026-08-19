# 🏗️ Architecture

## 📁 File Layout

```
SJ88_Block_code_creater/
├── index.html              # 185KB single-player game
├── README.md
├── .gitignore
├── mods/
│   └── ruby_mod.json       # Sample mod
├── multiplayer/
│   ├── server/
│   │   ├── server.js              # WS only (basic)
│   │   ├── server-full.js         # HTTP+WS combined
│   │   └── package.json
│   ├── deploy/
│   │   └── multiplayer.html       # 185KB MP game
│   └── deploy-mini-mp.py          # Deploy script
└── docs/
    ├── MODDING.md
    ├── DEPLOY.md
    └── ARCHITECTURE.md
```

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

### Server (server-full.js)

```
Client 1 ─┐                ┌─→ Client 1
           ├─ WebSocket ──┤
Client 2 ─┘   server.js   └─→ Client 2
```

### Message Protocol

```js
// Client → Server
{ type: 'hello', name, color, room? }
{ type: 'create_room' }
{ type: 'join_room', code }
{ type: 'move', x, y, z, yaw, pitch, hp }
{ type: 'block', action: 'place'|'break', x, y, z, block }
{ type: 'chat', text }
{ type: 'pong' }

// Server → Client
{ type: 'room_created', code, hostId }
{ type: 'joined', id, code, hostId, world }
{ type: 'player_joined', id, name, color }
{ type: 'player_left', id }
{ type: 'player_move', id, x, y, z, yaw, pitch, hp }
{ type: 'block_change', x, y, z, block, action }
{ type: 'chat', id, name, text }
{ type: 'pong' }
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
