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
const db = require('./db');
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

/* Validation + field allowlist shared by the JSON path and the
   durable path, so both accept exactly the same events. */
function prepareEvent(opts){
  const o = opts || {};
  if (EVENT_TYPES.indexOf(o.type) < 0) return { ok: false, error: 'Unknown event type.', code: 'BAD_TYPE' };
  const dedupeKey = o.dedupeKey ? String(o.dedupeKey).slice(0, 200) : null;
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
  return { ok: true, ev, dedupeKey };
}

/* JSON-store path (the dev/test default). Refuses to run when
   durable mode is selected so a misconfigured caller can never
   silently write to the ephemeral filesystem while the service
   claims durability (see bip/db.js). */
function recordDevEvent(opts){
  if (db.isDurableMode()) return { ok: false, error: 'Durable storage is selected; use recordDevEventAsync.', code: 'STORAGE_MODE_MISMATCH' };
  const prep = prepareEvent(opts);
  if (!prep.ok) return prep;
  const ev = prep.ev, dedupeKey = prep.dedupeKey;
  if (dedupeKey && isDuplicate(dedupeKey)) return { ok: true, duplicate: true };
  const d = store.ensureLoaded();
  d.devEvents.push(ev);
  store.trimCollection('devEvents', store.CAPS.devEvents);
  if (dedupeKey) markDelivery(dedupeKey);
  updateStatusBoard(ev);
  store.persist();
  broadcast({ kind: 'dev-event', event: ev });
  return { ok: true, event: ev };
}

/* Durable path: identical validation, then ONE atomic Postgres write
   (event insert + status-board upsert inside the bip_ingest_event()
   SQL transaction). Dedupe is enforced by the unique index, so
   concurrent CI retries cannot double-store. Storage failures come
   back as DURABLE_STORAGE_UNAVAILABLE so HTTP callers answer an
   honest 503 instead of pretending the event was accepted. */
async function recordDevEventAsync(opts){
  if (!db.isDurableMode()) return recordDevEvent(opts);
  const prep = prepareEvent(opts);
  if (!prep.ok) return prep;
  const ev = prep.ev, dedupeKey = prep.dedupeKey;
  let res;
  try{
    res = await db.insertEvent(ev, dedupeKey, statusUpdateFor(ev));
  }catch(e){
    return { ok: false, error: 'Durable storage is unavailable; the event was not recorded.', code: 'DURABLE_STORAGE_UNAVAILABLE' };
  }
  if (res.stored === false) return { ok: true, duplicate: true };
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


/* ---------- Render deploy webhook -> Standard Webhooks verification ------
   Render signs deliveries with the Standard Webhooks (Svix) scheme:
     headers  webhook-id, webhook-timestamp (unix seconds), webhook-signature
     sign     base64( HMAC-SHA256( key, "<id>.<timestamp>.<rawBody>" ) )
     key      base64-decode( secret with any leading "whsec_" stripped )
     compare  a "v1,<sig>" entry in a space-separated webhook-signature list
   A +/-5 minute timestamp window rejects replays. Reads RENDER_WEBHOOK_SECRET;
   configured:false lets the route answer an honest 503 while it is unset
   (Render webhooks also require a Pro plan — see docs/deployment.md). */
const RENDER_TOLERANCE_S = 300;
function verifyRenderSignature(rawBody, headers){
  const secret = process.env.RENDER_WEBHOOK_SECRET;
  if (!secret || secret.length < 8) return { ok: false, configured: false };
  const id = headers && headers['webhook-id'];
  const ts = headers && headers['webhook-timestamp'];
  const sig = headers && headers['webhook-signature'];
  if (!id || !ts || !sig) return { ok: false, configured: true, error: 'Missing webhook-id, webhook-timestamp, or webhook-signature header.' };
  const now = Math.floor(Date.now() / 1000);
  const t = parseInt(String(ts), 10);
  if (Number.isNaN(t)) return { ok: false, configured: true, error: 'Invalid webhook-timestamp.' };
  if (now - t > RENDER_TOLERANCE_S) return { ok: false, configured: true, error: 'webhook-timestamp is outside the accepted window (too old).' };
  if (t - now > RENDER_TOLERANCE_S) return { ok: false, configured: true, error: 'webhook-timestamp is outside the accepted window (too new).' };
  let k = String(secret);
  if (k.startsWith('whsec_')) k = k.slice(6);
  const key = Buffer.from(k, 'base64');
  if (!key.length) return { ok: false, configured: true, error: 'Signing secret could not be decoded.' };
  const toSign = String(id) + '.' + t + '.' + String(rawBody);
  const expected = crypto.createHmac('sha256', key).update(toSign, 'utf8').digest('base64');
  for (const entry of String(sig).split(' ')){
    const i = entry.indexOf(',');
    if (i < 0) continue;
    if (entry.slice(0, i) !== 'v1') continue;
    if (timingSafeEqualStr(entry.slice(i + 1), expected)) return { ok: true, configured: true };
  }
  return { ok: false, configured: true, error: 'Signature mismatch.' };
}

/* ---------- Render deploy webhook -> event mapping (allowlist only) ------
   Only deploy lifecycle notifications become public events; every other
   workspace notification (scale, restart, postgres, disks, ...) is dropped.
   Render's webhook payload carries NO commit SHA (that needs a separate
   Render API lookup), so ref stays empty rather than inventing one — the
   commit is reported by the CI ingest path instead. deploy_ended is trusted
   only when it carries an explicit status: succeeded -> deploy_succeeded,
   failed -> deploy_failed; an unknown status is ignored, never guessed.
   The webhook-id header is the stable, idempotent dedupe key (stable across
   Render's automatic retries). */
function mapRenderWebhook(payload, deliveryId){
  if (!payload || typeof payload.type !== 'string') return [];
  const data = (payload.data && typeof payload.data === 'object') ? payload.data : {};
  const service = String(data.serviceName || data.serviceId || 'service').slice(0, 80);
  const at = (typeof payload.timestamp === 'string') ? payload.timestamp : undefined;
  const common = {
    source: 'webhook',
    ref: '',
    at,
    detail: data.serviceId ? String(data.serviceId).slice(0, 80) : '',
    dedupeKey: deliveryId ? ('render-' + String(deliveryId).slice(0, 200)) : null
  };
  if (payload.type === 'deploy_started'){
    return [Object.assign({ type: 'deploy_started', summary: 'Render deploy started for ' + service }, common)];
  }
  if (payload.type === 'deploy_ended'){
    if (data.status === 'succeeded') return [Object.assign({ type: 'deploy_succeeded', summary: 'Render deploy succeeded for ' + service }, common)];
    if (data.status === 'failed') return [Object.assign({ type: 'deploy_failed', summary: 'Render deploy failed for ' + service }, common)];
    return [];
  }
  return [];
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
/* Which status-board slot (if any) an event type updates. Shared by
   the JSON writer and the durable RPC so both stay identical. */
function statusUpdateFor(ev){
  const state = ev.status === 'passed' ? 'passed'
    : ev.status === 'failed' ? 'failed'
    : ev.status === 'running' ? 'running' : 'unknown';
  const entry = { state, at: ev.at, ref: ev.ref || null };
  if (ev.type === 'tests_passed' || ev.type === 'tests_failed') return { slot: 'tests', entry };
  if (ev.type === 'deploy_started' || ev.type === 'deploy_succeeded' || ev.type === 'deploy_failed') return { slot: 'deploy', entry };
  if (ev.type.indexOf('build') === 0) return { slot: 'build', entry };
  /* milestone_verified from CI only reports WHAT passed; the actual
     milestone flip still requires the admin verify call (progress.js).
     Nothing is mutated here by design. */
  return null;
}

function updateStatusBoard(ev){
  const u = statusUpdateFor(ev);
  if (!u) return;
  store.ensureLoaded().settings[u.slot] = u.entry;
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

/* Storage-aware readers used by the HTTP layer. JSON mode reads the
   local store; durable mode reads Postgres. Durable failures throw a
   StorageError (code DURABLE_STORAGE_UNAVAILABLE) — never a stale
   local answer dressed up as current data. */
async function readActivity(limit){
  progress.ensureSeeded();
  if (!db.isDurableMode()) return latestActivity(limit);
  return db.fetchEvents(Math.max(1, Math.min(50, Number(limit) || 20)));
}

async function readStatusBoard(){
  if (!db.isDurableMode()) return statusBoard();
  const rows = await db.fetchStatus();
  const bySlot = {};
  for (const r of rows) bySlot[r.slot] = { state: r.state, at: r.at, ref: r.ref == null ? null : r.ref };
  const blank = { state: 'unknown', at: null, ref: null };
  return {
    build: bySlot.build || blank,
    tests: bySlot.tests || blank,
    deploy: bySlot.deploy || blank,
    integration: integrationStatus()
  };
}

/* Honest integration state: until GITHUB_WEBHOOK_SECRET and
   BIP_INGEST_TOKEN are configured, the feed is seeded + admin-driven
   and the UI must say so instead of pretending to be live.
   `storage`/`durable` go further: `durable` is true only when the
   supabase mode is selected AND its credentials are present, so the
   dashboard can tell ephemeral JSON storage from Postgres. */
function integrationStatus(){
  return {
    webhooks: Boolean(process.env.GITHUB_WEBHOOK_SECRET && process.env.GITHUB_WEBHOOK_SECRET.length >= 8),
    ciIngest: Boolean(process.env.BIP_INGEST_TOKEN && process.env.BIP_INGEST_TOKEN.length >= 8),
    live: Boolean(process.env.GITHUB_WEBHOOK_SECRET && process.env.GITHUB_WEBHOOK_SECRET.length >= 8) ||
          Boolean(process.env.BIP_INGEST_TOKEN && process.env.BIP_INGEST_TOKEN.length >= 8),
    storage: db.isDurableMode() ? 'supabase' : 'json',
    durable: db.isDurableMode() && db.isConfigured()
  };
}

module.exports = {
  EVENT_TYPES,
  isDuplicate, markDelivery, recordDevEvent, recordDevEventAsync,
  verifyGitHubSignature, mapGitHubEvent, verifyRenderSignature, mapRenderWebhook,
  subscribe, unsubscribe, broadcast, subscriberCount,
  latestActivity, statusBoard, readActivity, readStatusBoard,
  integrationStatus
};

