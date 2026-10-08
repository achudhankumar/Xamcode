#!/usr/bin/env python3
# Create compliance files - use base64 for long content
import base64
import os

OUT = 'c:/Xamcode'


def wf(name, content):
    with open(OUT + '/' + name, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Created ' + name)


# Base64-encoded privacy policy HTML (no special chars that break PowerShell)
privacy_b64 = 'PHA=`0_d50_d`='
# Actually we need to encode the actual content. Let's write it directly without special chars.

# Write privacy policy - minimal content to avoid issues
privacy = '<!DOCTYPE html>' \
    '<html lang="en">' \
    '<head>' \
    '<meta charset="UTF-8">' \
    '<meta name="viewport" content="width=device-width,initial-scale=1">' \
    '<title>Privacy Policy - XamCode AI</title>' \
    '<link rel="stylesheet" href="css/base.css">' \
    '<link rel="stylesheet" href="css/themes.css">' \
    '<link rel="stylesheet" href="css/layout.css">' \
    '<link rel="stylesheet" href="css/components.css">' \
    '<link rel="stylesheet" href="css/auth.css">' \
    '</head>' \
    '<body data-theme="bubblegum" data-mode="dark">' \
    '<header class="site-header"><div class="container"><a href="/" class="logo">XamCode AI</a>' \
    '<nav class="main-nav"><a href="/">Home</a><a href="/privacy-policy">Privacy Policy</a>' \
    '<a href="/terms-of-service">Terms of Service</a><a href="/accessibility-statement">Accessibility</a>' \
    '<a href="/sitemap.xml">Sitemap</a></nav></div></header>' \
    '<main class="content"><article class="card"><h1>Privacy Policy</h1>' \
    '<p class="subtitle">Last updated: 06 October 2026</p>' \
    '<p>This Privacy Policy explains what personal data we collect under the Digital Personal Data Protection Act, 2023 (DPDP Act) and the Digital Personal Data Protection Rules, 2025 (MeitY Rules).</p>' \
    '<h2>1. Data Controller</h2>' \
    '<p>XamCode AI - Owner: Achudhan, India</p>' \
    '<h2>2. Information We Collect</h2>' \
    '<p>Directly: name, email, study content (PDFs), communications to AURA AI.</p>' \
    '<h2>3. How We Use Your Data</h2>' \
    '<p>To provide the Service, process PDFs, answer questions, improve experience, and comply with legal obligations.</p>' \
    '<h2>4. Legal Basis (DPDP Act, 2023)</h2>' \
    '<p>Consent, contract, legal obligation, and legitimate interests.</p>' \
    '<h2>5. Data Security</h2>' \
    '<p>Data encrypted in transit and at rest with access controls and logging.</p>' \
    '<h2>6. Data Sharing</h2>' \
    '<p>We do not sell personal data. Shared with third-party providers under data processing agreements.</p>' \
    '<h2>7. Your Rights (DPDP Act)</h2>' \
    '<p>Right to access, correction, deletion, withdraw consent. Contact: support@xamcode.ai</p>' \
    '<h2>8. Data Retention</h2>' \
    '<p>Retained as long as necessary for service or as required by law.</p>' \
    '<h2>9. Children privacy</h2>' \
    '<p>Not intended for children under 18.</p>' \
    '<h2>10. Cookies</h2>' \
    '<p>Necessary cookies essential. Optional consent required.</p>' \
    '<h2>11. Third-Party Services</h2>' \
    '<p>Google Gemini, cloud hosting, Google Analytics.</p>' \
    '<h2>12. International Transfers</h2>' \
    '<p>Data may be transferred internationally.</p>' \
    '<h2>13. Changes to This Policy</h2>' \
    '<p>We may update this policy. Continued use constitutes acceptance.</p>' \
    '<h2>14. Contact</h2>' \
    '<p>Email: support@xamcode.ai</p>' \
    '</article></main>' \
    '<footer class="site-footer"><div class="container">' \
    '<div class="footer-links"><a href="/">Home</a><a href="/privacy-policy">Privacy Policy</a>' \
    '<a href="/terms-of-service">Terms of Service</a><a href="/accessibility-statement">Accessibility</a>' \
    '<a href="/sitemap.xml">Sitemap</a></div>' \
    '<p>copyright 2026 XamCode AI. All rights reserved.</p></div></footer>' \
    '</body></html>'

wf('privacy-policy.html', privacy)
print('Privacy policy created!')
