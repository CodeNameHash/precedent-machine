// Reusable browser verification: auth past profile picker, load a deal, report
// crashes + optional content checks. Usage: node scripts/verify-page.cjs <dealId> [needle1] [needle2]...
const { chromium } = require('/home/user/precedent-machine/node_modules/playwright-core');
const PORT = process.env.VPORT || '3940';
const dealId = process.argv[2];
const needles = process.argv.slice(3);
(async () => {
  const errs = [];
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless:true, args:['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(`http://localhost:${PORT}/login`, { waitUntil:'networkidle', timeout:60000 }).catch(e=>errs.push('login '+e.message));
  await page.waitForTimeout(1500);
  for (const b of await page.$$('button')) { const t=await b.innerText().catch(()=>''); if(/ben|admin|associate/i.test(t)){ await b.click().catch(()=>{}); break; } }
  await page.waitForTimeout(2500);
  await page.goto(`http://localhost:${PORT}/review/${dealId}`, { waitUntil:'networkidle', timeout:120000 }).catch(e=>errs.push('review '+e.message));
  await page.waitForTimeout(11000);
  const res = await page.evaluate((needles)=>{
    const body = document.body.innerText;
    const out = { len: body.length, crash:/Application error|client-side exception/i.test(body), found:{} };
    for (const n of needles) out.found[n] = body.includes(n);
    return out;
  }, needles).catch(e=>({err:e.message}));
  console.log('pageerrors:', errs.length, errs.slice(0,3));
  console.log('len:', res.len, 'crash:', res.crash);
  if (res.found) console.log('found:', JSON.stringify(res.found));
  await browser.close();
})();
