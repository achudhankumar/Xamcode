/* PHASE 5: VISUAL SYSTEM CORE — AuraVisualEngine.jsx */
/* Renderer component with play/pause/next/previous/caption controls */

import React, { useState, useEffect, useCallback } from 'react';
import { createVisual, checkRichness, getStepCount, getVisualSchema } from './index.js';

/**
 * AuraVisualEngine
 * Core renderer component that consumes a visual data structure and provides
 * standard controls: play/pause, next/previous navigation, and caption display.
 *
 * @param {Object} props
 * @param {Object} props.visual - The visual data object (steps, theme, config)
 * @param {string} props.type - Visual type (process_flow, timeline, etc.)
 * @param {Function} props.onStateChange - Callback for state changes (stepIdx, playing)
 * @param {Object} props.theme - Theme override (colors, fonts)
 */
export function AuraVisualEngine({ visual, type, onStateChange, theme }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [intervalId, setIntervalId] = useState(null);

  // Normalize the visual data using the schema helpers
  const normalized = useCallback((v, t) => {
    if (!v || !getVisualSchema(t)) {
      return createVisual(t, {
        steps: (v && v.steps) || [],
        theme: (v && v.theme) || theme || 'light',
        config: (v && v.config) || {}
      });
    }
    return v;
  }, [theme]);

  const normalizedVis = normalized(visual, type);

  // Validate richness (minimum 4 steps)
  const isValid = checkRichness(normalizedVis);

  // Ensure valid step index
  const clampStep = (idx) => Math.max(0, Math.min(stepIdx, Math.max(0, normalizedVis.steps.length - 1)));

  // Navigation handlers
  const goNext = useCallback(() => {
    const next = clampStep(stepIdx + 1);
    setStepIdx(next);
    onStateChange && onStateChange({ stepIdx: next, playing });
  }, [stepIdx, playing, onStateChange]);

  const goPrevious = useCallback(() => {
    const prev = clampStep(stepIdx - 1);
    setStepIdx(prev);
    onStateChange && onStateChange({ stepIdx: prev, playing });
  }, [stepIdx, playing, onStateChange]);

  const jumpTo = useCallback((idx) => {
    const clamped = clampStep(idx);
    setStepIdx(clamped);
    onStateChange && onStateChange({ stepIdx: clamped, playing });
  }, [onStateChange]);

  // Play/pause toggle
  const togglePlay = useCallback(() => {
    if (playing) {
      // Stop
      if (intervalId) {
        clearInterval(intervalId);
        setIntervalId(null);
      }
      setPlaying(false);
      onStateChange && onStateChange({ stepIdx, playing: false });
    } else {
      // Start
      if (normalizedVis.config.autoPlay) {
        const id = setInterval(() => {
          if (stepIdx < normalizedVis.steps.length - 1) {
            setStepIdx(stepIdx + 1);
            onStateChange && onStateChange({ stepIdx: stepIdx + 1, playing: true });
          } else {
            setPlaying(false);
            onStateChange && onStateChange({ stepIdx: stepIdx, playing: false });
          }
        }, normalizedVis.config.interval);
        setIntervalId(id);
      }
      setPlaying(true);
      onStateChange && onStateChange({ stepIdx, playing: true });
    }
  }, [playing, intervalId, stepIdx, normalizedVis.config.interval, onStateChange]);

  // Auto-play is only valid for rich visuals
  const canAutoPlay = isValid && normalizedVis.config.loop;

  // Caption generated from current step
  const currentStep = normalizedVis.steps[stepIdx];
  const caption = currentStep?.caption ||
    currentStep?.title ||
    `Step ${stepIdx + 1}: ${normalizedVis.steps.length} total`;
  // Rendering depends on visual type
  const renderVisual = () => {
    // This is the hook for the framework to render type-specific content
    switch (type) {
      case 'process_flow':
        return <ProcessFlowVisual steps={normalizedVis.steps} activeIdx={stepIdx} />;
      case 'timeline':
        return <TimelineVisual events={normalizedVis.events} activeIdx={stepIdx} />;
      case 'hierarchy_tree':
        return <HierarchyTreeVisual root={normalizedVis.root} activeIdx={stepIdx} />;
      case 'cycle':
        return <CycleVisual stages={normalizedVis.stages} activeIdx={stepIdx} />;
      case 'concept_map':
        return <ConceptMapVisual nodes={normalizedVis.nodes} edges={normalizedVis.edges} />;
      case 'matrix_2x2':
        return <Matrix2x2Visual quadrants={normalizedVis.quadrants} />;
      case 'comparison_visual':
        return <ComparisonVisual items={normalizedVis.items} />;
      case 'chart':
        return <ChartVisual data={normalizedVis.data} />;
      case 'equation_steps':
        return <EquationStepsVisual equations={normalizedVis.equations} />;
      case 'formula_slider':
        return <FormulaSliderVisual variables={normalizedVis.variables} />;
      case 'state_machine':
        return <StateMachineVisual states={normalizedVis.states} transitions={normalizedVis.transitions} />;
      case 'code_trace':
        return <CodeTraceVisual trace={normalizedVis.trace} />;
      case 'labeled_diagram':
        return <LabeledDiagramVisual diagram={normalizedVis.diagram} labels={normalizedVis.labels} />;
      default:
        return <DefaultVisual steps={normalizedVis.steps} activeIdx={stepIdx} />;
    }
  };

  return (
    <div className="aura-visual-engine">
      <div className="aura-visual-header">
        <h2>{normalizedVis.title || 'Visual'}</h2>
        <span className="aura-visual-type">{type}</span>
      </div>

      <div className="aura-visual-content">
        {renderVisual()}
      </div>

      <div className="aura-visual-footer">
        <div className="aura-visual-caption">
          <span className="aura-caption-label">Caption:</span>
          <span className="aura-caption-text">{caption}</span>
        </div>

        <div className="aura-visual-controls">
          <button
            className="aura-btn aura-btn-secondary"
            onClick={goPrevious}
            disabled={stepIdx === 0}
            aria-label="Previous step"
          >
            &larr; Previous
          </button>

          <button
            className={`aura-btn aura-btn-primary ${playing ? 'aura-btn-playing' : ''}`}
            onClick={togglePlay}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? '&bull; Pause' : '&rarr; Play'}
          </button>

          <button
            className="aura-btn aura-btn-secondary"
            onClick={goNext}
            disabled={stepIdx >= normalizedVis.steps.length - 1}
            aria-label="Next step"
          >
            Next &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * DefaultVisual - Fallback renderer for unknown visual types
 */
function DefaultVisual({ steps, activeIdx }) {
  if (!steps || steps.length === 0) {
    return <div className="aura-visual-empty">No steps available.</div>;
  }
  const step = steps[Math.min(activeIdx, steps.length - 1)];
  return (
    <div className="aura-visual-empty">
      <div className="aura-step-placeholder">
        <h3>{step?.title || `Step ${activeIdx + 1}`}</h3>
        <p>{step?.description || 'Render content for this step in the framework.' }</p>
      </div>
    </div>
  );
}

export default AuraVisualEngine;
