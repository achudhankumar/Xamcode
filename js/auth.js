/* ============================================================
   AUTH — sign in, sign up, guest mode
   ------------------------------------------------------------
   IMPORTANT / HONEST LIMITATION
   XamCode AI is a static study app with no user database and no
   server-side session store. So this is a CLIENT-SIDE gate, not
   real authentication:

     • accounts live in this browser's localStorage only
     • there is no server check, so anyone with devtools can edit
       the stored session and walk straight in
     • password verification compares a SHA-256 digest so the
       plaintext password is never written to disk, but a digest of
       a weak password is still not a security boundary

   It is built to give the app a real, polished sign-in experience
   and a persistent session. Swapping it for real auth later means
   replacing the four functions below and nothing else — the rest of
   the app only ever calls XC.auth.isSignedIn() and session().

   Password hashing uses SubtleCrypto, which needs a secure context
   (https or localhost). Opened over file:// it is unavailable, so we
   fall back to a clearly-labelled non-cryptographic digest. That
   fallback is a UX convenience, not protection.
   ============================================================ */
(function(){
  'use strict';

  window.XC = window.XC || {};

  const ACCOUNT_KEY = 'xc-account';
  const SESSION_KEY = 'xc-session';
  const HOURS = 12;

  /* ---------------- storage helpers ---------------- */
  function readJSON(key){
    try{
      const raw = localStorage.getItem(key);
      if(!raw) return null;
      const parsed = JSON.parse(raw);
      return (parsed && typeof parsed==='object' && !Array.isArray(parsed)) ? parsed : null;
    }catch(error){
      console.warn('Stored auth data was unreadable and has been ignored.', error);
      return null;
    }
  }
  function writeJSON(key, value){
    try{
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    }catch(error){
      console.error('Could not persist auth data to local storage.', error);
      return false;
    }
  }

  /* ---------------- password digest ---------------- */
  /* Not a substitute for server-side auth — see the header note. The
     only goal is to avoid writing the plaintext password to storage. */
  function fallbackDigest(text){
    /* FNV-1a, widened across two passes so the output is less trivial
       than a single 32-bit value. Not cryptographic. */
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    for(let i=0;i<text.length;i++){
      const code = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ code, 0x01000193) >>> 0;
      h2 = Math.imul(h2 + code, 0x85ebca6b) >>> 0;
    }
    return 'fnv1a:' + h1.toString(16).padStart(8,'0') + h2.toString(16).padStart(8,'0');
  }
  async function digest(text){
    const subtle = window.crypto && window.crypto.subtle;
    if(!subtle || !subtle.digest) return fallbackDigest(text);
    try{
      const bytes = new TextEncoder().encode(text);
      const hash = await subtle.digest('SHA-256', bytes);
      return 'sha256:' + Array.from(new Uint8Array(hash))
        .map(b=>b.toString(16).padStart(2,'0')).join('');
    }catch(error){
      console.warn('SubtleCrypto unavailable; falling back to a non-cryptographic digest.', error);
      return fallbackDigest(text);
    }
  }

  /* ---------------- session ---------------- */
  function account(){ return readJSON(ACCOUNT_KEY); }

  function session(){
    const stored = readJSON(SESSION_KEY);
    if(!stored || !stored.email) return null;
    if(typeof stored.expiresAt==='number' && Date.now() > stored.expiresAt){
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return stored;
  }

  function isSignedIn(){ return !!session(); }

  function clearSession(){ localStorage.removeItem(SESSION_KEY); }

  /* ---------------- events ---------------- */
  function announce(detail){
    window.dispatchEvent(new CustomEvent('xc:authchange', {detail:detail||{}}));
  }

  function esc(value){
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[c]);
  }

  /* ============================================================
     LOGIN SCREEN
     ========================================================== */
  let mode = 'signin';       // 'signin' | 'signup'
  let notice = '';           // transient banner text
  let noticeKind = 'error';  // 'error' | 'ok'
  let root = null;

  function setNotice(text, kind){
    notice = text || '';
    noticeKind = kind || 'error';
  }

  function googleMark(){
    return '<svg viewBox="0 0 18 18" aria-hidden="true" class="auth-social-mark"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H1v2.34A8.99 8.99 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.94H1a9 9 0 0 0 0 8.12l2.97-2.34z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A8.99 8.99 0 0 0 1 4.94l2.97 2.34C4.68 5.16 6.66 3.58 9 3.58z"/></svg>';
  }
  function githubMark(){
    return '<svg viewBox="0 0 16 16" aria-hidden="true" class="auth-social-mark"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>';
  }

  function brandPanel(){
    const app = window.XC && window.XC.app;
    const topics = app ? app.TOPICS.length : 29;
    const formulas = app ? app.FORMULAS.length : 31;
    return `<aside class="auth-brand">
        <div class="auth-brand-inner">
          <div class="auth-logo">
            <span class="brand-mark logo" aria-hidden="true">
              <svg viewBox="0 0 48 48" focusable="false">
                <path class="mark-page" d="M23.5 14.5c-4.9-2.2-9.3-2.2-13.5-.3v20c4.1-1.9 8.6-1.9 13.5.3z"/>
                <path class="mark-page" d="M24.5 14.5c4.9-2.2 9.3-2.2 13.5-.3v20c-4.1-1.9-8.6-1.9-13.5.3z"/>
                <path class="mark-code" d="m19.5 21-3 3 3 3m9-6 3 3-3 3"/>
                <path class="mark-spine" d="M24 15v19"/>
              </svg>
            </span>
            <span class="auth-logo-text">XamCode <em>AI</em></span>
          </div>
          <h1 class="auth-headline">Your entire syllabus,<br>taught like a good teacher.</h1>
          <p class="auth-sub">Animated visuals, cheat sheets, formula cards and a Vaathiyar quiz mode — built from your notes, not from guesswork.</p>
          <ul class="auth-points">
            <li><b>${topics}</b><span>lesson topics across five units</span></li>
            <li><b>${formulas}</b><span>formulas with worked examples</span></li>
            <li><b>AURA</b><span>AI tutor available on every page</span></li>
          </ul>
        </div>
        <div class="auth-brand-glow" aria-hidden="true"></div>
      </aside>`;
  }

  function field(id, label, type, placeholder, autocomplete){
    return `<div class="auth-field">
        <label for="${id}">${label}</label>
        <div class="auth-input-wrap">
          <input id="${id}" name="${id}" type="${type}" placeholder="${placeholder}" autocomplete="${autocomplete}" required>
        </div>
      </div>`;
  }

  function render(){
    if(session()){ if(root){ root.remove(); root=null; } return; }
    if(!root){
      root = document.createElement('div');
      root.id = 'authScreen';
      document.body.appendChild(root);
    }
    const signup = mode==='signup';
    root.innerHTML = `<div class="auth-screen">
      ${brandPanel()}
      <main class="auth-panel">
        <div class="auth-card">
          <div class="auth-tabs" role="tablist" aria-label="Account">
            <button type="button" role="tab" class="auth-tab ${signup?'':'active'}" data-auth-tab="signin" aria-selected="${!signup}">Sign in</button>
            <button type="button" role="tab" class="auth-tab ${signup?'active':''}" data-auth-tab="signup" aria-selected="${signup}">Create account</button>
          </div>
          <h2 class="auth-title">${signup?'Create your account':'Welcome back'}</h2>
          <p class="auth-desc">${signup?'Start studying in under a minute.':'Sign in to pick up where you left off.'}</p>
          ${notice?`<div class="auth-notice ${noticeKind}" role="alert">${esc(notice)}</div>`:''}
          <form class="auth-form" id="authForm" novalidate>
            ${signup?field('authName','Full name','text','Achudhan K','name'):''}
            ${field('authEmail','Email address','email','you@college.edu','email')}
            <div class="auth-field">
              <label for="authPassword">Password</label>
              <div class="auth-input-wrap">
                <input id="authPassword" name="authPassword" type="password" placeholder="${signup?'At least 8 characters':'Your password'}" autocomplete="${signup?'new-password':'current-password'}" minlength="8" required>
                <button type="button" class="auth-eye" data-auth-eye aria-label="Show password" aria-pressed="false">👁</button>
              </div>
              ${signup?'<p class="auth-hint">Minimum 8 characters.</p>':'<button type="button" class="auth-link" data-auth-forgot>Forgot password?</button>'}
            </div>
            ${signup
              ? '<label class="auth-check"><input type="checkbox" name="authTerms" required><span>I understand this account is stored only in this browser.</span></label>'
              : '<label class="auth-check"><input type="checkbox" name="authRemember" checked><span>Keep me signed in for 12 hours</span></label>'}
            <button type="submit" class="auth-submit">${signup?'Create account':'Sign in'} <span aria-hidden="true">→</span></button>
          </form>
          <div class="auth-sep"><span>or</span></div>
          <div class="auth-social">
            <button type="button" class="auth-social-btn" data-auth-social="Google">${googleMark()} Continue with Google</button>
            <button type="button" class="auth-social-btn" data-auth-social="GitHub">${githubMark()} Continue with GitHub</button>
          </div>
          <p class="auth-social-note" data-auth-social-note role="status"></p>
          <button type="button" class="auth-guest" data-auth-guest>Continue as guest</button>
          <p class="auth-fine">Demo sign-in. Credentials stay in this browser and are never sent anywhere.</p>
        </div>
      </main>
    </div>`;
    const first = root.querySelector(signup ? '#authName' : '#authEmail');
    if(first) first.focus();
  }

  /* ---------------- sign in / sign up ---------------- */
  function startSession(user, remember){
    writeJSON(SESSION_KEY, {
      email: user.email,
      name: user.name || user.email.split('@')[0],
      /* Without "remember me" the session still exists but expires sooner —
         there is no server to refresh it against. */
      expiresAt: remember ? Date.now() + HOURS * 3600_000 : Date.now() + 8 * 3600_000,
      persistent: !!remember
    });
    if(root){ root.remove(); root=null; }
    announce({type:'signin', email:user.email});
  }

  async function submit(form){
    const signup = mode==='signup';
    const email = String(form.authEmail?.value || '').trim().toLowerCase();
    const password = String(form.authPassword?.value || '');
    const name = String(form.authName?.value || '').trim();

    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
      setNotice('Enter a valid email address.'); render(); return;
    }
    if(password.length < 8){
      setNotice('Your password must be at least 8 characters.'); render(); return;
    }

    const stored = account();

    if(signup){
      if(stored && stored.email===email){
        setNotice('An account for that email already exists in this browser. Sign in instead.');
        render(); return;
      }
      if(!form.authTerms?.checked){
        setNotice('Please confirm you understand where the account is stored.'); render(); return;
      }
      const passwordDigest = await digest(password);
      /* One local account. Replacing rather than merging keeps the
         credential lookup a single, predictable record. */
      writeJSON(ACCOUNT_KEY, {
        email,
        name: name || email.split('@')[0],
        passwordDigest,
        algorithm: passwordDigest.startsWith('sha256:') ? 'sha256' : 'fnv1a',
        createdAt: new Date().toISOString()
      });
      startSession({email, name}, true);
      return;
    }

    if(!stored || stored.email!==email){
      setNotice('No account found for that email in this browser. Create an account first.');
      render(); return;
    }
    if(await digest(password) !== stored.passwordDigest){
      setNotice('That password is not correct. Try again.');
      render(); return;
    }
    startSession(stored, !!form.authRemember?.checked);
  }

  function signInAsGuest(){
    startSession({email:'guest@xamcode.local', name:'Guest'}, true);
  }

  function signOut(){
    clearSession();
    setNotice('You have been signed out.');
    announce({type:'signout'});
    render();
  }

  /* ---------------- account dropdown ---------------- */
  function closeAcctMenu(){
    document.querySelectorAll('.acct-menu.open').forEach(menu=>{
      menu.remove();
      const toggle = document.querySelector('[data-acct-toggle]');
      if(toggle) toggle.setAttribute('aria-expanded','false');
    });
  }

  function toggleAcctMenu(btn){
    if(document.querySelector('.acct-menu.open')){ closeAcctMenu(); return; }
    const s = session();
    if(!s) return;
    const answered = Object.keys(readJSON('xc-progress') || {}).length;
    const menu = document.createElement('div');
    menu.className = 'acct-menu';
    menu.setAttribute('role','menu');
    menu.innerHTML = `
      <div class="acct-menu-head">
        <span class="acct-avatar lg" aria-hidden="true">${esc((s.name||s.email||'?').charAt(0).toUpperCase())}</span>
        <div><strong>${esc(s.name||s.email)}</strong><small>${esc(s.email)}</small></div>
      </div>
      <div class="acct-menu-stats"><span><b>${answered}</b> quiz answers saved in this browser</span></div>
      <button type="button" role="menuitem" class="acct-menu-item" data-acct-goto="workspace">📚 Workspace</button>
      <button type="button" role="menuitem" class="acct-menu-item" data-acct-goto="formulas">🧮 Formulas</button>
      <button type="button" role="menuitem" class="acct-menu-item" data-auth-aura>✨ Ask AURA AI</button>
      <button type="button" role="menuitem" class="acct-menu-item danger" data-acct-signout>↩ Sign out</button>`;
    btn.parentElement.appendChild(menu);
    menu.classList.add('open');
    btn.setAttribute('aria-expanded','true');
  }

  /* ---------------- mount ---------------- */
  function mount(){
    render();

    document.addEventListener('click', event=>{
      const tab = event.target.closest('[data-auth-tab]');
      if(tab){ mode = tab.dataset.authTab; setNotice(''); render(); return; }

      if(event.target.closest('[data-auth-guest]')){ signInAsGuest(); return; }

      const social = event.target.closest('[data-auth-social]');
      if(social){
        const note = root && root.querySelector('[data-auth-social-note]');
        if(note) note.textContent = social.dataset.authSocial
          + ' sign-in needs an OAuth backend, which this demo does not have. Use email above, or continue as guest.';
        return;
      }

      if(event.target.closest('[data-auth-forgot]')){
        setNotice('There is no mail server in this demo, so passwords cannot be emailed. Create a new account instead.');
        render();
        return;
      }

      const eye = event.target.closest('[data-auth-eye]');
      if(eye && root){
        const input = root.querySelector('#authPassword');
        if(input){
          const showing = input.type==='text';
          input.type = showing ? 'password' : 'text';
          eye.setAttribute('aria-pressed', String(!showing));
          eye.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
        }
        return;
      }

      const acct = event.target.closest('[data-acct-toggle]');
      if(acct){ toggleAcctMenu(acct); return; }

      const goto = event.target.closest('[data-acct-goto]');
      if(goto){ closeAcctMenu(); if(window.XC.app) window.XC.app.go(goto.dataset.acctGoto); return; }

      if(event.target.closest('[data-auth-aura]')){
        closeAcctMenu();
        if(window.XC.aura) window.XC.aura.open();
        return;
      }
      if(event.target.closest('[data-acct-signout]')){ closeAcctMenu(); signOut(); return; }

      if(!event.target.closest('.acct-menu') && !event.target.closest('[data-acct-toggle]')) closeAcctMenu();
    });

    /* Submit is bound separately from click: pressing Enter inside a text
       field fires submit and never a click on the button. */
    document.addEventListener('submit', event=>{
      if(event.target && event.target.id==='authForm'){
        event.preventDefault();
        submit(event.target);
      }
    });
  }

  window.XC.auth = { isSignedIn, session, account, signOut, mount };

  /* Self-mount. This script is deliberately ordered before app.js, so the
     login screen is on screen before app.js makes its first render()
     decision. */
  mount();
})();