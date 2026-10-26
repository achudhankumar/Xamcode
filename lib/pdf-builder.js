'use strict';

/**
 * lib/pdf-builder.js
 * Exports a printable HTML/PDF revision sheet containing Cheat Codes, Vaathiyar summaries, and Quiz keys.
 */
function buildPrintableRevisionHtml(studyPack) {
  const topics = studyPack?.topics || [];
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${studyPack?.title || 'XamCode Revision Sheet'}</title></head>
<body style="font-family:sans-serif;padding:24px;">
  <h1>${studyPack?.title || 'XamCode AI Revision Sheet'}</h1>
  ${topics.map(t => `
    <section style="margin-bottom:20px;border-bottom:1px solid #ccc;padding-bottom:12px;">
      <h2>${t.title} (Pages ${t.startPage || 1}-${t.endPage || 5})</h2>
      <p><strong>One-Line Formula:</strong> ${(t.cheatCode || t.cheatcode)?.oneLine || ''}</p>
      <p><strong>Exam Rule:</strong> ${(t.cheatCode || t.cheatcode)?.right || ''}</p>
    </section>
  `).join('')}
</body>
</html>`;
}

module.exports = { buildPrintableRevisionHtml };
