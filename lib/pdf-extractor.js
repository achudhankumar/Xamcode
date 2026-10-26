'use strict';

let pdfjs = null;
let pdfjsLoaded = false;

function getPdfJs() {
  if (pdfjsLoaded) return pdfjs;
  pdfjsLoaded = true;
  const origWarn = console.warn;
  try {
    console.warn = (...args) => {
      const msg = String(args[0] || '');
      if (msg.includes('Cannot polyfill')) return;
      origWarn.apply(console, args);
    };
    pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
    if (pdfjs && pdfjs.VerbosityLevel) {
      pdfjs.verbosity = pdfjs.VerbosityLevel.ERRORS;
    }
  } catch (_) {
    pdfjs = null;
  } finally {
    console.warn = origWarn;
  }
  return pdfjs;
}

/**
 * Extracts structured per-page text from a PDF buffer using pdfjs-dist,
 * with a fallback stream decoder for minimal synthetic PDF buffers.
 * Flags pages with almost no text (< 40 non-whitespace characters) for OCR.
 *
 * @param {Buffer|Uint8Array} buffer - The PDF binary buffer
 * @returns {Promise<{
 *   numPages: number,
 *   pages: Array<{
 *     pageNumber: number,
 *     text: string,
 *     lines: string[],
 *     headings: string[],
 *     firstLines: string,
 *     charCount: number,
 *     needsOcr: boolean
 *   }>,
 *   extractor?: string
 * }>}
 */
async function extractPdfPages(buffer) {
  if (!buffer || !(buffer instanceof Buffer || buffer instanceof Uint8Array)) {
    throw new Error('extractPdfPages requires a Buffer or Uint8Array');
  }

  const lib = getPdfJs();
  if (lib && typeof lib.getDocument === 'function') {
    try {
      const data = new Uint8Array(buffer);
      const loadingTask = lib.getDocument({
        data,
        useSystemFonts: true,
        disableFontFace: true,
        verbosity: 0
      });

      const doc = await loadingTask.promise;
      const numPages = doc.numPages;
      const pages = [];

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await doc.getPage(pageNum);
        const content = await page.getTextContent();

        // Group text items by vertical position (Y coordinate) to reconstruct coherent lines
        const lineBuckets = new Map();
        for (const item of content.items) {
          if (!item || typeof item.str !== 'string') continue;
          if (!item.str && !item.str.trim()) continue;

          // Round Y coordinate to group characters on roughly the same baseline (~3pt tolerance)
          const y = Math.round((item.transform ? item.transform[5] : 0) / 3) * 3;
          if (!lineBuckets.has(y)) {
            lineBuckets.set(y, []);
          }
          lineBuckets.get(y).push({
            x: item.transform ? item.transform[4] : 0,
            width: item.width || 0,
            text: item.str
          });
        }

        // Sort lines from top of the page (highest Y in PDF coordinates) to bottom
        const sortedY = Array.from(lineBuckets.keys()).sort((a, b) => b - a);
        const lines = [];

        for (const y of sortedY) {
          const itemsInLine = lineBuckets.get(y);
          // Sort left-to-right
          itemsInLine.sort((a, b) => a.x - b.x);

          let line = '';
          for (let i = 0; i < itemsInLine.length; i++) {
            const it = itemsInLine[i];
            if (i > 0) {
              const prev = itemsInLine[i - 1];
              const gap = it.x - (prev.x + prev.width);
              if (gap > 2 && !line.endsWith(' ') && !it.text.startsWith(' ')) {
                line += ' ';
              }
            }
            line += it.text;
          }

          const lineStr = line.replace(/\s+/g, ' ').trim();
          if (lineStr) {
            lines.push(lineStr);
          }
        }

        const fullText = lines.join('\n');
        const charCount = fullText.replace(/\s+/g, '').length;

        // Detect heading candidates: short lines, uppercase, or title-like
        const headings = lines.filter(l => {
          if (l.length < 3 || l.length > 70) return false;
          const isUpper = l === l.toUpperCase() && /[A-Z]/.test(l);
          const isUnitOrChapter = /^(Unit|Chapter|Section|Module|\d+(\.\d+)*)\b/i.test(l);
          const noPunct = !/[.?!;,]$/.test(l);
          return (isUpper || isUnitOrChapter || noPunct);
        });

        const firstLines = lines.slice(0, 3).join(' — ');
        const needsOcr = charCount < 40;

        pages.push({
          pageNumber: pageNum,
          text: fullText,
          lines,
          headings,
          firstLines,
          charCount,
          needsOcr
        });
      }

      return {
        numPages,
        pages,
        extractor: 'pdfjs-dist'
      };
    } catch (_) {
      // Fall through to lightweight stream text decoder for synthetic buffers
    }
  }

  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const raw = buf.toString('latin1');
  const matches = raw.match(/\(([^()]{3,200})\)/g) || [];
  const cleanedLines = matches
    .map((m) => m.slice(1, -1).replace(/\\[nrt]/g, ' ').replace(/[^\x20-\x7E]/g, ' ').trim())
    .filter((l) => l.length > 3);

  const linesPerPage = 35;
  const totalPages = Math.max(1, Math.ceil(cleanedLines.length / linesPerPage));
  const pages = [];

  for (let p = 1; p <= totalPages; p++) {
    const slice = cleanedLines.slice((p - 1) * linesPerPage, p * linesPerPage);
    const fullText = slice.join('\n');
    const charCount = fullText.replace(/\s+/g, '').length;
    pages.push({
      pageNumber: p,
      text: fullText,
      lines: slice,
      headings: slice.filter((l) => l.length < 80 && /^[A-Z0-9]/.test(l)).slice(0, 5),
      firstLines: slice.slice(0, 3).join(' — '),
      charCount,
      needsOcr: charCount < 40
    });
  }

  return {
    numPages: totalPages,
    pages,
    extractor: 'fallback-stream'
  };
}

module.exports = {
  extractPdfPages
};
