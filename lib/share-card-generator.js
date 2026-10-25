/**
 * lib/share-card-generator.js
 * Generates viral share cards and social preview metadata for XamCode AI lessons (Phase 13).
 */

class ShareCardGenerator {
  /**
   * Generates social preview metadata and SVG share badge for a lesson topic.
   */
  generateCard({ topicTitle, subject, keyPoint, streakDays = 1, theme = 'Vibe Coding Studio' }) {
    const safeTitle = (topicTitle || 'Engineering Lesson').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeSubject = (subject || 'Computer Science').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeKeyPoint = (keyPoint || 'Master core concepts visually').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0A0B10" />
      <stop offset="50%" stop-color="#141829" />
      <stop offset="100%" stop-color="#0F172A" />
    </linearGradient>
    <linearGradient id="brand" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#6366F1" />
      <stop offset="100%" stop-color="#EC4899" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)" />

  <!-- Accent glow border -->
  <rect x="20" y="20" width="1160" height="590" rx="24" fill="none" stroke="url(#brand)" stroke-width="2" opacity="0.6" />

  <!-- Badge Header -->
  <g transform="translate(80, 100)">
    <rect width="180" height="36" rx="18" fill="#1E293B" />
    <text x="90" y="23" fill="#A5B4FC" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" text-anchor="middle" letter-spacing="1">XAMCODE AI</text>
    <text x="200" y="23" fill="#64748B" font-family="system-ui, sans-serif" font-size="14">• ${safeSubject.toUpperCase()}</text>
  </g>

  <!-- Title & Key Point -->
  <text x="80" y="220" fill="#FFFFFF" font-family="system-ui, sans-serif" font-size="48" font-weight="900" width="1040">${safeTitle}</text>
  <foreignObject x="80" y="270" width="1040" height="150">
    <p xmlns="http://www.w3.org/1999/xhtml" style="color:#94A3B8; font-family:system-ui, sans-serif; font-size:22px; line-height:1.5; margin:0;">
      "${safeKeyPoint}"
    </p>
  </foreignObject>

  <!-- Bottom Metric Bar -->
  <g transform="translate(80, 480)">
    <!-- Streak pill -->
    <rect width="160" height="50" rx="25" fill="#312E81" />
    <text x="80" y="31" fill="#F43F5E" font-family="system-ui, sans-serif" font-size="18" font-weight="bold" text-anchor="middle">🔥 ${streakDays} Day Streak</text>

    <!-- Theme badge -->
    <rect x="180" width="220" height="50" rx="25" fill="#1E293B" />
    <text x="290" y="31" fill="#CBD5E1" font-family="system-ui, sans-serif" font-size="15" text-anchor="middle">🎨 ${theme}</text>

    <!-- Call to action -->
    <text x="1040" y="31" fill="#6366F1" font-family="system-ui, sans-serif" font-size="20" font-weight="bold" text-anchor="end">xamcode.ai</text>
  </g>
</svg>
    `.trim();

    return {
      svg,
      metadata: {
        title: safeTitle,
        description: safeKeyPoint,
        openGraph: {
          title: `${safeTitle} — XamCode AI`,
          description: safeKeyPoint,
          site_name: 'XamCode AI',
          type: 'article'
        },
        twitter: {
          card: 'summary_large_image',
          title: safeTitle,
          description: safeKeyPoint
        }
      }
    };
  }

  /**
   * Generates AR model-viewer markup if 3D assets are available for topic.
   */
  generateArEmbed(modelUrl, title = '3D Model') {
    return `
<model-viewer
  src="${modelUrl}"
  alt="${title}"
  auto-rotate
  camera-controls
  ar
  ar-modes="webxr scene-viewer quick-look"
  shadow-intensity="1"
  style="width: 100%; height: 380px; border-radius: 12px; background: #0A0B10;">
  <button slot="ar-button" class="xc-ar-button" style="background:#6366F1; color:#fff; border:none; padding:8px 16px; border-radius:8px; font-weight:bold;">
    View in your room (AR)
  </button>
</model-viewer>
    `.trim();
  }
}

module.exports = { ShareCardGenerator };

