'use strict';
/* Live smoke test: boots server.js on a scratch port + scratch data
   dir, exercises every public BIP route plus auth-gated failures.
   Run: node test-bip-smoke.tmp.js */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 4197;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'bip-smoke-'));
const env = Object.assign({}, process.env, { PORT: String(PORT), BIP_DATA_DIR: DATA });
const child = spawn(process.execPath, ['server.js'], { cwd: __dirname, env, stdio: ['ignore', 'pipe', 'pipe'] });
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } }

function req(method, p, body, headers) {
  return new Promise((resolve, reject) => {
    const opts = { host: '127.0.0.1', port: PORT, path: p, method, headers: Object.assign({ Accept: 'application/json' }, headers || {}) };
    const r = http.request(opts, (res) => {
      let buf = '';
      res.on('data', (c) => { buf += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: buf }));
    });
    r.on('error', reject);
    if (body !== undefined) r.write(typeof body === 'string' ? body : JSON.stringify(body));
    r.end();
  });
}
function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
  await wait(1800);
  let r, j;
  function parse(body) { try { return JSON.parse(body); } catch (e) { return null; } }
  r = await req('GET', '/api/health');
  j = parse(r.body);
  ok(r.status === 200 && j && j.service === 'xamcode-ai' && j.apiVersion === 1, 'study /api/health contract intact');
  r = await req('GET', '/build', undefined, { Accept: 'text/html' });
  ok(r.status === 200 && /built in public/i.test(r.body), 'GET /build serves the public page');

  /* ---- Route-separation regression ----
     / must serve the MAIN study app; /build and /build/ must serve the BIP
     dashboard. Never each other. Guards against the mount falling through to
     serveStatic (which would 404) or a stray redirect to the main site. */
  ok(/text\/html/.test(r.headers['content-type'] || ''), '/build content-type is text/html (got ' + r.headers['content-type'] + ')');
  ok(!/Drop your PDF here/i.test(r.body), '/build does NOT serve the main study site');
  const buildBody = r.body;

  r = await req('GET', '/build/', undefined, { Accept: 'text/html' });
  ok(r.status === 200 && /built in public/i.test(r.body), 'GET /build/ serves the BIP dashboard (consistent with /build)');
  ok(/text\/html/.test(r.headers['content-type'] || ''), '/build/ content-type is text/html (got ' + r.headers['content-type'] + ')');

  r = await req('GET', '/', undefined, { Accept: 'text/html' });
  ok(r.status === 200 && /Drop your PDF here/i.test(r.body), 'GET / serves the MAIN XamCode study site');
  ok(!/built in public/i.test(r.body), '/ does NOT serve the BIP dashboard');
  ok(/text\/html/.test(r.headers['content-type'] || ''), '/ content-type is text/html (got ' + r.headers['content-type'] + ')');
  ok(r.body !== buildBody, '/ and /build return different documents');

  /* ---- Crash regression ----
     A missing STATIC file (favicon is requested by every browser) used to hit
     serveStatic's 404 -> sendJson(res,404,{}) with no requestId -> setHeader
     'X-Request-Id: undefined' threw inside the async fs.readFile callback ->
     uncaughtException -> process death -> Render 502 + restart loop. It must
     return a clean 404 and leave the process serving. */
  r = await req('GET', '/favicon.ico', undefined, { Accept: 'image/x-icon' });
  ok(r.status === 404, 'missing static file returns 404 (got ' + r.status + ')');
  r = await req('GET', '/definitely-not-a-real-path', undefined, { Accept: 'text/html' });
  ok(r.status === 404, 'unknown path returns 404 (got ' + r.status + ')');
  r = await req('GET', '/api/health');
  j = parse(r.body);
  ok(r.status === 200 && j && j.service === 'xamcode-ai', 'server still alive after 404s (no crash loop)');
  r = await req('GET', '/api/bip/summary');
  j = parse(r.body);
  ok(r.status === 200 && j && typeof j.progress.percent === 'number', 'summary carries progress.percent');
  ok(j && Array.isArray(j.milestones) && j.milestones.length >= 10, 'summary carries >=10 milestones');
  ok(j && j.progress.totalWeight === 100, 'milestone weights sum to 100');
  ok(!/AKIA[0-9A-Z]{16}|PRIVATE KEY/.test(r.body), 'summary leaks no secret-shaped strings');
  ok(j && j.launch && 'hasConfirmedDate' in j.launch, 'summary carries launch tri-state');
  ok(j && j.integration && typeof j.integration.live === 'boolean', 'summary carries honest integration flags');
  r = await req('POST', '/api/bip/chat', { text: 'hello smoke', nickname: 'Smoke' }, { 'Content-Type': 'application/json' });
  j = parse(r.body);
  ok(r.status === 201 && j && j.message, 'chat posts (201)');
  r = await req('POST', '/api/bip/chat', { text: 'xss probe', nickname: 'Smoke' }, { 'Content-Type': 'application/json' });
  ok(r.status === 201, 'second chat posts');
  r = await req('GET', '/api/bip/chat?limit=5');
  j = parse(r.body);
  ok(r.status === 200 && j && Array.isArray(j.messages), 'chat list reads back');
  r = await req('POST', '/api/bip/ideas', { title: 'x', description: 'y' }, { 'Content-Type': 'application/json' });
  ok(r.status === 400, 'short idea rejected (400, got ' + r.status + ')');
  r = await req('POST', '/api/bip/ideas', { title: 'Smoke idea', description: 'A real description longer than ten chars.' }, { 'Content-Type': 'application/json' });
  j = parse(r.body);
  const ideaId = j && j.idea && j.idea.id;
  ok(r.status === 201 && ideaId, 'idea submits (201)');
  const cookie = r.headers['set-cookie'] ? [].concat(r.headers['set-cookie']).join('; ') : '';
  const withCookie = cookie ? { Cookie: cookie } : {};
  r = await req('POST', '/api/bip/ideas/' + ideaId + '/vote', {}, Object.assign({ 'Content-Type': 'application/json' }, withCookie));
  const v1 = parse(r.body);
  ok(r.status === 200 && v1 && v1.votes === 1 && v1.voted === true, 'first vote counts (votes=1)');
  r = await req('POST', '/api/bip/ideas/' + ideaId + '/vote', {}, Object.assign({ 'Content-Type': 'application/json' }, withCookie));
  const v2 = parse(r.body);
  ok(r.status === 200 && v2 && v2.votes === 0 && v2.voted === false, 'second vote toggles off — no double count');
  r = await req('POST', '/api/bip/waitlist', { email: 'not-an-email', consent: true }, { 'Content-Type': 'application/json' });
  ok(r.status === 400, 'bad email rejected');
  r = await req('POST', '/api/bip/waitlist', { email: 'smoke@example.com', consent: true }, { 'Content-Type': 'application/json' });
  const w1 = parse(r.body);
  ok(r.status === 201 && w1 && w1.position === 1, 'waitlist joins (position 1)');
  r = await req('POST', '/api/bip/waitlist', { email: 'smoke@example.com', consent: true }, { 'Content-Type': 'application/json' });
  const w2 = parse(r.body);
  ok(r.status === 200 && w2 && w2.duplicate === true, 'duplicate signup handled gracefully');
  r = await req('GET', '/api/bip/waitlist/count');
  const wc = parse(r.body);
  ok(wc && wc.count === 1 && r.body.indexOf('smoke@example') < 0, 'waitlist count=1, email never published');
  r = await req('POST', '/api/bip/events/ingest', { type: 'build_passed', summary: 'x' }, { 'Content-Type': 'application/json' });
  ok(r.status === 503, 'ingest without token -> 503 (got ' + r.status + ')');
  r = await req('POST', '/api/bip/webhooks/github', '{}', { 'Content-Type': 'application/json' });
  ok(r.status === 503, 'webhook without secret -> 503 (got ' + r.status + ')');
  r = await req('POST', '/api/bip/admin/milestones/core-setup/verify', { evidence: 'x' }, { 'Content-Type': 'application/json' });
  ok(r.status === 503, 'admin without token -> 503 (got ' + r.status + ')');
  r = await req('POST', '/api/bip/reports', { kind: 'idea', targetId: ideaId, reason: 'spam test' }, { 'Content-Type': 'application/json' });
  ok(r.status === 201, 'abuse report files (201)');
  r = await req('GET', '/api/bip/nope');
  ok(r.status === 404, 'unknown BIP route -> 404');
  console.log('\nSMOKE: ' + pass + ' passed, ' + fail + ' failed');
  child.kill();
  setTimeout(() => { try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) {} process.exit(fail ? 1 : 0); }, 400);
})().catch((e) => { console.log('SMOKE ERROR: ' + (e && e.message)); try { child.kill(); } catch (x) {} process.exit(1); });
