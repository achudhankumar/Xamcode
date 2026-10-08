/* ============================================================
   LIBRARY — hybrid PDF + output storage (IndexedDB now, server later)
   Auth today is browser-localStorage only (js/auth.js), so there is
   no server account to bill against. IndexedDB holds payloads
   (study JSON + MiniMax image URLs + PDF metadata). localStorage
   holds only the trial clock (xc-trial-start) and the outbound sync
   queue (xc-library-sync). TRIAL: 30 days from first study save.
   purgeExpired() deletes studies when expired AND not renewed.
   renewTrial() is the payment-gateway seam. SYNC STUB: saves also
   queue to POST /api/library/sync (404 today = expected, swallowed).
   ============================================================ */
(function(){
  'use strict';
  window.XC = window.XC || {};
  const DB_NAME = 'xamcode-library';
  const DB_VERSION = 1;
  const STORE = 'studies';
  const TRIAL_KEY = 'xc-trial-start';
  const SYNC_KEY = 'xc-library-sync';
  const TRIAL_DAYS = 30;
  function trialStart(){
    try{
      let v = localStorage.getItem(TRIAL_KEY);
      if(!v){ v = String(Date.now()); localStorage.setItem(TRIAL_KEY, v); }
      return Number(v) || Date.now();
    }catch{ return Date.now(); }
  }
  function trialStatus(){
    const start = trialStart();
    const ms = TRIAL_DAYS*24*3600*1000 - (Date.now()-start);
    const daysLeft = Math.max(0, Math.ceil(ms/(24*3600*1000)));
    return { startedAt: start, daysLeft, expired: ms<=0,
      expiresAt: start + TRIAL_DAYS*24*3600*1000 };
  }
  function renewTrial(){
    try{ localStorage.setItem(TRIAL_KEY, String(Date.now())); }catch{}
    return trialStatus();
  }
  let dbPromise = null;
  function db(){
    if(dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject)=>{
      if(!('indexedDB' in window)){ reject(new Error('IndexedDB unavailable')); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = ()=>{ req.result.createObjectStore(STORE, { keyPath: 'id' }); };
      req.onsuccess = ()=>resolve(req.result);
      req.onerror = ()=>reject(req.error || new Error('DB open failed'));
    });
    return dbPromise;
  }
  function readSyncQueue(){
    try{ return JSON.parse(localStorage.getItem(SYNC_KEY) || '[]'); }
    catch{ return []; }
  }
  function writeSyncQueue(q){
    try{ localStorage.setItem(SYNC_KEY, JSON.stringify(q.slice(-50))); }catch{}
  }
  async function trySync(){
    const q = readSyncQueue();
    if(!q.length) return;
    try{
      const res = await fetch('/api/library/sync', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ items: q })
      });
      if(res.ok) writeSyncQueue([]);
    }catch{}
  }
  function enqueueSync(op){
    const q = readSyncQueue();
    q.push(Object.assign({ at: Date.now() }, op));
    writeSyncQueue(q);
    trySync();
  }
  window.XC._lib = { DB_NAME, STORE, TRIAL_KEY, SYNC_KEY, TRIAL_DAYS,
    trialStart, trialStatus, renewTrial, db, readSyncQueue,
    writeSyncQueue, trySync, enqueueSync };
  /* ---- part 2: study CRUD + expiry enforcement + public API ---- */
  function txPut(entry){
    return window.XC._lib.db().then(d=>new Promise((resolve, reject)=>{
      try{
        const t = d.transaction(window.XC._lib.STORE, 'readwrite');
        t.objectStore(window.XC._lib.STORE).put(entry);
        t.oncomplete = ()=>resolve(entry);
        t.onerror = ()=>reject(t.error || new Error('save failed'));
      }catch(e){ reject(e); }
    }));
  }
  function txList(){
    return window.XC._lib.db().then(d=>new Promise((resolve)=>{
      try{
        const out = [];
        const req = d.transaction(window.XC._lib.STORE, 'readonly')
          .objectStore(window.XC._lib.STORE).openCursor();
        req.onsuccess = (e)=>{
          const c = e.target.result;
          if(c){ out.push(c.value); c.continue(); }
          else resolve(out.sort((a,b)=>b.createdAt-a.createdAt));
        };
        req.onerror = ()=>resolve(out);
      }catch{ resolve([]); }
    }));
  }
  async function saveStudy(opts){
    opts = opts || {};
    const L = window.XC._lib;
    const id = opts.jobId || ('local-' + Date.now());
    const entry = {
      id, title: (opts.study && opts.study.title) || (opts.pdfMeta && opts.pdfMeta.name) || 'Untitled study',
      subject: (opts.study && opts.study.subject) || '',
      summary: (opts.study && opts.study.summary) || '',
      createdAt: Date.now(),
      expiresAt: L.trialStart() + L.TRIAL_DAYS*24*3600*1000,
      study: opts.study || null, images: opts.images || {},
      pdfMeta: opts.pdfMeta || null
    };
    L.trialStart();
    await txPut(entry);
    L.enqueueSync({ op:'save', id, title: entry.title, subject: entry.subject });
    return entry;
  }
  async function listStudies(){
    const L = window.XC._lib;
    if(L.trialStatus().expired){ await purgeExpired(); return []; }
    return txList().catch(()=>[]);
  }
  async function getStudy(id){
    const L = window.XC._lib;
    if(L.trialStatus().expired){ await purgeExpired(); return null; }
    return L.db().then(d=>new Promise((resolve)=>{
      try{
        const r = d.transaction(L.STORE,'readonly').objectStore(L.STORE).get(id);
        r.onsuccess = ()=>resolve(r.result || null);
        r.onerror = ()=>resolve(null);
      }catch{ resolve(null); }
    }));
  }
  async function deleteStudy(id){
    const L = window.XC._lib;
    await L.db().then(d=>new Promise((resolve)=>{
      try{
        const t = d.transaction(L.STORE,'readwrite');
        t.objectStore(L.STORE).delete(id);
        t.oncomplete = ()=>resolve();
        t.onerror = ()=>resolve();
      }catch{ resolve(); }
    }));
    L.enqueueSync({ op:'delete', id });
  }
  async function purgeExpired(){
    const L = window.XC._lib;
    if(!L.trialStatus().expired) return 0;
    let n = 0;
    await L.db().then(d=>new Promise((resolve)=>{
      try{
        const t = d.transaction(L.STORE,'readwrite');
        const st = t.objectStore(L.STORE);
        const req = st.getAll();
        req.onsuccess = ()=>{ for(const e of (req.result||[])){ st.delete(e.id); n++; } };
        t.oncomplete = ()=>resolve();
        t.onerror = ()=>resolve();
      }catch{ resolve(); }
    })).catch(()=>{});
    return n;
  }
  window.XC.library = { TRIAL_DAYS: window.XC._lib.TRIAL_DAYS,
    trialStatus: window.XC._lib.trialStatus, renewTrial: window.XC._lib.renewTrial,
    saveStudy, listStudies, getStudy, deleteStudy, purgeExpired,
    trySync: window.XC._lib.trySync };
})();
