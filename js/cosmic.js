/* ============================================================
   COSMIC FIELD — canvas layer for the cosmic theme
   ------------------------------------------------------------
   Layer 1 of the cosmic stack (see css/scenes.css). Draws, in
   one rAF loop:

     · 200 twinkling stars   opacity .2 → .9, twinkle .005–.02
     · shooting stars        ~0.8% spawn chance per frame,
                             80–140px streak, speed 12–18
     · 3 nebula blobs        700px, #8B5CF6 / #3B82F6 / #EC4899,
                             18% opacity, pulse .98 → 1.02
     · 60 orbital dust       motes circling the viewport centre

   Progressive enhancement only, and it parks itself completely on
   every non-cosmic theme: the rAF is cancelled and the loop
   stops, so the other three themes pay nothing for it. Reduced
   motion and a hidden tab both halt it too.

   Safe to delete along with its <canvas> and #cosmicOrbits in
   XamCode.html — cosmic then falls back to the plain background.
   ============================================================ */
(function(){
  'use strict';

  var canvas = document.getElementById('cosmicCanvas');
  if(!canvas) return;
  var ctx = canvas.getContext('2d');
  if(!ctx) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- tunables (the reference spec, in one place) ---------- */
  var STAR_COUNT   = 200;
  var DUST_COUNT   = 60;
  var SHOOT_CHANCE = 0.008;      // per frame
  var SHOOT_MAX    = 4;          // concurrent streaks
  var NEBULA_BLUR  = 120;        // px
  var NEBULA       = [
    { c:'139,92,246', x:0.22, y:0.26, s:0.00013 },
    { c:'59,130,246',  x:0.78, y:0.38, s:0.00017 },
    { c:'236,72,153',  x:0.52, y:0.82, s:0.00011 }
  ];

  var w = 0, h = 0, dpr = 1;
  var stars = [], dust = [], shoots = [];
  var raf = null, t = 0;

  function rand(a, b){ return a + Math.random() * (b - a); }

  /* ---------- sizing ---------- */
  function resize(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width  = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  }

  /* Rebuild every particle. Positions are stored as fractions of
     the viewport where it makes sense, so a resize redistributes
     them proportionally instead of piling them on one edge. */
  function build(){
    var i, s;
    stars = [];
    for(i = 0; i < STAR_COUNT; i++){
      s = {
        x: Math.random() * w,
        y: Math.random() * h,
        r: rand(0.3, 1.5),
        a: rand(0.2, 0.9),      // current alpha, the twinkle rides this
        tw: rand(0.005, 0.02),  // alpha units per frame
        dir: Math.random() < 0.5 ? -1 : 1
      };
      stars.push(s);
    }
    dust = [];
    for(i = 0; i < DUST_COUNT; i++){
      dust.push({
        /* elliptical orbit around the centre, so the field reads
           as a tilted disc rather than a flat ring */
        ang: Math.random() * Math.PI * 2,
        rad: rand(0.18, 0.72),
        sp: rand(0.0006, 0.0022) * (Math.random() < 0.5 ? -1 : 1),
        r: rand(0.4, 1.3),
        a: rand(0.1, 0.5),
        tilt: rand(0.42, 0.68)
      });
    }
    shoots.length = 0;
  }

/* ---------- painting ---------- */

  function drawNebula(){
    /* Soft-edged radial fills read as a 120px blur and are far
       cheaper than a real canvas filter, which would re-blur the
       whole surface every frame. */
    for(var i = 0; i < NEBULA.length; i++){
      var n = NEBULA[i];
      var pulse = 1 + Math.sin(t * n.s) * 0.02;      // .98 → 1.02
      var cx = n.x * w, cy = n.y * h;
      var r = NEBULA_BLUR * 3 * pulse;               // ~700px field
      var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0,    'rgba(' + n.c + ',0.18)');
      g.addColorStop(0.45, 'rgba(' + n.c + ',0.07)');
      g.addColorStop(1,    'rgba(' + n.c + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawStars(){
    for(var i = 0; i < stars.length; i++){
      var s = stars[i];
      /* twinkle: walk the alpha between the .2 and .9 bounds and
         reverse at the edges, so it never leaves its range */
      s.a += s.tw * s.dir;
      if(s.a >= 0.9){ s.a = 0.9; s.dir = -1; }
      if(s.a <= 0.2){ s.a = 0.2; s.dir =  1; }
      ctx.globalAlpha = s.a;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawDust(){
    var cx = w / 2, cy = h / 2;
    var base = Math.min(w, h) * 0.5;
    for(var i = 0; i < dust.length; i++){
      var d = dust[i];
      d.ang += d.sp;
      var x = cx + Math.cos(d.ang) * d.rad * base;
      var y = cy + Math.sin(d.ang) * d.rad * base * d.tilt;
      ctx.globalAlpha = d.a;
      ctx.fillStyle = 'rgba(196,181,253,1)';
      ctx.beginPath();
      ctx.arc(x, y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawShoots(){
    for(var i = shoots.length - 1; i >= 0; i--){
      var s = shoots[i];
      s.x += s.vx;
      s.y += s.vy;
      s.life -= 0.012;
      /* the streak is a line back along the travel vector, faded
         out at the tail with a gradient */
      var tailX = s.x - s.vx * s.len / 12;
      var tailY = s.y - s.vy * s.len / 12;
      var g = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
      g.addColorStop(0,   'rgba(255,255,255,' + Math.max(0, s.life).toFixed(3) + ')');
      g.addColorStop(1,   'rgba(255,255,255,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();
      if(s.life <= 0 || s.x < -200 || s.x > w + 200 || s.y < -200 || s.y > h + 200){
        shoots.splice(i, 1);
      }
    }
  }

  function spawnShoot(){
    /* fire from the upper band, angled down-right, like the
       reference streaks */
    shoots.push({
      x: rand(w * 0.1, w * 0.9),
      y: rand(0, h * 0.45),
      vx: rand(3, 6),
      vy: rand(1.2, 2.6),
      len: rand(80, 140),
      life: 1
    });
  }

  function frame(){
    t++;
    ctx.clearRect(0, 0, w, h);
    drawNebula();
    drawDust();
    drawStars();
    if(shoots.length < SHOOT_MAX && Math.random() < SHOOT_CHANCE) spawnShoot();
    drawShoots();
    raf = requestAnimationFrame(frame);
  }

/* ---------- lifecycle ---------- */

  function isCosmic(){
    return document.body.getAttribute('data-theme') === 'cosmic';
  }

  function start(){
    if(raf !== null) return;
    if(reduce.matches){
      /* one composed still frame instead of a loop */
      ctx.clearRect(0, 0, w, h);
      drawNebula();
      drawDust();
      drawStars();
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function stop(){
    if(raf === null) return;
    cancelAnimationFrame(raf);
    raf = null;
    ctx.clearRect(0, 0, w, h);
  }

  /* Only run while cosmic is actually the live theme, the tab is
     visible, and motion is allowed. */
  function sync(){
    if(isCosmic() && !document.hidden && !reduce.matches) start();
    else stop();
  }

  /* theme or mode changes land here — app.js flips data-theme */
  new MutationObserver(sync).observe(document.body, {
    attributes:true, attributeFilter:['data-theme','data-mode']
  });

  document.addEventListener('visibilitychange', sync);

  /* if the user turns reduced-motion on mid-session, stop at once */
  if(reduce.addEventListener){
    reduce.addEventListener('change', sync);
  }

  window.addEventListener('resize', function(){
    resize();
    /* a static frame must be repainted too, since stop() clears it */
    if(reduce.matches && isCosmic()) start();
  });

  resize();
  sync();
})();