/* Render preview gallery: bundles preview-entry.jsx (react inlined), writes
   preview/<type>.svg (dark bg, 800×500) + preview/index.html contact sheet.
   Run: node render-previews.mjs                                        */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = 'c:/Xamcode/aura-visuals';
const out = path.join(root, 'preview');

const { build } = await import('vite');
const reactPlugin = (await import('@vitejs/plugin-react')).default;

await build({
  configFile: false,
  logLevel: 'error',
  root,
  esbuild: { jsx: 'automatic' },
  plugins: [reactPlugin()],
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    ssr: path.join(root, 'preview-entry.jsx'),
    outDir: path.join(root, '.preview-out'),
    emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: 'bundle.mjs' } },
  },
});

const { renders, TITLES } = await import(
  pathToFileURL(path.join(root, '.preview-out/bundle.mjs')).href
);

fs.mkdirSync(out, { recursive: true });

const BG = '#0f0f16'; // app background (src/index.css)
const ORDER = ['projectile', 'photosynthesis', 'pythagoras', 'motor', 'dna', 'wave', 'generic'];

const toStandaloneSvg = (markup) => {
  let svg = markup.trim();
  // fixed intrinsic size so screenshots are exactly 800×500
  svg = svg.replace('width="100%"', 'width="800" height="500"');
  // dark background as first paint
  const close = svg.indexOf('>');
  if (close !== -1) {
    svg = svg.slice(0, close + 1) + `<rect width="400" height="250" fill="${BG}"/>` + svg.slice(close + 1);
  }
  return svg;
};

for (const type of ORDER) {
  const svg = toStandaloneSvg(renders[type]);
  fs.writeFileSync(path.join(out, `${type}.svg`), svg, 'utf8');
  console.log(`wrote preview/${type}.svg (${svg.length} bytes)`);
}

// Standalone HTML wrappers — Edge headless screenshots the HTML (bare .svg
// files open in Edge's XML tree view), with inline SVG rendering reliably.
for (const type of ORDER) {
  const inner = toStandaloneSvg(renders[type]).replace('width="800" height="500"', 'width="800" height="500"');
  fs.writeFileSync(
    path.join(out, `${type}.html`),
    `<!doctype html><html><head><meta charset="utf-8"><title>${type}</title>
<style>html,body{margin:0;padding:0;background:${BG};width:800px;height:500px;overflow:hidden}</style>
</head><body>${inner}</body></html>`,
    'utf8'
  );
}

// Contact sheet — open this in a browser to see everything in one page.
const cards = ORDER.map(
  (type) => `  <figure>
    <figcaption>${type} — ${TITLES[type]}</figcaption>
    ${toStandaloneSvg(renders[type]).replace('width="800" height="500"', 'style="width:100%;height:auto"')}
  </figure>`
).join('\n');

fs.writeFileSync(
  path.join(out, 'index.html'),
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Aura Visuals — preview gallery</title>
<style>
  body { margin:0; background:${BG}; color:#c8d0dc; font:14px/1.5 ui-sans-serif,system-ui,sans-serif; padding:28px; }
  h1 { color:#5eead4; font-size:20px; margin:0 0 4px; }
  p.sub { color:#6b7280; margin:0 0 24px; font-size:12px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(420px,1fr)); gap:20px; }
  figure { margin:0; background:#15151f; border:1px solid #262637; border-radius:12px; overflow:hidden; }
  figcaption { padding:9px 12px; font-size:12px; color:#9aa3b2; border-bottom:1px solid #262637; }
</style>
</head>
<body>
  <h1>Aura Visuals — all 7 types</h1>
  <p class="sub">Static SSR frames. For live animations run <code>npm run dev</code>.</p>
  <div class="grid">
${cards}
  </div>
</body>
</html>
`,
  'utf8'
);
console.log('wrote preview/index.html');

fs.rmSync(path.join(root, '.preview-out'), { recursive: true, force: true });