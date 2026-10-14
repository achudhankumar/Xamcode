import { useAnimationFrame } from 'framer-motion';
import { useState, useRef } from 'react';

/*
 * WaveSVG
 * ------
 * Parametric transverse wave. Props: { amplitude, frequency, isPlaying }.
 * A sine wave travels left→right inside a dashed envelope (±A), with:
 *  - axis labels (equilibrium / crest), a travelling dot riding the crest,
 *  - live readouts: y = A·sin(kx − ωt), wavelength λ and current amplitude.
 * Dragging amplitude/frequency sliders reacts instantly (pure function of t).
 */

const W = 400, H = 250;
const X0 = 30, X1 = 370;   // usable horizontal span
const CY = 118;            // equilibrium line

export default function WaveSVG({ amplitude = 60, frequency = 2, isPlaying = true }) {
  const [clock, setClock] = useState(0);
  const last = useRef(0);

  useAnimationFrame((ms) => {
    if (!isPlaying) { last.current = ms; return; }
    if (!last.current) last.current = ms;
    const dt = (ms - last.current) / 1000;
    last.current = ms;
    setClock((c) => c + dt);
  });

  const t = clock;
  const omega = 1.6 * frequency;          // angular speed scales with frequency
  const k = (2 * Math.PI * frequency) / (X1 - X0); // spatial frequency
  const y = (x) => CY - amplitude * Math.sin(k * (x - X0) - omega * t);

  // Path sampled across the span (recomputed each frame → smooth motion).
  let d = '';
  const N = 90;
  for (let i = 0; i <= N; i++) {
    const x = X0 + ((X1 - X0) * i) / N;
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y(x).toFixed(2)} `;
  }

  // Envelope: dashed lines at +A and −A around equilibrium.
  const envTop = CY - amplitude;
  const envBot = CY + amplitude;

  // Travelling dot: rides the wave at a fixed phase.
  const dotX = X0 + (((omega / k) * t) % (X1 - X0)); // phase velocity → x
  const dotY = y(dotX);

  // Live readouts.
  const lambda = (X1 - X0) / frequency;   // px per cycle
  const instAmp = amplitude;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ height: 'auto', display: 'block' }} role="img"
      aria-label={`Travelling wave with amplitude ${amplitude} and frequency ${frequency}`}>
      <defs>
        <linearGradient id="wv-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
        <radialGradient id="wv-dot">
          <stop offset="0%" stopColor="#fda4af" />
          <stop offset="100%" stopColor="#f472b6" />
        </radialGradient>
        <marker id="wv-axis" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="#3f4560" />
        </marker>
      </defs>

      {/* equilibrium (rest) axis */}
      <line x1={X0 - 8} y1={CY} x2={X1 + 12} y2={CY} stroke="#3f4560" strokeWidth="1.2"
        markerEnd="url(#wv-axis)" />
      <text x={X0 - 10} y={CY + 16} fill="#6b7280" fontSize="9" textAnchor="end">rest</text>

      {/* amplitude envelope ±A */}
      <line x1={X0} y1={envTop} x2={X1} y2={envTop} stroke="#4b5563" strokeWidth="1" strokeDasharray="5 5" />
      <line x1={X0} y1={envBot} x2={X1} y2={envBot} stroke="#4b5563" strokeWidth="1" strokeDasharray="5 5" />
      {/* amplitude brace at the right edge (left edge is where the particle
          starts its ride — keeping them apart avoids a permanent overlap) */}
      <line x1={X1 - 6} y1={CY} x2={X1 - 6} y2={envTop} stroke="#a78bfa" strokeWidth="1.4" />
      <path d={`M${X1 - 9} ${envTop + 5} L${X1 - 6} ${envTop} L${X1 - 3} ${envTop + 5}`} fill="none" stroke="#a78bfa" strokeWidth="1.4" />
      <path d={`M${X1 - 9} ${CY - 5} L${X1 - 6} ${CY} L${X1 - 3} ${CY - 5}`} fill="none" stroke="#a78bfa" strokeWidth="1.4" />
      <text x={X1 - 13} y={(CY + envTop) / 2 + 3} fill="#c4b5fd" fontSize="10" fontWeight="700" textAnchor="end">A = {instAmp}</text>

      {/* the wave itself */}
      <path d={d} fill="none" stroke="url(#wv-line)" strokeWidth="2.6" strokeLinecap="round" />

      {/* travelling particle riding the wave */}
      <circle cx={dotX} cy={dotY} r="6" fill="url(#wv-dot)" />
      <circle cx={dotX} cy={dotY} r="10" fill="none" stroke="#f472b6" strokeWidth="1" opacity="0.5" />
      {/* label flips side near the edges and drops below while the particle
          rides high — keeps it clear of "rest", the brace and the equations */}
      {(() => {
        const lx = dotX <= 60 ? dotX + 10 : dotX >= 300 ? dotX - 10 : dotX;
        const lAnchor = dotX <= 60 ? 'start' : dotX >= 300 ? 'end' : 'middle';
        const ly = dotY < 90 ? dotY + 19 : dotY - 14;
        return (
          <text x={lx} y={ly} fill="#f9a8d4" fontSize="9" fontWeight="700" textAnchor={lAnchor}>particle</text>
        );
      })()}

      {/* wavelength marker between two crests */}
      {(() => {
        const half = (X1 - X0) / frequency;
        const xa = X0 + half * 0.5, xb = xa + half;
        const yy = 208;
        return (
          <g stroke="#34d399" strokeWidth="1.2" fill="none">
            <line x1={xa} y1={yy - 5} x2={xa} y2={yy + 5} />
            <line x1={xb} y1={yy - 5} x2={xb} y2={yy + 5} />
            <line x1={xa} y1={yy} x2={xb} y2={yy} markerEnd="url(#wv-axis)" />
            <text x={(xa + xb) / 2} y={yy - 8} fill="#6ee7b7" fontSize="9" fontWeight="700"
              textAnchor="middle" stroke="none">λ = {(lambda / 50).toFixed(1)} cm</text>
          </g>
        );
      })()}

      {/* live equation readout */}
      <text x={X0} y={28} fill="#9aa3b2" fontSize="11" fontFamily="ui-monospace, monospace">
        y = A·sin(kx − ωt)
      </text>
      <text x={X0} y={44} fill="#6b7280" fontSize="10" fontFamily="ui-monospace, monospace">
        A = {amplitude} · f = {frequency} · ω = {omega.toFixed(1)} rad/s
      </text>
      <text x={X1} y={28} fill="#5eead4" fontSize="10" textAnchor="end" fontFamily="ui-monospace, monospace">
        transverse wave
      </text>
    </svg>
  );
}