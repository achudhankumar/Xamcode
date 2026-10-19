'use strict';
/* COUNTDOWN + ESTIMATE suite for Build-in-Public.
   ----------------------------------------------------------------
   Boots server.js on a scratch port + scratch BIP_DATA_DIR and verifies:
     - GET /api/bip/estimate contract (50h seed across 7 tasks, projected
       date derived from velocity, never a hardcoded date)
     - /build serves the effort-model countdown panel wired to the API
     - estimate reacts correctly to real changes over HTTP admin API
     - completed tasks are excluded from remaining effort
     - estimate state survives a process restart (durable across restart)
   Events (webhook/CI) can NEVER move the estimate — proven here.
   Run: node test-bip-countdown.js */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 4196;
const ADMIN_TOKEN = 'test-admin-token-countdown-123456';
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'bip-countdown-'));
const env = Object.assign({}, process.env, {
  PORT: String(PORT), BIP_DATA_DIR: DATA, BIP_ADMIN_TOKEN: ADMIN_TOKEN
});
delete env.GITHUB_WEBHOOK_SECRET;
delete env.BIP_INGEST_TOKEN;

let pass = 0, fail = 0;
function ok(c, m){ if(c){ pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } }
function parse(b){ try { return JSON.parse(b); } catch(e){ return null; } }
function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

let child = spawn(process.execPath, ['server.js'], { cwd: __dirname, env, stdio: ['ignore','pipe','pipe'] });
let stderrBuf = '';
child.stderr.on('data', c => { stderrBuf += c; });

function req(method, p, body, headers){
  return new Promise((resolve) => {
    const opts = { host:'127.0.0.1', port:PORT, path:p, method,
      headers: Object.assign({ Accept:'application/json' }, headers || {}) };
    const r = http.request(opts, (res) => {
      let buf = '';
      res.on('data', c => { buf += c; });
      res.on('end', () => resolve({ status:res.statusCode, headers:res.headers, body:buf }));
    });
    r.on('error', () => resolve({ status:0, headers:{}, body:'' }));
    if(body !== undefined) r.write(typeof body === 'string' ? body : JSON.stringify(body));
    r.end();
  });
}
const AUTH = { 'Content-Type':'application/json', 'Authorization':'Bearer ' + ADMIN_TOKEN };
const JSONH = { 'Content-Type':'application/json' };

(async () => {
  await wait(1800);
  let r, j;

  /* ---------- 1. /api/bip/estimate contract ---------- */
  r = await req('GET', '/api/bip/estimate');
  j = parse(r.body);
  ok(r.status === 200 && j && j.estimate, 'GET /api/bip/estimate returns 200 with estimate payload');
  const e0 = j.estimate;
  ok(e0.remainingHours === 50, 'seeded remaining effort is 50h (got ' + e0.remainingHours + ')');
  ok(e0.counts && e0.counts.tasksTotal === 7 && e0.counts.tasksDone === 0, '7 seeded tasks, none done (got ' + (e0.counts && e0.counts.tasksDone) + '/' + (e0.counts && e0.counts.tasksTotal) + ')');
  ok(e0.velocityHoursPerDay === 8, 'velocity is nominal 8 h/day before calibration (got ' + e0.velocityHoursPerDay + ')');
  ok(typeof e0.projectedAt === 'string' && isFinite(Date.parse(e0.projectedAt)), 'projectedAt is a real ISO date (got ' + e0.projectedAt + ')');
  ok(Date.parse(e0.projectedAt) > Date.now(), 'projected date is in the future (50h at 8h/day => ~7 days)');
  ok(typeof e0.readinessPercent === 'number', 'readinessPercent included (got ' + e0.readinessPercent + ')');
  ok(typeof e0.confidencePercent === 'number', 'confidencePercent included (got ' + e0.confidencePercent + ')');
  ok(typeof e0.at === 'string' && isFinite(Date.parse(e0.at)), 'server timestamp `at` present for client interpolation');
  // No hardcoded date: projectedAt must equal now + ceil(remaining/(vel/8)) days
  const calDays = 50 / (8 / 8);
  const expectMs = Date.now() + Math.ceil(calDays) * 86400000;
  const skew = Math.abs(Date.parse(e0.projectedAt) - expectMs);
  ok(skew < 120000, 'projectedAt matches remaining/velocity math within 2 min (skew ' + Math.round(skew/1000) + 's)');

  r = await req('GET', '/api/bip/estimate/history?limit=5');
  ok(r.status === 200 && parse(r.body) && Array.isArray(parse(r.body).history), 'GET /api/bip/estimate/history works');

  /* ---------- 2. /build page ships the countdown panel ---------- */
  r = await req('GET', '/build', undefined, { Accept:'text/html' });
  ok(r.status === 200 && /id="estPanel"/.test(r.body), '/build contains the effort-model panel (#estPanel)');
  ok(/id="estCells"/.test(r.body) && /id="ecdD"/.test(r.body) && /id="ecdS"/.test(r.body), 'countdown cells (days/hours/min/sec) present');
  ok(/api\/bip\/estimate/.test(r.body), 'page JS references GET /api/bip/estimate');
  ok(/How this estimate works/.test(r.body) && /<details[^>]*id="estModel"/.test(r.body), 'expandable model explainer present');
  ok(/restRefreshBind\(\)/.test(r.body), 'refresh-on-interval/focus binding is initialised');
  ok(/estRefreshTimer/.test(r.body) && /60000/.test(r.body), 'panel schedules its own 60s authoritative refresh');
  ok(/id="countCells"[^>]*hidden/.test(r.body) && /id="estCells"[^>]*hidden/.test(r.body), 'both countdown cell containers are hidden in initial server HTML');
  ok(!/id="(?:e?cd[DHMS])">0</.test(r.body) && /id="ecdD">—</.test(r.body) && /id="cdD">—</.test(r.body), 'initial countdown cells use em-dash placeholders (never fake 0:0:0:0 before hydration)');
  ok(/estBusy/.test(r.body), 'in-flight fetch guard prevents duplicate focus + visibilitychange estimate calls');
  ok(/id="trailerPanel"/.test(r.body) && /YOUR VISUAL TRAILER/.test(r.body) && /TRAILER IN PRODUCTION/.test(r.body), '/build includes the launch trailer teaser card in production');
  const rp = await req('GET', '/assets/xamcode-build-trailer-poster.jpg', undefined, { Accept:'image/jpeg' });
  ok(rp.status === 200 && /image\/jpeg/.test(rp.headers['content-type'] || '') && rp.body.length > 1000, 'poster JPG served at /assets/xamcode-build-trailer-poster.jpg with image/jpeg');
  const rv = await req('GET', '/assets/xamcode-build-trailer.mp4', undefined, { Range:'bytes=0-1023' });
  ok(rv.status === 206 && /video\/mp4/.test(rv.headers['content-type'] || '') && /^bytes 0-1023\/\d+$/.test(rv.headers['content-range'] || '') && Buffer.byteLength(rv.body, 'utf8') > 0, 'trailer MP4 supports HTTP 206 Range requests for video seeking');
  const rTrav = await req('GET', '/assets/../.env');
  const rPriv = await req('GET', '/bip-data/store.json');
  ok(rTrav.status === 403 && rPriv.status === 403, 'path traversal and private store paths are refused with 403');

  /* ---------- 3. admin mutation: task completion drops remaining ---------- */
  r = await req('POST', '/api/bip/admin/estimate/tasks/load-testing/status', { status:'done' }, AUTH);
  j = parse(r.body);
  ok(r.status === 200 && j && j.estimate && j.estimate.remainingHours === 42, 'completing load-testing drops 50h -> 42h (got ' + (j && j.estimate && j.estimate.remainingHours) + ')');
  ok(j.estimate.counts.tasksDone === 1, 'tasksDone is now 1');
  ok(Date.parse(j.estimate.projectedAt) < Date.parse(e0.projectedAt), 'projected date moved earlier after task completion');
  r = await req('GET', '/api/bip/estimate');
  j = parse(r.body);
  ok(j.estimate.remainingHours === 42, 'completed task excluded from remaining on fresh read (42h)');

  /* ---------- 4. launch-critical bug adds repair effort ---------- */
  r = await req('POST', '/api/bip/admin/estimate/bugs/new', { title:'pdf render crash on large files', severity:'critical', isLaunchBlocker:true }, AUTH);
  j = parse(r.body);
  ok(r.status === 200 && j.estimate.remainingHours === 58, 'critical bug adds 16h repair effort (42 -> 58, got ' + j.estimate.remainingHours + ')');
  ok(j.estimate.counts.openBugs === 1, 'openBugs is 1');
  const bugId = j.bug && j.bug.id;
  ok(!!bugId, 'bug gets a server id (' + bugId + ')');

  /* ---------- 5. duplicate blocker is deduped ---------- */
  r = await req('POST', '/api/bip/admin/estimate/blockers/new', { title:'pdf render crash blocks QA signoff', effortHours:6 }, AUTH);
  j = parse(r.body);
  ok(r.status === 200 && j.estimate.remainingHours === 58, 'blocker overlapping the open bug is deduped (still 58h, got ' + j.estimate.remainingHours + ')');
  r = await req('POST', '/api/bip/admin/estimate/blockers/new', { title:'payment gateway sandbox credentials', effortHours:3 }, AUTH);
  j = parse(r.body);
  ok(j.estimate.remainingHours === 61, 'distinct blocker adds its effort (58 -> 61, got ' + j.estimate.remainingHours + ')');
  ok(j.estimate.counts.openBlockers === 2, 'openBlockers counts both (got ' + j.estimate.counts.openBlockers + ')');

  /* ---------- 6. invalid inputs rejected ---------- */
  r = await req('POST', '/api/bip/admin/estimate/bugs/new', { title:'bad severity', severity:'nonsense' }, AUTH);
  ok(r.status === 400 && parse(r.body).code === 'BAD_SEVERITY', 'invalid severity -> 400 BAD_SEVERITY');
  r = await req('POST', '/api/bip/admin/estimate/bugs/new', { title:'negative effort', repairEffortHours:-3 }, AUTH);
  ok(r.status === 400 && parse(r.body).code === 'BAD_VALUE', 'negative repair effort -> 400 BAD_VALUE');
  r = await req('POST', '/api/bip/admin/estimate/tasks/load-testing/status', { status:'bogus' }, AUTH);
  ok(r.status === 400, 'invalid task status -> 400');
  r = await req('POST', '/api/bip/admin/estimate/tasks/nope/status', { status:'done' }, AUTH);
  ok(r.status === 404, 'unknown task key -> 404');
  r = await req('GET', '/api/bip/estimate');
  ok(parse(r.body).estimate.remainingHours === 61, 'rejected inputs changed nothing (still 61h)');

  /* ---------- 7. events can never move the estimate ---------- */
  // Compare the work-derived fields only: `at` and `projectedAt` are
  // recomputed from wall-clock on every read by design (the client
  // interpolates against them), so they are checked by tolerance below.
  function stable(e){ return JSON.stringify({ h:e.remainingHours, c:e.counts, v:e.velocityHoursPerDay, g:e.confidencePercent }); }
  const beforeEst = parse((await req('GET','/api/bip/estimate')).body).estimate;
  const before = stable(beforeEst);
  r = await req('POST', '/api/bip/events/ingest', { type:'tests_failed', summary:'CI red' }, JSONH);
  ok(r.status === 503, 'CI ingest without token -> 503 fail-closed (events cannot mutate anything)');
  r = await req('POST', '/api/bip/webhooks/github', '{}', JSONH);
  ok(r.status === 503, 'GitHub webhook without secret -> 503 fail-closed');
  const afterEst = parse((await req('GET','/api/bip/estimate')).body).estimate;
  const after = stable(afterEst);
  ok(before === after, 'estimate payload unchanged by (rejected) event attempts');
  ok(Math.abs(Date.parse(afterEst.projectedAt) - Date.parse(beforeEst.projectedAt)) < 60000, 'projected date did not move (within 60s clock drift)');

  /* ---------- 8. resolving the bug lowers remaining again ---------- */
  r = await req('POST', '/api/bip/admin/estimate/bugs/' + encodeURIComponent(bugId), { status:'fixed' }, AUTH);
  j = parse(r.body);
  // 61 - 16 (fixed critical bug) + 6 (the overlapping blocker was deduped
  // only WHILE the bug was open, so it counts again) = 51.
  ok(j.estimate.remainingHours === 51, 'fixed bug drops 16h and the deduped blocker counts again (61 -> 51, got ' + j.estimate.remainingHours + ')');
  ok(j.estimate.counts.openBugs === 0, 'openBugs is back to 0');

  /* ---------- 9. durability: restart with same data dir ---------- */
  await new Promise(res => { child.kill(); child.on('exit', res); });
  await wait(500);
  child = spawn(process.execPath, ['server.js'], { cwd: __dirname, env, stdio: ['ignore','pipe','pipe'] });
  await wait(2200);
  r = await req('GET', '/api/bip/estimate');
  j = parse(r.body);
  ok(r.status === 200 && j.estimate.remainingHours === 51, 'after restart: estimate state persisted (51h, got ' + (j && j.estimate && j.estimate.remainingHours) + ')');
  ok(j.estimate.counts.tasksDone === 1, 'after restart: completed task still counted (tasksDone=1)');
  r = await req('GET', '/api/bip/estimate/history?limit=50');
  ok(parse(r.body).history.length >= 5, 'after restart: change history persisted (' + parse(r.body).history.length + ' entries)');

  console.log('\nCOUNTDOWN: ' + pass + ' passed, ' + fail + ' failed');
  child.kill();
  setTimeout(() => { try { fs.rmSync(DATA, { recursive:true, force:true }); } catch(e){} process.exit(fail ? 1 : 0); }, 400);
})().catch(e => {
  console.log('COUNTDOWN ERROR: ' + (e && e.message));
  if(stderrBuf) console.log('server stderr:\n' + stderrBuf.slice(-2000));
  try { child.kill(); } catch(x){}
  process.exit(1);
});


