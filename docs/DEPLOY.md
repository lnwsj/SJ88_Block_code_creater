# 🌐 Deploy Guide

คู่มือ deploy MiniCraft 3D ไปยัง VPS / static hosting

## Option 1: Single-Player (Static Hosting)

แค่เปิด `index.html` ใน static server:

### GitHub Pages
```bash
git init
git add index.html
git commit -m "initial"
git push origin main
# เปิด Settings → Pages → เลือก main branch
```

### Netlify / Vercel
ลากโฟลเดอร์ที่มี `index.html` ไปวางในเว็บ

### Python HTTP server
```bash
python3 -m http.server 8000
# เปิด http://localhost:8000
```

## Option 2: Multiplayer (VPS + Node.js)

### Requirements
- Linux VPS
- Node.js 18+
- Port 3109 open (configurable via `PORT` env)

### Setup
```bash
cd multiplayer/server
npm install
node server-full.js
```

### systemd Service
```ini
# /etc/systemd/system/minicraft-mp.service
[Unit]
Description=MiniCraft 3D Multiplayer Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/minicraft-mp
ExecStart=/usr/bin/node /opt/minicraft-mp/server/server-full.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable minicraft-mp.service
systemctl start minicraft-mp.service
systemctl status minicraft-mp.service
```

### Firewall
```bash
ufw allow 3109/tcp
```

## ⚠️ Multiplayer Gotchas

### 1. WebSocket blocked by Cloudflare

ถ้าใช้ Cloudflare proxy (orange cloud) กับ subdomain, **WebSocket upgrade จะถูก block** โดย edge (istio-envoy returns 400)

**แก้**: 
- ❌ อย่าใช้ Cloudflare proxy กับ MP subdomain
- ✅ ใช้ direct VPS IP
- ✅ หรือตั้ง DNS เป็น **DNS only** (grey cloud) ใน Cloudflare

### 2. Mixed Content (HTTPS → WS)

ถ้าเกมโหลดจาก `https://` URL, browser block `ws://` (mixed content)

**แก้**:
- ✅ ใช้ HTTP URL สำหรับ MP: `http://IP:3109/`
- ✅ ตั้ง HTTPS บน VPS แล้วใช้ `wss://` (ต้องมี valid cert)

### 3. Auto-detect MP Server URL

เกมตรวจ host อัตโนมัติ:
```js
if (window.location.hostname.endsWith('space.minimax.io')) {
  // ใช้ VPS IP ตรงๆ
  return 'ws://103.253.75.161:3109/';
} else {
  // ใช้ host เดียวกัน
  return `${protocol}://${host}:3109/`;
}
```

## 🔒 HTTPS Setup (optional)

### ใช้ Certbot + Cloudflare DNS
```bash
# ติดตั้ง certbot + cloudflare plugin
apt install certbot python3-certbot-dns-cloudflare

# สร้าง /etc/cloudflare/cloudflare.ini
# dns_cloudflare_api_token = YOUR_TOKEN

# ขอ cert
certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /etc/cloudflare/cloudflare.ini \
  -d mp.example.com
```

### Nginx reverse proxy + WebSocket
```nginx
server {
  listen 443 ssl http2;
  server_name mp.example.com;
  ssl_certificate /etc/letsencrypt/live/mp.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/mp.example.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3109;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }
}
```

## 📊 Production Checklist

- [x] Port 3109 open
- [x] systemd service with Restart=always
- [x] Health check endpoint: `GET /health` → 200
- [x] Game loads at `http://IP:3109/`
- [x] WebSocket connects from same port
- [ ] (optional) HTTPS cert + nginx proxy

## 🐛 Debug Commands

```bash
# ดู logs
journalctl -u minicraft-mp.service -f

# ทดสอบ health
curl http://127.0.0.1:3109/health

# ทดสอบ WebSocket (wscat)
npm install -g wscat
wscat -c ws://127.0.0.1:3109/
```
