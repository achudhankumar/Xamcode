/* ============================================================
   BUNQ-LABS — studio chrome behaviour
   Progressive-enhancement companion to css/bunq.css. Adds the
   signature *feel* of a bold creative-studio site without ever
   touching study/quiz logic:
     · numbered 000→100 entry loader (fades once, per tab)
     · trailing blend-mode cursor ring (native cursor kept)
     · injected floating "Menu" pill + fullscreen overlay nav
     · magnetic nudge on the hero CTA
     · a scroll cue injected under the landing hero
   Composes, never collides: genz.js owns #cursorGlow, .gz-reveal
   and card tilt — everything here is namespaced bq-/#bq-* and
   bound by event delegation so it survives #app re-renders.
   No-ops under prefers-reduced-motion; pointer toys skip touch.
   ============================================================ */
(function(){
  'use strict';

  var fine = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : {matches:false};
  var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : {matches:true};

  /* ---------- helpers ---------- */
  function injectLoader(){
    if(document.getElementById('bq-loader')) return;
    var l = document.createElement('div');
    l.id = 'bq-loader';
    l.setAttribute('aria-hidden','true');
    l.innerHTML =
      '<span class="bq-load-brand">XamCode <em style="font-style:italic">AI</em></span>' +
      '<span class="bq-load-num">000</span>' +
      '<div class="bq-load-bar"><i></i></div>' +
      '<span class="bq-load-tag">Preparing your workspace</span>';
    document.body.appendChild(l);
  }
  function runLoader(){
    var l = document.getElementById('bq-loader');
    if(!l) return;
    var num = l.querySelector('.bq-load-num');
    var bar = l.querySelector('.bq-load-bar i');
    if(reduce.matches){ l.classList.add('bq-hidden'); return; }
    var start = performance.now(), dur = 1100;
    function tick(now){
      var p = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - p, 3);            // ease-out cubic
      var val = Math.round(eased * 100);
      if(num) num.textContent = ('00' + val).slice(-3);
      if(bar) bar.style.width = val + '%';
      if(p < 1){ requestAnimationFrame(tick); }
      else {
        window.setTimeout(function(){
          l.classList.add('bq-hidden');
          document.body.classList.add('bq-ready');
        }, 160);
      }
    }
    requestAnimationFrame(tick);
  }

  /* ---------- trailing cursor ring ---------- */
  function injectCursor(){
    if(document.getElementById('bq-cursor')) return;
    var c = document.createElement('div');
    c.id = 'bq-cursor';
    c.setAttribute('aria-hidden','true');
    document.body.appendChild(c);
  }
  function runCursor(){
    if(!fine.matches) return;
    var c = document.getElementById('bq-cursor');
    if(!c) return;
    var x = -100, y = -100, tx = -100, ty = -100, raf = null;
    function loop(){
      x += (tx - x) * .18;
      y += (ty - y) * .18;
      c.style.setProperty('--bq-x', x.toFixed(1) + 'px');
      c.style.setProperty('--bq-y', y.toFixed(1) + 'px');
      c.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)' +
                          (c.classList.contains('bq-press') ? ' scale(.7)' : '');
      if(Math.abs(tx - x) > .4 || Math.abs(ty - y) > .4){ raf = requestAnimationFrame(loop); }
      else { raf = null; }
    }
    document.addEventListener('pointermove', function(e){
      tx = e.clientX; ty = e.clientY;
      document.body.classList.add('bq-ready');
      if(raf === null) raf = requestAnimationFrame(loop);
      var hit = (e.target && e.target.closest)
        ? e.target.closest('a, button, .concept-card, .opt, [role="button"], input, .formula-card')
        : null;
      c.classList.toggle('bq-hover', !!hit);
    }, {passive:true});
    document.addEventListener('pointerdown', function(){ c.classList.add('bq-press'); }, {passive:true});
    document.addEventListener('pointerup', function(){ c.classList.remove('bq-press'); }, {passive:true});
    document.addEventListener('pointerleave', function(){ document.body.classList.remove('bq-ready'); }, true);
  }

  /* ---------- floating Menu pill + fullscreen overlay ---------- */
  var MENU_ITEMS = [
    {label:'Home',      nav:'landing',   num:'01'},
    {label:'Workspace', nav:'workspace', num:'02'},
    {label:'Formulas',  nav:'formulas',  num:'03'},
    {label:'Library',   nav:'library',   num:'04'}
  ];
  function injectMenu(){
    if(document.getElementById('bq-menu-btn')) return;
    var btn = document.createElement('button');
    btn.id = 'bq-menu-btn';
    btn.type = 'button';
    btn.setAttribute('aria-haspopup','true');
    btn.setAttribute('aria-expanded','false');
    btn.setAttribute('aria-controls','bq-menu');
    btn.innerHTML = '<span class="bq-dot" aria-hidden="true"></span>Menu';
    document.body.appendChild(btn);

    var menu = document.createElement('div');
    menu.id = 'bq-menu';
    menu.setAttribute('role','dialog');
    menu.setAttribute('aria-modal','true');
    menu.setAttribute('aria-label','Site menu');
    var closeBtn = document.createElement('button');
    closeBtn.id = 'bq-menu-close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label','Close menu');
    closeBtn.textContent = '×';
    menu.appendChild(closeBtn);

    var list = MENU_ITEMS.map(function(m){
      return '<li><button type="button" class="bq-menu-item" data-bq-nav="' + m.nav + '">' +
             '<span class="bq-num">' + m.num + '</span>' + m.label + '</button></li>';
    }).join('');
    var ul = document.createElement('ul');
    ul.className = 'bq-menu-list';
    ul.innerHTML = list;
    menu.appendChild(ul);

    document.body.appendChild(menu);

    function setOpen(open){
      menu.classList.toggle('bq-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.classList.toggle('bq-hidden', open);
      document.body.style.overflow = open ? 'hidden' : '';
      if(open){
        var first = menu.querySelector('.bq-menu-item');
        if(first) first.focus();
      } else { btn.focus(); }
    }
    btn.addEventListener('click', function(){ setOpen(true); });
    menu.querySelector('#bq-menu-close').addEventListener('click', function(){ setOpen(false); });
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && menu.classList.contains('bq-open')) setOpen(false); });
    // Delegate nav: reuse the app's own [data-nav] button so we never
    // duplicate navigation logic — a programmatic click bubbles to the
    // same handler app.js already installed.
    menu.addEventListener('click', function(e){
      var item = e.target.closest('[data-bq-nav]');
      if(!item) return;
      var nav = item.getAttribute('data-bq-nav');
      var real = document.querySelector('.nav [data-nav="' + nav + '"]');
      setOpen(false);
      if(real){ real.click(); }
    });
  }


  /* ---------- magnetic nudge on the hero CTA (delegated) ---------- */
  function runMagnetic(){
    if(!fine.matches || reduce.matches) return;
    document.addEventListener('pointermove', function(e){
      var b = (e.target && e.target.closest) ? e.target.closest('.btn-hero') : null;
      if(!b){ return; }
      var r = b.getBoundingClientRect();
      var dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      var dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      b.classList.add('bq-mag');
      b.style.transform = 'translate(' + (dx * 8).toFixed(2) + 'px,' + (dy * 8).toFixed(2) + 'px)';
    }, {passive:true});
    document.addEventListener('pointerout', function(e){
      var b = (e.target && e.target.closest) ? e.target.closest('.btn-hero') : null;
      if(b && !b.contains(e.relatedTarget)) b.style.transform = '';
    });
  }

  /* ---------- scroll cue under the landing hero ---------- */
  function scanCue(){
    var hero = document.querySelector('.hero-copy');
    if(!hero) return;
    if(hero.querySelector('.bq-scroll-cue')) return;
    var cue = document.createElement('div');
    cue.className = 'bq-scroll-cue';
    cue.innerHTML = '<span class="bq-line" aria-hidden="true"></span>Scroll to explore';
    hero.appendChild(cue);
  }

  /* ---------- marquee ticker band under the landing hero ----------
     The signature BunqLabs scroll strip. Injected only on the landing
     view (where a .hero exists); the observer re-adds it after the
     app re-renders. The track is duplicated so the -100% loop is
     seamless. Purely decorative → hidden under reduced-motion. */
  var MARQUEE_WORDS = [
    'Visual learning steps', 'Active recall', 'Grounded AI tutor',
    'Practice questions', 'Flashcards', 'Any subject, your PDF'
  ];
  function injectMarquee(){
    var hero = document.querySelector('.hero');
    if(!hero) return;                       // landing view only
    var shell = hero.parentElement;
    if(!shell) return;
    if(shell.querySelector(':scope > .bq-marquee')) return;
    var item = function(w){
      return '<span class="bq-marquee-item"><i aria-hidden="true">✳</i> ' + w + '</span>';
    };
    var trackHtml = MARQUEE_WORDS.map(item).join('');
    var band = document.createElement('div');
    band.className = 'bq-marquee';
    band.setAttribute('aria-hidden','true');
    band.innerHTML =
      '<div class="bq-marquee-track">' + trackHtml + '</div>' +
      '<div class="bq-marquee-track">' + trackHtml + '</div>';
    hero.insertAdjacentElement('afterend', band);
  }

  function watchApp(){
    var app = document.getElementById('app');
    if(app && 'MutationObserver' in window){
      var dirty = false;
      new MutationObserver(function(){
        if(dirty) return;
        dirty = true;
        requestAnimationFrame(function(){ dirty = false; scanCue(); injectMarquee(); });
      }).observe(app, {childList:true, subtree:true});
    }
  }

  /* ---------- boot ---------- */
  function boot(){
    injectLoader();
    injectCursor();
    injectMenu();
    runCursor();
    runMagnetic();
    watchApp();
    scanCue();
    injectMarquee();
    runLoader();
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();

