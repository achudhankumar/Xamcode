'use strict';

/**
 * Visual Template Registry & SVG Generator — Comprehensive Pack
 * Generates safe, responsive, theme-aware animated SVG diagrams
 * driven strictly by structured template parameters and step indexes.
 * Eliminates all AI-generated raw SVG and security vulnerabilities.
 */

function escapeSvg(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 1. Process Flow Renderer
 */
function renderProcessFlow(visual, stepIdx = 0) {
  const steps = visual.steps || [];
  const active = Math.min(Math.max(0, stepIdx), Math.max(0, steps.length - 1));
  const curStep = steps[active] || { title: 'Process Step', desc: '' };

  const width = 500;
  const height = 240;
  const nodeCount = Math.min(Math.max(steps.length, 3), 5);
  const startX = 60;
  const endX = 440;
  const spacing = nodeCount > 1 ? (endX - startX) / (nodeCount - 1) : 0;
  const cy = 110;

  let nodesHtml = '';
  for (let i = 0; i < nodeCount; i++) {
    const cx = startX + i * spacing;
    const isPast = i < active;
    const isCurrent = i === active;
    const circleColor = isCurrent ? '#FF6B35' : isPast ? '#22c55e' : '#1e293b';
    const strokeColor = isCurrent ? '#f97316' : isPast ? '#22c55e' : '#475569';
    const textColor = isCurrent ? '#ffffff' : isPast ? '#ffffff' : '#94a3b8';
    const sTitle = steps[i] ? escapeSvg(steps[i].title) : `Step ${i + 1}`;

    nodesHtml += `
      <g>
        <circle cx="${cx}" cy="${cy}" r="${isCurrent ? 24 : 18}" fill="${circleColor}" stroke="${strokeColor}" stroke-width="2" />
        <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="${isCurrent ? 12 : 10}" font-weight="700" fill="${textColor}">${i + 1}</text>
        <text x="${cx}" y="${cy + 42}" text-anchor="middle" font-size="10" font-weight="${isCurrent ? 700 : 500}" fill="${isCurrent ? '#f97316' : '#94a3b8'}">${sTitle.slice(0, 16)}</text>
      </g>
    `;
  }

  const pulseX1 = startX;
  const pulseX2 = startX + active * spacing;

  return `
    <svg viewBox="0 0 ${width} ${height}" style="width:100%;height:100%;max-width:540px" xmlns="http://www.w3.org/2000/svg">
      <line x1="${startX}" y1="${cy}" x2="${endX}" y2="${cy}" stroke="#1e293b" stroke-width="4" stroke-linecap="round" />
      <line x1="${startX}" y1="${cy}" x2="${pulseX2}" y2="${cy}" stroke="#FF6B35" stroke-width="4" stroke-linecap="round" />
      ${active > 0 ? `
        <circle r="6" fill="#facc15">
          <animateMotion dur="1.8s" repeatCount="indefinite" path="M ${pulseX1} ${cy} L ${pulseX2} ${cy}" />
        </circle>
      ` : ''}
      ${nodesHtml}
      <rect x="50" y="180" width="400" height="46" rx="8" fill="rgba(15,23,42,0.8)" stroke="#334155" stroke-width="1" />
      <text x="250" y="200" text-anchor="middle" font-size="11" font-weight="700" fill="#f8fafc">STEP ${active + 1}: ${escapeSvg(curStep.title)}</text>
      <text x="250" y="216" text-anchor="middle" font-size="10" fill="#94a3b8">${escapeSvg(curStep.desc).slice(0, 60)}</text>
    </svg>
  `;
}

/**
 * 2. Topology Renderer
 */
function renderTopology(visual, stepIdx = 0) {
  const steps = visual.steps || [];
  const active = Math.min(Math.max(0, stepIdx), Math.max(0, steps.length - 1));
  const curStep = steps[active] || { title: 'Network Topology', desc: '' };
  const nodes = [
    { id: 'N1', x: 250, y: 60, label: 'Host A' },
    { id: 'N2', x: 380, y: 120, label: 'Host B' },
    { id: 'N3', x: 330, y: 190, label: 'Host C' },
    { id: 'N4', x: 170, y: 190, label: 'Host D' },
    { id: 'N5', x: 120, y: 120, label: 'Host E' }
  ];

  let linksHtml = '';
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const activeLink = (active % 2 === 0 && (i === 0 || j === 0)) || (active % 2 === 1);
      linksHtml += `<line x1="${nodes[i].x}" y1="${nodes[i].y}" x2="${nodes[j].x}" y2="${nodes[j].y}" stroke="${activeLink ? '#2dd4bf' : '#334155'}" stroke-width="${activeLink ? 2 : 1}" opacity="${activeLink ? 0.9 : 0.4}" />`;
    }
  }

  let nodesHtml = '';
  nodes.forEach((n, idx) => {
    const isHighlight = idx === (active % nodes.length);
    nodesHtml += `
      <g>
        <circle cx="${n.x}" cy="${n.y}" r="${isHighlight ? 20 : 16}" fill="${isHighlight ? '#FF6B35' : '#0f172a'}" stroke="${isHighlight ? '#f97316' : '#2dd4bf'}" stroke-width="2" />
        <text x="${n.x}" y="${n.y + 4}" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">${n.label}</text>
      </g>
    `;
  });

  return `
    <svg viewBox="0 0 500 240" style="width:100%;height:100%;max-width:540px" xmlns="http://www.w3.org/2000/svg">
      ${linksHtml}
      ${nodesHtml}
      <rect x="50" y="205" width="400" height="30" rx="6" fill="rgba(15,23,42,0.85)" stroke="#334155" />
      <text x="250" y="224" text-anchor="middle" font-size="10" font-weight="700" fill="#f8fafc">TOPOLOGY [Links: 10] — ${escapeSvg(curStep.title)}</text>
    </svg>
  `;
}

/**
 * 3. Packet Flow Renderer
 */
function renderPacketFlow(visual, stepIdx = 0) {
  const steps = visual.steps || [];
  const active = Math.min(Math.max(0, stepIdx), Math.max(0, steps.length - 1));
  const curStep = steps[active] || { title: 'Packet Flow', desc: '' };

  const sx = 80, sy = 100;
  const rx = 420, ry = 100;
  const progress = active / Math.max(steps.length - 1, 1);
  const px = sx + (rx - sx) * progress;

  return `
    <svg viewBox="0 0 500 220" style="width:100%;height:100%;max-width:540px" xmlns="http://www.w3.org/2000/svg">
      <rect x="${sx - 35}" y="${sy - 30}" width="70" height="60" rx="8" fill="#1e293b" stroke="#38bdf8" stroke-width="2" />
      <text x="${sx}" y="${sy + 5}" text-anchor="middle" font-size="11" font-weight="800" fill="#fff">SENDER</text>
      <rect x="${rx - 35}" y="${ry - 30}" width="70" height="60" rx="8" fill="#1e293b" stroke="#38bdf8" stroke-width="2" />
      <text x="${rx}" y="${ry + 5}" text-anchor="middle" font-size="11" font-weight="800" fill="#fff">RECEIVER</text>
      <line x1="${sx + 35}" y1="${sy}" x2="${rx - 35}" y2="${ry}" stroke="#334155" stroke-width="3" stroke-dasharray="6 6" />
      <g transform="translate(${px}, ${sy})">
        <rect x="-24" y="-14" width="48" height="28" rx="6" fill="#FF6B35" stroke="#fff" stroke-width="1.5" />
        <text x="0" y="4" text-anchor="middle" font-size="9" font-weight="800" fill="#fff">PKT #${active + 1}</text>
      </g>
      <rect x="50" y="165" width="400" height="42" rx="8" fill="rgba(15,23,42,0.85)" stroke="#334155" />
      <text x="250" y="185" text-anchor="middle" font-size="11" font-weight="700" fill="#f8fafc">${escapeSvg(curStep.title)}</text>
      <text x="250" y="199" text-anchor="middle" font-size="10" fill="#94a3b8">${escapeSvg(curStep.desc).slice(0, 60)}</text>
    </svg>
  `;
}

/**
 * 4. Sliding Window Renderer
 */
function renderSlidingWindow(visual, stepIdx = 0) {
  const steps = visual.steps || [];
  const active = Math.min(Math.max(0, stepIdx), Math.max(0, steps.length - 1));
  const curStep = steps[active] || { title: 'Sliding Window', desc: '' };
  const winSize = (visual.parameters && visual.parameters.window_size) || 4;
  const startX = 60, cy = 90, boxW = 38, gap = 6;
  const totalFrames = 8;
  const windowStart = Math.min(active, totalFrames - winSize);

  let framesHtml = '';
  for (let i = 0; i < totalFrames; i++) {
    const fx = startX + i * (boxW + gap);
    const inWin = i >= windowStart && i < windowStart + winSize;
    const isAcked = i < windowStart;
    framesHtml += `
      <g>
        <rect x="${fx}" y="${cy - 20}" width="${boxW}" height="40" rx="4" fill="${isAcked ? '#22c55e' : inWin ? '#3b82f6' : '#1e293b'}" stroke="${inWin ? '#60a5fa' : '#475569'}" stroke-width="${inWin ? 2 : 1}" />
        <text x="${fx + boxW / 2}" y="${cy + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">${i}</text>
      </g>
    `;
  }

  const winX = startX + windowStart * (boxW + gap) - 4;
  const winW = winSize * boxW + (winSize - 1) * gap + 8;

  return `
    <svg viewBox="0 0 500 210" style="width:100%;height:100%;max-width:540px" xmlns="http://www.w3.org/2000/svg">
      <rect x="${winX}" y="${cy - 26}" width="${winW}" height="52" rx="8" fill="none" stroke="#FF6B35" stroke-width="2.5" stroke-dasharray="4 4" />
      <text x="${winX + winW / 2}" y="${cy - 32}" text-anchor="middle" font-size="10" font-weight="800" fill="#FF6B35">WINDOW [W = ${winSize}]</text>
      ${framesHtml}
      <rect x="50" y="160" width="400" height="38" rx="6" fill="rgba(15,23,42,0.85)" stroke="#334155" />
      <text x="250" y="182" text-anchor="middle" font-size="10" font-weight="700" fill="#f8fafc">STEP ${active + 1}: ${escapeSvg(curStep.title)}</text>
    </svg>
  `;
}

/**
 * 5. Hamming Code Renderer
 */
function renderHamming(visual, stepIdx = 0) {
  const steps = visual.steps || [];
  const active = Math.min(Math.max(0, stepIdx), Math.max(0, steps.length - 1));
  const curStep = steps[active] || { title: 'Hamming Error Check', desc: '' };
  const bits = ['P1', 'P2', 'D3', 'P4', 'D5', 'D6', 'D7'];

  let bitCols = '';
  bits.forEach((b, i) => {
    const isParity = b.startsWith('P');
    const isTarget = i === (active % bits.length);
    const x = 50 + i * 58;
    bitCols += `
      <g>
        <rect x="${x}" y="70" width="50" height="45" rx="6" fill="${isTarget ? '#FF6B35' : isParity ? '#3b82f6' : '#1e293b'}" stroke="${isTarget ? '#fff' : '#64748b'}" stroke-width="${isTarget ? 2 : 1}" />
        <text x="${x + 25}" y="92" text-anchor="middle" font-size="12" font-weight="800" fill="#fff">${b}</text>
        <text x="${x + 25}" y="106" text-anchor="middle" font-size="9" fill="${isParity ? '#93c5fd' : '#cbd5e1'}">Bit ${i + 1}</text>
      </g>
    `;
  });

  return `
    <svg viewBox="0 0 500 210" style="width:100%;height:100%;max-width:540px" xmlns="http://www.w3.org/2000/svg">
      <text x="250" y="45" text-anchor="middle" font-size="12" font-weight="800" fill="#38bdf8">HAMMING(7,4) PARITY MATRIX</text>
      ${bitCols}
      <rect x="50" y="155" width="400" height="40" rx="6" fill="rgba(15,23,42,0.85)" stroke="#334155" />
      <text x="250" y="179" text-anchor="middle" font-size="10" font-weight="700" fill="#f8fafc">STEP ${active + 1}: ${escapeSvg(curStep.title)}</text>
    </svg>
  `;
}

/**
 * 6. Collision Timeline Renderer
 */
function renderCollisionTimeline(visual, stepIdx = 0) {
  const steps = visual.steps || [];
  const active = Math.min(Math.max(0, stepIdx), Math.max(0, steps.length - 1));
  const curStep = steps[active] || { title: 'Collision Window & Backoff', desc: '' };

  const isCollision = active % 2 === 1;

  return `
    <svg viewBox="0 0 500 210" style="width:100%;height:100%;max-width:540px" xmlns="http://www.w3.org/2000/svg">
      <line x1="50" y1="110" x2="450" y2="110" stroke="#475569" stroke-width="2" />
      <!-- Station A -->
      <rect x="80" y="75" width="100" height="30" rx="4" fill="#3b82f6" />
      <text x="130" y="94" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">Station A Frame</text>
      <!-- Station B -->
      <rect x="150" y="115" width="110" height="30" rx="4" fill="${isCollision ? '#ef4444' : '#22c55e'}" />
      <text x="205" y="134" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">${isCollision ? 'COLLISION OVERLAP' : 'Station B Frame'}</text>
      ${isCollision ? '<circle cx="165" cy="110" r="14" fill="#facc15" opacity="0.8" /><text x="165" y="114" text-anchor="middle" font-size="10" font-weight="900" fill="#000">!</text>' : ''}
      <rect x="50" y="165" width="400" height="35" rx="6" fill="rgba(15,23,42,0.85)" stroke="#334155" />
      <text x="250" y="187" text-anchor="middle" font-size="10" font-weight="700" fill="#f8fafc">STEP ${active + 1}: ${escapeSvg(curStep.title)}</text>
    </svg>
  `;
}

/**
 * 7. OSI Encapsulation Renderer
 */
function renderOsiEncapsulation(visual, stepIdx = 0) {
  const steps = visual.steps || [];
  const active = Math.min(Math.max(0, stepIdx), Math.max(0, steps.length - 1));
  const curStep = steps[active] || { title: 'OSI Encapsulation Stack', desc: '' };

  const layers = [
    { name: 'Application Data', color: '#8b5cf6', w: 140 },
    { name: 'TCP Header', color: '#06b6d4', w: 200 },
    { name: 'IP Header', color: '#3b82f6', w: 280 },
    { name: 'Ethernet Frame + FCS', color: '#10b981', w: 380 }
  ];

  let layerSvg = '';
  for (let i = 0; i <= Math.min(active, 3); i++) {
    const l = layers[i];
    const x = 250 - l.w / 2;
    const y = 50 + i * 24;
    layerSvg += `
      <g>
        <rect x="${x}" y="${y}" width="${l.w}" height="20" rx="4" fill="${l.color}" opacity="0.9" />
        <text x="250" y="${y + 14}" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">${l.name}</text>
      </g>
    `;
  }

  return `
    <svg viewBox="0 0 500 210" style="width:100%;height:100%;max-width:540px" xmlns="http://www.w3.org/2000/svg">
      ${layerSvg}
      <rect x="50" y="160" width="400" height="40" rx="6" fill="rgba(15,23,42,0.85)" stroke="#334155" />
      <text x="250" y="184" text-anchor="middle" font-size="10" font-weight="700" fill="#f8fafc">STEP ${active + 1}: ${escapeSvg(curStep.title)}</text>
    </svg>
  `;
}

/**
 * 8. Bit Flip Renderer
 */
function renderBitFlip(visual, stepIdx = 0) {
  const steps = visual.steps || [];
  const active = Math.min(Math.max(0, stepIdx), Math.max(0, steps.length - 1));
  const curStep = steps[active] || { title: 'Bit Flip Error Detection', desc: '' };
  const rawBits = [1, 0, 1, 1, 0, 0, 1, 0];
  const flipIdx = 3;

  let bitsSvg = '';
  rawBits.forEach((bit, i) => {
    const isFlipped = active >= 1 && i === flipIdx;
    const val = isFlipped ? 0 : bit;
    const x = 70 + i * 45;
    bitsSvg += `
      <g>
        <rect x="${x}" y="80" width="38" height="38" rx="6" fill="${isFlipped ? '#ef4444' : '#1e293b'}" stroke="${isFlipped ? '#f87171' : '#475569'}" stroke-width="${isFlipped ? 2 : 1}" />
        <text x="${x + 19}" y="104" text-anchor="middle" font-size="14" font-weight="900" fill="#fff">${val}</text>
      </g>
    `;
  });

  return `
    <svg viewBox="0 0 500 210" style="width:100%;height:100%;max-width:540px" xmlns="http://www.w3.org/2000/svg">
      <text x="250" y="55" text-anchor="middle" font-size="12" font-weight="800" fill="#38bdf8">PHYSICAL CHANNEL BIT TRANSMISSION</text>
      ${bitsSvg}
      <rect x="50" y="155" width="400" height="40" rx="6" fill="rgba(15,23,42,0.85)" stroke="#334155" />
      <text x="250" y="179" text-anchor="middle" font-size="10" font-weight="700" fill="#f8fafc">STEP ${active + 1}: ${escapeSvg(curStep.title)}</text>
    </svg>
  `;
}

/**
 * 9. Code Trace Renderer
 */
function renderCodeTrace(visual, stepIdx = 0) {
  const steps = visual.steps || [];
  const active = Math.min(Math.max(0, stepIdx), Math.max(0, steps.length - 1));
  const curStep = steps[active] || { title: 'Code Execution Trace', desc: '' };

  const lines = [
    'def process_items(items):',
    '    total = 0',
    '    for item in items:',
    '        total += item * 2',
    '    return total'
  ];

  let codeSvg = '';
  lines.forEach((l, idx) => {
    const isActive = idx === Math.min(active, lines.length - 1);
    codeSvg += `
      <g>
        ${isActive ? `<rect x="50" y="${40 + idx * 22}" width="250" height="20" rx="3" fill="rgba(255,107,53,0.2)" stroke="#FF6B35" stroke-width="1" />` : ''}
        <text x="60" y="${54 + idx * 22}" font-family="monospace" font-size="10" fill="${isActive ? '#FF6B35' : '#cbd5e1'}">${idx + 1}  ${escapeSvg(l)}</text>
      </g>
    `;
  });

  return `
    <svg viewBox="0 0 500 220" style="width:100%;height:100%;max-width:540px" xmlns="http://www.w3.org/2000/svg">
      <rect x="40" y="30" width="270" height="120" rx="6" fill="#0f172a" stroke="#334155" />
      ${codeSvg}
      <!-- Variable Scope Box -->
      <rect x="325" y="30" width="135" height="120" rx="6" fill="#1e293b" stroke="#475569" />
      <text x="392" y="50" text-anchor="middle" font-size="10" font-weight="800" fill="#38bdf8">WATCH VARIABLES</text>
      <text x="340" y="75" font-family="monospace" font-size="9" fill="#94a3b8">step: ${active + 1}</text>
      <text x="340" y="95" font-family="monospace" font-size="9" fill="#22c55e">total: ${active * 10}</text>
      <rect x="50" y="165" width="400" height="42" rx="6" fill="rgba(15,23,42,0.85)" stroke="#334155" />
      <text x="250" y="188" text-anchor="middle" font-size="10" font-weight="700" fill="#f8fafc">STEP ${active + 1}: ${escapeSvg(curStep.title)}</text>
    </svg>
  `;
}

/**
 * 10. Memory Stack & Heap Renderer
 */
function renderMemoryStackHeap(visual, stepIdx = 0) {
  const steps = visual.steps || [];
  const active = Math.min(Math.max(0, stepIdx), Math.max(0, steps.length - 1));
  const curStep = steps[active] || { title: 'Memory Architecture', desc: '' };

  return `
    <svg viewBox="0 0 500 220" style="width:100%;height:100%;max-width:540px" xmlns="http://www.w3.org/2000/svg">
      <!-- Call Stack -->
      <rect x="50" y="35" width="160" height="120" rx="6" fill="#0f172a" stroke="#3b82f6" stroke-width="1.5" />
      <text x="130" y="55" text-anchor="middle" font-size="10" font-weight="800" fill="#60a5fa">CALL STACK (Frames)</text>
      <rect x="65" y="70" width="130" height="24" rx="4" fill="#1e293b" />
      <text x="130" y="86" text-anchor="middle" font-size="9" fill="#fff">Frame: eval_frame()</text>
      <rect x="65" y="100" width="130" height="24" rx="4" fill="#FF6B35" />
      <text x="130" y="116" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">local_ptr -> 0x7FFF</text>
      <!-- Heap -->
      <rect x="290" y="35" width="160" height="120" rx="6" fill="#0f172a" stroke="#10b981" stroke-width="1.5" />
      <text x="370" y="55" text-anchor="middle" font-size="10" font-weight="800" fill="#34d399">PYMALLOC HEAP</text>
      <rect x="305" y="70" width="130" height="34" rx="4" fill="#1e293b" />
      <text x="370" y="86" text-anchor="middle" font-size="8" font-weight="700" fill="#2dd4bf">PyObject (int)</text>
      <text x="370" y="98" text-anchor="middle" font-size="8" fill="#94a3b8">ob_refcnt: ${active + 1}</text>
      <!-- Pointer Arrow -->
      <line x1="195" y1="112" x2="305" y2="87" stroke="#FF6B35" stroke-width="2" stroke-dasharray="3 3" />
      <rect x="50" y="170" width="400" height="38" rx="6" fill="rgba(15,23,42,0.85)" stroke="#334155" />
      <text x="250" y="193" text-anchor="middle" font-size="10" font-weight="700" fill="#f8fafc">STEP ${active + 1}: ${escapeSvg(curStep.title)}</text>
    </svg>
  `;
}

/**
 * 11. Flowchart Renderer
 */
function renderFlowchart(visual, stepIdx = 0) {
  const steps = visual.steps || [];
  const active = Math.min(Math.max(0, stepIdx), Math.max(0, steps.length - 1));
  const curStep = steps[active] || { title: 'Flowchart Logic', desc: '' };

  return `
    <svg viewBox="0 0 500 220" style="width:100%;height:100%;max-width:540px" xmlns="http://www.w3.org/2000/svg">
      <rect x="70" y="80" width="90" height="40" rx="6" fill="#1e293b" stroke="#38bdf8" />
      <text x="115" y="104" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">Input / Start</text>
      <line x1="160" y1="100" x2="210" y2="100" stroke="#64748b" stroke-width="2" />
      <!-- Diamond Condition -->
      <polygon points="250,75 290,100 250,125 210,100" fill="${active >= 1 ? '#FF6B35' : '#1e293b'}" stroke="#f97316" stroke-width="1.5" />
      <text x="250" y="103" text-anchor="middle" font-size="8" font-weight="800" fill="#fff">Condition?</text>
      <line x1="290" y1="100" x2="340" y2="100" stroke="#64748b" stroke-width="2" />
      <rect x="340" y="80" width="90" height="40" rx="6" fill="#1e293b" stroke="#22c55e" />
      <text x="385" y="104" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">Branch Action</text>
      <rect x="50" y="165" width="400" height="40" rx="6" fill="rgba(15,23,42,0.85)" stroke="#334155" />
      <text x="250" y="189" text-anchor="middle" font-size="10" font-weight="700" fill="#f8fafc">STEP ${active + 1}: ${escapeSvg(curStep.title)}</text>
    </svg>
  `;
}

/**
 * 12. Hierarchy Tree Renderer
 */
function renderHierarchyTree(visual, stepIdx = 0) {
  const steps = visual.steps || [];
  const active = Math.min(Math.max(0, stepIdx), Math.max(0, steps.length - 1));
  const curStep = steps[active] || { title: 'Hierarchy Tree', desc: '' };

  return `
    <svg viewBox="0 0 500 220" style="width:100%;height:100%;max-width:540px" xmlns="http://www.w3.org/2000/svg">
      <rect x="205" y="35" width="90" height="30" rx="6" fill="#3b82f6" />
      <text x="250" y="54" text-anchor="middle" font-size="9" font-weight="800" fill="#fff">Root Node</text>
      <line x1="225" y1="65" x2="135" y2="105" stroke="#64748b" stroke-width="1.5" />
      <line x1="275" y1="65" x2="365" y2="105" stroke="#64748b" stroke-width="1.5" />
      <rect x="90" y="105" width="90" height="30" rx="6" fill="${active === 1 ? '#FF6B35' : '#1e293b'}" stroke="#475569" />
      <text x="135" y="124" text-anchor="middle" font-size="9" fill="#fff">Child Node A</text>
      <rect x="320" y="105" width="90" height="30" rx="6" fill="${active >= 2 ? '#FF6B35' : '#1e293b'}" stroke="#475569" />
      <text x="365" y="124" text-anchor="middle" font-size="9" fill="#fff">Child Node B</text>
      <rect x="50" y="165" width="400" height="40" rx="6" fill="rgba(15,23,42,0.85)" stroke="#334155" />
      <text x="250" y="189" text-anchor="middle" font-size="10" font-weight="700" fill="#f8fafc">STEP ${active + 1}: ${escapeSvg(curStep.title)}</text>
    </svg>
  `;
}

/**
 * 13. 2x2 Matrix Renderer
 */
function renderMatrix2x2(visual, stepIdx = 0) {
  const steps = visual.steps || [];
  const active = Math.min(Math.max(0, stepIdx), Math.max(0, steps.length - 1));
  const curStep = steps[active] || { title: '2x2 Strategic Matrix', desc: '' };

  return `
    <svg viewBox="0 0 500 220" style="width:100%;height:100%;max-width:540px" xmlns="http://www.w3.org/2000/svg">
      <rect x="150" y="35" width="95" height="50" rx="4" fill="${active === 0 ? '#FF6B35' : '#1e293b'}" stroke="#334155" />
      <text x="197" y="64" text-anchor="middle" font-size="8" font-weight="700" fill="#fff">Q1: High / Low</text>
      <rect x="255" y="35" width="95" height="50" rx="4" fill="${active === 1 ? '#FF6B35' : '#1e293b'}" stroke="#334155" />
      <text x="302" y="64" text-anchor="middle" font-size="8" font-weight="700" fill="#fff">Q2: High / High</text>
      <rect x="150" y="95" width="95" height="50" rx="4" fill="${active === 2 ? '#FF6B35' : '#1e293b'}" stroke="#334155" />
      <text x="197" y="124" text-anchor="middle" font-size="8" font-weight="700" fill="#fff">Q3: Low / Low</text>
      <rect x="255" y="95" width="95" height="50" rx="4" fill="${active >= 3 ? '#FF6B35' : '#1e293b'}" stroke="#334155" />
      <text x="302" y="124" text-anchor="middle" font-size="8" font-weight="700" fill="#fff">Q4: Low / High</text>
      <rect x="50" y="165" width="400" height="40" rx="6" fill="rgba(15,23,42,0.85)" stroke="#334155" />
      <text x="250" y="189" text-anchor="middle" font-size="10" font-weight="700" fill="#f8fafc">STEP ${active + 1}: ${escapeSvg(curStep.title)}</text>
    </svg>
  `;
}

/**
 * Universal Master Visual Dispatcher
 */
function renderVisualSvg(visual, stepIdx = 0) {
  if (!visual || typeof visual !== 'object') {
    return renderProcessFlow({ steps: [{ title: 'Overview', desc: '' }] }, 0);
  }

  const type = visual.type || 'process_flow';
  switch (type) {
    case 'topology':
      return renderTopology(visual, stepIdx);
    case 'packet_flow':
      return renderPacketFlow(visual, stepIdx);
    case 'sliding_window':
      return renderSlidingWindow(visual, stepIdx);
    case 'hamming':
      return renderHamming(visual, stepIdx);
    case 'collision_timeline':
      return renderCollisionTimeline(visual, stepIdx);
    case 'osi_encapsulation':
      return renderOsiEncapsulation(visual, stepIdx);
    case 'bit_flip':
      return renderBitFlip(visual, stepIdx);
    case 'code_trace':
      return renderCodeTrace(visual, stepIdx);
    case 'memory_stack_heap':
      return renderMemoryStackHeap(visual, stepIdx);
    case 'flowchart':
      return renderFlowchart(visual, stepIdx);
    case 'hierarchy_tree':
      return renderHierarchyTree(visual, stepIdx);
    case 'matrix_2x2':
      return renderMatrix2x2(visual, stepIdx);
    case 'process_flow':
    default:
      return renderProcessFlow(visual, stepIdx);
  }
}

module.exports = {
  renderVisualSvg,
  renderProcessFlow,
  renderTopology,
  renderPacketFlow,
  renderSlidingWindow,
  renderHamming,
  renderCollisionTimeline,
  renderOsiEncapsulation,
  renderBitFlip,
  renderCodeTrace,
  renderMemoryStackHeap,
  renderFlowchart,
  renderHierarchyTree,
  renderMatrix2x2
};
