'use strict';
/* Drives the real journey functions against a minimal DOM so the
   shooting-star progress bar is verified behaviourally, not just
   eyeballed. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const html=fs.readFileSync(path.join(__dirname,'XamCode.html'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'js','app.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'css','components.css'),'utf8');

let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ok   '+m);} else {fail++;console.log('  FAIL '+m);} };

/* ---- minimal DOM good enough for the star bar ---- */
const NODES={};
const makeEl=id=>({
  id,dataset:{},style:{},attrs:{},hidden:false,
  setAttribute(k,v){this.attrs[k]=String(v);},
  getAttribute(k){return this.attrs[k];},
  removeAttribute(k){delete this.attrs[k];}
});
const fill=makeEl('journeyFill'),caption=makeEl('journeyCaption'),journey=makeEl('pdfJourney');
journey.hidden=true;
Object.assign(NODES,{journeyFill:fill,journeyCaption:caption,pdfJourney:journey});

const start=app.indexOf('const journeyEl=');
const end=app.indexOf('const setUploadStage=');
if(start<0||end<0) throw new Error('journey block not found in app.js');
const block=app.slice(start,end)
  .replace(/document\.getElementById\('([\w-]+)'\)/g,(m,id)=>`NODES['${id}']`);

/* An advancing clock. The bar eases on elapsed time, so a frozen
   performance.now() would collapse every position back to zero and hide
   the monotonic-advance behaviour we actually want to assert. */
let now=0;
const sandbox={
  NODES,module:{exports:{}},window:{setTimeout(){}},
  performance:{now:()=>now},requestAnimationFrame(){return 1;},cancelAnimationFrame(){},
  escapeHtml:s=>String(s),console,Math,Number,String,Array,Object
};
vm.createContext(sandbox);
vm.runInContext(block+
  '\nmodule.exports={journeyReset,journeySetPosition,journeyFinish,journeyHide,journeyStartDrive,journeySetReal,journeySetStage,journeySetJobProgress};',
  sandbox);
const api=sandbox.module.exports;
/* top-level let/const live in the context's global lexical scope */
const peek=name=>vm.runInContext(name,sandbox);
/* The width of the trail IS the percentage - the only progress read-out. */
const trail=()=>parseFloat(fill.style.width)||0;

console.log('\nmarkup is present and accessible');
ok(html.includes('id="pdfJourney"'),'the journey panel exists in the document');
ok(html.includes('id="journeyFill" class="journey-fill"'),'the comet trail is the fill element');
ok(html.includes('style="width:0%"'),'the trail ships empty, ready for the first stage');
ok(html.includes('class="journey-star"'),'the comet head is in the markup');
ok((html.match(/class="journey-starlet"/g)||[]).length===8,
  'eight starlets twinkle in the sky behind it');
ok(html.includes('class="journey-meteor"'),'a background meteor streaks across the sky');
ok(/class="pdf-journey"[^>]*aria-hidden="true"/.test(html),
  'the decorative bar is hidden from screen readers');
ok(html.includes('role="progressbar"'),'a real progressbar is still exposed for assistive tech');
ok(html.includes('id="journeyCaption"'),'the caption under the bar is kept');

console.log('\nthe stickman arena is gone, not merely hidden');
ok(!html.includes('journeyHero')&&!html.includes('journeyDesk')&&!html.includes('journeyFoes'),
  'no hero, desk or field container is left in the markup');
ok(!html.includes('journey-foe')&&!html.includes('journey-crystal')&&!html.includes('journey-folder'),
  'nor any figure or prop');
ok(!/pdf-journey-svg/.test(html),'the arena svg is gone');

console.log('\nthe bar is positioned by width, not by SVG transforms');
const panel=/id="pdfJourney"[\s\S]*?id="journeyCaption"/.exec(html)[0];
ok(Boolean(panel),'the panel markup can be isolated for inspection');
ok(!/<svg/.test(panel),'no SVG is left inside the panel');
/* A CSS `transform` REPLACES a `transform` presentation attribute rather
   than composing with it, so anything carrying one and also animated would
   snap to the origin. The bar must never reintroduce that trap. */
ok(!/\btransform=/.test(panel),'nothing in the bar carries a transform attribute');

console.log('\nevery real server stage has a beat of its own');
const map=peek('JOURNEY_STAGE_PHASE');
const expected={queued:'idle',extract:'run',outline:'run',sections:'run',
  bank:'run',validate:'charge',ready:'finale'};
Object.entries(expected).forEach(([stage,phase])=>{
  ok(map[stage]===phase,`${stage} maps to the "${phase}" beat`);
});
api.journeyReset();
Object.entries(expected).forEach(([stage,phase])=>{
  api.journeySetStage(stage,`on ${stage}`);
  ok(journey.dataset.phase===phase,`reporting ${stage} puts the bar in "${phase}"`);
});
ok(caption.textContent==='on ready','the caption shows the real server stage label');

console.log('\nan out-of-order poll cannot rewind the bar');
api.journeySetStage('outline','back to outline');
ok(journey.dataset.phase==='finale','a stale earlier stage is ignored rather than replayed');
api.journeySetStage('nonsense');
ok(journey.dataset.phase==='finale','an unknown stage name is ignored');

console.log('\nthe trail IS the percentage');
api.journeyReset();
ok(trail()===0,`an empty trail starts at 0 (got ${trail()})`);
api.journeySetPosition(0.5);
ok(trail()===50,`half way through the trail reaches 50% (got ${trail()})`);
api.journeySetPosition(1);
ok(trail()===100,`at the end the trail runs the full width (got ${trail()})`);

console.log('\nprogress never rewinds inside a run');
api.journeyReset();
api.journeySetPosition(0.8);
const atEighty=trail();
api.journeySetPosition(0.3);
ok(trail()===atEighty,
  `a late poll reporting less does not pull the comet back (${atEighty} -> ${trail()})`);

console.log('\nfinishing lands the comet at the finish');
api.journeyReset();
api.journeySetPosition(0.4);
api.journeyFinish();
ok(journey.dataset.phase==='finale','phase becomes "finale", the last beat of the bar');
ok(trail()===100,`the trail runs the full width (${trail()}%)`);
ok(peek('journeyStage')==='ready','the bar is sitting on the ready stage');

console.log('\nthe finale is only reachable by finishing, never by a timer');
api.journeyReset();
now=0;
api.journeyStartDrive(0.24);
now=20000;                      /* twenty seconds of easing on the reading stage */
api.journeyStartDrive(0.24);
ok(trail()>0,`the timed driver does advance the trail (${trail()}%)`);
ok(journey.dataset.phase!=='finale',
  `and it is still mid-flight, never finished (phase "${journey.dataset.phase}")`);
api.journeyStartDrive(0.46);    /* the upload milestone arrives */
ok(peek('journeyCeiling')===0.46,'a later milestone raises the ceiling');
ok(trail()<100,`nor does raising the ceiling finish it (${trail()}%)`);

console.log('\nreal progress from the pipeline takes over the estimate');
api.journeyHide();
api.journeyReset();
api.journeySetReal(0.31);
ok(trail()===31,`measured byte progress lands on the trail (${trail()}%)`);
api.journeySetJobProgress(42);
ok(trail()===42,`the server percentage drives the trail directly (${trail()}%)`);
ok(peek('journeyCeiling')===0.42,'and becomes the ceiling the ease may reach');
ok(peek('journeyForce')===false,'the timed driver is stopped so it cannot fight the server');

console.log('\nteardown stops the animation and resets state');
api.journeyHide();
ok(journey.hidden===true,'the journey is hidden after a run');
ok(journey.dataset.phase==='idle','phase resets to idle');
ok(peek('journeyCeiling')===0,'the ceiling resets so the next run starts from zero');
ok(peek('journeyForce')===false,'the animation loop is stopped');
ok(peek('journeyStage')===null,"the next run does not inherit the last run's beat");
ok(peek('journeySettled')===0,'and the trail starts empty again');
api.journeyReset();
ok(trail()===0,`the bar starts from an empty trail again (${trail()}%)`);

console.log('\nthe script builds a bar, not a field of figures');
ok(!/journeyFoe|journeyFigure|journeyBuildScene|JOURNEY_FOES/.test(app),
  'the stickman builders are gone from the script');
ok(app.includes('journeyFill.style.width'),'the trail is driven by width');
ok(app.includes('journeySetPosition'),'the trail driver is still wired to the pipeline');

console.log('\nthe comet owns a fixed palette, not the theme accent');
/* The app's --accent is theme-dependent (pink, purple, blue, orange). If the
   comet borrowed it, a theme could land it near-white and wash it out against
   the night sky. The bar paints itself; the caption and the preview trigger
   are app chrome and SHOULD follow the theme. */
const sky=css.slice(css.indexOf('.pdf-journey{'),css.indexOf('.journey-caption{'));
ok(/--journey-hero:#5fe3e0/.test(sky),'the sky declares its own cyan for the comet');
ok(!/var\(--accent/.test(sky),'no rule that paints the bar borrows a theme token');

console.log('\nthe star bar animates, and holds still when asked to');
ok(css.includes('@keyframes journeyStarPulse'),'the comet pulses along the trail');
ok(css.includes('@keyframes journeyStarBurst'),'and bursts at the finish');
ok(css.includes('@keyframes journeyTwinkle'),'the starlets twinkle');
ok(css.includes('@keyframes journeyMeteor'),'the meteor streaks across the sky');
ok(css.includes('.journey-preview-trigger'),'the preview trigger is still styled');
ok(!/\.journey-(?:foe|hero|crystal|folder|spark)\b|journeyFall/.test(css),
  'no stickman or prop rule is left in the stylesheet');

console.log('\nreduced motion still reports the real percentage');
const rmStart=css.indexOf('@media (prefers-reduced-motion:reduce)',css.indexOf('.journey-caption{'));
ok(rmStart>=0,'a reduced-motion block covers the bar');
const rm=rmStart<0?'':css.slice(rmStart,css.indexOf('\n}',rmStart)+2);
ok(/\.journey-fill\{transition:none\}/.test(rm),'the trail stops easing');
ok(/\.journey-star,\.journey-starlet,\.journey-meteor\{animation:none\}/.test(rm),
  'the sky holds still instead of animating');
ok(!/width:\s*0/.test(rm),'and nothing forces the trail back to zero, so progress stays readable');

console.log(`\n${fail===0?'*** PASS ***':'*** FAIL ***'}  ${pass} passed, ${fail} failed\n`);
process.exit(fail===0?0:1);
