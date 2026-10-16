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
  if (req.method === 'GET' && p === '/api/bip/waitlist/count'){
    return sendJson(res, 200, { count: community.waitlistCount(), requestId }, requestId);
  }
  return null;   // not a simple GET — caller continues to POST/parametric routes
}

async function handleBipPosts(req, res, p, url, requestId){
  const visitorId = getOrCreateVisitor(req, res);
  const ip = clientIp(req);

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

/* GitHub webhook: HMAC over the RAW body, idempotent per delivery id,
   allowlisted event mapping. Never trusts parsed JSON for the check. */
async function handleWebhook(req, res, p, requestId){
  if (req.method !== 'POST' || p !== '/api/bip/webhooks/github') return null;
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
  if (req.method === 'GET' && tail === 'waitlist/export'){
    return admin.adminExportWaitlist(req, res, requestId);
  }
  return sendJson(res, 404, { error: 'Unknown admin route.', code: 'NOT_FOUND', requestId }, requestId);
}

/* Entry point called from server.js. Resolves true = handled. */
async function handleBip(req, res, url, p, requestId){
  if (p === '/build' && req.method === 'GET'){
    serveBuildPage(req, res, requestId);
    return true;
  }
  if (p === '/build/' && req.method === 'GET'){
    serveBuildPage(req, res, requestId);
    return true;
  }
  if (!p.startsWith('/api/bip/')) return false;
  const r1 = await handleBipApi(req, res, p, url, requestId);
  if (r1) return true;
  const r2 = await handleBipPosts(req, res, p, url, requestId);
  if (r2) return true;
  const r3 = await handleWebhook(req, res, p, requestId);
  if (r3) return true;
  const r4 = await handleIngest(req, res, p, requestId);
  if (r4) return true;
  const r5 = await handleAdmin(req, res, p, requestId);
  if (r5) return true;
  sendJson(res, 404, { error: 'Unknown Build-in-Public route.', code: 'NOT_FOUND', requestId }, requestId);
  return true;
}

module.exports = { handleBip, publicSummary };
