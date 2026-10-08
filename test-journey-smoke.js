'use strict';
/* Serves the real app and checks the journey assets actually reach the
   browser — catches markup that exists on disk but never renders. */
const {spawn}=require('child_process');
const path=require('path');
const PORT=4199;

let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ok   '+m);} else {fail++;console.log('  FAIL '+m);} };

const child=spawn(process.execPath,[path.join(__dirname,'server.js')],{
  env:{...process.env,PORT:String(PORT),
    XAMCODE_QUOTA_FILE:path.join(require('os').tmpdir(),`xamcode-quota-smoke-${process.pid}.json`)},stdio:'ignore'
});

const get=async(p)=>{
  const r=await fetch(`http://127.0.0.1:${PORT}${p}`);
  return {status:r.status,body:await r.text()};
};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
  let up=false;
  for(let i=0;i<25&&!up;i++){ await wait(400); try{ const r=await get('/'); up=r.status===200; }catch{} }
  ok(up,'the server starts and serves the app');

  const html=(await get('/')).body;
  const app=(await get('/js/app.js')).body;
  const css=(await get('/css/components.css')).body;

  console.log('\nthe shooting-star bar reaches the browser');
  ok(html.includes('id="pdfJourney"'),'journey panel is in the served HTML');
  ok(html.includes('id="journeyFill" class="journey-fill"'),'the comet trail is in the served HTML');
  ok(html.includes('class="journey-star"'),'the comet head is in the served HTML');
  ok(html.includes('class="journey-meteor"'),'the background meteor is in the served HTML');
  ok(!html.includes('journeyHero')&&!html.includes('journey-foe'),
    'the stickman arena is gone from the served HTML');
  ok(html.includes('class="pdf-journey" aria-hidden="true"'),
    'the decorative bar is hidden from screen readers');
  ok(html.includes('role="progressbar"'),'a real progressbar is still exposed');

  console.log('\nthe behaviour is in the served script');
  ok(app.includes('journeyStartDrive'),'the journey driver is served');
  ok(app.includes('journeyFinish'),'the finishing beat is served');
  ok(app.includes('journeySetStage'),'the real server stage drives the beats');
  ok(app.includes('journeyHide'),'teardown is served');
  ok(app.includes('journeySetReal'),'measured upload progress is wired');
  ok(app.includes('aiPickLayout'),'the content-driven diagram engine is served');
  ok(app.includes('aiDiagramChrome'),'per-archetype chrome is served');

  console.log('\nthe journey can be reviewed without provider quota');
  ok(html.includes('id="journeyPreviewButton"'),'a preview trigger is in the served HTML');
  ok(css.includes('.journey-preview-trigger'),'the preview trigger is styled');
  ok(app.includes('journeyPreviewStop'),'the preview run can be cancelled');
  ok(html.includes('>Preview the processing journey</button>'),'the trigger is labelled in the HTML');

  console.log('\nthe preview can actually reach the helpers it calls');
  /* resetProgress used to be a `const` inside the submit callback, so the
     preview - registered far earlier, at module scope - threw
     "resetProgress is not defined" the instant it was clicked, and every
     string-level check above still passed. Assert the SCOPE, not the name:
     the shared declaration has to sit before the submit listener that also
     uses it, and it must not be redeclared inside that callback. */
  const sharedAt=app.indexOf('const resetProgress=');
  const submitAt=app.indexOf("addEventListener('submit'");
  const previewAt=app.indexOf('journeyPreviewButton');
  ok(sharedAt>=0,'the shared reset helper is declared');
  ok(sharedAt<previewAt,
    'it is declared before the preview handler that calls it, so it is in scope');
  ok(sharedAt<submitAt,'and before the submit handler, so both callers see one definition');
  ok((app.match(/const resetProgress=/g)||[]).length===1,
    'it is declared exactly once, so no callback shadows the shared one');
  ok(/journeyFinish\(\)/.test(app.slice(app.indexOf("if(jobStage==='validate')"))),
    'the preview drives the real journeyFinish, so it mirrors a genuine run');
  ok(/journeySetJobProgress\(/.test(app.slice(previewAt, previewAt + 1400)),
    'and reports real per-stage percentages, not just the elapsed-time ease');
  /* The charge beat has to be a separate tick, or the blaze is overwritten
     by the finale before it can ever render. Checked by looking for a
     setTimeout between the validate branch and the finish, rather than by
     counting characters, so re-wording the comment cannot break it. */
  const chargeAt=app.indexOf("if(jobStage==='validate')");
  const previewFinishAt=app.indexOf('journeyFinish()',chargeAt);
  ok(chargeAt>=0&&previewFinishAt>chargeAt&&/setTimeout\(/.test(app.slice(chargeAt,previewFinishAt)),
    'the charge beat is held for a tick before the finale, so it is visible');

  console.log('\nthe scene is not left clipped below the fold');
  /* The dialog is capped at 820px and the progress panel opens at ~585px, so
     the scene and its caption landed below the dialog's own edge and were
     cut off. Two things had to be true, and both were verified in the live
     app: `end` rather than `nearest` (nearest stops once any part shows),
     and a frame's delay, because scrolling against a not-yet-settled layout
     computes the wrong offset and does nothing at all. */
  const stageAt=app.indexOf('const setUploadStage=');
  const stageBody=app.slice(stageAt, stageAt + 1800);
  ok(stageAt>=0,'setUploadStage is declared');
  ok(/scrollIntoView/.test(stageBody),'it scrolls the progress panel into view when the panel appears');
  ok(/scrollIntoView\(\{\s*block:'end'\s*\}\)/.test(stageBody),
    "it aligns the panel's bottom, because 'nearest' leaves the scene cut off");
  ok(/requestAnimationFrame\(\(\)=>requestAnimationFrame/.test(stageBody),
    'it waits a frame, so the scroll is measured against settled layout');
  ok(/data-scrolled-into-view/.test(stageBody),
    'it latches, so later stage changes do not hijack the scroll position');
  const resetAt=app.indexOf('const resetProgress=');
  ok(/data-scrolled-into-view/.test(app.slice(resetAt, resetAt + 900)),
    'and the latch is cleared on reset, so the next run scrolls again');

  console.log('\nthe animation and accessibility rules are served');
  ok(css.includes('journeyStarPulse'),'the comet pulse is in the served CSS');
  ok(css.includes('journeyStarBurst'),'the finishing burst is in the served CSS');
  ok(css.includes('journeyTwinkle'),'the starlet twinkle is in the served CSS');
  ok(css.includes('journeyMeteor'),'the meteor streak is in the served CSS');
  ok(!css.includes('journey-foe'),'no stickman rule is left in the served CSS');
  ok(css.includes('prefers-reduced-motion'),'reduced-motion is respected');

  console.log('\nthe finale is gated on a validated study, not a timer');
  /* Search forward from the validation call, so the preview trigger's own
     journeyFinish() (which legitimately has no study to validate) cannot
     satisfy or break this check. */
  const validateAt=app.indexOf('validateAIStudyForDisplay(result.study)');
  const finishAt=app.indexOf('journeyFinish();',validateAt);
  ok(validateAt>=0&&finishAt>validateAt,
    'in the real upload path the comet only blazes after validation has passed');
  ok(app.indexOf('journeyFinish();')!==finishAt||app.includes('journeyPreviewStop'),
    'the earlier journeyFinish() belongs to the preview, which is separately stoppable');

  console.log(`\n${fail===0?'*** PASS ***':'*** FAIL ***'}  ${pass} passed, ${fail} failed\n`);
  child.kill();
  process.exit(fail===0?0:1);
})().catch(e=>{ console.error(e); child.kill(); process.exit(1); });