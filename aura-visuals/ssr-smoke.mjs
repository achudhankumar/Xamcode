/* SSR smoke test: bundles react + react-dom/server + every Aura visual into
   ONE module (no externals → single React instance), renders each visual to
   static SVG markup, and asserts it produces real, meaningful output.
   Run: node ssr-smoke.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = 'c:/Xamcode/aura-visuals';

const { build } = await import('vite');
const reactPlugin = (await import('@vitejs/plugin-react')).default;

// Bundle the entry (which renders everything) — react fully inlined.
await build({
  configFile: false,
  logLevel: 'error',
  root,
  esbuild: { jsx: 'automatic' },
  plugins: [reactPlugin()],
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    ssr: path.join(root, 'ssr-entry.jsx'),
    outDir: path.join(root, '.ssr-out'),
    emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: 'bundle.mjs' } },
  },
});

const { renders, visualMap } = await import(
  pathToFileURL(path.join(root, '.ssr-out/bundle.mjs')).href
);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };

ok(Object.keys(visualMap).length === 7, `7 visuals registered (${Object.keys(visualMap).join(', ')})`);

for (const type of ['projectile', 'photosynthesis', 'pythagoras', 'motor', 'dna', 'wave', 'generic']) {
  const html = renders[type] || '';
  ok(html.length > 0, `${type}: renders without error`);
  ok(/viewBox="0 0 400 250"/.test(html), `${type}: emits 400×250 viewBox`);
  ok(/aria-label=/.test(html), `${type}: carries aria-label (a11y)`);
  ok(/<text/.test(html), `${type}: includes meaningful text labels`);
}

// generic specifically: LLM path drawn + instruction caption shown
ok(/d="M40 200 L40 120 L140 120"/.test(renders.genericCaption || ''),
  'generic: LLM svgPath rendered as path d');
ok(/Three-step process/.test(renders.genericCaption || ''),
  'generic: svg_instruction caption shown');

// unknown type → friendly empty state
ok(/No visual/.test(renders.unknown || ''), 'unknown type: friendly empty state');

console.log(`\n*** ${fail === 0 ? 'PASS' : 'FAIL'} ***  ${pass} passed, ${fail} failed`);

// —— text → diagram generator ——
const df = renders.diagramFlow || '';
const ds = renders.diagramSeq || '';
ok(/viewBox="0 0 \d+ \d+"/.test(df), 'diagram flow: emits sized viewBox');
ok(/data-shape="decision"/.test(df) && />Success</.test(df) && />Failure</.test(df),
  'diagram flow: branch outcomes rendered around a decision diamond');
ok(/<marker/.test(df) && /<line/.test(df), 'diagram flow: arrow marker + edges drawn');
ok(!/NaN|undefined/.test(df + ds), 'diagrams: no NaN/undefined anywhere in markup');
ok(/Hello</.test(ds) && />Hi</.test(ds) && />Alice</.test(ds) && />Bob</.test(ds),
  'diagram seq: both actors + both messages rendered');
ok(/stroke-dasharray/.test(ds), 'diagram seq: lifelines drawn');
const fm = renders.diagramModels.flow;
ok(fm && fm.kind === 'flowchart' && fm.nodes.length === 6 && fm.edges.length === 6,
  `diagram parser: flow model has 6 nodes / 6 edges (${fm?.nodes?.length}/${fm?.edges?.length})`);
ok(fm && fm.nodes.some((n) => n.label === 'Validate' && n.shape === 'decision'),
  'diagram parser: Validate becomes the decision node');
const sm = renders.diagramModels.seq;
ok(sm && sm.actors.join(',') === 'Alice,Bob' && sm.messages.length === 2
  && sm.messages[0].text === 'Hello' && sm.messages[1].to === 'Alice',
  'diagram parser: sequence actors + reply routed to original sender');
ok(Array.isArray(renders.diagramModels.junk?.nodes) && renders.diagramModels.junk.nodes.length >= 1,
  'diagram parser: free text falls back to a one-step flowchart');

console.log(`\n*** ${fail === 0 ? 'PASS' : 'FAIL'} ***  ${pass} passed, ${fail} failed`);
fs.rmSync(path.join(root, '.ssr-out'), { recursive: true, force: true });
process.exit(fail === 0 ? 0 : 1);