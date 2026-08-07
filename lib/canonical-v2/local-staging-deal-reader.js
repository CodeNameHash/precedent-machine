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
 * **Conditional termination-fee values (PLAN.md Step 2C1).**
 * `readConditionalTerminationFeeValuesForDeal` scopes by the `document_hash`
 * COLUMN that step added to `canonical_v2_staging.conditional_termination_
 * fee_values` -- unlike the four governed tables above, this kind's payload
 * has no document_hash field of its own (conditional-termination-fee-
 * value.js's 11-key schema does not carry one; its content-addressed id is
 * computed over the payload alone), so the column, populated at write time
 * from the write-set's own `deal.document_hash` rather than from anything
 * inside the row, is the only scope this function has to filter on.
 * `readDealFromLocalCanonicalV2Staging` returns these alongside `resolved`/
 * `open_world`/`relationships` as `conditional_termination_fee_values`, and
 * `lib/canonical-v2/termination-fee-serving-source.js` reads them from here
 * now instead of its own prior direct, unscoped `SELECT * FROM
 * conditional_termination_fee_values` -- before Step 2C1 that query read
 * the WHOLE table, correct only because Modiv was the only deal that had
 * ever written to it.
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
 *
 * **PLAN.md Step 2B2, hosted read access -- added without touching anything
 * above this paragraph.** Every read function above goes through a small
 * query interface (`createStagingQueryInterface`, just below the imports)
 * rather than calling `client.query()` directly. The join logic, the
 * closure computation, the ORPHAN_CLAIM_REVISION guard and the governance
 * assertions are unchanged -- this refactor only moved WHERE a page of rows
 * comes from, never what happens to it once it arrives. Two
 * implementations: LOCAL (a pg-compatible `client.query()`, the exact SQL
 * text this module always issued, so this module's own hermetic tests --
 * whose fake client routes on that text -- keep passing unmodified) and
 * HOSTED (a client exposing `client.rpc(name, params)`, calling the
 * whitelisted `SECURITY DEFINER` functions
 * `supabase/canonical-v2-staging-read.sql` defines, granted to the new
 * `canonical_v2_staging_reader` role -- DECISIONS.md, "Waiting on Ben" item
 * 1, RULED 2026-08-07 by Fable under Ben's delegation). Which one runs is
 * decided purely by what shape of client the caller supplies
 * (`.query` vs `.rpc`); nothing in this module chooses a hosted database on
 * its own, and `isPermittedCanonicalV2Runtime` still denies production
 * outright regardless of which interface a permitted caller ends up using.
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
  if (!client || (typeof client.query !== 'function' && typeof client.rpc !== 'function')) {
    throw new TypeError(
      'a query client is required: either a pg-compatible client (an object with an async '
      + '.query(text, values)) for the local prototype, or a hosted client (an object with an async '
      + '.rpc(name, params)) for the SECURITY DEFINER RPC surface supabase/canonical-v2-staging-read.sql defines',
    );
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

// ── The query interface (PLAN.md Step 2B2). See this module's header for
// the full account. In short: every read function below calls named methods
// on whichever interface `createStagingQueryInterface` builds for the
// client it was handed, and never issues SQL or an RPC call directly
// itself. ──

// Whitelisted by NAME, mirroring lib/canonical-v2/serving-client.js's
// RPC_SPECS allow-list for Step 5A's RPCs -- a hosted call this module
// issues can only ever be one of these eight, matching the eight functions
// supabase/canonical-v2-staging-read.sql defines and grants to
// canonical_v2_staging_reader.
const HOSTED_STAGING_RPC_NAMES = Object.freeze([
  'canonical_v2_staging_read_provision_instances',
  'canonical_v2_staging_read_provision_components',
  'canonical_v2_staging_read_claim_revisions',
  'canonical_v2_staging_read_relationship_revisions',
  'canonical_v2_staging_read_open_world_candidates',
  'canonical_v2_staging_read_open_world_candidate_occurrences',
  'canonical_v2_staging_read_open_world_evidence_references',
  'canonical_v2_staging_read_conditional_termination_fee_values',
]);

// Bounds mirrored from supabase/canonical-v2-staging-read.sql's own
// staging_read_bound() -- the SQL side enforces these first and fails loud
// (RAISE EXCEPTION, ERRCODE 54000) before a response is ever produced; this
// is defense-in-depth on the way back into JS, the same discipline
// serving-client.js's boundedRpcData applies to Step 5A's RPCs even though
// their SQL functions also enforce their own caps.
const HOSTED_STAGING_MAX_ROWS = 2000;
const HOSTED_STAGING_MAX_BYTES = 4 * 1024 * 1024;

// LOCAL: the raw SQL this module has always issued, byte-for-byte the same
// query shapes -- unchanged so this module's own hermetic tests (whose fake
// client routes on the query TEXT, see tests/canonical-v2-local-staging-
// deal-reader.test.js) keep passing without modification.
function createLocalStagingQueryInterface(client) {
  return {
    async provisionInstancesByDocumentHash(documentHash) {
      return queryPayloads(
        client,
        `SELECT canonical_payload FROM canonical_v2_staging.provision_instances
         WHERE canonical_payload->>'document_hash' = $1`,
        [documentHash],
      );
    },
    async provisionComponentsByParentProvisionInstanceIds(parentProvisionInstanceIds) {
      return queryPayloads(
        client,
        `SELECT canonical_payload FROM canonical_v2_staging.provision_components
         WHERE canonical_payload->>'parent_provision_instance_id' = ANY($1::text[])`,
        [parentProvisionInstanceIds],
      );
    },
    async claimRevisionsByClosureOrSubject(closureIds, subjectOccurrenceIds) {
      return queryPayloads(
        client,
        `SELECT canonical_payload FROM canonical_v2_staging.claim_revisions
         WHERE closure_id = ANY($1::text[])
            OR canonical_payload->>'subject_occurrence_id' = ANY($2::text[])`,
        [closureIds, subjectOccurrenceIds],
      );
    },
    async relationshipRevisionsBySourceOccurrenceIds(sourceOccurrenceIds) {
      return queryPayloads(
        client,
        `SELECT canonical_payload FROM canonical_v2_staging.relationship_revisions
         WHERE canonical_payload->>'source_occurrence_id' = ANY($1::text[])`,
        [sourceOccurrenceIds],
      );
    },
    async openWorldCandidatesByDocumentHash(documentHash) {
      return queryPayloads(
        client,
        `SELECT canonical_payload FROM canonical_v2_staging.open_world_candidates
         WHERE canonical_payload->>'document_hash' = $1`,
        [documentHash],
      );
    },
    async openWorldCandidateOccurrencesByCandidateIds(candidateIds) {
      return queryPayloads(
        client,
        `SELECT canonical_payload FROM canonical_v2_staging.open_world_candidate_occurrences
         WHERE canonical_payload->>'candidate_id' = ANY($1::text[])`,
        [candidateIds],
      );
    },
    async openWorldEvidenceReferencesByOccurrenceIds(openWorldCandidateOccurrenceIds) {
      return queryPayloads(
        client,
        `SELECT canonical_payload FROM canonical_v2_staging.open_world_evidence_references
         WHERE canonical_payload->>'open_world_candidate_occurrence_id' = ANY($1::text[])`,
        [openWorldCandidateOccurrenceIds],
      );
    },
    async conditionalTerminationFeeValuesByDocumentHash(documentHash) {
      return queryPayloads(
        client,
        `SELECT canonical_payload FROM canonical_v2_staging.conditional_termination_fee_values
         WHERE document_hash = $1`,
        [documentHash],
      );
    },
  };
}

// A response that is not a bounded array is treated as a broken read, not a
// permissive default -- an oversized or malformed hosted response fails
// loud here, the same "fails loud, not empty" discipline this module's
// header already states for the entry point.
function boundHostedStagingRows(rows, rpcName) {
  if (!Array.isArray(rows)) {
    throw new LocalStagingReadError(
      'HOSTED_RPC_MALFORMED_RESPONSE',
      `hosted read RPC ${rpcName} did not return an array`,
      { rpc: rpcName },
    );
  }
  if (rows.length > HOSTED_STAGING_MAX_ROWS) {
    throw new LocalStagingReadError(
      'HOSTED_RPC_RESPONSE_EXCEEDED_ROW_CEILING',
      `hosted read RPC ${rpcName} returned more rows (${rows.length}) than its ceiling (${HOSTED_STAGING_MAX_ROWS}) permits`,
      { rpc: rpcName, rows: rows.length, ceiling: HOSTED_STAGING_MAX_ROWS },
    );
  }
  let bytes;
  try {
    const encoded = JSON.stringify(rows);
    if (encoded === undefined) throw new TypeError('response is not JSON encodable');
    bytes = Buffer.byteLength(encoded, 'utf8');
  } catch {
    throw new LocalStagingReadError(
      'HOSTED_RPC_MALFORMED_RESPONSE',
      `hosted read RPC ${rpcName} response is not JSON-encodable`,
      { rpc: rpcName },
    );
  }
  if (bytes > HOSTED_STAGING_MAX_BYTES) {
    throw new LocalStagingReadError(
      'HOSTED_RPC_RESPONSE_EXCEEDED_BYTE_CEILING',
      `hosted read RPC ${rpcName} response (${bytes} bytes) exceeded its byte ceiling (${HOSTED_STAGING_MAX_BYTES})`,
      { rpc: rpcName, bytes, ceiling: HOSTED_STAGING_MAX_BYTES },
    );
  }
  return rows;
}

// HOSTED: calls the whitelisted SECURITY DEFINER functions by name, with
// bounded payloads. `client.rpc(name, params)` is expected to return
// `{ data, error }`, the same shape lib/canonical-v2/serving-client.js's
// `rpc()` already returns for Step 5A -- this module does not open its own
// database connection or construct one; the caller supplies a client that
// already knows how to reach the hosted RPC surface.
function createHostedStagingQueryInterface(client) {
  async function call(rpcName, params) {
    if (!HOSTED_STAGING_RPC_NAMES.includes(rpcName)) {
      throw new LocalStagingReadError(
        'HOSTED_RPC_NOT_WHITELISTED',
        `${rpcName} is not one of the read RPCs this module is permitted to call`,
        { rpc: rpcName },
      );
    }
    const { data, error } = await client.rpc(rpcName, params);
    if (error) {
      throw new LocalStagingReadError(
        'HOSTED_RPC_FAILED',
        `hosted read RPC ${rpcName} failed: ${(error && error.message) || 'unknown error'}`,
        { rpc: rpcName },
      );
    }
    return boundHostedStagingRows(data == null ? [] : data, rpcName);
  }
  return {
    provisionInstancesByDocumentHash: (documentHash) => call(
      'canonical_v2_staging_read_provision_instances', { p_document_hash: documentHash },
    ),
    provisionComponentsByParentProvisionInstanceIds: (parentProvisionInstanceIds) => call(
      'canonical_v2_staging_read_provision_components',
      { p_parent_provision_instance_ids: parentProvisionInstanceIds },
    ),
    claimRevisionsByClosureOrSubject: (closureIds, subjectOccurrenceIds) => call(
      'canonical_v2_staging_read_claim_revisions',
      { p_closure_ids: closureIds, p_subject_occurrence_ids: subjectOccurrenceIds },
    ),
    relationshipRevisionsBySourceOccurrenceIds: (sourceOccurrenceIds) => call(
      'canonical_v2_staging_read_relationship_revisions', { p_source_occurrence_ids: sourceOccurrenceIds },
    ),
    openWorldCandidatesByDocumentHash: (documentHash) => call(
      'canonical_v2_staging_read_open_world_candidates', { p_document_hash: documentHash },
    ),
    openWorldCandidateOccurrencesByCandidateIds: (candidateIds) => call(
      'canonical_v2_staging_read_open_world_candidate_occurrences', { p_candidate_ids: candidateIds },
    ),
    openWorldEvidenceReferencesByOccurrenceIds: (openWorldCandidateOccurrenceIds) => call(
      'canonical_v2_staging_read_open_world_evidence_references',
      { p_open_world_candidate_occurrence_ids: openWorldCandidateOccurrenceIds },
    ),
    conditionalTerminationFeeValuesByDocumentHash: (documentHash) => call(
      'canonical_v2_staging_read_conditional_termination_fee_values', { p_document_hash: documentHash },
    ),
  };
}

// The dispatcher. LOCAL when the client looks pg-compatible (`.query`),
// HOSTED when it looks like an RPC client (`.rpc`) -- the same distinction
// requireClient() already validated is present before this is ever called.
function createStagingQueryInterface(client) {
  if (client && typeof client.query === 'function') return createLocalStagingQueryInterface(client);
  if (client && typeof client.rpc === 'function') return createHostedStagingQueryInterface(client);
  throw new TypeError('createStagingQueryInterface requires a client exposing either .query or .rpc');
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
  const q = createStagingQueryInterface(client);

  const provisions = await q.provisionInstancesByDocumentHash(documentHash);
  const provisionById = new Map(provisions.map((row) => [row.provision_instance_id, row]));
  if (provisionById.size === 0) return [];

  // A claim's subject is NOT always a provision. validate-write-set.js's
  // `occurrences` map (search SEMANTIC_REFERENCE_UNRESOLVED) admits five
  // kinds -- provisions, components, definition occurrences, condition groups
  // and relationship occurrences -- and refuses any claim whose subject
  // resolves to none of them. So a published claim always has a resolvable
  // subject; it simply need not be a provision.
  //
  // This module originally read only provision_instances, and the cost was
  // measured on 2026-08-07: two Modiv runs written durably put 19 claims in
  // the database and this function returned 9, silently.
  // modiv-capitalisation's nine claims all name its single provision (nine
  // claims ABOUT one provision, which is not the broken write it looks like);
  // modiv-interim-operating's ten all name provision COMPONENTS, and every
  // one of them was invisible. See PLAN.md Step 2B3.
  const components = await q.provisionComponentsByParentProvisionInstanceIds([...provisionById.keys()]);
  const componentById = new Map(components.map((row) => [row.provision_component_id, row]));

  // Scoped by closure, NOT by the subject ids gathered above. The previous
  // form selected `WHERE subject_occurrence_id = ANY(<the ids we then check
  // against>)`, which made the ORPHAN_CLAIM_REVISION guard below structurally
  // unreachable: the only rows that could trigger it were the rows the query
  // excluded. A guard that cannot fire is worse than no guard, because it
  // reads as protection. Fetching by closure lets an unresolvable subject
  // actually reach the check.
  const closureIds = [...new Set([
    ...provisions.map((row) => row.closure_id),
    ...components.map((row) => row.closure_id),
  ].filter((id) => typeof id === 'string' && id.length > 0))];
  const claims = await q.claimRevisionsByClosureOrSubject(
    closureIds,
    [...provisionById.keys(), ...componentById.keys()],
  );

  return claims.map((claim) => {
    assertGovernedRowHasNoOpenWorldMarker(claim, 'claim_revisions row');
    const component = componentById.get(claim.subject_occurrence_id);
    const provisionInstance = provisionById.get(claim.subject_occurrence_id)
      || (component ? provisionById.get(component.parent_provision_instance_id) : undefined);
    if (!provisionInstance) {
      throw new LocalStagingReadError(
        'ORPHAN_CLAIM_REVISION',
        'a claim_revisions row names a subject_occurrence_id that resolves to no provision or provision component for this deal',
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
      // Present and null when the claim names the provision directly, so a
      // caller can tell "about the provision" from "about one of its
      // components" without inferring it from a missing key.
      provision_component: component || null,
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
  const q = createStagingQueryInterface(client);

  const candidates = await q.openWorldCandidatesByDocumentHash(documentHash);
  if (candidates.length === 0) return [];
  for (const candidate of candidates) assertOpenWorldRowGovernance(candidate, 'open_world_candidates row');

  const candidateIds = candidates.map((row) => row.candidate_id);
  const occurrences = await q.openWorldCandidateOccurrencesByCandidateIds(candidateIds);
  for (const occurrence of occurrences) assertOpenWorldRowGovernance(occurrence, 'open_world_candidate_occurrences row');
  const occurrencesByCandidateId = new Map();
  for (const occurrence of occurrences) {
    if (!occurrencesByCandidateId.has(occurrence.candidate_id)) occurrencesByCandidateId.set(occurrence.candidate_id, []);
    occurrencesByCandidateId.get(occurrence.candidate_id).push(occurrence);
  }

  const occurrenceIds = occurrences.map((row) => row.open_world_candidate_occurrence_id);
  const evidenceReferences = occurrenceIds.length === 0
    ? [] : await q.openWorldEvidenceReferencesByOccurrenceIds(occurrenceIds);
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
  const q = createStagingQueryInterface(client);

  const provisions = await q.provisionInstancesByDocumentHash(documentHash);
  const provisionById = new Map(provisions.map((row) => [row.provision_instance_id, row]));
  if (provisionById.size === 0) return [];

  const relationships = await q.relationshipRevisionsBySourceOccurrenceIds([...provisionById.keys()]);

  return relationships.map((relationship) => {
    assertGovernedRowHasNoOpenWorldMarker(relationship, 'relationship_revisions row');
    const provisionInstance = provisionById.get(relationship.source_occurrence_id);
    return Object.freeze({ provision_instance: provisionInstance, relationship });
  });
}

// ── Conditional termination-fee values (PLAN.md Step 2C1). Scoped by the
// document_hash COLUMN that step added to canonical_v2_staging.conditional_
// termination_fee_values, not by anything inside canonical_payload -- this
// kind carries no document_hash field in its own 11-key schema (see
// conditional-termination-fee-value.js), unlike provision_instances above,
// so there is no ->>'document_hash' payload lookup to fall back on here.
// Before this step, termination-fee-serving-source.js read the WHOLE table
// with no WHERE clause at all, which was correct only because Modiv was the
// only deal that had ever written to it -- see that module's own comment,
// corrected in the same change that added this function.
async function readConditionalTerminationFeeValuesForDeal({ client, documentHash }) {
  requireClient(client);
  requireDocumentHash(documentHash);
  const q = createStagingQueryInterface(client);
  return q.conditionalTerminationFeeValuesByDocumentHash(documentHash);
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
  const conditionalTerminationFeeValues = await readConditionalTerminationFeeValuesForDeal({ client, documentHash });

  if (expectNonEmpty && resolved.length === 0 && openWorld.length === 0 && relationships.length === 0
    && conditionalTerminationFeeValues.length === 0) {
    throw new LocalStagingReadError(
      'EMPTY_DEAL_READ',
      'read found no governed claims, open-world evidence, relationships or conditional termination fee values '
      + 'for this document_hash -- a reader that reads zero rows and reports success is the failure this module '
      + 'exists to avoid. Pass expectNonEmpty: false if this deal is genuinely expected to have no data yet.',
      { document_hash: documentHash },
    );
  }

  return Object.freeze({
    document_hash: documentHash,
    resolved: Object.freeze(resolved),
    open_world: Object.freeze(openWorld),
    relationships: Object.freeze(relationships),
    conditional_termination_fee_values: Object.freeze(conditionalTerminationFeeValues),
  });
}

module.exports = {
  LocalStagingReadError,
  OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER,
  readGovernedClaimsForDeal,
  readOpenWorldEvidenceForDeal,
  readRelationshipsForDeal,
  readConditionalTerminationFeeValuesForDeal,
  readDealFromLocalCanonicalV2Staging,
  // PLAN.md Step 2B2, the query interface. Exported for tests that need to
  // prove the hosted path is genuinely reachable and genuinely bounded, not
  // because application code outside this module is expected to build an
  // interface directly -- readDealFromLocalCanonicalV2Staging and friends
  // already do that internally from whatever client they are handed.
  HOSTED_STAGING_RPC_NAMES,
  createLocalStagingQueryInterface,
  createHostedStagingQueryInterface,
  createStagingQueryInterface,
};
