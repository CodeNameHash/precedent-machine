const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const fixture = require(
  '../__fixtures__/canonical-v2/metsera-exclusivity-p8.json',
);

test('binds one real Metsera result to all four product views', () => {
  const resultId = fixture.product_query_result_identity;
  assert.equal(
    fixture.fixture_kind,
    'REAL_SEALED_METSERA_P8_INACTIVE_CANDIDATE',
  );
  assert.equal(fixture.release_state, 'INACTIVE_CANDIDATE');
  assert.deepEqual(
    Object.keys(fixture.surface_bindings).sort(),
    ['COMPARE', 'CORPUS_CONTEXT', 'QUERY', 'REVIEW'],
  );
  for (const binding of Object.values(fixture.surface_bindings)) {
    assert.equal(binding.product_query_result_identity, resultId);
    assert.equal(
      binding.product_query_definition_id,
      fixture.product_query_definition_id,
    );
  }
  assert.equal(
    fixture.shared_result.domain_result_payload,
    fixture.presentation.result_slots[0].exact_content,
  );
  assert.equal(
    fixture.source_reader.disposition,
    'RELEASE_NOT_ACTIVE',
  );
  assert.equal(fixture.source_reader.execution_state, 'NOT_EXECUTED');
  assert.equal(fixture.source_reader.original_result_preserved, true);
});

test('does not manufacture market data for one pilot result', () => {
  assert.equal(
    fixture.surface_bindings.COMPARE.market_state,
    'SINGLE_PILOT_RESULT_NO_MARKET_COHORT',
  );
  assert.equal(
    fixture.surface_bindings.CORPUS_CONTEXT.market_state,
    'SINGLE_PILOT_RESULT_NO_MARKET_COHORT',
  );
  assert.doesNotMatch(JSON.stringify(fixture), /No market data/);
});

test('uses the compact three-column browser layout and inactive source action', () => {
  const component = fs.readFileSync(
    path.join(
      __dirname,
      '../components/process/MetseraExclusivityCrossView.jsx',
    ),
    'utf8',
  );
  const page = fs.readFileSync(
    path.join(
      __dirname,
      '../pages/design/canonical-v2-metsera-exclusivity-p8.js',
    ),
    'utf8',
  );
  assert.match(
    component,
    /lg:grid-cols-\[180px_minmax\(0,1fr\)_300px\]/,
  );
  assert.match(component, /Query/);
  assert.match(component, /Review/);
  assert.match(component, /Compare/);
  assert.match(component, /Corpus Context/);
  assert.match(component, /RELEASE_NOT_ACTIVE|release is not active/i);
  assert.match(page, /designPreviewServerSideProps/);
  assert.doesNotMatch(page, /fetch\s*\(/);
  assert.doesNotMatch(page, /\/api\//);
});

test('uses the exact seven-file phase boundary', () => {
  const allowlist = require(
    '../.github/phase-allowlists/wp-metsera-exclusivity-browser-acceptance-v1.json',
  );
  assert.equal(
    allowlist.phase,
    'WP-METSERA-EXCLUSIVITY-BROWSER-ACCEPTANCE-V1',
  );
  assert.equal(allowlist.allowed.length, 7);
});
