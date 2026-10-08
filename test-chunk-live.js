/* ============================================================
   LIVE TEST - UNIT-CHUNKED BUILD (manual, NOT in npm test)
   ============================================================
   Boots a scratch server on 4204 with the real .env keys and posts
   the user's large PDF through the Unit-1-first path: first delivery
   must be chunked (Unit 1 ready, rest locked), the background queue
   must unlock everything, the browser validator must accept the pack
   at delivery and at the end, and one MiniMax topic image must come
   back. Uses a scratch quota file so the real daily allowance and
   MiniMax credits are spent only on the image call.
   Run: node test-chunk-live.js
   ============================================================ */
'use strict';
const {spawn}=require('child_process');
const fs=require('fs'), path=require('path'), os=require('os'), vm=require('vm');
const PORT=4204;
const BASE='http://127.0.0.1:'+PORT;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ok   '+m);} else {fail++;console.log('  FAIL '+m);} };

/* The PDF under test: the user's big Java notes, wherever Downloads put it. */
function findPdf(){
  const dirs=[path.join(os.homedir(),'Downloads'),path.join(os.homedir(),'Desktop'),__dirname];
  const under=n=>n && fs.statSync(n).size<=20*1024*1024;
  for(const dir of dirs){
    let names=[];
    try{ names=fs.readdirSync(dir); }catch{ continue; }
    const pdfs=names.filter(n=>/\.pdf$/i.test(n));
    const full=p=>path.join(dir,p);
    const java=pdfs.filter(n=>/java|program/i.test(n)).map(full).filter(under);
    const pick=java.find(p=>/compressed/i.test(p))||java[0]||
      pdfs.map(full).find(p=>under(p)&&fs.statSync(p).size>4*1024*1024)||
      pdfs.map(full).find(under);
    if(pick) return pick;
  }
  return null;
}
/* Browser validator — the exact code the page runs. */
function clientValidate(study){
  const app=fs.readFileSync(path.join(__dirname,'js','app.js'),'utf8');
  const a=app.indexOf('function validateAIStudyForDisplay(study){');
  const b=app.indexOf('\nfunction aiStudyView()');
  const box={module:{exports:{}},exports:{},console};
  vm.createContext(box);
  vm.runInContext(app.slice(a,b)+'\nmodule.exports={validateAIStudyForDisplay};',box);
  return box.module.exports.validateAIStudyForDisplay(study);
}
(async()=>{
  const pdfPath=findPdf();
  if(!pdfPath){ console.log('FAIL: no PDF found in Downloads/Desktop'); process.exit(1); }
  const stat=fs.statSync(pdfPath);
  console.log('PDF: '+pdfPath+' ('+(stat.size/1024/1024).toFixed(1)+' MB)');

  const child=spawn(process.execPath,[path.join(__dirname,'server.js')],{
    env:{...process.env,PORT:String(PORT),
      XAMCODE_QUOTA_FILE:path.join(os.tmpdir(),'xamcode-quota-live-'+process.pid+'.json')},
    stdio:'ignore'});
  let up=false;
  for(let i=0;i<30&&!up;i++){ await wait(400); try{ up=(await fetch(BASE+'/api/health')).ok; }catch{} }
  if(!up){ console.log('FAIL: scratch server did not start'); child.kill(); process.exit(1); }
  console.log('scratch server up on '+PORT);

  const pdfB64=fs.readFileSync(pdfPath).toString('base64');
  const t0=Date.now();
  const post=await fetch(BASE+'/api/analyze',{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({pdfBase64:pdfB64,level:'standard'})});
  const body=await post.json();
  ok(post.status===202,'upload accepted with 202 (got '+post.status+')');
  if(post.status!==202){ console.log(JSON.stringify(body)); child.kill(); process.exit(1); }

  /* Phase 1: first delivery must be Unit 1 + locked remainder. */
  let first=null;
  for(;;){
    const r=await fetch(BASE+'/api/analyze/'+body.jobId);
    const s=await r.json();
    if(s.status==='failed'){ console.log('  failed: '+s.error); break; }
    if(s.status==='done'&&s.study){ first=s; break; }
    await wait(4000);
  }
  const firstMs=Date.now()-t0;
  ok(!!first,'the first delivery reached done in '+Math.round(firstMs/1000)+'s');
  if(first){
    ok(first.chunked===true,'the study reports chunked: true');
    ok(first.study.units.length>=1,'the full unit plan arrived ('+first.study.units.length+' units)');
    console.log('  first delivery: '+first.study.concepts.length+' lessons, '+first.study.questions.length+
      ' questions, pending units: '+JSON.stringify(first.pendingUnits));
    const v1=clientValidate(first.study);
    ok(v1==='','Unit-1-first study passes the browser validator'+(v1?' -> '+v1:''));
    ok(Array.isArray(first.unitStates)&&first.unitStates.length===first.study.units.length,'the unit ledger travels with the snapshot');
  }

  /* Phase 2: background unlocks until nothing is pending. */
  let last=first;
  if(first&&first.pendingUnits&&first.pendingUnits.length){
    const deadline=Date.now()+15*60*1000;
    while(Date.now()<deadline){
      const s=await(await fetch(BASE+'/api/analyze/'+body.jobId)).json();
      if(s.status==='cancelled'||s.status==='failed'){ console.log('  job ended: '+s.status+' '+(s.error||'')); break; }
      if(s.study&&(!last||s.study.concepts.length>last.study.concepts.length)){
        console.log('  +unlock at '+Math.round((Date.now()-t0)/1000)+'s -> '+s.study.concepts.length+
          ' lessons, pending '+JSON.stringify(s.pendingUnits));
        last=s;
      }
      if(s.study&&(!s.pendingUnits||!s.pendingUnits.length)){ last=s; break; }
      await wait(5000);
    }
  }
  if(last){
    const pending=last.pendingUnits||[];
    ok(pending.length===0,'every unit finished building (still pending: '+JSON.stringify(pending)+')');
    const v2=clientValidate(last.study);
    ok(v2==='','the fully unlocked study passes the browser validator'+(v2?' -> '+v2:''));
    const all=last.study.units.every(u=>!u.locked&&Array.isArray(u.topics)&&u.topics.length>0);
    ok(all,'every unit is unlocked with its own topics');
    const idx=last.study.units.flatMap(u=>u.topics.flatMap(t=>t.conceptIndices));
    ok(idx.length===last.study.concepts.length&&new Set(idx).size===idx.length,
      'lessons partition exactly once across units ('+idx.length+'/'+last.study.concepts.length+')');
    console.log('  final: '+last.study.units.length+' units, '+last.study.concepts.length+' lessons, '+
      last.study.questions.length+' questions, '+last.study.flashcards.length+' flashcards');
  }

  /* Phase 3: one real MiniMax still against the finished job. */
  if(last&&last.status==='done'){
    console.log('\ngenerating one topic image through MiniMax…');
    try{
      const img=await(await fetch(BASE+'/api/topic-images',{method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({jobId:body.jobId,topics:[0]})})).json();
      const first0=(img.images||[])[0];
      ok(!!(first0&&first0.imageUrl),'MiniMax returned a real image URL');
      if(first0&&first0.imageUrl) console.log('  image: '+first0.imageUrl.slice(0,90)+'…');
      if(first0&&first0.error) console.log('  image error: '+first0.error);
    }catch(e){ ok(false,'image request failed: '+e.message); }
  }

  try{ await fetch(BASE+'/api/analyze/'+body.jobId,{method:'DELETE'}); }catch{}
  child.kill();
  console.log(`\n${fail===0?'*** LIVE PASS ***':'*** LIVE FAIL ***'}  ${pass} passed, ${fail} failed\n`);
  process.exit(fail===0?0:1);
})().catch(e=>{ console.error(e); process.exit(1); });
