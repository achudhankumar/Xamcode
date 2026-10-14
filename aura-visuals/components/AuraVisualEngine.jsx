import ProjectileMotionSVG from './visuals/ProjectileMotionSVG.jsx';
import PhotosynthesisSVG from './visuals/PhotosynthesisSVG.jsx';
import PythagorasSVG from './visuals/PythagorasSVG.jsx';
import ElectricMotorSVG from './visuals/ElectricMotorSVG.jsx';
import DNAReplicationSVG from './visuals/DNAReplicationSVG.jsx';
import WaveSVG from './visuals/WaveSVG.jsx';
import GenericSVG from './visuals/GenericSVG.jsx';

/*
 * AuraVisualEngine
 * ----------------
 * Central visual router for Aura AI. Aura's answer JSON carries a `visual_type`
 * plus `params`; this engine maps the type to the matching parametric SVG and
 * forwards params + isPlaying. `svg_instruction` (the LLM's caption for the
 * generic visual) is forwarded too. Unknown types render a friendly empty state.
 *
 *   <AuraVisualEngine type="projectile" params={{ angle:45, velocity:80 }} isPlaying />
 */

export const visualMap = {
  projectile: ProjectileMotionSVG,
  photosynthesis: PhotosynthesisSVG,
  pythagoras: PythagorasSVG,
  motor: ElectricMotorSVG,
  dna: DNAReplicationSVG,
  wave: WaveSVG,
  generic: GenericSVG,
};

export function AuraVisualEngine({ type, params = {}, isPlaying = true, svgInstruction = '' }) {
  const Component = visualMap[type];

  if (!Component) {
    return (
      <svg viewBox="0 0 400 250" width="100%" style={{ height: 'auto', display: 'block' }} role="img"
        aria-label="No visual available">
        <rect width="400" height="250" fill="#15151f" />
        <text x="200" y="128" fill="#6b7280" fontSize="13" textAnchor="middle">
          No visual for “{type}”
        </text>
      </svg>
    );
  }

  // The generic visual reads svgPath/svgInstruction from params or props.
  const extra = type === 'generic'
    ? { svgPath: params.svgPath || '', svgInstruction: svgInstruction || params.svgInstruction || '' }
    : {};

  return <Component {...params} {...extra} isPlaying={isPlaying} />;
}

export default AuraVisualEngine;
