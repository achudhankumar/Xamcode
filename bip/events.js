'use strict';
/* ============================================================
   BIP EVENTS — VS Code -> GitHub -> backend -> public dashboard.
   ----------------------------------------------------------------
   Ingest paths:
     1. GitHub repo webhooks -> POST /api/bip/webhooks/github
        (HMAC verified, idempotent by delivery id, field-allowlisted)
     2. GitHub Actions      -> POST /api/bip/events/ingest
        (Bearer token, typed events: build/test/deploy/milestone)
   Public paths:
     • GET /api/bip/activity  — latest sanitized dev events
     • GET /api/bip/status    — build/test/deploy summary
     • GET /api/bip/stream    — SSE live updates
   Commits/CI NEVER auto-verify milestones; they feed the activity
   feed and the status cards only.
   ============================================================ */
const crypto = require('node:crypto');
const store = require('./store');
const progress = require('./progress');
const { sanitizePublicText, timingSafeEqualStr, isoNow } = require('./util');

/* Event types the public feed will ever show. Anything else from a
   webhook or CI payload is dropped, never published. */
const EVENT_TYPES = [
  'commit_pushed', 'build_started', 'build_passed', 'build_failed',
  'tests_passed', 'tests_failed', 'deploy_started', 'deploy_succeeded',
  'deploy_failed', 'milestone_verified', 'milestone_reopened',
  'release_published', 'note'
];

/* ---------- idempotent event recording ---------- */
function isDuplicate(dedupeKey){
  if (!dedupeKey) return false;
  return store.ensureLoaded().deliveries.indexOf(dedupeKey) >= 0;
}

function markDelivery(dedupeKey){
  if (!dedupeKey) return;
  const d = store.ensureLoaded();
  if (d.deliveries.indexOf(dedupeKey) < 0){
    d.deliveries.push(dedupeKey);
    store.trimCollection('deliveries', store.CAPS.deliveries);
  }
}

function recordDevEvent(opts){
  const o = opts || {};
  if (EVENT_TYPES.indexOf(o.type) < 0) return { ok: false, error: 'Unknown event type.', code: 'BAD_TYPE' };
  const dedupeKey = o.dedupeKey ? String(o.dedupeKey).slice(0, 200) : null;
  if (dedupeKey && isDuplicate(dedupeKey)) return { ok: true, duplicate: true };
  const d = store.ensureLoaded();
  let status = o.status;
  if (status !== 'failed' && status !== 'passed' && status !== 'running'){
    // Default from the type suffix so CI can send just the type name.
    status = /(_failed|_reopened)$/.test(o.type) ? 'failed'
      : /(_started)$/.test(o.type) ? 'running'
      : /(_passed|_succeeded|_published|_verified)$/.test(o.type) ? 'passed' : 'info';
  }
  const ev = {
    id: store.id('ev'),
    type: o.type,
    summary: sanitizePublicText(o.summary, 160),
    detail: o.detail ? sanitizePublicText(o.detail, 500) : '',
    ref: o.ref ? String(o.ref).slice(0, 80) : '',
    status,
    source: (o.source === 'seed' || o.source === 'admin' || o.source === 'webhook' || o.source === 'ci') ? o.source : 'ci',
    at: o.at || isoNow()
  };
  if (!ev.summary) return { ok: false, error: 'Event summary is required.', code: 'BAD_SUMMARY' };
  d.devEvents.push(ev);
  store.trimCollection('devEvents', store.CAPS.devEvents);
  if (dedupeKey) markDelivery(dedupeKey);
  updateStatusBoard(ev);
  store.persist();
  broadcast({ kind: 'dev-event', event: ev });
  return { ok: true, event: ev };
}

/* ---------- HMAC webhook verification ---------- */
function verifyGitHubSignature(rawBody, sigHeader){
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret || secret.length < 8) return { ok: false, configured: false };
  if (typeof sigHeader !== 'string' || !sigHeader.startsWith('sha256=')){
    return { ok: false, configured: true, error: 'Missing or malformed X-Hub-Signature-256.' };
  }
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(Buffer.from(rawBody, 'utf8')).digest('hex');
  return timingSafeEqualStr(sigHeader, expected)
    ? { ok: true, configured: true }
    : { ok: false, configured: true, error: 'Signature mismatch.' };
}


/* ---------- GitHub webhook -> event mapping (allowlist only) ----------
   Only three delivery types turn into public events, and each maps to
   an explicit field picklist: message, short sha, branch, run status.
   No source code, logs, file contents, tokens, or emails ever leave
   the payload — they are filtered here, not in the renderer. */
function mapGitHubEvent(eventName, action, payload, deliveryId){
  const out = [];
  if (eventName === 'push' && payload && Array.isArray(payload.commits)){
    const branch = typeof payload.ref === 'string' ? payload.ref.replace('refs/heads/', '').slice(0, 80) : '';
    for (const c of payload.commits.slice(0, 5)){
      out.push({
        type: 'commit_pushed',
        summary: sanitizePublicText((c && c.message ? String(c.message).split('\n')[0] : 'Commit pushed') + ' (' + branch + ')', 160),
        ref: String((c && c.id) || '').slice(0, 7),
        status: 'info',
        source: 'webhook',
        dedupeKey: 'gh-' + deliveryId + '-' + String((c && c.id) || '').slice(0, 12)
      });
    }
    return out;
  }
  if (eventName === 'workflow_run' && payload && payload.workflow_run){
    const run = payload.workflow_run;
    const name = sanitizePublicText(run.name || 'CI workflow', 80);
    const conclusion = String(run.conclusion || '');
    const status = String(run.status || '');
    if (run.event === 'pull_request') return out;   // PR churn stays private
    if (status === 'in_progress' || status === 'queued'){
      out.push({ type: 'build_started', summary: 'Build started: ' + name, ref: String(run.head_sha || '').slice(0, 7), status: 'running', source: 'webhook', dedupeKey: 'gh-' + deliveryId + '-started' });
    } else if (conclusion === 'success'){
      out.push({ type: 'build_passed', summary: 'Build passed: ' + name, ref: String(run.head_sha || '').slice(0, 7), status: 'passed', source: 'webhook', dedupeKey: 'gh-' + deliveryId + '-ok' });
    } else if (conclusion === 'failure' || conclusion === 'cancelled'){
      out.push({ type: 'build_failed', summary: 'Build failed: ' + name, ref: String(run.head_sha || '').slice(0, 7), status: 'failed', source: 'webhook', dedupeKey: 'gh-' + deliveryId + '-fail' });
    }
    return out;
  }
  if (eventName === 'release' && action === 'published' && payload && payload.release){
    out.push({
      type: 'release_published',
      summary: 'Release published: ' + sanitizePublicText(payload.release.tag_name || payload.release.name || 'new release', 80),
      ref: sanitizePublicText(payload.release.tag_name || '', 40),
      status: 'passed', source: 'webhook',
      dedupeKey: 'gh-' + deliveryId + '-release'
    });
    return out;
  }
  return out;
}

/* ---------- status board ---------- */
function updateStatusBoard(ev){
  const d = store.ensureLoaded();
  const state = ev.status === 'passed' ? 'passed'
    : ev.status === 'failed' ? 'failed'
    : ev.status === 'running' ? 'running' : 'unknown';
  const entry = { state, at: ev.at, ref: ev.ref || null };
  if (ev.type === 'tests_passed' || ev.type === 'tests_failed') d.settings.tests = entry;
  else if (ev.type === 'deploy_started' || ev.type === 'deploy_succeeded' || ev.type === 'deploy_failed') d.settings.deploy = entry;
  else if (ev.type.indexOf('build') === 0) d.settings.build = entry;
  /* milestone_verified from CI only reports WHAT passed; the actual
     milestone flip still requires the admin verify call (progress.js).
     Nothing is mutated here by design. */
}

/* ---------- SSE realtime bus (in-memory) ---------- */
const subscribers = new Set();
function subscribe(res){
  subscribers.add(res);
}
function unsubscribe(res){
  subscribers.delete(res);
}
function broadcast(payload){
  const line = 'data: ' + JSON.stringify(payload) + '\n\n';
  for (const res of Array.from(subscribers)){
    try{ res.write(line); }catch{ unsubscribe(res); }
  }
}
function subscriberCount(){ return subscribers.size; }

function latestActivity(limit){
  progress.ensureSeeded();
  const d = store.ensureLoaded();
  const n = Math.max(1, Math.min(50, Number(limit) || 20));
  return d.devEvents.slice(-n).reverse();
}

function statusBoard(){
  const d = store.ensureLoaded();
  return {
    build: d.settings.build,
    tests: d.settings.tests,
    deploy: d.settings.deploy,
    integration: integrationStatus()
  };
}

/* Honest integration state: until GITHUB_WEBHOOK_SECRET and
   BIP_INGEST_TOKEN are configured, the feed is seeded + admin-driven
   and the UI must say so instead of pretending to be live. */
function integrationStatus(){
  return {
    webhooks: Boolean(process.env.GITHUB_WEBHOOK_SECRET && process.env.GITHUB_WEBHOOK_SECRET.length >= 8),
    ciIngest: Boolean(process.env.BIP_INGEST_TOKEN && process.env.BIP_INGEST_TOKEN.length >= 8),
    live: Boolean(process.env.GITHUB_WEBHOOK_SECRET && process.env.GITHUB_WEBHOOK_SECRET.length >= 8) ||
          Boolean(process.env.BIP_INGEST_TOKEN && process.env.BIP_INGEST_TOKEN.length >= 8)
  };
}

module.exports = {
  EVENT_TYPES,
  isDuplicate, markDelivery, recordDevEvent,
  verifyGitHubSignature, mapGitHubEvent,
  subscribe, unsubscribe, broadcast, subscriberCount,
  latestActivity, statusBoard, integrationStatus
};

