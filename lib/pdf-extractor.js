'use strict';

const zlib = require('zlib');

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

const PDF_METADATA_REGEX = /(?:charprocs|cidtogidmap|fontbbox|fontmatrix|tounicode|firstchar|lastchar|differences|identity-h|\bidentity\b|\bwidths\b|\bencoding\b|\/font\b|\/charprocs\b|\/encoding\b|\/widths\b|\/cidfont|\/fontdescriptor|\/descendantfonts|\/basefont|\/capheight|\/xheight|\/stemv|\/italicangle|\/ascent|\/descent)/i;

/**
 * Checks if a string contains PDF internal metadata dictionary keys or operator syntax.
 */
function isPdfMetadata(str) {
  if (!str || typeof str !== 'string') return true;
  if (PDF_METADATA_REGEX.test(str)) return true;
  if (/^\s*\/[A-Z][a-zA-Z0-9_]*\s*(<<|>>|\[|\/)/.test(str)) return true;
  if (/^\s*<<[\s\S]*>>\s*$/.test(str)) return true;
  return false;
}

/**
 * Checks if a line is corrupted binary/glyph noise rather than human-readable text.
 */
function isCorruptedGlyphNoise(str) {
  if (!str || typeof str !== 'string') return true;
  const trimmed = str.trim();
  if (trimmed.length === 0) return true;

  // Unprintable control characters (excluding newline, carriage return, tab)
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(trimmed)) return true;

  // PDF operator noise / corrupted glyph patterns
  if (/^[0-9.]+\s+[0-9.]+\s+[0-9.]+\s+(?:rg|RG|g|G|m|l|re|cm|gs)\s*$/.test(trimmed)) return true;
  if (/^\/F\d+\s+[0-9.]+\s+Tf\s*$/i.test(trimmed)) return true;

  // High concentration of irregular punctuation clusters typical in glyph streams
  if (/[;*<>{}[\]|\\^~]{2,}/.test(trimmed)) return true;
  if (/[|;]\s*[|;]/.test(trimmed)) return true;
  if (/[*<"]\s*[*<"]/.test(trimmed)) return true;

  // Detect raw glyph stream sequences of isolated 1-2 character tokens (e.g. "S& v 0 Dzz V", "J 4 & zA bM j")
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length >= 3) {
    const shortTokens = tokens.filter(t => t.length <= 2);
    if (shortTokens.length / tokens.length > 0.65) return true;
    const avgLen = tokens.reduce((s, t) => s + t.length, 0) / tokens.length;
    if (avgLen < 2.4) return true;
  }

  // Calculate readability ratio: standard alphanumeric and common punctuation / whitespace
  const readableChars = (trimmed.match(/[a-zA-Z0-9\s.,!?:;'"()\/\-–—\[\]%&@$#*+=]/g) || []).length;
  const readabilityRatio = readableChars / trimmed.length;
  if (readabilityRatio < 0.80) return true;

  // For short strings, verify they aren't isolated glyph gibberish like 'RI "* f<' or 'l; |pX'
  const nonWs = trimmed.replace(/\s+/g, '');
  if (nonWs.length >= 3) {
    const alphaNum = (nonWs.match(/[a-zA-Z0-9]/g) || []).length;
    if (alphaNum / nonWs.length < 0.55 && /[*<|;~^\\{}]/.test(trimmed)) {
      return true;
    }
    if (/[*<|;~^\\]/.test(trimmed)) {
      const words = (trimmed.match(/[a-zA-Z0-9]{2,}/g) || []).join('');
      if (words.length / nonWs.length < 0.50) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Validates whether a line should be included in extracted page text.
 */
function isValidTextLine(line) {
  if (!line || typeof line !== 'string') return false;
  const trimmed = line.trim();
  if (trimmed.length < 2) return false;
  if (isPdfMetadata(trimmed)) return false;
  if (isCorruptedGlyphNoise(trimmed)) return false;
  return true;
}

function unescapePdfString(str) {
  if (!str) return '';
  return str
    .replace(/\\([0-9]{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\([nrtbf()\\])/g, (_, c) => {
      if (c === 'n') return '\n';
      if (c === 'r') return '\r';
      if (c === 't') return '\t';
      return c;
    })
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePdfTjArray(arrStr) {
  if (!arrStr) return '';
  const strRe = /\(((?:\\[\s\S]|[^\\()])*)\)/g;
  let res = '';
  let m;
  while ((m = strRe.exec(arrStr))) {
    res += unescapePdfString(m[1]) + ' ';
  }
  return res.replace(/\s+/g, ' ').trim();
}

/**
 * Extracts structured per-page text from a PDF buffer using pdfjs-dist,
 * with a fallback stream decoder for minimal synthetic PDF buffers.
 * Sanitizes output to eliminate PDF font metadata leaks and raw glyph stream noise.
 * Flags pages with low character counts (< 40 non-whitespace) or < 80% readability for OCR.
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

          // Scrub out font dictionary / internal metadata items at item level
          if (isPdfMetadata(item.str) || isCorruptedGlyphNoise(item.str)) continue;

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
          if (lineStr && isValidTextLine(lineStr)) {
            lines.push(lineStr);
          }
        }

        // Clean header/footer stripping: filter out isolated page numbers / running headers at extreme page boundaries
        const cleanLines = lines.filter((l, idx) => {
          if (lines.length <= 2) return true;
          const isEdge = (idx === 0 || idx === lines.length - 1);
          if (!isEdge) return true;
          // Filter running page numbers: "Page 1", "Page 1 of 5", "— 1 —", "1 / 10", standalone numbers
          if (/^(page\s+\d+(\s+of\s+\d+)?|\d+\s*\/\s*\d+|[-—–]\s*\d+\s*[-—–]|\d+)$/i.test(l.trim())) {
            return false;
          }
          return true;
        });

        const activeLines = cleanLines;
        const fullText = activeLines.join('\n');
        const charCount = fullText.replace(/\s+/g, '').length;

        // Readability assertion & minimum viable text check
        const readableChars = (fullText.match(/[a-zA-Z0-9\s.,!?:;'"()\/\-–—\[\]%&@$#*+=]/g) || []).length;
        const readabilityRatio = fullText.length > 0 ? (readableChars / fullText.length) : 0;
        const isReadable = readabilityRatio >= 0.80;

        const needsOcr = (charCount < 40) || !isReadable;
        const finalText = isReadable ? fullText : '';
        const finalLines = isReadable ? activeLines : [];

        // Detect heading candidates: short lines, uppercase, or title-like
        const headings = isReadable ? finalLines.filter(l => {
          if (l.length < 3 || l.length > 70) return false;
          const isUpper = l === l.toUpperCase() && /[A-Z]/.test(l);
          const isUnitOrChapter = /^(Unit|Chapter|Section|Module|Lecture|\d+(\.\d+)*)\b/i.test(l);
          const noPunct = !/[.?!;,]$/.test(l);
          return (isUpper || isUnitOrChapter || noPunct);
        }) : [];

        const firstLines = isReadable ? finalLines.slice(0, 3).join(' — ') : '';

        pages.push({
          pageNumber: pageNum,
          text: finalText,
          lines: finalLines,
          headings,
          firstLines,
          charCount: isReadable ? charCount : 0,
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
  const latin = buf.toString('latin1');
  const extractedLines = [];

  // Scan content streams (stream ... endstream)
  let pos = 0;
  let streamCount = 0;
  while (pos < latin.length && extractedLines.length < 500 && streamCount < 100) {
    const startTag = latin.indexOf('stream', pos);
    if (startTag === -1) break;

    // Skip stream if the preceding dictionary marks it as font, image, or glyph metadata
    const dictSlice = latin.substring(Math.max(0, startTag - 400), startTag);
    if (/(?:\/Type\s*\/Font|\/Subtype\s*\/Image|\/CharProcs|\/CIDToGIDMap|\/FontDescriptor|\/ToUnicode)/i.test(dictSlice)) {
      pos = startTag + 6;
      continue;
    }

    let dataStart = startTag + 6;
    if (latin.charCodeAt(dataStart) === 13) dataStart++;
    if (latin.charCodeAt(dataStart) === 10) dataStart++;
    const endTag = latin.indexOf('endstream', dataStart);
    if (endTag === -1) break;
    pos = endTag + 9;
    streamCount++;

    const streamLen = endTag - dataStart;
    if (streamLen <= 0 || streamLen > 4 * 1024 * 1024) continue;

    const rawChunk = buf.subarray(dataStart, endTag);
    let streamText = null;
    try {
      streamText = zlib.inflateSync(rawChunk).toString('latin1');
    } catch {
      try {
        streamText = zlib.inflateRawSync(rawChunk).toString('latin1');
      } catch {
        streamText = latin.substring(dataStart, endTag);
      }
    }
    if (!streamText) continue;

    // If decompressed stream contains font metadata signatures, skip
    if (/(?:charprocs|cidtogidmap|fontbbox|fontmatrix|\/FontBBox)/i.test(streamText)) {
      continue;
    }

    // TJ arrays: [(text)] TJ
    const tjArrayRe = /\[([\s\S]*?)\]\s*TJ/g;
    let tjMatch;
    while ((tjMatch = tjArrayRe.exec(streamText))) {
      const parsed = parsePdfTjArray(tjMatch[1]);
      if (isValidTextLine(parsed)) {
        extractedLines.push(parsed.trim());
      }
    }

    // BT ... ET text blocks
    const btRe = /BT\s*([\s\S]*?)\s*ET/g;
    let btMatch;
    while ((btMatch = btRe.exec(streamText))) {
      const block = btMatch[1];
      const strRe = /\(((?:\\[\s\S]|[^\\()])*)\)\s*(?:Tj|'|"|T\*)?/g;
      let sm;
      while ((sm = strRe.exec(block))) {
        const cleaned = unescapePdfString(sm[1]);
        if (isValidTextLine(cleaned)) {
          extractedLines.push(cleaned.trim());
        }
      }
    }

    // Standalone (text) Tj
    const tjSingleRe = /\(((?:\\[\s\S]|[^\\()])*)\)\s*(?:Tj|'|")/g;
    let singleMatch;
    while ((singleMatch = tjSingleRe.exec(streamText))) {
      const cleaned = unescapePdfString(singleMatch[1]);
      if (isValidTextLine(cleaned)) {
        extractedLines.push(cleaned.trim());
      }
    }
  }

  // Fallback for minimal synthetic PDF buffers without stream envelopes
  if (extractedLines.length === 0) {
    const matches = latin.match(/\(([^()]{3,200})\)/g) || [];
    for (const m of matches) {
      const cleaned = unescapePdfString(m.slice(1, -1));
      if (isValidTextLine(cleaned)) {
        extractedLines.push(cleaned.trim());
      }
    }
  }

  const linesPerPage = 35;
  const totalPages = Math.max(1, Math.ceil(extractedLines.length / linesPerPage));
  const pages = [];

  for (let p = 1; p <= totalPages; p++) {
    const slice = extractedLines.slice((p - 1) * linesPerPage, p * linesPerPage);
    const fullText = slice.join('\n');
    const charCount = fullText.replace(/\s+/g, '').length;
    const readableChars = (fullText.match(/[a-zA-Z0-9\s.,!?:;'"()\/\-–—\[\]%&@$#*+=]/g) || []).length;
    const readabilityRatio = fullText.length > 0 ? (readableChars / fullText.length) : 0;
    const isReadable = readabilityRatio >= 0.80;

    const needsOcr = (charCount < 40) || !isReadable;
    const finalText = isReadable ? fullText : '';
    const finalLines = isReadable ? slice : [];

    pages.push({
      pageNumber: p,
      text: finalText,
      lines: finalLines,
      headings: finalLines.filter((l) => l.length < 80 && /^[A-Z0-9]/.test(l)).slice(0, 5),
      firstLines: finalLines.slice(0, 3).join(' — '),
      charCount: isReadable ? charCount : 0,
      needsOcr
    });
  }

  return {
    numPages: totalPages,
    pages,
    extractor: 'fallback-stream'
  };
}

module.exports = {
  extractPdfPages,
  isPdfMetadata,
  isCorruptedGlyphNoise,
  isValidTextLine
};
