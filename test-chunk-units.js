/* ============================================================
   TEST - UNIT-CHUNKED BUILD
   ============================================================
   Drives the REAL server validators and merge helpers against
   synthetic unit packs, so the Unit-1-first path is verified without
   calling a live AI provider:
     · normalizePlan repairs a thin plan and rejects a broken one
     · validateUnitOutline enforces the one-unit partition rules
     · validateStudyOutline still accepts a full pack (refactor guard)
     · claimVisualKey resolves cross-unit diagram collisions
     · assembleChunkStudy keeps global offsets, locks and the ledger
     · validateChunkedStudy + the browser validator both accept the
       merged study at every unlock stage
   Run: node test-chunk-units.js
   ============================================================ */
'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm');
const src=fs.readFileSync(path.join(__dirname,'server.js'),'utf8');
const appSrc=fs.readFileSync(path.join(__dirname,'js','app.js'),'utf8');

/* ---- validator slice (same cut as test-study-sections) ---- */
const start=src.indexOf('const studySchema');
const end=src.indexOf('function validateStudyPack(pack) {');
if(start<0||end<0) throw new Error('could not locate the study schema/validator block');
let cut=src.indexOf('\n}',src.indexOf('return validateStudyBank(pack',end));
const pickEnd=src.indexOf('\n}',src.indexOf("return 'arch'; // default",cut));
if(pickEnd>cut) cut=pickEnd;
const slice=src.slice(start,cut+3);
const sandbox={module:{exports:{}},exports:{},require,console,__dirname:__dirname};
vm.createContext(sandbox);
vm.runInContext(slice+
  '\nmodule.exports={validateStudyOutline,validateUnitOutline,validateChunkedStudy,normalizePlan,validatePlan,normalizeOutline};',sandbox);
const S=sandbox.module.exports;

/* ---- chunk helper slice (dedupe + assembler) ---- */
const cs=src.indexOf('function clientVisualKey(');
const ce=src.indexOf('/* ---------- HTTP helpers + routes ---------- */');
if(cs<0||ce<0||ce<=cs) throw new Error('could not locate the chunk helper block');
const hbox={module:{exports:{}},exports:{},console};
vm.createContext(hbox);
vm.runInContext(src.slice(cs,ce)+
  '\nmodule.exports={clientVisualKey,claimVisualKey,wrapUnitPack,assembleChunkStudy};',hbox);
const H=hbox.module.exports;

/* ---- browser validator (the exact code the page runs) ---- */
const aStart=appSrc.indexOf('function validateAIStudyForDisplay(study){');
const aEnd=appSrc.indexOf('\nfunction aiStudyView()');
const abox={module:{exports:{}},exports:{},console};
vm.createContext(abox);
vm.runInContext(appSrc.slice(aStart,aEnd)+'\nmodule.exports={validateAIStudyForDisplay};',abox);
const C=abox.module.exports;

let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ok   '+m);} else {fail++;console.log('  FAIL '+m);} };

const N=(l,d)=>({label:l,detail:d});
const mkConcept=(i,uniq)=>({
  title:'Concept '+i, summary:'s'+i, explanation:'e'+i,
  sourceExcerpt:'x'+i, sourcePage:'1', keyPoints:['a','b','c'],
  whyItMatters:'w'+i, analogy:'an'+i,
  explanationLevels:{simple:'s',everyday:'e',advanced:'a'},
  commonTrap:'ct'+i, correctiveTruth:'cu'+i,
  comparison:{firstLabel:'A'+i,secondLabel:'B'+i,takeaway:'t'+i,
    rows:[{aspect:'a',first:'f',second:'s'},{aspect:'b',first:'f',second:'s'},{aspect:'c',first:'f',second:'s'}]},
  originStory:'o'+i, realWorldExamples:[{title:'t'+i,description:'d'+i}],
  workedExample:{scenario:'sc'+i,answer:'an'+i,steps:[{label:'l',action:'a',reasoning:'r'},{label:'l',action:'a',reasoning:'r'}]},
  quickRecall:'q'+i,
  cheatCode:{why:'w'+i,like:'l'+i,wrong:'wr'+i,right:'ri'+i,oneLine:'o'+i,mnemonic:'m'+i,
    see:['s1','s2','s3']},
  visualization:{caption:'c'+i,steps:[
    {title:'t'+i+'a',description:'d',layout:'flow',nodes:[N(uniq+'a1','x'),N(uniq+'a2','x'),N(uniq+'a3','x')]},
    {title:'t'+i+'b',description:'d',layout:'layer',nodes:[N(uniq+'b1','x'),N(uniq+'b2','x'),N(uniq+'b3','x')]}
  ]}
});
const mkQuestion=(qi,ci,uniq)=>({
  question:'Question '+qi+' about '+uniq, options:['o1','o2','o3','o4'],
  answerIndex:qi%4, category:'Concept', difficulty:'medium', conceptIndex:ci,
  hint:'h'+qi, explanation:'why '+qi, optionExplanations:['e1','e2','e3','e4'], eli5:'simple '+qi,
  visual:{caption:'vis '+qi,layout:'flow',steps:[
    {title:'s1',description:'d',nodes:[N(uniq+'q1','x'),N(uniq+'q2','x'),N(uniq+'q3','x')]},
    {title:'s2',description:'d',nodes:[N(uniq+'q1','x'),N(uniq+'q2','x'),N(uniq+'q3','x')]}
  ]}
});
const mkCard=(ci)=>({front:'f'+ci,back:'b'+ci,conceptIndex:ci});
const mkUnit=(title,n)=>({title,overview:'Overview of '+title,learningGoals:['goal a','goal b'],
  topics:[{title:title+' topics',overview:'topics overview',conceptIndices:Array.from({length:n},(_,i)=>i)}]});

console.log('\nnormalizePlan repairs a thin plan into a valid one');
const thin={title:'Course',units:[{title:'Unit 1'},{title:'Unit 2',overview:'o',topics:[{title:'T'}]}]};
ok(S.normalizePlan(thin)===true,'normalizePlan accepts a thin plan');
ok(S.validatePlan(thin),'the repaired plan validates');
ok(Array.isArray(thin.units[0].topics)&&thin.units[0].topics.length===1,'a unit without topics gets one');
ok(Array.isArray(thin.units[0].learningGoals)&&thin.units[0].learningGoals.length>0,'a unit without goals gets one');
ok(thin.units[0].topics[0].conceptIndices===undefined,'plan topics never carry conceptIndices');
console.log('\nnormalizePlan rejects a plan that cannot drive a study');
ok(S.normalizePlan({units:[]})===false,'a plan without a title fails');
ok(S.normalizePlan({title:'x'})===false,'a plan without units fails');
ok(S.validatePlan({title:'x',subject:'y',units:[{title:'u'}]})===false,'a unit without overview/goals/topics fails');

console.log('\nvalidateUnitOutline enforces the one-unit partition');
const unitPack={units:[mkUnit('Unit 1',4)],concepts:[0,1,2,3].map(i=>mkConcept(i,'u1c'+i))};
ok(S.validateUnitOutline(unitPack),'a clean 4-lesson unit passes');
const stray=JSON.parse(JSON.stringify(unitPack));
stray.units[0].topics[0].conceptIndices=[0,1,2,9];
ok(S.validateUnitOutline(stray)===false,'a phantom concept index is refused');
const thinUnit={units:[mkUnit('Unit 1',2)],concepts:[mkConcept(0,'a'),mkConcept(1,'b')]};
ok(S.validateUnitOutline(thinUnit)===false,'fewer than 3 lessons is refused');
const dupe=JSON.parse(JSON.stringify(unitPack));
dupe.units[0].topics=[{title:'A',overview:'o',conceptIndices:[0,1]},{title:'B',overview:'o',conceptIndices:[1,2]}];
ok(S.validateUnitOutline(dupe)===false,'a lesson assigned twice is refused');

console.log('\nvalidateStudyOutline still accepts a full pack (refactor guard)');
const full={title:'t',subject:'s',summary:'m',
  units:[mkUnit('U1',2),
    {title:'U2',overview:'o',learningGoals:['g'],topics:[{title:'T',overview:'o',conceptIndices:[2]}]},
    {title:'U3',overview:'o',learningGoals:['g'],topics:[{title:'T',overview:'o',conceptIndices:[3]}]}],
  concepts:[0,1,2,3].map(i=>mkConcept(i,'full'+i))};
ok(S.validateStudyOutline(full),'the 3-unit reference pack still passes');

console.log('\nclaimVisualKey resolves cross-unit diagram collisions');
const chunk={visualKeys:new Set()};
const stepA={title:'s',description:'d',layout:'flow',nodes:[N('Same','x'),N('Pool','x'),N('Generic','x')]};
const stepB={title:'s',description:'d',layout:'flow',nodes:[N('Same','x'),N('Pool','x'),N('Generic','x')]};
H.claimVisualKey(chunk,stepA,'Lesson One');
H.claimVisualKey(chunk,stepB,'Lesson Two');
ok(H.clientVisualKey(stepA)!==H.clientVisualKey(stepB),'two colliding steps end with distinct keys');
ok(stepB.nodes[0].label==='Lesson Two','the colliding step is rewritten to its own lesson title');
const stepC={title:'s',description:'d',layout:'flow',nodes:[N('Other','x'),N('Pool','x'),N('Generic','x')]};
H.claimVisualKey(chunk,stepC,'Lesson Three');
ok(stepC.nodes[0].label==='Other','a unique step is left untouched');

console.log('\nassembleChunkStudy merges built units at their global offsets');
const b0={topics:[{title:'T0',overview:'o',conceptIndices:[0,1,2,3]}],
  concepts:[0,1,2,3].map(i=>mkConcept(i,'b0-'+i)),
  questions:[0,1,2,3,4,5,6,7].map(i=>mkQuestion(i,i%4,'b0q'+i)),
  flashcards:[0,1,2,3,4,5,6,7].map(i=>mkCard(i%4)),
  formulas:[{name:'f',expression:'x',meaning:'m'}]};
const b2={topics:[{title:'T2',overview:'o',conceptIndices:[4,5]}],
  concepts:[4,5].map(i=>mkConcept(i,'b2-'+i)),
  questions:[0,1,2,3].map(i=>mkQuestion(i,4+(i%2),'b2q'+i)),
  flashcards:[4,5].map(i=>mkCard(i)),
  formulas:[]};
const planUnits=[
  {title:'U1',overview:'o1',learningGoals:['g'],topics:[{title:'t',overview:'o'}]},
  {title:'U2',overview:'o2',learningGoals:['g'],topics:[{title:'t',overview:'o'}]},
  {title:'U3',overview:'o3',learningGoals:['g'],topics:[{title:'t',overview:'o'}]}];
const job={chunk:{plan:{title:'Course',subject:'CS',summary:'sum',units:planUnits},
  built:[b0,null,b2],states:['ready','building','ready'],visualKeys:new Set()}};
const merged=H.assembleChunkStudy(job);
ok(merged.chunked===true&&Array.isArray(merged.unitStates),'the merged study carries its ledger');
ok(merged.units.length===3&&!merged.units[0].locked,'built units are unlocked');
ok(merged.units[1].locked===true&&merged.units[1].topics.length===0,'an unbuilt unit stays locked with no topics');
ok(merged.concepts.length===6,'lessons from both built units are present');
ok(JSON.stringify(merged.pendingUnits)==='[1]','only the unbuilt unit is pending');
ok(merged.unitStates[1].status==='building','the in-flight unit reports building');

console.log('\nthe merged study passes BOTH validators at every stage');
ok(S.validateChunkedStudy(merged),'the server accepts the merged pack');
ok(C.validateAIStudyForDisplay(merged)==='','the browser validator accepts it');
/* Stage 1: only Unit 1 built — the exact pack a big PDF first delivers. */
const stage1=H.assembleChunkStudy({chunk:Object.assign({},job.chunk,
  {built:[b0,null,null],states:['ready','building','locked']})});
ok(S.validateChunkedStudy(stage1),'Unit 1 alone validates on the server');
ok(C.validateAIStudyForDisplay(stage1)==='','Unit 1 alone validates in the browser');
const b3={topics:[{title:'T0',overview:'o',conceptIndices:[0,1,2]}],
  concepts:[0,1,2].map(i=>mkConcept(i,'b3-'+i)),
  questions:[0,1,2,3,4,5,6,7].map(i=>mkQuestion(i,i%3,'b3q'+i)),
  flashcards:[0,1,2,3,4,5,6,7].map(i=>mkCard(i%3)),
  formulas:[]};
const stage1Compact=H.assembleChunkStudy({chunk:Object.assign({},job.chunk,
  {built:[b3,null,null],states:['ready','building','locked']})});
ok(S.validateChunkedStudy(stage1Compact),'3-concept compact Unit 1 validates on the server');
ok(C.validateAIStudyForDisplay(stage1Compact)==='','3-concept compact Unit 1 validates in the browser');
/* A broken merge must be refused. */
const broken=JSON.parse(JSON.stringify(merged));
broken.units[0].topics=[];
ok(S.validateChunkedStudy(broken)===false,'an unlocked unit without topics is refused');
const broken2=JSON.parse(JSON.stringify(merged));
broken2.units[1].learningGoals=[];
ok(S.validateChunkedStudy(broken2)===false,'a locked unit without learning goals is refused');

console.log('\nwrapUnitPack accepts both response shapes');
const flat=H.wrapUnitPack({topics:[{title:'T',overview:'o',conceptIndices:[0]}],concepts:[mkConcept(0,'w')]},
  {title:'U',overview:'o',learningGoals:['g'],topics:[]});
ok(flat.units.length===1&&flat.units[0].topics.length===1,'a flat {topics,concepts} response wraps');
const nested=H.wrapUnitPack({units:[{topics:[{title:'T',overview:'o',conceptIndices:[0]}]}],concepts:[mkConcept(0,'w')]},
  {title:'U',overview:'o',learningGoals:['g'],topics:[]});
ok(nested.units[0].topics.length===1,'a {units:[{topics}]} response wraps too');

console.log(`\n${fail===0?'*** PASS ***':'*** FAIL ***'}  ${pass} passed, ${fail} failed\n`);
process.exit(fail===0?0:1);
