'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { previewClaimSection } = require('../lib/review-parity/rendered-row-preview');

function entry({ id, definition, concept, capacity, canonical = true, attributes = {} }) {
  const party = {
    role: concept === 'COND-REG' ? 'CONDITION_BENEFICIARY' : 'CONDITION_OBLIGOR',
    value: capacity === 'BUYER' ? 'Parent' : capacity === 'TARGET' ? 'Company' : 'Either Principal Party',
    capacity,
  };
  return {
    section_reference: '7.1',
    resolved_claim_definition_key: definition,
    concept_key: concept,
    party,
    provision_instance: { provision_instance_id: `provision-${id}`, party },
    claim: {
      claim_revision_id: `claim-${id}`,
      canonical_value: canonical,
      raw_value: `Operative ${definition} text`,
      attributes,
      evidence: [{ excerpt_id: `excerpt-${id}`, absolute_start: 0, absolute_end: 20 }],
    },
  };
}

function run(family, resolved) {
  return {
    manifest: { section_family: family, deal: 'row-owner-test' },
    resolution: { resolved, open_world: [], review_queue: [], residuals: [] },
  };
}

test('superior-proposal termination claim renders in its No-Solicitation owner section', () => {
  const resolved = entry({
    id: 'superior',
    definition: 'TERMINATION_RIGHT_GRANT',
    concept: 'TERMR-SUPERIOR',
    capacity: 'TARGET',
    attributes: { assertion_kind: 'RIGHT_GRANT', trigger_kind: 'SUPERIOR_PROPOSAL' },
  });
  const preview = previewClaimSection({ run: run('TERMINATION', [resolved]), resolved_entry: resolved });
  assert.equal(preview.section.id, 'nosol');
  assert.equal(preview.row_count, 1);
});

test('sole-remedy claims render in their Remedies owner section', () => {
  const effect = entry({
    id: 'sole-effect',
    definition: 'SOLE_REMEDY_LEGAL_EFFECT_PRESENT',
    concept: 'REM-SOLE',
    capacity: 'EITHER_PRINCIPAL_PARTY',
  });
  const carveout = {
    ...entry({
      id: 'sole-carveout',
      definition: 'SOLE_REMEDY_CARVEOUT_KIND',
      concept: 'REM-SOLE',
      capacity: 'EITHER_PRINCIPAL_PARTY',
      canonical: 'FRAUD',
    }),
    provision_instance: effect.provision_instance,
  };
  const resolutionRun = run('TERMINATION_FEE', [effect, carveout]);
  for (const resolved of [effect, carveout]) {
    const preview = previewClaimSection({ run: resolutionRun, resolved_entry: resolved });
    assert.equal(preview.section.id, 'misc-boilerplate');
    assert.equal(preview.row_count, 1);
    const text = preview.rows.flatMap((row) => row.cells.map((cell) => cell.text)).join(' ');
    if (resolved === effect) assert.doesNotMatch(text, /FRAUD/);
  }
});

test('Termination projection excludes a sibling claim on the same provision', () => {
  const grant = entry({
    id: 'legal-grant', definition: 'TERMINATION_RIGHT_GRANT', concept: 'TERMR-LEGAL',
    capacity: 'EITHER_PRINCIPAL_PARTY', attributes: { assertion_kind: 'RIGHT_GRANT', trigger_kind: 'LEGAL_RESTRAINT' },
  });
  const sibling = {
    ...entry({
      id: 'legal-sibling', definition: 'TERMINATION_RIGHT_GRANT', concept: 'TERMR-LEGAL',
      capacity: 'EITHER_PRINCIPAL_PARTY', attributes: { assertion_kind: 'RIGHT_GRANT', trigger_kind: 'LEGAL_RESTRAINT' },
    }),
    provision_instance: grant.provision_instance,
    claim: {
      ...entry({
        id: 'legal-sibling', definition: 'TERMINATION_RIGHT_GRANT', concept: 'TERMR-LEGAL',
        capacity: 'EITHER_PRINCIPAL_PARTY', attributes: { assertion_kind: 'RIGHT_GRANT', trigger_kind: 'LEGAL_RESTRAINT' },
      }).claim,
      raw_value: 'SIBLING CLAIM MUST NOT RENDER',
    },
  };
  const preview = previewClaimSection({ run: run('TERMINATION', [grant, sibling]), resolved_entry: grant });
  const text = preview.rows.flatMap((row) => row.cells.map((cell) => cell.text)).join(' ');
  assert.doesNotMatch(text, /SIBLING CLAIM MUST NOT RENDER/);
});

test('new Closing Conditions definitions project to existing canonical rows', () => {
  const resolved = [
    entry({
      id: 'regulatory', definition: 'REGULATORY_APPROVAL_CONDITION', concept: 'COND-REG',
      capacity: 'EITHER_PRINCIPAL_PARTY', attributes: { assertion_kind: 'REGULATORY_APPROVAL', approval_kind: 'HSR' },
    }),
    entry({
      id: 'target-covenant', definition: 'COVENANT_COMPLIANCE_STANDARD', concept: 'COND-COV',
      capacity: 'TARGET', canonical: 'MAT_ALL_MATERIAL', attributes: { assertion_kind: 'COVENANT_COMPLIANCE' },
    }),
    entry({
      id: 'buyer-covenant', definition: 'COVENANT_COMPLIANCE_STANDARD', concept: 'COND-COV',
      capacity: 'BUYER', canonical: 'MAT_ALL_MATERIAL', attributes: { assertion_kind: 'COVENANT_COMPLIANCE' },
    }),
    entry({
      id: 'mae', definition: 'NO_MAE_CONDITION', concept: 'COND-MAE', capacity: 'TARGET',
      attributes: { assertion_kind: 'NO_MAE_CONDITION' },
    }),
  ];
  const resolutionRun = run('CLOSING_CONDITIONS', resolved);
  for (const item of resolved) {
    const preview = previewClaimSection({ run: resolutionRun, resolved_entry: item });
    assert.equal(preview.section.id, 'conditions');
    assert.equal(preview.row_count, 1);
  }
});

test('Closing Conditions projection excludes a sibling claim on the same provision', () => {
  const mae = entry({
    id: 'mae-scope', definition: 'NO_MAE_CONDITION', concept: 'COND-MAE', capacity: 'TARGET',
    attributes: { assertion_kind: 'NO_MAE_CONDITION' },
  });
  const continuing = {
    ...entry({
      id: 'mae-continuing', definition: 'NO_MAE_CONDITION_CONTINUING', concept: 'COND-MAE', capacity: 'TARGET',
      attributes: { assertion_kind: 'MAE_CONTINUING' },
    }),
    provision_instance: mae.provision_instance,
  };
  const preview = previewClaimSection({
    run: run('CLOSING_CONDITIONS', [mae, continuing]),
    resolved_entry: mae,
  });
  const text = preview.rows.flatMap((row) => row.cells.map((cell) => cell.text)).join(' ');
  assert.match(text, /Continuing requirement not specified/);
  assert.doesNotMatch(text, /must be continuing at closing/);
});
