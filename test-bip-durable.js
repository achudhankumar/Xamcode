'use strict';
/* DURABLE STORAGE suite for Build-in-Public.
   ----------------------------------------------------------------
   Spins up a MOCK Supabase (PostgREST-shaped) HTTP server, points
   bip/db.js at it, and verifies the full event path end to end:
     ingest -> atomic durable write -> activity/status reads ->
     process restart WITH a wiped local data dir -> events still
   served from durable storage.
   Also covers: duplicate handling (atomic), invalid events, auth
   failures, database failures with honest 503s, milestone/progress
   behaviour unchanged, and that the service-role credential never
   appears in any HTTP response.

   HONESTY NOTE: the "restart" below is a real server.js process
   restart against the mock database. It is NOT a real Render
   redeploy test; that can only be performed on the live host.
   Run: node test-bip-durable.js */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 4294;
const MOCK_PORT = 4293;
const SERVICE_KEY = 'test-service-role-key-0123456789abcdef';
const INGEST_TOKEN = 'test-bip-ingest-token-123456';
const MOCK_URL = 'http://127.0.0.1:' + MOCK_PORT;

let pass = 0, fail = 0;
function ok(c, m){ if (c){ pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } }
function parse(body){ try { return JSON.parse(body); } catch (e) { return null; } }
function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

/* ---------- mock Supabase (PostgREST-shaped) ----------
   Mirrors exactly the contract documented in
   supabase/migrations/20261016090000_bip_events.sql:
   apikey + Bearer auth, rpc/bip_ingest_event with atomic dedupe,
   bip_events ordered read, bip_status read. `state.fail` toggles
   HTTP 500s to simulate a database outage. */
function createMockSupabase(){
  const rows = [];              // bip_events rows (insertion order)
  const statusRows = {};        // slot -> bip_status row
  const collections = {};       // collection -> jsonb doc (bip_collections)
  const state = { fail: false, rpcCalls: 0 };
  function authed(req){
    return req.headers.apikey === SERVICE_KEY && req.headers.authorization === 'Bearer ' + SERVICE_KEY;
  }
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      const url = new URL(req.url, 'http://mock');
      function json(code, obj){ res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }
      if (!authed(req)) return json(401, { message: 'Invalid API key' });
      if (state.fail) return json(500, { message: 'injected database failure' });
      /* ---- durable collections (document) RPCs ----
         Mirrors supabase/migrations/20261020120000_bip_collections.sql:
         load -> all collections merged, save/import -> upsert per key. */
      if (req.method === 'POST' && url.pathname === '/rest/v1/rpc/bip_load_document'){
        return json(200, Object.assign({}, collections));
      }
      if (req.method === 'POST' && url.pathname === '/rest/v1/rpc/bip_save_document'){
        let p; try { p = JSON.parse(body); } catch (e) { return json(400, { message: 'bad json' }); }
        const payload = p && p.p_collections ? p.p_collections : p;
        for (const k of Object.keys(payload || {})) collections[k] = payload[k];
        return json(200, null);
      }
      if (req.method === 'POST' && url.pathname === '/rest/v1/rpc/bip_import_document'){
        let p; try { p = JSON.parse(body); } catch (e) { return json(400, { message: 'bad json' }); }
        const payload = p && p.p_doc ? p.p_doc : p;
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return json(400, { message: 'document must be a JSON object' });
        let n = 0;
        for (const k of Object.keys(payload)){ collections[k] = payload[k]; n++; }
        return json(200, { collections: n, importedAt: new Date().toISOString() });
      }
      if (req.method === 'POST' && url.pathname === '/rest/v1/rpc/bip_ingest_event'){
        state.rpcCalls++;
        let p; try { p = JSON.parse(body); } catch (e) { return json(400, { message: 'bad json' }); }
        // SQL semantics: INSERT ... ON CONFLICT (dedupe_key) DO NOTHING.
        let stored = true;
        if (p.p_dedupe_key && rows.some(r => r.dedupe_key === p.p_dedupe_key)) stored = false;
        if (stored){
          rows.push({
            id: p.p_id, type: p.p_type, summary: p.p_summary, detail: p.p_detail,
            ref: p.p_ref, status: p.p_status, source: p.p_source, at: p.p_at,
            dedupe_key: p.p_dedupe_key || null
          });
          if (p.p_status_slot){
            statusRows[p.p_status_slot] = { slot: p.p_status_slot, state: p.p_status_state, at: p.p_status_at, ref: p.p_status_ref };
          }
        }
        return json(200, { stored, id: stored ? p.p_id : null });
      }
      if (req.method === 'GET' && url.pathname === '/rest/v1/bip_events'){
        const limit = Number(url.searchParams.get('limit')) || rows.length;
        // order=at.desc,id.desc
        const sorted = rows.slice().sort((a, b) => (a.at === b.at ? (a.id < b.id ? 1 : -1) : (a.at < b.at ? 1 : -1)));
        return json(200, sorted.slice(0, limit));
      }
      if (req.method === 'GET' && url.pathname === '/rest/v1/bip_status'){
        return json(200, Object.keys(statusRows).map(k => statusRows[k]));
      }
      return json(404, { message: 'unknown mock route ' + url.pathname });
    });
  });
  return { server, state, rows, statusRows, collections };
}

function freshDir(prefix){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return dir;
}

function reloadBip(){
  for (const mod of ['bip/db', 'bip/store', 'bip/progress', 'bip/events', 'bip/community', 'bip/admin', 'bip/util']){
    try { delete require.cache[require.resolve('./' + mod)]; } catch (e) {}
  }
  require('./bip/store').reset();
}
/* ---------- Part A: in-process unit tests (mock DB) ---------- */
async function unitTests(mock){
  console.log('--- Part A: durable unit behaviour (mock database) ---');
  process.env.BIP_DATA_DIR = freshDir('bip-durable-unit-');
  process.env.BIP_STORAGE = 'supabase';
  process.env.SUPABASE_URL = MOCK_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY;
  delete process.env.GITHUB_WEBHOOK_SECRET;
  reloadBip();
  const events = require('./bip/events');
  const db = require('./bip/db');

  ok(db.isDurableMode() === true, 'BIP_STORAGE=supabase selects durable mode');
  ok(db.isConfigured() === true, 'durable mode is configured with URL + service key');
  const int0 = events.integrationStatus();
  ok(int0.durable === true && int0.storage === 'supabase', 'integration reports durable=true, storage=supabase');
  ok(int0.live === false, 'live flag still reflects webhook/CI secrets only (honest)');

  // 1. Successful ingestion through the durable path.
  const r1 = await events.recordDevEventAsync({ type: 'tests_passed', summary: 'CI tests passed on main @ aaa1111 (run 101)', ref: 'aaa1111', dedupeKey: 'unit-101-1', source: 'ci', at: '2026-10-16T10:00:00.000Z' });
  ok(r1.ok === true && r1.event && r1.event.type === 'tests_passed', 'successful event ingestion via durable path');
  ok(mock.rows.length === 1, 'exactly one row reached the database');
  ok(mock.rows[0].dedupe_key === 'unit-101-1' && mock.rows[0].source === 'ci', 'row preserves dedupe key, source, ref, timestamp');

  // 2. Duplicate handling — atomic, same key never double-stored.
  const r2 = await events.recordDevEventAsync({ type: 'tests_passed', summary: 'CI tests passed on main @ aaa1111 (run 101)', ref: 'aaa1111', dedupeKey: 'unit-101-1', source: 'ci' });
  ok(r2.ok === true && r2.duplicate === true, 'duplicate delivery reported as duplicate');
  ok(mock.rows.length === 1, 'duplicate NOT stored again');

  // Concurrency: N racing writes with one dedupe key -> exactly 1 stored.
  const before = mock.rows.length;
  const races = await Promise.all(Array.from({ length: 6 }, () =>
    events.recordDevEventAsync({ type: 'tests_passed', summary: 'raced write', dedupeKey: 'unit-race', source: 'ci', at: '2026-10-16T10:00:01.000Z' })));
  const storedRaces = races.filter(r => r.ok && !r.duplicate).length;
  const dupRaces = races.filter(r => r.ok && r.duplicate).length;
  ok(storedRaces === 1 && dupRaces === 5, 'concurrent same-key writes: exactly 1 stored, 5 duplicates (got ' + storedRaces + '/' + dupRaces + ')');
  ok(mock.rows.length === before + 1, 'concurrency never double-stored the row');

  // 3. Invalid events are rejected BEFORE touching the database.
  const rpcBefore = mock.rpcCalls;
  const bad1 = await events.recordDevEventAsync({ type: 'deploy_running', summary: 'nope', dedupeKey: 'bad-1' });
  ok(bad1.ok === false && bad1.code === 'BAD_TYPE', 'unknown event type rejected (BAD_TYPE)');
  const bad2 = await events.recordDevEventAsync({ type: 'tests_passed', summary: '   ', dedupeKey: 'bad-2' });
  ok(bad2.ok === false && bad2.code === 'BAD_SUMMARY', 'empty summary rejected (BAD_SUMMARY)');
  ok(mock.rpcCalls === rpcBefore, 'rejected events never reached the database');

  // 4. Status board persisted with the event that produced it.
  // (The race winner overwrote the slot without a ref -> last writer
  // wins, by design; the ref round-trip is asserted over HTTP in Part B.)
  const sb = await events.readStatusBoard();
  ok(sb.tests.state === 'passed' && sb.tests.ref === null, 'status board tracks the LATEST tests event (last writer wins)');
  ok(sb.build.state === 'unknown' && sb.deploy.state === 'unknown', 'untouched slots stay honest unknown');
  const act = await events.readActivity(50);
  ok(act.length === 2, 'activity returns all stored events (got ' + act.length + ')');
  ok(act[0].summary === 'raced write', 'activity is newest-first');
  ok(act.every(e => typeof e.at === 'string' && !isNaN(Date.parse(e.at))), 'event timestamps are ISO strings');

  // 5. Milestone/progress behaviour unchanged under durable mode.
  const prog = require('./bip/progress').computeProgress();
  ok(prog.percent === 66 && prog.counts.total === 10, 'milestone progress unchanged (66%, 10 milestones)');
  // 6. Database outage: honest error, no silent fallback.
  mock.state.fail = true;
  const rFail = await events.recordDevEventAsync({ type: 'tests_passed', summary: 'during outage', dedupeKey: 'unit-outage' });
  ok(rFail.ok === false && rFail.code === 'DURABLE_STORAGE_UNAVAILABLE', 'write during outage -> DURABLE_STORAGE_UNAVAILABLE');
  let readErr = null;
  try { await events.readActivity(50); } catch (e) { readErr = e; }
  ok(readErr && readErr.code === 'DURABLE_STORAGE_UNAVAILABLE', 'read during outage throws DURABLE_STORAGE_UNAVAILABLE (never stale local data)');
  mock.state.fail = false;
  const rRec = await events.recordDevEventAsync({ type: 'tests_passed', summary: 'after recovery', dedupeKey: 'unit-recovery', at: '2026-10-16T10:00:02.000Z' });
  ok(rRec.ok === true, 'write succeeds again after outage clears');

  // 7. Missing credentials: honest unconfigured error, never ephemeral.
  const savedUrl = process.env.SUPABASE_URL;
  delete process.env.SUPABASE_URL;
  const rNoCfg = await events.recordDevEventAsync({ type: 'tests_passed', summary: 'unconfigured', dedupeKey: 'unit-nocfg' });
  ok(rNoCfg.ok === false && rNoCfg.code === 'DURABLE_STORAGE_UNAVAILABLE', 'unconfigured durable mode -> honest error');
  ok(events.integrationStatus().durable === false, 'integration reports durable=false when credentials are missing');
  process.env.SUPABASE_URL = savedUrl;

  // 7b. Invalid credentials (HTTP 401 from Supabase): honest error, never fallback.
  const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'wrong-service-key-must-not-match-mock';
  const rBadKey = await events.recordDevEventAsync({ type: 'tests_passed', summary: 'bad key', dedupeKey: 'unit-badkey' });
  ok(rBadKey.ok === false && rBadKey.code === 'DURABLE_STORAGE_UNAVAILABLE', 'invalid credentials -> DURABLE_STORAGE_UNAVAILABLE');
  process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;

  // 8. The sync JSON writer refuses to run under durable mode.
  const rSync = events.recordDevEvent({ type: 'tests_passed', summary: 'sync path', dedupeKey: 'unit-sync' });
  ok(rSync.ok === false && rSync.code === 'STORAGE_MODE_MISMATCH', 'sync JSON writer refuses durable mode (no silent ephemeral write)');

  // 9. JSON (dev) mode keeps its exact legacy behaviour.
  process.env.BIP_STORAGE = '';
  reloadBip();
  const evJson = require('./bip/events');
  const rJson = evJson.recordDevEvent({ type: 'build_passed', summary: 'CI build green', dedupeKey: 'json-1' });
  ok(rJson.ok === true, 'JSON mode: sync recordDevEvent still works');
  const jAct = await evJson.readActivity(50);
  ok(jAct.length === 1 && jAct[0].summary === 'CI build green', 'JSON mode: activity reads local store');
  const jSb = await evJson.readStatusBoard();
  ok(jSb.build.state === 'passed', 'JSON mode: status board reads local store');
  const jint = evJson.integrationStatus();
  ok(jint.durable === false && jint.storage === 'json', 'JSON mode: integration honestly reports durable=false');
}
/* ---------- shared HTTP helpers + server control ---------- */
let child = null, DATA2 = null;
const bodies = [];   // every server response body, scanned at the end for leaks

function req(port, method, p, body, headers){
  return new Promise((resolve) => {
    const opts = { host: '127.0.0.1', port, path: p, method, headers: Object.assign({ Accept: 'application/json' }, headers || {}) };
    const r = http.request(opts, (res) => {
      let buf = '';
      res.on('data', c => { buf += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    });
    r.on('error', () => resolve({ status: 0, body: '' }));
    if (body !== undefined) r.write(typeof body === 'string' ? body : JSON.stringify(body));
    r.end();
  });
}

function startServer(dataDir){
  const env = Object.assign({}, process.env, {
    PORT: String(PORT), BIP_DATA_DIR: dataDir, HOST: '127.0.0.1',
    BIP_STORAGE: 'supabase', SUPABASE_URL: MOCK_URL,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY, BIP_INGEST_TOKEN: INGEST_TOKEN
  });
  delete env.GITHUB_WEBHOOK_SECRET;
  delete env.BIP_ADMIN_TOKEN;
  return spawn(process.execPath, ['server.js'], { cwd: __dirname, env, stdio: ['ignore', 'pipe', 'pipe'] });
}

/* ---------- Part B: HTTP path (real server, mock database) ---------- */
async function httpTests(mock){
  console.log('--- Part B: HTTP path (real server.js, mock database) ---');
  DATA2 = freshDir('bip-durable-http-');
  child = startServer(DATA2);
  await wait(2500);
  const AUTH = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + INGEST_TOKEN };
  let r, j;

  r = await req(PORT, 'GET', '/api/bip/status'); bodies.push(r.body); j = parse(r.body);
  ok(r.status === 200 && j && j.tests.state === 'passed', 'durable server boots: status already served from durable storage (written in Part A)');
  ok(j && j.integration && j.integration.durable === true && j.integration.storage === 'supabase', 'API reports integration.durable=true (storage=supabase)');

  r = await req(PORT, 'POST', '/api/bip/events/ingest', { type: 'tests_passed', summary: 'x' }, { 'Content-Type': 'application/json' });
  ok(r.status === 401 && /UNAUTHORIZED/.test(r.body), 'ingest without Authorization -> 401 UNAUTHORIZED');
  r = await req(PORT, 'POST', '/api/bip/events/ingest', { type: 'tests_passed', summary: 'x' }, { 'Content-Type': 'application/json', Authorization: 'Bearer wrong-token-value' });
  ok(r.status === 401 && /UNAUTHORIZED/.test(r.body), 'ingest with WRONG token -> 401 UNAUTHORIZED');

  r = await req(PORT, 'POST', '/api/bip/events/ingest', { type: 'tests_passed', summary: 'CI tests passed on main @ bbb2222 (run 202)', ref: 'bbb2222', dedupeKey: 'http-202-1', source: 'ci' }, AUTH);
  bodies.push(r.body); j = parse(r.body);
  ok(r.status === 200 && j && j.received === true && j.stored === 1 && Array.isArray(j.errors) && j.errors.length === 0, 'valid ingest -> 200 stored=1 errors=[]');

  r = await req(PORT, 'GET', '/api/bip/activity?limit=10'); bodies.push(r.body); j = parse(r.body);
  ok(r.status === 200 && j && j.activity.some(e => e.summary === 'CI tests passed on main @ bbb2222 (run 202)'), 'activity endpoint returns the stored event');
  ok(j && j.integration && j.integration.durable === true, 'activity carries integration.durable=true');

  r = await req(PORT, 'GET', '/api/bip/status'); bodies.push(r.body); j = parse(r.body);
  ok(r.status === 200 && j && j.tests.state === 'passed' && j.tests.ref === 'bbb2222', 'status endpoint reflects tests_passed with ref');

  r = await req(PORT, 'GET', '/api/bip/summary'); bodies.push(r.body); j = parse(r.body);
  ok(r.status === 200 && j && Array.isArray(j.recentActivity) && j.recentActivity.length >= 1, 'summary recentActivity populated from durable storage');
  ok(j && j.progress && (j.progress.percent === 66) && j.milestones.length === 10, 'summary milestone progress unchanged (66%, 10 milestones)');
  ok(j && j.integration && j.integration.durable === true, 'summary reports integration.durable=true');

  r = await req(PORT, 'POST', '/api/bip/events/ingest', { type: 'tests_passed', summary: 'CI tests passed on main @ bbb2222 (run 202)', ref: 'bbb2222', dedupeKey: 'http-202-1', source: 'ci' }, AUTH);
  bodies.push(r.body); j = parse(r.body);
  ok(r.status === 200 && j && j.stored === 0 && j.duplicates === 1, 'duplicate over HTTP -> 200 stored=0 duplicates=1');

  r = await req(PORT, 'POST', '/api/bip/events/ingest', { type: 'deploy_running', summary: 'bogus', dedupeKey: 'http-bad' }, AUTH);
  bodies.push(r.body); j = parse(r.body);
  ok(r.status === 200 && j && j.stored === 0 && j.errors && j.errors[0] === 'BAD_TYPE', 'invalid type -> 200 with errors=[BAD_TYPE] (reported, never stored)');

  r = await req(PORT, 'POST', '/api/bip/webhooks/github', '{}', { 'Content-Type': 'application/json' });
  ok(r.status === 503 && /WEBHOOK_NOT_CONFIGURED/.test(r.body), 'webhook still fail-closed 503 in durable mode (unchanged)');
  r = await req(PORT, 'POST', '/api/bip/admin/milestones/core-setup/verify', { evidence: 'x' }, { 'Content-Type': 'application/json', Authorization: 'Bearer wrong' });
  ok(r.status === 503 && /ADMIN_NOT_CONFIGURED/.test(r.body), 'admin still fail-closed 503 without token (unchanged)');

  // Database outage -> honest 503s, never silent ephemeral fallback.
  mock.state.fail = true;
  r = await req(PORT, 'POST', '/api/bip/events/ingest', { type: 'tests_passed', summary: 'during outage', dedupeKey: 'http-outage' }, AUTH);
  bodies.push(r.body);
  ok(r.status === 503 && /DURABLE_STORAGE_UNAVAILABLE/.test(r.body), 'ingest during outage -> 503 DURABLE_STORAGE_UNAVAILABLE');
  r = await req(PORT, 'GET', '/api/bip/activity'); bodies.push(r.body);
  ok(r.status === 503 && /DURABLE_STORAGE_UNAVAILABLE/.test(r.body), 'activity during outage -> 503 (no stale local answer)');
  r = await req(PORT, 'GET', '/api/bip/status'); bodies.push(r.body);
  ok(r.status === 503, 'status during outage -> 503');
  r = await req(PORT, 'GET', '/api/bip/summary'); bodies.push(r.body);
  ok(r.status === 503, 'summary during outage -> 503 honest error');
  mock.state.fail = false;

  r = await req(PORT, 'POST', '/api/bip/events/ingest', { type: 'tests_passed', summary: 'CI tests passed after recovery @ ccc3333 (run 203)', ref: 'ccc3333', dedupeKey: 'http-203-1', source: 'ci' }, AUTH);
  bodies.push(r.body); j = parse(r.body);
  ok(r.status === 200 && j && j.stored === 1, 'ingest recovers after outage clears');
}

/* ---------- Part C: restart + local wipe -> durable retrieval ---------- */
async function restartTests(){
  console.log('--- Part C: process restart with WIPED local data dir ---');
  const expected = mockRowsCount();
  await new Promise(res => { child.kill(); child.on('exit', res); });
  await wait(500);
  // Simulate a Render redeploy: the local filesystem is GONE.
  try { fs.rmSync(DATA2, { recursive: true, force: true }); } catch (e) {}
  child = startServer(DATA2);
  await wait(2500);
  let r, j;
  r = await req(PORT, 'GET', '/api/bip/activity?limit=50'); bodies.push(r.body); j = parse(r.body);
  ok(r.status === 200 && j && j.activity.length === expected, 'after restart + local wipe: ALL events served from durable storage (got ' + (j ? j.activity.length : 0) + ', expected ' + expected + ')');
  r = await req(PORT, 'GET', '/api/bip/status'); bodies.push(r.body); j = parse(r.body);
  ok(r.status === 200 && j && j.tests.state === 'passed' && j.tests.ref === 'ccc3333', 'after restart + local wipe: status board intact from durable storage');
  r = await req(PORT, 'GET', '/api/bip/summary'); bodies.push(r.body); j = parse(r.body);
  ok(r.status === 200 && j && (j.progress.percent === 66) && j.recentActivity.length === expected, 'after restart: summary progress still 66% with durable activity');

  // The local JSON store must NOT mirror durable events: the read path
  // provably comes from the database, not a dual-written cache.
  //
  // In durable mode the local file is not written AT ALL (every managed
  // collection lives in Postgres), so "no local store" is the strongest
  // possible form of that guarantee. If a file happens to exist it must
  // still carry zero dev events.
  const localStorePath = path.join(DATA2, 'store.json');
  let localDevEvents = null;
  if (fs.existsSync(localStorePath)){
    let parsed = null;
    try { parsed = JSON.parse(fs.readFileSync(localStorePath, 'utf8')); } catch (e) { parsed = null; }
    localDevEvents = parsed ? parsed.devEvents : null;
  }
  ok(localDevEvents === null || (Array.isArray(localDevEvents) && localDevEvents.length === 0), 'local store holds zero dev events (reads come from durable storage)');

  // Credential leak scan over EVERY collected response body.
  const leaked = bodies.filter(b => b && b.indexOf(SERVICE_KEY) >= 0);
  ok(leaked.length === 0, 'service-role key NEVER appears in any HTTP response body');
  ok(bodies.length >= 15, 'leak scan covered ' + bodies.length + ' real response bodies');
}

let mockRef = null;
function mockRowsCount(){ return mockRef.rows.length; }


/* ---------- Part D & E & F: Community, moderation, restart & failure handling ---------- */
async function communityDurableTests(mock){
  console.log('--- Part D: Community, suggestions, votes, comments, waitlist in durable mode ---');
  await new Promise(res => { child.kill(); child.on('exit', res); });
  await wait(500);
  const DATA3 = freshDir('bip-durable-comm-');
  const ADMIN_TOKEN = 'test-durable-admin-token-xyz-123';
  const env = Object.assign({}, process.env, {
    PORT: String(PORT), BIP_DATA_DIR: DATA3, HOST: '127.0.0.1',
    BIP_STORAGE: 'supabase', SUPABASE_URL: MOCK_URL,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY, BIP_INGEST_TOKEN: INGEST_TOKEN,
    BIP_ADMIN_TOKEN: ADMIN_TOKEN
  });
  delete env.GITHUB_WEBHOOK_SECRET;
  child = spawn(process.execPath, ['server.js'], { cwd: __dirname, env, stdio: ['ignore', 'pipe', 'pipe'] });
  await wait(2500);

  let r = await req(PORT, 'POST', '/api/bip/chat', { nickname: 'Priya', text: 'Hello from durable Supabase test!' }, { 'Content-Type': 'application/json' });
  bodies.push(r.body); let j = parse(r.body);
  ok(r.status === 201 && j && j.message && j.message.text === 'Hello from durable Supabase test!', 'chat message posted via durable backend (201)');
  const msgId = j && j.message && j.message.id;

  r = await req(PORT, 'POST', '/api/bip/ideas', { title: 'Formula Derivation Sandbox', description: 'Interactive physics formula derivations with graphs.' }, { 'Content-Type': 'application/json' });
  bodies.push(r.body); j = parse(r.body);
  ok(r.status === 201 && j && j.idea && j.idea.title === 'Formula Derivation Sandbox', 'idea submitted via durable backend (201)');
  const ideaId = j && j.idea && j.idea.id;

  r = await req(PORT, 'POST', '/api/bip/ideas/' + encodeURIComponent(ideaId) + '/vote', {});
  bodies.push(r.body); j = parse(r.body);
  ok(r.status === 200 && j && j.votes === 1 && j.voted === true, 'idea vote registered and counted (votes=1)');

  r = await req(PORT, 'POST', '/api/bip/ideas/' + encodeURIComponent(ideaId) + '/comments', { nickname: 'Karthik', text: 'Crucial for kinematics derivations!' }, { 'Content-Type': 'application/json' });
  bodies.push(r.body); j = parse(r.body);
  ok(r.status === 201 && j && j.comment && j.comment.text === 'Crucial for kinematics derivations!', 'comment added to idea via durable backend (201)');
  const commentId = j && j.comment && j.comment.id;

  r = await req(PORT, 'POST', '/api/bip/waitlist', { email: 'student.priya@college.edu', consent: true }, { 'Content-Type': 'application/json' });
  bodies.push(r.body); j = parse(r.body);
  ok(r.status === 201 && j && j.position >= 1, 'waitlist joined via durable backend (position >= 1)');

  r = await req(PORT, 'POST', '/api/bip/reports', { kind: 'comment', targetId: commentId, reason: 'Test report moderation' }, { 'Content-Type': 'application/json' });
  bodies.push(r.body); j = parse(r.body);
  ok(r.status === 201 && j && (j.reportId || j.ok), 'abuse report filed via durable backend (201)');

  const ADM_AUTH = { Authorization: 'Bearer ' + ADMIN_TOKEN };
  r = await req(PORT, 'GET', '/api/bip/admin/overview', undefined, ADM_AUTH);
  bodies.push(r.body); j = parse(r.body);
  ok(r.status === 200 && j && j.counts && j.counts.ideas >= 1 && j.counts.chatMessages >= 1 && j.counts.comments >= 1, 'admin overview shows all community counts from durable backend');

  r = await req(PORT, 'PUT', '/api/bip/admin/ideas/' + encodeURIComponent(ideaId) + '/status', { status: 'in_development', adminNote: 'Sprint 3 target' }, Object.assign({ 'Content-Type': 'application/json' }, ADM_AUTH));
  bodies.push(r.body); j = parse(r.body);
  ok(r.status === 200 && j && j.idea && j.idea.status === 'in_development', 'admin updated idea status to in_development');

  r = await req(PORT, 'GET', '/api/bip/admin/waitlist/export', undefined, ADM_AUTH);
  bodies.push(r.body);
  ok(r.status === 200 && r.body.includes('student.priya@college.edu'), 'admin waitlist CSV export returns stored email');

  console.log('--- Part E: Community data survives restart with WIPED local directory ---');
  await new Promise(res => { child.kill(); child.on('exit', res); });
  await wait(500);
  try { fs.rmSync(DATA3, { recursive: true, force: true }); } catch (e) {}
  child = spawn(process.execPath, ['server.js'], { cwd: __dirname, env, stdio: ['ignore', 'pipe', 'pipe'] });
  await wait(2500);

  r = await req(PORT, 'GET', '/api/bip/chat?limit=50'); bodies.push(r.body); j = parse(r.body);
  ok(r.status === 200 && j && j.messages.some(m => m.id === msgId && m.text === 'Hello from durable Supabase test!'), 'chat message survived restart and wiped local directory');

  r = await req(PORT, 'GET', '/api/bip/ideas?sort=new'); bodies.push(r.body); j = parse(r.body);
  const foundIdea = j && j.ideas && j.ideas.find(i => i.id === ideaId);
  ok(foundIdea && foundIdea.status === 'in_development' && foundIdea.votes === 1, 'idea survived restart with in_development status and 1 vote intact');

  r = await req(PORT, 'GET', '/api/bip/ideas/' + encodeURIComponent(ideaId) + '/comments'); bodies.push(r.body); j = parse(r.body);
  ok(j && j.comments && j.comments.some(c => c.id === commentId), 'idea comment survived restart and wiped local directory');

  r = await req(PORT, 'GET', '/api/bip/waitlist/count'); bodies.push(r.body); j = parse(r.body);
  ok(r.status === 200 && j && j.count >= 1, 'waitlist count survived restart and wiped local directory');

  r = await req(PORT, 'GET', '/api/bip/admin/reports', undefined, ADM_AUTH); bodies.push(r.body); j = parse(r.body);
  ok(r.status === 200 && j && j.reports && j.reports.some(rep => rep.targetId === commentId), 'abuse report survived restart and wiped local directory');

  console.log('--- Part F: Storage outage during community mutation ---');
  mock.state.fail = true;
  r = await req(PORT, 'POST', '/api/bip/ideas', { title: 'Outage Temporary Idea', description: 'Should fail honestly during outage' }, { 'Content-Type': 'application/json' });
  bodies.push(r.body);
  ok(r.status === 503 && /DURABLE_STORAGE_UNAVAILABLE/.test(r.body), 'idea submission during outage -> 503 DURABLE_STORAGE_UNAVAILABLE');
  mock.state.fail = false;

  r = await req(PORT, 'GET', '/api/bip/ideas?sort=new'); bodies.push(r.body); j = parse(r.body);
  const phantom = j && j.ideas && j.ideas.find(i => i.title === 'Outage Temporary Idea');
  ok(!phantom, 'failed mutation was rolled back and not served (no split-brain or phantom records)');

  console.log('--- Part G: Repeatable CLI migration (bip/migrate.js) ---');
  const migrateMod = require('./bip/migrate');
  ok(typeof migrateMod.mergeCollection === 'function', 'bip/migrate exposes mergeCollection helper');
  const sampleIdeas = [{ id: 'idea_1', title: 'Idea 1', votes: 2 }];
  const mergedOnce = migrateMod.mergeCollection('ideas', [], sampleIdeas);
  ok(mergedOnce.length === 1 && mergedOnce[0].id === 'idea_1', 'migrate: initial merge populates records');
  const mergedTwice = migrateMod.mergeCollection('ideas', mergedOnce, sampleIdeas);
  ok(mergedTwice.length === 1, 'migrate: repeated merge creates zero duplicate records (idempotent)');
  const sampleWl = [{ id: 'wl_1', emailHash: 'hash1', email: 'a@b.com' }];
  const wlTwice = migrateMod.mergeCollection('waitlist', sampleWl, sampleWl);
  ok(wlTwice.length === 1, 'migrate: waitlist repeated merge creates zero duplicates');
}

/* ---------- runner ---------- */
(async () => {
  const mock = createMockSupabase();
  mockRef = mock;
  await new Promise(res => mock.server.listen(MOCK_PORT, '127.0.0.1', res));
  try {
    await unitTests(mock);
    await httpTests(mock);
    await restartTests();
    await communityDurableTests(mock);
  } catch (e) {
    fail++;
    console.log('  FAIL suite error: ' + (e && e.message));
  }
  if (child) { try { child.kill(); } catch (e) {} }
  await new Promise(res => { try { mock.server.close(res); } catch (e) { res(); } });
  const dirs = [];
  try { fs.readdirSync(os.tmpdir()).filter(f => /^bip-durable-/.test(f)).forEach(f => dirs.push(path.join(os.tmpdir(), f))); } catch (e) {}
  for (const d of dirs){ try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} }
  console.log('DURABLE: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();

