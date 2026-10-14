import { useAnimationFrame } from 'framer-motion';
import { useState, useRef } from 'react';

/*
 * GenericSVG
 * ----------
 * The "any topic" visual. Aura's LLM returns a sanitised `svgPath` (an SVG
 * path `d` string drawn in the 400×250 space) plus an `svgInstruction`
 * caption explaining what the diagram shows. This component:
 *  - draws the path with a stroke "write-on" reveal (dash-offset sweep),
 *  - adds a glowing dot that traces the path (drawing head),
 *  - shows the caption as a meaningful title, or a "Drawing…" placeholder
 *    while the path is still being generated.
 */

const W = 400, H = 250;
const REVEAL = 2.4; // seconds for one write-on sweep

export default function GenericSVG({ svgPath = '', svgInstruction = '', isPlaying = true, initialSweep = null }) {
  const [clock, setClock] = useState(0);
  const last = useRef(0);
  const pathRef = useRef(null);
  const [len, setLen] = useState(0);

  useAnimationFrame((ms) => {
    if (!isPlaying) { last.current = ms; return; }
    if (!last.current) last.current = ms;
    const dt = (ms - last.current) / 1000;
    last.current = ms;
    setClock((c) => c + dt);
  });

  // Measure the real path length once it mounts (browser API).
  const ref = (node) => {
    pathRef.current = node;
    if (node && typeof node.getTotalLength === 'function' && !len) {
      try { setLen(node.getTotalLength()); } catch { /* SSR/no layout */ }
    }
  };

  const hasPath = typeof svgPath === 'string' && svgPath.trim().length > 0;
  // initialSweep (0..1): optional static reveal fraction — used by previews/SSR
  // screenshots so a frozen render shows the path drawn instead of invisible.
  const sweep = initialSweep != null ? initialSweep : (clock % REVEAL) / REVEAL; // 0..1 write-on progress
  const dash = len || 1000;

  // Tracing head position (only when we could measure the path).
  let head = null;
  if (hasPath && len && pathRef.current) {
    try {
      const pt = pathRef.current.getPointAtLength(dash * sweep);
      head = { x: pt.x, y: pt.y };
    } catch { head = null; }
  }

  const caption = (svgInstruction || '').trim();

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ height: 'auto', display: 'block' }} role="img"
      aria-label={caption || 'Generated diagram'}>
      <defs>
        <linearGradient id="gn-line" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
        <filter id="gn-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* faint grid so any diagram reads as a "figure" */}
      <g stroke="#1c1c2b" strokeWidth="0.6">
        {Array.from({ length: 8 }).map((_, i) => (
          <line key={'v' + i} x1={(i + 1) * 44} y1="10" x2={(i + 1) * 44} y2={H - 34} />
        ))}
        {Array.from({ length: 4 }).map((_, i) => (
          <line key={'h' + i} x1="10" y1={(i + 1) * 50} x2={W - 10} y2={(i + 1) * 50} />
        ))}
      </g>

      {hasPath ? (
        <>
          {/* glow copy under the crisp path */}
          <path ref={ref} d={svgPath} fill="none" stroke="url(#gn-line)" strokeWidth="4"
            strokeLinecap="round" strokeLinejoin="round" opacity="0.25" filter="url(#gn-glow)"
            strokeDasharray={dash} strokeDashoffset={dash * (1 - sweep)} />
          <path d={svgPath} fill="none" stroke="url(#gn-line)" strokeWidth="2.4"
            strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray={dash} strokeDashoffset={dash * (1 - sweep)} />
          {head && (
            <>
              <circle cx={head.x} cy={head.y} r="4.5" fill="#5eead4" />
              <circle cx={head.x} cy={head.y} r="9" fill="none" stroke="#5eead4" strokeWidth="1" opacity="0.5" />
            </>
          )}
        </>
      ) : (
        <text x={W / 2} y={H / 2 - 8} fill="#6b7280" fontSize="13" textAnchor="middle">
          Drawing…
        </text>
      )}

      {/* caption — the "meaning" of the diagram */}
      <text x={W / 2} y={H - 14} fill="#9aa3b2" fontSize="11" textAnchor="middle">
        {caption.length > 72 ? caption.slice(0, 69) + '…' : caption}
      </text>
      {!caption && hasPath && (
        <text x={W / 2} y={H - 14} fill="#6b7280" fontSize="11" textAnchor="middle">
          Generated diagram
        </text>
      )}
    </svg>
  );
}