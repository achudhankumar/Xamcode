/* PHASE 5: VISUAL SYSTEM CORE — index.js */
/* Central export hub for all schema definitions and helper utilities */

export { default as VISUAL_SCHEMAS } from './schemas.js';
export { getVisualSchema, validateVisualData, checkRichness, getStepCount, createVisual } from './schemas.js';

// Re-export all validated visual types
export const VALID_VISUAL_TYPES = [
  'process_flow',
  'timeline',
  'hierarchy_tree',
  'cycle',
  'concept_map',
  'matrix_2x2',
  'comparison_visual',
  'chart',
  'equation_steps',
  'formula_slider',
  'state_machine',
  'code_trace',
  'labeled_diagram'
];
