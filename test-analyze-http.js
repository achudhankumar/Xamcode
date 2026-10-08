'use strict';
/* Live HTTP check of the job routes: POST returns 202 immediately, the
   job is pollable, DELETE cancels, and an unknown id is a clean 404. */
const {spawn}=require('child_process');
const path=require('path');
const PORT=4202;

let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ok   '+m);} else {fail++;console.log('  FAIL '+m);} };

const child=spawn(process.execPath,[path.join(__dirname,'server.js')],{
  env:{
    ...process.env,
    PORT:String(PORT),
    PDF_GENERATIONS_PER_DAY:'50',
    /* Scratch quota store so this suite's POSTs never decrement the real
       daily allowance in .xamcode-quota.json. */
    XAMCODE_QUOTA_FILE:path.join(require('os').tmpdir(),`xamcode-quota-http-${process.pid}.json`),
    /* A deliberately invalid key. server.js only fills env keys that are
       NOT already set, so this overrides the real one in .env and the
       provider rejects the call with a 401 straight away. The job
       lifecycle is fully exercised and NO real quota is spent. A 401 is
       also not failover-worthy, so the pool cannot spin through eleven
       models before failing. */
    GEMINI_API_KEY:'xamcode-test-invalid-key',
    GROQ_API_KEY:'',
    XAI_API_KEY:'',
    OPENROUTER_API_KEY:'',
    EXPLABS_API_KEY:'',
    GEMINI_MODELS:'gemini-3.8-flash'
  },
  stdio:'ignore'
});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const PDF=Buffer.from('%PDF-1.7\n%%EOF\n').toString('base64');

(async()=>{
  let up=false;
  for(let i=0;i<25&&!up;i++){ await wait(400); try{ const r=await fetch(`http://127.0.0.1:${PORT}/`); up=r.ok; }catch{} }
  ok(up,'the server starts');

  console.log('\nPOST /api/analyze answers immediately with a job id');
  const t0=Date.now();
  const post=await fetch(`http://127.0.0.1:${PORT}/api/analyze`,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({pdfBase64:PDF,level:'beginner'})
  });
  const elapsed=Date.now()-t0;
  const body=await post.json();
  ok(post.status===202,`status is 202 Accepted (got ${post.status})`);
  ok(/^[0-9a-f-]{36}$/.test(body.jobId||''),`jobId ${body.jobId} is well formed`);
  ok(Array.isArray(body.stages)&&body.stages.length>=6,`${body.stages?.length} stages advertised to the client`);
  ok(elapsed<8000,`the upload returned in ${elapsed}ms instead of holding the request open`);

  console.log('\nGET /api/analyze/:id reports a real stage');
  const poll=await fetch(`http://127.0.0.1:${PORT}/api/analyze/${body.jobId}`);
  const snap=await poll.json();
  ok(poll.status===200,'the job is readable');
  ok(['queued','extract','outline','sections','bank','validate','ready'].includes(snap.stage),`stage is "${snap.stage}"`);
  ok(typeof snap.progress==='number'&&snap.progress>=0&&snap.progress<=100,`progress ${snap.progress}% is valid`);
  ok(typeof snap.stageLabel==='string'&&snap.stageLabel.length>0,`stage is labelled "${snap.stageLabel}"`);

  console.log('\nan unknown job id is a clean 404');
  const missing=await fetch(`http://127.0.0.1:${PORT}/api/analyze/00000000-0000-0000-0000-000000000000`);
  const missBody=await missing.json();
  ok(missing.status===404,`status is 404 (got ${missing.status})`);
  ok(missBody.code==='JOB_NOT_FOUND','the 404 names the reason rather than crashing');

  console.log('\nDELETE cancels the build');
  const del=await fetch(`http://127.0.0.1:${PORT}/api/analyze/${body.jobId}`,{method:'DELETE'});
  const delBody=await del.json();
  ok(del.status===200,'cancel is accepted');
  ok(delBody.status==='cancelled','the job reports cancelled');
  const after=await (await fetch(`http://127.0.0.1:${PORT}/api/analyze/${body.jobId}`)).json();
  ok(after.status==='cancelled','the cancelled state persists across polls');
  ok(after.study===undefined,'a cancelled job never hands back a study');

  console.log('\nwrong method on a job is a clear 405');
  const bad=await fetch(`http://127.0.0.1:${PORT}/api/analyze/${body.jobId}`,{method:'PUT'});
  ok(bad.status===405,`PUT is rejected with 405 (got ${bad.status})`);

  console.log('\nquota and validation errors still answer on the POST, not async');
  const noPdf=await fetch(`http://127.0.0.1:${PORT}/api/analyze`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({level:'beginner'})
  });
  ok(noPdf.status===400,`a missing PDF is still an immediate 400 (got ${noPdf.status})`);

  console.log(`\n${fail===0?'*** PASS ***':'*** FAIL ***'}  ${pass} passed, ${fail} failed\n`);
  child.kill();
  process.exit(fail===0?0:1);
})().catch(e=>{ console.error(e); child.kill(); process.exit(1); });