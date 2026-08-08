'use strict';

// Step 2F BREAK 5 and BREAK 6. Both were write-succeeds-then-render-fails:
// claims committed to SQL with COMMITTED receipts, and the serving
// projection threw when asked to render them. See
// docs/codex-program/notes/step-2f-breaks-5-6.md.
//
// Every "renders" case below runs against a git-tracked resolution.json from
// a real committed run, never a synthetic fixture, because the whole point of
// both breaks is that the synthetic fixtures passed while both documents
// failed. The 2026-08-08 rung-4 runs are deliberately NOT read here: they are
// not tracked, and a test that silently passes when its input is missing
// proves nothing while reading like it proves everything.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  MAE_CLAIMS,
  KeyTermsMaeProductProjectionError,
  projectKeyTermsMaeClaims,
} = require('../lib/canonical-v2/key-terms-mae-product-projection');
const {
  NoOtherRepsFraudProductProjectionError,
  projectNoOtherRepsFraudProduct,
} = require('../lib/canonical-v2/no-other-reps-fraud-product-projection');
const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');

const EVIDENCE_ROOT = path.join(__dirname, '..', 'evidence', 'canonical-v2');

function loadResolution(run) {
  const file = path.join(EVIDENCE_ROOT, run, 'resolution.json');
  assert.ok(fs.existsSync(file), `${run}/resolution.json must exist; this test is worthless without it`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function maeEntriesOf(run) {
  const keys = new Set(Object.keys(MAE_CLAIMS));
  const resolution = loadResolution(run);
  return {
    entries: resolution.resolved.filter((entry) => keys.has(entry.resolved_claim_definition_key)),
    openWorld: resolution.open_world || [],
  };
}

// ── BREAK 5 ────────────────────────────────────────────────────────────────

test('BREAK 5: TopBuild PER_LIMB disproportionality carve-backs render, label-prefixed clause bodies and all', () => {
  const { entries, openWorld } = maeEntriesOf('topbuild-mae-definition-20260807-replay');
  const carvebacks = entries.filter((entry) => (
    entry.resolved_claim_definition_key === 'MAE_DISPROPORTIONALITY_CARVEBACK'
  ));
  assert.equal(entries.length, 19);
  assert.equal(carvebacks.length, 5);
  // The precise shape that used to throw: every carve-back is PER_LIMB, and
  // not one of their quotes contains its own enumeration marker, because the
  // marker precedes the clause body and is not part of it.
  assert.ok(carvebacks.every((entry) => entry.claim.attributes.carveback_source_form === 'PER_LIMB'));
  assert.ok(carvebacks.every((entry) => entry.claim.attributes.applies_to_clause_labels
    .every((label) => !entry.claim.raw_value.includes(label))));

  const projection = projectKeyTermsMaeClaims({ resolved_entries: entries, open_world_entries: openWorld });
  assert.equal(projection.records.length, 19);
  assert.equal(projection.records.filter((record) => record.owner_family === 'MAE_DEFINITION').length, 19);
  const [rollup] = projection.mae_disproportionality_rollups;
  assert.equal(projection.mae_disproportionality_rollups.length, 1);
  assert.equal(rollup.relationship_review_items.length, 0);
  assert.equal(rollup.covered_limbs.length, 5);
  assert.equal(projection.mae_review_cards.length, 1);
  assert.ok(projection.mae_review_cards[0].primary_quote.length > 0);
});

test('BREAK 5: Modiv TRAILING_LIST carve-backs still project exactly as before the fix', () => {
  const { entries, openWorld } = maeEntriesOf('modiv-mae-definition-20260807-live');
  const carvebacks = entries.filter((entry) => (
    entry.resolved_claim_definition_key === 'MAE_DISPROPORTIONALITY_CARVEBACK'
  ));
  assert.equal(entries.length, 10);
  assert.equal(carvebacks.length, 2);
  assert.ok(carvebacks.every((entry) => entry.claim.attributes.carveback_source_form === 'TRAILING_LIST'));

  const projection = projectKeyTermsMaeClaims({ resolved_entries: entries, open_world_entries: openWorld });
  // 8, not 10: both TRAILING_LIST carve-backs quarantine into
  // relationship_review_items and surface through the rollups instead. That
  // was true before this fix and is unchanged by it.
  assert.equal(projection.records.length, 8);
  assert.equal(projection.mae_disproportionality_rollups.length, 2);
  assert.equal(projection.mae_review_cards.length, 2);
});

// Relabelling to a real sibling limb, not to a nonsense label: a label that
// matches no limb at all is quarantined into relationship_review_items by
// buildMaeDisproportionalityRollups (PER_LIMB_TARGET_LIMB_NOT_FOUND) before
// projectEntry ever sees it, so it would never reach the guard under test.
// (C) is a genuine TopBuild carve-out limb and appears in neither (B)'s quote
// nor (B)'s governing context — a misattribution the rollup builder cannot
// catch, which is precisely what this guard is for.
function relabelCarveback(entries, fromLabel, toLabel) {
  return entries.map((entry) => {
    if (entry.resolved_claim_definition_key !== 'MAE_DISPROPORTIONALITY_CARVEBACK') return entry;
    if (entry.claim.attributes.applies_to_clause_labels[0] !== fromLabel) return entry;
    return {
      ...entry,
      claim: {
        ...entry.claim,
        attributes: { ...entry.claim.attributes, applies_to_clause_labels: [toLabel], limb_path: [toLabel] },
      },
    };
  });
}

test('BREAK 5: a PER_LIMB label grounded in neither the quote nor the governing context fails loudly', () => {
  const { entries, openWorld } = maeEntriesOf('topbuild-mae-definition-20260807-replay');
  const tampered = relabelCarveback(entries, '(B)', '(C)');
  assert.throws(
    () => projectKeyTermsMaeClaims({ resolved_entries: tampered, open_world_entries: openWorld }),
    (error) => error instanceof KeyTermsMaeProductProjectionError
      && error.code === 'CARVEBACK_CLAUSE_LABEL_UNGROUNDED'
      && error.details.clause_label === '(C)'
      && error.details.carveback_source_form === 'PER_LIMB'
      && typeof error.details.claim_revision_id === 'string',
  );
});

test('BREAK 5: a PER_LIMB label sitting AFTER its quote in the governing context is refused', () => {
  const { entries, openWorld } = maeEntriesOf('topbuild-mae-definition-20260807-replay');
  const tampered = entries.map((entry) => {
    if (entry.resolved_claim_definition_key !== 'MAE_DISPROPORTIONALITY_CARVEBACK') return entry;
    // Same real label and real quote, but the marker now trails the body.
    // An enumeration marker precedes its clause; a trailing one is not the
    // structural evidence the label claims to have.
    const label = entry.claim.attributes.applies_to_clause_labels[0];
    return { ...entry, governing_context_quote: `${entry.claim.raw_value} ${label}` };
  });
  assert.throws(
    () => projectKeyTermsMaeClaims({ resolved_entries: tampered, open_world_entries: openWorld }),
    (error) => error instanceof KeyTermsMaeProductProjectionError
      && error.code === 'CARVEBACK_CLAUSE_LABEL_UNGROUNDED',
  );
});

test('BREAK 5: a PER_LIMB quote that is not in its own governing context is refused', () => {
  const { entries, openWorld } = maeEntriesOf('topbuild-mae-definition-20260807-replay');
  const tampered = entries.map((entry) => {
    if (entry.resolved_claim_definition_key !== 'MAE_DISPROPORTIONALITY_CARVEBACK') return entry;
    return { ...entry, governing_context_quote: 'text this quote was never drawn from' };
  });
  assert.throws(
    () => projectKeyTermsMaeClaims({ resolved_entries: tampered, open_world_entries: openWorld }),
    (error) => error instanceof KeyTermsMaeProductProjectionError
      && error.code === 'CARVEBACK_CLAUSE_LABEL_UNGROUNDED',
  );
});

test('BREAK 5: TRAILING_LIST label containment is unchanged — the quote, not the context, is its evidence', () => {
  const { entries, openWorld } = maeEntriesOf('modiv-mae-definition-20260807-live');
  // (e) is a real Modiv carve-out limb, so the rollup builder resolves it and
  // does not quarantine it. It appears in the proviso's governing context but
  // NOT in the proviso's own quote. A PER_LIMB label in that position would be
  // grounded; a TRAILING_LIST one must not be, because a trailing proviso
  // recites the clauses it reaches inside its own text and that recitation is
  // the only evidence of its scope. Confirmed on the real entry before
  // asserting: quote.includes('(e)') === false, context.includes('(e)') === true.
  const [carveback] = entries.filter((entry) => (
    entry.resolved_claim_definition_key === 'MAE_DISPROPORTIONALITY_CARVEBACK'
  ));
  assert.equal(carveback.claim.raw_value.includes('(e)'), false);
  assert.equal(carveback.governing_context_quote.includes('(e)'), true);
  const tampered = entries.map((entry) => {
    if (entry.resolved_claim_definition_key !== 'MAE_DISPROPORTIONALITY_CARVEBACK') return entry;
    return {
      ...entry,
      claim: { ...entry.claim, attributes: { ...entry.claim.attributes, applies_to_clause_labels: ['(e)'] } },
    };
  });
  assert.throws(
    () => projectKeyTermsMaeClaims({ resolved_entries: tampered, open_world_entries: openWorld }),
    (error) => error instanceof KeyTermsMaeProductProjectionError
      && error.code === 'CARVEBACK_CLAUSE_LABEL_UNGROUNDED'
      && error.details.clause_label === '(e)'
      && error.details.carveback_source_form === 'TRAILING_LIST',
  );
});

test('BREAK 5: the comparison baseline must still be verbatim in the quote', () => {
  const { entries, openWorld } = maeEntriesOf('topbuild-mae-definition-20260807-replay');
  const tampered = entries.map((entry) => {
    if (entry.resolved_claim_definition_key !== 'MAE_DISPROPORTIONALITY_CARVEBACK') return entry;
    return {
      ...entry,
      claim: {
        ...entry.claim,
        attributes: { ...entry.claim.attributes, comparison_baseline_phrase: 'others in some other industry' },
      },
    };
  });
  assert.throws(
    () => projectKeyTermsMaeClaims({ resolved_entries: tampered, open_world_entries: openWorld }),
    (error) => error instanceof KeyTermsMaeProductProjectionError
      && error.code === 'INVALID_GOVERNED_ATTRIBUTES'
      && error.details.comparison_baseline_phrase === 'others in some other industry',
  );
});

// ── BREAK 6 ────────────────────────────────────────────────────────────────

const NORF_RUNS = ['modiv-no-other-reps-20260807-replay', 'modiv-no-other-reps-20260806'];

for (const run of NORF_RUNS) {
  test(`BREAK 6: ${run} renders through projectNoOtherRepsFraudProduct`, () => {
    const resolution = loadResolution(run);
    // The four fields the module used to read exist on none of these entries.
    assert.ok(resolution.resolved.every((item) => item.resolution_id === undefined
      && item.evidence_only === undefined
      && item.claim.owner_family === undefined
      && item.claim.concept_key === undefined));

    const projection = projectNoOtherRepsFraudProduct({ resolved: resolution.resolved });
    assert.equal(projection.review.length, resolution.resolved.length);
    assert.equal(projection.query.length, resolution.resolved.length);
    assert.equal(projection.compare.length, resolution.resolved.length);
    assert.equal(projection.market.length, resolution.resolved.length);
    assert.equal(projection.authority_state, 'VALIDATED_NOT_SERVED');
    for (const fact of projection.review) {
      assert.equal(fact.owner_family, 'NO_OTHER_REPS_FRAUD');
      assert.equal(fact.table_id, 'no-other-reps-fraud');
      assert.ok(fact.concept_key.startsWith('REP-'));
      assert.ok(fact.evidence.length > 0);
      assert.ok(fact.source_section_reference.length > 0);
      assert.ok(fact.row_id.startsWith('no-other-reps-fraud-'));
      // Provenance metadata is not a market dimension and must not survive
      // into a fact's attributes.
      assert.equal(Object.hasOwn(fact.attributes, 'answer_provenance'), false);
    }
    assert.equal(projection.query.every((fact) => fact.field_key === 'noOtherRepsFraudFact'), true);
    assert.equal(canonicalJson(projection.compare.map(({ concept_key: key }) => key)),
      canonicalJson(projection.query.map(({ concept_key: key }) => key)));
  });
}

test('BREAK 6: owner family and evidence-only routing come from the family contract, both resolver shapes agreeing', () => {
  const resolution = loadResolution('modiv-no-other-reps-20260807-replay');
  const native = resolution.resolved[0];
  // The legacy resolver's own shape, carrying the four fields explicitly.
  const legacy = {
    resolution_id: 'a'.repeat(64),
    section_reference: native.section_reference,
    claim: {
      ...native.claim,
      concept_key: native.concept_key,
      owner_family: 'NO_OTHER_REPS_FRAUD',
    },
    evidence_only: null,
  };
  const fromNative = projectNoOtherRepsFraudProduct({ resolved: [native] });
  const fromLegacy = projectNoOtherRepsFraudProduct({ resolved: [legacy] });
  for (const field of ['owner_family', 'concept_key', 'label', 'table_id', 'evidence', 'source_section_reference']) {
    assert.equal(fromNative.review[0][field], fromLegacy.review[0][field], field);
  }
  assert.equal(canonicalJson(fromNative.market[0]), canonicalJson(fromLegacy.market[0]));
});

test('BREAK 6: a claim this family owns but cannot render throws, naming it, instead of returning a short list', () => {
  const resolution = loadResolution('modiv-no-other-reps-20260807-replay');
  const cases = [
    ['UNMAPPED_FAMILY_CLAIM_DEFINITION', (item) => ({
      ...item,
      claim: { ...item.claim, claim_definition_key: 'REPRESENTATION_TRUE_AND_CORRECT_PRESENT' },
    })],
    ['MISSING_CONCEPT_KEY', (item) => {
      const { concept_key: _dropped, ...rest } = item;
      return rest;
    }],
    ['MISSING_CLAIM_IDENTITY', (item) => ({
      ...item,
      claim: { ...item.claim, claim_revision_id: undefined },
    })],
    ['NOT_A_POSITIVE_PRESENCE_CLAIM', (item) => ({
      ...item,
      claim: { ...item.claim, canonical_value: false },
    })],
  ];
  for (const [code, mutate] of cases) {
    const resolved = [resolution.resolved[0], mutate(resolution.resolved[1]), resolution.resolved[2]];
    let projection = null;
    assert.throws(
      () => { projection = projectNoOtherRepsFraudProduct({ resolved }); },
      (error) => error instanceof NoOtherRepsFraudProductProjectionError
        && error.code === code
        && error.details.index === 1,
      code,
    );
    // The failure this whole note is about: never a shorter list, never an
    // empty one, never a silent drop.
    assert.equal(projection, null, `${code} must not have produced a projection`);
  }
});
