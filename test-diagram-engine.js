'use strict';
/* Proves the diagram engine gives DIFFERENT topics genuinely different
   pictures, deterministically, instead of one reused generic diagram. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const src=fs.readFileSync(path.join(__dirname,'js','app.js'),'utf8');

/* Pull just the engine functions out of the browser bundle. */
const need=['function aiHash(','function aiPickLayout(','function aiDiagramPositions(',
  'function aiDiagramPairs(','const AI_LAYOUT_HINTS='];
const starts=need.map(k=>src.indexOf(k));
if(starts.some(s=>s<0)) throw new Error('could not locate the diagram engine in app.js');
const end=src.indexOf('function aiDiagramEdge(');
const slice=src.slice(src.indexOf('function aiHash('),end)
  +'\nmodule.exports={aiHash,aiPickLayout,aiDiagramPositions,aiDiagramPairs,AI_LAYOUT_HINTS};';
const sb={module:{exports:{}},console};
vm.createContext(sb);
vm.runInContext(slice,sb);
const {aiPickLayout,aiDiagramPositions,aiDiagramPairs,aiHash}=sb.module.exports;

let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ok   '+m);} else {fail++;console.log('  FAIL '+m);} };

const step=(title,labels,layout='flow')=>({
  title,description:'d',layout,
  nodes:labels.map(l=>({label:l,detail:'d'}))
});

console.log('\nkeyword hints pick a semantically fitting archetype');
const cases=[
  ['OSI protocol stack layers',['Application','Transport','Network'],'layers'],
  ['Repeats until done',['Request','Retry','Backoff'],'cycle'],
  ['Hub versus switch',['Collision','Isolated'],'compare'],
  ['Types of normalisation',['1NF','2NF','3NF'],'tree'],
  ['Request response process',['Client','Server','Response'],'flow'],
  ['Evolution over time',['1970s','1990s','Now'],'timeline']
];
for(const [title,labels,want] of cases){
  const got=aiPickLayout(step(title,labels),title);
  ok(got===want, `"${title}" -> ${got} (expected ${want})`);
}

console.log('\ndifferent topics get different pictures');
const topics=[
  'Database normalisation forms', 'TCP handshake stages', 'Cache eviction policies',
  'Optical fibre refraction', 'Binary search tree', 'Transformer architecture layers',
  'HTTP status classes', 'Disk scheduling algorithms', 'Public key cryptography',
  'Operating system interrupts'
];
const layouts=topics.map(t=>aiPickLayout(step(t,['A','B','C']),t));
const unique=new Set(layouts);
ok(unique.size>=5, `10 distinct topics produced ${unique.size} distinct layouts`);
console.log('    '+topics.map((t,i)=>`${t.slice(0,26)}=${layouts[i]}`).join('\n    '));

console.log('\nthe same topic always renders the same way');
const a=aiPickLayout(step('B+ tree index',['Leaf','Node']),'B+ tree index');
const b=aiPickLayout(step('B+ tree index',['Leaf','Node']),'B+ tree index');
ok(a===b, 'a concept must not reshuffle between renders');

console.log('\nlayouts are structurally distinct, not just renamed');
const sig=layout=>{
  const n=4;
  const pos=aiDiagramPositions(layout,n);
  const pairs=aiDiagramPairs(layout,[0,1,2,3]);
  return `${pos.map(p=>Math.round(p.x)+','+Math.round(p.y)).join('|')}#${pairs.map(q=>q.join('-')).join(',')}`;
};
const archetypes=['flow','cycle','hierarchy','compare','layers','stack','stepchain','timeline','tree','matrix'];
const signatures=new Map();
for(const l of archetypes) signatures.set(l,sig(l));
const uniqueSigs=new Set(signatures.values());
ok(uniqueSigs.size>=8,
  `${archetypes.length} archetypes yield ${uniqueSigs.size} distinct geometries`);

console.log('\nevery archetype keeps nodes inside the canvas');
for(const l of archetypes){
  const pos=aiDiagramPositions(l,4);
  const inside=pos.every(p=>p.x>=40&&p.x<=560&&p.y>=30&&p.y<=290);
  ok(inside, `${l}: 4 nodes stay within the 600x312 viewBox`);
}
for(const l of archetypes){
  const pos=aiDiagramPositions(l,5);
  const inside=pos.every(p=>p.x>=40&&p.x<=560&&p.y>=30&&p.y<=290);
  ok(inside, `${l}: 5 nodes stay within the 600x312 viewBox`);
}

console.log('\nedges never reference a missing node');
for(const l of archetypes){
  for(const n of [2,3,4,5]){
    const pairs=aiDiagramPairs(l,Array.from({length:n},(_,i)=>i));
    ok(pairs.every(([f,t])=>f>=0&&f<n&&t>=0&&t<n), `${l}/${n}: all edges in range`);
  }
}

console.log(`\n${fail===0?'*** PASS ***':'*** FAIL ***'}  ${pass} passed, ${fail} failed\n`);
process.exit(fail===0?0:1);