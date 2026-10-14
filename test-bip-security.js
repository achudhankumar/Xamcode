'use strict';
/* Focused security test: boots server.js on a scratch port + scratch
   data dir and verifies the hardening added in this pass against real
   HTTP behavior (not function-name presence):
     - CSP + security headers on /build page and JSON APIs
     - unauthorized admin / webhook / ingest fail closed
     - public endpoints cannot mutate protected state
     - HTML/script injection is neutralized on output
     - oversized / malformed bodies rejected
     - rate limiting kicks in
     - waitlist emails never published; CSV export is admin-only
   Run: node test-bip-security.js */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 4198;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'bip-sec-'));
/* A valid admin token so we can prove the AUTH path works AND that the
   SAME calls fail closed when the token is absent. Webhook/ingest secrets
   are left unset so their fail-closed 503 is exercised too. */
const ADMIN_TOKEN = 'test-admin-token-abcdef123456';
const env = Object.assign({}, process.env, {
  PORT: String(PORT),
  BIP_DATA_DIR: DATA,
  BIP_ADMIN_TOKEN: ADMIN_TOKEN
});
delete env.GITHUB_WEBHOOK_SECRET;
delete env.BIP_INGEST_TOKEN;

const child = spawn(process.execPath, ['server.js'], { cwd: 'c:/Xamcode', env, stdio: ['ignore', 'pipe', 'pipe'] });
let stderrBuf = '';
child.stderr.on('data', (c) => { stderrBuf += c; });

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } }
function parse(body) { try { return JSON.parse(body); } catch (e) { return null; } }

function req(method, p, body, headers) {
  return new Promise((resolve) => {
    const opts = { host: '127.0.0.1', port: PORT, path: p, method, headers: Object.assign({ Accept: 'application/json' }, headers || {}) };
    const r = http.request(opts, (res) => {
      let buf = '';
      res.on('data', (c) => { buf += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: buf }));
    });
    /* The body-size gate in bip/util.js calls req.destroy() the moment a
       body exceeds the cap (same defense as server.js). That is deliberate:
       an unbounded upload is refused by tearing down the socket. On the
       client that arrives as ECONNRESET, so resolve with a synthetic
       "refused" status instead of throwing and aborting the suite. */
    r.on('error', () => resolve({ status: 0, reset: true, headers: {}, body: '' }));
    if (body !== undefined) r.write(typeof body === 'string' ? body : JSON.stringify(body));
    r.end();
  });
}
function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
  await wait(1800);
  let r, j;

  /* ---------- 1. CSP + security headers on the public page ---------- */
  r = await req('GET', '/build', undefined, { Accept: 'text/html' });
  const cspPage = r.headers['content-security-policy'] || '';
  ok(typeof cspPage === 'string' && cspPage.length > 0, '/build sends a Content-Security-Policy header');
  ok(/default-src/.test(cspPage), 'page CSP sets default-src');
  ok(/script-src/.test(cspPage) && /'nonce-/.test(cspPage), 'page CSP uses a nonce for script-src');
  ok(/object-src 'none'/.test(cspPage), 'page CSP sets object-src \'none\'');
  ok(/base-uri/.test(cspPage), 'page CSP sets a restrictive base-uri');
  ok(/frame-ancestors 'none'/.test(cspPage), 'page CSP sets frame-ancestors \'none\'');
  ok(!/unsafe-eval/.test(cspPage), 'page CSP avoids unsafe-eval');
  const nonce = (cspPage.match(/'nonce-([A-Za-z0-9+/=]+)'/) || [])[1];
  ok(!!nonce, 'page CSP exposes a parseable nonce value');
  ok(nonce && new RegExp('<script nonce="' + nonce.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"').test(r.body), 'the inline <script> carries that nonce (page will execute)');
  ok((r.headers['x-frame-options'] || '').toUpperCase().indexOf('DENY') >= 0, '/build sets X-Frame-Options: DENY');
  ok((r.headers['x-content-type-options'] || '').toLowerCase() === 'nosniff', '/build sets X-Content-Type-Options: nosniff');
  ok(!!r.headers['referrer-policy'], '/build sets a Referrer-Policy');

  /* ---------- 2. CSP + headers on JSON APIs (BIP + study) ---------- */
  r = await req('GET', '/api/bip/summary');
  const cspApi = r.headers['content-security-policy'] || '';
  ok(typeof cspApi === 'string' && cspApi.length > 0, 'BIP JSON API sends a CSP header');
  ok(/default-src 'none'/.test(cspApi), 'API CSP is default-src \'none\' (JSON is not a document)');
  ok((r.headers['x-frame-options'] || '').toUpperCase().indexOf('DENY') >= 0, 'BIP API sets X-Frame-Options: DENY');
  r = await req('GET', '/api/health');
  ok(typeof (r.headers['content-security-policy'] || '') === 'string' && (r.headers['content-security-policy'] || '').length > 0, 'study /api/health also sends CSP');

  /* ---------- 3. Admin auth fails closed (401 when a token IS set) ---------- */
  const AUTH = { Authorization: 'Bearer ' + ADMIN_TOKEN, 'Content-Type': 'application/json', Accept: 'application/json' };
  r = await req('POST', '/api/bip/admin/milestones/security-review/verify', { evidence: 'x' }, { 'Content-Type': 'application/json', Accept: 'application/json' });
  ok(r.status === 401 && /UNAUTHORIZED/.test(r.body), 'admin verify with NO token -> 401 UNAUTHORIZED (got ' + r.status + ')');
  r = await req('POST', '/api/bip/admin/milestones/security-review/verify', { evidence: 'x' }, { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Bearer wrong-token-value' });
  ok(r.status === 401, 'admin verify with WRONG token -> 401 (got ' + r.status + ')');
  r = await req('PUT', '/api/bip/admin/launch', { estimated: '2026-12-01' }, { 'Content-Type': 'application/json', Accept: 'application/json' });
  ok(r.status === 401, 'admin launch edit with NO token -> 401 (got ' + r.status + ')');
  r = await req('GET', '/api/bip/admin/waitlist/export');
  ok(r.status === 401, 'waitlist CSV export with NO token -> 401 (got ' + r.status + ')');

  /* ---------- 4. The authorized admin path actually works ----------
     (proves auth is a real gate, not a blanket 401, and that verifying
     moves progress). */
  r = await req('POST', '/api/bip/admin/milestones/security-review/verify', { evidence: 'verified by security test' }, AUTH);
  j = parse(r.body);
  ok(r.status === 200 && j && j.milestone && j.milestone.status === 'verified', 'admin verify WITH correct token -> 200 and status=verified');
  ok(j && j.progress && typeof j.progress.percent === 'number' && j.progress.percent > 0, 'verification advances weighted progress');

  /* ---------- 5. Webhook + ingest fail closed when unconfigured ---------- */
  r = await req('POST', '/api/bip/webhooks/github', '{}', { 'Content-Type': 'application/json', Accept: 'application/json' });
  ok(r.status === 503 && /WEBHOOK_NOT_CONFIGURED/.test(r.body), 'webhook without secret -> 503 fail-closed (got ' + r.status + ')');
  r = await req('POST', '/api/bip/events/ingest', { type: 'build_passed', summary: 'x' }, { 'Content-Type': 'application/json', Accept: 'application/json' });
  ok(r.status === 503 && /INGEST_NOT_CONFIGURED/.test(r.body), 'ingest without token -> 503 fail-closed (got ' + r.status + ')');

  /* ---------- 6. HTML/script/secret injection neutralized on output ---------- */
  const payload = '<img src=x onerror=alert(1)><script>alert(2)</script> key sk-abcdef123456789012';
  r = await req('POST', '/api/bip/chat', { text: payload, nickname: '<b>Evil</b>' }, { 'Content-Type': 'application/json', Accept: 'application/json' });
  j = parse(r.body);
  ok(r.status === 201 && j && j.message, 'chat with injection payload still posts (201)');
  ok(j && j.message && !/</.test(j.message.text), 'stored chat text has all HTML tags stripped');
  ok(j && j.message && /\[redacted\]/.test(j.message.text), 'secret-looking token is redacted in stored text');
  ok(j && j.message && !/<b>/.test(j.message.nickname), 'nickname HTML is stripped');
  r = await req('GET', '/api/bip/chat?limit=5');
  ok(!/<script/i.test(r.body) && !/onerror=/i.test(r.body), 'chat feed returns no executable script/onerror markup');

  /* ---------- 7. Malformed + oversized bodies rejected ---------- */
  r = await req('POST', '/api/bip/chat', 'not-json{{{', { 'Content-Type': 'application/json', Accept: 'application/json' });
  ok(r.status === 400, 'malformed JSON body -> 400 (got ' + r.status + ')');
  r = await req('POST', '/api/bip/chat', JSON.stringify({ text: 'x'.repeat(70 * 1024) }), { 'Content-Type': 'application/json', Accept: 'application/json' });
  ok(r.status === 400 || r.reset, 'oversized body is refused (400 or socket reset by the size gate) (got status ' + r.status + ')');

  /* ---------- 8. Rate limiting kicks in on public chat ---------- */
  let saw429 = false;
  for (let i = 0; i < 12 && !saw429; i++){
    const rr = await req('POST', '/api/bip/chat', { text: 'rate probe ' + i }, { 'Content-Type': 'application/json', Accept: 'application/json' });
    if (rr.status === 429) saw429 = true;
  }
  ok(saw429, 'public chat rate limit returns 429 after burst');

  /* ---------- 9. Waitlist privacy + admin-only CSV with formula guard ---------- */
  r = await req('POST', '/api/bip/waitlist', { email: 'csv-inject@example.com', nickname: '=cmd|\' /c calc\'!A1', consent: true }, { 'Content-Type': 'application/json', Accept: 'application/json' });
  ok(r.status === 201, 'waitlist signup with formula nickname stores (201)');
  r = await req('GET', '/api/bip/waitlist/count');
  j = parse(r.body);
  ok(j && j.count >= 1 && r.body.indexOf('csv-inject@example') < 0 && r.body.indexOf('@example.com') < 0, 'public waitlist count never leaks the email');
  r = await req('GET', '/api/bip/summary');
  ok(r.body.indexOf('csv-inject@example') < 0, 'summary payload never includes waitlist emails');
  r = await req('GET', '/api/bip/admin/waitlist/export', undefined, AUTH);
  ok(r.status === 200 && /text\/csv/.test(r.headers['content-type'] || ''), 'CSV export WITH token -> 200 text/csv');
  ok(/'=cmd/.test(r.body), 'CSV neutralizes spreadsheet-formula injection (leading = is quoted)');
  ok(r.body.indexOf('csv-inject@example.com') >= 0, 'admin-only CSV does contain the email (proves gate, not data loss)');

  console.log('\nSECURITY: ' + pass + ' passed, ' + fail + ' failed');
  child.kill();
  setTimeout(() => { try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) {} process.exit(fail ? 1 : 0); }, 400);
})().catch((e) => { console.log('SECURITY ERROR: ' + (e && e.message)); if (stderrBuf) console.log('server stderr:\n' + stderrBuf.slice(-2000)); try { child.kill(); } catch (x) {} process.exit(1); });
