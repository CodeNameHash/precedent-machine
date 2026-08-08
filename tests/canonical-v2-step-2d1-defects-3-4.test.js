'use strict';

/**
 * tests/canonical-v2-step-2d1-defects-3-4.test.js
 *
 * PLAN.md Step 2D1, defects 3 and 4 (2026-08-07). Both silent.
 *
 * Defect 3: lib/canonical-v2/remedies-misc-product-projection.js covers
 * SPECIFIC_PERFORMANCE_REMEDIES and MISC_BOILERPLATE, but its
 * REMEDIES_DEFINITIONS/MISC_DEFINITIONS membership sets named an older,
 * finer-grained claim vocabulary the resolver stopped emitting; the two
 * real claim-definition keys -- SPECIFIC_PERFORMANCE_REMEDY_PRESENT and
 * MISC_BOILERPLATE_MECHANIC_PRESENT -- were not in them. Both families
 * wrote correctly and dropped silently to zero cards, no error. Fixed by
 * recognising the real keys (see the module's own header comment) and by
 * adding a guard that throws when a claim resolves under a concept this
 * module owns but neither membership set recognises it -- the exact shape
 * the bug had.
 *
 * Defect 4: four projections compared provision.schema_version to the
 * single literal 'PROVISION_INSTANCE/V1', where Step 4A1 taught the SQL
 * writer a second, legitimate, partyless kind --
 * 'STRUCTURAL_PROVISION_INSTANCE/V1' -- that validate-write-set.js's own
 * assertStructuralRowShape/expectedObjectId admit equally. Confirmed live
 * on TAX_MATTERS (tax-dividends-appraisal-product-projection.js, which also
 * owns DIVIDENDS and APPRAISAL_DISSENTERS_RIGHTS); latent on
 * FINANCING_COVENANTS and GUARANTY_FINANCING_PARTY
 * (financing-guaranty-product-projection.js) and on REPRESENTATIONS
 * (representations-product-projection.js). A fifth file,
 * ioc-wave-a-product-projection.js (INTERIM_OPERATING), was investigated
 * and deliberately NOT widened -- see its own header comment and the test
 * below -- because every IOC restriction is party-bound by construction and
 * widening it would trade a clean typed failure for an unrelated crash.
 *
 * Investigating defect 4 on TAX_MATTERS surfaced a second, previously
 * unknown blocker in the same two files: rejectUngovernedAttributes treated
 * the tax/dividends/appraisal (and financing/guaranty) producer's own
 * system metadata (assertion_kind, section_reference, answer_provenance)
 * and its unset null-valued template placeholders as ungoverned product
 * attributes, so even a claim that passed the schema_version gate still
 * failed closed on its very first real claim. Fixed alongside the
 * schema_version defect in the same two files, same investigation -- see
 * SYSTEM_ATTRIBUTE_KEYS in both.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  REMEDIES_DEFINITIONS,
  MISC_DEFINITIONS,
  RemediesMiscProjectionError,
  projectRemediesMiscProductSurfaces,
} = require('../lib/canonical-v2/remedies-misc-product-projection');
const {
  TaxDividendsAppraisalProductProjectionError,
  projectTaxDividendsAppraisalClaims,
} = require('../lib/canonical-v2/tax-dividends-appraisal-product-projection');
const {
  FinancingGuarantyProductProjectionError,
  projectFinancingGuarantyClaims,
} = require('../lib/canonical-v2/financing-guaranty-product-projection');
const {
  RepresentationsProductProjectionError,
  projectRepresentationClaims,
} = require('../lib/canonical-v2/representations-product-projection');
const { projectIocWaveAClaims } = require('../lib/canonical-v2/ioc-wave-a-product-projection');

const EVIDENCE = path.join(__dirname, '..', 'evidence', 'canonical-v2');

function resolutionFor(run) {
  return JSON.parse(fs.readFileSync(path.join(EVIDENCE, run, 'resolution.json'), 'utf8'));
}

// ---------------------------------------------------------------------
// Defect 3: membership sets, real committed data.
// ---------------------------------------------------------------------

test('defect 3: SPECIFIC_PERFORMANCE_REMEDY_PRESENT projects a real card from its committed replay run', () => {
  assert.ok(
    REMEDIES_DEFINITIONS.has('SPECIFIC_PERFORMANCE_REMEDY_PRESENT'),
    'the real claim-definition key must be in REMEDIES_DEFINITIONS',
  );
  const resolution = resolutionFor('modiv-specific-performance-20260807-replay');
  assert.ok(
    resolution.resolved.some((entry) => entry.resolved_claim_definition_key === 'SPECIFIC_PERFORMANCE_REMEDY_PRESENT'),
    'sanity: the fixture must actually carry the real key, or this test proves nothing',
  );
  const projected = projectRemediesMiscProductSurfaces({ resolution, deal_id: 'modiv-gnl' });
  assert.ok(projected.cards.length > 0, 'before this fix: 0 cards, no error, despite a successful write');
  assert.ok(projected.cards.some((card) => card.features.specificPerformance === true));
});

test('defect 3: MISC_BOILERPLATE_MECHANIC_PRESENT projects real cards from its committed replay run', () => {
  assert.ok(
    MISC_DEFINITIONS.has('MISC_BOILERPLATE_MECHANIC_PRESENT'),
    'the real claim-definition key must be in MISC_DEFINITIONS',
  );
  const resolution = resolutionFor('modiv-misc-boilerplate-20260807-replay');
  const realKeyCount = resolution.resolved.filter(
    (entry) => entry.resolved_claim_definition_key === 'MISC_BOILERPLATE_MECHANIC_PRESENT',
  ).length;
  assert.ok(realKeyCount > 0, 'sanity: the fixture must carry the real key');
  const projected = projectRemediesMiscProductSurfaces({ resolution, deal_id: 'modiv-gnl' });
  assert.ok(projected.cards.length > 0, 'before this fix: 0 cards, no error, despite 14 successfully written claims');
  // Every card's evidence must actually be the raw quote -- no invented
  // structure for a generic carrier whose only attribute is assertion_kind.
  for (const card of projected.cards) {
    assert.equal(card.provision_type, 'MISC_BOILERPLATE');
    assert.ok(card.features.mainConcept, 'the only honest feature for a generic carrier is the raw quote');
  }
});

test('defect 3: the old, resolver-dead MISC/REMEDIES definitions stay registered and still project by hand-built fixture', () => {
  // The parity test (tests/canonical-v2-remedies-misc-product-parity.test.js)
  // still exercises these; this just pins that adding the two real keys did
  // not remove them.
  for (const key of ['GOVERNING_LAW_STATE', 'SEVERABILITY_PROVISION', 'COUNTERPARTS_EXECUTION']) {
    assert.ok(MISC_DEFINITIONS.has(key));
  }
  for (const key of ['SPECIFIC_PERFORMANCE_AVAILABLE', 'SOLE_REMEDY_LEGAL_EFFECT_PRESENT']) {
    assert.ok(REMEDIES_DEFINITIONS.has(key));
  }
});

// ---------------------------------------------------------------------
// Defect 3: the guard. Proven by removing what it guards -- a synthetic
// entry with exactly the pre-fix shape (owned concept, unrecognised
// definition key) -- and watching it fail loudly instead of returning an
// empty card list.
// ---------------------------------------------------------------------

function baseResolution(entry) {
  return { resolved: [entry], open_world: [] };
}

test('defect 3 guard: a claim resolving under an owned MISC concept with an unmapped definition key fails loudly, not silently', () => {
  const entry = {
    resolved_claim_definition_key: 'SOME_FUTURE_MISC_BOILERPLATE_KEY',
    concept_key: 'MISC-BOILERPLATE',
    section_reference: '9.1',
    provision_instance: { schema_version: 'STRUCTURAL_PROVISION_INSTANCE/V1', provision_instance_id: 'prov-guard-1' },
    claim: {
      claim_revision_id: 'claim-guard-1', raw_value: 'quote', canonical_value: true, attributes: {},
    },
  };
  assert.throws(
    () => projectRemediesMiscProductSurfaces({ resolution: baseResolution(entry), deal_id: 'guard-deal' }),
    (error) => error instanceof RemediesMiscProjectionError
      && error.code === 'UNMAPPED_FAMILY_CLAIM_DEFINITION'
      && error.details.concept_key === 'MISC-BOILERPLATE',
  );
});

test('defect 3 guard: a claim resolving under an owned REMEDIES concept with an unmapped definition key fails loudly', () => {
  const entry = {
    resolved_claim_definition_key: 'SOME_FUTURE_REMEDY_KEY',
    concept_key: 'REM-FUTURE',
    section_reference: '8.8',
    provision_instance: { schema_version: 'STRUCTURAL_PROVISION_INSTANCE/V1', provision_instance_id: 'prov-guard-2' },
    claim: {
      claim_revision_id: 'claim-guard-2', raw_value: 'quote', canonical_value: true, attributes: {},
    },
  };
  assert.throws(
    () => projectRemediesMiscProductSurfaces({ resolution: baseResolution(entry), deal_id: 'guard-deal' }),
    (error) => error instanceof RemediesMiscProjectionError && error.code === 'UNMAPPED_FAMILY_CLAIM_DEFINITION',
  );
});

test('defect 3 guard does not fire on a concept this module genuinely does not own', () => {
  // The negative case: an entry for a wholly different family (e.g.
  // TERMINATION) must still be skipped silently -- "a family returning
  // zero can be correct" still applies to entries that are not this
  // module's business at all.
  const entry = {
    resolved_claim_definition_key: 'TERMINATION_RIGHT_GRANT',
    concept_key: 'TERMR-OUTSIDE',
    section_reference: '7.1',
    provision_instance: { schema_version: 'PROVISION_INSTANCE/V1', provision_instance_id: 'prov-other' },
    claim: {
      claim_revision_id: 'claim-other', raw_value: 'quote', canonical_value: true, attributes: {},
    },
  };
  const projected = projectRemediesMiscProductSurfaces({ resolution: baseResolution(entry), deal_id: 'guard-deal' });
  assert.equal(projected.cards.length, 0);
});

test('defect 3: an assertion_kind outside the governed enum fails loudly for both generic carriers', () => {
  const misc = {
    resolved_claim_definition_key: 'MISC_BOILERPLATE_MECHANIC_PRESENT',
    concept_key: 'MISC-BOILERPLATE',
    section_reference: '9.1',
    provision_instance: { schema_version: 'STRUCTURAL_PROVISION_INSTANCE/V1', provision_instance_id: 'prov-ak-1' },
    claim: {
      claim_revision_id: 'claim-ak-1', raw_value: 'quote', canonical_value: true,
      attributes: { assertion_kind: 'NOT_A_REAL_KIND' },
    },
  };
  assert.throws(
    () => projectRemediesMiscProductSurfaces({ resolution: baseResolution(misc), deal_id: 'guard-deal' }),
    (error) => error instanceof RemediesMiscProjectionError && error.code === 'MISC_ASSERTION_KIND_UNMAPPED',
  );
  const remedy = {
    resolved_claim_definition_key: 'SPECIFIC_PERFORMANCE_REMEDY_PRESENT',
    concept_key: 'REMEDY-SPECIFIC-PERFORMANCE',
    section_reference: '8.8',
    provision_instance: { schema_version: 'STRUCTURAL_PROVISION_INSTANCE/V1', provision_instance_id: 'prov-ak-2' },
    claim: {
      claim_revision_id: 'claim-ak-2', raw_value: 'quote', canonical_value: true,
      attributes: { assertion_kind: 'NOT_A_REAL_KIND' },
    },
  };
  assert.throws(
    () => projectRemediesMiscProductSurfaces({ resolution: baseResolution(remedy), deal_id: 'guard-deal' }),
    (error) => error instanceof RemediesMiscProjectionError && error.code === 'REMEDIES_ASSERTION_KIND_UNMAPPED',
  );
});

// ---------------------------------------------------------------------
// Defect 4: real committed data, TAX_MATTERS confirmed.
// ---------------------------------------------------------------------

test('defect 4: TAX_MATTERS projects with the structural provision kind on its committed replay run', () => {
  const resolution = resolutionFor('modiv-tax-matters-20260807-replay');
  assert.ok(resolution.resolved.length > 0, 'sanity: the fixture must carry resolved claims');
  assert.ok(
    resolution.resolved.every((entry) => entry.provision_instance.schema_version === 'STRUCTURAL_PROVISION_INSTANCE/V1'),
    'sanity: every resolved TAX_MATTERS entry in this run is partyless -- if this ever fails, the ' +
    'fixture changed and the "confirmed live" claim needs re-checking, not this test loosened',
  );
  const projected = projectTaxDividendsAppraisalClaims({ resolved_entries: resolution.resolved });
  assert.equal(
    projected.records.length,
    resolution.resolved.length,
    'before this fix: threw INVALID_PROVISION_BINDING on the very first entry',
  );
  for (const record of projected.records) {
    assert.equal(record.owner_family, 'TAX_MATTERS');
  }
});

test('defect 4: TAX_MATTERS still rejects a claim bound to the wrong provision kind outright', () => {
  // Not every schema_version is legitimate -- only the two
  // validate-write-set.js admits. A made-up third kind must still fail.
  const resolution = resolutionFor('modiv-tax-matters-20260807-replay');
  const tampered = JSON.parse(JSON.stringify(resolution));
  tampered.resolved[0].provision_instance.schema_version = 'SOME_OTHER_KIND/V1';
  assert.throws(
    () => projectTaxDividendsAppraisalClaims({ resolved_entries: tampered.resolved.slice(0, 1) }),
    (error) => error instanceof TaxDividendsAppraisalProductProjectionError
      && error.code === 'INVALID_PROVISION_BINDING',
  );
});

test('defect 4 (found alongside): TAX_MATTERS attributes carry producer system metadata and null-valued placeholders that must not be treated as ungoverned', () => {
  const resolution = resolutionFor('modiv-tax-matters-20260807-replay');
  const withPlaceholders = resolution.resolved.find(
    (entry) => Object.values(entry.claim.attributes || {}).includes(null),
  );
  assert.ok(withPlaceholders, 'sanity: the fixture must carry at least one null-valued placeholder attribute');
  assert.ok(
    ['answer_provenance', 'assertion_kind', 'section_reference'].some(
      (key) => Object.hasOwn(withPlaceholders.claim.attributes, key),
    ),
    'sanity: the fixture must carry system metadata alongside the placeholders',
  );
  // Already exercised end to end by the "projects with the structural
  // provision kind" test above; this just names the specific shape that
  // would otherwise have thrown INVALID_GOVERNED_ATTRIBUTES/
  // UNADJUDICATED_PRODUCT_ATTRIBUTE.
  assert.doesNotThrow(() => projectTaxDividendsAppraisalClaims({ resolved_entries: [withPlaceholders] }));
});

// ---------------------------------------------------------------------
// Defect 4: DIVIDENDS, APPRAISAL_DISSENTERS_RIGHTS, FINANCING_COVENANTS,
// GUARANTY_FINANCING_PARTY, REPRESENTATIONS -- latent. Zero resolved
// entries in every committed -20260807-replay run for these families, so
// they cannot be confirmed from real data; proven instead with hand-built
// entries in the real generic-carrier shape (mirroring what
// candidate-resolution.js's own finalize paths actually produce).
// ---------------------------------------------------------------------

test('defect 4 latent: DIVIDENDS and APPRAISAL_DISSENTERS_RIGHTS have zero resolved claims in their committed replay runs', () => {
  assert.equal(resolutionFor('modiv-dividends-20260807-replay').resolved.length, 0);
  assert.equal(resolutionFor('modiv-appraisal-20260807-replay').resolved.length, 0);
});

test('defect 4 latent: FINANCING_COVENANTS and GUARANTY_FINANCING_PARTY have zero resolved claims in their committed replay runs, and REPRESENTATIONS too', () => {
  assert.equal(resolutionFor('modiv-financing-covenants-20260807-replay').resolved.length, 0);
  assert.equal(resolutionFor('modiv-guaranty-20260807-replay').resolved.length, 0);
  assert.equal(resolutionFor('modiv-representations-20260807-replay').resolved.length, 0);
});

test('defect 4 latent: FINANCING_COVENANTS is genuinely mixed -- some assertion kinds party-bound, some partyless -- and both must project', () => {
  // candidate-resolution.js's handleFinancingCandidate: OBTAIN_EFFORTS/
  // COOPERATION_GRANT resolve a real party (mintProvision); NO_FINANCING_
  // CONDITION_ACK/PAYOFF_LEAD_TIME/MARKETING_PERIOD_LENGTH never set
  // `party` (mintStructuralProvision). One family, both provision kinds --
  // exactly why the fix accepts the union rather than picking one per
  // family the way key-terms-mae-product-projection.js's older fix did.
  const partyBound = {
    resolved_claim_definition_key: 'FINANCING_COOPERATION_PRESENT',
    concept_key: 'COV-FINANCING',
    section_reference: '6.1',
    provision_instance: { schema_version: 'PROVISION_INSTANCE/V1', provision_instance_id: 'prov-fin-1' },
    claim: {
      claim_revision_id: 'claim-fin-1', claim_definition_key: 'FINANCING_COOPERATION_PRESENT', state: 'PRESENT',
      subject_occurrence_id: 'prov-fin-1',
      raw_value: 'The Company shall provide cooperation with financing efforts.',
      canonical_value: true,
      attributes: { financing_kind: 'DEBT', obligor_ref: 'the Company', answer_provenance: { tag: 'MECHANICAL' } },
    },
  };
  const partyless = {
    resolved_claim_definition_key: 'NO_FINANCING_CONDITION_ACKNOWLEDGMENT',
    concept_key: 'COV-FINANCING',
    section_reference: '6.2',
    provision_instance: { schema_version: 'STRUCTURAL_PROVISION_INSTANCE/V1', provision_instance_id: 'prov-fin-2' },
    claim: {
      claim_revision_id: 'claim-fin-2', claim_definition_key: 'NO_FINANCING_CONDITION_ACKNOWLEDGMENT', state: 'PRESENT',
      subject_occurrence_id: 'prov-fin-2',
      raw_value: 'The receipt of the Debt Financing is not a condition to Closing.',
      canonical_value: true,
      attributes: { financing_kind: 'DEBT', answer_provenance: { tag: 'MECHANICAL' } },
    },
  };
  const projected = projectFinancingGuarantyClaims({ resolved_entries: [partyBound, partyless] });
  assert.equal(projected.records.length, 2);
});

test('defect 4 latent: GUARANTY_FINANCING_PARTY is always partyless and must project on the structural kind', () => {
  const guaranty = {
    resolved_claim_definition_key: 'PARENT_PERFORMANCE_GUARANTY',
    concept_key: 'GTY-PERF',
    section_reference: '9.1',
    provision_instance: { schema_version: 'STRUCTURAL_PROVISION_INSTANCE/V1', provision_instance_id: 'prov-gty-1' },
    claim: {
      claim_revision_id: 'claim-gty-1', claim_definition_key: 'PARENT_PERFORMANCE_GUARANTY', state: 'PRESENT',
      subject_occurrence_id: 'prov-gty-1',
      raw_value: 'Guarantor hereby guarantees the performance of Parent.',
      canonical_value: true,
      attributes: { guarantor_ref: 'Guarantor', answer_provenance: { tag: 'MECHANICAL' } },
    },
  };
  const projected = projectFinancingGuarantyClaims({ resolved_entries: [guaranty] });
  assert.equal(projected.records.length, 1);
  assert.equal(projected.records[0].owner_family, 'GUARANTY_FINANCING_PARTY');
});

test('defect 4 latent: financing/guaranty still rejects a claim bound to a made-up provision kind', () => {
  const bogus = {
    resolved_claim_definition_key: 'PARENT_PERFORMANCE_GUARANTY',
    concept_key: 'GTY-PERF',
    section_reference: '9.1',
    provision_instance: { schema_version: 'SOME_OTHER_KIND/V1', provision_instance_id: 'prov-gty-bogus' },
    claim: {
      claim_revision_id: 'claim-gty-bogus', claim_definition_key: 'PARENT_PERFORMANCE_GUARANTY', state: 'PRESENT',
      subject_occurrence_id: 'prov-gty-bogus',
      raw_value: 'Guarantor hereby guarantees the performance of Parent.',
      canonical_value: true,
      attributes: { guarantor_ref: 'Guarantor' },
    },
  };
  assert.throws(
    () => projectFinancingGuarantyClaims({ resolved_entries: [bogus] }),
    (error) => error instanceof FinancingGuarantyProductProjectionError
      && error.code === 'INVALID_PROVISION_BINDING',
  );
});

test('defect 4 latent: REPRESENTATIONS accepts a structural-kind provision at the schema gate, but still fails closed on the missing party downstream', () => {
  // REPRESENTATIONS is party-bound by construction (candidate-resolution.js's
  // GENERIC_CLAIM_KEY_RESOLUTION_TABLE gives every row that reaches
  // REPRESENTATION_ACCURACY_STANDARD/KNOWLEDGE_QUALIFIER a party_field), so
  // this claim should never actually arrive on a structural provision. The
  // point of this test is to prove the widened schema_version check does
  // NOT silently accept it anyway -- sideForParty(undefined) still fails
  // closed with UNRESOLVED_REPRESENTATION_SIDE, not a wrong answer.
  const entry = {
    resolved_claim_definition_key: 'KNOWLEDGE_QUALIFIER',
    concept_key: 'REP-T-CAPITALIZATION',
    section_reference: '3.1',
    provision_instance: { schema_version: 'STRUCTURAL_PROVISION_INSTANCE/V1', provision_instance_id: 'prov-rep-structural' },
    claim: {
      claim_revision_id: 'claim-rep-structural', claim_definition_key: 'KNOWLEDGE_QUALIFIER', state: 'PRESENT',
      subject_occurrence_id: 'prov-rep-structural',
      raw_value: 'to the knowledge of the Company',
      canonical_value: true,
      attributes: {},
      evidence: [{ excerpt_id: 'ex-1' }],
    },
  };
  assert.throws(
    () => projectRepresentationClaims({ resolved_entries: [entry] }),
    (error) => error instanceof RepresentationsProductProjectionError
      && error.code === 'UNRESOLVED_REPRESENTATION_SIDE',
  );
});

// ---------------------------------------------------------------------
// Defect 4: INTERIM_OPERATING (ioc-wave-a-product-projection.js) was
// investigated and deliberately left on the single literal. Two things to
// prove: the real committed run still projects in full, and widening would
// have been actively wrong (a crash, not a clean failure) -- shown by
// reproducing the exact `||` short-circuit the module's header comment
// describes, without touching the module itself.
// ---------------------------------------------------------------------

test('INTERIM_OPERATING (not widened) still projects every claim in its committed replay run', () => {
  const resolution = resolutionFor('modiv-interim-operating-20260807-replay');
  assert.ok(resolution.resolved.length > 0, 'sanity: the fixture must carry resolved claims');
  assert.ok(
    resolution.resolved.every((entry) => entry.provision_instance.schema_version === 'PROVISION_INSTANCE/V1'),
    'sanity: every IOC restriction in this run is party-bound, confirming the module was never actually broken',
  );
  const projected = projectIocWaveAClaims({
    resolved_entries: resolution.resolved,
    ioc_restriction_components: resolution.ioc_restriction_components || [],
  });
  assert.equal(projected.records.length, resolution.resolved.length);
});

test('why INTERIM_OPERATING was not widened: canonicalJson(undefined) throws a cryptic error, not a clean typed one', () => {
  // This is the exact expression ioc-wave-a-product-projection.js's guarded
  // `||` chain would newly reach if the schema check were widened to accept
  // STRUCTURAL_PROVISION_INSTANCE/V1 (which carries no `party` field) --
  // reproduced here against the shared canonical-bytes.js helper directly,
  // without touching the real module, to prove the risk is real rather than
  // asserted.
  const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
  assert.throws(
    () => canonicalJson(undefined),
    /canonical JSON does not support undefined/,
  );
});

// ---------------------------------------------------------------------
// Defect 4: the full-count grep the step required. Before this step, FOUR
// files compared `provision.schema_version !== 'PROVISION_INSTANCE/V1'` --
// one more than the "four" in the defect's own name, which named families,
// not files: financing-guaranty-product-projection.js (FINANCING_COVENANTS
// + GUARANTY_FINANCING_PARTY), tax-dividends-appraisal-product-projection.js
// (TAX_MATTERS + DIVIDENDS + APPRAISAL_DISSENTERS_RIGHTS),
// representations-product-projection.js (REPRESENTATIONS), and
// ioc-wave-a-product-projection.js (INTERIM_OPERATING) -- 4 files, 7
// families, matching the defect's own count. Three were widened to the
// union of both real kinds; ioc-wave-a was investigated and deliberately
// left on the single literal (see its own header comment and the tests
// above). key-terms-mae-product-projection.js already picked between the
// two kinds per-family before this step and needed no change -- it is not
// counted here because its comparison was never the single stale literal.
// Pinned below so a regression -- either a widened file reverting to the
// literal, or a new file introducing it uninvestigated -- fails loudly.
// ---------------------------------------------------------------------

test('defect 4: the full count of stale schema_version comparisons found, and the current state after the fix', () => {
  const projectionDir = path.join(__dirname, '..', 'lib', 'canonical-v2');
  const files = fs.readdirSync(projectionDir).filter((name) => name.includes('projection') && name.endsWith('.js'));
  const singleKindOnly = [];
  const widenedToUnion = [];
  for (const file of files) {
    const text = fs.readFileSync(path.join(projectionDir, file), 'utf8');
    // Pre-fix, every one of these compared with `!==='; post-fix, the
    // widened files test Set membership instead (`!Set.has(...)`), so
    // matching only `!==` would go blind to exactly the files this test
    // means to find. Match on `provision.schema_version` appearing in a
    // GOVERNED_PROVISION_SCHEMA_VERSION(S) check instead.
    const comparesProvisionSchema = /provision\.schema_version/.test(text)
      && /GOVERNED_PROVISION_SCHEMA_VERSIONS?\b/.test(text);
    if (!comparesProvisionSchema) continue;
    // GOVERNED_PROVISION_SCHEMA_VERSIONS (plural, a Set) marks a widened
    // file; GOVERNED_PROVISION_SCHEMA_VERSION (singular, a string) marks
    // ioc-wave-a's deliberate single-kind constant. Checking for the
    // constant name, not a bare mention of STRUCTURAL_PROVISION_INSTANCE/V1
    // anywhere in the file, because ioc-wave-a's own header comment names
    // that string too, to explain why it does NOT accept it.
    if (/GOVERNED_PROVISION_SCHEMA_VERSIONS\b/.test(text)) widenedToUnion.push(file);
    else if (/GOVERNED_PROVISION_SCHEMA_VERSION\b/.test(text)) singleKindOnly.push(file);
  }
  assert.deepEqual(
    singleKindOnly,
    ['ioc-wave-a-product-projection.js'],
    'ioc-wave-a is the one file deliberately left comparing against a single provision kind '
    + '(now via its own named GOVERNED_PROVISION_SCHEMA_VERSION constant, not the bare literal); '
    + 'any other name here is a regression or an unreviewed new comparison, not a pass',
  );
  assert.deepEqual(
    widenedToUnion.sort(),
    [
      'financing-guaranty-product-projection.js',
      'representations-product-projection.js',
      'tax-dividends-appraisal-product-projection.js',
    ],
    'the three files defect 4 named as latent/confirmed and this step widened to admit both real kinds',
  );
});
