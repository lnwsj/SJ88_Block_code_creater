// ======================================================================
// PROCEDURAL TEXTURE ATLAS
// ======================================================================
function makeAtlas() {
  const c = document.createElement('canvas');
  c.width = CFG.ATLAS * CFG.TILE;
  c.height = CFG.ATLAS_H * CFG.TILE;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  // Fill entire atlas with opaque white so any unfilled pixels are visible (not transparent)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);

  // Helper: tile rect
  const tile = (idx, fn) => {
    const tx = (idx % CFG.ATLAS) * CFG.TILE;
    const ty = Math.floor(idx / CFG.ATLAS) * CFG.TILE;
    ctx.save();
    ctx.translate(tx, ty);
    fn(ctx, CFG.TILE, CFG.TILE);
    ctx.restore();
  };

  // Pseudo-random with seed
  let s = currentSeed >>> 0;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return (s & 0xffffff) / 0xffffff; };

  const px = (ctx, x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); };
  const noise = (x, y, salt = 0) => {
    let n = (x * 374761393 + y * 668265263 + salt * 1610612741) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 0xffffffff;
  };
  const vnoise = (x, y, salt) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf*xf*(3-2*xf), v = yf*yf*(3-2*yf);
    const a = noise(xi, yi, salt), b = noise(xi+1, yi, salt);
    const c2 = noise(xi, yi+1, salt), d = noise(xi+1, yi+1, salt);
    return a + (b-a)*u + (c2-a)*v + (a-b-c2+d)*u*v;
  };

  // Tile 0: grass-dirt side (top green strip, bottom brown)
  tile(0, (ctx, w, h) => {
    // base — smooth color zones
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (y < 3) {
        // grass top strip (3 rows of solid green)
        px(ctx, x, y, '#5fb02a');
      } else {
        // dirt — smooth variation
        const g = vnoise(x*0.3, y*0.3, 2);
        const r = 122 + g*20, gg = 87 + g*18, b = 56 + g*14;
        px(ctx, x, y, `rgb(${r|0},${gg|0},${b|0})`);
      }
    }
    // a few darker grass tufts hanging down from the green strip
    for (let i = 0; i < 4; i++) {
      const x = (rand()*w)|0;
      px(ctx, x, 3, '#4a8a1e');
    }
  });

  // Tile 1: grass top — smooth lush green
  tile(1, (ctx, w, h) => {
    // base solid green with subtle low-frequency variation
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const g = vnoise(x*0.15, y*0.15, 3);
      const r = 60 + g*25, gg = 140 + g*30, b = 35 + g*15;
      px(ctx, x, y, `rgb(${r|0},${gg|0},${b|0})`);
    }
    // tiny darker speckles (grass clumps) — only ~8 of them, not 18
    for (let i = 0; i < 8; i++) {
      const x = (rand()*w)|0, y = (rand()*h)|0;
      px(ctx, x, y, '#4a8a1e');
    }
    // a few brighter highlights
    for (let i = 0; i < 4; i++) {
      const x = (rand()*w)|0, y = (rand()*h)|0;
      px(ctx, x, y, '#7ec838');
    }
  });

  // Tile 2: dirt
  tile(2, (ctx, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const g = vnoise(x*0.8, y*0.8, 4);
      const r = 105 + g*35, gg = 70 + g*30, b = 40 + g*20;
      px(ctx, x, y, `rgb(${r|0},${gg|0},${b|0})`);
    }
    for (let i = 0; i < 20; i++) {
      const x = (rand()*w)|0, y = (rand()*h)|0;
      px(ctx, x, y, rand() > 0.5 ? '#6e4a25' : '#8c6438');
    }
  });

  // Tile 3: stone
  tile(3, (ctx, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const g = vnoise(x*0.5, y*0.5, 5);
      const r = 110 + g*40, gg = 110 + g*40, b = 115 + g*40;
      px(ctx, x, y, `rgb(${r|0},${gg|0},${b|0})`);
    }
    for (let i = 0; i < 25; i++) {
      const x = (rand()*w)|0, y = (rand()*h)|0;
      px(ctx, x, y, rand() > 0.5 ? '#5a5a5e' : '#c8c8cc');
    }
  });

  // Tile 4: sand
  tile(4, (ctx, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const g = vnoise(x*0.7, y*0.7, 6);
      const r = 215 + g*25, gg = 195 + g*25, b = 130 + g*30;
      px(ctx, x, y, `rgb(${r|0},${gg|0},${b|0})`);
    }
    for (let i = 0; i < 15; i++) {
      const x = (rand()*w)|0, y = (rand()*h)|0;
      px(ctx, x, y, rand() > 0.5 ? '#d4b870' : '#fff0c0');
    }
  });

  // Tile 5: wood side (bark)
  tile(5, (ctx, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const g = vnoise(x*0.3, y*0.3, 7);
      const r = 75 + g*40, gg = 50 + g*25, b = 25 + g*15;
      px(ctx, x, y, `rgb(${r|0},${gg|0},${b|0})`);
    }
    // bark lines
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const stripe = (Math.sin(y*0.8 + Math.sin(x*0.1)*2) + 1) * 0.5;
      if (stripe > 0.7) px(ctx, x, y, '#3a2410');
    }
  });

  // Tile 6: wood top (rings)
  tile(6, (ctx, w, h) => {
    ctx.fillStyle = '#9c7038';
    ctx.fillRect(0, 0, w, h);
    const cx = w/2, cy = h/2;
    for (let r = 1; r < 8; r++) {
      ctx.strokeStyle = r % 2 ? '#6a4820' : '#b88848';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const segs = 16;
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        const rr = r + Math.sin(a*3 + r)*0.3;
        const x = cx + Math.cos(a)*rr*1.2;
        const y = cy + Math.sin(a)*rr;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });

  // Tile 7: leaves
  tile(7, (ctx, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const g = vnoise(x*0.9, y*0.9, 8);
      const r = 35 + g*40, gg = 95 + g*60, b = 25 + g*25;
      px(ctx, x, y, `rgb(${r|0},${gg|0},${b|0})`);
    }
    for (let i = 0; i < 30; i++) {
      const x = (rand()*w)|0, y = (rand()*h)|0;
      px(ctx, x, y, rand() > 0.5 ? '#4ea228' : '#0a3a08');
    }
  });

  // Tile 8: planks
  tile(8, (ctx, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const g = vnoise(x*0.4, y*0.4, 9);
      const r = 175 + g*30, gg = 130 + g*30, b = 75 + g*25;
      px(ctx, x, y, `rgb(${r|0},${gg|0},${b|0})`);
    }
    // plank lines
    ctx.strokeStyle = '#6a4818';
    ctx.lineWidth = 1;
    for (let y = 4; y < h; y += 4) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    for (let x = 0; x < w; x += 8) {
      const yy = ((x/8)|0) * 4;
      ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x, yy+4); ctx.stroke();
    }
  });

  // Tile 9: cobblestone
  tile(9, (ctx, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const g = vnoise(x*0.6, y*0.6, 10);
      const r = 100 + g*45, gg = 100 + g*45, b = 105 + g*45;
      px(ctx, x, y, `rgb(${r|0},${gg|0},${b|0})`);
    }
    // stone borders
    ctx.strokeStyle = '#3a3a3e';
    for (let i = 0; i < 5; i++) {
      const y = (i*4) % h;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    for (let i = 0; i < 4; i++) {
      const x = (i*5 + (i%2)*2) % w;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
  });

  // Tile 10: bedrock
  tile(10, (ctx, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const g = vnoise(x*0.5, y*0.5, 11);
      const r = 35 + g*30, gg = 35 + g*30, b = 40 + g*30;
      px(ctx, x, y, `rgb(${r|0},${gg|0},${b|0})`);
    }
    for (let i = 0; i < 30; i++) {
      const x = (rand()*w)|0, y = (rand()*h)|0;
      px(ctx, x, y, rand() > 0.5 ? '#1a1a1e' : '#707075');
    }
  });

  // Tile 11: snow
  tile(11, (ctx, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const g = vnoise(x*0.6, y*0.6, 12);
      const v = 235 + g*20;
      px(ctx, x, y, `rgb(${v|0},${(v+2)|0},${(v+5)|0})`);
    }
    for (let i = 0; i < 12; i++) {
      const x = (rand()*w)|0, y = (rand()*h)|0;
      px(ctx, x, y, '#ffffff');
    }
  });

  // Tile 12: brick
  tile(12, (ctx, w, h) => {
    ctx.fillStyle = '#8a3a20';
    ctx.fillRect(0, 0, w, h);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const g = vnoise(xx*0.5, yy*0.5, 13);
      const r = 140 + g*30;
      if (g < 0.3) px(ctx, xx, yy, '#5a2010');
    }
    ctx.fillStyle = '#3a1a08';
    for (let yy = 0; yy < h; yy += 4) ctx.fillRect(0, yy, w, 1);
    for (let xx = 0; xx < w; xx += 8) {
      const off = (Math.floor(xx/8) % 2) ? 4 : 0;
      ctx.fillRect(((xx+off)%w), 0, 1, h);
    }
  });

  // Tile 13: pumpkin top
  tile(13, (ctx, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const g = vnoise(x*0.6, y*0.6, 14);
      const r = 220 + g*25, gg = 130 + g*30, b = 30 + g*20;
      px(ctx, x, y, `rgb(${r|0},${gg|0},${b|0})`);
    }
  });

  // Tile 14: pumpkin side (with face)
  tile(14, (ctx, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const g = vnoise(x*0.6, y*0.6, 15);
      const r = 215 + g*30, gg = 125 + g*30, b = 25 + g*20;
      px(ctx, x, y, `rgb(${r|0},${gg|0},${b|0})`);
    }
    // vertical ridges
    for (let x = 2; x < w; x += 5) {
      for (let y = 0; y < h; y++) {
        if (x < w) {
          const cur = ctx.getImageData(((x%w)*1), y, 1, 1).data;
          // darker
          px(ctx, x, y, `rgb(${cur[0]*0.6|0},${cur[1]*0.6|0},${cur[2]*0.6|0})`);
        }
      }
    }
    // face: eyes & mouth
    ctx.fillStyle = '#1a0a00';
    ctx.fillRect(4, 5, 3, 3); ctx.fillRect(9, 5, 3, 3);
    ctx.fillRect(3, 10, 10, 2); ctx.fillRect(4, 9, 1, 1); ctx.fillRect(11, 9, 1, 1);
  });

  // Tile 15: water (translucent blue)
  tile(15, (ctx, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const g = vnoise(x*0.6, y*0.6, 16);
      const r = 30 + g*25, gg = 90 + g*40, b = 180 + g*50;
      // Use rgba with alpha < 1 for transparency
      ctx.fillStyle = `rgba(${r|0},${gg|0},${b|0},0.7)`;
      ctx.fillRect(x, y, 1, 1);
    }
    // wave highlights
    for (let i = 0; i < 12; i++) {
      const x = (rand()*w)|0, y = (rand()*h)|0;
      ctx.fillStyle = 'rgba(160,216,255,0.85)';
      ctx.fillRect(x, y, 1, 1);
    }
  });

  // ============== TIER 1 NEW TILES (16-31) ==============

  // Tile 16: glass (translucent)
  tile(16, (ctx, w, h) => {
    // base semi-transparent
    ctx.fillStyle = 'rgba(200, 220, 240, 0.35)';
    ctx.fillRect(0, 0, w, h);
    // border
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w-1, h-1);
    // diagonal shine
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(2, 2, 4, 1);
    ctx.fillRect(3, 3, 3, 1);
  });

  // Tile 17: torch
  tile(17, (ctx, w, h) => {
    // base wood stick
    ctx.fillStyle = '#8c5a2c';
    ctx.fillRect(7, 8, 2, 8);
    // top
    ctx.fillStyle = '#5a3818';
    ctx.fillRect(7, 8, 2, 1);
    // flame (yellow)
    ctx.fillStyle = '#ffd800';
    ctx.fillRect(7, 4, 2, 3);
    ctx.fillStyle = '#ff7a00';
    ctx.fillRect(7, 6, 2, 1);
    // outer glow
    ctx.fillStyle = 'rgba(255,180,40,0.3)';
    ctx.fillRect(5, 3, 6, 6);
  });

  // Tile 18: door side (wood planks vertical)
  tile(18, (ctx, w, h) => {
    ctx.fillStyle = '#9c6a30';
    ctx.fillRect(0, 0, w, h);
    // vertical planks
    ctx.fillStyle = '#6e4818';
    for (let x = 0; x < w; x += 4) ctx.fillRect(x, 0, 1, h);
    // handle
    ctx.fillStyle = '#3a2410';
    ctx.fillRect(11, 8, 2, 2);
    // panels
    ctx.strokeStyle = '#5a3818';
    ctx.lineWidth = 1;
    ctx.strokeRect(2, 3, 4, 5);
    ctx.strokeRect(8, 3, 4, 5);
  });

  // Tile 19: door top/bottom (wood end)
  tile(19, (ctx, w, h) => {
    ctx.fillStyle = '#8c5a2c';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#6e4818';
    for (let y = 0; y < h; y += 2) ctx.fillRect(0, y, w, 1);
  });

  // Tile 20: cactus
  tile(20, (ctx, w, h) => {
    // base green
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const g = vnoise(x*0.4, y*0.4, 17);
      const r = 40 + g*30, gg = 110 + g*30, b = 35 + g*15;
      px(ctx, x, y, `rgb(${r|0},${gg|0},${b|0})`);
    }
    // edges
    ctx.fillStyle = '#1a4010';
    ctx.fillRect(0, 0, 1, h);
    ctx.fillRect(w-1, 0, 1, h);
    // spines
    for (let i = 0; i < 6; i++) {
      const y = (rand()*h)|0;
      px(ctx, 1, y, '#f0e060');
      px(ctx, w-2, y, '#f0e060');
    }
  });

  // Tile 21: sandstone
  tile(21, (ctx, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const g = vnoise(x*0.5, y*0.5, 18);
      const r = 200 + g*25, gg = 175 + g*25, b = 105 + g*30;
      px(ctx, x, y, `rgb(${r|0},${gg|0},${b|0})`);
    }
    // horizontal lines
    ctx.fillStyle = '#a08850';
    for (let y = 3; y < h; y += 4) ctx.fillRect(0, y, w, 1);
  });

  // Tile 22: ice
  tile(22, (ctx, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const g = vnoise(x*0.4, y*0.4, 19);
      const r = 130 + g*30, gg = 200 + g*25, b = 230 + g*25;
      px(ctx, x, y, `rgb(${r|0},${gg|0},${b|0})`);
    }
    // cracks
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(2, 4, 3, 1);
    ctx.fillRect(10, 9, 4, 1);
    ctx.fillRect(5, 13, 2, 1);
  });

  // Tile 23: ore coal (on stone)
  tile(23, (ctx, w, h) => {
    // stone base
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const g = vnoise(x*0.5, y*0.5, 5);
      const r = 110 + g*40, gg = 110 + g*40, b = 115 + g*40;
      px(ctx, x, y, `rgb(${r|0},${gg|0},${b|0})`);
    }
    // coal chunks (black with slight shine)
    for (let i = 0; i < 5; i++) {
      const cx = (rand()*w)|0, cy = (rand()*h)|0;
      for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
        if (rand() > 0.3) px(ctx, cx+dx, cy+dy, '#0a0a0a');
      }
      px(ctx, cx, cy, '#3a3a3a');
    }
  });

  // Tile 24: ore iron (stone with tan flecks)
  tile(24, (ctx, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const g = vnoise(x*0.5, y*0.5, 5);
      const r = 110 + g*40, gg = 110 + g*40, b = 115 + g*40;
      px(ctx, x, y, `rgb(${r|0},${gg|0},${b|0})`);
    }
    for (let i = 0; i < 5; i++) {
      const cx = (rand()*w)|0, cy = (rand()*h)|0;
      for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
        if (rand() > 0.3) px(ctx, cx+dx, cy+dy, '#c8a878');
      }
      px(ctx, cx, cy, '#e8d0a0');
    }
  });

  // Tile 25: ore gold
  tile(25, (ctx, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const g = vnoise(x*0.5, y*0.5, 5);
      const r = 110 + g*40, gg = 110 + g*40, b = 115 + g*40;
      px(ctx, x, y, `rgb(${r|0},${gg|0},${b|0})`);
    }
    for (let i = 0; i < 5; i++) {
      const cx = (rand()*w)|0, cy = (rand()*h)|0;
      for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
        if (rand() > 0.3) px(ctx, cx+dx, cy+dy, '#e8c040');
      }
      px(ctx, cx, cy, '#fff080');
    }
  });

  // Tile 26: ore diamond
  tile(26, (ctx, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const g = vnoise(x*0.5, y*0.5, 5);
      const r = 110 + g*40, gg = 110 + g*40, b = 115 + g*40;
      px(ctx, x, y, `rgb(${r|0},${gg|0},${b|0})`);
    }
    for (let i = 0; i < 5; i++) {
      const cx = (rand()*w)|0, cy = (rand()*h)|0;
      for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
        if (rand() > 0.3) px(ctx, cx+dx, cy+dy, '#5cd0e8');
      }
      px(ctx, cx, cy, '#a0f0ff');
    }
  });

  // Tile 27: glowstone
  tile(27, (ctx, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const g = vnoise(x*0.5, y*0.5, 20);
      const r = 230 + g*20, gg = 200 + g*25, b = 100 + g*30;
      px(ctx, x, y, `rgb(${r|0},${gg|0},${b|0})`);
    }
    // bright spots
    for (let i = 0; i < 6; i++) {
      const x = (rand()*w)|0, y = (rand()*h)|0;
      px(ctx, x, y, '#fff8b0');
    }
  });

  // Tile 28: crafting table top
  tile(28, (ctx, w, h) => {
    ctx.fillStyle = '#9c6a30';
    ctx.fillRect(0, 0, w, h);
    // tools icon (hammer + saw)
    ctx.fillStyle = '#3a2410';
    ctx.fillRect(3, 4, 3, 1);  // hammer head
    ctx.fillRect(5, 5, 1, 2);
    ctx.fillRect(4, 7, 2, 1);
    // saw
    ctx.fillRect(8, 4, 5, 1);
    ctx.fillRect(8, 5, 1, 2);
    for (let x = 9; x < 13; x++) ctx.fillRect(x, 7, 1, 1);
    // grid dots
    ctx.fillStyle = '#5a3818';
    px(ctx, 2, 12, '#5a3818'); px(ctx, 6, 12, '#5a3818');
    px(ctx, 10, 12, '#5a3818'); px(ctx, 13, 12, '#5a3818');
  });

  // Tile 29: crafting table side
  tile(29, (ctx, w, h) => {
    // wood planks
    ctx.fillStyle = '#8c5a2c';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#6e4818';
    for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
    for (let x = 0; x < w; x += 8) {
      const off = (Math.floor(x/8) % 2) ? 4 : 0;
      ctx.fillRect(x, off, 1, 4);
    }
    // drawer handles
    ctx.fillStyle = '#3a2410';
    ctx.fillRect(6, 4, 4, 1);
    ctx.fillRect(6, 9, 4, 1);
  });

  // Tile 30: lever
  tile(30, (ctx, w, h) => {
    // base plate
    ctx.fillStyle = '#5a3818';
    ctx.fillRect(5, 8, 6, 4);
    // stick
    ctx.fillStyle = '#8c5a2c';
    ctx.fillRect(7, 6, 2, 2);
    // knob
    ctx.fillStyle = '#c84020';
    ctx.fillRect(7, 4, 2, 2);
  });

  // Tile 31: pressure plate
  tile(31, (ctx, w, h) => {
    // flat gold plate
    ctx.fillStyle = '#e8c040';
    ctx.fillRect(1, 6, 14, 4);
    ctx.fillStyle = '#fff080';
    ctx.fillRect(2, 7, 12, 1);
    ctx.fillStyle = '#a08020';
    ctx.fillRect(1, 9, 14, 1);
  });

  // ===== ROW 4 (tiles 32-39): Tier 2 blocks =====
  // Tile 32: CHEST side (front of chest)
  tile(32, (ctx, w, h) => {
    // wood plank base
    ctx.fillStyle = '#9c6a30';
    ctx.fillRect(0, 0, w, h);
    // horizontal planks
    ctx.fillStyle = '#7c4a20';
    for (let i = 3; i < 16; i += 3) ctx.fillRect(0, i, w, 1);
    // metal corners
    ctx.fillStyle = '#5a3a18';
    ctx.fillRect(0, 0, 1, h);
    ctx.fillRect(w-1, 0, 1, h);
    // lock
    ctx.fillStyle = '#ffd800';
    ctx.fillRect(7, 7, 2, 3);
    ctx.fillStyle = '#a08000';
    ctx.fillRect(8, 9, 1, 1);
  });
  // Tile 33: CHEST top (lid)
  tile(33, (ctx, w, h) => {
    ctx.fillStyle = '#9c6a30';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#7c4a20';
    ctx.fillRect(0, 0, w, 1);
    ctx.fillRect(0, 7, w, 1);
    ctx.fillStyle = '#5a3a18';
    ctx.fillRect(0, 8, w, 1);
    // handle/lock
    ctx.fillStyle = '#5a3a18';
    ctx.fillRect(6, 3, 4, 1);
    ctx.fillRect(6, 6, 4, 1);
  });
  // Tile 34: CHEST bottom
  tile(34, (ctx, w, h) => {
    ctx.fillStyle = '#7c4a20';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#5a3a18';
    ctx.fillRect(0, 0, w, 1);
    ctx.fillRect(0, h-1, w, 1);
  });
  // Tile 35: FURNACE side (furnace front with mouth)
  tile(35, (ctx, w, h) => {
    // stone base
    ctx.fillStyle = '#5a5a5a';
    ctx.fillRect(0, 0, w, h);
    // darker top
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, 0, w, 3);
    // mouth (fire hole)
    ctx.fillStyle = '#1a0a0a';
    ctx.fillRect(3, 7, 10, 7);
    // fire glow
    ctx.fillStyle = '#ff7700';
    ctx.fillRect(4, 9, 8, 4);
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(5, 10, 6, 2);
    ctx.fillStyle = '#ffee00';
    ctx.fillRect(6, 11, 4, 1);
    // frame
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(2, 6, 12, 1);
    ctx.fillRect(2, 14, 12, 1);
  });
  // Tile 36: FURNACE top
  tile(36, (ctx, w, h) => {
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#5a5a5a';
    ctx.fillRect(0, 0, w, 1);
    ctx.fillRect(0, h-1, w, 1);
    // hole
    ctx.fillStyle = '#1a0a0a';
    ctx.fillRect(4, 4, 8, 8);
  });
  // Tile 37: FURNACE bottom
  tile(37, (ctx, w, h) => {
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, w, 1);
    ctx.fillRect(0, h-1, w, 1);
  });

  return c;
}

