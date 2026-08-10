'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  FAMILY_ROUTES,
  previewClaimSection,
  previewResolvedClaimRow,
} = require('../lib/review-parity/rendered-row-preview');
const {
  NATIVE_SOURCE,
  projectEmployeeDnoProductSurfaces,
} = require('../lib/canonical-v2/employee-dno-product-projection');

const ROOT = path.resolve(__dirname, '..');

function pinnedRuns() {
  const manifest = JSON.parse(fs.readFileSync(path.join(
    ROOT, 'evidence', 'canonical-v2', 'stage-2y-cd-baseline-manifest.json',
  ), 'utf8'));
  return manifest.runs.filter((run) => run.family === 'EMPLOYEE_MATTERS');
}

function recordedRun(pin) {
  return {
    manifest: JSON.parse(fs.readFileSync(path.resolve(ROOT, pin.run_manifest.path), 'utf8')),
    resolution: JSON.parse(fs.readFileSync(path.resolve(ROOT, pin.resolution.path), 'utf8')),
  };
}

function resolvedEntry({ definition, claimId, attributes = {}, value = true }) {
  return {
    resolved_claim_definition_key: definition,
    concept_key: 'COV-EMPLOYEE',
    section_reference: '6.8',
    provision_instance: { provision_instance_id: 'employee-protection-period' },
    claim: {
      claim_revision_id: claimId,
      raw_value: definition === 'BENEFITS_CONTINUATION_PERIOD_MONTHS'
        ? 'For twelve months after Closing, the employee protections apply.'
        : 'Base salary will be no less favourable for twelve months after Closing.',
      canonical_value: value,
      attributes,
    },
  };
}

test('Employee Matters routes every supported definition and exact relief kind without text inference', () => {
  assert.deepEqual(FAMILY_ROUTES.EMPLOYEE_MATTERS, {
    configId: 'employee-benefits',
    projectionModule: 'lib/canonical-v2/employee-dno-product-projection.js',
    projectionExport: 'projectEmployeeDnoProductSurfaces',
    rowMatch: 'FEATURE_LINEAGE',
    featureKeyByClaimDefinition: {
      BENEFITS_CONTINUATION_PERIOD_MONTHS: 'protectionPeriodMonths',
      EMPLOYEE_COMP_ITEM_STANDARD: 'compensationItems',
      EMPLOYEE_MATTERS_TPB_DISCLAIMER: 'employeeMattersThirdPartyBeneficiaryDisclaimer',
      EMPLOYEE_SERVICE_CREDIT: 'continuedService',
      WELFARE_PLAN_TRANSITION_RELIEF: [
        'eligibilityWaiver',
        'welfarePlanExpenseCredit',
      ],
    },
  });
});

test('Employee claims report atomic rows and fail closed on merged service-credit lineage', () => {
  const result = { claims: 0, rows: 0, content: 0, failures: [] };

  for (const pin of pinnedRuns()) {
    const run = recordedRun(pin);
    assert.equal(run.resolution.resolved.length, pin.resolved_count);
    for (const entry of run.resolution.resolved) {
      result.claims += 1;
      try {
        const preview = previewResolvedClaimRow({ run, resolved_entry: entry });
        const section = previewClaimSection({ run, resolved_entry: entry });
        result.rows += 1;
        if (preview.row.cells.some((cell) => cell.text?.trim())) result.content += 1;
        assert.equal(section.rows.filter((row) => row.matches_claim_key).length, 1);
      } catch (error) {
        result.failures.push({
          deal: pin.deal,
          claim_revision_id: entry.claim.claim_revision_id,
          code: error.code || error.name,
        });
      }
    }
  }

  assert.deepEqual(result, {
    claims: 27,
    rows: 25,
    content: 25,
    failures: [
      {
        deal: 'concho',
        claim_revision_id: '4b36a406ce63f1db67db45a7d0a466a4ed6d96c4434460ccd112e43993a012a4',
        code: 'CLAIM_FEATURE_ROW_MISSING',
      },
      {
        deal: 'concho',
        claim_revision_id: 'b0d3a18d2089fea5b0be463851e4c6788202728eb2f534d606e6603caa32ca29',
        code: 'CLAIM_FEATURE_ROW_MISSING',
      },
    ],
  });
});

test('every projected Employee feature and repeated compensation row carries exact claim lineage', async () => {
  const { employeeBenefitsConfig } = await import('../components/review/table-configs/employee-benefits.config.js');

  for (const pin of pinnedRuns()) {
    const run = recordedRun(pin);
    const projection = projectEmployeeDnoProductSurfaces({ resolution: run.resolution, deal_id: pin.deal });
    const cards = projection.cards.filter((card) => card.canonical_v2_lineage.source === NATIVE_SOURCE);
    for (const card of cards) {
      const lineage = card.canonical_v2_lineage.feature_claim_revision_ids;
      for (const featureKey of Object.keys(card.features)) {
        assert.ok(Array.isArray(lineage[featureKey]) && lineage[featureKey].length > 0, `${pin.directory}:${featureKey}`);
      }
    }
    const rows = employeeBenefitsConfig.selectRows({ cards: projection.cards });
    const governedRows = rows.filter((row) => row.sourceCard?.canonical_v2_lineage?.source === NATIVE_SOURCE);
    assert.ok(governedRows.every((row) => typeof row.featureKey === 'string' && row.featureKey));
    for (const row of governedRows.filter((candidate) => candidate.featureKey === 'compensationItems')) {
      assert.equal(typeof row.claimRevisionId, 'string', `${pin.directory}:${row.id}`);
      assert.ok(row.sourceCard.canonical_v2_lineage.feature_claim_revision_ids.compensationItems.includes(row.claimRevisionId));
    }
  }
});

test('a protection period used only as header context fails honestly instead of claiming a compensation row', () => {
  const compensation = resolvedEntry({
    definition: 'EMPLOYEE_COMP_ITEM_STANDARD',
    claimId: 'employee-compensation-claim',
    attributes: {
      comp_item: 'BASE_SALARY',
      standard_kind: 'NO_LESS_FAVORABLE',
      benchmark: 'TARGET_PRE_CLOSING',
    },
  });
  const period = resolvedEntry({
    definition: 'BENEFITS_CONTINUATION_PERIOD_MONTHS',
    claimId: 'employee-period-claim',
    value: '12',
  });
  const run = {
    manifest: { section_family: 'EMPLOYEE_MATTERS', deal: 'employee-period-test' },
    resolution: { resolved: [compensation, period], open_world: [] },
  };

  assert.equal(previewResolvedClaimRow({ run, resolved_entry: compensation }).row.id, 'employee-benefits-BASE_SALARY');
  assert.throws(
    () => previewResolvedClaimRow({ run, resolved_entry: period }),
    (error) => error.code === 'CLAIM_FEATURE_ROW_MISSING'
      && error.details.feature_key === 'protectionPeriodMonths',
  );
});

test('an unregistered welfare relief kind fails closed instead of guessing a row', () => {
  const unknown = resolvedEntry({
    definition: 'WELFARE_PLAN_TRANSITION_RELIEF',
    claimId: 'employee-unknown-relief',
    attributes: { relief_kind: 'UNREGISTERED_RELIEF' },
  });

  assert.throws(
    () => projectEmployeeDnoProductSurfaces({
      resolution: { resolved: [unknown], open_world: [] },
      deal_id: 'employee-unknown-relief-test',
    }),
    /unsupported Employee relief_kind: UNREGISTERED_RELIEF/,
  );
});
