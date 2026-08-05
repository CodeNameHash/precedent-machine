'use strict';

const PHASE1_BASE_COMMIT = '6c446b171537768a6560534ff6338e048b4eb7cc';

const PURE_PROPOSAL_SOURCES = Object.freeze([
  // Browser-only view state: a sessionStorage-backed toggle deciding whether
  // collapsed clause text is exposed to the browser's find-in-page. It reaches
  // none of the seven scanned capabilities. sessionStorage is not
  // filesystem_write: it is per-tab browser memory, discarded on close, never
  // touching the repository or any server. Classified here rather than under
  // PRODUCTION_PATH_PURE_ANALYSIS because that class additionally forbids any
  // module dependency, and this one imports React.
  'components/review-v2/clauseSearchMode.js',
  'components/review/table-configs/canonical-v2-preview-lane.js',
  // Filesystem-driven pages/api/** enumerator for the S2 auth-coverage test
  // (tests/auth-route-enforcement.test.js: a route "nobody remembered to
  // classify" is refused automatically). Capability-free, and -- unlike
  // every other file added for the S2 authentication layer -- genuinely not
  // live: its own header says it is "never imported by middleware.js or any
  // page; only by tests/auth-route-enforcement.test.js and, if regenerated,
  // docs/API-ROUTE-CLASSIFICATION.md's route list", independently confirmed
  // by grepping the whole tree for its only importers. That is what earns it
  // PURE_PROPOSAL rather than the new LIVE_REQUEST_AUTHORIZATION class below:
  // it is test/doc-support tooling FOR the live mechanism, not part of it.
  'lib/auth/route-scan.js',
  'lib/canonical-v2/antitrust-v1-surface-disposition.js',
  'lib/canonical-v2/bd837f1d-financing-source-open-world-pin.js',
  'lib/canonical-v2/certification-policy-manifest-proposal.js',
  'lib/canonical-v2/company-employee-definition-owner-routing.js',
  'lib/canonical-v2/content-reviewed-definition-reclassification-contract.js',
  'lib/canonical-v2/corpus-source-discovery-capture.js',
  'lib/canonical-v2/dark-bridge-gate.js',
  'lib/canonical-v2/dark-integration-preflight.js',
  'lib/canonical-v2/deal-identity-allocation-readiness.js',
  'lib/canonical-v2/deal-identity-persistence-controller-interface.js',
  'lib/canonical-v2/deal-identity-trusted-key-registry-proposal.js',
  'lib/canonical-v2/decision-reconciliation-proposal.js',
  'lib/canonical-v2/derived-comparison.js',
  'lib/canonical-v2/durable-artifact-root.js',
  'lib/canonical-v2/general-covenants-dark-bridge.js',
  'lib/canonical-v2/governed-identity-proposal-packet.js',
  'lib/canonical-v2/governed-identity-readiness-descriptor.js',
  'lib/canonical-v2/governed-identity-trust-contracts.js',
  'lib/canonical-v2/identity-consumer-closure-audit.js',
  'lib/canonical-v2/identity-human-review-projection.js',
  'lib/canonical-v2/legacy-card-bridge.js',
  'lib/canonical-v2/metsera-comprehensive-selection-review.js',
  'lib/canonical-v2/metsera-pilot-extension-proposal.js',
  'lib/canonical-v2/metsera-pilot-extension-readiness.js',
  'lib/canonical-v2/native-producer/durable-12-item-pilot-readiness.js',
  'lib/canonical-v2/native-producer/family-absence-coverage-attestation.js',
  'lib/canonical-v2/native-producer/family-detection-profiles.js',
  'lib/canonical-v2/native-producer/full-corpus-execution-manifest-planner.js',
  'lib/canonical-v2/native-producer/full-corpus-routing-prompt-cost-audit.js',
  'lib/canonical-v2/native-producer/ioc-mechanic-resolution.js',
  'lib/canonical-v2/native-producer/prompt-budget-split-preflight.js',
  'lib/canonical-v2/native-producer/replay-invalidation-planner.js',
  'lib/canonical-v2/native-producer/semantic-safety-preflight.js',
  'lib/canonical-v2/native-producer/sole-remedy-resolution.js',
  'lib/canonical-v2/native-producer/unified-prompt-budget-preflight.js',
  'lib/canonical-v2/neutral-defined-term-comparison-consumer.js',
  'lib/canonical-v2/no-other-reps-fraud-dark-bridge.js',
  'lib/canonical-v2/operational-policy-set-proposal.js',
  'lib/canonical-v2/policy-successor-m1-adoption-binding.js',
  'lib/canonical-v2/phase1-authority-boundary-inventory.js',
  // Content-based provision -> current-section attribution (span accounting
  // spec, Part 3 rollout gate 1). Deterministic, no LLM, capability-free.
  // Depends on ./span-claims so it cannot be PRODUCTION_PATH_PURE_ANALYSIS
  // (that class additionally requires a dependency-free leaf); used only by
  // its own test and by scripts/span-residual-baseline.js, an offline
  // analysis script -- never imported by a page or API route, so it is not
  // live product behaviour the way lib/parse-money.js below is.
  'lib/parser-v2/attribute-provision-section.js',
  'lib/query/dark-authority-fence.js',
  // The review-parity harness: it compares the legacy and Canonical V2 views of
  // a family and reports whether they say the same thing. It proposes a
  // verdict and changes nothing -- no database, no network, no writes. The two
  // CLI entry points that do write are classified as artefact writers below.
  'lib/review-parity/case-file.js',
  'lib/review-parity/compare.js',
  'lib/review-parity/mapping.js',
  'lib/review-parity/normalise.js',
  'lib/review-parity/report.js',
  'lib/review-parity/run.js',
  'lib/review-parity/views.js',
  'lib/canonical-v2/representations-dark-bridge.js',
  'lib/canonical-v2/review-preview-assembly.js',
  'lib/canonical-v2/routine-primary-source-disposition-policy.js',
  'lib/canonical-v2/source-intake-readiness.js',
  'lib/canonical-v2/source-verification-state.js',
  'lib/canonical-v2/source-exception-approval-contract.js',
  'lib/canonical-v2/source-universe-inventory-candidate.js',
  'lib/canonical-v2/source-universe-inventory-planner.js',
  // Same species as dark-bridge-gate.js, canonical-v2-preview-lane.js and
  // review-preview-assembly.js already in this list: env-gated preview/serving
  // machinery that is unreachable in production, reads files and hashes them,
  // and exercises none of the seven authority capabilities.
  'lib/canonical-v2/termination-fee-serving-source.js',
  'lib/canonical-v2/topbuild-legal-text-delta.js',
  'lib/canonical-v2/topbuild-ordinary-multi-occurrence-disposition-packet.js',
  'lib/canonical-v2/topbuild-section-delta-review-queue.js',
  'lib/canonical-v2/topbuild-two-occurrence-review-packet.js',
  'lib/canonical-v2/v1-capture-evidence-proposal.js',
  'lib/canonical-v2/v1-output-routing-reconciliation-audit.js',
  'lib/canonical-v2/v1-replay-evidence-proposal.js',
  'lib/canonical-v2/v1-trusted-capture-control-contracts.js',
  'lib/canonical-v2/v1-trusted-capture-readiness-descriptor.js',
  'scripts/canonical-v2-corpus-source-discovery-capture.js',
  'scripts/plan-v1-render-capture.js',
  'scripts/reprocess/v1-apply-guard.js',
]);

const LOCAL_ARTIFACT_WRITERS = Object.freeze([
  'lib/canonical-v2/metsera-comprehensive-selection-review-writer.js',
  'lib/canonical-v2/native-producer/full-corpus-routing-prompt-cost-audit-writer.js',
  'lib/canonical-v2/source-intake-readiness-writer.js',
  'scripts/reprocess/v1-apply-backup.js',
  'scripts/reprocess/v1-apply-receipt.js',
  'scripts/reprocess/v1-apply-sequence.js',
  // Writes the review-parity case fixtures under tests/fixtures/. Its V2 side
  // replays a committed provider response through the real producer chain --
  // the provider passed to runNativeExtraction is an inline pure function over
  // that fixture, so there is no model call, no network and no credential.
  'scripts/review-parity-build-cases.js',
  // Writes the parity report as canonical JSON. Reads only otherwise.
  'scripts/review-parity-check.js',
  // The ONLY thing that may ever write __fixtures__/canonical-v2/qxo-
  // termination-fee-reviewed-excerpts.generated.js (see that file's own
  // header). Reads the reviewed .txt, writes the generated module;
  // tests/qxo-termination-fee-excerpt-module.test.js fails the moment the
  // checked-in output stops matching what running this script right now
  // would produce, so drift from a hand-edit or a stale regen cannot pass
  // silently.
  'scripts/generate-qxo-termination-fee-excerpt-module.js',
  'scripts/write-current-source-intake-readiness.js',
  'scripts/write-full-corpus-routing-prompt-cost-audit.js',
  'scripts/write-governed-identity-proposal-packet.js',
  'scripts/write-topbuild-legal-text-delta.js',
  'scripts/write-topbuild-section-delta-review-queue.js',
  'scripts/write-topbuild-two-occurrence-review-packet.js',
]);

// Phase 1's fourth kind, and the first that is neither scaffolding nor
// governance machinery: pure decision logic that the PRODUCT path calls
// unconditionally. lib/agreement-revision-classifier.js decides whether an SEC
// exhibit is an original agreement, a restatement, an amendment or something a
// human must look at; lib/edgar-catalog.js requires it at module load and acts
// on its verdict during ingest, behind no environment gate.
//
// It is recorded separately rather than folded into PURE_PROPOSAL because this
// register's job is to say what Phase 1 put where. PURE_PROPOSAL is enforced as
// "exercises no authority capability" and already contains modules that live
// consumers call, but every one of those is proposal, preview or containment
// machinery. Filing live ingest logic beside them would let the register be
// read as "Phase 1 added no product behaviour", which is not true.
//
// The class is strictly harder to satisfy than PURE_PROPOSAL, not softer. Its
// members take the same full capability scan AND must declare no module
// dependencies at all: the capability scan is textual and per-file, so purity
// that rests on an import is purity the scan never checked. A leaf module that
// imports nothing cannot reach a capability transitively.
const PRODUCTION_PATH_PURE_ANALYSIS_SOURCES = Object.freeze([
  'lib/agreement-revision-classifier.js',
  // The one shared "parse a dollar amount out of a string" primitive
  // (2026-08-05 consolidation of six independent, inconsistent copies --
  // see that file's header for the full backstory and the live cross-
  // surface disagreement it closes). Called unconditionally from the live
  // review renderer (pages/review-v1/[id].js's parseDollarAmount) and the
  // live query engine (lib/query/derived-fields.js's parseUsdAmount) among
  // others, so it belongs beside agreement-revision-classifier.js, not in
  // PURE_PROPOSAL: this IS product behaviour, not scaffolding. Zero module
  // dependencies (pure string/regex/math, no require/import at all) and
  // zero of the seven capabilities.
  'lib/parse-money.js',
]);

const READ_ONLY_GIT_INSPECTORS = Object.freeze([
  'lib/canonical-v2/successor-m1-readiness-packet.js',
  'lib/canonical-v2/v1-render-capture-preflight.js',
]);

// Phase 1's fifth kind: a standalone, human-invoked script that drives one
// real LLM call end to end -- through the Claude Code subscription CLI, no
// ANTHROPIC_API_KEY, no metered billing -- against an already-admitted,
// already-committed source, and writes its receipts/telemetry/resolution/
// validation evidence to local output files. This is the same species as the
// F28/Modiv/Skechers live-extraction-run scripts already in scripts/ (all of
// them predate the Phase 1 base commit, which is the only reason none of
// them needed a class here before now): it exercises `provider` (a real
// model-call authority, not a proposal) and `external_process` (spawns the
// `claude` CLI) alongside `filesystem_write`, so it cannot honestly be
// PURE_PROPOSAL (which permits none of the seven capabilities) or
// LOCAL_ARTIFACT_WRITER (which permits filesystem_write alone). It never
// touches a database, never reaches the network live (it reuses committed
// HTML and asserts the pinned hash), never signs, and never deploys or
// activates anything.
const LIVE_EXTRACTION_RUN_SOURCES = Object.freeze([
  'scripts/canonical-v2-modiv-termination-fee-scope-correction-run.mjs',
]);

// Phase 1's sixth kind, and the first that is genuinely LIVE on every
// request rather than proposal, preview, containment, analysis, inspection
// or writer machinery: the session/credential mechanism behind S2
// (ROADMAP.md "put a login in front of the application") -- middleware.js's
// one enforcement point (lib/auth/gate.js), the cookie and HMAC-session
// primitives underneath it (lib/auth/cookies.js, lib/auth/session.js), the
// credential check and open-redirect guard beside it (lib/auth/
// credentials.js, lib/auth/safe-next-path.js), and the three API routes
// that wire them to the browser. It reads secrets from the environment
// (SESSION_SECRET, AUTH_PASSWORD) and makes the one security decision that
// gates the entire application: whether a given request proceeds.
//
// It cannot honestly be PURE_PROPOSAL -- that class means "not live", and
// this runs on every real request today -- even though, mechanically, none
// of these eight files trips the seven-capability scan (Web Crypto's
// `crypto.subtle.sign`/`.verify` is not Node's `crypto.sign`/`createSign`,
// which is what the scan's `signing` patterns actually match; see
// lib/auth/session.js's own header for why Web Crypto was required here).
// The class exists to record what these files ARE, not to describe what the
// mechanical scan happens to catch: same full scan as PURE_PROPOSAL, all
// seven capabilities forbidden -- this mechanism has no legitimate reason to
// touch a database, the network, a model provider, a signing primitive
// outside its own session HMAC, a deployment, a child process, or the
// filesystem -- but recorded as live, because it is.
const LIVE_REQUEST_AUTHORIZATION_SOURCES = Object.freeze([
  'lib/auth/cookies.js',
  'lib/auth/credentials.js',
  'lib/auth/gate.js',
  'lib/auth/safe-next-path.js',
  'lib/auth/session.js',
  'pages/api/auth/login.js',
  'pages/api/auth/logout.js',
  'pages/api/auth/session.js',
]);

// The one client-side member of the same live authorization surface: the
// login page itself, live on a real route the moment a session is missing
// (middleware.js redirects here). Same "genuinely live, not a proposal"
// reasoning as LIVE_REQUEST_AUTHORIZATION_SOURCES above, but this is a React
// page that calls its own same-origin /api/auth/session and /api/auth/login
// over a browser fetch to check for and establish a session -- the one
// capability (`network`) the rest of that group correctly forbids itself.
// Recorded as its own class, not folded into LIVE_REQUEST_AUTHORIZATION_SOURCES,
// so the mechanism's own files keep the tighter, zero-capability boundary:
// widening that boundary for all nine to accommodate this one page's own
// browser fetch calls would be a real loosening of what the session/
// credential mechanism itself is permitted to do.
const LIVE_REQUEST_AUTHORIZATION_CLIENT_SOURCES = Object.freeze([
  'pages/login.js',
]);

// Phase 1's seventh kind: a reviewed, tested REPAIR for a route the July
// security review graded critical, deliberately held dormant behind
// lib/broad-corpus-containment.js. The live pages/api/** file for each of
// these still resolves to createBroadCorpusContainedHandler(...) (503), and
// tests/broad-corpus-containment.test.js independently, mechanically proves
// each one imports nothing of theirs (exactly one require(), zero imports,
// and none of supabase/anthropic/createClient/process.env/fetch/readFile/
// `from(` appear in the live route source at all) -- un-containing these
// routes is separate, later work (ROADMAP.md "Do not... turn them on"); this
// register only has to account for what already exists on disk.
//
// That independent proof is what makes it honest to record real,
// capability-bearing code as still safe: unlike every class above, these
// four files are NOT capability-free -- three of the four obtain their own
// service-role Supabase client as their actual repaired functionality
// (users.js's is_admin self-grant fix, reprocess-cond.js's now-
// authenticated-by-the-global-gate destructive reprocess, from-url.js's
// SSRF-guarded re-ingest),
// so PURE_PROPOSAL would be false for them. They are also proven unreachable
// today, so LIVE_REQUEST_AUTHORIZATION's "this runs on every request"
// framing would be equally false. `database` is therefore the one capability
// this class permits; every other one of the seven stays forbidden even for
// held-dormant code -- from-url-fetch.js's SSRF-guarded fetch in particular
// must stay proven incapable of reaching anything beyond its sec.gov
// allowlist by means other than that allowlist itself.
const CONTAINED_ROUTE_REPAIR_SOURCES = Object.freeze([
  'lib/broad-corpus/contained-routes/from-url-fetch.js',
  'lib/broad-corpus/contained-routes/from-url.js',
  'lib/broad-corpus/contained-routes/reprocess-cond.js',
  'lib/broad-corpus/contained-routes/users.js',
]);

const REQUIRED_AUTHORITY_BOUNDARY_CONTRACT_SOURCES = Object.freeze({
  DARK_INTEGRATION_CURRENT_ENVIRONMENT_VERIFICATION: 'lib/canonical-v2/dark-integration-preflight.js',
  GOVERNED_IDENTITY_FROZEN_KEY_REGISTRY_AMENDMENT: 'lib/canonical-v2/governed-identity-trust-contracts.js',
  GOVERNED_IDENTITY_LITERAL_KEY_REGISTRY_PATCH: 'lib/canonical-v2/deal-identity-trusted-key-registry-proposal.js',
  SOURCE_INTAKE_TRUSTED_AUTHORITY_VERIFIER: 'lib/canonical-v2/source-intake-readiness.js',
  SUCCESSOR_M1_TRUSTED_CONTROLLER_VERIFICATION: 'lib/canonical-v2/native-producer/durable-12-item-pilot-readiness.js',
});

const EXPLICIT_NEW_SOURCE_CLASSES = Object.freeze({
  PURE_PROPOSAL: PURE_PROPOSAL_SOURCES,
  LOCAL_ARTIFACT_WRITER: LOCAL_ARTIFACT_WRITERS,
  READ_ONLY_GIT_INSPECTOR: READ_ONLY_GIT_INSPECTORS,
  PRODUCTION_PATH_PURE_ANALYSIS: PRODUCTION_PATH_PURE_ANALYSIS_SOURCES,
  LIVE_EXTRACTION_RUN: LIVE_EXTRACTION_RUN_SOURCES,
  LIVE_REQUEST_AUTHORIZATION: LIVE_REQUEST_AUTHORIZATION_SOURCES,
  LIVE_REQUEST_AUTHORIZATION_CLIENT: LIVE_REQUEST_AUTHORIZATION_CLIENT_SOURCES,
  CONTAINED_ROUTE_REPAIR: CONTAINED_ROUTE_REPAIR_SOURCES,
});

function classifyChangedProductionSources({
  changedSources,
  existedAtBase,
  explicitClasses = EXPLICIT_NEW_SOURCE_CLASSES,
}) {
  if (!Array.isArray(changedSources) || typeof existedAtBase !== 'function') {
    throw new TypeError('changedSources and existedAtBase are required.');
  }
  const changed = [...new Set(changedSources)].sort();
  const changedSet = new Set(changed);
  const assignments = new Map(changed.map((relativePath) => [relativePath, []]));
  for (const [classification, paths] of Object.entries(explicitClasses)) {
    if (!Array.isArray(paths)) throw new TypeError(`${classification} must be an array.`);
    for (const relativePath of paths) {
      if (!changedSet.has(relativePath)) throw new Error(`CLASSIFIED_SOURCE_NOT_CHANGED: ${relativePath}`);
      if (existedAtBase(relativePath)) throw new Error(`PREEXISTING_SOURCE_EXPLICITLY_CLASSIFIED: ${relativePath}`);
      assignments.get(relativePath).push(classification);
    }
  }
  for (const relativePath of changed) {
    if (existedAtBase(relativePath)) assignments.get(relativePath).push('MODIFIED_PREEXISTING');
    const classes = assignments.get(relativePath);
    if (classes.length !== 1) {
      throw new Error(`${classes.length === 0 ? 'UNCLASSIFIED_CHANGED_SOURCE' : 'MULTIPLY_CLASSIFIED_CHANGED_SOURCE'}: ${relativePath}`);
    }
  }
  return Object.freeze(changed.map((relativePath) => Object.freeze({
    path: relativePath,
    classification: assignments.get(relativePath)[0],
  })));
}

module.exports = {
  PHASE1_BASE_COMMIT,
  PURE_PROPOSAL_SOURCES,
  LOCAL_ARTIFACT_WRITERS,
  READ_ONLY_GIT_INSPECTORS,
  PRODUCTION_PATH_PURE_ANALYSIS_SOURCES,
  LIVE_EXTRACTION_RUN_SOURCES,
  LIVE_REQUEST_AUTHORIZATION_SOURCES,
  LIVE_REQUEST_AUTHORIZATION_CLIENT_SOURCES,
  CONTAINED_ROUTE_REPAIR_SOURCES,
  EXPLICIT_NEW_SOURCE_CLASSES,
  REQUIRED_AUTHORITY_BOUNDARY_CONTRACT_SOURCES,
  classifyChangedProductionSources,
};
