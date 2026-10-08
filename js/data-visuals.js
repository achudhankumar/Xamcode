/* ============================================================
   DATA — SVG VISUAL GENERATORS
   All animated SVG functions used by topic.visual(step) and
   formula.visual(name)
   Exposes: window.XC.SVG = { ...all functions }
   ============================================================ */
window.XC = window.XC || {};

/* ============================================================
   UNIT I — TOPOLOGY VISUALS
   ============================================================ */
function meshSVG(){
  const N=[{x:200,y:40,l:'N1'},{x:340,y:130,l:'N2'},{x:200,y:220,l:'N3'},{x:60,y:130,l:'N4'}];
  const E=[[0,1],[1,2],[2,3],[3,0],[0,2],[1,3]];
  let s=`<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">MESH — every node ↔ every node</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" font-weight="600" fill="#6b7280">4 nodes → n(n-1)/2 = 6 links</text>`;
  E.forEach(([a,b],i)=>{
    const A=N[a],B=N[b];
    s+=`<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="#2dd4bf" stroke-width="1.8" opacity="0.85"/>`;
    const mx=(A.x+B.x)/2,my=(A.y+B.y)/2;
    s+=`<circle cx="${mx}" cy="${my}" r="7" fill="#0f172a" stroke="#facc15" stroke-width="1"/><text x="${mx}" y="${my+3}" text-anchor="middle" font-size="8" font-weight="800" fill="#facc15">${i+1}</text>`;
    s+=`<circle r="3" fill="#22c55e"><animateMotion dur="${1.8+i*0.15}s" repeatCount="indefinite" path="M ${A.x} ${A.y} L ${B.x} ${B.y}"/></circle>`;
    s+=`<circle r="3" fill="#22c55e" opacity="0.5"><animateMotion dur="${1.8+i*0.15}s" begin="${(1.8+i*0.15)/2}s" repeatCount="indefinite" path="M ${A.x} ${A.y} L ${B.x} ${B.y}"/></circle>`;
  });
  N.forEach((n,i)=>{
    s+=`<circle cx="${n.x}" cy="${n.y}" r="26" fill="none" stroke="#2dd4bf" stroke-width="1" opacity="0.5"><animate attributeName="r" values="24;32;24" dur="2.4s" begin="${i*0.4}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.6;0;0.6" dur="2.4s" begin="${i*0.4}s" repeatCount="indefinite"/></circle>`;
    s+=`<rect x="${n.x-22}" y="${n.y-14}" width="44" height="28" rx="6" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.4"/><text x="${n.x}" y="${n.y+3}" text-anchor="middle" font-size="10" font-weight="800" fill="#fff">${n.l}</text>`;
  });
  return s+`<text x="200" y="252" text-anchor="middle" font-size="9" font-weight="700" fill="#22c55e">Redundant paths · expensive cabling</text></svg>`;
}

function starSVG(){
  const cx=200,cy=90;
  const N=[{x:70,y:45,l:'WS-A'},{x:330,y:45,l:'WS-B'},{x:75,y:165,l:'WS-C'},{x:325,y:165,l:'WS-D'},{x:200,y:215,l:'WS-E'}];
  let s=`<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">STAR — all nodes to central hub</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" font-weight="600" fill="#6b7280">5 dedicated links · 1 SPOF</text>`;
  N.forEach((n,i)=>{
    s+=`<line x1="${cx}" y1="${cy+18}" x2="${n.x}" y2="${n.y}" stroke="#2dd4bf" stroke-width="1.8" opacity="0.85"/>`;
    s+=`<circle r="3.5" fill="#facc15"><animateMotion dur="${1.6+i*0.15}s" repeatCount="indefinite" path="M ${n.x} ${n.y} L ${cx} ${cy}"/></circle>`;
    s+=`<circle r="2.5" fill="#22c55e"><animateMotion dur="${1.6+i*0.15}s" begin="${0.8}s" repeatCount="indefinite" path="M ${cx} ${cy} L ${n.x} ${n.y}"/></circle>`;
  });
  s+=`<circle cx="${cx}" cy="${cy}" r="30" fill="none" stroke="#22c55e" stroke-width="1.5" opacity="0.6"><animate attributeName="r" values="28;52;28" dur="2.2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.7;0;0.7" dur="2.2s" repeatCount="indefinite"/></circle>`;
  s+=`<circle cx="${cx}" cy="${cy}" r="30" fill="none" stroke="#22c55e" stroke-width="1.5" opacity="0.6"><animate attributeName="r" values="28;52;28" dur="2.2s" begin="1.1s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.7;0;0.7" dur="2.2s" begin="1.1s" repeatCount="indefinite"/></circle>`;
  s+=`<rect x="${cx-44}" y="${cy-18}" width="88" height="36" rx="18" fill="#22c55e" stroke="#000" stroke-width="1.5"/><text x="${cx}" y="${cy+4}" text-anchor="middle" font-size="10" font-weight="900" fill="#000">SWITCH</text>`;
  N.forEach((n,i)=>{
    s+=`<circle cx="${n.x}" cy="${n.y}" r="20" fill="none" stroke="#2dd4bf" stroke-width="1" opacity="0.4"><animate attributeName="r" values="18;24;18" dur="2s" begin="${i*0.3}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.5;0;0.5" dur="2s" begin="${i*0.3}s" repeatCount="indefinite"/></circle>`;
    s+=`<rect x="${n.x-26}" y="${n.y-14}" width="52" height="28" rx="6" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.4"/><text x="${n.x}" y="${n.y+3}" text-anchor="middle" font-size="9" font-weight="800" fill="#fff">${n.l}</text>`;
  });
  return s+`<text x="200" y="252" text-anchor="middle" font-size="9" font-weight="700" fill="#facc15">Hub failure = whole network down (SPOF)</text></svg>`;
}

function busSVG(){
  const y=130;
  const N=[{x:80,l:'WS-A'},{x:160,l:'WS-B'},{x:240,l:'WS-C'},{x:320,l:'WS-D'}];
  let s=`<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">BUS — one shared backbone</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" font-weight="600" fill="#6b7280">Terminators absorb reflections</text>
    <line x1="48" y1="${y}" x2="352" y2="${y}" stroke="#2dd4bf" stroke-width="3"/>
    <rect x="34" y="${y-8}" width="14" height="16" rx="2" fill="#ef4444"><animate attributeName="opacity" values="1;0.5;1" dur="1.5s" repeatCount="indefinite"/></rect>
    <rect x="352" y="${y-8}" width="14" height="16" rx="2" fill="#ef4444"><animate attributeName="opacity" values="1;0.5;1" dur="1.5s" begin="0.75s" repeatCount="indefinite"/></rect>
    <text x="41" y="${y+28}" text-anchor="middle" font-size="7" font-weight="800" fill="#ef4444">TERM</text>
    <text x="359" y="${y+28}" text-anchor="middle" font-size="7" font-weight="800" fill="#ef4444">TERM</text>`;
  N.forEach((n,i)=>{
    s+=`<line x1="${n.x}" y1="${y-4}" x2="${n.x}" y2="${y-30}" stroke="#2dd4bf" stroke-width="2"/><rect x="${n.x-26}" y="${y-52}" width="52" height="26" rx="6" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.4"/><text x="${n.x}" y="${y-34}" text-anchor="middle" font-size="9" font-weight="800" fill="#fff">${n.l}</text><rect x="${n.x-4}" y="${y-8}" width="8" height="8" rx="1" fill="#facc15"/>`;
    s+=`<circle cx="${n.x}" cy="${y}" r="8" fill="none" stroke="#facc15" stroke-width="1" opacity="0.6"><animate attributeName="r" values="6;12;6" dur="2s" begin="${i*0.4}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.7;0;0.7" dur="2s" begin="${i*0.4}s" repeatCount="indefinite"/></circle>`;
  });
  s+=`<circle r="5" fill="#facc15" stroke="#000"><animateMotion dur="2.4s" repeatCount="indefinite" path="M 60 ${y} L 340 ${y} L 60 ${y}"/></circle>
      <circle r="4" fill="#22c55e" stroke="#000" opacity="0.8"><animateMotion dur="2.4s" begin="0.8s" repeatCount="indefinite" path="M 60 ${y} L 340 ${y} L 60 ${y}"/></circle>
      <circle r="3" fill="#a78bfa" stroke="#000" opacity="0.6"><animateMotion dur="2.4s" begin="1.6s" repeatCount="indefinite" path="M 60 ${y} L 340 ${y} L 60 ${y}"/></circle>
      <text x="200" y="60" text-anchor="middle" font-size="9" font-weight="800" fill="#facc15">Signal travels both ways</text>
      <text x="200" y="252" text-anchor="middle" font-size="9" font-weight="700" fill="#ef4444">Backbone break = whole network down</text></svg>`;
  return s;
}

function ringSVG(){
  const cx=200,cy=140,R=90,N=5;
  const nodes=Array.from({length:N},(_,i)=>{
    const a=-Math.PI/2+i*2*Math.PI/N;
    return {x:cx+R*Math.cos(a),y:cy+R*Math.sin(a),l:'N'+(i+1)};
  });
  let s=`<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">RING — closed loop</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" font-weight="600" fill="#6b7280">Data passes one direction · token-based</text>`;
  for(let i=0;i<N;i++){
    const A=nodes[i],B=nodes[(i+1)%N];
    s+=`<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="#2dd4bf" stroke-width="2" opacity="0.85"/>`;
  }
  const tokenPath=`M ${nodes[0].x} ${nodes[0].y} L ${nodes[1].x} ${nodes[1].y} L ${nodes[2].x} ${nodes[2].y} L ${nodes[3].x} ${nodes[3].y} L ${nodes[4].x} ${nodes[4].y} L ${nodes[0].x} ${nodes[0].y}`;
  s+=`<circle r="6" fill="#facc15" stroke="#000"><animateMotion dur="3s" repeatCount="indefinite" path="${tokenPath}"/></circle>`;
  s+=`<circle r="4" fill="#22c55e" stroke="#000" opacity="0.7"><animateMotion dur="3s" begin="1.5s" repeatCount="indefinite" path="${tokenPath}"/></circle>`;
  nodes.forEach((n,i)=>{
    s+=`<circle cx="${n.x}" cy="${n.y}" r="26" fill="none" stroke="#2dd4bf" stroke-width="1" opacity="0.5"><animate attributeName="r" values="24;32;24" dur="2.4s" begin="${i*0.5}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.6;0;0.6" dur="2.4s" begin="${i*0.5}s" repeatCount="indefinite"/></circle>`;
    s+=`<circle cx="${n.x}" cy="${n.y}" r="20" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.4"/><text x="${n.x}" y="${n.y+3}" text-anchor="middle" font-size="10" font-weight="800" fill="#fff">${n.l}</text>`;
  });
  return s+`<text x="200" y="258" text-anchor="middle" font-size="9" font-weight="700" fill="#ef4444">One break = entire ring down</text></svg>`;
}

function hybridSVG(){
  const hub={x:60,y:140};
  let s=`<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">HYBRID — star + bus branches</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" font-weight="600" fill="#6b7280">Combines two or more basic topologies</text>
    <circle cx="${hub.x}" cy="${hub.y}" r="30" fill="none" stroke="#facc15" stroke-width="1.2" opacity="0.6"><animate attributeName="r" values="26;42;26" dur="2.2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.7;0;0.7" dur="2.2s" repeatCount="indefinite"/></circle>
    <rect x="${hub.x-30}" y="${hub.y-16}" width="60" height="32" rx="16" fill="#facc15" stroke="#000" stroke-width="1.5"/>
    <text x="${hub.x}" y="${hub.y+4}" text-anchor="middle" font-size="10" font-weight="900" fill="#000">HUB</text>`;
  [50,140,220].forEach((y,bi)=>{
    s+=`<line x1="${hub.x+30}" y1="${hub.y}" x2="200" y2="${y}" stroke="#2dd4bf" stroke-width="2"/><line x1="200" y1="${y}" x2="370" y2="${y}" stroke="#2dd4bf" stroke-width="3"/>`;
    s+=`<circle r="3.5" fill="#22c55e"><animateMotion dur="${2+bi*0.3}s" repeatCount="indefinite" path="M ${hub.x+30} ${hub.y} L 200 ${y}"/></circle>`;
    s+=`<circle r="4" fill="#facc15"><animateMotion dur="${2+bi*0.3}s" repeatCount="indefinite" path="M 220 ${y} L 360 ${y} L 220 ${y}"/></circle>`;
    [240,300,350].forEach((x,i)=>{
      s+=`<line x1="${x}" y1="${y-4}" x2="${x}" y2="${y-20}" stroke="#2dd4bf" stroke-width="1.5"/><rect x="${x-16}" y="${y-36}" width="32" height="18" rx="4" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.2"/><text x="${x}" y="${y-24}" text-anchor="middle" font-size="7" font-weight="800" fill="#fff">S${bi+1}${i+1}</text>`;
      s+=`<circle cx="${x}" cy="${y}" r="4" fill="none" stroke="#facc15" stroke-width="1" opacity="0.6"><animate attributeName="r" values="3;7;3" dur="2s" begin="${(bi+i)*0.3}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.7;0;0.7" dur="2s" begin="${(bi+i)*0.3}s" repeatCount="indefinite"/></circle>`;
    });
  });
  return s+`<text x="200" y="258" text-anchor="middle" font-size="9" font-weight="700" fill="#22c55e">Star hub + bus branches on each spoke</text></svg>`;
}

function compareSVG(){
  const items=[['MESH','HIGH','MAX','n(n-1)/2'],['STAR','MED','LOW','n'],['BUS','LOW','NONE','1'],['RING','MED','LOW','n'],['HYBRID','VAR','VAR','mix']];
  let s=`<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">COMPARE TOPOLOGIES</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" font-weight="600" fill="#6b7280">Cost vs redundancy vs links formula</text>
    <rect x="20" y="44" width="360" height="200" rx="10" fill="#0f172a" stroke="#1e2a44"/>
    <line x1="20" y1="72" x2="380" y2="72" stroke="#1e2a44"/>
    <text x="60" y="62" font-size="9" font-weight="800" fill="#6b7280">TYPE</text>
    <text x="150" y="62" font-size="9" font-weight="800" fill="#6b7280">COST</text>
    <text x="220" y="62" font-size="9" font-weight="800" fill="#6b7280">REDUNDANCY</text>
    <text x="310" y="62" font-size="9" font-weight="800" fill="#6b7280">LINKS</text>`;
  items.forEach((it,i)=>{
    const y=90+i*32;
    s+=`<rect x="22" y="${y-12}" width="356" height="26" rx="4" fill="rgba(45,212,191,.08)" opacity="0"><animate attributeName="opacity" values="0;0.9;0" dur="${items.length}s" begin="${i}s" repeatCount="indefinite"/></rect>`;
    s+=`<text x="60" y="${y}" font-size="10" font-weight="800" fill="#2dd4bf">${it[0]}</text><text x="150" y="${y}" font-size="10" fill="#cbd5e1">${it[1]}</text><text x="220" y="${y}" font-size="10" fill="#cbd5e1">${it[2]}</text><text x="310" y="${y}" font-size="10" font-weight="700" fill="#facc15">${it[3]}</text>`;
  });
  return s+'</svg>';
}

/* ============================================================
   UNIT I — TRANSMISSION MEDIA VISUALS
   ============================================================ */
function twistedPairSVG(){
  const path1 = 'M 40 120 Q 80 90, 120 120 T 200 120 T 280 120 T 360 120';
  const path2 = 'M 360 120 Q 320 150, 280 120 T 200 120 T 120 120 T 40 120';
  return `<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="20" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">TWISTED-PAIR CABLE</text>
    <text x="200" y="36" text-anchor="middle" font-size="9" font-weight="600" fill="#6b7280">2 insulated copper wires twisted together · RJ45</text>
    <path d="${path1}" stroke="#ef4444" stroke-width="3" fill="none"/>
    <path d="M 40 120 Q 80 150, 120 120 T 200 120 T 280 120 T 360 120" stroke="#38bdf8" stroke-width="3" fill="none"/>
    <circle r="4" fill="#facc15" stroke="#000"><animateMotion dur="2.2s" repeatCount="indefinite" path="${path1}"/></circle>
    <circle r="3" fill="#facc15" stroke="#000" opacity="0.7"><animateMotion dur="2.2s" begin="1.1s" repeatCount="indefinite" path="${path1}"/></circle>
    <circle r="4" fill="#f472b6" stroke="#000"><animateMotion dur="2.2s" begin="0.4s" repeatCount="indefinite" path="${path2}"/></circle>
    <text x="200" y="194" text-anchor="middle" font-size="9" font-weight="700" fill="#ef4444">Conductor 1 (red) + Conductor 2 (blue)</text>
    <text x="200" y="212" text-anchor="middle" font-size="9" fill="#cbd5e1">Twisting reduces crosstalk &amp; noise</text>
    <text x="200" y="230" text-anchor="middle" font-size="9" fill="#22c55e">Used in: Telephone lines, 10Base-T LAN</text>
    <text x="200" y="248" text-anchor="middle" font-size="9" fill="#facc15">Connector: RJ45</text></svg>`;
}

function coaxialSVG(){
  const cx=200,cy=140;
  return `<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="20" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">COAXIAL CABLE</text>
    <text x="200" y="36" text-anchor="middle" font-size="9" font-weight="600" fill="#6b7280">Inner conductor + outer shield</text>
    <circle cx="${cx}" cy="${cy}" r="70" fill="#ef4444" opacity="0.25"/>
    <circle cx="${cx}" cy="${cy}" r="60" fill="#0a0a0a"/>
    <circle cx="${cx}" cy="${cy}" r="50" fill="#f59e0b" opacity="0.4"><animate attributeName="opacity" values="0.4;0.7;0.4" dur="2s" repeatCount="indefinite"/></circle>
    <circle cx="${cx}" cy="${cy}" r="40" fill="#0a0a0a"/>
    <circle cx="${cx}" cy="${cy}" r="28" fill="#fff" opacity="0.9"/>
    <circle cx="${cx}" cy="${cy}" r="14" fill="#cbd5e1"/>
    <circle cx="${cx}" cy="${cy}" r="6" fill="#78350f"><animate attributeName="r" values="5;8;5" dur="1.4s" repeatCount="indefinite"/></circle>
    <circle cx="${cx}" cy="${cy}" r="10" fill="none" stroke="#facc15" stroke-width="1.2" opacity="0.7"><animate attributeName="r" values="8;30;8" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite"/></circle>
    <circle cx="${cx}" cy="${cy}" r="10" fill="none" stroke="#facc15" stroke-width="1.2" opacity="0.7"><animate attributeName="r" values="8;30;8" dur="2s" begin="0.7s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.8;0;0.8" dur="2s" begin="0.7s" repeatCount="indefinite"/></circle>
    <text x="90" y="70" font-size="9" font-weight="700" fill="#ef4444">Plastic cover</text>
    <text x="90" y="105" font-size="9" font-weight="700" fill="#f59e0b">Outer conductor (shield)</text>
    <text x="240" y="150" font-size="9" font-weight="700" fill="#fff">Insulator</text>
    <text x="270" y="185" font-size="9" font-weight="700" fill="#cbd5e1">Inner conductor</text>
    <text x="200" y="248" text-anchor="middle" font-size="9" fill="#22c55e">Higher freq · BNC connector</text></svg>`;
}

function fiberSVG(){
  const lightPath = 'M 40 120 L 70 105 L 100 135 L 130 105 L 160 135 L 190 105 L 220 135 L 250 105 L 280 135 L 310 105 L 340 135 L 360 120';
  return `<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="20" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">FIBER-OPTIC CABLE</text>
    <text x="200" y="36" text-anchor="middle" font-size="9" font-weight="600" fill="#6b7280">Total internal reflection of light</text>
    <rect x="30" y="80" width="340" height="80" rx="4" fill="#0ea5e9" opacity="0.18"/>
    <rect x="30" y="105" width="340" height="30" rx="2" fill="#38bdf8" opacity="0.35"/>
    <polyline points="${lightPath.replace('M ','').replace(/ L /g,',')}" stroke="#facc15" stroke-width="2.5" fill="none" opacity="0.5"/>
    <circle r="5" fill="#facc15" stroke="#000" stroke-width="0.5"><animateMotion dur="2.6s" repeatCount="indefinite" path="${lightPath}"/></circle>
    <circle r="4" fill="#fde68a" stroke="#000" stroke-width="0.5"><animateMotion dur="2.6s" begin="0.65s" repeatCount="indefinite" path="${lightPath}"/></circle>
    <circle r="4" fill="#fef3c7" stroke="#000" stroke-width="0.5"><animateMotion dur="2.6s" begin="1.3s" repeatCount="indefinite" path="${lightPath}"/></circle>
    <circle r="4" fill="#fde68a" stroke="#000" stroke-width="0.5"><animateMotion dur="2.6s" begin="1.95s" repeatCount="indefinite" path="${lightPath}"/></circle>
    <text x="30" y="72" font-size="9" font-weight="700" fill="#0ea5e9">CLADDING (less dense)</text>
    <text x="30" y="102" font-size="9" font-weight="700" fill="#38bdf8">CORE (glass)</text>
    <rect x="12" y="105" width="18" height="30" fill="#ef4444"/>
    <text x="20" y="160" text-anchor="middle" font-size="8" font-weight="700" fill="#ef4444">SENDER</text>
    <rect x="370" y="105" width="18" height="30" fill="#22c55e"><animate attributeName="opacity" values="1;0.5;1" dur="1s" repeatCount="indefinite"/></rect>
    <text x="379" y="160" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">RECEIVER</text>
    <text x="200" y="200" text-anchor="middle" font-size="9" fill="#cbd5e1">Huge BW · low attenuation · immune to EMI · light</text>
    <text x="200" y="220" text-anchor="middle" font-size="9" fill="#facc15">50 km without repeater</text>
    <text x="200" y="242" text-anchor="middle" font-size="9" fill="#ef4444">Fragile · unidirectional · costly</text></svg>`;
}

function radioSVG(){
  const cx=200,cy=150;
  let s=`<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="20" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">RADIO WAVES — Omni-directional</text>
    <text x="200" y="36" text-anchor="middle" font-size="9" font-weight="600" fill="#6b7280">3 kHz – 1 GHz · propagates in all directions</text>
    <line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy-60}" stroke="#2dd4bf" stroke-width="3"/>
    <circle cx="${cx}" cy="${cy-62}" r="4" fill="#2dd4bf"><animate attributeName="r" values="4;7;4" dur="1s" repeatCount="indefinite"/></circle>`;
  [40,70,100,130].forEach((r,i)=>{
    s+=`<circle cx="${cx}" cy="${cy-60}" r="${r}" fill="none" stroke="#a78bfa" stroke-width="1.3" opacity="${1-i*0.2}"><animate attributeName="r" values="${r-10};${r+10};${r-10}" dur="2s" begin="${i*0.3}s" repeatCount="indefinite"/><animate attributeName="opacity" values="${0.7-i*0.1};0.2;${0.7-i*0.1}" dur="2s" begin="${i*0.3}s" repeatCount="indefinite"/></circle>`;
  });
  return s+`<text x="200" y="240" text-anchor="middle" font-size="9" fill="#22c55e">AM/FM radio, TV, cordless phones</text></svg>`;
}

function microwaveSVG(){
  const A={x:80,y:150},B={x:320,y:150};
  let s=`<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="20" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">MICROWAVES — Uni-directional</text>
    <text x="200" y="36" text-anchor="middle" font-size="9" font-weight="600" fill="#6b7280">1 – 300 GHz · aligned dish antennas</text>
    <path d="M ${A.x} ${A.y-40} Q ${A.x+30} ${A.y} ${A.x} ${A.y+40}" fill="none" stroke="#2dd4bf" stroke-width="2.5"/>
    <circle cx="${A.x+8}" cy="${A.y}" r="3" fill="#facc15"><animate attributeName="r" values="3;5;3" dur="1.2s" repeatCount="indefinite"/></circle>
    <path d="M ${B.x} ${B.y-40} Q ${B.x-30} ${B.y} ${B.x} ${B.y+40}" fill="none" stroke="#2dd4bf" stroke-width="2.5"/>
    <circle cx="${B.x-8}" cy="${B.y}" r="3" fill="#facc15"><animate attributeName="r" values="3;5;3" dur="1.2s" begin="0.6s" repeatCount="indefinite"/></circle>`;
  for(let i=0;i<5;i++){
    const y=A.y-20+i*10;
    s+=`<line x1="${A.x+20}" y1="${y}" x2="${B.x-20}" y2="${y}" stroke="#facc15" stroke-width="1.4" marker-end="url(#arr)"><animate attributeName="x1" values="${A.x+20};${A.x+30};${A.x+20}" dur="1.5s" begin="${i*0.15}s" repeatCount="indefinite"/></line>`;
  }
  s+=`<defs><marker id="arr" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#facc15"/></marker></defs>`;
  return s+`<text x="200" y="240" text-anchor="middle" font-size="9" fill="#22c55e">Satellite links, cellular, wireless LAN</text></svg>`;
}

function infraredSVG(){
  return `<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="20" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">INFRARED — Short range</text>
    <text x="200" y="36" text-anchor="middle" font-size="9" font-weight="600" fill="#6b7280">300 GHz – 400 THz · cannot pass walls</text>
    <rect x="40" y="130" width="50" height="30" rx="6" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.5"/>
    <text x="65" y="150" text-anchor="middle" font-size="9" font-weight="800" fill="#fff">REMOTE</text>
    <circle cx="95" cy="145" r="3" fill="#ef4444"><animate attributeName="r" values="3;5;3" dur="1s" repeatCount="indefinite"/></circle>
    <rect x="280" y="80" width="90" height="120" rx="6" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.5"/>
    <text x="325" y="145" text-anchor="middle" font-size="9" font-weight="800" fill="#fff">TV</text>
    <path d="M 100 145 L 280 145" stroke="#a78bfa" stroke-width="2" stroke-dasharray="5 3"><animate attributeName="opacity" values="0.9;0.3;0.9" dur="1.4s" repeatCount="indefinite"/></path>
    <circle r="4" fill="#a78bfa"><animateMotion dur="1.6s" repeatCount="indefinite" path="M 100 145 L 280 145"/></circle>
    <circle r="3" fill="#c4b5fd"><animateMotion dur="1.6s" begin="0.8s" repeatCount="indefinite" path="M 100 145 L 280 145"/></circle>
    <text x="190" y="130" text-anchor="middle" font-size="9" font-weight="800" fill="#a78bfa">IR BEAM</text>
    <rect x="255" y="60" width="12" height="160" fill="#1e2a44"/>
    <text x="261" y="250" text-anchor="middle" font-size="7" fill="#ef4444">WALL</text>
    <text x="200" y="240" text-anchor="middle" font-size="9" fill="#22c55e">Stays in one room</text></svg>`;
}

/* ============================================================
   UNIT II — FRAMING VISUALS
   ============================================================ */
function charCountSVG(){
  const frames=[
    {chars:'5 1 2 3 4 5',len:5},
    {chars:'5 6 7 8 9 8',len:5},
    {chars:'8 0 1 2 3 4 5 6 7',len:8},
    {chars:'8 8 9 0 1 2 3 4 5',len:8}
  ];
  let s=`<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">CHARACTER COUNT METHOD</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" font-weight="600" fill="#6b7280">Header field stores frame length</text>`;
  let xOff=30;
  frames.forEach(f=>{
    const parts=f.chars.split(' ');
    parts.forEach((c,j)=>{
      const isCount=j===0;
      s+=`<rect x="${xOff}" y="80" width="18" height="28" rx="3" fill="${isCount?'#facc15':'#111a2e'}" stroke="#2dd4bf" stroke-width="1" opacity="0.95"/><text x="${xOff+9}" y="99" text-anchor="middle" font-size="10" font-weight="800" fill="${isCount?'#000':'#fff'}">${c}</text>`;
      xOff+=20;
    });
    xOff+=6;
  });
  s+=`<polygon points="40,120 46,132 34,132" fill="#ef4444"><animate attributeName="points" values="40,120 46,132 34,132;90,120 96,132 84,132;40,120 46,132 34,132" dur="3s" repeatCount="indefinite"/></polygon>
      <text x="200" y="160" text-anchor="middle" font-size="9" font-weight="700" fill="#facc15">Header (yellow) = length of this frame</text>
      <text x="200" y="180" text-anchor="middle" font-size="9" fill="#cbd5e1">If one count is garbled, receiver loses sync — rarely used</text>
      <text x="200" y="210" text-anchor="middle" font-size="9" fill="#22c55e">Simple · efficient when no errors</text>
      <text x="200" y="228" text-anchor="middle" font-size="9" fill="#ef4444">One bad count → whole frame sync lost</text>
      <text x="200" y="252" text-anchor="middle" font-size="9" font-weight="700" fill="#6b7280">Frames shown: 4 · sizes 5, 5, 8, 8</text>`;
  return s+'</svg>';
}

function byteStuffSVG(){
  return `<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">BYTE STUFFING (FLAG + ESC)</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" font-weight="600" fill="#6b7280">ESC added before accidental FLAG in data</text>
    <text x="30" y="70" font-size="9" font-weight="800" fill="#6b7280">ORIGINAL</text>
    ${['A','FLAG','B','FLAG','C'].map((v,i)=>{
      const x=30+i*68;
      const isF=v==='FLAG';
      return `<rect x="${x}" y="78" width="60" height="26" rx="4" fill="${isF?'#facc15':'#111a2e'}" stroke="#2dd4bf" stroke-width="1"/><text x="${x+30}" y="96" text-anchor="middle" font-size="10" font-weight="800" fill="${isF?'#000':'#fff'}">${v}</text>`;
    }).join('')}
    <text x="200" y="128" text-anchor="middle" font-size="14" fill="#2dd4bf">↓</text>
    <text x="30" y="158" font-size="9" font-weight="800" fill="#6b7280">AFTER STUFFING</text>
    ${['A','ESC','FLAG','B','ESC','FLAG','C'].map((v,i)=>{
      const x=10+i*55;
      const isF=v==='FLAG',isE=v==='ESC';
      return `<rect x="${x}" y="166" width="48" height="26" rx="4" fill="${isF?'#facc15':isE?'#ef4444':'#111a2e'}" stroke="#2dd4bf" stroke-width="1"/><text x="${x+24}" y="184" text-anchor="middle" font-size="9" font-weight="800" fill="${isF?'#000':'#fff'}">${v}</text>`;
    }).join('')}
    <polygon points="62,140 68,150 56,150" fill="#22c55e"><animate attributeName="points" values="62,140 68,150 56,150;280,140 286,150 274,150;62,140 68,150 56,150" dur="3s" repeatCount="indefinite"/></polygon>
    <text x="200" y="220" text-anchor="middle" font-size="9" fill="#cbd5e1">Receiver removes ESC before delivering to network layer</text>
    <text x="200" y="240" text-anchor="middle" font-size="9" font-weight="700" fill="#22c55e">Receiver scans for FLAG to resync after an error</text>
    <text x="200" y="258" text-anchor="middle" font-size="9" fill="#ef4444">Tied to 8-bit characters (not Unicode)</text>
  </svg>`;
}

function bitStuffSVG(){
  return `<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">BIT STUFFING — 0 after five 1s</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" font-weight="600" fill="#6b7280">FLAG = 01111110 marks frame start/end</text>
    <text x="20" y="70" font-size="9" font-weight="800" fill="#6b7280">ORIGINAL</text>
    ${'01101111111111111110010'.split('').map((b,i)=>{
      const x=20+i*17;
      return `<rect x="${x}" y="78" width="15" height="20" rx="2" fill="${b==='1'?'#111a2e':'#0f172a'}" stroke="#2dd4bf" stroke-width="0.8"/><text x="${x+7.5}" y="92" text-anchor="middle" font-size="9" font-weight="800" fill="${b==='1'?'#2dd4bf':'#6b7280'}">${b}</text>`;
    }).join('')}
    <text x="20" y="132" font-size="9" font-weight="800" fill="#6b7280">AFTER STUFFING</text>
    ${'011011111011111011111010010'.split('').map((b,i)=>{
      const x=20+i*13.5;
      const isStuffed=(i===9||i===16||i===23);
      return `<rect x="${x}" y="140" width="12" height="20" rx="2" fill="${isStuffed?'#facc15':(b==='1'?'#111a2e':'#0f172a')}" stroke="#2dd4bf" stroke-width="0.8"/><text x="${x+6}" y="154" text-anchor="middle" font-size="9" font-weight="800" fill="${isStuffed?'#000':(b==='1'?'#2dd4bf':'#6b7280')}">${b}</text>`;
    }).join('')}
    <circle cx="${20+9*13.5+6}" cy="150" r="10" fill="none" stroke="#facc15" stroke-width="1.2"><animate attributeName="r" values="10;18;10" dur="1.6s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.9;0;0.9" dur="1.6s" repeatCount="indefinite"/></circle>
    <text x="200" y="200" text-anchor="middle" font-size="9" fill="#cbd5e1">Every time sender sees five 1s → inserts a 0</text>
    <text x="200" y="220" text-anchor="middle" font-size="9" fill="#22c55e">Receiver removes any 0 that follows five 1s</text>
    <text x="200" y="240" text-anchor="middle" font-size="9" fill="#facc15">Flag 01111110 → transmitted as 011111010</text>
    <text x="200" y="258" text-anchor="middle" font-size="9" font-weight="700" fill="#6b7280">Works with arbitrary bit lengths</text>
  </svg>`;
}

function physicalCodingSVG(){
  return `<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">PHYSICAL LAYER CODING VIOLATION</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" font-weight="600" fill="#6b7280">Use invalid codes as frame delimiters</text>
    <text x="30" y="70" font-size="9" font-weight="800" fill="#6b7280">BIT STREAM</text>
    ${'10001101111'.split('').map((b,i)=>`<text x="${30+i*32}" y="92" font-size="12" font-weight="800" fill="${b==='1'?'#2dd4bf':'#6b7280'}">${b}</text>`).join('')}
    <text x="30" y="130" font-size="9" font-weight="800" fill="#6b7280">MANCHESTER</text>
    <polyline points="30,160 46,140 62,160 78,140 94,160 110,140 126,160 142,140 158,160 174,140 190,160 206,140 222,160 238,140 254,160 270,140 286,160 302,140 318,160 334,140 350,160 366,140" stroke="#2dd4bf" stroke-width="1.6" fill="none" opacity="0.85"/>
    <circle r="3" fill="#facc15"><animateMotion dur="3s" repeatCount="indefinite" path="M 30 160 L 366 140 L 30 160"/></circle>
    <text x="30" y="200" font-size="9" font-weight="800" fill="#6b7280">INVALID CODES</text>
    <rect x="30" y="208" width="60" height="26" rx="4" fill="#ef4444"/>
    <text x="60" y="226" text-anchor="middle" font-size="10" font-weight="800" fill="#fff">HIGH-HIGH</text>
    <rect x="100" y="208" width="60" height="26" rx="4" fill="#ef4444"/>
    <text x="130" y="226" text-anchor="middle" font-size="10" font-weight="800" fill="#fff">LOW-LOW</text>
    <text x="180" y="226" font-size="9" fill="#cbd5e1">← these are unused</text>
    <rect x="30" y="208" width="60" height="26" rx="4" fill="none" stroke="#ef4444" stroke-width="1.4" opacity="0.7"><animate attributeName="opacity" values="0.9;0;0.9" dur="1.6s" repeatCount="indefinite"/></rect>
    <rect x="100" y="208" width="60" height="26" rx="4" fill="none" stroke="#ef4444" stroke-width="1.4" opacity="0.7"><animate attributeName="opacity" values="0.9;0;0.9" dur="1.6s" begin="0.8s" repeatCount="indefinite"/></rect>
    <text x="200" y="258" text-anchor="middle" font-size="9" fill="#22c55e">Data uses valid codes · invalid codes delimit frames</text>
  </svg>`;
}

/* ============================================================
   UNIT II — ERROR DETECTION VISUALS
   ============================================================ */
function paritySVG(){
  return `<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">SIMPLE PARITY CHECK</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" font-weight="600" fill="#6b7280">Add 1 bit so total number of 1s is even</text>
    ${['1','0','0','0','1','1'].map((b,i)=>`<rect x="${60+i*42}" y="90" width="36" height="40" rx="4" fill="${b==='1'?'#111a2e':'#0f172a'}" stroke="#2dd4bf" stroke-width="1.4"/><text x="${60+i*42+18}" y="118" text-anchor="middle" font-size="16" font-weight="800" fill="${b==='1'?'#2dd4bf':'#6b7280'}">${b}</text>`).join('')}
    <text x="200" y="152" text-anchor="middle" font-size="14" fill="#2dd4bf">↓ compute parity bit</text>
    ${['1','0','0','0','1','1'].map((b,i)=>`<rect x="${40+i*42}" y="170" width="36" height="40" rx="4" fill="${b==='1'?'#111a2e':'#0f172a'}" stroke="#2dd4bf" stroke-width="1.4"/><text x="${40+i*42+18}" y="198" text-anchor="middle" font-size="16" font-weight="800" fill="${b==='1'?'#2dd4bf':'#6b7280'}">${b}</text>`).join('')}
    <rect x="${40+6*42}" y="170" width="36" height="40" rx="4" fill="#facc15" stroke="#000" stroke-width="1.4"><animate attributeName="opacity" values="1;0.5;1" dur="1.5s" repeatCount="indefinite"/></rect>
    <text x="${40+6*42+18}" y="198" text-anchor="middle" font-size="16" font-weight="900" fill="#000">1</text>
    <text x="${40+6*42+18}" y="228" text-anchor="middle" font-size="8" font-weight="800" fill="#facc15">PARITY</text>
    <text x="200" y="252" text-anchor="middle" font-size="9" fill="#22c55e">Total 1s count = 4 (even) ✓</text>
  </svg>`;
}

function parity2DSVG(){
  const grid=[['1','0','0','1','1','0','0','1'],['1','1','1','0','0','0','1','0'],['0','0','1','0','0','1','0','0'],['1','0','0','0','0','1','0','0']];
  let s=`<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">TWO-DIMENSIONAL PARITY</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" font-weight="600" fill="#6b7280">Row parities + column parities</text>`;
  grid.forEach((row,r)=>{
    row.forEach((b,c)=>{
      const x=60+c*28,y=60+r*28;
      s+=`<rect x="${x}" y="${y}" width="24" height="24" rx="3" fill="${b==='1'?'#111a2e':'#0f172a'}" stroke="#2dd4bf" stroke-width="1"/><text x="${x+12}" y="${y+17}" text-anchor="middle" font-size="11" font-weight="800" fill="${b==='1'?'#2dd4bf':'#6b7280'}">${b}</text>`;
    });
    const rp=row.filter(x=>x==='1').length%2===0?'0':'1';
    s+=`<rect x="${60+8*28}" y="${60+r*28}" width="24" height="24" rx="3" fill="#facc15" stroke="#000" stroke-width="1"/><text x="${60+8*28+12}" y="${60+r*28+17}" text-anchor="middle" font-size="11" font-weight="900" fill="#000">${rp}</text>`;
  });
  for(let c=0;c<8;c++){
    let ones=0;
    grid.forEach(r=>{ if(r[c]==='1') ones++; });
    const cp=ones%2===0?'0':'1';
    s+=`<rect x="${60+c*28}" y="${60+4*28}" width="24" height="24" rx="3" fill="#facc15" stroke="#000" stroke-width="1"/><text x="${60+c*28+12}" y="${60+4*28+17}" text-anchor="middle" font-size="11" font-weight="900" fill="#000">${cp}</text>`;
  }
  s+=`<rect x="${60+8*28}" y="${60+4*28}" width="24" height="24" rx="3" fill="#facc15" stroke="#000" stroke-width="1"/><text x="${60+8*28+12}" y="${60+4*28+17}" text-anchor="middle" font-size="11" font-weight="900" fill="#000">0</text>`;
  s+=`<rect x="${60+8*28}" y="60" width="24" height="24" rx="3" fill="none" stroke="#22c55e" stroke-width="1.6"><animate attributeName="y" values="60;88;116;144;60" dur="2.4s" repeatCount="indefinite"/></rect>`;
  s+=`<text x="200" y="218" text-anchor="middle" font-size="9" fill="#cbd5e1">Row + column parities detect AND locate single-bit errors</text>
      <text x="200" y="240" text-anchor="middle" font-size="9" fill="#22c55e">Can also detect some burst errors</text>
      <text x="200" y="258" text-anchor="middle" font-size="9" fill="#facc15">More redundancy → more reliable than simple parity</text>`;
  return s+'</svg>';
}

function checksumSVG(){
  return `<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">CHECKSUM — 1's Complement Addition</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" font-weight="600" fill="#6b7280">Add segments · complement sum · append checksum</text>
    ${[['1','0','0','1','1','0','0','1'],['1','1','1','0','0','0','1','0'],['0','0','1','0','0','1','0','0'],['1','0','0','0','0','1','0','0']].map((row,i)=>{
      const y=60+i*24;
      return `<text x="30" y="${y+14}" font-size="10" fill="#6b7280">${i+1}</text>${row.map((b,j)=>`<text x="${60+j*22}" y="${y+14}" font-size="12" font-weight="700" fill="${b==='1'?'#2dd4bf':'#cbd5e1'}">${b}</text>`).join('')}${i===0?`<line x1="55" y1="${y+20}" x2="240" y2="${y+20}" stroke="#2dd4bf" stroke-width="1"/>`:''}`;
    }).join('')}
    <text x="30" y="180" font-size="9" font-weight="800" fill="#6b7280">SUM</text>
    ${'11111111'.split('').map((b,j)=>`<text x="${60+j*22}" y="184" font-size="12" font-weight="700" fill="#facc15">${b}</text>`).join('')}
    <text x="30" y="208" font-size="9" font-weight="800" fill="#6b7280">COMPLEMENT</text>
    ${'00000000'.split('').map((b,j)=>`<text x="${60+j*22}" y="212" font-size="12" font-weight="700" fill="#22c55e">${b}</text>`).join('')}
    <text x="30" y="236" font-size="9" font-weight="800" fill="#6b7280">SEND</text>
    ${'10011001'.split('').map((b,j)=>`<text x="${60+j*22}" y="240" font-size="12" font-weight="700" fill="#facc15">${b}</text>`).join('')}
    <text x="240" y="240" font-size="9" fill="#cbd5e1">← checksum</text>
    <circle cx="230" cy="72" r="20" fill="none" stroke="#22c55e" stroke-width="1" opacity="0.6"><animate attributeName="cy" values="72;96;120;144;72" dur="3s" repeatCount="indefinite"/></circle>
    <text x="200" y="260" text-anchor="middle" font-size="9" font-weight="700" fill="#22c55e">Receiver sums all → complement → 0 means OK</text>
  </svg>`;
}

function crcSVG(){
  return `<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">CYCLIC REDUNDANCY CHECK</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" font-weight="600" fill="#6b7280">Binary division by a generator polynomial</text>
    <text x="30" y="66" font-size="9" font-weight="800" fill="#6b7280">GENERATOR</text>
    ${'1001'.split('').map((b,i)=>`<text x="${140+i*16}" y="70" font-size="12" font-weight="800" fill="#a78bfa">${b}</text>`).join('')}
    <text x="210" y="70" font-size="9" font-weight="700" fill="#a78bfa">← 4-bit CRC polynomial (x³+1)</text>
    <line x1="30" y1="80" x2="370" y2="80" stroke="#1e2a44" stroke-width="1"/>
    <text x="30" y="108" font-size="9" font-weight="800" fill="#6b7280">DIVIDE</text>
    <text x="140" y="108" font-size="12" font-family="monospace" font-weight="800" fill="#2dd4bf">1010000000</text>
    <text x="250" y="108" font-size="9" fill="#cbd5e1">← data + appended zeros</text>
    ${['1001  ╷1010','1001  │','────  │','0011  │','0000  │','────  │','0110  │','0000  │','────  │','1100  │','1001  │','────  │','0101  │','0000  │','────  │','1010  │','1001  │','────  │','0011  ← remainder'].map((line,i)=>`<text x="80" y="${132+i*7}" font-size="8" font-family="monospace" fill="${line.includes('remainder')?'#facc15':'#6b7280'}">${line}</text>`).join('')}
    <rect x="70" y="256" width="240" height="12" rx="3" fill="none" stroke="#facc15" stroke-width="1.2" opacity="0.7"><animate attributeName="opacity" values="0.9;0.2;0.9" dur="1.6s" repeatCount="indefinite"/></rect>
    <text x="200" y="266" text-anchor="middle" font-size="9" font-weight="900" fill="#facc15">CRC = 0011 (remainder) → appended to data</text>
  </svg>`;
}

/* ============================================================
   UNIT II — SLIDING WINDOW + ALOHA VISUALS
   ============================================================ */
function swTimelineSVG(step){
  const S={x:70},R={x:330};
  const frames=[
    {y:80,label:'Frame 0',ack:'ACK 1',lost:false},
    {y:120,label:'Frame 1',ack:'ACK 2',lost:true},
    {y:160,label:'Frame 2',ack:'ACK 3',lost:false},
    {y:200,label:'Frame 3',ack:'ACK 4',lost:false}
  ];
  let s=`<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">SLIDING WINDOW — ARQ protocols</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" font-weight="600" fill="#6b7280">${step<2?'Stop-and-Wait ARQ':step<4?'Go-Back-N ARQ':'Selective Repeat ARQ'}</text>
    <line x1="${S.x}" y1="50" x2="${S.x}" y2="240" stroke="#1e2a44" stroke-width="1" stroke-dasharray="4 3"/>
    <line x1="${R.x}" y1="50" x2="${R.x}" y2="240" stroke="#1e2a44" stroke-width="1" stroke-dasharray="4 3"/>
    <text x="${S.x}" y="60" text-anchor="middle" font-size="9" font-weight="800" fill="#2dd4bf">SENDER</text>
    <text x="${R.x}" y="60" text-anchor="middle" font-size="9" font-weight="800" fill="#22c55e">RECEIVER</text>`;
  frames.forEach((f,i)=>{
    const on=i<=Math.min(step,frames.length-1);
    const isLost=f.lost&&step>=3;
    if(on){
      s+=`<line x1="${S.x+4}" y1="${f.y}" x2="${R.x-4}" y2="${f.y}" stroke="${isLost?'#ef4444':'#2dd4bf'}" stroke-width="${isLost?1.6:2}"/>
          <polygon points="${R.x-4},${f.y} ${R.x-14},${f.y-4} ${R.x-14},${f.y+4}" fill="${isLost?'#ef4444':'#2dd4bf'}"/>
          <text x="${(S.x+R.x)/2}" y="${f.y-3}" text-anchor="middle" font-size="8" font-weight="700" fill="${isLost?'#ef4444':'#fff'}">${f.label}${isLost?' LOST':''}</text>`;
      s+=`<circle r="2.5" fill="#facc15"><animateMotion dur="1.6s" begin="${i*0.3}s" repeatCount="indefinite" path="M ${S.x+6} ${f.y} L ${R.x-6} ${f.y}"/></circle>`;
      if(!isLost||step===4){
        s+=`<line x1="${R.x-4}" y1="${f.y+10}" x2="${S.x+4}" y2="${f.y+10}" stroke="#22c55e" stroke-width="1.5"/>
            <polygon points="${S.x+4},${f.y+10} ${S.x+14},${f.y+6} ${S.x+14},${f.y+14}" fill="#22c55e"/>
            <text x="${(S.x+R.x)/2}" y="${f.y+22}" text-anchor="middle" font-size="7" fill="#22c55e">${f.ack}</text>`;
      }
    }
  });
  if(step===1){
    s+=`<circle cx="${S.x+30}" cy="120" r="14" fill="none" stroke="#facc15" stroke-width="1.5"><animate attributeName="r" values="6;20;6" dur="1.6s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0;1" dur="1.6s" repeatCount="indefinite"/></circle>
        <text x="${S.x+30}" y="122" text-anchor="middle" font-size="7" font-weight="800" fill="#facc15">TIMER</text>`;
  }
  s+=`<text x="200" y="256" text-anchor="middle" font-size="9" font-weight="700" fill="#facc15">${step===0?'Window=1: send one, wait for ACK':step===1?'Timer expires → resend the frame':step===2?'Send N frames, cumulative ACK':step===3?'Lost frame → resend it and all after':step===4?'Only the lost frame is resent':'SR more efficient on noisy links'}</text>`;
  return s+'</svg>';
}

function alohaTimelineSVG(step){
  const stations=4;
  const yBase=70,yGap=34;
  const alohaSubtitle=step===0?'Send whenever — collisions happen':step===1?'Vulnerable time = 2 × Tfr':step===2?'Send only at slot boundaries':step===3?'Listen before transmit':'Detect and abort on collision';
  let s=`<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">${step<3?'PURE ALOHA':step<4?'SLOTTED ALOHA':'CSMA / CSMA-CD'}</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" font-weight="600" fill="#6b7280">${alohaSubtitle}</text>`;
  for(let i=0;i<stations;i++){
    const y=yBase+i*yGap;
    s+=`<line x1="30" y1="${y}" x2="370" y2="${y}" stroke="#1e2a44" stroke-width="0.8" stroke-dasharray="3 4"/>
        <text x="22" y="${y+3}" text-anchor="end" font-size="8" font-weight="700" fill="#6b7280">S${i+1}</text>`;
  }
  if(step<2){
    const frames=[
      {s:0,x1:60,x2:140,fill:'#facc15'},
      {s:1,x1:110,x2:190,fill:'#38bdf8',collides:true},
      {s:2,x1:180,x2:260,fill:'#facc15'},
      {s:3,x1:230,x2:310,fill:'#a78bfa',collides:true}
    ];
    frames.forEach(f=>{
      const y=yBase+f.s*yGap;
      s+=`<rect x="${f.x1}" y="${y-8}" width="${f.x2-f.x1}" height="16" rx="3" fill="${f.fill}" opacity="0.85"/>
          <text x="${(f.x1+f.x2)/2}" y="${y+3}" text-anchor="middle" font-size="8" font-weight="800" fill="#000">FRAME</text>`;
    });
    s+=`<rect x="110" y="${yBase-14}" width="30" height="${stations*yGap+4}" fill="#ef4444" opacity="0.2"><animate attributeName="opacity" values="0.3;0.1;0.3" dur="1.6s" repeatCount="indefinite"/></rect>
        <rect x="230" y="${yBase-14}" width="30" height="${stations*yGap+4}" fill="#ef4444" opacity="0.2"><animate attributeName="opacity" values="0.3;0.1;0.3" dur="1.6s" begin="0.8s" repeatCount="indefinite"/></rect>
        <text x="125" y="${yBase-20}" text-anchor="middle" font-size="7" font-weight="800" fill="#ef4444">COLLISION</text>
        <text x="245" y="${yBase-20}" text-anchor="middle" font-size="7" font-weight="800" fill="#ef4444">COLLISION</text>`;
    if(step===1){
      s+=`<line x1="140" y1="${yBase-8}" x2="200" y2="${yBase-8}" stroke="#facc15" stroke-width="1.5"/>
          <line x1="140" y1="${yBase-14}" x2="140" y2="${yBase-2}" stroke="#facc15" stroke-width="1.5"/>
          <line x1="200" y1="${yBase-14}" x2="200" y2="${yBase-2}" stroke="#facc15" stroke-width="1.5"/>
          <text x="170" y="${yBase-18}" text-anchor="middle" font-size="8" font-weight="800" fill="#facc15">VULNERABLE = 2×Tfr</text>`;
    }
  } else if(step<4){
    for(let i=0;i<8;i++){
      const x=40+i*42;
      s+=`<line x1="${x}" y1="${yBase-16}" x2="${x}" y2="${yBase+stations*yGap+4}" stroke="#1e2a44" stroke-width="0.6" stroke-dasharray="2 3"/>`;
    }
    const frames=[
      {s:0,x1:40,x2:124,fill:'#facc15'},
      {s:1,x1:124,x2:208,fill:'#38bdf8'},
      {s:2,x1:208,x2:292,fill:'#facc15'},
      {s:3,x1:292,x2:376,fill:'#a78bfa'}
    ];
    frames.forEach(f=>{
      const y=yBase+f.s*yGap;
      s+=`<rect x="${f.x1+1}" y="${y-8}" width="${f.x2-f.x1-2}" height="16" rx="3" fill="${f.fill}" opacity="0.9"/>
          <text x="${(f.x1+f.x2)/2}" y="${y+3}" text-anchor="middle" font-size="8" font-weight="800" fill="#000">SLOT</text>`;
    });
    s+=`<line x1="${40+2*42}" y1="${yBase-16}" x2="${40+2*42}" y2="${yBase+stations*yGap+4}" stroke="#22c55e" stroke-width="1.5"><animate attributeName="stroke-opacity" values="1;0.2;1" dur="1.2s" repeatCount="indefinite"/></line>`;
    s+=`<text x="200" y="${yBase+stations*yGap+22}" text-anchor="middle" font-size="9" font-weight="800" fill="#facc15">Vulnerable = 1 × Tfr · max throughput 36.8%</text>`;
  } else {
    const y1=yBase+yGap;
    const y3=yBase+3*yGap;
    s+=`<rect x="60" y="${y1-8}" width="100" height="16" rx="3" fill="#facc15"/>
        <rect x="140" y="${y3-8}" width="100" height="16" rx="3" fill="#38bdf8"/>
        <text x="110" y="${y1+3}" text-anchor="middle" font-size="8" font-weight="800" fill="#000">S2 TX</text>
        <text x="190" y="${y3+3}" text-anchor="middle" font-size="8" font-weight="800" fill="#000">S4 TX</text>
        <rect x="160" y="${yBase}" width="20" height="${3*yGap}" fill="#ef4444" opacity="0.3"><animate attributeName="opacity" values="0.4;0.1;0.4" dur="1.2s" repeatCount="indefinite"/></rect>
        <text x="170" y="${yBase-2}" text-anchor="middle" font-size="7" font-weight="800" fill="#ef4444">COLLISION</text>
        <text x="200" y="${yBase+stations*yGap+18}" text-anchor="middle" font-size="8" fill="#cbd5e1">Both stations sense &amp; find medium idle → transmit → collide → both abort</text>
        <text x="200" y="${yBase+stations*yGap+34}" text-anchor="middle" font-size="8" font-weight="800" fill="#22c55e">Min frame = 2 × Tp so sender is still TX when echo returns</text>`;
  }
  return s+'</svg>';
}

/* ============================================================
   UNIT III — ROUTING VISUALS
   ============================================================ */
function nlIssuesSVG(step){
  const routers=[{x:80,y:130,l:'R1'},{x:170,y:130,l:'R2'},{x:260,y:130,l:'R3'},{x:350,y:130,l:'R4'}];
  return `<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">STORE-AND-FORWARD PACKET SWITCHING</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" font-weight="600" fill="#6b7280">STEP ${step+1} — ${['host sends','router stores','verify checksum','forward','deliver'][step]||''}</text>
    <rect x="20" y="180" width="60" height="30" rx="6" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.4"/>
    <text x="50" y="198" text-anchor="middle" font-size="9" font-weight="800" fill="#fff">HOST A</text>
    <rect x="320" y="180" width="60" height="30" rx="6" fill="#111a2e" stroke="#22c55e" stroke-width="1.4"/>
    <text x="350" y="198" text-anchor="middle" font-size="9" font-weight="800" fill="#fff">HOST B</text>
    ${routers.map((r,i)=>{
      const on=i<=step;
      return `<rect x="${r.x-22}" y="${r.y-16}" width="44" height="32" rx="6" fill="#111a2e" stroke="${on?'#2dd4bf':'#1e2a44'}" stroke-width="1.4" opacity="${on?1:.35}"/>
        <text x="${r.x}" y="${r.y+3}" text-anchor="middle" font-size="9" font-weight="800" fill="${on?'#fff':'#6b7280'}">${r.l}</text>
        ${on?`<circle cx="${r.x}" cy="${r.y}" r="24" fill="none" stroke="#2dd4bf" stroke-width="1" opacity="0.5"><animate attributeName="r" values="22;30;22" dur="2s" begin="${i*0.3}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.6;0;0.6" dur="2s" begin="${i*0.3}s" repeatCount="indefinite"/></circle>`:''}`;
    }).join('')}
    ${[0,1,2].map(i=>`<line x1="${routers[i].x+22}" y1="${routers[i].y}" x2="${routers[i+1].x-22}" y2="${routers[i+1].y}" stroke="#1e2a44" stroke-width="2"/>`).join('')}
    <line x1="80" y1="180" x2="80" y2="146" stroke="#2dd4bf" stroke-width="1.4" stroke-dasharray="4 3"/>
    <line x1="350" y1="146" x2="350" y2="180" stroke="#2dd4bf" stroke-width="1.4" stroke-dasharray="4 3"/>
    ${step>=0?`<circle r="5" fill="#facc15" stroke="#000"><animateMotion dur="${1.4*(step+1)}s" repeatCount="indefinite" path="M 80 180 L 80 130 L 350 130 L 350 180"/></circle>`:''}
    <text x="200" y="230" text-anchor="middle" font-size="9" fill="#cbd5e1">Packet fully received at each router · checksum verified · then forwarded</text>
    <text x="200" y="252" text-anchor="middle" font-size="9" font-weight="700" fill="${step>=3?'#22c55e':'#6b7280'}">${['','','','','✓ Delivered to Host B'][step]||''}</text>
  </svg>`;
}

function dijkstraSVG(step){
  const N=[{id:'A',x:60,y:150},{id:'B',x:170,y:60},{id:'C',x:170,y:200},{id:'D',x:290,y:60},{id:'E',x:290,y:200},{id:'F',x:360,y:130}];
  const E=[[0,1,2],[0,2,5],[1,2,1],[1,3,7],[2,4,4],[3,5,1],[4,5,2]];
  const dist=[0,2,5,9,4,6];
  const permSet=step===0?[0]:step===1?[0]:step===2?[0,1]:step===3?[0,1,2]:step===4?[0,1,2,4]:[0,1,2,4,3,5];
  return `<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">DIJKSTRA — D(v) = min(D(v), D(u) + w(u,v))</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" font-weight="600" fill="#6b7280">STEP ${step+1} — ${['root A','permanent A','relax B,C','pick B','relax via B','done'][step]||''}</text>
    ${E.map(([a,b,w])=>{
      const A=N[a],B=N[b];
      return `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="#2dd4bf" stroke-width="1.4" opacity="0.75"/>
        <circle cx="${(A.x+B.x)/2}" cy="${(A.y+B.y)/2}" r="8" fill="#0f172a" stroke="#2dd4bf" stroke-width="1"/>
        <text x="${(A.x+B.x)/2}" y="${(A.y+B.y)/2+3}" text-anchor="middle" font-size="9" font-weight="800" fill="#cbd5e1">${w}</text>`;
    }).join('')}
    ${N.map((n,i)=>{
      const perm=permSet.includes(i);
      return `<circle cx="${n.x}" cy="${n.y}" r="18" fill="${perm?'#facc15':'#111a2e'}" stroke="${perm?'#facc15':'#2dd4bf'}" stroke-width="1.6">${perm?`<animate attributeName="opacity" values="1;0.7;1" dur="1.6s" repeatCount="indefinite"/>`:''}</circle>
        <text x="${n.x}" y="${n.y+4}" text-anchor="middle" font-size="12" font-weight="900" fill="${perm?'#000':'#fff'}">${n.id}</text>
        <text x="${n.x}" y="${n.y+32}" text-anchor="middle" font-size="10" font-weight="800" fill="${perm?'#facc15':'#6b7280'}">${dist[i]===Infinity?'∞':dist[i]}</text>`;
    }).join('')}
    <text x="200" y="252" text-anchor="middle" font-size="10" font-weight="800" fill="#22c55e">${['D(A)=0 · others ∞','A is permanent','D(B)=2, D(C)=5 via A','B is min → permanent','D(E)=4 (via B) < 6','Shortest-path tree built'][step]||''}</text>
  </svg>`;
}

function dvSVG(step){
  return `<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">DISTANCE VECTOR — D_x(y) = min_v { c(x,v) + D_v(y) }</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" font-weight="600" fill="#6b7280">STEP ${step+1} — ${['init','share','receive','add cost','compare','update'][step]||''}</text>
    <circle cx="70" cy="150" r="20" fill="#111a2e" stroke="#facc15" stroke-width="1.6"/>
    <text x="70" y="155" text-anchor="middle" font-size="12" font-weight="900" fill="#facc15">A</text>
    <circle cx="170" cy="60" r="18" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.4"/>
    <text x="170" y="64" text-anchor="middle" font-size="11" font-weight="800" fill="#fff">B</text>
    <circle cx="170" cy="150" r="18" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.4"/>
    <text x="170" y="154" text-anchor="middle" font-size="11" font-weight="800" fill="#fff">C</text>
    <circle cx="170" cy="240" r="18" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.4"/>
    <text x="170" y="244" text-anchor="middle" font-size="11" font-weight="800" fill="#fff">D</text>
    <circle cx="290" cy="60" r="18" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.4"/>
    <text x="290" y="64" text-anchor="middle" font-size="11" font-weight="800" fill="#fff">E</text>
    <circle cx="290" cy="150" r="18" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.4"/>
    <text x="290" y="154" text-anchor="middle" font-size="11" font-weight="800" fill="#fff">F</text>
    <circle cx="290" cy="240" r="18" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.4"/>
    <text x="290" y="244" text-anchor="middle" font-size="11" font-weight="800" fill="#fff">G</text>
    <line x1="90" y1="145" x2="152" y2="65" stroke="#2dd4bf" stroke-width="1.6"/>
    <line x1="90" y1="150" x2="152" y2="150" stroke="#2dd4bf" stroke-width="1.6"/>
    <line x1="90" y1="155" x2="152" y2="235" stroke="#2dd4bf" stroke-width="1.6"/>
    ${step>=1?`<circle r="4" fill="#facc15"><animateMotion dur="1.6s" repeatCount="indefinite" path="M 90 145 L 152 65 L 152 150 L 152 235 L 90 155"/></circle>`:''}
    ${step>=2?`<circle r="3" fill="#22c55e"><animateMotion dur="1.6s" begin="0.8s" repeatCount="indefinite" path="M 152 65 L 90 145"/></circle><circle r="3" fill="#22c55e"><animateMotion dur="1.6s" begin="1.1s" repeatCount="indefinite" path="M 152 150 L 90 150"/></circle><circle r="3" fill="#22c55e"><animateMotion dur="1.6s" begin="1.4s" repeatCount="indefinite" path="M 152 235 L 90 155"/></circle>`:''}
    ${['B','C','D','E','F','G'].slice(0,Math.min(step,4)).map((n,i)=>`<text x="200" y="${90+i*22}" font-size="10" font-family="monospace" fill="#cbd5e1">to ${n}: ${(step+i)*2}</text>`).join('')}
    <text x="200" y="252" text-anchor="middle" font-size="10" font-weight="800" fill="#22c55e">${['A knows only its neighbours','A shares its table','B,C,D send theirs','add link costs','pick smaller per destination','route improved'][step]||''}</text>
  </svg>`;
}

function lsSVG(step){
  const nodes=[{x:60,y:70,l:'A'},{x:200,y:60,l:'B'},{x:340,y:70,l:'C'},{x:60,y:180,l:'D'},{x:200,y:180,l:'E'},{x:340,y:180,l:'F'},{x:200,y:240,l:'G'}];
  const links=[[0,1],[0,3],[1,2],[1,4],[2,5],[3,4],[4,5],[4,6]];
  return `<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">LINK STATE — LSP FLOODING + DIJKSTRA</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" font-weight="600" fill="#6b7280">STEP ${step+1} — ${['build LSP','flood','compare seq','Dijkstra','routing table'][step]||''}</text>
    ${links.map(([a,b])=>`<line x1="${nodes[a].x}" y1="${nodes[a].y}" x2="${nodes[b].x}" y2="${nodes[b].y}" stroke="#2dd4bf" stroke-width="1.4" opacity="0.6"/>`).join('')}
    ${step>=1?links.map(([a,b],i)=>{
      const A=nodes[a],B=nodes[b];
      return `<circle r="3" fill="#facc15"><animateMotion dur="${1.6+i*0.1}s" repeatCount="indefinite" path="M ${A.x} ${A.y} L ${B.x} ${B.y}"/></circle><circle r="3" fill="#22c55e" opacity="0.7"><animateMotion dur="${1.6+i*0.1}s" begin="${(1.6+i*0.1)/2}s" repeatCount="indefinite" path="M ${B.x} ${B.y} L ${A.x} ${A.y}"/></circle>`;
    }).join(''):''}
    ${nodes.map((n,i)=>{
      const hi=step>=3&&i===0;
      return `<circle cx="${n.x}" cy="${n.y}" r="18" fill="${hi?'#facc15':'#111a2e'}" stroke="#2dd4bf" stroke-width="1.4"/><text x="${n.x}" y="${n.y+4}" text-anchor="middle" font-size="11" font-weight="800" fill="${hi?'#000':'#fff'}">${n.l}</text>`;
    }).join('')}
    ${step>=2?`<text x="200" y="230" text-anchor="middle" font-size="9" fill="#cbd5e1">Sequence numbers: newer LSPs win</text>`:''}
    ${step>=4?`<rect x="100" y="238" width="200" height="16" rx="4" fill="rgba(250,204,21,.1)" stroke="#facc15" stroke-width="1"/><text x="200" y="250" text-anchor="middle" font-size="9" font-weight="800" fill="#facc15">dest · cost · next-router</text>`:''}
    <text x="200" y="262" text-anchor="middle" font-size="10" font-weight="800" fill="#22c55e">${['each node announces its links','flood to every router','keep only newer LSPs','Dijkstra on the topology','derive routing table'][step]||''}</text>
  </svg>`;
}

function hierarchicalSVG(step){
  const regions=[{x:80,y:70},{x:200,y:70},{x:320,y:70},{x:80,y:180},{x:200,y:180},{x:320,y:180}];
  return `<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">HIERARCHICAL ROUTING — OPTIMAL LEVELS = ln N</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" font-weight="600" fill="#6b7280">STEP ${step+1} — ${['flat','split','local','remote','3 levels'][step]||''}</text>
    ${regions.map((r,i)=>{
      const show=step>=1;
      return `<rect x="${r.x-42}" y="${r.y-30}" width="84" height="60" rx="10" fill="rgba(45,212,191,.06)" stroke="#2dd4bf" stroke-width="1.2" stroke-dasharray="${show?'0':'4 3'}" opacity="${show?1:.25}"/>
        <text x="${r.x}" y="${r.y-14}" text-anchor="middle" font-size="8" font-weight="800" fill="#2dd4bf" opacity="${show?1:.4}">R${i+1}</text>
        ${[0,1,2,3,4].map(j=>`<circle cx="${r.x+22*Math.cos(j*2*Math.PI/5)-10}" cy="${r.y+18*Math.sin(j*2*Math.PI/5)}" r="4" fill="#111a2e" stroke="#2dd4bf" stroke-width="0.8" opacity="${show?1:.4}"/>`).join('')}`;
    }).join('')}
    ${step>=3?`<line x1="80" y1="70" x2="320" y2="70" stroke="#facc15" stroke-width="1.6" stroke-dasharray="5 3"/><line x1="80" y1="180" x2="320" y2="180" stroke="#facc15" stroke-width="1.6" stroke-dasharray="5 3"/><text x="200" y="105" text-anchor="middle" font-size="8" fill="#facc15">region summary only</text>`:''}
    ${step>=4?`<text x="200" y="230" text-anchor="middle" font-size="9" fill="#cbd5e1">3-level hierarchy: cluster → region → router</text><text x="200" y="248" text-anchor="middle" font-size="9" font-weight="800" fill="#facc15">8 clusters × 9 regions × 10 routers = 25 entries/router</text>`:''}
    <text x="200" y="262" text-anchor="middle" font-size="10" font-weight="800" fill="#22c55e">${['flat table: N entries','split into regions','local detail full','remote = summary only','nest further to shrink table'][step]||''}</text>
  </svg>`;
}

function congestionSVG(step){
  return `<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">${step<3?'CONGESTION':'TRAFFIC SHAPING'}</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" font-weight="600" fill="#6b7280">STEP ${step+1} — ${['load','onset','collapse','leaky bucket','token bucket'][step]||''}</text>
    ${step<3?`
      <line x1="40" y1="220" x2="360" y2="220" stroke="#6b7280" stroke-width="1"/>
      <line x1="40" y1="220" x2="40" y2="60" stroke="#6b7280" stroke-width="1"/>
      <text x="40" y="240" font-size="8" fill="#6b7280">load</text>
      <text x="22" y="70" font-size="8" fill="#6b7280">goodput</text>
      <path d="M 40 200 Q 100 60, 160 100 Q 220 130, 300 200 Q 330 230, 360 240" fill="none" stroke="#2dd4bf" stroke-width="2.2" opacity="0.85"/>
      <path d="M 40 200 L 130 100" stroke="#22c55e" stroke-width="1.4" stroke-dasharray="4 3"/>
      ${step>=1?`<circle cx="130" cy="100" r="6" fill="#facc15"><animate attributeName="r" values="5;9;5" dur="1.4s" repeatCount="indefinite"/></circle><text x="130" y="85" text-anchor="middle" font-size="8" font-weight="800" fill="#facc15">ONSET</text>`:''}
      ${step>=2?`<text x="300" y="180" font-size="9" font-weight="800" fill="#ef4444">COLLAPSE</text><rect x="280" y="170" width="60" height="20" rx="4" fill="rgba(239,68,68,.15)" stroke="#ef4444" stroke-width="1.2"><animate attributeName="opacity" values="1;0.5;1" dur="1.2s" repeatCount="indefinite"/></rect>`:''}
    `:step===3?`
      <rect x="60" y="60" width="60" height="90" rx="8" fill="none" stroke="#2dd4bf" stroke-width="1.6"/>
      <rect x="60" y="100" width="60" height="50" fill="rgba(45,212,191,.3)"/>
      <text x="90" y="160" text-anchor="middle" font-size="8" fill="#6b7280">BUCKET</text>
      <line x1="120" y1="90" x2="180" y2="90" stroke="#2dd4bf" stroke-width="1.2"/>
      <circle cx="140" cy="90" r="4" fill="#facc15"><animate attributeName="cx" values="120;180;120" dur="2s" repeatCount="indefinite"/></circle>
      ${[0,1,2].map(i=>`<circle cx="80" cy="${120+i*14}" r="4" fill="#22c55e" opacity="${i<Math.min(step+1,3)?1:0.3}"><animate attributeName="cy" values="${90};${200};${90}" dur="3s" begin="${i*0.6}s" repeatCount="indefinite"/></circle>`).join('')}
      <text x="90" y="50" text-anchor="middle" font-size="9" font-weight="800" fill="#facc15">IN (bursty)</text>
      <text x="200" y="90" font-size="9" fill="#22c55e" font-weight="800">→ constant output rate</text>
      <text x="200" y="230" text-anchor="middle" font-size="10" fill="#cbd5e1">Smooths bursts · discards excess packets</text>
    `:`
      <rect x="60" y="60" width="60" height="90" rx="8" fill="none" stroke="#a78bfa" stroke-width="1.6"/>
      ${[0,1,2,3].map(i=>`<circle cx="${80+i*12}" cy="${80+i*15}" r="4" fill="#facc15" opacity="0.9"><animate attributeName="cy" values="70;140;70" dur="${2+i*0.3}s" begin="${i*0.4}s" repeatCount="indefinite"/></circle>`).join('')}
      <text x="90" y="160" text-anchor="middle" font-size="8" fill="#6b7280">TOKENS</text>
      <text x="90" y="50" text-anchor="middle" font-size="9" font-weight="800" fill="#a78bfa">Bucket of tokens</text>
      <line x1="120" y1="90" x2="180" y2="90" stroke="#a78bfa" stroke-width="1.2"/>
      <line x1="40" y1="220" x2="360" y2="220" stroke="#6b7280" stroke-width="1"/>
      <circle r="4" fill="#22c55e"><animateMotion dur="1.8s" repeatCount="indefinite" path="M 180 90 L 340 90"/></circle>
      <text x="240" y="80" text-anchor="middle" font-size="9" fill="#22c55e" font-weight="800">burst allowed</text>
      <text x="200" y="240" text-anchor="middle" font-size="10" fill="#cbd5e1">Saves tokens when idle · allows bursts later</text>
    `}
  </svg>`;
}

/* ============================================================
   UNIT IV — TRANSPORT LAYER VISUALS
   ============================================================ */
function tpServicesSVG(step){
  const layers=[{l:'Application',d:'Process-to-process'},{l:'Transport',d:'Port → Port'},{l:'Network',d:'Host → Host'},{l:'Data Link',d:'Node → Node'},{l:'Physical',d:'Bits on wire'}];
  return `<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">TRANSPORT LAYER</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" fill="#6b7280">Step ${step+1}</text>
    ${layers.map((L,i)=>{
      const y=55+i*40;
      const on=i<=step+2;
      return `<rect x="60" y="${y}" width="280" height="30" rx="6" fill="${on?'#111a2e':'#0a1020'}" stroke="${i===1?'#facc15':'#2dd4bf'}" stroke-width="${i===1?1.6:1.2}" opacity="${on?1:.35}"/>
        <text x="80" y="${y+20}" font-size="11" font-weight="800" fill="${i===1?'#facc15':'#2dd4bf'}">${L.l}</text>
        <text x="320" y="${y+20}" text-anchor="end" font-size="10" fill="#cbd5e1">${L.d}</text>
        ${i===1&&on?`<circle cx="200" cy="${y+15}" r="3" fill="#facc15"><animate attributeName="cx" values="90;320;90" dur="2.4s" repeatCount="indefinite"/></circle>`:''}`;
    }).join('')}
  </svg>`;
}

function tcpSegmentSVG(step){
  const fields=[{n:'Source Port',w:80,desc:'16b'},{n:'Dest Port',w:80,desc:'16b'},{n:'Seq Number',w:160,desc:'32b'},{n:'Ack Number',w:160,desc:'32b'},{n:'HLEN',w:30,desc:'4b'},{n:'Flags',w:50,desc:'6b'},{n:'Window',w:80,desc:'16b'},{n:'Checksum',w:80,desc:'16b'},{n:'Urgent',w:80,desc:'16b'}];
  let s=`<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">TCP SEGMENT (20–60 B)</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" fill="#6b7280">Step ${step+1}</text>`;
  let y=60,cx=20;
  fields.forEach(f=>{
    if(cx+f.w>380){cx=20;y+=40;}
    s+=`<rect x="${cx}" y="${y}" width="${f.w-2}" height="30" rx="3" fill="#111a2e" stroke="#2dd4bf" stroke-width="1"/>
      <text x="${cx+f.w/2-1}" y="${y+13}" text-anchor="middle" font-size="7.5" font-weight="800" fill="#2dd4bf">${f.n}</text>
      <text x="${cx+f.w/2-1}" y="${y+24}" text-anchor="middle" font-size="6.5" fill="#6b7280">${f.desc}</text>`;
    cx+=f.w;
  });
  s+=`<rect x="20" y="${y+40}" width="360" height="30" rx="3" fill="#0a1020" stroke="#a78bfa" stroke-width="1"/><text x="200" y="${y+59}" text-anchor="middle" font-size="10" font-weight="800" fill="#a78bfa">DATA</text></svg>`;
  return s;
}

function tcpHandshakeSVG(step){
  const S={x:80},R={x:320};
  const msgs=[{y:70,label:'SYN',detail:'seq = x',dir:'→',c:'#2dd4bf'},{y:130,label:'SYN+ACK',detail:'seq = y, ack = x+1',dir:'←',c:'#a78bfa'},{y:190,label:'ACK',detail:'ack = y+1',dir:'→',c:'#2dd4bf'}];
  let s=`<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">TCP 3-WAY HANDSHAKE</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" fill="#6b7280">Step ${step+1}</text>
    <line x1="${S.x}" y1="50" x2="${S.x}" y2="230" stroke="#1e2a44" stroke-dasharray="4 3"/>
    <line x1="${R.x}" y1="50" x2="${R.x}" y2="230" stroke="#1e2a44" stroke-dasharray="4 3"/>
    <text x="${S.x}" y="48" text-anchor="middle" font-size="10" font-weight="800" fill="#facc15">CLIENT</text>
    <text x="${R.x}" y="48" text-anchor="middle" font-size="10" font-weight="800" fill="#22c55e">SERVER</text>`;
  msgs.forEach((m,i)=>{
    if(i>step) return;
    const x1=m.dir==='→'?S.x+4:R.x-4;
    const x2=m.dir==='→'?R.x-4:S.x+4;
    s+=`<line x1="${x1}" y1="${m.y}" x2="${x2}" y2="${m.y}" stroke="${m.c}" stroke-width="2"/>
      <text x="200" y="${m.y-4}" text-anchor="middle" font-size="10" font-weight="800" fill="${m.c}">${m.label}</text>
      <text x="200" y="${m.y+14}" text-anchor="middle" font-size="9" fill="#cbd5e1">${m.detail}</text>
      <circle r="3" fill="${m.c}"><animateMotion dur="1.6s" repeatCount="indefinite" path="M ${x1} ${m.y} L ${x2} ${m.y}"/></circle>`;
  });
  return s+'</svg>';
}

function tcpWindowSVG(step){
  const total=10;
  const rwnd=[4,6,8,6,4,4][Math.min(step,5)];
  const cwnd=[2,3,5,7,7,7][Math.min(step,5)];
  const eff=Math.min(rwnd,cwnd);
  return `<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">W = min(rwnd, cwnd)</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" fill="#6b7280">Step ${step+1}</text>
    <text x="30" y="80" font-size="10" font-weight="800" fill="#2dd4bf">rwnd</text>
    <text x="30" y="120" font-size="10" font-weight="800" fill="#a78bfa">cwnd</text>
    <text x="30" y="160" font-size="10" font-weight="800" fill="#facc15">eff</text>
    ${[...Array(total)].map((_,i)=>{
      const x=100+i*26;
      return `<rect x="${x}" y="65" width="22" height="22" rx="3" fill="${i<rwnd?'#2dd4bf':'#0a1020'}" stroke="#2dd4bf" stroke-width="0.8" opacity="${i<rwnd?0.85:0.3}"/>
        <rect x="${x}" y="105" width="22" height="22" rx="3" fill="${i<cwnd?'#a78bfa':'#0a1020'}" stroke="#a78bfa" stroke-width="0.8" opacity="${i<cwnd?0.85:0.3}"/>
        <rect x="${x}" y="145" width="22" height="22" rx="3" fill="${i<eff?'#facc15':'#0a1020'}" stroke="#facc15" stroke-width="0.8" opacity="${i<eff?0.9:0.3}"/>`;
    }).join('')}
    <text x="200" y="210" text-anchor="middle" font-size="12" font-family="monospace" font-weight="800" fill="#facc15">min(${rwnd}, ${cwnd}) = ${eff}</text>
  </svg>`;
}

function tcpCongestionSVG(step){
  return `<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">AIMD + SLOW START</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" fill="#6b7280">Step ${step+1}</text>
    <line x1="40" y1="230" x2="380" y2="230" stroke="#6b7280"/>
    <line x1="40" y1="230" x2="40" y2="50" stroke="#6b7280"/>
    <polyline points="40,220 60,180 80,120 100,70 120,55 140,60" fill="none" stroke="#facc15" stroke-width="2.2"/>
    ${step>=2?`<polyline points="140,60 180,90 220,120 250,140" fill="none" stroke="#22c55e" stroke-width="2.2"/>`:''}
    ${step>=3?`<circle cx="250" cy="140" r="6" fill="#ef4444"><animate attributeName="r" values="5;9;5" dur="1.2s" repeatCount="indefinite"/></circle>`:''}
    ${step>=4?`<polyline points="250,140 250,200 280,180 310,155" fill="none" stroke="#a78bfa" stroke-width="2.2"/>`:''}
  </svg>`;
}

function udpDatagramSVG(step){
  return `<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">UDP DATAGRAM</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" fill="#6b7280">Step ${step+1}</text>
    <rect x="30" y="80" width="160" height="30" rx="3" fill="#facc15"/>
    <text x="110" y="100" text-anchor="middle" font-size="10" font-weight="800" fill="#000">Source Port</text>
    <rect x="190" y="80" width="160" height="30" rx="3" fill="#facc15"/>
    <text x="270" y="100" text-anchor="middle" font-size="10" font-weight="800" fill="#000">Dest Port</text>
    <rect x="30" y="115" width="160" height="30" rx="3" fill="#2dd4bf"/>
    <text x="110" y="135" text-anchor="middle" font-size="10" font-weight="800" fill="#000">Length</text>
    <rect x="190" y="115" width="160" height="30" rx="3" fill="#2dd4bf"/>
    <text x="270" y="135" text-anchor="middle" font-size="10" font-weight="800" fill="#000">Checksum</text>
    <rect x="30" y="150" width="320" height="30" rx="3" fill="#0a1020" stroke="#a78bfa"/>
    <text x="200" y="169" text-anchor="middle" font-size="10" font-weight="800" fill="#a78bfa">DATA</text>
    <text x="200" y="210" text-anchor="middle" font-size="11" fill="#cbd5e1">Header = 8 bytes · No connection · No ACKs</text>
  </svg>`;
}

/* ============================================================
   UNIT V — APPLICATION LAYER VISUALS
   ============================================================ */
function dnsSVG(step){
  const levels=[{l:'Root',d:'.',y:55},{l:'TLD',d:'.com / .edu',y:95},{l:'Domain',d:'example.com',y:135},{l:'Subdomain',d:'www.example.com',y:175}];
  return `<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">DNS HIERARCHY</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" fill="#6b7280">Step ${step+1}</text>
    ${levels.map((L,i)=>{
      const on=i<=step+1;
      return `<rect x="${40+i*20}" y="${L.y}" width="${320-i*40}" height="28" rx="6" fill="${on?'#111a2e':'#0a1020'}" stroke="#2dd4bf" stroke-width="1.2" opacity="${on?1:.4}"/>
        <text x="${52+i*20}" y="${L.y+19}" font-size="10" font-weight="800" fill="#2dd4bf">${L.l}</text>
        <text x="${350-i*20}" y="${L.y+19}" text-anchor="end" font-size="9" fill="#cbd5e1">${L.d}</text>`;
    }).join('')}
    ${step>=2?`<circle r="3" fill="#facc15"><animateMotion dur="2s" repeatCount="indefinite" path="M 60 210 L 200 55 L 340 210 L 60 210"/></circle>`:''}
  </svg>`;
}

function wwwHttpSVG(step){
  return `<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">WWW — CLIENT / SERVER</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" fill="#6b7280">Step ${step+1}</text>
    <rect x="40" y="100" width="90" height="70" rx="8" fill="#111a2e" stroke="#facc15" stroke-width="1.4"/>
    <text x="85" y="135" text-anchor="middle" font-size="11" font-weight="800" fill="#facc15">CLIENT</text>
    <rect x="270" y="100" width="90" height="70" rx="8" fill="#111a2e" stroke="#22c55e" stroke-width="1.4"/>
    <text x="315" y="135" text-anchor="middle" font-size="11" font-weight="800" fill="#22c55e">SERVER</text>
    <line x1="130" y1="125" x2="270" y2="125" stroke="#2dd4bf" stroke-width="1.6"/>
    <polygon points="270,125 260,121 260,129" fill="#2dd4bf"/>
    <text x="200" y="118" text-anchor="middle" font-size="8" fill="#2dd4bf" font-weight="800">GET /path HTTP/1.1</text>
    <line x1="270" y1="150" x2="130" y2="150" stroke="#22c55e" stroke-width="1.6"/>
    <polygon points="130,150 140,146 140,154" fill="#22c55e"/>
    <text x="200" y="166" text-anchor="middle" font-size="8" fill="#22c55e" font-weight="800">200 OK</text>
    <circle r="3" fill="#facc15"><animateMotion dur="1.6s" repeatCount="indefinite" path="M 130 125 L 270 125"/></circle>
    <circle r="3" fill="#22c55e"><animateMotion dur="1.6s" begin="0.8s" repeatCount="indefinite" path="M 270 150 L 130 150"/></circle>
    <text x="200" y="210" text-anchor="middle" font-size="9" font-family="monospace" fill="#cbd5e1">https://www.example.com:443/index.html</text>
    <text x="200" y="240" text-anchor="middle" font-size="10" font-weight="800" fill="#22c55e">Port 80 (HTTP) · 443 (HTTPS)</text>
  </svg>`;
}

function ftpSVG(step){
  return `<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">FTP — CONTROL + DATA</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" fill="#6b7280">Step ${step+1}</text>
    <rect x="40" y="90" width="80" height="100" rx="8" fill="#111a2e" stroke="#facc15" stroke-width="1.4"/>
    <text x="80" y="145" text-anchor="middle" font-size="11" font-weight="800" fill="#facc15">CLIENT</text>
    <rect x="280" y="90" width="80" height="100" rx="8" fill="#111a2e" stroke="#22c55e" stroke-width="1.4"/>
    <text x="320" y="145" text-anchor="middle" font-size="11" font-weight="800" fill="#22c55e">SERVER</text>
    <line x1="120" y1="115" x2="280" y2="115" stroke="#2dd4bf" stroke-width="2"/>
    <text x="200" y="108" text-anchor="middle" font-size="8" fill="#2dd4bf" font-weight="800">CONTROL :21</text>
    <circle r="3" fill="#facc15"><animateMotion dur="1.6s" repeatCount="indefinite" path="M 120 115 L 280 115"/></circle>
    ${step>=3?`<line x1="120" y1="160" x2="280" y2="160" stroke="#a78bfa" stroke-width="2"/><text x="200" y="174" text-anchor="middle" font-size="8" fill="#a78bfa" font-weight="800">DATA :20</text><circle r="3" fill="#a78bfa"><animateMotion dur="1.2s" repeatCount="indefinite" path="M 120 160 L 280 160"/></circle>`:''}
    <text x="200" y="240" text-anchor="middle" font-size="10" font-weight="800" fill="#22c55e">Commands on 21 · File bytes on 20</text>
  </svg>`;
}

function smtpSVG(step){
  return `<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">SMTP — PUSH MAIL</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" fill="#6b7280">Step ${step+1}</text>
    <rect x="20" y="100" width="80" height="60" rx="6" fill="#111a2e" stroke="#facc15" stroke-width="1.4"/>
    <text x="60" y="135" text-anchor="middle" font-size="10" font-weight="800" fill="#facc15">SENDER</text>
    <rect x="150" y="100" width="100" height="60" rx="6" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.4"/>
    <text x="200" y="135" text-anchor="middle" font-size="10" font-weight="800" fill="#2dd4bf">SENDER SRV</text>
    <rect x="300" y="100" width="80" height="60" rx="6" fill="#111a2e" stroke="#22c55e" stroke-width="1.4"/>
    <text x="340" y="135" text-anchor="middle" font-size="10" font-weight="800" fill="#22c55e">RECV SRV</text>
    <line x1="100" y1="130" x2="150" y2="130" stroke="#facc15" stroke-width="1.6"/>
    <line x1="250" y1="130" x2="300" y2="130" stroke="#2dd4bf" stroke-width="1.6"/>
    <text x="275" y="122" text-anchor="middle" font-size="8" fill="#2dd4bf" font-weight="800">SMTP :25</text>
    <circle r="3" fill="#facc15"><animateMotion dur="1.6s" repeatCount="indefinite" path="M 100 130 L 150 130 L 300 130 L 340 130"/></circle>
    ${step>=4?`<line x1="300" y1="160" x2="100" y2="160" stroke="#a78bfa" stroke-width="1.6" stroke-dasharray="4 3"/><text x="200" y="178" text-anchor="middle" font-size="8" fill="#a78bfa">POP3 :110 / IMAP :143</text><circle r="3" fill="#a78bfa"><animateMotion dur="1.4s" repeatCount="indefinite" path="M 300 160 L 100 160"/></circle>`:''}
    <text x="200" y="240" text-anchor="middle" font-size="10" font-weight="800" fill="#22c55e">SMTP pushes · POP3/IMAP pull</text>
  </svg>`;
}

function telnetSVG(step){
  return `<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">TELNET — REMOTE LOGIN VIA NVT</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" fill="#6b7280">Step ${step+1}</text>
    <rect x="30" y="100" width="90" height="70" rx="6" fill="#111a2e" stroke="#facc15" stroke-width="1.4"/>
    <text x="75" y="140" text-anchor="middle" font-size="10" font-weight="800" fill="#facc15">CLIENT</text>
    <rect x="155" y="105" width="90" height="60" rx="6" fill="#0f172a" stroke="#a78bfa" stroke-width="1.4"/>
    <text x="200" y="130" text-anchor="middle" font-size="10" font-weight="800" fill="#a78bfa">NVT</text>
    <text x="200" y="148" text-anchor="middle" font-size="7" fill="#6b7280">7-bit ASCII</text>
    <rect x="280" y="100" width="90" height="70" rx="6" fill="#111a2e" stroke="#22c55e" stroke-width="1.4"/>
    <text x="325" y="140" text-anchor="middle" font-size="10" font-weight="800" fill="#22c55e">SERVER</text>
    <circle r="3" fill="#facc15"><animateMotion dur="1.6s" repeatCount="indefinite" path="M 120 135 L 155 135 L 245 135 L 280 135"/></circle>
    <text x="200" y="215" text-anchor="middle" font-size="10" font-family="monospace" fill="#cbd5e1">telnet host.example.com (port 23)</text>
    <text x="200" y="240" text-anchor="middle" font-size="10" font-weight="800" fill="#22c55e">Universal NVT makes TELNET platform-independent</text>
  </svg>`;
}

function rtpSVG(step){
  return `<svg viewBox="0 0 400 270" style="width:100%;height:100%;max-width:420px">
    <text x="200" y="16" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">RTP — REAL-TIME OVER UDP</text>
    <text x="200" y="30" text-anchor="middle" font-size="9" fill="#6b7280">Step ${step+1}</text>
    <rect x="30" y="110" width="60" height="50" rx="6" fill="#111a2e" stroke="#facc15" stroke-width="1.4"/>
    <text x="60" y="140" text-anchor="middle" font-size="9" font-weight="800" fill="#facc15">APP</text>
    <rect x="120" y="110" width="70" height="50" rx="6" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.4"/>
    <text x="155" y="140" text-anchor="middle" font-size="9" font-weight="800" fill="#2dd4bf">RTP</text>
    <rect x="220" y="110" width="60" height="50" rx="6" fill="#111a2e" stroke="#a78bfa" stroke-width="1.4"/>
    <text x="250" y="140" text-anchor="middle" font-size="9" font-weight="800" fill="#a78bfa">UDP</text>
    <rect x="310" y="110" width="60" height="50" rx="6" fill="#111a2e" stroke="#22c55e" stroke-width="1.4"/>
    <text x="340" y="140" text-anchor="middle" font-size="9" font-weight="800" fill="#22c55e">NET</text>
    <circle r="3" fill="#facc15"><animateMotion dur="1.4s" repeatCount="indefinite" path="M 90 135 L 120 135 L 190 135 L 220 135 L 280 135 L 310 135"/></circle>
    <text x="200" y="210" text-anchor="middle" font-size="9" font-family="monospace" fill="#cbd5e1">[ 12B header ][ payload ] → UDP → IP</text>
    <text x="200" y="235" text-anchor="middle" font-size="9" font-weight="800" fill="#facc15">seq # detects loss · timestamp syncs</text>
    <text x="200" y="255" text-anchor="middle" font-size="9" fill="#22c55e">Best-effort — jitter handled by receiver buffer</text>
  </svg>`;
}

/* ============================================================
   MINI VISUALS — for quiz answers
   ============================================================ */
function svgTwoNodes(){ return `<svg viewBox="0 0 200 100" style="width:100%;height:100px"><rect x="20" y="35" width="50" height="30" rx="6" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.4"/><text x="45" y="53" text-anchor="middle" font-size="9" font-weight="800" fill="#fff">NODE A</text><rect x="130" y="35" width="50" height="30" rx="6" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.4"/><text x="155" y="53" text-anchor="middle" font-size="9" font-weight="800" fill="#fff">NODE B</text><line x1="70" y1="50" x2="130" y2="50" stroke="#2dd4bf" stroke-width="2"/><circle r="3" fill="#facc15"><animateMotion dur="1.6s" repeatCount="indefinite" path="M 70 50 L 130 50"/></circle><text x="100" y="82" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">2 nodes + 1 link</text></svg>`; }
function svgNodes(){ return `<svg viewBox="0 0 200 100" style="width:100%;height:100px"><circle cx="40" cy="44" r="16" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.4"/><text x="40" y="48" text-anchor="middle" font-size="14">💻</text><circle cx="100" cy="44" r="16" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.4"/><text x="100" y="48" text-anchor="middle" font-size="14">🖨️</text><circle cx="160" cy="44" r="16" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.4"/><text x="160" y="48" text-anchor="middle" font-size="14">🖥️</text><text x="100" y="82" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">PC • Printer • Server</text></svg>`; }
function svgOfficeShare(){ return `<svg viewBox="0 0 200 100" style="width:100%;height:100px"><rect x="30" y="40" width="50" height="30" rx="6" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.4"/><text x="55" y="58" text-anchor="middle" font-size="9" font-weight="800" fill="#fff">PC</text><rect x="120" y="40" width="50" height="30" rx="6" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.4"/><text x="145" y="58" text-anchor="middle" font-size="9" font-weight="800" fill="#fff">PRINTER</text><line x1="80" y1="55" x2="120" y2="55" stroke="#2dd4bf" stroke-width="2"/><text x="100" y="86" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">Office resource sharing</text></svg>`; }
function svgPhishing(){ return `<svg viewBox="0 0 200 100" style="width:100%;height:100px"><rect x="20" y="30" width="60" height="40" rx="6" fill="#111a2e" stroke="#ef4444" stroke-width="1.4"/><text x="50" y="48" text-anchor="middle" font-size="9" font-weight="800" fill="#ef4444">FAKE</text><text x="50" y="60" text-anchor="middle" font-size="7" fill="#cbd5e1">email</text><line x1="80" y1="50" x2="120" y2="50" stroke="#ef4444" stroke-width="1.8" stroke-dasharray="3 3"/><polygon points="120,46 130,50 120,54" fill="#ef4444"/><rect x="135" y="30" width="50" height="40" rx="6" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.4"/><text x="160" y="48" text-anchor="middle" font-size="9" font-weight="800" fill="#fff">USER</text><text x="160" y="60" text-anchor="middle" font-size="7" fill="#cbd5e1">tricked</text><text x="100" y="90" text-anchor="middle" font-size="8" font-weight="700" fill="#ef4444">Credentials stolen</text></svg>`; }
function svgSimplex(){ return `<svg viewBox="0 0 200 100" style="width:100%;height:100px"><rect x="20" y="35" width="50" height="30" rx="6" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.4"/><text x="45" y="53" text-anchor="middle" font-size="8" font-weight="800" fill="#fff">KEYBOARD</text><rect x="130" y="35" width="50" height="30" rx="6" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.4"/><text x="155" y="53" text-anchor="middle" font-size="8" font-weight="800" fill="#fff">COMPUTER</text><line x1="70" y1="50" x2="130" y2="50" stroke="#2dd4bf" stroke-width="2.4"/><polygon points="130,46 140,50 130,54" fill="#2dd4bf"/><text x="100" y="80" text-anchor="middle" font-size="8" font-weight="700" fill="#facc15">One-way (Simplex)</text></svg>`; }
function svgHalfDuplex(){ return `<svg viewBox="0 0 200 100" style="width:100%;height:100px"><rect x="20" y="35" width="50" height="30" rx="6" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.4"/><text x="45" y="53" text-anchor="middle" font-size="8" font-weight="800" fill="#fff">WALKIE A</text><rect x="130" y="35" width="50" height="30" rx="6" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.4"/><text x="155" y="53" text-anchor="middle" font-size="8" font-weight="800" fill="#fff">WALKIE B</text><line x1="70" y1="45" x2="130" y2="45" stroke="#2dd4bf" stroke-width="1.8" stroke-dasharray="4 3"/><line x1="70" y1="55" x2="130" y2="55" stroke="#a78bfa" stroke-width="1.8" stroke-dasharray="4 3"/><text x="100" y="40" text-anchor="middle" font-size="6" fill="#2dd4bf">←</text><text x="100" y="68" text-anchor="middle" font-size="6" fill="#a78bfa">→</text><text x="100" y="86" text-anchor="middle" font-size="8" font-weight="700" fill="#facc15">Both ways, take turns</text></svg>`; }
function svgCriteria(){ return `<svg viewBox="0 0 200 100" style="width:100%;height:100px"><rect x="15" y="30" width="55" height="40" rx="6" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.4"/><text x="42" y="46" text-anchor="middle" font-size="7" font-weight="800" fill="#2dd4bf">PERF</text><text x="42" y="60" text-anchor="middle" font-size="7" fill="#cbd5e1">throughput</text><rect x="75" y="30" width="55" height="40" rx="6" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.4"/><text x="102" y="46" text-anchor="middle" font-size="7" font-weight="800" fill="#2dd4bf">RELI</text><text x="102" y="60" text-anchor="middle" font-size="7" fill="#cbd5e1">uptime</text><rect x="135" y="30" width="55" height="40" rx="6" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.4"/><text x="162" y="46" text-anchor="middle" font-size="7" font-weight="800" fill="#2dd4bf">SEC</text><text x="162" y="60" text-anchor="middle" font-size="7" fill="#cbd5e1">protect</text><text x="100" y="90" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">3 network criteria</text></svg>`; }
function svgMeshCount(){
  const N=[{x:50,y:20,l:'1'},{x:150,y:20,l:'2'},{x:150,y:80,l:'3'},{x:50,y:80,l:'4'}];
  const edges=[[0,1],[1,2],[2,3],[3,0],[0,2],[1,3]];
  let s=`<svg viewBox="0 0 200 100" style="width:100%;height:100px">`;
  edges.forEach(([a,b],i)=>{
    const A=N[a],B=N[b];
    s+=`<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="#2dd4bf" stroke-width="1.3"/>`;
    const mx=(A.x+B.x)/2,my=(A.y+B.y)/2;
    s+=`<circle cx="${mx}" cy="${my}" r="6" fill="#0f172a" stroke="#facc15" stroke-width="0.8"/><text x="${mx}" y="${my+2.5}" text-anchor="middle" font-size="6.5" font-weight="800" fill="#facc15">${i+1}</text>`;
  });
  N.forEach(n=>{ s+=`<circle cx="${n.x}" cy="${n.y}" r="11" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.2"/><text x="${n.x}" y="${n.y+3}" text-anchor="middle" font-size="9" font-weight="800" fill="#fff">${n.l}</text>`; });
  s+=`<text x="100" y="96" text-anchor="middle" font-size="7" font-weight="700" fill="#22c55e">n(n-1)/2 = 6 links for n=4</text></svg>`;
  return s;
}
function svgStarSPOF(){ return `<svg viewBox="0 0 200 100" style="width:100%;height:100px"><rect x="82" y="41" width="36" height="18" rx="9" fill="#ef4444"/><text x="100" y="53" text-anchor="middle" font-size="7" font-weight="900" fill="#fff">HUB OFF</text>${[[25,20],[175,20],[25,80],[175,80],[100,88]].map(([x,y])=>`<line x1="100" y1="50" x2="${x}" y2="${y}" stroke="#ef4444" stroke-width="1.4" stroke-dasharray="4 3" opacity="0.8"/><circle cx="${x}" cy="${y}" r="9" fill="#1a0f0f" stroke="#ef4444" stroke-width="1" opacity="0.5"/><text x="${x}" y="${y+2.5}" text-anchor="middle" font-size="7" font-weight="800" fill="#ef4444">X</text>`).join('')}<text x="100" y="98" text-anchor="middle" font-size="7" font-weight="700" fill="#ef4444">Hub fails → all down</text></svg>`; }
function svgBusTerminator(){ return `<svg viewBox="0 0 200 100" style="width:100%;height:100px"><line x1="20" y1="50" x2="180" y2="50" stroke="#2dd4bf" stroke-width="3"/><rect x="12" y="42" width="10" height="16" rx="2" fill="#ef4444"/><text x="17" y="76" text-anchor="middle" font-size="7" font-weight="800" fill="#ef4444">TERM</text><rect x="178" y="42" width="10" height="16" rx="2" fill="#ef4444"/><text x="183" y="76" text-anchor="middle" font-size="7" font-weight="800" fill="#ef4444">TERM</text><circle cx="60" cy="50" r="4" fill="#facc15"/><circle cx="100" cy="50" r="4" fill="#facc15"/><circle cx="140" cy="50" r="4" fill="#facc15"/><text x="100" y="20" text-anchor="middle" font-size="8" font-weight="700" fill="#facc15">Terminators absorb reflection</text><text x="100" y="92" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">Required at both ends</text></svg>`; }
function svgRingBreak(){
  const cx=100,cy=55,R=32,N=4;
  const nodes=Array.from({length:N},(_,i)=>{const a=-Math.PI/2+i*2*Math.PI/N;return {x:cx+R*Math.cos(a),y:cy+R*Math.sin(a),l:'N'+(i+1)};});
  let svg='';
  for(let i=0;i<N;i++){
    const A=nodes[i],B=nodes[(i+1)%N];
    const broken=i===1;
    svg+=`<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="${broken?'#ef4444':'#2dd4bf'}" stroke-width="1.6" stroke-dasharray="${broken?'4 3':'0'}"/>`;
    if(broken){const mx=(A.x+B.x)/2,my=(A.y+B.y)/2;svg+=`<circle cx="${mx}" cy="${my}" r="7" fill="#1a0f0f" stroke="#ef4444" stroke-width="1"/><line x1="${mx-3}" y1="${my-3}" x2="${mx+3}" y2="${my+3}" stroke="#ef4444" stroke-width="1.3" stroke-linecap="round"/><line x1="${mx-3}" y1="${my+3}" x2="${mx+3}" y2="${my-3}" stroke="#ef4444" stroke-width="1.3" stroke-linecap="round"/>`;}
  }
  nodes.forEach(n=>{svg+=`<circle cx="${n.x}" cy="${n.y}" r="10" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.2"/><text x="${n.x}" y="${n.y+2.5}" text-anchor="middle" font-size="7" font-weight="800" fill="#fff">${n.l}</text>`;});
  return `<svg viewBox="0 0 200 100" style="width:100%;height:100px">${svg}<text x="100" y="96" text-anchor="middle" font-size="7" font-weight="700" fill="#ef4444">One break → whole ring down</text></svg>`;
}
function svgHybrid(){ return `<svg viewBox="0 0 200 100" style="width:100%;height:100px"><rect x="15" y="40" width="30" height="20" rx="10" fill="#facc15" stroke="#000" stroke-width="1"/><text x="30" y="53" text-anchor="middle" font-size="7" font-weight="900" fill="#000">HUB</text><line x1="45" y1="50" x2="80" y2="25" stroke="#2dd4bf" stroke-width="1.4"/><line x1="45" y1="50" x2="80" y2="50" stroke="#2dd4bf" stroke-width="1.4"/><line x1="45" y1="50" x2="80" y2="75" stroke="#2dd4bf" stroke-width="1.4"/><line x1="80" y1="25" x2="180" y2="25" stroke="#2dd4bf" stroke-width="2"/><line x1="80" y1="50" x2="180" y2="50" stroke="#2dd4bf" stroke-width="2"/><line x1="80" y1="75" x2="180" y2="75" stroke="#2dd4bf" stroke-width="2"/><text x="100" y="98" text-anchor="middle" font-size="7" font-weight="700" fill="#22c55e">Star + Bus combined</text></svg>`; }
function svgFiberMini(){ return `<svg viewBox="0 0 200 100" style="width:100%;height:100px"><rect x="20" y="35" width="160" height="30" rx="3" fill="#0ea5e9" opacity="0.2"/><rect x="20" y="45" width="160" height="12" rx="2" fill="#38bdf8" opacity="0.35"/><polyline points="25,55 45,40 65,60 85,40 105,60 125,40 145,60 165,45 180,55" stroke="#facc15" stroke-width="2" fill="none"/><text x="100" y="25" text-anchor="middle" font-size="8" font-weight="700" fill="#38bdf8">CORE (light path)</text><text x="100" y="88" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">Fiber uses light</text></svg>`; }
function svgCoaxMini(){ return `<svg viewBox="0 0 200 100" style="width:100%;height:100px"><circle cx="100" cy="50" r="32" fill="#ef4444" opacity="0.2"/><circle cx="100" cy="50" r="26" fill="#0a0a0a"/><circle cx="100" cy="50" r="20" fill="#f59e0b" opacity="0.4"/><circle cx="100" cy="50" r="12" fill="#fff" opacity="0.9"/><circle cx="100" cy="50" r="4" fill="#78350f"/><text x="100" y="92" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">Coax · used in Cable TV</text></svg>`; }
function svgRadioMini(){ return `<svg viewBox="0 0 200 100" style="width:100%;height:100px"><line x1="100" y1="70" x2="100" y2="35" stroke="#2dd4bf" stroke-width="2"/><circle cx="100" cy="33" r="3" fill="#2dd4bf"/><circle cx="100" cy="33" r="18" fill="none" stroke="#a78bfa" stroke-width="1.2"/><circle cx="100" cy="33" r="28" fill="none" stroke="#a78bfa" stroke-width="1"/><circle cx="100" cy="33" r="38" fill="none" stroke="#a78bfa" stroke-width="0.8"/><text x="100" y="92" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">Radio · omni-directional</text></svg>`; }
function svgFiberEMI(){ return `<svg viewBox="0 0 200 100" style="width:100%;height:100px"><path d="M 20 50 L 180 50" stroke="#38bdf8" stroke-width="3"/><polyline points="30,50 50,42 70,58 90,42 110,58 130,42 150,58 170,50" stroke="#facc15" stroke-width="1.5" fill="none"/><text x="100" y="20" text-anchor="middle" font-size="8" font-weight="700" fill="#a78bfa">EMI waves</text><path d="M 40 20 Q 50 30 60 20" stroke="#a78bfa" stroke-width="1" fill="none"/><path d="M 100 20 Q 110 30 120 20" stroke="#a78bfa" stroke-width="1" fill="none"/><path d="M 150 20 Q 160 30 170 20" stroke="#a78bfa" stroke-width="1" fill="none"/><text x="100" y="88" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">EMI cannot enter fiber</text></svg>`; }

/* ---- Other mini visuals (referenced by topic questions) ---- */
function miniSvg(type){
  /* central dispatcher — many mini types map to a generic visual */
  const map = {
    'dllstack':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><rect x="20" y="20" width="160" height="12" rx="2" fill="#111a2e" stroke="#2dd4bf"/><rect x="20" y="36" width="160" height="12" rx="2" fill="#111a2e" stroke="#2dd4bf"/><rect x="20" y="52" width="160" height="12" rx="2" fill="#111a2e" stroke="#2dd4bf"/><rect x="20" y="68" width="160" height="12" rx="2" fill="#111a2e" stroke="#2dd4bf"/><text x="100" y="94" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">Framing · Addressing · Flow · Error</text></svg>`,
    'flowctrl':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><rect x="30" y="35" width="50" height="30" rx="6" fill="#111a2e" stroke="#2dd4bf"/><text x="55" y="54" text-anchor="middle" font-size="8" fill="#fff">SENDER</text><rect x="120" y="30" width="50" height="40" rx="6" fill="#111a2e" stroke="#22c55e"/><text x="145" y="54" text-anchor="middle" font-size="8" fill="#fff">BUFFER</text><line x1="80" y1="50" x2="120" y2="50" stroke="#2dd4bf" stroke-width="2"/><text x="100" y="86" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">Don't overflow receiver</text></svg>`,
    'charcount':`<svg viewBox="0 0 200 100" style="width:100%;height:100px">${'512345'.split('').map((c,i)=>`<rect x="${20+i*24}" y="40" width="20" height="24" rx="3" fill="${i===0?'#facc15':'#111a2e'}" stroke="#2dd4bf"/><text x="${30+i*24}" y="57" text-anchor="middle" font-size="10" font-weight="800" fill="${i===0?'#000':'#fff'}">${c}</text>`).join('')}<text x="100" y="86" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">Count header = 5</text></svg>`,
    'bytestuff':`<svg viewBox="0 0 200 100" style="width:100%;height:100px">${['FLAG','A','ESC','FLAG','B','FLAG'].map((c,i)=>{const x=15+i*29;const isF=c==='FLAG';const isE=c==='ESC';return `<rect x="${x}" y="35" width="26" height="26" rx="3" fill="${isF?'#facc15':isE?'#ef4444':'#111a2e'}" stroke="#2dd4bf"/><text x="${x+13}" y="53" text-anchor="middle" font-size="7" font-weight="800" fill="${isF?'#000':'#fff'}">${c}</text>`;}).join('')}<text x="100" y="86" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">ESC before accidental FLAG</text></svg>`,
    'bitstuff':`<svg viewBox="0 0 200 100" style="width:100%;height:100px">${'01111101011111010'.split('').map((b,i)=>{const x=12+i*10;const isS=(i===7||i===15);return `<rect x="${x}" y="40" width="9" height="20" rx="2" fill="${isS?'#facc15':(b==='1'?'#111a2e':'#0f172a')}" stroke="#2dd4bf" stroke-width="0.7"/><text x="${x+4.5}" y="54" text-anchor="middle" font-size="8" font-weight="800" fill="${isS?'#000':(b==='1'?'#2dd4bf':'#6b7280')}">${b}</text>`;}).join('')}<text x="100" y="86" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">0 inserted after five 1s</text></svg>`,
    'parity':`<svg viewBox="0 0 200 100" style="width:100%;height:100px">${'100011'.split('').map((b,i)=>`<rect x="${20+i*22}" y="38" width="18" height="24" rx="3" fill="${b==='1'?'#111a2e':'#0f172a'}" stroke="#2dd4bf"/><text x="${29+i*22}" y="55" text-anchor="middle" font-size="11" font-weight="800" fill="${b==='1'?'#2dd4bf':'#6b7280'}">${b}</text>`).join('')}<rect x="${20+6*22}" y="38" width="18" height="24" rx="3" fill="#facc15"/><text x="${29+6*22}" y="55" text-anchor="middle" font-size="11" font-weight="900" fill="#000">1</text><text x="100" y="86" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">Parity makes 1s even</text></svg>`,
    'checksum':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="30" y="35" font-size="10" font-family="monospace" font-weight="700" fill="#facc15">10011001</text><text x="30" y="53" font-size="10" font-family="monospace" font-weight="700" fill="#cbd5e1">11100010</text><text x="30" y="71" font-size="10" font-family="monospace" font-weight="700" fill="#cbd5e1">00100100</text><text x="30" y="89" font-size="10" font-family="monospace" font-weight="700" fill="#22c55e">11011010</text><text x="140" y="89" font-size="7" fill="#6b7280">← checksum</text></svg>`,
    'crc':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="20" y="30" font-size="10" font-weight="800" fill="#a78bfa">gen 1001</text><text x="20" y="52" font-size="10" font-family="monospace" font-weight="700" fill="#2dd4bf">1010000000</text><line x1="20" y1="60" x2="180" y2="60" stroke="#facc15" stroke-width="1"/><text x="20" y="78" font-size="10" font-family="monospace" font-weight="700" fill="#facc15">0011 ← CRC</text></svg>`,
    'hamming':`<svg viewBox="0 0 200 100" style="width:100%;height:100px">${[1,2,3,4,5,6,7].map((p,i)=>{const x=15+i*25;const isR=(p===1||p===2||p===4);return `<rect x="${x}" y="35" width="22" height="28" rx="3" fill="${isR?'#facc15':'#111a2e'}" stroke="#2dd4bf"/><text x="${x+11}" y="54" text-anchor="middle" font-size="10" font-weight="800" fill="${isR?'#000':'#fff'}">${isR?'r'+p:(p-1)}</text>`;}).join('')}<text x="100" y="86" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">Parity at 1,2,4</text></svg>`,
    'swarq':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="20" y="30" font-size="8" font-weight="700" fill="#2dd4bf">SENDER</text><text x="140" y="30" font-size="8" font-weight="700" fill="#22c55e">RECEIVER</text><line x1="30" y1="45" x2="140" y2="45" stroke="#2dd4bf" stroke-width="1.6"/><polygon points="140,45 132,42 132,48" fill="#2dd4bf"/><line x1="140" y1="60" x2="30" y2="60" stroke="#22c55e" stroke-width="1.6"/><polygon points="30,60 38,57 38,63" fill="#22c55e"/><circle r="3" fill="#facc15"><animateMotion dur="1.6s" repeatCount="indefinite" path="M 30 45 L 140 45 L 30 60"/></circle><text x="100" y="90" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">Window = 1</text></svg>`,
    'gbn':`<svg viewBox="0 0 200 100" style="width:100%;height:100px">${[0,1,2,3].map((n,i)=>`<rect x="${20+i*22}" y="35" width="18" height="20" rx="3" fill="${i>=1?'#ef4444':'#111a2e'}" stroke="#2dd4bf"/><text x="${29+i*22}" y="49" text-anchor="middle" font-size="9" font-weight="800" fill="#fff">F${n}</text>`).join('')}<text x="100" y="68" text-anchor="middle" font-size="7" fill="#ef4444">F1 lost → resend F1,F2,F3</text><text x="100" y="86" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">Go-Back-N</text></svg>`,
    'sr':`<svg viewBox="0 0 200 100" style="width:100%;height:100px">${[0,1,2,3].map((n,i)=>`<rect x="${20+i*22}" y="35" width="18" height="20" rx="3" fill="${i===1?'#ef4444':i===2?'#facc15':'#111a2e'}" stroke="#2dd4bf"/><text x="${29+i*22}" y="49" text-anchor="middle" font-size="9" font-weight="800" fill="#fff">F${n}</text>`).join('')}<text x="100" y="68" text-anchor="middle" font-size="7" fill="#facc15">Only F1 resent · F2 buffered</text><text x="100" y="86" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">Selective Repeat</text></svg>`,
    'purealoha':`<svg viewBox="0 0 200 100" style="width:100%;height:100px">${[0,1,2].map(i=>{const y=25+i*22;return `<text x="10" y="${y+8}" font-size="7" font-weight="700" fill="#6b7280">S${i+1}</text><rect x="${30+i*25}" y="${y}" width="${60}" height="14" rx="2" fill="${i===1?'#ef4444':'#facc15'}" opacity="0.85"/>`;}).join('')}<text x="100" y="86" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">Vulnerable = 2 × Tfr</text></svg>`,
    'csmacd':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="10" y="30" font-size="7" font-weight="700" fill="#6b7280">S1</text><text x="10" y="55" font-size="7" font-weight="700" fill="#6b7280">S2</text><text x="10" y="80" font-size="7" font-weight="700" fill="#6b7280">S3</text><rect x="30" y="22" width="70" height="14" rx="2" fill="#facc15" opacity="0.85"/><rect x="80" y="47" width="70" height="14" rx="2" fill="#38bdf8" opacity="0.85"/><rect x="80" y="22" width="20" height="40" fill="#ef4444" opacity="0.35"><animate attributeName="opacity" values="0.5;0.1;0.5" dur="1s" repeatCount="indefinite"/></rect><text x="90" y="16" text-anchor="middle" font-size="6" font-weight="800" fill="#ef4444">COLLISION</text><text x="100" y="90" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">Detect &amp; abort</text></svg>`,
    'csmaca':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><line x1="10" y1="50" x2="190" y2="50" stroke="#1e2a44"/><rect x="20" y="40" width="40" height="20" fill="#ef4444" opacity="0.6"/><text x="40" y="30" text-anchor="middle" font-size="7" fill="#ef4444">BUSY</text><rect x="85" y="40" width="30" height="20" fill="#facc15" opacity="0.6"/><rect x="115" y="40" width="30" height="20" fill="#facc15" opacity="0.6"/><text x="130" y="30" text-anchor="middle" font-size="7" fill="#facc15">CONTENTION</text><rect x="150" y="40" width="30" height="20" fill="#22c55e" opacity="0.6"/><text x="165" y="30" text-anchor="middle" font-size="7" fill="#22c55e">SEND</text><text x="100" y="92" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">Avoid via IFS + window</text></svg>`,
    'storefwd':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><rect x="20" y="35" width="40" height="30" rx="4" fill="#111a2e" stroke="#2dd4bf"/><text x="40" y="54" text-anchor="middle" font-size="7" fill="#fff">HOST</text><line x1="60" y1="50" x2="90" y2="50" stroke="#2dd4bf" stroke-width="1.6"/><rect x="90" y="35" width="40" height="30" rx="4" fill="#111a2e" stroke="#facc15"/><text x="110" y="54" text-anchor="middle" font-size="7" fill="#facc15">ROUTER</text><line x1="130" y1="50" x2="160" y2="50" stroke="#2dd4bf" stroke-width="1.6"/><text x="100" y="86" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">Store fully → forward</text></svg>`,
    'datagram':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><rect x="20" y="40" width="30" height="20" rx="3" fill="#facc15"/><rect x="55" y="40" width="30" height="20" rx="3" fill="#22c55e"/><rect x="90" y="40" width="30" height="20" rx="3" fill="#a78bfa"/><rect x="125" y="40" width="30" height="20" rx="3" fill="#2dd4bf"/><text x="35" y="54" text-anchor="middle" font-size="7" fill="#000">P1</text><text x="70" y="54" text-anchor="middle" font-size="7" fill="#000">P2</text><text x="105" y="54" text-anchor="middle" font-size="7" fill="#000">P3</text><text x="140" y="54" text-anchor="middle" font-size="7" fill="#000">P4</text><text x="100" y="86" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">Each packet routed independently</text></svg>`,
    'relax':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="22" text-anchor="middle" font-size="10" font-weight="800" fill="#2dd4bf">D(v) = min(D(v), D(u)+w)</text><circle cx="60" cy="55" r="14" fill="#facc15"/><text x="60" y="60" text-anchor="middle" font-size="11" font-weight="900" fill="#000">u</text><circle cx="140" cy="55" r="14" fill="#111a2e" stroke="#2dd4bf"/><text x="140" y="60" text-anchor="middle" font-size="11" font-weight="800" fill="#fff">v</text><line x1="74" y1="55" x2="126" y2="55" stroke="#2dd4bf" stroke-width="2"/><circle r="3" fill="#22c55e"><animateMotion dur="1.4s" repeatCount="indefinite" path="M 74 55 L 126 55"/></circle><text x="100" y="90" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">relax edge</text></svg>`,
    'perm':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><circle cx="60" cy="50" r="18" fill="#facc15"/><text x="60" y="55" text-anchor="middle" font-size="11" font-weight="900" fill="#000">min</text><circle cx="140" cy="50" r="18" fill="#111a2e" stroke="#6b7280"/><text x="140" y="55" text-anchor="middle" font-size="11" font-weight="800" fill="#6b7280">others</text><text x="100" y="90" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">Smallest → permanent</text></svg>`,
    'tree':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><circle cx="100" cy="25" r="10" fill="#facc15"/><circle cx="60" cy="60" r="8" fill="#111a2e" stroke="#2dd4bf"/><circle cx="140" cy="60" r="8" fill="#111a2e" stroke="#2dd4bf"/><circle cx="40" cy="85" r="6" fill="#111a2e" stroke="#2dd4bf"/><circle cx="80" cy="85" r="6" fill="#111a2e" stroke="#2dd4bf"/><line x1="100" y1="25" x2="60" y2="60" stroke="#2dd4bf"/><line x1="100" y1="25" x2="140" y2="60" stroke="#2dd4bf"/><line x1="60" y1="60" x2="40" y2="85" stroke="#2dd4bf"/><line x1="60" y1="60" x2="80" y2="85" stroke="#2dd4bf"/><text x="100" y="98" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">Shortest-path tree</text></svg>`,
    'dvshare':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><circle cx="50" cy="50" r="16" fill="#facc15"/><text x="50" y="55" text-anchor="middle" font-size="11" font-weight="900" fill="#000">A</text><circle cx="150" cy="50" r="16" fill="#111a2e" stroke="#2dd4bf"/><text x="150" y="55" text-anchor="middle" font-size="11" font-weight="800" fill="#fff">B</text><line x1="66" y1="50" x2="134" y2="50" stroke="#2dd4bf" stroke-width="2"/><text x="100" y="42" text-anchor="middle" font-size="7" fill="#2dd4bf" font-weight="800">full table →</text><circle r="3" fill="#22c55e"><animateMotion dur="1.4s" repeatCount="indefinite" path="M 66 50 L 134 50"/></circle></svg>`,
    'infinity':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="40" text-anchor="middle" font-size="24" font-weight="900" fill="#ef4444">∞ → 16</text><text x="100" y="66" text-anchor="middle" font-size="9" fill="#cbd5e1">max hops = 15</text><text x="100" y="88" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">RIP uses 16 as ∞</text></svg>`,
    'splithorizon':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><circle cx="50" cy="50" r="14" fill="#facc15"/><text x="50" y="55" text-anchor="middle" font-size="10" font-weight="900" fill="#000">A</text><circle cx="100" cy="50" r="14" fill="#111a2e" stroke="#2dd4bf"/><text x="100" y="55" text-anchor="middle" font-size="10" font-weight="800" fill="#fff">B</text><circle cx="150" cy="50" r="14" fill="#111a2e" stroke="#2dd4bf"/><text x="150" y="55" text-anchor="middle" font-size="10" font-weight="800" fill="#fff">X</text><line x1="64" y1="50" x2="86" y2="50" stroke="#22c55e" stroke-width="2"/><line x1="114" y1="50" x2="136" y2="50" stroke="#2dd4bf" stroke-width="2"/><text x="100" y="88" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">Don't advertise back to source</text></svg>`,
    'lsp':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><rect x="30" y="25" width="140" height="50" rx="4" fill="#111a2e" stroke="#2dd4bf"/><text x="100" y="42" text-anchor="middle" font-size="9" font-weight="800" fill="#2dd4bf">NODE A · LINKS: B,C,D</text><text x="100" y="58" text-anchor="middle" font-size="9" fill="#cbd5e1">SEQ=5 · AGE=120</text><text x="100" y="90" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">Business card for a router</text></svg>`,
    'flood':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><circle cx="100" cy="50" r="14" fill="#facc15"/><text x="100" y="55" text-anchor="middle" font-size="10" font-weight="900" fill="#000">A</text><circle cx="40" cy="25" r="10" fill="#111a2e" stroke="#2dd4bf"/><circle cx="160" cy="25" r="10" fill="#111a2e" stroke="#2dd4bf"/><circle cx="40" cy="75" r="10" fill="#111a2e" stroke="#2dd4bf"/><circle cx="160" cy="75" r="10" fill="#111a2e" stroke="#2dd4bf"/><line x1="100" y1="50" x2="40" y2="25" stroke="#2dd4bf"/><line x1="100" y1="50" x2="160" y2="25" stroke="#2dd4bf"/><line x1="100" y1="50" x2="40" y2="75" stroke="#2dd4bf"/><line x1="100" y1="50" x2="160" y2="75" stroke="#2dd4bf"/><circle r="3" fill="#22c55e"><animateMotion dur="1.6s" repeatCount="indefinite" path="M 100 50 L 40 25 L 100 50 L 160 25 L 100 50 L 40 75 L 100 50 L 160 75"/></circle><text x="100" y="95" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">Flood to every interface</text></svg>`,
    'levels':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="22" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">optimal = ln N</text>${[['flat',720,'#ef4444'],['2-lvl',53,'#facc15'],['3-lvl',25,'#22c55e']].map(([l,v,c],i)=>{const y=42+i*18;return `<text x="20" y="${y+4}" font-size="8" fill="#cbd5e1">${l}</text><rect x="60" y="${y-6}" width="${Math.min(100,v/8)}" height="12" rx="2" fill="${c}" opacity="0.7"/><text x="${63+Math.min(100,v/8)}" y="${y+4}" font-size="8" font-weight="800" fill="${c}">${v}</text>`;}).join('')}<text x="100" y="94" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">sweet spot</text></svg>`,
    'hier':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><rect x="20" y="30" width="60" height="40" rx="6" fill="rgba(45,212,191,.1)" stroke="#2dd4bf"/><text x="50" y="55" text-anchor="middle" font-size="9" fill="#2dd4bf" font-weight="800">R1</text><rect x="120" y="30" width="60" height="40" rx="6" fill="rgba(45,212,191,.06)" stroke="#2dd4bf" stroke-dasharray="3 3"/><text x="150" y="55" text-anchor="middle" font-size="9" fill="#6b7280">remote</text><text x="100" y="88" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">Local detail + remote summary</text></svg>`,
    'leaky':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><path d="M 60 30 L 140 30 L 130 80 L 70 80 Z" fill="none" stroke="#2dd4bf" stroke-width="1.6"/><path d="M 75 50 L 125 50 L 122 75 L 78 75 Z" fill="rgba(45,212,191,.3)"/><circle cx="90" cy="42" r="3" fill="#facc15"><animate attributeName="cy" values="35;50;35" dur="1.6s" repeatCount="indefinite"/></circle><circle cx="110" cy="42" r="3" fill="#facc15"><animate attributeName="cy" values="35;50;35" dur="1.6s" begin="0.5s" repeatCount="indefinite"/></circle><circle cx="100" cy="88" r="3" fill="#22c55e"><animate attributeName="cy" values="82;96;82" dur="1.4s" repeatCount="indefinite"/></circle><text x="100" y="98" text-anchor="middle" font-size="7" fill="#6b7280">drop excess</text></svg>`,
    'token':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><path d="M 60 30 L 140 30 L 130 80 L 70 80 Z" fill="none" stroke="#a78bfa" stroke-width="1.6"/>${[0,1,2,3,4,5].map(i=>`<circle cx="${78+i*10}" cy="${42+(i%3)*14}" r="3" fill="#facc15" opacity="0.9"/>`).join('')}<circle r="3" fill="#22c55e"><animateMotion dur="1.4s" repeatCount="indefinite" path="M 100 82 L 180 82"/></circle><text x="140" y="78" text-anchor="middle" font-size="7" fill="#22c55e">burst</text><text x="100" y="98" text-anchor="middle" font-size="7" fill="#6b7280">ρ = token rate</text></svg>`,
    'tpServices':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="22" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">process ↔ process</text>${[0,1,2,3].map(i=>`<rect x="30" y="${35+i*14}" width="140" height="12" rx="2" fill="#111a2e" stroke="${i===1?'#facc15':'#2dd4bf'}"/>`).join('')}<text x="100" y="94" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">port-to-port</text></svg>`,
    'ports':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><line x1="20" y1="50" x2="180" y2="50" stroke="#6b7280"/><rect x="20" y="42" width="30" height="16" fill="#2dd4bf" opacity="0.7"/><text x="35" y="72" text-anchor="middle" font-size="7" fill="#2dd4bf">0–1023</text><rect x="60" y="42" width="60" height="16" fill="#facc15" opacity="0.7"/><text x="90" y="72" text-anchor="middle" font-size="7" fill="#facc15">1024–49151</text><rect x="130" y="42" width="50" height="16" fill="#a78bfa" opacity="0.7"/><text x="155" y="72" text-anchor="middle" font-size="7" fill="#a78bfa">49152+</text><text x="100" y="22" text-anchor="middle" font-size="10" font-weight="800" fill="#2dd4bf">Port ranges</text><text x="100" y="90" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">16-bit port = 65536 values</text></svg>`,
    'tcpHdrMin':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="22" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">TCP ≥ 20 bytes</text><rect x="30" y="40" width="140" height="30" rx="4" fill="#facc15"/><text x="100" y="60" text-anchor="middle" font-size="12" font-weight="900" fill="#000">Header</text><text x="100" y="90" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">+ up to 40 bytes options</text></svg>`,
    'synFlag':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="22" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">SYN = start connection</text><circle cx="50" cy="55" r="16" fill="#facc15"/><text x="50" y="60" text-anchor="middle" font-size="10" font-weight="900" fill="#000">C</text><circle cx="150" cy="55" r="16" fill="#22c55e"/><text x="150" y="60" text-anchor="middle" font-size="10" font-weight="900" fill="#000">S</text><line x1="66" y1="55" x2="134" y2="55" stroke="#2dd4bf" stroke-width="2"/><polygon points="130,55 120,51 120,59" fill="#2dd4bf"/><circle r="3" fill="#facc15"><animateMotion dur="1.4s" repeatCount="indefinite" path="M 66 55 L 134 55"/></circle><text x="100" y="80" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">SYN →</text></svg>`,
    'handshake3':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="18" text-anchor="middle" font-size="10" font-weight="800" fill="#2dd4bf">3-way handshake</text>${[[60,'SYN','#facc15'],[75,'SYN+ACK','#a78bfa'],[90,'ACK','#2dd4bf']].map(([y,l,c])=>`<text x="30" y="${y}" font-size="8" font-weight="800" fill="${c}">${l}</text><line x1="70" y1="${y-3}" x2="130" y2="${y-3}" stroke="${c}" stroke-width="1.4"/>`).join('')}<text x="100" y="98" text-anchor="middle" font-size="7" font-weight="700" fill="#22c55e">established</text></svg>`,
    'synFlood':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="18" text-anchor="middle" font-size="10" font-weight="800" fill="#ef4444">SYN flood</text>${[0,1,2,3,4,5,6].map(i=>`<circle cx="${30+((i*23)%150)}" cy="${40+(i%3)*15}" r="5" fill="#ef4444" opacity="0.7"><animate attributeName="cx" values="${30+((i*23)%150)};170;${30+((i*23)%150)}" dur="${1.4+i*0.1}s" repeatCount="indefinite"/></circle>`).join('')}<rect x="160" y="30" width="30" height="40" rx="4" fill="#1a0f0f" stroke="#ef4444" stroke-width="1.4"/><text x="175" y="55" text-anchor="middle" font-size="9" font-weight="900" fill="#ef4444">SVR</text><text x="100" y="92" text-anchor="middle" font-size="8" font-weight="700" fill="#ef4444">resources exhausted</text></svg>`,
    'minWindow':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="18" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">W = min(rwnd, cwnd)</text><text x="50" y="50" text-anchor="middle" font-size="10" font-family="monospace" fill="#2dd4bf">rwnd=8</text><text x="150" y="50" text-anchor="middle" font-size="10" font-family="monospace" fill="#a78bfa">cwnd=4</text><text x="100" y="75" text-anchor="middle" font-size="13" font-family="monospace" font-weight="800" fill="#facc15">= 4</text><text x="100" y="92" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">smaller wins</text></svg>`,
    'byteWindow':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="18" text-anchor="middle" font-size="10" font-weight="800" fill="#2dd4bf">byte-oriented window</text>${[0,1,2,3,4,5,6,7].map(i=>`<rect x="${20+i*20}" y="40" width="18" height="24" rx="2" fill="${i<5?'#facc15':'#111a2e'}" stroke="#2dd4bf" stroke-width="0.8"/><text x="${29+i*20}" y="56" text-anchor="middle" font-size="8" font-weight="800" fill="${i<5?'#000':'#6b7280'}">b${i}</text>`).join('')}<text x="100" y="88" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">sliding window of bytes</text></svg>`,
    'aimd':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="18" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">+1 / ÷2</text><polyline points="20,80 60,60 100,40 120,35 140,60 170,50" fill="none" stroke="#22c55e" stroke-width="1.8"/><circle cx="120" cy="35" r="4" fill="#ef4444"><animate attributeName="r" values="3;6;3" dur="1.2s" repeatCount="indefinite"/></circle><text x="100" y="94" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">sawtooth</text></svg>`,
    'fastRetx':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="18" text-anchor="middle" font-size="10" font-weight="800" fill="#2dd4bf">3 dup ACKs → resend</text>${[0,1,2].map(i=>`<rect x="${30+i*40}" y="35" width="30" height="18" rx="3" fill="#facc15"/><text x="${45+i*40}" y="48" text-anchor="middle" font-size="8" font-weight="800" fill="#000">ACK</text>`).join('')}<rect x="140" y="70" width="40" height="18" rx="3" fill="#ef4444"/><text x="160" y="83" text-anchor="middle" font-size="8" font-weight="800" fill="#fff">RETX</text><text x="100" y="94" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">fast retransmit</text></svg>`,
    'udpHdr':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="18" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">UDP header = 8 bytes</text>${[0,1,2,3].map(i=>`<rect x="${30+(i%2)*70}" y="${35+Math.floor(i/2)*24}" width="60" height="18" rx="3" fill="${i<2?'#facc15':'#2dd4bf'}"/><text x="${60+(i%2)*70}" y="${48+Math.floor(i/2)*24}" text-anchor="middle" font-size="8" font-weight="800" fill="#000">field ${i+1}</text>`).join('')}<text x="100" y="94" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">4 fields × 16 bits</text></svg>`,
    'udpUse':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="20" text-anchor="middle" font-size="10" font-weight="800" fill="#2dd4bf">UDP use cases</text>${[['DNS',30],['VoIP',70],['streaming',110],['RPC',150]].map(([l,x])=>`<rect x="${x-15}" y="42" width="42" height="20" rx="4" fill="#111a2e" stroke="#2dd4bf"/><text x="${x+6}" y="55" text-anchor="middle" font-size="7" font-weight="800" fill="#22c55e">${l}</text>`).join('')}<text x="100" y="88" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">speed &gt; reliability</text></svg>`,
    'dnsPort':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="20" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">DNS :53</text><circle cx="100" cy="55" r="20" fill="#facc15"/><text x="100" y="60" text-anchor="middle" font-size="14" font-weight="900" fill="#000">53</text><text x="100" y="92" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">UDP · also TCP</text></svg>`,
    'dnsRoot':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="18" text-anchor="middle" font-size="10" font-weight="800" fill="#2dd4bf">Root at top</text><rect x="60" y="30" width="80" height="14" rx="3" fill="#facc15"/><text x="100" y="41" text-anchor="middle" font-size="8" font-weight="800" fill="#000">.</text><rect x="70" y="50" width="60" height="14" rx="3" fill="#111a2e" stroke="#2dd4bf"/><text x="100" y="61" text-anchor="middle" font-size="7" fill="#2dd4bf">.com</text><rect x="80" y="70" width="40" height="14" rx="3" fill="#111a2e" stroke="#2dd4bf"/><text x="100" y="81" text-anchor="middle" font-size="7" fill="#2dd4bf">example</text></svg>`,
    'httpGet':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="20" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">GET method</text><rect x="40" y="40" width="120" height="24" rx="4" fill="#111a2e" stroke="#2dd4bf"/><text x="100" y="56" text-anchor="middle" font-size="10" font-family="monospace" font-weight="800" fill="#2dd4bf">GET /path</text><text x="100" y="86" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">retrieve a document</text></svg>`,
    'httpPort':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="20" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">HTTP :80 · HTTPS :443</text><circle cx="60" cy="55" r="18" fill="#facc15"/><text x="60" y="60" text-anchor="middle" font-size="13" font-weight="900" fill="#000">80</text><circle cx="140" cy="55" r="18" fill="#22c55e"/><text x="140" y="60" text-anchor="middle" font-size="12" font-weight="900" fill="#000">443</text><text x="100" y="92" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">web ports</text></svg>`,
    'ftpConn':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="20" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">FTP = 2 connections</text><line x1="30" y1="50" x2="170" y2="50" stroke="#2dd4bf" stroke-width="2"/><text x="100" y="44" text-anchor="middle" font-size="7" fill="#2dd4bf" font-weight="800">control :21</text><line x1="30" y1="72" x2="170" y2="72" stroke="#a78bfa" stroke-width="2"/><text x="100" y="88" text-anchor="middle" font-size="7" fill="#a78bfa" font-weight="800">data :20</text></svg>`,
    'ftpPorts':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="20" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">Control 21 · Data 20</text><circle cx="60" cy="55" r="16" fill="#2dd4bf"/><text x="60" y="60" text-anchor="middle" font-size="11" font-weight="900" fill="#000">21</text><circle cx="140" cy="55" r="16" fill="#a78bfa"/><text x="140" y="60" text-anchor="middle" font-size="11" font-weight="900" fill="#000">20</text><text x="100" y="92" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">control + data</text></svg>`,
    'smtpPort':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="20" text-anchor="middle" font-size="10" font-weight="800" fill="#2dd4bf">SMTP :25 · Submission :587</text><rect x="20" y="42" width="60" height="26" rx="4" fill="#2dd4bf"/><text x="50" y="59" text-anchor="middle" font-size="11" font-weight="900" fill="#000">25</text><rect x="120" y="42" width="60" height="26" rx="4" fill="#22c55e"/><text x="150" y="59" text-anchor="middle" font-size="11" font-weight="900" fill="#000">587</text><text x="100" y="90" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">relay · submit</text></svg>`,
    'smtpRecv':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="20" text-anchor="middle" font-size="10" font-weight="800" fill="#2dd4bf">POP3 :110 · IMAP :143</text><rect x="20" y="42" width="60" height="26" rx="4" fill="#a78bfa"/><text x="50" y="59" text-anchor="middle" font-size="11" font-weight="900" fill="#000">110</text><rect x="120" y="42" width="60" height="26" rx="4" fill="#a78bfa"/><text x="150" y="59" text-anchor="middle" font-size="11" font-weight="900" fill="#000">143</text><text x="100" y="90" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">pull email</text></svg>`,
    'nvt':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="20" text-anchor="middle" font-size="10" font-weight="800" fill="#2dd4bf">NVT = Network Virtual Terminal</text><rect x="40" y="40" width="120" height="26" rx="4" fill="#a78bfa"/><text x="100" y="58" text-anchor="middle" font-size="10" font-weight="800" fill="#000">7-bit ASCII</text><text x="100" y="86" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">universal charset</text></svg>`,
    'telnetPort':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="20" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">TELNET :23</text><circle cx="100" cy="55" r="20" fill="#facc15"/><text x="100" y="61" text-anchor="middle" font-size="14" font-weight="900" fill="#000">23</text><text x="100" y="92" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">remote login</text></svg>`,
    'rtpUdp':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="20" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">RTP over UDP</text><rect x="30" y="42" width="50" height="24" rx="4" fill="#2dd4bf"/><text x="55" y="58" text-anchor="middle" font-size="10" font-weight="900" fill="#000">RTP</text><rect x="120" y="42" width="50" height="24" rx="4" fill="#a78bfa"/><text x="145" y="58" text-anchor="middle" font-size="10" font-weight="900" fill="#000">UDP</text><line x1="80" y1="54" x2="120" y2="54" stroke="#facc15" stroke-width="1.6"/><circle r="3" fill="#facc15"><animateMotion dur="1.4s" repeatCount="indefinite" path="M 80 54 L 120 54"/></circle><text x="100" y="90" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">real-time media</text></svg>`,
    'rtpSeq':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="20" text-anchor="middle" font-size="10" font-weight="800" fill="#2dd4bf">Sequence # detects loss</text>${[0,1,2,3,5,6].map((n,i)=>`<rect x="${20+i*28}" y="42" width="24" height="20" rx="3" fill="${i===3?'#ef4444':'#2dd4bf'}" opacity="0.8"/><text x="${32+i*28}" y="56" text-anchor="middle" font-size="9" font-weight="800" fill="#000">${n}</text>`).join('')}<text x="100" y="88" text-anchor="middle" font-size="8" font-weight="700" fill="#ef4444">#4 missing!</text></svg>`,
    /* Formula minis */
    'meshLinksMin':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><rect x="15" y="15" width="40" height="40" rx="6" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.3"/><rect x="145" y="15" width="40" height="40" rx="6" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.3"/><rect x="15" y="55" width="40" height="40" rx="6" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.3"/><rect x="145" y="55" width="40" height="40" rx="6" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.3"/><line x1="55" y1="35" x2="145" y2="35" stroke="#2dd4bf" stroke-width="1.2"/><line x1="55" y1="75" x2="145" y2="75" stroke="#2dd4bf" stroke-width="1.2"/><line x1="35" y1="55" x2="165" y2="55" stroke="#2dd4bf" stroke-width="1.2"/><line x1="35" y1="35" x2="165" y2="75" stroke="#2dd4bf" stroke-width="1.2"/><line x1="165" y1="35" x2="35" y2="75" stroke="#2dd4bf" stroke-width="1.2"/><circle r="2.5" fill="#facc15"><animateMotion dur="1.8s" repeatCount="indefinite" path="M 55 35 L 145 35 L 145 75 L 55 75 L 55 35"/></circle><text x="100" y="96" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">n(n-1)/2</text></svg>`,
    'starLinksMin':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><rect x="80" y="40" width="40" height="20" rx="10" fill="#22c55e"/><text x="100" y="54" text-anchor="middle" font-size="7" font-weight="900" fill="#000">SW</text>${[[30,25],[170,25],[30,75],[170,75],[100,85]].map(([x,y])=>`<line x1="100" y1="50" x2="${x}" y2="${y}" stroke="#2dd4bf" stroke-width="1.4"/><circle cx="${x}" cy="${y}" r="6" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.2"/>`).join('')}<circle r="2.5" fill="#facc15"><animateMotion dur="1.4s" repeatCount="indefinite" path="M 30 25 L 100 50 L 170 75"/></circle><text x="100" y="96" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">Links = n</text></svg>`,
    'busTermMin':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><line x1="20" y1="50" x2="180" y2="50" stroke="#2dd4bf" stroke-width="3"/><rect x="12" y="42" width="10" height="16" rx="2" fill="#ef4444"><animate attributeName="opacity" values="1;0.4;1" dur="1.2s" repeatCount="indefinite"/></rect><rect x="178" y="42" width="10" height="16" rx="2" fill="#ef4444"><animate attributeName="opacity" values="1;0.4;1" dur="1.2s" begin="0.6s" repeatCount="indefinite"/></rect><circle r="3" fill="#facc15"><animateMotion dur="1.6s" repeatCount="indefinite" path="M 20 50 L 180 50 L 20 50"/></circle><text x="100" y="90" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">Terminators = 2</text></svg>`,
    'hammingRMin':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="26" text-anchor="middle" font-size="13" font-weight="800" fill="#2dd4bf">2^r ≥ d+r+1</text><text x="100" y="48" text-anchor="middle" font-size="10" fill="#cbd5e1">d=4 → r=3 → 7 bits</text>${[1,2,3,4,5,6,7].map((p,i)=>{const x=40+i*18;const isR=(p===1||p===2||p===4);return `<rect x="${x}" y="60" width="14" height="20" rx="3" fill="${isR?'#facc15':'#111a2e'}" stroke="#2dd4bf"/><text x="${x+7}" y="74" text-anchor="middle" font-size="9" font-weight="800" fill="${isR?'#000':'#fff'}">${isR?'r':'·'}</text>`;}).join('')}<text x="100" y="96" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">r parity bits protect d data bits</text></svg>`,
    'hammingPosMin':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="26" text-anchor="middle" font-size="13" font-weight="800" fill="#2dd4bf">pos = r4·4 + r2·2 + r1</text><text x="60" y="62" font-size="16" font-family="monospace" font-weight="800" fill="#facc15">1 0 0</text><text x="120" y="62" font-size="14" fill="#cbd5e1">→</text><text x="150" y="62" font-size="16" font-family="monospace" font-weight="800" fill="#ef4444">bit 4</text><text x="100" y="92" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">binary → error position</text></svg>`,
    'pureAlohaMin':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="26" text-anchor="middle" font-size="13" font-weight="800" fill="#2dd4bf">S = G·e^(−2G)</text><path d="M 30 80 Q 70 30, 100 45 Q 130 60, 170 80" fill="none" stroke="#2dd4bf" stroke-width="1.8"/><circle cx="100" cy="45" r="4" fill="#facc15"><animate attributeName="r" values="3;6;3" dur="1.4s" repeatCount="indefinite"/></circle><text x="100" y="36" text-anchor="middle" font-size="7" fill="#facc15" font-weight="800">peak 18.4%</text><line x1="30" y1="86" x2="170" y2="86" stroke="#6b7280"/><text x="100" y="96" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">at G = 0.5</text></svg>`,
    'vulnTimeMin':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="26" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">T_vuln = 2 × T_fr</text><line x1="30" y1="60" x2="170" y2="60" stroke="#2dd4bf" stroke-width="2"/><rect x="70" y="48" width="60" height="24" rx="3" fill="#facc15"/><text x="100" y="64" text-anchor="middle" font-size="9" font-weight="800" fill="#000">FRAME</text><line x1="40" y1="42" x2="160" y2="42" stroke="#ef4444" stroke-width="1.4" stroke-dasharray="3 3"/><text x="100" y="36" text-anchor="middle" font-size="8" fill="#ef4444">vulnerable window</text><text x="100" y="90" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">2 × frame time</text></svg>`,
    'minFrameMin':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="26" text-anchor="middle" font-size="12" font-weight="800" fill="#2dd4bf">T_fr ≥ 2 × T_p</text><line x1="30" y1="60" x2="100" y2="60" stroke="#2dd4bf" stroke-width="3"/><text x="65" y="75" text-anchor="middle" font-size="8" fill="#2dd4bf" font-weight="800">T_p</text><line x1="100" y1="60" x2="170" y2="60" stroke="#22c55e" stroke-width="3"/><text x="135" y="75" text-anchor="middle" font-size="8" fill="#22c55e" font-weight="800">T_p</text><circle r="3" fill="#facc15"><animateMotion dur="1.6s" repeatCount="indefinite" path="M 30 60 L 170 60 L 30 60"/></circle><text x="100" y="92" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">64 bytes min @ 10 Mbps</text></svg>`,
    'gbnWinMin':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="26" text-anchor="middle" font-size="13" font-weight="800" fill="#2dd4bf">W = 2^m − 1</text>${[...Array(8)].map((_,i)=>`<rect x="${30+i*18}" y="50" width="14" height="18" rx="3" fill="${i<6?'#facc15':'#111a2e'}" stroke="#2dd4bf"/><text x="${37+i*18}" y="63" text-anchor="middle" font-size="8" font-weight="800" fill="${i<6?'#000':'#fff'}">${i}</text>`).join('')}<text x="100" y="90" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">m=4 → 15</text></svg>`,
    'srWinMin':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="26" text-anchor="middle" font-size="13" font-weight="800" fill="#2dd4bf">W = 2^(m−1)</text>${[...Array(8)].map((_,i)=>`<rect x="${30+i*18}" y="50" width="14" height="18" rx="3" fill="${i<4?'#facc15':'#a78bfa'}" stroke="#2dd4bf"/><text x="${37+i*18}" y="63" text-anchor="middle" font-size="8" font-weight="800" fill="#000">${i}</text>`).join('')}<text x="100" y="90" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">m=4 → 8 send + 8 recv</text></svg>`,
    'parityRuleMin':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="26" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">Even Parity Rule</text>${'100011'.split('').map((b,i)=>`<rect x="${50+i*18}" y="46" width="14" height="18" rx="3" fill="${b==='1'?'#111a2e':'#0f172a'}" stroke="#2dd4bf"/><text x="${57+i*18}" y="60" text-anchor="middle" font-size="9" font-weight="800" fill="${b==='1'?'#2dd4bf':'#6b7280'}">${b}</text>`).join('')}<rect x="${50+6*18}" y="46" width="14" height="18" rx="3" fill="#facc15"/><text x="${57+6*18}" y="60" text-anchor="middle" font-size="9" font-weight="900" fill="#000">1</text><text x="100" y="90" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">makes 1s even</text></svg>`,
    'checksumRuleMin':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="20" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">1's Complement Sum</text><text x="40" y="44" font-size="10" font-family="monospace" fill="#cbd5e1">10011001</text><text x="40" y="60" font-size="10" font-family="monospace" fill="#cbd5e1">11100010</text><text x="40" y="76" font-size="10" font-family="monospace" fill="#facc15">→ 11011010</text><text x="100" y="94" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">end-around carry</text></svg>`,
    'crcRuleMin':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="20" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">CRC = Binary Division</text><text x="20" y="48" font-size="10" font-family="monospace" fill="#a78bfa">gen 1001</text><text x="80" y="48" font-size="10" font-family="monospace" fill="#2dd4bf">│ 1010000</text><text x="80" y="66" font-size="10" font-family="monospace" fill="#facc15">│ ← 011</text><line x1="20" y1="72" x2="180" y2="72" stroke="#facc15" stroke-width="1"/><text x="100" y="92" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">remainder = CRC</text></svg>`,
    'dijkstraRelaxMin':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="20" text-anchor="middle" font-size="10" font-weight="800" fill="#2dd4bf">D(v) = min(D(v), D(u)+w)</text><circle cx="50" cy="55" r="14" fill="#facc15"/><text x="50" y="60" text-anchor="middle" font-size="11" font-weight="900" fill="#000">u</text><circle cx="150" cy="55" r="14" fill="#111a2e" stroke="#2dd4bf"/><text x="150" y="60" text-anchor="middle" font-size="11" font-weight="800" fill="#fff">v</text><line x1="64" y1="55" x2="136" y2="55" stroke="#2dd4bf" stroke-width="2"/><circle r="3" fill="#22c55e"><animateMotion dur="1.4s" repeatCount="indefinite" path="M 64 55 L 136 55"/></circle><text x="100" y="88" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">relax edge</text></svg>`,
    'dvUpdateMin':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="20" text-anchor="middle" font-size="10" font-weight="800" fill="#2dd4bf">D_x(y) = min_v { c + D_v }</text><circle cx="50" cy="55" r="14" fill="#facc15"/><text x="50" y="60" text-anchor="middle" font-size="11" font-weight="900" fill="#000">x</text><circle cx="150" cy="55" r="12" fill="#111a2e" stroke="#2dd4bf"/><text x="150" y="60" text-anchor="middle" font-size="10" font-weight="800" fill="#fff">v</text><line x1="64" y1="55" x2="138" y2="55" stroke="#2dd4bf" stroke-width="2"/><text x="100" y="50" text-anchor="middle" font-size="9" font-weight="800" fill="#2dd4bf">3</text><circle r="3" fill="#22c55e"><animateMotion dur="1.4s" repeatCount="indefinite" path="M 64 55 L 138 55"/></circle><text x="100" y="88" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">take minimum</text></svg>`,
    'hierLevelsMin':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="20" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">optimal levels = ln N</text>${[['flat',720,'#ef4444'],['2-lvl',53,'#facc15'],['3-lvl',25,'#22c55e']].map(([l,v,c],i)=>{const y=42+i*18;return `<text x="20" y="${y+4}" font-size="8" fill="#cbd5e1">${l}</text><rect x="60" y="${y-6}" width="${Math.min(100,v/8)}" height="12" rx="2" fill="${c}" opacity="0.7"/><text x="${63+Math.min(100,v/8)}" y="${y+4}" font-size="8" font-weight="800" fill="${c}">${v}</text>`;}).join('')}<text x="100" y="94" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">sweet spot</text></svg>`,
    'leakyBucketMin':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="20" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">Constant output rate</text><path d="M 60 35 L 140 35 L 130 85 L 70 85 Z" fill="none" stroke="#2dd4bf" stroke-width="1.4"/><path d="M 75 55 L 125 55 L 120 75 L 80 75 Z" fill="rgba(45,212,191,.3)"/><circle cx="90" cy="48" r="3" fill="#facc15"><animate attributeName="cy" values="40;55;40" dur="1.6s" repeatCount="indefinite"/></circle><circle cx="110" cy="48" r="3" fill="#facc15"><animate attributeName="cy" values="40;55;40" dur="1.6s" begin="0.5s" repeatCount="indefinite"/></circle><circle cx="100" cy="90" r="3" fill="#22c55e"><animate attributeName="cy" values="88;98;88" dur="1.4s" repeatCount="indefinite"/></circle><text x="100" y="98" text-anchor="middle" font-size="7" fill="#6b7280">drop excess</text></svg>`,
    'tokenBucketMin':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="20" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">Bucket of tokens · bursts</text><path d="M 60 35 L 140 35 L 130 85 L 70 85 Z" fill="none" stroke="#a78bfa" stroke-width="1.4"/>${[0,1,2,3,4,5].map(i=>`<circle cx="${78+i*10}" cy="${45+(i%3)*15}" r="3" fill="#facc15" opacity="0.9"/>`).join('')}<circle r="3" fill="#22c55e"><animateMotion dur="1.4s" repeatCount="indefinite" path="M 100 88 L 180 88"/></circle><text x="140" y="82" text-anchor="middle" font-size="7" fill="#22c55e">burst</text><text x="100" y="98" text-anchor="middle" font-size="7" fill="#6b7280">ρ = token rate</text></svg>`,
    'dvInfinityMin':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="20" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">∞ ≡ 16 hops (RIP)</text>${[...Array(8)].map((_,i)=>`<rect x="${20+i*20}" y="42" width="16" height="18" rx="3" fill="${i===7?'#ef4444':'#22c55e'}" stroke="${i===7?'#ef4444':'#2dd4bf'}"/><text x="${28+i*20}" y="55" text-anchor="middle" font-size="8" font-weight="800" fill="#fff">${(i+1)*2}</text>`).join('')}<text x="100" y="82" text-anchor="middle" font-size="8" fill="#22c55e">hops 2–14 reachable</text><text x="100" y="94" text-anchor="middle" font-size="8" font-weight="700" fill="#ef4444">16 = ∞</text></svg>`,
    'fTcpWindowMin':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="20" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">W = min(rwnd, cwnd)</text><text x="100" y="48" text-anchor="middle" font-size="12" font-family="monospace" font-weight="800" fill="#facc15">min(8, 4) = 4</text><text x="100" y="78" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">smaller limit wins</text></svg>`,
    'fThroughputMin':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="20" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">Throughput = W / RTT</text><text x="100" y="48" text-anchor="middle" font-size="11" font-family="monospace" font-weight="800" fill="#facc15">64 KB / 0.1 s</text><text x="100" y="72" text-anchor="middle" font-size="11" font-family="monospace" font-weight="800" fill="#22c55e">≈ 640 KB/s</text></svg>`,
    'fSlowStartMin':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="20" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">Slow Start: 2^t</text>${[1,2,4,8].map((v,i)=>`<rect x="${30+i*40}" y="${80-v*6}" width="20" height="${v*6}" rx="2" fill="#facc15" opacity="0.8"/><text x="${40+i*40}" y="${76-v*6}" text-anchor="middle" font-size="8" font-weight="800" fill="#facc15">${v}</text>`).join('')}<text x="100" y="94" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">doubles each RTT</text></svg>`,
    'fAimdMin':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="20" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">AIMD sawtooth</text><polyline points="30,80 70,55 110,40 130,40 150,70 180,55" fill="none" stroke="#22c55e" stroke-width="1.8"/><text x="100" y="94" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">+1 up, ÷2 down</text></svg>`,
    'fUdpLengthMin':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="20" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">Length = 8 + data</text><rect x="40" y="42" width="30" height="20" fill="#facc15"/><text x="55" y="57" text-anchor="middle" font-size="9" font-weight="900" fill="#000">8</text><rect x="72" y="42" width="80" height="20" fill="#a78bfa"/><text x="112" y="57" text-anchor="middle" font-size="9" font-weight="800" fill="#000">data</text><text x="100" y="88" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">max data = 65,507 B</text></svg>`,
    'fTcpHeaderMin':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="20" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">HLEN = bytes / 4</text><text x="100" y="48" text-anchor="middle" font-size="11" font-family="monospace" font-weight="800" fill="#facc15">5 … 15</text><text x="100" y="70" text-anchor="middle" font-size="11" font-family="monospace" font-weight="800" fill="#22c55e">20 … 60 bytes</text><text x="100" y="94" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">counts of 32-bit words</text></svg>`,
    'fDnsLevelsMin':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="20" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">levels ≤ 128</text><rect x="60" y="35" width="80" height="12" rx="3" fill="#facc15"/><rect x="70" y="52" width="60" height="12" rx="3" fill="#111a2e" stroke="#2dd4bf"/><rect x="80" y="69" width="40" height="12" rx="3" fill="#111a2e" stroke="#2dd4bf"/><text x="100" y="94" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">root → TLD → …</text></svg>`,
    'fHttpReqMin':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="20" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">Request line</text><text x="100" y="55" text-anchor="middle" font-size="11" font-family="monospace" font-weight="800" fill="#facc15">GET /path HTTP/1.1</text><text x="100" y="86" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">method · path · version</text></svg>`,
    'fFtpPortsMin':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="20" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">FTP: 21 + 20</text><text x="100" y="48" text-anchor="middle" font-size="11" font-family="monospace" font-weight="800" fill="#2dd4bf">Control = 21</text><text x="100" y="70" text-anchor="middle" font-size="11" font-family="monospace" font-weight="800" fill="#a78bfa">Data = 20</text><text x="100" y="92" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">two channels</text></svg>`,
    'fSmtpPortMin':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="20" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">SMTP ports</text><text x="100" y="48" text-anchor="middle" font-size="11" font-family="monospace" font-weight="800" fill="#2dd4bf">Relay = 25</text><text x="100" y="70" text-anchor="middle" font-size="11" font-family="monospace" font-weight="800" fill="#22c55e">Submit = 587</text><text x="100" y="92" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">push mail</text></svg>`,
    'fTelnetPortMin':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="20" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">TELNET</text><text x="100" y="48" text-anchor="middle" font-size="12" font-family="monospace" font-weight="800" fill="#facc15">port 23</text><text x="100" y="70" text-anchor="middle" font-size="10" font-family="monospace" font-weight="800" fill="#a78bfa">NVT = 7-bit ASCII</text><text x="100" y="92" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">remote login</text></svg>`,
    'fRtpHeaderMin':`<svg viewBox="0 0 200 100" style="width:100%;height:100px"><text x="100" y="18" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">RTP header ≥ 12 bytes</text><rect x="30" y="35" width="140" height="14" rx="3" fill="#facc15"/><text x="100" y="46" text-anchor="middle" font-size="7" font-weight="800" fill="#000">flags · seq · ts · ssrc</text><text x="100" y="72" text-anchor="middle" font-size="11" font-weight="800" fill="#facc15">3 × 4 = 12 bytes</text><text x="100" y="92" text-anchor="middle" font-size="8" font-weight="700" fill="#22c55e">+ optional CSRC</text></svg>`
  };

  /* Legacy aliases: these mini keys predate the map above and are still
     referenced by questions in data-topics.js. Each one maps to a
     standalone svg*() generator that already exists in this file but was
     never reachable from the dispatcher, so those questions were falling
     through to the blank "Q" placeholder. */
  const legacy = {
    'two-nodes': svgTwoNodes, 'nodes': svgNodes, 'office': svgOfficeShare,
    'phishing': svgPhishing, 'simplex': svgSimplex, 'halfduplex': svgHalfDuplex,
    'criteria': svgCriteria, 'meshcount': svgMeshCount, 'starpof': svgStarSPOF,
    'terminator': svgBusTerminator, 'ringbreak': svgRingBreak, 'hybrid': svgHybrid,
    'fibermini': svgFiberMini, 'coaxmini': svgCoaxMini,
    'radiomini': svgRadioMini, 'fiberemi': svgFiberEMI
  };
  if (typeof legacy[type] === 'function') return legacy[type]();

  /* Last resort so a typo or a new topic never shows a bare "Q" box —
     draw something honest instead of an empty frame. */
  const label = String(type || 'concept').replace(/[^a-z0-9 _-]/gi, '').slice(0, 22);
  return map[type] || `<svg viewBox="0 0 200 100" style="width:100%;height:100px" role="img" aria-label="${label}">
    <rect x="16" y="22" width="168" height="48" rx="9" fill="#111a2e" stroke="#2dd4bf" stroke-width="1.4"/>
    <circle cx="38" cy="46" r="7" fill="none" stroke="#a78bfa" stroke-width="1.6"><animate attributeName="r" values="6;9;6" dur="2.2s" repeatCount="indefinite"/></circle>
    <circle cx="162" cy="46" r="7" fill="none" stroke="#22c55e" stroke-width="1.6"><animate attributeName="r" values="6;9;6" dur="2.2s" begin="1.1s" repeatCount="indefinite"/></circle>
    <line x1="45" y1="46" x2="155" y2="46" stroke="#2dd4bf" stroke-width="1.6"/>
    <circle r="2.8" fill="#facc15"><animateMotion dur="1.7s" repeatCount="indefinite" path="M 45 46 L 155 46"/></circle>
    <text x="100" y="90" text-anchor="middle" font-size="8" font-weight="700" fill="#94a3b8">${label}</text></svg>`;
}

/* Expose all SVG functions via window.XC.SVG */
window.XC.SVG = {
  meshSVG, starSVG, busSVG, ringSVG, hybridSVG, compareSVG,
  twistedPairSVG, coaxialSVG, fiberSVG, radioSVG, microwaveSVG, infraredSVG,
  charCountSVG, byteStuffSVG, bitStuffSVG, physicalCodingSVG,
  paritySVG, parity2DSVG, checksumSVG, crcSVG,
  swTimelineSVG, alohaTimelineSVG,
  nlIssuesSVG, dijkstraSVG, dvSVG, lsSVG, hierarchicalSVG, congestionSVG,
  tpServicesSVG, tcpSegmentSVG, tcpHandshakeSVG, tcpWindowSVG, tcpCongestionSVG, udpDatagramSVG,
  dnsSVG, wwwHttpSVG, ftpSVG, smtpSVG, telnetSVG, rtpSVG,
  miniSvg,
  svgTwoNodes, svgNodes, svgOfficeShare, svgPhishing,
  svgSimplex, svgHalfDuplex, svgCriteria, svgMeshCount, svgStarSPOF, svgBusTerminator,
  svgRingBreak, svgHybrid, svgFiberMini, svgCoaxMini, svgRadioMini, svgFiberEMI
};

console.log('Data loaded: SVG functions =', Object.keys(window.XC.SVG).length);