# All-families aggregate: what the 25-family Modiv sweep actually shows, and a fix plan ordered by leverage

Source evidence: `evidence/canonical-v2/modiv-*-20260806/` (23 dirs from the 06:23-06:47 batch) plus `evidence/canonical-v2/topbuild-mae-definition-20260806/` and `evidence/canonical-v2/modiv-termination-fee-citation-following-20260806/`, both reused into the "25" count rather than fresh members of the batch (see section 1). Every number below states the command used to derive it. Where a claim rests on reasoning rather than a direct measurement, it is marked "inferred", and the reasoning is shown.

A machine-readable baseline was supplied mid-task at `docs/codex-program/notes/all-families-baseline-20260806.json`. It was spot-checked, not trusted blind: an independent scan (`/tmp/agg-scan.js`, method in section 1) reproduced its per-family resolved/queued/open-world counts exactly, and also found two things the baseline itself gets wrong (section 2). Both are corrected below.

## 0. Headline corrections to the brief

The brief that opened this task, and the commit message it was drawn from (`git show 4788860b`), both need correcting on three points. All three are corrections of fact, established by reading the evidence, not matters of interpretation:

1. **The crash count is three in both existing accounts, but not the same three, and the true count is four.** The brief's three are closing conditions, interim operating, and (worded as "no other reps") NO_OTHER_REPS_FRAUD. The baseline file's three are capitalisation, closing conditions, and interim operating. Neither list is complete. All four dirs have an incomplete pipeline: capitalisation, closing conditions, interim operating, and NO_OTHER_REPS_FRAUD, each stopping at a different stage (section 2).
2. **Only one of the three "produced nothing" families (appraisal, guaranty, specific performance) is actually a wrong-section problem.** Appraisal's section is correctly identified but the sectionizer reports the wrong byte range for it. Specific performance's section is correctly identified, richly populated, and the model extracted the clause correctly; the candidate is dropped two steps later by an overly literal filter regex. Only guaranty looks like a genuine mapping miss (section 5).
3. **"Every one of the 25 registered section families was run against the Modiv merger agreement" is not quite true.** Two of the 25 registered families have no fresh Modiv evidence from this batch at all: MAE_DEFINITION's only evidence is against TopBuild, a different deal, from a separate prior session; TERMINATION_FEE's only evidence is `modiv-termination-fee-citation-following-20260806`, timestamped 01:00 the same day, roughly five hours before this batch started, from what the commit history calls the citation-following fix session. The 111/206/193 totals are real, but they are a mixture of one fresh 23-family Modiv batch plus two pieces of older, reused evidence, not a clean parallel 25 (section 1).

None of this changes the shape of the underlying problems much. It changes what "three crashes" and "25 families run" can safely be asserted to mean, which matters because the fix plan in section 6 is keyed to the corrected picture.

### 0.1 The three categories, and which finding belongs to which

The brief asked for a sharp distinction between our code being broken, the model producing something the system cannot represent, and the system refusing something correct, because each needs a different response. Sorting every finding below into those three, rather than leaving the split implicit inside each section:

- **Our code is broken.** The interim-operating crash (section 2.3, a real TypeError from a caller's array being frozen by reference, fix already written) and the NO_OTHER_REPS_FRAUD crash (section 2.4, a missing governance tag on one family's claim-finalisation path) both belong here without qualification: nothing about the model's output was at fault in either case, and both have an exact file and line. The specific-performance filter bug (section 5.3) also belongs here: the model's extraction was correct and complete, and a regex our own code owns discarded it.
- **The model is producing something the system cannot represent.** Only consideration's exchange-mechanics/proration/withholding gap (section 3.1) is a clean example of this, and even then, "cannot represent" needs qualifying: V1 already represents all three, so the more accurate statement is that V2 has not yet been built out to represent them, not that they are unrepresentable in principle. Representations' TEMPORAL/THRESHOLD qualifier gap (section 3.1, unverified) is the other candidate for this bucket, pending the follow-up check this task did not complete.
- **The system is refusing something correct.** This is the largest bucket. All five NOT_IN_QUOTE reason codes (section 4), the material-contracts REAL_ESTATE synonym gap (section 3.2), and 78% of representations' and material-contracts' combined open-world candidates (section 3.2, the governed-but-rejected share) belong here: in every one of these, the model proposed something a human reviewer would accept as correct, and a resolver check that was written too narrowly refused it.
- **Does not fit cleanly in any of the three.** Two findings are neither a code defect nor a model or resolver problem in the above sense, and forcing them into one of the three would misstate them. Appraisal's sectionizer byte-offset bug (section 5.1) is the system extracting and showing the model the *wrong text entirely*, upstream of both the model and the resolver; the model never had a chance to be right or wrong. Capitalisation's 600-second timeout (section 2.1) and closing conditions' zero-retry policy meeting one malformed response (section 2.2) are operational/policy questions, not defects with a line number. Guaranty's mapping (section 5.2) is a judgement call about what the family should mean on a deal with no financing party, not a bug anywhere in the pipeline.

## 1. What was actually run, and the verified numbers

Command used throughout this section:

```
node /tmp/agg-scan.js
```

(reads every `evidence/canonical-v2/modiv-*-20260806/resolution.json` plus `topbuild-mae-definition-20260806/resolution.json`, sums `resolved.length` / `review_queue.length` / `open_world.length`, and derives a pipeline stage reached from which evidence files exist). Full per-family output is in the table below. The registered-family list itself was pulled directly from the registry, not assumed:

```
node -e "console.log(require('./lib/canonical-v2/native-producer/producer-prompt-registry.js').listRegisteredSectionFamilies())"
```

This returns exactly 25 family IDs. Cross-referencing against `evidence/canonical-v2/` shows 23 of them have a `modiv-*-20260806` directory from this batch (mtimes 06:23 to 06:47). The remaining two, MAE_DEFINITION and TERMINATION_FEE, are represented in the baseline's 25-row table by reused evidence from other runs (confirmed by directory name, deal label inside `run-manifest.json`/`section-location-scan.json`, and mtime).

| Family (dir) | Sections (Ben's mapping) | Resolved | Queued | Open world | Status |
|---|---|---|---|---|---|
| ANTITRUST_REGULATORY (antitrust) | 5.5 | 10 | 22 | 11 | complete |
| APPRAISAL_DISSENTERS_RIGHTS (appraisal) | 2.6 | 0 | 0 | 0 | complete, wrong text (section 5) |
| CAPITALISATION (capitalisation) | 3.2, 4.2 | - | - | - | **crashed: model call timeout** |
| CLOSING_CONDITIONS (closing-conditions) | 6.1, 6.2, 6.3, 6.4 | - | - | - | **crashed: unparseable model response** |
| CONSIDERATION (consideration) | 2.1, 2.2, 2.3 | 1 | 4 | 20 | complete |
| DIVIDENDS (dividends) | 5.10 | 0 | 0 | 3 | complete |
| DNO_INDEMNIFICATION (dno) | 5.8 | 4 | 10 | 7 | complete |
| EMPLOYEE_MATTERS (employee-matters) | 3.11, 3.12 | 0 | 0 | 3 | complete |
| FINANCING_COVENANTS (financing-covenants) | 4.13, 5.20 | 0 | 3 | 2 | complete |
| GENERAL_COVENANTS (general-covenants) | 5.3, 5.7, 5.9 | 0 | 0 | 12 | complete |
| GUARANTY_FINANCING_PARTY (guaranty) | 5.11 | 0 | 0 | 0 | complete, weak mapping (section 5) |
| INTERIM_OPERATING (interim-operating) | 5.1 | - | - | - | **crashed: frozen-array TypeError** |
| KEY_DEFINED_TERMS (key-defined-terms) | 8.5 | 0 | 0 | 15 | complete |
| MATERIAL_CONTRACTS (material-contracts) | 3.17 | 5 | 5 | 26 | complete |
| MERGER_STRUCTURE_CLOSING (merger-structure) | 1.1, 1.4, 1.5, 1.6 | 20 | 20 | 3 | complete |
| MISC_BOILERPLATE (misc-boilerplate) | 8.2, 8.3, 8.4, 8.7, 8.9, 8.10 | 14 | 14 | 0 | complete |
| NO_OTHER_REPS_FRAUD (no-other-reps) | 3.25 | 3 | 3 | 0 | **crashed at validation, after resolving** (section 2) |
| NO_SHOP (no-shop) | 5.6 | 42 | 52 | 9 | complete |
| PROXY_MEETING (proxy-meeting) | 5.4 | 0 | 13 | 8 | complete |
| REPRESENTATIONS (representations) | 3.1, 3.3, 3.4 | 0 | 0 | 28 | complete |
| SPECIFIC_PERFORMANCE_REMEDIES (specific-performance) | 8.8 | 0 | 0 | 0 | complete, candidate dropped pre-compile (section 5) |
| TAX_MATTERS (tax-matters) | 3.13, 4.15, 5.12 | 0 | 0 | 11 | complete |
| TERMINATION (termination) | 7.1, 7.2 | 1 | 16 | 13 | complete |
| TERMINATION_FEE (termination-fee-citation-following, reused, not this batch) | 7.1, 7.3, 8.12 | 9 | 23 | 20 | complete, pre-dates batch |
| MAE_DEFINITION (topbuild-mae-definition, reused, different deal) | 3.1(a) | 2 | 21 | 2 | complete, TopBuild not Modiv |

Totals across the 23 fresh Modiv-batch families only (`node /tmp/agg-scan.js`, excluding the two reused rows): **100 resolved, 162 queued, 171 open world**. Add the two reused rows and the totals become 111 / 206 / 193, matching the brief's and the baseline's headline figures exactly. Both figures are correct; they are answers to different questions ("what did this batch produce" versus "what does the union of all evidence this repo holds for all 25 families show").

## 2. The crashes: four, not three, four different mechanisms

The pipeline (`scripts/canonical-v2-live-extraction-run.mjs`, renamed mid-task from `canonical-v2-modiv-termination-fee-scope-correction-run.mjs`, same file) writes evidence in a fixed order: `source-reference.json`, `section-location-scan.json`, then (if the model call succeeds) `run-receipt.json` and `call-telemetry.json`, then `resolution.json`, `review-queue.json`, `adapter-result.json`, `validation.json`, `run-manifest.json`, strictly in that order (confirmed by reading the write calls at lines 692-861 of that script, and cross-checked against file mtimes with `stat -f "%Sm %N" -t "%H:%M:%S" evidence/canonical-v2/*/*.json`). Which files exist in a crashed directory pinpoints exactly which stage failed, without needing a captured stack trace, though two of the four were also reproduced directly (below).

### 2.1 Capitalisation: model-call timeout (not mentioned in the brief at all)

`evidence/canonical-v2/modiv-capitalisation-20260806/call-telemetry.json` shows one call, against section 3.2 ("Capitalization", confirmed by `section-location-scan.json`), with:

```
"failed": true,
"error": "native producer model call failed after 1 attempt(s): model call failed: claude -p timed out after 600000ms"
```

Both mapped sections carry the right headings ("Capitalization" at 3.2, "Parent Capitalization" at 4.2, both roughly 8.2KB), so this is not a mapping problem. Capitalisation reps are unusually dense (exact share counts, option pools, RSUs/PSUs by tranche, warrants), and the one recorded call before the timeout had already produced 58,867 output tokens over roughly 520 seconds when the 600-second wall clock cut it off. This reads as a genuinely slow, large extraction hitting a fixed timeout, not a defect with a line number to fix. This is an infrastructure/timeout-policy question, not a code bug (section 6.4).

### 2.2 Closing conditions: unparseable model response, on the second of four planned calls, not the third

`call-telemetry.json` shows section 6.1 succeeding (4,922 output tokens) and section 6.2 failing:

```
"error": "model response does not contain one complete, parseable JSON object"
```

`section-location-scan.json` shows four sections were requested (6.1, 6.2, 6.3, 6.4, all four resolved cleanly by the sectionizer). Only two calls were ever dispatched before the run aborted, so this died on the **second** of four planned calls, not the third as the commit message states; that detail is now corrected. The 6.2 response is directly readable and is not JSON at all; it opens with `"Written to \`evidence/canonical-v2/modiv-closing-conditions-20260806/native-producer-recorded-response-6.2.json\`, matching the sibling..."`, i.e. the model narrated a file-writing action in prose instead of returning the requested JSON object. `max_retries: 0` is a deliberate run setting (documented in the script's own header: "a failed call fails the run, it does not silently retry and blur the call count"), so this is a real, if rare, failure mode of a considered policy, not a code defect. Retrying this exact call once would very likely have produced a normal, parseable response; nothing else about the section mapping (6.1-6.4 are all correctly resolved, real closing-conditions text) needs to change.

### 2.3 Interim operating: our code, root cause found, fix already exists uncommitted

`call-telemetry.json` shows the one model call for section 5.1 succeeding cleanly (no `failed` field, `run-receipt.json` written, 302KB). The crash is downstream, inside `resolveCandidates()`, before `resolution.json` is ever written.

Reproduced directly, offline, no live model call, by replaying the already-recorded `run-receipt.json` through the real `resolveCandidates()`:

```
node /tmp/repro-interim-operating.mjs
```

(script reconstructs the admitted source context exactly as the runner does from the committed, pinned raw HTML at `tests/fixtures/canonical-v2/mae-definition-family/modiv-raw-fetched.htm`, then calls `resolveCandidates({run_receipt: <the real evidence file>, ...})`).

Root cause, found by reading `lib/canonical-v2/native-producer/candidate-resolution.js` (the `openWorld` array, declared once at line 3816, gets mutated in place at lines 9510 and 9522) alongside `lib/canonical-v2/native-producer/sole-remedy-resolution.js` and `lib/canonical-v2/native-producer/ioc-mechanic-resolution.js`: both helper modules' "nothing to do here" branches used to return `freeze({ ..., open_world: openWorld, ... })`, where `openWorld` is the **caller's own live array**, not a copy, and `freeze()` is a deep freeze (`Object.values(value).forEach(freeze)`). Calling it on an object that embeds the caller's array freezes that array in place as a side effect, even on the branch that does nothing else. `resolveSoleRemedyOpenWorld` is called first (line 9501); this contract's vocabulary does not support sole-remedy concepts, so it takes the "disabled" branch and freezes `openWorld` as a side effect regardless. Its own gated splice (`if (soleRemedyResolution.enabled) { openWorld.splice(...) }`) is skipped, so nothing crashes yet. `resolveIocMechanics` is then called with the now-frozen array; interim operating is the one family whose candidates actually contain IOC-surface items, so this call takes its "enabled" branch, and `openWorld.splice(0, openWorld.length, ...)` at line 9522 throws exactly `TypeError: Cannot assign to read only property '0' of object '[object Array]'`, because `openWorld` was silently frozen two calls earlier by an unrelated branch.

This explains why only interim operating crashes: every other family's `resolveCandidates()` call also freezes its `openWorld` by the same aliasing bug (this is not family-specific), but no other family's `resolveIocMechanics` call takes the enabled branch, so no other family reaches a mutation of the now-frozen array. The corruption is universal; the crash is not, because only one family's data shape reaches the one remaining write.

**The fix already exists in the working tree, uncommitted** (`git diff lib/canonical-v2/native-producer/ioc-mechanic-resolution.js lib/canonical-v2/native-producer/sole-remedy-resolution.js`, both files touched, 06:57:59, roughly 25 minutes after this batch's interim-operating run crashed): both disabled branches now return `open_world: [...openWorld]`, a copy, matching the pattern already used on the enabled branch of each. Re-running the exact replay above against the current working tree confirms the fix: `resolved= 10 review_queue= 54 open_world= 46`, no crash. This has not yet been verified against a fresh live run and is not committed.

### 2.4 NO_OTHER_REPS_FRAUD: our code, root cause found and reproduced, a different failure from the other three

This is the "no other reps... writeSet.claims" crash named in the brief, and it is a genuinely different kind of failure from the other three: `resolution.json` (56KB, 3 resolved / 3 queued / 0 open world), `review-queue.json` and `adapter-result.json` (452KB) all exist and are well-formed. The crash happens later, inside `validateResolvedCanonicalWriteSet()`, after a seemingly successful resolution. This means NO_OTHER_REPS_FRAUD's 3 resolved claims are real candidates that were never confirmed safe to write, not a family that produced zero.

Reproduced directly from the committed evidence, no live model call:

```
node /tmp/repro-no-other-reps.mjs
```

(loads the real `adapter-result.json` and `resolution.json`, reconstructs the `writeSet` exactly as the runner does at lines 831-838, and calls the real `validateResolvedCanonicalWriteSet()`). Result, with full stack trace:

```
CanonicalValidationError: writeSet.claims[a0612b88...].attributes.answer_provenance is required:
this write set originates from the native producer (write_set_origin: 'NATIVE_PRODUCER').
  at validateAnswerProvenanceRow (lib/canonical-v2/validate-write-set.js:262:13)
  at validateWithAdmittedSources (lib/canonical-v2/validate-write-set.js:2098:9)
  at validateResolvedCanonicalWriteSet (lib/canonical-v2/validate-write-set.js:2325:10)
```

`answer_provenance` is a governance tag (`MECHANICAL` / `VERIFIED` / never `AI`, per `validate-write-set.js:254-279`) that every claim in a `NATIVE_PRODUCER` write set must carry, added by the recent Phase 1 production-readiness work (`git log --oneline -- lib/canonical-v2/validate-write-set.js` shows `03aa78bb feat(canonical-v2): MECHANICAL/AI/VERIFIED provenance tags, pin sweep, serving contract`, and the most recent repo commit before this task, `0d17ad00 feat(canonical-v2): add Phase 1 production-readiness controls`). Searching for where families attach it (`grep -rl answer_provenance lib/canonical-v2/native-producer/`) finds exactly two files, `candidate-resolution.js` and `native-write-set-adapter.js`; it is set inline, per handler, not centrally. `handleNoOtherRepsCandidate` (`candidate-resolution.js:6000`, confirmed by reading it directly) builds its resolved claims through its own bespoke path and never calls whatever attaches this tag elsewhere. This looks like a rollout gap: the provenance-tag requirement was added centrally, most family handlers were updated, this one family's finalisation path was not. Unlike section 2.3, no fix exists yet for this one.

## 3. What "open world" actually is, and why it is not one thing

Traced by reading `resolution.json`'s schema directly (`resolved`, `review_queue`, `open_world`, `residuals` are four separate top-level arrays, confirmed with `node -e "console.log(Object.keys(JSON.parse(require('fs').readFileSync('evidence/canonical-v2/modiv-antitrust-20260806/resolution.json'))))"`) and by dumping every open-world item's `claim_definition_key` and `reason` for the three highest-count families:

```
node -e "for (const fam of ['representations','material-contracts','consideration']) { ... }"
```

(full script and output captured during this task; reproducible against any family's `resolution.json`).

Open world is a single JSON array, but it holds **two structurally different kinds of failure**, distinguished by `claim_definition_key`:

- **Genuine open-world propositions**: `claim_definition_key: "OPEN_WORLD_PROPOSITION"`, `reason: "NATIVE_OPEN_WORLD_PROPOSAL"`. This is the model explicitly using the schema's own escape hatch, meaning it found something worth recording but had no governed claim type to route it through. All 20 of consideration's open-world items are this kind; only 9 of representations' 28 and 3 of material-contracts' 26 are.
- **Governed-but-rejected candidates**: `claim_definition_key` is a real, registered type (`NATIVE_REPRESENTATION_QUALIFIER_CANDIDATE`, `NATIVE_MATERIAL_CONTRACT_BUCKET_CANDIDATE`, `NATIVE_MATERIAL_CONTRACT_THRESHOLD_CANDIDATE`), with a specific rejection reason (`..._NOT_EXACT`, `..._NOT_GOVERNED`, `..._UNCORROBORATED`, `..._UNRESOLVED`). These are resolver refusals dressed as open-world entries. 19 of representations' 28 and 23 of material-contracts' 26 are this kind. This is architecturally the same failure family as the review-queue's `..._UNCORROBORATED`/`..._NOT_IN_QUOTE` reasons (section 4); it is only sitting in the open-world bucket instead of the review queue as a routing choice, not because the underlying problem is "unrecognised vocabulary."

This distinction is the reason the coordinator's steering on this point matters: the 193 open-world figure is not 193 instances of one cause. It is a mix of missing-taxonomy cases (section 3.1) and mis-corroborated-but-recognised cases (section 3.2), and the two need different fixes.

### 3.1 Genuinely missing taxonomy: consideration is a strong, cheap port from V1; material contracts is not

Per the coordinator's steering, V1's `lib/rubric.js` and `lib/taxonomy.js` were read directly and checked against the actual proposed concepts (not assumed to overlap).

**Consideration: a strong match, not yet ported.** All 20 of consideration's open-world items tag an `attributes` kind of `EXCHANGE_MECHANICS` (12), `PRORATION_FORMULA` (3), `WITHHOLDING` (2), or carry no kind (3, short procedural fragments). Checked against `lib/rubric.js`:

- The `CONSID` provision category's own description (`lib/rubric.js:26`) reads: *"Share conversion, **exchange mechanics**, equity award treatment, appraisal rights"*, i.e. "exchange mechanics" is not an inferred label, it is V1's own name for this concept.
- `CONSID-WITHHOLD` (`lib/rubric.js:278-283`): label "Withholding Rights", description "Right to deduct and withhold taxes from merger consideration", aliases `['Tax Withholding', 'Withholding']`. This matches the `WITHHOLDING` open-world items exactly (their raw text: "less any applicable withholding Taxes").
- `prorationMechanics` (`lib/rubric.js:4047-4048`): a structured object field, `{ electionType, oversubscriptionTreatment, electionDeadline, text }`, plus a separate boolean `proration` field (`lib/rubric.js:4159`) and `withholdingProvision` boolean (`lib/rubric.js:4153-4154`). This matches the `PRORATION_FORMULA` items (raw text about per-holder aggregation and cash-in-lieu-of-fractional-shares caps).

V2's CONSIDERATION family, by contrast, has no governed claim type for any of this (checked: `NATIVE_CONSIDERATION` and related claim definitions in `lib/canonical-v2/contract-bundle.js` and the consideration producer prompt do not reference exchange-mechanics, proration, or withholding concepts). This is a genuine port gap: **17 of consideration's 20 open-world candidates (85%) map onto concepts V1 has carried, named and structured for some time**, and 3 remain genuinely unclear pending a closer look. Design and resolver-wiring work is real (new claim definitions, prompt fields, resolver handlers, following the pattern every other family already uses), but the legal-judgement question ("what is a withholding-rights clause, what is proration") is already answered in `lib/rubric.js`; this is porting, not designing from scratch.

**Material contracts: not a port gap. The taxonomy is already shared.** `lib/canonical-v2/native-producer/material-contracts-producer-prompt.js` imports `MATERIAL_CONTRACT_BUCKET_CODES` directly from `../../taxonomy` (i.e. from `lib/taxonomy.js`, the same V1 file), and `lib/canonical-v2/material-contracts-product-projection.js` does the same. V2 did not reinvent this vocabulary; it reuses V1's `MATERIAL_CONTRACT_BUCKET_META` verbatim. Pulling one real rejected candidate confirms the model is using it correctly:

```json
{
  "raw_value": "is a Company Space Lease, Ground Lease or Company Lease",
  "canonical_value": "REAL_ESTATE",
  "attributes": { "bucket_code": "REAL_ESTATE", "threshold_kind": "ANY", "threshold_value": "Any" },
  "reason": "MATERIAL_CONTRACT_BUCKET_UNCORROBORATED"
}
```

The model correctly classified this as `REAL_ESTATE`. It was still rejected as uncorroborated. `REAL_ESTATE`'s synonym list in `lib/taxonomy.js` (`/real\s+estate/i`, `/lease\s+agreement/i`) does not match the actual defined-term phrasing this agreement uses ("Space Lease", "Ground Lease", "Company Lease", never the literal words "real estate" or "lease agreement"). This is the same defect *shape* as the review-queue NOT_IN_QUOTE class (section 4): a check written narrowly against one drafting style failing on a legitimate variant. It is a regex-breadth fix inside `MATERIAL_CONTRACT_BUCKET_META`, not a taxonomy-design or porting question, and (inferred, not separately checked for every one of the 23 governed-but-rejected material-contracts items) likely explains a meaningful share of the rest, since several other rejected items are similarly plain-language descriptions of a bucket the model named correctly but whose exact wording is not in the corresponding synonym list.

**Representations: real candidate for the same port pattern, not fully checked.** 19 of representations' 28 open-world items are `NATIVE_REPRESENTATION_QUALIFIER_CANDIDATE` proposing a qualifier kind of `TEMPORAL` (7, reason `..._NOT_GOVERNED`, i.e. genuinely absent from V2's registry, not just miscorroborated), `THRESHOLD` (1, `..._NOT_GOVERNED`), or `ACCURACY` (9, `..._NOT_EXACT`, i.e. a registered concept whose exact-match check is failing, closer to the material-contracts pattern than to a missing concept). `lib/taxonomy.js` has `KNOWLEDGE_QUALIFIER_CODES`, `MATERIALITY_CODES` and `EXCEPTION_CODES` (lines 22-92) that look adjacent to these, but this task did not get to a field-by-field check the way it did for consideration and material contracts, so this is flagged as the next check to run, not a confirmed finding. Do not report this as settled either way.

### 3.2 The governed-but-rejected share of open world is architecturally the review queue's problem, not a vocabulary problem

Restating section 3.1's finding plainly because it changes where effort should go: of representations' and material-contracts' combined 54 open-world candidates, 42 (78%) are the resolver rejecting a candidate it already recognised, for reasons (`_UNCORROBORATED`, `_NOT_EXACT`) that are the same mechanism as the review queue's own rejection reasons. Fixing the open-world/review-queue split is not "give the registry more concepts" for these two families; it is "make the existing corroboration checks recognise real drafting variation", which is section 4's problem, applied to a different output bucket.

## 4. The NOT_IN_QUOTE class: generalises for two of five codes, contested for a third, MAE's 17 are already cleared

Per the second piece of steering: MAE's `CLAUSE_LABEL_NOT_IN_QUOTE` / `CARVEBACK_CLAUSE_LABELS_NOT_IN_QUOTE` fix (`docs/codex-program/notes/mae-clause-label.md`, commit `8df63845`, confirmed committed and clean via `git log --oneline -1 -- lib/canonical-v2/native-producer/mae-clause-label-parse.js` and `git status --short` on the same file) was reported as MAE-specific, on the basis that only two producer-prompt fields anywhere end in `_label`. The steering's challenge, that `_ref` fields (`TERMINATING_PARTY_REF`, `MEETING_REF`, `CONTROL_PARTY_REF`) were never checked and might share the identical structural defect, was checked directly against the resolver code for all five NOT_IN_QUOTE reason codes in the baseline.

The defect MAE had, pre-fix: a scalar reference field (`clause_label`) is required to appear as a literal substring inside a **quote the producer prompt deliberately narrows** to one clause, so a correctly narrowed quote legitimately never restates the label that sits outside it. The fix was not a prompt change; it was checking the label's adjacency against the real admitted section text (with a same-label-sibling fallback for compound clauses), because the model was already right and the checker was checking the wrong thing.

| Reason code | Count | Resolver check (file:line) | What it tests | Same defect shape as MAE? |
|---|---|---|---|---|
| CLAUSE_LABEL_NOT_IN_QUOTE | 12 | `candidate-resolution.js` (MAE handlers) | `clause_label` in narrowed `quote` | Yes. Already fixed and committed. All 12 occurrences in the baseline are from the pre-fix TopBuild run and clear on any re-run; do not count as outstanding. |
| CARVEBACK_CLAUSE_LABELS_NOT_IN_QUOTE | 5 | same | as above, compound carve-out labels | Yes. Same fix, same commit, same "already cleared" status. |
| MEETING_REF_NOT_IN_QUOTE | 4 | `candidate-resolution.js:4470` area, dynamic reason `` `${refField.toUpperCase()}_NOT_IN_QUOTE` `` | `!quote.includes(attrs.meeting_ref)`, bare quote, no widening | **Yes, unfixed.** Identical shape: `meeting_ref` is a separate scalar field alongside `quote` (`"meeting_ref":"<verbatim or null>"` in `proxy-meeting-producer-prompt.js`), checked with the exact pre-fix MAE pattern, no adjacency or sibling fallback at all. |
| CONTROL_PARTY_REF_NOT_IN_QUOTE | 1 | `candidate-resolution.js:4483` | `!quote.includes(attrs.control_party)`, bare quote, no widening | **Yes, unfixed.** Same pattern as MEETING_REF, same file, same missing rescue. |
| TERMINATING_PARTY_REF_NOT_IN_QUOTE | 12 | `candidate-resolution.js:8693` | `!partySupportQuote.includes(terminatingPartyRef)` | **Same defect class, but not a clean "yes".** See below. |

Two real, concrete examples of the TERMINATING_PARTY_REF_NOT_IN_QUOTE failures (`evidence/canonical-v2/modiv-termination-20260806/resolution.json`, both section 7.1(d)): the quotes are `"the Company enters into an Alternative Acquisition Agreement..."` and `"the Company Board shall have effected an Adverse Recommendation Change"`, neither of which names who may terminate on that ground; that fact lives once in the shared chapeau sentence ("This Agreement may be terminated by the Company... if:"), never repeated in each narrow trigger-limb quote. This is the identical structural shape to MAE's carve-out clauses. Unlike MEETING_REF and CONTROL_PARTY_REF, however, this code path is **not** a bare `quote.includes()` check: it already has a `grantContext`/`partySupportQuote` widening mechanism (`candidate-resolution.js:8652-8676`) that appears to have been built for exactly this problem, and it is still failing on these 12. This task did not have time to establish why `grantContext` is not resolving (or not matching) for these specific candidates; that is the one open question standing between "confirmed generalisation" and "fix". Reporting it as a strong, evidence-backed likely-yes, not a proven yes, is the honest position: the field-and-quote *shape* of the defect is confirmed identical to MAE's; whether the existing partial rescue can be repaired the same way MAE's tier 2/3 was, or needs its own fix, is not yet confirmed.

**Bottom line for this steering point: it holds, and should lead the report, for 5 of the 17 previously-unaccounted-for NOT_IN_QUOTE candidates (MEETING_REF + CONTROL_PARTY_REF), with very high confidence given the checked-code match to MAE's own pre-fix pattern. It very likely also holds for the 12 TERMINATING_PARTY_REF candidates, the single largest block in the whole review queue, but that one needs one more investigation step (why the existing widening mechanism is not catching them) before a MAE-style fix can be written with the same confidence.** The committed claim that the defect is MAE-specific should be corrected: it is not MAE-specific, it recurs wherever a producer prompt pairs a narrowed quote with a separate scalar reference field, which several families do.

## 5. The three "produced nothing" families: three different causes, only one a mapping problem

Ben's own commit message (`4788860b`) guesses all three share one cause: "probably means the sections they were pointed at are wrong." Checked directly against the actual document text at each mapped byte range (`tests/fixtures/canonical-v2/mae-definition-family/modiv-raw-fetched.htm`, converted via the real `convertSecHtmlToCanonicalText`, the same pipeline the runner uses, no live model call), this guess is right for one of three.

### 5.1 Appraisal: the mapping is right, the sectionizer's byte range is wrong by 272 bytes

`section-location-scan.json` reports section 2.6 as `heading: "Dissenters' Rights"` (the correct heading, exactly matching APPRAISAL_DISSENTERS_RIGHTS) at byte range 50293-50412. Reading that exact range from the canonical text returns *"r Consideration or Fractional Per OpCo Common Unit Merger Consideration. In the event that..."*, which is a fragment of the following section, 2.7. Searching the same canonical text for the literal string `"Section 2.6 Dissenters"` finds it at byte **50021**, 272 bytes earlier than the sectionizer's reported start. The real, complete Section 2.6 is one sentence: *"Section 2.6 Dissenters' Rights. No dissenters' or appraisal rights shall be available with respect to the Mergers."* The model was never shown this sentence; it was shown 119 bytes of an unrelated adjacent section under a "Dissenters' Rights" label, so its finding literally nothing is fully explained without needing to change the section reference at all. This is a bug in the deterministic sectionizer's own boundary resolution for this one section, not in Ben's choice of "2.6".

Because the real clause is a flat, one-sentence denial with no procedure to describe, fixing the byte range is unlikely to produce more than a single resolved claim ("appraisal rights: not available"). That is still worth having (it is a real, correct fact about the deal), but nobody should expect a rich yield here even after the fix.

### 5.2 Guaranty: the one plausible mapping miss of the three, and the real content may not exist as a dedicated section on this deal

Section 5.11 ("Other Transactions") contains no guaranty language; reading its text shows it governs pre-closing consent for the Company entering into transactions Parent has approved, nothing about a guaranty or a financing party. Searching the whole canonical text for `/guarant/i` (`node -e` scan, 15 hits) finds the one substantive standalone guaranty clause at byte 278108, inside **Section 5.8** ("Directors' and Officers' Indemnification"), already the section mapped to and resolving 4 claims for the DNO_INDEMNIFICATION family: *"Parent hereby fully and irrevocably guarantees the payment and performance of the Surviving Company's and the Surviving OpCo's obligations in this Section 5.8(a)."* Every other guaranty-adjacent hit is either a representation about existing lease guarantors, an interim-covenant restriction on the Company guaranteeing new debt, or release-of-existing-guarantees language tied to the Existing Credit Facility, none of which is the "financing party guarantees the deal" concept the family name suggests. Given this is a stock-for-stock strategic REIT merger with no third-party acquisition financing (confirmed by the runner script's own header describing the deal), it is plausible this agreement simply has no dedicated Guaranty article for GUARANTY_FINANCING_PARTY to find, and the one relevant sentence is already inside DNO_INDEMNIFICATION's scope. The cheap next step is re-testing this family against section 5.8 rather than 5.11; the honest expectation is a thin yield (at most the one sentence above), and that a near-zero result may be the correct answer for this family on this deal type, not evidence of a further mapping error to keep chasing.

### 5.3 Specific performance: not a mapping problem at all. The candidate is dropped after correct extraction, by an over-literal filter

Section 8.8 ("Specific Performance", 3,298 bytes, a perfect heading match) is the richest of the three in real text. The recorded model response (`native-producer-recorded-response-8.8.json`) shows the model extracted the clause correctly and completely:

> "The parties hereto agree that irreparable harm, for which monetary damages (even if available) would not be an adequate remedy, would occur in the event that any party hereto does not perform... Accordingly, the parties acknowledge and agree that the parties hereto shall be entitled to an injunction, specific performance or other equitable relief..."

This is a textbook, complete specific-performance grant: irreparable harm, inadequate remedy at law, entitlement to injunctive relief, all present. Yet `resolution_receipt.counts.compiled_candidates` is 0, and `run-receipt.json`'s `evidence_residual_count` is 1, with `reason: "SPECIFIC_PERFORMANCE_OPERATIVE_PREMISE_UNVERIFIED"`. The cause is `isIncompleteSpecificPerformanceGrant` (`lib/canonical-v2/native-producer/anthropic-provider.js:1188-1195`), which is meant to catch grants of injunctive relief that never establish the underlying premise, but does so with two regexes checked against the literal quote:

```js
!(/\birreparable harm would occur\b/i.test(assertion.quote)
  && /\bmoney damages would not be an adequate remedy\b/i.test(assertion.quote));
```

The real clause reads "irreparable harm, **for which** monetary damages... would not be an adequate remedy, **would occur**" (harm and "would occur" separated by a relative clause) and says "**monetary** damages", not "money damages". Neither regex matches this entirely standard, common phrasing, so the filter wrongly classifies a complete grant as incomplete and routes it to `evidence_residuals`, where it is dropped before ever being counted as a compiled candidate. This is a code bug with an exact location, unrelated to section mapping (the section is exactly right), and worth flagging as higher-value than its single-candidate count on Modiv suggests: "monetary damages" versus "money damages" and this exact relative-clause structure are both extremely common in real drafting, so this narrow pair of regexes is likely to misfire on a large share of future deals' specific-performance clauses, not just this one.

## 6. Fix plan, ordered by leverage (claims unblocked per unit of work)

"Unblocked" below means candidates that become visible, resolvable, or safely writable; it does not mean every one of them will end up `resolved` rather than correctly queued or open-world, since some genuinely belong in review.

| # | Fix | Families | Candidates affected | Effort | Confidence |
|---|---|---|---|---|---|
| 1 | Verify and commit the already-written interim-operating fix (`sole-remedy-resolution.js` / `ioc-mechanic-resolution.js`, copy instead of alias `openWorld` on the disabled branch), then re-run interim operating live | INTERIM_OPERATING | Unblocks an entire family currently producing zero visible output; replay shows 10 resolved / 54 queued / 46 open world once unblocked | Near zero: the code change already exists uncommitted, only verification and a live re-run remain | High. Directly reproduced clean against the current working tree. |
| 2 | Extend MAE's adjacency-verification pattern to `meeting_ref` and `control_party` in the proxy-meeting resolver | PROXY_MEETING | 5 (4 MEETING_REF_NOT_IN_QUOTE + 1 CONTROL_PARTY_REF_NOT_IN_QUOTE) | Low: same design, same helper shape as the already-shipped MAE fix, arguably reusable code, not just a reusable pattern | High. Resolver check confirmed byte-for-byte identical in shape to MAE's pre-fix check. |
| 3 | Investigate why `grantContext` is not rescuing TERMINATING_PARTY_REF_NOT_IN_QUOTE, then apply the same fix if the mechanism is repairable | TERMINATION | 12, the single largest block in the review queue | Medium: needs a diagnosis step first (this task did not complete it), then likely a low-effort fix given the rescue mechanism already exists | Medium-high on the diagnosis (defect shape confirmed), not yet confirmed on the specific repair |
| 4 | Add `answer_provenance` to the NO_OTHER_REPS_FRAUD claim-finalisation path in `handleNoOtherRepsCandidate` | NO_OTHER_REPS_FRAUD | 3 resolved claims currently blocked from being confirmed safe to write, plus restores visibility into this family's true queued/open-world counts (currently unknown past the crash point) | Low: one field, following the exact pattern already used elsewhere in the same file | High. Root cause reproduced with a full stack trace from real evidence. |
| 5 | Port `EXCHANGE_MECHANICS`, `PRORATION_FORMULA` (`prorationMechanics`) and `WITHHOLDING` (`CONSID-WITHHOLD`) from V1's rubric into V2's CONSIDERATION family as governed claim types | CONSIDERATION | 17 of 20 open-world candidates (85%) | Medium: real design/wiring work (new claim definitions, prompt fields, resolver handlers), but the legal-judgement question is already answered in `lib/rubric.js`, which is most of what makes a new family expensive | High on "these concepts already exist and are well-specified in V1"; medium on exact resolved/queued/open-world split once wired, since some will still need corroboration |
| 6 | Widen `REAL_ESTATE`'s synonym list in `MATERIAL_CONTRACT_BUCKET_META` (e.g. admit "Space Lease", "Ground Lease"), then check whether the same regex-breadth issue explains the other 22 governed-but-uncorroborated material-contracts candidates | MATERIAL_CONTRACTS | At least 2 confirmed (the REAL_ESTATE pair checked directly); the remaining ~20 are plausible but not individually checked | Low per fix, medium to check all buckets | High on the one checked example; inferred, not confirmed, for the rest |
| 7 | Widen `isIncompleteSpecificPerformanceGrant`'s two regexes (accept "monetary" as well as "money"; tolerate the relative-clause structure, or check the underlying premise/conclusion as separate matches rather than one fixed phrase) | SPECIFIC_PERFORMANCE_REMEDIES | 1 on Modiv, but this is boilerplate present in nearly every merger agreement, so the real leverage is future-deal risk retirement, not this one candidate | Very low: two regex edits with a clear, already-identified real-world counterexample to test against | High |
| 8 | Fix the deterministic sectionizer's boundary resolution for section 2.6 (or, more valuably, establish whether this off-by-272-bytes class of error affects other sections on this or other deals, since it is a shared module) | APPRAISAL_DISSENTERS_RIGHTS, and potentially any family relying on the same sectionizer | 1 claim on Modiv; unknown, unquantified blast radius elsewhere, which is the real reason to prioritise this above its own candidate count | Low for the one instance; the investigation into blast radius is the part worth doing before treating this as "done" | High that this specific offset is real and reproducible; open on how widely the underlying sectionizer defect reaches |
| 9 | Re-test GUARANTY_FINANCING_PARTY against section 5.8 instead of 5.11, and make the judgement call on whether this family is genuinely near-inapplicable to stock-for-stock strategic deals | GUARANTY_FINANCING_PARTY | At most 1 (the D&O-adjacent guaranty sentence already visible to DNO_INDEMNIFICATION) | Very low to test | Medium: mapping problem confirmed, but low expected yield even once fixed |
| 10 | Retry-on-parse-failure (or a bounded single retry) for closing conditions' call 2, rather than treating one malformed response as fatal to the whole run | CLOSING_CONDITIONS | Recovers 3 of 4 planned calls (6.2, 6.3, 6.4) that never ran | Low, but this is a policy change (the zero-retry design is deliberate and documented), not a bug fix, so it needs a decision, not just a patch | Medium: the fix is easy; whether to make it is a judgement call outside this task's scope |
| 11 | Decide a remedy for capitalisation's 600-second timeout (raise the timeout, split the section, or accept and re-run) | CAPITALISATION | Unblocks an entire family | Unclear until a remedy is chosen; this is an infrastructure/operational question, not a code defect with a line number | Low on root cause beyond "this section is large and slow"; no fix recommended here, only options |
| 12 | Field-by-field V1 cross-check of representations' TEMPORAL/THRESHOLD/ACCURACY qualifier kinds, and the remainder of representations' and material-contracts' governed-but-uncorroborated items | REPRESENTATIONS, MATERIAL_CONTRACTS | Up to 19 (representations) + 20 (material-contracts' non-REAL_ESTATE items) | Medium: same method as section 3.1's consideration check, just not yet run to completion | Not yet established; flagged as the next sweep, not claimed here |
| 13 | Investigate the UNCORROBORATED review-queue class as a whole (50 candidates, roughly 19 distinct reason codes) for the same two remedies termination fee already needed once: widening a vocabulary, widening a search scope | Spread across ANTITRUST_REGULATORY, PROXY_MEETING, DNO_INDEMNIFICATION, NO_SHOP, and others | Up to 50 | Unknown until scoped | Low. This task only examined the aggregate shape of this class (via the baseline's reason tally, independently reproduced), not individual mechanisms. Named here as the next sweep's most likely target by volume, not diagnosed. |

### Not worth fixing, or not yet

- **MAE's CLAUSE_LABEL_NOT_IN_QUOTE (12) and CARVEBACK_CLAUSE_LABELS_NOT_IN_QUOTE (5)** in the baseline file are already fixed and committed (`8df63845`). They will clear on the next TopBuild run. Do not re-diagnose or re-fix; re-run and confirm instead.
- **Chasing a richer yield for appraisal beyond the byte-offset fix.** The real Section 2.6 is one sentence with nothing else to extract. Fix the boundary, expect one claim, move on.
- **A single global find-and-replace fix for every NOT_IN_QUOTE code at once.** MAE's own design note is explicit that its tier-3 sibling logic is proven for compound carve-out clauses specifically and was deliberately left off the TRAILING_LIST path, which has a different, legitimately-correct check. The same discipline applies here: MEETING_REF and CONTROL_PARTY_REF look safe to fix the same way (section 4); TERMINATING_PARTY_REF needs its own investigation first, because a rescue mechanism already exists there and is failing for an unknown reason, so patching over it without understanding why risks masking a second, different bug.
- **Capitalisation's timeout as a code fix.** There is no line to point to; this needs an operational decision (timeout budget, or accept occasional re-runs), not a patch, and forcing it into the "our code is broken" bucket would misstate what was found.

## 7. Verification

```
CI=true npm test > /tmp/agg.log 2>&1; echo "EXIT=$?"
```

Result: `EXIT=0`. This task's own change is this document plus throwaway diagnostic scripts run from `/tmp` (never added to the repository); nothing under version control was modified by this task, so this is confirming the suite is unaffected, not that a fix landed clean.
