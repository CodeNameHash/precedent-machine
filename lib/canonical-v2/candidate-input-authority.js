const { canonicalJson, contentId } = require('./canonical-bytes');
const { validateContractBundle } = require('./contract-bundle');
const {
  buildCandidateCorrectionInputSeal,
  validateCandidateCorrectionInputSeal,
  validateCorrectionDischarge,
} = require('./candidate-correction-input');

const SHA256_RE = /^[a-f0-9]{64}$/;
const DEFAULT_TIMEOUT_MS = 5000;
const MAX_TIMEOUT_MS = 30000;
const MAX_AUTHORITY_MATERIALISATIONS = 512;
const SELECTOR_RPC = 'canonical_v2_select_candidate_inputs';
const RECHECK_RPC = 'canonical_v2_recheck_candidate_input_head';

class CandidateInputAuthorityError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CandidateInputAuthorityError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new CandidateInputAuthorityError(code, message, details);
}

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_CANDIDATE_INPUT_AUTHORITY', `${label} must be an object.`, { label });
  }
  return value;
}

function requireExactKeys(value, keys, label) {
  requireObject(value, label);
  if (canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    fail('INVALID_CANDIDATE_INPUT_AUTHORITY', `${label} fields do not match the contract.`, { label });
  }
}

function requireDigest(value, label) {
  if (!SHA256_RE.test(value || '')) {
    fail('INVALID_CANDIDATE_INPUT_AUTHORITY', `${label} must be a SHA-256 content ID.`, { label });
  }
  return value;
}

function requireGeneration(value) {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail('INVALID_CANDIDATE_INPUT_AUTHORITY', 'generation must be a positive safe integer.');
  }
  return value;
}

function validateAuthorityMaterialisationCount(value, label = 'correction authority materialisations') {
  if (!Array.isArray(value) || value.length > MAX_AUTHORITY_MATERIALISATIONS) {
    fail(
      'AUTHORITY_MATERIALISATION_LIMIT_EXCEEDED',
      `${label} must contain at most ${MAX_AUTHORITY_MATERIALISATIONS} records.`,
      { count: Array.isArray(value) ? value.length : null, maximum: MAX_AUTHORITY_MATERIALISATIONS },
    );
  }
  return true;
}

function buildCorrectionAuthorityMaterialisation({
  correction_materialisation: correctionMaterialisation,
  contract_bundle: contractBundle,
} = {}) {
  requireExactKeys(
    correctionMaterialisation,
    ['correction_output', 'correction_discharge'],
    'correction materialisation',
  );
  validateCorrectionDischarge({
    discharge: correctionMaterialisation.correction_discharge,
    correction_output: correctionMaterialisation.correction_output,
    contract_bundle: contractBundle,
  });
  const applicationId = correctionMaterialisation.correction_output?.application?.correction_application_id;
  if (applicationId !== correctionMaterialisation.correction_discharge.correction_application_id) {
    fail(
      'INVALID_CORRECTION_AUTHORITY_MATERIALISATION',
      'Correction authority materialisation has mismatched application identities.',
    );
  }
  requireDigest(applicationId, 'correction_application_id');
  const body = {
    schema_version: 'CORRECTION_AUTHORITY_MATERIALISATION/V1',
    correction_application_id: applicationId,
    correction_discharge_id: correctionMaterialisation.correction_discharge.correction_discharge_id,
    correction_output: clone(correctionMaterialisation.correction_output),
    correction_discharge: clone(correctionMaterialisation.correction_discharge),
  };
  const canonicalPayloadDigest = contentId('CORRECTION_AUTHORITY_MATERIALISATION_PAYLOAD/V1', body);
  return deepFreeze({
    ...body,
    canonical_payload_digest: canonicalPayloadDigest,
    correction_authority_materialisation_id: contentId('CORRECTION_AUTHORITY_MATERIALISATION/V1', {
      ...body,
      canonical_payload_digest: canonicalPayloadDigest,
    }),
  });
}

function validateCorrectionAuthorityMaterialisation({
  correction_authority_materialisation: authorityMaterialisation,
  contract_bundle: contractBundle,
} = {}) {
  requireExactKeys(authorityMaterialisation, [
    'schema_version',
    'correction_application_id',
    'correction_discharge_id',
    'correction_output',
    'correction_discharge',
    'canonical_payload_digest',
    'correction_authority_materialisation_id',
  ], 'correction authority materialisation');
  const rebuilt = buildCorrectionAuthorityMaterialisation({
    correction_materialisation: {
      correction_output: authorityMaterialisation.correction_output,
      correction_discharge: authorityMaterialisation.correction_discharge,
    },
    contract_bundle: contractBundle,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(authorityMaterialisation)) {
    fail(
      'INVALID_CORRECTION_AUTHORITY_MATERIALISATION',
      'Correction authority materialisation identity or content is invalid.',
    );
  }
  return true;
}

function mapEntry(materialisation) {
  return {
    correction_application_id: materialisation.correction_application_id,
    correction_discharge_id: materialisation.correction_discharge_id,
    correction_authority_materialisation_id: materialisation.correction_authority_materialisation_id,
    correction_authority_materialisation_payload_digest: materialisation.canonical_payload_digest,
  };
}

function buildCorrectionDischargeMap({
  contract_bundle: contractBundle,
  correction_materialisations: correctionMaterialisations,
} = {}) {
  validateContractBundle(contractBundle);
  if (!Array.isArray(correctionMaterialisations)) {
    fail(
      'INVALID_CORRECTION_DISCHARGE_MAP',
      'correction_materialisations must be an explicit array, including when empty.',
    );
  }
  validateAuthorityMaterialisationCount(correctionMaterialisations, 'correction_materialisations');
  const materialisations = correctionMaterialisations.map((materialisation) => (
    buildCorrectionAuthorityMaterialisation({
      correction_materialisation: materialisation,
      contract_bundle: contractBundle,
    })
  )).sort((left, right) => (
    left.correction_application_id.localeCompare(right.correction_application_id)
  ));
  const activeApplicationIds = materialisations.map((item) => item.correction_application_id);
  if (new Set(activeApplicationIds).size !== activeApplicationIds.length) {
    fail('DUPLICATE_CORRECTION_DISCHARGE_MAP_ENTRY', 'Correction discharge map contains duplicate applications.');
  }

  buildCandidateCorrectionInputSeal({
    contract_bundle: contractBundle,
    expected_active_application_ids: activeApplicationIds,
    correction_materialisations: materialisations.map((item) => ({
      correction_output: item.correction_output,
      correction_discharge: item.correction_discharge,
    })),
  });
  const orderedEntries = materialisations.map(mapEntry);
  const body = {
    schema_version: 'CORRECTION_DISCHARGE_MAP/V1',
    stage: 'POST_SCOPE',
    contract_fingerprint: contractBundle.fingerprint,
    ordered_entries: orderedEntries,
    counts: {
      ordered_entries: orderedEntries.length,
    },
    roots: {
      active_correction_application_root: contentId(
        'ACTIVE_CORRECTION_APPLICATION_ROOT/V1',
        activeApplicationIds,
      ),
      correction_authority_materialisation_root: contentId(
        'CORRECTION_AUTHORITY_MATERIALISATION_ROOT/V1',
        orderedEntries,
      ),
    },
    status: 'PASS',
  };
  const canonicalPayloadDigest = contentId('CORRECTION_DISCHARGE_MAP_PAYLOAD/V1', body);
  const map = deepFreeze({
    ...body,
    canonical_payload_digest: canonicalPayloadDigest,
    correction_discharge_map_id: contentId('CORRECTION_DISCHARGE_MAP/V1', {
      ...body,
      canonical_payload_digest: canonicalPayloadDigest,
    }),
  });
  validateCorrectionDischargeMap({
    correction_discharge_map: map,
    contract_bundle: contractBundle,
  });
  return map;
}

function validateCorrectionDischargeMap({
  correction_discharge_map: correctionDischargeMap,
  contract_bundle: contractBundle,
} = {}) {
  validateContractBundle(contractBundle);
  requireExactKeys(correctionDischargeMap, [
    'schema_version',
    'stage',
    'contract_fingerprint',
    'ordered_entries',
    'counts',
    'roots',
    'status',
    'canonical_payload_digest',
    'correction_discharge_map_id',
  ], 'correction discharge map');
  if (correctionDischargeMap.contract_fingerprint !== contractBundle.fingerprint) {
    fail('INVALID_CORRECTION_DISCHARGE_MAP', 'Correction discharge map uses a different contract bundle.');
  }
  if (!Array.isArray(correctionDischargeMap.ordered_entries)) {
    fail('INVALID_CORRECTION_DISCHARGE_MAP', 'ordered_entries must be an explicit array.');
  }
  validateAuthorityMaterialisationCount(correctionDischargeMap.ordered_entries, 'ordered_entries');
  const entries = correctionDischargeMap.ordered_entries.map((entry, index) => {
    requireExactKeys(entry, [
      'correction_application_id',
      'correction_discharge_id',
      'correction_authority_materialisation_id',
      'correction_authority_materialisation_payload_digest',
    ], `ordered_entries[${index}]`);
    Object.entries(entry).forEach(([key, value]) => requireDigest(value, `ordered_entries[${index}].${key}`));
    return clone(entry);
  });
  const orderedEntries = [...entries].sort((left, right) => (
    left.correction_application_id.localeCompare(right.correction_application_id)
  ));
  const activeApplicationIds = orderedEntries.map((item) => item.correction_application_id);
  if (new Set(activeApplicationIds).size !== activeApplicationIds.length
    || new Set(orderedEntries.map((item) => item.correction_discharge_id)).size !== orderedEntries.length
    || new Set(orderedEntries.map((item) => (
      item.correction_authority_materialisation_id
    ))).size !== orderedEntries.length) {
    fail('DUPLICATE_CORRECTION_DISCHARGE_MAP_ENTRY', 'Correction discharge map contains duplicate identities.');
  }
  requireExactKeys(correctionDischargeMap.counts, ['ordered_entries'], 'correction discharge map counts');
  requireExactKeys(correctionDischargeMap.roots, [
    'active_correction_application_root',
    'correction_authority_materialisation_root',
  ], 'correction discharge map roots');
  const body = {
    schema_version: 'CORRECTION_DISCHARGE_MAP/V1',
    stage: 'POST_SCOPE',
    contract_fingerprint: contractBundle.fingerprint,
    ordered_entries: orderedEntries,
    counts: {
      ordered_entries: orderedEntries.length,
    },
    roots: {
      active_correction_application_root: contentId(
        'ACTIVE_CORRECTION_APPLICATION_ROOT/V1',
        activeApplicationIds,
      ),
      correction_authority_materialisation_root: contentId(
        'CORRECTION_AUTHORITY_MATERIALISATION_ROOT/V1',
        orderedEntries,
      ),
    },
    status: 'PASS',
  };
  const canonicalPayloadDigest = contentId('CORRECTION_DISCHARGE_MAP_PAYLOAD/V1', body);
  const rebuilt = deepFreeze({
    ...body,
    canonical_payload_digest: canonicalPayloadDigest,
    correction_discharge_map_id: contentId('CORRECTION_DISCHARGE_MAP/V1', {
      ...body,
      canonical_payload_digest: canonicalPayloadDigest,
    }),
  });
  if (canonicalJson(rebuilt) !== canonicalJson(correctionDischargeMap)) {
    fail('INVALID_CORRECTION_DISCHARGE_MAP', 'Correction discharge map identity or closure is invalid.');
  }
  return true;
}

function buildCandidateInputHead({
  environment = 'staging',
  generation,
  correction_discharge_map: correctionDischargeMap,
  previous_candidate_input_head_id: previousCandidateInputHeadId = null,
} = {}) {
  if (environment !== 'staging') {
    fail('INVALID_CANDIDATE_INPUT_HEAD', 'Candidate input authority is staging-only.');
  }
  requireGeneration(generation);
  requireObject(correctionDischargeMap, 'correction_discharge_map');
  requireDigest(correctionDischargeMap.correction_discharge_map_id, 'correction_discharge_map_id');
  requireDigest(correctionDischargeMap.canonical_payload_digest, 'correction_discharge_map_payload_digest');
  if (previousCandidateInputHeadId !== null) {
    requireDigest(previousCandidateInputHeadId, 'previous_candidate_input_head_id');
  }
  const body = {
    schema_version: 'CANDIDATE_INPUT_HEAD/V1',
    environment: 'staging',
    contract_fingerprint: correctionDischargeMap.contract_fingerprint,
    generation,
    correction_discharge_map_id: correctionDischargeMap.correction_discharge_map_id,
    correction_discharge_map_payload_digest: correctionDischargeMap.canonical_payload_digest,
    previous_candidate_input_head_id: previousCandidateInputHeadId,
    status: 'SEALED',
  };
  const canonicalPayloadDigest = contentId('CANDIDATE_INPUT_HEAD_PAYLOAD/V1', body);
  return deepFreeze({
    ...body,
    canonical_payload_digest: canonicalPayloadDigest,
    candidate_input_head_id: contentId('CANDIDATE_INPUT_HEAD/V1', {
      ...body,
      canonical_payload_digest: canonicalPayloadDigest,
    }),
  });
}

function validateCandidateInputHeadIdentity(candidateInputHead) {
  requireExactKeys(candidateInputHead, [
    'schema_version',
    'environment',
    'contract_fingerprint',
    'generation',
    'correction_discharge_map_id',
    'correction_discharge_map_payload_digest',
    'previous_candidate_input_head_id',
    'status',
    'canonical_payload_digest',
    'candidate_input_head_id',
  ], 'candidate input head');
  requireGeneration(candidateInputHead.generation);
  requireDigest(candidateInputHead.contract_fingerprint, 'contract_fingerprint');
  requireDigest(candidateInputHead.correction_discharge_map_id, 'correction_discharge_map_id');
  requireDigest(
    candidateInputHead.correction_discharge_map_payload_digest,
    'correction_discharge_map_payload_digest',
  );
  if (candidateInputHead.previous_candidate_input_head_id !== null) {
    requireDigest(candidateInputHead.previous_candidate_input_head_id, 'previous_candidate_input_head_id');
  }
  const { canonical_payload_digest: payloadDigest, candidate_input_head_id: headId, ...body } = candidateInputHead;
  const expectedPayloadDigest = contentId('CANDIDATE_INPUT_HEAD_PAYLOAD/V1', body);
  if (candidateInputHead.schema_version !== 'CANDIDATE_INPUT_HEAD/V1'
    || candidateInputHead.environment !== 'staging'
    || candidateInputHead.status !== 'SEALED'
    || payloadDigest !== expectedPayloadDigest
    || headId !== contentId('CANDIDATE_INPUT_HEAD/V1', {
      ...body,
      canonical_payload_digest: expectedPayloadDigest,
    })) {
    fail('INVALID_CANDIDATE_INPUT_HEAD', 'Candidate input head identity is invalid.');
  }
  return true;
}

function validateCandidateInputHead({
  candidate_input_head: candidateInputHead,
  correction_discharge_map: correctionDischargeMap,
} = {}) {
  validateCandidateInputHeadIdentity(candidateInputHead);
  const rebuilt = buildCandidateInputHead({
    environment: candidateInputHead.environment,
    generation: candidateInputHead.generation,
    correction_discharge_map: correctionDischargeMap,
    previous_candidate_input_head_id: candidateInputHead.previous_candidate_input_head_id,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(candidateInputHead)) {
    fail('INVALID_CANDIDATE_INPUT_HEAD', 'Candidate input head identity or map binding is invalid.');
  }
  return true;
}

function validateEventHeadAndMap(head, map) {
  if ((head === null) !== (map === null)) {
    fail('INVALID_CANDIDATE_INPUT_EVENT', 'A candidate input event head and map must both be null or both be present.');
  }
  if (head === null) return;
  validateCandidateInputHead({
    candidate_input_head: head,
    correction_discharge_map: map,
  });
}

function buildCandidateInputEvent({
  predecessor_candidate_input_head: predecessorHead = null,
  predecessor_correction_discharge_map: predecessorMap = null,
  successor_candidate_input_head: successorHead,
  successor_correction_discharge_map: successorMap,
} = {}) {
  validateEventHeadAndMap(predecessorHead, predecessorMap);
  validateEventHeadAndMap(successorHead, successorMap);
  if (!successorHead) {
    fail('INVALID_CANDIDATE_INPUT_EVENT', 'A candidate input event requires an exact successor head.');
  }
  if (successorHead.previous_candidate_input_head_id
    !== (predecessorHead?.candidate_input_head_id || null)) {
    fail('INVALID_CANDIDATE_INPUT_EVENT', 'Successor head does not link to the exact predecessor head.');
  }
  if (predecessorHead !== null
    && successorHead.generation !== predecessorHead.generation + 1) {
    fail('INVALID_CANDIDATE_INPUT_EVENT', 'Successor generation must advance the predecessor by one.');
  }
  if (predecessorHead !== null
    && successorHead.contract_fingerprint !== predecessorHead.contract_fingerprint) {
    fail('INVALID_CANDIDATE_INPUT_EVENT', 'A candidate input event cannot cross contract fingerprints.');
  }
  const body = {
    schema_version: 'CANDIDATE_INPUT_EVENT/V1',
    environment: 'staging',
    contract_fingerprint: successorHead.contract_fingerprint,
    generation: successorHead.generation,
    transition: predecessorHead === null ? 'INITIALISE' : 'ADVANCE',
    predecessor_candidate_input_head_id: predecessorHead?.candidate_input_head_id || null,
    predecessor_candidate_input_head_payload_digest: predecessorHead?.canonical_payload_digest || null,
    successor_candidate_input_head_id: successorHead.candidate_input_head_id,
    successor_candidate_input_head_payload_digest: successorHead.canonical_payload_digest,
    correction_discharge_map_id: successorMap.correction_discharge_map_id,
    correction_discharge_map_payload_digest: successorMap.canonical_payload_digest,
    status: 'PASS',
  };
  const canonicalPayloadDigest = contentId('CANDIDATE_INPUT_EVENT_PAYLOAD/V1', body);
  return deepFreeze({
    ...body,
    canonical_payload_digest: canonicalPayloadDigest,
    candidate_input_event_id: contentId('CANDIDATE_INPUT_EVENT/V1', {
      ...body,
      canonical_payload_digest: canonicalPayloadDigest,
    }),
  });
}

function validateCandidateInputEvent({
  candidate_input_event: candidateInputEvent,
  predecessor_candidate_input_head: predecessorHead = null,
  predecessor_correction_discharge_map: predecessorMap = null,
  successor_candidate_input_head: successorHead,
  successor_correction_discharge_map: successorMap,
} = {}) {
  requireExactKeys(candidateInputEvent, [
    'schema_version',
    'environment',
    'contract_fingerprint',
    'generation',
    'transition',
    'predecessor_candidate_input_head_id',
    'predecessor_candidate_input_head_payload_digest',
    'successor_candidate_input_head_id',
    'successor_candidate_input_head_payload_digest',
    'correction_discharge_map_id',
    'correction_discharge_map_payload_digest',
    'status',
    'canonical_payload_digest',
    'candidate_input_event_id',
  ], 'candidate input event');
  const rebuilt = buildCandidateInputEvent({
    predecessor_candidate_input_head: predecessorHead,
    predecessor_correction_discharge_map: predecessorMap,
    successor_candidate_input_head: successorHead,
    successor_correction_discharge_map: successorMap,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(candidateInputEvent)) {
    fail('INVALID_CANDIDATE_INPUT_EVENT', 'Candidate input event identity or transition is invalid.');
  }
  return true;
}

function bounded(promise, timeoutMs, timeoutCode, timeoutMessage) {
  let timer;
  return Promise.race([
    promise,
    new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new CandidateInputAuthorityError(timeoutCode, timeoutMessage)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

function validateCandidateInputAuthoritySelection({
  authority_selection: authoritySelection,
  contract_bundle: contractBundle,
} = {}) {
  requireExactKeys(authoritySelection, [
    'candidate_input_head',
    'correction_discharge_map',
    'correction_materialisations',
    'correction_authority_materialisations',
    'active_correction_application_ids',
  ], 'candidate input authority selection');
  validateCorrectionDischargeMap({
    correction_discharge_map: authoritySelection.correction_discharge_map,
    contract_bundle: contractBundle,
  });
  validateCandidateInputHead({
    candidate_input_head: authoritySelection.candidate_input_head,
    correction_discharge_map: authoritySelection.correction_discharge_map,
  });
  for (const key of [
    'correction_materialisations',
    'correction_authority_materialisations',
    'active_correction_application_ids',
  ]) {
    if (!Array.isArray(authoritySelection[key])) {
      fail('INVALID_CANDIDATE_INPUT_AUTHORITY_SELECTION', `${key} must be an explicit array.`);
    }
  }
  validateAuthorityMaterialisationCount(
    authoritySelection.correction_materialisations,
    'correction_materialisations',
  );
  validateAuthorityMaterialisationCount(
    authoritySelection.correction_authority_materialisations,
    'correction_authority_materialisations',
  );
  validateAuthorityMaterialisationCount(
    authoritySelection.active_correction_application_ids,
    'active_correction_application_ids',
  );
  const authorityMaterialisations = authoritySelection.correction_authority_materialisations.map(
    (materialisation) => {
      validateCorrectionAuthorityMaterialisation({
        correction_authority_materialisation: materialisation,
        contract_bundle: contractBundle,
      });
      return clone(materialisation);
    },
  );
  const sortedAuthorityMaterialisations = [...authorityMaterialisations].sort((left, right) => (
    left.correction_application_id.localeCompare(right.correction_application_id)
  ));
  const expectedMaterialisations = sortedAuthorityMaterialisations.map((item) => ({
    correction_output: clone(item.correction_output),
    correction_discharge: clone(item.correction_discharge),
  }));
  const expectedApplicationIds = authoritySelection.correction_discharge_map.ordered_entries.map(
    (entry) => entry.correction_application_id,
  );
  if (canonicalJson(authorityMaterialisations) !== canonicalJson(sortedAuthorityMaterialisations)
    || canonicalJson(sortedAuthorityMaterialisations.map(mapEntry))
      !== canonicalJson(authoritySelection.correction_discharge_map.ordered_entries)
    || canonicalJson(authoritySelection.correction_materialisations)
      !== canonicalJson(expectedMaterialisations)
    || canonicalJson(authoritySelection.active_correction_application_ids)
      !== canonicalJson(expectedApplicationIds)) {
    fail(
      'INCOMPLETE_CANDIDATE_INPUT_AUTHORITY_SELECTION',
      'Authority selection does not exactly contain the materialisations governed by its captured map.',
    );
  }
  return true;
}

function buildCandidateCorrectionInputSealV2({
  authority_selection: authoritySelection,
  contract_bundle: contractBundle,
  release_correction_materialisations: releaseCorrectionMaterialisations,
} = {}) {
  validateCandidateInputAuthoritySelection({ authority_selection: authoritySelection, contract_bundle: contractBundle });
  if (!Array.isArray(releaseCorrectionMaterialisations)) {
    fail(
      'INVALID_CORRECTION_INPUT_SEAL_V2',
      'release_correction_materialisations must be an explicit array, including when empty.',
    );
  }
  if (canonicalJson(releaseCorrectionMaterialisations)
    !== canonicalJson(authoritySelection.correction_materialisations)) {
    fail(
      'CORRECTION_AUTHORITY_MATERIALISATION_MISMATCH',
      'Release correction materialisations must equal the exact authority-selected materialisations.',
    );
  }
  const expectedApplicationIds = [...authoritySelection.active_correction_application_ids];
  const releaseSeal = buildCandidateCorrectionInputSeal({
    contract_bundle: contractBundle,
    expected_active_application_ids: expectedApplicationIds,
    correction_materialisations: releaseCorrectionMaterialisations,
  });
  const authorityMap = authoritySelection.correction_discharge_map;
  const authorityHead = authoritySelection.candidate_input_head;
  const body = {
    schema_version: 'CANDIDATE_CORRECTION_INPUT_SEAL/V2',
    contract_fingerprint: contractBundle.fingerprint,
    candidate_input_head_id: authorityHead.candidate_input_head_id,
    candidate_input_head_payload_digest: authorityHead.canonical_payload_digest,
    correction_discharge_map_id: authorityMap.correction_discharge_map_id,
    correction_discharge_map_payload_digest: authorityMap.canonical_payload_digest,
    expected_active_application_ids: expectedApplicationIds,
    correction_entries: clone(releaseSeal.correction_entries),
    counts: clone(releaseSeal.counts),
    roots: {
      authority_active_correction_application_root:
        authorityMap.roots.active_correction_application_root,
      correction_authority_materialisation_root:
        authorityMap.roots.correction_authority_materialisation_root,
      authority_correction_discharge_root: contentId(
        'AUTHORITY_CORRECTION_DISCHARGE_ROOT/V1',
        authorityMap.ordered_entries.map((entry) => ({
          correction_application_id: entry.correction_application_id,
          correction_discharge_id: entry.correction_discharge_id,
        })),
      ),
      expected_active_application_root: releaseSeal.roots.expected_active_application_root,
      correction_entry_root: releaseSeal.roots.correction_entry_root,
      correction_discharge_root: releaseSeal.roots.correction_discharge_root,
    },
    status: 'PASS',
  };
  const canonicalPayloadDigest = contentId('CANDIDATE_CORRECTION_INPUT_SEAL_PAYLOAD/V2', body);
  const seal = deepFreeze({
    ...body,
    canonical_payload_digest: canonicalPayloadDigest,
    candidate_correction_input_seal_id: contentId('CANDIDATE_CORRECTION_INPUT_SEAL/V2', {
      ...body,
      canonical_payload_digest: canonicalPayloadDigest,
    }),
  });
  validateCandidateCorrectionInputSealV2(seal);
  return seal;
}

function validateCandidateCorrectionInputSealV2(seal) {
  requireExactKeys(seal, [
    'schema_version',
    'contract_fingerprint',
    'candidate_input_head_id',
    'candidate_input_head_payload_digest',
    'correction_discharge_map_id',
    'correction_discharge_map_payload_digest',
    'expected_active_application_ids',
    'correction_entries',
    'counts',
    'roots',
    'status',
    'canonical_payload_digest',
    'candidate_correction_input_seal_id',
  ], 'candidate correction input seal V2');
  for (const key of [
    'contract_fingerprint',
    'candidate_input_head_id',
    'candidate_input_head_payload_digest',
    'correction_discharge_map_id',
    'correction_discharge_map_payload_digest',
  ]) requireDigest(seal[key], key);
  requireExactKeys(seal.roots, [
    'authority_active_correction_application_root',
    'correction_authority_materialisation_root',
    'authority_correction_discharge_root',
    'expected_active_application_root',
    'correction_entry_root',
    'correction_discharge_root',
  ], 'candidate correction input seal V2 roots');
  Object.entries(seal.roots).forEach(([key, value]) => requireDigest(value, `roots.${key}`));

  const v1Body = {
    schema_version: 'CANDIDATE_CORRECTION_INPUT_SEAL/V1',
    contract_fingerprint: seal.contract_fingerprint,
    expected_active_application_ids: clone(seal.expected_active_application_ids),
    correction_entries: clone(seal.correction_entries),
    counts: clone(seal.counts),
    roots: {
      expected_active_application_root: seal.roots.expected_active_application_root,
      correction_entry_root: seal.roots.correction_entry_root,
      correction_discharge_root: seal.roots.correction_discharge_root,
    },
    status: seal.status,
  };
  const v1PayloadDigest = contentId('CANDIDATE_CORRECTION_INPUT_SEAL_PAYLOAD/V1', v1Body);
  const v1Seal = {
    ...v1Body,
    canonical_payload_digest: v1PayloadDigest,
    candidate_correction_input_seal_id: contentId('CANDIDATE_CORRECTION_INPUT_SEAL/V1', {
      ...v1Body,
      canonical_payload_digest: v1PayloadDigest,
    }),
  };
  try {
    validateCandidateCorrectionInputSeal(v1Seal);
  } catch (error) {
    fail('INVALID_CORRECTION_INPUT_SEAL_V2', 'Release correction closure inside Seal V2 is invalid.', {
      cause_code: error.code || error.name,
      cause_message: error.message,
    });
  }
  if (seal.roots.authority_active_correction_application_root !== contentId(
    'ACTIVE_CORRECTION_APPLICATION_ROOT/V1',
    seal.expected_active_application_ids,
  )) {
    fail(
      'INVALID_CORRECTION_INPUT_SEAL_V2',
      'Seal V2 authority application root does not bind its derived application set.',
    );
  }
  const { canonical_payload_digest: payloadDigest, candidate_correction_input_seal_id: sealId, ...body } = seal;
  const expectedPayloadDigest = contentId('CANDIDATE_CORRECTION_INPUT_SEAL_PAYLOAD/V2', body);
  if (seal.schema_version !== 'CANDIDATE_CORRECTION_INPUT_SEAL/V2'
    || payloadDigest !== expectedPayloadDigest
    || sealId !== contentId('CANDIDATE_CORRECTION_INPUT_SEAL/V2', {
      ...body,
      canonical_payload_digest: expectedPayloadDigest,
    })) {
    fail('INVALID_CORRECTION_INPUT_SEAL_V2', 'Candidate correction input Seal V2 identity is invalid.');
  }
  return true;
}

async function selectTrustedCandidateInputs({
  client,
  contract_bundle: contractBundle,
  timeout_ms: timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  validateContractBundle(contractBundle);
  if (!client || typeof client.rpc !== 'function') {
    fail('INVALID_CANDIDATE_INPUT_SELECTOR', 'client.rpc is required.');
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMEOUT_MS) {
    fail('INVALID_CANDIDATE_INPUT_SELECTOR', `timeout_ms must be between 1 and ${MAX_TIMEOUT_MS}.`);
  }

  let response;
  try {
    response = await bounded(Promise.resolve(client.rpc(SELECTOR_RPC, {
      p_environment: 'staging',
      p_contract_fingerprint: contractBundle.fingerprint,
    })), timeoutMs, 'CANDIDATE_INPUT_SELECTOR_TIMEOUT', 'Candidate input selection exceeded its deadline.');
  } catch (error) {
    if (error instanceof CandidateInputAuthorityError) throw error;
    fail('CANDIDATE_INPUT_SELECTOR_FAILED', 'Candidate input selector RPC failed.', {
      cause_code: error.code || error.name,
      cause_message: error.message,
    });
  }
  if (!response || response.error) {
    fail('CANDIDATE_INPUT_SELECTOR_FAILED', 'Candidate input selector RPC returned an error.', {
      rpc_error: response?.error || null,
    });
  }
  const payload = Array.isArray(response.data) && response.data.length === 1
    ? response.data[0]
    : response.data;
  requireExactKeys(payload, [
    'captured_candidate_input_head',
    'correction_discharge_map',
    'ordered_materialisations',
  ], 'candidate input selector payload');
  validateCorrectionDischargeMap({
    correction_discharge_map: payload.correction_discharge_map,
    contract_bundle: contractBundle,
  });
  validateCandidateInputHead({
    candidate_input_head: payload.captured_candidate_input_head,
    correction_discharge_map: payload.correction_discharge_map,
  });
  if (!Array.isArray(payload.ordered_materialisations)) {
    fail('INVALID_CANDIDATE_INPUT_SELECTOR', 'ordered_materialisations must be an array.');
  }
  const materialisations = payload.ordered_materialisations.map((materialisation) => {
    validateCorrectionAuthorityMaterialisation({
      correction_authority_materialisation: materialisation,
      contract_bundle: contractBundle,
    });
    return clone(materialisation);
  });
  const sortedMaterialisations = [...materialisations].sort((left, right) => (
    left.correction_application_id.localeCompare(right.correction_application_id)
  ));
  if (canonicalJson(sortedMaterialisations) !== canonicalJson(materialisations)
    || canonicalJson(sortedMaterialisations.map(mapEntry))
      !== canonicalJson(payload.correction_discharge_map.ordered_entries)) {
    fail(
      'INCOMPLETE_CANDIDATE_INPUT_SELECTOR',
      'Selected materialisations do not exactly discharge the captured correction map.',
    );
  }
  const selection = deepFreeze({
    candidate_input_head: clone(payload.captured_candidate_input_head),
    correction_discharge_map: clone(payload.correction_discharge_map),
    correction_materialisations: sortedMaterialisations.map((item) => ({
      correction_output: clone(item.correction_output),
      correction_discharge: clone(item.correction_discharge),
    })),
    correction_authority_materialisations: sortedMaterialisations,
    active_correction_application_ids: payload.correction_discharge_map.ordered_entries.map(
      (entry) => entry.correction_application_id,
    ),
  });
  validateCandidateInputAuthoritySelection({
    authority_selection: selection,
    contract_bundle: contractBundle,
  });
  return selection;
}

async function recheckCandidateInputHead({
  client,
  candidate_input_head: candidateInputHead,
  timeout_ms: timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  validateCandidateInputHeadIdentity(candidateInputHead);
  if (!client || typeof client.rpc !== 'function') {
    fail('INVALID_CANDIDATE_INPUT_RECHECK', 'client.rpc is required.');
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMEOUT_MS) {
    fail('INVALID_CANDIDATE_INPUT_RECHECK', `timeout_ms must be between 1 and ${MAX_TIMEOUT_MS}.`);
  }
  let response;
  try {
    response = await bounded(Promise.resolve(client.rpc(RECHECK_RPC, {
      p_environment: 'staging',
      p_contract_fingerprint: candidateInputHead.contract_fingerprint,
      p_expected_candidate_input_head_id: candidateInputHead.candidate_input_head_id,
      p_expected_candidate_input_head_payload_digest: candidateInputHead.canonical_payload_digest,
    })), timeoutMs, 'CANDIDATE_INPUT_RECHECK_TIMEOUT', 'Candidate input head recheck exceeded its deadline.');
  } catch (error) {
    if (error instanceof CandidateInputAuthorityError) throw error;
    fail('CANDIDATE_INPUT_RECHECK_FAILED', 'Candidate input head recheck RPC failed.', {
      cause_code: error.code || error.name,
      cause_message: error.message,
    });
  }
  if (!response || response.error) {
    fail('CANDIDATE_INPUT_RECHECK_FAILED', 'Candidate input head recheck RPC returned an error.', {
      rpc_error: response?.error || null,
    });
  }
  const payload = Array.isArray(response.data) && response.data.length === 1
    ? response.data[0]
    : response.data;
  requireExactKeys(payload, ['current_candidate_input_head'], 'candidate input recheck payload');
  validateCandidateInputHeadIdentity(payload.current_candidate_input_head);
  if (canonicalJson(payload.current_candidate_input_head) !== canonicalJson(candidateInputHead)) {
    fail('CANDIDATE_INPUT_HEAD_CHANGED', 'Candidate input head changed after selection.');
  }
  return true;
}

module.exports = {
  CandidateInputAuthorityError,
  MAX_AUTHORITY_MATERIALISATIONS,
  RECHECK_RPC,
  SELECTOR_RPC,
  buildCandidateCorrectionInputSealV2,
  buildCorrectionAuthorityMaterialisation,
  buildCandidateInputEvent,
  buildCandidateInputHead,
  buildCorrectionDischargeMap,
  recheckCandidateInputHead,
  selectTrustedCandidateInputs,
  validateCorrectionAuthorityMaterialisation,
  validateCandidateCorrectionInputSealV2,
  validateCandidateInputAuthoritySelection,
  validateCandidateInputEvent,
  validateCandidateInputHead,
  validateCorrectionDischargeMap,
  validateAuthorityMaterialisationCount,
};
