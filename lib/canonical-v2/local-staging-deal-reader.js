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
 * **`RESOLVED_ENTRY_ALLOWLISTED_GAPS` / `OPEN_WORLD_ENTRY_ALLOWLISTED_GAPS`
 * -- the fields that do NOT round-trip, each with a reason, checked by
 * construction rather than asserted from memory** (PLAN.md Step 2D1 defect
 * 5: found five separate times in one ladder run -- `CONSIDERATION`'s
 * `party`, `REPRESENTATIONS`'s open-world fields, `NO_OTHER_REPS_FRAUD`,
 * `MAE_DEFINITION`'s MAE path, `INTERIM_OPERATING`'s whole missing
 * `ioc_restriction_components` collection -- which is what made this a
 * reader-shape defect class rather than five unrelated ones).
 * `scripts/canonical-v2-reader-resolution-contract-check.js` is the actual
 * proof: it diffs every field of a committed run's real `resolution.json`
 * against this module's own read-back of the same deal, through
 * `canonicalJson` (never `JSON.stringify` -- Postgres `jsonb` reorders
 * object keys on output, and that already produced one false mismatch this
 * same day), and names every field that does not match. Two kinds of gap
 * came out of running it for real, and they are handled oppositely:
 *
 * 1. **`party` -- was silently dropped, now reconstructed, because it was
 *    genuinely available the whole time.** `resolution.json`'s top-level
 *    `party` on a `resolved[]` entry is, in every one of the 349 resolved
 *    entries in this project's committed Modiv corpus (checked directly,
 *    not sampled), byte-identical to `entry.provision_instance.party` --
 *    `null` for a partyless `STRUCTURAL_PROVISION_INSTANCE/V1`, the real
 *    `{role, value, capacity}` object for a party-bearing
 *    `PROVISION_INSTANCE/V1` (`source-structure.js`'s `buildProvisionInstance`
 *    always sets it; `buildStructuralProvisionInstance` never does). This
 *    module never set it at all before this fix -- `entry.party` came back
 *    `undefined`, which `consideration-wave-a-product-projection.js`'s
 *    `entry.party !== null` check (deliberately strict: a Wave A fact must
 *    not carry an obligation party) rejects where `null` would pass. Fixed
 *    by reconstructing it from `provision_instance.party` (`Object.hasOwn`,
 *    not `?.`, so a genuinely absent key reads as `null` rather than
 *    accidentally matching a provision that happens to carry
 *    `party: null` -- which never occurs today, but the check is cheap and
 *    correct either way).
 * 2. **`section_reference` -- was returned unconditionally `null`; now
 *    reconstructed from `claim.attributes.section_reference` wherever the
 *    claim kind's own attribute schema carries it, and stays `null`,
 *    honestly, where it does not.** The prior header claimed this field
 *    "does not round-trip, by construction" -- true of the TOP-LEVEL
 *    `CLAIM_REVISION_PAYLOAD_FIELDS` (no such key), false of what those
 *    fields actually contain: `attributes` IS one of
 *    `CLAIM_REVISION_PAYLOAD_FIELDS`, and for most claim kinds
 *    `attributes.section_reference` carries the exact same value (checked
 *    directly against the whole committed Modiv corpus: 218 of 263 resolved
 *    entries carry it inside `attributes`, and every single one of those
 *    218 matches `entry.section_reference` exactly -- zero mismatches).
 *    This was the prior investigation testing a claim ("neither schema lists
 *    it") without testing whether the field it named was nested one level
 *    deeper -- exactly the "test a claim, don't record it as fact" failure
 *    CLAUDE.md names. It is also, concretely, why `MAE_DEFINITION` could
 *    never render: `key-terms-mae-product-projection.js`'s
 *    `validMaeBinding` requires `attributes.section_reference ===
 *    entry.section_reference` verbatim (every MAE claim kind's own
 *    attribute schema REQUIRES `section_reference` to be present --
 *    `validateMaeAttributes`), so an always-`null` `entry.section_reference`
 *    could never equal it. Some claim kinds genuinely never carry it in
 *    `attributes` at all (confirmed empty, not merely unchecked: the six
 *    concepts `CHARTER_PROTECTION_CONTINUATION`, `COVERED_PERSON_TPB_RIGHTS`,
 *    `INDEMNIFICATION_CONTINUATION`, `MERGER_STRUCTURE_MECHANIC_PRESENT`,
 *    `MISC_BOILERPLATE_MECHANIC_PRESENT`,
 *    `NO_OTHER_REPRESENTATIONS_DISCLAIMER_PRESENT`,
 *    `SPECIFIC_PERFORMANCE_REMEDY_PRESENT`, plus the sole-remedy family's
 *    `SOLE_REMEDY_CARVEOUT_KIND`/`SOLE_REMEDY_LEGAL_EFFECT_PRESENT`) --
 *    those genuinely stay `null`, which is the honest answer, not a
 *    regression from the old always-`null` behaviour.
 *
 * Every field below is a genuine, checked "never in the write set", not an
 * assumption:
 *
 * - **`party_source_span`** -- a section-local byte span computed only at
 *   resolve time (`candidate-resolution.js`); not one of
 *   `CLAIM_REVISION_PAYLOAD_FIELDS`, not in either provision-instance
 *   payload shape (`source-structure.js`). Dropped before the write set, by
 *   construction.
 * - **`citation_context`, `governing_context_quote`, `generic_claim_key`,
 *   `compiled_candidate`, `triage`, top-level `source_citation`** -- all
 *   pipeline-only bookkeeping `candidate-resolution.js`'s `resolvedEntry`
 *   carries for its own resolution-quality auditing; none of them appear in
 *   `CLAIM_REVISION_PAYLOAD_FIELDS` and no committed row in
 *   `canonical_v2_staging` carries any of them. Zero consumers outside the
 *   native-producer pipeline itself (checked: grepped every
 *   `*-product-projection.js` and every `*serving*.js` in this project).
 * - **Open-world's `source_citation`, `extraction_provenance`,
 *   `citation_validation`, `answer_provenance`,
 *   `section_family_ai_unverified`** -- same shape of gap, on the open-world
 *   side: none of `buildOpenWorldWriteRows`'s `candidateBody`/
 *   `occurrenceBody` (`native-write-set-adapter.js`) carry them, so no
 *   `open_world_candidates`/`open_world_candidate_occurrences` row ever has
 *   them to read back.
 *
 * `RESOLVED_ENTRY_ALLOWLISTED_GAPS` and `OPEN_WORLD_ENTRY_ALLOWLISTED_GAPS`
 * below are exported so the contract-check script (and any future one) reads
 * this list rather than re-deriving or re-typing it -- the single place a
 * genuinely-new gap gets added, with its own reason, instead of silently
 * re-justified inline wherever it is next noticed.
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
 * **`readFlatOpenWorldEntriesForDeal` -- the SAME rows, reshaped flat
 * (PLAN.md Step 2D1 defect 5's `REPRESENTATIONS` instance).** Every
 * `*-product-projection.js` module that reads open-world data at all --
 * `representations-product-projection.js`'s `open_world_entries` param,
 * `key-terms-mae-product-projection.js`'s `open_world_entries` param, and
 * every `{resolution, deal_id}`-shaped module's `resolution.open_world` --
 * reads it FLAT, in `resolution.json`'s own `open_world[]` shape
 * (`entry.attributes`, `entry.reason`, `entry.section_reference` at the top
 * level), never the `{candidate, occurrence, evidenceReferences}` bundle
 * shape `readOpenWorldEvidenceForDeal` returns for
 * `open-world-evidence-serving.js`. Those are two different, real consumers
 * with two different, real shape contracts -- not a shape this module ever
 * got to pick once. `readFlatOpenWorldEntriesForDeal` builds the second
 * shape from the exact same bundles (no extra query), so both are available
 * without either consumer adapting: `section_reference`, `claim_definition_key`,
 * `reason`, `raw_value`, `canonical_value`, `attributes`, `closure_id` come
 * back real, from `candidate`/`occurrence`; `evidence` comes back as the
 * real `open_world_evidence_references` rows (a superset of
 * `resolution.json`'s own evidence-edge fields, missing only
 * `claim_evidence_id`/`schema_version`, which no consumer reads); the five
 * fields named in `OPEN_WORLD_ENTRY_ALLOWLISTED_GAPS` above come back
 * `null`, honestly, because they were never written. Exposed on
 * `readDealFromLocalCanonicalV2Staging`'s return as `open_world_entries`,
 * alongside the existing bundle-shaped `open_world` -- additive, so no
 * existing caller of `.open_world` (`termination-fee-serving-source.js`,
 * `open-world-evidence-serving.js`, this module's own proof scripts) sees
 * its shape change.
 *
 * **`readIocRestrictionComponentsForDeal` -- the missing collection (PLAN.md
 * Step 2D1 defect 5's `INTERIM_OPERATING` instance).**
 * `ioc-wave-a-product-projection.js`'s `projectIocWaveAClaims` takes
 * `ioc_restriction_components` as its own required, TOP-LEVEL input
 * (`{resolved_entries, ioc_restriction_components}`) -- a plain array of
 * `PROVISION_COMPONENT/V1` rows, looked up by `provision_component_id`, not
 * embedded per-entry. `resolution.json`'s own `ioc_restriction_components`
 * key is exactly that: every written `RESTRICTED_ACTION` component
 * (confirmed against `modiv-interim-operating-20260807-replay/resolution.json`
 * byte-for-byte). Before this fix, nothing in this module surfaced that
 * collection at all -- `readGovernedClaimsForDeal` fetches
 * `provision_components` internally (Step 2B3) but only to resolve a
 * claim's subject, and only embeds one component per entry
 * (`entry.provision_component`), never the whole collection a caller can
 * hand to `projectIocWaveAClaims` directly.
 * `readIocRestrictionComponentsForDeal` re-queries provisions and their
 * components (the same two-query shape `readGovernedClaimsForDeal` and
 * `readRelationshipsForDeal` already each independently issue -- consistent
 * with this file's existing pattern of each `read*ForDeal` function being
 * independently callable, not sharing a fetch), filtered to
 * `component_key === 'RESTRICTED_ACTION'` -- the provision-component table
 * is shared with other component kinds (e.g. `REPRESENTATION_LIMB`, minted
 * by the assertion-node adapter path in `native-write-set-adapter.js`), and
 * `resolution.json`'s own `ioc_restriction_components` key never mixes them
 * in, so this filter matches that, not merely today's corpus (which happens
 * to have only `RESTRICTED_ACTION` components written so far). Exposed on
 * `readDealFromLocalCanonicalV2Staging`'s return as
 * `ioc_restriction_components`, matching `resolution.json`'s own field name.
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

// PLAN.md Step 2D1 defect 5. The complete, checked list of `resolution.json`
// resolved-entry fields this module can never reconstruct, each with the
// reason -- see this module's header for how every one of these was
// verified, not assumed. A field belongs here only once it has been checked
// against CLAIM_REVISION_PAYLOAD_FIELDS / the provision-instance payload
// shapes and confirmed absent from both, not merely "not yet wired".
const RESOLVED_ENTRY_ALLOWLISTED_GAPS = Object.freeze({
  party_source_span: 'a section-local byte span computed only at resolve time (candidate-resolution.js); '
    + 'not one of CLAIM_REVISION_PAYLOAD_FIELDS, not in either provision-instance payload shape '
    + '(source-structure.js). Dropped before the write set, by construction.',
  citation_context: 'pipeline-only citation-validation bookkeeping (candidate-resolution.js); not part of '
    + 'CLAIM_REVISION_PAYLOAD_FIELDS or either provision-instance payload shape.',
  governing_context_quote: 'pipeline-only party-context bookkeeping (candidate-resolution.js); not part of '
    + 'CLAIM_REVISION_PAYLOAD_FIELDS or either provision-instance payload shape.',
  generic_claim_key: 'the producer-side generic key used before resolution to a governed claim_definition_key; '
    + 'not carried past resolution into any write-set row.',
  compiled_candidate: 'the full pre-resolution candidate + provenance envelope; excluded by construction '
    + '(CLAIM_REVISION_PAYLOAD_FIELDS is a closed field list that does not include it).',
  triage: 'auto-pass/gate bookkeeping for the M3 protocol; pipeline-only, never written to any table.',
  source_citation: "the resolver's published citation string (post citation-validation); not one of "
    + 'CLAIM_REVISION_PAYLOAD_FIELDS and not reconstructible from anything the claim/provision payload carries.',
  // section_reference is NOT listed here: it now reconstructs from
  // claim.attributes.section_reference wherever the claim kind's own
  // attribute schema carries it (see this module's header), and is only
  // conditionally null -- not a blanket gap this allowlist can name once.
});

// Same idea, for readFlatOpenWorldEntriesForDeal's flattened entries.
// buildOpenWorldWriteRows (native-write-set-adapter.js) is the single
// source checked against: none of these five appear in candidateBody or
// occurrenceBody, so no open_world_candidates/open_world_candidate_
// occurrences row ever carries them to read back.
const OPEN_WORLD_ENTRY_ALLOWLISTED_GAPS = Object.freeze({
  source_citation: 'the resolver\'s published citation string; never written to open_world_candidates '
    + 'or open_world_candidate_occurrences.',
  extraction_provenance: 'model/prompt/producer-receipt provenance; not one of the fields '
    + 'buildOpenWorldWriteRows carries into candidateBody/occurrenceBody.',
  citation_validation: 'pipeline-only citation-validation bookkeeping; not written.',
  answer_provenance: 'AI/mechanical provenance tag at the open-world entry\'s own top level; not written. '
    + '(A same-named key can appear INSIDE some claims\' attributes -- unrelated, and that copy round-trips '
    + 'fine since attributes is written verbatim.)',
  section_family_ai_unverified: 'pipeline-only flag; not written.',
});

// The claim_definition_keys whose own attribute schema never carries
// section_reference (confirmed empty against the whole committed Modiv
// corpus, not merely unchecked -- see this module's header). A
// section_reference mismatch is a genuine defect for any OTHER key; for
// these it is the honest, checked answer. Kept here, in code, rather than
// only in the header's prose, so a future claim kind added to this list (or
// removed from it because a producer starts carrying the field) is a
// one-line, reviewable diff instead of a header claim nobody re-verifies --
// the exact failure mode CLAUDE.md's "read the code, not the comment" rule
// exists to prevent.
const CLAIM_DEFINITION_KEYS_WITHOUT_ATTRIBUTES_SECTION_REFERENCE = Object.freeze(new Set([
  'CHARTER_PROTECTION_CONTINUATION',
  'COVERED_PERSON_TPB_RIGHTS',
  'INDEMNIFICATION_CONTINUATION',
  'MERGER_STRUCTURE_MECHANIC_PRESENT',
  'MISC_BOILERPLATE_MECHANIC_PRESENT',
  'NO_OTHER_REPRESENTATIONS_DISCLAIMER_PRESENT',
  'SPECIFIC_PERFORMANCE_REMEDY_PRESENT',
  'SOLE_REMEDY_CARVEOUT_KIND',
  'SOLE_REMEDY_LEGAL_EFFECT_PRESENT',
]));

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

// PLAN.md Step 2D1 defect 5. section_reference is inside claim.attributes
// for most claim kinds -- see this module's header for the full account and
// the exact claim kinds where it is genuinely absent.
function sectionReferenceFromClaimAttributes(claim) {
  const value = claim && claim.attributes ? claim.attributes.section_reference : undefined;
  return typeof value === 'string' && value.length > 0 ? value : null;
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
      // PLAN.md Step 2D1 defect 5. Reconstructed from claim.attributes.
      // section_reference wherever the claim kind's own attribute schema
      // carries it (verified against the whole committed Modiv corpus: 218
      // of 263 resolved entries carry it in attributes, zero mismatches
      // against their own resolution.json's top-level section_reference).
      // Genuinely null, honestly, for the claim kinds whose attributes never
      // carry it at all -- see this module's header for the exact list.
      // Present either way (not omitted) so callers see a real value or a
      // real gap, never a missing key silently changing shape.
      section_reference: sectionReferenceFromClaimAttributes(claim),
      resolved_claim_definition_key: claim.claim_definition_key,
      concept_key: provisionInstance.concept_key,
      // PLAN.md Step 2D1 defect 5 (the CONSIDERATION instance). Byte-
      // identical to entry.provision_instance.party in every one of the 349
      // resolved entries in this project's committed Modiv corpus (checked
      // directly): null for a partyless STRUCTURAL_PROVISION_INSTANCE/V1,
      // the real {role, value, capacity} object for a party-bearing
      // PROVISION_INSTANCE/V1. Object.hasOwn, not `?.` or `|| null`, so a
      // provision that genuinely carried `party: null` (never happens today,
      // per source-structure.js's buildProvisionInstance, but the check
      // should not rely on that) would still read back correctly.
      party: Object.hasOwn(provisionInstance, 'party') ? provisionInstance.party : null,
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

// PLAN.md Step 2D1 defect 5 (the REPRESENTATIONS instance). Reshapes one
// {candidate, occurrence, evidenceReferences} bundle into resolution.json's
// own flat open_world[] entry shape -- see this module's header for exactly
// which fields are real and which five are genuine, checked gaps.
function flattenOpenWorldBundle({ candidate, occurrence, evidenceReferences }) {
  return Object.freeze({
    section_reference: candidate.section_reference,
    claim_definition_key: candidate.attempted_claim_definition_key,
    reason: candidate.reason_code,
    raw_value: candidate.raw_value,
    canonical_value: candidate.canonical_value,
    attributes: occurrence.attributes,
    closure_id: candidate.closure_id,
    evidence: evidenceReferences,
    // OPEN_WORLD_ENTRY_ALLOWLISTED_GAPS -- never written, so never here.
    source_citation: null,
    extraction_provenance: null,
    citation_validation: null,
    answer_provenance: null,
    section_family_ai_unverified: null,
  });
}

// ── Open-world evidence, flat (PLAN.md Step 2D1 defect 5). The SAME rows
// readOpenWorldEvidenceForDeal reads (no extra query), reshaped into the
// flat resolution.json shape every *-product-projection.js module that
// reads open-world data actually expects (representations-product-
// projection.js's and key-terms-mae-product-projection.js's own
// open_world_entries param; every {resolution, deal_id}-shaped module's
// resolution.open_world) -- never the {candidate, occurrence,
// evidenceReferences} bundle shape, which is specific to open-world-
// evidence-serving.js's buildOpenWorldEvidenceCard. See this module's
// header for the full account of which shape which consumer needs and why
// both are exposed rather than one replacing the other.
async function readFlatOpenWorldEntriesForDeal({ client, documentHash }) {
  const bundles = await readOpenWorldEvidenceForDeal({ client, documentHash });
  return bundles.map(flattenOpenWorldBundle);
}

// ── Restricted-action provision components (PLAN.md Step 2D1 defect 5, the
// INTERIM_OPERATING instance). ioc-wave-a-product-projection.js's
// projectIocWaveAClaims takes ioc_restriction_components as its own
// required, TOP-LEVEL input -- a plain array of PROVISION_COMPONENT/V1 rows
// looked up by provision_component_id, not embedded per resolved entry.
// resolution.json's own ioc_restriction_components key is exactly every
// written RESTRICTED_ACTION component (verified against a real committed
// run -- see this module's header). Re-queries provisions and their
// components independently, the same two-query shape readGovernedClaimsForDeal
// and readRelationshipsForDeal each already issue on their own -- consistent
// with this file's existing pattern of each read*ForDeal function being
// independently callable, not sharing a fetch.
async function readIocRestrictionComponentsForDeal({ client, documentHash }) {
  requireClient(client);
  requireDocumentHash(documentHash);
  const q = createStagingQueryInterface(client);

  const provisions = await q.provisionInstancesByDocumentHash(documentHash);
  const provisionIds = provisions.map((row) => row.provision_instance_id);
  if (provisionIds.length === 0) return [];

  const components = await q.provisionComponentsByParentProvisionInstanceIds(provisionIds);
  // The provision_components table is shared with other component kinds
  // (e.g. REPRESENTATION_LIMB, native-write-set-adapter.js's assertion-node
  // path) -- filtered so this matches resolution.json's own
  // ioc_restriction_components field, which never mixes them in, not merely
  // today's corpus (which happens to have only RESTRICTED_ACTION components
  // written so far).
  return components.filter((row) => row.component_key === 'RESTRICTED_ACTION');
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
  // Reshapes of the two collections above (no extra query for the open-world
  // one; one extra provisions+components query for the IOC one, matching
  // this file's existing per-function independence -- see their own
  // comments). Not part of the emptiness guard below: both are strictly
  // derived from resolved/openWorld's own presence, never an independent
  // signal that this document_hash has data those two would have missed.
  const openWorldEntries = await readFlatOpenWorldEntriesForDeal({ client, documentHash });
  const iocRestrictionComponents = await readIocRestrictionComponentsForDeal({ client, documentHash });
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
    // PLAN.md Step 2D1 defect 5. Flat, resolution.json-shaped -- see this
    // module's header for why both this and `open_world` above are exposed.
    open_world_entries: Object.freeze(openWorldEntries),
    // PLAN.md Step 2D1 defect 5 (INTERIM_OPERATING). Matches resolution.json's
    // own field name and shape exactly.
    ioc_restriction_components: Object.freeze(iocRestrictionComponents),
    relationships: Object.freeze(relationships),
    conditional_termination_fee_values: Object.freeze(conditionalTerminationFeeValues),
  });
}

module.exports = {
  LocalStagingReadError,
  OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER,
  RESOLVED_ENTRY_ALLOWLISTED_GAPS,
  OPEN_WORLD_ENTRY_ALLOWLISTED_GAPS,
  CLAIM_DEFINITION_KEYS_WITHOUT_ATTRIBUTES_SECTION_REFERENCE,
  readGovernedClaimsForDeal,
  readOpenWorldEvidenceForDeal,
  readFlatOpenWorldEntriesForDeal,
  readIocRestrictionComponentsForDeal,
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
