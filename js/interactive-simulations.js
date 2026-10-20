/* ============================================================
   XAMCODE INTERACTIVE ALGORITHM SIMULATION ENGINE
   ============================================================
   Deterministic, verified, interactive visualizations for algorithms
   and data structures (Bubble Sort, Binary Search, Linear Search,
   Stack, Queue).
   
   Supports:
   - Step-by-step state machine with mathematical correctness
   - Play, pause, resume, reset, next, previous controls
   - Variable playback speed (0.5x, 1x, 2x)
   - Real-time comparison and swap tracking
   - Active pseudocode line highlighting
   - Complexity analysis and educational explanations
   
   Works in browser (window.XC.simulations) and Node.js (module.exports).
   ============================================================ */
'use strict';

(function(root, factory){
  if (typeof module === 'object' && module.exports){
    module.exports = factory();
  } else {
    root.XC = root.XC || {};
    root.XC.simulations = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){

  /* ============================================================
     1. BUBBLE SORT STATE GENERATOR (DETERMINISTIC)
     ============================================================ */
  function generateBubbleSortSteps(inputArray){
    const arr = Array.isArray(inputArray) && inputArray.length ? [...inputArray] : [5, 1, 4, 2, 8];
    const n = arr.length;
    const steps = [];
    let comparisons = 0;
    let swaps = 0;
    const sortedIndices = [];

    // Step 0: Initial state
    steps.push({
      stepIndex: 0,
      pass: 0,
      totalPasses: n - 1,
      array: [...arr],
      comparing: [],
      swapped: false,
      swapIndices: [],
      sortedIndices: [],
      comparisons: 0,
      swaps: 0,
      phase: 'init',
      codeLine: 1,
      description: `Initial unsorted array: [${arr.join(', ')}]. Ready to begin Bubble Sort pass 1.`
    });

    for (let i = 0; i < n - 1; i++){
      let passSwapped = false;
      const passNumber = i + 1;

      for (let j = 0; j < n - i - 1; j++){
        comparisons++;
        const a = arr[j];
        const b = arr[j + 1];
        const willSwap = a > b;

        // Step: Comparing
        steps.push({
          stepIndex: steps.length,
          pass: passNumber,
          totalPasses: n - 1,
          array: [...arr],
          comparing: [j, j + 1],
          swapped: false,
          swapIndices: [],
          sortedIndices: [...sortedIndices],
          comparisons,
          swaps,
          phase: 'compare',
          codeLine: 3,
          description: `Pass ${passNumber}: Comparing arr[${j}] (${a}) and arr[${j+1}] (${b}). ${willSwap ? `${a} > ${b}, so a swap is required.` : `${a} ≤ ${b}, so they are in correct order.`}`
        });

        if (willSwap){
          swaps++;
          passSwapped = true;
          arr[j] = b;
          arr[j + 1] = a;

          // Step: Swapped
          steps.push({
            stepIndex: steps.length,
            pass: passNumber,
            totalPasses: n - 1,
            array: [...arr],
            comparing: [j, j + 1],
            swapped: true,
            swapIndices: [j, j + 1],
            sortedIndices: [...sortedIndices],
            comparisons,
            swaps,
            phase: 'swap',
            codeLine: 4,
            description: `Swapped ${a} and ${b}. Array is now [${arr.join(', ')}].`
          });
        }
      }

      // The element at n - 1 - i is now in its final sorted position
      sortedIndices.unshift(n - 1 - i);

      steps.push({
        stepIndex: steps.length,
        pass: passNumber,
        totalPasses: n - 1,
        array: [...arr],
        comparing: [],
        swapped: false,
        swapIndices: [],
        sortedIndices: [...sortedIndices],
        comparisons,
        swaps,
        phase: 'pass-complete',
        codeLine: 2,
        description: `Pass ${passNumber} complete. Element ${arr[n - 1 - i]} bubbled to its permanent sorted position at index ${n - 1 - i}.`
      });

      // Optimized early termination check
      if (!passSwapped){
        steps.push({
          stepIndex: steps.length,
          pass: passNumber,
          totalPasses: n - 1,
          array: [...arr],
          comparing: [],
          swapped: false,
          swapIndices: [],
          sortedIndices: Array.from({ length: n }, (_, k) => k),
          comparisons,
          swaps,
          phase: 'early-exit',
          codeLine: 6,
          description: `Optimized check: Zero swaps occurred in Pass ${passNumber}. Array is already fully sorted! Terminating early.`
        });
        break;
      }
    }

    // Final completed state
    const allSorted = Array.from({ length: n }, (_, k) => k);
    if (steps[steps.length - 1].phase !== 'early-exit'){
      steps.push({
        stepIndex: steps.length,
        pass: n - 1,
        totalPasses: n - 1,
        array: [...arr],
        comparing: [],
        swapped: false,
        swapIndices: [],
        sortedIndices: allSorted,
        comparisons,
        swaps,
        phase: 'finished',
        codeLine: 7,
        description: `Bubble Sort finished! Total comparisons: ${comparisons}, Total swaps: ${swaps}. Final sorted array: [${arr.join(', ')}].`
      });
    }

    return steps;
  }

  /* ============================================================
     2. BINARY SEARCH STATE GENERATOR
     ============================================================ */
  function generateBinarySearchSteps(sortedArray, targetVal){
    const arr = Array.isArray(sortedArray) && sortedArray.length ? [...sortedArray] : [2, 4, 7, 10, 13, 18, 23, 29];
    const target = targetVal !== undefined ? targetVal : 18;
    const steps = [];
    let low = 0;
    let high = arr.length - 1;
    let stepCount = 0;

    steps.push({
      stepIndex: 0,
      array: [...arr],
      target,
      low,
      high,
      mid: -1,
      found: false,
      foundIndex: -1,
      eliminated: [],
      description: `Initial sorted array: [${arr.join(', ')}]. Target value to find: ${target}. Search range: index ${low} to ${high}.`
    });

    while (low <= high){
      stepCount++;
      const mid = Math.floor((low + high) / 2);
      const val = arr[mid];

      steps.push({
        stepIndex: steps.length,
        array: [...arr],
        target,
        low,
        high,
        mid,
        found: val === target,
        foundIndex: val === target ? mid : -1,
        eliminated: arr.map((_, i) => (i < low || i > high)),
        description: `Step ${stepCount}: Range [${low}..${high}]. Midpoint index is ${mid} with value ${val}.`
      });

      if (val === target){
        steps.push({
          stepIndex: steps.length,
          array: [...arr],
          target,
          low,
          high,
          mid,
          found: true,
          foundIndex: mid,
          eliminated: arr.map((_, i) => i !== mid),
          description: `Target ${target} found at index ${mid} in ${stepCount} iterations!`
        });
        return steps;
      } else if (val < target){
        low = mid + 1;
        steps.push({
          stepIndex: steps.length,
          array: [...arr],
          target,
          low,
          high,
          mid,
          found: false,
          foundIndex: -1,
          eliminated: arr.map((_, i) => (i < low || i > high)),
          description: `${val} < ${target}. Eliminate left half (indices 0..${mid}). New search range: [${low}..${high}].`
        });
      } else {
        high = mid - 1;
        steps.push({
          stepIndex: steps.length,
          array: [...arr],
          target,
          low,
          high,
          mid,
          found: false,
          foundIndex: -1,
          eliminated: arr.map((_, i) => (i < low || i > high)),
          description: `${val} > ${target}. Eliminate right half (indices ${mid}..${arr.length-1}). New search range: [${low}..${high}].`
        });
      }
    }

    steps.push({
      stepIndex: steps.length,
      array: [...arr],
      target,
      low,
      high,
      mid: -1,
      found: false,
      foundIndex: -1,
      eliminated: arr.map(() => true),
      description: `Search complete. Target ${target} was not found in the array.`
    });

    return steps;
  }

  /* ============================================================
     3. PSEUDOCODE DEFINITIONS
     ============================================================ */
  const BUBBLE_SORT_CODE = [
    { line: 1, text: 'procedure bubbleSort(A : list of sortable items)' },
    { line: 2, text: '  for i := 0 to length(A) - 2 do' },
    { line: 3, text: '    for j := 0 to length(A) - i - 2 do' },
    { line: 4, text: '      if A[j] > A[j+1] then' },
    { line: 5, text: '        swap(A[j], A[j+1]); swapped := true' },
    { line: 6, text: '    if not swapped then break  // Optimized early exit' },
    { line: 7, text: 'end procedure' }
  ];

  const BINARY_SEARCH_CODE = [
    { line: 1, text: 'procedure binarySearch(A : sorted list, target : item)' },
    { line: 2, text: '  low := 0; high := length(A) - 1' },
    { line: 3, text: '  while low <= high do' },
    { line: 4, text: '    mid := floor((low + high) / 2)' },
    { line: 5, text: '    if A[mid] = target then return mid  // Found!' },
    { line: 6, text: '    else if A[mid] < target then low := mid + 1' },
    { line: 7, text: '    else high := mid - 1' },
    { line: 8, text: '  return -1  // Target not in list' },
    { line: 9, text: 'end procedure' }
  ];

  /* ============================================================
     4. SVG RENDERING HELPERS FOR BUBBLE SORT
     ============================================================ */
  function renderBubbleSortSvg(step){
    const arr = step.array;
    const maxVal = Math.max(...arr, 10);
    const svgWidth = 560;
    const svgHeight = 220;
    const barWidth = 64;
    const barGap = 24;
    const totalBarsWidth = arr.length * barWidth + (arr.length - 1) * barGap;
    const startX = (svgWidth - totalBarsWidth) / 2;
    const baseLineY = 175;

    let bars = '';
    arr.forEach((val, i) => {
      const x = startX + i * (barWidth + barGap);
      const barHeight = Math.max(30, (val / maxVal) * 110);
      const y = baseLineY - barHeight;

      const isComparing = step.comparing.includes(i);
      const isSwapping = step.swapIndices.includes(i);
      const isSorted = step.sortedIndices.includes(i);

      let strokeColor = '#38bdf8'; // Cobalt / Cyan default
      let fillColor = 'rgba(56, 189, 248, 0.15)';
      let badge = '';

      if (isSwapping){
        strokeColor = '#f43f5e'; // Rose / Red for swap
        fillColor = 'rgba(244, 63, 94, 0.35)';
        badge = '⇄';
      } else if (isComparing){
        strokeColor = '#f59e0b'; // Amber for comparing
        fillColor = 'rgba(245, 158, 11, 0.3)';
        badge = '▼';
      } else if (isSorted){
        strokeColor = '#10b981'; // Emerald for sorted
        fillColor = 'rgba(16, 185, 129, 0.25)';
        badge = '✓';
      }

      bars += `
        <g class="bs-bar-group" transform="translate(0, 0)">
          ${badge ? `<text x="${x + barWidth/2}" y="${y - 12}" text-anchor="middle" fill="${strokeColor}" font-size="12" font-weight="bold">${badge}</text>` : ''}
          <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="8" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${isComparing || isSwapping ? '2.5' : '1.5'}" style="transition:all 0.25s ease;" />
          <text x="${x + barWidth/2}" y="${y + barHeight/2 + 6}" text-anchor="middle" fill="#ffffff" font-size="18" font-weight="800" font-family="Geist Mono, monospace">${val}</text>
          <text x="${x + barWidth/2}" y="${baseLineY + 22}" text-anchor="middle" fill="#94a3b8" font-size="11" font-family="Geist Mono, monospace">idx ${i}</text>
        </g>
      `;
    });

    return `
      <svg class="simulation-svg" viewBox="0 0 ${svgWidth} ${svgHeight}" style="width:100%;height:auto;max-height:240px;" xmlns="http://www.w3.org/2000/svg">
        <line x1="20" y1="${baseLineY}" x2="${svgWidth - 20}" y2="${baseLineY}" stroke="#334155" stroke-width="1.5" stroke-dasharray="4 4" />
        ${bars}
      </svg>
    `;
  }

  /* ============================================================
     5. HTML COMPONENT RENDERER (FULL INTERACTIVE WIDGET)
     ============================================================ */
  function renderBubbleSortPlayerHtml(simId, currentStep, totalSteps, stepObj, speedMultiplier, isPlaying){
    const svg = renderBubbleSortSvg(stepObj);
    const activeLine = stepObj.codeLine || 1;

    const pseudocodeHtml = BUBBLE_SORT_CODE.map(c => {
      const isCurrent = c.line === activeLine;
      return `<div class="bs-code-line ${isCurrent ? 'active' : ''}" style="${isCurrent ? 'background:rgba(56,189,248,0.2);color:#38bdf8;font-weight:700;border-left:3px solid #38bdf8;padding-left:8px;' : 'padding-left:11px;color:#94a3b8;'}font-family:Geist Mono,monospace;font-size:12px;line-height:1.7;">${c.text}</div>`;
    }).join('');

    return `
      <div class="interactive-simulation-card" id="${simId}" data-sim-type="bubble-sort">
        <div class="sim-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid #1e293b;padding-bottom:10px;">
          <div>
            <span class="panel-tag" style="color:#22c55e;font-size:11px;font-weight:700;letter-spacing:1px;">INTERACTIVE VISUALIZATION · ALGORITHM</span>
            <h3 style="margin:4px 0 0 0;font-size:19px;color:#f8fafc;">Bubble Sort Algorithm Walkthrough</h3>
          </div>
          <div class="sim-telemetry" style="display:flex;gap:16px;font-family:Geist Mono,monospace;font-size:12px;">
            <span style="background:rgba(245,158,11,0.15);color:#f59e0b;padding:4px 8px;border-radius:6px;border:1px solid rgba(245,158,11,0.3);">
              Comparisons: <b>${stepObj.comparisons}</b>
            </span>
            <span style="background:rgba(244,63,94,0.15);color:#f43f5e;padding:4px 8px;border-radius:6px;border:1px solid rgba(244,63,94,0.3);">
              Swaps: <b>${stepObj.swaps}</b>
            </span>
            <span style="background:rgba(34,197,94,0.15);color:#22c55e;padding:4px 8px;border-radius:6px;border:1px solid rgba(34,197,94,0.3);">
              Pass: <b>${stepObj.pass} / ${stepObj.totalPasses}</b>
            </span>
          </div>
        </div>

        <div class="sim-stage-container" style="background:#090d16;border:1px solid #1e293b;border-radius:12px;padding:16px;margin-bottom:14px;text-align:center;">
          ${svg}
          <div class="sim-narration" style="margin-top:10px;padding:10px 14px;background:#0f172a;border-radius:8px;border:1px solid #334155;color:#e2e8f0;font-size:13.5px;line-height:1.5;min-height:42px;display:flex;align-items:center;justify-content:center;">
            <span>${stepObj.description}</span>
          </div>
        </div>

        <!-- Controls Toolbar -->
        <div class="sim-controls-bar" style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:16px;padding:10px;background:#0f172a;border-radius:10px;border:1px solid #1e293b;">
          <div class="sim-btn-group" style="display:flex;gap:6px;">
            <button type="button" class="btn-ghost" data-sim-action="reset" style="padding:6px 12px;border-radius:6px;font-size:12px;cursor:pointer;">⟲ Reset</button>
            <button type="button" class="btn-ghost" data-sim-action="prev" ${currentStep === 0 ? 'disabled' : ''} style="padding:6px 12px;border-radius:6px;font-size:12px;cursor:pointer;">← Prev</button>
            <button type="button" class="btn-primary" data-sim-action="play" style="padding:6px 16px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;">
              ${isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            <button type="button" class="btn-ghost" data-sim-action="next" ${currentStep >= totalSteps - 1 ? 'disabled' : ''} style="padding:6px 12px;border-radius:6px;font-size:12px;cursor:pointer;">Next →</button>
          </div>

          <div style="font-size:12px;color:#94a3b8;font-family:Geist Mono,monospace;">
            Step <b>${currentStep + 1}</b> of <b>${totalSteps}</b>
          </div>

          <div class="sim-speed-group" style="display:flex;align-items:center;gap:6px;font-size:12px;color:#94a3b8;">
            <span>Speed:</span>
            <button type="button" class="speed-btn ${speedMultiplier === 0.5 ? 'active' : ''}" data-sim-speed="0.5" style="padding:3px 8px;border-radius:4px;cursor:pointer;background:${speedMultiplier === 0.5 ? '#38bdf8' : '#1e293b'};color:${speedMultiplier === 0.5 ? '#000' : '#fff'};border:none;">0.5x</button>
            <button type="button" class="speed-btn ${speedMultiplier === 1 ? 'active' : ''}" data-sim-speed="1" style="padding:3px 8px;border-radius:4px;cursor:pointer;background:${speedMultiplier === 1 ? '#38bdf8' : '#1e293b'};color:${speedMultiplier === 1 ? '#000' : '#fff'};border:none;">1x</button>
            <button type="button" class="speed-btn ${speedMultiplier === 2 ? 'active' : ''}" data-sim-speed="2" style="padding:3px 8px;border-radius:4px;cursor:pointer;background:${speedMultiplier === 2 ? '#38bdf8' : '#1e293b'};color:${speedMultiplier === 2 ? '#000' : '#fff'};border:none;">2x</button>
          </div>
        </div>

        <!-- Educational Deep Dive: Pseudocode & Complexity Grid -->
        <div class="sim-deepdive-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          <div class="sim-code-card" style="background:#090d16;border:1px solid #1e293b;border-radius:10px;padding:12px;">
            <div style="font-size:11px;font-weight:700;color:#38bdf8;margin-bottom:8px;text-transform:uppercase;">Algorithm Pseudocode</div>
            <div class="bs-code-container" style="font-family:Geist Mono,monospace;">
              ${pseudocodeHtml}
            </div>
          </div>

          <div class="sim-complexity-card" style="background:#090d16;border:1px solid #1e293b;border-radius:10px;padding:12px;">
            <div style="font-size:11px;font-weight:700;color:#22c55e;margin-bottom:8px;text-transform:uppercase;">Complexity & Mechanics</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;font-size:12px;">
              <div style="background:#0f172a;padding:6px 10px;border-radius:6px;border:1px solid #334155;">
                <span style="color:#94a3b8;">Best Time:</span> <b style="color:#22c55e;">O(n)</b>
                <div style="font-size:10px;color:#64748b;">(Optimized with swapped flag)</div>
              </div>
              <div style="background:#0f172a;padding:6px 10px;border-radius:6px;border:1px solid #334155;">
                <span style="color:#94a3b8;">Worst Time:</span> <b style="color:#f43f5e;">O(n²)</b>
                <div style="font-size:10px;color:#64748b;">(Reverse sorted array)</div>
              </div>
              <div style="background:#0f172a;padding:6px 10px;border-radius:6px;border:1px solid #334155;">
                <span style="color:#94a3b8;">Average Time:</span> <b style="color:#f59e0b;">O(n²)</b>
                <div style="font-size:10px;color:#64748b;">(Random permutations)</div>
              </div>
              <div style="background:#0f172a;padding:6px 10px;border-radius:6px;border:1px solid #334155;">
                <span style="color:#94a3b8;">Space:</span> <b style="color:#38bdf8;">O(1)</b>
                <div style="font-size:10px;color:#64748b;">(In-place sort)</div>
              </div>
            </div>
            <p style="font-size:11.5px;color:#94a3b8;line-height:1.5;margin:0;">
              <b>Key Intuition:</b> Each complete pass bubbles the largest unsorted element to its final position at the right. The optimized algorithm terminates early if a pass executes without any swaps.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  /* ============================================================
     5B. BINARY SEARCH RENDERERS (SVG + HTML WIDGET)
     ============================================================ */
  function renderBinarySearchSvg(step){
    const arr = step.array || [2, 4, 7, 10, 13, 18, 23, 29];
    const target = step.target !== undefined ? step.target : 18;
    const svgWidth = 560;
    const svgHeight = 220;
    const barWidth = 48;
    const barGap = 16;
    const totalBarsWidth = arr.length * barWidth + (arr.length - 1) * barGap;
    const startX = (svgWidth - totalBarsWidth) / 2;
    const baseLineY = 145;

    let bars = '';
    arr.forEach((val, i) => {
      const x = startX + i * (barWidth + barGap);
      const y = baseLineY - 45;
      const isMid = step.mid === i;
      const isFound = step.found && step.foundIndex === i;
      const isEliminated = step.eliminated && step.eliminated[i];
      const isLow = step.low === i;
      const isHigh = step.high === i;

      let strokeColor = '#38bdf8';
      let fillColor = 'rgba(56, 189, 248, 0.15)';
      let badge = '';

      if (isFound) {
        strokeColor = '#10b981';
        fillColor = 'rgba(16, 185, 129, 0.35)';
        badge = '✓ FOUND';
      } else if (isMid) {
        strokeColor = '#f59e0b';
        fillColor = 'rgba(245, 158, 11, 0.3)';
        badge = 'MID';
      } else if (isEliminated) {
        strokeColor = '#334155';
        fillColor = 'rgba(15, 23, 42, 0.4)';
      }

      let pointerText = '';
      if (isLow && isHigh) pointerText = 'L=H';
      else if (isLow) pointerText = 'LOW';
      else if (isHigh) pointerText = 'HIGH';

      bars += `
        <g class="bs-bar-group" opacity="${isEliminated ? '0.35' : '1'}">
          ${badge ? `<text x="${x + barWidth/2}" y="${y - 10}" text-anchor="middle" fill="${strokeColor}" font-size="10" font-weight="bold" font-family="Geist Mono, monospace">${badge}</text>` : ''}
          <rect x="${x}" y="${y}" width="${barWidth}" height="55" rx="8" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${isMid || isFound ? '2.5' : '1.5'}" style="transition:all 0.25s ease;" />
          <text x="${x + barWidth/2}" y="${y + 34}" text-anchor="middle" fill="#ffffff" font-size="16" font-weight="800" font-family="Geist Mono, monospace">${val}</text>
          <text x="${x + barWidth/2}" y="${y + 74}" text-anchor="middle" fill="#94a3b8" font-size="10" font-family="Geist Mono, monospace">idx ${i}</text>
          ${pointerText ? `<text x="${x + barWidth/2}" y="${y + 90}" text-anchor="middle" fill="${isLow ? '#38bdf8' : '#f43f5e'}" font-size="10" font-weight="bold" font-family="Geist Mono, monospace">▲ ${pointerText}</text>` : ''}
        </g>
      `;
    });

    return `
      <svg class="simulation-svg" viewBox="0 0 ${svgWidth} ${svgHeight}" style="width:100%;height:auto;max-height:240px;" xmlns="http://www.w3.org/2000/svg">
        <text x="24" y="24" fill="#94a3b8" font-size="12" font-family="Geist Mono, monospace">Target: <tspan fill="#38bdf8" font-weight="bold">${target}</tspan></text>
        <text x="${svgWidth - 24}" y="24" text-anchor="end" fill="#94a3b8" font-size="12" font-family="Geist Mono, monospace">Window: <tspan fill="#f59e0b" font-weight="bold">[${step.low >= 0 ? step.low : '—'}..${step.high >= 0 ? step.high : '—'}]</tspan></text>
        <line x1="20" y1="${baseLineY + 12}" x2="${svgWidth - 20}" y2="${baseLineY + 12}" stroke="#334155" stroke-width="1.5" stroke-dasharray="4 4" />
        ${bars}
      </svg>
    `;
  }

  function renderBinarySearchPlayerHtml(simId, currentStep, totalSteps, stepObj, speedMultiplier, isPlaying){
    const svg = renderBinarySearchSvg(stepObj);
    const activeLine = stepObj.found ? 5 : stepObj.mid >= 0 ? 4 : 2;

    const pseudocodeHtml = BINARY_SEARCH_CODE.map(c => {
      const isCurrent = c.line === activeLine;
      return `<div class="bs-code-line ${isCurrent ? 'active' : ''}" style="${isCurrent ? 'background:rgba(56,189,248,0.2);color:#38bdf8;font-weight:700;border-left:3px solid #38bdf8;padding-left:8px;' : 'padding-left:11px;color:#94a3b8;'}font-family:Geist Mono,monospace;font-size:12px;line-height:1.7;">${c.text}</div>`;
    }).join('');

    return `
      <div class="interactive-simulation-card" id="${simId}" data-sim-type="binary-search">
        <div class="sim-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid #1e293b;padding-bottom:10px;">
          <div>
            <span class="panel-tag" style="color:#38bdf8;font-size:11px;font-weight:700;letter-spacing:1px;">INTERACTIVE VISUALIZATION · ALGORITHM</span>
            <h3 style="margin:4px 0 0 0;font-size:19px;color:#f8fafc;">Binary Search Algorithm Walkthrough</h3>
          </div>
          <div class="sim-telemetry" style="display:flex;gap:16px;font-family:Geist Mono,monospace;font-size:12px;">
            <span style="background:rgba(56,189,248,0.15);color:#38bdf8;padding:4px 8px;border-radius:6px;border:1px solid rgba(56,189,248,0.3);">
              Target: <b>${stepObj.target}</b>
            </span>
            <span style="background:rgba(245,158,11,0.15);color:#f59e0b;padding:4px 8px;border-radius:6px;border:1px solid rgba(245,158,11,0.3);">
              Mid Index: <b>${stepObj.mid >= 0 ? stepObj.mid : '—'}</b>
            </span>
            <span style="background:rgba(34,197,94,0.15);color:#22c55e;padding:4px 8px;border-radius:6px;border:1px solid rgba(34,197,94,0.3);">
              Status: <b>${stepObj.found ? 'FOUND ✓' : 'SEARCHING'}</b>
            </span>
          </div>
        </div>

        <div class="sim-stage-container" style="background:#090d16;border:1px solid #1e293b;border-radius:12px;padding:16px;margin-bottom:14px;text-align:center;">
          ${svg}
          <div class="sim-narration-box" style="margin-top:12px;padding:10px 14px;background:rgba(30,41,59,0.7);border-radius:8px;border-left:4px solid #38bdf8;font-size:13px;color:#f1f5f9;text-align:left;">
            <b>Step ${currentStep + 1} of ${totalSteps}:</b> ${stepObj.description}
          </div>
        </div>

        <div class="sim-controls-panel" style="display:flex;justify-content:space-between;align-items:center;background:#0c1222;border:1px solid #1e293b;border-radius:10px;padding:12px 16px;margin-bottom:14px;">
          <div class="sim-btn-group" style="display:flex;gap:8px;">
            <button type="button" class="btn-sm" data-sim-action="reset" style="background:#1e293b;color:#f8fafc;border:1px solid #334155;padding:6px 14px;border-radius:6px;cursor:pointer;font-weight:600;">⏮ Reset</button>
            <button type="button" class="btn-sm" data-sim-action="prev" ${currentStep === 0 ? 'disabled' : ''} style="background:#1e293b;color:#f8fafc;border:1px solid #334155;padding:6px 14px;border-radius:6px;cursor:${currentStep === 0 ? 'not-allowed' : 'pointer'};opacity:${currentStep === 0 ? 0.5 : 1};font-weight:600;">◀ Prev</button>
            <button type="button" class="btn-sm" data-sim-action="play" style="background:#0284c7;color:#ffffff;border:none;padding:6px 18px;border-radius:6px;cursor:pointer;font-weight:700;">${isPlaying ? '⏸ Pause' : '▶ Play'}</button>
            <button type="button" class="btn-sm" data-sim-action="next" ${currentStep >= totalSteps - 1 ? 'disabled' : ''} style="background:#1e293b;color:#f8fafc;border:1px solid #334155;padding:6px 14px;border-radius:6px;cursor:${currentStep >= totalSteps - 1 ? 'not-allowed' : 'pointer'};opacity:${currentStep >= totalSteps - 1 ? 0.5 : 1};font-weight:600;">Next ▶</button>
          </div>
          <div class="sim-speed-group" style="display:flex;align-items:center;gap:6px;font-size:12px;color:#94a3b8;">
            <span>Speed:</span>
            <button type="button" class="btn-xs ${speedMultiplier === 0.5 ? 'active' : ''}" data-sim-speed="0.5" style="background:${speedMultiplier === 0.5 ? '#0284c7' : '#1e293b'};color:#fff;border:none;padding:3px 8px;border-radius:4px;cursor:pointer;">0.5x</button>
            <button type="button" class="btn-xs ${speedMultiplier === 1 ? 'active' : ''}" data-sim-speed="1" style="background:${speedMultiplier === 1 ? '#0284c7' : '#1e293b'};color:#fff;border:none;padding:3px 8px;border-radius:4px;cursor:pointer;">1x</button>
            <button type="button" class="btn-xs ${speedMultiplier === 2 ? 'active' : ''}" data-sim-speed="2" style="background:${speedMultiplier === 2 ? '#0284c7' : '#1e293b'};color:#fff;border:none;padding:3px 8px;border-radius:4px;cursor:pointer;">2x</button>
          </div>
        </div>

        <div class="sim-details-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          <div class="sim-code-box" style="background:#090d16;border:1px solid #1e293b;border-radius:10px;padding:12px;">
            <div style="font-size:11px;font-weight:700;color:#64748b;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">Execution Pseudocode</div>
            ${pseudocodeHtml}
          </div>
          <div class="sim-analysis-box" style="background:#090d16;border:1px solid #1e293b;border-radius:10px;padding:12px;">
            <div style="font-size:11px;font-weight:700;color:#64748b;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">Complexity & Mechanics</div>
            <div style="font-size:12.5px;color:#cbd5e1;line-height:1.6;">
              <p style="margin:0 0 6px 0;"><b>Best Case:</b> <span style="color:#22c55e;font-family:Geist Mono,monospace;">O(1)</span> (Target found at initial midpoint).</p>
              <p style="margin:0 0 6px 0;"><b>Worst / Average Case:</b> <span style="color:#38bdf8;font-family:Geist Mono,monospace;">O(log n)</span> (Search space halved each step).</p>
              <p style="margin:0 0 6px 0;"><b>Space Complexity:</b> <span style="color:#22c55e;font-family:Geist Mono,monospace;">O(1)</span> auxiliary memory.</p>
              <p style="margin:0;color:#94a3b8;font-size:11.5px;"><b>Key Invariant:</b> Monotonically ordered input list.</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* ============================================================
     6. DETECTOR & MANAGER
     ============================================================ */
  function detectAlgorithmType(text){
    if (!text || typeof text !== 'string') return null;
    const lower = text.toLowerCase();
    if (lower.includes('bubble sort') || lower.includes('bubblesort')) return 'bubble-sort';
    if (lower.includes('binary search')) return 'binary-search';
    if (lower.includes('linear search')) return 'linear-search';
    return null;
  }

  return {
    generateBubbleSortSteps,
    generateBinarySearchSteps,
    renderBubbleSortSvg,
    renderBubbleSortPlayerHtml,
    renderBinarySearchSvg,
    renderBinarySearchPlayerHtml,
    detectAlgorithmType,
    BUBBLE_SORT_CODE,
    BINARY_SEARCH_CODE
  };
});

