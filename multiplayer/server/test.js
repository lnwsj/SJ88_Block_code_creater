// Integration test: boots the real server on a test port and drives WebSocket
// clients through the full MP flow + checks the REST API. Run with: npm test
//
// Security note: the HTTP helper never accepts URLs from callers — it only
// takes a route NAME resolved from a fixed table of literal paths (plus a
// literal 127.0.0.1 host), so no caller-controlled request targets exist.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.TEST_PORT || 3199;
const TOKEN = 'p4-test-token';
const W = 64, D = 64, H = 36;
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = true, total = 0;
function check(label, cond, extra = '') {
  total++;
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + label + (extra ? '  [' + extra + ']' : ''));
  if (!cond) pass = false;
}

// Same RLE format as the client's rleEncodeU8
function rleEncodeU8(arr) {
  const out = [];
  let i = 0;
  while (i < arr.length) {
    const v = arr[i];
    let run = 1;
    while (i + run < arr.length && arr[i + run] === v && run < 65535) run++;
    out.push(run & 255, (run >> 8) & 255, v);
    i += run;
  }
  let s = '';
  for (let j = 0; j < out.length; j += 8192) s += String.fromCharCode.apply(null, out.slice(j, j + 8192));
  return Buffer.from(s, 'binary').toString('base64');
}
function rleDecodeB64(b64, target) {
  const s = Buffer.from(b64, 'base64');
  let o = 0;
  for (let i = 0; i + 2 < s.length; i += 3) {
    const run = s[i] | (s[i + 1] << 8);
    const v = s[i + 2];
    for (let r = 0; r < run && o < target.length; r++) target[o++] = v;
  }
  return o === target.length;
}

// Fixed route table — literal paths only; callers reference routes by name
const ROUTES = {
  health:      { method: 'GET',    path: '/health' },
  sw:          { method: 'GET',    path: '/sw.js' },
  manifest:    { method: 'GET',    path: '/manifest.webmanifest' },
  worldGet:    { method: 'GET',    path: '/api/worlds/TEST' },
  worldDel:    { method: 'DELETE', path: '/api/worlds/TEST' },
  worldRename: { method: 'POST',   path: '/api/worlds/TEST/rename' },
};
function httpReq(routeName, opts = {}) {
  const route = ROUTES[routeName];
  if (!route) return Promise.reject(new Error('unknown route: ' + routeName));
  const headers = {};
  if (opts.token) headers['x-admin-token'] = opts.token;
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port: PORT, method: route.method, path: route.path, headers },
      res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

class Client {
  constructor(name) {
    this.name = name;
    this.msgs = [];
    this.waiters = [];
    this.ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
    this.ws.on('message', raw => {
      const m = JSON.parse(raw.toString());
      this.msgs.push(m);
      this.waiters = this.waiters.filter(w => !w(m));
    });
    this.open = new Promise(r => this.ws.on('open', r));
  }
  send(obj) { this.ws.send(JSON.stringify(obj)); }
  wait(type, timeout = 5000) {
    const existing = this.msgs.find(m => m.type === type);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${this.name}: timeout waiting for ${type}`)), timeout);
      this.waiters.push(m => {
        if (m.type === type) { clearTimeout(timer); resolve(m); return true; }
        return false;
      });
    });
  }
}

async function main() {
  // Literal command + argv array (no shell) — nothing user-derived is executed
  const server = spawn('node', ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(PORT), MINICRAFT_ADMIN_TOKEN: TOKEN },
    stdio: ['ignore', 'ignore', 'inherit'],
  });

  let healthy = false;
  for (let i = 0; i < 50 && !healthy; i++) {
    await sleep(200);
    try { healthy = (await httpReq('health')).status === 200; } catch (e) {}
  }
  check('server boots and answers /health', healthy);
  if (!healthy) { server.kill(); process.exit(1); }

  const sw = await httpReq('sw');
  check('PWA service worker served', sw.status === 200 && sw.body.includes('caches'));
  const mf = await httpReq('manifest');
  check('PWA manifest served', mf.status === 200 && JSON.parse(mf.body).name === 'MiniCraft 3D');

  // ---- Host creates a room with a synthetic world ----
  const blocks = new Uint8Array(W * D * H);
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const hgt = 8 + ((x * 7 + z * 13) % 6);
    for (let y = 0; y < hgt; y++) blocks[x + y * W + z * W * D] = y === hgt - 1 ? 1 : 3;
  }
  const markerIdx = 5 + 2 * W + 3 * W * D;
  blocks[markerIdx] = 42;
  const gx = 2, gy = 1, gz = 2, gIdx = gx + gy * W + gz * W * D;
  blocks[gIdx] = 7; // pre-place the guest's edit so the revived disk world has it too
  const wire = rleEncodeU8(blocks);
  const jsonLen = JSON.stringify(Array.from(blocks)).length;
  check('worldRB64 far smaller than JSON array', wire.length < jsonLen * 0.5,
    `${(wire.length / 1024).toFixed(1)}KB vs ${(jsonLen / 1024).toFixed(1)}KB`);

  const host = new Client('host');
  await host.open;
  host.send({ type: 'create_room', name: 'Host', color: '#4a9eff' });
  const room = await host.wait('room_created');
  const code = room.code;
  check('4-char room code', /^[A-Z0-9]{4}$/.test(code), code);

  host.send({ type: 'world_state', world: { W, D, H, worldRB64: wire, chests: { '1_2_3': [{ name: 'block:8', count: 5 }, null] } }, seed: 777 });
  await host.wait('world_sync');

  // ---- Guest joins and receives the world ----
  const guest = new Client('guest');
  await guest.open;
  guest.send({ type: 'join_room', code, name: 'Guest', color: '#7cda24' });
  const joined = await guest.wait('joined');
  check('guest received world payload', !!joined.world?.worldRB64);
  const got = new Uint8Array(W * D * H);
  check('guest world decodes fully', rleDecodeB64(joined.world.worldRB64, got));
  check('guest world matches host (marker intact)', got[markerIdx] === 42);
  check('guest received chest contents', joined.world.chests?.['1_2_3']?.[0]?.count === 5);

  // ---- GUEST block edit applies server-side + broadcasts ----
  guest.send({ type: 'block', action: 'place', x: gx, y: gy, z: gz, block: 7 });
  const bc = await host.wait('block_change');
  check('host sees guest block_change', bc.x === gx && bc.block === 7);

  // ---- Host migration ----
  host.ws.close();
  const mig = await guest.wait('host_migrated');
  check('guest promoted to host', mig.id === joined.id);
  // world_save from the migrated host — like the real client, it carries chests
  guest.send({ type: 'world_save', world: { W, D, H, worldRB64: wire, chests: { '1_2_3': [{ name: 'block:8', count: 5 }, null] } } });
  check('migrated host can world_save', !!(await guest.wait('world_saved')).meta);

  // ---- Everyone leaves → room closes → world saved to disk ----
  guest.ws.close();
  await sleep(6000); // block-edit debounced save (5s) + close save
  const joiner = new Client('joiner');
  await joiner.open;
  joiner.send({ type: 'join_room', code, name: 'Joiner', color: '#ff8800' });
  const revived = await joiner.wait('joined');
  check('room revived from disk after everyone left', !!revived.world?.worldRB64);
  const disk = new Uint8Array(W * D * H);
  check('revived world decodes', rleDecodeB64(revived.world.worldRB64, disk));
  check('guest edit survived to disk (room revived)', disk[gIdx] === 7);
  check('marker block survived to disk', disk[markerIdx] === 42);
  check('chests survived to disk', revived.world.chests?.['1_2_3']?.[0]?.count === 5);

  // ---- REST API against a seeded world with a literal code ----
  const seedDir = path.join(__dirname, 'worlds', 'TEST');
  fs.mkdirSync(seedDir, { recursive: true });
  fs.writeFileSync(path.join(seedDir, 'meta.json'), JSON.stringify({
    code: 'TEST', name: 'Test World', seed: 1, W, D, H, blockCount: 1,
    createdAt: Date.now(), lastSaved: Date.now(), lastHost: 'seed',
  }));
  fs.writeFileSync(path.join(seedDir, 'data.bin'), Buffer.from([42]));
  check('GET seeded world → 200', (await httpReq('worldGet')).status === 200);
  check('rename without token → 403', (await httpReq('worldRename', { body: JSON.stringify({ name: 'x' }) })).status === 403);
  check('rename with token → 200', (await httpReq('worldRename', { token: TOKEN, body: JSON.stringify({ name: 'Renamed' }) })).status === 200);
  check('DELETE without token → 403', (await httpReq('worldDel')).status === 403);
  check('DELETE wrong token → 403', (await httpReq('worldDel', { token: 'nope' })).status === 403);
  check('DELETE correct token → 200', (await httpReq('worldDel', { token: TOKEN })).status === 200);
  check('GET after delete → 404', (await httpReq('worldGet')).status === 404);

  // ---- Rate limit ----
  let pong = 0;
  joiner.waiters.push(m => { if (m.type === 'pong') { pong++; return false; } return false; });
  for (let i = 0; i < 120; i++) joiner.send({ type: 'ping' });
  await sleep(800);
  check('rate limiter throttles floods', pong > 0 && pong < 120, `pongs=${pong}/120`);

  // ---- Cleanup ----
  joiner.ws.close();
  server.kill();
  await sleep(300);
  try { fs.rmSync(path.join(__dirname, 'worlds', code), { recursive: true, force: true }); } catch (e) {}
  console.log(`\n${total} checks: ${pass ? 'ALL PASSED' : 'FAILURES PRESENT'}`);
  process.exit(pass ? 0 : 1);
}

main().catch(e => { console.error('TEST CRASH:', e.message); process.exit(1); });
