/* ============================================================
   SEARCH — command palette over topics, formulas and cheat codes
   ------------------------------------------------------------
   The index is built lazily on first open, not at load: it walks
   29 topics + 31 formulas + 29 cheat codes and would otherwise add
   work to first paint for a feature most visitors never use.

   Ranking is deliberately simple and explainable — exact title,
   then prefix, then word-boundary inside the title, then any other
   field. Fuzzy matching was rejected: on a syllabus of 89 items a
   surprising match ("crc" landing on "crash") is worse than a
   predictable one.
   ============================================================ */
(function(){
  'use strict';

  window.XC = window.XC || {};

  const MAX_PER_GROUP = 5;
  let index = null;
  let query = '';
  let active = 0;
  let flat = [];
  let root = null;
  let input = null;
  let results = null;
  let lastFocus = null;

  function esc(value){
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[c]);
  }

  /* Wrap every occurrence of the query in <mark>. The source strings are
     escaped BEFORE this runs, so the only markup that can reach the DOM
     is the <mark> we add ourselves. */
  function highlight(text, q){
    const safe = esc(text);
    if(!q) return safe;
    const needle = esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safe.replace(new RegExp(needle, 'gi'), match=>`<mark>${match}</mark>`);
  }

  function buildIndex(){
    if(index) return index;
    const XC = window.XC || {};
    const app = XC.app;
    const entries = [];

    (app && app.TOPICS || []).forEach((t, i)=>{
      entries.push({
        kind:'topic', group:'Topics', icon:'📘',
        title:t.title,
        subtitle:`Unit ${t.unit||'I'} · ${t.topic} · ${t.questions.length} questions`,
        haystack:[t.title, t.topic, t.visId, t.explanation, ...(t.keyPoints||[])].filter(Boolean).join(' '),
        weightBonus: 0,
        go:()=>app.go('study', {topicIdx:i})
      });
    });

    (app && app.FORMULAS || []).forEach(f=>{
      entries.push({
        kind:'formula', group:'Formulas', icon:'🧮',
        title:f.title,
        subtitle:`${f.cat} · ${f.formula}`,
        haystack:[f.title, f.cat, f.formula, f.meaning, f.explanation, ...(f.keyPoints||[])].filter(Boolean).join(' '),
        go:()=>app.go('formula', {formulaId:f.id})
      });
    });

    /* CHEATCODES is a map keyed by topic id, not an array, and it carries
       no title of its own — only why/like/wrong/right/see. Each entry is
       joined back to its topic so a result reads "TCP — cheat sheet"
       rather than an anonymous string. */
    const cheatCodes = (app && app.CHEATCODES) || {};
    Object.keys(cheatCodes).forEach(id=>{
      const c = cheatCodes[id];
      if(!c || typeof c!=='object') return;
      const topicIdx = (app.TOPICS || []).findIndex(t=>t.id===id);
      const topic = topicIdx >= 0 ? app.TOPICS[topicIdx] : null;
      entries.push({
        kind:'cheat', group:'Cheat Sheets', icon:'🎯',
        title: `${topic ? topic.title : id} — cheat sheet`,
        subtitle:'One-liners, common traps and what to revise',
        haystack:[topic ? topic.title : id, c.why, c.like, c.wrong, c.right, ...(c.see||[])].filter(Boolean).join(' '),
        /* Land on the topic with the CheatCode tab already selected —
           otherwise the result throws the user at the workspace grid
           and makes them hunt for the sheet they just searched for. */
        go:()=>{
          app.go('study', {topicIdx: topicIdx >= 0 ? topicIdx : 0});
          const s = app.state;
          s.studyTab = 'cheat';
          app.render();
        }
      });
    });

    index = entries;
    return index;
  }

  function score(entry, q){
    if(!q) return 1;
    const title = entry.title.toLowerCase();
    const hay = entry.haystack.toLowerCase();
    if(title === q) return 1000;
    if(title.startsWith(q)) return 900 - title.length;
    /* Word-boundary hit beats a mid-word hit: "flow" should find
       "Sliding Window" before "Overflow". */
    const wordHit = new RegExp('\\b'+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).test(hay);
    if(wordHit) return 600;
    if(hay.includes(q)) return 400;
    /* All query words present somewhere, in any order. */
    const words = q.split(/\s+/).filter(Boolean);
    if(words.length>1 && words.every(w=>hay.includes(w))) return 250;
    return 0;
  }

  function runSearch(raw){
    query = String(raw || '').trim().toLowerCase();
    const all = buildIndex();
    if(!query){
      /* Empty query: offer a few suggested entry points rather than a
         wall of 89 rows. */
      flat = [
        {kind:'topic', group:'Try these', icon:'📘', title:'Data Link Layer', subtitle:'Framing, error control and access control', go:()=>window.XC.app.go('workspace')},
        {kind:'topic', group:'Try these', icon:'📘', title:'TCP 3-Way Handshake', subtitle:'How a connection is established', go:()=>window.XC.app.go('workspace')},
        {kind:'action', group:'Go to', icon:'🧮', title:'Formula library', subtitle:'31 formulas with worked examples', go:()=>window.XC.app.go('formulas')},
        {kind:'action', group:'Go to', icon:'📚', title:'Workspace', subtitle:'All 29 topics by unit', go:()=>window.XC.app.go('workspace')},
        {kind:'action', group:'Go to', icon:'✨', title:'Ask AURA AI', subtitle:'Ask the AI tutor a question', go:()=>window.XC && window.XC.aura && window.XC.aura.open()}
      ];
      return renderList();
    }

    const scored = [];
    all.forEach(entry=>{
      const s = score(entry, query);
      if(s>0) scored.push({entry, s});
    });

    /* Group first, score second. Sorting on score alone interleaves the
       groups and repeats the same heading three times, which reads as a
       bug even though every row is a legitimate match. */
    const groupOrder = ['Topics','Formulas','Cheat Sheets'];
    scored.sort((a,b)=>
      (groupOrder.indexOf(a.entry.group) - groupOrder.indexOf(b.entry.group)) ||
      (b.s - a.s) ||
      a.entry.title.localeCompare(b.entry.title));

    /* Cap per group so one broad match cannot crowd out everything else. */
    const perGroup = {};
    flat = [];
    scored.forEach(({entry})=>{
      perGroup[entry.group] = (perGroup[entry.group] || 0) + 1;
      if(perGroup[entry.group] <= MAX_PER_GROUP) flat.push(entry);
    });
    renderList();
  }

  /* ---------------- rendering ---------------- */
  function renderList(){
    if(!results) return;
    active = Math.min(active, Math.max(0, flat.length-1));

    if(!flat.length){
      results.innerHTML = `<div class="sp-empty">
          <strong>No matches for “${esc(query)}”</strong>
          <span>Try a shorter word, a formula name like “bandwidth”, or a topic like “TCP”.</span>
        </div>`;
      return;
    }

    let html = '';
    let lastGroup = null;
    flat.forEach((entry, i)=>{
      if(entry.group !== lastGroup){
        html += `<div class="sp-group">${esc(entry.group)}</div>`;
        lastGroup = entry.group;
      }
      html += `<button type="button" class="sp-row ${i===active?'active':''}" data-sp-index="${i}" role="option" aria-selected="${i===active}">
          <span class="sp-icon" aria-hidden="true">${entry.icon}</span>
          <span class="sp-text">
            <span class="sp-title">${highlight(entry.title, query)}</span>
            ${entry.subtitle?`<span class="sp-sub">${highlight(entry.subtitle, query)}</span>`:''}
          </span>
          <span class="sp-go" aria-hidden="true">↵</span>
        </button>`;
    });
    results.innerHTML = html;

    const activeRow = results.querySelector('.sp-row.active');
    if(activeRow) activeRow.scrollIntoView({block:'nearest'});
  }

  function move(delta){
    if(!flat.length) return;
    active = (active + delta + flat.length) % flat.length;
    renderList();
  }

  function choose(i){
    const entry = flat[i];
    if(!entry) return;
    close();
    entry.go();
  }

  function open(){
    if(!root){
      root = document.createElement('div');
      root.className = 'sp';
      root.setAttribute('role','dialog');
      root.setAttribute('aria-modal','true');
      root.setAttribute('aria-label','Search topics and formulas');
      root.innerHTML = `
        <div class="sp-backdrop" data-sp-close></div>
        <div class="sp-panel">
          <div class="sp-field">
            <svg viewBox="0 0 24 24" aria-hidden="true" class="sp-glass"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>
            <input type="text" class="sp-input" placeholder="Search topics, formulas and cheat sheets…" aria-label="Search" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-autocomplete="list">
            <button type="button" class="sp-esc" data-sp-close aria-label="Close search">esc</button>
          </div>
          <div class="sp-results" role="listbox" aria-label="Search results"></div>
          <div class="sp-foot">
            <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
            <span><kbd>↵</kbd> open</span>
            <span><kbd>esc</kbd> close</span>
          </div>
        </div>`;
      document.body.appendChild(root);
      input = root.querySelector('.sp-input');
      results = root.querySelector('.sp-results');
      root.querySelector('.sp-panel').addEventListener('click', event=>{
        if(event.target.closest('[data-sp-close]')){ close(); return; }
        const row = event.target.closest('[data-sp-index]');
        if(row){ choose(Number(row.dataset.spIndex)); }
      });
      input.addEventListener('input', ()=>{ active=0; runSearch(input.value); });
    }

    lastFocus = document.activeElement;
    root.classList.add('open');
    document.body.classList.add('sp-locked');
    input.value = '';
    active = 0;
    runSearch('');
    requestAnimationFrame(()=>input.focus());
  }

  function close(){
    if(!root) return;
    root.classList.remove('open');
    document.body.classList.remove('sp-locked');
    if(lastFocus && typeof lastFocus.focus==='function') lastFocus.focus();
  }

  function isOpen(){ return !!(root && root.classList.contains('open')); }

  /* ---------------- mount ---------------- */
  function mount(){
    document.addEventListener('click', event=>{
      if(event.target.closest('[data-search-open]')){ event.preventDefault(); open(); }
    });

    document.addEventListener('keydown', event=>{
      /* Ctrl/Cmd+K opens from anywhere. "/" is the convention people
         already expect, but only when they are not typing into a field —
         otherwise it would swallow the key in the login form and search. */
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')
        || document.activeElement?.isContentEditable;

      if((event.key==='k' || event.key==='K') && (event.metaKey || event.ctrlKey)){
        event.preventDefault();
        isOpen() ? close() : open();
        return;
      }
      if(event.key==='/' && !typing && !isOpen()){
        event.preventDefault();
        open();
        return;
      }
      if(!isOpen()) return;

      if(event.key==='Escape'){ event.preventDefault(); close(); return; }
      if(event.key==='ArrowDown'){ event.preventDefault(); move(1); return; }
      if(event.key==='ArrowUp'){ event.preventDefault(); move(-1); return; }
      if(event.key==='Enter'){ event.preventDefault(); choose(active); return; }
      /* Tab would move focus out of the palette into the page behind it. */
      if(event.key==='Tab'){ event.preventDefault(); move(event.shiftKey ? -1 : 1); }
    });

    /* The header is re-rendered on every render(), so the shortcut hint
       has to be refreshed to match this platform. */
    function syncHint(){
      const kbd = document.getElementById('searchKbd');
      if(kbd) kbd.textContent = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '') ? '⌘K' : '/';
    }
    document.addEventListener('xc:rerender', syncHint);
    syncHint();
  }

  window.XC.search = { open, close, isOpen, mount };

  /* Self-mount: this script loads after app.js, so XC.app already exists
     and the index can be built straight away. */
  mount();
})();