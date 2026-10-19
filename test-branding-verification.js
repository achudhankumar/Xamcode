'use strict';
const { chromium } = require('playwright');

async function runAudit() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || 'C:\\Users\\asus1\\AppData\\Local\\ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe'
  });
  const results = [];
  function assert(name, condition, details = '') {
    results.push({ name, passed: !!condition, details });
    console.log((condition ? ' PASS: ' : ' FAIL: ') + name + (details ? ' (' + details + ')' : ''));
  }

  try {
    const page = await browser.newPage();

    // 1. Audit Favicon on all pages
    const routes = [
      { url: 'http://localhost:4173/build', name: 'Build in Public' },
      { url: 'http://localhost:4173/', name: 'Home' },
      { url: 'http://localhost:4173/privacy-policy', name: 'Privacy Policy' },
      { url: 'http://localhost:4173/terms-of-service', name: 'Terms of Service' },
      { url: 'http://localhost:4173/accessibility-statement', name: 'Accessibility Statement' }
    ];

    for (const r of routes) {
      await page.goto(r.url, { waitUntil: 'domcontentloaded' });
      const favicons = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll("link[rel*='icon']"));
        return links.map(l => ({
          rel: l.rel,
          href: l.getAttribute('href'),
          sizes: l.getAttribute('sizes') || '',
          type: l.getAttribute('type') || ''
        }));
      });

      assert(`${r.name} has favicon link`, favicons.length > 0, `found ${favicons.length} icon tags`);
      const hasIco = favicons.some(f => f.href && f.href.includes('favicon.ico'));
      const has32 = favicons.some(f => f.href && f.href.includes('favicon.png'));
      const has192 = favicons.some(f => f.href && f.href.includes('favicon-192.png'));
      const hasApple = favicons.some(f => f.rel.includes('apple-touch-icon') && f.href.includes('apple-touch-icon.png'));

      assert(`${r.name} has favicon.ico`, hasIco);
      assert(`${r.name} has 32x32 png favicon`, has32);
      assert(`${r.name} has 192x192 png favicon`, has192);
      assert(`${r.name} has apple-touch-icon`, hasApple);
    }

    // 2. Desktop Footer Logo Audit on /build
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:4173/build', { waitUntil: 'networkidle' });

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const desktopLogo = await page.evaluate(() => {
      const img = document.querySelector('.footer-logo-img');
      const wrap = document.querySelector('.footer-logo-wrap');
      const brand = document.querySelector('.footer-brand');
      const fmark = document.querySelector('.fmark');
      if (!img) return null;
      const rect = img.getBoundingClientRect();
      const style = window.getComputedStyle(img);
      return {
        width: rect.width,
        height: rect.height,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        aspectRatio: rect.width / rect.height,
        objectFit: style.objectFit,
        alt: img.getAttribute('alt'),
        src: img.getAttribute('src'),
        fmarkVisible: !!fmark && fmark.clientWidth >= fmark.scrollWidth - 2
      };
    });

    assert('Desktop footer logo exists', !!desktopLogo);
    if (desktopLogo) {
      assert('Desktop logo width between 64px and 88px', desktopLogo.width >= 64 && desktopLogo.width <= 88, `got ${desktopLogo.width}px`);
      assert('Desktop logo height between 64px and 88px', desktopLogo.height >= 64 && desktopLogo.height <= 88, `got ${desktopLogo.height}px`);
      assert('Desktop logo aspect ratio is 1:1', Math.abs(desktopLogo.aspectRatio - 1) < 0.02, `ratio: ${desktopLogo.aspectRatio}`);
      assert('Desktop logo loads high-res official metallic X', desktopLogo.naturalWidth === 1024 && desktopLogo.naturalHeight === 1024, `${desktopLogo.naturalWidth}x${desktopLogo.naturalHeight}`);
      assert('Desktop logo uses object-fit: contain', desktopLogo.objectFit === 'contain');
      assert('Desktop logo has descriptive alt text', !!desktopLogo.alt && desktopLogo.alt.length > 0, desktopLogo.alt);
      assert('Desktop fmark wordmark is intact without clipping', desktopLogo.fmarkVisible);
    }

    // Take desktop screenshot of footer
    const footerEl = await page.$('.colophon');
    if (footerEl) {
      await footerEl.screenshot({ path: 'assets/preview-review/footer-desktop.png' });
      console.log('Saved assets/preview-review/footer-desktop.png');
    }

    // 3. Mobile Footer Logo Audit on /build
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:4173/build', { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const mobileLogo = await page.evaluate(() => {
      const img = document.querySelector('.footer-logo-img');
      const fmark = document.querySelector('.fmark');
      if (!img) return null;
      const rect = img.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        aspectRatio: rect.width / rect.height,
        fmarkVisible: !!fmark && fmark.clientWidth >= fmark.scrollWidth - 2
      };
    });

    assert('Mobile footer logo exists', !!mobileLogo);
    if (mobileLogo) {
      assert('Mobile logo width between 48px and 64px', mobileLogo.width >= 48 && mobileLogo.width <= 64, `got ${mobileLogo.width}px`);
      assert('Mobile logo height between 48px and 64px', mobileLogo.height >= 48 && mobileLogo.height <= 64, `got ${mobileLogo.height}px`);
      assert('Mobile logo aspect ratio is 1:1', Math.abs(mobileLogo.aspectRatio - 1) < 0.02, `ratio: ${mobileLogo.aspectRatio}`);
      assert('Mobile fmark wordmark is intact without clipping', mobileLogo.fmarkVisible);
    }

    const mobileFooterEl = await page.$('.colophon');
    if (mobileFooterEl) {
      await mobileFooterEl.screenshot({ path: 'assets/preview-review/footer-mobile.png' });
      console.log('Saved assets/preview-review/footer-mobile.png');
    }

    // 4. Reduced motion test
    const contextReduced = await browser.newContext({
      reducedMotion: 'reduce'
    });
    const pageReduced = await contextReduced.newPage();
    await pageReduced.setViewportSize({ width: 1440, height: 900 });
    await pageReduced.goto('http://localhost:4173/build', { waitUntil: 'networkidle' });
    const motionStyle = await pageReduced.evaluate(() => {
      const img = document.querySelector('.footer-logo-img');
      const brand = document.querySelector('.footer-brand');
      return {
        imgTransition: window.getComputedStyle(img).transition,
        brandTransition: window.getComputedStyle(brand).transition
      };
    });
    assert('Reduced motion disables transitions', motionStyle.imgTransition.includes('none') || motionStyle.imgTransition === 'all 0s ease 0s', `imgTransition: ${motionStyle.imgTransition}`);
    await contextReduced.close();

  } catch (err) {
    console.error('ERROR during audit:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }

  const failed = results.filter(r => !r.passed);
  console.log(`\nAUDIT COMPLETE: ${results.length - failed.length}/${results.length} passed.`);
  if (failed.length > 0) {
    console.error('Failed tests:', failed);
    process.exit(1);
  }
}

runAudit();
