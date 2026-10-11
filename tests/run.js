// Unit tests for the game's pure logic — executed against the REAL source
// files in src/js (not copies), so they can't drift from the shipped game.
// Run: node tests/run.js
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src', 'js');
const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');

let pass = true, failed = 0, total = 0;
function check(label, cond, extra = '') {
  total++;
  if (cond) console.log('PASS  ' + label + (extra ? '  [' + extra + ']' : ''));
  else { console.log('FAIL  ' + label + (extra ? '  [' + extra + ']' : '')); pass = false; failed++; }
}
function grabFn(code, name) {
  const start = code.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('cannot find function ' + name);
  let depth = 0;
  const begin = code.indexOf('{', start);
  for (let i = begin; i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') { depth--; if (depth === 0) return code.slice(start, i + 1); }
  }
  throw new Error('unbalanced ' + name);
}
function grabConst(code, name) {
  const start = code.indexOf('const ' + name + ' = ');
  if (start < 0) throw new Error('cannot find const ' + name);
  let depth = 0;
  const begin = code.indexOf('{', start);
  for (let i = begin; i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') { depth--; if (depth === 0) return code.slice(start, i + 1); }
  }
  throw new Error('unbalanced ' + name);
}
const b64 = { btoa: s => Buffer.from(s, 'binary').toString('base64'), atob: s => Buffer.from(s, 'base64').toString('binary') };

// ---------------------------------------------------------------- 010-config
const code010 = read('010-config.js');
const cfg = new Function('localStorage', code010 + '\nreturn { CFG, B, TRANSPARENT, rleEncodeU8, rleDecodeU8 };')(
  { getItem: () => null, setItem: () => {}, removeItem: () => {} });
check('010 loads standalone (no DOM at module scope)', !!cfg.CFG && !!cfg.B && !!cfg.TRANSPARENT);
check('world dims are 64x64x36', cfg.CFG.WORLD_W === 64 && cfg.CFG.WORLD_D === 64 && cfg.CFG.WORLD_H === 36);

// RLE roundtrip on synthetic inputs
{
  // deterministic PRNG for test data (stable runs, no Math.random)
  let seed = 42;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xffffffff; };
  const cases = [
    ['all-zero', new Uint8Array(147456)],
    ['runs', Uint8Array.from({ length: 147456 }, (_, i) => (i * 7) & 3)],
    ['noise', Uint8Array.from({ length: 20000 }, () => rnd() * 256 | 0)],
  ];
  for (const [label, src] of cases) {
    const enc = cfg.rleEncodeU8(src);
    const out = new Uint8Array(src.length);
    let ok = cfg.rleDecodeU8(enc, out);
    for (let i = 0; ok && i < src.length; i++) if (src[i] !== out[i]) ok = false;
    check('RLE roundtrip: ' + label, ok);
  }
  check('RLE rejects truncated payload', cfg.rleDecodeU8('AAAA', new Uint8Array(100)) === false);
}

// ---------------------------------------------------------------- 030-world
const code030 = read('030-world.js');
function makeGen() {
  return new Function('CFG', 'B', 'TRANSPARENT', 'markChunkDirty',
    code030 + '\nreturn { generateWorld, getBlock, world, findSpawn };')(
    cfg.CFG, cfg.B, cfg.TRANSPARENT, () => {});
}
{
  const g1 = makeGen(), g2 = makeGen(), g3 = makeGen();
  g1.generateWorld(123456789);
  g2.generateWorld(123456789);   // same seed
  g3.generateWorld(987654321);   // different seed
  let same = true, diff = false, nonAir = 0;
  for (let i = 0; i < g1.world.length; i++) {
    if (g1.world[i] !== g2.world[i]) same = false;
    if (g1.world[i] !== g3.world[i]) diff = true;
    if (g1.world[i] !== 0) nonAir++;
  }
  check('worldgen deterministic per seed', same);
  check('worldgen differs across seeds', diff);
  check('generated world is mostly solid (>30k blocks)', nonAir > 30000, `nonAir=${nonAir}`);
  const sp = g1.findSpawn();
  check('findSpawn returns in-bounds position',
    sp.x >= 0 && sp.x < 64 && sp.z >= 0 && sp.z < 64 && sp.y > 0 && sp.y < 36);
  // RLE of a REAL world should compress well (what MP sync relies on)
  const enc = cfg.rleEncodeU8(g1.world);
  const jsonLen = JSON.stringify(Array.from(g1.world)).length;
  check('real-world RLE compresses for MP sync', enc.length < jsonLen * 0.5,
    `rle=${(enc.length / 1024).toFixed(1)}KB vs json=${(jsonLen / 1024).toFixed(1)}KB`);
}

// ---------------------------------------------------------------- 080-editor
const code080 = read('080-editor-ai.js');
{
  const mod = new Function('btoa', 'atob',
    grabConst(code080, 'BLOCK_DEFS') + '\n' + grabFn(code080, 'validateAIScript') +
    '\nreturn { BLOCK_DEFS, validateAIScript };')(b64.btoa, b64.atob);
  check('BLOCK_DEFS includes Phase-3 opcodes',
    !!mod.BLOCK_DEFS.place_at && !!mod.BLOCK_DEFS.fill && !!mod.BLOCK_DEFS.while_block);
  const good = { scripts: [{ id: 's', type: 'on_start', params: {}, next: {
    id: 'b', type: 'fill', params: { x1: 0, y1: 0, z1: 0, x2: 4, y2: 0, z2: 4, block: 7 }, next: null, children: null }, children: null }] };
  check('validateAIScript accepts fill script', mod.validateAIScript(good).ok === true);
  check('validateAIScript rejects unknown type', mod.validateAIScript({ scripts: [{ type: 'nope', params: {} }] }).ok === false);
  check('validateAIScript rejects non-hat root', mod.validateAIScript({ scripts: [{ type: 'walk', params: {} }] }).ok === false);
  const clamped = JSON.parse(JSON.stringify(good));
  clamped.scripts[0].next.params.x2 = 9999;
  const r = mod.validateAIScript(clamped);
  check('validateAIScript clamps params', r.ok === true && r.script.scripts[0].next.params.x2 === 50);
}
{
  let scripts = [{
    id: 'hat', type: 'on_start', params: {},
    next: { id: 'walk', type: 'walk', params: {}, next: { id: 'turn', type: 'turn', params: {}, next: null, children: null }, children: null },
    children: null,
  }, {
    id: 'hat2', type: 'on_start', params: {},
    next: { id: 'rep', type: 'repeat', params: {}, children: [{ id: 'jump', type: 'jump', params: {}, next: null, children: null }], next: null },
    children: null,
  }];
  const tree = new Function('savedScripts',
    grabFn(code080, 'insertAfterBlock') + '\n' + grabFn(code080, 'removeBlockNode') +
    '\nreturn { insertAfterBlock, removeBlockNode };')(scripts);
  const n = { id: 'new', type: 'say', params: {}, next: null, children: null };
  check('insertAfterBlock mid-chain', tree.insertAfterBlock(scripts[0].next, n) === true &&
    scripts[0].next.next.id === 'new' && scripts[0].next.next.next.id === 'turn');
  check('insertAfterBlock into children', tree.insertAfterBlock(scripts[1].next.children[0], { id: 'n2' }) === true &&
    scripts[1].next.children.length === 2);
  check('insertAfterBlock refuses hat root', tree.insertAfterBlock(scripts[0], { id: 'x' }) === false);
  check('removeBlockNode relinks chain', tree.removeBlockNode(scripts[0], 'new') === true && scripts[0].next.next.id === 'turn');
}

// ---------------------------------------------------------------- 060-gameplay
// (checked as source assertions — the security policy blocks new dynamic
//  evaluation sites; the executed suites above predate it)
const code060 = read('060-gameplay.js');
{
  check('attackDamageFor: sword tiers mapped (wood/stone/modded)',
    /item === 'wooden_sword'\) return 3/.test(code060) &&
    /item === 'stone_sword'\) return 4/.test(code060) &&
    /item\.endsWith\('_sword'\)\) return 4/.test(code060));
  check('FOODS: cook chain is edible and worth it (5 > 3)',
    /pork:\s*3/.test(code060) && /cooked_pork:\s*5/.test(code060) && /bread:\s*4/.test(code060));
  check('autoFillHandSlots skips held items and non-blocks',
    /if \(!it\.name\.startsWith\('block:'\)\) continue;/.test(grabFn(code060, 'autoFillHandSlots')) &&
    /if \(handSlots\.includes\(it\.name\)\) continue;/.test(grabFn(code060, 'autoFillHandSlots')));
  check('vanilla recipe: cook pork with coal',
    /id:\s*'cooked_pork'[\s\S]*?name:\s*'pork'[\s\S]*?name:\s*'coal'/.test(code060));
  check('mobsKilled stat incremented on kill (feeds monster_hunter)',
    /stats\.mobsKilled\+\+/.test(grabFn(code060, 'damageMob')));
}

console.log(`\n${total - failed}/${total} passed` + (pass ? '' : ' — FAILURES ABOVE'));
process.exit(pass ? 0 : 1);
