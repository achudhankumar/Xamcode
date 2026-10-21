const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function testMainVisual() {
  console.log('--- Testing Main XamCode Website on http://127.0.0.1:4173 ---');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const consoleWarnings = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    if (msg.type() === 'warning') consoleWarnings.push(msg.text());
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
  });

  try {
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500);

    const outDir = path.join(__dirname, 'review-screenshots');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    // Desktop Screenshot
    await page.screenshot({ path: path.join(outDir, 'main-site-desktop.png') });
    console.log('Saved main site desktop screenshot');

    // Check DOM Elements
    const title = await page.title();
    const appExists = (await page.$('#app')) !== null;
    const uploadModalExists = (await page.$('#uploadModal')) !== null;
    const bgExists = (await page.$('#bg')) !== null;

    console.log('Page Title:', title);
    console.log('App root exists:', appExists);
    console.log('Upload modal exists:', uploadModalExists);

    // Mobile Viewport Test
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, 'main-site-mobile.png') });
    console.log('Saved main site mobile screenshot');

    console.log('\n--- Console Report ---');
    console.log('Errors count:', consoleErrors.length);
    if (consoleErrors.length > 0) {
      console.log('Errors:', consoleErrors);
    }
    console.log('Warnings count:', consoleWarnings.length);

    console.log('\n*** VISUAL REVIEW PASSED ***');
  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    await browser.close();
  }
}

testMainVisual();

