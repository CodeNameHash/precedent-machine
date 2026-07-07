const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const residualAudit = require('../../scripts/schema-loss/audit-residuals.js');
const integrityAudit = require('../../scripts/schema-loss/audit-claim-integrity.js');
const applyDecision = require('../../scripts/schema-loss/apply-integrity-decision.js');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

test('schema-loss audits are deterministic', () => {
  integrityAudit.run();
  residualAudit.run();
  const firstObservations = read('docs/schema-shape/unmapped-observations.json');
  const firstWarnings = read('docs/schema-shape/claim-integrity-warnings.jsonl');
  integrityAudit.run();
  residualAudit.run();
  assert.equal(read('docs/schema-shape/unmapped-observations.json'), firstObservations);
  assert.equal(read('docs/schema-shape/claim-integrity-warnings.jsonl'), firstWarnings);
});

test('Dimension A queue only exposes clusters seen in at least three Deals', () => {
  const queue = JSON.parse(read('docs/schema-shape/unmapped-observations.json'));
  for (const cluster of queue.clusters || []) {
    assert.ok(cluster.distinct_deals >= 3, `${cluster.id} is below threshold`);
  }
});

test('Dimension B checks are independently detectable with fixture Claims', () => {
  const baseClaim = {
    id: 'claim-1',
    deal_id: 'deal-1',
    field_key: 'antitrustEffortsStandard',
    raw_value: 'reasonable best efforts',
    canonicalKey: 'reasonable-best-efforts',
    source_provision_id: 'prov-1',
    evidence_quote: 'Parent shall use commercially reasonable efforts.',
  };
  const context = {
    provision: {
      text: 'The Company shall operate in the ordinary course. Parent shall use reasonable best efforts.',
      section_anchor: 'Article III - Representations',
    },
    attribute: {
      structural_patterns: {
        expected_sections: ['Article VI'],
        expected_context_terms: ['Antitrust'],
      },
      party_scope: 'Company',
    },
    canonicalMarkers: ['reasonable best efforts'],
  };
  const result = integrityAudit.runIntegrityChecksForClaim(baseClaim, context);
  assert.ok(result.checks_failed.includes('B1'));
  assert.ok(result.checks_failed.includes('B2'));
  assert.ok(result.checks_failed.includes('B3'));
  assert.ok(result.checks_failed.includes('B4'));
  assert.ok(result.checks_failed.includes('B5'));

  const longClaim = {
    ...baseClaim,
    canonicalKey: null,
    evidence_quote: 'x'.repeat(500),
  };
  assert.ok(integrityAudit.runIntegrityChecksForClaim(longClaim, {}).checks_failed.includes('B6'));
});

test('Dimension B warnings include check details', () => {
  const rows = read('docs/schema-shape/claim-integrity-warnings.jsonl').split('\n').filter(Boolean).map((line) => JSON.parse(line));
  assert.ok(rows.length > 0);
  for (const row of rows) {
    assert.ok(Array.isArray(row.checks_failed));
    assert.ok(row.checks_failed.length > 0);
    assert.equal(typeof row.check_details, 'object');
  }
});

test('integrity reassignment writes a WORKLOG entry and keeps Claim shape', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'schema-loss-'));
  const normalizedFile = path.join(dir, 'normalized-v1.json');
  const worklogFile = path.join(dir, 'WORKLOG-P0-D.md');
  fs.writeFileSync(normalizedFile, JSON.stringify({
    triples: [
      {
        id: 'claim-1',
        deal_id: 'deal-1',
        field_key: 'oldAttribute',
        raw_value: 'old',
        evidence_quote: 'excerpt',
      },
    ],
  }, null, 2));
  const result = applyDecision.applyDecision({
    decision_type: 'reassign-attribute',
    claim_id: 'claim-1',
    target_field_key: 'newAttribute',
  }, { normalizedFile, worklogFile });
  assert.equal(result.changed, true);
  const updated = JSON.parse(read(normalizedFile));
  assert.equal(updated.triples[0].field_key, 'newAttribute');
  assert.match(read(worklogFile), /schema-loss reassign-attribute/);
});

test('FROZEN paths are guarded by scripts and the decision endpoint', () => {
  assert.throws(() => applyDecision.assertNotFrozenPath('docs/vocab/FROZEN-triggerCode-v1.json'), /Refusing/);
  const endpoint = read('pages/api/admin/schema-loss/decide.js');
  assert.match(endpoint, /assertWritableTarget/);
  assert.match(endpoint, /docs\\\/vocab\\\/FROZEN-/);
  assert.match(endpoint, /docs\\\/market-registry\\\/FROZEN-/);
  assert.doesNotMatch(endpoint, /generated-v1\.json/);
  assert.doesNotMatch(endpoint, /writeFileSync/);
});

test('schema-loss admin page and APIs are wired into nav', () => {
  const registry = JSON.parse(read('docs/admin/nav-registry.json'));
  const entry = registry.find((item) => item.id === 'schema-loss');
  assert.deepEqual(entry && {
    href: entry.href,
    group: entry.group,
    order: entry.order,
  }, {
    href: '/admin/schema-loss',
    group: 'schema',
    order: 60,
  });
  assert.ok(fs.existsSync('pages/admin/schema-loss.js'));
  assert.ok(fs.existsSync('pages/api/admin/schema-loss/queue.js'));
  assert.ok(fs.existsSync('pages/api/admin/schema-loss/decide.js'));
  assert.ok(fs.existsSync('pages/api/admin/schema-loss/rerun.js'));
});
