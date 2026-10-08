#!/usr/bin/env node
'use strict';
// Real PDF end-to-end test. Run: node setup/test-real-pdf.js
const http = require('http');
const BASE = 'http://127.0.0.1:4173';

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch (e) { resolve({ raw: d }); }
      });
    }).on('error', reject);
  });
}

function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { resolve({ status: res.statusCode, raw: raw }); }
      });
    });
    req.on('error', reject);
    req.end(data);
  });
}

function pollJob(jobId, maxAttempts, interval) {
  maxAttempts = maxAttempts || 60;
  interval = interval || 5000;
  return new Promise((resolve, reject) => {
    function check(i) {
      if (i >= maxAttempts) { resolve(null); return; }
      getJson(BASE + '/api/analyze/' + jobId).then((st) => {
        if (st && (st.status === 'done' || st.status === 'completed' || st.status === 'failed' || st.status === 'error' || st.status === 'cancelled')) resolve(st);
        else setTimeout(() => check(i + 1), interval);
      }).catch(reject);
    }
    check(0);
  });
}

function createStudyPdf() {
  const L = [
    '%PDF-1.4',
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 5 0 R/Resources<</Font<</F1 4 0 R>>>>>>endobj',
    '4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj',
    '5 0 obj<</Length 900>>stream',
    'BT /F1 14 Tf 72 740 Td (Photosynthesis Study Guide) Tj ET',
    'BT /F1 11 Tf 72 716 Td (Chapter 5: Plant Biology) Tj ET',
    'BT /F1 11 Tf 72 692 Td (Photosynthesis converts light energy into chemical energy in glucose.) Tj ET',
    'BT /F1 11 Tf 72 676 Td (It occurs in chloroplasts and needs sunlight, water and carbon dioxide.) Tj ET',
    'BT /F1 11 Tf 72 652 Td (Step 1: light reactions in thylakoid membranes split water, release oxygen.) Tj ET',
    'BT /F1 11 Tf 72 636 Td (Step 2: Calvin cycle in stroma fixes CO2 into glucose using ATP and NADPH.) Tj ET',
    'BT /F1 11 Tf 72 612 Td (Chlorophyll absorbs light. Stroma is the fluid space. Thylakoid holds pigments.) Tj ET',
    'BT /F1 11 Tf 72 596 Td (Equation: 6CO2 + 6H2O + light -> C6H12O6 + 6O2.) Tj ET',
    'BT /F1 11 Tf 72 572 Td (Q1: two main stages? Q2: where do light reactions occur?) Tj ET',
    'BT /F1 11 Tf 72 556 Td (Q3: role of chlorophyll? Q4: why is oxygen produced?) Tj ET',
    'endstream',
    'endobj',
    'xref',
    '0 6',
    '0000000000 65535 f ',
    '0000000009 00000 n ',
    '0000000056 00000 n ',
    '0000000111 00000 n ',
    '0000000262 00000 n ',
    '0000000321 00000 n ',
    'trailer<</Size 6/Root 1 0 R>>',
    'startxref',
    '1300',
    '%%EOF'
  ];
  return Buffer.from(L.join('\n'), 'utf8');
}

async function main() {
  console.log('=== XamCode AI Agent Test (Real PDF) ===');
  try {
    const root = await getJson(BASE + '/');
    console.log('1. server: OK');
  } catch (e) { console.log('1. server: NOT RUNNING (' + e.message + ')'); return; }
  const prov = await getJson(BASE + '/api/providers');
  const list = prov.providers || [];
  const g = list.find((p) => p.id === 'gemini');
  const q = list.find((p) => p.id === 'groq');
  console.log('2. gemini=' + (g && g.configured ? 'CONFIGURED docs=' + g.documents : 'MISSING') +
    ' groq=' + (q && q.configured ? 'CONFIGURED' : 'MISSING'));
  const quota = await getJson(BASE + '/api/quota');
  if (quota.allowance) console.log('3. quota: ' + quota.allowance.remaining + ' of ' + quota.allowance.limit + ' remaining');
  else console.log('3. quota: ' + JSON.stringify(quota).slice(0, 300));
  const pdf = createStudyPdf();
  console.log('4. pdf bytes: ' + pdf.length);
  const job = await postJson(BASE + '/api/analyze', { pdfBase64: pdf.toString('base64'), level: 'standard' });
  console.log('5. job: ' + (job.jobId || JSON.stringify(job).slice(0, 400)));
  if (!job.jobId) return;
  console.log('6. polling (up to ~5 min)...');
  const st = await pollJob(job.jobId);
  if (!st) { console.log('   TIMEOUT waiting for job'); return; }
  console.log('   status=' + st.status + ' stage=' + (st.stage || '') + ' progress=' + (st.progress || ''));
  if (st.error) console.log('   error: ' + st.error);
  if (st.study) {
    console.log('   OK completed. title=' + (st.study.title || '?'));
    console.log('   concepts=' + (st.study.concepts ? st.study.concepts.length : 0) +
      ' units=' + (st.study.units ? st.study.units.length : 0) +
      ' questions=' + (st.study.questions ? st.study.questions.length : 0) +
      ' flashcards=' + (st.study.flashcards ? st.study.flashcards.length : 0) +
      ' formulas=' + (st.study.formulas ? st.study.formulas.length : 0));
    console.log('   sample concept: ' + ((st.study.concepts || [])[0] ? st.study.concepts[0].title : '?'));
    console.log('   sample question: ' + ((st.study.questions || [])[0] ? st.study.questions[0].question : '?'));
  } else if (st.status !== 'done' && st.status !== 'completed') {
    console.log('   body: ' + JSON.stringify(st).slice(0, 800));
  }
  console.log('=== Test Complete ===');
}

main().catch((e) => { console.error('Fatal: ' + e.message); process.exit(1); });

