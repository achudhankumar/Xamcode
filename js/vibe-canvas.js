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
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const nodes = Array.from({ length: 38 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      r: 1.4 + Math.random() * 1.8
    }));

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const accent =
        getComputedStyle(document.documentElement).getPropertyValue('--xc-accent-primary').trim() ||
        '#00F0FF';
      ctx.fillStyle = accent;
      ctx.strokeStyle = accent;

      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        a.x = (a.x + a.vx + canvas.width) % canvas.width;
        a.y = (a.y + a.vy + canvas.height) % canvas.height;
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
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  });
})();
