import { useState, useMemo } from 'react';
import { AuraVisualEngine } from '../components/AuraVisualEngine.jsx';
import { DiagramFromText } from '../components/diagram/DiagramFromText.jsx';
import { EXAMPLE_FLOWCHART } from '../components/diagram/parse-diagram.mjs';

/*
 * App — a live test harness for the Aura visual engine.
 * Mimics the chat bubble Aura returns:
 *   { visual_type, params, explanation }
 * You can switch type, drag sliders (params update live), play/pause, replay.
 */

const TYPES = [
  { key: 'projectile', label: 'Projectile Motion', sliders: [
    { name: 'angle', label: 'Angle', min: 5, max: 85, step: 1, def: 45, unit: '°' },
    { name: 'velocity', label: 'Velocity', min: 20, max: 120, step: 1, def: 80, unit: ' m/s' },
  ]},
  { key: 'photosynthesis', label: 'Photosynthesis', sliders: [
    { name: 'lightIntensity', label: 'Light intensity', min: 0, max: 1, step: 0.05, def: 0.8, unit: '' },
  ]},
  { key: 'pythagoras', label: 'Pythagoras (a²+b²=c²)', sliders: [
    { name: 'a', label: 'Side a', min: 2, max: 9, step: 1, def: 3, unit: '' },
    { name: 'b', label: 'Side b', min: 2, max: 9, step: 1, def: 4, unit: '' },
    { name: 'c', label: 'Hypotenuse c', min: 3, max: 13, step: 1, def: 5, unit: '' },
  ]},
  { key: 'motor', label: 'Electric Motor', sliders: [] },
  { key: 'dna', label: 'DNA Replication', sliders: [] },
  { key: 'wave', label: 'Wave', sliders: [
    { name: 'amplitude', label: 'Amplitude', min: 10, max: 70, step: 1, def: 60, unit: '' },
    { name: 'frequency', label: 'Frequency', min: 1, max: 6, step: 1, def: 2, unit: '' },
  ]},
  { key: 'generic', label: 'Generic (LLM path)', sliders: [] },
];

const DEFAULT_PARAMS = {
  projectile: { angle: 45, velocity: 80 },
  photosynthesis: { lightIntensity: 0.8 },
  pythagoras: { a: 3, b: 4, c: 5 },
  motor: {},
  dna: {},
  wave: { amplitude: 60, frequency: 2 },
  generic: {
    svgPath: 'M40 200 L40 120 L140 120 M140 120 L140 200 M140 200 L240 200 M280 120 L360 120 L360 200',
  },
};

const EXPLANATIONS = {
  projectile: 'The ball follows a parabola because horizontal velocity stays constant while gravity accelerates it downward at 9.8 m/s².',
  photosynthesis: 'Chloroplasts use light energy to convert CO₂ and water into glucose, releasing oxygen as a by-product.',
  pythagoras: 'In any right triangle, the area of the square on the hypotenuse equals the sum of the areas of the squares on the other two sides.',
  motor: 'Current in a coil within a magnetic field experiences forces that produce continuous torque — the principle of every DC motor.',
  dna: 'DNA polymerase reads each original strand and builds a complementary partner, so one helix becomes two identical copies.',
  wave: 'A wave transfers energy without transferring matter — each particle oscillates about its rest position as the pattern travels.',
  generic: 'For any topic, Aura asks the model for a simple SVG path diagram plus a caption — here it sketches a three-step process.',
};

const CAPTIONS = {
  generic: 'Three-step process: input → transform → output',
};

export default function App() {
  const [type, setType] = useState('projectile');
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [isPlaying, setIsPlaying] = useState(true);
  const [replayKey, setReplayKey] = useState(0); // remount → restart animation
  const [desc, setDesc] = useState(EXAMPLE_FLOWCHART); // text → diagram demo

  const active = useMemo(() => TYPES.find((t) => t.key === type), [type]);

  const setParam = (name, value) =>
    setParams((p) => ({ ...p, [type]: { ...p[type], [name]: value } }));

  const switchType = (key) => { setType(key); setReplayKey((k) => k + 1); };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 20px 60px' }}>
      <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>Aura AI · Visual Explanations</h1>
      <p style={{ color: 'var(--muted)', marginTop: 0, fontSize: 13 }}>
        Parametric SVG — no Lottie. Drag sliders; the SVG reacts in real time.
      </p>

      {/* type switcher */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '18px 0' }}>
        {TYPES.map((t) => (
          <button key={t.key} onClick={() => switchType(t.key)}
            style={{
              padding: '8px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              border: `1px solid ${type === t.key ? 'var(--accent)' : 'var(--border)'}`,
              background: type === t.key ? 'rgba(45,212,191,.12)' : 'transparent',
              color: type === t.key ? 'var(--accent)' : 'var(--muted)',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* the styled visual card */}
      <div style={{
        background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 16,
        padding: 24,
      }}>
        {/* title bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Visual Explanation</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={() => setIsPlaying((v) => !v)} style={btn}>
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            <button onClick={() => setReplayKey((k) => k + 1)} style={btn}>↻ Replay</button>
          </span>
        </div>

        {/* engine */}
        <AuraVisualEngine key={`${type}-${replayKey}`} type={type}
          params={params[type]} isPlaying={isPlaying}
          svgInstruction={CAPTIONS[type] || ''} />

        {/* explanation (as Aura would return) */}
        <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6, margin: '16px 0 0' }}>
          {EXPLANATIONS[type]}
        </p>

        {/* the JSON Aura returns */}
        <pre style={{
          marginTop: 16, padding: 12, borderRadius: 10, background: '#0f0f16',
          border: '1px solid var(--border)', color: 'var(--muted)', fontSize: 11, overflowX: 'auto',
        }}>
{JSON.stringify({ visual_type: type, params: params[type], explanation: EXPLANATIONS[type] }, null, 2)}
        </pre>
      </div>

      {/* sliders */}
      {active.sliders.length > 0 && (
        <div style={{
          marginTop: 18, background: 'var(--panel)', border: '1px solid var(--border)',
          borderRadius: 16, padding: 20,
        }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Live parameters</div>
          {active.sliders.map((s) => (
            <label key={s.name} style={{ display: 'block', marginBottom: 14 }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}>
                <span>{s.label}</span>
                <span style={{ color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                  {params[type][s.name]}{s.unit}
                </span>
              </span>
              <input type="range" min={s.min} max={s.max} step={s.step}
                value={params[type][s.name]}
                onChange={(e) => setParam(s.name, parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent)' }} />
            </label>
          ))}
        </div>
      )}

      {/* text → diagram: parse + layout live in the browser, no server */}
      <div style={{
        marginTop: 18, background: 'var(--panel)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 20,
      }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>Text → diagram</div>
        <div style={{ color: 'var(--muted)', fontSize: 12, margin: '4px 0 12px' }}>
          Describe a flowchart (steps, with C/D branches) or a sequence diagram
          (actors + sends/replies) — parsed and laid out live.
        </div>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={3}
          placeholder="A flowchart showing … with steps: A, B, C/D, E"
          style={{
            width: '100%', resize: 'vertical', background: '#0f0f16', color: 'var(--text)',
            border: '1px solid var(--border)', borderRadius: 10, padding: 10,
            fontSize: 12.5, fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box',
          }}
        />
        <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <DiagramFromText text={desc} />
        </div>
      </div>
    </div>
  );
}

const btn = {
  padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
  border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)',
};
