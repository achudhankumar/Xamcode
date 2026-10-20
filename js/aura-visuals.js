/* ============================================================
   AURA VISUALS — parametric SVG animation engine (vanilla JS)
   ------------------------------------------------------------
   No Lottie. No React. Every visual is pure inline SVG driven
   by requestAnimationFrame, so AURA can render a live, reactive
   animation under any answer in real time.

   Public API on window.XC.auraVisuals:
     • detect(text)                 -> 'projectile' | ... | null
     • extractParams(type, text)    -> { angle:45, ... }
     • createPlayer(mount, type, params) -> { destroy(), setPlaying() }
     • VISUALS                      -> registry of the 5 types
   ============================================================ */
(function(){
  'use strict';
  window.XC = window.XC || {};

  const NS = 'http://www.w3.org/2000/svg';
  let _uid = 0;

  function svgEl(tag, attrs, parent){
    const n = document.createElementNS(NS, tag);
    if(attrs) for(const k in attrs){ if(attrs[k] != null) n.setAttribute(k, attrs[k]); }
    if(parent) parent.appendChild(n);
    return n;
  }
  function defs(svg){ return svg.querySelector('defs') || svgEl('defs', {}, svg); }
  function marker(svg, id, color){
    const m = svgEl('marker', { id, viewBox:'0 0 10 10', refX:9, refY:5,
      markerWidth:6, markerHeight:6, orient:'auto-start-reverse' }, defs(svg));
    m.appendChild(svgEl('path', { d:'M0 0 L10 5 L0 10 z', fill:color }));
    return id;
  }
  function clamp(v, lo, hi){ return v < lo ? lo : v > hi ? hi : v; }

  /* ---------------- 1. Projectile Motion ---------------- */
  const projectile = {
    label:'Projectile Motion',
    defaults:{ angle:45, velocity:80 },
    sliders:[
      { key:'angle', label:'Angle', min:10, max:80, step:1, unit:'°' },
      { key:'velocity', label:'Velocity', min:20, max:120, step:1, unit:'' }
    ],
    build(ctx, p){
      const svg = ctx.svg, uid = ctx.uid;
      ctx.refs.mkVx = marker(svg, uid+'-vx', 'var(--av-vx, #f472b6)');
      ctx.refs.mkVy = marker(svg, uid+'-vy', 'var(--av-vy, #60a5fa)');
      const g = svgEl('g', {}, svg);
      svgEl('line', { x1:20, y1:216, x2:380, y2:216, class:'av-ground' }, g);
      svgEl('path', { class:'av-path', fill:'none' }, g);
      svgEl('path', { class:'av-trail', fill:'none', 'stroke-linecap':'round' }, g);
      svgEl('line', { class:'av-vx', 'marker-end':'url(#'+ctx.refs.mkVx+')' }, g);
      svgEl('line', { class:'av-vy', 'marker-end':'url(#'+ctx.refs.mkVy+')' }, g);
      svgEl('circle', { r:6.5, class:'av-ball' }, g);
      ctx.refs.g = g;
      ctx.refs.path = g.children[1];
      ctx.refs.trail = g.children[2];
      ctx.refs.vx = g.children[3];
      ctx.refs.vy = g.children[4];
      ctx.refs.ball = g.children[5];
    },
    update(ctx, p, t){
      const r = ctx.refs;
      const ang = p.angle * Math.PI / 180, v = p.velocity, g = 9.8;
      const vx = v * Math.cos(ang), vy = v * Math.sin(ang);
      const T = (2 * vy / g) || 1;
      const range = vx * T, hmax = (vy * vy) / (2 * g);
      const s = Math.min(320 / (range || 1), 150 / (hmax || 1));
      const x0 = 48, y0 = 216;
      const pos = tt => ({ x: x0 + vx * tt * s, y: y0 - (vy * tt - 0.5 * g * tt * tt) * s });
      let d = '';
      for(let i = 0; i <= 60; i++){ const pt = pos(T * i / 60); d += (i ? 'L' : 'M') + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1); }
      r.path.setAttribute('d', d);
      const tt = (t * (v / 46)) % T;
      const cur = pos(tt);
      r.ball.setAttribute('cx', cur.x); r.ball.setAttribute('cy', cur.y);
      let td = '';
      for(let i = 0; i <= 30; i++){ const pt = pos(T * i / 30); if(pt.x > cur.x) break; td += (i ? 'L' : 'M') + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1); }
      r.trail.setAttribute('d', td);
      const vs = 0.55;
      r.vx.setAttribute('x1', cur.x); r.vx.setAttribute('y1', cur.y);
      r.vx.setAttribute('x2', cur.x + vx * vs); r.vx.setAttribute('y2', cur.y);
      r.vy.setAttribute('x1', cur.x); r.vy.setAttribute('y1', cur.y);
      r.vy.setAttribute('x2', cur.x); r.vy.setAttribute('y2', cur.y - vy * vs);
    }
  };

  /* ---------------- 2. Photosynthesis ---------------- */
  const photosynthesis = {
    label:'Photosynthesis',
    defaults:{ lightIntensity:70 },
    sliders:[ { key:'lightIntensity', label:'Light intensity', min:0, max:100, step:1, unit:'%' } ],
    build(ctx){
      const svg = ctx.svg;
      const mkCo2 = marker(svg, ctx.uid+'-co2', '#34d399');
      const mkH2o = marker(svg, ctx.uid+'-h2o', '#60a5fa');
      const mkO2  = marker(svg, ctx.uid+'-o2',  '#f472b6');
      /* Sun */
      ctx.refs.sun = svgEl('g', { class:'av-sun' }, svg);
      svgEl('circle', { cx:56, cy:48, r:14, class:'av-sun-core' }, ctx.refs.sun);
      ctx.refs.rays = [];
      for(let i=0;i<8;i++){
        const a = i*Math.PI/4;
        ctx.refs.rays.push(svgEl('line', {
          x1:56+Math.cos(a)*20, y1:48+Math.sin(a)*20,
          x2:56+Math.cos(a)*30, y2:48+Math.sin(a)*30, class:'av-sun-ray'
        }, ctx.refs.sun));
      }
      /* Leaf */
      svgEl('path', { d:'M150 128 C 175 66, 268 66, 300 128 C 268 190, 175 190, 150 128 Z', class:'av-leaf' }, svg);
      svgEl('path', { d:'M158 128 L296 128', class:'av-leaf-vein' }, svg);
      /* Pipes + arrowheads */
      svgEl('line', { x1:22, y1:116, x2:150, y2:116, class:'av-pipe av-co2', 'marker-end':'url(#'+mkCo2+')' }, svg);
      svgEl('line', { x1:196, y1:232, x2:196, y2:188, class:'av-pipe av-h2o', 'marker-end':'url(#'+mkH2o+')' }, svg);
      svgEl('line', { x1:250, y1:122, x2:250, y2:38,  class:'av-pipe av-o2',  'marker-end':'url(#'+mkO2+')'  }, svg);
      const lbl = (x,y,t,c)=>{ const n=svgEl('text',{x,y,class:'av-tag','text-anchor':'middle',fill:c},svg); n.textContent=t; };
      lbl(38,108,'CO₂','#34d399'); lbl(214,236,'H₂O','#60a5fa'); lbl(268,32,'O₂','#f472b6');
      /* Moving particles */
      ctx.refs.photo = svgEl('circle', { r:3.4, class:'av-photon' }, svg);
      ctx.refs.co2P  = svgEl('circle', { r:3.2, class:'av-p-co2' }, svg);
      ctx.refs.h2oP  = svgEl('circle', { r:3.2, class:'av-p-h2o' }, svg);
      ctx.refs.o2P   = svgEl('circle', { r:3.2, class:'av-p-o2'  }, svg);
    },
    update(ctx, p, t){
      const li = p.lightIntensity/100;
      const pulse = 1 + 0.12*Math.sin(t*4)*li;
      ctx.refs.sun.setAttribute('transform', `translate(56 48) scale(${pulse.toFixed(3)}) translate(-56 -48)`);
      ctx.refs.sun.setAttribute('opacity', (0.35 + 0.65*li).toFixed(3));
      ctx.refs.rays.forEach(r=>r.setAttribute('opacity', (0.25 + 0.75*li).toFixed(2)));
      /* photon sun -> leaf */
      const frac = (t*0.5)%1;
      ctx.refs.photo.setAttribute('cx', (60+(150-60)*frac).toFixed(1));
      ctx.refs.photo.setAttribute('cy', (48+(128-48)*frac).toFixed(1));
      ctx.refs.photo.setAttribute('opacity', li.toFixed(2));
      /* CO2 in */
      const f2 = (t*0.4)%1;
      ctx.refs.co2P.setAttribute('cx', (24+(150-24)*f2).toFixed(1));
      ctx.refs.co2P.setAttribute('cy', 116);
      /* H2O in */
      const f3 = (t*0.4+0.33)%1;
      ctx.refs.h2oP.setAttribute('cx', 196);
      ctx.refs.h2oP.setAttribute('cy', (230+(188-230)*f3).toFixed(1));
      /* O2 out */
      const f4 = (t*0.4+0.66)%1;
      ctx.refs.o2P.setAttribute('cx', 250);
      ctx.refs.o2P.setAttribute('cy', (122+(38-122)*f4).toFixed(1));
    }
  };

  /* ---------------- 3. Pythagoras ---------------- */
  const pythagoras = {
    label:'Pythagoras Theorem',
    defaults:{ a:3, b:4, c:5 },
    sliders:[
      { key:'a', label:'Side a', min:2, max:8, step:1, unit:'' },
      { key:'b', label:'Side b', min:2, max:8, step:1, unit:'' },
      { key:'c', label:'Hypotenuse c', min:3, max:10, step:1, unit:'' }
    ],
    build(ctx){
      const svg = ctx.svg;
      svgEl('rect', { x:0, y:0, width:400, height:250, class:'av-bg' }, svg);
      ctx.refs.tri = svgEl('path', { class:'av-tri' }, svg);
      ctx.refs.sqA = svgEl('path', { class:'av-sq av-sq-a' }, svg);
      ctx.refs.sqB = svgEl('path', { class:'av-sq av-sq-b' }, svg);
      ctx.refs.sqC = svgEl('path', { class:'av-sq av-sq-c' }, svg);
      ctx.refs.lblA = svgEl('text', { class:'av-tag av-sq-a-l', 'text-anchor':'middle' }, svg);
      ctx.refs.lblB = svgEl('text', { class:'av-tag av-sq-b-l', 'text-anchor':'middle' }, svg);
      ctx.refs.lblC = svgEl('text', { class:'av-tag av-sq-c-l', 'text-anchor':'middle' }, svg);
      ctx.refs.eq = svgEl('text', { x:200, y:238, class:'av-eq', 'text-anchor':'middle' }, svg);
    },
    update(ctx, p, t){
      const r = ctx.refs;
      /* right-angle vertex at origin O; leg a along x, leg b up the y */
      const k = 24;
      const Ax = 130, Ay = 200;
      const Bx = Ax + p.a * k, By = Ay;
      const Cx = Ax, Cy = Ay - p.b * k;
      r.tri.setAttribute('d', `M${Ax} ${Ay} L${Bx.toFixed(1)} ${By} L${Cx.toFixed(1)} ${Cy.toFixed(1)} Z`);
      /* squares outward from each side */
      r.sqA.setAttribute('d', `M${Ax} ${Ay} L${Bx} ${By} L${Bx} ${By + p.a*k} L${Ax} ${Ay + p.a*k} Z`);
      r.sqB.setAttribute('d', `M${Ax} ${Ay} L${Cx} ${Cy} L${Cx - p.b*k} ${Cy} L${Ax - p.b*k} ${Ay} Z`);
      r.sqC.setAttribute('d', `M${Bx} ${By} L${Cx} ${Cy} L${Cx - (Cy-By)} ${Cy + (Bx-Cx)} L${Bx - (Cy-By)} ${By + (Bx-Cx)} Z`);
      /* labels: value squared, pulsing to show the proof */
      const pop = (base)=>base * (1 + 0.06*Math.sin(t*3));
      r.lblA.setAttribute('x', Ax + p.a*k/2); r.lblA.setAttribute('y', By + p.a*k/2);
      r.lblA.textContent = `a²=${p.a*p.a}`; r.lblA.setAttribute('font-size', pop(12).toFixed(1));
      r.lblB.setAttribute('x', Ax - p.b*k/2); r.lblB.setAttribute('y', Ay - p.b*k/2);
      r.lblB.textContent = `b²=${p.b*p.b}`; r.lblB.setAttribute('font-size', pop(12).toFixed(1));
      r.lblC.setAttribute('x', (Bx+Cx)/2 + 6); r.lblC.setAttribute('y', (By+Cy)/2);
      r.lblC.textContent = `c²=${p.c*p.c}`; r.lblC.setAttribute('font-size', pop(13).toFixed(1));
      const ok = (p.a*p.a + p.b*p.b === p.c*p.c);
      r.eq.textContent = `${p.a*p.a} + ${p.b*p.b} = ${p.a*p.a+p.b*p.b}${ok?'  ✓ = c²':''}`;
      r.eq.setAttribute('fill', ok ? '#34d399' : '#f472b6');
    }
  };

  /* ---------------- 4. Electric Motor ---------------- */
  const motor = {
    label:'Electric Motor',
    defaults:{},
    sliders:[],
    build(ctx){
      const svg = ctx.svg;
      /* magnets top (N) + bottom (S) */
      svgEl('rect', { x:96, y:22, width:208, height:22, rx:4, class:'av-magnet-n' }, svg);
      const nT = svgEl('text', { x:200, y:37, class:'av-tag', 'text-anchor':'middle' }, svg); nT.textContent='N';
      svgEl('rect', { x:96, y:206, width:208, height:22, rx:4, class:'av-magnet-s' }, svg);
      const sT = svgEl('text', { x:200, y:221, class:'av-tag', 'text-anchor':'middle' }, svg); sT.textContent='S';
      /* field lines top->bottom */
      for(let i=0;i<5;i++){
        svgEl('line', { x1:120+i*40, y1:50, x2:120+i*40, y2:200, class:'av-field' }, svg);
      }
      /* rotating coil group */
      ctx.refs.coil = svgEl('g', {}, svg);
      svgEl('rect', { x:170, y:100, width:60, height:50, rx:5, class:'av-coil' }, ctx.refs.coil);
      svgEl('line', { x1:200, y1:100, x2:200, y2:150, class:'av-coil-div' }, ctx.refs.coil);
      /* current arrows on the two coil faces (direction flips with rotation) */
      const mkI = marker(svg, ctx.uid+'-i', '#fbbf24');
      ctx.refs.iTop = svgEl('line', { class:'av-curr', 'marker-end':'url(#'+mkI+')' }, ctx.refs.coil);
      ctx.refs.iBot = svgEl('line', { class:'av-curr', 'marker-end':'url(#'+mkI+')' }, ctx.refs.coil);
      /* commutator + brushes */
      svgEl('circle', { cx:200, cy:125, r:5, class:'av-hub' }, svg);
      svgEl('line', { x1:120, y1:125, x2:168, y2:125, class:'av-brush' }, svg);
      svgEl('line', { x1:232, y1:125, x2:280, y2:125, class:'av-brush' }, svg);
    },
    update(ctx, p, t){
      const ang = (t * 180) % 360;
      ctx.refs.coil.setAttribute('transform', `rotate(${ang.toFixed(1)} 200 125)`);
      /* current direction swaps each half turn */
      const fwd = Math.floor((t*180)/180) % 2 === 0;
      ctx.refs.iTop.setAttribute('x1', fwd ? 168 : 232);
      ctx.refs.iTop.setAttribute('y1', 112);
      ctx.refs.iTop.setAttribute('x2', fwd ? 232 : 168);
      ctx.refs.iTop.setAttribute('y2', 112);
      ctx.refs.iBot.setAttribute('x1', fwd ? 232 : 168);
      ctx.refs.iBot.setAttribute('y1', 138);
      ctx.refs.iBot.setAttribute('x2', fwd ? 168 : 232);
      ctx.refs.iBot.setAttribute('y2', 138);
    }
  };

  /* ---------------- 5. DNA Replication ---------------- */
  const dna = {
    label:'DNA Replication',
    defaults:{},
    sliders:[],
    build(ctx){
      const svg = ctx.svg;
      ctx.refs.helixL = svgEl('g', {}, svg);
      ctx.refs.helixR = svgEl('g', {}, svg);
      ctx.refs.newL = svgEl('g', {}, svg);
      ctx.refs.newR = svgEl('g', {}, svg);
      ctx.refs.strandsL = [];
      ctx.refs.strandsR = [];
      ctx.refs.rungs = [];
      ctx.refs.newLNodes = [];
      ctx.refs.newRNodes = [];
      const rows = 9;
      ctx.refs.gap = 5;
      const labels = ['A','T','C','G','A','G','C','T','A'];
      const compl = { A:'T', T:'A', C:'G', G:'C' };
      ctx.refs.labels = labels;
      ctx.refs.compl = compl;
      ctx.refs.rows = rows;
      for(let i=0;i<rows;i++){
        const y = 26 + i * 24;
        const l = svgEl('circle', { r:5, class:'av-base av-base-l' }, ctx.refs.helixL);
        const r = svgEl('circle', { r:5, class:'av-base av-base-r' }, ctx.refs.helixR);
        ctx.refs.strandsL.push(l);
        ctx.refs.strandsR.push(r);
        const rung = svgEl('line', { class:'av-rung' }, svg);
        ctx.refs.rungs.push(rung);
        ctx.refs.newLNodes.push(svgEl('circle', { r:5, class:'av-base av-base-new' }, ctx.refs.newL));
        ctx.refs.newRNodes.push(svgEl('circle', { r:5, class:'av-base av-base-new' }, ctx.refs.newR));
      }
      const lt = svgEl('text', { x:200, y:243, class:'av-eq', 'text-anchor':'middle' }, svg);
      lt.textContent = 'A=T · C≡G · each strand builds its complement';
      ctx.refs.legend = lt;
    },
    update(ctx, p, t){
      const r = ctx.refs;
      const cyc = (t * 0.45) % 2;
      const unzip = cyc < 1 ? cyc : 2 - cyc;
      const ease = unzip < 0.5 ? 2*unzip*unzip : 1 - Math.pow(-2*unzip+2, 2)/2;
      const cx = 200;
      for(let i=0;i<r.rows;i++){
        const y = 26 + i * 24;
        const spread = ease * r.gap * 3;
        const lx = cx - 30 - spread;
        const rx = cx + 30 + spread;
        r.strandsL[i].setAttribute('cx', lx);
        r.strandsL[i].setAttribute('cy', y);
        r.strandsL[i].setAttribute('opacity', (0.35 + 0.65*(1-ease)).toFixed(2));
        r.strandsR[i].setAttribute('cx', rx);
        r.strandsR[i].setAttribute('cy', y);
        r.strandsR[i].setAttribute('opacity', (0.35 + 0.65*(1-ease)).toFixed(2));
        r.rungs[i].setAttribute('x1', lx);
        r.rungs[i].setAttribute('y1', y);
        r.rungs[i].setAttribute('x2', rx);
        r.rungs[i].setAttribute('y2', y);
        r.rungs[i].setAttribute('opacity', (1 - ease).toFixed(2));
        const nl = r.newLNodes[i], nr = r.newRNodes[i];
        nl.setAttribute('cx', lx - 26 * ease - 6);
        nl.setAttribute('cy', y);
        nl.setAttribute('opacity', ease.toFixed(2));
        nr.setAttribute('cx', rx + 26 * ease + 6);
        nr.setAttribute('cy', y);
        nr.setAttribute('opacity', ease.toFixed(2));
      }
    }
  };

  /* ---------------- 6. Wave (sine) ---------------- */
  const wave = {
    label:'Wave',
    defaults:{ amplitude:60, frequency:2 },
    sliders:[
      { key:'amplitude', label:'Amplitude', min:10, max:90, step:1, unit:'' },
      { key:'frequency', label:'Frequency', min:1, max:6, step:1, unit:'' }
    ],
    build(ctx){
      const svg = ctx.svg;
      svgEl('rect', { x:0, y:0, width:400, height:250, class:'av-bg' }, svg);
      svgEl('line', { x1:16, y1:125, x2:384, y2:125, class:'av-wave-axis' }, svg);
      ctx.refs.envelope = svgEl('path', { class:'av-wave-env', fill:'none' }, svg);
      ctx.refs.curve = svgEl('path', { class:'av-wave', fill:'none' }, svg);
      ctx.refs.dot = svgEl('circle', { r:5, class:'av-wave-dot' }, svg);
      const lA = svgEl('text', { x:22, y:118, class:'av-tag', 'text-anchor':'start' }, svg); lA.textContent = 'rest';
      const lP = svgEl('text', { x:384, y:118, class:'av-tag', 'text-anchor':'end' }, svg); lP.textContent = 'peak';
      ctx.refs.desc = svgEl('text', { x:200, y:243, class:'av-eq', 'text-anchor':'middle' }, svg);
    },
    update(ctx, p, t){
      const r = ctx.refs, mid = 125, amp = p.amplitude, k = p.frequency;
      const y = x => mid - amp * Math.sin((x / 400) * k * Math.PI * 2 - t * 3);
      let d = '';
      for(let x = 16; x <= 384; x += 4){ d += (x === 16 ? 'M' : 'L') + x.toFixed(1) + ' ' + y(x).toFixed(1); }
      r.curve.setAttribute('d', d);
      r.envelope.setAttribute('d', `M16 ${mid-amp} L384 ${mid-amp} M16 ${mid+amp} L384 ${mid+amp}`);
      const xdot = 16 + ((t * 70) % 368);
      r.dot.setAttribute('cx', xdot.toFixed(1));
      r.dot.setAttribute('cy', y(xdot).toFixed(1));
      r.desc.textContent = 'y = A·sin(kx − ωt)   ·   A=' + amp + '  (ω animates over time)';
    }
  };

  /* ---------------- 8. Bicycle Mechanics & Powertrain ---------------- */
  const bicycle = {
    label: 'Bicycle Powertrain & Mechanical Advantage',
    defaults: { cadence: 60, gearRatio: 2.5 },
    sliders: [
      { key: 'cadence', label: 'Cadence (Pedaling RPM)', min: 20, max: 120, step: 1, unit: ' RPM' },
      { key: 'gearRatio', label: 'Gear Ratio (Chainring / Sprocket)', min: 1.0, max: 4.5, step: 0.1, unit: 'x' }
    ],
    build(ctx, p){
      const svg = ctx.svg;
      svgEl('rect', { x:0, y:0, width:400, height:250, class:'av-bg' }, svg);

      // Ground with dashed moving terrain
      ctx.refs.ground = svgEl('line', { x1:10, y1:212, x2:390, y2:212, stroke:'#475569', 'stroke-width':3, 'stroke-dasharray':'12 8' }, svg);

      // Wheel groups
      const rG = svgEl('g', { transform:'translate(95, 160)' }, svg);
      const fG = svgEl('g', { transform:'translate(305, 160)' }, svg);

      // Tires & Rims
      svgEl('circle', { cx:0, cy:0, r:48, stroke:'#0284c7', 'stroke-width':4, fill:'rgba(2,132,199,0.06)' }, rG);
      svgEl('circle', { cx:0, cy:0, r:48, stroke:'#0284c7', 'stroke-width':4, fill:'rgba(2,132,199,0.06)' }, fG);
      svgEl('circle', { cx:0, cy:0, r:12, fill:'#38bdf8' }, rG);
      svgEl('circle', { cx:0, cy:0, r:12, fill:'#38bdf8' }, fG);

      // Rotating Spokes
      ctx.refs.rSpokes = [];
      ctx.refs.fSpokes = [];
      for(let i=0; i<6; i++){
        const ang = (i * Math.PI) / 3;
        ctx.refs.rSpokes.push(svgEl('line', { x1:0, y1:0, x2:(48*Math.cos(ang)).toFixed(1), y2:(48*Math.sin(ang)).toFixed(1), stroke:'#94a3b8', 'stroke-width':1.5 }, rG));
        ctx.refs.fSpokes.push(svgEl('line', { x1:0, y1:0, x2:(48*Math.cos(ang)).toFixed(1), y2:(48*Math.sin(ang)).toFixed(1), stroke:'#94a3b8', 'stroke-width':1.5 }, fG));
      }

      // Diamond Frame Tubes (Standard Bicycle Geometry)
      const frame = svgEl('g', { stroke:'#22c55e', 'stroke-width':3.5, 'stroke-linecap':'round', 'stroke-linejoin':'round' }, svg);
      svgEl('line', { x1:95, y1:160, x2:195, y2:160 }, frame); // Chainstay
      svgEl('line', { x1:95, y1:160, x2:160, y2:85 }, frame);  // Seatstay
      svgEl('line', { x1:195, y1:160, x2:160, y2:85 }, frame); // Seat tube
      svgEl('line', { x1:160, y1:85, x2:275, y2:75 }, frame);  // Top tube
      svgEl('line', { x1:195, y1:160, x2:275, y2:75 }, frame); // Down tube
      svgEl('line', { x1:275, y1:75, x2:305, y2:160 }, frame); // Fork

      // Saddle & Handlebars
      svgEl('path', { d:'M142 80 Q160 76 178 82 Q160 88 142 80 Z', fill:'#f8fafc', stroke:'#0f172a', 'stroke-width':1.5 }, svg);
      svgEl('path', { d:'M275 75 L272 58 Q278 52 288 56 Q280 64 275 75 Z', fill:'none', stroke:'#e2e8f0', 'stroke-width':3 }, svg);

      // Chain drive
      svgEl('line', { x1:95, y1:152, x2:195, y2:144, stroke:'#facc15', 'stroke-width':2, 'stroke-dasharray':'4 3' }, svg);
      svgEl('line', { x1:95, y1:168, x2:195, y2:176, stroke:'#facc15', 'stroke-width':2, 'stroke-dasharray':'4 3' }, svg);
      ctx.refs.chainTop = svg.children[svg.children.length - 2];
      ctx.refs.chainBottom = svg.children[svg.children.length - 1];

      // Front Chainring
      svgEl('circle', { cx:195, cy:160, r:18, stroke:'#facc15', 'stroke-width':2.5, fill:'rgba(250,204,21,0.2)' }, svg);
      // Rear Sprocket
      svgEl('circle', { cx:95, cy:160, r:9, stroke:'#facc15', 'stroke-width':2, fill:'rgba(250,204,21,0.4)' }, svg);

      // Crank arms & Pedals
      ctx.refs.crankGroup = svgEl('g', { transform:'translate(195, 160)' }, svg);
      ctx.refs.crankArmA = svgEl('line', { x1:0, y1:0, x2:0, y2:22, stroke:'#cbd5e1', 'stroke-width':3 }, ctx.refs.crankGroup);
      ctx.refs.crankArmB = svgEl('line', { x1:0, y1:0, x2:0, y2:-22, stroke:'#cbd5e1', 'stroke-width':3 }, ctx.refs.crankGroup);
      ctx.refs.pedalA = svgEl('rect', { x:-6, y:18, width:12, height:6, rx:2, fill:'#f43f5e' }, ctx.refs.crankGroup);
      ctx.refs.pedalB = svgEl('rect', { x:-6, y:-24, width:12, height:6, rx:2, fill:'#f43f5e' }, ctx.refs.crankGroup);

      // Telemetry HUD
      ctx.refs.speedText = svgEl('text', { x:200, y:28, class:'av-title-h', 'text-anchor':'middle', fill:'#38bdf8', 'font-size':13, 'font-weight':800 }, svg);
      ctx.refs.ratioText = svgEl('text', { x:200, y:242, class:'av-eq', 'text-anchor':'middle', fill:'#94a3b8', 'font-size':11 }, svg);
    },
    update(ctx, p, t){
      const r = ctx.refs;
      const cadenceRps = (p.cadence || 60) / 60;
      const crankAngle = (t * cadenceRps * 2 * Math.PI) % (2 * Math.PI);
      const wheelAngle = (crankAngle * (p.gearRatio || 2.5)) % (2 * Math.PI);

      // Rotate crank arm
      const cDeg = (crankAngle * 180 / Math.PI).toFixed(1);
      r.crankGroup.setAttribute('transform', `translate(195, 160) rotate(${cDeg})`);

      // Rotate wheel spokes
      for(let i=0; i<6; i++){
        const baseAng = (i * Math.PI) / 3;
        const curAng = baseAng + wheelAngle;
        const x = (48 * Math.cos(curAng)).toFixed(1);
        const y = (48 * Math.sin(curAng)).toFixed(1);
        r.rSpokes[i].setAttribute('x2', x); r.rSpokes[i].setAttribute('y2', y);
        r.fSpokes[i].setAttribute('x2', x); r.fSpokes[i].setAttribute('y2', y);
      }

      // Scroll ground line backwards to simulate forward velocity
      const wheelCircumference = 2.12; // meters (standard 700c wheel)
      const speedKmh = ((p.cadence || 60) * (p.gearRatio || 2.5) * wheelCircumference * 60) / 1000;
      const groundOffset = ((t * speedKmh * 8) % 20).toFixed(1);
      r.ground.setAttribute('stroke-dashoffset', groundOffset);
      r.chainTop.setAttribute('stroke-dashoffset', (-groundOffset * 1.5).toFixed(1));
      r.chainBottom.setAttribute('stroke-dashoffset', (groundOffset * 1.5).toFixed(1));

      r.speedText.textContent = `Speed: ${speedKmh.toFixed(1)} km/h  ·  Pedaling: ${p.cadence} RPM`;
      r.ratioText.textContent = `Gear Ratio: ${(p.gearRatio||2.5).toFixed(1)}:1  ·  Crank Torque → Chain Tension → Wheel Rotation`;
    }
  };

  /* ---------------- 9. 4-Stroke Engine Cycle ---------------- */
  const engine = {
    label: '4-Stroke Internal Combustion Engine',
    defaults: { rpm: 1200 },
    sliders: [
      { key: 'rpm', label: 'Engine Speed', min: 600, max: 3600, step: 100, unit: ' RPM' }
    ],
    build(ctx, p){
      const svg = ctx.svg;
      svgEl('rect', { x:0, y:0, width:400, height:250, class:'av-bg' }, svg);

      // Cylinder block
      svgEl('rect', { x:150, y:35, width:100, height:130, rx:4, fill:'#0b1120', stroke:'#334155', 'stroke-width':3 }, svg);
      // Combustion chamber glow
      ctx.refs.chamber = svgEl('rect', { x:154, y:38, width:92, height:30, fill:'rgba(244,63,94,0)' }, svg);

      // Valves
      ctx.refs.valvIn = svgEl('line', { x1:175, y1:35, x2:175, y2:45, stroke:'#38bdf8', 'stroke-width':4 }, svg);
      ctx.refs.valvEx = svgEl('line', { x1:225, y1:35, x2:225, y2:45, stroke:'#f97316', 'stroke-width':4 }, svg);
      // Spark plug
      svgEl('rect', { x:197, y:25, width:6, height:14, fill:'#facc15' }, svg);
      ctx.refs.spark = svgEl('circle', { cx:200, cy:40, r:0, fill:'#facc15', opacity:0 }, svg);

      // Piston & Connecting Rod
      ctx.refs.piston = svgEl('rect', { x:155, y:60, width:90, height:38, rx:5, fill:'#475569', stroke:'#94a3b8', 'stroke-width':2 }, svg);
      ctx.refs.conRod = svgEl('line', { x1:200, y1:79, x2:200, y2:185, stroke:'#cbd5e1', 'stroke-width':5, 'stroke-linecap':'round' }, svg);

      // Crankshaft
      svgEl('circle', { cx:200, cy:185, r:30, fill:'none', stroke:'#1e293b', 'stroke-width':3, 'stroke-dasharray':'4 4' }, svg);
      ctx.refs.crankPin = svgEl('circle', { cx:200, cy:160, r:7, fill:'#38bdf8', stroke:'#0284c7', 'stroke-width':2 }, svg);

      // Status HUD
      ctx.refs.phaseLabel = svgEl('text', { x:200, y:235, class:'av-title-h', 'text-anchor':'middle', fill:'#22c55e', 'font-size':13, 'font-weight':800 }, svg);
      ctx.refs.telemetry = svgEl('text', { x:200, y:248, class:'av-eq', 'text-anchor':'middle', fill:'#94a3b8', 'font-size':10 }, svg);
    },
    update(ctx, p, t){
      const r = ctx.refs;
      const rps = (p.rpm || 1200) / 60;
      const totalAngle = (t * rps * 2 * Math.PI) % (4 * Math.PI); // 4-stroke cycle = 720° (4pi)
      const crankAngle = totalAngle % (2 * Math.PI);

      const crankR = 24;
      const rodL = 68;
      const cX = 200 + crankR * Math.sin(crankAngle);
      const cY = 185 + crankR * Math.cos(crankAngle);

      // Piston slider-crank kinematics
      const pistonY = cY - Math.sqrt(rodL*rodL - Math.pow(cX - 200, 2)) - 19;
      r.piston.setAttribute('y', (pistonY - 19).toFixed(1));
      r.conRod.setAttribute('x1', '200');
      r.conRod.setAttribute('y1', pistonY.toFixed(1));
      r.conRod.setAttribute('x2', cX.toFixed(1));
      r.conRod.setAttribute('y2', cY.toFixed(1));
      r.crankPin.setAttribute('cx', cX.toFixed(1));
      r.crankPin.setAttribute('cy', cY.toFixed(1));

      // 4-Stroke Cycle States
      let phase = '', col = '#38bdf8';
      if(totalAngle < Math.PI){
        phase = '1. INTAKE STROKE · Air-Fuel Mixture Drawn In';
        col = '#38bdf8';
        r.valvIn.setAttribute('y2', '52'); r.valvEx.setAttribute('y2', '45');
        r.chamber.setAttribute('fill', 'rgba(56, 189, 248, 0.25)');
        r.spark.setAttribute('r', '0');
      } else if(totalAngle < 2 * Math.PI){
        phase = '2. COMPRESSION STROKE · Mixture Compressed';
        col = '#f59e0b';
        r.valvIn.setAttribute('y2', '45'); r.valvEx.setAttribute('y2', '45');
        r.chamber.setAttribute('fill', 'rgba(245, 158, 11, 0.25)');
        r.spark.setAttribute('r', '0');
      } else if(totalAngle < 3 * Math.PI){
        phase = '3. POWER STROKE · Spark Ignites Combustion';
        col = '#f43f5e';
        r.valvIn.setAttribute('y2', '45'); r.valvEx.setAttribute('y2', '45');
        r.chamber.setAttribute('fill', 'rgba(244, 63, 94, 0.55)');
        r.spark.setAttribute('r', totalAngle < 2.3 * Math.PI ? '10' : '0');
      } else {
        phase = '4. EXHAUST STROKE · Burned Gases Expelled';
        col = '#94a3b8';
        r.valvIn.setAttribute('y2', '45'); r.valvEx.setAttribute('y2', '52');
        r.chamber.setAttribute('fill', 'rgba(148, 163, 184, 0.2)');
        r.spark.setAttribute('r', '0');
      }

      r.phaseLabel.textContent = phase;
      r.phaseLabel.setAttribute('fill', col);
      r.telemetry.textContent = `Engine: ${p.rpm} RPM  ·  Kinematic Cycle: 4-Stroke Otto Cycle`;
    }
  };

  /* ---------------- 10. Heart & Cardiovascular Dynamics ---------------- */
  const heart = {
    label: 'Cardiovascular Circulatory System',
    defaults: { bpm: 72 },
    sliders: [
      { key: 'bpm', label: 'Heart Rate', min: 40, max: 160, step: 1, unit: ' BPM' }
    ],
    build(ctx, p){
      const svg = ctx.svg;
      svgEl('rect', { x:0, y:0, width:400, height:250, class:'av-bg' }, svg);

      // Heart Muscle Outline
      ctx.refs.heartG = svgEl('g', { transform:'translate(200, 110)' }, svg);
      ctx.refs.heartPath = svgEl('path', { d:'M 0 -35 C -45 -75 -90 -25 -65 30 C -45 70 0 95 0 95 C 0 95 45 70 65 30 C 90 -25 45 -75 0 -35 Z', fill:'rgba(244,63,94,0.3)', stroke:'#f43f5e', 'stroke-width':3 }, ctx.refs.heartG);

      // Chambers
      svgEl('circle', { cx:-28, cy:-10, r:16, fill:'rgba(56,189,248,0.25)', stroke:'#38bdf8', 'stroke-width':1.5 }, ctx.refs.heartG);
      svgEl('circle', { cx:28, cy:-10, r:16, fill:'rgba(244,63,94,0.25)', stroke:'#f43f5e', 'stroke-width':1.5 }, ctx.refs.heartG);
      svgEl('text', { x:-28, y:-7, 'text-anchor':'middle', fill:'#38bdf8', 'font-size':9, 'font-weight':700 }, ctx.refs.heartG).textContent = 'RA';
      svgEl('text', { x:28, y:-7, 'text-anchor':'middle', fill:'#f43f5e', 'font-size':9, 'font-weight':700 }, ctx.refs.heartG).textContent = 'LA';

      // Ventricles
      svgEl('circle', { cx:-20, cy:35, r:22, fill:'rgba(56,189,248,0.35)', stroke:'#38bdf8', 'stroke-width':1.5 }, ctx.refs.heartG);
      svgEl('circle', { cx:20, cy:35, r:22, fill:'rgba(244,63,94,0.35)', stroke:'#f43f5e', 'stroke-width':1.5 }, ctx.refs.heartG);
      svgEl('text', { x:-20, y:38, 'text-anchor':'middle', fill:'#38bdf8', 'font-size':10, 'font-weight':800 }, ctx.refs.heartG).textContent = 'RV';
      svgEl('text', { x:20, y:38, 'text-anchor':'middle', fill:'#f43f5e', 'font-size':10, 'font-weight':800 }, ctx.refs.heartG).textContent = 'LV';

      // ECG Waveform at bottom
      ctx.refs.ecg = svgEl('path', { d:'M10 230 L120 230 L130 225 L140 230 L150 230 L155 240 L165 205 L175 245 L180 230 L195 230 L205 220 L215 230 L390 230', fill:'none', stroke:'#22c55e', 'stroke-width':2.5, 'stroke-linecap':'round' }, svg);

      // HUD
      ctx.refs.status = svgEl('text', { x:200, y:28, class:'av-title-h', 'text-anchor':'middle', fill:'#f43f5e', 'font-size':13, 'font-weight':800 }, svg);
    },
    update(ctx, p, t){
      const r = ctx.refs;
      const bps = (p.bpm || 72) / 60;
      const phase = (t * bps) % 1; // 0 to 1 cardiac cycle

      // Dual-pulse heartbeat expansion (lub-dub)
      let scale = 1.0;
      if(phase < 0.15) scale = 1.0 + 0.18 * Math.sin((phase / 0.15) * Math.PI); // Atrial systole
      else if(phase > 0.25 && phase < 0.45) scale = 1.0 + 0.24 * Math.sin(((phase - 0.25) / 0.20) * Math.PI); // Ventricular systole

      r.heartG.setAttribute('transform', `translate(200, 110) scale(${scale.toFixed(3)})`);
      r.status.textContent = `Pulse: ${p.bpm} BPM  ·  ${phase < 0.45 ? 'Systole (Pumping)' : 'Diastole (Refilling)'}`;
    }
  };


  /* ---------------- 7. Generic (LLM-drawn) ---------------- */
  const generic = {
    label:'Illustration',
    defaults:{},
    sliders:[],
    build(ctx, p){
      const svg = ctx.svg;
      svgEl('rect', { x:0, y:0, width:400, height:250, class:'av-bg' }, svg);
      const path = svgEl('path', { d: p.svgPath || '', class:'av-generic',
        fill:'none', 'stroke-linecap':'round', 'stroke-linejoin':'round' }, svg);
      ctx.refs.path = path;
      let len = 800;
      try{ len = path.getTotalLength() || 800; }catch(e){}
      ctx.refs.len = len;
      path.style.strokeDasharray = len + ' ' + len;
      path.style.strokeDashoffset = String(len);
      ctx.refs.empty = svgEl('text', { x:200, y:132, class:'av-eq', 'text-anchor':'middle' }, svg);
      ctx.refs.empty.textContent = p.svgPath ? '' : 'Illustrating…';
      if(p.svg_instruction){
        const cap = svgEl('text', { x:200, y:243, class:'av-eq', 'text-anchor':'middle' }, svg);
        cap.textContent = p.svg_instruction.length > 68 ? p.svg_instruction.slice(0, 65) + '…' : p.svg_instruction;
      }
    },
    update(ctx, p, t){
      const r = ctx.refs;
      const cyc = (t * 0.45) % 1;
      const shown = cyc < 0.72 ? cyc / 0.72 : 1;
      r.path.style.strokeDashoffset = String(r.len * (1 - shown));
      if(!p.svgPath) r.empty.textContent = 'Illustrating…';
    }
  };

  /* ============================================================
     ENGINE — registry, RAF player, sliders, public API
     ============================================================ */
  const VISUALS = { bicycle, engine, heart, projectile, photosynthesis, pythagoras, motor, dna, wave, generic };

  const KEYWORDS = {
    bicycle: ['bicycle', 'bike', 'pedal', 'crank', 'chain drive', 'sprocket', 'gear ratio', 'cadence', 'cycling', 'two-wheeler', 'velocipede'],
    engine: ['engine', 'internal combustion', '4-stroke', 'four-stroke', 'cylinder', 'piston', 'spark plug', 'crankshaft', 'combustion chamber', 'diesel', 'petrol engine'],
    heart: ['heart', 'cardiac', 'circulatory', 'blood flow', 'ventricle', 'atrium', 'systole', 'diastole', 'pulse', 'pumping blood', 'aorta', 'myocardium'],
    projectile: ['projectile', 'parabola', 'trajectory', 'thrown', 'launch',
      'projectile motion', 'angle of projection', 'time of flight', 'maximum height', 'range of the'],
    photosynthesis: ['photosynthesis', 'photosynthes', 'chlorophyll', 'chloroplast',
      'light reaction', 'calvin cycle', 'glucose', 'carbon dioxide'],
    pythagoras: ['pythagoras', 'pythagorean', 'hypotenuse', 'right triangle',
      'right-angled', 'a2+b2', 'a²+b²'],
    motor: ['electric motor', 'dc motor', 'ac motor', 'coil', 'commutator',
      'armature', 'rotating coil', 'back emf', 'synchronous'],
    dna: ['dna', 'double helix', 'replication', 'nucleotide', 'base pair',
      'chromosome', 'helix', 'complementary base', 'a-t', 'c-g', 'a=t'],
    wave: ['wave', 'sine wave', 'amplitude', 'frequency', 'wavelength',
      'sound wave', 'light wave', 'transverse wave', 'oscillation', 'crest', 'trough']
  };

  function detect(text){
    const s = ' ' + String(text || '').toLowerCase() + ' ';
    let best = null, bestScore = 0;
    for(const type in KEYWORDS){
      let score = 0;
      KEYWORDS[type].forEach(k => { if(s.indexOf(k) >= 0) score += k.length; });
      if(score > bestScore){ bestScore = score; best = type; }
    }
    return best;
  }

  function extractParams(type, text){
    const def = VISUALS[type]; if(!def) return {};
    const out = Object.assign({}, def.defaults);
    const s = String(text || '');
    if(type === 'projectile'){
      const am = s.match(/(\d+(?:\.\d+)?)\s*(?:°|degree|deg)/i);
      if(am) out.angle = clamp(parseFloat(am[1]), 10, 80);
      const vm = s.match(/(\d+(?:\.\d+)?)\s*(?:m\/s|mps|metres? per second|meters? per second)/i);
      if(vm) out.velocity = clamp(parseFloat(vm[1]), 20, 120);
    } else if(type === 'photosynthesis'){
      const lm = s.match(/(\d+(?:\.\d+)?)\s*%/);
      if(lm) out.lightIntensity = clamp(parseFloat(lm[1]), 0, 100);
    } else if(type === 'pythagoras'){
      const nums = (s.match(/\d+(?:\.\d+)?/g) || []).map(Number);
      if(nums.length >= 2){
        out.a = clamp(Math.round(nums[0]), 2, 8);
        out.b = clamp(Math.round(nums[1]), 2, 8);
        out.c = clamp(nums.length >= 3 ? Math.round(nums[2]) : Math.round(Math.hypot(out.a, out.b)), 3, 10);
      }
    }
    return out;
  }

  function createPlayer(mount, type, params, extra){
    const def = VISUALS[type];
    if(!def || !mount) return null;
    const p = Object.assign({}, def.defaults, params || {});
    /* svg_instruction is a sibling of params (a caption), not a slider — keep
       it available to build() for the generic visual without treating it as a
       numeric parameter. */
    if(extra && typeof extra === 'object'){
      for(const k in extra){ if(p[k] === undefined) p[k] = extra[k]; }
    }
    let playing = true, raf = 0, t = 0, last = 0;

    mount.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'av-wrap';
    const card = document.createElement('div');
    card.className = 'av-card';

    /* ---- title bar: icon + "Visual Explanation" + subtitle ---- */
    const bar = document.createElement('div');
    bar.className = 'av-bar';
    const title = document.createElement('div');
    title.className = 'av-title';
    const icon = document.createElement('span');
    icon.className = 'av-icon'; icon.setAttribute('aria-hidden', 'true'); icon.textContent = '✦';
    const titleText = document.createElement('span');
    titleText.className = 'av-title-text';
    const head = document.createElement('span');
    head.className = 'av-title-h'; head.textContent = 'Visual Explanation';
    const sub = document.createElement('span');
    sub.className = 'av-title-sub'; sub.textContent = def.label;
    titleText.appendChild(head); titleText.appendChild(sub);
    title.appendChild(icon); title.appendChild(titleText);

    const controls = document.createElement('div');
    controls.className = 'av-controls';
    const playBtn = document.createElement('button');
    playBtn.type = 'button'; playBtn.className = 'av-btn av-btn-primary'; playBtn.setAttribute('aria-label', 'Play or pause');
    const replayBtn = document.createElement('button');
    replayBtn.type = 'button'; replayBtn.className = 'av-btn'; replayBtn.setAttribute('aria-label', 'Replay'); replayBtn.textContent = '↻';
    controls.appendChild(playBtn); controls.appendChild(replayBtn);
    bar.appendChild(title); bar.appendChild(controls);

    /* ---- the SVG canvas ---- */
    const svg = svgEl('svg', { viewBox:'0 0 400 250', class:'av-svg', preserveAspectRatio:'xMidYMid meet', role:'img', 'aria-label':def.label });

    /* ---- optional sliders (instant reaction, even when paused) ---- */
    const sliders = def.sliders || [];
    let sliderWrap = null;
    if(sliders.length){
      sliderWrap = document.createElement('div');
      sliderWrap.className = 'av-sliders';
      sliders.forEach(s => {
        const row = document.createElement('label');
        row.className = 'av-slider';
        const name = document.createElement('span'); name.textContent = s.label;
        const val = document.createElement('b'); val.textContent = p[s.key] + (s.unit || '');
        const input = document.createElement('input');
        input.type = 'range'; input.min = s.min; input.max = s.max; input.step = s.step; input.value = p[s.key];
        input.addEventListener('input', () => {
          p[s.key] = parseFloat(input.value);
          val.textContent = input.value + (s.unit || '');
          def.update(ctx, p, t);            /* instant reaction, even when paused */
        });
        row.appendChild(name); row.appendChild(input); row.appendChild(val);
        sliderWrap.appendChild(row);
      });
    }

    /* ---- footer status bar (demo chrome) ---- */
    const foot = document.createElement('div');
    foot.className = 'av-foot';
    const status = document.createElement('span');
    status.className = 'av-status';
    const badge = document.createElement('span');
    badge.className = 'av-badge'; badge.textContent = 'Aura generated';
    foot.appendChild(status); foot.appendChild(badge);

    /* ---- assemble: card holds everything; wrap is the glow shell ---- */
    card.appendChild(bar);
    card.appendChild(svg);
    if(sliderWrap) card.appendChild(sliderWrap);
    card.appendChild(foot);
    wrap.appendChild(card);
    mount.appendChild(wrap);

    const ctx = { svg, uid:'av' + (_uid++), refs:{} };
    def.build(ctx, p);

    function frame(now){
      const dt = last ? (now - last) / 1000 : 0;
      last = now; t += dt;
      def.update(ctx, p, t);
      raf = requestAnimationFrame(frame);
    }
    function start(){ if(raf) return; last = 0; raf = requestAnimationFrame(frame); }
    function stop(){ if(raf) cancelAnimationFrame(raf); raf = 0; }
    function setIcon(){ playBtn.innerHTML = playing ? '⏸' : '▶'; }
    function setStatus(){ status.textContent = playing ? 'Playing • Educational animation' : 'Paused • Press play to resume'; }
    function setPlaying(v){ playing = v; setIcon(); setStatus(); if(playing) start(); else stop(); }
    function replay(){ t = 0; last = 0; def.update(ctx, p, t); if(!playing) setPlaying(true); }

    playBtn.addEventListener('click', () => setPlaying(!playing));
    replayBtn.addEventListener('click', replay);
    replayBtn.innerHTML = '↻';

    setPlaying(true);                                 /* autoplay on mount */

    return {
      el: wrap,
      setPlaying,
      replay,
      setParam(k, v){ if(k in p){ p[k] = v; def.update(ctx, p, t); } },
      getParams(){ return Object.assign({}, p); },
      destroy(){ stop(); mount.innerHTML = ''; }
    };
  }

  window.XC.auraVisuals = { detect, extractParams, createPlayer, VISUALS };
})();
