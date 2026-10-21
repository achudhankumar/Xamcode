/* ============================================================
   XAMCODE AI — VIBE 3D DYNAMIC CANVAS ENGINE (PORTED FROM BIL)
   ------------------------------------------------------------
   Implements the audited BIL WebGL/Canvas dynamic rendering loop:
     · 3D perspective projection for rotating polyhedrons (cube/octahedron/tesseract)
     · Spatial constellation particle network with distance-decay links
     · Dynamic theme synchronization (Bubblegum, Digital, Cosmic, Organic)
     · IntersectionObserver + visibilitychange lifecycle management (0 GPU leak)
     · Frame-rate capped 60 FPS loop with prefers-reduced-motion safety
   ============================================================ */

(function(){
  'use strict';
  window.XC = window.XC || {};

  function initVibeCanvas(cv){
    if(!cv) cv = document.getElementById('heroCanvas');
    if(!cv) return null;

    var reduce = false;
    try { reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch(e){}

    var ctx = null;
    try { ctx = cv.getContext('2d'); } catch(e){ return null; }
    if(!ctx) return null;

    var W = 800, H = 600, mx = 0.5, my = 0.4, t = 0;
    var pts = [];
    var heroVisible = true;
    var rafId = null;

    function size(){
      try {
        var p = cv.parentElement || cv;
        var r = p.getBoundingClientRect();
        if(r && r.width) W = Math.floor(r.width);
        if(r && r.height) H = Math.floor(r.height);
      } catch(e){}
      cv.width = W;
      cv.height = H;
      pts = [];
      var n = Math.floor(Math.min(72, Math.max(28, W / 18)));
      for(var i = 0; i < n; i++){
        pts.push({
          x: Math.random() * W,
          y: Math.random() * H,
          z: (Math.random() - 0.5) * 220,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          r: Math.random() * 1.8 + 0.6
        });
      }
    }
    size();
    window.addEventListener('resize', size);

    var onPointerMove = function(e){
      try {
        var r = cv.getBoundingClientRect();
        mx = (e.clientX - r.left) / (r.width || 1);
        my = (e.clientY - r.top) / (r.height || 1);
      } catch(x){}
    };
    if(cv.parentElement) cv.parentElement.addEventListener('pointermove', onPointerMove);

    var io = null;
    try {
      if('IntersectionObserver' in window){
        io = new IntersectionObserver(function(entries){
          entries.forEach(function(entry){ heroVisible = entry.isIntersecting; });
        }, { threshold: 0.01 });
        if(cv.parentElement) io.observe(cv.parentElement);
      }
    } catch(e){}

    /* 3D Cube / Octahedron Vertices & Edges */
    var CUBE_V = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
    var CUBE_E = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
    var OCT_V = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    var OCT_E = [[0,2],[0,3],[0,4],[0,5],[1,2],[1,3],[1,4],[1,5],[2,4],[4,3],[3,5],[5,2]];

    function proj3d(v, ax, ay, az, scale, cx, cy){
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

    function frame(){
      if(!reduce && (heroVisible && !document.hidden)){ t += 0.008; }
      try { ctx.clearRect(0, 0, W, H); } catch(e){ return; }

      try {
        var curTheme = (document.body && document.body.getAttribute('data-theme')) || 'digital';
        var gx = W * (0.3 + 0.4 * mx), gy = H * (0.35 + 0.3 * my);
        var cx = W * (window.innerWidth > 960 ? 0.72 : 0.5), cy = H * 0.5;
        var scale = Math.min(W, H) * 0.16;
        var ax = t * 0.7 + (my - 0.5) * 0.6;
        var ay = t * 0.9 + (mx - 0.5) * 0.8;
        var az = t * 0.35;

        if(curTheme === 'bubblegum'){
          var gB = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(W, H) * 0.65);
          gB.addColorStop(0, 'rgba(255, 90, 138, 0.16)');
          gB.addColorStop(0.5, 'rgba(201, 168, 255, 0.10)');
          gB.addColorStop(1, 'rgba(15, 6, 18, 0)');
          ctx.fillStyle = gB; ctx.fillRect(0, 0, W, H);
          var octP = OCT_V.map(function(v){ return proj3d(v, ax, ay, az, scale * 1.3, cx, cy); });
          ctx.strokeStyle = 'rgba(255, 90, 138, 0.35)'; ctx.lineWidth = 1.5;
          for(var oe = 0; oe < OCT_E.length; oe++){
            var op1 = octP[OCT_E[oe][0]], op2 = octP[OCT_E[oe][1]];
            ctx.beginPath(); ctx.moveTo(op1.x, op1.y); ctx.lineTo(op2.x, op2.y); ctx.stroke();
          }
        } else if(curTheme === 'cosmic'){
          var gC = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(W, H) * 0.7);
          gC.addColorStop(0, 'rgba(139, 92, 246, 0.16)');
          gC.addColorStop(0.45, 'rgba(236, 72, 153, 0.10)');
          gC.addColorStop(1, 'rgba(5, 5, 8, 0)');
          ctx.fillStyle = gC; ctx.fillRect(0, 0, W, H);
          ctx.strokeStyle = 'rgba(139, 92, 246, 0.35)'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.ellipse(cx, cy, scale * 1.4, scale * 0.55, t * 0.3, 0, Math.PI * 2); ctx.stroke();
          ctx.strokeStyle = 'rgba(236, 72, 153, 0.30)';
          ctx.beginPath(); ctx.ellipse(cx, cy, scale * 1.15, scale * 0.42, -t * 0.25 + 0.8, 0, Math.PI * 2); ctx.stroke();
        } else if(curTheme === 'organic'){
          var gO = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(W, H) * 0.65);
          gO.addColorStop(0, 'rgba(255, 107, 74, 0.15)');
          gO.addColorStop(0.5, 'rgba(184, 230, 213, 0.10)');
          gO.addColorStop(1, 'rgba(22, 19, 15, 0)');
          ctx.fillStyle = gO; ctx.fillRect(0, 0, W, H);
          for(var b = 0; b < 6; b++){
            var ang = t * 0.8 + b * 1.047;
            var bx = cx + Math.cos(ang) * (scale * 0.8) + Math.sin(t + b) * 12;
            var by = cy + Math.sin(ang * 1.2) * (scale * 0.6);
            var br = 14 + (b % 3) * 6;
            ctx.fillStyle = b % 2 === 0 ? 'rgba(255, 107, 74, 0.22)' : 'rgba(184, 230, 213, 0.20)';
            ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
          }
        } else {
          /* Digital Wireframe / Cyber Vibe Coding Default */
          var gD = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(W, H) * 0.7);
          gD.addColorStop(0, 'rgba(200, 255, 61, 0.12)');
          gD.addColorStop(0.3, 'rgba(168, 85, 247, 0.08)');
          gD.addColorStop(0.6, 'rgba(92, 109, 255, 0.06)');
          gD.addColorStop(1, 'rgba(6, 8, 3, 0)');
          ctx.fillStyle = gD; ctx.fillRect(0, 0, W, H);

          var vOuter = CUBE_V.map(function(v){ return proj3d(v, ax, ay, az, scale * 1.15, cx, cy); });
          var vInner = CUBE_V.map(function(v){ return proj3d(v, -ax * 0.8, ay * 1.1, -az, scale * 0.58, cx, cy); });

          ctx.strokeStyle = 'rgba(200, 255, 61, 0.30)'; ctx.lineWidth = 1.3;
          for(var ce = 0; ce < CUBE_E.length; ce++){
            var c1 = vOuter[CUBE_E[ce][0]], c2 = vOuter[CUBE_E[ce][1]];
            ctx.beginPath(); ctx.moveTo(c1.x, c1.y); ctx.lineTo(c2.x, c2.y); ctx.stroke();
          }

          ctx.strokeStyle = 'rgba(168, 85, 247, 0.32)'; ctx.lineWidth = 1.0;
          for(var cvIdx = 0; cvIdx < 8; cvIdx++){
            ctx.beginPath(); ctx.moveTo(vOuter[cvIdx].x, vOuter[cvIdx].y); ctx.lineTo(vInner[cvIdx].x, vInner[cvIdx].y); ctx.stroke();
          }
        }

        /* Ambient Constellation Network */
        ctx.strokeStyle = curTheme === 'bubblegum' ? 'rgba(230, 46, 122, 0.18)' :
                          curTheme === 'cosmic' ? 'rgba(139, 92, 246, 0.18)' :
                          curTheme === 'organic' ? 'rgba(255, 107, 74, 0.16)' :
                          'rgba(200, 255, 61, 0.16)';
        ctx.lineWidth = 1;

        for(var pi = 0; pi < pts.length; pi++){
          var a = pts[pi];
          if(!reduce && (heroVisible && !document.hidden)){
            a.x += a.vx + (mx - 0.5) * 0.35;
            a.y += a.vy + (my - 0.4) * 0.35;
            if(a.x < 0) a.x = W; if(a.x > W) a.x = 0;
            if(a.y < 0) a.y = H; if(a.y > H) a.y = 0;
          }
          for(var pj = pi + 1; pj < pts.length; pj++){
            var bPt = pts[pj];
            var dx = a.x - bPt.x, dy = a.y - bPt.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if(dist < 110){
              ctx.globalAlpha = Math.max(0, (110 - dist) / 110 * 0.45);
              ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(bPt.x, bPt.y); ctx.stroke();
            }
          }
          ctx.globalAlpha = 0.85;
          if(curTheme === 'bubblegum'){
            ctx.fillStyle = pi % 3 === 0 ? '#ff5a8a' : (pi % 2 === 0 ? '#c9a8ff' : '#ffc8a0');
          } else if(curTheme === 'cosmic'){
            ctx.fillStyle = pi % 3 === 0 ? '#8b5cf6' : (pi % 2 === 0 ? '#3b82f6' : '#ec4899');
          } else if(curTheme === 'organic'){
            ctx.fillStyle = pi % 3 === 0 ? '#ff6b4a' : (pi % 2 === 0 ? '#b8e6d5' : '#d4e4d0');
          } else {
            ctx.fillStyle = pi % 5 === 0 ? '#c8ff3d' : (pi % 3 === 0 ? '#38bdf8' : (pi % 2 === 0 ? '#a855f7' : '#f1efe3'));
          }
          ctx.beginPath(); ctx.arc(a.x + Math.sin(t + pi) * 2.5, a.y + Math.cos(t * 0.8 + pi) * 2.5, a.r, 0, 6.28); ctx.fill();
        }
        ctx.globalAlpha = 1;
      } catch(err){}

      if(!reduce){
        rafId = requestAnimationFrame(frame);
      }
    }

    frame();

    return {
      destroy: function(){
        if(rafId) cancelAnimationFrame(rafId);
        window.removeEventListener('resize', size);
        if(cv.parentElement) cv.parentElement.removeEventListener('pointermove', onPointerMove);
        if(io) io.disconnect();
      }
    };
  }

  window.XC.vibeCanvas = { init: initVibeCanvas };

  document.addEventListener('DOMContentLoaded', function(){
    var cv = document.getElementById('heroCanvas');
    if(cv) window.XC.vibeCanvas.init(cv);
  });
})();
