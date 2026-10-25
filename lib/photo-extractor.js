'use strict';

/**
 * Photo Upload & Vision Text Extraction Module (Phase A5)
 * Allows up to 20 textbook photos (JPG, PNG, HEIC) to be processed
 * into standard extracted page format for the outline & topic pipeline.
 */

const MAX_PHOTOS_PER_DOC = 20;
const MIN_DIMENSION_PX = 400; // Heuristic warning for blurry / low-res images

function validatePhotos(photos) {
  if (!Array.isArray(photos) || photos.length === 0) {
    throw new Error('No photos provided. Please upload at least one photo.');
  }

  if (photos.length > MAX_PHOTOS_PER_DOC) {
    throw new Error(`Photo upload limit exceeded: maximum ${MAX_PHOTOS_PER_DOC} photos allowed per document.`);
  }

  const warnings = [];

  photos.forEach((photo, idx) => {
    const pageNum = idx + 1;
    const mime = (photo.mimeType || photo.type || '').toLowerCase();
    const validMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];
    
    if (!validMimes.some(v => mime.includes(v.split('/')[1]))) {
      throw new Error(`Unsupported image format for photo ${pageNum}: "${mime}". Supported: JPG, PNG, WEBP, HEIC.`);
    }

    if (photo.width && photo.height) {
      if (photo.width < MIN_DIMENSION_PX || photo.height < MIN_DIMENSION_PX) {
        warnings.push(`Page ${pageNum}: Image resolution (${photo.width}x${photo.height}) is low; text may be blurry or cropped.`);
      }
    }
  });

  return { valid: true, count: photos.length, warnings };
}

/**
 * Extracts structured headings, first lines, and full text from a photo.
 * If pre-extracted text or mock is provided, formats it; otherwise sends to vision model.
 */
async function extractPhotoPages(photos, options = {}) {
  const { warnings } = validatePhotos(photos);
  const pages = [];

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const pageNumber = i + 1;

    let text = photo.text || '';
    if (!text && options.visionExtractor) {
      text = await options.visionExtractor(photo, pageNumber);
    }

    // Parse headings (lines in ALL CAPS or starting with '#' or numbered sections)
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const headings = lines
      .filter(l => /^([0-9]+\.[0-9]*\s+[A-Z]|UNIT\s+[0-9]|[A-Z\s]{4,30}$)/.test(l))
      .slice(0, 4);

    const firstLines = lines.slice(0, 3).join(' ');

    pages.push({
      pageNumber,
      text,
      fullText: text,
      headings: headings.length ? headings : (lines[0] ? [lines[0].slice(0, 40)] : []),
      firstLines: firstLines || '(No text preview extracted)',
      imageMeta: {
        width: photo.width || 1200,
        height: photo.height || 1600,
        mimeType: photo.mimeType || 'image/jpeg'
      }
    });
  }

  return {
    numPages: photos.length,
    pages,
    warnings,
    isPhotoUpload: true
  };
}

module.exports = {
  MAX_PHOTOS_PER_DOC,
  MIN_DIMENSION_PX,
  validatePhotos,
  extractPhotoPages
};
