'use strict';
/* ============================================================
   BIP ROUTES — HTTP dispatcher for the Build-in-Public platform.
   ----------------------------------------------------------------
   Mounted from server.js with two lines (require + one dispatch
   call before the /api/ 404). Returns true when it handled the
   request, false to let the study app serve as before.

   Route map (all JSON unless noted):
     GET  /build                        -> build.html (public site)
     GET  /api/bip/summary              -> one-call homepage payload
     GET  /api/bip/progress             -> weighted progress + milestones
     GET  /api/bip/roadmap              -> official roadmap items
     GET  /api/bip/activity?limit=      -> latest dev events + integration
     GET  /api/bip/status               -> build / tests / deploy board
     GET  /api/bip/stream               -> SSE live updates (text/event-stream)
     GET  /api/bip/chat?limit=&after=   -> public messages
     POST /api/bip/chat                 -> post a message (rate limited)
     GET  /api/bip/ideas?sort=top|new   -> ideas board
     POST /api/bip/ideas                -> submit idea (rate limited)
     GET  /api/bip/ideas/:id            -> idea + comments
     POST /api/bip/ideas/:id/vote       -> toggle vote (1 per visitor)
     GET  /api/bip/ideas/:id/comments   -> comments
     POST /api/bip/ideas/:id/comments   -> comment (rate limited)
     POST /api/bip/reports              -> report abuse (rate limited)
      GET  /api/bip/estimate             -> deterministic effort estimate (public)
      GET  /api/bip/estimate/history    -> estimate change history (public)
     GET  /api/bip/launch               -> readiness + countdown
     GET  /api/bip/waitlist/count       -> count only (never emails)
     POST /api/bip/waitlist             -> join (rate limited, consent)
     POST /api/bip/webhooks/github      -> HMAC-verified GitHub delivery
     POST /api/bip/events/ingest        -> CI bearer-token ingest
   Admin (BIP_ADMIN_TOKEN Bearer required, else 401/503):
     POST /api/bip/admin/milestones/:id/verify|reopen|status|criteria
     PUT  /api/bip/admin/launch
     PUT  /api/bip/admin/roadmap/:key
     PUT  /api/bip/admin/ideas/:id/status
     GET  /api/bip/admin/reports
     POST /api/bip/admin/reports/:id/resolve
     DELETE /api/bip/admin/chat/:id
     GET  /api/bip/admin/waitlist/export   -> CSV download
   ============================================================ */
const fs = require('node:fs');
const path = require('node:path');
const store = require('./store');
const progress = require('./progress');
const events = require('./events');
const community = require('./community');
const admin = require('./admin');
const estimate = require('./estimate');
const {
  sendJson, readJson, readRawBody, clientIp,
  getOrCreateVisitor, createRateLimiter, bearerMatches,
  newNonce, cspForPage, applySecurityHeaders
} = require('./util');

/* Per-IP sliding windows. Anonymous posting stays open because
   these gates + length caps + moderation make abuse expensive. */
const rlChat = createRateLimiter({ windowMs: 60000, max: 5 });
const rlIdea = createRateLimiter({ windowMs: 60000, max: 3 });
const rlComment = createRateLimiter({ windowMs: 60000, max: 5 });
const rlVote = createRateLimiter({ windowMs: 60000, max: 20 });
const rlReport = createRateLimiter({ windowMs: 60000, max: 5 });
const rlWaitlist = createRateLimiter({ windowMs: 60000, max: 5 });

function denied(res, limiter, key, requestId){
  if (!limiter.allow(key)){
    sendJson(res, 429, { error: 'Too many requests. Please wait a minute and try again.', code: 'RATE_LIMITED', requestId }, requestId);
    return true;
  }
  return false;
}

/* Durable-storage read/write failure: an honest 503. Never serves
   stale or empty local data as if it were live, and never falls back
   to the ephemeral JSON store when supabase mode is selected. */
function durableUnavailable(res, requestId, detail){
  sendJson(res, 503, {
    error: 'Durable Build-in-Public storage is unavailable. Nothing was read or stored.',
    code: 'DURABLE_STORAGE_UNAVAILABLE',
    received: true,
    stored: 0,
    detail: detail || undefined,
    requestId
  }, requestId);
  return true;
}

async function readJsonBody(req){
  try{
    return await readJson(req, 64 * 1024);
  }catch(e){
    return { __bodyError: (e && e.message) || 'The request body was unreadable.' };
  }
}

/* ---------- durable write verification ----------
   In durable mode a handler answers 200 as soon as it has mutated the
   in-memory document; the database write happens right after. If that
   write fails the client must NOT be told the write succeeded.
   To keep every existing handler synchronous and unchanged, the
   response is CAPTURED instead of being sent, the durable write is
   flushed, and only then are the bytes released:
     - write landed  -> the captured response is sent unchanged
     - write failed  -> an honest 503 replaces it
   Handlers that never persist (GETs) are unaffected apart from the
   extra flush, which is a no-op when nothing is dirty. */
function captureResponse(res){
  const cap = { status: 200, headers: {}, body: null, ended: false, durable: false };
  const origSetHeader = res.setHeader;
  const origWriteHead = res.writeHead;
  const origEnd = res.end;
  res.setHeader = function(name, value){ cap.headers[name] = value; return res; };
  res.writeHead = function(status, headers){
    cap.status = status;
    if (headers) for (const k of Object.keys(headers)) cap.headers[k] = headers[k];
    return res;
  };
  res.end = function(chunk, enc, cb){ cap.body = chunk; cap.ended = true; return res; };
  const handle = {
    cap,
    restore(){
      res.setHeader = origSetHeader;
      res.writeHead = origWriteHead;
      res.end = origEnd;
    }
  };
  /* A handler that already wrote straight to the database (e.g. the
     durable import) marks itself durable, so a later flush failure is
     not reported as "not stored". */
  res.__bipCapture = handle;
  return handle;
}

async function finishCaptured(res, requestId, captured, method){
  const cap = captured.cap;
  captured.restore();
  if (!cap.ended) return;
  let ok = true;
  let detail;
  try{
    const flushed = await store.flush();
    ok = !!flushed.ok;
    detail = flushed.error && flushed.error.message;
  }catch(e){
    ok = false;
    detail = e && e.message;
  }
  /* Only a MUTATION can be "not stored". A read that happens to run
     while the database is down must not be reported as a failed
     write; the read itself is served from the last known state. */
  const isMutation = method && method !== 'GET' && method !== 'HEAD';
  if (!ok && isMutation && !cap.durable && cap.status < 400){
    /* The change was NOT stored. Say so instead of pretending. */
    const body = JSON.stringify({
      error: 'Durable Build-in-Public storage is unavailable. The change was not stored.',
      code: 'DURABLE_STORAGE_UNAVAILABLE',
      stored: false,
      detail: detail || undefined,
      requestId
    });
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    if (requestId) res.setHeader('X-Request-Id', requestId);
    res.writeHead(503);
    res.end(body);
    return;
  }
  for (const k of Object.keys(cap.headers)) res.setHeader(k, cap.headers[k]);
  res.writeHead(cap.status);
  res.end(cap.body);
}

function serveBuildPage(req, res, requestId){
  const file = path.join(__dirname, '..', 'build.html');
  fs.readFile(file, (e, data) => {
    if (e){
      sendJson(res, 500, { error: 'The public build page is not deployed yet.', code: 'BUILD_PAGE_MISSING', requestId }, requestId);
      return;
    }
    // Per-request nonce: the single inline <script> is authorized by
    // nonce (no unsafe-inline/unsafe-eval). Injected at serve time so
    // the nonce can never be predicted or reused across responses.
    const nonce = newNonce();
    let html = data.toString('utf8');
    html = html.replace(/<script>/, '<script nonce="' + nonce + '">');
    if (!res.headersSent){
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      if (requestId) res.setHeader('X-Request-Id', requestId);
      applySecurityHeaders(res, { csp: cspForPage(nonce) });
    }
    res.writeHead(200);
    res.end(html);
  });
}

/* One-call homepage payload: progress, launch, status, roadmap,
   recent activity, ideas top-5 and counts — no secrets attached.
   Async because status/activity reads may hit durable storage. */
async function publicSummary(){
  progress.ensureSeeded();
  const d = store.ensureLoaded();
  const p = progress.computeProgress();
  const est = estimate.computeEstimate();
  const targetMs = (d.settings && d.settings.telemetry && d.settings.telemetry.targetTimestamp)
    || est.targetMs || (est.projectedAt ? Date.parse(est.projectedAt) : (Date.now() + 50 * 3600 * 1000));
  return {
    progress: p,
    milestones: d.milestones,
    launch: admin.publicLaunch(),
    status: await events.readStatusBoard(),
    integration: events.integrationStatus(),
    roadmap: d.roadmapItems,
    recentActivity: await events.readActivity(10),
    ideas: community.listIdeas({ sort: 'top' }).ideas.slice(0, 5),
    counts: {
      waitlist: community.waitlistCount(),
      ideas: d.ideas.length,
      chatMessages: d.chatMessages.filter(m => !m.deleted).length,
      openReports: d.reports.filter(r => r.status === 'open').length
    },
    estimate: est,
    targetTimestamp: targetMs,
    targetMs: targetMs,
    telemetry: (d.settings && d.settings.telemetry) || {
      percent: p.percent,
      remainingEffortHours: est.remainingHours,
      targetTimestamp: targetMs,
      status: 'active'
    }
  };
}

async function handleBipApi(req, res, p, url, requestId){
  const visitorId = getOrCreateVisitor(req, res);
  const ip = clientIp(req);

  /* ---------- public reads ---------- */
  if (req.method === 'GET' && p === '/api/bip/summary'){
    try{
      return sendJson(res, 200, Object.assign({ requestId }, await publicSummary()), requestId);
    }catch(e){ return durableUnavailable(res, requestId, e && e.message); }
  }
  if (req.method === 'GET' && p === '/api/bip/progress'){
    progress.ensureSeeded();
    const d = store.ensureLoaded();
    return sendJson(res, 200, { progress: progress.computeProgress(), milestones: d.milestones, requestId }, requestId);
  }
  if (req.method === 'GET' && p === '/api/bip/roadmap'){
    progress.ensureSeeded();
    return sendJson(res, 200, { roadmap: store.ensureLoaded().roadmapItems, requestId }, requestId);
  }
  if (req.method === 'GET' && p === '/api/bip/activity'){
    const limit = Number(url.searchParams.get('limit')) || 20;
    try{
      return sendJson(res, 200, { activity: await events.readActivity(limit), integration: events.integrationStatus(), requestId }, requestId);
    }catch(e){ return durableUnavailable(res, requestId, e && e.message); }
  }
  if (req.method === 'GET' && p === '/api/bip/status'){
    try{
      return sendJson(res, 200, Object.assign({ requestId }, await events.readStatusBoard()), requestId);
    }catch(e){ return durableUnavailable(res, requestId, e && e.message); }
  }
  if (req.method === 'GET' && p === '/api/bip/stream'){
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.write(': connected\n\n');
    events.subscribe(res);
    const hb = setInterval(() => { try{ res.write(': ping\n\n'); }catch{} }, 25000);
    req.on('close', () => { clearInterval(hb); events.unsubscribe(res); });
    return true;
  }
  if (req.method === 'GET' && p === '/api/bip/chat'){
    const out = community.listMessages({ limit: url.searchParams.get('limit'), after: url.searchParams.get('after') });
    return sendJson(res, 200, Object.assign({ requestId }, out), requestId);
  }
  if (req.method === 'GET' && p === '/api/bip/ideas'){
    const out = community.listIdeas({ sort: url.searchParams.get('sort'), visitorId });
    return sendJson(res, 200, Object.assign({ requestId }, out), requestId);
  }
  if (req.method === 'GET' && p === '/api/bip/launch'){
    return sendJson(res, 200, Object.assign({ requestId }, admin.publicLaunch()), requestId);
  }
  if (req.method === 'GET' && p === '/api/bip/estimate'){
    return sendJson(res, 200, Object.assign({ requestId, estimate: estimate.computeEstimate() }), requestId);
  }
  if (req.method === 'GET' && p === '/api/bip/estimate/history'){
    const limit = url.searchParams ? Number(url.searchParams.get('limit')) : NaN;
    return sendJson(res, 200, { history: estimate.history(Number.isFinite(limit) ? limit : 50), requestId }, requestId);
  }
  if (req.method === 'GET' && p === '/api/bip/waitlist/count'){
    return sendJson(res, 200, { count: community.waitlistCount(), requestId }, requestId);
  }
  return null;   // not a simple GET — caller continues to POST/parametric routes
}

async function handleBipPosts(req, res, p, url, requestId){
  const visitorId = getOrCreateVisitor(req, res);
  const ip = clientIp(req);

  if (req.method === 'POST' && p === '/api/bip/events'){
    const token = process.env.BIP_INGEST_TOKEN;
    if (token && req.headers['authorization']){
      const gate = bearerMatches(req, token);
      if (!gate.ok) return sendJson(res, 401, { error: 'CI ingest authorization required.', code: 'UNAUTHORIZED', requestId }, requestId);
    }
    const body = await readJsonBody(req);
    if (body.__bodyError) return sendJson(res, 400, { error: body.__bodyError, code: 'BAD_JSON', requestId }, requestId);

    const sha = body.sha || (body.ref ? String(body.ref).slice(0, 7) : '');
    const message = body.message || body.summary || '';
    const status = (body.status === 'passed' || body.status === 'success') ? 'passed' : 'failed';
    const passed = Number(body.passed) || 0;
    const failed = Number(body.failed) || 0;

    const tel = progress.recalculateTelemetry({
      sha,
      message,
      status,
      passed,
      failed,
      bonusPercent: body.bonusPercent,
      effortCutHours: body.effortCutHours,
      at: body.at || new Date().toISOString()
    });

    const shortSha = sha ? String(sha).slice(0, 7) : 'head';
    const eventType = status === 'passed' ? 'tests_passed' : 'tests_failed';
    const bAmt = (typeof body.bonusPercent === 'number' && !isNaN(body.bonusPercent)) ? body.bonusPercent : 2;
    const eAmt = (typeof body.effortCutHours === 'number' && !isNaN(body.effortCutHours)) ? body.effortCutHours : 4;
    const deltaBadge = status === 'passed' ? ('+' + bAmt + '% readiness, -' + eAmt + 'h effort') : '-4% readiness, +12h delay';
    const eventSummary = status === 'passed'
      ? 'CI verified commit @ ' + shortSha + (message ? ': ' + message.slice(0, 60) : '') + ' [' + deltaBadge + ']'
      : 'CI tests failed on commit @ ' + shortSha + ' [' + deltaBadge + ']';

    await events.recordDevEventAsync({
      type: eventType,
      summary: eventSummary,
      detail: 'branch: ' + (body.branch || 'main') + ', commit: ' + shortSha + ', passed: ' + passed + ', failed: ' + failed + ', delta: ' + deltaBadge,
      ref: shortSha,
      status: status,
      source: 'ci',
      dedupeKey: 'ci-event-' + shortSha + '-' + Date.now()
    });

    const summary = await publicSummary();
    return sendJson(res, 200, Object.assign({ ok: true, telemetry: tel, requestId }, summary), requestId);
  }

  if (req.method === 'POST' && p === '/api/bip/chat'){
    if (denied(res, rlChat, ip, requestId)) return true;
    const body = await readJsonBody(req);
    if (body.__bodyError) return sendJson(res, 400, { error: body.__bodyError, code: 'BAD_JSON', requestId }, requestId);
    const r = community.postMessage({ text: body.text, nickname: body.nickname, visitorId });
    if (!r.ok) return sendJson(res, 400, { error: r.error, code: r.code, requestId }, requestId);
    return sendJson(res, 201, { message: r.message, requestId }, requestId);
  }
  if (req.method === 'POST' && p === '/api/bip/ideas'){
    if (denied(res, rlIdea, ip + '|idea', requestId)) return true;
    const body = await readJsonBody(req);
    if (body.__bodyError) return sendJson(res, 400, { error: body.__bodyError, code: 'BAD_JSON', requestId }, requestId);
    const r = community.submitIdea({ title: body.title, description: body.description, visitorId });
    if (!r.ok) return sendJson(res, 400, { error: r.error, code: r.code, requestId }, requestId);
    return sendJson(res, 201, { idea: r.idea, requestId }, requestId);
  }
  if (req.method === 'POST' && p === '/api/bip/reports'){
    if (denied(res, rlReport, ip + '|report', requestId)) return true;
    const body = await readJsonBody(req);
    if (body.__bodyError) return sendJson(res, 400, { error: body.__bodyError, code: 'BAD_JSON', requestId }, requestId);
    const r = community.reportContent(body.kind, body.targetId, { reason: body.reason, visitorId, kind: body.kind });
    if (!r.ok) return sendJson(res, 400, { error: r.error, code: r.code, requestId }, requestId);
    return sendJson(res, 201, { reportId: r.reportId, requestId }, requestId);
  }
  if (req.method === 'POST' && p === '/api/bip/waitlist'){
    if (denied(res, rlWaitlist, ip + '|waitlist', requestId)) return true;
    const body = await readJsonBody(req);
    if (body.__bodyError) return sendJson(res, 400, { error: body.__bodyError, code: 'BAD_JSON', requestId }, requestId);
    const r = community.joinWaitlist({ email: body.email, nickname: body.nickname, consent: body.consent });
    if (!r.ok) return sendJson(res, 400, { error: r.error, code: r.code, requestId }, requestId);
    return sendJson(res, r.duplicate ? 200 : 201, { position: r.position, duplicate: !!r.duplicate, requestId }, requestId);
  }
  /* Parametric idea routes: /api/bip/ideas/:id[/vote|/comments] */
  if (p.startsWith('/api/bip/ideas/')){
    const rest = p.slice('/api/bip/ideas/'.length);
    const slash = rest.indexOf('/');
    const ideaId = slash < 0 ? rest : rest.slice(0, slash);
    const tail = slash < 0 ? '' : rest.slice(slash);
    if (req.method === 'GET' && tail === ''){
      const d = store.ensureLoaded();
      const idea = d.ideas.find(i => i.id === ideaId);
      if (!idea) return sendJson(res, 404, { error: 'Unknown idea.', code: 'NOT_FOUND', requestId }, requestId);
      return sendJson(res, 200, { idea: community.publicIdea(idea, visitorId), requestId }, requestId);
    }
    if (req.method === 'POST' && tail === '/vote'){
      if (denied(res, rlVote, visitorId + '|vote', requestId)) return true;
      const r = community.voteIdea(ideaId, visitorId);
      if (!r.ok) return sendJson(res, 400, { error: r.error, code: r.code, requestId }, requestId);
      return sendJson(res, 200, { votes: r.votes, voted: r.voted, requestId }, requestId);
    }
    if (req.method === 'GET' && tail === '/comments'){
      const out = community.listComments(ideaId);
      return sendJson(res, 200, Object.assign({ requestId }, out), requestId);
    }
    if (req.method === 'POST' && tail === '/comments'){
      if (denied(res, rlComment, ip + '|comment', requestId)) return true;
      const body = await readJsonBody(req);
      if (body.__bodyError) return sendJson(res, 400, { error: body.__bodyError, code: 'BAD_JSON', requestId }, requestId);
      const r = community.addComment(ideaId, { text: body.text, nickname: body.nickname, visitorId });
      if (!r.ok) return sendJson(res, r.code === 'NOT_FOUND' ? 404 : 400, { error: r.error, code: r.code, requestId }, requestId);
      return sendJson(res, 201, { comment: r.comment, requestId }, requestId);
    }
  }
  return null;
}

/* Render deploy webhook: Standard Webhooks HMAC over the RAW body,
   idempotent per webhook-id, allowlisted deploy-lifecycle mapping only.
   Returns after responding so the caller short-circuits (no 404 fall-through).
   Honest 503 until RENDER_WEBHOOK_SECRET is set — Render's deploy webhooks
   additionally require a Pro plan and a manually created webhook
   (see docs/deployment.md). */
async function handleRenderWebhook(req, res, requestId){
  let raw;
  try{
    raw = await readRawBody(req, 256 * 1024);
  }catch{
    return sendJson(res, 413, { error: 'Delivery too large.', code: 'BODY_TOO_LARGE', requestId }, requestId);
  }
  const check = events.verifyRenderSignature(raw, req.headers);
  if (!check.configured){
    return sendJson(res, 503, { error: 'Render deploy webhooks are not configured on this server.', code: 'WEBHOOK_NOT_CONFIGURED', received: true, stored: false, requestId }, requestId);
  }
  if (!check.ok){
    return sendJson(res, 401, { error: check.error || 'Invalid webhook signature.', code: 'BAD_SIGNATURE', requestId }, requestId);
  }
  let payload;
  try{ payload = JSON.parse(raw); }
  catch{ return sendJson(res, 400, { error: 'Delivery body was unreadable.', code: 'BAD_JSON', requestId }, requestId); }
  const deliveryId = req.headers['webhook-id'] || '';
  const mapped = events.mapRenderWebhook(payload, deliveryId);
  let stored = 0, duplicates = 0;
  for (const m of mapped){
    const r = await events.recordDevEventAsync(m);
    if (r.code === 'DURABLE_STORAGE_UNAVAILABLE'){
      return durableUnavailable(res, requestId, 'A deploy event could not be stored.');
    }
    if (r.ok && r.duplicate) duplicates++;
    else if (r.ok) stored++;
  }
  return sendJson(res, 200, { received: true, stored, duplicates, ignored: mapped.length === 0, requestId }, requestId);
}

/* GitHub webhook: HMAC over the RAW body, idempotent per delivery id,
   allowlisted event mapping. Never trusts parsed JSON for the check. */
async function handleWebhook(req, res, p, requestId){
  if (req.method !== 'POST') return null;
  if (p === '/api/bip/webhooks/render'){
    await handleRenderWebhook(req, res, requestId);
    return true;
  }
  if (p !== '/api/bip/webhooks/github') return null;
  let raw;
  try{
    raw = await readRawBody(req, 256 * 1024);
  }catch{
    return sendJson(res, 413, { error: 'Delivery too large.', code: 'BODY_TOO_LARGE', requestId }, requestId);
  }
  const sig = req.headers['x-hub-signature-256'];
  const check = events.verifyGitHubSignature(raw, sig);
  if (!check.configured){
    return sendJson(res, 503, { error: 'GitHub webhooks are not configured on this server.', code: 'WEBHOOK_NOT_CONFIGURED', received: true, stored: false, requestId }, requestId);
  }
  if (!check.ok){
    return sendJson(res, 401, { error: check.error || 'Invalid webhook signature.', code: 'BAD_SIGNATURE', requestId }, requestId);
  }
  let payload;
  try{ payload = JSON.parse(raw); }
  catch{ return sendJson(res, 400, { error: 'Delivery body was unreadable.', code: 'BAD_JSON', requestId }, requestId); }
  const eventName = req.headers['x-github-event'] || '';
  const action = payload && payload.action;
  const deliveryId = req.headers['x-github-delivery'] || '';
  const mapped = events.mapGitHubEvent(eventName, action, payload, deliveryId);
  let stored = 0, duplicates = 0;
  for (const m of mapped){
    const r = await events.recordDevEventAsync(m);
    if (r.code === 'DURABLE_STORAGE_UNAVAILABLE'){
      return durableUnavailable(res, requestId, 'A mapped event could not be stored.');
    }
    if (r.ok && r.duplicate) duplicates++;
    else if (r.ok) stored++;
  }
  return sendJson(res, 200, { received: true, stored, duplicates, ignored: mapped.length === 0, requestId }, requestId);
}


/* CI ingest from GitHub Actions: Bearer token, typed events only. */
async function handleIngest(req, res, p, requestId){
  if (req.method !== 'POST' || p !== '/api/bip/events/ingest') return null;
  const gate = bearerMatches(req, process.env.BIP_INGEST_TOKEN);
  if (!gate.configured){
    return sendJson(res, 503, { error: 'CI ingest is not configured on this server.', code: 'INGEST_NOT_CONFIGURED', requestId }, requestId);
  }
  if (!gate.ok){
    return sendJson(res, 401, { error: 'CI ingest authorization required.', code: 'UNAUTHORIZED', requestId }, requestId);
  }
  const body = await readJsonBody(req);
  if (body.__bodyError) return sendJson(res, 400, { error: body.__bodyError, code: 'BAD_JSON', requestId }, requestId);
  const items = Array.isArray(body.events) ? body.events : [body];
  let stored = 0, duplicates = 0;
  const errors = [];
  for (const item of items.slice(0, 20)){
    const r = await events.recordDevEventAsync({
      type: item.type, summary: item.summary, detail: item.detail,
      ref: item.ref, status: item.status, source: 'ci',
      dedupeKey: item.dedupeKey, at: item.at
    });
    if (r.code === 'DURABLE_STORAGE_UNAVAILABLE'){
      return durableUnavailable(res, requestId, 'The event could not be stored.');
    }
    if (r.ok && r.duplicate) duplicates++;
    else if (r.ok) stored++;
    else errors.push(r.code || 'BAD_EVENT');
  }
  return sendJson(res, 200, { received: true, stored, duplicates, errors, requestId }, requestId);
}


async function handleAdmin(req, res, p, requestId){
  if (!p.startsWith('/api/bip/admin/')) return null;
  if (admin.requireAdmin(req, res, requestId)) return true;
  const tail = p.slice('/api/bip/admin/'.length);

  let m = tail.match(/^milestones\/([^/]+)\/(verify|reopen|status|criteria)$/);
  if (req.method === 'POST' && m){
    const id = decodeURIComponent(m[1]);
    const body = await readJsonBody(req);
    if (body.__bodyError) return sendJson(res, 400, { error: body.__bodyError, code: 'BAD_JSON', requestId }, requestId);
    if (m[2] === 'verify') return admin.adminVerifyMilestone(req, res, id, body, requestId);
    if (m[2] === 'reopen') return admin.adminReopenMilestone(req, res, id, body, requestId);
    if (m[2] === 'status') return admin.adminSetMilestone(req, res, id, body, requestId);
    return admin.adminUpdateCriteria(req, res, id, body, requestId);
  }
  if (req.method === 'PUT' && tail === 'launch'){
    const body = await readJsonBody(req);
    if (body.__bodyError) return sendJson(res, 400, { error: body.__bodyError, code: 'BAD_JSON', requestId }, requestId);
    return admin.adminSetLaunch(req, res, body, requestId);
  }
  m = tail.match(/^roadmap\/([^/]+)$/);
  if (req.method === 'PUT' && m){
    const body = await readJsonBody(req);
    if (body.__bodyError) return sendJson(res, 400, { error: body.__bodyError, code: 'BAD_JSON', requestId }, requestId);
    return admin.adminSetRoadmap(req, res, decodeURIComponent(m[1]), body, requestId);
  }
  m = tail.match(/^ideas\/([^/]+)\/status$/);
  if ((req.method === 'PUT' || req.method === 'POST') && m){
    const body = await readJsonBody(req);
    if (body.__bodyError) return sendJson(res, 400, { error: body.__bodyError, code: 'BAD_JSON', requestId }, requestId);
    return admin.adminSetIdeaStatus(req, res, decodeURIComponent(m[1]), body, requestId);
  }
  if (req.method === 'GET' && tail === 'overview'){
    return admin.adminOverview(req, res, requestId);
  }
  if (req.method === 'GET' && tail === 'reports'){
    return admin.adminListReports(req, res, requestId);
  }
  m = tail.match(/^reports\/([^/]+)\/resolve$/);
  if (req.method === 'POST' && m){
    const body = await readJsonBody(req);
    if (body.__bodyError) return sendJson(res, 400, { error: body.__bodyError, code: 'BAD_JSON', requestId }, requestId);
    return admin.adminResolveReport(req, res, decodeURIComponent(m[1]), body, requestId);
  }
  m = tail.match(/^chat\/([^/]+)$/);
  if (req.method === 'DELETE' && m){
    return admin.adminDeleteMessage(req, res, decodeURIComponent(m[1]), requestId);
  }
  m = tail.match(/^comments\/([^/]+)$/);
  if (req.method === 'DELETE' && m){
    return admin.adminDeleteComment(req, res, decodeURIComponent(m[1]), requestId);
  }
  if (req.method === 'GET' && tail === 'waitlist/export'){
    return admin.adminExportWaitlist(req, res, requestId);
  }
  /* Durable document export/import. The export reads the AUTHORITATIVE
     stored state (Postgres in durable mode), not a stale in-memory copy.
     The import only accepts known managed collections and is repeatable:
     applying the same document twice converges on the same state. */
  if (req.method === 'GET' && tail === 'document'){
    let doc;
    try{
      doc = await store.exportDocument();
    }catch(e){
      return durableUnavailable(res, requestId, (e && e.message) || 'The document could not be exported.');
    }
    return sendJson(res, 200, { document: doc, requestId }, requestId);
  }
  if (req.method === 'POST' && tail === 'document'){
    const body = await readJsonBody(req);
    if (body.__bodyError) return sendJson(res, 400, { error: body.__bodyError, code: 'BAD_JSON', requestId }, requestId);
    let out;
    try{
      out = await store.importDocument(body.document || body);
    }catch(e){
      const code = (e && e.code) || 'BAD_IMPORT';
      if (code === 'DURABLE_STORAGE_UNAVAILABLE'){
        return durableUnavailable(res, requestId, (e && e.message) || 'The document could not be imported.');
      }
      return sendJson(res, 400, { error: (e && e.message) || 'The import document was rejected.', code, requestId }, requestId);
    }
    /* The import already wrote through the durable backend. */
    if (res.__bipCapture) res.__bipCapture.cap.durable = true;
    return sendJson(res, 200, { imported: out.imported, durable: out.durable, at: out.at, requestId }, requestId);
  }
  m = tail.match(/^estimate\/tasks\/([^/]+)$/);
  if ((req.method === 'PUT' || req.method === 'POST') && m){
    const body = await readJsonBody(req);
    if (body.__bodyError) return sendJson(res, 400, { error: body.__bodyError, code: 'BAD_JSON', requestId }, requestId);
    return admin.adminSetTaskEstimate(req, res, decodeURIComponent(m[1]), body, requestId);
  }
  m = tail.match(/^estimate\/tasks\/([^/]+)\/status$/);
  if ((req.method === 'PUT' || req.method === 'POST') && m){
    const body = await readJsonBody(req);
    if (body.__bodyError) return sendJson(res, 400, { error: body.__bodyError, code: 'BAD_JSON', requestId }, requestId);
    return admin.adminSetTaskStatus(req, res, decodeURIComponent(m[1]), body, requestId);
  }
  m = tail.match(/^estimate\/bugs\/([^/]+)$/);
  if ((req.method === 'PUT' || req.method === 'POST') && m){
    const body = await readJsonBody(req);
    if (body.__bodyError) return sendJson(res, 400, { error: body.__bodyError, code: 'BAD_JSON', requestId }, requestId);
    return admin.adminSetBug(req, res, decodeURIComponent(m[1]), body, requestId);
  }
  m = tail.match(/^estimate\/blockers\/([^/]+)$/);
  if ((req.method === 'PUT' || req.method === 'POST') && m){
    const body = await readJsonBody(req);
    if (body.__bodyError) return sendJson(res, 400, { error: body.__bodyError, code: 'BAD_JSON', requestId }, requestId);
    return admin.adminSetBlocker(req, res, decodeURIComponent(m[1]), body, requestId);
  }
  if ((req.method === 'PUT' || req.method === 'POST') && tail === 'estimate/velocity'){
    const body = await readJsonBody(req);
    if (body.__bodyError) return sendJson(res, 400, { error: body.__bodyError, code: 'BAD_JSON', requestId }, requestId);
    return admin.adminSetVelocity(req, res, body, requestId);
  }
  return sendJson(res, 404, { error: 'Unknown admin route.', code: 'NOT_FOUND', requestId }, requestId);
}

/* Entry point called from server.js. Resolves true = handled. */
async function handleBip(req, res, url, p, requestId){
  if (p === '/build' && req.method === 'GET'){
    serveBuildPage(req, res, requestId);
    return true;
  }
  if ((p === '/build/' || p === '/build/admin' || p === '/build/admin/') && req.method === 'GET'){
    serveBuildPage(req, res, requestId);
    return true;
  }
  if (!p.startsWith('/api/bip/')) return false;
  /* Durable mode: the document must be read from Postgres before any
     route answers, otherwise the first request after a restart would
     serve an empty board. A read failure is an honest 503 — never a
     silent fallback to the ephemeral JSON file. */
  if (store.isDurable() && !store.isHydrated()){
    try{
      await store.hydrate();
    }catch(e){
      return durableUnavailable(res, requestId, (e && e.message) || 'The durable document could not be read.');
    }
  }
  /* The SSE stream writes directly to the socket, so it cannot be
     captured. It is a read-only stream: nothing to flush. */
  const streaming = (req.method === 'GET' && p === '/api/bip/stream');
  const captured = streaming ? null : captureResponse(res);
  try{
    const r1 = await handleBipApi(req, res, p, url, requestId);
    if (r1) return await finishHandled(res, requestId, captured, req.method);
    const r2 = await handleBipPosts(req, res, p, url, requestId);
    if (r2) return await finishHandled(res, requestId, captured, req.method);
    const r3 = await handleWebhook(req, res, p, requestId);
    if (r3) return await finishHandled(res, requestId, captured, req.method);
    const r4 = await handleIngest(req, res, p, requestId);
    if (r4) return await finishHandled(res, requestId, captured, req.method);
    const r5 = await handleAdmin(req, res, p, requestId);
    if (r5) return await finishHandled(res, requestId, captured, req.method);
    sendJson(res, 404, { error: 'Unknown Build-in-Public route.', code: 'NOT_FOUND', requestId }, requestId);
    return await finishHandled(res, requestId, captured, req.method);
  }catch(e){
    if (captured) captured.restore();
    throw e;
  }
}

/* Release the captured response, but only after the durable write
   landed. A failed write becomes an honest 503. */
async function finishHandled(res, requestId, captured, method){
  if (!captured) return true;
  await finishCaptured(res, requestId, captured, method);
  return true;
}

module.exports = { handleBip, publicSummary };
