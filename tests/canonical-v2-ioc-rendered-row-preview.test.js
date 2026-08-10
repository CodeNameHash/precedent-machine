'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  FAMILY_ROUTES,
  previewReviewDealRow,
  previewResolvedClaimRow,
} = require('../lib/review-parity/rendered-row-preview');

const ROOT = path.resolve(__dirname, '..');

function recordedRun(name) {
  const dir = path.join(ROOT, 'evidence', 'canonical-v2', name);
  return {
    manifest: JSON.parse(fs.readFileSync(path.join(dir, 'run-manifest.json'), 'utf8')),
    resolution: JSON.parse(fs.readFileSync(path.join(dir, 'resolution.json'), 'utf8')),
  };
}

test('INTERIM_OPERATING preview keeps the selected provision components and one card for the supplied claim', () => {
  assert.deepEqual(FAMILY_ROUTES.INTERIM_OPERATING, {
    configIdByPartyCapacity: {
      TARGET: 'ioc-exceptions',
      BUYER: 'parent-ioc-exceptions',
    },
    projectionModule: 'lib/canonical-v2/ioc-wave-a-product-projection.js',
    projectionExport: 'projectIocWaveAClaims',
    rowMatch: 'SINGLE_SCOPED_ROW',
  });

  const run = recordedRun('metsera-interim-operating-20260809-2xk-final');
  const selected = run.resolution.resolved.find(
    (entry) => entry.claim.attributes.restriction_category === 'COLLECTIVE_BARGAINING',
  );
  assert.ok(selected);
  const provisionId = selected.provision_instance.provision_instance_id;
  const siblingEntries = run.resolution.resolved.filter(
    (entry) => entry.provision_instance.provision_instance_id === provisionId,
  );
  assert.equal(siblingEntries.length, 3);

  const projectionPath = require.resolve('../lib/canonical-v2/ioc-wave-a-product-projection');
  const projectionModule = require(projectionPath);
  const originalProject = projectionModule.projectIocWaveAClaims;
  let suppliedResolution;
  let projected;
  projectionModule.projectIocWaveAClaims = (input) => {
    suppliedResolution = structuredClone(input.resolution);
    projected = originalProject(input);
    return projected;
  };

  let preview;
  try {
    preview = previewResolvedClaimRow({ run, resolved_entry: selected });
  } finally {
    projectionModule.projectIocWaveAClaims = originalProject;
  }

  assert.equal(suppliedResolution.resolved.length, siblingEntries.length);
  assert.ok(suppliedResolution.resolved.every(
    (entry) => entry.provision_instance.provision_instance_id === provisionId,
  ));
  assert.equal(suppliedResolution.ioc_restriction_components.length, siblingEntries.length);
  assert.ok(suppliedResolution.ioc_restriction_components.every(
    (component) => component.parent_provision_instance_id === provisionId,
  ));
  assert.deepEqual(
    suppliedResolution.ioc_restriction_components.map((component) => component.provision_component_id).sort(),
    siblingEntries.map((entry) => entry.claim.subject_occurrence_id).sort(),
  );

  assert.equal(projected.cards.length, siblingEntries.length);
  assert.equal(projected.ioc_restriction_components.length, siblingEntries.length);
  const targetCards = projected.cards.filter(
    (card) => card.canonical_v2_lineage.claim_revision_ids.includes(selected.claim.claim_revision_id),
  );
  assert.equal(targetCards.length, 1);
  assert.equal(targetCards[0].provision_component_id, selected.claim.subject_occurrence_id);
  assert.deepEqual(targetCards[0].canonical_v2_lineage.provision_component_ids, [
    selected.claim.subject_occurrence_id,
  ]);

  assert.equal(preview.family_id, 'INTERIM_OPERATING');
  assert.equal(preview.section.id, 'ioc-exceptions');
  assert.equal(preview.claim_revision_id, selected.claim.claim_revision_id);
  assert.equal(preview.provision_instance_id, provisionId);
  assert.match(preview.row.cells[0].text, /COLLECTIVE_BARGAINING/);
  assert.doesNotMatch(preview.row.cells[0].text, /BENEFIT_PLANS|EMPLOYEE_COMPENSATION/);
});

test('all latest IOC claims select the review section from their governed party capacity', () => {
  const runNames = fs.readdirSync(path.join(ROOT, 'evidence', 'canonical-v2'))
    .filter((name) => /interim-operating-20260809/.test(name))
    .sort();
  let claims = 0;
  const capacities = new Map();
  for (const name of runNames) {
    const run = recordedRun(name);
    for (const entry of run.resolution.resolved) {
      const preview = previewResolvedClaimRow({ run, resolved_entry: entry });
      const expected = entry.party.capacity === 'TARGET'
        ? { id: 'ioc-exceptions', title: 'Interim Operating Covenants — Target' }
        : { id: 'parent-ioc-exceptions', title: 'Interim Operating Covenants — Parent' };
      assert.deepEqual(preview.section, expected, `${name}:${entry.claim.claim_revision_id}`);
      assert.equal(preview.claim_revision_id, entry.claim.claim_revision_id);
      capacities.set(entry.party.capacity, (capacities.get(entry.party.capacity) || 0) + 1);
      claims += 1;
    }
  }
  assert.equal(claims, 127);
  assert.deepEqual(Object.fromEntries(capacities), { TARGET: 119, BUYER: 8 });
});

test('IOC preview fails closed when governed party capacity cannot select a section', () => {
  const baseCard = {
    id: 'ioc-unsupported-party',
    provision_instance_id: 'ioc-provision',
    provision_type: 'COVENANT_INTERIM_OPERATING',
    provision_subtype: 'IOC-DEBT',
    primary_quote: 'incur any indebtedness',
    features: { restrictionComponents: ['INDEBTEDNESS'] },
  };
  for (const party of [null, {
    role: 'IOC_COVENANT_OBLIGOR', value: 'Both parties', capacity: 'JOINT_MULTI_PARTY',
  }]) {
    assert.throws(
      () => previewReviewDealRow({
        family_id: 'INTERIM_OPERATING',
        review_deal: { cards: [{ ...baseCard, party }] },
        target_card_id: baseCard.id,
      }),
      (error) => error.code === 'ROUTE_PARTY_CAPACITY_UNSUPPORTED',
    );
  }
});
