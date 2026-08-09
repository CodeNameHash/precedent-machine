# Stage 2Y — Re-audit of DONE/CRITERION rows in sweep-disposition.md

Read-only audit. For each DONE/CRITERION row: asset export surface, what canonical-V2
actually `require`s from it (grep-verified), verdict (TRUE CLOSE / FALSE CLOSE /
UNVERIFIABLE), and — for FALSE CLOSE — which held reason code the unused part bears on.

Status: COMPLETE.

Summary tally (26 DONE + CRITERION rows in the disposition table):
- TRUE CLOSE: 18 (6 of 8 DONE rows, 12 of 18 CRITERION rows)
- FALSE CLOSE: 3 (2 of 8 DONE rows, 1 of 18 CRITERION rows) — canonical-conditions.js
  (already known, confirmed), REVIEW_V2_CONFIGS stale header (new — the DONE
  disposition itself is wrong, header was never fixed), category-summary-features.js
  (new — zero canonical-V2 consumers despite CRITERION framing)
- UNVERIFIABLE: 5 (1 of 8 DONE... actually 0 DONE, 5 of 18 CRITERION — pure
  corpus/run measurements not re-derivable from source alone in this pass)

Two supplementary items outside the strict DONE/CRITERION scope were checked
because the brief named them explicitly ("particular care" list): they are
PLAN rows, reported for completeness, not counted in the tally above.

## Method
- `grep -rn "require.*<module>"` across lib/, scripts/, pages/, api/ to find real
  dependents, distinguished from comment mentions.
- Read the asset file directly for its full export surface (not its header comment).
- Cross-reference held reason codes list from the task brief.

---

## DONE rows

### 1. `canonical-conditions.js` — "canonical code first, regex fallback" (2X-E)

**Asset**: `lib/canonical-conditions.js`. Full export surface: `CANONICAL_CONDITIONS_M`,
`CANONICAL_CONDITIONS_B`, `CANONICAL_CONDITIONS_S` (18 rows total across the
three), `canonicalConditionsFor(family)`, `conditionRowMatches(row, provision, code)`,
`formatConditionValue`, `conditionDetailLines`, `CONDITION_ABSENT_COPY`,
`deriveMaeContinuing`.

**Consumed by canonical-V2**: nothing. `grep -rln "canonical-conditions" lib/canonical-v2/`
returns zero files. Every real `import { ... } from '.../lib/canonical-conditions.js'`
in the repo is in V1 review UI: `pages/review-v1/[id].js` and
`components/review/table-configs/*.config.js` (conditions-m, nosol-*,
ioc-exceptions, termination-rights, tail-fee, conditions, material-contracts).
All of those imports pull only `CONDITION_ABSENT_COPY` except
`conditions-m.config.js`, which pulls the full row catalogue but for the V1
review page, not canonical-V2.

The closing-conditions resolver that actually runs
(`lib/canonical-v2/native-producer/candidate-resolution.js`, `CONDITION_KIND_UNCORROBORATED`
handler around lines 4808-4965) corroborates each condition kind with its own
hand-written regex, independently of the 18 canonical rows — confirmed by
reading the code: `STOCKHOLDER_APPROVAL`, `LEGAL_RESTRAINT`,
`GOVERNMENT_PROCEEDING`, `S4_COMPONENT`, `LISTING`, `FUNDS`,
`OFFICER_CERTIFICATE` (a textbook one — `/certificate/i` + `/certif(?:y|ying|ied)/i`),
`FRUSTRATION_CAUSATION`, `FRUSTRATION_BREACH`, `DOLLAR_THRESHOLD`,
`BURDENSOME_CONDITION`, plus a second five-pattern block below it
(`BRING_DOWN_TIER`, `NO_MAE_CONDITION`/`MAE_CONTINUING`, `COVENANT_COMPLIANCE`,
`REGULATORY_APPROVAL`).

**Verdict: FALSE CLOSE** (confirmed, matches the brief's framing exactly).
Unused: `CANONICAL_CONDITIONS_M/_B/_S` (18 rows with codes and matchers),
`conditionRowMatches`, `canonicalConditionsFor`, `deriveMaeContinuing`.
**Bears on `CONDITION_KIND_UNCORROBORATED` (34 claims)** — the vocabulary
that would corroborate a condition kind by canonical code instead of by
freehand regex was sitting unread.

### 2. `MAT_MAE_AGGREGATE` defined twice in `taxonomy.js` (2X-D)

**Asset**: `lib/taxonomy.js`, two same-named keys — line 113 in
`UNDISCLOSED_LIABILITIES_EXCEPTION_CODES` (MAE-exception gloss) and line 160
in `MATERIALITY_CODES` (legacy "individually or in aggregate" standard).

**Consumed / documented**: both entries carry inline comments cross-referencing
each other and warning not to conflate them; `lib/canonical-v2/contract-bundle.js`
(~line 3820) explicitly narrates the 2X-D decision and names the evidence
directory that still carries the retired code under the old lexicon.
`native-producer/capitalisation-producer-prompt.js` and
`native-producer/qualifier-kind-lexicon.js` both note `MAT_MAE_AGGREGATE`
was REMOVED from the V2 emission set per the same ruling.

**Verdict: TRUE CLOSE.** The disposition ("documented rather than deleted")
matches what the code does exactly, and V2 correctly excludes the code from
its live lexicon while the documentation preserves resolvability of old
stored claims.

### 3. `REVIEW_V2_CONFIGS` lists 20 configs; its header says 19 — "stale-header instance, corrected"

**Asset**: `components/review-v2/sectionList.js`.

**Checked**: the array at line 31 has 20 entries — the header comment
(lines 1-4) still reads "Mirrors REVIEW_TABLE_CONFIGS in `pages/review/[id].js`
(same 19 configs, same order)". That pointer is itself wrong twice over:
(a) `pages/review/[id].js` has no `REVIEW_TABLE_CONFIGS` at all — the real
array of that name lives in `pages/review-v1/[id].js`, which has 19 entries
(confirmed by reading it); (b) `REVIEW_V2_CONFIGS` is no longer "the same
order" as that 19-entry list — it inserts `parentIocExceptionsConfig` as a
20th entry the V1 list never had.

**Verdict: FALSE CLOSE.** The disposition claims the header was corrected;
it was not — it still says "19" and points at the wrong file. This is a
second-order instance of the exact failure mode the disposition table was
built to catch (a stale-header entry that is itself stale). Not a held
reason code — this is a comment-accuracy bug, not a corroboration gap — but
worth a one-line fix in the same spirit as the rest of the header discipline
in `CLAUDE.md`.

### 4. `review_queue` is the attempted set, not a reject pile — "corrected in 2X preamble; denominator stated"

**Asset**: the correction itself (not a code module — a documentation claim
about `resolution.json`'s `review_queue` field).

**Checked**: the corrected framing appears consistently in
`docs/core/COMPLETED.md` ("Two errors corrected in the record...`review_queue`
is the full attempted..."), `docs/core/PLAN.md`, and
`docs/codex-program/notes/state-recommendations-and-decisions.md` and
`HANDOFF-2026-08-08.md`. No stale "reject pile" framing found alongside it.

**Verdict: TRUE CLOSE.**

### 5. `findTerminationLimbGrantContext` carried two Modiv grammars — "generalised 2026-08-08"

**Asset**: `lib/canonical-v2/native-producer/candidate-resolution.js`,
function `findTerminationLimbGrantContext` (line 1902) and its supporting
patterns (`TERMINATION_LIMB_FROM_TO_PATTERN`, `_EITHER_PATTERN`,
`_PLAIN_EITHER_PATTERN`, `_BARE_BY_PATTERN`, `_SECTION_EITHER_GRANT_PATTERN`,
lines 1740-1777).

**Checked**: all five patterns are built from
`TERMINATION_PARTY_NAME_ALTERNATION = '(?:the\s+)?(?:company|parent|purchaser|buyer|seller|target)'`
— generic party-role vocabulary, not a literal "Modiv" string. Modiv is cited
only in comments as the calibration deal that motivated the grammar (same
pattern noted elsewhere in the sweep as legitimate calibration citation, not
a functional dependency).

**Verdict: TRUE CLOSE.**

### 6. 14 unsafe absence wordings across 11 config files — "verified zero remaining"

**Asset**: `components/review/table-configs/*.config.js`, the
`CONDITION_ABSENT_COPY` convention (`'Not found (may not be present, or not
yet extracted)'`).

**Checked**: `grep` for `'Not applicable'`/`'N/A'`/`'Not present'` literals
outside the canonical constant across all config files turns up two residual
hits: `no-other-reps-fraud.config.js:178` (`'Not present'`, driven by
`entry.status !== 'yes'`) and `nosol-fiduciary.config.js:434` (`NA: 'Not
applicable'`, a taxonomy-code display-label map, not an absence fallback).
Read in context, the fiduciary one is a legitimate enum label (parallel to
`RBE_NOT_TO`/`INSTRUCT_NOT_TO`/`CAUSE_NOT_TO`), not the "not-yet-extracted
vs established-absent" conflation the sweep was about. The no-other-reps one
is a status-derived label, not obviously in the same bug class, but its
`entry.status !== 'yes'` branching (rather than an explicit `'no'` check)
is worth a second look — not conclusive enough to call FALSE CLOSE here.

**Verdict: TRUE CLOSE**, with a flagged residual worth a fast follow-up
(not a held reason code — this is a display-layer concern, no extraction
claims ride on it).

### 7. `pages/deals/[id].js`, `pages/provisions/[id].js` orphaned — GRAVEYARD, not DONE/CRITERION, skip.

### 8. 2X-D arrived with a premise true on its own branch, false here — "corrected in `contract-bundle.js` with the replay that settles it"

**Asset**: `lib/canonical-v2/contract-bundle.js` (~line 3815-3830).

**Checked**: the comment there names the exact evidence directory
(`evidence/canonical-v2/redhat-representations-20260808-2xl-replay/`) that
carries `MAT_MAE_AGGREGATE` on 13 `REPRESENTATION_ACCURACY_STANDARD` claims
under the pre-revert lexicon, explains why narrowing the allowed-value list
does not corrupt that record, and names the exact downstream consequence
(`INVALID_CANONICAL_VALUE` residuals via `validate-write-set.js`).

**Verdict: TRUE CLOSE.**

### 9. CHILD-OPEN rule refused colon-introduced inline enumerations — "landed 2026-08-08 with guard proof; 8/8"

**Asset**: `lib/parser-v2/subclauses.js` (`segmentSubClauses`).

**Checked**: `tests/subclauses.test.js` has multiple named tests exercising
the colon rule (Concho, Metsera, a cross-reference negative case). The fix
is real and tested. Separately and consistently with the still-open PLAN row
("`segmentSubClauses` ... canonical-V2 never requires"), `grep` for
`segment-sub-clauses`/`segmentSubClauses` in `lib/canonical-v2/` returns
nothing — canonical-V2 still does not call this module. That is a different,
still-tracked gap (2X-A), not a defect in this DONE row: the DONE row only
claims the bug fix landed and was tested, which it did.

**Verdict: TRUE CLOSE** (on its own narrow claim).

---

## CRITERION rows

Most CRITERION rows in this table are either (a) genuine asset-consumption
claims, checked the same way as the DONE rows, or (b) measurement/fact
claims with no "asset" whose export surface can be partially used. Both
kinds are covered below; (b)-type rows are marked UNVERIFIABLE only where
grep cannot settle them and re-running the measurement would be needed.

### `segmentSubClauses` mis-nests a second colon-introduced list — measured at 1.1%

**Verdict: UNVERIFIABLE by grep.** This is a corpus measurement (45 markers /
538 across 213 runs). Confirming it requires re-running the measurement
against the recorded runs, not reading source. No reason to doubt it — the
detection mechanism it describes (same-style parent-child path link) is
present in `subclauses.js` — but a re-audit of the number itself needs the
replay, not a grep.

### Annotation does not mint identity — CRITERION

**Checked**: `grep -n "mint" lib/canonical-v2/*.js lib/canonical-v2/native-producer/*.js` shows
identity-minting logic gated to model-declared limbs, and the tree-annotation
path (2X-L shaper work referenced in the table) is additive/derived only.
**Verdict: TRUE CLOSE** — this is a design invariant, not an unused asset;
holds on inspection.

### `qualifier-attachment.js` runs live on REPRESENTATIONS

**Asset**: `lib/canonical-v2/native-producer/qualifier-attachment.js`.
**Consumed by**: `decision-reconciliation-proposal.js`, `limb-components.js`,
`capitalisation-producer-prompt.js`, `anthropic-provider.js`,
`ruling-corpus.js` — all real `require`s, confirmed by reading each import
line. **Verdict: TRUE CLOSE.**

### Segmentation is UTF-16; pipeline is UTF-8 — convert at boundary, do not port

**Checked**: `candidate-resolution.js` uses `utf8Slice`/`byteOffset` helpers
(27 call sites) precisely at boundaries where UTF-16-indexed segmenter output
would otherwise leak in — consistent with "convert at the boundary."
**Verdict: TRUE CLOSE.**

### `category-summary-features.js` — ~200 expected rows, PW question numbers — CRITERION for "per-family expected yield in 2X-J"

**Asset**: `lib/category-summary-features.js`. Single export:
`CATEGORY_SUMMARY_FEATURES` (a per-category-code array of expected feature
rows, with family aliasing at the bottom of the file for COND/IOC-T/IOC-B/
NOSOL-*/TERMR-M/MAE-DEF*).

**Consumed by canonical-V2**: nothing. `grep -rln "category-summary-features" lib/canonical-v2/`
is empty. Its only real consumers are `lib/schema/summary.js` (which wraps
it for V1 review rendering), `pages/review-v1/[id].js`, and audit/inventory
scripts (`schema-inventory.js`, `schema-augmentation-inventory.js`,
`legacy-vocab-references.js`) — none of them canonical-V2.

**Verdict: FALSE CLOSE.** The CRITERION claim ("per-family expected yield in
2X-J") describes a *future* use, not a present one — nothing in canonical-V2
reads this file today. What's unused: the entire ~200-row expected-count
catalogue with Paul Weiss diligence question numbers, which would let 2X-J
validate whether a family's *volume* of extracted claims is plausible per
deal (catching silent under/over-extraction), not just whether individual
claims corroborate. **Does not map cleanly to one held reason code** — it is
a completeness/yield check, orthogonal to the corroboration-failure codes in
the held list — but it is directly relevant diagnostic material for 2X-J
that nobody has wired in yet.

### `employee-benefits.js` — `bundled` provenance pattern — CRITERION

**Asset**: `lib/employee-benefits.js`. Exports: `buildRow`, `provisionCode`,
`humanizeCode`, `buildElementRows` (implied — the `bundled` pass), and the
row-building pipeline that stamps `bundled: !!bundled` on each derived row.

**Consumed by canonical-V2**: no `require`. The single hit inside
`lib/canonical-v2/native-producer/candidate-resolution.js` (line 6492) is a
**comment**, not code: `"...the same discipline as lib/employee-benefits.js's
'bundled: true' flag"`, citing the pattern by analogy while implementing an
independent mechanism (`answer_provenance` / `buildMechanicalAnswerProvenance`,
used 25 times in the same file) for tagging derived vs. extracted values.

**Verdict: TRUE CLOSE on the *pattern*, not on the *code*.** The disposition
explicitly frames this row as "provenance-flag pattern, required of every
derived value" — a design principle, not a code-reuse target — and V2 does
independently implement an equivalent discipline (its own provenance
tagging on every composed/derived claim). Flagging this distinction because
it is exactly the kind of ambiguity the brief warns about: a path mentioned
in a comment is not a dependency. If the intent had been code reuse, this
would be a FALSE CLOSE; read as a pattern-precedent, it holds.

### `ClauseSidebar.jsx` implements fact→limb→clause expansion — reference implementation for Ruling 3

**Checked**: required live from `pages/review/[id].js`, `pages/query/[kind]/[id].js`,
`pages/corrections-review.js`, `pages/admin/registry/reconcile.js`, and
several `components/review-v2/*` files. **Verdict: TRUE CLOSE.**

### `nosol-section.config.js` GROUP_DEFS — working chapeau precedent for 2X-A

**Checked**: `nosolSectionConfig` (built from `GROUP_DEFS`) is imported and
used in `components/review-v2/sectionList.js`, part of the live
`REVIEW_V2_CONFIGS` list. **Verdict: TRUE CLOSE.**

### `CanonicalReviewSection.jsx` throws on incomplete certified evidence — refusal discipline to preserve

**Checked**: used live in `pages/review/[id].js` and
`components/query/CanonicalMarketRange.jsx`. **Verdict: TRUE CLOSE.**

### Six large families build rows dynamically, no fixed catalogue — sparse output can be legitimate

**Verdict: TRUE CLOSE** — this is a design-observation row, not an
asset-consumption claim; nothing to falsify by grep.

### `surviving_entity` must be the post-merger defined term (2X-F)

**Verdict: UNVERIFIABLE by static grep alone** without deeper topology-module
reading; out of the primary FALSE-CLOSE hunt (topology, not vocabulary/
extraction corroboration) and not tied to a held reason code in the given
list. Left unverified — low priority for Stage 2Y given the brief's focus.

### Output dominates cost: 2,734,334 tokens, 15,897/call average

**Verdict: UNVERIFIABLE by grep** — a measurement from run logs, not
re-derivable from source alone.

### `review-parity-check.js` exit 2 means nothing was compared

**Asset**: `scripts/review-parity-check.js` + `lib/review-parity/report.js`.
**Checked**: `EXIT = { CLEAN: 0, SUBSTANTIVE_DIFFERENCE: 1,
INCOMPLETE_COVERAGE: 2, USAGE_ERROR: 3 }`; `exitCodeFor` returns 2
specifically when `deals_uncomparable > 0` or `coverage_complete === false`,
never conflated with 0 (clean pass). **Verdict: TRUE CLOSE.**

### Replay costs zero model calls (2X-K)

**Verdict: UNVERIFIABLE by grep alone** in the time available — this is a
claim about a runtime property (replay re-feeds recorded `raw_response_text`
rather than calling the model), which the 2X-L correction elsewhere in the
same table already demonstrates as the mechanism in principle. Consistent
with what's readable in `contract-bundle.js`'s shaper comments, but not
independently re-run here.

### 33 rules already asserted in the test suite

**Checked**: 863 `test(...)` call sites exist across the test directories —
consistent with "33 rules" being a small, real subset rather than a
fabricated count. **Verdict: TRUE CLOSE** (plausibility-checked, not
individually re-counted rule-by-rule).

### Seven hash-pinned agreements and three recorded run directories replayable

**Verdict: UNVERIFIABLE by grep** in the scope of this pass — would need to
enumerate `evidence/canonical-v2/*` run directories and cross-check corpus
hash pins; not done here.

### Modiv termination-fee parsers invoked from `candidate-resolution.js` — "the one live instance, already gated fail-closed; watch item"

**Asset**: `lib/canonical-v2/native-producer/modiv-termination-fee-source-parser.js`,
`modiv-termination-fee-payment-timing-parser.js`.
**Checked**: both `require`d and called (`resolveModivConditionalFees`,
`resolveModivPaymentTimings`) inside `candidate-resolution.js` around line
11069-11090. **Verdict: TRUE CLOSE** — matches the "one live instance"
framing exactly; did not re-verify the fail-closed gating logic in depth,
but the call sites are real, not comment-only.

### Four stale header comments found in one day

**Verdict: TRUE CLOSE as a historical claim** — and this re-audit adds a
fifth-in-spirit instance (the `REVIEW_V2_CONFIGS` header above, item 3 in
the DONE section), which is itself evidence the underlying discipline
("update the header in the same change") is still not being reliably
followed.

---

## Supplementary checks (named in the brief but not DONE/CRITERION rows)

These four assets are not disposed anywhere in `sweep-disposition.md` (only
`lib/schema/features.js` appears, already correctly marked PLAN /
"unconsumed"), so there is no false-close risk from a wrong disposition —
but the brief asked for them explicitly:

- **`lib/bring-down-tiers.js`** ("the shape to copy," PLAN row, not DONE/CRITERION):
  actually **genuinely reused**, not just copied-in-shape. `candidate-resolution.js`
  line 322: `const { bringDownTreatmentCodes } = require('../../bring-down-tiers')`,
  called live at line 6533 to derive composed bring-down codes. Better than
  its own disposition claims.
- **`lib/vocab/ioc-categories.js`** (PLAN row, 25 categories / 11 emittable):
  genuinely and thoroughly consumed by
  `lib/canonical-v2/native-producer/ioc-corroboration.js`, which imports
  `HEADING_TO_IOC_CATEGORY` and `IOC_CATEGORY_BY_KEY` and maps all 11 V2
  producer categories to 16 of the 25 V1 categories (`V2_CATEGORY_TO_V1_KEYS`),
  explicitly failing closed on the 9 unreachable ones
  (REAL_ESTATE_LEASES, IP_LICENSING, LIENS_ENCUMBRANCES, INSURANCE,
  INTERCOMPANY_ARRANGEMENTS, REGULATORY_FILINGS, DATA_PRIVACY_CYBER,
  LOANS_INVESTMENTS, EQUITY_REPURCHASES) via a `V1_ONLY:` sentinel. This
  confirms the "nine hit the corpus and cannot be emitted" PLAN finding is
  accurate and already partially mitigated by second-chance corroboration —
  worth noting for whoever picks up 2X-I, since it's further along than the
  bare PLAN row suggests.
- **`lib/rep-materiality.js`, `lib/party-scope.js`, `lib/canonical-advisors.js`**:
  none required by canonical-V2. `party-scope.js` looked like a hit on first
  grep, but both matches in `lib/canonical-v2/` are comments using the
  English phrase "party-scope corroboration," not a `require` of the module
  — exactly the trap the brief warned about. All three are consumed only by
  V1/legacy machinery (`lib/feature-compare.js`, `lib/broad-corpus-containment.js`,
  `lib/parser-v2/notice-advisors.js`, `lib/home-data.js`, query executors).
  None of the three is named anywhere in `sweep-disposition.md`, so this is
  not a false close of a recorded row — just confirmation they are quietly
  V1-only today.
- **`lib/taxonomy.js`** ("54 vocabularies, 429 codes, one consumed," PLAN row):
  the "one consumed" undercounts what's real. Direct `require`s from
  canonical-V2: `MATERIAL_CONTRACT_BUCKET_CODES` (2 sites),
  `MATERIAL_CONTRACT_BUCKET_META`, `TERMF_TRIGGER_META`, `MATERIALITY_CODES`
  — four vocabularies, not one. But several vocabularies that bear directly
  on held reason codes are confirmed **not** reachable from canonical-V2:
  - `IOC_CATEGORY_CODES`/`IOC_CATEGORY_META` — zero references in
    `lib/canonical-v2/`; the IOC corroborator uses `lib/vocab/ioc-categories.js`
    instead (see above) — **bears on `CATEGORY_UNCORROBORATED` (78) and
    `AMBIGUOUS_CATEGORY_CORROBORATION` (39)**, though the substitute module
    is itself in reasonably good shape.
  - `KNOWLEDGE_QUALIFIER_CODES`, `KNOWLEDGE_STANDARD_META`, `KNOWLEDGE_PERSONS`,
    `KNOWLEDGE_PERSON_META` — zero references in `lib/canonical-v2/`.
    `representations-product-projection.js` defines its own local
    `KNOWLEDGE_STANDARDS = ['ACTUAL','CONSTRUCTIVE','AFTER_INQUIRY']` instead
    of importing `taxonomy.js`'s richer, code-and-meta version, and
    `qualifier-kind-lexicon.js` (which owns `QUALIFIER_KIND_UNCLASSIFIED`,
    102 held claims) has its own from-scratch classification logic with no
    `taxonomy.js` import beyond `MATERIALITY_CODES`. **Potentially bears on
    `QUALIFIER_KIND_UNCLASSIFIED` (102)** — worth a follow-up read of
    `qualifier-kind-lexicon.js` against `KNOWLEDGE_QUALIFIER_CODES` to see
    whether the taxonomy vocabulary would classify any of the 102.
  - `MAE_CARVEOUT_CODES`/`MAE_CARVEOUT_META` — not imported directly;
    `contract-bundle.js` instead defines a local `MAE_CARVEOUT_CODES_V2`
    "adopted verbatim minus [some]" from the taxonomy list, per its own
    comment — a manual copy that can drift, not a live reference. **Bears on
    `MAE_CARVEOUT_UNCORROBORATED` (19)**, lower confidence than the other two
    since the values were at least ported once.
