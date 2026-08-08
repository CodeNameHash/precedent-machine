# Step 3G — closing the four review conditions on `acfcaa50`

Adversarial review verdict on `acfcaa50` ("fix: four located resolver
defects, each a loosening with a hostile test") was **merge with
conditions**. This note records closing all four before the branch reaches
`main`.

Baseline confirmed green before any change:
`CI=true node --test tests/canonical-v2-general-covenant-corroboration.test.js
tests/canonical-v2-tax-cooperation-corroboration.test.js
tests/canonical-v2-step-3g-resolver-defects.test.js
tests/canonical-v2-m3-representations-merger-remedies-resolution.test.js`
→ `EXIT=0`.

## Condition 1 — Material Contracts contradiction regex, digits only

**Confirmed as stated.** `MATERIAL_CONTRACT_ANY_THRESHOLD_CONTRADICTION`
(`lib/canonical-v2/native-producer/candidate-resolution.js`) matched only
`$[\d,]+`, a digit percent, and `\btop\s+\d+\b`. None of the four named
drafting shapes ("ten largest customers", "top ten customer", "two hundred
fifty thousand dollars", "five percent or more") matched.

**Fix.** Widened the same constant (now built with `new RegExp(...)` from a
shared `MATERIAL_CONTRACT_NUMBER_WORD`/`_RUN` fragment) to also catch: a
word-numeral run before "dollars"/"percent"; word forms of "top ten/fifteen/
twenty" (plus twenty-five/thirty/forty/fifty, harmless extras); a
word-numeral count before "largest"; and the bare superlative "largest" on
its own. Exported `MATERIAL_CONTRACT_ANY_THRESHOLD_CONTRADICTION` from
`candidate-resolution.js` for direct unit testing (it was not exported
before).

**Hostile test added**, one assertion per named marker shape, in
`tests/canonical-v2-step-3g-resolver-defects.test.js`
("HOSTILE: word-numeral and superlative Material Contract threshold markers
still contradict ANY") — direct regex test against all four quotes from the
condition.

**Regression check.** Re-ran the existing family-level replay test
(`modiv-material-contracts-20260807-replay`): still `open_world: 16 -> 7`,
`MATERIAL_CONTRACT_THRESHOLD_UNCORROBORATED` still clears to 0. The 9
genuinely-ANY Modiv items still resolve after widening — none of their real
quotes happen to contain a newly-added marker.

## Condition 2 — General Covenants cross-code confusion

**Both confirmed live**, checked directly against
`generalCovenantCodeCorroborated`:
- `{quote: "The Company shall promptly notify Parent of any Transaction
  Litigation...", code: 'COV-NOTIFY'}` → `true`; same quote against
  `COV-LITNOTIFY` → `true`. Different owners (`NOTIFICATION_COVENANTS` vs
  `TRANSACTION_LITIGATION_COVENANTS`).
- `"...any press release or other public announcement or SEC filings..."`
  corroborates both `COV-PUBLICITY` and `COV-SECREPORT` (`PUBLICITY_COVENANTS`
  vs `POST_CLOSING_SEC_REPORTING_COVENANTS`).

**Count confirmed wrong.** `GENERAL_COVENANT_FOLLOW_ON_OWNERS`
(`lib/canonical-v2/p0-product-surface-routing.js`) has **18** keys, not 17
(counted programmatically). `GENERAL_COVENANT_CODE_PATTERNS` in
`general-covenant-corroboration.js` already had all 18 patterns — only the
two prose claims ("17-code table") were wrong, in the file's own header and
in `docs/codex-program/notes/step-3g-resolver-defects.md`. Both fixed to say
18.

**(a) Hostile tests for the confusable pairs.** Added to
`tests/canonical-v2-general-covenant-corroboration.test.js`:
`"HOSTILE (confusable pair): a Transaction-Litigation notice quote fires
both COV-NOTIFY and COV-LITNOTIFY"` and `"HOSTILE (confusable pair): a
publicity covenant mentioning SEC filings fires both COV-PUBLICITY and
COV-SECREPORT"` — both assert `true`/`true` (both codes DO corroborate;
that's the point — corroboration is not the same question as the resolver's
choice between them).

**(b) Double-fire rule implemented.** New function
`generalCovenantDoubleFireCode(quote, ownCode)` in `candidate-resolution.js`,
next to `generalCovenantGroundingFailure`: scans `GENERAL_COVENANT_CODES`
for any OTHER code, with a DIFFERENT `owner_id`, whose own pattern also
corroborates the same quote. Same-owner code pairs (e.g. `COV-DELIST`/
`COV-LIST`, both `LISTING_DELISTING_COVENANTS`) are deliberately excluded —
routing depends on the owner, not the code, so a same-owner double match is
not an ambiguity. Wired into the `NATIVE_GENERAL_COVENANT_` branch of the
main resolution loop: when `generalCovenantGroundingFailure` finds no defect
(the model's own pick corroborates), a double-fire check now runs; if it
finds a different-owner competitor, the candidate routes to `review_queue`
with reason `GENERAL_COVENANT_CODE_DOUBLE_FIRE` (`has_resolution: false`,
`auto_pass: false`) instead of falling through to the normal resolve path.

**Resolver-level hostile test.** `tests/canonical-v2-step-3g-resolver-
defects.test.js`, `"HOSTILE: a genuinely double-firing General Covenant
quote routes to review_queue, not resolved"` — forges a real
`modiv-general-covenants-20260807-replay` COV-NOTIFY candidate's `raw_value`
to the Transaction-Litigation quote and replays through the real
`resolveCandidates`: `resolved.length === 0`, `open_world.length === 0`,
`review_queue.length === 1` with reason `GENERAL_COVENANT_CODE_DOUBLE_FIRE`.

**Regression check.** Re-ran `modiv-general-covenants-20260807-replay`
unforged: `open_world` still `12 -> 1`, `resolved` still 10,
`review_queue` still 11 with the identical composition it had before this
change (confirmed by running the fix's own parent commit `acfcaa50` side by
side — the 11-item review_queue with mostly-empty `reasons` arrays is a
**pre-existing** artefact of a separate mechanism, not something my change
introduced). None of this run's real candidates double-fire, so the count
does not move.

## Condition 3 — comment misstating the ACCURACY/REVIEW contract

**Confirmed false as written.** Read `qualifier-kind-lexicon.js` directly:
- Line 114: `IDENTITY_BEARING_KINDS = Object.freeze(['ACCURACY',
  'DISCLOSURE_SCHEDULE_CARVEOUT'])`.
- Lines 880-888 (the zero-family branch, `familySet.size === 0`): when
  `modelKind === 'ACCURACY'`, returns `{ outcome: 'REVIEW', reason:
  QUALIFIER_KIND_UNCLASSIFIED, families: [] }` — REVIEW even though the
  lexicon found **zero** markers, not a disagreement.
- Line 905 (`familySet.size === 1`, disagreement branch) and line 1013-1026
  (`doubtOutcome`) are both guarded by
  `IDENTITY_BEARING_KINDS.includes(modelKind)`, which is true for ACCURACY —
  every branch that could otherwise return `OPEN_WORLD` is redirected to
  `REVIEW` instead.

So for `modelKind: 'ACCURACY'`, `OPEN_WORLD` is **structurally unreachable**
from `classifyQualifierQuote` — there is no code path where "the lexicon
recognised marker text" is what separates REVIEW from anything else. The old
comment's claim ("REVIEW means the classifier recognised qualifier-marker
text and declined to pick a family") and its reassurance ("genuinely
ungoverned text still falls through to NOT_EXACT; only REVIEW is
redirected") are both false/vacuous: ACCURACY input can produce REVIEW,
CLASSIFIED, or SPLIT, but never the OPEN_WORLD outcome the old comment
implied was still reachable and being carefully excluded.

**Fix: documentation only, no routing change** (the review confirmed the
routing is correct and safe; this condition explicitly forbids changing it).
Rewrote the comment block at `handleRepresentationQualifierCarrier`'s
ACCURACY branch in `candidate-resolution.js` to state the real contract: for
ACCURACY the qualifier kind is identity-bearing, and `classifyQualifierQuote`
never lets doubt about it — including the zero-marker case — resolve
silently; every such doubt upgrades to REVIEW. What still falls through to
`REPRESENTATION_QUALIFIER_KIND_NOT_EXACT` is every other non-CLASSIFIED
*outcome shape* (SPLIT, or CLASSIFIED with the wrong kind) that
`classifyQualifierQuote` can still return for ACCURACY input — never
`OPEN_WORLD`, because that outcome cannot occur for this `modelKind`. Cited
exact line numbers (~114, ~880, ~905, ~1013) so a future reader can verify
directly rather than trust the paraphrase.

## Condition 4 — transfer-cooperation gate lost its conjunction

**Confirmed as stated.** The shipped `TRANSFER_PREPARATION_ACTION_PATTERN`
was `/\b(?:cooperat\w*|prepar\w*|fil(?:e[ds]?|ing))\b/i` — a disjunction, so
ANY of the three word families alone corroborated. Verified the demonstrated
failure directly: `"All Transfer Taxes shall be borne by Parent when due,
and Parent shall file all necessary Tax Returns with respect to all such
Transfer Taxes"` (no cooperation obligation at all) corroborated as
`TRANSFER_COOPERATION` before the fix.

**Fix.** Split into two mandatory gates in `tax-cooperation-
corroboration.js`: `TRANSFER_COOPERATION_VERB_PATTERN = /\bcooperat\w*\b/i`
(mandatory) AND `TRANSFER_PREPARATION_ACTION_PATTERN =
/\b(?:prepar\w*|fil(?:e[ds]?|ing))\b/i` (still word-form tolerant, the
original defect's actual territory) — both required alongside the existing
`TRANSFER_TAX_VOCABULARY_PATTERN`. `TRANSFER_COOPERATION_VERB_PATTERN` is
now also exported.

**Replay verified.** The real Modiv quote contains "cooperation" (noun) and
"cooperate" (verb) both, so it still clears at zero cost — confirmed by
`transferCooperationCorroborated(REAL_TRANSFER_COOPERATION_QUOTE) === true`
and by re-running the family-level replay (see totals below): Tax Matters
stays `11 -> 6`, `resolved.length` stays 5.

**Hostile test added.** `tests/canonical-v2-tax-cooperation-
corroboration.test.js`, `"HOSTILE: a unilateral allocation-and-filing clause
with no cooperation verb does not corroborate as TRANSFER_COOPERATION"`
(the condition's own demonstrated failure text) — now refuses. A companion
test pins the real Modiv quote still passing with cooperation mandatory.

## Re-derived Step 3G replay counts (after all four fixes)

Re-ran the real `resolveCandidates` against the same committed
`-20260807-replay` evidence, zero model calls:

| Family | Before | After | Δ |
|---|---|---|---|
| Material Contracts | 16 | 7 | −9 |
| General Covenants | 12 | 1 | −11 |
| Representations | 28 | 18 | −10 |
| Tax Matters | 11 | 6 | −5 |
| **Total** | **67** | **32** | **−35** |

**Identical to the baseline in `acfcaa50`.** None of the four fixes moved
any of these numbers:
- Condition 1 (regex widening) adds new contradiction markers but none of
  this run's 9 genuinely-ANY items contain one, so no regression and no
  further reduction either (there were no false ANY items left to catch in
  this specific committed run).
- Condition 2 (double-fire routing) adds a NEW way to land in review_queue,
  but none of this run's real 10 resolved General Covenant candidates
  actually double-fire against a different-owner code.
- Condition 3 is a comment-only change.
- Condition 4 (mandatory cooperation) tightens the gate, but the real Modiv
  `TRANSFER_COOPERATION` candidate already contains "cooperat*" twice, so it
  still clears; the unilateral-filing failure shape the condition warned
  about does not appear in this committed run's candidates, so nothing
  regresses.

If a future corpus contains a real double-fire or a real unilateral-filing
candidate, conditions 2 and 4 will now catch it — the reason these fixes
matter is not visible in this one committed replay pack, by design (the
review's whole point was that neither confusable-pair nor scope-widened
shape happened to be present in the fixtures the first pass tested against).

## Tests: targeted runs, exit codes

- `CI=true node --test tests/canonical-v2-general-covenant-corroboration.test.js
  tests/canonical-v2-tax-cooperation-corroboration.test.js
  tests/canonical-v2-step-3g-resolver-defects.test.js
  tests/canonical-v2-m3-representations-merger-remedies-resolution.test.js`
  → `EXIT=0` (40 pass, 0 fail).
- Full touched-file sweep, `grep -rl "candidate-resolution" tests/*.js` (72
  files) → `EXIT=0` (770 tests, 756 pass, 14 skipped — pre-existing,
  unrelated to this change — 0 fail).
- `bash scripts/lint/forbidden-patterns.sh` → `EXIT=0` (`INVARIANT-4: PASS`).

## Files touched

- `lib/canonical-v2/native-producer/candidate-resolution.js` — widened
  `MATERIAL_CONTRACT_ANY_THRESHOLD_CONTRADICTION` and exported it (condition
  1); added `generalCovenantDoubleFireCode` and wired the double-fire route
  into the `NATIVE_GENERAL_COVENANT_` branch (condition 2b); rewrote the
  ACCURACY/REVIEW comment block in `handleRepresentationQualifierCarrier`
  (condition 3, no behaviour change).
- `lib/canonical-v2/native-producer/general-covenant-corroboration.js` —
  "17" → "18" in the header (condition 2, count fix only).
- `lib/canonical-v2/native-producer/tax-cooperation-corroboration.js` —
  split `TRANSFER_PREPARATION_ACTION_PATTERN` into a mandatory
  `TRANSFER_COOPERATION_VERB_PATTERN` AND a (still word-form-tolerant)
  preparation/filing pattern (condition 4).
- `tests/canonical-v2-step-3g-resolver-defects.test.js` — word-numeral/
  superlative Material Contracts hostile test (condition 1); General
  Covenants double-fire resolver-level hostile test (condition 2b); header
  comment updated.
- `tests/canonical-v2-general-covenant-corroboration.test.js` — two
  confusable-pair hostile tests (condition 2a); header comment updated.
- `tests/canonical-v2-tax-cooperation-corroboration.test.js` — unilateral
  allocation-and-filing hostile test, plus a regression pin for the real
  Modiv quote (condition 4).
- `docs/codex-program/notes/step-3g-resolver-defects.md` — "17-code table"
  → "18-code table" (condition 2, count fix only).

## Where I found the conditions' own claims to be wrong

None. All four conditions' factual claims were verified directly against
the code (regex behaviour, the 18-vs-17 count, the
`classifyQualifierQuote`/`IDENTITY_BEARING_KINDS` structural-unreachability
claim, and the disjunction-vs-conjunction defect) before any fix was
written, and every one checked out exactly as stated.
