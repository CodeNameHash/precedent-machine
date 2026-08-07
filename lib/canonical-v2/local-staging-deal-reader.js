/**
 * lib/canonical-v2/local-staging-deal-reader.js
 *
 * PLAN.md Step 2B, "the read half, stated plainly because it is easy to
 * miss". No serving source read `canonical_v2_staging` before this file --
 * grep every `lib/canonical-v2/*serving*.js` for `serving-client` or
 * `canonical_v2_staging` and the only hits are comments.
 * `termination-fee-serving-source.js`, the one family that serves V2 data on
 * a preview deployment, reads a committed fixture, not this schema.
 *
 * **This is the LOCAL prototype, and its name says so on purpose.** It reads
 * `canonical_v2_staging` over a plain `pg` connection the caller supplies --
 * a table-owner connection to a local container, e.g.
 * `scripts/canonical-v2-local-durable-write.js`'s target. That shortcut
 * works ONLY because `supabase/canonical-v2-foundation.sql` never sets
 * `FORCE ROW LEVEL SECURITY` (grep it: zero occurrences), so a table owner
 * reads freely even though every table has RLS enabled with zero policies
 * and every role's table privileges are revoked
 * (`foundation.sql:8661-8665`). That is an absence, not a design --
 * DECISIONS.md's "Waiting on Ben" item 1 -- and this module must not be
 * carried into a hosted environment as though it were one. It does not
 * import `lib/canonical-v2/serving-client.js`: that module's
 * `validateConnectionString` hard-codes the Supabase pooler hostname, so it
 * physically cannot address a local container, and its `RPC_SPECS` read the
 * Step 5A corpus-release layer (`shared_serving_rows` /
 * `active_corpus_release_pointers`, zero rows), not the tables the writer
 * populates. This module's own guard is `isPermittedCanonicalV2Runtime`
 * (`feature-flags.js`), the same one every other Canonical V2 serving
 * source already gates on, so it denies production the same way the rest of
 * the family does rather than becoming the module that quietly changes that.
 *
 * **What it reads and why the shapes differ.** Deal identity is
 * `document_hash`, not `deal_key` -- `deal_key` is per-(deal, family); 24
 * committed Modiv runs carry 24 distinct `deal_key`s over one
 * `document_hash`. None of the four governed tables
 * (`excerpts`/`provision_instances`/`provision_components`/
 * `claim_revisions`) has a `document_hash` COLUMN -- it lives inside
 * `canonical_payload`, and `claim_revisions` does not carry it at all,
 * joining instead via `claim.subject_occurrence_id =
 * provision_instance.provision_instance_id` (the same join
 * `termination-product-projection.js`'s `resolved[]` entries already
 * encode as `.provision_instance` next to `.claim`).
 *
 * `readGovernedClaimsForDeal` reassembles that join and returns entries
 * shaped like `resolution.json`'s `resolved[]` array -- the shape
 * `termination-product-projection.js`'s `project()` already consumes
 * (`resolved_claim_definition_key`, `concept_key`, `provision_instance`,
 * `claim`). It is reassembly, not translation: `canonical_payload` is the
 * write-set item verbatim, so `entry.claim` and `entry.provision_instance`
 * below are byte-identical to what the writer received, not a re-derived
 * copy of it.
 *
 * **One field does not round-trip, by construction, and callers must not
 * assume it does.** `resolution.json`'s `resolved[]` entries carry
 * `section_reference` at the top level; neither `CLAIM_REVISION_PAYLOAD_
 * FIELDS` nor a provision instance's payload includes it (verified: neither
 * schema lists it, and a written row in this project's own local container
 * confirms it -- see this module's own test and
 * `docs/codex-program/notes/step-2b-read-half.md`). Every entry this module
 * returns carries `section_reference: null` rather than a stale or
 * fabricated value. `project()` tolerates this (it only ever assigns the
 * field through, never requires it), so a card renders with no section
 * reference rather than a wrong one -- but a caller that DOES require it
 * must know this module cannot supply it and must not silently substitute
 * anything.
 *
 * **Open-world evidence is read separately and stays marked.** DECISIONS.md
 * decision 2 requires the governed/ungoverned distinction to survive on the
 * row, checkable without knowing which table or query produced it.
 * `readOpenWorldEvidenceForDeal` returns `{ candidate, occurrence,
 * evidenceReferences }` bundles in exactly the shape
 * `lib/canonical-v2/open-world-evidence-serving.js`'s
 * `buildOpenWorldEvidenceCard` already expects -- the "serving-side reader
 * already built" this task's own brief names -- so this module's job is
 * getting real rows into that function's hands, not reimplementing its
 * governance check. Every row this function returns still carries
 * `evidence_governance: OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER` because it is
 * never stripped from `canonical_payload`; `assertOpenWorldRowGovernance`
 * verifies that on the way out rather than trusting the write boundary
 * silently. A governed claim row is asserted the opposite way
 * (`assertGovernedRowHasNoOpenWorldMarker`) for the same reason: the two
 * kinds must never become confusable even if a future write path drifts.
 *
 * **Relationships.** `readRelationshipsForDeal` joins
 * `relationship_revisions` the same way, via
 * `relationship.source_occurrence_id = provision_instance.provision_instance_id`
 * (`RELATIONSHIP_REVISION_PAYLOAD_FIELDS`, `native-write-set-adapter.js`).
 * No importable run in this project's committed baseline publishes any
 * relationship rows (checked directly, not assumed), so this path is
 * implemented and unit-tested against a synthetic row but has not yet been
 * proven against a real run's relationship data -- there is none written
 * anywhere yet to prove it against.
 *
 * **Fails loud, not empty.** `readDealFromLocalCanonicalV2Staging` never
 * returns `{ resolved: [], open_world: [], relationships: [] }` silently for
 * a deal the caller believes has data: pass `expectNonEmpty: true` (the
 * default) and it throws `LocalStagingReadError('EMPTY_DEAL_READ', ...)`
 * when every collection comes back empty, so a broken join or a wrong
 * `document_hash` fails the caller's own test rather than reporting success
 * for a query that read nothing. This is the same discipline
 * `evidence-to-write-set-bridge.js` already applies on the write side
 * ("Found by a test asserting the import publishes *something*, not by
 * anything failing. Keep that assertion.") -- and CLAUDE.md's rule directly:
 * "a run that reads zero rows and reports success is the specific failure
 * this step exists to avoid."
 *
 * Entry point: `readDealFromLocalCanonicalV2Staging({ client, documentHash,
 * env })`.
 */

'use strict';

const { isPermittedCanonicalV2Runtime } = require('./feature-flags');
const {
  OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER,
} = require('./native-producer/native-write-set-adapter');
const {
  assertOpenWorldRowGovernance,
  assertGovernedRowHasNoOpenWorldMarker,
} = require('./open-world-evidence-serving');

class LocalStagingReadError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'LocalStagingReadError';
    this.code = code;
    this.details = details;
  }
}

function requireClient(client) {
  if (!client || typeof client.query !== 'function') {
    throw new TypeError('a pg-compatible client (an object with an async .query(text, values)) is required');
  }
  return client;
}

function requireDocumentHash(documentHash) {
  if (typeof documentHash !== 'string' || documentHash.length === 0) {
    throw new TypeError('documentHash must be a non-empty string');
  }
  return documentHash;
}

async function queryPayloads(client, sql, values) {
  const result = await client.query(sql, values);
  return result.rows.map((row) => row.canonical_payload);
}

// ── Governed claims + their provisions, reassembled into resolution.json's
// resolved[] shape (the shape termination-product-projection.js's project()
// already reads: resolved_claim_definition_key, concept_key,
// provision_instance, claim). document_hash lives inside provision_
// instances' payload; claim_revisions has no document_hash column at all
// and joins onto the provision via subject_occurrence_id.
async function readGovernedClaimsForDeal({ client, documentHash }) {
  requireClient(client);
  requireDocumentHash(documentHash);

  const provisions = await queryPayloads(
    client,
    `SELECT canonical_payload FROM canonical_v2_staging.provision_instances
     WHERE canonical_payload->>'document_hash' = $1`,
    [documentHash],
  );
  const provisionById = new Map(provisions.map((row) => [row.provision_instance_id, row]));
  if (provisionById.size === 0) return [];

  const claims = await queryPayloads(
    client,
    `SELECT canonical_payload FROM canonical_v2_staging.claim_revisions
     WHERE canonical_payload->>'subject_occurrence_id' = ANY($1::text[])`,
    [[...provisionById.keys()]],
  );

  return claims.map((claim) => {
    assertGovernedRowHasNoOpenWorldMarker(claim, 'claim_revisions row');
    const provisionInstance = provisionById.get(claim.subject_occurrence_id);
    if (!provisionInstance) {
      throw new LocalStagingReadError(
        'ORPHAN_CLAIM_REVISION',
        'a claim_revisions row names a subject_occurrence_id with no matching provision_instances row for this deal',
        { claim_revision_id: claim.claim_revision_id, subject_occurrence_id: claim.subject_occurrence_id },
      );
    }
    return Object.freeze({
      // Does NOT round-trip through the persisted write-set -- see this
      // module's header. Present (not omitted) so callers see the gap
      // rather than a missing key silently changing shape.
      section_reference: null,
      resolved_claim_definition_key: claim.claim_definition_key,
      concept_key: provisionInstance.concept_key,
      provision_instance: provisionInstance,
      claim,
    });
  });
}

// ── Open-world evidence, in the {candidate, occurrence, evidenceReferences}
// shape open-world-evidence-serving.js's buildOpenWorldEvidenceCard already
// expects. Every row is verified to carry the governance marker before it
// leaves this function -- decision 2's "the marker sits on the row" made
// checkable on the way OUT, not just on the way in.
async function readOpenWorldEvidenceForDeal({ client, documentHash }) {
  requireClient(client);
  requireDocumentHash(documentHash);

  const candidates = await queryPayloads(
    client,
    `SELECT canonical_payload FROM canonical_v2_staging.open_world_candidates
     WHERE canonical_payload->>'document_hash' = $1`,
    [documentHash],
  );
  if (candidates.length === 0) return [];
  for (const candidate of candidates) assertOpenWorldRowGovernance(candidate, 'open_world_candidates row');

  const candidateIds = candidates.map((row) => row.candidate_id);
  const occurrences = await queryPayloads(
    client,
    `SELECT canonical_payload FROM canonical_v2_staging.open_world_candidate_occurrences
     WHERE canonical_payload->>'candidate_id' = ANY($1::text[])`,
    [candidateIds],
  );
  for (const occurrence of occurrences) assertOpenWorldRowGovernance(occurrence, 'open_world_candidate_occurrences row');
  const occurrencesByCandidateId = new Map();
  for (const occurrence of occurrences) {
    if (!occurrencesByCandidateId.has(occurrence.candidate_id)) occurrencesByCandidateId.set(occurrence.candidate_id, []);
    occurrencesByCandidateId.get(occurrence.candidate_id).push(occurrence);
  }

  const occurrenceIds = occurrences.map((row) => row.open_world_candidate_occurrence_id);
  const evidenceReferences = occurrenceIds.length === 0 ? [] : await queryPayloads(
    client,
    `SELECT canonical_payload FROM canonical_v2_staging.open_world_evidence_references
     WHERE canonical_payload->>'open_world_candidate_occurrence_id' = ANY($1::text[])`,
    [occurrenceIds],
  );
  for (const evidence of evidenceReferences) assertOpenWorldRowGovernance(evidence, 'open_world_evidence_references row');
  const evidenceByOccurrenceId = new Map();
  for (const evidence of evidenceReferences) {
    const key = evidence.open_world_candidate_occurrence_id;
    if (!evidenceByOccurrenceId.has(key)) evidenceByOccurrenceId.set(key, []);
    evidenceByOccurrenceId.get(key).push(evidence);
  }

  const bundles = [];
  for (const candidate of candidates) {
    const candidateOccurrences = occurrencesByCandidateId.get(candidate.candidate_id) || [];
    for (const occurrence of candidateOccurrences) {
      bundles.push(Object.freeze({
        candidate,
        occurrence,
        evidenceReferences: evidenceByOccurrenceId.get(occurrence.open_world_candidate_occurrence_id) || [],
      }));
    }
  }
  return bundles;
}

// ── Relationships, joined the same way as claims. Implemented and unit-
// tested (see this module's test file), but no importable run in this
// project's committed baseline publishes relationship rows yet -- checked
// directly (see this file's header) -- so there is nothing durable to prove
// it against today.
async function readRelationshipsForDeal({ client, documentHash }) {
  requireClient(client);
  requireDocumentHash(documentHash);

  const provisions = await queryPayloads(
    client,
    `SELECT canonical_payload FROM canonical_v2_staging.provision_instances
     WHERE canonical_payload->>'document_hash' = $1`,
    [documentHash],
  );
  const provisionById = new Map(provisions.map((row) => [row.provision_instance_id, row]));
  if (provisionById.size === 0) return [];

  const relationships = await queryPayloads(
    client,
    `SELECT canonical_payload FROM canonical_v2_staging.relationship_revisions
     WHERE canonical_payload->>'source_occurrence_id' = ANY($1::text[])`,
    [[...provisionById.keys()]],
  );

  return relationships.map((relationship) => {
    assertGovernedRowHasNoOpenWorldMarker(relationship, 'relationship_revisions row');
    const provisionInstance = provisionById.get(relationship.source_occurrence_id);
    return Object.freeze({ provision_instance: provisionInstance, relationship });
  });
}

// ── The entry point. ──
//
// Fails closed the way every other Canonical V2 serving source does
// (isPermittedCanonicalV2Runtime denies production outright), and refuses
// to report success on a read that found nothing, unless the caller
// explicitly opts out (expectNonEmpty: false) -- e.g. a deal that
// genuinely has no data yet, which this module cannot distinguish from a
// broken join without the caller saying so.
async function readDealFromLocalCanonicalV2Staging({
  client,
  documentHash,
  env = process.env,
  expectNonEmpty = true,
}) {
  if (!isPermittedCanonicalV2Runtime(env)) {
    throw new LocalStagingReadError(
      'RUNTIME_NOT_PERMITTED',
      'Canonical V2 local staging read is denied in this runtime (production, or an unrecognised environment).',
      {},
    );
  }
  requireClient(client);
  requireDocumentHash(documentHash);

  // Sequenced, not Promise.all: the caller may hand this a single pg
  // `Client` rather than a `Pool` (a table-owner connection to a throwaway
  // local container has no reason to need more than one), and a bare
  // `Client` cannot run overlapping queries.
  const resolved = await readGovernedClaimsForDeal({ client, documentHash });
  const openWorld = await readOpenWorldEvidenceForDeal({ client, documentHash });
  const relationships = await readRelationshipsForDeal({ client, documentHash });

  if (expectNonEmpty && resolved.length === 0 && openWorld.length === 0 && relationships.length === 0) {
    throw new LocalStagingReadError(
      'EMPTY_DEAL_READ',
      'read found no governed claims, open-world evidence or relationships for this document_hash -- a reader '
      + 'that reads zero rows and reports success is the failure this module exists to avoid. Pass '
      + 'expectNonEmpty: false if this deal is genuinely expected to have no data yet.',
      { document_hash: documentHash },
    );
  }

  return Object.freeze({
    document_hash: documentHash,
    resolved: Object.freeze(resolved),
    open_world: Object.freeze(openWorld),
    relationships: Object.freeze(relationships),
  });
}

module.exports = {
  LocalStagingReadError,
  OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER,
  readGovernedClaimsForDeal,
  readOpenWorldEvidenceForDeal,
  readRelationshipsForDeal,
  readDealFromLocalCanonicalV2Staging,
};
