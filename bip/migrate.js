'use strict';
/* ============================================================
   BIP MIGRATE — safe, repeatable CLI migration of BIP JSON data
   into Supabase Postgres (public.bip_collections).
   ------------------------------------------------------------
   Usage:
     node bip/migrate.js [--dry-run] [--file <path-to-store.json>]

   Requirements (Phase 4):
     - Never overwrite existing Supabase records blindly.
     - Avoid duplicate imports when migration is rerun.
     - Use stable IDs and safe upsert/conflict handling.
     - Preserve timestamps, votes, comments, reports, moderation.
     - Produce a clear migration/import summary without exposing
       private waitlist emails.
     - Handle malformed records safely.
     - Do not delete the original JSON file automatically.
   ============================================================ */
const fs = require('node:fs');
const path = require('node:path');
const db = require('./db');

const MANAGED = [
  'milestones', 'chatMessages', 'ideas', 'ideaVotes', 'ideaComments',
  'waitlist', 'reports', 'roadmapItems', 'settings', 'deliveries'
];

function parseArgs(){
  const args = process.argv.slice(2);
  const opts = {
    dryRun: false,
    file: path.join(__dirname, '..', 'bip-data', 'store.json'),
    help: false
  };
  for (let i = 0; i < args.length; i++){
    if (args[i] === '--dry-run') opts.dryRun = true;
    else if (args[i] === '--file' && args[i + 1]){ opts.file = path.resolve(args[++i]); }
    else if (args[i] === '--help' || args[i] === '-h') opts.help = true;
  }
  return opts;
}

function mergeCollection(name, existingList, incomingList){
  const existing = Array.isArray(existingList) ? existingList : [];
  const incoming = Array.isArray(incomingList) ? incomingList : [];
  if (!incoming.length) return existing.slice();
  if (!existing.length) return incoming.slice();

  const out = existing.slice();

  if (name === 'milestones'){
    const map = new Map();
    for (const m of out){
      const k = m.key || m.id;
      if (k) map.set(k, m);
    }
    for (const inc of incoming){
      const k = inc.key || inc.id;
      if (!k) continue;
      if (!map.has(k)){
        out.push(inc);
        map.set(k, inc);
      }
    }
    return out;
  }

  if (name === 'roadmapItems'){
    const map = new Map();
    for (const r of out){
      const k = r.id || r.title;
      if (k) map.set(k, r);
    }
    for (const inc of incoming){
      const k = inc.id || inc.title;
      if (!k) continue;
      if (!map.has(k)){
        out.push(inc);
        map.set(k, inc);
      }
    }
    return out;
  }

  if (name === 'ideas'){
    const map = new Map();
    for (const item of out){ if (item.id) map.set(item.id, item); }
    for (const inc of incoming){
      if (!inc || !inc.id) continue;
      if (!map.has(inc.id)){
        out.push(inc);
        map.set(inc.id, inc);
      }
    }
    return out;
  }

  if (name === 'ideaVotes'){
    const set = new Set();
    for (const v of out){
      if (v && v.ideaId && v.voterId) set.add(v.ideaId + '|' + v.voterId);
    }
    for (const inc of incoming){
      if (!inc || !inc.ideaId || !inc.voterId) continue;
      const key = inc.ideaId + '|' + inc.voterId;
      if (!set.has(key)){
        out.push(inc);
        set.add(key);
      }
    }
    return out;
  }

  if (name === 'waitlist'){
    const set = new Set();
    for (const w of out){
      const k = w.emailHash || w.id;
      if (k) set.add(k);
    }
    for (const inc of incoming){
      if (!inc) continue;
      const k = inc.emailHash || inc.id;
      if (k && !set.has(k)){
        out.push(inc);
        set.add(k);
      }
    }
    return out;
  }

  if (name === 'deliveries'){
    const set = new Set(out.filter(Boolean));
    for (const id of incoming){
      if (id && !set.has(id)){
        out.push(id);
        set.add(id);
      }
    }
    return out;
  }

  // chatMessages, ideaComments, reports: deduplicate by id
  const idMap = new Map();
  for (const item of out){ if (item && item.id) idMap.set(item.id, item); }
  for (const inc of incoming){
    if (!inc || !inc.id) continue;
    if (!idMap.has(inc.id)){
      out.push(inc);
      idMap.set(inc.id, inc);
    }
  }
  return out;
}

function mergeSettings(existingSettings, incomingSettings){
  const ext = existingSettings && typeof existingSettings === 'object' ? existingSettings : {};
  const inc = incomingSettings && typeof incomingSettings === 'object' ? incomingSettings : {};
  return Object.assign({}, inc, ext); // existing in Supabase takes precedence over incoming JSON defaults
}

async function run(){
  const opts = parseArgs();
  if (opts.help){
    console.log('Usage: node bip/migrate.js [--dry-run] [--file <path>]');
    process.exit(0);
  }

  console.log('========================================================');
  console.log(' Build-in-Public JSON -> Supabase Data Migration');
  console.log('========================================================');
  console.log('Source file : ' + opts.file);
  console.log('Mode        : ' + (opts.dryRun ? 'DRY RUN (no database writes)' : 'LIVE MIGRATION'));

  if (!fs.existsSync(opts.file)){
    console.error('\nERROR: Source file does not exist: ' + opts.file);
    process.exit(1);
  }

  let sourceDoc = null;
  try{
    sourceDoc = JSON.parse(fs.readFileSync(opts.file, 'utf8'));
  }catch(e){
    console.error('\nERROR: Failed to parse JSON source file: ' + (e && e.message));
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key){
    console.error('\nERROR: Supabase credentials not found in environment.');
    console.error('Please configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }

  console.log('\nConnecting to Supabase durable storage...');
  let existingDoc = {};
  try{
    existingDoc = await db.loadDocument();
    console.log('Successfully connected to Supabase (bip_collections).');
  }catch(e){
    console.error('\nERROR: Failed to query public.bip_collections in Supabase.');
    console.error('Message: ' + (e && e.message));
    console.error('\nEnsure migration supabase/migrations/20261020120000_bip_collections.sql has been applied.');
    process.exit(1);
  }

  console.log('\nAnalyzing collections for migration:');
  const mergedDoc = {};
  const stats = {};

  for (const col of MANAGED){
    const inCol = sourceDoc[col];
    const extCol = existingDoc[col];

    if (col === 'settings'){
      mergedDoc.settings = mergeSettings(extCol, inCol);
      stats.settings = { incoming: inCol ? Object.keys(inCol).length : 0, existing: extCol ? Object.keys(extCol).length : 0 };
      console.log('  - settings     : merged configuration keys');
      continue;
    }

    const inCount = Array.isArray(inCol) ? inCol.length : 0;
    const extCount = Array.isArray(extCol) ? extCol.length : 0;
    mergedDoc[col] = mergeCollection(col, extCol, inCol);
    const mergedCount = Array.isArray(mergedDoc[col]) ? mergedDoc[col].length : 0;
    const newItems = mergedCount - extCount;

    stats[col] = { incoming: inCount, existing: extCount, merged: mergedCount, new: newItems };
    console.log(`  - ${col.padEnd(13)}: ${inCount} in JSON, ${extCount} existing in DB -> ${mergedCount} total (+${newItems} new)`);
  }

  if (opts.dryRun){
    console.log('\nDRY RUN complete. No data was written to Supabase.');
    console.log('Original JSON file remains unchanged: ' + opts.file);
    process.exit(0);
  }

  console.log('\nWriting merged collections to Supabase (bip_collections)...');
  try{
    const res = await db.importDocument(mergedDoc);
    console.log(`\nSUCCESS: Successfully migrated ${res.collections || Object.keys(mergedDoc).length} collections to Supabase!`);
    console.log('Database table: public.bip_collections');
    console.log('Original JSON file preserved: ' + opts.file);
    console.log('Timestamp: ' + (res.importedAt || new Date().toISOString()));
  }catch(e){
    console.error('\nERROR: Failed to save merged document to Supabase: ' + (e && e.message));
    process.exit(1);
  }
}

if (require.main === module){
  run().catch(err => {
    console.error('Fatal error during migration:', err);
    process.exit(1);
  });
}

module.exports = { parseArgs, mergeCollection, mergeSettings, MANAGED };
