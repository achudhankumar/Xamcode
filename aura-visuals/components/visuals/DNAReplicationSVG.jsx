import { useAnimationFrame } from 'framer-motion';
import { useState, useRef } from 'react';

/*
 * DNAReplicationSVG
 * ------------------
 * Semiconservative replication. Props: { isPlaying }.
 * Two anti-parallel strands start paired (A–T, C–G hydrogen bonds). The helix
 * "unzips" left→right; as each base pair separates, new complementary bases
 * are drawn in on both strands, producing two daughter duplexes.
 *
 * A single phase (0..1) drives the unzip position, so it loops smoothly and
 * replays deterministically.
 */

const lerp = (a, b, p) => a + (b - a) * p;

// Base-pair sequence down the strand (complement: A↔T, C↔G).
const SEQ = ['A', 'T', 'G', 'C', 'T', 'A', 'C', 'G', 'A', 'T'];
const COMP = { A: 'T', T: 'A', G: 'C', C: 'G' };

// Colors per base
const BASE_COLOR = { A: '#2dd4bf', T: '#f472b6', G: '#a78bfa', C: '#fbbf24' };

const TOP = 200;      // y of the two original strands region
const ROWS = SEQ.length;
const ROW_GAP = 30;
const X0 = 60;        // first column x
const X_STEP = 34;

export default function DNAReplicationSVG({ isPlaying = true, initialPhase = null }) {
  // initialPhase (0..1): optional deterministic starting frame — used by
  // previews/SSR screenshots so a static render shows the fork mid-unzip.
  const [phase, setPhase] = useState(initialPhase ?? 0);
  const last = useRef(0);

  useAnimationFrame((ms) => {
    if (!isPlaying) { last.current = ms; return; }
    if (!last.current) last.current = ms;
    const dt = (ms - last.current) / 1000;
    last.current = ms;
    setPhase((p) => (p + dt * 0.28) % 1); // ~3.6s per unzip cycle
  });

  // Unzip front moves across columns; use a ping-pong so it re-zips too.
  const pingpong = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
  const front = pingpong * (ROWS + 1); // column index (can exceed ROWS)

  return (
    <svg viewBox="0 0 400 250" width="100%" style={{ height: 'auto', display: 'block' }} role="img"
      aria-label="DNA replication: the double helix unzips and each strand builds a complementary copy">
      <defs>
        <linearGradient id="dna-strand" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2dd4bf" /><stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>

      {/* title */}
      <text x="14" y="22" fill="#9aa3b2" fontSize="10" fontFamily="ui-monospace, monospace">
        semiconservative replication · A=T · C≡G
      </text>

      {/* legend — top-right row, clear of the strand columns */}
      <g fontSize="9" fontWeight="700">
        <circle cx="286" cy="18" r="4.5" fill="#2dd4bf" />
        <text x="295" y="21" fill="#9aa3b2">original</text>
        <circle cx="348" cy="18" r="4.5" fill="#4ade80" />
        <text x="357" y="21" fill="#9aa3b2">new</text>
      </g>

      {/* helicase marker at the replication fork (label flips side near the right edge) */}
      {(() => {
        const fx = X0 + front * X_STEP;
        const open = front > 0 && front <= ROWS;
        if (!open) return null;
        const flip = fx > 300; // keep the label inside the viewBox
        return (
          <g>
            <circle cx={fx} cy={(78 + TOP) / 2} r="4" fill="#5eead4" />
            <line x1={fx} y1={(78 + TOP) / 2 - 6} x2={flip ? fx - 26 : fx + 26} y2="58"
              stroke="#4b5563" strokeWidth="0.9" />
            <text x={flip ? fx - 30 : fx + 30} y="61" fill="#5eead4" fontSize="9" fontWeight="700"
              textAnchor={flip ? 'end' : 'start'}>helicase · unzip</text>
          </g>
        );
      })()}

      {/* The two original backbones */}
      <path d={`M${X0} 78 H${X0 + X_STEP * (ROWS - 1)}`} stroke="url(#dna-strand)" strokeWidth="3" fill="none" />
      <path d={`M${X0} ${TOP} H${X0 + X_STEP * (ROWS - 1)}`} stroke="url(#dna-strand)" strokeWidth="3" fill="none" />

      {/* Replication fork glow */}
      {front <= ROWS && (
        <circle cx={X0 + front * X_STEP} cy={(78 + TOP) / 2} r="10" fill="#2dd4bf" opacity="0.12" />
      )}

      {SEQ.map((base, i) => {
        const x = X0 + i * X_STEP;
        const yTop = 78;
        const yBot = TOP;
        const opened = i < front;              // this column has unzipped
        const zAmt = opened ? Math.min(1, front - i) : 0;

        // Original top strand base
        const topY = lerp(yTop, yTop - 16, zAmt);   // moves up when opened
        const botY = lerp(yBot, yBot + 16, zAmt);   // moves down when opened

        // New complementary bases grow in beside originals once opened
        const newTopY = lerp(yTop, yTop - 16, zAmt);
        const newBotY = lerp(yBot, yBot + 16, zAmt);

        return (
          <g key={i}>
            {/* hydrogen bond (only while closed) */}
            {!opened && (
              <line x1={x} y1={yTop} x2={x} y2={yBot} stroke="#3f4560"
                strokeWidth={base === 'G' || base === 'C' ? 3 : 1.5} strokeDasharray="3 3" />
            )}

            {/* original bases */}
            <g transform={`translate(${x},${topY})`}>
              <circle r="8" fill={BASE_COLOR[base]} opacity="0.95" />
              <text y="3" fontSize="9" fontWeight="800" fill="#0b1020" textAnchor="middle">{base}</text>
            </g>
            <g transform={`translate(${x},${botY})`}>
              <circle r="8" fill={BASE_COLOR[COMP[base]]} opacity="0.95" />
              <text y="3" fontSize="9" fontWeight="800" fill="#0b1020" textAnchor="middle">{COMP[base]}</text>
            </g>

            {/* newly synthesized complementary strands */}
            {opened && zAmt > 0.5 && (
              <>
                <g transform={`translate(${x},${newTopY - 16})`} opacity={zAmt}>
                  <circle r="8" fill={BASE_COLOR[COMP[base]]} stroke="#4ade80" strokeWidth="1.5" />
                  <text y="3" fontSize="9" fontWeight="800" fill="#0b1020" textAnchor="middle">{COMP[base]}</text>
                </g>
                <g transform={`translate(${x},${newBotY + 16})`} opacity={zAmt}>
                  <circle r="8" fill={BASE_COLOR[base]} stroke="#4ade80" strokeWidth="1.5" />
                  <text y="3" fontSize="9" fontWeight="800" fill="#0b1020" textAnchor="middle">{base}</text>
                </g>
              </>
            )}
          </g>
        );
      })}

      {/* direction labels — left margin, outside the column grid */}
      <text x="14" y="81" fill="#2dd4bf" fontSize="9" fontWeight="700">5'→3'</text>
      <text x="14" y="203" fill="#a78bfa" fontSize="9" fontWeight="700">3'→5'</text>
      <text x="386" y="246" fill="#4ade80" fontSize="9" fontWeight="700" textAnchor="end">2 daughter duplexes</text>
    </svg>
  );
}
