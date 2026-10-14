/* Quiz-flow harness: loads the real data + app.js into a vm sandbox with a
   minimal DOM stub, then drives the sequential quiz flow end to end. */
const fs=require('fs'), vm=require('vm'), path=require('path');
const ROOT=process.argv[2]||__dirname;

const handlers={};
function el(id){
  return {
    id, innerHTML:'', textContent:'', style:{}, dataset:{},
    classList:{add(){},remove(){},contains(){return false},toggle(){}},
    offsetWidth:0, offsetTop:0, focus(){}, addEventListener(){}, removeEventListener(){},
    querySelectorAll:()=>[], querySelector:()=>null, appendChild(){}, remove(){},
    getAttribute(){return null}, setAttribute(){}, hasAttribute(){return false},
    insertAdjacentHTML(){}, scrollIntoView(){}, closest(){return null}
  };
}
const els={app:el('app'), flash:el('flash'), themeModal:el('themeModal'), themeOpen:el('themeOpen')};
/* Auto-vivify unknown ids so post-boot wiring (flashcard listeners etc.)
   finds a node instead of throwing. */
const getEl=id=>els[id]||(els[id]=el(id));
const document={
  body:el('body'), documentElement:el('html'),
  getElementById:id=>getEl(id),
  querySelector:()=>null, querySelectorAll:()=>[],
  createElement:t=>el('tag-'+t), createTextNode:t=>({textContent:t}),
  addEventListener:(type,fn)=>{ (handlers[type]=handlers[type]||[]).push(fn); },
  removeEventListener(){},
  elementFromPoint:()=>null, readyState:'complete'
};
const store={};
const sandbox={
  document, console,
  navigator:{userAgent:'node', clipboard:{writeText(){}}},
  localStorage:{getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]}},
  sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},
  location:{hash:'',search:'',href:'http://localhost/',pathname:'/'},
  history:{replaceState(){},pushState(){}},
  matchMedia:()=>({matches:false,addEventListener(){},addListener(){},removeListener(){}}),
  requestAnimationFrame:f=>setTimeout(f,0), cancelAnimationFrame:clearTimeout,
  setTimeout, clearTimeout, setInterval, clearInterval,
  getComputedStyle:()=>({getPropertyValue:()=>''}),
  IntersectionObserver:class{observe(){}unobserve(){}disconnect(){}},
  ResizeObserver:class{observe(){}unobserve(){}disconnect(){}},
  scrollTo(){}, alert(){}, confirm(){return true},
  addEventListener:(type,fn)=>{ (handlers[type]=handlers[type]||[]).push(fn); },
  removeEventListener(){},
  CustomEvent:class{}, Event:class{}, URLSearchParams,
  performance:{now:()=>0}, innerWidth:1440, innerHeight:900,
  scrollY:0, pageYOffset:0, devicePixelRatio:1
};
sandbox.window=sandbox; sandbox.self=sandbox; sandbox.globalThis=sandbox;
vm.createContext(sandbox);

/* Load every data file, but keep the load ORDER fixed. readdirSync does not
   return names in a useful order, and data-vaathiyar-unitN.js merges into
   the VAATHIYAR map that data-vaathiyar.js creates — loading a unit file
   first throws "Cannot convert undefined or null to object". */
function dataRank(file) {
  if (file === 'data-vaathiyar.js') return 20;              // base map first
  const unit = /^data-vaathiyar-unit(\d+)\.js$/.exec(file);
  if (unit) return 21 + Number(unit[1]);                   // then unit 2, 3, 4, 5
  if (file === 'data-visuals.js') return 90;                // visuals build on TOPICS
  return 10;
}
const dataFiles = fs.readdirSync(path.join(ROOT,'js'))
  .filter(f => f.startsWith('data-') && f.endsWith('.js'))
  .sort((a,b) => dataRank(a) - dataRank(b) || a.localeCompare(b));
for(const f of dataFiles){
  vm.runInContext(fs.readFileSync(path.join(ROOT,'js',f),'utf8'), sandbox, {filename:f});
}

/* Expose internals: append an export just inside the closing IIFE. */
let src=fs.readFileSync(path.join(ROOT,'js','app.js'),'utf8');
/* Detect the file's own newline so the marker matches whether the checkout
   is CRLF (Windows, core.autocrlf=true) or LF (Linux/CI). */
const nl=src.includes('\r\n')?'\r\n':'\n';
const marker=nl+'})();'+nl;
const at=src.lastIndexOf(marker);
if(at<0){ console.error('FAIL: IIFE tail marker not found'); process.exit(1); }
src=src.slice(0,at)+'\nwindow.__T={quizFlow,quizResults,qCard,studyView,resetQuizFlow,render,state,TOPICS};\n'+src.slice(at);
vm.runInContext(src, sandbox, {filename:'app.js'});

const T=sandbox.window.__T;
let pass=0, fail=0;
function ok(cond,msg){ if(cond){pass++;} else {fail++; console.log('  FAIL: '+msg);} }
function stats(){ return {pass,fail}; }
function clickNext(){
  const b={disabled:false}; b.closest=s=>s==='[data-qnext]'?b:null;
  (handlers.click||[]).forEach(fn=>fn({target:{closest:s=>s==='[data-qnext]'?b:null}}));
}
function clickRetry(){
  const b={disabled:false}; b.closest=s=>s==='[data-qretry]'?b:null;
  (handlers.click||[]).forEach(fn=>fn({target:{closest:s=>s==='[data-qretry]'?b:null}}));
}
function clickDisabledNext(){
  const b={disabled:true}; b.closest=s=>s==='[data-qnext]'?b:null;
  (handlers.click||[]).forEach(fn=>fn({target:{closest:s=>s==='[data-qnext]'?b:null}}));
}
module.exports={T,ok,clickNext,clickRetry,clickDisabledNext,
  stats:()=>({pass,fail}), reset:()=>{pass=0;fail=0;}};
/* ---------- assertions ---------- */
const c=T.TOPICS[0], total=c.questions.length, idx=0;
T.state.topicIdx=idx; T.state.answers={}; T.state.qStep=0; T.state.qDone=false;
T.resetQuizFlow();

console.log('Loaded topics:', T.TOPICS.length, '| questions in topic 0:', total);
ok(total>0,'topic has questions');

console.log('\n== 1. Initial render shows Q1 only ==');
let html=T.quizFlow(c);
let qNums=(html.match(/pill cat">Q(\d+)/g)||[]).map(s=>+s.match(/Q(\d+)/)[1]);
ok(qNums.length===1,'exactly one question card rendered, got '+qNums.length);
ok(qNums[0]===1,'that card is Q1, got Q'+qNums[0]);
ok(/data-qnext/.test(html),'Next button present');
ok(/disabled/.test(html),'Next disabled before answering');
ok(!/data-qjump/.test(html),'no jump control (flow is non-skippable)');
ok((html.match(/class="q-dot /g)||[]).length===total,'inert progress dots rendered');

console.log('\n== 2. After answering Q1, Next enables ==');
T.state.answers[`${idx}-0`]=c.questions[0].a;
html=T.quizFlow(c);
ok(/class="q-next" data-qnext>/.test(html),'Next enabled after answering: '+(html.match(/<button[^>]*q-next[^>]*>/)||[''])[0]);

console.log('\n== 3. Step through Q2..QN via Next ==');
for(let i=0;i<total-1;i++){
  clickNext();
  const shown=(T.quizFlow(c).match(/pill cat">Q(\d+)/)||[])[1];
  ok(shown===String(i+2),`Next from Q${i+1} shows Q${i+2}, got ${shown}`);
  ok(T.state.qStep===i+1,`qStep advanced to ${i+1}, got ${T.state.qStep}`);
  ok(!T.state.qDone,`qDone still false at step ${i+1}`);
  T.state.answers[`${idx}-${T.state.qStep}`]=c.questions[T.state.qStep].a;
}

console.log('\n== 4. Last question button says See Results ==');
html=T.quizFlow(c);
ok(/See Results/.test(html),'final Next labelled "See Results"');
ok((html.match(/pill cat">Q(\d+)/)||[])[1]===String(total),'showing last question');

console.log('\n== 5. Next on last -> results screen ==');
clickNext();
ok(T.state.qDone===true,'qDone flipped true');
html=T.quizFlow(c);
ok(/q-results/.test(html),'results screen rendered');
ok(!/pill cat">Q/.test(html),'no question card on results screen');
ok(/FINAL RESULTS/.test(html),'results header present');
ok(/q-final-list/.test(html),'final answers list present');
ok((html.match(/class="q-final /g)||[]).length===total,'final answers has '+total+' rows');
ok(/q-results-verdict/.test(html),'verdict line present');
ok(/data-qretry/.test(html),'retry button present');
ok(html.includes('/'+total+'<'),'score shows full marks for all-correct run');

console.log('\n== 6. Results flag wrong answers and disclose the correct one ==');
T.state.answers[`${idx}-1`]=(c.questions[1].a+1)%c.questions[1].opts.length;
html=T.quizResults(c);
ok(/class="q-final bad"/.test(html),'wrong answer row marked bad');
ok(/Correct answer/.test(html),'correct answer disclosed');
ok((html.match(/class="q-final bad"/g)||[]).length===1,'exactly one bad row');
ok(!/undefined/.test(html),'no undefined leaks');

console.log('\n== 7. Retry clears answers and restarts at Q1 ==');
clickRetry();
ok(Object.keys(T.state.answers).filter(k=>k.startsWith(idx+'-')).length===0,'answers cleared');
ok(T.state.qStep===0,'qStep reset to 0');
ok(T.state.qDone===false,'qDone reset to false');
ok((T.quizFlow(c).match(/pill cat">Q(\d+)/)||[])[1]==='1','back to Q1');

console.log('\n== 8. Disabled Next is a no-op (cannot skip ahead) ==');
console.log('\n== 10. studyView() end-to-end + previous layout reverted ==');
T.state.answers={}; T.state.qStep=0; T.state.qDone=false; T.resetQuizFlow();
const view=T.studyView();
ok(/study-grid/.test(view),'study grid present');
ok(!/study-lesson/.test(view),'previous sticky lesson column gone (layout reverted)');
ok(!/study-quiz/.test(view),'previous study-quiz wrapper gone (layout reverted)');
ok(!/quiz-rail/.test(view),'previous quiz rail gone (layout reverted)');
ok(!/q-nav-dot/.test(view),'previous jump chips gone');
ok(/q-step-bar/.test(view),'new step bar present');
ok(view.includes('data-qnext'),'Next present in study view');
ok((view.match(/pill cat">Q(\d+)/g)||[]).length===1,'exactly one question in whole study view');
ok(/study-tabs/.test(view),'study tabs still render');
ok(!/undefined/.test(view),'no undefined leaks in study view');

console.log('\n== 11. Every topic renders a valid single-question flow ==');
let issues=0;
for(let i=0;i<T.TOPICS.length;i++){
  const tc=T.TOPICS[i];
  T.state.topicIdx=i; T.state.answers={}; T.state.qStep=0; T.state.qDone=false; T.resetQuizFlow();
  const h=T.quizFlow(tc);
  const n=(h.match(/pill cat">Q(\d+)/g)||[]).length;
  const dots=(h.match(/class="q-dot /g)||[]).length;
  if(n!==1||dots!==tc.questions.length||!/data-qnext/.test(h)||/undefined/.test(h)){
    console.log('  topic '+i+' "'+tc.title+'" n='+n+' dots='+dots+'/'+tc.questions.length);
    issues++;
  }
}
ok(issues===0,'all '+T.TOPICS.length+' topics render a valid single-question flow');

console.log('\n== 12. Results screen valid for every topic (half wrong) ==');
let resIssues=0;
for(let i=0;i<T.TOPICS.length;i++){
  const tc=T.TOPICS[i];
  T.state.topicIdx=i; T.state.answers={}; T.state.qStep=0; T.state.qDone=false; T.resetQuizFlow();
  tc.questions.forEach((q,qi)=>{ T.state.answers[`${i}-${qi}`]=(qi%2===0)? q.a : (q.a+1)%q.opts.length; });
  T.state.qStep=tc.questions.length-1; T.state.qDone=true;
  const h=T.quizResults(tc);
  const rows=(h.match(/class="q-final /g)||[]).length;
  if(rows!==tc.questions.length||/undefined/.test(h)){
    console.log('  topic '+i+' rows='+rows+' undefined='+/undefined/.test(h)); resIssues++;
  }
}
ok(resIssues===0,'results screen valid for all '+T.TOPICS.length+' topics');

console.log('\n== 13. Full sequential run on 5 different topics ==');
let runIssues=0;
[0,1,5,10,20].forEach(i=>{
  if(i>=T.TOPICS.length) return;
  const tc=T.TOPICS[i];
  T.state.topicIdx=i; T.state.answers={}; T.state.qStep=0; T.state.qDone=false; T.resetQuizFlow();
  const seen=[];
  for(let qi=0;qi<tc.questions.length;qi++){
    const shown=(T.quizFlow(tc).match(/pill cat">Q(\d+)/)||[])[1];
    seen.push(shown);
    if(!T.quizFlow(tc).includes('disabled')){ console.log('  topic '+i+' Q'+(qi+1)+' Next not locked'); runIssues++; }
    T.state.answers[`${i}-${qi}`]=tc.questions[qi].a;
    clickNext();
  }
  if(!T.state.qDone){ console.log('  topic '+i+' did not reach results'); runIssues++; }
  const expect=tc.questions.map((_,k)=>String(k+1)).join(',');
  if(seen.join(',')!==expect){ console.log('  topic '+i+' order '+seen.join(',')+' != '+expect); runIssues++; }
});
ok(runIssues===0,'5 topics stepped Q1->Qn in strict order and reached results');

const st=stats();
console.log('\n'+(st.fail===0?'*** PASS ***':'*** FAIL ***')+'  '+st.pass+' passed, '+st.fail+' failed');
process.exit(st.fail===0?0:1);
clickDisabledNext();
ok(T.state.qStep===0,'qStep unchanged');
ok(!T.state.qDone,'qDone unchanged');

console.log('\n== 9. Reset re-seeds from persisted answers ==');
T.state.answers[`${idx}-0`]=0; T.state.answers[`${idx}-1`]=0;
T.resetQuizFlow();
ok(T.state.qStep===2,'resumes at first unanswered (2), got '+T.state.qStep);
ok(T.state.qDone===false,'not done when some remain');
T.state.answers[`${idx}-${total-1}`]=0;
T.resetQuizFlow();
ok(T.state.qDone===true,'done when all answered');