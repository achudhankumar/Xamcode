import { useAnimationFrame } from 'framer-motion';
import { useState, useRef } from 'react';

/*
 * PhotosynthesisSVG
 * -----------------
 * Pure parametric animation of photosynthesis inside a leaf.
 * Props: { lightIntensity (0..1), isPlaying }
 *  - The sun pulses (radius + glow) brighter/faster as lightIntensity rises.
 *  - CO₂ (grey) and H₂O (blue) particles flow from the air into the leaf.
 *  - O₂ (green) is released outward and glucose builds up in a meter.
 *
 * A single frame clock is stored in React state, so every particle position is
 * recomputed each frame → genuine 60fps motion. lightIntensity rescales
 * speed/brightness live, so dragging a slider reacts instantly.
 */

const LEAF_CX = 235;

// Deterministic pseudo-random so particles look scattered but stay stable.
const rnd = (i) => {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const inLeafPoint = (i) => ({
  x: LEAF_CX + (rnd(i) - 0.5) * 70,
  y: 118 + (rnd(i + 7) - 0.5) * 40,
});

const lerp = (a, b, p) => a + (b - a) * p;

export default function PhotosynthesisSVG({ lightIntensity = 0.8, isPlaying = true }) {
  const [clock, setClock] = useState(0);
  const last = useRef(0);

  const speed = 0.4 + lightIntensity * 1.1; // particles speed up with light

  useAnimationFrame((ms) => {
    if (!isPlaying) { last.current = ms; return; }
    if (!last.current) last.current = ms;
    const dt = (ms - last.current) / 1000;
    last.current = ms;
    setClock((c) => c + dt * speed);
  });

  const t = clock;
  const sunPulse = Math.sin(t * 3);
  const sunR = 22 + sunPulse * 2.5;
  const sunGlow = 0.35 + lightIntensity * (0.4 + sunPulse * 0.2);

  const N = 9;
  const O2N = 6;

  return (
    <svg viewBox="0 0 400 250" width="100%" style={{ height: 'auto', display: 'block' }} role="img"
      aria-label="Photosynthesis: light converts carbon dioxide and water into oxygen and glucose">
      <defs>
        <radialGradient id="ph-sun" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.1" />
        </radialGradient>
        <linearGradient id="ph-leaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#15803d" />
          <stop offset="100%" stopColor="#065f46" />
        </linearGradient>
        <radialGradient id="ph-sunglow" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ---- Sun + rays ---- */}
      <circle cx="60" cy="56" r="46" fill="url(#ph-sunglow)" opacity={sunGlow} />
      <circle cx="60" cy="56" r={sunR} fill="url(#ph-sun)" />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2;
        const r0 = sunR + 4;
        const r1 = sunR + 8 + (26 + sunPulse * 6) * 0.18;
        return (
          <line key={i}
            x1={60 + Math.cos(a) * r0} y1={56 + Math.sin(a) * r0}
            x2={60 + Math.cos(a) * r1} y2={56 + Math.sin(a) * r1}
            stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"
            opacity={0.5 + lightIntensity * 0.4} />
        );
      })}

      {/* ---- Leaf body ---- */}
      <path d="M150 118 C150 68 205 50 255 60 C305 70 322 94 322 118 C322 148 272 176 222 176 C172 176 150 156 150 118 Z"
        fill="url(#ph-leaf)" stroke="#0f766e" strokeWidth="2" />
      <path d="M150 118 H322" stroke="#a7f3d0" strokeWidth="2" opacity="0.5" />
      <path d="M235 118 V78 M235 118 V150 M280 118 V94 M280 118 V144" stroke="#a7f3d0" strokeWidth="1.2" opacity="0.35" />
      {/* meaningful part labels: site + organelle */}
      {/* title sits at the leaf floor — clear of every particle flight path
          (in/out particles only ever travel above y≈141) */}
      <text x="236" y="164" fill="#a7f3d0" fontSize="9" fontWeight="800" letterSpacing="1.4" textAnchor="middle">
        CHLOROPLAST
      </text>
      <text x="60" y="106" fill="#fbbf24" fontSize="9" fontWeight="800" letterSpacing="1.2" textAnchor="middle">
        LIGHT
      </text>
      {/* input / output arrow labels */}
      <text x="26" y="132" fill="#34d399" fontSize="9" fontWeight="700">CO₂ in</text>
      <text x="204" y="246" fill="#60a5fa" fontSize="9" fontWeight="700" textAnchor="middle">H₂O in (roots)</text>
      <text x="272" y="26" fill="#f472b6" fontSize="9" fontWeight="700" textAnchor="middle">O₂ out</text>

      {/* ---- CO₂ + H₂O flowing in ---- */}
      {Array.from({ length: N }).map((_, i) => {
        const p = (t * 0.12 + i / N) % 1;
        const start = { x: i % 2 ? 96 : 140, y: 40 + rnd(i) * 30 };
        const end = inLeafPoint(i);
        const x = lerp(start.x, end.x, p);
        const y = lerp(start.y, end.y, p);
        const isWater = i % 3 === 2;
        return isWater ? (
          <g key={'in' + i}>
            <circle cx={x} cy={y} r={3 + Math.sin(t * 4 + i)} fill="#38bdf8" />
          </g>
        ) : (
          <text key={'in' + i} x={x} y={y + 3} fontSize="8" fontWeight="700"
            fill="#94a3b8" textAnchor="middle">CO₂</text>
        );
      })}

      {/* ---- O₂ flowing out ---- */}
      {Array.from({ length: O2N }).map((_, i) => {
        const p = (t * 0.15 + i / O2N) % 1;
        const start = inLeafPoint(i + 3);
        const end = { x: start.x + (i % 2 ? 70 : -70), y: 40 - rnd(i) * 10 };
        const x = lerp(start.x, end.x, p);
        const y = lerp(start.y, end.y, p);
        return (
          <text key={'out' + i} x={x} y={y} fontSize="9" fontWeight="800"
            fill="#4ade80" textAnchor="middle" opacity={0.9}>O₂</text>
        );
      })}

      {/* ---- glucose meter (fills as light works) ---- */}
      <rect x="150" y="196" width="180" height="8" rx="4" fill="#262636" />
      <rect x="150" y="196" width={((t * 0.4) % 1) * 180} height="8" rx="4" fill="#facc15" />
      <text x="336" y="204" fontSize="9" fill="#9aa3b2" textAnchor="end" fontFamily="ui-monospace, monospace">
        C₆H₁₂O₆
      </text>

      {/* equation — above every ray (rays top out at y≈18, text sits at y≤14) */}
      <text x="14" y="14" fontSize="10" fill="#9aa3b2" fontFamily="ui-monospace, monospace">
        6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂
      </text>
    </svg>
  );
}

