'use strict';
/* Proves the Mermaid upgrade is a real enhancement, not a dependency:
   correct diagram choice, safe syntax, and a fallback that always
   exists even when Mermaid never loads. */
const fs=require('fs'),path=require('path'),vm=require('vm');

let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ok   '+m);} else {fail++;console.log('  FAIL '+m);} };

const app=fs.readFileSync(path.join(__dirname,'js','app.js'),'utf8');
const start=app.indexOf('const AI_MERMAID_HINTS=');
const end=app.indexOf('/* Per-archetype chrome.');
if(start<0||end<0) throw new Error('mermaid block not found in app.js');
const slice=app.slice(start,end)
  .replace(/document\.(querySelectorAll|head|createElement)\([^)]*\)/g,'null')
  .replace(/\bdocument\b/g,'({getElementById:()=>null,querySelectorAll:()=>[],head:{appendChild(){}},createElement:()=>({})})')
  +'\nmodule.exports={aiPickMermaidType,aiMermaidSafe,aiMermaidSyntax,aiMermaidSlot,aiMermaidSlots};';

const sb={module:{exports:{}},console,window:{},document:{getElementById:()=>null,querySelectorAll:()=>[],
  head:{appendChild(){}},createElement:()=>({})},setTimeout,Promise,Math,String,Number,Array,Object,JSON};
vm.createContext(sb);
vm.runInContext(slice,sb);
const {aiPickMermaidType,aiMermaidSafe,aiMermaidSyntax,aiMermaidSlot,aiMermaidSlots}=sb.module.exports;

const step=(title,labels)=>({title,description:'d',layout:'flow',
  nodes:labels.map((l,i)=>({label:l,detail:`detail ${i+1}`}))});

console.log('\nthe right concepts are routed to Mermaid');
const cases=[
  ['TCP handshake',['Client','Server','SYN','ACK'],'sequence'],
  ['TCP connection lifecycle',['Idle','SynSent','Established','Closed'],'state'],
  ['University database schema',['Student','Course','Enrolment'],'er'],
  ['OOP inheritance',['Shape','Circle','Rectangle'],'class']
];
for(const [title,labels,want] of cases){
  const got=aiPickMermaidType(step(title,labels),title);
  ok(got===want,`"${title}" -> ${got} (expected ${want})`);
}

console.log('\nordinary concepts keep the bespoke engine');
['Cache eviction policies','B+ tree index','Refraction of light','HTTP status classes']
  .forEach(title=>{
    ok(aiPickMermaidType(step(title,['A','B','C']),title)===null,
      `"${title}" stays on the custom engine`);
  });

console.log('\nthe same concept always picks the same shape');
const a=aiPickMermaidType(step('TCP handshake',['A','B']),'TCP handshake');
const b=aiPickMermaidType(step('TCP handshake',['A','B']),'TCP handshake');
ok(a===b,'diagram type is stable across re-renders');

console.log('\nhostile labels are sanitised before they reach the parser');
ok(!aiMermaidSafe('Say "hi" [now]').includes('"'),'quotes are stripped');
ok(!/[[\]{}()<>|]/.test(aiMermaidSafe('a{b}c(d)')),'brackets are stripped');
ok(aiMermaidSafe('A'.repeat(200)).length<=38,'long labels are truncated');
ok(aiMermaidSafe('')==='step'||aiMermaidSafe('')==='Step 1','an empty label still yields a valid token');
ok(aiMermaidSafe(null).length>0,'a null label never produces empty syntax');

console.log('\nevery generated syntax block starts with a valid diagram header');
const valid={sequence:'sequenceDiagram',state:'stateDiagram-v2',er:'erDiagram',class:'classDiagram'};
for(const type of Object.keys(valid)){
  const syntax=aiMermaidSyntax(type,step('Sample concept',['Alpha','Beta','Gamma','Delta']));
  ok(syntax.split('\n')[0]===valid[type],`${type} emits a "${valid[type]}" header`);
  ok(!/["'`]/.test(syntax.split('\n').slice(1).join('\n').split(':')[0]||''),`${type} header is clean`);
}

console.log('\nno generated block contains a character Mermaid chokes on');
for(const type of Object.keys(valid)){
  const syntax=aiMermaidSyntax(type,step('Weird "title" [here]',['A "x"','B [y]','C|z','D{w}']));
  ok(!syntax.includes('"')||type==='er','quote use is confined to the ER relationship label');
  ok(!/^\s*-->/m.test(syntax)||type==='state',`${type} has no dangling arrow`);
}

console.log('\nthe slot ALWAYS contains a working fallback');
const fallbackSvg='<svg class="ai-diagram-svg"><title>t</title></svg>';
const slotHtml=aiMermaidSlot('sequence',step('Handshake',['A','B','C']),fallbackSvg,'Handshake: flow');
ok(slotHtml.includes('data-mermaid-slot='),'the slot is marked for hydration');
ok(slotHtml.includes(fallbackSvg),'the bespoke SVG is inside the slot, so it renders before Mermaid loads');
ok(slotHtml.startsWith('<div'),'the slot is a div wrapper, not a replacement of the svg');
ok(aiMermaidSlots.size===1,'the payload map holds the syntax for later hydration');

console.log('\nsyntax is grounded in the concept, not a template');
const s1=aiMermaidSyntax('sequence',step('TCP handshake',['Client','Server','SYN','ACK']));
const s2=aiMermaidSyntax('sequence',step('DNS lookup',['Resolver','Server','Query','Answer']));
ok(s1!==s2,'two different concepts produce two different sequence diagrams');
ok(s1.includes('Client')&&s2.includes('Resolver'),'participant names come from the concept nodes');

console.log(`\n${fail===0?'*** PASS ***':'*** FAIL ***'}  ${pass} passed, ${fail} failed\n`);
process.exit(fail===0?0:1);