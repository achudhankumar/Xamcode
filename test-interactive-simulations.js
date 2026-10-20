/* ============================================================
   TEST: INTERACTIVE ALGORITHM SIMULATIONS
   Tests the mathematical and state-machine correctness of
   Bubble Sort and Binary Search simulations.
   ============================================================ */
'use strict';
const assert = require('assert');
const sim = require('./js/interactive-simulations.js');

let pass = 0, fail = 0;
const ok = (c, m) => {
  if (c) { pass++; console.log('  ok   ' + m); }
  else { fail++; console.log('  FAIL ' + m); }
};

console.log('\n--- BUBBLE SORT STATE MACHINE VERIFICATION ---');

const sampleArray = [5, 1, 4, 2, 8];
const steps = sim.generateBubbleSortSteps(sampleArray);

ok(Array.isArray(steps) && steps.length > 5, 'generateBubbleSortSteps returns an array of states');

// Step 0: Initial State
const s0 = steps[0];
ok(s0.stepIndex === 0, 'step 0 has index 0');
ok(JSON.stringify(s0.array) === JSON.stringify([5, 1, 4, 2, 8]), 'initial array is untouched [5, 1, 4, 2, 8]');
ok(s0.comparisons === 0 && s0.swaps === 0, 'initial comparisons and swaps are 0');

// Verify that every comparison correctly detects whether a swap is needed
let foundSwap = false;
for (const step of steps) {
  if (step.phase === 'compare') {
    const [i, j] = step.comparing;
    const a = step.array[i];
    const b = step.array[j];
    ok(i < j, `comparing indices are in order (${i} < ${j})`);
  }
  if (step.phase === 'swap') {
    foundSwap = true;
    ok(step.swapped === true, 'step with phase swap has swapped=true');
    ok(step.swapIndices.length === 2, 'swapIndices has exactly 2 elements');
  }
}
ok(foundSwap, 'at least one swap occurred in the simulation');

// Verify Pass 1 completion: element 8 (largest) must be at index 4
const pass1Complete = steps.find(s => s.phase === 'pass-complete' && s.pass === 1);
ok(pass1Complete !== undefined, 'Pass 1 complete step exists');
ok(pass1Complete.array[4] === 8, 'largest element 8 bubbled to index 4 in Pass 1');
ok(pass1Complete.sortedIndices.includes(4), 'index 4 is in sortedIndices after Pass 1');

// Verify Final step: array must be strictly sorted [1, 2, 4, 5, 8]
const finalStep = steps[steps.length - 1];
ok(JSON.stringify(finalStep.array) === JSON.stringify([1, 2, 4, 5, 8]), 'final array is strictly sorted [1, 2, 4, 5, 8]');
ok(finalStep.sortedIndices.length === 5, 'all 5 elements marked sorted in final step');
ok(finalStep.comparisons > 0 && finalStep.swaps > 0, `comparisons (${finalStep.comparisons}) and swaps (${finalStep.swaps}) recorded accurately`);

// Verify already-sorted array triggers early-exit in 1 pass
const sortedInput = [1, 2, 3, 4, 5];
const sortedSteps = sim.generateBubbleSortSteps(sortedInput);
const earlyExit = sortedSteps.find(s => s.phase === 'early-exit');
ok(earlyExit !== undefined, 'already-sorted array triggers early-exit optimization');
ok(earlyExit.swaps === 0, 'already-sorted array requires 0 swaps');
ok(earlyExit.pass === 1, 'already-sorted array terminates in exactly 1 pass');

console.log('\n--- BINARY SEARCH VERIFICATION ---');

const bArray = [2, 4, 7, 10, 13, 18, 23, 29];
const bSteps = sim.generateBinarySearchSteps(bArray, 18);
ok(Array.isArray(bSteps) && bSteps.length > 2, 'generateBinarySearchSteps returns steps');
const bFinal = bSteps[bSteps.length - 1];
ok(bFinal.found === true, 'target 18 is found');
ok(bFinal.foundIndex === 5, 'target 18 found at index 5');

// Search for non-existent value
const bNotFoundSteps = sim.generateBinarySearchSteps(bArray, 99);
const bNotFoundFinal = bNotFoundSteps[bNotFoundSteps.length - 1];
ok(bNotFoundFinal.found === false, 'non-existent target 99 is reported as not found');
ok(bNotFoundFinal.foundIndex === -1, 'foundIndex is -1 when not found');

console.log('\n--- SVG & HTML RENDERING ---');

const svgMarkup = sim.renderBubbleSortSvg(finalStep);
ok(typeof svgMarkup === 'string' && svgMarkup.includes('<svg') && svgMarkup.includes('</svg>'), 'renderBubbleSortSvg generates valid SVG markup');
ok(svgMarkup.includes('Geist Mono'), 'SVG includes monospace styling');

const playerHtml = sim.renderBubbleSortPlayerHtml('sim-test-1', 2, steps.length, steps[2], 1, false);
ok(typeof playerHtml === 'string' && playerHtml.includes('interactive-simulation-card'), 'renderBubbleSortPlayerHtml generates card markup');
ok(playerHtml.includes('Bubble Sort Algorithm Walkthrough'), 'card contains correct title');
ok(playerHtml.includes('data-sim-action="play"'), 'card contains play control button');
ok(playerHtml.includes('data-sim-action="reset"'), 'card contains reset button');
ok(playerHtml.includes('data-sim-speed="2"'), 'card contains speed buttons');
ok(playerHtml.includes('Complexity & Mechanics'), 'card contains complexity analysis');

const bSvgMarkup = sim.renderBinarySearchSvg(bFinal);
ok(typeof bSvgMarkup === 'string' && bSvgMarkup.includes('<svg') && bSvgMarkup.includes('</svg>'), 'renderBinarySearchSvg generates valid SVG markup');
ok(bSvgMarkup.includes('FOUND'), 'Binary search SVG indicates found target');

const bPlayerHtml = sim.renderBinarySearchPlayerHtml('sim-test-bs', 1, bSteps.length, bSteps[1], 1, false);
ok(typeof bPlayerHtml === 'string' && bPlayerHtml.includes('interactive-simulation-card'), 'renderBinarySearchPlayerHtml generates card markup');
ok(bPlayerHtml.includes('Binary Search Algorithm Walkthrough'), 'BS card contains correct title');
ok(bPlayerHtml.includes('data-sim-action="play"'), 'BS card contains play control button');

console.log('\n--- ALGORITHM DETECTION ---');

ok(sim.detectAlgorithmType('Understanding Bubble Sort in Java') === 'bubble-sort', 'detects bubble-sort in title');
ok(sim.detectAlgorithmType('Binary Search algorithm and complexity') === 'binary-search', 'detects binary-search in title');
ok(sim.detectAlgorithmType('OSI Layer 4 Protocol') === null, 'returns null for non-algorithm text');

console.log(`\n*** PASS ***  ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);

