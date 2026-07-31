# P9 gate acceptance definitions (proposal)

Status: **proposal for review, not adopted**. `docs/codex-program/programme-gates.yaml`
is governed; nothing here has been written into it. Adopting any definition
below into the registry is a separate, deliberate step (edit the YAML, run
`tests/programme-gates/governing-registry.spec.js` and the drift tests, get
review).

Scope: the 22 gates under `preproduction_gates` in `programme-gates.yaml`
whose id begins `P9_`, in the registry's own order (lines 140-188 of that
file). `P9_DEPLOYMENT_PARITY` already carries an `acceptance:` block in the
YAML; it is included here for completeness and cross-check, not because it
was undefined.

Method: for each gate I searched `docs/codex-program/canonical-contracts.md`
(14,608 lines), `docs/codex-program/adversarial-tests.md` (3,180 lines),
`docs/CODEX-PROGRAM.md`, `lib/programme-gates/governing-registry.js`, the
`docs/handoffs/` notes and `docs/codex-program/EXECUTION-LEDGER.md` for the
gate's exact ID string and for its component keywords. Grep counts and
quotes are reported gate-by-gate. Where a gate ID does not appear anywhere
outside the registry itself, I say so plainly and mark the definition LOW
confidence — it is a proposal from the gate name alone, not a recovery of an
existing spec.

## Headline finding that shapes every gate below

`docs/CODEX-PROGRAM.md` §"Phase 9: Candidate certification and production
release" and `canonical-contracts.md` §"Phase 9 release and traceability
contracts" describe an entirely unbuilt 25-step certification chain
(`CandidateReleaseManifest` → `ReleaseBundleEnvelope` → checkpointed
production import → `DeploymentParityAttestation` → atomic activation →
post-cutover smoke). As of this writing:

- The native v2 extractor exists as of this week (`lib/canonical-v2/native-producer/*`)
  and has never run at corpus scale — only fixture/pilot runs (QXO F28, one
  Metsera passage) with hand-authored or single-source inputs.
- The corpus is ~40 v1-ingested deals. Canonical v2 has zero corpus-scale
  rows; the only v2 writes are inside rollback transactions in isolated
  staging (`EXECUTION-LEDGER.md` "Generic Agreement writer staging proof",
  "Product query cache staging proof").
- Production authority is `NONE` everywhere (`EXECUTION-LEDGER.md`, M1
  acknowledgement bundle approval row).
- None of `CandidateReleaseManifest`, `ReleaseBundleEnvelope`,
  `ProductionImportAttestation`, `DeploymentParityAttestation`,
  `PostActivationControlHead`, or the `GeneratedLockPlanRegistry` exist as
  code in `lib/`. They are prose contracts only.

So for the gates in the P10/P11 half of this list (import, promotion,
cutover, post-cutover smoke, deployment parity, traceability), "grounded in
what this repository can actually check" mostly means: **there is nothing to
mechanically check yet, and the honest acceptance definition says what must
be built first.** I have not invented mechanisms to paper over that gap.

---

## Summary table

| # | Gate | Confidence | needs_ben | Buildable today |
| - | --- | --- | --- | --- |
| 1 | `P9_SCOPE_EXACT` | LOW | yes | Partial — scope-freeze primitives exist; "exact" predicate does not |
| 2 | `P9_REGISTRY_DISPOSITIONS` | LOW | no | Partial — registries exist; disposition-completeness check does not |
| 3 | `P9_MKT_WORK` | LOW | yes | No — market-statistics containment is real but P9 scope (corpus-wide stats) has no corpus |
| 4 | `P9_BEN_RUNBOOK` | LOW | yes | No — no runbook artefact exists |
| 5 | `P9_NUMERIC` | LOW | yes | No — no numeric/unit verification harness exists at corpus scale |
| 6 | `P9_RENDER_PARITY` | LOW | no | Partial — legacy M2 parity report exists but is explicitly not P9 evidence (per audit note) |
| 7 | `P9_STRUCTURED_CLAIMS` | LOW | yes | No — no structured-claim conformance checker exists |
| 8 | `P9_PARTY_LINT` | LOW | yes | No — no party/entity-class lint exists |
| 9 | `P9_SHADOW_REEXTRACTION` | MEDIUM | yes | No — referenced once in canonical-contracts, mechanism unbuilt |
| 10 | `P9_IDENTITY_AND_DRIFT` | LOW | no | Partial — identity-stability tests exist per-module; corpus-wide drift check does not |
| 11 | `P9_BROWSER_A11Y_PERFORMANCE` | MEDIUM | yes (thresholds) | Partial — one browser-acceptance/perf test exists for one pilot; no a11y suite, no corpus-scale budget |
| 12 | `P9_STAGING_SMOKE_AND_ROLLBACK` | LOW | no | Partial — staging rollback proofs exist per-slice; no consolidated smoke suite |
| 13 | `P9_DATABASE_SOAK` | MEDIUM | yes (thresholds) | No — soak harness and fixture manifest do not exist |
| 14 | `P9_BACKUP_RESTORE` | LOW | no | No — no backup/restore drill or tooling exists |
| 15 | `P9_PREIMPORT_TRACEABILITY` | MEDIUM | no | No — traceability matrix generator does not exist |
| 16 | `P9_DEPLOYMENT_PARITY` | HIGH (already defined) | no | No — dependency chain (import, release) unbuilt; this is the one gate the registry already specifies |
| 17 | `P9_IMPORT_PARITY` | MEDIUM | no | No — production import machinery does not exist |
| 18 | `P9_PROMOTION_ELIGIBILITY` | MEDIUM | no | No — depends on `CandidatePromotionFence`/status generation machinery, unbuilt |
| 19 | `P9_CUTOVER_AUTHORISATION` | MEDIUM | yes (one-use) | No — `CutoverAuthorisation` object and controller unbuilt |
| 20 | `P9_POSTCUTOVER_SMOKE` | LOW | no | No — no production to smoke-test |
| 21 | `P9_TRACEABILITY` | MEDIUM | no | No — traceability matrix generator does not exist |
| 22 | `P9_SECURITY_AUTH` | LOW | yes | **Questionable — probably misplaced.** Duplicate of `phase_12_security_gates.P9_SECURITY_AUTH`, which is `DEFERRED_POST_CUTOVER`. Not a P9 dependency. |

Confidence counts: **HIGH 1** (the gate that already had a definition),
**MEDIUM 8**, **LOW 13**.
`needs_ben`: **11 of 22** gates embed a judgment call that must not be made
unilaterally by engineering (thresholds, quality bars, taxonomy scope, or
authorisation).

---

## Gates flagged as questionable or obsolete (read first)

1. **`P9_SECURITY_AUTH` appears twice in the governing surface** — once
   inside `preproduction_gates` (line ~207 in the flat list referenced by
   `governing-registry.js`'s `EXPECTED_GATE_IDS`) and once inside
   `phase_12_security_gates` in `programme-gates.yaml` (lines 202-222),
   where it is explicitly `DEFERRED_POST_CUTOVER` and `blocks_cutover:
   false`. `programme-gates.yaml` v2's `preproduction_gates` list (lines
   126-188) does **not** actually contain a `P9_SECURITY_AUTH` entry — only
   `lib/programme-gates/governing-registry.js`'s `EXPECTED_GATE_IDS` array
   does, and that module targets schema `canonical-programme-gates/v1`
   with a flat 35-gate array, while the live YAML declares schema
   `canonical-programme-gates/v2` with a nested structure and no such flat
   array. **These two are out of sync**: the governing-registry module
   would reject the current YAML as invalid if actually invoked against it
   (`sourceRegistry.schema !== 'canonical-programme-gates/v1'` and
   `sourceRegistry.gates.length !== 35` both fail against the real file).
   No test in the repo currently exercises `createGoverningRegistryAuthority`
   against the real file (`tests/programme-gates/governing-registry.spec.js`
   reads the YAML directly with the `yaml` package, not through
   `governing-registry.js`), so this drift is latent, not caught by CI.
   This is worth Ben's attention independent of the P9 acceptance work: the
   module is either dead code or a v1-schema relic that will throw the
   moment something tries to load it.
2. **`P9_MKT_WORK`, `P9_NUMERIC`, `P9_STRUCTURED_CLAIMS`, `P9_PARTY_LINT`,
   `P9_SHADOW_REEXTRACTION`, `P9_IDENTITY_AND_DRIFT` all presuppose a
   corpus of canonical v2 candidates to certify.** There is no such corpus.
   `EXECUTION-LEDGER.md`'s M3 basis decision (2026-07-31) states plainly:
   "canonical v2 proves validation, identity, relationships, writing,
   release and product behaviour for reviewed inputs. It does NOT prove
   generic source-to-candidate extraction... every v2 deal to date is a
   hand-authored reviewed-slice module." These gates are not wrong in
   concept, but **none of them can be run, even in principle, until the
   native extractor produces a real multi-deal candidate set** — which is
   itself gated on M3's own auto-pass/review-queue/sampling protocol being
   implemented (currently prose-only in the ledger, no code). I have
   written acceptance definitions for all six assuming that prerequisite is
   met; none should be treated as "close to buildable now."
3. **`P9_RENDER_PARITY`** risks being satisfied by the wrong evidence. The
   2026-07-23 gate-registry audit (`docs/handoffs/AUDIT-GATE-REGISTRY-STATUS-2026-07-23.md`)
   explicitly warns: "`reports/PARITY-GATE-2026-07-15.md` is the legacy M2
   parity gate, not `P9_RENDER_PARITY` evidence." Any acceptance definition
   for this gate must name a fresh generator, not point at that file. I have
   done so below, but flag it because it is the one gate where a plausible
   wrong answer already exists in the repo and could be mistaken for the
   real one.
4. **`P9_DEPLOYMENT_PARITY`'s existing acceptance block is itself
   unreachable today**, not obsolete but currently unsatisfiable: its
   `governing_test: DEPLOYMENT-PARITY-FRESHNESS-01` and
   `required_adversarial_tests` are prose scenario descriptions in
   `adversarial-tests.md` (lines 3134-3143, 2855-2867, 2779-2794), not
   implemented tests. The only place those three ID strings appear in `test`
   or `tests/` is `tests/programme-gates/query-release-contract-closure.spec.js`,
   which checks the *strings exist in the markdown files* — a
   documentation-integrity check, not a check that the described mechanism
   works. This is not a reason to rewrite the gate (it is the one gate Ben
   didn't ask me to define), but it means "already has an acceptance
   block" should not be read as "already mechanically checkable."
5. **None of the P10/P11-flavoured P9 gates (`P9_IMPORT_PARITY`,
   `P9_PROMOTION_ELIGIBILITY`, `P9_CUTOVER_AUTHORISATION`,
   `P9_POSTCUTOVER_SMOKE`) should be read as close to done.** They sit
   inside `preproduction_gates` but their subject matter is production
   import and cutover — work classes that are explicitly `OPEN` and gated
   behind M3/M4 (`work_classes.production_import`,
   `work_classes.production_cutover` in the YAML). Nothing is wrong with
   having their acceptance criteria defined now (that is exactly what Ben
   asked for — define before M3 relies on them), but a reviewer should not
   infer readiness from the existence of a definition.

None of the above are recommendations to delete a gate outright — the
programme's own phase plan (`EXECUTION-LEDGER.md` §4, P9-P11) still needs
all of them eventually. The flag is narrower: don't let M3 claim any of
these pass against evidence that was never designed to answer the question.

---

## 1. `P9_SCOPE_EXACT`

**Existing definition found:** none under this exact ID. `canonical-contracts.md`
has extensive prose on "corpus scope" freeze mechanics (e.g. line 664:
"Corpus scope selects those fixed pre-freeze roots"; line 1400: "Before a
corpus scope can freeze, two disjoint implementations build a..."; line 3807:
"Before corpus scope freezes, create one immutable `ExpectedOccurrenceSlot`")
and Phase 9 step 5 in `CODEX-PROGRAM.md` describes `CorpusScopeManifest` and
`CorpusScopeFreezeAttestation` as two-independent-enumerator equality proofs.
None of this prose is bound to the string `P9_SCOPE_EXACT`.

- **statement**: The certified corpus scope (the exact set of deals,
  sources and sections examined) is provably complete and exact — nothing in
  scope was silently dropped, and nothing out of scope was silently included.
- **acceptance**: Two independently implemented scope enumerators (one
  driven off the deal/source admission ledger, one driven off the frozen
  `CorpusScopeManifest`) must produce byte-identical inventories of
  deals × sources × sections in scope. A script (not yet built —
  `scripts/verify-corpus-scope-exact.js`) computes both sets and diffs them;
  zero missing, zero extra, zero duplicate.
- **evidence**: A generated `CorpusScopeEqualityReport` (JSON) recording
  both enumerator outputs, their diff (must be empty), and the digest of the
  frozen `CorpusScopeManifest` it was checked against, committed under
  `docs/certification/evidence/` (directory does not currently exist —
  confirmed absent by the 2026-07-23 audit; must be created as part of
  adopting this gate).
- **confidence**: LOW. The two-independent-enumerator pattern is real and
  used elsewhere in the spec (e.g. `InventoryEnumeratorIndependenceAttestation`
  for CORPUS_SCOPE at `canonical-contracts.md` line ~11004), so I am
  extrapolating an established pattern to this gate name rather than
  inventing from nothing — but nothing ties that pattern to this specific
  gate ID.
- **needs_ben**: yes. What counts as "in scope" for M3 (which deals, which
  document types, whether amendments/schedules count) is a product/legal
  scoping decision, not an engineering one.

## 2. `P9_REGISTRY_DISPOSITIONS`

**Existing definition found:** none under this exact ID. `canonical-contracts.md`
line 11899 references "the high-risk-family list, registry disposition enum
selection" in the context of soak-test fixtures — a different meaning
(runtime registry dispositions like `CanonicalWriterDispositionRegistry`),
not obviously "every registry has a disposition recorded for M3."

- **statement**: Every governed registry that Phase 9 depends on (writer
  disposition, physical carrier, cutoff preparation, etc.) has a
  disposition/state recorded for every entry it is expected to cover — no
  registry has an unresolved or missing disposition for anything in the
  frozen corpus scope.
- **acceptance**: A script enumerates the closed registries named in the
  contract bundle (`CanonicalWriterDispositionRegistry`,
  `CanonicalPhysicalCarrierRegistry`, `OperationActionRegistry`, and any
  others the frozen contract bundle names as closed/enumerable) and asserts
  every entry required by the frozen scope has exactly one disposition, none
  `PENDING`/`UNRESOLVED`. This enumeration script does not exist yet.
- **evidence**: A `RegistryDispositionCompletenessReport` per registry,
  listing entry count, disposition histogram, and zero unresolved.
- **confidence**: LOW — the gate name maps plausibly onto real registry
  objects in the contract bundle, but I found no prose anywhere binding
  "registry dispositions" to a Phase 9 pass condition.
- **needs_ben**: no. This is a structural completeness check, not a
  judgment call, once the registries and their expected coverage are
  contract-defined (which they already are, outside Phase 9).

## 3. `P9_MKT_WORK`

**Existing definition found:** none under this exact ID. `canonical-contracts.md`
line 8814-8817 is the only market-statistics prose found: "Published market
statistics are a census of the eligible active-release... never populate a
result or cache labelled as a complete market statistic" — this describes
G0-level containment (market stats must not leak un-gated), not a P9
completion criterion. `G0_MARKET_STATS_CONTAINED` is a separate, already-open
gate.

- **statement**: Cross-corpus market statistics (the aggregate, comparative
  numbers the product surfaces — e.g. "X% of deals have a reverse
  termination fee") are computed only over the certified active release, are
  reproducible, and every stated statistic's denominator and numerator trace
  to real candidate rows.
- **acceptance**: For every published `MarketStatistic` surface, a
  regeneration script recomputes the statistic directly from the active
  `CorpusRelease` candidate rows and asserts byte-identical numerator,
  denominator and value against what the surface currently serves. Requires
  a corpus-scale active release to exist — it does not.
- **evidence**: A `MarketStatisticReconciliationReport` per published
  statistic surface with recomputed vs served values and a diff.
- **confidence**: LOW.
- **needs_ben**: yes. Which statistics are "market work" in scope, and what
  counts as an eligible denominator member (the same reviewed-cohort
  question already live in `EXECUTION-LEDGER.md`'s "Reviewed-deal cohort
  rule"), is a product/legal call.

## 4. `P9_BEN_RUNBOOK`

**Existing definition found:** none. No occurrence of `runbook` anywhere in
`canonical-contracts.md`. The closest analogues are the M1-M4 acknowledgement
artefacts under `docs/acks/` (a human-authored markdown record Ben signs
off), which are a different mechanism.

- **statement**: Ben has a written, current runbook describing exactly what
  he needs to do (and in what order) to review, approve and authorise each
  remaining P9-P11 milestone — so a milestone approval is never blocked on
  Ben having to reconstruct process from scratch.
- **acceptance**: A committed document (e.g.
  `docs/codex-program/BEN-RUNBOOK.md`, does not exist yet) that a script can
  check for freshness: it must reference the current M1 bundle digest and
  current ledger main-basis commit, and CI can assert those two identifiers
  in the runbook match the current `EXECUTION-LEDGER.md` "Current state"
  table (a staleness check, not a content-quality check — content quality is
  Ben's own judgment).
- **evidence**: The runbook file itself, plus a passing staleness-check test
  output.
- **confidence**: LOW — this is the weakest-grounded gate in the list; I am
  proposing a definition from the gate name alone, and "mechanical
  acceptance" here can only ever check freshness, never usefulness.
- **needs_ben**: yes, definitionally — the content of a document that exists
  to tell Ben what to do cannot be specified by engineering without Ben's
  input on what he actually needs.

## 5. `P9_NUMERIC`

**Existing definition found:** none under this ID. Adjacent grounding: the
M3 review protocol in `EXECUTION-LEDGER.md` (2026-07-31) defines auto-pass
criteria including quote byte-identity and "not in a known-defect group,"
and separately notes "the F19 drift check" and the `lib/canonical-v2/native-producer/known-defect-registry.js`
module, which implements defect-class tracking used elsewhere in M3.

- **statement**: Every extracted numeric/monetary/percentage value in the
  certified candidate set matches its cited source text exactly (unit,
  precision, and any `APPROXIMATE` qualifier preserved), with zero silent
  precision loss or unit mismatch.
- **acceptance**: A numeric-verification pass (does not exist yet) re-parses
  every candidate's cited source span for numeric tokens and asserts the
  candidate's structured numeric field reproduces value, unit and precision
  qualifier byte-for-byte from that span. Reuses the byte-identical-quote
  machinery already required for auto-pass (per the M3 protocol) but adds a
  numeric-specific comparator, since a quote can be byte-identical while its
  *parsed* numeric interpretation still drifts (this is exactly the class of
  defect `EXECUTION-LEDGER.md` records being caught and fixed for
  `APPROXIMATE` denominator precision in the Stage 4 review round).
- **evidence**: A `NumericVerificationReport` with pass/fail per candidate,
  zero flags required to close the gate, cross-referenced against the
  known-defect registry.
- **confidence**: LOW — no prose ties this gate ID to a specific mechanism;
  MEDIUM-strength inference only in that the *general* verification pattern
  (byte-identical quote reproduction) is well established elsewhere in the
  M3 protocol and this is the natural numeric-typed extension of it.
- **needs_ben**: yes. What tolerance (if any) is acceptable for
  approximated/rounded figures in source text is a legal-judgment call, not
  an engineering default.

## 6. `P9_RENDER_PARITY`

**Existing definition found:** none under this exact ID in
`canonical-contracts.md`. Explicitly warned about in
`docs/handoffs/AUDIT-GATE-REGISTRY-STATUS-2026-07-23.md`: "
`reports/PARITY-GATE-2026-07-15.md` is the legacy M2 parity gate, not
`P9_RENDER_PARITY` evidence" — i.e. a wrong-but-plausible answer already
exists and must not be reused.

- **statement**: The canonical v2 candidate render (what the Review/Query/
  Compare UI shows) is provably faithful to the underlying stored
  candidate — no field silently dropped, reordered, truncated, or displayed
  differently than its canonical value.
- **acceptance**: A render-parity script renders every candidate in the
  active release through the same serialisation path the UI uses (headless,
  not screenshot-based) and diffs the rendered field set against the
  candidate's canonical field set; zero missing, zero extra, zero mismatched
  fields. This is distinct from and does not reuse `reports/PARITY-GATE-2026-07-15.md`,
  which the audit note establishes covers different (M2, legacy) ground.
  Does not exist yet.
- **evidence**: A fresh `P9RenderParityReport` generated against the current
  active release, dated after the render-parity script's own creation (so it
  cannot be satisfied by a stale pre-existing report).
- **confidence**: LOW on mechanism (nothing built), but MEDIUM on scope
  because the audit note gives an unusually clear negative constraint (what
  this is *not*) even though it doesn't say what it *is*.
- **needs_ben**: no — this is a structural equality check once the render
  path and candidate schema are fixed.

## 7. `P9_STRUCTURED_CLAIMS`

**Existing definition found:** none. No occurrence of "StructuredClaim" or
"structured claim" anywhere in `canonical-contracts.md`.

- **statement**: Every candidate's structured claim (the machine-readable
  proposition — e.g. "termination fee = $X, triggered by Y") conforms to its
  declared schema and is internally consistent with its own evidence
  (qualifiers attach to the right limb, cross-references resolve, no
  orphaned fields).
- **acceptance**: A schema-conformance + cross-field consistency validator
  (does not exist yet, though the taxonomy/rubric machinery in `lib/rubric.js`
  and `lib/taxonomy.js` plus the v2 `qualifier-attachment.js` and
  `citation-constructibility.js` modules under `lib/canonical-v2/native-producer/`
  are the building blocks) runs over every candidate in the active release;
  zero schema violations, zero unresolved cross-reference, zero qualifier
  attached to the wrong limb.
- **evidence**: A `StructuredClaimConformanceReport` with pass/fail per
  candidate and a breakdown by violation type.
- **confidence**: LOW — gate name plausibly maps to existing building
  blocks (`qualifier-attachment.js`, `citation-constructibility.js`), but no
  prose defines "structured claims" as a P9 pass condition, and those
  modules today validate individual mechanics, not a corpus-wide
  conformance sweep.
- **needs_ben**: yes. What counts as a disqualifying structural defect vs. a
  benign edge case is a taxonomy/rubric judgment call.

## 8. `P9_PARTY_LINT`

**Existing definition found:** none. No occurrence anywhere in
`canonical-contracts.md`, `adversarial-tests.md`, or `CODEX-PROGRAM.md`.
CLAUDE.md's model-routing guide separately mentions "classify rules (the
safety check against all deals' section titles is the review)" for a
different (v1, not P9) mechanism, and there's a distinct
`docs/handoffs/ANALYSIS-D2-ADVISER-LAWYER-ENTITY-CLASSES-2026-07-23.md`
handoff about adviser/lawyer entity classification — likely the actual
ancestor of this gate's intent, though not tied to the `P9_PARTY_LINT` id.

- **statement**: Every party/entity reference in the certified candidate
  set (buyer, seller, target, adviser, guarantor, etc.) is classified into
  the correct entity role and there is no unresolved or ambiguous party
  binding in the active release.
- **acceptance**: A lint script (does not exist yet, though
  `ANALYSIS-D2-ADVISER-LAWYER-ENTITY-CLASSES-2026-07-23.md` documents the
  entity-class taxonomy this would check against) walks every candidate's
  party references and asserts each resolves to exactly one entity-class
  from the closed taxonomy, with zero `UNRESOLVED`/`AMBIGUOUS` states in the
  active release.
- **evidence**: A `PartyLintReport` with per-candidate pass/fail and an
  unresolved-count summary; zero required to close.
- **confidence**: LOW — the entity-class taxonomy referenced in the
  handoff is a real, concrete artefact, which is why this isn't rated
  lower, but nothing binds it to the `P9_PARTY_LINT` gate ID specifically.
- **needs_ben**: yes. The entity-class taxonomy itself (what counts as a
  distinct role, how advisers vs. principals are distinguished) is a legal
  taxonomy call.

## 9. `P9_SHADOW_REEXTRACTION`

**Existing definition found:** one direct hit. `canonical-contracts.md`
lines 745-748: "Advancing any bound head, correction, scope, candidate,
manifest, contract or extractor input makes the attestation stale and leaves
`P9_SHADOW_REEXTRACTION` `OPEN`; `PreCutoverCertification` requires the
attestation subject to equal its exact candidate and frozen pair." This
establishes *staleness semantics* (what invalidates a pass) but not *what
passing itself checks*.

- **statement**: Re-running extraction against the exact same frozen
  inputs (source documents, scope, contract bundle) reproduces the same
  candidate set — extraction is deterministic enough that a second,
  independent ("shadow") run is not a materially different answer, and any
  divergence is triaged before certification.
- **acceptance**: A shadow-reextraction script re-runs the native
  producer over the frozen candidate scope's inputs on a separate run
  (independent provider call, same prompts/contracts) and diffs the
  resulting candidate set against the certified one field-by-field. Per the
  contracts prose, this attestation goes stale automatically the moment any
  bound head/correction/scope/candidate/manifest/contract/extractor input
  advances — so the acceptance check must also verify the compared
  candidate set's exact identity matches the current frozen pair, not a
  prior one. Does not exist yet; requires the native producer to run at
  corpus scale first.
- **evidence**: A `ShadowReextractionAttestation` binding: (a) the frozen
  candidate/contract pair identity, (b) the shadow run's output digest, (c)
  the diff (must be empty or contain only Ben-triaged, logged divergences).
- **confidence**: MEDIUM — genuine defining prose exists for the staleness
  contract, which is unusually strong grounding among the LOW-confidence
  gates, but the pass condition itself (what "shadow" means operationally —
  full re-run? sampled?) is inferred, not quoted.
- **needs_ben**: yes. Model non-determinism means some divergence is
  expected; where the line sits between "acceptable extraction variance"
  and "extraction is unreliable" is a legal-quality judgment.

## 10. `P9_IDENTITY_AND_DRIFT`

**Existing definition found:** none under this exact ID. Identity-stability
is a heavily tested *concept* elsewhere (per `EXECUTION-LEDGER.md`: "Test
coverage includes extraction goldens, identity stability, contract and
stage-registry enforcement..." at line 10740 of canonical-contracts.md), but
that's a general Phase-9-adjacent test-coverage list, not this gate's
definition.

- **statement**: Candidate and source identities are stable across
  re-processing — the same source content always produces the same content-
  addressed identity, and no identity silently changes (drifts) between
  extraction runs for unchanged inputs.
- **acceptance**: An identity-drift check recomputes every content-addressed
  ID (source digest, candidate closure ID, excerpt ID, etc.) for the active
  release from raw inputs and asserts byte-identical match against the
  stored IDs; zero drift. Partially buildable today: individual modules
  already have identity-stability unit tests (need to enumerate which,
  e.g. candidate-proposal-compiler's `closure_id` derivation), but no
  corpus-wide drift sweep exists.
- **evidence**: An `IdentityDriftReport` recomputing and diffing every
  identity class in the active release; zero mismatches required.
- **confidence**: LOW on the gate-specific mechanism, though the underlying
  identity-stability testing pattern is real and already partially
  implemented per-module.
- **needs_ben**: no — this is a mechanical equality check once identity
  derivation functions are fixed.

## 11. `P9_BROWSER_A11Y_PERFORMANCE`

**Existing definition found:** one direct hit plus adjacent prose.
`canonical-contracts.md` lines 14431-14434: "...and the exact
MaximumScaleFixtureManifest subject to the existing success and throughput
floors; a missing class measurement fails `P9_BROWSER_A11Y_PERFORMANCE` and
`P9_DATABASE_SOAK`." Lines 14436-14442 define a separate
`ClientTransitionPerformanceRegistry`: "Every member must show its usable,
accessible destination state within 2 seconds while trusted instrumentation
records zero admission, network, API, cache and database calls." This is the
strongest concrete numeric criterion found for any undefined gate (2-second
budget, zero-call constraint for client transitions).

- **statement**: Every client-side transition in the product (page/view
  changes that don't require a fresh server round-trip) reaches a usable,
  accessible state within budget, and the product meets a defined
  accessibility bar — no missing performance-class measurement, no
  regression against the fixed floor.
- **acceptance**: (a) Performance: a `ClientTransitionPerformanceRegistry`
  sweep instruments every registered `ClientTransitionTemplate` and asserts
  time-to-accessible-paint ≤ 2 seconds with zero admission/network/API/
  cache/database calls recorded during the transition, per the quoted
  contract. (b) Accessibility: an automated a11y sweep (e.g. axe-core
  against key routes) with zero critical/serious violations. Neither exists
  today. One data point exists: `EXECUTION-LEDGER.md`'s Metsera browser
  proof ("13 focused cross-view tests PASS... Browser acceptance PASS at
  1440 and 390 pixels with no horizontal overflow") is a *browser
  acceptance* test, not an a11y or perf-budget test — do not conflate it
  with this gate's evidence.
- **evidence**: A `ClientTransitionPerformanceReport` (per-transition
  latency and call-count) and an `AccessibilityViolationReport` (per-route
  violation list); zero required to close both.
- **confidence**: MEDIUM — the performance half has a real, specific,
  quoted numeric criterion (2 seconds, zero calls); the accessibility half
  has no defining prose anywhere and is proposed from the gate name.
- **needs_ben**: yes, on thresholds — the 2-second/zero-call budget is
  already contract-specified so engineering can adopt it as-is, but the
  accessibility conformance level (WCAG A/AA/AAA, which routes are in
  scope) is a product decision only Ben should set.

## 12. `P9_STAGING_SMOKE_AND_ROLLBACK`

**Existing definition found:** none under this exact ID. Extensive adjacent
evidence exists in practice: every P8 staging proof in `EXECUTION-LEDGER.md`
already follows a smoke-then-rollback pattern ("Forced rollback left zero
candidate, partition, serving and cache rows," "Exact replay was a no-op,"
repeated across at least 6 entries).

- **statement**: A consolidated smoke test exercises the full staging
  write/read path (writer → candidate release → serving → query surfaces)
  for the certified corpus and proves rollback leaves zero durable residue —
  the pattern already demonstrated per-slice must hold for the whole
  certified set, not just individual pilot slices.
- **acceptance**: A corpus-scale staging smoke runner (does not exist —
  today's proofs are per-feature, e.g. `PM-P8-AGREEMENT-WRITER-STAGING-03`,
  `PM-P8-PRODUCT-CACHE-STAGING-01`, not corpus-wide) that runs the same
  rollback-transaction pattern already proven per-slice, across every
  candidate in the active release, and asserts zero durable rows/receipts
  post-rollback and unchanged active pointer generation.
- **evidence**: A `StagingSmokeAndRollbackReport` with per-candidate
  pass/fail and a final zero-residue assertion, structured the same way as
  the existing per-slice proofs already recorded in `EXECUTION-LEDGER.md`.
- **confidence**: LOW on the specific gate binding, though MEDIUM-strength
  by extrapolation since the exact pattern this gate implies is already
  working code, just not run at corpus scale or consolidated into one gate
  artefact.
- **needs_ben**: no — this is an extension of an already-approved pattern,
  not a new judgment call.

## 13. `P9_DATABASE_SOAK`

**Existing definition found:** three hits, the most substantive prose found
for any undefined gate. Line 14031-14033: "...tuple without this one
physical fixture, unrelated per-dimension fixtures, unlineaged padding,
changed distribution, multiplied byte estimate or post-freeze measurement
fails `P9_DATABASE_SOAK`." Lines 14396-14402: "A hand-picked benign subset
cannot satisfy `P9_DATABASE_SOAK`. Every request also binds one of the exact
three load states, its live load fence and the passing
LoadRouteEquivalenceAttestation. Missing 10N execution, a production
READY_CANONICAL dependency, a direct namespace bypass or an unrevoked load
fence fails the gate." Line 14433-14434 (shared with gate 11 above).

- **statement**: The database survives a realistic, non-cherry-picked
  sustained load test across all three defined load states, using a fixed
  `MaximumScaleFixtureManifest` (not a hand-picked benign subset), with no
  missing performance-class measurement.
- **acceptance**: A soak-test runner executes `10N` requests (per the quoted
  "Missing 10N execution... fails the gate" — N is not itself defined
  anywhere I found, so this is a placeholder to resolve, not a value to
  guess at) against the fixed `MaximumScaleFixtureManifest`, covering all
  three load states with `LoadRouteEquivalenceAttestation` passing for each,
  under the live load fence, with zero direct namespace bypass. None of
  `MaximumScaleFixtureManifest`, `LoadRouteEquivalenceAttestation`, or the
  soak harness exist as code today.
- **evidence**: A `DatabaseSoakReport` recording load state, request count,
  fixture manifest digest, and pass/fail per the quoted floors.
- **confidence**: MEDIUM — real, specific, quoted constraints exist (three
  load states, "10N" execution, no hand-picked subset), which is
  unusually strong for an "undefined" gate — but the value of N, the
  fixture manifest's actual contents, and the throughput floor are not
  specified anywhere I found.
- **needs_ben**: yes, on the threshold (N, throughput floor, acceptable
  latency) — these are capacity/product decisions, not derivable from the
  prose alone.

## 14. `P9_BACKUP_RESTORE`

**Existing definition found:** none under this exact ID. Adjacent: line
10742 lists "backup restoration" among a general Phase 9 test-coverage
sentence (goldens, identity stability, ..., "backup restoration, rollback,
performance and database load or soak tests") — confirms it's expected to
exist as a category, not a definition of what passing means.

- **statement**: A backup of the production (or staging, pre-cutover)
  database can be restored and the restored instance is provably equivalent
  to the source at backup time — no silent data loss, no restore-time
  corruption.
- **acceptance**: A restore drill: take a backup, restore it to an isolated
  target, and run a full-corpus equality check (row counts, content
  digests) between source and restored instance. Requires Supabase
  backup/restore tooling to be exercised and scripted — does not exist
  today; the isolated Supabase staging project exists (per
  `EXECUTION-LEDGER.md`, "Isolated-staging access | PASS") but no restore
  drill has been run against it.
- **evidence**: A `BackupRestoreDrillReport` with source/restored digest
  comparison and timing (restore duration against a defined budget, per
  line 13024's "measured restore time against a fixed budget" — that budget
  is not itself specified anywhere found).
- **confidence**: LOW.
- **needs_ben**: no — this is an operational/mechanical drill, though the
  acceptable restore-time budget is a minor judgment call worth a quick
  Ben sign-off, not full legal review.

## 15. `P9_PREIMPORT_TRACEABILITY`

**Existing definition found:** two direct, substantive hits.
Line 10260-10262: "`P9_PREIMPORT_TRACEABILITY` certifies only the complete
PRE_SEAL and POST_FREEZE prefix, schemas and generated coverage contracts
required to open production import. It cannot stand in for later phases."
Lines 10238-10248 (failure-terminal exclusion rule) also names this gate
directly: a failure terminal "cannot satisfy `P9_PREIMPORT_TRACEABILITY` or
`P9_TRACEABILITY`."

- **statement**: Every object required to open production import (the
  PRE_SEAL through POST_FREEZE prefix of the traceability chain) is present,
  schema-valid, and has generated coverage contracts — proven complete
  *before* import opens, distinct from and not standing in for the fuller
  post-cutover `P9_TRACEABILITY` chain.
- **acceptance**: A traceability-matrix generator (does not exist — this is
  the central missing piece across several P9 gates) walks the PRE_SEAL →
  POST_FREEZE prefix defined in `CODEX-PROGRAM.md` Phase 9 steps 1-11 and
  asserts every named artefact (M1 acknowledgement, `OperationalPolicySet`,
  `CertificationPolicyManifest`, `CorpusScopeManifest`,
  `CandidateReleaseManifest`, `CandidateReleaseFreezeAttestation`,
  `DeploymentManifest`, `POST_FREEZE` TraceabilityExtension) exists,
  schema-validates, and has no gap — with zero pass for any object on a
  failure-terminal branch, per the quoted exclusion rule.
- **evidence**: A `PreimportTraceabilityMatrix` document binding every named
  object's ID/digest with pass/fail per step.
- **confidence**: MEDIUM — genuinely strong defining prose (what it
  certifies, and explicitly what it does NOT certify), but no code
  implements the traceability-matrix generator this requires.
- **needs_ben**: no — this is a structural completeness check against an
  already-defined chain, once that chain's objects exist.

## 16. `P9_DEPLOYMENT_PARITY` (already defined — included for cross-check)

**Existing definition, verbatim from `programme-gates.yaml` lines 172-178:**
```yaml
acceptance:
  - production_release_statistics_root_equal
  - live_physical_plan_fingerprint_root_equal
  - live_query_plan_smoke_equal
  - activation_parity_recheck_fresh_and_current
governing_test: DEPLOYMENT-PARITY-FRESHNESS-01
required_adversarial_tests: [POST-ACTIVATION-CONTROLLER-01, DEPLOY-CUTOVER-01]
```
Corroborating prose at `canonical-contracts.md` lines 14269-14278: "...cannot
satisfy `P9_DEPLOYMENT_PARITY`. The fixed dependency order is
`PreCutoverCertification -> ReleaseBundleEnvelope ->
ProductionImportAttestation -> DeploymentParityAttestation -> POST_IMPORT
TraceabilityExtension -> CutoverAuthorisation`."

- **statement**: The live production deployment (after inactive import, before
  activation) matches the certified release exactly on statistics, physical
  query plan, and a live query-plan smoke check, freshly rechecked
  immediately before activation (not a stale/cached check).
- **acceptance**: as quoted above — already mechanical in form. What's
  missing is not the definition but the implementation: `governing_test:
  DEPLOYMENT-PARITY-FRESHNESS-01` and the two `required_adversarial_tests`
  are currently prose scenario descriptions in `adversarial-tests.md`, not
  runnable tests (see Flag #4 above). Nothing to redefine here; the gap is
  build work, not definition work.
- **evidence**: `DeploymentParityAttestation` per the quoted contract.
- **confidence**: HIGH — this is the one gate with a real governing
  definition already in the registry.
- **needs_ben**: no — mechanically specified already.

## 17. `P9_IMPORT_PARITY`

**Existing definition found:** substantial adjacent prose (11 hits for the
phrase "import parity" / `IMPORT_PARITY`, mostly describing the
`BUILD_IMPORT_PARITY_BATCH` action grammar in exhaustive detail, e.g. lines
4390-4410, 11917-12242), but none of it is phrased as "passing
`P9_IMPORT_PARITY` requires X" — it's action-grammar spec, not gate-pass
criteria. One direct hit: line 11267 ("Neither `P9_IMPORT_PARITY` nor
`P9_DEPLOYMENT_PARITY` is a member or transitive dependency of the
`production_import` work class or PreCutoverCertification") — a *negative*
constraint (what this gate does NOT gate), useful but not a definition of
what passing means.

- **statement**: Every member imported into the inactive production
  namespace exactly matches its certified release-bundle counterpart —
  complete member and support parity, with checkpointed resumable import,
  exact replay as no-op, and conflicting replay failing closed.
- **acceptance**: The `BUILD_IMPORT_PARITY_BATCH` action grammar (quoted
  exhaustively in the contracts, lines 11917-12242) already specifies the
  exact discriminator tuples and receipt mapping a correct implementation
  must follow. Acceptance = a production-import test harness that runs this
  grammar against a real (inactive) import and asserts: member/support
  parity root equality, checkpoint-replay no-op, and conflicting-replay
  fail-closed — mirroring the pattern already proven in isolated staging for
  the writer (`PM-P8-AGREEMENT-WRITER-STAGING-03`: "Exact replay was a
  no-op. Conflicting replay failed closed.") but for the production-import
  path specifically, which does not exist as code yet.
- **evidence**: `ProductionImportSeal` and `ImportSuccessErasureReceipt`
  set, per the quoted contract.
- **confidence**: MEDIUM — the action grammar is exhaustively specified
  (strong grounding on mechanism), but no prose states the pass/fail
  predicate for the gate itself, and none of this exists as code.
- **needs_ben**: no — mechanical once the import harness exists; it is
  effectively test-driven against an already-fully-specified grammar.

## 18. `P9_PROMOTION_ELIGIBILITY`

**Existing definition found:** one direct, substantive hit. Lines
10956-10962: "`P9_PROMOTION_ELIGIBILITY` is `PASS` only when the
target-bound status generation selects exactly one current union variant
and its exact held fence. For the historical variant, the immutable prior
production-import and gate evidence remains evidence for that retained
target, while every mutable policy, revocation, dependency, provider,
schema, readiness and release-state predicate is freshly evaluated. Evidence
or status from the failed target cannot satisfy the historical branch."

- **statement**: The candidate release selected for promotion is
  unambiguously the one current, eligible target — exactly one status
  generation with exactly one held promotion fence — and if it's a
  historical-reactivation target, every mutable predicate (policy,
  revocation, dependency, provider, schema, readiness, release-state) is
  freshly re-evaluated rather than reused from the original evidence.
- **acceptance**: A promotion-eligibility check reads the current
  `CandidatePromotionFence` and status-generation state and asserts: (a)
  exactly one current union variant selected, (b) exactly one held fence,
  (c) for historical-reactivation, every named mutable predicate was
  re-evaluated against current state, not copied from prior evidence. None
  of `CandidatePromotionFence` or the status-generation machinery exist as
  code today.
- **evidence**: `PromotionEligibilityProof`, per the quoted contract.
- **confidence**: MEDIUM — direct, specific quoted prose, but the
  underlying machinery it depends on is entirely unbuilt.
- **needs_ben**: no — mechanical once the machinery exists; the ambiguity
  it guards against (double-selection, stale evidence reuse) is exactly the
  kind of thing a mechanical check should catch.

## 19. `P9_CUTOVER_AUTHORISATION`

**Existing definition found:** one direct hit plus surrounding contract.
Line 13318-13319: "For `FIRST_CANONICAL_CUTOVER`, that exact authorisation is
the evidence for `P9_CUTOVER_AUTHORISATION`." This ties the gate to the
`CutoverAuthorisation` object described throughout Phase 9 step 17 in
`CODEX-PROGRAM.md`: "a fresh, one-use `ActivationDeploymentParityRecheck/V1`
... then the M4 acknowledgement and exact one-use Ben `CutoverAuthorisation`."

- **statement**: Production cutover is authorised by exactly one, one-use,
  Ben-issued authorisation, bound to a fresh (not stale/cached) deployment
  parity recheck and the M4 acknowledgement — and that authorisation cannot
  be replayed or reused for a different cutover attempt.
- **acceptance**: An authorisation-issuance check asserts: (a) an M4
  acknowledgement markdown file exists and matches the current bundle
  fingerprint (the same pattern as the existing M1/M2 acknowledgement files
  under `docs/acks/`), (b) a fresh `ActivationDeploymentParityRecheck/V1`
  (≤10 minutes old, per the quoted `DEPLOYMENT-PARITY-FRESHNESS-01`
  scenario) is bound to the authorisation, (c) the authorisation's one-use
  nonce has not been previously consumed. None of the authorisation object
  or nonce-consumption tracking exist as code today.
- **evidence**: `CutoverAuthorisation` record with bound nonce, parity
  recheck reference, and M4 acknowledgement reference.
- **confidence**: MEDIUM — direct quote ties the gate to a real object, and
  that object's shape is well specified elsewhere in the same document.
- **needs_ben**: yes, unconditionally — cutover authorisation is one of the
  four explicit `ben_approval_points` in the registry itself
  (`ONE_USE_PRODUCTION_CUTOVER`, line 58). No engineering acceptance
  definition can substitute for Ben's authorisation; the mechanical check
  can only verify the authorisation Ben gave was used correctly, never
  generate or waive it.

## 20. `P9_POSTCUTOVER_SMOKE`

**Existing definition found:** none under this exact ID. Extensive adjacent
prose on `PostCutoverSmokeAttestation` (Phase 9 step 21 in
`CODEX-PROGRAM.md`; referenced in `production_import_and_cutover.required_controls`
in the YAML as `POST_CUTOVER_SMOKE_WITH_ROLLBACK`), but not bound to this ID.

- **statement**: Immediately after activation, a smoke test against the now-
  live production instance passes, with rollback available and tested if it
  doesn't.
- **acceptance**: `PostCutoverSmokeAttestation` (per Phase 9 step 21) is
  generated by running the live smoke suite against the newly activated
  production namespace and must pass before the `ISSUE_PASS_COMMIT_LEASE`
  step can proceed (per `CODEX-PROGRAM.md` steps 21-22). Requires a real
  production namespace and cutover to exist — impossible before M4/cutover
  by construction.
- **evidence**: `PostCutoverSmokeAttestation`.
- **confidence**: LOW — the surrounding machinery (`PostActivationControlHead`,
  the smoke-then-lease sequencing) is well specified, but nothing ties this
  exact gate ID to a pass predicate distinct from that machinery, and there
  is categorically nothing to run this against yet.
- **needs_ben**: no — mechanical once cutover has happened; Ben's approval
  is already captured upstream at `P9_CUTOVER_AUTHORISATION`.

## 21. `P9_TRACEABILITY`

**Existing definition found:** the most-referenced gate in the corpus (10
hits in `canonical-contracts.md`, 2 in `adversarial-tests.md`, 1 in
`CODEX-PROGRAM.md`). Line 10262-10268 draws the sharpest available
contrast with gate 15: "`P9_TRACEABILITY` certifies exact bidirectional
coverage through the POST_ACTIVATION cumulative root and the frozen complete
required-object and coverage contracts for the later POST_COMPLETION phase.
It does not claim that smoke, completion or the proposed terminal status has
already been traced." Also referenced at line 10955 and 24 (Phase 9 step
24: "exact `P9_TRACEABILITY` evidence and the M4 pre-cutover
acknowledgement").

- **statement**: Every object in the complete Phase 9 chain — pre-import
  through POST_ACTIVATION — has exact bidirectional traceability coverage:
  every required object is traced forward from its source and backward from
  its consumer, with the frozen complete required-object and coverage
  contracts for POST_COMPLETION satisfied, distinct from (broader than)
  `P9_PREIMPORT_TRACEABILITY`'s narrower prefix.
- **acceptance**: The same traceability-matrix generator needed for gate 15
  (`P9_PREIMPORT_TRACEABILITY`), extended to walk the full chain through
  POST_ACTIVATION, asserting bidirectional coverage (every object has both
  a producer and a consumer edge in the matrix) with zero gaps. Per the
  failure-terminal exclusion rule (lines 10238-10248), any object on a
  failed branch cannot satisfy this gate. Does not exist as code.
- **evidence**: The completed `TraceabilityMatrix` covering pre-import
  through POST_ACTIVATION, referenced by the M4 pre-cutover acknowledgement.
- **confidence**: MEDIUM — very well specified in prose (what it does and
  does not certify is explicit and precise), but the generator that would
  produce this evidence does not exist, and it depends on the entire
  unbuilt import/activation chain.
- **needs_ben**: no — structural completeness check, though it gates the
  M4 acknowledgement which is itself a Ben approval point upstream.

## 22. `P9_SECURITY_AUTH`

**Existing definition found:** none directly, but a critical structural
finding (see Flag #1 above): this gate ID exists in
`lib/programme-gates/governing-registry.js`'s `EXPECTED_GATE_IDS` list
(line 31) and in `programme-gates.yaml`'s `phase_12_security_gates.gates`
list (lines 207-208), where it is explicitly `state: DEFERRED_POST_CUTOVER`.
It is **not present** in the live `preproduction_gates` list in the current
YAML (lines 126-188) — only in the stale governing-registry module's
expectation and in the Phase 12 deferred list.

- **statement**: Ambiguous by construction — this ID currently names two
  different things depending which surface you read. If it means "the
  Phase 12 security/attacker-model certification," its statement is: the
  product has certified route/action inventory, default-deny probes, and
  egress controls (per the sibling gates in `phase_12_security_gates`:
  `ROUTE_ACTION_THREE_WAY_INVENTORY`, `DEFAULT_DENY_FULL_PROBE_SUITE`,
  `EGRESS_DENY_BY_DEFAULT_CERTIFICATION`).
- **acceptance**: Not proposed. Recommend this gate be **excluded from the
  P9 acceptance-definition set entirely** and instead reconciled as part of
  fixing the `governing-registry.js` schema-v1/v2 drift (Flag #1). If Ben
  wants a P9-scoped security gate distinct from Phase 12, it needs a
  distinct ID and a real definition of what "auth" checks pre-cutover
  (vs. the explicitly deferred attacker-model work) — that's a scoping
  question, not a documentation-completeness one.
- **evidence**: n/a.
- **confidence**: LOW — flagged as a registry-hygiene problem, not treated
  as a gate needing a normal acceptance definition.
- **needs_ben**: yes — this is a scoping/governance decision (is there a
  real P9-scoped `P9_SECURITY_AUTH`, or is this drift/duplication that
  should be deleted from `governing-registry.js`'s expectations), not an
  engineering call.

---

## What adopting this into the registry would require

Per the constraint on this task, `programme-gates.yaml` was not touched.
Adopting any subset of the above:

1. Pick the gates ready to formalise (candidates: `P9_DEPLOYMENT_PARITY`
   already done; `P9_PREIMPORT_TRACEABILITY` and `P9_TRACEABILITY` have the
   strongest existing prose to draw an `acceptance:` block from directly).
2. Edit `programme-gates.yaml` to add `acceptance:` (and `governing_test`/
   `required_adversarial_tests` where applicable) per gate.
3. Update `lib/programme-gates/governing-registry.js`'s `EXPECTED_GATE_IDS`
   and schema-version handling to match the live v2 YAML structure — it is
   currently out of sync regardless of this work (Flag #1) and should not
   be left broken while new acceptance blocks are added on top of it.
4. Run `tests/programme-gates/governing-registry.spec.js` and the other
   `tests/programme-gates/*.spec.js` drift tests; extend them to assert the
   new acceptance blocks parse and their named evidence artefacts (reports,
   scripts) actually exist before a gate can flip to `PASS`.
5. For every `needs_ben: true` gate above, get Ben's ruling on the
   specific judgment call named before treating the definition as final.
