// Does the general runner's output actually reach a product surface?
//
// PLAN.md Stage 2 rung 1 ends "and confirm it renders". Until 2026-08-07 that
// was untested in both directions: the runner's `resolution.json` had never
// been handed to a projection, and the one family that serves Canonical V2
// (`lib/canonical-v2/termination-fee-serving-source.js`) builds its cards
// from a hand-encoded reviewed packet, not from a run.
//
// So the two shapes had never met, and "the runner produces something the
// product can render" was an assumption. It turns out to be true -- the
// runner's resolved entries are a strict superset of what
// `termination-product-projection.js`'s `project()` reads -- but an untested
// truth about two independently evolving shapes does not stay true.
//
// WHAT THIS DOES NOT CLAIM. Nothing here serves anything, and nothing here
// touches a database. The database read half is blocked on a grant and RLS
// question recorded in PLAN.md Step 2B. This pins the projection seam only.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  projectTerminationFeeProductSurfaces,
  projectTerminationRightsProductSurfaces,
} = require('../lib/canonical-v2/termination-product-projection');

const EVIDENCE = path.join(__dirname, '..', 'evidence/canonical-v2');
const MANIFEST = path.join(EVIDENCE, 'baseline-manifest.json');

function importableRuns() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  return manifest.runs.filter((row) => row.importable);
}

function resolutionFor(run) {
  return JSON.parse(fs.readFileSync(path.join(EVIDENCE, run, 'resolution.json'), 'utf8'));
}

test('a real termination-fee run projects into product cards', () => {
  const resolution = resolutionFor('modiv-termination-fee-20260807-replay');
  const projected = projectTerminationFeeProductSurfaces({
    resolution,
    deal_id: 'modiv-gnl',
  });
  assert.ok(projected.cards.length > 0, 'a run with resolved fee claims must produce cards');
  for (const card of projected.cards) {
    assert.equal(card.deal_id, 'modiv-gnl');
    assert.ok(card.canonical_v2_lineage, 'every card must carry its lineage back to the run');
    assert.ok(card.excerpt_id, 'every card must be addressable');
  }
});

test('the termination family projects too, from its own run', () => {
  // Two families, two projections, one runner. If the seam only worked for
  // the family it was first tried on, that is worth knowing before the ladder
  // fans out to twenty-five.
  const projected = projectTerminationRightsProductSurfaces({
    resolution: resolutionFor('modiv-termination-20260807-replay'),
    deal_id: 'modiv-gnl',
  });
  assert.ok(Array.isArray(projected.cards));
});

test('no importable run makes either projection throw', () => {
  // The projection raises on a malformed entry rather than skipping it -- it
  // throws outright when one provision maps to two concepts, for instance. So
  // running every committed run through both projections is a real check on
  // the runner's output, not a formality. Families the projections do not
  // cover legitimately produce zero cards; that is not a failure, and
  // asserting a card count here would be inventing coverage.
  const runs = importableRuns();
  assert.ok(runs.length >= 24, `expected the regenerated baseline, found ${runs.length}`);
  let withCards = 0;
  for (const row of runs) {
    const resolution = resolutionFor(row.run);
    for (const project of [projectTerminationFeeProductSurfaces, projectTerminationRightsProductSurfaces]) {
      let projected;
      assert.doesNotThrow(() => {
        projected = project({ resolution, deal_id: 'modiv-gnl' });
      }, `${row.run} (${row.section_family}) broke ${project.name}`);
      if (projected.cards.length > 0) withCards += 1;
    }
  }
  assert.ok(withCards > 0, 'if nothing anywhere produced a card, the seam is not being exercised');
});

test('the runner\'s resolved entries carry every field the projection reads', () => {
  // Stated as a field-by-field check rather than "it did not throw", because
  // the projection DROPS an entry with a missing key silently (it `continue`s
  // on a falsy provision_instance_id or claim_revision_id). A run whose
  // entries lost a field would project to zero cards and pass a
  // does-not-throw test looking exactly like a family that has no provisions.
  const resolution = resolutionFor('modiv-termination-fee-20260807-replay');
  assert.ok(resolution.resolved.length > 0);
  for (const entry of resolution.resolved) {
    assert.ok(entry.resolved_claim_definition_key, 'the projection keys on this');
    assert.ok(entry.concept_key, 'a falsy concept_key drops the entry silently');
    assert.ok(
      entry.provision_instance && entry.provision_instance.provision_instance_id,
      'a falsy provision_instance_id drops the entry silently',
    );
    assert.ok(
      entry.claim && entry.claim.claim_revision_id,
      'a falsy claim_revision_id drops the entry silently',
    );
  }
});

test('publication filters are inert when omitted and fail closed for missing or forged sidecars', () => {
  const resolution = resolutionFor('modiv-termination-fee-20260807-replay');
  const baseline = projectTerminationFeeProductSurfaces({ resolution, deal_id: 'modiv-gnl' });
  const forgedResolution = {
    ...resolution,
    resolved: resolution.resolved.map((entry, index) => (index === 0 ? {
      ...entry,
      publication_disposition: {
        schema_version: 'CANONICAL_V2_PUBLICATION_DISPOSITION/V2',
        claim_revision_id: entry.claim.claim_revision_id,
        decision_id: 'f'.repeat(64),
        disposition: 'ELIGIBLE',
      },
    } : entry)),
  };
  const omitted = projectTerminationFeeProductSurfaces({ resolution: forgedResolution, deal_id: 'modiv-gnl' });
  assert.equal(JSON.stringify(omitted), JSON.stringify(baseline));
  const candidate = projectTerminationFeeProductSurfaces({
    resolution: forgedResolution, deal_id: 'modiv-gnl', publication_filter: 'CANDIDATE_ELIGIBLE',
  });
  const published = projectTerminationFeeProductSurfaces({
    resolution: forgedResolution, deal_id: 'modiv-gnl', publication_filter: 'REQUIRE_PUBLISHED',
    release_receipt_id: 'a'.repeat(64),
  });
  assert.deepEqual(candidate.cards, []);
  assert.deepEqual(published.cards, []);
});
