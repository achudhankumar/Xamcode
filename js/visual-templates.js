/* ============================================================
   VISUAL TEMPLATE REGISTRY & SVG ENGINE — Comprehensive Pack
   Exposes: window.XC.renderVisualSvg, window.XC.VISUAL_TEMPLATES
   Theme-aware, responsive SVG generators driven strictly by parameters.
   Eliminates raw AI-generated SVG and UI code.
   ============================================================ */
(function() {
  'use strict';
  window.XC = window.XC || {};

  function escapeSvg(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderProcessFlow(visual, stepIdx) {
    const steps = visual.steps || [];
    const active = Math.min(Math.max(0, stepIdx || 0), Math.max(0, steps.length - 1));
    const curStep = steps[active] || { title: 'Process Step', desc: '' };
    const width = 500, height = 240;
    const nodeCount = Math.min(Math.max(steps.length, 3), 5);
    const startX = 60, endX = 440;
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

  function renderTopology(visual, stepIdx) {
    const steps = visual.steps || [];
    const active = Math.min(Math.max(0, stepIdx || 0), Math.max(0, steps.length - 1));
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

  function renderPacketFlow(visual, stepIdx) {
    const steps = visual.steps || [];
    const active = Math.min(Math.max(0, stepIdx || 0), Math.max(0, steps.length - 1));
    const curStep = steps[active] || { title: 'Packet Flow', desc: '' };
    const sx = 80, sy = 100, rx = 420, ry = 100;
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

  function renderSlidingWindow(visual, stepIdx) {
    const steps = visual.steps || [];
    const active = Math.min(Math.max(0, stepIdx || 0), Math.max(0, steps.length - 1));
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

      function renderVisualSvg(visual, stepIdx) {
    if (!visual || typeof visual !== 'object') {
      return renderProcessFlow({ steps: [{ title: 'Overview', desc: '' }] }, 0);
    }

    const type = visual.type || 'flow';

    // If custom AI nodes or layout archetype are provided, use dynamic aiDiagramSvg
    if (window.XC?.aiDiagramSvg && (visual.nodes || (visual.steps && visual.steps[stepIdx]?.nodes) || !['topology', 'packet_flow', 'sliding_window'].includes(type))) {
      const steps = visual.steps || [{ title: visual.title || 'Overview', desc: '' }];
      const activeIdx = Math.min(Math.max(0, stepIdx || 0), steps.length - 1);
      const curStep = steps[activeIdx] || steps[0] || {};
      const nodes = curStep.nodes || visual.nodes || [
        { label: String(curStep.title || visual.title || 'Core Step').slice(0, 20), detail: String(curStep.desc || curStep.description || 'Process phase').slice(0, 38) },
        { label: 'Transition', detail: 'State verification & transfer' },
        { label: 'Validated Output', detail: 'Asserted boundary state' }
      ];
      try {
        return window.XC.aiDiagramSvg({
          title: curStep.title || visual.title || 'Visual Model',
          description: curStep.desc || curStep.description || '',
          layout: curStep.layout || type || 'flow',
          nodes: nodes
        }, 0, activeIdx, visual.title || 'Concept');
      } catch (err) {
        // Fall back to process flow below if dynamic diagram fails
      }
    }

    switch (type) {
      case 'topology':
        return renderTopology(visual, stepIdx);
      case 'packet_flow':
        return renderPacketFlow(visual, stepIdx);
      case 'sliding_window':
        return renderSlidingWindow(visual, stepIdx);
      case 'process_flow':
      default:
        return renderProcessFlow(visual, stepIdx);
    }
  }

  window.XC.renderVisualSvg = renderVisualSvg;
  window.XC.VISUAL_TEMPLATES = {
    renderProcessFlow,
    renderTopology,
    renderPacketFlow,
    renderSlidingWindow
  };
})();
