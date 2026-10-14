/* Preview entry: renders every Aura visual to a STATIC, meaningful frame
   (mid-animation where frame-0 would be empty) in ONE bundle — used by
   render-previews.mjs to export preview/*.svg for the visual gallery. */
import { renderToString } from 'react-dom/server';
import { AuraVisualEngine } from './components/AuraVisualEngine.jsx';

export const TITLES = {
  projectile: 'Projectile Motion — parabolic trajectory',
  photosynthesis: 'Photosynthesis — leaf, light, gas exchange',
  pythagoras: 'Pythagoras — a² + b² = c²',
  motor: 'Electric Motor — coil, brushes, commutator',
  dna: 'DNA Replication — unzipping at the fork',
  wave: 'Travelling Wave — amplitude, wavelength',
  generic: 'Generic (LLM path) — three-step process',
};

const renders = {
  projectile: renderToString(
    <AuraVisualEngine type="projectile" params={{ angle: 45, velocity: 80 }} isPlaying />
  ),
  photosynthesis: renderToString(
    <AuraVisualEngine type="photosynthesis" params={{ lightIntensity: 0.8 }} isPlaying />
  ),
  pythagoras: renderToString(
    <AuraVisualEngine type="pythagoras" params={{ a: 3, b: 4, c: 5 }} isPlaying />
  ),
  motor: renderToString(<AuraVisualEngine type="motor" params={{}} isPlaying />),
  // initialPhase 0.28 → fork open ~6 columns in, new copies visible
  dna: renderToString(<AuraVisualEngine type="dna" params={{ initialPhase: 0.28 }} isPlaying />),
  wave: renderToString(
    <AuraVisualEngine type="wave" params={{ amplitude: 60, frequency: 2 }} isPlaying />
  ),
  // initialSweep 1 → fully drawn static path (write-on frozen complete)
  generic: renderToString(
    <AuraVisualEngine
      type="generic"
      params={{
        svgPath: 'M40 200 L40 120 L140 120 M140 120 L140 200 M140 200 L240 200 M280 120 L360 120 L360 200',
        svgInstruction: 'Three-step process: input → transform → output',
        initialSweep: 1,
      }}
      svgInstruction="Three-step process: input → transform → output"
      isPlaying
    />
  ),
};

export { renders };
export default { renders, TITLES };