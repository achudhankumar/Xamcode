'use strict';
/* Verifies the per-caller daily allowance:
     1. a malformed upload must NOT spend a generation
     2. a valid attempt spends exactly one
     3. the Nth+1 attempt is refused with DAILY_LIMIT_REACHED
   Uses a tiny real PDF header, and deliberately relies on every model
   being exhausted so no live generation is consumed.

   DELIBERATELY NOT IN `npm test`. Step 2 spends the caller's ENTIRE
   daily allowance - that is the only way to reach the Nth+1 refusal
   without faking the counter - so running it burns all 5 PDFs for the day
   against the live server on 4173 and must be done by hand, on a day you
   are willing to spend. It also expects the server to already be running.

   The CLIENT half of the same refusal (the 429 branch in
   analyzePdfRequest, the panel refresh, and the teardown that stops the
   journey animation) costs nothing to run and IS in the suite, as
   test-allowance-client.js / `npm run test:allowance`. */
const http = require('http');

const BASE = 'http://127.0.0.1:4173';
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
  '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
  '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n' +
  'trailer<</Root 1 0 R>>\n%%EOF\n', 'latin1').toString('base64');

function post(body){
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(BASE + '/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode, body: raw }); } });
    });
    req.on('error', reject);
    req.end(payload);
  });
}

const allowance = async () => (await new Promise((res, rej) => {
  http.get(BASE + '/api/quota', r => { let s = ''; r.on('data', c => s += c); r.on('end', () => res(JSON.parse(s).allowance)); }).on('error', rej);
}));

(async () => {
  let pass = 0, fail = 0;
  const check = (name, ok, extra) => { ok ? pass++ : fail++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`); };

  const limit = (await allowance()).limit;
  console.log(`\nAllowance limit under test: ${limit}\n`);

  console.log('1. malformed uploads must not spend a generation');
  const before = (await allowance()).used;
  await post({ pdfBase64: 'bm90LWEtcGRm' });            // valid base64, not a PDF
  await post({ pdfBase64: '' });                          // empty
  await post({ pdfBase64: '!!!not base64!!!' });          // not base64
  const afterBad = (await allowance()).used;
  check('3 bad uploads spent 0 generations', before === afterBad, `used ${before} -> ${afterBad}`);

  console.log('\n2. valid attempts spend exactly one each');
  let spent = 0;
  for (let i = 0; i < limit; i++) {
    const u0 = (await allowance()).used;
    await post({ pdfBase64: PDF });
    const u1 = (await allowance()).used;
    if (u1 === u0 + 1) spent++;
  }
  check(`each of ${limit} attempts spent 1`, spent === limit, `${spent}/${limit}`);

  console.log('\n3. the next attempt is refused');
  const over = await post({ pdfBase64: PDF });
  check('HTTP 429 returned', over.status === 429, `status ${over.status}`);
  check("code is DAILY_LIMIT_REACHED", over.body?.code === 'DAILY_LIMIT_REACHED', over.body?.code);
  check('remaining reported as 0', over.body?.allowance?.remaining === 0, JSON.stringify(over.body?.allowance));
  const still = (await allowance()).used;
  check('refused attempt did not spend more', still === limit, `used ${still}`);

  console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'}: ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
})();