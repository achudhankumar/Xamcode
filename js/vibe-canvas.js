/**
 * js/vibe-canvas.js
 * Interactive 3D depth particle background canvas that adapts to the active 3D Experience Theme.
 */
(function initVibeParticleCanvas() {
  if (typeof document === 'undefined') return;
  window.addEventListener('DOMContentLoaded', () => {
    let canvas = document.getElementById('xc-particle-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'xc-particle-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      document.body.prepend(canvas);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = null;
    let isContextLost = false;

    /* WebGL & 2D Canvas Context Loss & Restore Resilience */
    const onLost = (e) => {
      try { e.preventDefault(); } catch (x) {}
      isContextLost = true;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    };
    const onRestored = () => {
      isContextLost = false;
      resize();
      if (!document.hidden && !rafId) {
        rafId = requestAnimationFrame(draw);
      }
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    canvas.addEventListener('contextlost', onLost);
    canvas.addEventListener('contextrestored', onRestored);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    const nodes = Array.from({ length: 38 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      r: 1.4 + Math.random() * 1.8
    }));

    function draw() {
      rafId = null;
      if (isContextLost || document.hidden || !canvas.isConnected) return;

      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);
      const accent =
        getComputedStyle(document.documentElement).getPropertyValue('--xc-accent-primary').trim() ||
        '#00F0FF';
      ctx.fillStyle = accent;
      ctx.strokeStyle = accent;

      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        a.x = (a.x + a.vx + w) % w;
        a.y = (a.y + a.vy + h) % h;
        ctx.globalAlpha = 0.42;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
        ctx.fill();

        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 135) {
            ctx.globalAlpha = (1 - dist / 135) * 0.14;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;

      if (!document.hidden && !isContextLost && canvas.isConnected) {
        rafId = requestAnimationFrame(draw);
      }
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      } else if (!isContextLost && canvas.isConnected && !rafId) {
        rafId = requestAnimationFrame(draw);
      }
    });

    if (!document.hidden) {
      rafId = requestAnimationFrame(draw);
    }
  });
})();
