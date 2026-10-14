import { motion, useMotionValue, useTransform, useAnimationFrame } from 'framer-motion';

/*
 * ProjectileMotionSVG
 * -------------------
 * Pure parametric projectile-motion animation. Given { angle, velocity } it
 * solves the ballistic trajectory live and rides a ball along the resulting
 * parabola with velocity + component vectors.
 *
 * The ball follows the curve via CSS `offset-path` (motion.circle + animated
 * offsetDistance) as requested; every geometry value is recomputed from props
 * on each render, so dragging the angle/velocity sliders reacts instantly.
 *
 * World model (y-up, origin at the launch point):
 *   x(t) = vx·t
 *   y(t) = vy·t − ½·g·t²
 *   flight time T = 2·vy/g,  range R = vx·T,  apex H = vy²/(2g)
 * World units are scaled into the 400×250 viewBox around LAUNCH.
 */

const G = 20;                     // gravity in world units
const LOOP = 2.2;                 // seconds for one full flight
const LAUNCH = { x: 42, y: 206 }; // launch point in viewBox coords
const ARROW = 34;                 // velocity-vector length (px)
const MAX_W = 340;                // usable width to the right of launch
const MAX_H = 184;                // usable height above the ground line

export default function ProjectileMotionSVG({ angle = 45, velocity = 80, isPlaying = true }) {
  const rad = (angle * Math.PI) / 180;
  const vx = velocity * Math.cos(rad);
  const vy = velocity * Math.sin(rad);
  const T = (2 * vy) / G || 0.0001;
  const R = vx * T;
  const H = (vy * vy) / (2 * G);
  const s = Math.min(MAX_W / (R || 1), MAX_H / (H || 1), 1.5);

  const toX = (wx) => LAUNCH.x + s * wx;
  const toY = (wy) => LAUNCH.y - s * wy;
  const posAt = (t) => [toX(vx * t), toY(vy * t - 0.5 * G * t * t)];

  // Build the trajectory path string once per param change.
  const d = (() => {
    const N = 56;
    let out = '';
    for (let i = 0; i <= N; i++) {
      const [x, y] = posAt((i / N) * T);
      out += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)} `;
    }
    return out.trim();
  })();

  const progress = useMotionValue(0);
  const last = useMotionValue(0);

  useAnimationFrame((t) => {
    if (!isPlaying) { last.set(t); return; }
    if (!last.get()) last.set(t);
    const dt = (t - last.get()) / 1000;
    last.set(t);
    progress.set((progress.get() + dt / LOOP) % 1);
  });

  // Everything below is a pure function of `progress` — instant reactivity.
  const dist = useTransform(progress, (p) => `${(p * 100).toFixed(2)}%`);
  const ballX = useTransform(progress, (p) => posAt(p * T)[0]);
  const ballY = useTransform(progress, (p) => posAt(p * T)[1]);
  const vel = useTransform(progress, (p) => {
    const vyy = vy - G * p * T;
    const len = Math.hypot(vx, vyy) || 1;
    const bx = posAt(p * T)[0];
    const by = posAt(p * T)[1];
    return { tx: bx + (vx / len) * ARROW, ty: by - (vyy / len) * ARROW, cx: bx + (vx / len) * ARROW, by };
  });
  const tipX = useTransform(vel, (v) => v.tx);
  const tipY = useTransform(vel, (v) => v.ty);
  const compX = useTransform(vel, (v) => v.cx); // horizontal component tip
  // Label anchors as derived MotionValues — plain arithmetic on a MotionValue
  // (e.g. `tipY + 14`) evaluates to NaN and strands the label at y=0.
  const tipLabelX = useTransform(vel, (v) => v.tx + 3);
  const tipLabelY = useTransform(vel, (v) => v.ty - 6);
  const compLabelX = useTransform(vel, (v) => v.cx);
  const compLabelY = useTransform(vel, (v) => v.by + 11);
  // Fade the component labels in only once the ball has cleared the crowded
  // launch zone (θ / v₀ labels live there) and while it is still airborne.
  const labelOn = useTransform(vel, (v) => (v.bx > 110 && v.by < 190) ? 1 : 0);

  return (
    <svg viewBox="0 0 400 250" width="100%" style={{ height: 'auto', display: 'block' }} role="img"
      aria-label={`Projectile motion at ${angle} degrees and ${velocity} units per second`}>
      <defs>
        <radialGradient id="proj-ball" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
        <marker id="proj-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="#2dd4bf" />
        </marker>
      </defs>

      {/* ground + launch pad */}
      <line x1="10" y1="206" x2="390" y2="206" stroke="#2f3346" strokeWidth="1.5" />
      <rect x={LAUNCH.x - 10} y="200" width="20" height="6" rx="2" fill="#3a3f57" />

      {/* launch angle arc + θ label (meaningful part label) */}
      {(() => {
        const arcR = 34;
        const a = (angle * Math.PI) / 180;
        const ax = LAUNCH.x + arcR * Math.cos(a);
        const ay = LAUNCH.y - arcR * Math.sin(a);
        return (
          <g>
            <path d={`M${LAUNCH.x + arcR} ${LAUNCH.y} A${arcR} ${arcR} 0 0 0 ${ax} ${ay}`}
              fill="none" stroke="#a78bfa" strokeWidth="1.3" opacity="0.9" />
            <text x={LAUNCH.x + arcR * 0.62} y={LAUNCH.y - arcR * 0.42}
              fill="#c4b5fd" fontSize="11" fontWeight="700">θ {angle}°</text>
            <text x={14} y={184} fill="#5eead4" fontSize="10" fontWeight="700">
              v₀ {velocity}
            </text>
          </g>
        );
      })()}

      {/* apex + range markers (what the numbers mean) */}
      {(() => {
        const [rx, ry] = posAt(T / 2);   // apex
        const [gx] = posAt(T);           // landing
        return (
          <g>
            <line x1={rx} y1={ry} x2={rx} y2="206" stroke="#fbbf24" strokeWidth="1" strokeDasharray="3 4" opacity="0.7" />
            <circle cx={rx} cy={ry} r="2.5" fill="#fbbf24" />
            <text x={rx} y={ry - 8} fill="#fbbf24" fontSize="9.5" fontWeight="700" textAnchor="middle">
              apex H {H.toFixed(0)}
            </text>
            <line x1={LAUNCH.x} y1="222" x2={gx} y2="222" stroke="#34d399" strokeWidth="1.2" />
            <line x1={LAUNCH.x} y1="218" x2={LAUNCH.x} y2="226" stroke="#34d399" strokeWidth="1.2" />
            <line x1={gx} y1="218" x2={gx} y2="226" stroke="#34d399" strokeWidth="1.2" />
            <text x={(LAUNCH.x + gx) / 2} y="236" fill="#6ee7b7" fontSize="9.5" fontWeight="700" textAnchor="middle">
              range {R.toFixed(0)}
            </text>
          </g>
        );
      })()}

      {/* trajectory guide */}
      <path d={d} fill="none" stroke="#3f4560" strokeWidth="1.4" strokeDasharray="4 5" />

      {/* velocity vector + components */}
      <g strokeLinecap="round">
        <motion.line x1={ballX} y1={ballY} x2={tipX} y2={tipY} stroke="#2dd4bf" strokeWidth="2.4" markerEnd="url(#proj-arrow)" />
        <motion.line x1={ballX} y1={ballY} x2={compX} y2={ballY} stroke="#a78bfa" strokeWidth="1.4" strokeDasharray="3 3" opacity="0.8" />
        <motion.line x1={compX} y1={ballY} x2={tipX} y2={tipY} stroke="#a78bfa" strokeWidth="1.4" strokeDasharray="3 3" opacity="0.8" />
        <motion.circle cx={tipX} cy={tipY} r="2.4" fill="#2dd4bf" />
        {/* component labels: horizontal vₓ stays constant, vertical v_y shrinks.
            Both ride MotionValues (see above) and hide near the launch zone. */}
        <motion.g opacity={labelOn}>
          <motion.text fill="#c4b5fd" fontSize="9" fontWeight="700" x={compLabelX} y={compLabelY} textAnchor="middle">vₓ</motion.text>
          <motion.text fill="#93c5fd" fontSize="9" fontWeight="700" x={tipLabelX} y={tipLabelY} textAnchor="start">v_y</motion.text>
        </motion.g>
      </g>

      {/* the ball, riding the parabola via offset-path */}
      <motion.circle
        r="7"
        fill="url(#proj-ball)"
        style={{ offsetPath: `path("${d}")`, offsetDistance: dist, offsetRotate: '0deg', offsetAnchor: 'center', transformBox: 'fill-box' }}
      />

      {/* readouts */}
      <text x="12" y="26" fill="#9aa3b2" fontSize="11" fontFamily="ui-monospace, monospace">x(t)=vₓt   y(t)=v_y t − ½gt²</text>
      <text x="12" y="42" fill="#6b7280" fontSize="10" fontFamily="ui-monospace, monospace">g = 9.8 m/s²  ·  vₓ constant, v_y falls</text>
    </svg>
  );
}
