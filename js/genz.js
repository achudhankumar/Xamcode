/* ============================================================
   GENZ — pointer FX · 3D tilt · scroll reveal · micro-interactions
   Progressive enhancement only. No-ops on touch + reduced-motion.
   Loaded after app.js; safe to remove without breaking the app.
   ============================================================ */
(function(){
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var fine   = window.matchMedia('(hover: hover) and (pointer: fine)');
  if(reduce.matches) return;            // honour motion preferences — do nothing

  /* ---------- 3D pointer tilt: LANDING PAGE ONLY ----------
     Tilt is scoped to the landing page. `.card` is the feature grid
     on the landing view; it is the one surface where a pointer-driven
     3D lean reads as polish, because that grid is decorative content
     the user is not trying to hit precisely.

     Everything else is deliberately absent and keeps plain :hover
     colour/shadow feedback with no 3D transform:

       .concept-card          Workspace unit/topic grid
       .formula-card          Formula reference view
       .cc-card               Cheatcode panels
       .v-row / .v-stage      Vaathiyar-mode lesson content
       .ai-*                  The whole PDF-generated study space,
                              including the lesson scene stages
       .ts-card               Theme Studio gallery

     Those are reading and clicking surfaces. Tilt there displaced
     two-column layouts, and worse, it made small answer options a
     moving target. Study content must not move under the pointer. */
  var TILT = '.card';
  var MAX_TILT = 6;                     // degrees
  var active = null;

  function clear(el){
    if(!el) return;
    el.classList.remove('gz-tilt');
    el.style.removeProperty('--rx');
    el.style.removeProperty('--ry');
  }

  /* ---------- 3D pointer tilt (rAF-throttled, delegated) ---------- */
  /* Also feeds the editorial spotlight: --mouse-x/--mouse-y are written
     as plain pixel offsets on the same pass, so a card gets tilt and
     bloom from one layout read instead of two. Separate custom props
     from --rx/--ry, so neither effect can clobber the other. */
  var pending = false, lastEv = null;
  function applyTilt(e){
    var el = (e.target && e.target.closest) ? e.target.closest(TILT) : null;
    if(el && el.offsetParent !== null){
      if(active && active !== el) clear(active);
      active = el;
      var r = el.getBoundingClientRect();
      if(!r.width || !r.height) return;
      var px = (e.clientX - r.left) / r.width;   // 0..1
      var py = (e.clientY - r.top) / r.height;   // 0..1
      el.style.setProperty('--ry', ((px - .5) * 2 * MAX_TILT).toFixed(2) + 'deg');
      el.style.setProperty('--rx', ((.5 - py) * 2 * MAX_TILT).toFixed(2) + 'deg');
      el.style.setProperty('--mouse-x', e.clientX - r.left + 'px');
      el.style.setProperty('--mouse-y', e.clientY - r.top + 'px');
      el.classList.add('gz-tilt');
    } else if(active){
      clear(active); active = null;
    }
  }
  document.addEventListener('pointermove', function(e){
    if(!fine.matches) return;
    lastEv = e;
    if(pending) return;
    pending = true;
    requestAnimationFrame(function(){ pending = false; applyTilt(lastEv); });
  }, {passive:true});

  document.addEventListener('pointerleave', function(){ clear(active); active = null; }, true);
  document.addEventListener('scroll', function(){ clear(active); active = null; }, {passive:true, capture:true});
  window.addEventListener('blur', function(){ clear(active); active = null; });

  /* ---------- soft cursor glow (lerped follow) ---------- */
  var glow = document.getElementById('cursorGlow');
  if(glow && fine.matches){
    var x = 0, y = 0, tx = 0, ty = 0, raf = null;
    function loop(){
      x += (tx - x) * .16;
      y += (ty - y) * .16;
      glow.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
      if(Math.abs(tx - x) > .4 || Math.abs(ty - y) > .4){ raf = requestAnimationFrame(loop); }
      else { raf = null; }
    }
    document.addEventListener('pointermove', function(e){
      tx = e.clientX; ty = e.clientY;
      document.body.classList.add('gz-pointer');
      if(raf === null) raf = requestAnimationFrame(loop);
    }, {passive:true});
    document.addEventListener('pointerleave', function(){
      document.body.classList.remove('gz-pointer');
    }, true);
  }

  /* ---------- scroll reveal (re-observes after every re-render) ---------- */
  /* Cards added by the experience layer (§15) join the same reveal sweep.
     Chosen so no selector nests inside another — a parent `.gz-reveal`
     transform plus a child one would compound into double motion. */
  var REVEAL = '.stats > span, .feature-card-top, .section-heading, .course-cta, .ai-plan-hero, .ai-page-hero, .ai-chat-panel, .ai-unit-card, .ai-question-card, .formula-card, .f-step-card';
  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if(en.isIntersecting){ en.target.classList.add('gz-in'); io.unobserve(en.target); }
    });
  }, {rootMargin:'0px 0px -8% 0px', threshold:.08}) : null;

  function scan(){
    if(!io) return;
    document.querySelectorAll(REVEAL).forEach(function(el){
      if(el.classList.contains('gz-reveal')) return;
      var r = el.getBoundingClientRect();
      // only elements below the fold — above-the-fold keeps its instant entrance
      if(r.top > window.innerHeight * .9){ el.classList.add('gz-reveal'); io.observe(el); }
    });
  }

  /* ---------- tactile press feedback on bars, tabs & chips ---------- */
  document.addEventListener('pointerdown', function(e){
    var b = (e.target && e.target.closest)
      ? e.target.closest('.nav button, .study-tabs button, .tree-btn, .opt, .btn-ghost, .theme-card')
      : null;
    if(!b) return;
    b.style.transition = 'transform .12s cubic-bezier(.34,1.56,.64,1)';
    b.style.transform = 'scale(.94)';
    window.setTimeout(function(){ b.style.transform = ''; b.style.transition = ''; }, 150);
  }, {passive:true});

  /* ---------- re-scan when the app re-renders #app ---------- */
  var app = document.getElementById('app');
  if(app && 'MutationObserver' in window){
    var dirty = false;
    new MutationObserver(function(){
      if(dirty) return;
      dirty = true;
      requestAnimationFrame(function(){ dirty = false; scan(); });
    }).observe(app, {childList:true, subtree:true});
  }

  window.addEventListener('load', scan);
  scan();
})();
