'use strict';

/**
 * Shared Theme System Registry (Phase 9)
 * Ported from Build-in-Public to unify the main app and /build dashboard.
 */

const fs = require('fs');
const path = require('path');

const THEME_IDS = [
  '01-vibe-coding-studio',
  '02-bubblegum-playground',
  '03-liquid-glass-3d',
  '04-neo-brutalist-creative-lab',
  '05-soft-minimal-studio'
];

function loadThemes() {
  return THEME_IDS.map(id => {
    const jsonPath = path.join(__dirname, id, 'theme.json');
    const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    return {
      ...meta,
      tokensPath: path.join(__dirname, id, 'tokens.css'),
      scenePath: path.join(__dirname, id, 'scene.js')
    };
  });
}

const THEMES = loadThemes();

function getAllThemes() {
  return THEMES;
}

function getTheme(id) {
  if (!id) return THEMES[0];
  const normalized = id.toLowerCase().trim();
  return THEMES.find(t => t.id === normalized || t.styleKey === normalized) || THEMES[0];
}

function shouldRecommendSoftMinimal({
  isCoarsePointer = false,
  deviceMemory = 8,
  hardwareConcurrency = 8,
  saveData = false,
  prefersReducedMotion = false
} = {}) {
  if (isCoarsePointer) return true;
  if (deviceMemory <= 4) return true;
  if (hardwareConcurrency <= 4) return true;
  if (saveData) return true;
  if (prefersReducedMotion) return true;
  return false;
}

/**
 * Client-side live theme switch helper (no reload)
 */
function applyThemeLive(themeId, doc = (typeof document !== 'undefined' ? document : null)) {
  if (!doc) return;
  const theme = getTheme(themeId);
  doc.body.setAttribute('data-style', theme.styleKey);
  doc.documentElement.setAttribute('data-theme', theme.id);

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('xamcode_selected_theme', theme.id);
      localStorage.setItem('bip_style', theme.styleKey);
    } catch (_) {}
  }
}

module.exports = {
  THEME_IDS,
  getAllThemes,
  getTheme,
  shouldRecommendSoftMinimal,
  applyThemeLive
};
