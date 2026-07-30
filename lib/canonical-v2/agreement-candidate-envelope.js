const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  validateQxoCapitalisationCrossViewReleaseF28,
} = require('./qxo-capitalisation-cross-view-release-f28');
const {
  buildReviewedIocCapexServingRow,
  buildReviewedIocCapexSlice,
} = require('./reviewed-ioc-capex-slice');
const {
  AGREEMENT_CANDIDATE_ENVELOPE_DEFINITION_DIGEST,
  validateAuthoredAgreementCandidateEnvelopeInputs,
} = require('./agreement-candidate-envelope-contract-input-validator');

const contract = require(
  '../../contracts/canonical-v2/successor/product/query/agreement-candidate-envelope.v1.json',
);

const AGREEMENT_CANDIDATE_ENVELOPE_RUNTIME_SCHEMA =
  'AGREEMENT_CANDIDATE_ENVELOPE/V1';
const SOURCE_PROJECTION_SCHEMA =
  'AGREEMENT_CANDIDATE_ENVELOPE_SOURCE_PROJECTION/V1';
const TERMINAL_SCHEMA = 'AGREEMENT_CANDIDATE_ENVELOPE_TERMINAL/V1';
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

function digest(value) {
  return sha256Hex(Buffer.from(canonicalJson(value), 'utf8'));
}

function profiles() {
  validateAuthoredAgreementCandidateEnvelopeInputs([{
    object_kind: contract.object_kind,
    canonical_value: contract,
  }]);
  return new Map(
    contract.definition.runtime_contract.admitted_family_profiles.map(
      (profile) => [profile.profile_id, profile],
    ),
  );
}

function profileFor(profileId) {
  const profile = profiles().get(profileId);
  if (!profile) {
    throw new TypeError('the Agreement candidate-envelope family is not admitted');
  }
  return profile;
}

function subjectTerminal(kind, value) {
  if (kind === 'MARKET_OBSERVATION') {
    return {
      id: value?.market_observation_id
        || value?.market_observation_serving_key,
      value,
    };
  }
  if (kind === 'MARKET_METRIC_SLOT_EXCLUSION') {
    return {
      id: value?.market_metric_slot_exclusion_id,
      value,
    };
  }
  throw new TypeError('the Agreement candidate-envelope terminal kind is not governed');
}

function buildF28Projection(input, profile) {
  exactKeys(input, [
    'qxo_cross_view_release',
    'reviewed_graph',
    'source_context',
    'parser_source_closure',
    'contract_bundle',
  ], 'QXO F28 family input');
  validateQxoCapitalisationCrossViewReleaseF28({
    candidate: input.qxo_cross_view_release,
    reviewedGraph: input.reviewed_graph,
    sourceContext: input.source_context,
    parserSourceClosure: input.parser_source_closure,
    contractBundle: input.contract_bundle,
  });
  const release = input.qxo_cross_view_release;
  const terminals = new Map([
    ...release.observations.map((value) => [
      value.metric_serving_admission_id,
      { kind: 'MARKET_OBSERVATION', value },
    ]),
    ...release.exclusions.map((value) => [
      value.metric_serving_admission_id,
      { kind: 'MARKET_METRIC_SLOT_EXCLUSION', value },
    ]),
  ]);
  const ordered = release.admissions.map((admission, ordinal) => {
    const terminal = terminals.get(admission.metric_serving_admission_id);
    const governed = profile.ordered_metric_slots[ordinal];
    if (
      !terminal
      || governed?.ordinal !== ordinal
      || governed.metric_key !== admission.metric_key
      || governed.value_slot_key !== admission.value_slot_key
      || governed.subject_terminal_kind !== terminal.kind
    ) {
      throw new TypeError(`the F28 source terminal ${ordinal} is not profile-governed`);
    }
    return {
      ordinal,
      metric_key: admission.metric_key,
      value_slot_key: admission.value_slot_key,
      subject_terminal_kind: terminal.kind,
      ...subjectTerminal(terminal.kind, terminal.value),
    };
  });
  return {
    source_release: {
      schema_version: release.schema_version,
      id: release.qxo_capitalisation_cross_view_release_f28_id,
      payload_digest: release.canonical_payload_digest,
    },
    provision_row: {
      schema_version: release.provision_row.schema_version,
      id: release.provision_row.provision_row_id,
      payload_digest: digest(release.provision_row),
      payload: release.provision_row,
    },
    ordered_terminals: ordered,
    source_validation_input_digest: digest(input),
  };
}

function buildIocProjection(input, profile) {
  exactKeys(input, [
    'agreement_text',
    'deal_value_source_text',
    'contract_bundle',
  ], 'IOC capex family input');
  const slice = buildReviewedIocCapexSlice({
    agreementText: input.agreement_text,
    dealValueSourceText: input.deal_value_source_text,
    contractBundle: input.contract_bundle,
  });
  const row = buildReviewedIocCapexServingRow({
    slice,
    contractBundle: input.contract_bundle,
  });
  const observation = slice.projection.observation;
  const governed = profile.ordered_metric_slots[0];
  if (
    !observation
    || governed?.ordinal !== 0
    || governed.metric_key !== observation.metric_key
    || governed.value_slot_key !== observation.value_slot_key
    || governed.subject_terminal_kind !== 'MARKET_OBSERVATION'
  ) {
    throw new TypeError('the IOC capex source terminal is not profile-governed');
  }
  return {
    source_release: {
      schema_version: slice.reviewed_mapping.schema_version,
      id: slice.reviewed_mapping.reviewed_mapping_id,
      payload_digest: slice.reviewed_mapping.canonical_payload_digest,
    },
    provision_row: {
      schema_version: row.schema_version,
      id: row.row_serving_key,
      payload_digest: digest(row),
      payload: row,
    },
    ordered_terminals: [{
      ordinal: 0,
      metric_key: observation.metric_key,
      value_slot_key: observation.value_slot_key,
      subject_terminal_kind: 'MARKET_OBSERVATION',
      ...subjectTerminal('MARKET_OBSERVATION', observation),
    }],
    source_validation_input_digest: digest(input),
  };
}

function buildSourceProjection(profile, familyInput) {
  let projected;
  if (profile.profile_id === 'CAPITALISATION_BRING_DOWN_V3') {
    projected = buildF28Projection(familyInput, profile);
  } else if (profile.profile_id === 'IOC_CAPEX_RESTRICTION_V1') {
    projected = buildIocProjection(familyInput, profile);
  } else {
    throw new TypeError('the Agreement candidate-envelope source adapter is absent');
  }
  if (
    projected.source_release.schema_version
      !== profile.source_release_schema_version
    || projected.provision_row.schema_version
      !== profile.provision_row_schema_version
    || !/^[a-f0-9]{64}$/.test(projected.source_release.id)
    || !/^[a-f0-9]{64}$/.test(projected.source_release.payload_digest)
    || !/^[a-f0-9]{64}$/.test(projected.provision_row.id)
    || !/^[a-f0-9]{64}$/.test(projected.provision_row.payload_digest)
    || projected.provision_row.payload_digest
      !== digest(projected.provision_row.payload)
  ) {
    throw new TypeError('the Agreement candidate-envelope source projection is invalid');
  }
  const body = {
    family_profile_id: profile.profile_id,
    family_profile_digest: digest(profile),
    source_validator_stable_id: profile.source_validator_stable_id,
    source_validator_version: profile.source_validator_version,
    source_validation_input_digest:
      projected.source_validation_input_digest,
    source_release: clone(projected.source_release),
    provision_row: clone(projected.provision_row),
    ordered_terminals: clone(projected.ordered_terminals),
    validation_state: 'VALIDATED',
  };
  return freeze({
    schema_version: SOURCE_PROJECTION_SCHEMA,
    source_projection_id: contentId(SOURCE_PROJECTION_SCHEMA, body),
    source_projection_payload_digest: digest(body),
    ...body,
  });
}

function buildTerminals(profile, projection) {
  if (
    projection.ordered_terminals.length
      !== profile.ordered_metric_slots.length
  ) {
    throw new TypeError('the Agreement candidate-envelope terminal count has drifted');
  }
  return projection.ordered_terminals.map((source, ordinal) => {
    const governed = profile.ordered_metric_slots[ordinal];
    if (
      source.ordinal !== ordinal
      || source.metric_key !== governed.metric_key
      || source.value_slot_key !== governed.value_slot_key
      || source.subject_terminal_kind !== governed.subject_terminal_kind
      || !/^[a-f0-9]{64}$/.test(source.id || '')
      || source.payload_digest !== undefined
    ) {
      throw new TypeError(`the Agreement candidate terminal ${ordinal} is invalid`);
    }
    const body = {
      family_profile_id: profile.profile_id,
      ordinal,
      metric_key: source.metric_key,
      value_slot_key: source.value_slot_key,
      subject_terminal_kind: source.subject_terminal_kind,
      subject_terminal_id: source.id,
      subject_terminal_payload_digest: digest(source.value),
    };
    return freeze({
      schema_version: TERMINAL_SCHEMA,
      terminal_id: contentId(TERMINAL_SCHEMA, body),
      terminal_payload_digest: digest(body),
      ...body,
      subject_terminal: clone(source.value),
    });
  });
}

function buildAgreementCandidateEnvelope({
  family_profile_id: profileId,
  family_input: familyInput,
} = {}) {
  const profile = profileFor(profileId);
  const projection = buildSourceProjection(profile, familyInput);
  const terminals = buildTerminals(profile, projection);
  const membership = {
    ...clone(profile.product_membership),
    domain_result_identity: projection.provision_row.id,
    domain_result_payload_digest: projection.provision_row.payload_digest,
  };
  const body = {
    contract_stable_id: contract.stable_id,
    contract_definition_digest:
      AGREEMENT_CANDIDATE_ENVELOPE_DEFINITION_DIGEST,
    family_profile_id: profile.profile_id,
    family_profile_digest: digest(profile),
    source_projection_id: projection.source_projection_id,
    source_projection_payload_digest:
      projection.source_projection_payload_digest,
    source_projection: clone(projection),
    provision_row: clone(projection.provision_row.payload),
    ordered_terminals: terminals,
    product_membership: membership,
    candidate_state: 'VALIDATED_NOT_MATERIALISED',
    authority_state: AUTHORITY_STATE,
  };
  return freeze({
    schema_version: AGREEMENT_CANDIDATE_ENVELOPE_RUNTIME_SCHEMA,
    agreement_candidate_envelope_id: contentId(
      AGREEMENT_CANDIDATE_ENVELOPE_RUNTIME_SCHEMA,
      body,
    ),
    ...body,
  });
}

function validateAgreementCandidateEnvelope(value, input) {
  if (
    canonicalJson(value)
      !== canonicalJson(buildAgreementCandidateEnvelope(input))
  ) {
    throw new TypeError('the Agreement candidate envelope has changed');
  }
  return true;
}

module.exports = {
  AGREEMENT_CANDIDATE_ENVELOPE_RUNTIME_SCHEMA,
  AUTHORITY_STATE,
  buildAgreementCandidateEnvelope,
  validateAgreementCandidateEnvelope,
};
