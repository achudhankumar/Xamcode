/* ============================================================
   AURA AI — the site-wide assistant
   ------------------------------------------------------------
   A floating launcher that works on every view, unlike the existing
   in-page PDF chat which is bound to one generated study pack.

   It posts to /api/aura. That endpoint does NOT require a PDF: it
   answers from a catalogue of the app's own topics and formulas, so
   AURA works before any document has been uploaded. Anything the
   catalogue does not cover is answered as general study help, and
   the system prompt forbids inventing syllabus facts.
   ============================================================ */
(function(){
  'use strict';

  window.XC = window.XC || {};

  const HISTORY_KEY = 'aura-history';
  const MAX_MESSAGES = 40;

  let root = null;
  let open = false;
  let busy = false;
  let messages = load();

  const SUGGESTIONS = [
    'Explain the TCP 3-way handshake',
    'How does CRC detect errors?',
    'What is the formula for network delay?'
  ];

  function load(){
    try{
      const raw = localStorage.getItem(HISTORY_KEY);
      if(!raw) return [];
      const parsed = JSON.parse(raw);
      if(!Array.isArray(parsed)) return [];
      const list = parsed.filter(m=>m && (m.role==='user'||m.role==='aura') && typeof m.text==='string').slice(-MAX_MESSAGES);
      /* Past answers have no stored visual (older format), so re-detect
         them on load — saved history animates just like fresh replies. */
      const av = window.XC.auraVisuals;
      if(av && typeof av.detect === 'function'){
        list.forEach(m => {
          if(m.role === 'aura' && !m.visual && !m.diagramText){
            const type = av.detect(m.text);
            if(type) m.visual = { type, params: av.extractParams(type, m.text) };
          }
        });
      }
      return list;
    }catch(error){
      console.warn('AURA history was unreadable and has been cleared.', error);
      return [];
    }
  }
  function save(){
    try{
      /* m.svg is only a session cache of the rendered diagram — it is
         regenerated from the tiny diagramText recipe instantly, so it
         never goes into localStorage. */
      const lean = messages.slice(-MAX_MESSAGES).map(m=>{
        const c = { role:m.role, text:m.text };
        if(m.diagramText) c.diagramText = m.diagramText;
        if(m.visual) c.visual = m.visual;
        return c;
      });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(lean));
    }catch(error){
      console.warn('AURA history could not be saved.', error);
    }
  }

  function esc(value){
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[c]);
  }

  /* Replies are plain text from the model, not HTML. We escape them and
     then convert newlines to <br> — the only markup that ever reaches
     the DOM is the <br> we add ourselves. */
  function format(text){
    return esc(text).replace(/\n/g, '<br>');
  }

  /* A visual (if the model returned one) gets its own mount point under
     the text; paint() fills it with a live SVG player via mountVisuals(). */

  /* Every repaint rebuilds the thread from scratch, so the old SVG
     players are detached here. We stop their RAF loops and mount a
     fresh player into each message's visual slot. */
  let players = [];
  function mountVisuals(){
    players.forEach(p => { try{ p.destroy(); }catch(error){ /* already gone */ } });
    players = [];
    if(!root) return;
    const av = window.XC.auraVisuals;
    const slots = root.querySelectorAll('.aura-visual');
    let i = 0;
    for(const m of messages){
      if(!m.diagramText && !m.visual) continue;
      const slot = slots[i++];
      if(!slot) break;
      if(m.diagramText){ mountDiagram(slot, m); continue; }
      if(av && typeof av.createPlayer === 'function'){
        const player = av.createPlayer(slot, m.visual.type, m.visual.params, { svg_instruction: m.visual.svg_instruction || '' });
        if(player) players.push(player);
      }
    }
  }

  /* Draw the text→diagram image into a message's visual slot. The SVG is
     cached on the message for this session only (save() strips it), so
     repaints inject instantly after the first draw. */
  function mountDiagram(slot, m){
    if(typeof m.svg === 'string' && m.svg){
      slot.innerHTML = m.svg;
      return;
    }
    const ad = window.XC.auraDiagram;
    if(!ad || typeof ad.render !== 'function'){ mountDiagramFallback(slot, m); return; }
    slot.classList.add('aura-diagram-busy');
    ad.render(m.diagramText, {}).then(res=>{
      m.svg = res.svg;
      if(!slot.isConnected) return; /* repainted already — next paint uses m.svg */
      slot.classList.remove('aura-diagram-busy');
      slot.innerHTML = res.svg;
    }).catch(error=>{
      console.warn('AURA diagram render failed:', error);
      if(!slot.isConnected) return;
      slot.classList.remove('aura-diagram-busy');
      mountDiagramFallback(slot, m);
    });
  }

  /* Diagram engine unavailable → the old parametric player if this message
     has one; otherwise drop the slot rather than show an empty box. */
  function mountDiagramFallback(slot, m){
    const av = window.XC.auraVisuals;
    if(m.visual && av && typeof av.createPlayer === 'function'){
      const player = av.createPlayer(slot, m.visual.type, m.visual.params, { svg_instruction: m.visual.svg_instruction || '' });
      if(player) players.push(player);
    }else if(typeof slot.remove === 'function'){
      slot.remove();
    }
  }

  /* ---------------- view ---------------- */
  function bubble(m){
    const vis = (m.diagramText || m.visual) ? `<div class="aura-visual"></div>` : '';
    return `<div class="aura-msg" data-role="${m.role}">
        <span class="aura-msg-who">${m.role==='user'?'YOU':'AURA'}</span>
        <div class="aura-msg-body">${format(m.text)}</div>
        ${vis}
      </div>`;
  }

  function paint(){
    if(!root) return;
    const thread = root.querySelector('.aura-thread');
    const history = messages.length
      ? messages.map(bubble).join('')
      : `<div class="aura-hello">
          <div class="aura-hello-mark" aria-hidden="true">✦</div>
          <strong>Hi — I’m AURA.</strong>
          <span>I know every topic and formula in XamCode. Ask me to explain something, quiz you, or point you at the right lesson.</span>
          <div class="aura-suggest">${SUGGESTIONS.map(s=>`<button type="button" class="aura-suggest-btn" data-aura-suggest="${esc(s)}">${esc(s)}</button>`).join('')}</div>
        </div>`;

    thread.innerHTML = history + (busy
      ? `<div class="aura-msg" data-role="aura"><span class="aura-msg-who">AURA</span><div class="aura-msg-body aura-typing"><i></i><i></i><i></i></div></div>`
      : '');

    mountVisuals();

    const input = root.querySelector('.aura-input');
    if(input) input.disabled = busy;

    /* Only auto-scroll when the user is already at the bottom, so
       scrolling up to re-read an earlier answer is not yanked away. */
    const nearBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 140;
    if(nearBottom) thread.scrollTop = thread.scrollHeight;
  }

  function setOpen(next){
    open = next;
    if(!root) return;
    root.classList.toggle('open', open);
    document.body.classList.toggle('aura-open', open);
    const launcher = root.querySelector('.aura-launcher');
    if(launcher) launcher.setAttribute('aria-expanded', String(open));
    if(open){
      paint();
      requestAnimationFrame(()=>{
        const input = root.querySelector('.aura-input');
        if(input) input.focus();
      });
    }
  }

  function build(){
    root = document.createElement('div');
    root.className = 'aura';
    root.innerHTML = `
      <button type="button" class="aura-launcher" data-aura-toggle aria-expanded="false" aria-controls="auraPanel" aria-label="Open AURA AI assistant">
        <span class="aura-launcher-ring" aria-hidden="true"></span>
        <span class="aura-launcher-mark" aria-hidden="true">✦</span>
        <span class="aura-launcher-label">AURA</span>
      </button>

      <section class="aura-panel" id="auraPanel" aria-label="AURA AI assistant">
        <header class="aura-head">
          <span class="aura-head-mark" aria-hidden="true">✦</span>
          <div class="aura-head-text">
            <strong>AURA AI</strong>
            <small data-aura-context>XamCode tutor</small>
          </div>
          <button type="button" class="aura-icon-btn" data-aura-clear title="Clear conversation" aria-label="Clear conversation">⌫</button>
          <button type="button" class="aura-icon-btn" data-aura-close title="Close" aria-label="Close AURA">✕</button>
        </header>

        <div class="aura-thread" role="log" aria-live="polite" aria-label="Conversation with AURA"></div>

        <form class="aura-form" id="auraForm">
          <input type="text" class="aura-input" name="question" maxlength="1000" autocomplete="off"
                 placeholder="Ask AURA anything about your syllabus…" aria-label="Ask AURA a question">
          <button type="submit" class="aura-send" aria-label="Send message">↑</button>
        </form>
        <p class="aura-note">AURA can make mistakes. Check important details against your notes.</p>
      </section>`;
    document.body.appendChild(root);

    root.addEventListener('click', event=>{
      if(event.target.closest('[data-aura-toggle]')){ setOpen(!open); return; }
      if(event.target.closest('[data-aura-close]')){ setOpen(false); return; }
      if(event.target.closest('[data-aura-clear]')){
        messages = [];
        save();
        paint();
        return;
      }
      const suggestion = event.target.closest('[data-aura-suggest]');
      if(suggestion){ ask(suggestion.dataset.auraSuggest); return; }
    });

    root.querySelector('#auraForm').addEventListener('submit', event=>{
      event.preventDefault();
      const input = event.target.querySelector('.aura-input');
      const text = input.value.trim();
      if(!text) return;
      input.value = '';
      ask(text);
    });

    document.addEventListener('keydown', event=>{
      if(event.key==='Escape' && open){ setOpen(false); }
    });
  }

  /* Refresh the "looking at…" subtitle so the model knows the context. */
  function syncContext(){
    if(!root) return;
    const el = root.querySelector('[data-aura-context]');
    if(!el) return;
    const app = window.XC.app;
    el.textContent = app && typeof app.contextLabel==='function'
      ? `Looking at: ${app.contextLabel()}`
      : 'XamCode tutor';
  }

  window.addEventListener('xc:rerender', syncContext);

  /* ---------------- asking ---------------- */
  async function ask(text){
    const question = String(text || '').trim();
    if(!question || busy) return;
    if(!open) setOpen(true);

    messages.push({role:'user', text:question});
    busy = true;
    paint();

    try{
      const app = window.XC.app;
      const response = await fetch('/api/aura', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          question,
          page: app && typeof app.contextLabel==='function' ? app.contextLabel() : '',
          /* Last few exchanges give follow-up questions ("what about the
             sender side?") something to refer back to. */
          history: messages
            .filter(m=>m.role==='aura' || m.text!==question)
            .slice(-8)
            .map(m=>({role: m.role==='user' ? 'user' : 'assistant', text:m.text}))
        })
      });

      let data = {};
      try{ data = await response.json(); }catch(error){
        console.warn('AURA returned a non-JSON response.', error);
      }

      if(!response.ok){
        /* Carry the server's code through so the catch block can tell a
           missing API key apart from a transient failure. */
        const failure = new Error(data.error || `Request failed with HTTP ${response.status}.`);
        failure.code = data.code;
        failure.status = response.status;
        throw failure;
      }
      if(!data.answer && !data.explanation) throw new Error('AURA sent back an empty answer. Please try again.');
      const answerText = data.explanation || data.answer || '';
      const auraMsg = { role:'aura', text:answerText };
      /* The server hands back a "diagram" recipe (arrow chain, flow: or seq:
         DSL) that the text→diagram engine (js/aura-diagram.js) turns into
         the picture shown next to the answer. The parametric visual from
         visual_type/params stays behind it as the fallback when that engine
         cannot render, and keyword detection still covers older servers —
         so every answer ends up with an image. */
      const KNOWN = { projectile:1, photosynthesis:1, pythagoras:1, motor:1, dna:1, wave:1, generic:1 };
      const knownVisual = data.visual_type && KNOWN[data.visual_type]
        ? { type:data.visual_type, params:(data.params && typeof data.params==='object')?data.params:{}, svg_instruction:data.svg_instruction||'' }
        : null;
      if(typeof data.diagram === 'string' && data.diagram.trim()){
        auraMsg.diagramText = data.diagram.trim();
        if(knownVisual) auraMsg.visual = knownVisual;
      }else if(knownVisual){
        auraMsg.visual = knownVisual;
      }else{
        const av = window.XC.auraVisuals;
        const type = av && typeof av.detect==='function' ? av.detect(question + '\n' + answerText) : null;
        if(type) auraMsg.visual = { type, params:av.extractParams(type, answerText), svg_instruction:'' };
        else auraMsg.diagramText = answerText;
      }
      messages.push(auraMsg);
    }catch(error){
      console.warn('AURA request failed:', error);
      messages.push({role:'aura', text:explain(error)});
    }finally{
      busy = false;
      save();
      paint();
    }
  }

  /* Turns a failure into something the learner can actually act on.
     The previous single "could not reach the server" message hid the
     most common cause by far: a 404 from a server that is running an
     older build with no /api/aura route. */
  function explain(error){
    if(error.code === 'AI_NOT_CONFIGURED'){
      return 'The AI is not configured on the server yet. Copy .env.example to .env, add your GEMINI_API_KEY, then restart with "node server.js".';
    }
    if(error.status === 404){
      return 'This server has no /api/aura route — it is running an older build of XamCode. Stop it (Ctrl+C) and start it again with "node server.js" so the AURA endpoint loads.';
    }
    if(error.status === 429){
      return 'The AI provider is rate limiting us right now. Free Gemini keys have a small daily quota, so wait a little and try again.';
    }
    if(error.status === 502 || error.status === 503){
      return 'The AI provider did not respond. That usually means a transient failure or an exhausted free-tier quota. Try again shortly.';
    }
    /* fetch() itself threw, so nothing answered on this address at all. */
    if(!error.status) return 'AURA could not reach the server at all. Make sure "node server.js" is running, and that you opened the app from http://127.0.0.1:4173 rather than the file directly.';
    return error.message || 'Something went wrong. Please try again.';
  }

  function mount(){
    build();
    syncContext();
    /* Signed-out visitors get no assistant — there is no page for it to
       sit on, and /api/aura would have no syllabus context to offer. */
    window.addEventListener('xc:authchange', ()=>{
      const auth = window.XC.auth;
      const signedIn = !auth || typeof auth.isSignedIn!=='function' ? true : auth.isSignedIn();
      if(root) root.classList.toggle('aura-hidden', !signedIn);
      if(!signedIn) setOpen(false);
      else syncContext();
    });
    if(root) root.classList.toggle('aura-hidden', !!(window.XC.auth && window.XC.auth.isSignedIn && !window.XC.auth.isSignedIn()));
  }

  window.XC.aura = { open:()=>setOpen(true), close:()=>setOpen(false), ask, mount };

  mount();
})();