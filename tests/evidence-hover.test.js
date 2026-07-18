// GD 11 (repeat) — popover bolding for VALUE-backed cells (Yes/No/pill
// derived value, not the raw-text-cell case which already worked). Root
// cause: the popover's `quote` WAS the whole excerpt, so there was nothing
// to bold against; the earlier "empty cell" bolding fix never wired
// `highlight` through for a populated value. lib/citable.js's evidenceHover
// pairs a wider-context `quote` with the supporting excerpt as `highlight`
// whenever the excerpt is a genuine, strictly-shorter substring of the
// provision's full_text.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

let citable;
test.before(async () => {
  citable = await import(path.join('..', 'lib', 'citable.js'));
});

test('evidenceHover: a real citable quote gets the full provision text as context, with the quote as the bolded highlight', () => {
  const fullText = 'SECTION 6.05. Indemnification. (a) All rights to indemnification existing in favor of any present or former director or officer of the Company shall survive the Merger. With respect to all compensation and benefit plans, each employee’s prior service shall be treated as service with Parent.';
  const rawValue = {
    value: true,
    quotes: ["each employee’s prior service shall be treated as service with Parent"],
  };
  const hover = citable.evidenceHover(rawValue, { provision: { full_text: fullText } });
  assert.equal(hover.quote, fullText, 'popover body is the WIDER provision text, not just the bare excerpt');
  assert.equal(hover.highlight, "each employee’s prior service shall be treated as service with Parent");
  assert.ok(fullText.includes(hover.highlight), 'the highlight is a literal substring of the quote shown — never invented');
});

test('evidenceHover: D&O-advancement-shaped fixture — a bare boolean feature (advancementOfExpenses=true, no citable wrapper) with a long full_text still gets a highlight span, never a bare degenerate popover', () => {
  const fullText = 'SECTION 6.05. Indemnification. '.padEnd(700, 'x'); // > EVIDENCE_SLICE (600) so the fallback excerpt is a genuine slice, not the whole text
  const rawValue = true; // advancementOfExpenses is stored as a bare boolean on real Metsera data
  const hover = citable.evidenceHover(rawValue, { provision: { full_text: fullText } });
  assert.ok(hover.quote, 'popover still renders something');
  assert.equal(hover.quote, fullText, 'context is the full provision text');
  assert.ok(hover.highlight, 'a highlight span is present (the evidence-fallback excerpt), never null when full_text is longer than the excerpt');
  assert.ok(fullText.includes(hover.highlight));
});

test('evidenceHover: no full_text available — falls back to the bare excerpt with no highlight (nothing to bold against)', () => {
  const rawValue = { value: true, quotes: ['a short verbatim clause'] };
  const hover = citable.evidenceHover(rawValue, {});
  assert.equal(hover.quote, 'a short verbatim clause');
  assert.equal(hover.highlight, null);
});

test('evidenceHover: excerpt equals full_text verbatim (nothing wider to show) — no highlight, no duplication', () => {
  const text = 'A short provision with one sentence.';
  const hover = citable.evidenceHover({ value: true, quotes: [text] }, { provision: { full_text: text } });
  assert.equal(hover.quote, text);
  assert.equal(hover.highlight, null);
});

test('evidenceHover: no evidence and no provision full_text returns all-null', () => {
  const hover = citable.evidenceHover(null, {});
  assert.deepEqual(hover, { quote: null, highlight: null, primaryQuote: null });
});

/* ── Wiring: DefaultFeatureRow (and the two D&O cell renderers) use
   evidenceHover so bolding applies wherever these shared row/cell renderers
   are used — pages/review/[id].js is JSX and can't be imported under
   node --test (see tests/fb3-wiring.test.js for the established pattern). */
const reviewSrc = fs.readFileSync(path.join(__dirname, '..', 'pages', 'review-v1', '[id].js'), 'utf8');

test('DefaultFeatureRow renders the VALUE cell HoverSource with evidenceHover\'s quote + highlight', () => {
  const start = reviewSrc.indexOf('function DefaultFeatureRow(');
  assert.ok(start > 0);
  const body = reviewSrc.slice(start, reviewSrc.indexOf('\n}', start));
  assert.match(body, /evidenceHover\(hit\.value, \{ provision: hit\.provision \}\)/);
  assert.match(body, /<HoverSource quote=\{hover\.quote\} highlight=\{hover\.highlight\} as="div">/);
});

test('the D&O Insurance Cap and Period cells also use evidenceHover (fix applies to the whole D&O group, not just one field)', () => {
  assert.match(reviewSrc, /function renderDoInsuranceCapCell[\s\S]{0,400}evidenceHover\(raw, \{ provision: hit\.provision \}\)/);
  assert.match(reviewSrc, /function renderDoPeriodCell[\s\S]{0,400}evidenceHover\(raw, \{ provision: hit\.provision \}\)/);
});
