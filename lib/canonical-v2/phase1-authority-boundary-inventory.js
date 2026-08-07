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
  // Reads an extraction run's evidence directory, re-validates its write-set
  // against the current contract, and hands it to the canonical writer
  // (PLAN.md Step 2B write half). Filesystem READS only -- it writes nothing
  // itself; the repository it is handed owns any persistence, and the caller
  // supplies it. Defaults to dryRun so calling it without thinking does not
  // write.
  'lib/canonical-v2/evidence-to-write-set-bridge.js',
  'lib/canonical-v2/identity-consumer-closure-audit.js',
  'lib/canonical-v2/identity-human-review-projection.js',
  'lib/canonical-v2/legacy-card-bridge.js',
  'lib/canonical-v2/metsera-comprehensive-selection-review.js',
  'lib/canonical-v2/metsera-pilot-extension-proposal.js',
  'lib/canonical-v2/metsera-pilot-extension-readiness.js',
  'lib/canonical-v2/native-producer/durable-12-item-pilot-readiness.js',
  'lib/canonical-v2/native-producer/family-absence-coverage-attestation.js',
  'lib/canonical-v2/native-producer/family-detection-profiles.js',
  // Derives a family -> [section_reference] proposal for a document by
  // sectionizing it and running the stage-1 deterministic classifier over
  // the dispatchable nodes (PLAN.md Step 2A). Reads only: no filesystem
  // write, no database, no network, no model call. Its output is a proposal
  // for a human to review before anything is pinned, which is what earns
  // PURE_PROPOSAL. Cannot be PRODUCTION_PATH_PURE_ANALYSIS because that
  // class forbids module dependencies and this imports four. Same class as
  // full-corpus-routing-prompt-cost-audit.js below, which does the same
  // composition for a fixed audit cohort and is this module's precedent.
  'lib/canonical-v2/native-producer/family-section-ref-generator.js',
  'lib/canonical-v2/native-producer/full-corpus-execution-manifest-planner.js',
  'lib/canonical-v2/native-producer/full-corpus-routing-prompt-cost-audit.js',
  'lib/canonical-v2/native-producer/ioc-mechanic-resolution.js',
  // Record/replay wrappers around an Anthropic client, so an extraction run
  // can be re-scored against fixed model output instead of a fresh sample
  // (PLAN.md Stage 2's blocking prerequisite; Ben ruled 2026-08-06 for a
  // replay path over a tolerance policy). No filesystem access of its own --
  // the recorder hands the finished recording to a caller-supplied sink, and
  // the replayer is given a parsed recording, so the writing stays with the
  // script that owns it. It wraps a client the caller already holds; it
  // never constructs one and never reads a credential.
  'lib/canonical-v2/native-producer/provider-record-replay.js',
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
  'lib/canonical-v2/v1-replay-evidence-proposal.js',
  'lib/canonical-v2/v1-trusted-capture-control-contracts.js',
  'lib/canonical-v2/v1-trusted-capture-readiness-descriptor.js',
  'scripts/canonical-v2-corpus-source-discovery-capture.js',
  // Offline analysis harness for the citation-scope design question
  // (docs/codex-program/notes/citation-scope-design.md): reproduces the
  // committed source-admission pipeline against the already-committed raw
  // HTML fixture and the deterministic sectionizer, and reads three
  // already-committed recorded-response fixtures. No writeFileSync
  // anywhere in the file; no live network fetch (the capture step reuses
  // local bytes and re-verifies the pinned hash, the same "no live fetch"
  // shape the live run script's own Step 1 already uses); no model call;
  // no child_process. Reports findings to stdout only -- same species as
  // lib/review-parity/report.js above (proposes/reports, changes nothing).
  'scripts/canonical-v2-citation-scope-resolution-harness.mjs',
  'scripts/plan-v1-render-capture.js',
  'scripts/reprocess/v1-apply-guard.js',
  // Citation-following implementation (docs/codex-program/notes/citation-
  // scope-design.md Part 6; docs/codex-program/notes/citation-following-
  // implementation.md), same species as sole-remedy-resolution.js and
  // ioc-mechanic-resolution.js already in this list: deterministic quote
  // classification (bare-citation-trigger-parser.js has zero dependencies
  // at all) and dispatch orchestration (native-extraction-run-citation-
  // followup.js composes runNativeExtraction -- itself PRODUCTION_PATH_
  // PURE_ANALYSIS-adjacent proposal machinery, not a live capability --
  // and the deterministic sectionizer). Neither performs a live model call
  // itself, writes a file, opens a network connection, signs anything,
  // spawns a process, or touches a database; both propose candidates and
  // a merged run receipt for a caller to act on, exactly like every other
  // resolver-support module in this list.
  'lib/canonical-v2/native-producer/bare-citation-trigger-parser.js',
  'lib/canonical-v2/native-producer/native-extraction-run-citation-followup.js',
  // MAE clause_label verification (docs/codex-program/notes/mae-clause-
  // label.md): same species as bare-citation-trigger-parser.js immediately
  // above -- deterministic string-position logic (zero dependencies, zero
  // requires at all) that candidate-resolution.js calls to decide whether a
  // clause_label/prong_label genuinely denotes a candidate's own quote,
  // before that candidate is allowed to resolve. It never reads a file,
  // calls a model, opens a network connection, signs anything, spawns a
  // process, or touches a database; it proposes a verification verdict for
  // the resolver to act on, exactly like every other resolver-support
  // module in this list.
  'lib/canonical-v2/native-producer/mae-clause-label-parse.js',
]);

// A PURE_PROPOSAL file in every respect but one. Validating a *proposed*
// future evidence-acceptance contract requires checking that a submitted
// collector signature actually verifies -- crypto.createPublicKey and
// crypto.verify, over a public key and a signature that both arrive as
// plain function arguments (validateCollectorAuthority,
// verifyCaptureSignature), never anything this module holds, generates, or
// reads from the environment itself. It never calls crypto.sign,
// crypto.createPrivateKey or crypto.createSign -- it consumes a signature,
// it never produces one -- and both collectEvidenceRecords() and
// validateV1RenderedSurfaceArtifactSet() fail closed unconditionally today
// (TRUSTED_V1_CAPTURE_AND_REPLAY_EXECUTOR_NOT_IMPLEMENTED /
// STATIC_EVIDENCE_INCOMPLETE), so there is no live path through this module
// yet -- the same "proposes and changes nothing" shape as every other
// PURE_PROPOSAL file. Recorded as its own class rather than widening
// PURE_FORBIDDEN_CAPABILITIES for the whole ~80-file PURE_PROPOSAL group,
// which would hand every one of those files an unreviewed signing allowance
// none of them asked for or need. Permits exactly `signing`; every other
// one of the seven stays forbidden, and the test independently proves the
// verify-only shape -- no crypto.sign/createPrivateKey/createSign anywhere
// in the source -- not just the bare capability name.
const PURE_PROPOSAL_SIGNATURE_VERIFICATION_SOURCES = Object.freeze([
  'lib/canonical-v2/v1-output-routing-reconciliation-audit.js',
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
  // Writes a family -> [section_reference] PROPOSAL as JSON under
  // docs/codex-program/notes/ (PLAN.md Step 2A). Reads a committed raw HTML
  // fixture, rebuilds canonical text from it, and refuses to proceed unless
  // the resulting sha256 matches the pinned one -- so it cannot generate a
  // map from bytes that are not the admitted source. No model call, no
  // network, no database, no credential. The library it drives
  // (lib/canonical-v2/native-producer/family-section-ref-generator.js) is
  // PURE_PROPOSAL; this script is the writer around it, which is the same
  // split as full-corpus-routing-prompt-cost-audit.js and its -writer.js.
  'scripts/canonical-v2-generate-family-section-refs.mjs',
  // The ONLY thing that may ever write __fixtures__/canonical-v2/qxo-
  // termination-fee-reviewed-excerpts.generated.js (see that file's own
  // header). Reads the reviewed .txt, writes the generated module;
  // tests/qxo-termination-fee-excerpt-module.test.js fails the moment the
  // checked-in output stops matching what running this script right now
  // would produce, so drift from a hand-edit or a stale regen cannot pass
  // silently.
  'scripts/generate-qxo-termination-fee-excerpt-module.js',
  // Same species as generate-qxo-termination-fee-excerpt-module.js
  // immediately above: reads source files under lib/ and components/ (no
  // database, no network, no model call, no child process, no signing) and
  // writes exactly one generated artefact, docs/codex-program/generated/
  // system-inventory.json. tests/codex-program-generated-docs.test.js
  // fails the moment the checked-in output stops matching what running
  // this script right now would produce, the same drift guard as its
  // sibling above.
  'scripts/generate-codebase-inventory.js',
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
  // Negation-boundary guard (docs/codex-program/notes/negation-reversal.md):
  // decides whether the text immediately governing a candidate quote's
  // start carries a negation ("would not", "in no event", a closed "no
  // <noun>" list, ...) the quote itself does not include -- the check that
  // closes the "have a Company Material Adverse Effect" cut out of "...
  // would not have a Company Material Adverse Effect..." class of defect.
  // Called unconditionally, behind no environment gate, from
  // lib/verification.js's quoteAppearsIn/sanitizeFeatureQuotes, which
  // lib/parser-v2/store.js calls at real ingestion to decide which quotes
  // survive into the stored feature bag -- live product behaviour, the same
  // shape as lib/parse-money.js and lib/agreement-revision-classifier.js
  // immediately above, not proposal/preview scaffolding. Zero module
  // dependencies (pure string/regex logic, no require/import at all) and
  // zero of the seven capabilities.
  'lib/negation-boundary-guard.js',
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
//
// Renamed from `canonical-v2-modiv-termination-fee-scope-correction-run.mjs`
// to `canonical-v2-live-extraction-run.mjs` (2026-08-06). The script was
// generalised to run any of the 25 registered families against any deal
// pinned in its own `DEAL_PINS` table well before this rename; the old name,
// describing one scope correction for one deal and one family, was left in
// place at generalisation time specifically to avoid re-touching this
// classification. That was the wrong trade -- it was then run against all 25
// families under a name that still claimed a single one-off correction,
// which is a provenance problem, not a cosmetic one. The rename is the
// correction; this entry's classification is not, because generalising
// which family or deal a run targets never changed what the script is
// capable of doing. It is still exactly `provider` + `external_process` +
// `filesystem_write`, nothing more, both before and after.
const LIVE_EXTRACTION_RUN_SOURCES = Object.freeze([
  'scripts/canonical-v2-live-extraction-run.mjs',
]);

// Phase 1's sixth kind, and the first that is genuinely LIVE on every
// request rather than proposal, preview, containment, analysis, inspection
// or writer machinery: the session/credential mechanism behind S2
// (ROADMAP.md "put a login in front of the application") -- middleware.js's
// one enforcement point (lib/auth/gate.js), the cookie primitive underneath
// it (lib/auth/cookies.js), the credential check and open-redirect guard
// beside it (lib/auth/credentials.js, lib/auth/safe-next-path.js), and the
// three API routes that wire them to the browser. It reads secrets from the
// environment (SESSION_SECRET, AUTH_PASSWORD) and makes the one security
// decision that gates the entire application: whether a given request
// proceeds.
//
// It cannot honestly be PURE_PROPOSAL -- that class means "not live", and
// this runs on every real request today. Same full scan as PURE_PROPOSAL,
// all seven capabilities forbidden -- this mechanism has no legitimate
// reason to touch a database, the network, a model provider, a signing
// primitive, a deployment, a child process, or the filesystem -- but
// recorded as live, because it is.
//
// The session-token HMAC itself (lib/auth/session.js) is deliberately NOT
// in this array; see LIVE_REQUEST_AUTHORIZATION_SESSION_SOURCES below. The
// 2026-08-05 AST rewrite of the capability scan (tests/canonical-v2-
// phase1-authority-boundary.test.js) closed the exact gap an earlier
// version of this comment relied on: the scan now resolves
// `getSubtle().sign(...)`/`.verify(...)` back to Web Crypto's
// `crypto.subtle`, so session.js's own HMAC correctly registers as
// `signing`. That is not a false positive to explain away -- signing the
// session token really is what the file exists to do -- so it gets its own
// narrower class with `signing` permitted, instead of widening this
// array's all-seven-forbidden boundary, which would hand gate.js,
// credentials.js, cookies.js and safe-next-path.js a signing allowance none
// of them need or has been reviewed for.
const LIVE_REQUEST_AUTHORIZATION_SOURCES = Object.freeze([
  'lib/auth/cookies.js',
  'lib/auth/credentials.js',
  'lib/auth/gate.js',
  'lib/auth/safe-next-path.js',
  'pages/api/auth/login.js',
  'pages/api/auth/logout.js',
  'pages/api/auth/session.js',
]);

// The one member of the session/credential mechanism (see the class comment
// above) that must itself sign and verify: the session-token HMAC
// everything else in that class depends on. Web Crypto's
// `crypto.subtle.sign`/`.verify`, reached through this file's own
// `getSubtle()` wrapper -- HMAC-SHA256 only, over the session claims,
// nothing else (see lib/auth/session.js's own header for why Web Crypto
// specifically: it is the one crypto surface both the Next.js Edge runtime
// and the Node API routes implement identically). Recorded as its own
// class rather than widening LIVE_REQUEST_AUTHORIZATION_FORBIDDEN_
// CAPABILITIES for the whole group -- the same reasoning as
// LIVE_REQUEST_AUTHORIZATION_CLIENT_SOURCES below, singled out rather than
// folded in so the rest of the mechanism keeps its tighter, zero-capability
// boundary. Permits exactly `signing`; every other one of the seven stays
// forbidden. The test enforces the narrower shape the class comment
// claims, not just the bare capability name: this file must never require
// Node's `crypto` module, which is the only way to reach
// `crypto.sign`/`createSign`/`createPrivateKey`/`createVerify` -- none of
// which Web Crypto's ambient `crypto.subtle` exposes.
const LIVE_REQUEST_AUTHORIZATION_SESSION_SOURCES = Object.freeze([
  'lib/auth/session.js',
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
// files are NOT capability-free -- users.js's is_admin self-grant fix and
// reprocess-cond.js's now-authenticated-by-the-global-gate destructive
// reprocess each obtain their own service-role Supabase client as their
// actual repaired functionality, and from-url.js does too, on top of
// driving the SSRF-guarded fetch (see
// CONTAINED_ROUTE_REPAIR_GUARDED_FETCH_SOURCES below for that fetch
// itself) -- so PURE_PROPOSAL would be false for all three. They are also
// proven unreachable today, so LIVE_REQUEST_AUTHORIZATION's "this runs on
// every request" framing would be equally false. `database` is therefore
// the one capability this class permits; every other one of the seven
// stays forbidden even for held-dormant code.
const CONTAINED_ROUTE_REPAIR_SOURCES = Object.freeze([
  'lib/broad-corpus/contained-routes/from-url.js',
  'lib/broad-corpus/contained-routes/reprocess-cond.js',
  'lib/broad-corpus/contained-routes/users.js',
]);

// The SSRF-guarded fetch that from-url.js (above) drives, split into its
// own class rather than widening CONTAINED_ROUTE_REPAIR_FORBIDDEN_
// CAPABILITIES: this is the one route-repair file whose repaired
// functionality IS reaching the network, and it never obtains a Supabase
// client at all -- `database` would be unjustified slack here, not a
// needed permission, so this class permits `network` alone rather than
// inheriting the sibling class's `database` allowance. fetchUrl()
// restricts every request, including every redirect hop it follows, to
// https://sec.gov and https://*.sec.gov (see this file's own header for
// the SSRF finding it repairs); the test drives the real exported
// isAllowedIngestUrl guard against a battery of adversarial hosts to prove
// that, rather than trusting the capability name alone.
const CONTAINED_ROUTE_REPAIR_GUARDED_FETCH_SOURCES = Object.freeze([
  'lib/broad-corpus/contained-routes/from-url-fetch.js',
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
  PURE_PROPOSAL_SIGNATURE_VERIFICATION: PURE_PROPOSAL_SIGNATURE_VERIFICATION_SOURCES,
  LOCAL_ARTIFACT_WRITER: LOCAL_ARTIFACT_WRITERS,
  READ_ONLY_GIT_INSPECTOR: READ_ONLY_GIT_INSPECTORS,
  PRODUCTION_PATH_PURE_ANALYSIS: PRODUCTION_PATH_PURE_ANALYSIS_SOURCES,
  LIVE_EXTRACTION_RUN: LIVE_EXTRACTION_RUN_SOURCES,
  LIVE_REQUEST_AUTHORIZATION: LIVE_REQUEST_AUTHORIZATION_SOURCES,
  LIVE_REQUEST_AUTHORIZATION_SESSION: LIVE_REQUEST_AUTHORIZATION_SESSION_SOURCES,
  LIVE_REQUEST_AUTHORIZATION_CLIENT: LIVE_REQUEST_AUTHORIZATION_CLIENT_SOURCES,
  CONTAINED_ROUTE_REPAIR: CONTAINED_ROUTE_REPAIR_SOURCES,
  CONTAINED_ROUTE_REPAIR_GUARDED_FETCH: CONTAINED_ROUTE_REPAIR_GUARDED_FETCH_SOURCES,
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
  PURE_PROPOSAL_SIGNATURE_VERIFICATION_SOURCES,
  LOCAL_ARTIFACT_WRITERS,
  READ_ONLY_GIT_INSPECTORS,
  PRODUCTION_PATH_PURE_ANALYSIS_SOURCES,
  LIVE_EXTRACTION_RUN_SOURCES,
  LIVE_REQUEST_AUTHORIZATION_SOURCES,
  LIVE_REQUEST_AUTHORIZATION_SESSION_SOURCES,
  LIVE_REQUEST_AUTHORIZATION_CLIENT_SOURCES,
  CONTAINED_ROUTE_REPAIR_SOURCES,
  CONTAINED_ROUTE_REPAIR_GUARDED_FETCH_SOURCES,
  EXPLICIT_NEW_SOURCE_CLASSES,
  REQUIRED_AUTHORITY_BOUNDARY_CONTRACT_SOURCES,
  classifyChangedProductionSources,
};
