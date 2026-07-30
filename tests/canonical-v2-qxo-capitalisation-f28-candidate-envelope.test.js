const assert = require('node:assert/strict');
const test = require('node:test');

const {
  canonicalJson,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  AUTHORITY_STATE,
  QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_RUNTIME_SCHEMA,
  buildQxoCapitalisationF28CandidateEnvelope,
} = require(
  '../lib/canonical-v2/qxo-capitalisation-f28-candidate-envelope',
);
const {
  buildF28ProductInputs,
  clone,
} = require(
  './fixtures/canonical-v2/qxo-capitalisation-f28-product-inputs',
);

function input() {
  const value = buildF28ProductInputs();
  return {
    qxo_cross_view_release: value.qxo_cross_view_release,
    reviewed_graph: value.reviewed_graph,
    source_context: value.source_context,
    parser_source_closure: value.parser_source_closure,
    contract_bundle: value.contract_bundle,
  };
}

test('builds one immutable F28 envelope with fourteen exact terminals', () => {
  const value = buildQxoCapitalisationF28CandidateEnvelope(input());
  assert.equal(
    value.schema_version,
    QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_RUNTIME_SCHEMA,
  );
  assert.equal(value.authority_state, AUTHORITY_STATE);
  assert.equal(value.candidate_state, 'VALIDATED_NOT_MATERIALISED');
  assert.equal(value.ordered_terminals.length, 14);
  assert.equal(
    value.ordered_terminals.filter(
      (entry) => entry.subject_terminal_kind === 'MARKET_OBSERVATION',
    ).length,
    13,
  );
  assert.equal(
    value.ordered_terminals.filter(
      (entry) => entry.subject_terminal_kind
        === 'MARKET_METRIC_SLOT_EXCLUSION',
    ).length,
    1,
  );
  assert.equal(Object.isFrozen(value), true);
});

test('preserves the exact row and terminal payloads from the source release', () => {
  const source = input();
  const value = buildQxoCapitalisationF28CandidateEnvelope(source);
  assert.equal(
    canonicalJson(value.provision_row),
    canonicalJson(source.qxo_cross_view_release.provision_row),
  );
  const subjects = [
    ...source.qxo_cross_view_release.observations,
    ...source.qxo_cross_view_release.exclusions,
  ];
  for (const subject of subjects) {
    assert.equal(
      value.ordered_terminals.some(
        (entry) => canonicalJson(entry.subject_terminal)
          === canonicalJson(subject),
      ),
      true,
    );
  }
});

test('rejects release, row, terminal and authority drift', () => {
  const releaseDrift = input();
  releaseDrift.qxo_cross_view_release = clone(
    releaseDrift.qxo_cross_view_release,
  );
  releaseDrift.qxo_cross_view_release.release_id = '0'.repeat(64);
  assert.throws(
    () => buildQxoCapitalisationF28CandidateEnvelope(releaseDrift),
    /release|identity|drift|invalid/i,
  );

  const terminalDrift = input();
  terminalDrift.qxo_cross_view_release = clone(
    terminalDrift.qxo_cross_view_release,
  );
  terminalDrift.qxo_cross_view_release.observations[0].raw_value = 'forged';
  assert.throws(
    () => buildQxoCapitalisationF28CandidateEnvelope(terminalDrift),
    /release|terminal|identity|drift|invalid/i,
  );

  const authorityDrift = input();
  authorityDrift.qxo_cross_view_release = clone(
    authorityDrift.qxo_cross_view_release,
  );
  authorityDrift.qxo_cross_view_release.manifest.authority.serving = 'GRANTED';
  assert.throws(
    () => buildQxoCapitalisationF28CandidateEnvelope(authorityDrift),
    /release|authority|invalid/i,
  );
});
