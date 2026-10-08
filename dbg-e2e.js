/* End-to-end: POST sample-networks.pdf to /api/analyze and poll the job
   until done/failed, then run the client validator on the delivered study. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BASE = 'http://127.0.0.1:4173';

(async () => {
  const pdfB64 = fs.readFileSync(path.join(__dirname, 'sample-networks.pdf')).toString('base64');
  const res = await fetch(BASE + '/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdfBase64: pdfB64, level: 'standard' })
  });
  const first = await res.json();
  console.log('POST', res.status, JSON.stringify(first).slice(0, 300));
  if (!first.jobId){ console.log('NO JOB ID'); process.exit(1); }

  const t0 = Date.now();
  let snap = first;
  while (snap.status !== 'done' && snap.status !== 'failed' && snap.status !== 'cancelled'){
    if (Date.now() - t0 > 300000){ console.log('TIMEOUT after 300s'); process.exit(1); }
    await new Promise(r => setTimeout(r, 3000));
    const r = await fetch(BASE + '/api/analyze/' + first.jobId);
    snap = await r.json();
    console.log(((Date.now() - t0) / 1000).toFixed(0) + 's', 'stage=' + (snap.stage || '?'), 'status=' + snap.status, snap.status === 'failed' ? snap.error : '');
  }
  console.log('FINAL:', snap.status, snap.status === 'failed' ? snap.error : '');
  if (snap.status !== 'done'){ process.exit(1); }

  /* Client validator on the study the browser would actually receive. */
  const appSrc = fs.readFileSync(path.join(__dirname, 'js', 'app.js'), 'utf8');
  const aStart = appSrc.indexOf('function validateAIStudyForDisplay(study){');
  const aEnd = appSrc.indexOf('\nfunction aiStudyView()');
  const ab = { module: { exports: {} }, exports: {}, console, Array, Object, String, Number, Boolean, JSON, Set, Math };
  vm.createContext(ab);
  vm.runInContext(appSrc.slice(aStart, aEnd) + '\nmodule.exports={validateAIStudyForDisplay};', ab);
  const err = ab.module.exports.validateAIStudyForDisplay(snap.study);
  console.log('client validator:', err ? 'FAIL -> ' + err : 'PASS');
  if (err){
    snap.study.units.forEach((u, ui) => u.topics.forEach((t, ti) => {
      console.log(`unit[${ui}].topic[${ti}] title=${JSON.stringify(t.title)} conceptIndices=`,
        JSON.stringify(t.conceptIndices),
        'types=', (t.conceptIndices || []).map(i => typeof i + (Number.isInteger(i) ? '' : '!int')).join(','));
    }));
    console.log('concept count:', snap.study.concepts.length);
  }
  console.log('study shape: units=' + snap.study.units.length,
    'concepts=' + snap.study.concepts.length,
    'questions=' + snap.study.questions.length,
    'flashcards=' + snap.study.flashcards.length,
    'formulas=' + (Array.isArray(snap.study.formulas) ? snap.study.formulas.length : 'MISSING'));
  process.exit(err ? 1 : 0);
})().catch(e => { console.log('ERROR:', e.message); process.exit(1); });
