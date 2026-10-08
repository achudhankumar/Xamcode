/* ============================================================
   THEME STUDIO — 3D theme gallery · visual theme detail · quick rail
   Progressive enhancement. The theme switch itself is handled by
   app.js via [data-set-theme]; this file only paints the UI and
   syncs with body[data-theme]/[data-mode].
   Safe to delete with css/theme-studio.css.
   ============================================================ */
(function(){
  'use strict';

  /* ============================================================
     1 · REGISTRY — single source of truth for the studio
     ============================================================ */
  var THEMES = [
    {
      id:'bubblegum', name:'Bubblegum', emoji:'🍬', art:'bubblegum',
      category:'Soft washes · floating cards',
      vibe:'Soft washes',
      blurb:'Blurred pink and lavender washes with frosted cards drifting between them. Warm, plush, endlessly soft.',
      palette:['Bubblegum Pink','Lavender','Peach Wash','Deep Plum','Berry Ink'],
      stops:['#0f0612','#ff5a8a','#c9a8ff'],
      aurora:['#ff5a8a','#c9a8ff','#ffc8a0'],
      tokens:{
        dark:{bg:'#0f0612',surface:'#1e1020',strong:'#2a1828',text:'#fcf8ff',muted:'#a08aa0',accent:'#ff5a8a',accent2:'#c9a8ff',accent3:'#ffc8a0'},
        light:{bg:'#fff4f8',surface:'#fffdfd',strong:'#ffe7f0',text:'#3b1026',muted:'#8a5c74',accent:'#db2777',accent2:'#8b5cf6',accent3:'#f97316'}
      }
    },
    {
      id:'digital', name:'Digital', emoji:'🧊', art:'digital',
      category:'Grid · wireframes · data streams',
      vibe:'Wireframe world',
      blurb:'A 48px grid receding to the horizon, wireframe cubes turning in the light and data falling between them.',
      palette:['Signal Blue','Sky','Cyan','Carbon','Deep Navy'],
      stops:['#07080a','#5b8cff','#22d3ee'],
      aurora:['#5b8cff','#22d3ee','#a78bfa'],
      tokens:{
        dark:{bg:'#07080a',surface:'#0d1117',strong:'#151b24',text:'#e8f0ff',muted:'#7a8ab0',accent:'#5b8cff',accent2:'#7dd3fc',accent3:'#22d3ee'},
        light:{bg:'#f1f5ff',surface:'#ffffff',strong:'#e4ebff',text:'#0a1220',muted:'#5a6b8c',accent:'#2563eb',accent2:'#0891b2',accent3:'#7c3aed'}
      }
    },
    {
      id:'cosmic', name:'Cosmic', emoji:'🪐', art:'cosmic',
      category:'Starfield · nebula · orbits',
      vibe:'Deep orbit',
      blurb:'Two nebula clouds, a twinkling starfield and three orbital rings turning around a violet core.',
      palette:['Nebula Violet','Orbit Blue','Nebula Pink','Void Black','Starlight'],
      stops:['#050508','#8b5cf6','#ec4899'],
      aurora:['#8b5cf6','#3b82f6','#ec4899'],
      tokens:{
        dark:{bg:'#050508',surface:'#0b0a18',strong:'#141230',text:'#ede8ff',muted:'#9a8ab8',accent:'#8b5cf6',accent2:'#3b82f6',accent3:'#ec4899'},
        light:{bg:'#f7f5ff',surface:'#ffffff',strong:'#ece7ff',text:'#140f2e',muted:'#6b5f8c',accent:'#7c3aed',accent2:'#2563eb',accent3:'#db2777'}
      }
    },
    {
      id:'organic', name:'Organic', emoji:'🫧', art:'organic',
      category:'Metaballs · flowing lines',
      vibe:'Slow liquid',
      blurb:'Five metaballs that merge as they drift, with peach, sage and mint liquid lines running behind them.',
      palette:['Liquid Peach','Sage','Mint','Paper','Charcoal'],
      stops:['#fafaf8','#ff6b4a','#b8e6d5'],
      aurora:['#ff6b4a','#b8e6d5','#d4e4d0'],
      tokens:{
        dark:{bg:'#16130f',surface:'#211d18',strong:'#2c2620',text:'#f7f1e9',muted:'#b5a695',accent:'#ff6b4a',accent2:'#b8e6d5',accent3:'#d4e4d0'},
        light:{bg:'#fafaf8',surface:'#ffffff',strong:'#f4ece0',text:'#1a1a1a',muted:'#8a7a74',accent:'#ff6b4a',accent2:'#6fbf9f',accent3:'#7c9a6e'}
      }
    }
  ];

  function byId(id){
    for(var i=0;i<THEMES.length;i++){ if(THEMES[i].id===id) return THEMES[i]; }
    return THEMES[0];
  }
  function activeTheme(){ return document.body.getAttribute('data-theme') || 'bubblegum'; }
  function activeMode(){ return document.body.getAttribute('data-mode') || 'dark'; }

  /* ============================================================
     2 · HELPERS
     ============================================================ */
  function esc(s){
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  var gradOf = function(t){ return 'linear-gradient(135deg, ' + t.stops.join(', ') + ')'; };

  /* the 5 palette colours, in the order the names are declared */
  function paletteOf(t, mode){
    var k = t.tokens[mode];
    var vals = [k.accent, k.accent2, k.accent3, k.bg, k.surface];
    return t.palette.map(function(n, i){ return { n:n, c:vals[i] }; });
  }

  var toastEl = null, toastTimer = null;
  function toast(msg){
    if(!toastEl){
      toastEl = document.createElement('div');
      toastEl.id = 'tsToast';
      toastEl.setAttribute('role','status');
      toastEl.setAttribute('aria-live','polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ toastEl.classList.remove('show'); }, 1800);
  }

  /* ============================================================
     3 · GALLERY — one 3D card per theme
     ============================================================ */
  function cardHTML(t){
    var on = t.id === activeTheme();
    return '<button class="ts-card' + (on ? ' is-active' : '') + '" type="button" data-set-theme="' + t.id + '" ' +
             'data-ts-id="' + t.id + '" aria-pressed="' + (on ? 'true' : 'false') + '" ' +
             'aria-label="Use the ' + t.name + ' theme">' +
      '<span class="ts-art" data-art="' + t.art + '" style="--ts-grad:' + gradOf(t) + '">' +
        (on ? '<span class="ts-badge">Active</span>' : '') +
        '<span class="ts-hint">' + esc(t.vibe) + '</span>' +
        '<span class="ts-obj" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' +
      '</span>' +
      '<span class="ts-foot">' +
        '<span class="ts-dot" aria-hidden="true">' + t.emoji + '</span>' +
        '<span class="ts-meta"><b>' + t.name + ' theme</b><span>' + esc(t.category) + '</span></span>' +
        '<span class="ts-use">' + (on ? 'Active' : 'Use →') + '</span>' +
      '</span>' +
    '</button>';
  }

  function paintGallery(gallery){
    gallery.innerHTML = THEMES.map(cardHTML).join('');
  }

  /* keep every card's active state in sync without re-rendering */
  function syncCards(){
    var cur = activeTheme();
    document.querySelectorAll('.ts-card').forEach(function(c){
      var on = c.getAttribute('data-ts-id') === cur;
      c.classList.toggle('is-active', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
      var badge = c.querySelector('.ts-badge');
      if(on && !badge){
        var b = document.createElement('span');
        b.className = 'ts-badge';
        b.textContent = 'Active';
        c.querySelector('.ts-art').insertBefore(b, c.querySelector('.ts-art').firstChild);
      } else if(!on && badge){
        badge.remove();
      }
      var use = c.querySelector('.ts-use');
      if(use) use.textContent = on ? 'Active' : 'Use →';
    });
  }

  /* ============================================================
     4 · INSPECTOR — a visual read-out of the active theme
     ============================================================ */

  function paintInspector(side, id){
    var t = byId(id), mode = activeMode();
    var grad = gradOf(t);
    var pal = paletteOf(t, mode);

    side.innerHTML =
      /* big live preview — same 3D object as the card, at hero size */
      '<div class="ts-preview" style="--ts-grad:' + grad + '">' +
        '<span class="ts-art ts-preview-art" data-art="' + t.art + '" aria-hidden="true">' +
          '<span class="ts-obj"><i></i><i></i><i></i><i></i></span>' +
        '</span>' +
        '<span class="ts-preview-em" aria-hidden="true">' + t.emoji + '</span>' +
      '</div>' +

      '<div class="ts-title-row">' +
        '<div><strong>' + t.name + ' theme</strong><em>' + esc(t.category) + '</em></div>' +
        '<span class="ts-live">In use</span>' +
      '</div>' +

      '<p class="ts-blurb">' + esc(t.blurb) + '</p>' +

      '<div class="ts-palette-wrap">' +
        '<span class="ts-label">Palette</span>' +
        '<div class="ts-palette">' +
          pal.map(function(p){
            return '<span class="ts-chip" style="--c:' + p.c + '" title="' + esc(p.n) + '">' +
              '<i style="background:' + p.c + '"></i><b>' + esc(p.n) + '</b></span>';
          }).join('') +
        '</div>' +
      '</div>' +

      '<div class="ts-appearance">' +
        '<span class="ts-label">Appearance</span>' +
        '<div class="ts-appear-row">' +
          '<button class="ts-appear' + (mode === 'light' ? ' active' : '') + '" ' +
            'type="button" data-set-mode="light" aria-pressed="' + (mode === 'light') + '">' +
            '<span aria-hidden="true">☀️</span> Light</button>' +
          '<button class="ts-appear' + (mode === 'dark' ? ' active' : '') + '" ' +
            'type="button" data-set-mode="dark" aria-pressed="' + (mode === 'dark') + '">' +
            '<span aria-hidden="true">🌙</span> Dark</button>' +
        '</div>' +
      '</div>';
  }

  /* ============================================================
     5 · QUICK RAIL — the persistent right-edge theme switcher
     ============================================================ */
  function buildRail(){
    var rail = document.createElement('div');
    rail.id = 'tsRail';
    rail.setAttribute('role','group');
    rail.setAttribute('aria-label','Quick theme switcher');
    rail.innerHTML =
      THEMES.map(function(t){
        return '<button class="ts-rail-dot" type="button" data-set-theme="' + t.id + '" data-ts-dot="' + t.id + '" ' +
          'data-label="' + t.name + '" aria-label="Switch to the ' + t.name + ' theme" ' +
          'style="--dot:' + gradOf(t) + '"></button>';
      }).join('') +
      '<span class="ts-rail-sep"></span>' +
      '<span class="ts-rail-label">THEMES</span>';
    document.body.appendChild(rail);
    return rail;
  }

  /* ============================================================
     6 · STATE SYNC
     ============================================================ */
  var gallery = document.getElementById('tsGallery');
  var side = document.getElementById('tsSide');
  var rail = buildRail();

  function refresh(){
    if(gallery) syncCards();
    if(side) paintInspector(side, activeTheme());
    document.querySelectorAll('.ts-rail-dot').forEach(function(d){
      d.classList.toggle('is-active', d.getAttribute('data-ts-dot') === activeTheme());
    });
  }

  /* keep the rail out of the way of dialogs, flashcards and the intro film */
  function visible(elm){
    if(!elm) return false;
    var cs = window.getComputedStyle(elm);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity || 1) > .05;
  }
  function syncRailVisibility(){
    var themeModal = document.getElementById('themeModal');
    var blocked =
      visible(document.getElementById('videoIntro')) ||
      visible(document.getElementById('fcOverlay')) ||
      (themeModal && themeModal.classList.contains('open'));
    rail.classList.toggle('ts-off', !!blocked);
  }

  /* ============================================================
     7 · EVENTS
     ============================================================ */
  document.addEventListener('click', function(e){
    if(!e.target.closest) return;

    /* shuffle — roll a different vibe */
    if(e.target.closest('.ts-shuffle')){
      var pool = THEMES.filter(function(t){ return t.id !== activeTheme(); });
      var pick = pool[Math.floor(Math.random() * pool.length)];
      var card = document.querySelector('.ts-card[data-ts-id="' + pick.id + '"]');
      if(card) card.click();
      document.querySelectorAll('.ts-rail-dot').forEach(function(d){
        if(d.getAttribute('data-ts-dot') === pick.id) d.click();
      });
      toast(pick.name + ' it is ' + pick.emoji);
    }
  }, true);

  /* any theme/mode change anywhere re-syncs the whole studio */
  new MutationObserver(refresh).observe(document.body, {
    attributes:true, attributeFilter:['data-theme','data-mode']
  });

  /* release the entrance animation once it has played, so the card
     settles into its normal state instead of holding the keyframe */
  document.addEventListener('animationend', function(e){
    var card = e.target && e.target.closest && e.target.closest('.ts-card');
    if(card) card.classList.add('ts-ready');
  });

  /* dialogs opening/closing re-evaluates the rail */
  ['themeModal','videoIntro','fcOverlay','uploadModal'].forEach(function(id){
    var elm = document.getElementById(id);
    if(elm) new MutationObserver(syncRailVisibility).observe(elm, {attributes:true, attributeFilter:['class','style','open']});
  });

  /* ============================================================
     8 · BOOT
     ============================================================ */
  if(gallery) paintGallery(gallery);
  refresh();
  syncRailVisibility();

  window.XamThemeStudio = {
    themes: THEMES,
    refresh: refresh
  };
})();