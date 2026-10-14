/* SSR entry for the text→diagram pipeline (bundled by render-diagram.mjs):
   text description → React → SVG string + intrinsic pixel dimensions. */
import { renderToString } from 'react-dom/server';
import { DiagramFromText } from './components/diagram/DiagramFromText.jsx';
import { parseDiagram } from './components/diagram/parse-diagram.mjs';
import { layoutDiagram } from './components/diagram/layout-diagram.mjs';

export function renderDiagram(text, opts = {}) {
  const model = parseDiagram(text);
  if (!model) return null;
  const theme = opts.theme === 'light' ? 'light' : 'dark';
  const L = layoutDiagram(model, { theme });
  const svg = renderToString(<DiagramFromText text={text} theme={theme} />);
  return {
    svg,
    width: L.width,
    height: L.height,
    kind: model.kind,
    title: L.title,
    nodes: model.nodes ? model.nodes.length : 0,
    messages: model.messages ? model.messages.length : 0,
  };
}

export default { renderDiagram };