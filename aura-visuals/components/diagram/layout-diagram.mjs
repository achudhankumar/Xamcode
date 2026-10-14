/* Deterministic diagram layouts: layered flowchart + lifeline sequence.
   Pure ESM (no JSX / no deps) so it runs in SSR bundles AND plain Node.
   Every coordinate is clamped inside the viewBox → no clipped elements.   */

export const THEMES = {
  dark: {
    bg: '#0f0f16', title: '#5eead4', text: '#e5e7eb', muted: '#9aa3b2',
    edge: '#5b6472', nodeFill: '#15151f', nodeStroke: '#5eead4',
    decisionFill: '#1a1a2e', decisionStroke: '#a78bfa', branchStroke: '#fbbf24',
    actorFill: '#15151f', actorStroke: '#5eead4', lifeline: '#3a3a52', msg: '#c8d0dc',
  },
  light: {
    bg: '#ffffff', title: '#0f766e', text: '#111827', muted: '#4b5563',
    edge: '#6b7280', nodeFill: '#f3f4f6', nodeStroke: '#0d9488',
    decisionFill: '#ede9fe', decisionStroke: '#7c3aed', branchStroke: '#d97706',
    actorFill: '#f3f4f6', actorStroke: '#0d9488', lifeline: '#9ca3af', msg: '#1f2937',
  },
};

export const FONT = 'Segoe UI, system-ui, -apple-system, sans-serif';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const CH = 7.0; // approx glyph width @13px (wrap + measure)

/** Greedy word-wrap; never more than 3 lines (overflow ellipsised). */
export function wrapLabel(label, maxChars = 26) {
  const words = String(label ?? '').split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > maxChars) { lines.push(cur); cur = w; }
    else cur = cur ? cur + ' ' + w : w;
  }
  if (cur) lines.push(cur);
  if (lines.length <= 3) return lines;
  return [lines[0], lines[1], lines.slice(2).join(' ').slice(0, maxChars - 1) + '…'];
}

export function layoutDiagram(model, opts = {}) {
  return model?.kind === 'sequence' ? layoutSequence(model, opts) : layoutFlowchart(model, opts);
}

export function layoutFlowchart(model = {}, opts = {}) {
  const pal = THEMES[opts.theme] || THEMES.dark;
  const incoming = Array.isArray(model.nodes) && model.nodes.length
    ? model.nodes
    : [{ id: 'n0', label: 'Step', shape: 'box' }];
  const nodes = incoming.map((n) => ({ ...n, shape: n.shape === 'decision' ? 'decision' : 'box' }));
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  let groups = (Array.isArray(model.groups) && model.groups.length ? model.groups : [nodes.map((n) => n.id)])
    .map((g) => (Array.isArray(g) ? g : [g]).filter((id) => byId[id]))
    .filter((g) => g.length);
  if (!groups.length) groups = [nodes.map((n) => n.id)].filter((g) => g.length);
  if (!groups.length) groups = [['n0']];

  // measure every node (wrapped label → box size)
  const meta = {};
  for (const n of nodes) {
    const lines = wrapLabel(n.label);
    const textW = Math.max(1, Math.max(...lines.map((l) => l.length))) * CH + 26;
    if (n.shape === 'decision') meta[n.id] = { lines, w: Math.max(150, textW + 40), h: 74 };
    else meta[n.id] = { lines, w: clamp(textW, 108, 248), h: lines.length > 1 ? 32 + lines.length * 17 : 48 };
  }

  // outcome members (groups of >1) render in the accent branch colour
  const alt = new Set();
  groups.forEach((g) => { if (g.length > 1) g.forEach((id) => alt.add(id)); });

  const pad = 30, titleH = 46, vGap = 64, hGap = 30;
  const rows = groups.map((ids) => ({
    ids,
    w: ids.reduce((s, id) => s + meta[id].w, 0) + hGap * Math.max(0, ids.length - 1),
    h: Math.max(...ids.map((id) => meta[id].h)),
  }));
  const W = Math.ceil(Math.max(420, Math.max(...rows.map((r) => r.w)) + pad * 2));
  const pos = {};
  let y = pad + titleH;
  for (const row of rows) {
    let x = (W - row.w) / 2;
    for (const id of row.ids) {
      const m = meta[id];
      pos[id] = { x, y: y + (row.h - m.h) / 2, w: m.w, h: m.h };
      x += m.w + hGap;
    }
    y += row.h + vGap;
  }
  const H = Math.ceil(y - vGap + pad);

  const outNodes = nodes.filter((n) => pos[n.id]).map((n) => ({
    ...n, ...pos[n.id], lines: meta[n.id].lines, alt: alt.has(n.id),
    cx: pos[n.id].x + pos[n.id].w / 2, cy: pos[n.id].y + pos[n.id].h / 2,
  }));
  const edges = (Array.isArray(model.edges) ? model.edges : [])
    .filter((e) => e && e.from !== e.to && pos[e.from] && pos[e.to])
    .map((e) => {
      const a = pos[e.from], b = pos[e.to];
      return { from: { x: a.x + a.w / 2, y: a.y + a.h }, to: { x: b.x + b.w / 2, y: b.y } };
    });

  return { kind: 'flowchart', width: W, height: H, title: model.title || 'Flowchart', pal, pad, nodes: outNodes, edges };
}

const cleanish = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

export function layoutSequence(model = {}, opts = {}) {
  const pal = THEMES[opts.theme] || THEMES.dark;
  let actors = (Array.isArray(model.actors) ? model.actors : []).map(cleanish).filter(Boolean);
  if (actors.length > 8) actors = actors.slice(0, 8);
  if (actors.length < 2) actors = ['A', 'B'];
  const idx = Object.fromEntries(actors.map((a, i) => [a, i]));
  const messages = (Array.isArray(model.messages) ? model.messages : [])
    .filter((m) => m && m.from && m.to && idx[m.from] !== undefined && idx[m.to] !== undefined && cleanish(m.text));

  const n = actors.length;
  const pillW = (name) => clamp(name.length * 8.6 + 36, 92, 260);
  const widest = Math.max(...actors.map(pillW));
  const W = Math.ceil(Math.max(460, 140 + n * 170, 140 + (n - 1) * (widest + 34)));
  const step = n > 1 ? (W - 140) / (n - 1) : 0;
  const ax = (i) => 70 + i * step;
  const pillY = 54, pillH = 36, firstMsgY = 134, msgGap = 56;
  const H = Math.ceil(Math.max(200, firstMsgY + Math.max(0, messages.length - 1) * msgGap + 58));
  return {
    kind: 'sequence', width: W, height: H, title: model.title || 'Sequence diagram', pal, pad: 30,
    actors: actors.map((name, i) => ({ name, x: ax(i), w: pillW(name), y: pillY, h: pillH })),
    lifelineTop: pillY + pillH, lifelineBottom: H - 26,
    messages: messages.map((m, i) => ({
      from: m.from, to: m.to, text: cleanish(m.text),
      y: firstMsgY + i * msgGap, x1: ax(idx[m.from]), x2: ax(idx[m.to]),
    })),
  };
}