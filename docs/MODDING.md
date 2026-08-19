# 📦 Modding Guide

คู่มือสร้าง mod สำหรับ MiniCraft 3D

## 🚀 Quick Start

1. เปิดเกม → กด **"📦 Mods"**
2. กด **"📝 โหลดตัวอย่าง"** เพื่อดูตัวอย่าง
3. กด **"📥 ติดตั้ง"** เพื่อเพิ่มเข้าเกม
4. กด **C** → เปิดคราฟต์ → เห็น recipe ใหม่

## 📝 Mod Format

Mod คือไฟล์ JSON ที่มีโครงสร้าง:

```json
{
  "id": "my_mod",
  "name": "My Mod",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "คำอธิบาย mod",
  "items": [...],
  "recipes": [...]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `id` | ✅ | unique identifier (no spaces, no "vanilla") |
| `name` | ✅ | ชื่อที่แสดงใน UI |
| `version` | ❌ | เวอร์ชั่น (default "1.0") |
| `author` | ❌ | ชื่อผู้สร้าง |
| `description` | ❌ | คำอธิบาย |
| `items` | ❌ | array ของ custom items |
| `recipes` | ❌ | array ของ crafting recipes |
| `blocks` | ❌ | (planned) array ของ custom blocks |

## 🧱 Item Format

```json
{
  "id": "ruby",
  "name": "ทับทิม",
  "color": "#c83030",
  "shape": "gem"
}
```

### Available Shapes

| Shape | Visual |
|-------|--------|
| `gem` | 🔷 เพชร 4 เหลี่ยม |
| `ingot` | 📏 แท่งเหล็ก |
| `stick` | 🪵 ไม้ขีด |
| `powder` | ⚪ กองผง |
| `food` | 🍞 อาหาร |
| `leather` | 🟫 หนัง |
| `tool_pickaxe` | ⛏ เครื่องมือขุด |
| `tool_sword` | 🗡 ดาบ |
| `potion` | 🧪 ขวดยา |
| `coin` | 🟡 เหรียญ |

## 🍳 Recipe Format

```json
{
  "id": "ruby_pickaxe",
  "name": "พลั่วทับทิม",
  "category": "tools",
  "result": { "name": "ruby_pickaxe", "count": 1 },
  "ingredients": [
    { "name": "ruby", "count": 3 },
    { "name": "stick", "count": 2 }
  ]
}
```

### Categories

| Category | Icon |
|----------|------|
| `basic` | 🪵 พื้นฐาน |
| `tools` | ⛏ เครื่องมือ |
| `building` | 🏠 ก่อสร้าง |
| `food` | 🍞 อาหาร |
| `other` | 📦 อื่นๆ |

### Ingredients & Result

`name` สามารถเป็น:
- **`"item_id"`** - item ที่กำหนดใน mod เดียวกัน หรือ vanilla items
- **`"block:N"`** - บล็อกในเกม (N = block ID 0-29)

### Vanilla Item IDs

```
stick, coal, iron_ingot, gold_ingot, diamond, bread,
wooden_pickaxe, stone_pickaxe, iron_pickaxe,
wooden_sword, stone_sword, torch_item,
pork, leather, rotten_flesh, gunpowder,
cooked_pork
```

### Block IDs

```
0=AIR, 1=GRASS, 2=DIRT, 3=STONE, 4=SAND, 5=WOOD, 6=LEAVES,
7=PLANKS, 8=COBBLE, 9=BEDROCK, 10=SNOW, 11=BRICK, 12=PUMPKIN,
13=WATER, 14=GLASS, 15=TORCH, 16=DOOR, 17=CACTUS, 18=SANDSTONE,
19=ICE, 20=ORE_COAL, 21=ORE_IRON, 22=ORE_GOLD, 23=ORE_DIAMOND,
24=GLOWSTONE, 25=CRAFTING_TABLE, 26=LEVER, 27=PRESSURE_PLATE,
28=FLOWER, 29=SAPLING
```

## 📤 Share Your Mod

1. เปิด **Mod Manager** → คลิก **📤** ที่ mod
2. JSON จะถูก copy ไปยัง clipboard
3. แชร์ใน Discord, GitHub Gist, หรือ host บน URL
4. เพื่อน paste ในช่อง **Mod JSON** แล้วกดติดตั้ง

## 🌐 Install from URL

1. Host mod JSON บน GitHub Pages, gist, หรือ server ใดๆ
2. เปิดเกม → Mods → กรอก URL → กด **"🌐 ติดตั้งจาก URL"**

ตัวอย่าง URL: `https://raw.githubusercontent.com/user/repo/main/mods/emerald.json`

## 💡 Example: Full Mod

```json
{
  "id": "emerald_gear",
  "name": "Emerald Gear",
  "version": "1.0",
  "author": "BlockMaster",
  "description": "ชุดเครื่องมือมรกตที่แข็งแกร่งกว่าเหล็ก",
  "items": [
    { "id": "emerald", "name": "มรกต", "color": "#5cc878", "shape": "gem" },
    { "id": "emerald_pickaxe", "name": "พลั่วมรกต", "color": "#5cc878", "shape": "tool_pickaxe" },
    { "id": "emerald_axe", "name": "ขวานมรกต", "color": "#5cc878", "shape": "tool_sword" }
  ],
  "recipes": [
    {
      "id": "emerald_pickaxe",
      "name": "พลั่วมรกต",
      "category": "tools",
      "result": { "name": "emerald_pickaxe", "count": 1 },
      "ingredients": [
        { "name": "emerald", "count": 3 },
        { "name": "stick", "count": 2 }
      ]
    },
    {
      "id": "emerald_axe",
      "name": "ขวานมรกต",
      "category": "tools",
      "result": { "name": "emerald_axe", "count": 1 },
      "ingredients": [
        { "name": "emerald", "count": 2 },
        { "name": "stick", "count": 1 }
      ]
    }
  ]
}
```

## ⚠️ Limitations (v3.0)

- ❌ Custom blocks ยังไม่รองรับ (blocks array เก็บไว้แต่ไม่ render)
- ❌ Custom mobs ยังไม่รองรับ
- ❌ Custom biomes ยังไม่รองรับ
- ❌ Multiplayer mods sync - mods ต้องติดตั้งทั้ง host และ guests

## 🐛 Troubleshooting

**Mod ไม่ขึ้นในตารางคราฟต์**
- ตรวจสอบ JSON syntax (ใช้ jsonlint.com)
- ตรวจสอบ `category` field

**Items แสดงเป็น gray box**
- ต้องใส่ `shape` field
- ถ้าไม่มี shape จะใช้ generic color

**Mod ติดตั้งไม่ได้**
- ดู toast เพื่อ error message
- `id` ต้องไม่ซ้ำกับ mod ที่มีอยู่
- `id` ต้องไม่ใช่ "vanilla"
