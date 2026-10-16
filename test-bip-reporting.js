'use strict';
/* ============================================================
   REPORTING TESTS — CI build events + Render deploy webhook.
   ----------------------------------------------------------------
   Covers the Phase-3 lifecycle integrations end to end:
     * Standard Webhooks signature verification (valid / forged / stale /
       unconfigured) for POST /api/bip/webhooks/render,
     * allowlisted deploy mapping (started / succeeded / failed, and the
       honest "ignore anything unconfirmed" rule),
     * build_* event -> build status slot + deploy_* -> deploy slot,
     * stable dedupe keys (idempotent retries) for both paths,
     * the .github/report-bip.js CI reporter (success / failure / PR-skip).

   Run: node test-bip-reporting.js
   ============================================================ */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');

let pass = 0, fail = 0;
function ok(c, m){ if (c){ pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } }
function parse(body){ try { return JSON.parse(body); } catch (e){ return null; } }
function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

/* ---- Standard Webhooks signing (independent of the code under test) ---- */
const RENDER_SECRET = 'whsec_' + crypto.randomBytes(32).toString('base64');
const INGEST_TOKEN = 'test-bip-ingest-token-reporting-0123456789';
function signRender(secret, id, ts, body){
  let k = String(secret);
  if (k.startsWith('whsec_')) k = k.slice(6);
  const key = Buffer.from(k, 'base64');
  return 'v1,' + crypto.createHmac('sha256', key).update(id + '.' + ts + '.' + body, 'utf8').digest('base64');
}

/* ---- HTTP helper against a booted server ---- */
function req(port, method, p, body, headers){
  return new Promise((resolve) => {
    const opts = { host: '127.0.0.1', port, path: p, method, headers: Object.assign({ Accept: 'application/json' }, headers || {}) };
    const r = http.request(opts, (res) => {
      let buf = '';
      res.on('data', (c) => { buf += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: buf }));
    });
    r.on('error', () => resolve({ status: 0, headers: {}, body: '' }));
    if (body !== undefined) r.write(typeof body === 'string' ? body : JSON.stringify(body));
    r.end();
  });
}

/* ---- HTTP: signed Render deploy webhook against a booted server ---- */
async function webhookHttpTests(port){
  console.log('--- http: signed Render deploy webhook ---');
  const nowIso = new Date().toISOString();
  function post(payload, opts){
    opts = opts || {};
    const id = opts.id || ('evt-' + crypto.randomBytes(4).toString('hex'));
    const ts = opts.ts || String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify(payload);
    let sig;
    if (opts.badSig) sig = 'v1,' + Buffer.from('forged-signature').toString('base64');
    else sig = signRender(RENDER_SECRET, id, ts, body);
    const h = { 'Content-Type': 'application/json', 'webhook-id': id, 'webhook-timestamp': ts };
    if (!opts.noSig) h['webhook-signature'] = sig;
    return req(port, 'POST', '/api/bip/webhooks/render', body, h);
  }
  let r, j;
  r = await post({ type: 'deploy_started', timestamp: nowIso, data: { serviceId: 'srv_x', serviceName: 'xamcode-ai' } });
  j = parse(r.body);
  ok(r.status === 200 && j && j.stored === 1, 'deploy_started stored (got ' + r.status + ' stored=' + (j && j.stored) + ')');
  r = await req(port, 'GET', '/api/bip/status'); j = parse(r.body);
  ok(j && j.deploy && j.deploy.state === 'running', 'status.deploy = running after deploy_started (got ' + (j && j.deploy && j.deploy.state) + ')');

  r = await post({ type: 'deploy_ended', timestamp: nowIso, data: { serviceId: 'srv_x', serviceName: 'xamcode-ai', status: 'succeeded' } });
  ok(parse(r.body).stored === 1, 'deploy_ended succeeded stored');
  r = await req(port, 'GET', '/api/bip/status'); j = parse(r.body);
  ok(j.deploy.state === 'passed', 'status.deploy = passed after deploy_ended succeeded (got ' + j.deploy.state + ')');

  r = await post({ type: 'deploy_ended', timestamp: nowIso, data: { serviceId: 'srv_x', serviceName: 'xamcode-ai', status: 'failed' } });
  ok(parse(r.body).stored === 1, 'deploy_ended failed stored');
  r = await req(port, 'GET', '/api/bip/status'); j = parse(r.body);
  ok(j.deploy.state === 'failed', 'status.deploy = failed after deploy_ended failed (got ' + j.deploy.state + ')');

  // idempotency: replay the SAME webhook-id
  const replayId = 'evt-replay-1';
  const replayPayload = { type: 'deploy_started', timestamp: nowIso, data: { serviceId: 'srv_x', serviceName: 'xamcode-ai' } };
  r = await post(replayPayload, { id: replayId });
  ok(parse(r.body).stored === 1, 'first delivery of replay id stored');
  r = await post(replayPayload, { id: replayId });
  j = parse(r.body);
  ok(r.status === 200 && j && j.duplicates === 1 && j.stored === 0, 'replayed webhook-id is idempotent (duplicates=1, stored=0)');

  // failure reporting: forged / missing signature
  r = await post({ type: 'deploy_started', data: { serviceId: 'srv_x' } }, { badSig: true });
  ok(r.status === 401 && /BAD_SIGNATURE/.test(r.body), 'forged signature -> 401 BAD_SIGNATURE (got ' + r.status + ')');
  r = await post({ type: 'deploy_started', data: { serviceId: 'srv_x' } }, { noSig: true });
  ok(r.status === 401, 'missing signature header -> 401 (got ' + r.status + ')');

  // honest ignores
  r = await post({ type: 'deploy_ended', data: { serviceId: 'srv_x' } });
  j = parse(r.body);
  ok(r.status === 200 && j.stored === 0 && j.ignored === true, 'deploy_ended with no status ignored (never guessed)');
  r = await post({ type: 'server_scaled', data: { serviceId: 'srv_x' } });
  j = parse(r.body);
  ok(r.status === 200 && j.stored === 0 && j.ignored === true, 'non-deploy notification ignored');
}

/* ---- HTTP: CI build events via bearer ingest ---- */
async function ingestHttpTests(port){
  console.log('--- http: CI build events via bearer ingest ---');
  const AUTH = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + INGEST_TOKEN };
  let r, j;
  async function ingest(item){
    return req(port, 'POST', '/api/bip/events/ingest', item, AUTH);
  }
  r = await ingest({ type: 'build_started', summary: 'CI build started @ abc1234 (run 1)', ref: 'abc1234', dedupeKey: 'ci-build-start-1-1', source: 'ci' });
  j = parse(r.body);
  ok(r.status === 200 && j && j.stored === 1, 'build_started ingested (stored=' + (j && j.stored) + ')');
  r = await req(port, 'GET', '/api/bip/status'); j = parse(r.body);
  ok(j.build.state === 'running', 'status.build = running after build_started (got ' + j.build.state + ')');

  r = await ingest({ type: 'build_passed', summary: 'CI build passed @ abc1234 (run 1)', ref: 'abc1234', dedupeKey: 'ci-build-1-1', source: 'ci' });
  ok(parse(r.body).stored === 1, 'build_passed ingested');
  r = await req(port, 'GET', '/api/bip/status'); j = parse(r.body);
  ok(j.build.state === 'passed', 'status.build = passed after build_passed (got ' + j.build.state + ')');

  r = await ingest({ type: 'build_failed', summary: 'CI build failed @ abc1234 (run 1)', ref: 'abc1234', dedupeKey: 'ci-build-1-2', source: 'ci' });
  ok(parse(r.body).stored === 1, 'build_failed ingested');
  r = await req(port, 'GET', '/api/bip/status'); j = parse(r.body);
  ok(j.build.state === 'failed', 'status.build = failed after build_failed (got ' + j.build.state + ')');

  // idempotency
  r = await ingest({ type: 'build_passed', summary: 'CI build passed @ abc1234 (run 1)', ref: 'abc1234', dedupeKey: 'ci-build-1-1', source: 'ci' });
  j = parse(r.body);
  ok(r.status === 200 && j && j.duplicates === 1 && j.stored === 0, 'same dedupe key is idempotent (build)');

  // auth still enforced
  r = await req(port, 'POST', '/api/bip/events/ingest', { type: 'build_passed', summary: 'x' }, { 'Content-Type': 'application/json' });
  ok(r.status === 401, 'ingest without bearer -> 401 (got ' + r.status + ')');
}

function unitTests(){
  console.log('--- unit: Render signature verification ---');
  const events = require('./bip/events');
  const body = JSON.stringify({ type: 'deploy_started', timestamp: new Date().toISOString(), data: { id: 'evt_1', serviceId: 'srv_1', serviceName: 'xamcode-ai' } });
  const id = 'evt-cvvuvstest0001', ts = String(Math.floor(Date.now() / 1000));
  const goodSig = signRender(RENDER_SECRET, id, ts, body);
  const headers = { 'webhook-id': id, 'webhook-timestamp': ts, 'webhook-signature': goodSig };

  process.env.RENDER_WEBHOOK_SECRET = RENDER_SECRET;
  ok(events.verifyRenderSignature(body, headers).ok === true, 'valid signature verifies');
  ok(events.verifyRenderSignature(body, Object.assign({}, headers, { 'webhook-signature': 'v1,' + Buffer.from('forged').toString('base64') })).ok === false, 'forged signature rejected');
  ok(events.verifyRenderSignature(body, Object.assign({}, headers, { 'webhook-timestamp': String(Math.floor(Date.now() / 1000) - 4000) })).ok === false, 'stale timestamp rejected (replay window)');
  ok(events.verifyRenderSignature(body, { 'webhook-id': id }).ok === false, 'missing signature/timestamp headers rejected');
  ok(events.verifyRenderSignature('tampered' + body, headers).ok === false, 'signature does not cover a tampered body');
  delete process.env.RENDER_WEBHOOK_SECRET;
  ok(events.verifyRenderSignature(body, headers).configured === false, 'unconfigured secret reports configured:false (route answers 503)');

  console.log('--- unit: deploy mapping allowlist ---');
  const at = new Date().toISOString();
  let m = events.mapRenderWebhook({ type: 'deploy_started', timestamp: at, data: { serviceId: 'srv_1', serviceName: 'xamcode-ai' } }, 'evt_a');
  ok(m.length === 1 && m[0].type === 'deploy_started' && m[0].source === 'webhook' && m[0].dedupeKey === 'render-evt_a', 'deploy_started maps with stable dedupe key');
  ok(m[0].ref === '', 'deploy event ref stays empty (no commit in Render payload — never invented)');
  m = events.mapRenderWebhook({ type: 'deploy_ended', data: { serviceId: 'srv_1', status: 'succeeded' } }, 'evt_b');
  ok(m.length === 1 && m[0].type === 'deploy_succeeded', 'deploy_ended+succeeded maps to deploy_succeeded');
  m = events.mapRenderWebhook({ type: 'deploy_ended', data: { serviceId: 'srv_1', status: 'failed' } }, 'evt_c');
  ok(m.length === 1 && m[0].type === 'deploy_failed', 'deploy_ended+failed maps to deploy_failed');
  m = events.mapRenderWebhook({ type: 'deploy_ended', data: { serviceId: 'srv_1' } }, 'evt_d');
  ok(m.length === 0, 'deploy_ended with NO status is ignored (never a guessed result)');
  m = events.mapRenderWebhook({ type: 'server_scaled', data: { serviceId: 'srv_1' } }, 'evt_e');
  ok(m.length === 0, 'non-deploy notifications are ignored');
  ok(events.mapRenderWebhook(null, 'x').length === 0, 'null payload ignored');
}

/* ---- boot helpers ---- */
function bootServer(port, withRenderSecret){
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'bip-rep-'));
  const env = Object.assign({}, process.env, { PORT: String(port), BIP_DATA_DIR: data, BIP_INGEST_TOKEN: INGEST_TOKEN });
  delete env.RENDER_WEBHOOK_SECRET;
  delete env.BIP_INGEST_TOKEN;
  if (withRenderSecret) env.RENDER_WEBHOOK_SECRET = RENDER_SECRET;
  env.BIP_INGEST_TOKEN = INGEST_TOKEN;
  const child = spawn(process.execPath, ['server.js'], { cwd: __dirname, env, stdio: ['ignore', 'pipe', 'pipe'] });
  return { child, data };
}
async function killServer(s){
  if (!s) return;
  try { await new Promise(res => { s.child.once('exit', res); s.child.kill(); setTimeout(res, 1500); }); } catch (e){}
  await wait(300);
  try { fs.rmSync(s.data, { recursive: true, force: true }); } catch (e){}
}

/* ---- Render webhook without a secret must fail closed; ingest unaffected ---- */
async function unconfiguredWebhookTest(port){
  console.log('--- http: Render webhook unconfigured fails closed ---');
  const id = 'evt-x', ts = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({ type: 'deploy_started', data: { serviceId: 'srv_x' } });
  const sig = signRender(RENDER_SECRET, id, ts, body);
  let r = await req(port, 'POST', '/api/bip/webhooks/render', body, { 'Content-Type': 'application/json', 'webhook-id': id, 'webhook-timestamp': ts, 'webhook-signature': sig });
  ok(r.status === 503 && /WEBHOOK_NOT_CONFIGURED/.test(r.body), 'webhook without RENDER_WEBHOOK_SECRET -> 503 fail-closed (got ' + r.status + ')');
  r = await req(port, 'POST', '/api/bip/events/ingest', { type: 'build_started', summary: 'CI build started @ abc (run 9)', dedupeKey: 'ci-build-start-9-1', source: 'ci' }, { 'Content-Type': 'application/json', Authorization: 'Bearer ' + INGEST_TOKEN });
  ok(r.status === 200, 'ingest works independently of Render webhook config (got ' + r.status + ')');
}

/* ---- CI reporter (.github/report-bip.js): success / failure / PR-skip ---- */
function reporterTests(port){
  console.log('--- reporter: .github/report-bip.js ---');
  const script = path.join(__dirname, '.github', 'report-bip.js');
  const baseEnv = Object.assign({}, process.env, { PUBLIC_URL: 'http://127.0.0.1:' + port, GITHUB_RUN_ID: '42', GITHUB_SHA: 'abcdef1234567890abcdef1234567890abcdef12' });
  delete baseEnv.BIP_INGEST_TOKEN;
  function run(extra){
    return spawnSync(process.execPath, [script], { env: Object.assign({}, baseEnv, extra || {}), encoding: 'utf8' });
  }
  let out = run({ BIP_INGEST_TOKEN: INGEST_TOKEN, EVENT_TYPE: 'build_passed', SUMMARY: 'CI build passed @ abcdef1 (run 42)', REF: 'abcdef1234567890abcdef1234567890abcdef12', DEDUPE_KEY: 'ci-build-42-1', SOURCE: 'ci', GITHUB_EVENT_NAME: 'push' });
  ok(out.status === 0 && /report OK/.test(out.stdout), 'reporter success exits 0 (status ' + out.status + ')');
  ok(String(out.stdout).indexOf(INGEST_TOKEN) < 0 && String(out.stderr).indexOf(INGEST_TOKEN) < 0, 'reporter never echoes the bearer token to a log');
  out = run({ EVENT_TYPE: 'build_started', SUMMARY: 'CI build started @ abcdef1 (run 42)', GITHUB_EVENT_NAME: 'push' });
  ok(out.status === 1 && /BIP_INGEST_TOKEN/.test(String(out.stdout) + String(out.stderr)), 'reporter missing token on push fails visibly (status ' + out.status + ')');
  out = run({ EVENT_TYPE: 'build_started', SUMMARY: 'CI build started @ abcdef1 (run 42)', GITHUB_EVENT_NAME: 'pull_request' });
  ok(out.status === 0 && /skipped/i.test(String(out.stdout)), 'reporter skips gracefully on pull_request without secrets');
}

/* ---- runner ---- */
(async () => {
  let s1 = null, s2 = null;
  try {
    unitTests();
    s1 = bootServer(4195, true);
    await wait(1800);
    await webhookHttpTests(4195);
    await ingestHttpTests(4195);
    reporterTests(4195);
    await killServer(s1); s1 = null;

    s2 = bootServer(4194, false);
    await wait(1800);
    await unconfiguredWebhookTest(4194);
    await killServer(s2); s2 = null;
  } catch (e) {
    fail++; console.log('  FAIL suite error: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e.message));
  }
  await killServer(s1); await killServer(s2);
  console.log('\nREPORTING: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();

