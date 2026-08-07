/**
 * lib/canonical-v2/open-world-evidence-serving.js
 *
 * The serving-boundary half of DECISIONS.md decision 2 ("Whether open-world
 * evidence is written at all" -- RULED 2026-08-07: "emit them, with a
 * flag"). `native-producer/native-write-set-adapter.js` closes the WRITE
 * boundary: it mints `open_world_candidates`/`open_world_candidate_
 * occurrences`/`open_world_evidence_references`/`open_world_candidate_
 * dispositions` rows, each carrying `evidence_governance:
 * OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER` on the row itself. This module is
 * where that marker gets HONOURED on the way back out, per decision 2's
 * second constraint, quoted here because it is the reason this file exists
 * rather than a family's product-projection module growing an ad-hoc check:
 *
 *   "The projection and serving layers must honour it. Emitting the rows and
 *   then rendering them indistinguishably is worse than not emitting them,
 *   because it launders ungoverned output into apparent claims. A card built
 *   from open-world evidence says so on the page."
 *
 * Two guarantees this module provides, both fail-loud rather than silent
 * (the same discipline `termination-product-projection.js` uses for
 * `TERMINATION_RIGHT_TITLE_UNMAPPED`/`JOINT_MULTI_PARTY_CAPACITY`, cited in
 * this task's own brief):
 *
 *   1. `assertOpenWorldRowGovernance` / `assertGovernedRowHasNoOpenWorldMarker`
 *      read ONLY the row's own `evidence_governance` field -- never which
 *      table, collection or query produced it -- so a caller holding a row
 *      with no other context can still tell what it is holding. This is
 *      decision 2's first constraint ("The marker sits on the row, not
 *      inferred from which collection it arrived in or which table it sits
 *      in") made checkable in code, not just true by convention.
 *   2. `buildOpenWorldEvidenceCard` / `buildGovernedClaimSummaryCard` are two
 *      DIFFERENT card shapes -- different schema_version, different field
 *      set, and only the open-world one carries a `governance` value at all
 *      -- so the two can never render identically even if a caller forgets
 *      to check which one it has. Each constructor also refuses the OTHER
 *      kind of row outright, rather than silently producing a plausible-
 *      looking card from it.
 */

'use strict';

const {
  OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER,
} = require('./native-producer/native-write-set-adapter');

const OPEN_WORLD_CARD_SCHEMA = 'CANONICAL_V2_OPEN_WORLD_SERVING_CARD/V1';
const GOVERNED_CLAIM_CARD_SCHEMA = 'CANONICAL_V2_GOVERNED_CLAIM_SUMMARY_CARD/V1';

class UngovernedEvidenceProjectionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'UngovernedEvidenceProjectionError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new UngovernedEvidenceProjectionError(code, message, details);
}

// Reads ONLY `row.evidence_governance`. No parameter here ever names a table,
// collection key or object kind -- the point being proven is that the marker
// alone is sufficient.
function assertOpenWorldRowGovernance(row, label) {
  if (!row || typeof row !== 'object') {
    fail('INVALID_ROW', `${label} must be an object`, { label });
  }
  if (row.evidence_governance !== OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER) {
    fail(
      'MISSING_OPEN_WORLD_MARKER',
      `${label} does not carry the open-world evidence-governance marker -- refusing to treat it as ungoverned evidence`,
      { label, evidence_governance: row.evidence_governance },
    );
  }
  return row;
}

// The inverse check, for a row a caller believes is a governed claim or
// relationship revision. A real write can never produce a claim/relationship
// row carrying this field (their identity is content-hashed over a closed
// field list that does not include it -- see native-write-set-adapter.js's
// `CLAIM_REVISION_PAYLOAD_FIELDS`/`RELATIONSHIP_REVISION_PAYLOAD_FIELDS`, and
// `validate-write-set.js`'s `requireExactKeys(row, CLAIM_REVISION_KEYS, ...)`
// would reject it before it ever reached a publishable write set) -- so this
// only ever fires on a hand-tampered or otherwise corrupted row, which is
// exactly the case it exists to catch before that row reaches a page.
function assertGovernedRowHasNoOpenWorldMarker(row, label) {
  if (!row || typeof row !== 'object') {
    fail('INVALID_ROW', `${label} must be an object`, { label });
  }
  if (Object.prototype.hasOwnProperty.call(row, 'evidence_governance')) {
    fail(
      'GOVERNED_ROW_CARRIES_OPEN_WORLD_MARKER',
      `${label} is claimed to be a governed claim but carries an evidence-governance marker -- refusing to serve it as a governed claim`,
      { label, evidence_governance: row.evidence_governance },
    );
  }
  return row;
}

// Builds a review-surface card directly from the DB row shapes
// `buildOpenWorldWriteRows` (native-write-set-adapter.js) writes -- the
// candidate, its occurrence, and the occurrence's evidence references -- not
// from the in-memory `resolution.open_world` JSON the native-producer runner
// also carries. That distinction is the point: this function proves the
// marker survives a round trip through the shape the database actually
// stores, which is what decision 2's serving-boundary constraint is about.
function buildOpenWorldEvidenceCard({ candidate, occurrence, evidenceReferences = [] } = {}) {
  assertOpenWorldRowGovernance(candidate, 'open_world_candidates row');
  assertOpenWorldRowGovernance(occurrence, 'open_world_candidate_occurrences row');
  if (occurrence.candidate_id !== candidate.candidate_id) {
    fail('CANDIDATE_OCCURRENCE_MISMATCH', 'occurrence does not belong to the supplied candidate', {
      candidate_id: candidate.candidate_id, occurrence_candidate_id: occurrence.candidate_id,
    });
  }
  if (!Array.isArray(evidenceReferences) || evidenceReferences.length === 0) {
    fail('NO_EVIDENCE', 'an open-world evidence card requires at least one evidence reference', {
      open_world_candidate_occurrence_id: occurrence.open_world_candidate_occurrence_id,
    });
  }
  for (const evidence of evidenceReferences) {
    assertOpenWorldRowGovernance(evidence, 'open_world_evidence_references row');
    if (evidence.open_world_candidate_occurrence_id !== occurrence.open_world_candidate_occurrence_id) {
      fail('EVIDENCE_OCCURRENCE_MISMATCH', 'evidence reference does not belong to the supplied occurrence', {
        expected: occurrence.open_world_candidate_occurrence_id,
        actual: evidence.open_world_candidate_occurrence_id,
      });
    }
  }
  return Object.freeze({
    schema_version: OPEN_WORLD_CARD_SCHEMA,
    // Present on every card this function produces, and on no card
    // `buildGovernedClaimSummaryCard` produces -- the on-page signal decision
    // 2 requires ("A card built from open-world evidence says so on the
    // page").
    governance: OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER,
    is_governed_claim: false,
    display_label: 'Ungoverned evidence -- the model found this, but no governed taxonomy slot corroborates it',
    section_reference: candidate.section_reference ?? null,
    attempted_claim_definition_key: candidate.attempted_claim_definition_key ?? null,
    reason_code: candidate.reason_code ?? null,
    quote: occurrence.raw_value ?? null,
    canonical_value: occurrence.canonical_value ?? null,
    evidence_count: evidenceReferences.length,
    excerpt_ids: evidenceReferences.map((evidence) => evidence.excerpt_id).sort(),
  });
}

// The governed counterpart. Never carries `governance`, and refuses a row
// that does -- the two card shapes cannot converge even if a caller merges
// their fields carelessly downstream, because one has a field the other is
// forbidden to have.
// A POSITIVE check, and the reason it has to be positive. Until 2026-08-07
// this function asked only whether the row lacked the ungoverned marker, and
// adversarial review broke it by execution: a QXO-era
// `NOVEL_CONCEPT_CANDIDATE/V1` open-world row -- which by design never carries
// the marker, because it predates it -- was accepted and rendered as
// "Governed claim" with its value. That is uncorroborated model output shown
// to a lawyer as a finding, which OPERATING-RULES.md names as the worst
// failure this product can produce.
//
// Marker-absence distinguishes nothing, because two grammars share these
// tables: the native rows that carry the marker, and the QXO rows that never
// did. The commit that shipped this claimed each constructor "refuses the
// other kind of row outright"; that was true only for the marker-carrying
// half of the row universe. Ask what the row IS, never what it lacks.
const CLAIM_REVISION_SCHEMA = 'CLAIM_REVISION/V1';

function buildGovernedClaimSummaryCard(claimRow) {
  if (!claimRow || typeof claimRow !== 'object') {
    throw new UngovernedEvidenceProjectionError(
      'GOVERNED_CLAIM_CARD_REQUIRES_ROW',
      'a governed claim card requires a claim revision row',
    );
  }
  if (claimRow.schema_version !== CLAIM_REVISION_SCHEMA) {
    throw new UngovernedEvidenceProjectionError(
      'GOVERNED_CLAIM_CARD_WRONG_ROW_KIND',
      `a governed claim card requires ${CLAIM_REVISION_SCHEMA}, received `
      + `${JSON.stringify(claimRow.schema_version ?? null)}. A row that is not a claim revision `
      + 'is never a governed claim, whether or not it carries an ungoverned marker.',
    );
  }
  assertGovernedRowHasNoOpenWorldMarker(claimRow, 'claim revision row');
  return Object.freeze({
    schema_version: GOVERNED_CLAIM_CARD_SCHEMA,
    is_governed_claim: true,
    display_label: 'Governed claim',
    claim_definition_key: claimRow.claim_definition_key ?? null,
    canonical_value: claimRow.canonical_value ?? null,
    raw_value: claimRow.raw_value ?? null,
  });
}

module.exports = {
  OPEN_WORLD_CARD_SCHEMA,
  GOVERNED_CLAIM_CARD_SCHEMA,
  UngovernedEvidenceProjectionError,
  assertOpenWorldRowGovernance,
  assertGovernedRowHasNoOpenWorldMarker,
  buildOpenWorldEvidenceCard,
  buildGovernedClaimSummaryCard,
};
