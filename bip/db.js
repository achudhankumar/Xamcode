'use strict';
/* ============================================================
   BIP DB — durable storage adapter for Build-in-Public events and
   the build / test / deploy status board.
   ----------------------------------------------------------------
   Why this exists: Render Free's local filesystem is wiped on every
   redeploy and restart (docs/deployment.md), so the JSON store in
   bip/store.js cannot hold the public activity feed. When
   BIP_STORAGE=supabase, the event path is backed by dedicated
   Postgres tables through the Supabase REST (PostgREST) API using
   Node's global fetch — no new runtime dependencies (this project
   is deliberately dependency-free).

   Required environment (SERVER-SIDE ONLY):
     BIP_STORAGE=supabase          opt in; any other value = legacy JSON store
     SUPABASE_URL                  https://<project-ref>.supabase.co
     SUPABASE_SERVICE_ROLE_KEY     service-role key (bypasses RLS; NEVER the
                                   anon key, never shipped to the browser)

   Contract (see docs/deployment.md):
     - Durable mode NEVER silently falls back to the ephemeral JSON
       store. Every failure raises a StorageError with code
       DURABLE_STORAGE_UNAVAILABLE so HTTP callers answer an honest
       503 instead of pretending the write succeeded.
     - insertEvent() relies on the unique index over dedupe_key plus
       ON CONFLICT inside the bip_ingest_event() SQL function, so
       deduplication is atomic even when CI requests race. The event
       row and the status-board upsert commit in ONE transaction.
     - The service-role key is never logged, never placed in a
       response body, and is only ever sent to SUPABASE_URL.
   ============================================================ */

const TIMEOUT_MS = 8000;

/* Single error type for "durable storage unavailable". Message text
   is safe to surface: it never contains credentials or response
   bodies, only the endpoint path and HTTP status. */
function storageError(message){
  const e = new Error(message);
  e.code = 'DURABLE_STORAGE_UNAVAILABLE';
  return e;
}

function isDurableMode(){
  return String(process.env.BIP_STORAGE || '').trim().toLowerCase() === 'supabase';
}

function restBase(){
  const u = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  return u ? u + '/rest/v1' : '';
}

function serviceKey(){
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
}

function isConfigured(){
  return isDurableMode() && restBase().length > 0 && serviceKey().length > 0;
}

function headers(){
  return {
    apikey: serviceKey(),
    Authorization: 'Bearer ' + serviceKey(),
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
}


/* One guarded request helper: validates config, applies a timeout,
   and converts every transport/HTTP failure into a StorageError. */
async function request(pathAndQuery, opts){
  if (!isDurableMode()) throw storageError('Durable storage is not selected (BIP_STORAGE != supabase).');
  if (!isConfigured()) throw storageError('Durable storage is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing).');
  const ctrl = new AbortController();
  const timer = setTimeout(() => { try{ ctrl.abort(); }catch{} }, TIMEOUT_MS);
  let res;
  try{
    res = await fetch(restBase() + pathAndQuery, Object.assign({}, opts, {
      headers: Object.assign(headers(), (opts && opts.headers) || {}),
      signal: ctrl.signal
    }));
  }catch{
    throw storageError('Durable storage request failed for ' + pathAndQuery.split('?')[0] + ' (network/timeout).');
  }finally{
    clearTimeout(timer);
  }
  if (!res.ok){
    throw storageError('Durable storage answered HTTP ' + res.status + ' for ' + pathAndQuery.split('?')[0] + '.');
  }
  return res;
}

/* timestamptz columns are strict; normalize any caller-provided
   timestamp and fall back to now() rather than rejecting the event. */
function isoOrNull(v){
  if (v == null || v === '') return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function iso(v){
  if (v == null) return v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toISOString();
}

/* Atomic insert via the bip_ingest_event() SQL function:
   INSERT ... ON CONFLICT (dedupe_key) DO NOTHING + status-board
   upsert in one transaction. Returns { stored: boolean, id }. */
async function insertEvent(ev, dedupeKey, statusUpdate){
  const payload = {
    p_id: String(ev.id),
    p_type: String(ev.type),
    p_summary: String(ev.summary),
    p_detail: String(ev.detail || ''),
    p_ref: String(ev.ref || ''),
    p_status: String(ev.status || 'info'),
    p_source: String(ev.source || 'ci'),
    p_at: isoOrNull(ev.at) || new Date().toISOString(),
    p_dedupe_key: dedupeKey ? String(dedupeKey) : null,
    p_status_slot: statusUpdate ? statusUpdate.slot : null,
    p_status_state: statusUpdate ? statusUpdate.entry.state : null,
    p_status_at: statusUpdate ? isoOrNull(statusUpdate.entry.at) : null,
    p_status_ref: statusUpdate ? (statusUpdate.entry.ref || null) : null
  };
  const res = await request('/rpc/bip_ingest_event', { method: 'POST', body: JSON.stringify(payload) });
  let out;
  try{ out = await res.json(); }catch{ throw storageError('Durable storage returned a malformed insert response.'); }
  if (!out || typeof out.stored !== 'boolean') throw storageError('Durable storage returned an unexpected insert response.');
  return out;
}


function rowToEvent(r){
  return {
    id: r.id,
    type: r.type,
    summary: r.summary,
    detail: r.detail || '',
    ref: r.ref || '',
    status: r.status || 'info',
    source: r.source || 'ci',
    at: iso(r.at)
  };
}

/* ---------- durable collections (document) API ----------
   Every Build-in-Public collection that is NOT a dev event (milestones,
   roadmap, chat, ideas, votes, comments, waitlist, reports, settings,
   webhook delivery ids) lives in public.bip_collections as one JSON
   document per collection, so the JSON import format and the live
   format are the same document.

   The dev-event feed keeps its own relational table (bip_events) and
   the status board its own (bip_status); both are read from there. */

/* Load every collection as one object: { milestones: [...], ... } */
async function loadDocument(){
  const res = await request('/rpc/bip_load_document', { method: 'POST', body: '{}' });
  let out;
  try{ out = await res.json(); }catch{ throw storageError('Durable storage returned a malformed document response.'); }
  if (!out || typeof out !== 'object' || Array.isArray(out)) throw storageError('Durable storage returned an unexpected document response.');
  return out;
}

/* Upsert the collections present in the payload. Other rows are left
   untouched, so a partial save never destroys unrelated data. */
async function saveDocument(collections){
  const payload = Object.assign({}, collections || {});
  const res = await request('/rpc/bip_save_document', { method: 'POST', body: JSON.stringify({ p_collections: payload }) });
  const text = await res.text();
  let out = null;
  if (text && text.trim()){
    try{ out = JSON.parse(text); }catch{ throw storageError('Durable storage returned a malformed save response.'); }
  }
  return { saved: Object.keys(payload).length, result: out };
}

/* Repeatable full import of a managed document. Importing the same
   document twice converges on the same state (upsert, not append). */
async function importDocument(doc){
  const res = await request('/rpc/bip_import_document', { method: 'POST', body: JSON.stringify({ p_doc: doc || {} }) });
  let out;
  try{ out = await res.json(); }catch{ throw storageError('Durable storage returned a malformed import response.'); }
  if (!out || typeof out.collections !== 'number') throw storageError('Durable storage returned an unexpected import response.');
  return out;
}

/* Newest first, matching the JSON store's latestActivity() order. */
async function fetchEvents(limit){
  const n = Math.max(1, Math.min(50, Number(limit) || 20));
  const res = await request('/bip_events?select=*&order=at.desc,id.desc&limit=' + n, { method: 'GET' });
  let rows;
  try{ rows = await res.json(); }catch{ throw storageError('Durable storage returned a malformed activity response.'); }
  if (!Array.isArray(rows)) throw storageError('Durable storage returned an unexpected activity response.');
  return rows.map(rowToEvent);
}

async function fetchStatus(){
  const res = await request('/bip_status?select=*&order=slot.asc', { method: 'GET' });
  let rows;
  try{ rows = await res.json(); }catch{ throw storageError('Durable storage returned a malformed status response.'); }
  if (!Array.isArray(rows)) throw storageError('Durable storage returned an unexpected status response.');
  return rows.map(r => ({
    slot: r.slot,
    state: r.state,
    at: iso(r.at),
    ref: r.ref == null ? null : r.ref
  }));
}

module.exports = {
  isDurableMode, isConfigured, insertEvent, fetchEvents, fetchStatus,
  loadDocument, saveDocument, importDocument
};
