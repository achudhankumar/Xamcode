/* Text → diagram model. Deterministic mini-parser (no NLP deps) supporting:
     • flowchart prompts  "A flowchart showing X with steps: A, B, C/D, E"
     • sequence prompts   "… two actors, Alice and Bob. Alice sends a message
                           'Hello' to Bob. Bob replies with 'Hi'."
     • compact DSL        "flow: A | B | C"  /  "seq: Alice; Bob | Alice->Bob: Hello"
     • arrow chains       "Start -> Check -> End"
     • free text          → sentence-per-step fallback (always returns a model)
   Pure ESM — shared by DiagramFromText.jsx (client + SSR) and Node tests.    */

export const EXAMPLE_FLOWCHART =
  'A flowchart showing a user login process with steps: Start, Enter Credentials, Validate, Success/Failure, End';
export const EXAMPLE_SEQUENCE =
  "Create a sequence diagram with two actors, Alice and Bob. Alice sends a message 'Hello' to Bob. Bob replies with 'Hi'.";

const clean = (s) =>
  String(s ?? '').replace(/\s+/g, ' ').trim().replace(/^[\s,;:]+|[\s,;:.!?]+$/g, '');

const splitList = (s, re = /\s*(?:,| and | & )\s*/i) =>
  String(s).split(re).map(clean).filter(Boolean);

export function parseDiagram(text) {
  const t = String(text ?? '').trim();
  if (!t) return null;
  if (/^flow\s*:/i.test(t)) return flowFromSteps(splitList(t.replace(/^flow\s*:/i, ''), /[|;,]/), 'Flowchart');
  if (/^seq\s*:/i.test(t)) return parseSeqDsl(t.replace(/^seq\s*:/i, ''));
  if (/sequence\s+diagram/i.test(t)) return parseSequence(t);
  if (/\bflowchart\b|\bsteps\s*:/i.test(t)) return parseFlowchart(t);
  if (/->|→/.test(t)) {
    const steps = t.split(/\s*(?:->|→)\s*/).map(clean).filter(Boolean);
    if (steps.length >= 2) return flowFromSteps(steps, 'Flowchart');
  }
  // free text → sentence-per-step linear flow (always succeeds)
  const parts = t
    .split(/(?<=[.!?])\s+|\s+(?:then|after that|next,?)\s+/i)
    .map(clean)
    .filter(Boolean);
  return flowFromSteps(parts.length ? parts : [clean(t)], 'Process');
}

/* ---------- flowchart ---------- */

function parseFlowchart(t) {
  let title = 'Flowchart';
  const tm = t.match(/\bflowchart\b\s+(?:showing|for|of|about)\s+(.+?)(?=\s+with\s+steps\s*:|\s*steps\s*:|$)/i);
  if (tm && clean(tm[1])) {
    const raw = clean(tm[1]);
    title = raw.charAt(0).toUpperCase() + raw.slice(1);
  }
  let src = '';
  const sm = t.match(/\bsteps\s*:\s*(.+)$/i);
  if (sm) src = sm[1];
  else {
    const cm = t.match(/\bflowchart\s*:\s*(.+)$/i);
    src = cm ? cm[1] : t.replace(/\bflowchart\b/i, '');
  }
  src = clean(src).replace(/[.]+$/, '');
  let steps = src.split(/\s*,\s*/).map(clean).filter(Boolean);
  if (steps.length === 1 && /\s+and\s+/i.test(src)) steps = splitList(src);
  else if (steps.length === 1 && /->|→/.test(src)) steps = src.split(/\s*(?:->|→)\s*/).map(clean).filter(Boolean);
  // prose after "steps:" (e.g. a chat answer that happens to say "steps:") →
  // split it into sentences so the fallback still lays out a real multi-node flow
  else if (steps.length === 1 && /[.!?]/.test(src)) steps = src.split(/(?<=[.!?])\s+|\s+(?:then|after that|next,?)\s+/i).map(clean).filter(Boolean);
  return flowFromSteps(steps, title);
}

function flowFromSteps(steps, title) {
  const groups = steps
    .map((s) => String(s ?? '').split('/').map(clean).filter(Boolean))
    .filter((g) => g.length);
  return buildFlowModel(groups.length ? groups : [['Step']], title);
}

function buildFlowModel(groups, title) {
  const nodes = [];
  const edges = [];
  let n = 0;
  const ids = groups.map((labels) =>
    labels.map((label) => {
      const id = `n${n++}`;
      nodes.push({ id, label, shape: 'box' });
      return id;
    })
  );
  // a group of alternatives turns its predecessor into a decision diamond
  for (let i = 1; i < ids.length; i++) {
    if (ids[i].length > 1) {
      for (const pid of ids[i - 1]) {
        const node = nodes.find((x) => x.id === pid);
        if (node) node.shape = 'decision';
      }
    }
  }
  // connect consecutive groups (bipartite → branches rejoin naturally)
  for (let i = 0; i + 1 < ids.length; i++) {
    for (const a of ids[i]) for (const b of ids[i + 1]) edges.push({ from: a, to: b });
  }
  return { kind: 'flowchart', title, nodes, edges, groups: ids };
}

/* ---------- sequence ---------- */

function parseSeqDsl(body) {
  const segs = body.split('|').map(clean).filter(Boolean);
  const actors = splitList(segs.shift() || '');
  const messages = [];
  for (const seg of segs) {
    const m = seg.match(/^\s*(\w+)\s*->\s*(\w+)\s*:\s*(.+)$/);
    if (m) messages.push({ from: m[1], to: m[2], text: m[3] });
  }
  return finalizeSequence('Sequence diagram', actors, messages);
}

function parseSequence(t) {
  let actors = [];
  const am =
    t.match(/\bactors?\s*[,:]?\s+([^.!?]+)[.!?]/i) ||
    t.match(/\bactors?\s*:\s*([^.!?]+)/i);
  if (am) actors = splitList(am[1]);

  const messages = [];
  for (const raw of t.split(/(?<=[.!?])\s+/)) {
    const s = clean(raw);
    let m;
    if ((m = s.match(/^\s*(\w+)\s+sends\s+(?:a\s+message\s+)?['"]([^'"]+)['"]\s+to\s+(\w+)/i))) {
      messages.push({ from: m[1], to: m[3], text: m[2] });
    } else if ((m = s.match(/^\s*(\w+)\s+(?:replies|responds|answers)\s+(?:back\s+)?(?:with|:)\s+['"]([^'"]+)['"]/i))) {
      const prev = messages[messages.length - 1];
      messages.push({ from: m[1], to: prev ? prev.from : '', text: m[2] });
    } else if ((m = s.match(/^\s*(\w+)\s*->\s*(\w+)\s*:\s*(.+)$/))) {
      messages.push({ from: m[1], to: m[2], text: m[3] });
    } else if ((m = s.match(/^\s*(\w+)\s+sends\s+(?:a\s+message\s+)?(.+?)\s+to\s+(\w+)/i))) {
      const txt = clean(m[2]).replace(/^['"]|['"]$/g, '').replace(/^(?:a|the)\s+(?:message\s+)?/i, '') || 'message';
      messages.push({ from: m[1], to: m[3], text: txt });
    }
  }
  return finalizeSequence('Sequence diagram', actors, messages);
}

function finalizeSequence(title, actors, messages) {
  const list = [];
  const add = (v) => { const c = clean(v); if (c && !list.includes(c)) list.push(c); };
  actors.forEach(add);
  messages.forEach((m) => { add(m.from); add(m.to); });
  if (list.length === 0) list.push('A', 'B');
  else if (list.length === 1) list.push('Other');
  const ms = messages
    .filter((m) => m && clean(m.text))
    .map((m) => {
      const from = list.includes(clean(m.from)) ? clean(m.from) : list[0];
      const to = list.includes(clean(m.to)) && clean(m.to) !== from
        ? clean(m.to)
        : list.find((a) => a !== from) || list[0];
      return { from, to, text: clean(m.text) };
    });
  return { kind: 'sequence', title, actors: list, messages: ms };
}