'use strict';

/**
 * Creates a valid, well-formed multi-page PDF buffer containing text lines per page.
 * Uses standard PDF 1.4 syntax with Helvetica font.
 *
 * @param {Array<{ title: string, headings: string[], paragraphs: string[] }>} pages
 * @returns {Buffer}
 */
function createTextPdf(pages) {
  const objects = [];
  const addObject = (content) => {
    objects.push(content);
    return objects.length; // 1-indexed object id
  };

  // Object 1: Catalog
  // Object 2: Pages
  // Object 3: Font
  const catalogId = addObject(''); // placeholder
  const pagesId = addObject('');   // placeholder
  const fontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  const pageObjectIds = [];

  for (const page of pages) {
    const textLines = [
      `BT`,
      `/F1 16 Tf`,
      `50 750 Td`,
      `(${escapePdf(page.title || 'Lecture')}) Tj`,
      `/F1 12 Tf`,
      `0 -24 Td`
    ];

    if (Array.isArray(page.headings)) {
      for (const h of page.headings) {
        textLines.push(`0 -20 Td`);
        textLines.push(`/F1 13 Tf`);
        textLines.push(`(${escapePdf(h)}) Tj`);
        textLines.push(`/F1 11 Tf`);
        textLines.push(`0 -16 Td`);
      }
    }

    if (Array.isArray(page.paragraphs)) {
      for (const p of page.paragraphs) {
        textLines.push(`(${escapePdf(p)}) Tj`);
        textLines.push(`0 -16 Td`);
      }
    }

    textLines.push(`ET`);
    const streamContent = textLines.join('\n');
    const streamLength = Buffer.byteLength(streamContent, 'ascii');

    const contentStreamId = addObject(
      `<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream`
    );

    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentStreamId} 0 R >>`
    );
    pageObjectIds.push(pageId);
  }

  // Finalize Catalog and Pages
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageObjectIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>`;

  // Build PDF buffer with cross-reference table (xref)
  let output = '%PDF-1.4\n';
  const offsets = [0];

  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(output, 'utf8'));
    output += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(output, 'utf8');
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

  for (let i = 1; i <= objects.length; i++) {
    const off = String(offsets[i]).padStart(10, '0');
    output += `${off} 00000 n \n`;
  }

  output += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(output, 'utf8');
}

function escapePdf(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, ' '); // Keep printable ASCII
}

module.exports = {
  createTextPdf
};

