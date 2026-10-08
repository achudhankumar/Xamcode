#!/usr/bin/env python3
# Create accessibility statement
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


acc = '<main class="content"><article class="card"><h1>Accessibility Statement</h1>'
acc += '<p class="subtitle">Last updated: 06 October 2026</p>'
acc += '<p>XamCode AI is committed to ensuring digital accessibility for people with disabilities. We are continually improving the user experience for everyone and applying the relevant accessibility standards.</p>'
acc += '<h2>Our Commitment</h2>'
acc += '<p>We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.2 at Level AA. This is an international standard published by the World Wide Web Consortium (W3C).</p>'
acc += '<h2>Technical Accessibility</h2>'
acc += '<ul>'
acc += '<li>All meaningful images have descriptive alt text</li>'
acc += '<li>Every interactive element is keyboard reachable with visible focus indicator</li>'
acc += '<li>Focus order is logical and intuitive</li>'
acc += '<li>Forms have clear labels, instructions, and accessible error messages</li>'
acc += '<li>Color is never the only indicator of state or information</li>'
acc += '<li>Text can be resized up to 200% without loss of functionality</li>'
acc += '<li>Headings follow a logical hierarchy</li>'
acc += '<li>Buttons are coded as buttons; links as links</li>'
acc += '<li>Animations respect the prefers-reduced-motion setting</li>'
acc += '</ul>'
acc += '<h2>Feedback</h2>'
acc += '<p>If you encounter an accessibility barrier, please let us know so we can improve:</p>'
acc += '<p>Email: support@xamcode.ai</p>'
acc += '<h2>Third-Party Content</h2>'
acc += '<p>Some content on this Service is provided by third parties and may not be fully accessible. We are not responsible for the accessibility of third-party content.</p>'
acc += '</article></main>'

wf('accessibility-statement.html', make_page('Accessibility Statement - XamCode AI', acc))
print('Accessibility Statement created!')
