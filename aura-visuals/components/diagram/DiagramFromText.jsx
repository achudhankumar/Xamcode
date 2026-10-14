/* DiagramFromText — text description in, collision-free SVG diagram out.
   Deterministic (no NLP, no animation) so SSR, PNG and PDF all match exactly.
   Kinds: flowchart (layered, decision diamonds, branch outcomes) and
          sequence (actor pills, dashed lifelines, labelled messages). */
import { parseDiagram } from './parse-diagram.mjs';
import { layoutDiagram, THEMES, FONT } from './layout-diagram.mjs';

export function DiagramFromText({ text, theme = 'dark' }) {
  const model = parseDiagram(text);
  if (!model) {
    const p = THEMES[theme] || THEMES.dark;
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 250" width="100%"
        role="img" aria-label="No diagram">
        <rect width="400" height="250" fill={p.bg} />
        <text x="200" y="128" textAnchor="middle" fontFamily={FONT} fontSize="13" fill={p.muted}>
          No diagram — describe steps or a sequence
        </text>
      </svg>
    );
  }
  const L = layoutDiagram(model, { theme });
  const p = L.pal;
  const aria = `${L.kind === 'sequence' ? 'Sequence diagram' : 'Flowchart'} — ${L.title}`;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${L.width} ${L.height}`}
      width="100%" role="img" aria-label={aria} data-kind={L.kind}>
      <defs>
        <marker id="dgm-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8"
          markerHeight="8" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0 0 L8 4 L0 8 Z" fill={p.edge} />
        </marker>
        <marker id="dgm-msg" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8"
          markerHeight="8" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0 0 L8 4 L0 8 Z" fill={p.msg} />
        </marker>
      </defs>
      <rect width={L.width} height={L.height} fill={p.bg} />
      <text x={L.pad} y={L.pad + 11} fontFamily={FONT} fontSize="14.5"
        fontWeight="600" fill={p.title}>{L.title}</text>
      {L.kind === 'flowchart' ? <FlowBody L={L} /> : <SeqBody L={L} />}
    </svg>
  );
}

function FlowBody({ L }) {
  const p = L.pal;
  return (
    <g>
      {L.edges.map((e, i) => (
        <line key={`e${i}`} x1={e.from.x} y1={e.from.y} x2={e.to.x} y2={e.to.y - 4}
          stroke={p.edge} strokeWidth="1.6" markerEnd="url(#dgm-arrow)" />
      ))}
      {L.nodes.map((n) => (
        <g key={n.id} data-shape={n.shape} data-label={n.label}>
          {n.shape === 'decision' ? (
            <path
              d={`M${n.cx} ${n.y} L${n.x + n.w} ${n.cy} L${n.cx} ${n.y + n.h} L${n.x} ${n.cy} Z`}
              fill={p.decisionFill} stroke={p.decisionStroke} strokeWidth="1.8" strokeLinejoin="round" />
          ) : (
            <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="9"
              fill={p.nodeFill} stroke={n.alt ? p.branchStroke : p.nodeStroke} strokeWidth="1.8" />
          )}
          {n.lines.map((ln, i, arr) => (
            <text key={i} x={n.cx}
              y={n.cy + (i - (arr.length - 1) / 2) * 16.5 + 4.7}
              textAnchor="middle" fontFamily={FONT} fontSize="13" fill={p.text}>{ln}</text>
          ))}
        </g>
      ))}
    </g>
  );
}

function SeqBody({ L }) {
  const p = L.pal;
  return (
    <g>
      {L.actors.map((a, i) => (
        <line key={`ll${i}`} x1={a.x} y1={L.lifelineTop} x2={a.x} y2={L.lifelineBottom}
          stroke={p.lifeline} strokeWidth="1.4" strokeDasharray="5 7" />
      ))}
      {L.messages.map((m, i) => {
        const est = Math.max(30, m.text.length * 7 + 12);
        const self = m.x1 === m.x2;
        const mid = (m.x1 + m.x2) / 2;
        const flip = self && m.x1 + 56 + est > L.width - 8;
        const tx = self ? (flip ? m.x1 - 12 : m.x1 + 56) : mid;
        const anchor = self ? (flip ? 'end' : 'start') : 'middle';
        const ty = self ? m.y + 4.5 : m.y - 11;
        const rx = anchor === 'middle' ? tx - est / 2 : anchor === 'start' ? tx - 4 : tx - est + 4;
        return (
          <g key={i} data-message={`${m.from}->${m.to}`}>
            {self ? (
              <path d={`M${m.x1 + 8} ${m.y - 9} H${m.x1 + 46} V${m.y + 9} H${m.x1}`}
                fill="none" stroke={p.msg} strokeWidth="1.6" markerEnd="url(#dgm-msg)" />
            ) : (
              <line x1={m.x1} y1={m.y} x2={m.x2} y2={m.y}
                stroke={p.msg} strokeWidth="1.6" markerEnd="url(#dgm-msg)" />
            )}
            <rect x={rx} y={ty - 12} width={est} height="17" rx="4" fill={p.bg} />
            <text x={tx} y={ty} textAnchor={anchor} fontFamily={FONT}
              fontSize="12.5" fill={p.text}>{m.text}</text>
          </g>
        );
      })}
      {L.actors.map((a) => (
        <g key={a.name} data-actor={a.name}>
          <rect x={a.x - a.w / 2} y={a.y} width={a.w} height={a.h} rx={a.h / 2}
            fill={p.actorFill} stroke={p.actorStroke} strokeWidth="1.8" />
          <text x={a.x} y={a.y + a.h / 2 + 4.7} textAnchor="middle" fontFamily={FONT}
            fontSize="13.5" fontWeight="600" fill={p.text}>{a.name}</text>
        </g>
      ))}
    </g>
  );
}

export default DiagramFromText;