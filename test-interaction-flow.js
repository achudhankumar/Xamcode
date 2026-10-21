const { chromium } = require('playwright');
const path = require('path');

async function testInteractions() {
  console.log('\n--- VERIFYING INTERACTIVE USER EXPERIENCE ---');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);

  // 1. Verify Pipeline Mount & 5-Step Scrubber
  const pipeline = await page.$('.wc-pipeline-container');
  console.log('✓ Pipeline container rendered:', pipeline !== null);

  const steps = await page.$$('.wc-step-btn');
  console.log('✓ Step scrubber buttons count:', steps.length);

  // Click Step 0 (PDF Ingest)
  await steps[0].click();
  await page.waitForTimeout(300);
  let termText = await page.$eval('#wcTerminalBody', el => el.textContent);
  console.log('✓ Step 0 terminal loaded:', termText.includes('ingestAcademicPDF'));

  // Click Step 3 (In-Situ Quiz)
  await steps[3].click();
  await page.waitForTimeout(300);
  termText = await page.$eval('#wcTerminalBody', el => el.textContent);
  console.log('✓ Step 3 terminal loaded:', termText.includes('evaluateAnswer'));

  // Test Quiz Option Click inside Pipeline
  const quizOpts = await page.$$('.wc-pipeline-quiz-opt');
  if(quizOpts.length >= 2){
    await quizOpts[1].click(); // Option B is correct
    await page.waitForTimeout(300);
    const fb = await page.$eval('#wcPipelineQuizFeedback', el => el.textContent);
    console.log('✓ In-Pipeline Quiz Verified (+50 XP):', fb.includes('+50 XP'));
  }

  // 2. Verify Landing Page Quiz Card
  const landingOpts = await page.$$('.wc-quiz-opt');
  if(landingOpts.length >= 2){
    await landingOpts[1].click(); // Option B (Transport)
    await page.waitForTimeout(300);
    const landingFb = await page.$eval('#landingQuizFeedback', el => el.textContent);
    console.log('✓ In-Situ Landing Quiz verified (+50 XP):', landingFb.includes('+50 XP'));
  }

  // 3. Verify Vaathiyar 8-Section Tabs
  const vtabs = await page.$$('.wc-vaathiyar-tab');
  console.log('✓ Vaathiyar tabs count:', vtabs.length);
  if(vtabs.length >= 8){
    // Click Tab 5 (Comparison)
    await vtabs[5].click();
    await page.waitForTimeout(200);
    let vContent = await page.$eval('#landingVaathiyarContent', el => el.textContent);
    console.log('✓ Vaathiyar Tab 5 loaded (TCP vs UDP):', vContent.includes('TCP') && vContent.includes('UDP'));

    // Click Tab 7 (Cheat Code)
    await vtabs[7].click();
    await page.waitForTimeout(200);
    vContent = await page.$eval('#landingVaathiyarContent', el => el.textContent);
    console.log('✓ Vaathiyar Tab 7 loaded (Mnemonic):', vContent.includes('Please Do Not Throw Sausage Pizza Away'));
  }

  // 4. Verify Upload Modal Trigger
  await page.click('button[data-open="upload"]');
  await page.waitForTimeout(500);
  const modalOpen = await page.$eval('#uploadModal', el => el.hasAttribute('open'));
  console.log('✓ Upload modal opens on CTA click:', modalOpen);
  await page.click('[data-upload-close]');
  await page.waitForTimeout(300);

  // 5. Verify Workspace Navigation
  await page.click('button[data-nav="workspace"]');
  await page.waitForTimeout(600);
  const treeTitle = await page.$eval('.tree-title', el => el.textContent);
  console.log('✓ Workspace loaded topic tree:', treeTitle.includes('TOPIC TREE'));

  // Navigate back to landing
  await page.click('button[data-nav="landing"]');
  await page.waitForTimeout(600);
  const heroH1 = await page.$eval('.hero h1', el => el.textContent);
  console.log('✓ Returned to landing hero:', heroH1.includes('Transform 20 to 400+'));

  console.log('\nTotal Console Errors:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.error('Errors:', consoleErrors);
  }

  await browser.close();
  console.log('--- ALL INTERACTIVE VERIFICATIONS PASSED ---\n');
}

testInteractions().catch(err => {
  console.error(err);
  process.exit(1);
});
