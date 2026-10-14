import { useAnimationFrame } from 'framer-motion';
import { useState, useRef } from 'react';

/*
 * PythagorasSVG
 * -------------
 * Parametric proof of a² + b² = c². Props: { a, b, c, isPlaying }.
 * A right triangle is drawn with the two legs (a, b) and hypotenuse c. Squares
 * are constructed on each side and fill with a colour sweep to visualise area.
 * When a² + b² ≈ c² the squares on a and b "pour" into the square on c.
 *
 * The triangle is auto-scaled to fit the 400×250 viewBox; `a`, `b`, `c` are
 * recomputed on every render so slider changes react instantly.
 */

const lerp = (a, b, p) => a + (b - a) * p;

export default function PythagorasSVG({ a = 3, b = 4, c = 5, isPlaying = true }) {
  const [phase, setPhase] = useState(0); // 0..1 area-fill sweep
  const last = useRef(0);
  const keyRef = useRef(0);

  // Restart sweep if the side lengths change materially.
  const key = `${a}-${b}-${c}`;
  if (keyRef.current !== key) {
    keyRef.current = key;
    if (phase !== 0) setPhase(0);
  }

  useAnimationFrame((ms) => {
    if (!isPlaying) { last.current = ms; return; }
    if (!last.current) last.current = ms;
    const dt = (ms - last.current) / 1000;
    last.current = ms;
    setPhase((p) => (p + dt * 0.5) % 1);
  });

  // Geometry: right angle at O. The b-square extends left of O and the a-square
  // below it, so the scale is capped by every viewBox edge the squares can hit
  // (and by the equation block that lives on the right).
  const OX = 112, OY = 150;                 // right-angle vertex
  const scale = Math.min(106 / b, 94 / a, 130 / a, 144 / b) || 0.001;
  const px = a * scale;
  const py = b * scale;
  const A = { x: OX + px, y: OY };          // end of leg a (horizontal)
  const B = { x: OX, y: OY - py };          // end of leg b (vertical)
  const sqA = px;                            // area of square on a (in px²/scale²)
  const areaA = a * a;
  const areaB = b * b;
  const areaC = c * c;
  const balanced = Math.abs(areaA + areaB - areaC) < 0.5;

  // Sweep fill 0..1 mapped with a ping-pong so it loops nicely.
  const sweep = phase < 0.5 ? phase * 2 : (1 - phase) * 2;

  return (
    <svg viewBox="0 0 400 250" width="100%" style={{ height: 'auto', display: 'block' }} role="img"
      aria-label={`Pythagorean theorem: ${a} squared plus ${b} squared equals ${c} squared`}>
      <defs>
        <linearGradient id="py-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#0f766e" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="py-b" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#6d28d9" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="py-c" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#b45309" stopOpacity="0.25" />
        </linearGradient>
      </defs>

      {/* Square on a (built downward from hypotenuse... actually below leg a) */}
      <path d={`M${OX} ${OY} H${A.x} V${OY + sqA} H${OX} Z`} fill="url(#py-a)"
        opacity={0.25 + sweep * 0.6} stroke="#2dd4bf" strokeWidth="1.2" />
      <text x={OX + sqA / 2} y={OY + sqA / 2 + 4} fill="#2dd4bf" fontSize="14" fontWeight="800"
        textAnchor="middle">a²</text>

      {/* Square on b (to the left of leg b) */}
      <path d={`M${OX} ${OY} V${B.y} H${OX - py} V${OY} Z`} fill="url(#py-b)"
        opacity={0.25 + sweep * 0.6} stroke="#a78bfa" strokeWidth="1.2" />
      <text x={OX - py / 2} y={OY - py / 2 + 4} fill="#c4b5fd" fontSize="14" fontWeight="800"
        textAnchor="middle">b²</text>

      {/* The right triangle */}
      <path d={`M${OX} ${OY} L${A.x} ${A.y} L${B.x} ${B.y} Z`} fill="#15151f"
        stroke="#e5e7eb" strokeWidth="2" />
      {/* right-angle marker */}
      <path d={`M${OX + 14} ${OY} V${OY - 14} H${OX}`} fill="none" stroke="#9aa3b2" strokeWidth="1" />

      {/* leg labels */}
      <text x={(OX + A.x) / 2} y={OY + 16} fill="#9aa3b2" fontSize="11" textAnchor="middle">a = {a}</text>
      <text x={OX - 8} y={(OY + B.y) / 2} fill="#9aa3b2" fontSize="11" textAnchor="end">b = {b}</text>
      {/* hypotenuse label, offset perpendicular to the line so it never sits
          on the stroke (outward = away from the right-angle vertex) */}
      {(() => {
        const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
        const L = Math.hypot(px, py) || 1;
        return (
          <text x={mx + (py / L) * 16} y={my - (px / L) * 16 + 4} fill="#fbbf24" fontSize="12" fontWeight="700"
            textAnchor="middle">c = {c}</text>
        );
      })()}

      {/* Equation + balance badge — right-aligned so long numbers never clip */}
      <g transform="translate(396,204)" textAnchor="end">
        <text x="0" y="0" fill="#9aa3b2" fontSize="13" fontFamily="ui-monospace, monospace">
          a² + b² = {areaA} + {areaB} = {areaA + areaB}
        </text>
        <text x="0" y="18" fill="#9aa3b2" fontSize="13" fontFamily="ui-monospace, monospace">
          c² = {areaC}
        </text>
        <text x="0" y="36" fill={balanced ? '#4ade80' : '#f87171'} fontSize="11" fontWeight="700">
          {balanced ? '✓ balanced' : '≠ not a right triangle'}
        </text>
      </g>
    </svg>
  );
}
