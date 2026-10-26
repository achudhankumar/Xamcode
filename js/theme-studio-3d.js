/**
 * js/theme-studio-3d.js
 * XamCode Build-in-Public 5-Style 3D Experience Engine (ported from build.html)
 * + V2 3D Experience Theme Studio compatibility bridge.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'xamcode_experience_style_v2';
  var V2_STORAGE_KEY = 'xc_3d_theme';
  var ORDER = ['vibe', 'bubblegum', 'glass', 'brutalist', 'minimal'];

  var STYLES = {
    vibe: {
      id: 'vibe',
      name: 'Vibe Coding Studio',
      short: 'Vibe Studio',
      mode: 'dark',
      canvas: {
        bgTop: '#060803',
        gridRgb: '200,255,61',
        accentRgb: '200,255,61',
        secRgb: '94,234,212',
        gridAlpha: 0.28,
        speed: 1.0,
        particleShape: 'circle'
      }
    },
    bubblegum: {
      id: 'bubblegum',
      name: 'Bubblegum Playground',
      short: 'Bubblegum',
      mode: 'light',
      canvas: {
        bgTop: '#fff5fb',
        gridRgb: '255,61,154',
        accentRgb: '255,61,154',
        secRgb: '0,210,255',
        gridAlpha: 0.22,
        speed: 1.25,
        particleShape: 'bubble'
      }
    },
    glass: {
      id: 'glass',
      name: 'Liquid Glass 3D',
      short: 'Liquid Glass',
      mode: 'dark',
      canvas: {
        bgTop: '#040914',
        gridRgb: '56,232,255',
        accentRgb: '56,232,255',
        secRgb: '168,85,247',
        gridAlpha: 0.26,
        speed: 0.82,
        particleShape: 'prism'
      }
    },
    brutalist: {
      id: 'brutalist',
      name: 'Neo-Brutalist Lab',
      short: 'Brutalist Lab',
      mode: 'dark',
      canvas: {
        bgTop: '#0d0d0d',
        gridRgb: '255,230,0',
        accentRgb: '255,230,0',
        secRgb: '255,77,0',
        gridAlpha: 0.36,
        speed: 1.35,
        particleShape: 'square'
      }
    },
    minimal: {
      id: 'minimal',
      name: 'Soft Minimal Studio',
      short: 'Minimal Studio',
      mode: 'light',
      canvas: {
        bgTop: '#f6f3ec',
        gridRgb: '217,107,39',
        accentRgb: '26,25,22',
        secRgb: '42,124,111',
        gridAlpha: 0.16,
        speed: 0.65,
        particleShape: 'ring'
      }
    }
  };

  var V2_TO_STYLE_MAP = {
    'default-bil': 'vibe',
    'cyber-vaathiyar': 'vibe',
    'quantum-holo': 'glass',
    'abyssal-prism': 'glass',
    'neural-synapse': 'bubblegum',
    'solaris-chrono': 'minimal',
    'obsidian-monolith': 'brutalist'
  };

  var XAMCODE_3D_EXPERIENCE_THEMES = {
    'quantum-holo': {
      id: 'quantum-holo',
      name: 'Quantum Hologram 3D',
      tagline: 'Spatial glassmorphism with holographic cyan & magenta depth',
      vars: { '--xc-bg-deep': '#040914', '--xc-accent-primary': '#38e8ff', '--xc-accent-secondary': '#a855f7' }
    },
    'cyber-vaathiyar': {
      id: 'cyber-vaathiyar',
      name: 'Cyber-Vaathiyar Studio',
      tagline: 'Electric lime & obsidian high-contrast exam command center',
      vars: { '--xc-bg-deep': '#060803', '--xc-accent-primary': '#c8ff3d', '--xc-accent-secondary': '#5eead4' }
    },
    'neural-synapse': {
      id: 'neural-synapse',
      name: 'Neural Synapse Biolum',
      tagline: 'Organic bioluminescent emerald & indigo deep-focus matrix',
      vars: { '--xc-bg-deep': '#fff5fb', '--xc-accent-primary': '#ff3d9a', '--xc-accent-secondary': '#00d2ff' }
    },
    'solaris-chrono': {
      id: 'solaris-chrono',
      name: 'Solaris Glass Studio',
      tagline: 'Warm titanium & amber daylight-balanced 3D academic studio',
      vars: { '--xc-bg-deep': '#f6f3ec', '--xc-accent-primary': '#d96b27', '--xc-accent-secondary': '#2a7c6f' }
    },
    'abyssal-prism': {
      id: 'abyssal-prism',
      name: 'Abyssal Prism 3D',
      tagline: 'Deep ocean sapphire with chromatic aberration edge highlights',
      vars: { '--xc-bg-deep': '#040914', '--xc-accent-primary': '#38e8ff', '--xc-accent-secondary': '#6366f1' }
    },
    'obsidian-monolith': {
      id: 'obsidian-monolith',
      name: 'Obsidian Monolith',
      tagline: 'Zero-distraction carbon black with surgical gold telemetry',
      vars: { '--xc-bg-deep': '#0d0d0d', '--xc-accent-primary': '#ffe600', '--xc-accent-secondary': '#ff4d00' }
    }
  };

  var savedStyle = 'vibe';
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw && STYLES[raw]) savedStyle = raw;
  } catch (e) {}

  var activeStyle = savedStyle;
  var previewStyle = null;
  var isOpen = false;

  function syncStyleUI() {
    var shown = previewStyle || activeStyle;
    var cfg = STYLES[shown] || STYLES.vibe;
    var badge = document.getElementById('styleCurrentBadge');
    if (badge) {
      badge.textContent = previewStyle ? (cfg.short + ' · Preview') : cfg.short;
    }
    var statusTxt = document.getElementById('styleStatusText');
    if (statusTxt) {
      statusTxt.textContent = previewStyle
        ? ('Previewing: ' + cfg.name + ' · Click Apply to save')
        : ('Active: ' + cfg.name + ' · Preview any experience below');
    }
    var cards = document.querySelectorAll('.style-card[data-style-card]');
    cards.forEach(function (card) {
      var cid = card.getAttribute('data-style-card');
      var isSelected = (cid === shown);
      var isSaved = (cid === activeStyle);
      card.classList.toggle('is-active', isSelected);
      card.classList.toggle('is-previewing', cid === previewStyle && previewStyle !== activeStyle);
      card.setAttribute('aria-checked', isSelected ? 'true' : 'false');
      var statePill = card.querySelector('[data-badge-for]');
      if (statePill) {
        if (isSaved && !previewStyle) statePill.textContent = 'Active';
        else if (cid === previewStyle) statePill.textContent = 'Previewing';
        else if (isSaved) statePill.textContent = 'Saved';
        else statePill.textContent = 'Available';
      }
    });
  }

  function applyStyleToDOM(id, isPreview) {
    var styleId = STYLES[id] ? id : (V2_TO_STYLE_MAP[id] || 'vibe');
    var cfg = STYLES[styleId];
    if (!document.body) return cfg;

    document.body.setAttribute('data-style', styleId);
    document.body.setAttribute('data-theme', 'bil');
    document.body.setAttribute('data-mode', cfg.mode || 'dark');
    document.documentElement.setAttribute('data-style', styleId);

    if (isPreview) {
      previewStyle = styleId;
    } else {
      activeStyle = styleId;
      previewStyle = null;
      try {
        localStorage.setItem(STORAGE_KEY, styleId);
      } catch (e) {}
    }

    syncStyleUI();
    window.dispatchEvent(new CustomEvent('xamcode:stylechange', { detail: cfg }));
    return cfg;
  }

  function applyXamCode3DTheme(themeId) {
    if (STYLES[themeId]) {
      return applyStyleToDOM(themeId, false);
    }
    var mapped = V2_TO_STYLE_MAP[themeId] || 'vibe';
    try {
      localStorage.setItem(V2_STORAGE_KEY, themeId);
    } catch (e) {}
    document.documentElement.setAttribute('data-xc-3d-theme', themeId);
    return applyStyleToDOM(mapped, false);
  }

  function setOpen(open, revertIfPreview) {
    var modal = document.getElementById('styleModal');
    var veil = document.getElementById('styleVeil');
    var trig = document.getElementById('styleBtn');
    if (!modal || !veil) return;

    if (!open && revertIfPreview && previewStyle && previewStyle !== activeStyle) {
      applyStyleToDOM(activeStyle, false);
    }
    isOpen = !!open;
    modal.classList.toggle('show', isOpen);
    modal.classList.toggle('open', isOpen);
    veil.classList.toggle('show', isOpen);
    veil.classList.toggle('open', isOpen);
    modal.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    veil.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    if (trig) trig.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    if (isOpen) syncStyleUI();
  }

  // Event delegation for #styleBtn and #styleModal
  document.addEventListener('click', function (e) {
    var trig = e.target.closest('#styleBtn');
    if (trig) {
      e.preventDefault();
      setOpen(!isOpen, true);
      return;
    }

    if (e.target.closest('#styleCloseBtn') || e.target.id === 'styleVeil') {
      e.preventDefault();
      setOpen(false, true);
      return;
    }

    if (e.target.closest('#styleResetBtn')) {
      e.preventDefault();
      applyStyleToDOM(activeStyle, false);
      return;
    }

    if (e.target.closest('#styleApplyConfirmBtn')) {
      e.preventDefault();
      var chosen = previewStyle || activeStyle;
      applyStyleToDOM(chosen, false);
      setOpen(false, false);
      return;
    }

    var applyBtn = e.target.closest('[data-apply]');
    if (applyBtn) {
      e.preventDefault();
      e.stopPropagation();
      var aid = applyBtn.getAttribute('data-apply');
      if (aid && STYLES[aid]) {
        applyStyleToDOM(aid, false);
        setOpen(false, false);
      }
      return;
    }

    var prevBtn = e.target.closest('[data-preview]');
    if (prevBtn) {
      e.preventDefault();
      e.stopPropagation();
      var pid = prevBtn.getAttribute('data-preview');
      if (pid && STYLES[pid]) {
        applyStyleToDOM(pid, true);
      }
      return;
    }

    var card = e.target.closest('.style-card[data-style-card]');
    if (card) {
      var cid = card.getAttribute('data-style-card');
      if (cid && STYLES[cid]) {
        applyStyleToDOM(cid, true);
      }
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) {
      setOpen(false, true);
    }
  });

  // Scroll Progress Bar + 3D Hero Canvas + 3D Polyhedron Cube Controller (from build.html)
  var currentCanvasInstance = null;
  var mx = 0, my = 0, tx = 0, ty = 0;
  var scrollRatio = 0;

  window.addEventListener('pointermove', function (e) {
    var w = window.innerWidth || 1;
    var h = window.innerHeight || 1;
    tx = (e.clientX / w - 0.5) * 2;
    ty = (e.clientY / h - 0.5) * 2;
  }, { passive: true });

  function onScroll() {
    var docH = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    scrollRatio = Math.min(1, Math.max(0, window.scrollY / docH));
    var progBar = document.getElementById('scrollProgBar');
    if (progBar) {
      progBar.style.width = (scrollRatio * 100).toFixed(2) + '%';
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  function mountHeroCanvas() {
    var c = document.getElementById('heroCanvas');
    if (!c || c === currentCanvasInstance) return;
    currentCanvasInstance = c;

    var ctx = c.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = 0, h = 0, t = 0;
    var pts = [];

    function resize() {
      if (!c.isConnected) return;
      w = c.clientWidth || window.innerWidth;
      h = c.clientHeight || window.innerHeight;
      c.width = w * dpr;
      c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    for (var i = 0; i < 95; i++) {
      pts.push({
        x: (Math.random() - 0.5) * 2.4,
        y: (Math.random() - 0.5) * 1.6,
        z: Math.random() * 2 + 0.2,
        s: Math.random() * 1.9 + 0.5,
        kind: i % 3
      });
    }

    function proj(x, y, z) {
      var f = 520 / (z * 260 + 220);
      return [w / 2 + (x + mx * 0.18) * f * 260, h * 0.52 + (y + my * 0.12) * f * 260, f];
    }

    function drawFrame() {
      if (!c.isConnected) {
        currentCanvasInstance = null;
        return;
      }
      var shown = previewStyle || activeStyle;
      var st = (STYLES[shown] || STYLES.vibe).canvas;

      t += 0.006 * (st.speed || 1);
      mx += (tx - mx) * 0.06;
      my += (ty - my) * 0.06;

      var sceneRoot = document.getElementById('scene3dRoot');
      if (sceneRoot) {
        var rx = (-my * 16 + Math.sin(t * 1.4) * 4).toFixed(2);
        var ry = (mx * 22 + Math.cos(t * 1.1) * 6).toFixed(2);
        var tz = (Math.sin(t * 1.8) * 10 - scrollRatio * 40).toFixed(2);
        sceneRoot.style.transform = 'translate3d(0,' + (scrollRatio * -28).toFixed(1) + 'px,' + tz + 'px) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg)';
      }

      ctx.clearRect(0, 0, w, h);

      var g = ctx.createRadialGradient(w * (0.5 + mx * 0.08), h * (0.42 + my * 0.06), 10, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
      g.addColorStop(0, 'rgba(' + st.accentRgb + ',0.13)');
      g.addColorStop(0.45, 'rgba(' + st.secRgb + ',0.05)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      var ga = st.gridAlpha || 0.25;
      ctx.strokeStyle = 'rgba(' + st.gridRgb + ',' + (ga * 0.35).toFixed(3) + ')';
      ctx.lineWidth = 1;
      var rows = 14, cols = 16;
      for (var r = 1; r <= rows; r++) {
        var z = ((r / rows + (t * 0.35) % (1 / rows))) * 2.2;
        var p1 = proj(-1.8, 0.55, z), p2 = proj(1.8, 0.55, z);
        ctx.strokeStyle = 'rgba(' + st.gridRgb + ',' + ((1 - z / 2.3) * ga).toFixed(3) + ')';
        ctx.beginPath();
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(' + st.gridRgb + ',' + (ga * 0.32).toFixed(3) + ')';
      for (var k = -cols / 2; k <= cols / 2; k++) {
        var x = (k / (cols / 2)) * 1.8;
        var a = proj(x, 0.55, 0.15), b = proj(x, 0.55, 2.2);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }

      for (var idx = 0; idx < pts.length; idx++) {
        var p = pts[idx];
        p.z -= 0.0035 * (st.speed || 1);
        if (p.z < 0.15) p.z = 2.2;
        var pr = proj(p.x, p.y - 0.1, p.z);
        var alpha = Math.max(0, Math.min(1, (2.2 - p.z) / 1.8)) * 0.78;
        var rgb = p.kind === 0 ? st.accentRgb : (p.kind === 1 ? st.secRgb : st.gridRgb);
        ctx.fillStyle = 'rgba(' + rgb + ',' + alpha.toFixed(3) + ')';
        ctx.strokeStyle = 'rgba(' + rgb + ',' + (alpha * 0.9).toFixed(3) + ')';
        var rad = Math.max(0.8, p.s * pr[2] * 1.35);

        if (st.particleShape === 'square') {
          ctx.fillRect(pr[0] - rad, pr[1] - rad, rad * 2, rad * 2);
        } else if (st.particleShape === 'ring') {
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(pr[0], pr[1], rad * 1.2, 0, Math.PI * 2);
          ctx.stroke();
        } else if (st.particleShape === 'bubble') {
          ctx.beginPath();
          ctx.arc(pr[0], pr[1], rad * 1.45, 0, Math.PI * 2);
          ctx.fill();
        } else if (st.particleShape === 'prism') {
          ctx.beginPath();
          ctx.moveTo(pr[0], pr[1] - rad * 1.5);
          ctx.lineTo(pr[0] + rad * 1.4, pr[1] + rad * 1.1);
          ctx.lineTo(pr[0] - rad * 1.4, pr[1] + rad * 1.1);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(pr[0], pr[1], rad, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      requestAnimationFrame(drawFrame);
    }

    requestAnimationFrame(drawFrame);
  }

  function initExperience() {
    applyStyleToDOM(activeStyle, false);
    onScroll();
    mountHeroCanvas();

    var appEl = document.getElementById('app');
    if (appEl && typeof MutationObserver !== 'undefined') {
      var obs = new MutationObserver(function () {
        syncStyleUI();
        mountHeroCanvas();
      });
      obs.observe(appEl, { childList: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExperience);
  } else {
    initExperience();
  }

  window.XAMCODE_3D_EXPERIENCE_THEMES = XAMCODE_3D_EXPERIENCE_THEMES;
  window.XAMCODE_BUILD_STYLES = STYLES;
  window.applyXamCode3DTheme = applyXamCode3DTheme;
  window.applyBuildStyle = function (styleId) { return applyStyleToDOM(styleId, false); };
})();
