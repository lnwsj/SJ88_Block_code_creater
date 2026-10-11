# 🏗️ Architecture — MiniCraft 3D / SJ88 Block Code Creater

เอกสารนี้อธิบายสถาปัตยกรรม**ฉบับปัจจุบัน** (หลังการปรับปรุงใหญ่ 6 เฟส + playtest hardening ต.ค. 2026) — ทุกอย่างออกแบบให้ยึดหลัก **"ไฟล์เดียว เขียนเอง ไม่มี dependency"**

---

## 🔨 Source layout & build

เกมมาจาก `src/` (แก้โค้ดที่นี่) → `node scripts/build.js` รวมเป็น
`index.html` + `multiplayer/deploy/multiplayer.html` ไฟล์เดียว (build output
ถูก commit ไว้ด้วยเพื่อแจกง่าย — CI เช็คว่าไม่ล้าสมัยด้วย `--check`)

```
src/head.html + style.css + mid.html + src/js/*.js (เรียงตามเลข) + tail.html
  → scripts/build.js → index.html (≡ multiplayer/deploy/multiplayer.html)
```

⚠️ **ห้ามแก้ `index.html` โดยตรง** — แก้ที่ `src/` แล้ว rebuild เสมอ

โมดูล JS (ตามลำดับในไฟล์ build — โมดูลหลังเห็นตัวแปร top-level ของโมดูลก่อนหน้าเพราะอยู่ใน global lexical scope เดียวกัน):

| ไฟล์ | เนื้อหา | จุดสำคัญ |
|------|---------|----------|
| `010-config.js` | CFG, block IDs `B`, `BLOCK_NAMES`, save system, RLE codec | `handSlots[8]`, save v3, `rleEncodeU8/rleDecodeU8` |
| `020-atlas.js` | procedural texture atlas | Canvas 2D สร้างตอน runtime |
| `030-world.js` | worldgen 5 ไบโอม, ต้นไม้, แร่, โครงสร้าง | deterministic ต่อ seed (unit test ยึดหลักนี้) |
| `040-mesh.js` | chunk mesher | chunk 16×16 ทั้งความสูง, Uint16 indices, ซ่อนหน้าที่ชนกัน, dirty tracking |
| `050-render-input.js` | WebGL, กล้อง/math, frustum culling, input, physics, น้ำ/อากาศ, `breakBlock`/`placeBlock`, game loop `loop()` | single rAF, `isGameActive()` |
| `060-gameplay.js` | เสียง, day/night, ความหิว, ม็อบ, คลัง/คราฟต์/หีบ, อาหาร `FOODS`, ต่อสู้ `attackDamageFor`, achievements, `VANILLA_MOD` + ModManager | data-driven recipes |
| `070-multiplayer.js` | WS client, ซิงก์, remote players/bots, **thin wrappers** broadcast การทุบ/วาง | MP_SERVER same-origin |
| `080-editor-ai.js` | Block editor UI, `Executor`, `Agent` (บอท), AI generator, world browser, SW registration | พิกัดสัมพัทธ์ผู้เล่น |

## 📁 File Layout

```
SJ88_Block_code_creater/
├── index.html                  # BUILD OUTPUT (เกมทั้งเกมในไฟล์เดียว)
├── src/                        # ★ source of truth (ดูตารางด้านบน)
├── scripts/build.js            # src/ → single HTML (+ --check สำหรับ CI)
├── tests/run.js                # unit tests 25 ข้อ (รันโค้ดจริงจาก src/ + source-assertions)
├── multiplayer/
│   ├── server/server.js        # เซิร์ฟเวอร์รวม: ws + http static + REST + PWA
│   ├── server/test.js          # integration tests 25 ข้อ
│   ├── server/minicraft-mp.service  # systemd unit
│   └── deploy.sh               # deploy ด้วย SSH key (ไม่มี credential ใน repo)
├── .github/workflows/ci.yml    # build + stale guard + syntax + ทั้งสองชุดทดสอบ
├── .gitattributes              # บังคับ LF ทั้ง repo
└── docs/                       # GAMEPLAY · CHANGELOG · ARCHITECTURE · MODDING · DEPLOY · screenshots
```

---

## 🎮 เอนจินเกม (client)

### Game loop — rAF เดียว

```
loop(t):
  FPS สถิติ → resize → rebuild chunks ที่ dirty → updatePlayer(dt)
  → ถ้า isGameActive(): เวลาในเกม, updateMobs, สถิติ, redstone, achievements
  → particles → render() → renderMobs → renderParticles → remotePlayers
  → minimap (4fps) → HUD (pos/ชื่อบล็อกที่เล็ง) → requestAnimationFrame(loop)
```

- `isGameActive() = gameStarted && !anyModalOpen()` — **ไม่ผูก pointer lock**
  (นี่คือสิ่งที่ทำให้มือถือซึ่ง lock ไม่ได้เล่นได้เต็มรูปแบบ)
- `updatePlayer(dt)` คือ single source ของฟิสิกส์: เดิน/วิ่ง/กระโดด/บิน, ตรวจน้ำ
  (feetIn/headIn), อากาศ/จมน้ำ, การชนแบบ AABB ทีละแกน

### Rendering pipeline

1. **Opaque pass** — บล็อกทึบ (backface culling + face culling ระหว่างบล็อก)
2. **Transparent pass** — น้ำ/กระจก/ใบไม้ (alpha blend, วาดหลัง opaque)
3. **Mobs + particles + remote players + bots** (shader สี solid + name labels)
4. **HUD** — overlay DOM (crosshair, hotbar, HP, hunger, air, minimap canvas)

**การตัดสินใจสำคัญ — chunking**: เดิมวาดทั้งโลกเป็น mesh เดียว ~98k–130k
vertices ซึ่ง**ล้น Uint16 index buffer** (65,535) บน GPU จริง → แบ่งเป็น chunk
16×16 ทั้งความสูง (สูงสุดต่อ chunk ~20k verts) มี dirty flag ต่อ chunk —
แก้บล็อกนึง rebuild แค่ chunk ที่โดน (และ chunk ข้างๆ ถ้าบล็อกอยู่ขอบ)
+ Gribb–Hartmann frustum culling ต่อ chunk

### การเก็บข้อมูลโลก

- `world[]` — flat `Uint8Array(W*D*H)` indexed `[x + W*(z + D*y)]` (W=D=64, H=36)
- `meta[]` — Uint8Array คู่ขนาน (ทิศประตู/สถานะคาน ฯลฯ)
- `chests` — Map `"x_y_z" → { items: Array(27) }`
- **RLE+base64 codec** (`rleEncodeU8`) ใช้ทั้งในเซฟ localStorage และส่งผ่านเน็ต —
  โลกเต็มใบ ~24KB จาก ~288KB JSON (×12)

### Save format v3 (localStorage `minicraft3d_v1`)

```js
{ v: 3, seed, px, py, pz, yaw, pitch, fly, hp,
  worldB64, metaB64,        // RLE
  chests,                   // { "x_y_z": [27 slots] }
  hand,                     // ★ handSlots ทั้ง 8 ช่อง (เฟส 1)
  sel, inv, hung, time, ach, stat }
```

- เปิดหน้าเกม = สร้าง preview world **โดยไม่เซฟ** (กันทับเซฟเก่า — บั๊กเดิม)
- `saveGame()` **ไม่ทำงานเมื่ออยู่ในห้อง MP** (โลกของห้องเป็นของ host — ไม่ทับเซฟส่วนตัว)

### ระบบมือ/ทุบ/วาง/กิน/ตี — ทางเดียวเดียว

`breakBlock()` / `placeBlock()` ใน 050 คือ **single source of truth**:
attack mob ก่อน (ถ้ามีม็อบใต้เป็นเล็ง) → ทุบ/วางจริง + drop + อนุภาค + เสียง +
กินอาหาร (FOODS) + หักคลัง (เว้นโหมดบิน) + คืน hit descriptor `{x,y,z,block}`

ส่วน 070 ครอบด้วย **thin wrapper**: เรียกต้นฉบับแล้ว broadcast ผลลัพธ์
ไปห้อง — gameplay logic ไม่ถูก duplicate ที่ไหนอีก (เคยเป็นบั๊กสถาปัตยกรรม:
070 เขียนทับทั้งฟังก์ชัน ทำให้ลอจิกสองทางเหลื่อมกัน)

---

## 🌐 Multiplayer

### เซิร์ฟเวอร์รวม (`multiplayer/server/server.js`)

Node.js ตัวเดียว รับทั้งหมดในพอร์ตเดียว (ค่าเริ่มต้น 3109, `PORT` เปลี่ยนได้):

```
Client 1 ─┐                 ┌─→ Client 1
           ├─ WebSocket ────┤
Client 2 ─┘    server.js    └─→ Client 2
                 │
                 ├─ GET /            → เสิร์ฟ index.html (หรือ multiplayer.html)
                 ├─ GET /sw.js, /manifest.webmanifest → PWA
                 ├─ worlds/<CODE>/meta.json + data.bin + chests.json (disk)
                 └─ REST /api/worlds (อ่านได้) · DELETE/rename (ต้องมี admin token)
```

- **การเชื่อมต่อจาก client**: ถ้าหน้าเกมถูกเสิร์ฟจาก http/https → WebSocket
  ใช้ **same-origin** (`ws(s)://location.host`) → deploy พอร์ตไหนก็ได้
  (กติกาเดิม hardcode 3109 เป็นบั๊กที่ playtest จับได้) · `window.MP_SERVER_OVERRIDE`
  ใช้ override ได้ · `file://` → `ws://localhost:3109`
- **Host = authoritative**: host เป็นเจ้าของโลก แชร์ `worldRB64` ให้คนเข้าใหม่,
  autosave ทุก 30 วิ · การแก้บล็อก/หีบของ**ทุกคน**ถูก apply ที่เซิร์ฟเวอร์และ persist
- **Host migration**: host หลุด → ผู้เล่นที่อยู่นานสุดได้เป็น host (`host_migrated`)
  autosave ต่อผ่านคนใหม่ — โลก "อยู่ต่อ" แม้ host ปิดเบราว์เซอร์
- **เซฟไม่มีฟิลด์ chests → คงหีบเดิมไว้** (กันโลกเซฟจาก client เก่าๆ ลบของ)
- ความปลอดภัย: room code `crypto.randomInt`, admin token
  (`MINICRAFT_ADMIN_TOKEN` หรือ random per-boot), token-bucket rate limit
  30 msg/วิ/ผู้เชื่อมต่อ, CORS สะท้อน origin เฉพาะที่ขอ

### Message protocol

```js
// Client → Server
{ type: 'hello', name, color, room? }
{ type: 'create_room', resumeCode? }        // resumeCode = เปิดโลกที่เซฟไว้ต่อ
{ type: 'join_room', code }
{ type: 'move', x, y, z, yaw, pitch, hp, fly }
{ type: 'block', action: 'place'|'break', x, y, z, block }
{ type: 'chest_update', x, y, z, items }    // ใครก็ส่งได้
{ type: 'world_state', world: { W, D, H, worldRB64, chests } }  // host แชร์ตอนคนเข้า
{ type: 'world_save', world: { ... } }      // host autosave 30s
{ type: 'chat', text }
{ type: 'bot' / 'bot_stop', ... }
{ type: 'pong' }

// Server → Client
{ type: 'room_created', code, id, hostId, resumed }
{ type: 'joined', id, code, players, world: { worldRB64, chests } }
{ type: 'world_sync', world }
{ type: 'player_joined' / 'player_left', ... }
{ type: 'player_move', id, x, y, z, yaw, pitch, hp, fly }
{ type: 'block_change', id, action, x, y, z, block }
{ type: 'chest_update', x, y, z, items }
{ type: 'host_migrated', id, name }
{ type: 'chat', id, name, text }
{ type: 'world_saved', meta }
{ type: 'error', message }
```

อัตราซิงก์: ตำแหน่ง 10Hz · บล็อก/แชท event-driven · ping/pong 5 วิ

---

## 🧩 Block Code Editor & Executor

- สคริปต์ = ลิงก์ลิสต์ของ block nodes (`{ type, params, next, children }`)
  ต้นแบบมาจาก `BLOCK_DEFS` (data-driven — เพิ่ม opcode = เพิ่ม def + case ใน Executor)
- **พิกัดทุกที่เป็นสัมพัทธ์กับตำแหน่งผู้เล่นตอนกด Run** (`executor.origin`)
- `Agent` (บอท) เคลื่อนไหวแบบ tween ~200ms ผ่าน rAF — ใน webview ที่ถูก
  throttle จะเห็นเคลื่อนช้า (เป็นข้อจำกัดของสภาพแวดล้อม ไม่ใช่บั๊ก)
- AI generator: local pattern 12 แบบ (จับ keyword ไทย/อังกฤษ + ตัวเลข
  `5x5`/`สูง 10` + ชื่อวัสดุ) หรือ online LLM แบบ OpenAI-compatible

---

## 📲 PWA / Service Worker

- เซิร์ฟเวอร์เสิร์ฟ `/sw.js`: **stale-while-revalidate** (เปิดเร็วด้วยแคช
  อัปเดตเบื้องหลัง) — API (`/api/`) ไม่ผ่านแคชเสมอ
- ⚠️ **กติกาสำคัญ**: ทุกครั้งที่ `index.html` เปลี่ยนพฤติกรรมและจะ ship —
  **bump ชื่อแคช** `'minicraft-v2'` → v3… ใน server.js (ไม่งั้นผู้เล่น PWA
  ได้เกมเก่าจนกว่า reload รอบที่สอง — เคยเกิดจริงข้าม 6 คอมมิท)

---

## ✅ Testing

| ชุด | ไฟล์ | ครอบคลุม |
|---|---|---|
| Unit (25) | `tests/run.js` | worldgen deterministic ต่อ seed (รันโค้ด 030 จริง), RLE codec, `attackDamageFor`, `autoFillHandSlots`, สูตร vanilla, tree helpers, `validateAIScript` + source-assertions ตรวจสิ่งที่รันใน browser อย่างเดียวไม่ได้ |
| Integration (25) | `multiplayer/server/test.js` | สปอว์นเซิร์ฟเวอร์จริง: health, สร้าง/เข้าห้อง, ซิงก์บล็อก, worldRB64 round-trip, host migration, **chests รอดจากเซฟไม่มีฟิลด์**, resume โลกจากดิสก์, rate limit, admin token 403 |
| Playtest (manual/automated) | — | ขับเกมในเบราว์เซอร์จริงผ่าน automation — รอบล่าสุด (ต.ค. 2026) ผ่านครบทุกระบบ + จับบั๊ก 4 จุด (ดู CHANGELOG) |

CI (`.github/workflows/ci.yml`): build → `--check` (output ต้องสด) → syntax → unit → integration

---

## 🔑 Key Design Decisions (สรุป)

1. **Vanilla WebGL 1.0 / ไม่มี CDN ไม่มีไลบรารี** — offline จริงจากไฟล์เดียว
2. **Assets procedural ทั้งหมด** (atlas Canvas 2D + WebAudio synth)
3. **เดี่ยว = localStorage, ออนไลน์ = โลกบนเซิร์ฟเวอร์** — แยกกันชัดเจน ไม่ทับกัน
4. **Chunk 16×16 + Uint16** — แก้ overflow และได้ dirty-rebuild + frustum culling ฟรี
5. **RLE+base64** — เซฟ/ซิงก์เล็กลง ~12 เท่า
6. **Host = authoritative + migration** — ไม่ต้องมี DB, โลกก็ยังถาวร
7. **Data-driven (BLOCK_DEFS / recipes / mods)** — เพิ่มเนื้อหาไม่ต้องแก้เอนจิน
8. **`isGameActive()` แทนเงื่อนไข pointer-lock** — มือถือเล่นได้
9. **same-origin WebSocket** — deploy พอร์ตไหนก็ได้
