'use strict';
/* Real-browser QA for the /build redesign.
   - Scrolls through the page first so .reveal animations complete,
     then captures full-page screenshots (previous captures were taken
     before IntersectionObserver fired, showing empty sections).
   - Verifies nav states per breakpoint, console cleanliness, overflow,
     mobile menu interaction, and anchor offset under the fixed dock. */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const OUT = __dirname;
const fails = [];
const ok = [];
function check(name, cond, extra){ (cond?ok:fails).push(name+(cond?'':' — '+(extra||''))); }

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:\\Users\\asus1\\AppData\\Local\\ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe' });
  const viewports = [
    { name:'desktop', w:1440, h:900 },
    { name:'tablet',  w:768,  h:1024 },
    { name:'mobile',  w:390,  h:844 },
    { name:'small',   w:360,  h:740 }
  ];
  for (const v of viewports){
    const page = await browser.newPage({ viewport:{ width:v.w, height:v.h } });
    const errors = [];
    const notFound = [];
    page.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) notFound.push(r.status()+' '+r.url()); });
    /* Resource-load 404s are tracked by URL via notFound above (the console
       copy of that message carries no URL, so only filter non-resource errors
       here to avoid duplicate/uncollectable reports). */
    page.on('console', m=>{ if(m.type()==='error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    page.on('pageerror', e=>errors.push(String(e)));
    await page.goto(BASE+'/build', { waitUntil:'networkidle' });
    await page.waitForTimeout(600);

    /* Scroll through the whole page to fire IntersectionObserver reveals.
       Use instant behavior: the page sets html{scroll-behavior:smooth},
       which would make this loop outrun the scroll and skip sections. */
    await page.evaluate(async () => {
      const step = Math.max(300, Math.floor(window.innerHeight*0.7));
      for (let y=0; y<document.documentElement.scrollHeight; y+=step){
        window.scrollTo({ top:y, behavior:'instant' });
        await new Promise(r=>setTimeout(r,140));
      }
      window.scrollTo({ top:0, behavior:'instant' });
    });
    await page.waitForTimeout(2000);

    /* Every .reveal must now be visible. */
    const hidden = await page.evaluate(() => {
      const out=[];
      document.querySelectorAll('.reveal').forEach(el=>{
        const r=el.getBoundingClientRect(), s=getComputedStyle(el);
        if(parseFloat(s.opacity)<0.99) out.push(el.className+' opacity='+s.opacity);
      });
      return out;
    });
    check(v.name+': all .reveal sections visible after scroll', hidden.length===0, hidden.join(' | '));

    /* No status pill may spill outside its readiness card (overflow:hidden
       on .lr-card used to clip them on narrow screens). */
    const spill = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('.lr-card').forEach(card => {
        const cr = card.getBoundingClientRect();
        card.querySelectorAll('.pill').forEach(p => {
          const pr = p.getBoundingClientRect();
          if (pr.right > cr.right - 1 || pr.left < cr.left - 1)
            out.push((p.textContent||'').trim()+' in '+(card.querySelector('.lr-kicker')||{}).textContent);
        });
      });
      return out;
    });
    check(v.name+': readiness pills fit their cards', spill.length===0, spill.join(' | '));

    /* Honesty rule: countdown cells visible only when a date is real. */
    const cd = await page.evaluate(() => {
      const cc = document.getElementById('countCells');
      if (!cc) return { missing:true };
      const shown = cc.hasAttribute('hidden') ? false : getComputedStyle(cc).display !== 'none';
      return { shown, state:((document.getElementById('launchState')||{}).textContent||'') };
    });
    const expectsCells = !/not set/i.test(cd.state||'');
    const pending = !cd.state || /^\s*[—-]\s*$/.test(cd.state);
    check(v.name+': countdown cells match launch state', !cd.missing && (pending || cd.shown===expectsCells), JSON.stringify(cd));

    /* No horizontal overflow. */
    const over = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      win: window.innerWidth
    }));
    check(v.name+': no horizontal overflow', over.doc <= over.win+1, JSON.stringify(over));

    /* Section content actually rendered (non-empty bounding boxes). */
    const empty = await page.evaluate(() => {
      const ids=['progress','roadmap','activity','launch'];
      return ids.filter(id=>{
        const s=document.getElementById(id);
        if(!s) return true;
        return s.getBoundingClientRect().height < 120;
      });
    });
    check(v.name+': key sections have real height', empty.length===0, 'too short: '+empty.join(','));

    /* Nav breakpoint behaviour. */
    const nav = await page.evaluate(() => {
      const cs = el => el ? getComputedStyle(el).display : 'absent';
      return {
        docknav: cs(document.querySelector('.docknav')),
        mbtn: cs(document.getElementById('menuBtn')),
        live: cs(document.getElementById('liveBadge')),
        links: document.querySelectorAll('.docknav a').length,
        fnav: document.querySelectorAll('.fnav a').length
      };
    });
    if (v.w >= 961){
      check(v.name+': inline nav visible, MENU hidden', nav.docknav!=='none' && nav.mbtn==='none', JSON.stringify(nav));
    } else {
      check(v.name+': MENU button visible, docknav hidden', nav.docknav==='none' && nav.mbtn!=='none', JSON.stringify(nav));
      /* Mobile menu interaction. */
      await page.click('#menuBtn');
      await page.waitForTimeout(500);
      const opened = await page.evaluate(() => {
        const ov=document.getElementById('menuOverlay');
        return ov && ov.classList.contains('show') && ov.getAttribute('aria-hidden')==='false'
          && document.getElementById('menuBtnLabel').textContent==='CLOSE';
      });
      check(v.name+': menu opens (aria-expanded/label/overlay)', !!opened);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      const closed = await page.evaluate(() => {
        const ov=document.getElementById('menuOverlay');
        return ov && !ov.classList.contains('show') && ov.getAttribute('aria-hidden')==='true';
      });
      check(v.name+': Escape closes menu', !!closed);
    }
    if (v.w <= 1120 && v.w >= 961){
      check(v.name+': live badge hidden in tight band', nav.live==='none', nav.live);
    }
    check(v.name+': footer nav present', nav.fnav===8, String(nav.fnav));
    /* Wordmark must not clip (overflow:hidden would silently eat letters). */
    const fm = await page.evaluate(() => {
      const el = document.querySelector('.fmark');
      return el ? { c: el.clientWidth, s: el.scrollWidth } : null;
    });
    check(v.name+': footer wordmark fully visible', fm && fm.s <= fm.c + 1, JSON.stringify(fm));
    check(v.name+': 7 inline section links', nav.links===7, String(nav.links));

    /* Anchor offset: heading must not hide behind the fixed dock. */
    if (v.w >= 961){
      await page.click('.docknav a[href="#roadmap"]');
      await page.waitForTimeout(900);
      const off = await page.evaluate(() => {
        const h=document.getElementById('roadmap').getBoundingClientRect();
        const d=document.querySelector('.dock').getBoundingClientRect();
        return { top:h.top, dockBottom:d.bottom };
      });
      check(v.name+': #roadmap clears the dock after nav click', off.top >= off.dockBottom-4, JSON.stringify(off));
    }

    /* --- Keyboard accessibility (Phase 7) --- */
    /* Reload first: blur() does not reset Chromium's sequential-focus
       starting point, so a stale point would skew the "first Tab" result. */
    await page.reload({ waitUntil:'networkidle' });
    await page.waitForTimeout(500);
    /* Chromium restores scroll position across reload — return to the top
       so the absolutely-positioned skip link (anchored to the document
       origin) is in the viewport when focused. */
    await page.evaluate(() => window.scrollTo({ top:0, behavior:'instant' }));
    await page.keyboard.press('Tab');
    await page.waitForTimeout(400); /* let the :focus top transition finish */
    const skip = await page.evaluate(() => {
      const a = document.activeElement;
      if (!a || a.className !== 'skip') return { first:(a&&(a.className||a.tagName))||'none' };
      const r = a.getBoundingClientRect();
      return { first:'skip', visible: r.top >= 0 && r.height > 0, rect:{t:Math.round(r.top),h:Math.round(r.height)}, focus:a.matches(':focus') };
    });
    check(v.name+': first Tab lands on visible skip link', skip.first==='skip' && skip.visible, JSON.stringify(skip)+(skip.first==='skip'?' rect='+JSON.stringify(skip.rect):''));
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const afterSkip = await page.evaluate(() => {
      const h = document.activeElement;
      return h ? (h.id || h.tagName) : 'none';
    });
    check(v.name+': skip link moves focus into #main', afterSkip==='main'||afterSkip==='MAIN', afterSkip);

    /* Keyboard activation of the primary nav (or MENU on small screens). */
    if (v.w >= 961){
      await page.evaluate(() => document.querySelector('.docknav a[href="#waitlist"]').focus());
      const focused = await page.evaluate(() => document.activeElement.getAttribute('href'));
      check(v.name+': nav link focusable by keyboard', focused==='#waitlist', String(focused));
    } else {
      await page.focus('#menuBtn');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);
      const kbOpen = await page.evaluate(() => document.getElementById('menuOverlay').classList.contains('show'));
      check(v.name+': MENU opens via keyboard Enter', !!kbOpen);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    /* Form controls reachable + visible focus ring. */
    await page.focus('#waitEmail');
    const focusRing = await page.evaluate(() => {
      const el = document.getElementById('waitEmail');
      const s = getComputedStyle(el);
      return { outline:s.outlineStyle, shadow:s.boxShadow, border:s.borderTopColor };
    });
    check(v.name+': form focus state visible', focusRing.outline!=='none' || (focusRing.shadow && focusRing.shadow!=='none'), JSON.stringify(focusRing));

    check(v.name+': no console errors', errors.length===0 && notFound.length===0, errors.concat(notFound).join(' | '));

    /* Return to the very top and let parallax/transition settle before
       capture — otherwise the fixed dock lands mid-page and the hero
       parallax transform shows in the fullPage shot. The keyboard section
       reloaded the page, so re-fire the reveal observers on the way up. */
    await page.evaluate(async () => {
      const step = Math.max(300, Math.floor(window.innerHeight*0.7));
      for (let y=0; y<document.documentElement.scrollHeight; y+=step){
        window.scrollTo({ top:y, behavior:'instant' });
        await new Promise(r=>setTimeout(r,120));
      }
      window.scrollTo({ top:0, behavior:'instant' });
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/screenshot-${v.name}.png`, fullPage:true });
    await page.close();
  }
  await browser.close();
  ok.forEach(l=>console.log('  ok   '+l));
  fails.forEach(l=>console.log('  FAIL '+l));
  console.log(`\nBROWSER: ${ok.length} passed, ${fails.length} failed`);
  process.exit(fails.length?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
