// End-to-end acceptance test for Phase 3 of the claims-render adapter:
// flat public.claims rows -> lib/queries/review-deal.js#shapeReviewDealRows
// -> the REAL, unmodified table-configs (mae-definitions, antitrust-
// regulatory, material-contracts). If this passes, the configs light up from
// claims-table data without any changes on their side.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { shapeReviewDealRows } = require('../../lib/queries/review-deal');

let maeDefinitionsMod;
let antitrustRegulatoryMod;
let materialContractsMod;

test.before(async () => {
  maeDefinitionsMod = await import(path.join('..', '..', 'components', 'review', 'table-configs', 'mae-definitions.config.js'));
  antitrustRegulatoryMod = await import(path.join('..', '..', 'components', 'review', 'table-configs', 'antitrust-regulatory.config.js'));
  materialContractsMod = await import(path.join('..', '..', 'components', 'review', 'table-configs', 'material-contracts.config.js'));
});

function provisionCard(overrides = {}) {
  const provisionInstanceId = overrides.provision_instance_id || overrides.id;
  return {
    id: overrides.id,
    deal_id: 'deal-1',
    provision_instance_id: provisionInstanceId,
    excerpt_id: `${provisionInstanceId}:0`,
    section_ref: overrides.section_ref || 'Article I',
    short_title: overrides.short_title || 'Provision',
    kind: 'standard',
    defined_term: null,
    defined_value: null,
    references: [],
    provenance: {
      source_doc_id: 'doc-1',
      source_doc_page: 1,
      source_doc_offset_start: overrides.offset ?? 0,
      source_doc_offset_end: (overrides.offset ?? 0) + 10,
      extractor_name: 'parser-v2',
      extractor_version: 'test',
      model: 'test',
      prompt_hash: 'sha256:test',
      run_id: 'run-1',
      extracted_at: '2026-07-08T00:00:00.000Z',
    },
    ...overrides,
  };
}

function claim(overrides = {}) {
  return {
    id: overrides.id,
    deal_id: 'deal-1',
    excerpt_id: overrides.excerpt_id,
    provision_instance_id: overrides.provision_instance_id || null,
    region_id: null,
    attribute: overrides.attribute,
    verbatim: overrides.verbatim ?? null,
    evidence_quote: overrides.evidence_quote ?? null,
    canonical: overrides.canonical ?? null,
    provenance: {},
    source_provision_id: null,
    created_at: overrides.created_at || '2026-07-08T00:00:00.000Z',
    ...overrides,
  };
}

test('MAE carve-outs render as a multi-item pill list through the unmodified mae-definitions config', () => {
  const maeCard = provisionCard({
    id: 'mae-def',
    provision_type: 'MAE',
    provision_subtype: 'DEF-MAE',
    short_title: 'Company Material Adverse Effect',
  });

  const claims = [
    claim({
      id: 'cl-1', excerpt_id: 'mae-def:0', attribute: 'carveouts',
      canonical: 'ECONOMY_GENERAL', verbatim: 'general economic conditions',
      evidence_quote: 'general changes in economic conditions in the United States or globally',
      created_at: '2026-07-08T00:00:00.000Z',
    }),
    claim({
      id: 'cl-2', excerpt_id: 'mae-def:0', attribute: 'carveouts',
      canonical: null, verbatim: 'acts of war or terrorism',
      evidence_quote: 'any acts of war, armed hostilities or terrorism',
      created_at: '2026-07-08T00:00:01.000Z',
    }),
    claim({
      id: 'cl-3', excerpt_id: 'mae-def:0', attribute: 'carveouts',
      canonical: 'PANDEMIC', verbatim: 'pandemics',
      evidence_quote: 'any pandemic, epidemic or other public health crisis',
      created_at: '2026-07-08T00:00:02.000Z',
    }),
    claim({
      id: 'cl-4', excerpt_id: 'mae-def:0', attribute: 'maeLimbs',
      canonical: 'TWO_LIMB', verbatim: 'prevent or materially delay the Merger',
      evidence_quote: 'or would reasonably be expected to prevent or materially delay the Merger',
    }),
  ];

  const reviewDeal = shapeReviewDealRows('deal-1', [maeCard], { claims });
  const card = reviewDeal.cards[0];

  // Rule: claims are flat, but list attributes must rebuild as arrays — the
  // regression this whole work package exists to prevent.
  assert.ok(Array.isArray(card.features.carveouts));
  assert.equal(card.features.carveouts.length, 3, 'all three carve-out claim rows must survive, not collapse to one');

  const rows = maeDefinitionsMod.maeDefinitionsConfig.selectRows(reviewDeal);
  const carveoutsRow = rows.find((row) => row.id === 'mae-definitions-carveouts');
  assert.ok(carveoutsRow, 'carve-outs row must render');
  assert.equal(carveoutsRow.signals.length, 1);
  // readableValue resolves the taxonomy label from `code` — codes never
  // surface raw, even for the claim whose canonical came back null and had
  // to be recovered via the synonym fallback (ACTS_OF_WAR_TERRORISM).
  assert.match(carveoutsRow.signals[0].label, /^Carve-out: /);
  assert.doesNotMatch(carveoutsRow.signals[0].label, /ECONOMY_GENERAL|ACTS_OF_WAR_TERRORISM|PANDEMIC/);

  const limbsRow = rows.find((row) => row.id === 'mae-definitions-limbs');
  assert.ok(limbsRow, 'limbs row must render from the maeLimbs claim');
});

test('antitrust efforts standard renders through the antitrust-regulatory config with no term/value doubling (REBUILD-SPECS.md §8)', () => {
  const antiCard = provisionCard({
    id: 'anti-hsr',
    provision_type: 'ANTITRUST_REGULATORY',
    provision_subtype: 'ANTI-HSR',
    short_title: 'Regulatory Efforts',
  });
  const claims = [
    claim({
      id: 'cl-5', excerpt_id: 'anti-hsr:0', attribute: 'effortsStandard',
      canonical: 'REASONABLE_BEST_EFFORTS', verbatim: 'reasonable best efforts',
      evidence_quote: 'Parent shall use its reasonable best efforts to obtain clearance',
    }),
  ];
  const reviewDeal = shapeReviewDealRows('deal-1', [antiCard], { claims });
  const rows = antitrustRegulatoryMod.antitrustRegulatoryConfig.selectRows(reviewDeal);
  const efforts = rows.find((row) => row.id === 'antitrust-regulatory-efforts');
  // Term column already reads "Efforts standard" -- the pill must be the
  // resolved value alone, never "Efforts standard: Reasonable best efforts"
  // / "Reasonable best efforts: reasonable best efforts" doubling.
  assert.deepEqual(efforts.signals.map((item) => item.label), ['Reasonable best efforts']);
});

test('material-contracts buckets recover a canonical code from verbatim text when claims.canonical is null', () => {
  const mcCard = provisionCard({
    id: 'mc',
    provision_subtype: 'REP-T-MATERIAL-CONTRACTS',
    short_title: 'Material Contracts',
  });
  const claims = [
    // canonical present
    claim({
      id: 'cl-7', excerpt_id: 'mc:0', attribute: 'materialContractsBuckets',
      canonical: 'JV_PARTNERSHIPS', verbatim: 'joint venture agreements',
      evidence_quote: 'any joint venture, partnership or similar agreement',
    }),
    // canonical null — must be recovered via MATERIAL_CONTRACT_BUCKET_META synonyms
    claim({
      id: 'cl-8', excerpt_id: 'mc:0', attribute: 'materialContractsBuckets',
      canonical: null, verbatim: 'credit agreement',
      evidence_quote: 'any credit agreement, loan agreement or other indebtedness document',
      created_at: '2026-07-08T00:00:01.000Z',
    }),
  ];
  const reviewDeal = shapeReviewDealRows('deal-1', [mcCard], { claims });
  const card = reviewDeal.cards[0];
  assert.equal(card.features.materialContractsBuckets.length, 2);

  const rows = materialContractsMod.materialContractsConfig.selectRows(reviewDeal);
  const codes = rows.filter((row) => row.code).map((row) => row.code);
  assert.deepEqual(codes.sort(), ['INDEBTEDNESS', 'JV_PARTNERSHIPS']);
  // No generic "Contract type N" fallback labels — confirms isTagged() saw a
  // real string code for the canonical-null claim too.
  const labels = rows.filter((row) => row.code).map((row) => row.label);
  assert.ok(labels.every((label) => !/^Contract type \d+$/.test(label)), `unexpected fallback label in ${JSON.stringify(labels)}`);
});

test('an attribute with zero claims for a card renders as absent, not a null/empty pill', () => {
  const card = provisionCard({ id: 'mae-empty', provision_type: 'MAE', provision_subtype: 'DEF-MAE', short_title: 'MAE' });
  const reviewDeal = shapeReviewDealRows('deal-1', [card], { claims: [] });
  assert.deepEqual(reviewDeal.cards[0].features, {});
  const rows = maeDefinitionsMod.maeDefinitionsConfig.selectRows(reviewDeal);
  assert.equal(rows.length, 0);
});
