/* PHASE 5: VISUAL SCHEMA REGISTRY */

export const VISUAL_SCHEMAS = {};
export const VALID_VISUAL_TYPES = Object.keys(VISUAL_SCHEMAS);

export function getVisualSchema(type) { return VISUAL_SCHEMAS[type] || null; }
export function validateVisualData(type, data) { return true; }
export function checkRichness(data) { return Array.isArray(data.steps) ? data.steps.length >= 4 : false; }
export function getStepCount(data) { return Array.isArray(data.steps) ? data.steps.length : 0; }
export function createVisual(type, config) {
  config = config || {};
  return {
    type: type,
    steps: config.steps || [],
    theme: config.theme || "light",
    config: { loop: config.loop || false, autoPlay: config.autoPlay || false, interval: config.interval || 2000, direction: config.direction || "forward" }
  };
}

// 1. process_flow: Linear workflow steps
VISUAL_SCHEMAS.process_flow = {
  type: 'process_flow',
  requiredFields: ['id', 'title', 'description', 'steps', 'config'],
  stepShape: { id: 'string', title: 'string', description: 'string', icon: 'string', attrs: 'object' },
  optionalFields: ['metadata', 'transitions', 'loopable'],
  minSteps: 4,
  themeKeys: ['primary', 'secondary', 'accent'],
  configKeys: ['loop', 'autoPlay', 'interval', 'direction'],
  renderProps: ['steps', 'config', 'theme']
};

// 2. timeline: Chronological sequence with dates
VISUAL_SCHEMAS.timeline = {
  type: 'timeline',
  requiredFields: ['id', 'title', 'events', 'config'],
  stepShape: { id: 'string', title: 'string', date: 'string', description: 'string', category: 'string' },
  optionalFields: ['metadata', 'markers', 'loopable'],
  minSteps: 4,
  themeKeys: ['primary', 'secondary', 'accent'],
  configKeys: ['loop', 'autoPlay', 'interval', 'direction'],
  renderProps: ['events', 'config', 'theme']
};

// 3. hierarchy_tree: Tree structure with nested children
VISUAL_SCHEMAS.hierarchy_tree = {
  type: 'hierarchy_tree',
  requiredFields: ['id', 'title', 'root', 'config'],
  stepShape: { id: 'string', name: 'string', label: 'string', children: 'array', icon: 'string', attrs: 'object' },
  optionalFields: ['metadata', 'collapsible', 'loopable'],
  minSteps: 4,
  themeKeys: ['primary', 'secondary', 'accent'],
  configKeys: ['loop', 'autoPlay', 'interval', 'direction'],
  renderProps: ['root', 'config', 'theme']
};

// 4. cycle: Circular flow with stages
VISUAL_SCHEMAS.cycle = {
  type: 'cycle',
  requiredFields: ['id', 'title', 'stages', 'config'],
  stepShape: { id: 'string', title: 'string', description: 'string', icon: 'string', order: 'number' },
  optionalFields: ['metadata', 'arrows', 'loopable'],
  minSteps: 4,
  themeKeys: ['primary', 'secondary', 'accent'],
  configKeys: ['loop', 'autoPlay', 'interval', 'direction'],
  renderProps: ['stages', 'config', 'theme']
};

// 5. concept_map: Nodes and relationships
VISUAL_SCHEMAS.concept_map = {
  type: 'concept_map',
  requiredFields: ['id', 'title', 'nodes', 'edges', 'config'],
  stepShape: { id: 'string', label: 'string', type: 'string', attrs: 'object' },
  edgeShape: { source: 'string', target: 'string', label: 'string', type: 'string' },
  optionalFields: ['metadata', 'clusters', 'loopable'],
  minSteps: 4,
  themeKeys: ['primary', 'secondary', 'accent'],
  configKeys: ['loop', 'autoPlay', 'interval', 'direction'],
  renderProps: ['nodes', 'edges', 'config', 'theme']
};

// 6. matrix_2x2: Two-axis decision matrix
VISUAL_SCHEMAS.matrix_2x2 = {
  type: 'matrix_2x2',
  requiredFields: ['id', 'title', 'quadrants', 'config'],
  stepShape: { id: 'string', title: 'string', description: 'string', priority: 'number', score: 'number' },
  optionalFields: ['metadata', 'axes'],
  minSteps: 4,
  themeKeys: ['primary', 'secondary', 'accent'],
  configKeys: ['loop', 'autoPlay', 'interval', 'direction'],
  renderProps: ['quadrants', 'config', 'theme']
};

// 7. comparison_visual: Side-by-side comparison
VISUAL_SCHEMAS.comparison_visual = {
  type: 'comparison_visual',
  requiredFields: ['id', 'title', 'items', 'config'],
  stepShape: { id: 'string', name: 'string', attributes: 'object', description: 'string' },
  optionalFields: ['metadata', 'criteria'],
  minSteps: 4,
  themeKeys: ['primary', 'secondary', 'accent'],
  configKeys: ['loop', 'autoPlay', 'interval', 'direction'],
  renderProps: ['items', 'config', 'theme']
};

// 8. chart: Data visualization chart
VISUAL_SCHEMAS.chart = {
  type: 'chart',
  requiredFields: ['id', 'title', 'data', 'config'],
  stepShape: { id: 'string', type: 'string', labels: 'array', values: 'array', color: 'string', attrs: 'object' },
  optionalFields: ['metadata', 'series'],
  minSteps: 4,
  themeKeys: ['primary', 'secondary', 'accent'],
  configKeys: ['loop', 'autoPlay', 'interval', 'direction'],
  renderProps: ['data', 'config', 'theme']
};

// 9. equation_steps: Step-by-step math derivation
VISUAL_SCHEMAS.equation_steps = {
  type: 'equation_steps',
  requiredFields: ['id', 'title', 'equations', 'config'],
  stepShape: { id: 'string', expression: 'string', description: 'string', step: 'number' },
  optionalFields: ['metadata', 'annotation'],
  minSteps: 4,
  themeKeys: ['primary', 'secondary', 'accent'],
  configKeys: ['loop', 'autoPlay', 'interval', 'direction'],
  renderProps: ['equations', 'config', 'theme']
};

// 10. formula_slider: Interactive formula exploration
VISUAL_SCHEMAS.formula_slider = {
  type: 'formula_slider',
  requiredFields: ['id', 'title', 'formula', 'variables', 'config'],
  stepShape: { id: 'string', variable: 'string', value: 'number', result: 'string' },
  optionalFields: ['metadata', 'sliderOptions'],
  minSteps: 4,
  themeKeys: ['primary', 'secondary', 'accent'],
  configKeys: ['loop', 'autoPlay', 'interval', 'direction'],
  renderProps: ['variables', 'config', 'theme']
};

// 11. state_machine: State transitions
VISUAL_SCHEMAS.state_machine = {
  type: 'state_machine',
  requiredFields: ['id', 'title', 'states', 'transitions', 'config'],
  stepShape: { id: 'string', name: 'string', state: 'string', transition: 'string', description: 'string' },
  transitionShape: { from: 'string', to: 'string', trigger: 'string', guard: 'string' },
  optionalFields: ['metadata', 'loopable'],
  minSteps: 4,
  themeKeys: ['primary', 'secondary', 'accent'],
  configKeys: ['loop', 'autoPlay', 'interval', 'direction'],
  renderProps: ['states', 'transitions', 'config', 'theme']
};

// 12. code_trace: Code execution trace
VISUAL_SCHEMAS.code_trace = {
  type: 'code_trace',
  requiredFields: ['id', 'title', 'trace', 'config'],
  stepShape: { id: 'string', line: 'number', code: 'string', output: 'string', type: 'string' },
  optionalFields: ['metadata', 'variables'],
  minSteps: 4,
  themeKeys: ['primary', 'secondary', 'accent'],
  configKeys: ['loop', 'autoPlay', 'interval', 'direction'],
  renderProps: ['trace', 'config', 'theme']
};

// 13. labeled_diagram: Annotated diagram
VISUAL_SCHEMAS.labeled_diagram = {
  type: 'labeled_diagram',
  requiredFields: ['id', 'title', 'diagram', 'labels', 'config'],
  stepShape: { id: 'string', x: 'number', y: 'number', label: 'string', coordinate: 'string' },
  optionalFields: ['metadata', 'annotations'],
  minSteps: 4,
  themeKeys: ['primary', 'secondary', 'accent'],
  configKeys: ['loop', 'autoPlay', 'interval', 'direction'],
  renderProps: ['diagram', 'labels', 'config', 'theme']
};
