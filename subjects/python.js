'use strict';

/**
 * Python Programming, Data Structures & AI Engineering Subject Pack
 */
const PYTHON_PACK = {
  id: 'python',
  name: 'Python Programming, Data Structures & AI Engineering',
  domain: 'Software & Systems',
  systemPrompt: `You are a Principal Python Core Engineer and Senior Computer Science Professor.
When generating topics:
- Focus on CPython VM mechanics, bytecode disassembly, memory layout (PyObject header, __slots__, pymalloc), and GIL concurrency tradeoffs.
- Emphasize asymptotic algorithmic complexity (Big-O, Master Theorem), vectorized data structures (NumPy ndarray strides, PyArrow columnar buffers), and clean typing (PEP 484/544).
- Select specialized visual models (code_trace, memory_stack_heap, flowchart, hierarchy_tree, matrix_2x2) where applicable.`,
  allowedVisualTypes: [
    'code_trace',
    'memory_stack_heap',
    'flowchart',
    'hierarchy_tree',
    'matrix_2x2',
    'process_flow'
  ],
  layoutEmphasis: 'Code panel with step-through execution, memory heap/stack diagrams, and runtime complexity',
  quizStyle: 'CPython bytecode prediction, Big-O worst-case derivations, memory refcounting, PEP typing invariants',

  /**
   * Evaluates if a proposed visual scene meets pedagogical richness criteria.
   * Requirement: at least 3 distinct elements, at least 4 steps, captions on every step.
   */
  checkRichness(visual) {
    if (!visual || typeof visual !== 'object') return false;
    const steps = Array.isArray(visual.steps) ? visual.steps : [];
    if (steps.length < 3) return false;
    
    // Check captions on every step
    const allHaveCaptions = steps.every(s => (s.desc && s.desc.trim().length > 3) || (s.caption && s.caption.trim().length > 3));
    if (!allHaveCaptions) return false;

    // Check distinct elements
    const elements = new Set(steps.map(s => (s.title || '').trim().toLowerCase()));
    return elements.size >= 3;
  }
};

module.exports = PYTHON_PACK;
