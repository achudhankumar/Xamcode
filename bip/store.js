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

   The document now lives behind bip/storage.js: the same synchronous
   API is preserved, but the backend can be the JSON file (default) or
   durable Postgres (BIP_STORAGE=supabase) for hosts whose filesystem
   is wiped on every redeploy. See bip/storage.js for the seam.

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

const storage = require('./storage');

const SCHEMA_VERSION = storage.SCHEMA_VERSION;
const CAPS = storage.CAPS;

/* Legacy path accessors kept for compatibility (docs, tooling).
   Resolved lazily so a test can point BIP_DATA_DIR at a scratch
   directory after this module was required. */
function DATA_DIR(){ return storage.dataDir(); }
function STORE_FILE(){ return storage.storeFile(); }

function emptyStore(){
  return storage.emptyStore();
}

/* The live document. Callers get the SAME object every time, so a
   synchronous mutation is immediately visible to every other module —
   the legacy contract, unchanged.

   In JSON mode the file is read lazily on first access. In durable
   mode the document is filled by storage.hydrate(), which the server
   awaits during boot; until then the in-memory document is empty but
   fully shaped. */
function ensureLoaded(){
  return storage.document();
}

function migrate(d){
  /* Future schema upgrades go here: bump SCHEMA_VERSION and transform.
     v1 is the initial shape, so there is nothing to do yet. */
  if (!d.schemaVersion) d.schemaVersion = SCHEMA_VERSION;
  return d;
}

/* Write-through. In JSON mode this writes the file synchronously
   (legacy behaviour). In durable mode it queues the write; the route
   layer awaits storage.flush() and answers 503 if the write failed. */
function persist(){
  storage.persist();
}

function id(prefix){
  return storage.id(prefix);
}

function trimCollection(name, cap){
  storage.trimCollection(name, cap);
}

/* Test hook: drop the cached document so a test can point BIP_DATA_DIR
   at a temp directory and start fresh. */
function reset(){
  storage.reset();
}

module.exports = {
  SCHEMA_VERSION, CAPS,
  /* Getters so the value always reflects the CURRENT BIP_DATA_DIR
     (tests repoint it at runtime). */
  get STORE_FILE(){ return STORE_FILE(); },
  get DATA_DIR(){ return DATA_DIR(); },
  ensureLoaded, persist, id, trimCollection, reset, emptyStore,
  /* Durable-mode helpers used by the route layer. */
  hydrate: storage.hydrate,
  flush: storage.flush,
  isDurable: storage.isDurable,
  isHydrated: storage.isHydrated,
  exportDocument: storage.exportDocument,
  importDocument: storage.importDocument,
  captureState: storage.captureState,
  restoreState: storage.restoreState
};
