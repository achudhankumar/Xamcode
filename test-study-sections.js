/* ============================================================
   TEST - GENERATED STUDY SECTIONS
   ============================================================
   Drives the REAL server validators against synthetic packs, so the
   per-section rules (CheatCode, per-question visuals, visual reuse,
   quiz coverage) are verified without calling a live AI provider.

   Run: node test-study-sections.js
   ============================================================ */
'use strict';
/* Exercises the real server validators against synthetic packs, so the
   section rules are tested without depending on a live AI provider. */
const fs=require('fs'), path=require('path'), vm=require('vm');
const src=fs.readFileSync(path.join(__dirname,'server.js'),'utf8');

/* Load only the schema + validator slice, so no server socket opens.
   The slice ends right after validateStudyPack, before any routing. */
const start=src.indexOf('const studySchema');
const endMarker='function validateStudyPack(pack) {';
const end=src.indexOf(endMarker);
if(start<0||end<0) throw new Error('could not locate the study schema/validator block');
let depth=0,cut=src.indexOf('\n}',src.indexOf('return validateStudyBank(pack',end));
/* Extend past validateStudyPack to include the pickLayout keyword router,
   which sits immediately after it and before the MiniMax section. */
const pickEnd=src.indexOf('\n}',src.indexOf('return \'arch\'; // default',cut));
if(pickEnd>cut) cut=pickEnd;
const slice=src.slice(start,cut+3);
const sandbox={module:{exports:{}},exports:{},require,console,__dirname:__dirname};
vm.createContext(sandbox);
vm.runInContext(slice+'\nmodule.exports={studySchema,studyPlanSchema,studyBankSchema,validateStudyOutline,validateStudyBank,validateStudyPack,pickLayout,visualFingerprint,normalizeOutline,normalizeBank};',sandbox);
const M=sandbox.module.exports;

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
    {title:'t'+i+'b',description:'d',layout:'cycle',nodes:[N(uniq+'b1','x'),N(uniq+'b2','x'),N(uniq+'b3','x')]}
  ]}
});
const mkUnit=(i,n)=>({title:'U'+i,overview:'o',learningGoals:['g1','g2'],
  topics:[{title:'T'+i,overview:'o',conceptIndices:Array.from({length:n},(_,k)=>i*n+k)}]});
const mkQ=(i,uniq)=>({
  question:'q'+i, options:['a','b','c','d'], answerIndex:0, category:'c', difficulty:'Easy',
  conceptIndex:i, hint:'h', explanation:'e',
  optionExplanations:['a','b','c','d'], eli5:'l',
  visual:{caption:'vc'+i,layout:'flow',steps:[
    {title:'s1',description:'d',nodes:[N(uniq+'1','x'),N(uniq+'2','x'),N(uniq+'3','x')]},
    {title:'s2',description:'d',nodes:[N(uniq+'4','x'),N(uniq+'5','x'),N(uniq+'6','x')]}
  ]}
});

const N_C=5;
/* Each concept must be assigned exactly once, so the 3 units partition
   the concept list rather than repeating it. */
const mkUnits=(n)=>{
  const per=[2,2,1].slice(0,3);
  let cursor=0;
  return per.map((count,u)=>{
    const indices=Array.from({length:count},(_,k)=>cursor+k);
    cursor+=count;
    return {title:'U'+u,overview:'o',learningGoals:['g1','g2'],
      topics:[{title:'T'+u,overview:'o',conceptIndices:indices}]};
  });
};
const goodOutline=()=>({title:'T',subject:'S',summary:'m',
  units:mkUnits(N_C), concepts:Array.from({length:N_C},(_,i)=>mkConcept(i,'c'+i+'z'))});
const goodBank=()=>({formulas:[{name:'f',expression:'e',meaning:'m'}],
  questions:Array.from({length:N_C*3},(_,i)=>mkQ(i%N_C,'q'+i+'z')),
  flashcards:Array.from({length:N_C*2},(_,i)=>({front:'f',back:'b',conceptIndex:i%N_C}))});

console.log('\nvalid packs pass');
ok(M.validateStudyOutline(goodOutline())===true,'a complete outline validates');
ok(M.validateStudyBank(goodBank(),N_C)===true,'a complete bank validates');
ok(M.validateStudyPack({...goodOutline(),...goodBank()})===true,'a complete assembled pack validates');

console.log('\nCheatCodes are mandatory');
const noCc=goodOutline(); delete noCc.concepts[0].cheatCode;
ok(M.validateStudyOutline(noCc)===false,'a concept without a cheatCode is rejected');
const partialCc=goodOutline(); delete partialCc.concepts[1].cheatCode.mnemonic;
ok(M.validateStudyOutline(partialCc)===false,'a cheatCode missing mnemonic is rejected');
const thinSee=goodOutline(); thinSee.concepts[2].cheatCode.see=['only one'];
ok(M.validateStudyOutline(thinSee)===false,'a cheatCode with fewer than 3 examples is rejected');

console.log('\nvisuals must be topic-specific (the reported bug)');
const dupCon=goodOutline();
dupCon.concepts[1].visualization.steps[0].nodes=dupCon.concepts[0].visualization.steps[0].nodes;
ok(M.validateStudyOutline(dupCon)===false,'two concepts sharing one diagram is rejected');
/* A generic diagram reused across every topic: the fingerprints collide
   because the node COUNT and layout are also identical. */
const genericLabel=goodOutline();
['Step 1','Step 2','Step 3'].forEach((lbl,k)=>{
  genericLabel.concepts.forEach(c=>c.visualization.steps.forEach((st,si)=>{
    st.title=si?'Then':'Start'; st.layout='flow';
    st.nodes=[0,1,2].map(n=>({label:lbl,detail:'d'}));
  }));
});
ok(M.validateStudyOutline(genericLabel)===false,
  'one generic diagram repeated on every topic is rejected');
const dupQ=goodBank();
dupQ.questions[3].visual=JSON.parse(JSON.stringify(dupQ.questions[0].visual));
ok(M.validateStudyBank(dupQ,N_C)===false,'two questions sharing one diagram is rejected');
const noVis=goodBank(); delete noVis.questions[0].visual;
ok(M.validateStudyBank(noVis,N_C)===false,'a question without a visual is rejected');
const noVisStep=goodBank(); noVisStep.questions[1].visual.steps[0].nodes=[{label:'x'}];
ok(M.validateStudyBank(noVisStep,N_C)===false,'a visual node missing detail is rejected');

console.log('\nquiz coverage');
const fewQ=goodBank(); fewQ.questions=fewQ.questions.slice(0,N_C);
ok(M.validateStudyBank(fewQ,N_C)===false,'fewer than 2 questions per concept is rejected');
const lopsided=goodBank();
lopsided.questions=lopsided.questions.map(q=>q.conceptIndex===0?{...q,conceptIndex:0}:q)
  .filter(q=>q.conceptIndex!==4);
ok(M.validateStudyBank(lopsided,N_C)===false,'a topic with no questions at all is rejected');

console.log('\nformulas are optional but must be well formed');
ok(M.validateStudyBank({...goodBank(),formulas:[]},N_C)===true,'an empty formulas array is allowed');
ok(M.validateStudyBank({...goodBank(),formulas:[{name:'f',expression:'',meaning:'m'}]},N_C)===false,
  'a formula missing an expression is rejected');

console.log('\ncode-aware diagram nodes (syntax + workflow)');
ok(!!M.studyPlanSchema.properties.concepts.items.properties.visualization.properties.steps.items.properties.nodes.items.properties.code,
  'the stage 1 schema exposes the optional code field on nodes');
ok(!!M.studyBankSchema.properties.questions.items.properties.visual.properties.steps.items.properties.nodes.items.properties.code,
  'the stage 2 schema exposes the optional code field on nodes');
const coded=goodOutline();
coded.concepts[0].visualization.steps[0].nodes=coded.concepts[0].visualization.steps[0].nodes.map((n,i)=>({...n,code:['x = 1','for i in range(3):','print(x)'][i]}));
ok(M.validateStudyOutline(coded)===true,'nodes carrying real syntax still validate');
const badCode=goodOutline();
badCode.concepts[0].visualization.steps[0].nodes[0]={label:'Step',detail:'does a thing',code:'   '};
ok(M.validateStudyOutline(badCode)===false,'a node with blank code is rejected');
const longCode=goodOutline();
longCode.concepts[0].visualization.steps[0].nodes[0]={label:'Step',detail:'does a thing',code:'x'.repeat(81)};
ok(M.validateStudyOutline(longCode)===false,'a node with code over 80 chars is rejected');
const codedQ=goodBank();
codedQ.questions[0].visual.steps[1].nodes=codedQ.questions[0].visual.steps[1].nodes.map(n=>({...n,code:'print(x)'}));
ok(M.validateStudyBank(codedQ,N_C)===true,'question nodes carrying syntax still validate');
const badCodeQ=goodBank();
badCodeQ.questions[1].visual.steps[0].nodes[0]={label:'Step',detail:'asks',code:''};
ok(M.validateStudyBank(badCodeQ,N_C)===false,'a question node with empty code is rejected');

console.log('\nschemas expose both stages');
ok(M.studyPlanSchema.required.join()==='title,subject,summary,units,concepts','stage 1 schema shape');
ok(M.studyBankSchema.required.join()==='formulas,questions,flashcards','stage 2 schema shape');
ok(!!M.studyPlanSchema.properties.concepts.items.properties.cheatCode,'cheatCode is in the stage 1 schema');
ok(!!M.studyBankSchema.properties.questions.items.properties.visual,'per-question visual is in the stage 2 schema');

console.log('\n15 universal layouts validate, anything else is rejected');
const all15=['flow','arch','seq','compare','hierarchy','state','erd','fbd','wave','isometric','mindmap','matrix','equation','cycle','layer'];
const pack15={...goodOutline(),...goodBank()};
pack15.concepts.forEach((c,i)=>{ c.visualization.steps.forEach(s=>{ s.layout=all15[i%all15.length]; }); });
pack15.questions.forEach((q,i)=>{ q.visual.layout=all15[i%all15.length]; });
ok(M.validateStudyPack(pack15)===true,'a pack using all 15 layouts validates');
const badLayout={...goodOutline(),...goodBank()};
badLayout.concepts[0].visualization.steps[0].layout='flowchart';
ok(M.validateStudyPack(badLayout)===false,'an unknown concept layout is rejected');
const badQLayout={...goodOutline(),...goodBank()};
badQLayout.questions[0].visual.layout='diagram';
ok(M.validateStudyPack(badQLayout)===false,'an unknown question layout is rejected');

console.log('\nunit/topic structure mirrors the browser\'s exact-once rule');
const stray=goodOutline();
stray.units[2].topics[0].conceptIndices=[4,9];
ok(M.validateStudyOutline(stray)===false,'a topic index pointing past the last lesson is rejected');
const missing=goodOutline();
missing.units[2].topics[0].conceptIndices=[];
ok(M.validateStudyOutline(missing)===false,'a topic with no lessons is rejected');
const twice=goodOutline();
twice.units[1].topics[0].conceptIndices=[2,3,4];
ok(M.validateStudyOutline(twice)===false,'a lesson assigned to two topics is rejected');

console.log('\nnormalizeOutline repairs the model\'s arithmetic, never invents');
const miscount=goodOutline();
miscount.units[2].topics[0].conceptIndices=[4,9];
M.normalizeOutline(miscount);
ok(M.validateStudyOutline(miscount)===true,'an out-of-range stray index is dropped and the outline validates');
const gap=goodOutline();
gap.units[2].topics[0].conceptIndices=[9];
M.normalizeOutline(gap);
ok(M.validateStudyOutline(gap)===true,'an index that strands its topic is reattached and the outline validates');
const dupTopic=goodOutline();
dupTopic.units[1].topics[0].conceptIndices=[2,3,4];
M.normalizeOutline(dupTopic);
ok(M.validateStudyOutline(dupTopic)===true,'a doubly-assigned lesson is deduped and the outline validates');
const husk=goodOutline();
husk.units.push({title:'',overview:'',learningGoals:[],topics:[{title:'',conceptIndices:[99]}]});
M.normalizeOutline(husk);
ok(husk.units.length>=3&&M.validateStudyOutline(husk)===true,
  'a fourth husk unit never drops the outline below three units');

console.log('\nphantom lesson pointers are refused (and repairable)');
const strayQ=goodBank();
strayQ.questions[0].conceptIndex=N_C;
ok(M.validateStudyBank(strayQ,N_C)===false,'a question pointing past the last lesson is rejected');
const strayCard=goodBank();
strayCard.flashcards[0].conceptIndex=N_C+2;
ok(M.validateStudyBank(strayCard,N_C)===false,'a flashcard pointing past the last lesson is rejected');
M.normalizeBank(strayQ,N_C);
ok(M.validateStudyBank(strayQ,N_C)===true,'normalizeBank reassigns a stray question index and the bank validates');
M.normalizeBank(strayCard,N_C);
ok(M.validateStudyBank(strayCard,N_C)===true,'normalizeBank reassigns a stray flashcard index and the bank validates');
const hole=goodBank();
hole.questions.forEach(q=>{ if(q.conceptIndex===0) q.conceptIndex=4; });
M.normalizeBank(hole,N_C);
ok(M.validateStudyBank(hole,N_C)===true,'a coverage hole left by reassignment is filled from the surplus');

console.log('\npickLayout routes keywords to the right archetype');
ok(M.pickLayout('AC vs DC differences')==='compare','vs/difference routes to compare');
ok(M.pickLayout('Explain the steps of how a bill becomes law')==='flow','steps/process routes to flow');
ok(M.pickLayout('Describe the cardiac cycle loop')==='cycle','cycle/loop routes to cycle');
ok(M.pickLayout('TCP states and status modes')==='state','states/status routes to state');
ok(M.pickLayout('Read the ECG wave graph signal')==='wave','graph/wave routes to wave');
ok(M.pickLayout('Calculate the dosage formula derivation')==='equation','formula/calc routes to equation');
ok(M.pickLayout('Name the types in this classification')==='hierarchy','types/classification routes to hierarchy');
ok(M.pickLayout('Give the case timeline in order')==='seq','timeline/order routes to seq');
ok(M.pickLayout('List the OSI layers and levels')==='layer','layers/levels routes to layer');
ok(M.pickLayout('Model User 1:N Posts entities')==='erd','entities/relationship routes to erd');
ok(M.pickLayout('Beam load pressure and force')==='fbd','force/pressure routes to fbd');
ok(M.pickLayout('Show the client server system parts')==='arch','system/parts routes to arch');
ok(M.pickLayout('Brainstorm causes of crime ideas')==='mindmap','brainstorm/causes routes to mindmap');
ok(M.pickLayout('Fill the SWOT matrix table grid')==='matrix','table/matrix routes to matrix');
ok(M.pickLayout('Exploded 3D assembly view')==='isometric','3D/exploded routes to isometric');
ok(M.pickLayout('Something with no keywords at all')==='arch','unknown text falls back to arch');

console.log('\nvisualFingerprint keys on first-step layout + node labels');
ok(M.visualFingerprint({steps:[{layout:'flow',nodes:[{label:'Ingestion'},{label:'Absorption'}]}]})==='flow:Ingestion/Absorption',
  'fingerprint is "layout:label/label" (e.g. flow:Ingestion/Absorption)');

console.log(`\n${fail===0?'*** PASS ***':'*** FAIL ***'}  ${pass} passed, ${fail} failed\n`);
process.exit(fail===0?0:1);