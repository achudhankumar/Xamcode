#!/usr/bin/env python3
# Create robots.txt and sitemap.xml
import os

OUT = 'c:/Xamcode'


def wf(name, content):
    with open(OUT + '/' + name, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Created ' + name)


# robots.txt
robots = 'User-agent: *\n'
robots += 'Allow: /\n'
robots += 'Sitemap: https://xamcode.ai/sitemap.xml\n'
robots += '\n'
robots += 'User-agent: Googlebot\n'
robots += 'Allow: /\n'
robots += '\n'
robots += 'User-agent: *\n'
robots += 'Disallow: /api/\n'
robots += 'Disallow: /private/\n'
wf('robots.txt', robots)

# sitemap.xml
sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n'
sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
sitemap += '  <url>\n'
sitemap += '    <loc>https://xamcode.ai/</loc>\n'
sitemap += '    <lastmod>2026-10-06</lastmod>\n'
sitemap += '    <changefreq>weekly</changefreq>\n'
sitemap += '  </url>\n'
sitemap += '  <url>\n'
sitemap += '    <loc>https://xamcode.ai/privacy-policy</loc>\n'
sitemap += '    <lastmod>2026-10-06</lastmod>\n'
sitemap += '    <changefreq>monthly</changefreq>\n'
sitemap += '  </url>\n'
sitemap += '  <url>\n'
sitemap += '    <loc>https://xamcode.ai/terms-of-service</loc>\n'
sitemap += '    <lastmod>2026-10-06</lastmod>\n'
sitemap += '    <changefreq>yearly</changefreq>\n'
sitemap += '  </url>\n'
sitemap += '  <url>\n'
sitemap += '    <loc>https://xamcode.ai/accessibility-statement</loc>\n'
sitemap += '    <lastmod>2026-10-06</lastmod>\n'
sitemap += '    <changefreq>yearly</changefreq>\n'
sitemap += '  </url>\n'
sitemap += '</urlset>\n'
wf('sitemap.xml', sitemap)

print('robots.txt and sitemap.xml created!')
