# 📜 CHANGELOG — MiniCraft 3D / SJ88 Block Code Creater

ประวัติการเปลี่ยนแปลงฉบับเต็ม เรียงจากใหม่ → เก่า (รูปแบบ [Keep a Changelog](https://keepachangelog.com/), เวอร์ชันตาม commit)

---

## [Unreleased #5] — Graphics pass (12 ต.ค. 2026)

> ตอบรายงานผู้เล่นจริง: "เกมส์ภาพไม่สวยเลย" — เทียบก่อน/หลังที่ `docs/screenshots/gfx-before.png` vs `gfx-after.png` (มุมเดียวกัน เวลาเดียวกัน)

### Added/Changed (src/js/040-mesh, 050-render-input, 070, style.css, mid.html)
- **Per-vertex Ambient Occlusion** (อัลกอริทึม 0fps คลาสสิก): มุมที่บล็อกเกาะกันมืดลงเหมือนแสงตกเงา — ยืนยันจริง 141,716 จุดยอด ค่า 0.58–1.0 + พลิกเส้นทแยงมุม (quad flip) กัน artifact ไล่เฉด
- **เมฆลอย 2,830 แผ่น** ที่ระดับ 44 — ขาวโปร่งแสง ลอยผ่านช้าๆ ตามเวลาในเกม ใช้ shader หลัก (โดนแสง/หมอกเหมือนของจริง)
- **Mipmap + กรองระยะไกล** — เดิม NEAREST ล้วนทำภาพไกลกระพริบเป็น noise; atlas ถูก pad เป็น power-of-two แล้ว generateMipmap (ใกล้ยังคมแบบ retro)
- **Antialias เปิด** (เดิมปิด — ขอบบล็อกแหลมเป็นฟันเลื่อย) + **FOV 60°→70°** + **vignette** จางๆ ขอบจอ
- SW cache bump v5 → **v6**

---

## [Unreleased #4] — Revived rooms had no host (11 ต.ค. 2026)

### Fixed
- **ห้องที่ revive จากดิสก์ไม่มี host ตลอดกาล** — `join_room` สร้างห้อง revive ด้วย `hostId: null` แล้วไม่มีใครถูก promote เลย → `world_save` ถูกปฏิเสธ (30 วิ autosave ก็ข้าม) การแก้บล็อกในห้อง revive จึง**ตายไปพร้อมห้อง** (เคสจริง: พีระมิดที่สร้างหายเพราะเข้าห้อง revive หลัง reload) — ตอนนี้คนแรกที่เข้าห้อง hostless ได้เป็น host ทันที + ส่ง `hostId` ใน `joined` + `host_migrated` แจ้ง client (`multiplayer/server/server.js`, `src/js/070-multiplayer.js`) — ยืนยันสด: เข้าห้อง ERPF → isHost=true → สร้างเขาวงกต → lastSaved สด + blockCount 37,522→49,307
- SW cache bump v4 → **v5** (client แก้การอ่าน isHost)

### Added (เนื้อหาในเกม, โลก ERPF)
- **เขาวงกตอิฐ 25×25** บนที่ราบระดับ 26 (ระเบิดหัวเนิน 6,561 บล็อก): DFS perfect maze ผนัง 2 ชั้น 668 บล็อก, ปากทางใต้, ห้องกลางเสากลอสโตน + หีบสมบัติ (เพชร 5/เหล็ก 8/ขนมปัง 6), BFS ยืนยันทางเดิน 62 ก้าว — ภาพ m35–m39 ในคู่มือ

---

## [Unreleased #3] — Inverted mouse-look fix (11 ต.ค. 2026)

### Fixed
- **เมาส์แกนนอนกลับด้าน** (รายงานจากการเล่นจริงครั้งแรก) — กล้องหันแรงเยอร์ = `(-sin yaw, ·, -cos yaw)` ดังนั้น yaw เพิ่ม = กล้องหันซ้าย แต่ตัวจับเมาส์ใช้ `yaw += movementX` ทำให้เมาส์ขวา→กล้องหันซ้าย แก้เป็น `yaw -= movementX` (แกนตั้งถูกอยู่แล้ว) + SW bump v4 — บั๊กนี้เล็ดรอดจาก playtest อัตโนมัติเพราะ automation ไม่เคยขยับเมาส์จริงเหนือ canvas

---

## [Unreleased #2] — Illustrated Manual + craft UI crash fix (11 ต.ค. 2026)

### Fixed
- **คราฟต์ 2×2 (กด C) พังทันที** — สูตรแบบ 3×3 (หีบ/เตา/ประตู/กระจก/อิฐ) มี `shape` ไม่มี `ingredients` ทำให้ `buildCraftUI` โดน `undefined.every` ตั้งแต่ commit หีบ — ตอนนี้สูตร `needTable` อยู่กับโต๊ะ 3×3 อย่างเดียว + ค้นสูตรตอนคลิกใช้ `recipe.id` แทน result name (glass 2×2 กับ 3×3 เคยชนกัน) — พบระหว่างถ่ายภาพคู่มือ (`src/js/060-gameplay.js`)
- **SW cache bump v2 → v3** ตามกติกาที่ตั้งไว้เอง (ship แล้วต้อง bump — ตอนถ่ายคู่มือเจอว่าหน้าเก่ายังถูกเสิร์ฟจากแคช v2 จริงๆ)

### Docs
- **docs/MANUAL.md** — คู่มือฉบับสมบูรณ์ประกอบ**ภาพจริงจากเกม 34 ภาพ** (m01–m34 ใน docs/screenshots/) ครบทุกหัวข้อ: เมนู/ห้องออนไลน์, เกมเพลย์พื้นฐาน, คราฟต์, อาหาร, ต่อสู้, บิน, น้ำ, กลางวัน-กลางคืน, editor/บอท/AI, ความสำเร็จ — ทุกภาพถ่ายจากเซสชันสด ตรวจสองสถานะเกมขณะถ่าย และคัดภาพซ้ำออกก่อนรวม (md5 ไม่ซ้ำเลย)
- ลิงก์ MANUAL จาก README + GAMEPLAY

---

## [Unreleased] — Playtest Hardening (11 ต.ค. 2026)

> รอบ "ทดสอบว่าเล่นได้จริง": playtest อัตโนมัติในเบราว์เซอร์จริง (เซิร์ฟเวอร์จริงบนพอร์ต 3210) ครบทุกระบบ — เดิน กระโดด ทุบ วาง กิน ตีม็อบ บิน จมน้ำ เซฟ v3 บอท AI สร้างบ้าน (44 อิฐ) สร้างห้องออนไลน์ (โลก 37,522 บล็อกขึ้นเซิร์ฟเวอร์จริง) — **0 runtime error ตลอดรอบ** พบและแก้บั๊กจริง 4 จุด:

### Fixed
- **MP WebSocket URL ต่อพอร์ตผิดเสมอ** — client เคย hardcode พอร์ต `3109` ทุกกรณี ทำให้เปิดเซิร์ฟเวอร์ด้วยพอร์ตอื่น (`PORT=xxxx`) แล้วขาดการเชื่อมต่อเงียบๆ ตอนนี้ใช้ **same-origin** (`ws(s)://location.host`) เมื่อหน้าเกมถูกเสิร์ฟจาก http/https — ยืนยันด้วยการเชื่อมต่อจริงสำเร็จ (`src/js/070-multiplayer.js`, `src/js/080-editor-ai.js` getMPBaseURL)
- **`requestPointerLock()` ไม่ catch rejection** — ใน Chromium ใหม่ API คืน Promise; บริบทที่ lock ถูกปฏิเสธ (webview ฝัง/iframe ไม่มี allow) ทำให้เกิด unhandled rejection ตอนนี้ catch พร้อม toast แนะนำคลิกซ้ำ (`src/js/050-render-input.js`)
- **Service Worker cache ไม่เคย bump** — เกมอัปเดตข้าม 6 คอมมิทแต่ชื่อแคชยัง `minicraft-v1` ผู้เล่น PWA จะได้เกมเก่าจนกว่า reload รอบที่สอง (stale-while-revalidate) → bump เป็น **`minicraft-v2`** (`multiplayer/server/server.js`) — และบันทึกกติกา: bump ทุกครั้งที่ ship build ใหม่
- **AI generator อ่านชื่อบล็อกไม่ได้** — `ctx.blockNames` อ้าง `window.BLOCK_NAMES` ซึ่งเป็น `undefined` เสมอ (ตัวแปร `const` ไม่ติด window) ทำให้ข้อความ say ของบอท fallback เป็น "หิน" ตลอด → อ้าง `BLOCK_NAMES` ตรงๆ (`src/js/080-editor-ai.js`)

### Docs
- เอกสารชุดใหม่: `docs/GAMEPLAY.md` (คู่มือผู้เล่นละเอียด), `docs/CHANGELOG.md` (ไฟล์นี้), README เขียนใหม่, `docs/ARCHITECTURE.md` เขียนใหม่ตามโครง src/, `docs/MODDING.md` อัปเดตอนุสัญญา
- ภาพหน้าจอจริงจาก playtest อัตโนมัติ 5 ภาพใน `docs/screenshots/` + แก้ `.gitignore` ให้ติดตามไฟล์

---

## [a75581c] — Phase 1 เสร็จ: มือ-ถือของ / อาหาร / ต่อสู้ / น้ำ (10 ต.ค. 2026)

### Added — ระบบมือ (Hand Slots) แทน hotbar บล็อกคงที่
- `handSlots[8]` — hotbar 1–8 คือช่องมือ ถือไอเทมใดก็ได้ (`block:N` / ดาบ / อาหาร)
- ทุบบล็อกได้ของ → **เข้ามืออัตโนมัติ** (เฉพาะบล็อก; อาหาร/เครื่องมือถือเองผ่านคลัง E)
- ตัวเลขจำนวน `x3` บนช่อง + `∞` ในโหมดบิน
- เซฟ v3 เก็บ `hand` ครบทั้ง 8 ช่อง

### Added — อาหารและการกิน
- ตาราง `FOODS`: ขนมปัง +4, หมูดิบ +3, หมูสุก +5, เนื้อเน่า +1
- ถืออาหาร → **คลิกขวา = กิน** (ในเกมและในคลังของ) + เสียงกิน + อนุภาค
- สูตรใหม่: หมูสุก = หมูดิบ + ถ่าน

### Added — การต่อสู้
- คลิกซ้ายใส่**ม็อบใต้เป้าเล็ง** (mobUnderCrosshair) — ดาเมจตามของที่ถือ: หมัด 1 / ดาบไม้ 3 / ดาบหิน 4 / mod `*_sword` 4
- สถิติ `mobsKilled` + ความสำเร็จ "นักล่ามอนสเตอร์"

### Added — น้ำและการจมน้ำ
- ฟิสิกส์น้ำ: เคลื่อนที่ช้าลง ×0.6, จมช้า (gravity ×0.3, cap −2.5), Space ว่ายขึ้น, **ตกน้ำไม่เจ็บ**, splash + อนุภาค
- ระบบอากาศ 🫧×10: หัวใต้น้ำลด 1 ฟอง/1.4 วิ → หมดแล้วเสีย HP 1/วินาที → โผล่หัวพ้นน้ำเต็มทันที + UI `#hud-air`

### Changed
- `breakBlock`/`placeBlock` กลายเป็น single source of truth (โจมตีม็อบก่อน → ทุบ/วาง + กิน + หักคลัง) คืน hit descriptor `{x,y,z,block}` — ส่วน 070 multiplayer เหลือแค่ thin wrapper broadcast
- โหมดบินเติมพาเลทต์บล็อก 8 ช่องอัตโนมัติ + วางฟรี
- ป้องกันวางบล็อกทับตัวเอง

---

## [9f04177] — Phase 5: แยกซอร์ส + CI + PWA (10 ต.ค. 2026)

### Added
- **แยกไฟล์เดียว → src/ modules**: `src/js/010-config … 080-editor-ai` (8 โมดูล) + `src/head.html` / `mid.html` / `tail.html` / `style.css`
- **Build pipeline**: `scripts/build.js` ประกอบ src/ → `index.html` + `multiplayer/deploy/multiplayer.html`; โหมด `--check` สำหรับ CI (fail ถ้า output เลย)
- **CI**: `.github/workflows/ci.yml` — build + stale-output guard + syntax + unit tests + integration tests
- **PWA**: เซิร์ฟเวอร์เสิร์ฟ `/sw.js` (stale-while-revalidate) + `/manifest.webmanifest` → ติดตั้งเป็นแอป เล่นออฟไลน์ได้
- `.gitattributes` บังคับ LF ทั้ง repo (กันปัญหา CRLF บน Windows)

### Changed
- `index.html` กลายเป็น **build output** — แก้ที่ src/ เท่านั้น

---

## [99a87c1] — Phase 4: เซิร์ฟเวอร์รวม + โลกถาวร + host migration (10 ต.ค. 2026)

### Added
- **`multiplayer/server/server.js`** — เซิร์ฟเวอร์ Node.js ตัวเดียว (ws + http + สติกไฟล์): เสิร์ฟหน้าเกม ห้องออนไลน์ REST API และ PWA
- **Persistent worlds**: โลกเขียนลงดิสก์ (`worlds/<code>/meta.json|data.bin|chests.json`) เซฟทุก 30 วิ — host ออกได้ โลกอยู่ต่อ ทุกคนออกก็ยังกลับมาเปิดได้ด้วยรหัสเดิม
- **Host migration**: host หลุด → ผู้เล่นแรกที่เหลือได้เป็น host อัตโนมัติ (broadcast `host_migrated`)
- **World browser**: `GET /api/worlds` + UI "🌍 โลกที่บันทึก"
- **ความปลอดภัย**: admin token (`MINICRAFT_ADMIN_TOKEN` หรือสุ่ม `crypto.randomBytes(16)`) คุ้มกัน REST ลบโลก, rate limiting 30 msg/วิ/ผู้เลื่อม (token bucket), room code ใช้ `crypto.randomInt`
- **`multiplayer/server/test.js`** — integration test 25 ข้อ (health/ห้อง/ซิงก์บล็อก/worldRB64/host migration/chests กันโดนลบเมื่อเซฟไม่มีฟิลด์/rate limit/403 token ผิด)
- `multiplayer/deploy.sh` — deploy ด้วย SSH key (ไม่มี credential ใน repo)

### Fixed
- เซฟโลกที่ไม่มีฟิลด์ `chests` เคย**ลบของในหีบทิ้ง** — ตอนนี้เซิร์ฟเวอร์คงหีบเดิมไว้เมื่อฟิลด์หาย (พบโดย integration test)
- การเข้ารหัสโลกเปลี่ยนเป็น **RLE+base64 (`worldRB64`)** ~24KB จากเดิม ~288KB JSON (ลด 12 เท่า)

---

## [6d79dd5] — Phase 3: Editor ปรับ UI + AI Generator (10 ต.ค. 2026)

### Added
- **AI Script Generator**: โหมด local (offline) จับแพตเทิร์น 12 แบบ (บ้าน/หอคอย/กำแพง/สะพาน/พื้น/พีระมิด/สระ/วงกลม/ขุด/เดิน/ทักทาย/ต้นไม้) + โหมด online (OpenAI-compatible)
- บล็อกคำสั่งใหม่: `place_at` / `fill` (พิกัดสัมพัทธ์กับผู้เล่น), `while_block`, ตัวแปร set/change
- `/cmd` ในแชท trigger สคริปต์, Undo stack, Export/Import JSON

### Changed
- Editor UI ปรับโฉมสไตล์ Scratch: พาเลทตามหมวด + ลากวาง + ป้ายพารามิเตอร์ชัดเจน

---

## [411bdcf] — Phase 2: เอนจิน chunk + game loop + มือถือ + เซฟ v3 (10 ต.ค. 2026)

### Fixed — เอนจิน
- **Uint16 index overflow**: โลกทั้งใบ 1 mesh เดียว ~98k–130k vertices > 65,535 → บั๊ก render บน GPU บางรุ่น → แบ่งเป็น **chunk 16×16** (ต่อ chunk ~20k verts, buffer แยก, สร้างใหม่เฉพาะ chunk ที่แก้)
- Frustum culling (Gribb–Hartmann) ตัด chunk ที่มองไม่เห็น
- **Game loop รวมเป็น rAF เดียว** — ก่อนหน้ามีหลาย loop ซ้อนกัน
- `isGameActive()` = เริ่มเกมแล้ว + ไม่มี modal เปิด — แทนเงื่อนไข pointer lock เดิม (ทำให้**มือถือ**ที่ lock ไม่ได้เลยก็เล่นได้)

### Added
- **รองรับมือถือ**: จอยสติ๊กเดิน + ปุ่มลัด (กระโดด/ทุบ/วาง/คลัง/เมนู)
- **เซฟ v3**: โลก+เมตา เก็บแบบ RLE+base64 (~24KB), เก็บหีบ, เก็บสถิติ/ความสำเร็จ
- ม็อบ 3D เต็มรูปแบบ + อนุภาคทุบบล็อก + เสียงเพิ่ม

---

## [fa5a39f] — Phase 0: แก้ด่วน เซฟ/XSS (9 ต.ค. 2026)

### Fixed
- **เปิดหน้าเกมแล้วเซฟเก่าโดนทับ** — preview world ตอนโหลดหน้าไม่เซฟอีกต่อไป
- **XSS ในแชท/ชื่อผู้เล่น** — ข้อความจากผู้เล่นอื่นถูก escape ก่อนแสดง (เดิมฝัง innerHTML ตรงๆ)

---

## เวอร์ชันก่อนหน้า (สรุปย่อ)

- **3197d78** 🌍 Server-side Persistent Worlds — host can leave, world stays
- **5ec5524** 🤖 AI Script Generator — 11 local patterns + online LLM
- **8eace9d** 🎨 Code Editor UI overhaul — Scratch-style
- **d0c0cd2** 📱 Mobile touch — joystick + action buttons + PWA
- **33d97ac** 📦 Chest (27 slots) + โต๊ะคราฟต์ 3×3 (5 สูตร)
- (ย้อนไปอีก): multiplayer WebSocket 8 คน/ห้อง, mod loader data-driven, 30 บล็อก 5 ไบโอม, ม็อบ AI, คราฟต์ 12 สูตร, day/night, minimap, 10 procedural sounds, achievements

---

## แนวทางกติกาภายในสำหรับคนแก้โค้ด

1. **ห้ามแก้ `index.html` ตรงๆ** — แก้ที่ `src/` แล้วรัน `node scripts/build.js` (CI จะ fail ถ้า output เลย)
2. **แก้เกมแล้วต้อง bump SW cache** — `'minicraft-v2'` → v3… ใน `multiplayer/server/server.js` ทุกครั้งที่ index.html เปลี่ยนพฤติกรรม
3. **บล็อกใหม่** ต้องลงทั้ง `B` (010), สี, ชื่อไทย `BLOCK_NAMES`, เสียง และ (ถ้าทุบได้) drop
4. **mod sword**: ลงท้าย `_sword` = ดาเมจ 4 อัตโนมัติ; `FOODS` เป็นตาราง vanilla เท่านั้น (mod เพิ่มอาหารผ่าน recipe ไม่ได้ค่าหิวใหม่ได้)
5. **เทส**: `node tests/run.js` (unit 25) + `cd multiplayer/server && node test.js` (integration 25) ต้องเขียวก่อน push
