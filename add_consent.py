#!/usr/bin/env python3
# Add cookie consent and SEO meta tags to all HTML pages
import os

OUT = 'c:/Xamcode'

meta_tags = """
<!-- SEO: Compliance metadata -->
<meta name="description" content="XamCode AI - AI-powered study assistant. Upload PDFs to generate flashcards, quizzes, and study materials. DPDP Act compliant. Free to start.">
<meta name="keywords" content="AI study assistant, PDF to flashcards, study tools, India, DPDP compliant">
<meta name="author" content="XamCode AI (Achudhan) - support@xamcode.ai">
<meta name="robots" content="index, follow">

<!-- Cookie consent banner -->
<div id="cookie-consent" style="display:none; position:fixed; bottom:0 left:0 right:0 z-9999; background:#1a1a2e; color:#e2e8f0; padding:12px 16px; font-family:Inter,system-ui,sans-serif; font-size:14px; border-top:1px solid #334155;">
  <div style="max-width:1200px; margin:0 auto;">
    <p>This site uses cookies to enhance your experience. <a href="/privacy-policy" style="color:#60a5fa;text-decoration:underline;">Learn more</a></p>
    <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
      <button id="cookie-decline" style="padding:6px 12px; background:#475569; color:#e2e8f0; border:none; border-radius:4px; cursor:pointer; font-size:13px;">Decline</button>
      <button id="cookie-accept" style="padding:6px 12px; background:#22c55e; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:13px;">Accept All</button>
    </div>
  </div>
</div>
<script>
(function() {
  try {
    var c = document.cookie.split(';').some(function(item) {
      return item.trim().startsWith('xamcode_consent=');
    });
    var el = document.getElementById('cookie-consent');
    if (c) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    document.getElementById('cookie-accept').addEventListener('click', function() {
      document.cookie = 'xamcode_consent=accepted; path=/; max-age=31536000; SameSite=Lax';
      el.style.display = 'none';
    });
    document.getElementById('cookie-decline').addEventListener('click', function() {
      document.cookie = 'xamcode_consent=declined; path=/; max-age=31536000; SameSite=Lax';
      el.style.display = 'none';
    });
  } catch (e) {}
})();
</script>
"""

files = os.listdir(OUT)
for f in files:
    if f.endswith('.html') and f != 'server.js':
        path = os.path.join(OUT, f)
        try:
            with open(path, 'r', encoding='utf-8') as file:
                content = file.read()
            idx = content.find('</head>')
            if idx >= 0:
                new_content = content[:idx+7] + meta_tags + content[idx+7:]
                with open(path, 'w', encoding='utf-8') as file:
                    file.write(new_content)
                print('Updated ' + f)
        except Exception as e:
            print('Error updating ' + f + ': ' + str(e))

print('Done!')
