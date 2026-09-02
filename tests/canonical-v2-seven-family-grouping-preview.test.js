'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
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

test('seven-family grouping preview reads the exact sealed successor estate', () => {
  const preview = loadSevenFamilyGroupingPreview({ env: PREVIEW_ENV });
  assert.deepEqual(preview.review, { state: 'PASS', path: REVIEW_PATH, ...REVIEW_BINDING });
  assert.equal(preview.family_count, 7);
  assert.equal(preview.profile_count, 140);
  assert.equal(preview.comparison_row_count, 29);
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

test('approved comparison lines, links and party bands render without deal-value claims', () => {
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
  assert.match(page, /Not yet extracted in V2/);
  assert.match(page, /SevenFamilyPreview\.noLayout = true/);
  assert.doesNotMatch(page, /fetch\(|useEffect|Supabase|database_url/i);
  assert.equal(FAMILY_SOURCES.length, 7);
});

test('existing V1 values are rendered through the live review components', () => {
  const { default: SevenFamilyV1Surface } = loadEsmModule(resolveRepoPath(
    'components/review-v2/SevenFamilyV1Surface.jsx',
  ));
  const { buildSevenFamilyV1PreviewDeal } = require('../lib/canonical-v2/seven-family-v1-preview-deal');
  const reviewDeal = buildSevenFamilyV1PreviewDeal();
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
