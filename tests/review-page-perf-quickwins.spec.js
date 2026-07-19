const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const reviewPageSrc = fs.readFileSync('pages/review/[id].js', 'utf8');
const useLazyAgreementSourceSrc = fs.readFileSync('lib/useLazyAgreementSource.js', 'utf8');

// pages/review/[id].js is JSX and can't be imported under node --test — this
// pins the perf-package wiring via source text, matching the convention used
// throughout this repo (see tests/review-provision-card-table.test.js).

test('Q3: review page requests the slim deal header view, not the full deal row', () => {
  assert.match(reviewPageSrc, /useDeal\(dealId,\s*\{\s*view:\s*'header'\s*\}\)/);
});

test('Q4: review page defers the agreement-source fetch and fetches on-demand on open', () => {
  assert.match(reviewPageSrc, /useLazyAgreementSource\(dealId\)/);
  assert.match(reviewPageSrc, /ensureAgreementSourceLoaded/);
  // No longer an unconditional fetch()-on-mount for agreement-source.
  assert.doesNotMatch(reviewPageSrc, /fetch\(`\/api\/agreement-source/);
});

test('Q4: the overlay/agreement view surface a loading prop derived from the lazy fetch state', () => {
  assert.match(reviewPageSrc, /loading=\{sourceOverlayLoading\}/);
  assert.match(reviewPageSrc, /loading=\{sourceLoading \|\| !sourceAttempted\}/);
});

test('Q7: review page no longer loads fonts from fonts.googleapis.com', () => {
  // No <link> (stylesheet or preconnect) pointed at Google Fonts — comments
  // are allowed to reference the domain name for context.
  assert.doesNotMatch(reviewPageSrc, /<link[^>]*fonts\.(googleapis|gstatic)\.com/);
  assert.doesNotMatch(reviewPageSrc, /href=\{?["'`]?https:\/\/fonts\.googleapis\.com/);
  assert.doesNotMatch(reviewPageSrc, /const FONTS_HREF/);
});

test('Q4: useLazyAgreementSource schedules via requestIdleCallback with a setTimeout fallback, and exposes ensureLoaded for on-demand fetches', () => {
  assert.match(useLazyAgreementSourceSrc, /requestIdleCallback/);
  assert.match(useLazyAgreementSourceSrc, /setTimeout/);
  assert.match(useLazyAgreementSourceSrc, /ensureLoaded/);
  assert.match(useLazyAgreementSourceSrc, /fetchedRef\.current = true/, 'must not double-fetch once a load has started');
});

test('Q7: self-hosted font stylesheet exists and is imported globally', () => {
  const cssSrc = fs.readFileSync('styles/mtx-fonts.css', 'utf8');
  for (const family of ['Inter', 'Tinos', 'IBM Plex Mono']) {
    assert.ok(cssSrc.includes(family), `missing @font-face for ${family}`);
  }
  assert.match(cssSrc, /font-display:\s*swap/);
  // Every @font-face src must be same-origin (/fonts/...) — no url()
  // pointing at an external Google Fonts host (comments may still
  // reference the domain name for provenance/context).
  const srcUrls = [...cssSrc.matchAll(/src:\s*url\(([^)]+)\)/g)].map((m) => m[1]);
  assert.ok(srcUrls.length > 0);
  for (const url of srcUrls) {
    assert.doesNotMatch(url, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  }

  const appSrc = fs.readFileSync('pages/_app.js', 'utf8');
  assert.match(appSrc, /styles\/mtx-fonts\.css/);
});

test('Q7: every font referenced by mtx-fonts.css exists in public/fonts', () => {
  const cssSrc = fs.readFileSync('styles/mtx-fonts.css', 'utf8');
  const urls = [...cssSrc.matchAll(/url\('(\/fonts\/[^']+)'\)/g)].map((m) => m[1]);
  assert.ok(urls.length >= 8, 'expected at least 8 @font-face src urls');
  for (const url of urls) {
    const filePath = `public${url}`;
    assert.ok(fs.existsSync(filePath), `missing font file ${filePath}`);
    const buf = fs.readFileSync(filePath);
    assert.equal(buf.slice(0, 4).toString('ascii'), 'wOF2', `${filePath} is not a valid woff2 file`);
  }
});

test('Q6: cards/deals/agreement-source GET routes set the shared Cache-Control header', () => {
  const cardsSrc = fs.readFileSync('pages/api/review/[id]/cards.js', 'utf8');
  const dealsSrc = fs.readFileSync('pages/api/deals.js', 'utf8');
  const sourceSrc = fs.readFileSync('pages/api/agreement-source.js', 'utf8');
  const header = "s-maxage=300, stale-while-revalidate=3600";
  assert.match(cardsSrc, new RegExp(header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(dealsSrc, new RegExp(header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(sourceSrc, new RegExp(header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
