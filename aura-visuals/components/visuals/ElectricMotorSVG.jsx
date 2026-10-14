import { useAnimationFrame } from 'framer-motion';
import { useState, useRef } from 'react';

/*
 * ElectricMotorSVG
 * ----------------
 * DC motor. Props: { isPlaying }.
 * A rectangular coil sits between two permanent magnets (N / S). Current flows
 * through the coil (animated arrows) producing torque; the coil rotates about
 * its centre. Commutator contact points and a back-EMF indicator round it out.
 * Single frame clock → all motion stays in phase.
 */

const CX = 200, CY = 125;
const COIL_W = 90, COIL_H = 54;

const lerp = (a, b, p) => a + (b - a) * p;

export default function ElectricMotorSVG({ isPlaying = true }) {
  const [clock, setClock] = useState(0);
  const last = useRef(0);

  useAnimationFrame((ms) => {
    if (!isPlaying) { last.current = ms; return; }
    if (!last.current) last.current = ms;
    const dt = (ms - last.current) / 1000;
    last.current = ms;
    setClock((c) => c + dt);
  });

  const angle = (clock * 2.2) * (180 / Math.PI); // deg/sec
  const curPhase = (clock * 1.6) % 1;            // current arrow travel

  // Coil half-extents projected under rotation (for the rotating loop).
  const rad = (angle * Math.PI) / 180;
  const hw = COIL_W / 2;
  const hh = COIL_H / 2;
  // corners of the coil rotated about (CX,CY)
  const corner = (sx, sy) => ({
    x: CX + sx * hw * Math.cos(rad) - sy * hh * Math.sin(rad),
    y: CY + sx * hw * Math.sin(rad) + sy * hh * Math.cos(rad),
  });
  const p00 = corner(-1, -1), p10 = corner(1, -1), p11 = corner(1, 1), p01 = corner(-1, 1);

  return (
    <svg viewBox="0 0 400 250" width="100%" style={{ height: 'auto', display: 'block' }} role="img"
      aria-label="DC electric motor: current through a coil in a magnetic field creates rotation">
      <defs>
        <linearGradient id="em-magnet-n" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ef4444" /><stop offset="100%" stopColor="#7f1d1d" />
        </linearGradient>
        <linearGradient id="em-magnet-s" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1d4ed8" /><stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
        <radialGradient id="em-shaft" cx="40%" cy="40%">
          <stop offset="0%" stopColor="#e5e7eb" /><stop offset="100%" stopColor="#6b7280" />
        </radialGradient>
        <marker id="em-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="#fbbf24" />
        </marker>
      </defs>

      {/* Magnets: N on left, S on right */}
      <rect x="24" y={CY - 52} width="30" height="104" rx="5" fill="url(#em-magnet-n)" />
      <text x="39" y={CY + 5} fill="#fff" fontSize="15" fontWeight="800" textAnchor="middle">N</text>
      <rect x="346" y={CY - 52} width="30" height="104" rx="5" fill="url(#em-magnet-s)" />
      <text x="361" y={CY + 5} fill="#fff" fontSize="15" fontWeight="800" textAnchor="middle">S</text>

      {/* Field lines left → right (subtle) */}
      {[ -34, -10, 10, 34 ].map((dy, i) => (
        <line key={i} x1="56" y1={CY + dy} x2="344" y2={CY + dy} stroke="#2dd4bf"
          strokeWidth="0.6" opacity="0.18" strokeDasharray="3 6" />
      ))}

      {/* Rotating coil */}
      <polygon points={`${p00.x},${p00.y} ${p10.x},${p10.y} ${p11.x},${p11.y} ${p01.x},${p01.y}`}
        fill="#1f2937" stroke="#fbbf24" strokeWidth="2.2" strokeLinejoin="round" />
      {/* coil winding hint along the two active sides */}
      <line x1={p00.x} y1={p00.y} x2={p01.x} y2={p01.y} stroke="#f59e0b" strokeWidth="3" />
      <line x1={p10.x} y1={p10.y} x2={p11.x} y2={p11.y} stroke="#f59e0b" strokeWidth="3" />

      {/* Current flow arrows travelling around the loop */}
      {(() => {
        // sample perimeter position for the moving arrow
        const per = [
          { x: lerp(p00.x, p10.x, curPhase), y: lerp(p00.y, p10.y, curPhase) },
          { x: lerp(p10.x, p11.x, curPhase), y: lerp(p10.y, p11.y, curPhase) },
          { x: lerp(p11.x, p01.x, curPhase), y: lerp(p11.y, p01.y, curPhase) },
          { x: lerp(p01.x, p00.x, curPhase), y: lerp(p01.y, p00.y, curPhase) },
        ];
        const a = per[1]; // down the right active side (into the page/screen)
        const b = per[3]; // up the left active side
        return (
          <g stroke="#fbbf24" strokeWidth="2" markerEnd="url(#em-arrow)">
            <line x1={a.x} y1={a.y - 18} x2={a.x} y2={a.y} />
            <line x1={b.x} y1={b.y} x2={b.x} y2={b.y - 18} />
          </g>
        );
      })()}

      {/* Shaft + rotation arrow */}
      <circle cx={CX} cy={CY} r="7" fill="url(#em-shaft)" />
      <path d={`M${CX + 14} ${CY - 12} A18 18 0 0 1 ${CX + 14} ${CY + 12}`} fill="none"
        stroke="#2dd4bf" strokeWidth="2" markerEnd="url(#em-arrow)" opacity="0.9" />
      <text x={CX - 12} y={CY + 20} fill="#2dd4bf" fontSize="10" fontWeight="700" textAnchor="middle">τ torque</text>

      {/* Commutator dots at top */}
      <circle cx={CX} cy="40" r="4" fill="#fbbf24" />
      <circle cx={CX} cy="210" r="4" fill="#9aa3b2" />

      {/* ---- meaningful part labels with leader lines ---- */}
      <g fontSize="9" fontWeight="700" letterSpacing="0.6">
        {/* coil */}
        <line x1={CX + 62} y1={CY - 34} x2={CX + 92} y2={CY - 56} stroke="#4b5563" strokeWidth="0.9" />
        <text x={CX + 96} y={CY - 58} fill="#fbbf24">COIL (I)</text>
        {/* brushes */}
        <line x1="150" y1="125" x2="110" y2="160" stroke="#4b5563" strokeWidth="0.9" />
        <text x="64" y="172" fill="#f59e0b">BRUSHES</text>
        {/* commutator */}
        <line x1={CX} y1="40" x2={CX + 60} y2="40" stroke="#4b5563" strokeWidth="0.9" />
        <text x={CX + 64} y="43" fill="#fbbf24">COMMUTATOR</text>
        {/* field */}
        <line x1="90" y1="70" x2="70" y2="52" stroke="#4b5563" strokeWidth="0.9" />
        <text x="60" y="46" fill="#5eead4" textAnchor="middle">B field →</text>
        {/* shaft */}
        <line x1={CX} y1="210" x2={CX + 40} y2="228" stroke="#4b5563" strokeWidth="0.9" />
        <text x={CX + 44} y="231" fill="#9aa3b2">SHAFT</text>
      </g>

      <text x="16" y="24" fill="#9aa3b2" fontSize="10" fontFamily="ui-monospace, monospace">
        F = I L × B  →  continuous rotation
      </text>
      <text x="384" y="24" fill="#6b7280" fontSize="10" textAnchor="end" fontFamily="ui-monospace, monospace">
        {(((angle % 360) + 360) % 360).toFixed(0)}°
      </text>
    </svg>
  );
}
