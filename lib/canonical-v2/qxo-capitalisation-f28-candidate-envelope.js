const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  validateQxoCapitalisationCrossViewReleaseF28,
} = require('./qxo-capitalisation-cross-view-release-f28');
const {
  QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_DEFINITION_DIGEST,
  validateAuthoredQxoCapitalisationF28CandidateEnvelopeInputs,
} = require(
  './qxo-capitalisation-f28-candidate-envelope-contract-input-validator',
);

const contract = require(
  '../../contracts/canonical-v2/successor/product/query/qxo-capitalisation-f28-candidate-envelope.v1.json',
);

const QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_RUNTIME_SCHEMA =
  'QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_RUNTIME/V1';
const AUTHORITY_STATE = 'NONE';

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort())
      !== canonicalJson([...expected].sort())) {
    throw new TypeError(`${label} fields do not match the closed contract`);
  }
}

function validateContract() {
  validateAuthoredQxoCapitalisationF28CandidateEnvelopeInputs([{
    object_kind: contract.object_kind,
    canonical_value: contract,
  }]);
}

function validateRelease(input) {
  validateQxoCapitalisationCrossViewReleaseF28({
    candidate: input.qxo_cross_view_release,
    reviewedGraph: input.reviewed_graph,
    sourceContext: input.source_context,
    parserSourceClosure: input.parser_source_closure,
    contractBundle: input.contract_bundle,
  });
}

function subjectTerminals(release) {
  return new Map([
    ...release.observations.map((value) => [
      value.metric_serving_admission_id,
      {
        kind: 'MARKET_OBSERVATION',
        id: value.market_observation_id,
        value,
      },
    ]),
    ...release.exclusions.map((value) => [
      value.metric_serving_admission_id,
      {
        kind: 'MARKET_METRIC_SLOT_EXCLUSION',
        id: value.market_metric_slot_exclusion_id,
        value,
      },
    ]),
  ]);
}

function buildOrderedTerminals(release, envelopeDefinition) {
  const subjects = subjectTerminals(release);
  if (subjects.size !== release.admissions.length) {
    throw new TypeError('the F28 release does not have one terminal per admission');
  }
  return release.admissions.map((admission, ordinal) => {
    const subject = subjects.get(admission.metric_serving_admission_id);
    const governed =
      envelopeDefinition.ordered_terminals.ordered_metric_slots[ordinal];
    const subjectDigest = sha256Hex(Buffer.from(
      canonicalJson(subject?.value),
      'utf8',
    ));
    const terminalBody = {
      ordinal,
      subject_terminal_kind: subject?.kind,
      subject_terminal_id: subject?.id,
      subject_terminal_payload_digest: subjectDigest,
    };
    const terminalId = contentId(
      'QXO_CAPITALISATION_F28_CANDIDATE_TERMINAL/V1',
      terminalBody,
    );
    const terminalPayloadDigest = sha256Hex(Buffer.from(
      canonicalJson(terminalBody),
      'utf8',
    ));
    if (
      !subject
      || governed.ordinal !== ordinal
      || governed.metric_key !== admission.metric_key
      || governed.value_slot_key !== admission.value_slot_key
      || governed.subject_terminal_kind !== subject.kind
    ) {
      throw new TypeError(
        `the F28 candidate terminal ${ordinal} does not match its governed subject`,
      );
    }
    return {
      ordinal,
      terminal_id: terminalId,
      terminal_payload_digest: terminalPayloadDigest,
      subject_terminal_kind: subject.kind,
      subject_terminal_id: subject.id,
      subject_terminal_payload_digest: subjectDigest,
      metric_serving_admission_id: admission.metric_serving_admission_id,
      subject_terminal: clone(subject.value),
    };
  });
}

function buildQxoCapitalisationF28CandidateEnvelope(input = {}) {
  exactKeys(input, [
    'qxo_cross_view_release',
    'reviewed_graph',
    'source_context',
    'parser_source_closure',
    'contract_bundle',
  ], 'QXO F28 candidate-envelope input');
  validateContract();
  validateRelease(input);
  const release = input.qxo_cross_view_release;
  const definition = contract.definition.candidate_envelope_contract;
  if (
    release.schema_version
      !== definition.source_cross_view_release.schema_version
    || release.provision_row.schema_version
      !== definition.provision_row.schema_version
    || !/^[a-f0-9]{64}$/.test(
      release.qxo_capitalisation_cross_view_release_f28_id,
    )
    || !/^[a-f0-9]{64}$/.test(release.canonical_payload_digest)
    || !/^[a-f0-9]{64}$/.test(release.provision_row.provision_row_id)
    || !/^[a-f0-9]{64}$/.test(sha256Hex(Buffer.from(
      canonicalJson(release.provision_row),
      'utf8',
    )))
  ) {
    throw new TypeError(
      'the F28 candidate envelope does not match its governed release and row',
    );
  }
  const body = {
    contract_stable_id: contract.stable_id,
    contract_definition_digest:
      QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_DEFINITION_DIGEST,
    source_cross_view_release_id:
      release.qxo_capitalisation_cross_view_release_f28_id,
    source_cross_view_release_payload_digest:
      release.canonical_payload_digest,
    provision_row: clone(release.provision_row),
    ordered_terminals: buildOrderedTerminals(release, definition),
    product_membership: {
      domain_key: definition.product_membership.domain_key,
      result_definition_stable_id:
        definition.product_membership.result_definition_stable_id,
      result_definition_version:
        definition.product_membership.result_definition_version,
      domain_result_identity: release.provision_row.provision_row_id,
      domain_result_payload_digest: sha256Hex(Buffer.from(
        canonicalJson(release.provision_row),
        'utf8',
      )),
      membership_state: definition.product_membership.membership_state,
    },
    candidate_state: 'VALIDATED_NOT_MATERIALISED',
    authority_state: AUTHORITY_STATE,
  };
  return freeze({
    schema_version:
      QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_RUNTIME_SCHEMA,
    qxo_capitalisation_f28_candidate_envelope_id: contentId(
      QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_RUNTIME_SCHEMA,
      body,
    ),
    ...body,
  });
}

function validateQxoCapitalisationF28CandidateEnvelope(value, input) {
  if (
    canonicalJson(value)
      !== canonicalJson(buildQxoCapitalisationF28CandidateEnvelope(input))
  ) {
    throw new TypeError('the F28 candidate envelope has changed');
  }
  return true;
}

module.exports = {
  AUTHORITY_STATE,
  QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_RUNTIME_SCHEMA,
  buildQxoCapitalisationF28CandidateEnvelope,
  validateQxoCapitalisationF28CandidateEnvelope,
};
