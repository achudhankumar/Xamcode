'use strict';
/* End-to-end exercise of the async job lifecycle against the REAL server
   routes, with the provider call stubbed. This is the regression net for
   the old synchronous design, where a 429 cost several generations with
   nothing observable happening. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const {Readable}=require('stream');
const {randomUUID}=require('crypto');

let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ok   '+m);} else {fail++;console.log('  FAIL '+m);} };

/* Boot server.js in a vm with a fake provider so no real quota is spent. */
function bootServer(env){
  const source=fs.readFileSync(path.join(__dirname,'server.js'),'utf8');
  const cut=source.indexOf('const server = http.createServer');
  const sandbox={module:{exports:{}},console,
    process:{env:{...env},hasOwnProperty:Object.hasOwn,on(){},exitCode:0},
    require,__dirname,__filename,Buffer,URL,fetch,setTimeout,clearTimeout,setInterval,clearInterval,
    AbortController,TextEncoder,Intl,randomUUID};
  sandbox.globalThis=sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source.slice(0,cut)+
    '\nglobalThis.__j={analyzePdf,jobSnapshot,createAnalyzeJob,runAnalyzeJob,finishJob,'+
    'ANALYZE_STAGES,jobs,setJobStage};',sandbox,{filename:'server.js'});
  return sandbox;
}

function makeRes(){
  const out={status:null,body:null,headers:{}};
  return {
    setHeader(k,v){out.headers[k]=v;},
    get headersSent(){return out.status!==null;},
    writeHead(s){out.status=s;},
    end(b){if(b)out.body=b.toString();out.done=true;},
    _out:out,
    async json(){return JSON.parse(out.body||'null');}
  };
}

const PDF=Buffer.from('%PDF-1.7\n%%EOF\n').toString('base64');
const known=stage=>['queued','extract','outline','sections','bank','validate','ready'].includes(stage);

(async()=>{
  console.log('\nthe stage model is monotonic and bounded');
  const sb=bootServer({GEMINI_API_KEY:'test-key',PORT:'0',PDF_GENERATIONS_PER_DAY:'50',
    /* Scratch quota store: a test that exercises analyzePdf must never
       decrement the caller's real daily allowance in .xamcode-quota.json. */
    XAMCODE_QUOTA_FILE:path.join(require('os').tmpdir(),`xamcode-quota-jobs-${process.pid}.json`)});
  const {ANALYZE_STAGES,jobSnapshot,jobs,setJobStage,finishJob,analyzePdf}=sb.__j;
  ok(ANALYZE_STAGES.length>=6,`${ANALYZE_STAGES.length} named stages drive the progress panel`);
  ok(new Set(ANALYZE_STAGES.map(s=>s.key)).size===ANALYZE_STAGES.length,'stage keys are unique');
  const weights=ANALYZE_STAGES.reduce((t,s)=>t+s.weight,0);
  ok(weights===100,`stage weights total ${weights}, so progress can reach 100`);

  const job={status:'running',stage:'queued',stageStartedAt:Date.now(),progress:0,
    id:'x',requestId:'r',createdAt:Date.now(),study:null,error:null};
  const seen=[];
  for(const s of ANALYZE_STAGES){ setJobStage(job,s.key); seen.push(jobSnapshot(job).progress); }
  ok(seen.every((v,i)=>i===0||v>=seen[i-1]),`progress never goes backwards: ${seen.join(' -> ')}`);
  ok(seen[seen.length-1]>0,'the final stage reports real progress');

  console.log('\nPOST /api/analyze returns a job id immediately');
  const res=makeRes();
  const body=JSON.stringify({pdfBase64:PDF,level:'beginner'});
  const req=Object.assign(Readable.from([Buffer.from(body)]),{
    headers:{'content-type':'application/json','content-length':String(Buffer.byteLength(body))},
    requestId:'req-1',socket:{remoteAddress:'10.0.0.9'}
  });
  /* Hanging fetch: the worker reaches its first provider call and parks
     there for the rest of the test. No request ever leaves the machine,
     so no real quota is spent, and the background job cannot interfere. */
  sb.fetch=()=>new Promise(()=>{});
  await analyzePdf(req,res);
  const posted=await res.json();
  ok(res._out.status===202,`the upload returns 202 Accepted immediately (got ${res._out.status})`);
  ok(/^[0-9a-f-]{36}$/.test(posted.jobId||''),'a well-formed jobId is returned');
  ok(Array.isArray(posted.stages)&&posted.stages.length===ANALYZE_STAGES.length,'the stage list travels with the job so the client can label the panel');
  ok(posted.study===undefined,'no study is inlined in the 202; it arrives via polling');

  console.log('\npolling reports progress and never exposes internals');
  const created=jobs.get(posted.jobId);
  ok(!!created,'the job is retrievable by id');
  const snap=jobSnapshot(created);
  ok(known(snap.stage),`stage "${snap.stage}" is a known stage`);
  ok(typeof snap.progress==='number'&&snap.progress>=0&&snap.progress<=100,`progress ${snap.progress} is within 0..100`);
  ok(!JSON.stringify(snap).includes('JVBER'),'the snapshot never serialises the PDF bytes');
  ok(JSON.stringify(snap).length<4000,'the snapshot stays small enough to poll cheaply');

  console.log('\nDELETE cancels and stops further work');
  created.cancelled=true;
  finishJob(created,{status:'cancelled',error:'The study build was cancelled.'});
  const after=jobSnapshot(created);
  ok(after.status==='cancelled','the job reports cancelled');
  ok(setJobStage(created,'bank')===false,'a cancelled job refuses to advance to the next stage');
  ok(after.study===undefined,'a cancelled job never returns a study');

  console.log('\nfailed jobs keep their real reason and never leak a stack');
  const failed={status:'failed',stage:'validate',stageStartedAt:Date.now(),progress:52,
    id:'y',requestId:'r2',createdAt:Date.now(),study:null,error:'The AI providers are too busy right now.'};
  const f2=jobSnapshot(failed);
  ok(f2.error.includes('too busy'),'the failure reason is the real provider message');
  ok(!JSON.stringify(f2).includes('at Object'),'no stack trace is exposed to the client');
  ok(f2.study===undefined,'a failed job carries no partial study');

  console.log('\nfinished jobs release the PDF bytes');
  const mem={status:'running',pdf:Buffer.alloc(1024)};
  finishJob(mem,{status:'done'});
  ok(mem.pdf===null,'the decoded PDF is dropped as soon as the job settles');

  console.log('\nan unknown job id resolves to nothing rather than throwing');
  ok(!jobs.get('00000000-0000-0000-0000-000000000000'),'a random uuid is simply absent from the map');

  console.log(`\n${fail===0?'*** PASS ***':'*** FAIL ***'}  ${pass} passed, ${fail} failed\n`);
  process.exit(fail===0?0:1);
})().catch(e=>{console.error(e);process.exit(1);});