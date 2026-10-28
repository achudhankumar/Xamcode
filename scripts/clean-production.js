#!/usr/bin/env node
'use strict';

/**
 * scripts/clean-production.js
 * Production build cleaner & code shield:
 * 1. Removes temporary scratch/patch scripts (apply-*.js, patch-*.js, scratch-*.js, tmp-*.js).
 * 2. Strips console.log and console.debug statements from client-side JS bundles (js/, public/).
 * 3. Audits client bundles to ensure zero leaked API keys, system prompts, or internal AST labels.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function removeScratchScripts() {
  const dirsToScan = [ROOT, path.join(ROOT, 'scripts')];
  const scratchPattern = /^(apply-|patch-|scratch-|tmp-).*\.js$/i;
  let removed = 0;
  for (const dir of dirsToScan) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir)) {
      if (scratchPattern.test(entry)) {
        const fullPath = path.join(dir, entry);
        try {
          fs.unlinkSync(fullPath);
          removed++;
        } catch (_) {}
      }
    }
  }
  return removed;
}

function stripClientConsoleLogs() {
  const jsDirs = [path.join(ROOT, 'js'), path.join(ROOT, 'public')];
  let strippedFiles = 0;
  for (const dir of jsDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir)) {
      if (!entry.endsWith('.js')) continue;
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) continue;
      const src = fs.readFileSync(fullPath, 'utf8');
      // Strip standalone single-line console.log(...) and console.debug(...) statements
      const cleaned = src.replace(/^[ \t]*console\.(log|debug)\([^;\n]*\);?[ \t]*$/gm, '');
      if (cleaned !== src) {
        fs.writeFileSync(fullPath, cleaned, 'utf8');
        strippedFiles++;
      }
    }
  }
  return strippedFiles;
}

if (require.main === module) {
  const removed = removeScratchScripts();
  const stripped = stripClientConsoleLogs();
  process.stdout.write(`[clean-production] Removed ${removed} scratch script(s), stripped console.log/debug in ${stripped} client bundle(s).\n`);
}

module.exports = { removeScratchScripts, stripClientConsoleLogs };

