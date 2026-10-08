/* Diagnostic: run the real outline prompt against live Gemini and report
   finishReason, token usage, parse result, and the first failing rule. */
const fs = require('fs');
const path = require('path');

const envText = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
const key = (envText.match(/^GEMINI_API_KEY=(.*)$/m) || [])[1];
const slugs = ((envText.match(/^GEMINI_MODELS=(.*)$/m) || [])[1] || '').split(',').map(s => s.trim()).filter(Boolean);

const outlinePrompt = 'Analyze the attached educational PDF and respond with a single valid JSON object containing title, subject, summary, units (at least 3, each with title, overview, learningGoals, topics with conceptIndices) and concepts (4 to 6 items, each with title, summary, explanation, sourceExcerpt, sourcePage, keyPoints, whyItMatters, analogy, explanationLevels {simple, everyday, advanced}, commonTrap, correctiveTruth, comparison {firstLabel, secondLabel, takeaway, rows[3] {aspect, first, second}}, originStory, realWorldExamples[{title, description}], workedExample {scenario, answer, steps[2] {label, action, reasoning}}, quickRecall, cheatCode {why, like, wrong, right, oneLine, mnemonic, see[3]}, visualization {caption, steps[2] {title, description, layout, nodes[3] {label, detail}}})). Level: standard. Each visualization layout MUST be one of exactly these 15: flow (steps/process), arch (system/parts), seq (timeline/order), compare (vs/difference), hierarchy (types/classification), state (states/status), erd (entities/data), fbd (force/pressure), wave (graph/signal), isometric (3D/layers), mindmap (brainstorm/causes), matrix (table/grid), equation (formula/calc), cycle (loop/repeats), layer (layers/levels). Keep every diagram topic-specific.';

function t(s){ return typeof s === 'string' && s.trim().length > 0; }
function debugOutline(pack){
  if (!pack || !Array.isArray(pack.units) || pack.units.length < 3) return 'units < 3';
  if (!Array.isArray(pack.concepts) || pack.concepts.length < 4) return 'concepts < 4';
  for (let i = 0; i < pack.concepts.length; i++){
    const c = pack.concepts[i];
    const at = (rule) => `concept[${i}] "${String(c.title||'').slice(0,40)}": ${rule}`;
    if (!t(c.title) || !t(c.summary) || !t(c.explanation)) return at('title/summary/explanation');
    if (!t(c.sourceExcerpt) || !(t(c.sourcePage) || (Number.isInteger(c.sourcePage) && c.sourcePage > 0))) return at('sourceExcerpt/sourcePage');
    if (!Array.isArray(c.keyPoints) || !c.keyPoints.length) return at('keyPoints');
    if (!t(c.whyItMatters) || !t(c.analogy)) return at('whyItMatters/analogy');
    if (!c.explanationLevels || !t(c.explanationLevels.simple) || !t(c.explanationLevels.everyday) || !t(c.explanationLevels.advanced)) return at('explanationLevels');
    if (!t(c.commonTrap) || !t(c.correctiveTruth)) return at('commonTrap/correctiveTruth');
    if (!c.comparison || !c.comparison.rows || c.comparison.rows.length < 3) return at('comparison.rows < 3');
    if (!t(c.originStory) || !Array.isArray(c.realWorldExamples) || !c.realWorldExamples.length) return at('originStory/realWorldExamples');
    if (!c.workedExample || !Array.isArray(c.workedExample.steps) || c.workedExample.steps.length < 2) return at('workedExample.steps < 2');
    if (!t(c.quickRecall)) return at('quickRecall');
    const cc = c.cheatCode;
    if (!cc || !t(cc.why) || !t(cc.like) || !t(cc.wrong) || !t(cc.right) || !t(cc.oneLine) || !t(cc.mnemonic)) return at('cheatCode fields');
    if (!Array.isArray(cc.see) || cc.see.length < 3) return at('cheatCode.see < 3');
    const vis = c.visualization;
    if (!vis || !t(vis.caption) || !Array.isArray(vis.steps) || vis.steps.length < 1) return at('visualization caption/steps empty');
    for (let j = 0; j < vis.steps.length; j++){
      const s = vis.steps[j];
      if (!t(s.title) || !t(s.description) || !t(s.layout)) return at(`vis.steps[${j}] title/desc/layout`);
      if (!Array.isArray(s.nodes) || s.nodes.length < 3) return at(`vis.steps[${j}] nodes < 3`);
      for (const n of s.nodes){ if (!t(n.label) || !t(n.detail)) return at(`vis.steps[${j}] node label/detail`); }
    }
  }
  return 'structure OK - failing rule must be visual fingerprints / pooled labels';
}


(async () => {
  const pdfB64 = fs.readFileSync(path.join(__dirname, 'sample-networks.pdf')).toString('base64');
  const slug = slugs[0];
  console.log('model:', slug, '| rotation:', slugs.join(','));
  const body = {
    model: 'models/' + slug,
    contents: [{ parts: [ { text: outlinePrompt }, { inlineData: { mimeType: 'application/pdf', data: pdfB64 } } ] }],
    generationConfig: { responseMimeType: 'application/json' }
  };
  const t0 = Date.now();
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + slug + ':generateContent?key=' + encodeURIComponent(key), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const jb = await res.json();
  console.log('http', res.status, 'in', ((Date.now() - t0) / 1000).toFixed(1) + 's');
  if (!res.ok){ console.log('ERROR:', JSON.stringify(jb.error).slice(0, 500)); return; }
  const cand = jb.candidates && jb.candidates[0];
  console.log('finishReason:', cand && cand.finishReason, '| usage:', JSON.stringify(jb.usageMetadata));
  const textOut = cand && cand.content && cand.content.parts ? cand.content.parts.map(p => p.text || '').join('') : '';
  console.log('text length:', textOut.length);
  fs.writeFileSync(path.join(__dirname, 'dbg-outline-raw.txt'), textOut);
  console.log('wrote dbg-outline-raw.txt');
  let parsed = null;
  try{
    const clean = String(textOut || '').replace(/```json/gi, '```').trim();
    const fenced = /```\s*([\s\S]*?)```/.exec(clean);
    const raw = fenced ? fenced[1] : clean;
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    parsed = JSON.parse(start >= 0 && end > start ? raw.slice(start, end + 1) : raw);
  }catch(e){
    console.log('PARSE FAILED:', e.message);
    const m = /position (\d+)/.exec(e.message);
    if (m){ const p = +m[1]; console.log('--- context around error ---'); console.log(textOut.slice(Math.max(0, p - 300), p + 300)); }
    else console.log(textOut.slice(0, 400));
    return;
  }
  console.log('parsed OK. units:', parsed.units && parsed.units.length, 'concepts:', parsed.concepts && parsed.concepts.length);
  console.log('first failing rule:', debugOutline(parsed));
  fs.writeFileSync(path.join(__dirname, 'dbg-outline.json'), JSON.stringify(parsed, null, 2));
  console.log('wrote dbg-outline.json');
})();
