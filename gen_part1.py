#!/usr/bin/env python3
# Create compliance HTML files for XamCode AI
import os

OUT = 'c:/Xamcode'


def wf(name, content):
    with open(OUT + '/' + name, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Created ' + name)


# Common HTML head
head = '<!DOCTYPE html>' \
    '<html lang="en">' \
    '<head>' \
    '<meta charset="UTF-8">' \
    '<meta name="viewport" content="width=device-width,initial-scale=1">' \
    '<title>'

tail = '</title>' \
    '<link rel="stylesheet" href="css/base.css">' \
    '<link rel="stylesheet" href="css/themes.css">' \
    '<link rel="stylesheet" href="css/layout.css">' \
    '<link rel="stylesheet" href="css/components.css">' \
    '<link rel="stylesheet" href="css/auth.css">' \
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">' \
    '</head>' \
    '<body data-theme="bubblegum" data-mode="dark">' \
    '<header class="site-header"><div class="container"><a href="/" class="logo">XamCode AI</a><nav class="main-nav">' \
    '<a href="/">Home</a><a href="/privacy-policy">Privacy Policy</a><a href="/terms-of-service">Terms of Service</a>' \
    '<a href="/accessibility-statement">Accessibility</a><a href="/sitemap.xml">Sitemap</a></nav></div></header>'

footer = '<footer class="site-footer"><div class="container"><div class="footer-links">' \
    '<a href="/">Home</a><a href="/privacy-policy">Privacy Policy</a><a href="/terms-of-service">Terms of Service</a>' \
    '<a href="/accessibility-statement">Accessibility</a><a href="/sitemap.xml">Sitemap</a></div>' \
    '<p>copyright 2026 XamCode AI. All rights reserved.</p></div></footer>' \
    '</body>' \
    '</html>'


def make_page(title, body):
    return head + title + tail + body + footer

print('Functions defined - ready for content')
