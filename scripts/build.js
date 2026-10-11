// Build: assemble src/ into the distributable single-file game.
//   node scripts/build.js          → writes index.html + multiplayer/deploy/multiplayer.html
//   node scripts/build.js --check  → verify only, exit 1 if out of date
//
// src layout (all parts concatenate in sorted order to reproduce the file):
//   src/head.html   doctype + <style>
//   src/style.css   all CSS
//   src/mid.html    </style> ... <script>
//   src/js/*.js     game modules (numeric prefixes enforce order)
//   src/tail.html   </script></body></html>
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = [
  path.join(ROOT, 'index.html'),
  path.join(ROOT, 'multiplayer', 'deploy', 'multiplayer.html'),
];
const CHECK = process.argv.includes('--check');

function read(...p) { return fs.readFileSync(path.join(SRC, ...p), 'utf8'); }

const jsDir = path.join(SRC, 'js');
const js = fs.readdirSync(jsDir)
  .filter(f => f.endsWith('.js'))
  .sort()
  .map(f => fs.readFileSync(path.join(jsDir, f), 'utf8'))
  .join('');

const html = read('head.html') + read('style.css') + read('mid.html') + js + read('tail.html');

if (CHECK) {
  let ok = true;
  for (const out of OUT) {
    const current = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null;
    const match = current === html;
    console.log((match ? 'up to date:' : 'STALE:'.padEnd(12)) + ' ' + path.relative(ROOT, out));
    if (!match) ok = false;
  }
  if (!ok) {
    console.error('\nBuilt output differs from src/ — run: node scripts/build.js');
    process.exit(1);
  }
} else {
  for (const out of OUT) {
    fs.writeFileSync(out, html);
    console.log('wrote ' + path.relative(ROOT, out) + ' (' + html.length + ' bytes)');
  }
}
