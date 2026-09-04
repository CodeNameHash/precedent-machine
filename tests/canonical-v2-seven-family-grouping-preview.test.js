'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const { loadEsmModule, resolveRepoPath } = require('../lib/review-parity/views');

const {
  FAMILY_SOURCES,
  REVIEW_BINDING,
  REVIEW_PATH,
  loadSevenFamilyGroupingPreview,
  validateSealReceipt,
} = require('../lib/canonical-v2/seven-family-grouping-preview-source');
const {
  loadSevenFamilyV2ReviewEvidence,
} = require('../lib/canonical-v2/seven-family-v2-review-evidence');

const PREVIEW_ENV = { VERCEL: '1', VERCEL_ENV: 'preview', NODE_ENV: 'production' };

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function gitBlobOid(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`, 'utf8');
  return crypto.createHash('sha1').update(header).update(bytes).digest('hex');
}

function normaliseRecordedText(value) {
  return String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number(codePoint)))
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .replace(/([“‘])\s+/g, '$1')
    .replace(/\s+([”’])/g, '$1')
    .trim();
}

async function compileServerSidePropsBundle(directory) {
  const webpackModule = require('next/dist/compiled/webpack/webpack');
  await webpackModule.init();
  const entryPath = path.join(directory, 'entry.js');
  const outputPath = path.join(directory, 'output');
  fs.writeFileSync(entryPath, [
    `'use strict';`,
    `const { loadSevenFamilyGroupingPreview } = require(${JSON.stringify(resolveRepoPath(
      'lib/canonical-v2/seven-family-grouping-preview-source.js',
    ))});`,
    'module.exports.getServerSideProps = async function getServerSideProps() {',
    '  return { props: { preview: loadSevenFamilyGroupingPreview({',
    `    env: ${JSON.stringify(PREVIEW_ENV)},`,
    '  }) } };',
    '};',
    '',
  ].join('\n'));
  const compiler = webpackModule.webpack({
    mode: 'production',
    target: 'node',
    entry: entryPath,
    output: {
      path: outputPath,
      filename: 'server.js',
      library: { type: 'commonjs2' },
    },
    optimization: { minimize: false },
  });
  try {
    await new Promise((resolve, reject) => {
      compiler.run((error, stats) => {
        if (error) return reject(error);
        if (stats.hasErrors()) {
          return reject(new Error(stats.toString({ all: false, errors: true })));
        }
        return resolve();
      });
    });
  } finally {
    await new Promise((resolve, reject) => {
      compiler.close((error) => (error ? reject(error) : resolve()));
    });
  }
  return require(path.join(outputPath, 'server.js'));
}

test('seven-family grouping preview is available only in a permitted preview runtime', () => {
  assert.equal(loadSevenFamilyGroupingPreview({
    env: { VERCEL: '1', VERCEL_ENV: 'production', NODE_ENV: 'production' },
  }), null);
  assert.equal(loadSevenFamilyGroupingPreview({
    env: { VERCEL: '1', VERCEL_ENV: 'development', NODE_ENV: 'production' },
  }), null);
  assert.equal(loadSevenFamilyGroupingPreview({ env: { NODE_ENV: 'development' } }).family_count, 7);
  assert.equal(loadSevenFamilyGroupingPreview({ env: PREVIEW_ENV }).family_count, 7);
});

test('bundled getServerSideProps can read and validate the sealed preview estate', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'seven-family-preview-bundle-'));
  try {
    const page = await compileServerSidePropsBundle(directory);
    const result = await page.getServerSideProps();
    assert.equal(result.props.preview.family_count, 7);
    assert.equal(result.props.preview.profile_count, 140);
    assert.equal(result.props.preview.claim_count, 240);
    assert.equal(result.props.preview.source_only_count, 4);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('seven-family grouping preview reads the exact sealed successor estate', () => {
  const preview = loadSevenFamilyGroupingPreview({ env: PREVIEW_ENV });
  assert.deepEqual(preview.review, { state: 'PASS', path: REVIEW_PATH, ...REVIEW_BINDING });
  assert.equal(preview.family_count, 7);
  assert.equal(preview.profile_count, 140);
  assert.equal(preview.comparison_row_count, 29);
  assert.equal(preview.claim_count, 240);
  assert.equal(preview.source_only_count, 4);
  assert.deepEqual(
    preview.families.map((family) => [family.family_key, family.profile_count, family.v2_rows.length]),
    [
      ['DIVIDENDS', 1, 1],
      ['MAE_DEFINITION', 4, 5],
      ['GUARANTY_FINANCING_PARTY', 5, 1],
      ['APPRAISAL_DISSENTERS_RIGHTS', 5, 1],
      ['FINANCING_COVENANTS', 5, 3],
      ['CONSIDERATION', 7, 2],
      ['INTERIM_OPERATING', 113, 16],
    ],
  );
  for (const family of preview.families) {
    assert.match(family.package.path, /grouping-successor-2026-09-01B\.json$/);
    assert.match(family.package.sha256, /^[0-9a-f]{64}$/);
    assert.ok(family.package.byte_length > 0);
    assert.match(family.package.family_profile_package_id, /^[0-9a-f]{64}$/);
    assert.ok(Array.isArray(family.v1.rows));
  }
  assert.deepEqual(
    preview.families.find((family) => family.family_key === 'GUARANTY_FINANCING_PARTY').v1.rows,
    [],
  );
  assert.deepEqual(
    preview.families.find((family) => family.family_key === 'FINANCING_COVENANTS').v1.rows,
    [
      'Closing Conditions: Financing / Sufficient Funds',
      'Structure / Mechanics: Marketing period',
    ],
  );
});

test('independent-review PASS is bound to its exact recorded bytes', () => {
  const reviewBytes = fs.readFileSync(REVIEW_PATH);
  assert.equal(reviewBytes.length, REVIEW_BINDING.byte_length);
  assert.equal(sha256(reviewBytes), REVIEW_BINDING.sha256);
  assert.equal(gitBlobOid(reviewBytes), REVIEW_BINDING.git_blob_oid);
  assert.match(reviewBytes.toString('utf8'), /^\*\*Result:\*\* PASS\./m);
});

test('approved comparison lines, links and party bands carry validated V2 review evidence', () => {
  const preview = loadSevenFamilyGroupingPreview({ env: PREVIEW_ENV });
  const byFamily = new Map(preview.families.map((family) => [family.family_key, family]));
  assert.deepEqual(
    byFamily.get('MAE_DEFINITION').v2_rows.map((row) => row.comparison_line),
    [
      'Definition prongs',
      'MAE Test',
      'Carve-outs',
      'Disproportionality relationships',
      'Exceptions to carve-outs',
    ],
  );
  assert.deepEqual(
    byFamily.get('CONSIDERATION').v2_rows.map((row) => [row.comparison_line, row.row_kind]),
    [
      ['Cash component', 'COMPARISON'],
      ["Appraisal / dissenters' rights", 'LINK'],
    ],
  );
  assert.deepEqual(byFamily.get('DIVIDENDS').v2_rows[0].bands, [
    { party_band: null, profile_count: 1 },
  ]);
  const interim = byFamily.get('INTERIM_OPERATING');
  const bandTotals = new Map();
  for (const row of interim.v2_rows) {
    for (const band of row.bands) {
      bandTotals.set(band.party_band, (bandTotals.get(band.party_band) || 0) + band.profile_count);
    }
  }
  assert.deepEqual(Object.fromEntries(bandTotals), { Target: 105, Parent: 8 });
  assert.deepEqual(
    interim.v2_rows.find((row) => row.comparison_line === 'Indebtedness and loans').bands,
    [
      { party_band: 'Target', profile_count: 18 },
      { party_band: 'Parent', profile_count: 1 },
    ],
  );
  for (const row of interim.v2_rows.filter((entry) => entry.bands.length === 2)) {
    assert.deepEqual(row.bands.map((band) => band.party_band), ['Target', 'Parent']);
  }
  assert.deepEqual(interim.unmeasured_concepts.map((entry) => entry.concept), [
    "affirmative-covenant band carrying V1's refined specifics",
    'asset sales / divestitures / licenses',
    'real estate / leases as its own category',
    'broader third-party-obligation guarantees beyond debt',
  ]);
});

test('every comparison row exposes its exact sealed V2 profile coverage', () => {
  const preview = loadSevenFamilyGroupingPreview({ env: PREVIEW_ENV });
  const uniqueProfiles = new Map();
  for (const family of preview.families) {
    for (const row of family.v2_rows) {
      assert.equal(row.profiles.length, row.profile_count);
      for (const profile of row.profiles) {
        assert.match(profile.profile_key, /^[0-9a-f]{64}$/);
        assert.ok(Array.isArray(profile.classification_path));
        assert.ok(profile.classification_path.length >= 1);
        assert.ok(profile.required_expression_signature.length > 0);
        assert.ok(row.bands.some((band) => band.party_band === profile.party_band));
        assert.equal(profile.extraction_state, 'COMPLETE');
        assert.equal(profile.output_disposition, 'REVIEW_ONLY');
        assert.equal(profile.source_quality, 'SUFFICIENT');
        assert.ok(profile.evidence.length > 0);
        uniqueProfiles.set(profile.profile_key, profile);
      }
    }
  }
  assert.equal(uniqueProfiles.size, 140);
  const evidence = [...uniqueProfiles.values()].flatMap((profile) => profile.evidence);
  assert.equal(evidence.filter((entry) => entry.evidence_kind === 'M4_CLAIM').length, 240);
  assert.equal(
    evidence.filter((entry) => entry.evidence_kind === 'PHASE2_SOURCE_ONLY').length,
    4,
  );
  assert.ok(evidence.filter((entry) => entry.evidence_kind === 'M4_CLAIM').every((entry) => (
    entry.claim_state === 'PRESENT'
      && entry.publication_state === 'VALIDATED'
      && entry.serving_state === 'NOT_SERVED'
      && entry.serving_reason === 'SCHEMA_APPROVAL_PENDING'
  )));
  assert.deepEqual(
    evidence
      .filter((entry) => entry.claim_definition_key === 'PER_SHARE_CASH_CONSIDERATION')
      .map((entry) => entry.canonical_value)
      .sort(),
    ['190.00', '57.00', '63.00'],
  );
  assert.deepEqual(
    evidence
      .filter((entry) => entry.claim_definition_key === 'PAYOFF_DELIVERY_LEAD_TIME_DAYS')
      .map((entry) => [entry.canonical_value, entry.attributes.day_kind, entry.attributes.delivery_stage]),
    [['1', 'BUSINESS', 'FINAL'], ['3', 'BUSINESS', 'DRAFT']],
  );
  assert.ok(evidence.some((entry) => (
    entry.claim_definition_key === 'FINANCING_OBTAIN_EFFORTS_STANDARD'
      && entry.canonical_value === 'REASONABLE_BEST_EFFORTS'
  )));
  assert.ok(evidence.some((entry) => (
    entry.claim_definition_key === 'NO_FINANCING_CONDITION_ACKNOWLEDGMENT'
      && entry.canonical_value === true
  )));
  assert.ok(evidence.some((entry) => (
    entry.claim_definition_key === 'LIMITED_GUARANTY_DELIVERED'
      && entry.attributes.guarantor_ref.includes('3G Fund VI, L.P.')
  )));
  const interim = preview.families.find((family) => family.family_key === 'INTERIM_OPERATING');
  const indebtedness = interim.v2_rows.find((row) => row.comparison_line === 'Indebtedness and loans');
  assert.ok(indebtedness.profiles.some((profile) => (
    profile.required_expression_signature
      === 'INTERIM_OPERATING::RESTRICTIVE_COVENANT::TOPBUILD_4_1_4_1_vii__IOC_RESTRICTION_PRESENT_INDEBTEDNESS_08875c21'
  )));
});

test('Interim Operating keeps threshold and exception measurement visibly open', () => {
  const preview = loadSevenFamilyGroupingPreview({ env: PREVIEW_ENV });
  const interim = preview.families.find((family) => family.family_key === 'INTERIM_OPERATING');
  const reviewEvidence = loadSevenFamilyV2ReviewEvidence().families.find(
    (family) => family.family_key === 'INTERIM_OPERATING',
  );
  const sourceTextByProfile = new Map(reviewEvidence.profiles.map((profile) => [
    profile.proposed_profile_key,
    profile.evidence[0].raw_value,
  ]));
  const profiles = interim.v2_rows.flatMap((row) => row.profiles);

  assert.equal(profiles.length, 113);
  assert.equal(new Set(profiles.map((profile) => profile.profile_key)).size, 113);
  for (const profile of profiles) {
    assert.deepEqual(
      profile.measurement_statuses.map((measurement) => ({
        field_key: measurement.field_key,
        label: measurement.label,
        measurement_state: measurement.measurement_state,
        disposition: measurement.disposition,
        value_type: measurement.value_type,
        typed_value: measurement.typed_value,
      })),
      [
        {
          field_key: 'THRESHOLD',
          label: 'Threshold',
          measurement_state: 'NOT_YET_MEASURED',
          disposition: null,
          value_type: null,
          typed_value: null,
        },
        {
          field_key: 'EXCEPTION',
          label: 'Exception',
          measurement_state: 'NOT_YET_MEASURED',
          disposition: null,
          value_type: null,
          typed_value: null,
        },
      ],
    );
    assert.equal(profile.output_disposition, 'REVIEW_ONLY');
    assert.equal(profile.evidence.length, 1);
    assert.equal(profile.evidence[0].claim_definition_key, 'IOC_RESTRICTION_PRESENT');
    assert.equal(profile.evidence[0].canonical_value, true);
    assert.equal(profile.evidence[0].raw_value, sourceTextByProfile.get(profile.profile_key));
  }

  const measurements = profiles.flatMap((profile) => profile.measurement_statuses);
  assert.equal(measurements.length, 226);
  assert.equal(measurements.filter(
    (measurement) => measurement.measurement_state === 'NOT_YET_MEASURED',
  ).length, 226);
  assert.equal(measurements.filter(
    (measurement) => measurement.disposition === 'ABSENT',
  ).length, 0);
  assert.deepEqual(interim.measurement_summary, {
    required_disposition_count: 226,
    explicit_disposition_count: 0,
    not_yet_measured_count: 226,
    absent_count: 0,
    review_only: true,
    comparison_complete: false,
    product_ready: false,
  });
});

test('a changed seal receipt cannot retain its pinned identity', () => {
  const spec = FAMILY_SOURCES.find((entry) => entry.family_key === 'MAE_DEFINITION');
  const seal = JSON.parse(fs.readFileSync(spec.seal.file, 'utf8'));
  seal.successor_disposition_binding.sha256 = '0'.repeat(64);
  assert.throws(
    () => validateSealReceipt(spec, seal),
    /MAE_DEFINITION seal receipt is invalid/,
  );
});

test('preview route stays server-derived and carries no serving or persistence path', () => {
  const page = fs.readFileSync('pages/design/canonical-v2-seven-family.js', 'utf8');
  assert.match(page, /getServerSideProps/);
  assert.match(page, /designPreviewServerSideProps/);
  assert.match(page, /loadSevenFamilyGroupingPreview/);
  assert.match(page, /SevenFamilyV1Surface/);
  assert.match(page, /buildSevenFamilyV1PreviewDeal/);
  assert.match(page, /Validated V2 review evidence/);
  assert.match(page, /Validated claims/);
  assert.match(page, /Not product-served/);
  assert.match(page, /View recorded clause text/);
  assert.doesNotMatch(page, /Not yet extracted in V2/);
  assert.match(page, /Different source sets/);
  assert.match(page, /not a same-deal or value-by-value comparison/);
  assert.match(page, /SevenFamilyPreview\.noLayout = true/);
  assert.doesNotMatch(page, /fetch\(|useEffect|Supabase|database_url/i);
  assert.equal(FAMILY_SOURCES.length, 7);
});

test('preview formats validated V2 values for legal review', () => {
  const { evidenceForComparisonRow, formatEvidenceValue } = loadEsmModule(resolveRepoPath(
    'pages/design/canonical-v2-seven-family.js',
  ));
  assert.equal(formatEvidenceValue({
    evidence_kind: 'M4_CLAIM',
    claim_definition_key: 'PER_SHARE_CASH_CONSIDERATION',
    canonical_value: '190.00',
    attributes: { currency: 'USD' },
  }), '$190.00');
  assert.equal(formatEvidenceValue({
    evidence_kind: 'M4_CLAIM',
    claim_definition_key: 'PAYOFF_DELIVERY_LEAD_TIME_DAYS',
    canonical_value: '1',
    attributes: { day_kind: 'BUSINESS', delivery_stage: 'FINAL' },
  }), '1 business day, final');
  assert.equal(formatEvidenceValue({
    evidence_kind: 'M4_CLAIM',
    claim_definition_key: 'PAYOFF_DELIVERY_LEAD_TIME_DAYS',
    canonical_value: '3',
    attributes: { day_kind: 'BUSINESS', delivery_stage: 'DRAFT' },
  }), '3 business days, draft');
  assert.equal(formatEvidenceValue({
    evidence_kind: 'M4_CLAIM',
    claim_definition_key: 'FINANCING_OBTAIN_EFFORTS_STANDARD',
    canonical_value: 'REASONABLE_BEST_EFFORTS',
    attributes: {},
  }), 'Reasonable Best Efforts');
  assert.equal(formatEvidenceValue({
    evidence_kind: 'M4_CLAIM',
    claim_definition_key: 'NO_FINANCING_CONDITION_ACKNOWLEDGMENT',
    canonical_value: true,
    attributes: {},
  }), 'No financing condition');
  assert.equal(formatEvidenceValue({ evidence_kind: 'PHASE2_SOURCE_ONLY' }), (
    'Recorded source example, no structured claim'
  ));

  const preview = loadSevenFamilyGroupingPreview({ env: PREVIEW_ENV });
  const mae = preview.families.find((family) => family.family_key === 'MAE_DEFINITION');
  const expected = new Map([
    ['Definition prongs', { count: 2, keys: ['MAE_DEFINITION_PRONG'] }],
    ['MAE Test', { count: 2, keys: ['MAE_DEFINITION_PRONG'] }],
    ['Carve-outs', { count: 11, keys: ['MAE_CARVEOUT'] }],
    ['Disproportionality relationships', {
      count: 8,
      keys: ['MAE_DISPROPORTIONALITY_CARVEBACK'],
    }],
    ['Exceptions to carve-outs', { count: 2, keys: ['MAE_CARVEOUT'] }],
  ]);
  for (const row of mae.v2_rows) {
    const displayed = row.profiles.flatMap((profile) => evidenceForComparisonRow(
      mae.family_key,
      row.comparison_line,
      profile,
    ));
    assert.equal(displayed.length, expected.get(row.comparison_line).count, row.comparison_line);
    assert.deepEqual(
      [...new Set(displayed.map((entry) => entry.claim_definition_key))],
      expected.get(row.comparison_line).keys,
      row.comparison_line,
    );
  }
  const exceptions = mae.v2_rows.find((row) => row.comparison_line === 'Exceptions to carve-outs');
  assert.deepEqual(
    exceptions.profiles.flatMap((profile) => evidenceForComparisonRow(
      mae.family_key,
      exceptions.comparison_line,
      profile,
    )).map((entry) => entry.canonical_value).sort(),
    ['FAILURE_TO_MEET_PROJECTIONS', 'STOCK_PRICE_CHANGES'],
  );
});

test('preview renders measurement status generically without claiming IOC completion', () => {
  const {
    MeasurementStatuses,
    default: SevenFamilyPreview,
    formatMeasurementValue,
  } = loadEsmModule(resolveRepoPath('pages/design/canonical-v2-seven-family.js'));
  const { buildSevenFamilyV1PreviewDeal } = require('../lib/canonical-v2/seven-family-v1-preview-deal');
  const pending = {
    field_key: 'THRESHOLD',
    label: 'Threshold',
    measurement_state: 'NOT_YET_MEASURED',
    disposition: null,
    value_type: null,
    typed_value: null,
  };
  const futurePresent = {
    field_key: 'CAP_AMOUNT',
    label: 'Cap amount',
    measurement_state: 'MEASURED',
    disposition: 'PRESENT',
    value_type: 'MONEY',
    typed_value: { amount: 5000000, currency: 'USD' },
  };

  assert.equal(formatMeasurementValue(pending), 'Not yet measured');
  assert.equal(formatMeasurementValue(futurePresent), 'USD 5000000');
  const syntheticMarkup = renderToStaticMarkup(React.createElement(
    MeasurementStatuses,
    { statuses: [futurePresent] },
  ));
  assert.match(syntheticMarkup, /Cap amount/);
  assert.match(syntheticMarkup, /USD 5000000/);

  const markup = renderToStaticMarkup(React.createElement(SevenFamilyPreview, {
    preview: loadSevenFamilyGroupingPreview({ env: PREVIEW_ENV }),
    v1ReviewDeal: buildSevenFamilyV1PreviewDeal(),
  }));
  assert.equal((markup.match(/data-measurement-state="NOT_YET_MEASURED"/g) || []).length, 226);
  assert.equal((markup.match(/data-measurement-disposition="UNSET"/g) || []).length, 226);
  assert.doesNotMatch(markup, /data-measurement-disposition="ABSENT"/);
  assert.match(markup, /226 required measurements not yet measured/);
  assert.match(markup, /Review-only/);
  assert.match(markup, /Not comparison-complete/);
  assert.match(markup, /Not product-ready/);
  assert.doesNotMatch(markup, /Extraction complete/);
  assert.doesNotMatch(markup, /Work 4 complete/i);

  const page = fs.readFileSync('pages/design/canonical-v2-seven-family.js', 'utf8');
  const genericMeasurementRenderer = page.slice(
    page.indexOf('export function formatMeasurementValue'),
    page.indexOf('export function evidenceForComparisonRow'),
  );
  assert.ok(genericMeasurementRenderer.length > 0);
  assert.doesNotMatch(
    genericMeasurementRenderer,
    /INTERIM_OPERATING|IOC_RESTRICTION_PRESENT|familyKey/,
  );
});

test('existing V1 values are rendered through the live review components', () => {
  const { default: SevenFamilyV1Surface } = loadEsmModule(resolveRepoPath(
    'components/review-v2/SevenFamilyV1Surface.jsx',
  ));
  const { buildSevenFamilyV1PreviewDeal } = require('../lib/canonical-v2/seven-family-v1-preview-deal');
  const reviewDeal = buildSevenFamilyV1PreviewDeal();
  assert.deepEqual(reviewDeal.sourceDeals, ['Pfizer / Metsera', 'Landos / AbbVie']);
  const disproportionateImpactQuote = 'except in the case of clause (A), (B), (C), (D), (E) or (I), to the extent that the Company and the Company Subsidiaries, taken as a whole, are disproportionately affected thereby as compared with other participants in the industries in which the Company and the Company Subsidiaries operate (in which case the incremental disproportionate impact or impacts may be taken into account in determining whether there has been a Company Material Adverse Effect).';
  assert.deepEqual(
    reviewDeal.cards.map((card) => ({
      id: card.id,
      provision_subtype: card.provision_subtype,
      short_title: card.short_title,
      features: card.features,
    })),
    [
      {
        id: 'metsera-mae-definition',
        provision_subtype: 'MAE-DEF',
        short_title: 'Company Material Adverse Effect',
        features: {
          maeLimbType: 'TWO_LIMB',
          carveouts: [
            {
              code: 'INDUSTRY_GENERAL',
              label: 'Industry conditions',
              text: 'changes in economic, business and financial conditions generally affecting the biopharmaceutical industry',
              hasDisproportionateImpactCarveback: true,
              disproportionality_quotes: [disproportionateImpactQuote],
            },
            {
              code: 'ECONOMY_GENERAL',
              label: 'General economic conditions',
              text: 'changes in general economic or regulatory, legislative or political conditions',
              hasDisproportionateImpactCarveback: true,
              disproportionality_quotes: [disproportionateImpactQuote],
            },
            {
              code: 'CHANGE_IN_LAW',
              label: 'Changes in law',
              text: 'changes after the date hereof in applicable Law or GAAP',
              hasDisproportionateImpactCarveback: true,
              disproportionality_quotes: [disproportionateImpactQuote],
            },
          ],
          disproportionateImpactCarveouts: [
            'INDUSTRY_GENERAL',
            'ECONOMY_GENERAL',
            'CHANGE_IN_LAW',
          ],
        },
      },
      {
        id: 'metsera-consideration',
        provision_subtype: 'CONSID-CONVERT',
        short_title: 'Conversion of Company Common Stock',
        features: { considerationType: 'cash-with-cvr', perShareAmount: 47.5 },
      },
      {
        id: 'metsera-appraisal-rights',
        provision_subtype: 'CONSID',
        short_title: 'Appraisal Rights',
        features: { appraisalRightsAvailable: true },
      },
      {
        id: 'landos-ioc-ordinary',
        provision_subtype: 'IOC-ORDINARY',
        short_title: 'Ordinary Course Obligation',
        features: {
          positiveObligations: [{
            appliesTo: ['BUSINESS'],
            obligation: 'conduct its business in the ordinary course of business as was being conducted prior to the date of this Agreement',
            efforts_standard: 'COMMERCIALLY_REASONABLE_EFFORTS',
          }],
        },
      },
      {
        id: 'landos-ioc-dividend',
        provision_subtype: 'IOC-DIVIDEND',
        short_title: 'Dividends and Distributions',
        features: {
          restrictionComponents: ['DIVIDENDS_DISTRIBUTIONS'],
          permittedExceptions: [{
            code: 'PRIOR_WRITTEN_CONSENT',
            label: 'With Parent consent',
            text: 'without the prior written consent of Parent',
          }],
          mainObligation: 'shall not declare, set aside or pay any dividend',
        },
      },
    ],
  );
  const render = (familyKey, deal = reviewDeal) => renderToStaticMarkup(React.createElement(
    SevenFamilyV1Surface,
    { familyKey, reviewDeal: deal },
  ));

  const consideration = render('CONSIDERATION');
  assert.match(consideration, /\$47\.50 in cash/);
  assert.match(consideration, /Appraisal rights/);

  const changedDeal = buildSevenFamilyV1PreviewDeal();
  changedDeal.cards.find((card) => card.id === 'metsera-consideration').features.perShareAmount = 61.25;
  const changedConsideration = render('CONSIDERATION', changedDeal);
  assert.match(changedConsideration, /\$61\.25 in cash/);
  assert.match(changedConsideration, /Recorded source evidence[\s\S]*\$47\.50 in cash/);

  const mae = render('MAE_DEFINITION');
  assert.match(mae, /Two limbs/i);
  assert.match(mae, /Industry-wide conditions/i);
  assert.match(mae, /General economic conditions/i);
  assert.match(mae, /Changes in applicable law or regulation/i);
  assert.match(mae, /incremental disproportionate impact or impacts may be taken into account/i);
  assert.match(render('APPRAISAL_DISSENTERS_RIGHTS'), /Appraisal rights/);
  assert.match(render('DIVIDENDS'), /Dividends and Distributions/);
  assert.match(render('DIVIDENDS'), /With Parent consent/);
  const interim = render('INTERIM_OPERATING');
  assert.match(interim, /Ordinary Course Obligation/i);
  assert.match(interim, /Business \/ operations/i);
  assert.match(interim, /Commercially reasonable efforts/i);
  assert.match(interim, /Dividends and Distributions/i);
  assert.match(interim, /DIVIDENDS_DISTRIBUTIONS/);
  assert.match(interim, /With Parent consent/);
  assert.match(interim, /the Company shall, and shall cause the Company Subsidiaries to, use commercially reasonable efforts/i);

  const changedMaeEvidenceDeal = buildSevenFamilyV1PreviewDeal();
  for (const carveout of changedMaeEvidenceDeal.cards.find(
    (card) => card.id === 'metsera-mae-definition',
  ).features.carveouts) {
    carveout.disproportionality_quotes = ['HOSTILE MAE CARVEBACK EVIDENCE'];
  }
  const changedMaeEvidence = render('MAE_DEFINITION', changedMaeEvidenceDeal);
  assert.match(changedMaeEvidence, /HOSTILE MAE CARVEBACK EVIDENCE/);
  assert.doesNotMatch(changedMaeEvidence, /incremental disproportionate impact or impacts may be taken into account/i);

  const changedIocEvidenceDeal = buildSevenFamilyV1PreviewDeal();
  changedIocEvidenceDeal.cards.find(
    (card) => card.id === 'landos-ioc-ordinary',
  ).primary_quote = 'HOSTILE IOC EVIDENCE';
  const changedIocEvidence = render('INTERIM_OPERATING', changedIocEvidenceDeal);
  assert.match(changedIocEvidence, /HOSTILE IOC EVIDENCE/);
  assert.doesNotMatch(changedIocEvidence, /the Company shall, and shall cause the Company Subsidiaries to, use commercially reasonable efforts/i);
});

test('every displayed V1 fixture value is bound to recorded source text', () => {
  const { buildSevenFamilyV1PreviewDeal } = require('../lib/canonical-v2/seven-family-v1-preview-deal');
  const reviewDeal = buildSevenFamilyV1PreviewDeal();
  for (const card of reviewDeal.cards) {
    const recorded = normaliseRecordedText(fs.readFileSync(card.source_path, 'utf8'));
    assert.ok(
      recorded.includes(normaliseRecordedText(card.primary_quote)),
      `${card.id} primary quote must occur in ${card.source_path}`,
    );
  }

  const mae = reviewDeal.cards.find((card) => card.id === 'metsera-mae-definition');
  assert.equal(mae.features.maeLimbType, 'TWO_LIMB');
  assert.match(mae.primary_quote, /material adverse effect on the business/);
  assert.match(mae.primary_quote, /prevent the consummation of, or materially impair the ability/);
  const maeSource = normaliseRecordedText(fs.readFileSync(mae.source_path, 'utf8'));
  for (const carveout of mae.features.carveouts) {
    assert.ok(maeSource.includes(normaliseRecordedText(carveout.text)));
    assert.equal(carveout.hasDisproportionateImpactCarveback, true);
    assert.equal(carveout.disproportionality_quotes.length, 1);
    assert.ok(maeSource.includes(normaliseRecordedText(carveout.disproportionality_quotes[0])));
  }

  const appraisal = reviewDeal.cards.find((card) => card.id === 'metsera-appraisal-rights');
  assert.equal(appraisal.features.appraisalRightsAvailable, true);
  assert.match(appraisal.primary_quote, /properly demands appraisal/);
  assert.match(appraisal.primary_quote, /Section 262 of the DGCL/);

  const ordinaryCourse = reviewDeal.cards.find((card) => card.id === 'landos-ioc-ordinary');
  assert.equal(Object.hasOwn(ordinaryCourse.features, 'ordinaryCourseCarveout'), false);
  assert.match(ordinaryCourse.primary_quote, /use commercially reasonable efforts/);
  assert.match(ordinaryCourse.primary_quote, /conduct its business in the ordinary course/);
});

test('families without an own-family V1 clause table are described without invented rows', () => {
  const { default: SevenFamilyV1Surface } = loadEsmModule(resolveRepoPath(
    'components/review-v2/SevenFamilyV1Surface.jsx',
  ));
  const { buildSevenFamilyV1PreviewDeal } = require('../lib/canonical-v2/seven-family-v1-preview-deal');
  const reviewDeal = buildSevenFamilyV1PreviewDeal();
  const render = (familyKey) => renderToStaticMarkup(React.createElement(
    SevenFamilyV1Surface,
    { familyKey, reviewDeal },
  ));

  const financing = render('FINANCING_COVENANTS');
  assert.match(financing, /No own-family V1 clause table/);
  assert.match(financing, /no matching value in this recorded example/i);
  assert.doesNotMatch(financing, /Financing cooperation required|Breach is a closing condition/);

  const guaranty = render('GUARANTY_FINANCING_PARTY');
  assert.match(guaranty, /No V1 review-page clause surface/);
  assert.doesNotMatch(guaranty, /Buyer type/);
});
