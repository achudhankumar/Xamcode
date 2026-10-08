#!/usr/bin/env node
'use strict';
// Show full details of a completed analyze job.
const http = require('http');
const BASE = 'http://127.0.0.1:4173';
const JOB = process.argv[2] || '778f960f-3512-49ee-be06-b1f90ea7ba30';
function g(url) {
  return new Promise((res, rej) => {
    http.get(url, (r) => {
      let d = '';
      r.on('data', (c) => { d += c; });
      r.on('end', () => {
        try { res(JSON.parse(d)); }
        catch (e) { res({ raw: String(d).slice(0, 500) }); }
      });
    }).on('error', rej);
  });
}
async function run() {
  const j = await g(BASE + '/api/analyze/' + JOB);
  console.log('status=' + j.status + ' stage=' + j.stage + ' progress=' + j.progress + ' elapsedMs=' + j.elapsedMs);
  const s = j.study;
  if (!s) { console.log('NO STUDY. error=' + (j.error || '?')); return; }
  console.log('title: ' + s.title);
  console.log('subject: ' + s.subject);
  console.log('summary: ' + s.summary);
  console.log('units=' + s.units.length + ' concepts=' + s.concepts.length +
    ' questions=' + (s.questions || []).length + ' flashcards=' + (s.flashcards || []).length +
    ' formulas=' + (s.formulas || []).length);
  console.log('--- units ---');
  s.units.forEach((u, i) => console.log('  ' + (i + 1) + '. ' + u.title + ' | topics: ' + (u.topics || []).map((t) => t.title).join(', ')));
  console.log('--- concepts ---');
  s.concepts.forEach((c, i) => console.log('  ' + (i + 1) + '. ' + c.title));
  console.log('--- sample question ---');
  if (s.questions && s.questions[0]) {
    const q = s.questions[0];
    console.log('  Q: ' + q.question);
    (q.options || []).forEach((o, i) => console.log('    ' + (i === q.answerIndex ? '*' : ' ') + String.fromCharCode(65 + i) + '. ' + o));
  }
  console.log('--- sample flashcard ---');
  if (s.flashcards && s.flashcards[0]) console.log('  Q: ' + s.flashcards[0].front + ' | A: ' + s.flashcards[0].back);
}
run().catch((e) => { console.error('ERR ' + e.message); process.exit(1); });
