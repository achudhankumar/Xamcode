/**
 * js/theme-studio-3d.js
 * XamCode Build-in-Public 5-Style 3D Experience Engine (ported verbatim from build.html)
 * + V2 3D Experience Theme Studio compatibility bridge.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'xamcode_bip_style';
  var LEGACY_KEY = 'xamcode_experience_style_v2';
  var V2_STORAGE_KEY = 'xc_3d_theme';
  var ORDER = ['vibe', 'bubblegum', 'glass', 'brutalist', 'minimal'];

  var STYLES = {
    vibe: {
      id: 'vibe',
      name: 'Vibe Coding Studio',
      short: 'Vibe Studio',
      mode: 'dark'
    },
    bubblegum: {
      id: 'bubblegum',
      name: 'Bubblegum Playground',
      short: 'Bubblegum',
      mode: 'light'
    },
    glass: {
      id: 'glass',
      name: 'Liquid Glass 3D',
      short: 'Liquid Glass',
      mode: 'dark'
    },
    brutalist: {
      id: 'brutalist',
      name: 'Neo-Brutalist Creative Lab',
      short: 'Neo-Brutalist',
      mode: 'light'
    },
    minimal: {
      id: 'minimal',
      name: 'Soft Minimal Studio',
      short: 'Soft Minimal',
      mode: 'light'
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
      vars: { '--xc-bg-deep': '#fff2f7', '--xc-accent-primary': '#e62e7a', '--xc-accent-secondary': '#9333ea' }
    },
    'solaris-chrono': {
      id: 'solaris-chrono',
      name: 'Solaris Glass Studio',
      tagline: 'Warm titanium & amber daylight-balanced 3D academic studio',
      vars: { '--xc-bg-deep': '#faf8f5', '--xc-accent-primary': '#b4532a', '--xc-accent-secondary': '#23533d' }
    },
    'abyssal-prism': {
      id: 'abyssal-prism',
      name: 'Abyssal Prism 3D',
      tagline: 'Deep ocean sapphire with chromatic aberration edge highlights',
      vars: { '--xc-bg-deep': '#040914', '--xc-accent-primary': '#38bdf8', '--xc-accent-secondary': '#6366f1' }
    },
    'obsidian-monolith': {
      id: 'obsidian-monolith',
      name: 'Obsidian Monolith',
      tagline: 'Zero-distraction carbon black with surgical gold telemetry',
      vars: { '--xc-bg-deep': '#f4f0e6', '--xc-accent-primary': '#ffe600', '--xc-accent-secondary': '#ff4d00' }
    }
  };

  var savedStyle = 'vibe';
  try {
    var raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY);
    if (raw && STYLES[raw]) savedStyle = raw;
  } catch (e) {}

  var activeStyle = savedStyle;
  var previewStyle = null;
  var isOpen = false;

  function syncStyleUI() {
    var shown = previewStyle || activeStyle;
    var cfg = STYLES[shown] || STYLES.vibe;
    var activeCfg = STYLES[activeStyle] || STYLES.vibe;
    var badge = document.getElementById('styleCurrentBadge');
    if (badge) {
      badge.textContent = previewStyle && previewStyle !== activeStyle
        ? (cfg.short + ' · Preview')
        : activeCfg.short;
    }
    var statusTxt = document.getElementById('styleStatusText');
    if (statusTxt) {
      statusTxt.textContent = previewStyle && previewStyle !== activeStyle
        ? ('Previewing: ' + cfg.name + ' (Active: ' + activeCfg.short + ') · Click Apply to save')
        : ('Active: ' + activeCfg.name + ' · Select a card to preview or apply');
    }
    var cards = document.querySelectorAll('.style-card[data-style-card]');
    cards.forEach(function (card) {
      var cid = card.getAttribute('data-style-card');
      var isAct = (cid === activeStyle);
      var isPrev = (cid === shown);
      card.classList.toggle('is-active', isAct);
      card.classList.toggle('is-previewing', isPrev);
      card.setAttribute('aria-checked', isAct ? 'true' : 'false');
      card.setAttribute('tabindex', isPrev ? '0' : '-1');
      var statePill = card.querySelector('[data-badge-for]');
      if (statePill) {
        statePill.textContent = isAct ? 'Active' : (isPrev ? 'Previewing' : 'Available');
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
      if (previewStyle !== activeStyle) {
        document.body.setAttribute('data-style-preview', 'true');
      } else {
        document.body.removeAttribute('data-style-preview');
      }
    } else {
      activeStyle = styleId;
      previewStyle = null;
      document.body.removeAttribute('data-style-preview');
      try {
        localStorage.setItem(STORAGE_KEY, styleId);
        localStorage.setItem(LEGACY_KEY, styleId);
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

  // ==========================================================================
  // Exact 3D Hero Canvas & 3D Stage Controller from build.html (lines 3790-3942)
  // ==========================================================================
  var currentCanvasInstance = null;
  var mx = 0.5, my = 0.5;

  function onScroll() {
    var docH = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    var scrollRatio = Math.min(1, Math.max(0, window.scrollY / docH));
    var progBar = document.getElementById('scrollProgBar');
    if (progBar) {
      progBar.style.width = (scrollRatio * 100).toFixed(2) + '%';
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  var CUBE_V = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
  var CUBE_E = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  var OCT_V  = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  var OCT_E  = [[0,2],[0,3],[0,4],[0,5],[1,2],[1,3],[1,4],[1,5],[2,4],[4,3],[3,5],[5,2]];

  function proj3d(v, ax, ay, az, scale, cx, cy) {
    var x = v[0], y = v[1], z = v[2];
    var cy1 = Math.cos(ay), sy1 = Math.sin(ay);
    var x1 = x * cy1 - z * sy1, z1 = z * cy1 + x * sy1;
    var cx1 = Math.cos(ax), sx1 = Math.sin(ax);
    var y2 = y * cx1 - z1 * sx1, z2 = z1 * cx1 + y * sx1;
    var cz1 = Math.cos(az), sz1 = Math.sin(az);
    var x3 = x1 * cz1 - y2 * sz1, y3 = y2 * cz1 + x1 * sz1;
    var fov = 380 / (380 + z2 * scale * 0.45);
    return { x: cx + x3 * scale * fov, y: cy + y3 * scale * fov, z: z2, s: fov };
  }

  function mountHeroCanvas() {
    var cv = document.getElementById('heroCanvas');
    if (!cv || cv === currentCanvasInstance) return;
    currentCanvasInstance = cv;

    var ctx = cv.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, t = 0;
    var pts = [];
    var rafId = null, isContextLost = false;

    /* WebGL & Canvas 2D Context Resilience */
    function onLost(e) {
      try { e.preventDefault(); } catch (x) {}
      isContextLost = true;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    }
    function onRestored() {
      isContextLost = false;
      resize();
      if (cv.isConnected && !document.hidden && !rafId) {
        rafId = requestAnimationFrame(frame);
      }
    }
    cv.addEventListener('webglcontextlost', onLost);
    cv.addEventListener('webglcontextrestored', onRestored);
    cv.addEventListener('contextlost', onLost);
    cv.addEventListener('contextrestored', onRestored);

    function resize() {
      if (!cv.isConnected) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var parent = cv.parentElement || document.body;
      W = parent.clientWidth || window.innerWidth;
      H = parent.clientHeight || 680;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    for (var i = 0; i < 42; i++) {
      pts.push({
        x: Math.random() * (W || 1200),
        y: Math.random() * (H || 700),
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: 1.3 + Math.random() * 1.6
      });
    }

    if (cv.parentElement) {
      cv.parentElement.addEventListener('pointermove', function (e) {
        var r = cv.getBoundingClientRect();
        mx = (e.clientX - r.left) / (r.width || 1);
        my = (e.clientY - r.top) / (r.height || 1);
        var stageRoot = document.getElementById('scene3dRoot');
        if (stageRoot && window.innerWidth > 900) {
          var rx = (-16 + (0.5 - my) * 18).toFixed(2) + 'deg';
          var ry = (28 + (mx - 0.5) * 26).toFixed(2) + 'deg';
          stageRoot.style.setProperty('--rx', rx);
          stageRoot.style.setProperty('--ry', ry);
        }
      }, { passive: true });
    }

    function onVisibility() {
      if (document.hidden) {
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      } else if (cv.isConnected && !isContextLost && !rafId) {
        rafId = requestAnimationFrame(frame);
      }
    }
    document.addEventListener('visibilitychange', onVisibility);

    function frame() {
      rafId = null;
      if (!cv.isConnected) {
        currentCanvasInstance = null;
        document.removeEventListener('visibilitychange', onVisibility);
        return;
      }
      if (isContextLost || document.hidden) return;
      t += 0.008;
      ctx.clearRect(0, 0, W, H);

      var curStyle = (document.body && document.body.getAttribute('data-style')) || 'vibe';
      var isMobile = W < 680;
      var gx = W * (0.3 + 0.4 * mx), gy = H * (0.35 + 0.3 * my);
      var cx = W * (isMobile ? 0.5 : (window.innerWidth > 960 ? 0.74 : 0.5));
      var cy = H * (isMobile ? 0.46 : 0.5);
      var scale = Math.min(W, H) * (isMobile ? 0.19 : 0.16);
      var ax = t * 0.7 + (my - 0.5) * 0.6, ay = t * 0.9 + (mx - 0.5) * 0.8, az = t * 0.35;

      if (curStyle === 'bubblegum') {
        var gB = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(W, H) * 0.65);
        gB.addColorStop(0, 'rgba(255,107,157,.18)');
        gB.addColorStop(0.5, 'rgba(192,132,252,.12)');
        gB.addColorStop(1, 'rgba(255,242,247,0)');
        ctx.fillStyle = gB;
        ctx.fillRect(0, 0, W, H);
        for (var b = 0; b < 10; b++) {
          var ang = t * 0.8 + b * 0.628;
          var bx = W * 0.5 + Math.cos(ang) * (W * 0.28) + Math.sin(t + b) * 20;
          var by = H * 0.48 + Math.sin(ang * 1.3) * (H * 0.22);
          var br = 12 + (b % 4) * 7;
          var bg = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.3, 1, bx, by, br);
          bg.addColorStop(0, '#ffffff');
          bg.addColorStop(0.4, b % 3 === 0 ? '#ff85b3' : (b % 2 === 0 ? '#c084fc' : '#7dd3fc'));
          bg.addColorStop(1, b % 3 === 0 ? 'rgba(230,46,122,.25)' : 'rgba(124,58,237,.22)');
          ctx.fillStyle = bg;
          ctx.beginPath();
          ctx.arc(bx, by, br, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (curStyle === 'glass') {
        var gG = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(W, H) * 0.7);
        gG.addColorStop(0, 'rgba(56,189,248,.16)');
        gG.addColorStop(0.45, 'rgba(168,85,247,.10)');
        gG.addColorStop(1, 'rgba(3,8,22,0)');
        ctx.fillStyle = gG;
        ctx.fillRect(0, 0, W, H);
        var octP = OCT_V.map(function (v) { return proj3d(v, ax, ay, az, scale * 1.35, cx, cy); });
        ctx.strokeStyle = 'rgba(125,211,252,.38)';
        ctx.lineWidth = 1.5;
        for (var oe = 0; oe < OCT_E.length; oe++) {
          var p1 = octP[OCT_E[oe][0]], p2 = octP[OCT_E[oe][1]];
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      } else if (curStyle === 'brutalist') {
        ctx.strokeStyle = 'rgba(13,13,13,.22)';
        ctx.lineWidth = 2;
        var bCube = CUBE_V.map(function (v) { return proj3d(v, ax * 0.6, ay * 0.6, 0, scale * 1.15, cx, cy); });
        for (var be = 0; be < CUBE_E.length; be++) {
          var bp1 = bCube[CUBE_E[be][0]], bp2 = bCube[CUBE_E[be][1]];
          ctx.beginPath();
          ctx.moveTo(bp1.x, bp1.y);
          ctx.lineTo(bp2.x, bp2.y);
          ctx.stroke();
        }
      } else if (curStyle === 'minimal') {
        ctx.strokeStyle = 'rgba(24,24,22,.14)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, scale * 1.3, scale * 0.55, t * 0.3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(180,83,42,.22)';
        ctx.beginPath();
        ctx.ellipse(cx, cy, scale * 1.05, scale * 0.42, -t * 0.25 + 0.8, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        var g = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(W, H) * 0.7);
        g.addColorStop(0, 'rgba(200,255,61,.10)');
        g.addColorStop(0.3, 'rgba(168,85,247,.05)');
        g.addColorStop(0.6, 'rgba(91,108,255,.06)');
        g.addColorStop(1, 'rgba(11,14,7,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        var vOuter = CUBE_V.map(function (v) { return proj3d(v, ax, ay, az, scale * 1.1, cx, cy); });
        var vInner = CUBE_V.map(function (v) { return proj3d(v, -ax * 0.8, ay * 1.1, -az, scale * 0.55, cx, cy); });
        ctx.strokeStyle = 'rgba(200,255,61,.24)';
        ctx.lineWidth = 1.2;
        for (var ce = 0; ce < CUBE_E.length; ce++) {
          var c1 = vOuter[CUBE_E[ce][0]], c2 = vOuter[CUBE_E[ce][1]];
          ctx.beginPath();
          ctx.moveTo(c1.x, c1.y);
          ctx.lineTo(c2.x, c2.y);
          ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(168,85,247,.26)';
        for (var cvIdx = 0; cvIdx < 8; cvIdx++) {
          ctx.beginPath();
          ctx.moveTo(vOuter[cvIdx].x, vOuter[cvIdx].y);
          ctx.lineTo(vInner[cvIdx].x, vInner[cvIdx].y);
          ctx.stroke();
        }
      }

      /* Ambient 3D Constellation Nodes */
      ctx.strokeStyle = curStyle === 'minimal' ? 'rgba(24,24,22,.08)' : (curStyle === 'brutalist' ? 'rgba(13,13,13,.12)' : (curStyle === 'bubblegum' ? 'rgba(230,46,122,.14)' : 'rgba(200,255,61,.15)'));
      ctx.lineWidth = 1;
      for (var pIdx = 0; pIdx < pts.length; pIdx++) {
        var a = pts[pIdx];
        a.x += a.vx + (mx - 0.5) * 0.35;
        a.y += a.vy + (my - 0.4) * 0.35;
        if (a.x < 0) a.x = W;
        if (a.x > W) a.x = 0;
        if (a.y < 0) a.y = H;
        if (a.y > H) a.y = 0;
        for (var j = pIdx + 1; j < pts.length; j++) {
          var bPt = pts[j];
          var dx = a.x - bPt.x, dy = a.y - bPt.y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < 115) {
            ctx.globalAlpha = Math.max(0, (115 - d) / 115 * 0.42);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(bPt.x, bPt.y);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 0.85;
        if (curStyle === 'minimal') {
          ctx.fillStyle = pIdx % 3 === 0 ? '#b4532a' : '#23533d';
        } else if (curStyle === 'brutalist') {
          ctx.fillStyle = pIdx % 3 === 0 ? '#ff4d00' : '#0d0d0d';
        } else if (curStyle === 'bubblegum') {
          ctx.fillStyle = pIdx % 3 === 0 ? '#e62e7a' : (pIdx % 2 === 0 ? '#9333ea' : '#0284c7');
        } else if (curStyle === 'glass') {
          ctx.fillStyle = pIdx % 3 === 0 ? '#38bdf8' : '#c084fc';
        } else {
          ctx.fillStyle = pIdx % 7 === 0 ? '#f97316' : (pIdx % 5 === 0 ? '#c084fc' : (pIdx % 3 === 0 ? '#C8FF3D' : 'rgba(241,239,227,.7)'));
        }
        ctx.beginPath();
        ctx.arc(a.x + Math.sin(t + pIdx) * 3, a.y + Math.cos(t * 0.8 + pIdx) * 3, a.r, 0, 7);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (cv.isConnected && !isContextLost && !document.hidden) {
        rafId = requestAnimationFrame(frame);
      }
    }

    if (cv.isConnected && !isContextLost && !document.hidden) {
      rafId = requestAnimationFrame(frame);
    }
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
