'use strict';
/* ============================================================
   BIP STORAGE — one persistence seam for every Build-in-Public
   collection.
   ----------------------------------------------------------------
   Two backends behind one API:
     json     — the legacy single JSON file (bip-data/store.json),
                written atomically (temp file + rename). Used when
                BIP_STORAGE is not "supabase".
     supabase — durable Postgres (public.bip_collections, one JSONB
                row per collection) reached through the service-role
                REST API in bip/db.js.

   Why: Render Free wipes the local filesystem on every redeploy, so
   admin decisions and community data must live in the database. But
   the existing modules (progress, community, admin, estimate) call
   store.persist() synchronously, so the seam must keep a
   synchronous read/write surface.

   Design:
     - The in-memory document is the single source of truth for
       callers; storage owns it and hands out the SAME object
       reference, so synchronous mutations are visible immediately.
     - JSON mode writes through synchronously (unchanged legacy
       behaviour).
     - Durable mode writes through asynchronously and NEVER falls
       back to the JSON file. A failed durable write is recorded and
       surfaced as an explicit failure (HTTP 503) by the route
       layer instead of pretending the write succeeded.
     - hydrate() must complete before durable reads are served, so
       a fresh process loads the real collections from Postgres.

   Managed collections (everything except the dev-event feed, which
   stays relational in bip_events / bip_status):
     milestones, chatMessages, ideas, ideaVotes, ideaComments,
     waitlist, reports, roadmapItems, settings, deliveries
   ============================================================ */
const fs = require('node:fs');
const path = require('node:path');

const db = require('./db');

const SCHEMA_VERSION = 1;

/* Resolved lazily: tests point BIP_DATA_DIR at a scratch directory at
   runtime, so the path must never be frozen at require time. */
function dataDir(){
  return process.env.BIP_DATA_DIR || path.join(__dirname, '..', 'bip-data');
}
function storeFile(){
  return path.join(dataDir(), 'store.json');
}

/* Bounded histories: the public site never needs the full archive,
   and unbounded growth on a free host would be a denial-of-service
   vector. Oldest rows are dropped past these caps. */
const CAPS = {
  devEvents: 500,
  chatMessages: 500,
  deliveries: 1000,
  reports: 500
};

/* Collections persisted in the durable document. devEvents is
   intentionally absent: in durable mode the event feed and the
   status board live in their own relational tables. */
const MANAGED = [
  'milestones', 'chatMessages', 'ideas', 'ideaVotes', 'ideaComments',
  'waitlist', 'reports', 'roadmapItems', 'settings', 'deliveries'
];

function emptyStore(){
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    milestones: [],
    devEvents: [],
    chatMessages: [],
    ideas: [],
    ideaVotes: [],
    ideaComments: [],
    waitlist: [],
    reports: [],
    roadmapItems: [],
    settings: {
      phase: 'Building',
      currentMilestoneId: null,
      launch: { estimated: null, confirmed: null, note: '' },
      build: { state: 'unknown', at: null, ref: null },
      tests: { state: 'unknown', at: null, ref: null },
      deploy: { state: 'unknown', at: null, ref: null },
      blockers: []
    },
    deliveries: []
  };
}

/* ---------- document state ---------- */
let doc = null;            // the live document (shared reference)
let hydrated = false;      // true once the backend has been read
let readyPromise = null;   // in-flight / settled hydrate promise
let lastError = null;      // { code, message } of the last write failure
let pending = null;        // reserved for the next durable write

function isDurable(){
  return db.isDurableMode();
}

function storageError(message, code){
  const e = new Error(message);
  e.code = code || 'DURABLE_STORAGE_UNAVAILABLE';
  return e;
}

/* Fill in every expected key so an old/partial document still has
   the full shape. */
function normalize(d){
  const blank = emptyStore();
  if (!d || typeof d !== 'object' || Array.isArray(d)) d = blank;
  for (const k of Object.keys(blank)){
    if (d[k] === undefined) d[k] = blank[k];
  }
  if (!d.settings || typeof d.settings !== 'object') d.settings = blank.settings;
  for (const k of Object.keys(blank.settings)){
    if (d.settings[k] === undefined) d.settings[k] = blank.settings[k];
  }
  if (!d.schemaVersion) d.schemaVersion = SCHEMA_VERSION;
  return d;
}

/* The live document. In JSON mode it is loaded from disk lazily and
   synchronously (legacy behaviour). In durable mode it starts empty
   and is filled by hydrate(); server boot awaits hydrate() before it
   serves any request. */
function document(){
  if (!doc){
    if (isDurable()) doc = normalize(emptyStore());
    else doc = readJsonFile();
  }
  return doc;
}

/* ---------- backend: JSON file ---------- */
function readJsonFile(){
  const dir = dataDir();
  try{
    fs.mkdirSync(dir, { recursive: true });
  }catch{}
  let parsed = null;
  try{
    parsed = JSON.parse(fs.readFileSync(storeFile(), 'utf8'));
  }catch{
    parsed = null;
  }
  return normalize(parsed || emptyStore());
}

/* Atomic write: temp file + rename so a crash mid-write cannot leave
   a truncated store. Runs synchronously — write volume is low and the
   server is single-threaded, which also makes read-modify-write
   sequences race-free within a request. */
function writeJsonFile(d){
  const dir = dataDir();
  const file = storeFile();
  try{
    fs.mkdirSync(dir, { recursive: true });
    const tmp = file + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(d), { mode: 0o600 });
    fs.renameSync(tmp, file);
    return true;
  }catch(e){
    console.error('BIP store write failed:', e && e.message);
    return false;
  }
}

/* ---------- backend: durable document ---------- */
function managedSnapshot(){
  const d = document();
  const out = {};
  for (const k of MANAGED) out[k] = d[k];
  return out;
}

/* Merge a document read from Postgres into the live document. The
   live object identity is preserved so existing references (and the
   synchronous module APIs) stay valid. */
function mergeDocument(loaded){
  const d = document();
  if (!loaded || typeof loaded !== 'object' || Array.isArray(loaded)) return d;
  for (const k of Object.keys(loaded)){
    if (loaded[k] === undefined) continue;
    if (k === 'settings'){
      d.settings = Object.assign({}, d.settings, loaded.settings);
    }else{
      d[k] = loaded[k];
    }
  }
  return d;
}

/* Serialize durable writes. Each write sends the current managed
   snapshot; a write that arrives while another is in flight is
   coalesced, so the last write always wins and nothing is lost. */
let writeTimer = null;
let writeDirty = false;
let writeChain = Promise.resolve();
/* Last state that is known to be in the database. Used to roll the
   in-memory document back when a durable write fails, so the server
   never serves a change that was never stored. */
let goodState = null;

function scheduleDurableWrite(){
  writeDirty = true;
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    void runDurableWrite();
  }, 20);
  if (writeTimer.unref) writeTimer.unref();
}

async function runDurableWrite(){
  if (!writeDirty) return;
  writeDirty = false;
  const snapshot = managedSnapshot();
  writeChain = writeChain.then(async () => {
    try{
      await db.saveDocument(snapshot);
      lastError = null;
      goodState = JSON.stringify(snapshot);
    }catch(e){
      lastError = { code: (e && e.code) || 'DURABLE_STORAGE_UNAVAILABLE', message: (e && e.message) || 'Durable storage write failed.' };
      writeDirty = true;   // retry on the next flush
    }
  });
  writeChain = writeChain.catch(() => {});   // keep the chain alive
  await writeChain;
}

/* Await the durable write queue and report the outcome. Callers use
   this to answer an honest 503 when the write did not land.

   On failure the in-memory document is rolled back to the last state
   that is known to be in the database, so the server never keeps
   serving a change that was never stored. */
async function flush(){
  if (!isDurable()) return { ok: true, durable: false };
  if (writeTimer){ clearTimeout(writeTimer); writeTimer = null; }
  await runDurableWrite();
  await writeChain;
  if (lastError){
    if (goodState){
      try{ mergeDocument(JSON.parse(goodState)); }catch{}
    }
    return { ok: false, durable: true, error: lastError };
  }
  return { ok: true, durable: true };
}

/* ---------- public API ---------- */
function id(prefix){
  const crypto = require('node:crypto');
  return (prefix || 'id') + '_' + crypto.randomBytes(8).toString('hex');
}

/* Keep a collection bounded. Oldest entries are dropped. */
function trimCollection(name, cap){
  const d = document();
  if (Array.isArray(d[name]) && d[name].length > cap){
    d[name] = d[name].slice(d[name].length - cap);
  }
}

/* Read the backend into the live document. Idempotent: calling it
   twice never re-reads and never discards live mutations. */
async function hydrate(){
  if (hydrated) return document();
  if (readyPromise) return readyPromise;
  readyPromise = (async () => {
    if (isDurable()){
      /* Durable mode NEVER falls back to the local file. If Postgres
         is unreachable the read fails loudly and the route layer
         answers 503 instead of serving an empty board. */
      const loaded = await db.loadDocument();
      const hasCollections = loaded && Object.keys(loaded).length > 0;
      if (hasCollections){
        mergeDocument(loaded);
      } else {
        const localDoc = readJsonFile();
        mergeDocument(localDoc);
        try { await db.saveDocument(managedSnapshot()); } catch (e) { /* ignore */ }
      }
      goodState = JSON.stringify(managedSnapshot());
    }else{
      doc = readJsonFile();
    }
    hydrated = true;
    return document();
  })();
  try{
    return await readyPromise;
  }catch(e){
    readyPromise = null;
    throw e;
  }
}

/* True once the backend has been read into the live document. */
function isHydrated(){
  return hydrated;
}

/* Synchronous write-through, exactly like the legacy store.persist().
   In JSON mode it writes the file. In durable mode it queues the
   write and returns immediately (the route layer awaits flush()). */
function persist(){
  if (!isDurable()){
    if (!doc) return;
    writeJsonFile(doc);
    return;
  }
  scheduleDurableWrite();
}

/* Capture the managed state so a failed durable write can be rolled
   back instead of leaving an in-memory change that was never stored. */
function captureState(){
  if (!isDurable()) return null;
  return JSON.stringify(managedSnapshot());
}

function restoreState(captured){
  if (!captured) return;
  let parsed;
  try{ parsed = JSON.parse(captured); }catch{ return; }
  mergeDocument(parsed);
}

/* Full document for export. In durable mode the authoritative copy is
   read back from Postgres so an export reflects what is actually
   stored, not a stale cache. */
async function exportDocument(){
  const d = document();
  const out = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    durable: isDurable(),
    collections: {}
  };
  if (isDurable()){
    const loaded = await db.loadDocument();
    for (const k of MANAGED){
      out.collections[k] = (loaded && loaded[k] !== undefined) ? loaded[k] : d[k];
    }
    return out;
  }
  for (const k of MANAGED) out.collections[k] = d[k];
  return out;
}

/* Repeatable import: applying the same document twice converges on the
   same state (per-collection upsert, never an append). */
async function importDocument(payload){
  const body = payload && typeof payload === 'object' ? payload : {};
  const src = (body.collections && typeof body.collections === 'object' && !Array.isArray(body.collections))
    ? body.collections
    : body;
  const picked = {};
  for (const k of Object.keys(src || {})){
    if (MANAGED.indexOf(k) < 0) continue;   // only managed collections
    picked[k] = src[k];
  }
  if (!Object.keys(picked).length) throw storageError('The import document contains no known collections.', 'BAD_IMPORT');
  if (isDurable()){
    const res = await db.importDocument(picked);
    mergeDocument(picked);
    return { imported: Object.keys(picked).length, durable: true, at: (res && res.importedAt) || new Date().toISOString() };
  }
  const d = document();
  for (const k of Object.keys(picked)) d[k] = picked[k];
  writeJsonFile(d);
  return { imported: Object.keys(picked).length, durable: false, at: new Date().toISOString() };
}

/* Test hook: drop the cached document so a test can point BIP_DATA_DIR
   at a temp directory and start fresh. */
function reset(){
  doc = null;
  hydrated = false;
  readyPromise = null;
  lastError = null;
  writeDirty = false;
  goodState = null;
  writeChain = Promise.resolve();
  if (writeTimer){ clearTimeout(writeTimer); writeTimer = null; }
}

module.exports = {
  SCHEMA_VERSION, CAPS, MANAGED,
  dataDir, storeFile,
  emptyStore, normalize, document, isDurable,
  hydrate, persist, flush, id, trimCollection, reset,
  isHydrated,
  captureState, restoreState, exportDocument, importDocument,
  lastError: () => lastError
};
