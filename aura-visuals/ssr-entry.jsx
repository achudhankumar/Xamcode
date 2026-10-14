/* SSR entry: renders every Aura visual to static SVG markup in ONE bundle
   (react + react-dom/server + engine inlined → guaranteed single React
   instance, avoiding ESM/CJS dual-instance hook crashes). */
import { renderToString } from 'react-dom/server';
import { AuraVisualEngine, visualMap } from './components/AuraVisualEngine.jsx';
import { DiagramFromText } from './components/diagram/DiagramFromText.jsx';
import { parseDiagram, EXAMPLE_FLOWCHART, EXAMPLE_SEQUENCE } from './components/diagram/parse-diagram.mjs';

const paramsFor = {
  projectile: { angle: 45, velocity: 80 },
  photosynthesis: { lightIntensity: 0.8 },
  pythagoras: { a: 3, b: 4, c: 5 },
  motor: {},
  dna: {},
  wave: { amplitude: 60, frequency: 2 },
  generic: { svgPath: 'M40 200 L40 120 L140 120' },
};

const renders = {};
for (const [type, params] of Object.entries(paramsFor)) {
  renders[type] = renderToString(
    <AuraVisualEngine type={type} params={params} isPlaying svgInstruction="Test caption" />
  );
}
renders.genericCaption = renderToString(
  <AuraVisualEngine type="generic"
    params={{ svgPath: 'M40 200 L40 120 L140 120' }}
    svgInstruction="Three-step process" isPlaying />
);
renders.unknown = renderToString(<AuraVisualEngine type="hologram" params={{}} />);

/* —— text → diagram generator (parse + layout + render, all in this bundle) —— */
renders.diagramFlow = renderToString(<DiagramFromText text={EXAMPLE_FLOWCHART} />);
renders.diagramSeq = renderToString(<DiagramFromText text={EXAMPLE_SEQUENCE} />);
renders.diagramModels = {
  flow: parseDiagram(EXAMPLE_FLOWCHART),
  seq: parseDiagram(EXAMPLE_SEQUENCE),
  junk: parseDiagram('Just one vague sentence'),
};

export { renders, visualMap };
export default { renders, visualMap };