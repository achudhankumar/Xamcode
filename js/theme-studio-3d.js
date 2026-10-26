/**
 * js/theme-studio-3d.js
 * Browser 3D Experience Themes & Interactive Spatial Canvas Engine for XamCode AI v2.0
 */

window.XAMCODE_3D_THEMES = {
  'quantum-holo': {
    name: 'Quantum Holo-Deck 3D',
    badge: 'FLAGSHIP 3D',
    bgPrimary: '#040611',
    bgElevated: 'rgba(12, 19, 44, 0.76)',
    accentPrimary: '#00F0FF',
    accentSecondary: '#FF2A85',
    accentGlow: 'rgba(0, 240, 255, 0.28)',
    gridColor: 'rgba(0, 240, 255, 0.10)',
    perspectivePx: 1200
  },
  'cyber-vaathiyar': {
    name: 'Cyber-Vaathiyar Neon Grid',
    badge: 'VIBE CODING',
    bgPrimary: '#090314',
    bgElevated: 'rgba(26, 11, 46, 0.78)',
    accentPrimary: '#FFB800',
    accentSecondary: '#B537F2',
    accentGlow: 'rgba(255, 184, 0, 0.28)',
    gridColor: 'rgba(181, 55, 242, 0.14)',
    perspectivePx: 1100
  },
  'neural-synapse': {
    name: 'Neural Synapse Bio-3D',
    badge: 'LIVE NEURAL',
    bgPrimary: '#020F0D',
    bgElevated: 'rgba(6, 34, 29, 0.78)',
    accentPrimary: '#10B981',
    accentSecondary: '#06B6D4',
    accentGlow: 'rgba(16, 185, 129, 0.28)',
    gridColor: 'rgba(16, 185, 129, 0.12)',
    perspectivePx: 1250
  },
  'solaris-chrono': {
    name: 'Solaris Spatial Glass',
    badge: 'ZERO EYE STRAIN',
    bgPrimary: '#0E0B07',
    bgElevated: 'rgba(33, 25, 16, 0.80)',
    accentPrimary: '#F59E0B',
    accentSecondary: '#EC4899',
    accentGlow: 'rgba(245, 158, 11, 0.25)',
    gridColor: 'rgba(245, 158, 11, 0.10)',
    perspectivePx: 1400
  },
  'abyssal-prism': {
    name: 'Bioluminescent Abyss 3D',
    badge: 'DEEP FOCUS',
    bgPrimary: '#010916',
    bgElevated: 'rgba(7, 25, 52, 0.78)',
    accentPrimary: '#38BDF8',
    accentSecondary: '#818CF8',
    accentGlow: 'rgba(56, 189, 248, 0.28)',
    gridColor: 'rgba(56, 189, 248, 0.11)',
    perspectivePx: 1200
  },
  'obsidian-monolith': {
    name: 'Obsidian Carbon 3D',
    badge: '2-DAY CRASH MODE',
    bgPrimary: '#060608',
    bgElevated: 'rgba(20, 20, 26, 0.86)',
    accentPrimary: '#F43F5E',
    accentSecondary: '#E2E8F0',
    accentGlow: 'rgba(244, 63, 94, 0.28)',
    gridColor: 'rgba(244, 63, 94, 0.10)',
    perspectivePx: 1000
  }
};

window.applyXamCode3DTheme = function (themeId) {
  if (!themeId || themeId === 'default-bil') {
    document.documentElement.removeAttribute('data-xc-3d-theme');
    try { localStorage.setItem('xc_3d_theme', 'default-bil'); } catch (_) {}
    return;
  }
  const t = window.XAMCODE_3D_THEMES[themeId] || window.XAMCODE_3D_THEMES['quantum-holo'];
  const root = document.documentElement;
  root.style.setProperty('--xc-bg-primary', t.bgPrimary);
  root.style.setProperty('--xc-bg-elevated', t.bgElevated);
  root.style.setProperty('--xc-accent-primary', t.accentPrimary);
  root.style.setProperty('--xc-accent-secondary', t.accentSecondary);
  root.style.setProperty('--xc-accent-glow', t.accentGlow);
  root.style.setProperty('--xc-grid-color', t.gridColor);
  root.style.setProperty('--xc-perspective', (t.perspectivePx || 1200) + 'px');
  root.setAttribute('data-xc-3d-theme', themeId);
  try {
    localStorage.setItem('xc_3d_theme', themeId);
  } catch (_) {}
};

window.bindXamCode3DTilt = function () {
  document
    .querySelectorAll('.xc-3d-card, .study-card, .q-card, .cheat-card, .vaathiyar-panel, .lib-card')
    .forEach((card) => {
      if (card.dataset.boundTilt === '1') return;
      card.dataset.boundTilt = '1';
      card.style.transformStyle = 'preserve-3d';
      card.style.transition = 'transform 0.2s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.2s ease';
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `perspective(1200px) rotateX(${(-y * 5).toFixed(2)}deg) rotateY(${(x * 5).toFixed(2)}deg) translateZ(4px)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
      });
    });
};

window.addEventListener('DOMContentLoaded', () => {
  try {
    const saved = localStorage.getItem('xc_3d_theme');
    if (saved && saved !== 'default-bil' && window.XAMCODE_3D_THEMES[saved]) {
      window.applyXamCode3DTheme(saved);
    }
  } catch (_) {}
  window.bindXamCode3DTilt();
});
