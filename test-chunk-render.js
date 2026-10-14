/* ============================================================
   TEST - CHUNKED RENDER (workspace + plan page)
   ============================================================
   Loads the real data + app.js into a vm sandbox (same harness as
   test-quiz-flow) and renders the two views this task rewrites:
     · Workspace with the sample course removed — library cards,
       unit chips, continue button, empty state
     · AI-study plan page for a chunked study — locked cards, the
       background-unlock strip, and the locked-unit redirect
   Run: node test-chunk-render.js
   ============================================================ */
'use strict';
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
  scrollY:0, pageYOffset:0, devicePixelRatio:1,
  fetch:()=>new Promise(()=>{})
};
sandbox.window=sandbox; sandbox.self=sandbox; sandbox.globalThis=sandbox;
vm.createContext(sandbox);

function dataRank(file){
  if(file==='data-vaathiyar.js') return 20;
  const unit=/^data-vaathiyar-unit(\d+)\.js$/.exec(file);
  if(unit) return 21+Number(unit[1]);
  if(file==='data-visuals.js') return 90;
  return 10;
}
const dataFiles=fs.readdirSync(path.join(ROOT,'js'))
  .filter(f=>f.startsWith('data-')&&f.endsWith('.js'))
  .sort((a,b)=>dataRank(a)-dataRank(b)||a.localeCompare(b));
for(const f of dataFiles){
  vm.runInContext(fs.readFileSync(path.join(ROOT,'js',f),'utf8'),sandbox,{filename:f});
}
let src=fs.readFileSync(path.join(ROOT,'js','app.js'),'utf8');
const marker='\r\n})();\r\n';
const at=src.lastIndexOf(marker);
if(at<0){ console.error('FAIL: IIFE tail marker not found'); process.exit(1); }
src=src.slice(0,at)+'\nwindow.__T={workspaceViewInner,aiStudyView,state,xcToast,setLibraryCache:v=>{libraryCache=v}};\n'+src.slice(at);
vm.runInContext(src,sandbox,{filename:'app.js'});
const T=sandbox.window.__T;

let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ok   '+m);} else {fail++;console.log('  FAIL '+m);} };

/* A display-valid chunked study: Unit 1 ready, Units 2-3 locked. */
const mkC=i=>({title:'Lesson '+i,summary:'s',explanation:'e',sourceExcerpt:'x',sourcePage:'1',
  keyPoints:['k'],whyItMatters:'w',analogy:'a',
  explanationLevels:{simple:'s',everyday:'d',advanced:'a'},
  commonTrap:'c',correctiveTruth:'c',
  comparison:{firstLabel:'A',secondLabel:'B',takeaway:'t',
    rows:[{aspect:'a',first:'f',second:'s'},{aspect:'b',first:'f',second:'s'},{aspect:'c',first:'f',second:'s'}]},
  originStory:'o',realWorldExamples:[{title:'t',description:'d'}],
  workedExample:{scenario:'s',answer:'a',steps:[{label:'l',action:'a',reasoning:'r'},{label:'l',action:'a',reasoning:'r'}]},
  quickRecall:'q',
  cheatCode:{why:'w',like:'l',wrong:'w',right:'r',oneLine:'o',mnemonic:'m',see:['1','2','3']},
  visualization:{caption:'c',steps:[{title:'t',description:'d',layout:'flow',
    nodes:[{label:'n'+i+'a',detail:'d'},{label:'n'+i+'b',detail:'d'},{label:'n'+i+'c',detail:'d'}]}]}});
const mkQ=(i,ci)=>({question:'q'+i,options:['1','2','3','4'],answerIndex:0,category:'c',difficulty:'e',
  conceptIndex:ci,hint:'h',explanation:'e',optionExplanations:['a','b','c','d'],eli5:'e',
  visual:{caption:'v',layout:'flow',steps:[{title:'s',description:'d',
    nodes:[{label:'x'+i+'1',detail:'d'},{label:'x'+i+'2',detail:'d'},{label:'x'+i+'3',detail:'d'}]}]}});
const chunkStudy={chunked:true,title:'Java Course',subject:'CS',summary:'sum',formulas:[],
  units:[
    {title:'Unit 1',overview:'o',learningGoals:['g'],topics:[{title:'T1',overview:'o',conceptIndices:[0,1,2,3]}],locked:false},
    {title:'Unit 2',overview:'o',learningGoals:['g'],topics:[],locked:true},
    {title:'Unit 3',overview:'o',learningGoals:['g'],topics:[],locked:true}],
  concepts:[0,1,2,3].map(mkC),
  questions:[0,1,2,3,4,5,6,7].map(i=>mkQ(i,i%4)),
  flashcards:[0,1,2,3,4,5,6,7].map(i=>({front:'f',back:'b',conceptIndex:i%4})),
  unitStates:[{index:0,title:'Unit 1',status:'ready',lessons:4},
              {index:1,title:'Unit 2',status:'building',lessons:0},
              {index:2,title:'Unit 3',status:'locked',lessons:0}],
  pendingUnits:[1,2]};

console.log('\nworkspace renders the sample workshop content');
T.setLibraryCache([]);
T.state.aiStudy=null;
let ws=T.workspaceViewInner();
ok(typeof ws==='string'&&ws.length>0,'workspace renders a page');
ok(/SAMPLE COURSE • COMPUTER NETWORKS/.test(ws),'the sample course header is present');
ok(/Computer Networks — Unit Wise/.test(ws),'the sample course title is back');
ok(/TOPIC TREE/.test(ws),'the sample topic tree is back');
ok((ws.match(/data-study=/g)||[]).length>0,
  'sample lesson cards are back ('+((ws.match(/data-study=/g)||[]).length)+')');
ok(/UNIT I: Introduction to Networks/.test(ws),'the unit labels are back');
ok((ws.match(/data-toggle-unit=/g)||[]).length>0,'the unit collapse toggles are back');

console.log('\nplan page renders a chunked study with locked cards');
T.state.aiStudy=chunkStudy;
T.state.aiPage={type:'plan'};
T.state.aiChunkNote='';
let html=T.aiStudyView();
ok(!/STUDY COULD NOT BE OPENED/.test(html),'the chunked study passes the display validator');
ok((html.match(/ai-unit-card-locked/g)||[]).length===2,'two locked unit cards render');
ok(/Unit 2 is being written right now/.test(html),'the building unit says so');
ok(/Queued — unlocks automatically/.test(html),'the queued unit says so');
ok(/unlock in the background while you study/.test(html),'the background-unlock strip is present');
ok(/Start learning/.test(html),'Start learning is offered for Unit 1');
ok(!/Open unit/.test(html.split('ai-unit-card-locked')[1]||''),'locked cards expose no Open unit link');

console.log('\nlocked unit pages redirect to the plan');
T.state.aiPage={type:'unit',unitIndex:1};
html=T.aiStudyView();
ok(/ai-plan-hero/.test(html),'a locked unit page falls back to the plan');
ok(T.state.aiPage.type==='plan','the page state was reset to plan');

console.log('\nthe unlock toast builds without a real DOM');
try{ T.xcToast('Unit 2 is ready — 6 new lessons unlocked.'); ok(true,'xcToast ran'); }
catch(e){ ok(false,'xcToast threw: '+e.message); }
ok(sandbox.document.getElementById('xcToast').textContent==='Unit 2 is ready — 6 new lessons unlocked.',
  'the toast carries the unlock message');

console.log(`\n${fail===0?'*** PASS ***':'*** FAIL ***'}  ${pass} passed, ${fail} failed\n`);
process.exit(fail===0?0:1);
