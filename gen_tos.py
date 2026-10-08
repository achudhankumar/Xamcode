#!/usr/bin/env python3
# Create terms of service
import os

OUT = 'c:/Xamcode'


def wf(name, content):
    with open(OUT + '/' + name, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Created ' + name)


def make_page(title, body):
    head = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title + '</title>'
    head += '<link rel="stylesheet" href="css/base.css">'
    head += '<link rel="stylesheet" href="css/themes.css">'
    head += '<link rel="stylesheet" href="css/layout.css">'
    head += '<link rel="stylesheet" href="css/components.css">'
    head += '<link rel="stylesheet" href="css/auth.css">'
    head += '</head><body data-theme="bubblegum" data-mode="dark">'
    head += '<header class="site-header"><div class="container"><a href="/" class="logo">XamCode AI</a>'
    head += '<nav class="main-nav"><a href="/">Home</a><a href="/privacy-policy">Privacy Policy</a>'
    head += '<a href="/terms-of-service">Terms of Service</a>'
    head += '<a href="/accessibility-statement">Accessibility</a><a href="/sitemap.xml">Sitemap</a></nav></div></header>'
    footer = '<footer class="site-footer"><div class="container"><div class="footer-links">'
    footer += '<a href="/">Home</a><a href="/privacy-policy">Privacy Policy</a>'
    footer += '<a href="/terms-of-service">Terms of Service</a>'
    footer += '<a href="/accessibility-statement">Accessibility</a><a href="/sitemap.xml">Sitemap</a></div>'
    footer += '<p>copyright 2026 XamCode AI. All rights reserved.</p></div></footer>'
    return head + '<body>' + body + footer


tos = '<main class="content"><article class="card"><h1>Terms of Service</h1>'
tos += '<p class="subtitle">Last updated: 06 October 2026</p>'
tos += '<p>These Terms of Service govern your use of the XamCode AI Service (the Service). By accessing or using the Service, you agree to be bound by these Terms.</p>'
tos += '<h2>1. Acceptance of Terms</h2>'
tos += '<p>These Terms were created by XamCode AI. They set out the rules and regulations for using XamCode AI Website and Services.</p>'
tos += '<h2>2. Description of Service</h2>'
tos += '<p>XamCode AI is a study learning application that provides interactive study materials generated from PDFs, formula cards, cheat sheets, and a Vaathiyar quiz mode.</p>'
tos += '<h2>3. User Accounts</h2>'
tos += '<p>You may be required to create an account to access certain features. You are responsible for maintaining the confidentiality of your account credentials.</p>'
tos += '<h2>4. Acceptable Use</h2>'
tos += '<p>You agree not to use the Service to:</p>'
tos += '<ul>'
tos += '<li>Violate any applicable laws or regulations</li>'
tos += '<li>Infringe intellectual property rights of others</li>'
tos += '<li>Transmit harmful, illegal, or offensive content</li>'
tos += '<li>Attempt to gain unauthorized access to the Service</li>'
tos += '<li>Interfere with or disrupt the Service</li>'
tos += '</ul>'
tos += '<h2>5. Intellectual Property</h2>'
tos += '<p>The Service and its original content are owned by XamCode AI and are protected by intellectual property laws.</p>'
tos += '<h2>6. Privacy</h2>'
tos += '<p>Your privacy is important to us. Our privacy practices are described in the Privacy Policy at /privacy-policy.</p>'
tos += '<h2>7. Third-Party Services</h2>'
tos += '<p>The Service may link to third-party websites. We have no control over third-party content or privacy practices.</p>'
tos += '<h2>8. Limitation of Liability</h2>'
tos += '<p>XamCode AI shall not be liable for any indirect, incidental, special, consequential, or punitive damages.</p>'
tos += '<h2>9. Changes to Terms</h2>'
tos += '<p>We reserve the right to modify these Terms at any time.</p>'
tos += '<h2>10. Governing Law</h2>'
tos += '<p>These Terms shall be governed by the laws of India. Any dispute arising under these Terms shall be resolved in the courts of India.</p>'
tos += '<h2>11. Contact Information</h2>'
tos += '<p>If you have any questions about these Terms, please contact us at: support@xamcode.ai</p>'
tos += '</article></main>'

wf('terms-of-service.html', make_page('Terms of Service - XamCode AI', tos))
print('Terms of Service created!')
