#!/usr/bin/env node
// One-off Playwright screenshot script for the WP-5 SourceOverlay live
// verification gate. Not a test — run manually against `npm run dev`.
const { chromium } = require('playwright');

const DEAL_ID = '885edae5-49e8-464a-9f33-edd229119d7c'; // Metsera, Inc.
const CARD_ID = 'bb145166-b14b-49a7-b46a-65386e2cd767'; // TERMF 8.01 Effect of Termination
const OUT_DIR = process.argv[2] || 'scratch-screenshots';

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // 1. Deep-link straight to the overlay.
  await page.goto(`http://localhost:3000/review/${DEAL_ID}?card=${CARD_ID}`, { waitUntil: 'load' });
  await page.waitForSelector('.mtx-source-overlay', { timeout: 15000 });
  await page.waitForTimeout(1200); // let the scrollIntoView settle
  await page.screenshot({ path: `${OUT_DIR}/wp5-overlay-deeplink-highlight.png`, fullPage: false });

  const markCount = await page.locator('mark.mtx-doc-highlight').count();
  const markText = markCount ? await page.locator('mark.mtx-doc-highlight').first().innerText() : null;
  console.log('deep-link: mark count =', markCount, 'mark text len =', markText ? markText.length : 0);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT_DIR}/wp5-overlay-closed.png`, fullPage: false });

  // 2. ProvisionIndex "View in agreement" row affordance.
  await page.goto(`http://localhost:3000/review/${DEAL_ID}`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.locator('button:has-text("EXPAND ALL")').click();
  await page.waitForTimeout(300);
  // Open every per-section "Provisions in this section" index too.
  const toggles = page.locator('summary:has-text("Provisions in this section")');
  const toggleCount = await toggles.count();
  for (let i = 0; i < toggleCount; i++) {
    const t = toggles.nth(i);
    const isOpen = await t.evaluate((el) => el.parentElement.open);
    if (!isOpen) await t.click();
  }
  await page.waitForTimeout(300);
  const rowBtn = page.locator('[data-testid="view-in-agreement-row"]').first();
  await rowBtn.waitFor({ timeout: 10000 });
  await page.screenshot({ path: `${OUT_DIR}/wp5-provision-index-affordance.png`, fullPage: false });
  await rowBtn.click();
  await page.waitForSelector('.mtx-source-overlay', { timeout: 10000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT_DIR}/wp5-overlay-from-provision-row.png`, fullPage: false });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 3. ClauseSidebar "View in agreement" affordance. ProvisionIndex rows call
  // onSelect (opens ClauseSidebar) unless the click lands on the nested
  // "View in agreement" button or the "read clause" <details>, so target the
  // row's title cell text directly.
  const provisionLink = page
    .locator('[data-testid^="provision-table-index-"] td:has-text("Effect of Termination")')
    .first();
  if (await provisionLink.count()) {
    await provisionLink.click({ position: { x: 5, y: 5 } });
    await page.waitForSelector('[data-testid="clause-sidebar"]', { timeout: 10000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT_DIR}/wp5-clause-sidebar-affordance.png`, fullPage: false });
    const sidebarBtn = page.locator('[data-testid="view-in-agreement"]').first();
    if (await sidebarBtn.count()) {
      await sidebarBtn.click();
      await page.waitForSelector('.mtx-source-overlay', { timeout: 10000 });
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${OUT_DIR}/wp5-overlay-from-sidebar.png`, fullPage: false });
    }
  }

  // 4. Unresolved-span notice, using a card known to fail resolution.
  await page.goto(`http://localhost:3000/review/b57d0d65-d9d6-4e77-8e2e-08da4eb58f81?card=fb81cffc-0538-4cef-9381-f06c3df31155`, { waitUntil: 'load' });
  await page.waitForSelector('.mtx-source-overlay', { timeout: 15000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT_DIR}/wp5-overlay-unresolved-notice.png`, fullPage: false });

  await browser.close();
  console.log('Screenshots written to', OUT_DIR);
}

main().catch((e) => { console.error(e); process.exit(1); });
