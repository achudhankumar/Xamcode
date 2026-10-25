'use strict';

const computerNetworks = require('./computer-networks');
const python = require('./python');

const SUBJECT_PACKS = {
  [computerNetworks.id]: computerNetworks,
  [python.id]: python
};

function getSubjectPack(id) {
  if (!id) return null;
  const key = id.toLowerCase().replace(/[_\s]+/g, '-');
  return SUBJECT_PACKS[key] || null;
}

function getAllSubjectPacks() {
  return Object.values(SUBJECT_PACKS);
}

function checkVisualRichness(visual, subjectId = null) {
  const pack = getSubjectPack(subjectId);
  if (pack && typeof pack.checkRichness === 'function') {
    return pack.checkRichness(visual);
  }
  // Generic fallback richness check: at least 3 distinct steps with descriptions
  if (!visual || !Array.isArray(visual.steps)) return false;
  if (visual.steps.length < 3) return false;
  const allCaptions = visual.steps.every(s => (s.desc && s.desc.length > 2) || (s.caption && s.caption.length > 2));
  return allCaptions;
}

module.exports = {
  SUBJECT_PACKS,
  getSubjectPack,
  getAllSubjectPacks,
  checkVisualRichness
};

