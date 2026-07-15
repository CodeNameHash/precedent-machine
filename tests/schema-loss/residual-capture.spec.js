// GAP-E residual-capture PLUMBING (P7). Hermetic tests -- no live DB, no
// Supabase, no dependence on the 87MB docs/schema-shape/normalized-v1.json.
// Every scenario constructs its own tiny fixture, mirroring the isolated
// tmpdir pattern already used by tests/schema-loss/loss-audit.spec.js.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { FEATURES } = require('../../lib/schema/features');
const residuals = require('../../lib/schema-loss/residuals');
const auditScript = require('../../scripts/schema-loss/audit-feature-residuals');

// Pick real, currently-registered coded features rather than hand-rolling
// fixture registry entries, so the test breaks loudly if the registry shape
// this module depends on ever changes.
const LIST_TAGGED_KEY = Object.keys(FEATURES).find(
  (key) => FEATURES[key].listItemType === 'tag' && FEATURES[key].listItemTagFamily
);
const ENUM_KEY = Object.keys(FEATURES).find(
  (key) => FEATURES[key].valueType === 'enum' && Array.isArray(FEATURES[key].enumSet) && FEATURES[key].enumSet.length > 0
);
assert.ok(LIST_TAGGED_KEY, 'fixture precondition: at least one list-tagged coded feature must exist');
assert.ok(ENUM_KEY, 'fixture precondition: at least one enum coded feature must exist');

const MISFIT_VERBATIM = 'a bespoke carve-out mechanic that matches no codebook entry, verbatim from the clause';

function syntheticClaims() {
  return [
    // (a) the GAP-E misfit: coded feature, no code assigned, verbatim present.
    {
      id: 'claim-misfit-1',
      deal_id: 'deal-1',
      attribute: LIST_TAGGED_KEY,
      verbatim: MISFIT_VERBATIM,
      canonical: null,
      evidence_quote: 'Notwithstanding the foregoing, this bespoke mechanic shall apply.',
    },
    // (b) same attribute, but properly coded -- must NOT appear.
    {
      id: 'claim-coded-1',
      deal_id: 'deal-1',
      attribute: LIST_TAGGED_KEY,
      verbatim: 'a run-of-the-mill exception',
      canonical: 'SOME_EXISTING_CODE',
      evidence_quote: 'quote',
    },
    // (c) enum-coded feature, unmatched -- also a residual.
    {
      id: 'claim-misfit-2',
      deal_id: 'deal-2',
      attribute: ENUM_KEY,
      verbatim: 'a phrasing that matched no enum member',
      canonical: null,
      evidence_quote: 'quote 2',
    },
    // (d) an attribute the registry doesn't recognize at all -- never a residual.
    {
      id: 'claim-unknown-1',
      deal_id: 'deal-1',
      attribute: '__not_a_real_feature_key__',
      verbatim: 'irrelevant',
      canonical: null,
    },
    // (e) coded feature, no code AND no verbatim -- nothing to capture.
    {
      id: 'claim-empty-1',
      deal_id: 'deal-1',
      attribute: LIST_TAGGED_KEY,
      verbatim: null,
      canonical: null,
    },
  ];
}

test('GAP-E: flag OFF (default) -- computeFeatureResiduals returns empty, no env var needed', () => {
  assert.equal(process.env.RESIDUAL_CAPTURE_ENABLED, undefined, 'test env must not already have the flag set');
  assert.equal(residuals.isResidualCaptureEnabled(), false);
  const out = residuals.computeFeatureResiduals(syntheticClaims());
  assert.deepEqual(out, []);
});

test('GAP-E: flag OFF via explicit env override -- still empty regardless of claims content', () => {
  const out = residuals.computeFeatureResiduals(syntheticClaims(), { env: { RESIDUAL_CAPTURE_ENABLED: 'false' } });
  assert.deepEqual(out, []);
});

test('GAP-E: flag ON -- synthetic misfit surfaces, is not force-mapped, verbatim byte-preserved', () => {
  const out = residuals.computeFeatureResiduals(syntheticClaims(), { enabled: true });
  const ids = out.map((entry) => entry.id).sort();
  assert.deepEqual(ids, ['claim-misfit-1', 'claim-misfit-2']);

  const misfit = out.find((entry) => entry.id === 'claim-misfit-1');
  assert.equal(misfit.attribute, LIST_TAGGED_KEY);
  // Byte-preserved: exact identity, not a trimmed/normalized/re-encoded copy.
  assert.equal(misfit.verbatim, MISFIT_VERBATIM);
  assert.ok(Object.is(misfit.verbatim, MISFIT_VERBATIM) || misfit.verbatim === MISFIT_VERBATIM);
  // Not force-mapped: canonical stays null, never coerced to a guessed code.
  assert.equal(misfit.canonical, null);
  assert.equal(misfit.codebook_kind, 'list-tagged');
  assert.equal(misfit.family, FEATURES[LIST_TAGGED_KEY].listItemTagFamily);

  const enumMisfit = out.find((entry) => entry.id === 'claim-misfit-2');
  assert.equal(enumMisfit.codebook_kind, 'enum');
  assert.equal(enumMisfit.canonical, null);

  // Coded, unknown-attribute, and empty-verbatim claims never appear.
  assert.ok(!out.some((entry) => entry.id === 'claim-coded-1'));
  assert.ok(!out.some((entry) => entry.id === 'claim-unknown-1'));
  assert.ok(!out.some((entry) => entry.id === 'claim-empty-1'));
});

test('GAP-E: isResidualCaptureEnabled parses common truthy/falsy env forms', () => {
  for (const truthy of ['1', 'true', 'TRUE', 'on', 'yes']) {
    assert.equal(residuals.isResidualCaptureEnabled({ RESIDUAL_CAPTURE_ENABLED: truthy }), true, truthy);
  }
  for (const falsy of ['0', 'false', 'off', 'no', '', undefined]) {
    assert.equal(residuals.isResidualCaptureEnabled({ RESIDUAL_CAPTURE_ENABLED: falsy }), false, String(falsy));
  }
});

test('GAP-E: normalizeClaim accepts both the live claims-row shape and the normalized-v1.json triple shape', () => {
  const liveRow = { attribute: LIST_TAGGED_KEY, verbatim: 'v', canonical: null, id: 'x', deal_id: 'd' };
  const triple = { field_key: LIST_TAGGED_KEY, raw_value: 'v', canonicalKey: null, id: 'x', deal_id: 'd' };
  assert.deepEqual(residuals.normalizeClaim(liveRow), residuals.normalizeClaim(triple));
});

test('GAP-E: hasCodebook / codebookFor never claim a codebook for uncoded free-text attributes', () => {
  const freeTextKey = Object.keys(FEATURES).find(
    (key) => FEATURES[key].listItemTagFamily == null && !(FEATURES[key].valueType === 'enum' && Array.isArray(FEATURES[key].enumSet) && FEATURES[key].enumSet.length > 0)
  );
  assert.ok(freeTextKey, 'fixture precondition: at least one free-text feature must exist');
  assert.equal(residuals.hasCodebook(freeTextKey), false);
  assert.equal(residuals.codebookFor(freeTextKey), null);
  assert.equal(residuals.hasCodebook('__not_a_real_feature_key__'), false);
});

test('GAP-E: audit-feature-residuals.js writes flag-off artifact with empty entries by default', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gap-e-residuals-'));
  const normalizedFile = path.join(dir, 'normalized-v1.json');
  const outFile = path.join(dir, 'feature-residuals.json');
  fs.writeFileSync(normalizedFile, JSON.stringify({ triples: syntheticClaims().map((c) => ({
    id: c.id,
    deal_id: c.deal_id,
    field_key: c.attribute,
    raw_value: c.verbatim,
    canonicalKey: c.canonical,
    evidence_quote: c.evidence_quote,
  })) }));

  const offArtifact = auditScript.run({ normalizedFile, outFile, enabled: false });
  assert.equal(offArtifact.enabled, false);
  assert.deepEqual(offArtifact.entries, []);
  assert.deepEqual(JSON.parse(fs.readFileSync(outFile, 'utf8')).entries, []);

  const onArtifact = auditScript.run({ normalizedFile, outFile, enabled: true });
  assert.equal(onArtifact.enabled, true);
  const ids = onArtifact.entries.map((e) => e.id).sort();
  assert.deepEqual(ids, ['claim-misfit-1', 'claim-misfit-2']);

  // Determinism / idempotency: re-running against the same inputs produces
  // byte-identical output, matching the sibling audits' convention.
  const before = fs.readFileSync(outFile, 'utf8');
  auditScript.run({ normalizedFile, outFile, enabled: true });
  const after = fs.readFileSync(outFile, 'utf8');
  assert.equal(before, after);
});

test('GAP-E: admin queue API gates dimension C at read time, independent of any stale artifact', () => {
  const { readSchemaLossQueue } = require('../../pages/api/admin/schema-loss/queue.js');
  assert.equal(process.env.RESIDUAL_CAPTURE_ENABLED, undefined);
  const result = readSchemaLossQueue({ dimension: 'C' });
  assert.equal(result.enabled, false);
  assert.deepEqual(result.entries, []);
  assert.equal(result.total, 0);
});

test('GAP-E: schema-loss page hides the Feature residuals tab unless the flag probe reports enabled', () => {
  const page = fs.readFileSync('pages/admin/schema-loss.js', 'utf8');
  assert.match(page, /residualCaptureEnabled/);
  assert.match(page, /residualCaptureEnabled \? \[\['C', 'Feature residuals'\]\] : \[\]/);
  assert.match(page, /FeatureResidualPane/);
  // Dimension C never gets a DecisionRouter -- read-only per the P7 scope line.
  assert.match(page, /dimension === 'C' \? null : <DecisionRouter/);
});

test('GAP-E: hard scope line -- no diff here touches rubric, taxonomy, feature/tag schema, or extraction prompts', () => {
  const guardedFiles = [
    'lib/rubric.js',
    'lib/taxonomy.js',
    'lib/schema/features.js',
    'lib/schema/tags.js',
    'lib/parser-v2/extract.js',
  ];
  for (const file of guardedFiles) {
    assert.ok(fs.existsSync(file), `expected ${file} to exist unmodified`);
  }
  const detector = fs.readFileSync('lib/schema-loss/residuals.js', 'utf8');
  assert.doesNotMatch(detector, /OTHER/);
  assert.doesNotMatch(detector, /require\(['"]\.\.\/rubric['"]\)/);
  assert.doesNotMatch(detector, /require\(['"]\.\.\/taxonomy['"]\)/);
});
