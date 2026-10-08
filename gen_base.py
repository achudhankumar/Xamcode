#!/usr/bin/env python3
"""Generate compliance HTML pages for XamCode AI."""
import os

OUT = 'c:/Xamcode'


def wf(name, content):
    with open(OUT + '/' + name, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Created ' + name)


# Common header for legal pages
HEAD = ('<!DOCTYPE html>\n'
        '<html lang="en">\n'
        '<head>\n'
        '<meta charset="UTF-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
        '<title>')

TAIL = ('</title>\n'
        '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;display=swap">\n'
        '<link rel="stylesheet" href="css/base.css">\n'
        '<link rel="stylesheet" href="css/themes.css">\n'
        '<link rel="stylesheet" href="css/layout.css">\n'
        '<link rel="stylesheet" href="css/components.css">\n'
        '<link rel="stylesheet" href="css/auth.css">\n'
        '</head>\n'
        '<body data-theme="bubblegum" data-mode="dark">\n'
        '<header class="site-header">\n'
        '  <div class="container">\n'
        '    <a href="/" class="logo">XamCode AI</a>\n'
        '    <nav class="main-nav">\n'
        '      <a href="/">Home</a>\n'
        '      <a href="/privacy-policy">Privacy Policy</a>\n'
        '      <a href="/terms-of-service">Terms of Service</a>\n'
        '      <a href="/accessibility-statement">Accessibility</a>\n'
        '      <a href="/sitemap.xml">Sitemap</a>\n'
        '    </nav>\n'
        '  </div>\n'
        '</header>\n')


def common_footer():
    return ('\n'
            '<footer class="site-footer">\n'
            '  <div class="container">\n'
            '    <div class="footer-links">\n'
            '      <a href="/">Home</a>\n'
            '      <a href="/privacy-policy">Privacy Policy</a>\n'
            '      <a href="/terms-of-service">Terms of Service</a>\n'
            '      <a href="/accessibility-statement">Accessibility</a>\n'
            '      <a href="/sitemap.xml">Sitemap</a>\n'
            '    </div>\n'
            '    <p>copyright 2026 XamCode AI. All rights reserved.</p>\n'
            '  </div>\n'
            '</footer>\n'
            '\n'
            '</body>\n'
            '</html>\n')


def make_page(title, body):
    return HEAD + title + TAIL + body + common_footer()
