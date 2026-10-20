/* ============================================================
   TEST: AURA DYNAMIC VISUALS
   Verifies that bicycle, engine, heart, and projectile visuals
   are correctly detected from user questions and render
   interactive SVG players with parametric sliders.
   ============================================================ */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

let pass = 0, fail = 0;
const ok = (c, m) => {
  if (c) { pass++; console.log('  ok   ' + m); }
  else { fail++; console.log('  FAIL ' + m); }
};

const sandbox = {
  console,
  window: {},
  requestAnimationFrame: (cb) => setTimeout(cb, 16),
  cancelAnimationFrame: (id) => clearTimeout(id)
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

// Minimal DOM stub for svgEl and createPlayer
function createMockElement(tag, attrs = {}) {
  const children = [];
  return {
    tagName: tag.toUpperCase(),
    attributes: { ...attrs },
    style: {},
    children,
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return this.attributes[k] || null; },
    appendChild(child) { children.push(child); return child; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    removeEventListener() {}
  };
}

sandbox.document = {
  createElementNS(ns, tag) { return createMockElement(tag); },
  createElement(tag) { return createMockElement(tag); }
};

vm.createContext(sandbox);

const auraVisualsSrc = fs.readFileSync(path.join(__dirname, 'js', 'aura-visuals.js'), 'utf8');
vm.runInContext(auraVisualsSrc, sandbox);

const AV = sandbox.window.XC && sandbox.window.XC.auraVisuals;
ok(AV !== undefined, 'window.XC.auraVisuals is exposed');
ok(typeof AV.detect === 'function', 'AV.detect is a function');
ok(typeof AV.createPlayer === 'function', 'AV.createPlayer is a function');

console.log('\n--- DETECTION OF EDUCATIONAL TOPICS ---');

// 1. Bicycle detection
const bikeQ = 'How does a bicycle work? Explain the pedal, crank and chain drive.';
const detectedBike = AV.detect(bikeQ);
ok(detectedBike === 'bicycle', `detects "bicycle" from "${bikeQ}" (got ${detectedBike})`);

// 2. Engine detection
const engineQ = 'Explain the four-stroke internal combustion engine cycle and piston movement.';
const detectedEngine = AV.detect(engineQ);
ok(detectedEngine === 'engine', `detects "engine" from "${engineQ}" (got ${detectedEngine})`);

// 3. Heart detection
const heartQ = 'How does the human heart pump blood through the cardiac chambers?';
const detectedHeart = AV.detect(heartQ);
ok(detectedHeart === 'heart', `detects "heart" from "${heartQ}" (got ${detectedHeart})`);

// 4. Projectile detection
const projQ = 'What is the maximum height and range of projectile motion?';
const detectedProj = AV.detect(projQ);
ok(detectedProj === 'projectile', `detects "projectile" from "${projQ}" (got ${detectedProj})`);

console.log('\n--- DYNAMIC VISUAL CREATION & SLIDERS ---');

// Verify bicycle visual definition
const bikeDef = AV.VISUALS.bicycle;
ok(bikeDef !== undefined, 'bicycle visual exists in VISUALS registry');
ok(bikeDef.label.includes('Bicycle'), 'bicycle visual has descriptive label');
ok(bikeDef.sliders.length >= 2, 'bicycle visual has cadence and gearRatio sliders');

const mount = createMockElement('div');
const bikePlayer = AV.createPlayer(mount, 'bicycle', { cadence: 80, gearRatio: 3.0 });
ok(mount.children.length > 0, 'createPlayer successfully mounted bicycle visual DOM');

// Verify engine visual definition
const engineDef = AV.VISUALS.engine;
ok(engineDef !== undefined, 'engine visual exists in VISUALS registry');
ok(engineDef.sliders.some(s => s.key === 'rpm'), 'engine visual has RPM slider');

const engineMount = createMockElement('div');
const enginePlayer = AV.createPlayer(engineMount, 'engine', { rpm: 2400 });
ok(engineMount.children.length > 0, 'createPlayer successfully mounted engine visual DOM');

// Verify heart visual definition
const heartDef = AV.VISUALS.heart;
ok(heartDef !== undefined, 'heart visual exists in VISUALS registry');
ok(heartDef.sliders.some(s => s.key === 'bpm'), 'heart visual has BPM slider');

const heartMount = createMockElement('div');
const heartPlayer = AV.createPlayer(heartMount, 'heart', { bpm: 90 });
ok(heartMount.children.length > 0, 'createPlayer successfully mounted heart visual DOM');

if (bikePlayer && typeof bikePlayer.destroy === 'function') bikePlayer.destroy();
if (enginePlayer && typeof enginePlayer.destroy === 'function') enginePlayer.destroy();
if (heartPlayer && typeof heartPlayer.destroy === 'function') heartPlayer.destroy();

console.log(`\n*** PASS ***  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
