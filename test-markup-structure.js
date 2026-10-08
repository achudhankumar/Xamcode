'use strict';
/* Guards the structural bug that hid the journey: .pdf-progress-track is
   4px tall with overflow:hidden, so ANY markup accidentally nested inside
   it is silently clipped to a sliver. Audits the progress panel's real
   nesting rather than trusting a grep for an id. */
const fs=require('fs'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'XamCode.html'),'utf8');

let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ok   '+m);} else {fail++;console.log('  FAIL '+m);} };

/* Isolate the panel. Scoped deliberately: auditing the whole document
   would have to understand every inline-SVG and optional-close quirk in
   markup this test does not own, and those failures drown the signal. */
const panelStart=html.indexOf('<section id="pdfUploadProgress"');
/* Slice through the panel's own </section> INCLUSIVE, so the audit sees a
   balanced section element. Cutting at next <p> would orphan the step
   list; cutting at the </section> index would drop the section itself. */
const panelEnd=html.indexOf('</section>',panelStart)+'</section>'.length;
ok(panelStart>=0&&panelEnd>panelStart,'the progress panel can be isolated');
const panel=html.slice(panelStart,panelEnd);
if(process.env.DEBUG_PANEL){
  console.log('panelStart',panelStart,'panelEnd',panelEnd,'len',panel.length);
  console.log('--- head ---');
  console.log(JSON.stringify(panel.slice(0,240)));
  console.log('--- tail ---');
  console.log(JSON.stringify(panel.slice(-240)));
  console.log('--- matches ---');
  const dbg=/<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  let d,n=0;
  while((d=dbg.exec(panel))&&n<14){
    console.log(`${n++} open=${d[1]==='/'?'C':'O'} tag=${d[2]} attrs=${JSON.stringify(d[3].slice(0,40))} @${d.index}`);
  }
}

console.log('\nthe panel is nested correctly');
/* Void elements we legitimately use inside the panel. */
const VOID=new Set(['br','hr','img','input','meta','link','source','col','area','embed','track','wbr','use']);
const stack=[];const problems=[];
/* Attribute values may legally contain ">" and "/", so match them as
   quoted units and test for the trailing slash on the whole match. A
   lazy [^>]*? here swallows the "/" of "<tag/>" and reports a phantom
   open tag for every self-closing element. */
const re=/<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
let m;
while((m=re.exec(panel))){
  const closing=m[1]==='/',tag=m[2].toLowerCase(),selfClose=m[3].trimEnd().endsWith('/');
  if(closing){
    let i=stack.length-1;
    while(i>=0&&stack[i]!==tag) i--;
    if(i<0){problems.push(`stray </${tag}>`);continue;}
    /* k starts at i+1: the tag at i is the one this close tag legitimately
       matches, so reporting it would flag every well-formed pair. */
    for(let k=i+1;k<stack.length;k++) problems.push(`<${stack[k]}> left open inside </${tag}>`);
    stack.length=i;
  }else if(!selfClose&&!VOID.has(tag)){
    stack.push(tag);
  }
}
problems.forEach(p=>{fail++;console.log('  FAIL '+p);});
stack.forEach(t=>{fail++;console.log(`  FAIL <${t}> never closed`);});
ok(stack.length===0&&problems.length===0,'every tag inside the panel is closed in the right order');

console.log('\nthe journey is a SIBLING of the progress track, not nested inside it');
const trackOpen=panel.indexOf('<div class="pdf-progress-track"');
const barIdx=panel.indexOf('id="pdfProgressBar"');
const trackClose=panel.indexOf('</div>',barIdx);
const journeyAt=panel.indexOf('id="pdfJourney"');
ok(trackOpen>=0,'the progress track exists');
ok(trackClose>barIdx,'the track closes right after its fill span');
ok(trackClose<journeyAt,
  'the track closes BEFORE the journey begins, so overflow:hidden cannot clip the journey');

console.log('\nthe panel sections render in the intended order');
const order=['pdf-progress-heading','pdfProgressBar','pdfJourney','pdf-progress-steps',
  'pdfProgressStatus','pdfProgressElapsed','pdf-progress-note'];
const at={};order.forEach(k=>{at[k]=panel.indexOf(k);});
ok(order.every(k=>at[k]>=0),'every expected panel section is present');
ok(order.every((k,i)=>i===0||at[k]>at[order[i-1]]),
  'heading -> bar -> journey -> steps -> status -> elapsed -> note appear in document order');

console.log(`\n${fail===0?'*** PASS ***':'*** FAIL ***'}  ${pass} passed, ${fail} failed\n`);
process.exit(fail===0?0:1);