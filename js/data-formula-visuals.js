/* ============================================================
   DATA — FORMULA VISUALS (step-aware, full-size)
   ------------------------------------------------------------
   Loaded after data-visuals.js. Every export is named exactly
   as the `visual:` key on FORMULAS[] in data-formulas.js and is
   merged into window.XC.SVG, so app.js can call fn(step) and get
   an animated SVG that tracks the formula's derivation steps.

   The small "*Min" thumbs already in data-visuals.js are used for
   the catalog grid; these are the large stage versions.
   ============================================================ */
window.XC = window.XC || {};

const FV_TEAL = '#2dd4bf';
const FV_GOLD = '#facc15';
const FV_GRN  = '#22c55e';
const FV_PUR  = '#a78bfa';
const FV_RED  = '#ef4444';
const FV_IDLE = '#334155';

/* Colour a slot by how far the derivation has reached it. */
function fvC(step, i){ return i < step ? FV_GRN : (i === step ? FV_GOLD : FV_IDLE); }

/* Frame opener with the two-line header used by every stage visual. */
function fvOpen(title, sub){
  return `<svg viewBox="0 0 400 280" style="width:100%;height:100%;max-width:440px" role="img" aria-label="${title}">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="${FV_TEAL}">${title}</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" font-weight="600" fill="#6b7280">${sub}</text>`;
}

/* Progress dots + closing tag. */
function fvDots(step, total){
  const n = Math.min(total, 12);
  let s = '';
  for (let i = 0; i < n; i++){
    const x = 200 - ((n - 1) * 9) / 2 + i * 9;
    s += `<circle cx="${x.toFixed(1)}" cy="266" r="3.5" fill="${i <= step ? FV_TEAL : '#1e2a44'}"/>`;
  }
  return s + '</svg>';
}

/* The single big equation pill sitting above the dots. */
function fvMath(txt, color){
  const col = color || FV_GOLD;
  return `<rect x="106" y="228" width="188" height="26" rx="13" fill="#0f172a" stroke="${col}" stroke-width="1.4"/>
    <text x="200" y="246" text-anchor="middle" font-size="12" font-family="ui-monospace,Menlo,monospace" font-weight="800" fill="${col}">${txt}</text>`;
}

/* Labeled box. */
function fvNode(x, y, w, h, label, fill){
  const txt = fill === FV_IDLE ? '#5b6b85' : '#fff';
  return `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="7" fill="#111a2e" stroke="${fill}" stroke-width="1.6"/>
    <text x="${x}" y="${y + 4}" text-anchor="middle" font-size="10" font-weight="800" fill="${txt}">${label}</text>`;
}

/* Arrow that only appears once its step is reached. */
function fvArrow(x1, y1, x2, y2, on, color){
  if (!on) return '';
  const col = color || FV_GOLD;
  const back = x2 > x1 ? 7 : -7;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="1.8"/>
    <polygon points="${x2},${y2} ${x2 - back},${y2 - 4} ${x2 - back},${y2 + 4}" fill="${col}"/>`;
}

/* Row of bit cells, highlighted by index. */
function fvBits(labels, fills, y){
  const step = 42;
  const x0 = 200 - ((labels.length - 1) * step) / 2;
  let s = '';
  labels.forEach((b, i) => {
    const x = x0 + i * step;
    const f = fills[i];
    const light = f !== '#111a2e';
    s += `<rect x="${x - 18}" y="${y - 16}" width="36" height="32" rx="6" fill="${f}" stroke="${light ? f : FV_IDLE}" stroke-width="1.4"/>
      <text x="${x}" y="${y + 5}" text-anchor="middle" font-size="12" font-family="ui-monospace,Menlo,monospace" font-weight="800" fill="${light ? '#000' : '#5b6b85'}">${b}</text>`;
  });
  return s;
}
/* ============================================================
   UNIT I — TOPOLOGY + ERROR CONTROL
   ============================================================ */

/* n(n-1)/2 — nodes light up, then every link, then the halving. */
function meshLinks(step){
  const N = [{x:200,y:70,l:'1'},{x:320,y:125,l:'2'},{x:280,y:220,l:'3'},{x:120,y:220,l:'4'},{x:80,y:125,l:'5'}];
  const E = [[0,1],[0,2],[0,3],[0,4],[1,2],[2,3],[3,4],[1,4],[2,4],[1,3]];
  let s = fvOpen('FULL MESH - every node to every node', 'n(n-1)/2 · n = 5 · 10 links');
  N.forEach((n,i) => {
    s += `<circle cx="${n.x}" cy="${n.y}" r="30" fill="none" stroke="${fvC(step,i)}" stroke-width="1" opacity="0.5">
      <animate attributeName="r" values="28;34;28" dur="2.4s" begin="${i*0.3}s" repeatCount="indefinite"/></circle>`;
    s += fvNode(n.x, n.y, 42, 28, n.l, fvC(step,i));
  });
  const live = step >= 2 ? E.length : step === 1 ? 5 : 0;
  E.forEach(([a,b],i) => {
    if (i >= live) return;
    const A = N[a], B = N[b];
    s += `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="${FV_TEAL}" stroke-width="1.6" opacity="0.8"/>
      <circle r="2.6" fill="${FV_GRN}"><animateMotion dur="${1.4+i*0.08}s" repeatCount="indefinite" path="M ${A.x} ${A.y} L ${B.x} ${B.y}"/></circle>`;
  });
  if (step >= 3) s += `<text x="200" y="192" text-anchor="middle" font-size="11" font-weight="800" fill="${FV_RED}">5 x 4 = 20, each link counted twice</text>
    <text x="200" y="207" text-anchor="middle" font-size="11" font-weight="800" fill="${FV_GRN}">20 / 2 = 10 real links</text>`;
  return s + fvMath(step >= 3 ? 'n(n-1)/2 = 10' : step >= 2 ? '5 x 4 = 20 (x2)' : step >= 1 ? 'n - 1 = 4' : 'n = 5', step >= 3 ? FV_GRN : FV_GOLD) + fvDots(step, 5);
}

function starLinks(step){
  const cx = 200, cy = 130;
  const N = [{x:80,y:70,l:'A'},{x:200,y:60,l:'B'},{x:320,y:70,l:'C'},{x:80,y:190,l:'D'},{x:320,y:190,l:'E'}];
  let s = fvOpen('STAR - one dedicated link per node', 'Links = n · n = 5 · hub is a SPOF');
  N.forEach((n,i) => {
    if (step >= 1) s += `<line x1="${cx}" y1="${cy}" x2="${n.x}" y2="${n.y}" stroke="${FV_TEAL}" stroke-width="1.8" opacity="0.85"/>
      <circle r="3" fill="${FV_GOLD}"><animateMotion dur="${1.4+i*0.12}s" repeatCount="indefinite" path="M ${n.x} ${n.y} L ${cx} ${cy}"/></circle>`;
    s += `<circle cx="${n.x}" cy="${n.y}" r="22" fill="none" stroke="${fvC(step,i)}" stroke-width="1" opacity="0.4">
      <animate attributeName="r" values="20;26;20" dur="2s" begin="${i*0.3}s" repeatCount="indefinite"/></circle>`;
    s += fvNode(n.x, n.y, 40, 26, n.l, fvC(step,i));
  });
  s += `<circle cx="${cx}" cy="${cy}" r="34" fill="none" stroke="${step>=2?FV_RED:FV_IDLE}" stroke-width="1.4" opacity="0.6">
    <animate attributeName="r" values="32;46;32" dur="2.2s" repeatCount="indefinite"/></circle>`;
  s += fvNode(cx, cy, 92, 36, 'SWITCH', step >= 2 ? FV_RED : FV_TEAL);
  return s + fvMath(step >= 3 ? '5 x 1 = 5 links' : step >= 2 ? '5 nodes x 1 link' : step >= 1 ? '1 link each' : 'n = 5', step >= 3 ? FV_GRN : FV_GOLD) + fvDots(step, 4);
}

function busTerm(step){
  const y = 140;
  let s = fvOpen('BUS - both ends need a terminator', 'Terminators = 2 · always, at both ends');
  s += `<rect x="60" y="${y-9}" width="280" height="18" rx="4" fill="#111a2e" stroke="${FV_TEAL}" stroke-width="1.6"/>`;
  [{x:110,l:'A'},{x:165,l:'B'},{x:235,l:'C'},{x:290,l:'D'}].forEach((t,i) => {
    if (step >= 1) s += `<line x1="${t.x}" y1="${y}" x2="${t.x}" y2="${y-34}" stroke="${FV_TEAL}" stroke-width="1.4"/>`;
    s += fvNode(t.x, y - 48, 34, 22, t.l, fvC(step, i));
  });
  if (step >= 1) s += fvNode(40, y, 40, 26, 'TERM', FV_RED)
    + `<circle cx="40" cy="${y}" r="22" fill="none" stroke="${FV_RED}" stroke-width="1" opacity="0.5"><animate attributeName="r" values="20;30;20" dur="2s" repeatCount="indefinite"/></circle>`;
  if (step >= 2) s += fvNode(360, y, 40, 26, 'TERM', FV_RED)
    + `<circle cx="360" cy="${y}" r="22" fill="none" stroke="${FV_RED}" stroke-width="1" opacity="0.5"><animate attributeName="r" values="20;30;20" dur="2s" begin="1s" repeatCount="indefinite"/></circle>`;
  s += `<text x="200" y="205" text-anchor="middle" font-size="9" font-weight="700" fill="${step>=1?FV_RED:'#6b7280'}">${step>=1 ? 'an open end reflects the signal, terminators absorb it' : 'one shared backbone, every node taps in'}</text>`;
  return s + fvMath(step >= 3 ? '2 terminators' : step >= 2 ? 'left + right' : step >= 1 ? '+ 1 terminator' : '1 shared cable', step >= 3 ? FV_GRN : FV_GOLD) + fvDots(step, 4);
}
/* 2^r >= d + r + 1 — table rows light up one per step. */
function hammingR(step){
  const rows = [['r=1','2','6','x'],['r=2','4','7','x'],['r=3','8','8','OK']];
  const hl = step >= 3 ? 3 : step >= 2 ? 2 : step >= 1 ? 1 : 0;
  let s = fvOpen('HAMMING - find r for d = 4', '2^r >= d + r + 1');
  ['r','2^r','d+r+1','fits?'].forEach((h,i) => {
    s += `<text x="${[46,126,212,318][i]}" y="56" font-size="9" font-weight="800" fill="#6b7280">${h}</text>`;
  });
  rows.forEach((r,i) => {
    const y = 78 + i * 32;
    const on = i < hl;
    const col = on ? (r[3] === 'OK' ? FV_GRN : FV_RED) : FV_IDLE;
    const cur = (i === hl - 1 && hl > 0);
    s += `<rect x="30" y="${y-17}" width="322" height="27" rx="6" fill="${cur ? '#132033' : 'transparent'}" stroke="${cur ? col : 'transparent'}" stroke-width="1.2"/>`;
    [r[0],r[1],r[2]].forEach((t,j) => {
      s += `<text x="${[46,126,212][j]}" y="${y+3}" font-size="11" font-family="ui-monospace,Menlo,monospace" font-weight="800" fill="${col}">${t}</text>`;
    });
    s += `<text x="318" y="${y+4}" font-size="11" font-weight="900" fill="${col}">${on ? r[3] : '-'}</text>`;
  });
  s += `<text x="200" y="198" text-anchor="middle" font-size="10" font-weight="700" fill="${step>=3?FV_GRN:'#6b7280'}">${step>=3 ? 'smallest r that fits, code word = d + r = 7 bits' : 'grow r until the parity bits can cover the data'}</text>`;
  return s + fvMath(step >= 3 ? 'd + r = 4 + 3 = 7' : step >= 2 ? '2^3 = 8 >= 8 OK' : step >= 1 ? '2^2 = 4 < 7 no' : 'd = 4', step >= 3 ? FV_GRN : FV_GOLD) + fvDots(step, 4);
}

function hammingPos(step){
  const bits = ['d1','d2','d3','d4','r1','r2','r4'];
  const idle = ['#111a2e','#111a2e','#111a2e','#111a2e','#22c55e','#ef4444','#ef4444'];
  const fixed = ['#facc15','#facc15','#22c55e','#111a2e','#22c55e','#22c55e','#22c55e'];
  const st = step >= 3 ? fixed : idle;
  let s = fvOpen('HAMMING - parity bits locate the error', 'pos = r4*4 + r2*2 + r1*1');
  bits.forEach((b,i) => {
    const x = 44 + i * 52;
    const bad = st[i] === '#ef4444';
    const on = st[i] === '#22c55e' || st[i] === '#facc15';
    s += `<rect x="${x-21}" y="58" width="42" height="42" rx="6" fill="${st[i]}" stroke="${bad?FV_RED:FV_TEAL}" stroke-width="1.4"/>
      <text x="${x}" y="75" text-anchor="middle" font-size="10" font-weight="800" fill="${bad||on?'#000':'#cbd5e1'}">${b}</text>
      <text x="${x}" y="90" text-anchor="middle" font-size="8" font-weight="700" fill="${bad||on?'#000':'#6b7280'}">P${i+1}</text>`;
    if (bad) s += `<circle cx="${x}" cy="79" r="26" fill="none" stroke="${FV_RED}" stroke-width="1.4"><animate attributeName="r" values="24;32;24" dur="1.6s" repeatCount="indefinite"/></circle>`;
  });
  s += `<text x="200" y="126" text-anchor="middle" font-size="9" font-weight="800" fill="#6b7280">PARITY CHECKS</text>`;
  [['r1','0'],['r2','0'],['r4','1']].forEach((p,i) => {
    const x = 90 + i * 110, on = step >= 1;
    const col = on ? (p[1] === '1' ? FV_RED : FV_GRN) : FV_IDLE;
    s += `<rect x="${x-36}" y="138" width="72" height="28" rx="14" fill="#0f172a" stroke="${col}" stroke-width="1.4"/>
      <text x="${x}" y="157" text-anchor="middle" font-size="11" font-family="ui-monospace,Menlo,monospace" font-weight="800" fill="${col}">${p[0]} = ${p[1]}</text>`;
  });
  if (step >= 2) s += `<text x="200" y="192" text-anchor="middle" font-size="12" font-family="ui-monospace,Menlo,monospace" font-weight="800" fill="${FV_TEAL}">r4 r2 r1 = 100 = 4</text>`;
  if (step >= 3) s += `<text x="200" y="208" text-anchor="middle" font-size="10" font-weight="700" fill="${FV_GRN}">flip the single bit the parity pointed at</text>`;
  return s + fvMath(step >= 3 ? 'flip bit 4' : step >= 2 ? '100 = 4' : step >= 1 ? 'r4 r2 r1 = 100' : 'recount parities', step >= 3 ? FV_GRN : FV_GOLD) + fvDots(step, 4);
}

/* S = G * e^(-2G) — the real curve with the peak marked. */
function pureAloha(step){
  let s = fvOpen('PURE ALOHA - throughput falls as load rises', 'S = G * e^(-2G)');
  const pt = (g) => ({ x: 50 + g * 300, y: 170 - (g * Math.exp(-2 * g)) * 430 });
  let d = '';
  for (let i = 0; i <= 60; i++) {
    const g = i / 60, p = pt(g);
    d += `${d ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
  }
  s += `<line x1="50" y1="170" x2="350" y2="170" stroke="#1e2a44" stroke-width="1"/>
    <line x1="50" y1="170" x2="50" y2="45" stroke="#1e2a44" stroke-width="1"/>
    <path d="${d}" fill="none" stroke="${FV_TEAL}" stroke-width="2.2" opacity="0.9"/>
    <text x="352" y="184" text-anchor="end" font-size="8" font-weight="700" fill="#6b7280">G (load)</text>
    <text x="44" y="52" font-size="8" font-weight="700" fill="#6b7280">S</text>`;
  const peak = pt(0.5);
  s += `<circle cx="${peak.x}" cy="${peak.y}" r="5" fill="${step>=2?FV_GRN:FV_GOLD}"><animate attributeName="r" values="4;8;4" dur="2s" repeatCount="indefinite"/></circle>
    <text x="${peak.x}" y="${peak.y-13}" text-anchor="middle" font-size="8" font-weight="800" fill="${FV_GOLD}">peak ~18.4%</text>`;
  if (step >= 1) s += `<line x1="${peak.x}" y1="45" x2="${peak.x}" y2="170" stroke="${FV_GOLD}" stroke-width="1" stroke-dasharray="3 3" opacity="0.7"/>`;
  if (step >= 3) s += `<text x="200" y="205" text-anchor="middle" font-size="10" font-weight="700" fill="${FV_GRN}">only ~1 frame in 5 survives, very wasteful</text>`;
  return s + fvMath(step >= 3 ? '18.4% maximum' : step >= 2 ? '0.5 x 0.368 = 0.184' : step >= 1 ? '0.5 * e^-1 ~ 0.368' : 'S = G * e^(-2G)', step >= 3 ? FV_GRN : FV_GOLD) + fvDots(step, 4);
}
/* Vulnerable window drawn as a real timeline. */
function vulnTime(step){
  const x0 = 40, x1 = 360, y = 150, T = x1 - x0, fw = T / 3;
  let s = fvOpen('ALOHA - the vulnerable window', 'T_vuln = 2 x T_fr (Pure) · T_fr (Slotted)');
  s += `<rect x="${x0}" y="${y-34}" width="${T}" height="34" rx="8" fill="#0f172a" stroke="${FV_IDLE}" stroke-width="1.2"/>`;
  if (step >= 3) s += `<rect x="${x0}" y="${y-34}" width="${2*fw}" height="34" fill="${FV_RED}" opacity="0.22" stroke="${FV_RED}" stroke-width="1.4" stroke-dasharray="4 3"/>`;
  s += `<rect x="${x0+fw}" y="${y-34}" width="${fw}" height="34" fill="none" stroke="${step>=3?FV_RED:FV_TEAL}" stroke-width="1.8"/>`;
  s += `<text x="${x0+fw/2}" y="${y-42}" text-anchor="middle" font-size="8" font-weight="700" fill="#6b7280">before</text>
    <text x="${x0+fw*1.5}" y="${y-42}" text-anchor="middle" font-size="8" font-weight="700" fill="#6b7280">frame</text>
    <text x="${x0+fw*2.5}" y="${y-42}" text-anchor="middle" font-size="8" font-weight="700" fill="#6b7280">after</text>`;
  [x0+fw, x0+fw*2].forEach((mx,i) => {
    s += `<line x1="${mx}" y1="${y}" x2="${mx}" y2="${y+16}" stroke="${fvC(step,i)}" stroke-width="1.6"/>
      <text x="${mx}" y="${y+30}" text-anchor="middle" font-size="9" font-weight="800" fill="${fvC(step,i)}">T_fr</text>`;
  });
  if (step >= 3) s += `<line x1="${x0}" y1="${y+52}" x2="${x0+fw*2}" y2="${y+52}" stroke="${FV_RED}" stroke-width="1.6"/>
    <polygon points="${x0},${y+52} ${x0+6},${y+48} ${x0+6},${y+56}" fill="${FV_RED}"/>
    <polygon points="${x0+fw*2},${y+52} ${x0+fw*2-6},${y+48} ${x0+fw*2-6},${y+56}" fill="${FV_RED}"/>
    <text x="${x0+fw}" y="${y+68}" text-anchor="middle" font-size="10" font-weight="800" fill="${FV_RED}">T_vuln = 2 x T_fr</text>`;
  return s + fvMath(step >= 3 ? 'T_vuln = 2 x T_fr' : step >= 2 ? 'during + T_fr' : step >= 1 ? 'before + T_fr' : 'frame takes T_fr', step >= 3 ? FV_RED : FV_GOLD) + fvDots(step, 4);
}

/* Round trip out and back; the frame must outlast it. */
function minFrame(step){
  const y = 140;
  let s = fvOpen('CSMA/CD - the frame must outlast the round trip', 'T_fr >= 2 x T_p');
  s += fvNode(70, y, 78, 34, 'SENDER', step >= 3 ? FV_GRN : FV_TEAL);
  s += fvNode(330, y, 78, 34, 'FAR END', FV_PUR);
  if (step >= 1) s += `<line x1="110" y1="${y}" x2="290" y2="${y}" stroke="${FV_GOLD}" stroke-width="2" stroke-dasharray="5 4"/>
    <circle r="3.5" fill="${FV_GOLD}"><animateMotion dur="1.6s" repeatCount="indefinite" path="M 110 ${y} L 290 ${y}"/></circle>
    <text x="200" y="${y-12}" text-anchor="middle" font-size="9" font-weight="800" fill="${FV_GOLD}">T_p outbound</text>`;
  if (step >= 2) s += `<line x1="290" y1="${y}" x2="110" y2="${y}" stroke="${FV_RED}" stroke-width="2" stroke-dasharray="5 4" opacity="0.9">
    <animate attributeName="opacity" values="0.2;1;0.2" dur="1.6s" repeatCount="indefinite"/></line>
    <circle r="3.5" fill="${FV_RED}"><animateMotion dur="1.6s" begin="1.6s" repeatCount="indefinite" path="M 290 ${y} L 110 ${y}"/></circle>
    <text x="200" y="${y+24}" text-anchor="middle" font-size="9" font-weight="800" fill="${FV_RED}">T_p collision returns</text>`;
  if (step >= 3) s += `<text x="200" y="204" text-anchor="middle" font-size="10" font-weight="700" fill="${FV_GRN}">still transmitting when the echo arrives, collision detected</text>`;
  return s + fvMath(step >= 3 ? 'T_fr >= 2 x T_p' : step >= 2 ? '2 x T_p' : step >= 1 ? 'out + back' : 'T_p one way', step >= 3 ? FV_GRN : FV_GOLD) + fvDots(step, 4);
}

/* ============================================================
   UNIT II — SLIDING WINDOW + ERROR DETECTION
   ============================================================ */

/* Circular sequence-number ring shared by the two window formulas. */
function fvRing(title, sub, total, win, cur, note, mathFn, step){
  const R = 62, cx = 200, cy = 118;
  let s = fvOpen(title, sub);
  s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${FV_IDLE}" stroke-width="1.4"/>`;
  for (let i = 0; i < total; i++) {
    const a = -Math.PI / 2 + (i / total) * Math.PI * 2;
    const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
    const isCur = i === cur, inWin = i < win;
    const col = isCur ? FV_GOLD : (inWin ? FV_TEAL : FV_IDLE);
    s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${isCur?15:11}" fill="${isCur?FV_GOLD:'#111a2e'}" stroke="${col}" stroke-width="1.8">
      <animate attributeName="r" values="${isCur?13:15};${isCur?17:15};${isCur?13:15}" dur="2s" repeatCount="indefinite"/></circle>
      <text x="${x.toFixed(1)}" y="${(y+4).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="800" fill="${isCur?'#000':(inWin?'#fff':'#5b6b85')}">${i}</text>`;
  }
  s += `<circle cx="${cx}" cy="${cy}" r="34" fill="#0b1320" stroke="${FV_TEAL}" stroke-width="1.4"/>
    <text x="${cx}" y="${cy-2}" text-anchor="middle" font-size="9" font-weight="800" fill="#6b7280">send</text>
    <text x="${cx}" y="${cy+13}" text-anchor="middle" font-size="15" font-weight="900" fill="${FV_GOLD}">${cur}</text>
    <text x="200" y="204" text-anchor="middle" font-size="10" font-weight="700" fill="${step>=3?FV_GRN:'#6b7280'}">${note}</text>`;
  return s + fvMath(mathFn(step), step >= 3 ? FV_GRN : FV_GOLD) + fvDots(step, 4);
}

function gbnWin(step){
  return fvRing('GO-BACK-N - reserve one number', 'W_send = 2^m - 1 · m = 4', 16, 16, 0,
    step >= 3 ? 'one value held back keeps old and new frames distinct' : 'all 16 sequence numbers, one is about to be given up',
    st => st >= 3 ? '16 - 1 = 15' : st >= 2 ? 'reserve 1 -> 15' : st >= 1 ? '2^4 = 16 values' : 'm = 4 bits', step);
}

function srWin(step){
  return fvRing('SELECTIVE REPEAT - split the space', 'W = 2^(m-1) · m = 4', 16, 8, 4,
    step >= 3 ? 'send half + receive half, no overlap on either side' : 'only half the ring may be in flight at once',
    st => st >= 3 ? '16 / 2 = 8' : st >= 2 ? 'send 8 + recv 8' : st >= 1 ? '2^4 = 16 values' : 'm = 4 bits', step);
}
/* Parity rule — the parity bit flips in as the count is judged. */
function parityRule(step){
  const data = ['1','0','0','0','1','1'];
  let s = fvOpen('PARITY - force the 1-count to be even', 'odd count -> parity = 1');
  s += fvBits(data, data.map((b,i) => step >= 1 ? ((i < 4 && b === '1') ? '#facc15' : '#22c55e') : '#111a2e'), 76);
  s += `<text x="200" y="112" text-anchor="middle" font-size="9" font-weight="800" fill="#6b7280">DATA 100011 -> 3 ones</text>
    <rect x="182" y="130" width="36" height="32" rx="6" fill="${step>=2?FV_GOLD:'#111a2e'}" stroke="${step>=2?FV_GOLD:FV_IDLE}" stroke-width="1.4"/>
    <text x="200" y="152" text-anchor="middle" font-size="13" font-family="ui-monospace,Menlo,monospace" font-weight="800" fill="${step>=2?'#000':'#5b6b85'}">P</text>`;
  if (step >= 3) s += `<text x="200" y="190" text-anchor="middle" font-size="12" font-family="ui-monospace,Menlo,monospace" font-weight="800" fill="${FV_GRN}">1000111 -> 4 ones (even)</text>
    <text x="200" y="206" text-anchor="middle" font-size="9" font-weight="700" fill="#6b7280">receiver recomputes parity and compares</text>`;
  return s + fvMath(step >= 3 ? '100011 1, 4 ones' : step >= 2 ? 'odd -> parity = 1' : step >= 1 ? 'count = 3 (odd)' : 'parity = ?', step >= 3 ? FV_GRN : FV_GOLD) + fvDots(step, 4);
}

/* 1's complement sum with end-around carry. */
function checksumRule(step){
  const segs = ['10011001','11100010','00100100','10000100'];
  const live = step >= 2 ? 4 : step >= 1 ? 2 : 0;
  let s = fvOpen('CHECKSUM - 1s complement sum of segments', 'k = 4 segments · m = 8 bits');
  segs.forEach((g,i) => {
    const y = 64 + i * 26, on = i < live;
    s += `<text x="22" y="${y}" font-size="9" font-weight="800" fill="#6b7280">s${i+1}</text>
      <text x="60" y="${y}" font-size="12" font-family="ui-monospace,Menlo,monospace" font-weight="800" fill="${on?FV_TEAL:FV_IDLE}">${g}</text>`;
    if (on) s += fvArrow(150, y-4, 192, y-4, true, FV_GOLD);
  });
  s += `<rect x="248" y="52" width="120" height="112" rx="10" fill="#0f172a" stroke="${step>=3?FV_GOLD:FV_IDLE}" stroke-width="1.4"/>
    <text x="308" y="78" text-anchor="middle" font-size="9" font-weight="800" fill="#6b7280">RESULT</text>
    <text x="308" y="108" text-anchor="middle" font-size="14" font-family="ui-monospace,Menlo,monospace" font-weight="800" fill="${step>=3?FV_GOLD:FV_IDLE}">0000</text>
    <text x="308" y="128" text-anchor="middle" font-size="9" font-weight="700" fill="${step>=3?FV_GRN:'#5b6b85'}">~ = checksum</text>
    <text x="308" y="148" text-anchor="middle" font-size="8" font-weight="700" fill="#6b7280">end-around carry</text>`;
  return s + fvMath(step >= 3 ? '~11111111 = 0000' : step >= 2 ? 'add all 4 segments' : step >= 1 ? 's1 + s2 first' : 'split into segments', step >= 3 ? FV_GRN : FV_GOLD) + fvDots(step, 4);
}

/* Binary long division laid out like real long division. */
function crcRule(step){
  const L = (t,x,y,col,sz) => `<text x="${x}" y="${y}" font-size="${sz||12}" font-family="ui-monospace,Menlo,monospace" font-weight="800" fill="${col}">${t}</text>`;
  let s = fvOpen('CRC - binary long division', 'data * 2^n / generator -> remainder');
  s += `<text x="24" y="66" font-size="10" font-weight="800" fill="${FV_PUR}">G = 1001</text>
    <text x="24" y="86" font-size="10" font-weight="800" fill="#6b7280">degree 3, append 3 zeros</text>`;
  s += L('1010000', 236, 110, step >= 1 ? FV_TEAL : FV_IDLE, 13);
  if (step >= 2) {
    s += L('1001', 236, 138, FV_PUR, 13);
    s += `<line x1="228" y1="118" x2="338" y2="118" stroke="${FV_PUR}" stroke-width="1.4"/>
      <line x1="228" y1="146" x2="338" y2="146" stroke="${FV_PUR}" stroke-width="1.4"/>
      <line x1="228" y1="164" x2="338" y2="164" stroke="${FV_GOLD}" stroke-width="1.4"/>
      ${L('1101000', 236, 184, '#5b6b85')}`;
  }
  if (step >= 3) {
    s += L('011', 292, 206, FV_GRN, 14);
    s += `<circle cx="301" cy="202" r="20" fill="none" stroke="${FV_GRN}" stroke-width="1.2"><animate attributeName="r" values="18;26;18" dur="2s" repeatCount="indefinite"/></circle>`;
  }
  return s + fvMath(step >= 3 ? 'remainder = 011' : step >= 2 ? 'long division' : step >= 1 ? '1010 -> 1010000' : 'G = 1001', step >= 3 ? FV_GRN : FV_GOLD) + fvDots(step, 4);
}
/* ============================================================
   UNIT III — ROUTING + CONGESTION
   ============================================================ */

/* Small weighted graph shared by dijkstraRelax and dvUpdate. */
function fvGraph(step, showD){
  const N = { A:[70,120], B:[200,70], C:[200,170], D:[330,120] };
  let s = '';
  [['A','B',2],['A','C',4],['B','D',3],['C','D',1]].forEach(([a,b,w]) => {
    const A = N[a], B = N[b];
    const hot = (a === 'A' && b === 'B' && step >= 2);
    s += `<line x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}" stroke="${hot?FV_GOLD:FV_IDLE}" stroke-width="${hot?2.2:1.4}"/>
      <text x="${(A[0]+B[0])/2}" y="${(A[1]+B[1])/2 - 6}" text-anchor="middle" font-size="9" font-weight="800" fill="${hot?FV_GOLD:'#6b7280'}">${w}</text>`;
    if (hot) s += `<circle r="3" fill="${FV_GOLD}"><animateMotion dur="1.4s" repeatCount="indefinite" path="M ${A[0]} ${A[1]} L ${B[0]} ${B[1]}"/></circle>`;
  });
  Object.keys(N).forEach((k) => {
    const p = N[k], isA = k === 'A', isB = k === 'B';
    const col = isA ? FV_GRN : (isB && step >= 3 ? FV_GOLD : (step >= 1 ? FV_TEAL : FV_IDLE));
    s += `<circle cx="${p[0]}" cy="${p[1]}" r="21" fill="#111a2e" stroke="${col}" stroke-width="1.8"/>
      <text x="${p[0]}" y="${p[1]+4}" text-anchor="middle" font-size="12" font-weight="900" fill="${col===FV_IDLE?'#5b6b85':'#fff'}">${k}</text>`;
    if (showD) s += `<text x="${p[0]}" y="${p[1]+36}" text-anchor="middle" font-size="9" font-weight="800" fill="${isB&&step>=3?FV_GOLD:'#6b7280'}">D=${isA?0:(k==='B'?(step>=3?'2':'inf'):(k==='C'?'4':'5'))}</text>`;
  });
  return s;
}

function dijkstraRelax(step){
  let s = fvOpen('DIJKSTRA - relax one edge', 'D(v) = min( D(v), D(u)+w(u,v) )');
  s += fvGraph(step, true);
  s += `<text x="200" y="204" text-anchor="middle" font-size="10" font-weight="700" fill="${step>=3?FV_GRN:'#6b7280'}">${step>=3 ? 'candidate 2 beats inf, D(B) is now shortest' : 'take the closest unvisited node, extend outward'}</text>`;
  return s + fvMath(step >= 3 ? 'min(inf, 0+2) = 2' : step >= 2 ? '0 + 2 = 2' : step >= 1 ? 'u = A, D(A)=0' : 'D(v) = min(...)', step >= 3 ? FV_GRN : FV_GOLD) + fvDots(step, 4);
}

function dvUpdate(step){
  let s = fvOpen('DISTANCE VECTOR - compare the tables', 'D_x(y) = min_v { c(x,v) + D_v(y) }');
  s += `<text x="24" y="60" font-size="9" font-weight="800" fill="#6b7280">C advertises { B:4, D:inf }</text>
    <rect x="18" y="70" width="184" height="112" rx="10" fill="#0f172a" stroke="${FV_IDLE}" stroke-width="1.4"/>
    <text x="110" y="90" text-anchor="middle" font-size="9" font-weight="800" fill="#6b7280">c(x,v) = 3</text>`;
  s += fvGraph(Math.min(step,3), false);
  s += `<rect x="226" y="70" width="156" height="112" rx="10" fill="#0b1320" stroke="${step>=3?FV_GOLD:FV_IDLE}" stroke-width="1.4"/>
    <text x="304" y="92" text-anchor="middle" font-size="9" font-weight="800" fill="#6b7280">candidate vs own</text>
    <text x="304" y="124" text-anchor="middle" font-size="12" font-family="ui-monospace,Menlo,monospace" font-weight="800" fill="${step>=3?FV_GOLD:'#5b6b85'}">min(2, 7) = 2</text>
    <text x="304" y="148" text-anchor="middle" font-size="9" font-weight="700" fill="${step>=3?FV_GRN:'#5b6b85'}">keep the old route</text>
    <text x="304" y="166" text-anchor="middle" font-size="8" font-weight="700" fill="#6b7280">via B was better</text>`;
  return s + fvMath(step >= 3 ? 'min(2, 7) = 2' : step >= 2 ? '3 + 4 = 7' : step >= 1 ? 'C table received' : 'add link cost', FV_GOLD) + fvDots(step, 4);
}

/* Table entries per router at each hierarchy depth. */
function hierLevels(step){
  let s = fvOpen('HIERARCHY - tables shrink fast', 'levels = ln N · entries = e * ln N');
  [['flat 720',720,FV_RED],['2 levels',53,FV_GOLD],['3 levels',25,FV_GRN]].forEach(([l,v,c],i) => {
    const y = 66 + i * 40, on = i <= step;
    const w = Math.min(230, Math.max(6, Math.log10(v + 1) * 44));
    s += `<text x="20" y="${y+5}" font-size="9" font-weight="800" fill="${on?c:'#5b6b85'}">${l}</text>
      <rect x="82" y="${y-8}" width="230" height="16" rx="4" fill="#0f172a" stroke="${FV_IDLE}" stroke-width="0.8"/>
      <rect x="82" y="${y-8}" width="${on?w:0}" height="16" rx="4" fill="${c}" opacity="0.8"/>
      <text x="${90+Math.min(230,w)}" y="${y+5}" font-size="10" font-weight="800" fill="${on?c:'#5b6b85'}">${on?v:''}</text>`;
  });
  s += `<text x="200" y="196" text-anchor="middle" font-size="10" font-weight="700" fill="${step>=3?FV_GRN:'#6b7280'}">${step>=3 ? 'ln 720 = 6.6, sweet spot around 6-7 levels' : 'each extra level trades update traffic for table size'}</text>`;
  return s + fvMath(step >= 3 ? 'ln 720 = 6.6' : step >= 2 ? '3 levels -> 25 entries' : step >= 1 ? '2 levels -> 53' : 'flat -> 720', step >= 3 ? FV_GRN : FV_GOLD) + fvDots(step, 4);
}
/* Shared bucket drawing for the leaky/token bucket pair. */
function fvBucket(step, tokenMode, title, sub, mathFn, note){
  let s = fvOpen(title, sub);
  s += `<circle cx="44" cy="118" r="5" fill="${FV_RED}"/><text x="54" y="122" font-size="9" font-weight="700" fill="#cbd5e1">in</text>
    <polygon points="140,70 220,70 206,188 154,188" fill="#0f172a" stroke="${FV_TEAL}" stroke-width="1.8"/>
    <text x="180" y="204" text-anchor="middle" font-size="9" font-weight="800" fill="#6b7280">bucket</text>`;
  if (tokenMode) {
    const tok = step >= 2 ? 3 : step;
    for (let i = 0; i < tok; i++) {
      const cy = 176 - (i % 2) * 22;
      s += `<circle cx="${162+i*16}" cy="${cy}" r="6" fill="${FV_GOLD}"><animate attributeName="cy" values="${cy};${cy-4};${cy}" dur="2s" repeatCount="indefinite"/></circle>`;
    }
    s += `<text x="180" y="58" text-anchor="middle" font-size="9" font-weight="800" fill="${step>=1?FV_GOLD:'#5b6b85'}">tokens: ${step>=2?3:step}</text>`;
  } else {
    const fillH = [26, 62, 100][step > 2 ? 2 : step];
    s += `<rect x="154" y="${188-fillH}" width="52" height="${fillH}" fill="${step>=3?FV_RED:FV_GOLD}" opacity="0.55"/>
      <text x="180" y="58" text-anchor="middle" font-size="9" font-weight="800" fill="${step>=3?FV_RED:FV_GOLD}">${step>=3?'OVERFLOW, drop':'level '+(step>=2?2:step)}</text>`;
  }
  for (let i = 0; i < (step >= 1 ? 3 : 1); i++) {
    s += `<circle r="3.4" fill="${tokenMode?FV_GOLD:FV_GRN}"><animateMotion dur="1.8s" begin="${i*0.5}s" repeatCount="indefinite" path="M 220 148 Q 300 ${148+i*10} 356 118"/></circle>`;
  }
  s += `<polygon points="346,114 356,118 346,122" fill="${FV_GRN}"/>
    <text x="336" y="104" text-anchor="middle" font-size="9" font-weight="800" fill="${FV_GRN}">out @ ${tokenMode?'rate':'r'}</text>
    <text x="200" y="228" text-anchor="middle" font-size="9" font-weight="700" fill="${step>=3?(tokenMode?FV_GRN:FV_RED):'#6b7280'}">${note}</text>`;
  return s + fvMath(mathFn(step), step >= 3 ? (tokenMode ? FV_GRN : FV_RED) : FV_GOLD) + fvDots(step, 4);
}

function leakyBucket(step){
  return fvBucket(step, false, 'LEAKY BUCKET - flat output, no bursts', 'out = r · full -> drop',
    st => st >= 3 ? 'excess -> dropped' : st >= 2 ? 'leak 1 per tick' : st >= 1 ? 'buffer capacity C' : 'bursty input',
    step >= 3 ? 'bucket full, the extra packet is dropped' : 'input may burst, output never does');
}

function tokenBucket(step){
  return fvBucket(step, true, 'TOKEN BUCKET - credit buys a burst', 'tokens = rate · capacity C',
    st => st >= 3 ? 'burst up to C' : st >= 2 ? 'spend the tokens' : st >= 1 ? 'tokens accumulate' : 'idle',
    step >= 3 ? 'stored burst is spent, then the rate returns' : 'idle time banks credit for a later burst');
}

/* Hop counter walking up to the infinity cap. */
function dvInfinity(step){
  const cap = step >= 3 ? 15 : step;
  let s = fvOpen('RIP - infinity is really a hop count', 'infinity = 16 hops, max diameter 15');
  for (let i = 0; i < 16; i++) {
    const x = 34 + i * 21.5;
    const lit = i < cap;
    const col = i === cap ? FV_RED : (lit ? FV_TEAL : FV_IDLE);
    s += `<rect x="${(x-8).toFixed(1)}" y="70" width="17" height="26" rx="3" fill="${lit?'#111a2e':'#0b1320'}" stroke="${col}" stroke-width="1.3"/>
      <text x="${x.toFixed(1)}" y="88" text-anchor="middle" font-size="8" font-weight="800" fill="${col===FV_IDLE?'#5b6b85':'#fff'}">${i+1}</text>`;
  }
  s += `<text x="200" y="126" text-anchor="middle" font-size="10" font-weight="800" fill="${step>=3?FV_RED:'#6b7280'}">${step>=3 ? '16 is unreachable, anything 16 hops or more is called infinity' : 'count hops as the table is passed along'}</text>`;
  [[80,170],[200,190],[320,170]].forEach((p,i) => {
    const on = i <= step;
    s += `<circle cx="${p[0]}" cy="${p[1]}" r="15" fill="#111a2e" stroke="${on?FV_TEAL:FV_IDLE}" stroke-width="1.6"/>
      <text x="${p[0]}" y="${p[1]+4}" text-anchor="middle" font-size="9" font-weight="800" fill="${on?'#fff':'#5b6b85'}">R${i+1}</text>`;
    if (on && i > 0) s += fvArrow(p[0]-72, p[1]-6, p[0]-18, p[1]-6, true, FV_GOLD);
  });
  s += `<text x="200" y="222" text-anchor="middle" font-size="9" font-weight="700" fill="${step>=3?FV_GRN:'#6b7280'}">${step>=3 ? 'scale limit, a wider network needs another protocol' : 'each router adds 1 to the hop count it received'}</text>`;
  return s + fvMath(step >= 3 ? 'max hops = 15' : step >= 2 ? 'infinity := 16' : step >= 1 ? 'infinity := 100' : 'infinity', step >= 3 ? FV_RED : FV_GOLD) + fvDots(step, 4);
}
/* ============================================================
   UNIT IV — TCP FLOW + CONGESTION CONTROL
   ============================================================ */

/* Effective window = the smaller of the two limits. */
function fTcpWindow(step){
  let s = fvOpen('TCP - the smaller limit wins', 'W_eff = min( rwnd, cwnd )');
  s += `<rect x="34" y="70" width="146" height="52" rx="10" fill="#0f172a" stroke="${step>=1?FV_TEAL:FV_IDLE}" stroke-width="1.6"/>
    <text x="107" y="92" text-anchor="middle" font-size="9" font-weight="800" fill="#6b7280">rwnd</text>
    <text x="107" y="112" text-anchor="middle" font-size="15" font-weight="900" fill="${step>=1?FV_TEAL:'#5b6b85'}">8 KB</text>
    <text x="107" y="136" text-anchor="middle" font-size="8" font-weight="700" fill="#6b7280">receiver buffer</text>`;
  s += `<rect x="220" y="70" width="146" height="52" rx="10" fill="#0f172a" stroke="${step>=2?FV_PUR:FV_IDLE}" stroke-width="1.6"/>
    <text x="293" y="92" text-anchor="middle" font-size="9" font-weight="800" fill="#6b7280">cwnd</text>
    <text x="293" y="112" text-anchor="middle" font-size="15" font-weight="900" fill="${step>=2?FV_PUR:'#5b6b85'}">4 KB</text>
    <text x="293" y="136" text-anchor="middle" font-size="8" font-weight="700" fill="#6b7280">congestion limit</text>`;
  s += fvArrow(110, 164, 178, 164, step >= 3, FV_GOLD);
  s += fvArrow(290, 164, 222, 164, step >= 3, FV_GOLD);
  s += `<circle cx="200" cy="164" r="20" fill="#0b1320" stroke="${step>=3?FV_GRN:FV_IDLE}" stroke-width="2"/>
    <text x="200" y="170" text-anchor="middle" font-size="14" font-weight="900" fill="${step>=3?FV_GRN:'#5b6b85'}">min</text>
    <line x1="200" y1="190" x2="200" y2="208" stroke="${step>=3?FV_GRN:FV_IDLE}" stroke-width="1.6" stroke-dasharray="3 3"/>
    <text x="200" y="224" text-anchor="middle" font-size="10" font-weight="800" fill="${step>=3?FV_GRN:'#6b7280'}">${step>=3 ? 'in flight <= 4 KB' : 'take the tighter of the two'}</text>`;
  return s + fvMath(step >= 3 ? 'min(8, 4) = 4 KB' : step >= 2 ? 'cwnd = 4 KB' : step >= 1 ? 'rwnd = 8 KB' : 'W = min(rwnd, cwnd)', step >= 3 ? FV_GRN : FV_GOLD) + fvDots(step, 4);
}

/* Throughput is window divided by round trip. */
function fThroughput(step){
  let s = fvOpen('TCP THROUGHPUT - window per round trip', 'Throughput = W / RTT');
  s += `<rect x="34" y="66" width="332" height="24" rx="6" fill="#0f172a" stroke="${step>=1?FV_TEAL:FV_IDLE}" stroke-width="1.4"/>
    <text x="46" y="82" font-size="10" font-weight="800" fill="#6b7280">WINDOW IN FLIGHT</text>
    <rect x="34" y="66" width="${step>=1?258:0}" height="24" rx="6" fill="${FV_TEAL}" opacity="0.4"/>
    <text x="356" y="82" text-anchor="end" font-size="11" font-family="ui-monospace,Menlo,monospace" font-weight="800" fill="${step>=1?FV_TEAL:'#5b6b85'}">${step>=1?'64 KB':'-'}</text>
    <line x1="34" y1="112" x2="366" y2="112" stroke="${FV_IDLE}" stroke-width="1.4"/>
    <path d="M 34 112 Q 200 ${step>=2?152:112} 366 112" fill="none" stroke="${FV_GOLD}" stroke-width="2"/>
    <circle r="3.5" fill="${FV_GOLD}"><animateMotion dur="2s" repeatCount="indefinite" path="M 34 112 Q 200 ${step>=2?152:112} 366 112"/></circle>
    <text x="200" y="${step>=2?172:134}" text-anchor="middle" font-size="10" font-weight="800" fill="${step>=2?FV_GOLD:'#6b7280'}">${step>=2 ? 'RTT = 100 ms round trip' : 'one RTT = send, wait, ack'}</text>
    <text x="200" y="206" text-anchor="middle" font-size="10" font-weight="700" fill="${step>=3?FV_GRN:'#6b7280'}">${step>=3 ? 'about 5 Mbps ceiling on this link' : 'divide the bytes in flight by the wait'}</text>`;
  return s + fvMath(step >= 3 ? '640 KB/s ~ 5 Mbps' : step >= 2 ? '64 KB / 0.1 s' : step >= 1 ? 'W = 64 KB' : 'W / RTT', step >= 3 ? FV_GRN : FV_GOLD) + fvDots(step, 4);
}
/* Slow-start exponential ramp drawn as a staircase. */
function fSlowStart(step){
  const vals = [1,2,4,8,16], upto = step + 1;
  let s = fvOpen('SLOW START - double every RTT', 'cwnd(t) = 2^t until ssthresh');
  vals.forEach((v,i) => {
    const x = 52 + i * 62, h = 14 + v * 7, on = i < upto;
    s += `<rect x="${x-16}" y="${190-h}" width="32" height="${h}" rx="3" fill="${on?FV_GOLD:'#0f172a'}" stroke="${on?FV_GOLD:FV_IDLE}" stroke-width="1.4"/>
      <text x="${x}" y="${184-h}" text-anchor="middle" font-size="10" font-weight="800" fill="${on?FV_GOLD:'#5b6b85'}">${v}</text>
      <text x="${x}" y="206" text-anchor="middle" font-size="8" font-weight="700" fill="#6b7280">RTT ${i}</text>`;
  });
  s += `<line x1="34" y1="190" x2="366" y2="190" stroke="${FV_IDLE}" stroke-width="1.2"/>
    <text x="200" y="230" text-anchor="middle" font-size="10" font-weight="700" fill="${step>=3?FV_GRN:'#6b7280'}">${step>=3 ? 'keeps doubling until ssthresh, then grows linearly' : 'each round trip doubles the congestion window'}</text>`;
  return s + fvMath(step >= 3 ? 'cwnd = 2^t' : step >= 2 ? '4 -> 8' : step >= 1 ? '2 -> 4' : 'cwnd = 1', step >= 3 ? FV_GRN : FV_GOLD) + fvDots(step, 4);
}

/* AIMD sawtooth with the halving point marked. */
function fAimd(step){
  const up = [[36,168],[70,150],[104,132],[138,114],[172,96],[196,92]];
  let d = '';
  up.forEach((p,i) => { d += `${i?'L':'M'} ${p[0]} ${p[1]} `; });
  d += 'L 206 60 L 240 150 L 274 128 L 308 106 L 342 84 L 360 78';
  const cut = 5;
  let s = fvOpen('AIMD - up slowly, down hard', 'cwnd+1 per RTT · cwnd/2 on loss');
  s += `<line x1="34" y1="180" x2="366" y2="180" stroke="${FV_IDLE}" stroke-width="1.2"/>
    <path d="${d}" fill="none" stroke="${step>=2?FV_RED:FV_GRN}" stroke-width="2.4"/>
    <circle cx="${up[cut][0]}" cy="${up[cut][1]}" r="5" fill="${FV_GOLD}"><animate attributeName="r" values="4;9;4" dur="1.8s" repeatCount="indefinite"/></circle>
    <text x="${up[cut][0]-6}" y="${up[cut][1]-10}" font-size="9" font-weight="800" fill="${FV_GOLD}">loss</text>
    <text x="110" y="132" font-size="9" font-weight="800" fill="${FV_GRN}">additive +1</text>
    <text x="256" y="178" font-size="9" font-weight="800" fill="${FV_RED}">multiplicative /2</text>
    <text x="200" y="228" text-anchor="middle" font-size="10" font-weight="700" fill="${step>=3?FV_GRN:'#6b7280'}">${step>=3 ? 'probing up, punishing fast, the classic sawtooth' : 'gentle growth, sudden drop on every loss'}</text>`;
  return s + fvMath(step >= 3 ? '18 / 2 = 9' : step >= 2 ? 'loss, halve' : step >= 1 ? '17 = 16 + 1' : 'cwnd = 16', step >= 3 ? FV_RED : FV_GOLD) + fvDots(step, 4);
}
/* ============================================================
   UNIT V — APPLICATION LAYER HEADERS + PORTS
   ============================================================ */

/* Header split into 32-bit words, filling one per step. */
function fvWords(labels, filled){
  let s = '';
  labels.forEach((l,i) => {
    const x = 40 + i * 68, on = i < filled;
    s += `<rect x="${x}" y="62" width="60" height="42" rx="6" fill="${on?'#111a2e':'#0b1320'}" stroke="${on?FV_TEAL:FV_IDLE}" stroke-width="1.5"/>
      <text x="${x+30}" y="80" text-anchor="middle" font-size="8" font-weight="800" fill="${on?FV_TEAL:'#5b6b85'}">word ${i+1}</text>
      <text x="${x+30}" y="95" text-anchor="middle" font-size="8" font-weight="700" fill="${on?'#cbd5e1':'#5b6b85'}">4 B</text>
      <text x="${x+30}" y="130" text-anchor="middle" font-size="8" font-weight="700" fill="${on?'#cbd5e1':'#5b6b85'}">${on?l:''}</text>`;
    if (on && i < labels.length - 1) s += `<text x="${x+64}" y="88" text-anchor="middle" font-size="11" font-weight="900" fill="${FV_GOLD}">+</text>`;
  });
  return s;
}

function fTcpHeader(step){
  let s = fvOpen('TCP HEADER - length counts 32-bit words', 'HLEN = header_bytes / 4');
  s += fvWords(['flags/seq','ack/wnd','cksum','options','padding'], step >= 3 ? 5 : step + 1);
  s += `<rect x="34" y="146" width="${step>=3?258:34}" height="24" rx="6" fill="${FV_GOLD}" opacity="0.3" stroke="${step>=3?FV_GOLD:FV_IDLE}" stroke-width="1.4"/>
    <text x="46" y="162" font-size="9" font-weight="800" fill="${step>=3?FV_GOLD:'#6b7280'}">${step>=3 ? '20 to 60 bytes total' : 'header length'}</text>
    <text x="200" y="196" text-anchor="middle" font-size="10" font-weight="700" fill="${step>=3?FV_GRN:'#6b7280'}">${step>=3 ? 'HLEN stores 5 to 15, not the raw byte count' : 'options make the header variable length'}</text>`;
  return s + fvMath(step >= 3 ? '/ 4 = 5 to 15' : step >= 2 ? '20 - 60 bytes' : step >= 1 ? 'options 0-40 B' : 'fixed = 20 B', step >= 3 ? FV_GRN : FV_GOLD) + fvDots(step, 4);
}

function fRtpHeader(step){
  let s = fvOpen('RTP - three 32-bit words minimum', 'RTP header >= 12 bytes');
  s += fvWords(['V/P/X/CC','M/PT/seq','timestamp','SSRC','CSRC'], step >= 3 ? 3 : step + 1);
  s += `<rect x="40" y="146" width="${step>=3?150:0}" height="22" rx="6" fill="${FV_TEAL}" opacity="0.35"/>
    <text x="200" y="196" text-anchor="middle" font-size="10" font-weight="700" fill="${step>=3?FV_GRN:'#6b7280'}">${step>=3 ? 'CSRC list and extensions are optional extras' : 'no acknowledgements and no retransmission'}</text>`;
  return s + fvMath(step >= 3 ? '3 x 4 = 12 bytes' : step >= 2 ? 'word 3 = 4 B' : step >= 1 ? 'word 2 = 4 B' : 'word 1 = 4 B', step >= 3 ? FV_GRN : FV_GOLD) + fvDots(step, 4);
}

function fUdpLength(step){
  let s = fvOpen('UDP - fixed header, variable length', 'Length = 8 + data bytes');
  s += `<rect x="46" y="66" width="86" height="46" rx="6" fill="${step>=1?'#111a2e':'#0b1320'}" stroke="${step>=1?FV_GOLD:FV_IDLE}" stroke-width="1.5"/>
    <text x="89" y="86" text-anchor="middle" font-size="9" font-weight="800" fill="${step>=1?FV_GOLD:'#5b6b85'}">HEADER</text>
    <text x="89" y="103" text-anchor="middle" font-size="13" font-weight="900" fill="${step>=1?FV_GOLD:'#5b6b85'}">8</text>
    <text x="140" y="94" text-anchor="middle" font-size="13" font-weight="900" fill="${FV_GOLD}">+</text>
    <rect x="154" y="66" width="${step>=2?104:22}" height="46" rx="6" fill="${step>=2?FV_PUR:'#0b1320'}" stroke="${step>=2?FV_PUR:FV_IDLE}" stroke-width="1.5" opacity="0.75"/>
    <text x="206" y="86" text-anchor="middle" font-size="9" font-weight="800" fill="${step>=2?'#fff':'#5b6b85'}">DATA</text>
    <text x="206" y="103" text-anchor="middle" font-size="11" font-weight="900" fill="${step>=2?'#fff':'#5b6b85'}">${step>=2?'N':''}</text>
    <text x="89" y="136" text-anchor="middle" font-size="8" font-weight="700" fill="#6b7280">always 8</text>
    <text x="206" y="136" text-anchor="middle" font-size="8" font-weight="700" fill="#6b7280">0 to 65,507</text>
    <rect x="46" y="152" width="308" height="26" rx="6" fill="#0f172a" stroke="${step>=3?FV_GRN:FV_IDLE}" stroke-width="1.4"/>
    <text x="200" y="169" text-anchor="middle" font-size="11" font-family="ui-monospace,Menlo,monospace" font-weight="800" fill="${step>=3?FV_GRN:'#5b6b85'}">length = 8 + N  &lt;= 65,535</text>
    <text x="200" y="200" text-anchor="middle" font-size="10" font-weight="700" fill="${step>=3?FV_GRN:'#6b7280'}">${step>=3 ? 'the 16-bit length field caps the whole datagram' : 'no options, so the header never grows'}</text>`;
  return s + fvMath(step >= 3 ? '8 + N <= 65,535' : step >= 2 ? '8 + N' : step >= 1 ? 'header = 8 B' : 'Length = ?', step >= 3 ? FV_GRN : FV_GOLD) + fvDots(step, 4);
}
/* DNS hierarchy - one tier lights up per step. */
function fDnsLevels(step){
  const tiers = [['root  ""', 240, 96], ['TLD  .com', 200, 140], ['example.com', 160, 184]];
  let s = fvOpen('DNS - names read right to left', 'levels <= 128 · root = level 0');
  tiers.forEach(([l,w,y],i) => {
    const on = i <= step, col = on ? fvC(step, i) : FV_IDLE;
    s += `<rect x="${200-w/2}" y="${y-14}" width="${w}" height="26" rx="6" fill="${on?'#111a2e':'#0b1320'}" stroke="${col}" stroke-width="1.5"/>
      <text x="200" y="${y+3}" text-anchor="middle" font-size="10" font-weight="800" fill="${on?'#fff':'#5b6b85'}">${on?l:''}</text>`;
    if (i > 0) s += `<line x1="200" y1="${y-14}" x2="200" y2="${y-8}" stroke="${on?FV_GOLD:FV_IDLE}" stroke-width="1.4" stroke-dasharray="3 3"/>`;
  });
  s += `<text x="200" y="222" text-anchor="middle" font-size="10" font-weight="700" fill="${step>=3?FV_GOLD:'#6b7280'}">${step>=3 ? 'depth is capped at 128 labels' : 'every dot in the name is one level down'}</text>`;
  return s + fvMath(step >= 3 ? 'levels <= 128' : step >= 2 ? 'example.com = 2' : step >= 1 ? '.com = 1' : 'root = 0', FV_GOLD) + fvDots(step, 4);
}

/* HTTP request line assembled field by field. */
function fHttpReq(step){
  const parts = [['GET',FV_GOLD],['/index.html',FV_TEAL],['HTTP/1.1',FV_PUR]];
  const shown = step >= 3 ? 3 : step + 1;
  let s = fvOpen('HTTP - the request line', 'METHOD /path HTTP/1.1');
  let x = 40;
  parts.forEach(([t,c],i) => {
    const on = i < shown, w = t.length * 8.5 + 18;
    s += `<rect x="${x}" y="76" width="${w}" height="30" rx="6" fill="${on?'#111a2e':'#0b1320'}" stroke="${on?c:FV_IDLE}" stroke-width="1.5"/>
      <text x="${x+w/2}" y="95" text-anchor="middle" font-size="11" font-family="ui-monospace,Menlo,monospace" font-weight="800" fill="${on?c:'#5b6b85'}">${on?t:''}</text>`;
    x += w + 18;
  });
  s += `<rect x="40" y="122" width="320" height="24" rx="6" fill="#0f172a" stroke="${step>=3?FV_GRN:FV_IDLE}" stroke-width="1.4"/>
    <text x="200" y="138" text-anchor="middle" font-size="10" font-family="ui-monospace,Menlo,monospace" font-weight="800" fill="${step>=3?FV_GRN:'#5b6b85'}">GET /index.html HTTP/1.1</text>
    <text x="200" y="178" text-anchor="middle" font-size="10" font-weight="700" fill="${step>=3?FV_GRN:'#6b7280'}">${step>=3 ? 'three fields, one line, then optional headers' : 'the first line of every HTTP request'}</text>`;
  return s + fvMath(step >= 3 ? 'GET /index.html' : step >= 2 ? 'HTTP/1.1' : step >= 1 ? 'path added' : 'method GET', step >= 3 ? FV_GRN : FV_GOLD) + fvDots(step, 4);
}
/* Shared two-channel port diagram for FTP and SMTP. */
function fvPorts(step, title, sub, rows, mathFn){
  let s = fvOpen(title, sub);
  s += fvNode(66, 150, 84, 40, 'CLIENT', FV_TEAL) + fvNode(334, 150, 84, 40, 'SERVER', FV_PUR);
  rows.forEach(([lab, col], i) => {
    const y = 74 + i * 30, on = i === Math.min(step, rows.length - 1);
    s += `<rect x="130" y="${y-11}" width="140" height="22" rx="11" fill="${on?'#0f172a':'#0b1320'}" stroke="${on?col:FV_IDLE}" stroke-width="1.4"/>
      <text x="200" y="${y+4}" text-anchor="middle" font-size="10" font-family="ui-monospace,Menlo,monospace" font-weight="800" fill="${on?col:'#5b6b85'}">${on?lab:'- - -'}</text>`;
    if (on) s += `<line x1="108" y1="${y}" x2="128" y2="${y}" stroke="${col}" stroke-width="1.4"/>
      <line x1="272" y1="${y}" x2="292" y2="${y}" stroke="${col}" stroke-width="1.4"/>
      <circle r="2.6" fill="${col}"><animateMotion dur="1.6s" begin="${i*0.4}s" repeatCount="indefinite" path="M 108 ${y} L 292 ${y}"/></circle>`;
  });
  s += `<text x="200" y="214" text-anchor="middle" font-size="9" font-weight="700" fill="#6b7280">port numbers are the well-known handles</text>`;
  return s + fvMath(mathFn(step), FV_GOLD) + fvDots(step, 4);
}

function fFtpPorts(step){
  return fvPorts(step, 'FTP - two channels, two ports', 'CONTROL = 21 · DATA = 20',
    [['RETR file', FV_GOLD], ['file bytes', FV_TEAL]],
    st => st >= 3 ? '21 + 20' : st >= 2 ? 'data opens :20' : st >= 1 ? 'control :21' : 'login first');
}

function fSmtpPort(step){
  return fvPorts(step, 'SMTP - submit, relay, then read', 'SMTP = 25 · submission = 587',
    [['submit', FV_GOLD], ['relay', FV_TEAL]],
    st => st >= 3 ? 'pull: 110 / 143' : st >= 2 ? 'relay :25' : st >= 1 ? 'submit :587' : 'push mail');
}

function fTelnetPort(step){
  let s = fvOpen('TELNET - one port, one universal charset', 'port 23 · NVT = 7-bit ASCII');
  s += fvNode(66, 112, 80, 38, 'LOCAL', FV_TEAL) + fvNode(334, 112, 80, 38, 'REMOTE', FV_PUR);
  s += `<line x1="106" y1="112" x2="294" y2="112" stroke="${FV_GOLD}" stroke-width="2"/>
    <circle r="3.5" fill="${FV_GOLD}"><animateMotion dur="1.8s" repeatCount="indefinite" path="M 106 112 L 294 112"/></circle>
    <rect x="158" y="100" width="84" height="24" rx="12" fill="#0f172a" stroke="${FV_GOLD}" stroke-width="1.4"/>
    <text x="200" y="116" text-anchor="middle" font-size="10" font-family="ui-monospace,Menlo,monospace" font-weight="800" fill="${FV_GOLD}">:23</text>`;
  [['local chars','#cbd5e1'],['NVT ASCII',FV_GOLD],['remote chars','#cbd5e1']].forEach(([t,c],i) => {
    const on = i <= step, lift = i === 1 ? 10 : 0;
    s += `<rect x="${34+i*114}" y="${172-lift}" width="104" height="26" rx="6" fill="${on?'#111a2e':'#0b1320'}" stroke="${on?c:FV_IDLE}" stroke-width="1.4"/>
      <text x="${86+i*114}" y="${189-lift}" text-anchor="middle" font-size="9" font-weight="800" fill="${on?c:'#5b6b85'}">${on?t:''}</text>`;
  });
  s += `<text x="200" y="224" text-anchor="middle" font-size="9" font-weight="700" fill="${step>=3?FV_GRN:'#6b7280'}">${step>=3 ? 'both ends translate, so any two systems interoperate' : 'a common language both machines understand'}</text>`;
  return s + fvMath(step >= 3 ? 'NVT -> native' : step >= 2 ? '7-bit ASCII' : step >= 1 ? 'to NVT' : 'port 23', step >= 3 ? FV_GRN : FV_GOLD) + fvDots(step, 4);
}

/* ============================================================
   REGISTRY — merge into window.XC.SVG
   ============================================================ */
window.XC.SVG = Object.assign(window.XC.SVG || {}, {
  meshLinks, starLinks, busTerm, hammingR, hammingPos,
  pureAloha, vulnTime, minFrame, gbnWin, srWin,
  parityRule, checksumRule, crcRule,
  dijkstraRelax, dvUpdate, hierLevels,
  leakyBucket, tokenBucket, dvInfinity,
  fTcpWindow, fThroughput, fSlowStart, fAimd,
  fUdpLength, fTcpHeader, fDnsLevels, fHttpReq,
  fFtpPorts, fSmtpPort, fTelnetPort, fRtpHeader
});

console.log('Data loaded: FORMULA visuals = 31 stage visuals');