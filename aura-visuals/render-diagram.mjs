/* Text → React/SVG diagram → PNG → PDF.
   node render-diagram.mjs "<description>" [--out name] [--formats svg,png,pdf] [--light]
   Bundles diagram-entry.jsx with Vite (same pattern as render-previews.mjs),
   rasterizes with headless Edge (--screenshot) and prints vector PDFs with
   Edge --print-to-pdf. No new npm dependencies.                              */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { THEMES } from './components/diagram/layout-diagram.mjs';

const root = 'c:/Xamcode/aura-visuals';

/* ---- args ---- */
const argv = process.argv.slice(2);
const opt = { out: null, formats: 'svg,png,pdf', theme: 'dark' };
const words = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--out') opt.out = argv[++i] || null;
  else if (a === '--formats') opt.formats = argv[++i] || 'svg,png,pdf';
  else if (a === '--light') opt.theme = 'light';
  else if (a.startsWith('--')) { console.error(`render-diagram: unknown flag ${a}`); process.exit(1); }
  else words.push(a);
}
const text = words.join(' ').trim();
if (!text) {
  console.log('Usage: node render-diagram.mjs "<description>" [--out name] [--formats svg,png,pdf] [--light]');
  console.log('Example: node render-diagram.mjs "A flowchart showing a user login process with steps: Start, Enter Credentials, Validate, Success/Failure, End"');
  process.exit(1);
}
const want = (f) => opt.formats.split(',').some((s) => s.trim().toLowerCase() === f);

/* ---- bundle the SSR entry (react inlined) ---- */
const { build } = await import('vite');
const reactPlugin = (await import('@vitejs/plugin-react')).default;
await build({
  configFile: false, logLevel: 'error', root,
  esbuild: { jsx: 'automatic' }, plugins: [reactPlugin()],
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    ssr: path.join(root, 'diagram-entry.jsx'),
    outDir: path.join(root, '.diagram-out'),
    emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: 'bundle.mjs' } },
  },
});
const { renderDiagram } = await import(pathToFileURL(path.join(root, '.diagram-out/bundle.mjs')).href);
const res = renderDiagram(text, { theme: opt.theme });
if (!res) { console.error('render-diagram: could not parse text into a diagram'); process.exit(1); }

/* ---- write outputs ---- */
const BG = (THEMES[opt.theme] || THEMES.dark).bg;
const OUT = path.join(root, 'diagrams');
fs.mkdirSync(OUT, { recursive: true });
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  .split('-').filter(Boolean).slice(0, 6).join('-') || 'diagram';
const base = slug(opt.out || `${res.kind} ${res.title}`);
const fixedSvg = res.svg.replace('width="100%"', `width="${res.width}" height="${res.height}"`);
const failures = [];
const say = (f, extra = '') => console.log(`  wrote diagrams/${base}.${f}${extra}`);

if (want('svg')) {
  fs.writeFileSync(path.join(OUT, `${base}.svg`), fixedSvg, 'utf8');
  say('svg', ` (${res.width}×${res.height})`);
}

const htmlPath = path.join(OUT, `${base}.html`);
fs.writeFileSync(htmlPath, `<!doctype html><html><head><meta charset="utf-8"><title>${res.title}</title>
<style>html,body{margin:0;padding:0;background:${BG}}
@page{size:${res.width}px ${res.height}px;margin:0}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
svg{display:block}</style></head><body>${fixedSvg}</body></html>`, 'utf8');
const url = pathToFileURL(htmlPath).href;

/* ---- headless Edge helpers ---- */
const findEdge = () => {
  const cands = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    path.join(process.env.LOCALAPPDATA || '~', 'Microsoft/Edge/Application/msedge.exe'),
    path.join(process.env.PROGRAMFILES || '~', 'Microsoft/Edge/Application/msedge.exe'),
  ];
  return cands.find((p) => fs.existsSync(p)) || null;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(file, ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if (fs.statSync(file).size > 0) return true; } catch { /* not yet */ }
    await sleep(150);
  }
  return false;
}
const edge = findEdge();
const prof = edge ? fs.mkdtempSync(path.join(os.tmpdir(), 'edge-dgm-')) : null;
const edgeArgs = (rest) => [
  '--headless', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--no-default-browser-check', `--user-data-dir=${prof}`, ...rest,
];

if ((want('png') || want('pdf')) && !edge) {
  failures.push('Edge not found — PNG/PDF skipped (SVG still written)');
}

if (edge && want('png')) {
  const png = path.join(OUT, `${base}.png`);
  fs.rmSync(png, { force: true });
  spawnSync(edge, edgeArgs([`--screenshot=${png}`, `--window-size=${res.width},${res.height}`, url]),
    { windowsHide: true, encoding: 'utf8' });
  if (await waitFor(png)) {
    const b = fs.readFileSync(png);
    say('png', ` (${b.readUInt32BE(16)}×${b.readUInt32BE(20)} px, ${b.length} bytes)`);
  } else failures.push('PNG screenshot was not produced');
}

if (edge && want('pdf')) {
  const pdf = path.join(OUT, `${base}.pdf`);
  fs.rmSync(pdf, { force: true });
  spawnSync(edge, edgeArgs([`--print-to-pdf=${pdf}`, '--no-pdf-header-footer',
    '--print-to-pdf-no-header', url]), { windowsHide: true, encoding: 'utf8' });
  if (await waitFor(pdf)) {
    const buf = fs.readFileSync(pdf).toString('latin1');
    const ok = buf.startsWith('%PDF-');
    const mb = buf.match(/\/MediaBox\s*\[\s*([\d.\s-]+)\]/);
    say('pdf', `${ok ? '' : ' WARNING: bad header'}${mb ? ` (MediaBox [${mb[1].trim()}])` : ''}`);
    if (!ok) failures.push('PDF has bad header');
  } else failures.push('PDF was not produced');
}

/* ---- cleanup ---- */
fs.rmSync(path.join(root, '.diagram-out'), { recursive: true, force: true });
if (prof) fs.rmSync(prof, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
if (failures.length) { failures.forEach((f) => console.error('  FAIL ' + f)); process.exit(1); }
console.log(`done — ${res.kind}: "${res.title}"`);