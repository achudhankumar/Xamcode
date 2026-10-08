#!/usr/bin/env node
'use strict';
const http = require('http');
const BASE = 'http://127.0.0.1:4173';
const JOB = process.argv[2];
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
  if (JOB) {
    const j = await g(BASE + '/api/analyze/' + JOB);
    console.log('JOB=' + JSON.stringify(j).slice(0, 1500));
  }
  const q = await g(BASE + '/api/quota');
  console.log('QUOTA used=' + q.allowance.used + ' remaining=' + q.allowance.remaining);
  for (const m of (q.models || [])) {
    console.log('  ' + m.slug + '=' + m.status + (m.lastError ? ' err=' + m.lastError : ''));
  }
}
run().catch((e) => { console.error('ERR ' + e.message); process.exit(1); });
