# 🎮 SJ88 Block Code Creater

> **เกม 3D Minecraft-style ที่เล่นได้แบบ Offline (single HTML) + Online Multiplayer (WebSocket) + Mod Loader (data-driven)**

[![vanilla WebGL](https://img.shields.io/badge/WebGL-Vanilla-orange)](https://www.khronos.org/webgl/)
[![no CDN](https://img.shields.io/badge/dependencies-None-success)]()
[![offline](https://img.shields.io/badge/works-100%25%20Offline-blue)]()
[![multiplayer](https://img.shields.io/badge/multiplayer-WebSocket-purple)]()

## ✨ Features

### 🌍 v2.0 Full Edition (Single-Player)
- 🏗️ **30 บล็อก**: ดิน หิน ไม้ ใบไม้ ทราย อิฐ แก้ว น้ำแข็ง แร่ (ถ่าน/เหล็ก/ทอง/เพชร) คบไฟ ประตู กระบอกไม้ ฯลฯ
- 🌎 **5 ไบโอม**: ทุ่ง ป่า ทะเลทราย หิมะ ภูเขา + มหาสมุทร
- 🐷 **Mob AI**: หมู วัว (passive), ซอมบี้ ครีปเปอร์ (hostile กลางคืน)
- ❤️ **Survival**: HP (20), Hunger (20), Fall damage, Starve damage
- 🌞 **Day/Night cycle**: 10 นาที/วัน, dynamic sky, dynamic sun
- 🎵 **10 procedural sounds**: ทุบ วาง เดิน เจ็บ กระโดด ดาบ ระเบิด ฯลฯ
- 🎒 **Inventory + 12 Crafting recipes** (พลั่ว 3 ดาบ 2 คบไฟ แก้ว อิฐ โต๊ะคราฟต์)
- 🏠 **โครงสร้างสุ่ม**: บ้าน 2-3 หลังต่อโลก
- 🗺️ **Minimap + 10 Achievements**

### 🌐 v3.0 Multiplayer
- 🎮 **8 คน/ห้อง** (4-char room codes เช่น VAAM, X467)
- 🔄 **Real-time sync**: ตำแหน่ง มุม HP บิน (10 ครั้ง/วินาที)
- 🧱 **Block sync**: ทุบ/วางเห็นทันทีทั้ง 2 ฝ่าย
- 💬 **In-game chat** (T key)
- 🤝 **Auto-reconnect** + **World sync** (host shares world to new joiners)
- 📊 **Player list** พร้อมสี + HP

### 📦 Mod Loader
- 🔌 **Data-driven recipes**: เพิ่ม recipe ผ่าน JSON ไม่ต้องแก้โค้ด
- 🎨 **Custom items**: 10 shape (gem, ingot, stick, food, tool_pickaxe, tool_sword, potion, coin, ...)
- 🗂️ **Recipe categories**: พื้นฐาน, เครื่องมือ, ก่อสร้าง, อาหาร
- 💾 **Persistence**: mods เก็บใน localStorage
- 🌐 **Install from URL**: โหลด mod จาก URL ได้
- 📤 **Export/Share**: copy mod JSON ไปแชร์

## 📂 Project Structure

```
SJ88_Block_code_creater/
├── index.html              # เกม single-player (185KB, 4,600+ lines)
├── README.md
├── .gitignore
├── mods/
│   └── ruby_mod.json       # Mod ตัวอย่าง
├── multiplayer/
│   ├── server/
│   │   ├── server.js       # WebSocket signaling server (basic)
│   │   ├── server-full.js  # HTTP+WS combined server
│   │   ├── package.json
│   │   └── package-lock.json
│   ├── deploy/
│   │   └── multiplayer.html # เกม multiplayer (185KB)
│   └── deploy-mini-mp.py   # Deploy script (paramiko)
└── docs/
    ├── MODDING.md          # คู่มือสร้าง mod
    └── DEPLOY.md           # คู่มือ deploy
```

## 🚀 Quick Start

### 1. Single-Player (Offline)
```bash
# เปิดไฟล์ index.html ใน browser
open index.html
# หรือใช้ static server
python3 -m http.server 8000
# แล้วเปิด http://localhost:8000
```

### 2. Multiplayer Server
```bash
cd multiplayer/server
npm install
node server-full.js
# Server runs on http://localhost:3109
# เปิด multiplayer/deploy/multiplayer.html ใน browser 2 tabs
```

### 3. ติดตั้ง Mod
1. เปิดเกม → กด **"📦 Mods"**
2. กด **"📝 โหลดตัวอย่าง"** → เห็น Ruby Mod
3. กด **"📥 ติดตั้ง"** → เพิ่ม 2 recipes + 3 items
4. กด **C** → ดูตารางคราฟต์ → เห็น "พลั่วทับทิม"

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| **Rendering** | Vanilla WebGL 1.0 (no Three.js, no library) |
| **Textures** | Canvas 2D procedural generation |
| **Audio** | Web Audio API (oscillator + gain envelope) |
| **Storage** | localStorage (no cloud, no account) |
| **Multiplayer** | Node.js + `ws` library (WebSocket) |
| **Server** | Combined HTTP+WS on single port (port 3109) |

## 📸 Screenshots

### Game World (v2.0)
![Start Screen](docs/screenshots/start.png)

### Multiplayer
![Multiplayer UI](docs/screenshots/mp_connected.png)

### Mod Manager
![Mod Manager](docs/screenshots/mods_modal.png)

### Crafting with Mods
![Crafting with Mods](docs/screenshots/mods_craft.png)

## 🌐 Live URLs

| Version | URL | Note |
|---------|-----|------|
| Single-player (HTTP) | `http://103.253.75.161:3109/multiplayer.html` | Full MP works |
| Single-player (HTTPS) | [deploy link] | MP blocked (mixed content) |

## 📖 Documentation

- 📦 [Modding Guide](docs/MODDING.md) - วิธีสร้าง mod
- 🌐 [Deploy Guide](docs/DEPLOY.md) - วิธี deploy ไป VPS
- 🏗️ [Architecture](docs/ARCHITECTURE.md) - โครงสร้างโค้ด

## 🎯 Key Constraints (Design Decisions)

- ✅ **No CDN, no library** - เปิดได้บนเครื่อง offline 100%
- ✅ **Single HTML file** - แชร์/ฝังง่าย เปิดได้ทุก browser
- ✅ **No account, no cloud save** - เก็บ localStorage ทั้งหมด
- ✅ **All assets procedural** - ไม่มีภาพ/เสียง external

## 🔑 Keyboard Controls

| Key | Action |
|-----|--------|
| `W A S D` | เดิน |
| `Space` | กระโดด / บินขึ้น |
| `Shift` | วิ่ง |
| `F` | บิน (toggle) |
| `Mouse` | มองรอบทิศ / ทุบ-วาง |
| `E` | เปิด Inventory |
| `C` | เปิด Crafting |
| `B` | เปิด Achievements |
| `T` | แชท (multiplayer) |
| `1-9, 0` | เลือกช่อง Hotbar |
| `Esc` | ปิด Modal / หยุดชั่วคราว |

## 🐛 Known Issues

- **HTTPS blocks multiplayer** (browser mixed content). ใช้ HTTP URL เพื่อเล่นออนไลน์
- **Cloudflare proxy blocks WebSocket upgrade** — ใช้ direct VPS IP (103.253.75.161:3109)

## 📝 License

MIT - ใช้/แก้ไข/แจกจ่ายได้ตามสบาย

## 🙏 Credits

Built with ❤️ using vanilla WebGL by lnwsj
