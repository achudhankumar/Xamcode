'use strict';
/* ============================================================
   BIP STORE — persistence layer for the Build-in-Public platform.
   ----------------------------------------------------------------
   The study app has NO database: the server persists JSON files
   (e.g. .xamcode-quota.json) and the client uses localStorage.
   Following that established pattern (and the rule against
   introducing unnecessary services), BIP uses a single JSON document
   with atomic writes behind a small collection-style API, so a real
   database driver can be swapped in later without touching callers.

   Collections (see docs/BUILD-IN-PUBLIC.md for the full schema):
     milestones   — weighted progress items (verification/reversible)
     devEvents    — sanitized development events (idempotent)
     chatMessages — public discussion (bounded history)
     ideas        — feature requests with status lifecycle
     ideaVotes    — one row per (idea, visitor) — uniqueness = integrity
     ideaComments — comments on ideas
     waitlist     — consented signups (email stored, never published)
     reports      — abuse reports for moderation
     roadmapItems — official roadmap (admin-controlled)
     settings     — launch target, phase, build/test/deploy status
     deliveries   — processed webhook delivery ids (idempotency)
   ============================================================ */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SCHEMA_VERSION = 1;
const DATA_DIR = process.env.BIP_DATA_DIR || path.join(__dirname, '..', 'bip-data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

/* Bounded histories: the public site never needs the full archive,
   and unbounded growth on a free host would be a denial-of-service
   vector. Oldest rows are dropped past these caps. */
const CAPS = {
  devEvents: 500,
  chatMessages: 500,
  deliveries: 1000,
  reports: 500
};

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

let data = null;

function ensureLoaded(){
  if (data) return data;
  try{
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }catch{}
  try{
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) data = emptyStore();
    migrate(data);
  }catch{
    data = emptyStore();
  }
  // Guarantee every expected collection exists even on old/partial files.
  const blank = emptyStore();
  for (const k of Object.keys(blank)){
    if (data[k] === undefined) data[k] = blank[k];
  }
  if (!data.settings || typeof data.settings !== 'object') data.settings = blank.settings;
  for (const k of Object.keys(blank.settings)){
    if (data.settings[k] === undefined) data.settings[k] = blank.settings[k];
  }
  return data;
}

function migrate(d){
  /* Future schema upgrades go here: bump SCHEMA_VERSION and transform.
     v1 is the initial shape, so there is nothing to do yet. */
  if (!d.schemaVersion) d.schemaVersion = SCHEMA_VERSION;
}

/* Atomic write: temp file + rename so a crash mid-write cannot leave
   a truncated store. Runs synchronously — write volume is low and the
   server is single-threaded, which also makes read-modify-write
   sequences race-free within a request. */
function persist(){
  if (!data) return;
  try{
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = STORE_FILE + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data), { mode: 0o600 });
    fs.renameSync(tmp, STORE_FILE);
  }catch(e){
    console.error('BIP store write failed:', e && e.message);
  }
}

function id(prefix){
  return (prefix || 'id') + '_' + crypto.randomBytes(8).toString('hex');
}

function trimCollection(name, cap){
  const d = ensureLoaded();
  if (Array.isArray(d[name]) && d[name].length > cap){
    d[name] = d[name].slice(d[name].length - cap);
  }
}

/* Test hook: drop the cached document so a test can point BIP_DATA_DIR
   at a temp directory and start fresh. */
function reset(){
  data = null;
}

module.exports = {
  SCHEMA_VERSION, CAPS, STORE_FILE,
  ensureLoaded, persist, id, trimCollection, reset, emptyStore
};
