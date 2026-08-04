'use strict';

const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');
const { validateSourceDeclaration } = require('./native-producer/unified-runner-validate');

const INVENTORY_SCHEMA = 'CANONICAL_SOURCE_UNIVERSE_INVENTORY/V1';
const BLOCKER_REPORT_SCHEMA = 'CANONICAL_SOURCE_UNIVERSE_BLOCKER_REPORT/V1';
const TERMINAL_DISPOSITIONS = new Set([
  'INCLUDE_AS_ROLE',
  'INCLUDE_WITH_OPEN_WORLD_ROLE_CANDIDATE',
  'EXACT_DUPLICATE_OF',
  'NON_DOCUMENT_TRANSPORT',
  'OUT_OF_PROGRAMME_SCOPE',
  'BLOCKING_UNRESOLVED',
]);
const INCLUDE_DISPOSITIONS = new Set([
  'INCLUDE_AS_ROLE',
  'INCLUDE_WITH_OPEN_WORLD_ROLE_CANDIDATE',
]);
const DIGEST_RE = /^[a-f0-9]{64}$/;

class SourceUniverseInventoryPlannerError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'SourceUniverseInventoryPlannerError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details) {
  throw new SourceUniverseInventoryPlannerError(code, message, details);
}

function exactKeys(value, keys) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function text(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.trim() !== value) {
    fail('INVALID_SOURCE_UNIVERSE_INPUT', `${label} must be a non-empty trimmed string.`);
  }
  return value;
}

function digest(value, label) {
  if (typeof value !== 'string' || !DIGEST_RE.test(value)) {
    fail('INVALID_SOURCE_UNIVERSE_INPUT', `${label} must be a lower-case SHA-256 digest.`);
  }
  return value;
}

function byteLength(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    fail('INVALID_SOURCE_UNIVERSE_INPUT', `${label} must be a non-negative safe integer.`);
  }
  return value;
}

function nonEmptyByteLength(value, label) {
  byteLength(value, label);
  if (value === 0) {
    fail('EMPTY_RAW_BYTES', `${label} must describe non-empty raw bytes.`);
  }
  return value;
}

function evidence(value, label) {
  if (!exactKeys(value, ['evidence_id', 'exact_text', 'exact_text_sha256'])) {
    fail('INVALID_SOURCE_UNIVERSE_INPUT', `${label} must contain exact evidence.`);
  }
  text(value.evidence_id, `${label}.evidence_id`);
  text(value.exact_text, `${label}.exact_text`);
  digest(value.exact_text_sha256, `${label}.exact_text_sha256`);
  if (sha256Hex(value.exact_text) !== value.exact_text_sha256) {
    fail('EVIDENCE_HASH_MISMATCH', `${label} exact evidence bytes do not match its declared hash.`);
  }
}

function reviewApproval(value, label) {
  evidence(value.evidence, `${label}.evidence`);
  text(value.review_id, `${label}.review_id`);
  text(value.approval_id, `${label}.approval_id`);
}

function validateRoster(roster) {
  if (!Array.isArray(roster) || roster.length === 0) {
    fail('INVALID_SOURCE_UNIVERSE_INPUT', 'governed_deal_roster must be a non-empty explicit array.');
  }
  const byKey = new Map();
  for (const row of roster) {
    if (!exactKeys(row, ['governed_deal_key'])) {
      fail('INVALID_SOURCE_UNIVERSE_INPUT', 'each governed roster row must contain only governed_deal_key.');
    }
    text(row.governed_deal_key, 'governed_deal_roster.governed_deal_key');
    if (byKey.has(row.governed_deal_key)) {
      fail('DUPLICATE_GOVERNED_DEAL', `duplicate governed deal ${row.governed_deal_key}.`);
    }
    byKey.set(row.governed_deal_key, Object.freeze({ ...row }));
  }
  return byKey;
}

function validateSourceDeclarationForInclusion(sourceDeclaration, occurrenceId) {
  try {
    validateSourceDeclaration(sourceDeclaration);
  } catch (error) {
    fail('INVALID_INCLUDED_SOURCE_DECLARATION', `included occurrence ${occurrenceId} has an invalid source declaration.`, {
      cause: error && error.code,
    });
  }
  if (!['ADMITTED_LOCAL', 'ADMITTED_RECORDED'].includes(sourceDeclaration.disposition)) {
    fail('INVALID_INCLUDED_SOURCE_DECLARATION', `included occurrence ${occurrenceId} must be an admitted source declaration.`);
  }
}

function validateOccurrence(row, rosterByKey) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    fail('INVALID_SOURCE_OCCURRENCE', 'each received source occurrence must be an object.');
  }
  text(row.occurrence_id, 'received_source_occurrence.occurrence_id');
  text(row.governed_deal_key, 'received_source_occurrence.governed_deal_key');
  text(row.source_locator, 'received_source_occurrence.source_locator');
  if (!rosterByKey.has(row.governed_deal_key)) {
    fail('OCCURRENCE_OUTSIDE_GOVERNED_ROSTER', `occurrence ${row.occurrence_id} names a deal outside the governed roster.`);
  }
  if (!TERMINAL_DISPOSITIONS.has(row.terminal_disposition)) {
    fail('INVALID_TERMINAL_DISPOSITION', `occurrence ${row.occurrence_id} has no supported terminal disposition.`);
  }
  const disposition = row.terminal_disposition;
  if (INCLUDE_DISPOSITIONS.has(disposition)) {
    const expected = disposition === 'INCLUDE_AS_ROLE'
      ? ['occurrence_id', 'governed_deal_key', 'source_locator', 'raw_sha256', 'raw_byte_length', 'terminal_disposition', 'source_role', 'source_declaration']
      : ['occurrence_id', 'governed_deal_key', 'source_locator', 'raw_sha256', 'raw_byte_length', 'terminal_disposition', 'source_role_candidate', 'governed_approval_id', 'source_declaration'];
    if (!exactKeys(row, expected)) {
      fail('INVALID_SOURCE_OCCURRENCE', `included occurrence ${row.occurrence_id} has an invalid closed shape.`);
    }
    digest(row.raw_sha256, `occurrence ${row.occurrence_id}.raw_sha256`);
    nonEmptyByteLength(row.raw_byte_length, `occurrence ${row.occurrence_id}.raw_byte_length`);
    text(disposition === 'INCLUDE_AS_ROLE' ? row.source_role : row.source_role_candidate,
      `occurrence ${row.occurrence_id}.source_role`);
    if (disposition === 'INCLUDE_WITH_OPEN_WORLD_ROLE_CANDIDATE') {
      text(row.governed_approval_id, `occurrence ${row.occurrence_id}.governed_approval_id`);
    }
    validateSourceDeclarationForInclusion(row.source_declaration, row.occurrence_id);
    if (row.source_declaration.disposition === 'ADMITTED_LOCAL') {
      if (row.source_declaration.raw_sha256 !== row.raw_sha256) {
        fail('INCONSISTENT_HASH', `included occurrence ${row.occurrence_id} raw hash disagrees with its admitted source declaration.`);
      }
      if (row.source_declaration.governed_deal_key !== row.governed_deal_key) {
        fail('INCONSISTENT_GOVERNED_DEAL', `included occurrence ${row.occurrence_id} governed deal disagrees with its admitted local source declaration.`);
      }
    }
    if (row.source_declaration.disposition === 'ADMITTED_RECORDED'
      && row.source_declaration.document_hash !== row.raw_sha256) {
      fail('INCONSISTENT_HASH', `included occurrence ${row.occurrence_id} raw hash disagrees with its admitted recorded source declaration.`);
    }
    return;
  }
  if (disposition === 'EXACT_DUPLICATE_OF') {
    if (!exactKeys(row, ['occurrence_id', 'governed_deal_key', 'source_locator', 'raw_sha256', 'raw_byte_length', 'terminal_disposition', 'retained_occurrence_id', 'review_id', 'approval_id', 'evidence'])) {
      fail('INVALID_SOURCE_OCCURRENCE', `duplicate occurrence ${row.occurrence_id} has an invalid closed shape.`);
    }
    digest(row.raw_sha256, `occurrence ${row.occurrence_id}.raw_sha256`);
    nonEmptyByteLength(row.raw_byte_length, `occurrence ${row.occurrence_id}.raw_byte_length`);
    text(row.retained_occurrence_id, `occurrence ${row.occurrence_id}.retained_occurrence_id`);
    reviewApproval(row, `occurrence ${row.occurrence_id}`);
    return;
  }
  if (disposition === 'BLOCKING_UNRESOLVED') {
    if (!exactKeys(row, ['occurrence_id', 'governed_deal_key', 'source_locator', 'terminal_disposition', 'blocker_id', 'evidence', 'review_id', 'approval_id'])) {
      fail('INVALID_SOURCE_OCCURRENCE', `blocking occurrence ${row.occurrence_id} has an invalid closed shape.`);
    }
    text(row.blocker_id, `occurrence ${row.occurrence_id}.blocker_id`);
    reviewApproval(row, `occurrence ${row.occurrence_id}`);
    return;
  }
  if (!exactKeys(row, ['occurrence_id', 'governed_deal_key', 'source_locator', 'raw_sha256', 'raw_byte_length', 'terminal_disposition', 'evidence', 'review_id', 'approval_id'])) {
    fail('INVALID_SOURCE_OCCURRENCE', `non-include occurrence ${row.occurrence_id} has an invalid closed shape.`);
  }
  digest(row.raw_sha256, `occurrence ${row.occurrence_id}.raw_sha256`);
  nonEmptyByteLength(row.raw_byte_length, `occurrence ${row.occurrence_id}.raw_byte_length`);
  reviewApproval(row, `occurrence ${row.occurrence_id}`);
}

function occurrenceSort(left, right) {
  return left.occurrence_id.localeCompare(right.occurrence_id);
}

function blocker(code, message, occurrenceId = null, dealKey = null) {
  return Object.freeze({ code, message, occurrence_id: occurrenceId, governed_deal_key: dealKey });
}

function duplicateBlockers(occurrencesById) {
  const blockers = [];
  const state = new Map();
  function visit(occurrence) {
    if (occurrence.terminal_disposition !== 'EXACT_DUPLICATE_OF') return;
    const status = state.get(occurrence.occurrence_id);
    if (status === 'VISITING') {
      blockers.push(blocker('DUPLICATE_CYCLE', 'exact duplicate declarations form a cycle.', occurrence.occurrence_id, occurrence.governed_deal_key));
      return;
    }
    if (status === 'DONE') return;
    state.set(occurrence.occurrence_id, 'VISITING');
    const retained = occurrencesById.get(occurrence.retained_occurrence_id);
    if (!retained) {
      blockers.push(blocker('UNRESOLVED_REPLACEMENT', 'exact duplicate names a missing retained occurrence.', occurrence.occurrence_id, occurrence.governed_deal_key));
    } else {
      visit(retained);
      if (retained.governed_deal_key !== occurrence.governed_deal_key) {
        blockers.push(blocker('CROSS_DEAL_EXACT_DUPLICATE', 'exact duplicate must resolve within the same governed deal.', occurrence.occurrence_id, occurrence.governed_deal_key));
      }
      if (!INCLUDE_DISPOSITIONS.has(retained.terminal_disposition)) {
        blockers.push(blocker('UNRESOLVED_REPLACEMENT', 'exact duplicate must resolve to an included retained occurrence.', occurrence.occurrence_id, occurrence.governed_deal_key));
      } else if (retained.raw_sha256 !== occurrence.raw_sha256 || retained.raw_byte_length !== occurrence.raw_byte_length) {
        blockers.push(blocker('INCONSISTENT_HASH', 'exact duplicate does not have byte-identical raw content to its retained occurrence.', occurrence.occurrence_id, occurrence.governed_deal_key));
      }
    }
    state.set(occurrence.occurrence_id, 'DONE');
  }
  for (const occurrence of occurrencesById.values()) visit(occurrence);
  return blockers;
}

function localOrdinalBlockers(occurrences) {
  const seen = new Map();
  const blockers = [];
  for (const occurrence of occurrences) {
    if (!INCLUDE_DISPOSITIONS.has(occurrence.terminal_disposition)
      || occurrence.source_declaration.disposition !== 'ADMITTED_LOCAL') continue;
    const key = `${occurrence.governed_deal_key}\u0000${occurrence.source_declaration.source_ordinal}`;
    const prior = seen.get(key);
    if (prior) {
      blockers.push(blocker(
        'DUPLICATE_LOCAL_SOURCE_ORDINAL',
        'admitted local source ordinal must be unique within its governed deal.',
        occurrence.occurrence_id,
        occurrence.governed_deal_key,
      ));
    } else seen.set(key, occurrence.occurrence_id);
  }
  return blockers;
}

function buildSourceUniverseInventory({
  governed_deal_roster: roster,
  received_source_occurrences: receivedOccurrences,
} = {}) {
  const rosterByKey = validateRoster(roster);
  if (!Array.isArray(receivedOccurrences)) {
    fail('INVALID_SOURCE_UNIVERSE_INPUT', 'received_source_occurrences must be an explicit array.');
  }
  const occurrencesById = new Map();
  for (const occurrence of receivedOccurrences) {
    validateOccurrence(occurrence, rosterByKey);
    if (occurrencesById.has(occurrence.occurrence_id)) {
      fail('DUPLICATE_SOURCE_OCCURRENCE', `duplicate source occurrence ${occurrence.occurrence_id}.`);
    }
    occurrencesById.set(occurrence.occurrence_id, Object.freeze({ ...occurrence }));
  }
  const occurrences = Object.freeze([...occurrencesById.values()].sort(occurrenceSort));
  const blockers = [...duplicateBlockers(occurrencesById), ...localOrdinalBlockers(occurrences)];
  const includedByDeal = new Set(occurrences
    .filter((occurrence) => INCLUDE_DISPOSITIONS.has(occurrence.terminal_disposition))
    .map((occurrence) => occurrence.governed_deal_key));
  const unresolvedByDeal = new Set(occurrences
    .filter((occurrence) => occurrence.terminal_disposition === 'BLOCKING_UNRESOLVED')
    .map((occurrence) => occurrence.governed_deal_key));
  for (const dealKey of [...rosterByKey.keys()].sort()) {
    const occurrencesForDeal = occurrences.filter((occurrence) => occurrence.governed_deal_key === dealKey);
    if (occurrencesForDeal.length === 0) {
      blockers.push(blocker('MISSING_DEAL_OCCURRENCES', 'governed deal has no explicit received-source occurrence.', null, dealKey));
    }
    if (!includedByDeal.has(dealKey) && !unresolvedByDeal.has(dealKey)) {
      blockers.push(blocker('ZERO_SOURCE_WITHOUT_UNRESOLVED', 'governed deal has no included source and no explicit unresolved occurrence.', null, dealKey));
    }
  }
  for (const occurrence of occurrences) {
    if (occurrence.terminal_disposition === 'BLOCKING_UNRESOLVED') {
      blockers.push(blocker('BLOCKING_UNRESOLVED', occurrence.blocker_id, occurrence.occurrence_id, occurrence.governed_deal_key));
    }
  }
  const declaredSourceDeclarations = occurrences
    .filter((occurrence) => INCLUDE_DISPOSITIONS.has(occurrence.terminal_disposition))
    .map((occurrence) => occurrence.source_declaration)
    .sort((left, right) => left.source_id.localeCompare(right.source_id));
  const sourceIds = new Set();
  for (const sourceDeclaration of declaredSourceDeclarations) {
    if (sourceIds.has(sourceDeclaration.source_id)) {
      blockers.push(blocker('DUPLICATE_INCLUDED_SOURCE_ID', 'two included occurrences expose the same execution source ID.'));
    }
    sourceIds.add(sourceDeclaration.source_id);
  }
  const sortedBlockers = Object.freeze([...blockers].sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right))));
  const sourceDeclarationDiagnostics = Object.freeze(declaredSourceDeclarations.map((source) => Object.freeze({
    source_id: source.source_id,
    declared_disposition: source.disposition,
    diagnostic_authority: 'NONE',
  })));
  const inventoryBody = {
    schema_version: INVENTORY_SCHEMA,
    status: 'PROPOSAL_ONLY_NOT_ADMISSION_AUTHORITY',
    authority: 'NONE',
    governed_deal_roster: Object.freeze([...rosterByKey.values()].sort((left, right) => left.governed_deal_key.localeCompare(right.governed_deal_key))),
    received_source_occurrences: occurrences,
    source_declaration_diagnostics: sourceDeclarationDiagnostics,
  };
  const inventory = Object.freeze({
    ...inventoryBody,
    inventory_id: contentId(INVENTORY_SCHEMA, inventoryBody),
  });
  const reportBody = {
    schema_version: BLOCKER_REPORT_SCHEMA,
    inventory_id: inventory.inventory_id,
    blocker_count: sortedBlockers.length,
    status: 'BLOCKED_PROPOSAL_ONLY_NOT_EXECUTION_AUTHORITY',
    blockers: sortedBlockers,
  };
  return Object.freeze({
    inventory,
    blocker_report: Object.freeze({
      ...reportBody,
      blocker_report_id: contentId(BLOCKER_REPORT_SCHEMA, reportBody),
    }),
  });
}

module.exports = {
  INVENTORY_SCHEMA,
  BLOCKER_REPORT_SCHEMA,
  TERMINAL_DISPOSITIONS,
  SourceUniverseInventoryPlannerError,
  buildSourceUniverseInventory,
};
