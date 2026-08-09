# SOL adversarial review: Stage 2Y

Date: 2026-08-09  
Review posture: independent, different-vendor, read-only review. No implementation.

## Verdict

Do not execute Stage 2Y as written.

The resolver does not need a wholesale structural rewrite. The proposed context,
defined-term, numeral, deduplication and reconciliation changes fit the existing
producer, resolver and replay architecture.

One structural correction is required before unattended use. Resolution and
publication must become separate, first-class states. A claim can currently be
both in `resolved` and in `review_queue`. The live runner sends every `resolved`
claim to the write-set adapter. The adapter does not persist `triage` or
`auto_pass`. Stage 2Y-0A therefore starts from the wrong premise. The system does
have a front-fill path. It does not have a publication boundary that consumes the
proposed gate.

The required change is bounded but fundamental at that boundary:

1. Mint a versioned publication disposition for each resolved claim.
2. Carry that disposition through the write set, validation, storage and serving
   paths.
3. Fail closed when its calibration artefact is absent, stale or does not bind the
   exact resolver, registry, prompt and source digests.
4. Keep review routing separate. A queue entry is an audit or correction task. It
   must not implicitly mean either published or unpublished.

Do not replace the overall extractor or resolver. Do not build a second parallel
pipeline.

## Findings

### 1. Blocker: the plan branch and the evidence branch do not contain the same system

The Stage 2Y corpus was generated at `7535782a` on
`origin/cursor/step-2x-free-phase-b641`. The current Stage 2Y documentation branch
is `2a2f7e85`. Their merge base is `2bfad4c2`, not `7535782a`.

This is substantive, not line-number drift:

- At `7535782a`, `anthropic-provider.js` contains
  `shapeMaeDefinitionLimbAssertionProposals` and mints the common limb key from
  three shapers. The current branch has no such function and its header names only
  two shapers.
- At `7535782a`, `structure-placement.js` and `governing-structure.js` exist and
  `candidate-resolution.js` attaches `structure_context`. Those modules are not
  present on the current branch.

Step 2Y-G cannot suppress the named MAE duplicate at its proposed minting site on
the current branch because that minting site is absent. Step 2Y-A cannot simply
consume a current-branch `structure_context` service because that service is also
absent.

Required correction: choose and integrate the governing code baseline before any
2Y implementation. Then regenerate the register and re-derive every code site.
Treating this as citation drift will produce changes against the wrong program.

Evidence:

- `docs/core/PLAN.md:2865`
- `lib/canonical-v2/native-producer/anthropic-provider.js:29`
- Commit `7535782a`,
  `lib/canonical-v2/native-producer/anthropic-provider.js:2344`
- Commit `7535782a`,
  `lib/canonical-v2/native-producer/structure-placement.js`

Commands:

```sh
git rev-parse HEAD 7535782a
git merge-base HEAD 7535782a
git grep -n "shapeMaeDefinitionLimbAssertionProposals" 7535782a -- lib/canonical-v2/native-producer/anthropic-provider.js
rg -n "shapeMaeDefinitionLimbAssertionProposals" lib/canonical-v2/native-producer/anthropic-provider.js
git grep -n "structure_context" 7535782a -- lib/canonical-v2/native-producer
rg -n "structure_context" lib/canonical-v2/native-producer
```

### 2. Critical: Step 2Y-0A misidentifies the publication boundary

`finalizeResolvedCandidate` pushes a claim into `resolved` before it checks
`autoPass`. If `autoPass` is false, the same claim is also pushed into
`reviewQueue`.

The live runner then replaces `run_receipt.compiled_candidates` with every
`resolution.resolved[].compiled_candidate` and sends that list to
`buildNativeWriteSet`. The adapter writes those claims. The local staging reader
states that `triage` is pipeline-only and is never written to a table.

Therefore:

- `auto_pass: false` means "also queue this resolved claim" in this path.
- It does not mean "do not write or publish this claim".
- Removing the three absent conditions cannot, by itself, create an unattended
  publication path. It changes queue membership.
- A new run-time gate that is not consumed at the adapter, validator and serving
  boundary is theatre.

Step 2Y-0A must start with an end-to-end state transition and threat model. Its
acceptance test cannot be only "at least one family publishes unattended". It
must include a negative proof that an ineligible claim cannot enter the
publishable write set or any serving projection.

Evidence:

- `lib/canonical-v2/native-producer/candidate-resolution.js:5868`
- `scripts/canonical-v2-live-extraction-run.mjs:2053`
- `lib/canonical-v2/native-producer/native-write-set-adapter.js:940`
- `lib/canonical-v2/local-staging-deal-reader.js:325`
- `docs/core/PLAN.md:3454`

Commands:

```sh
sed -n '5850,5915p' lib/canonical-v2/native-producer/candidate-resolution.js
sed -n '2040,2075p' scripts/canonical-v2-live-extraction-run.mjs
sed -n '930,1085p' lib/canonical-v2/native-producer/native-write-set-adapter.js
sed -n '305,335p' lib/canonical-v2/local-staging-deal-reader.js
```

### 3. Critical: the context defect is larger than the documented line slice

The single-newline slice is real. `sourceParagraphForCandidate` returns only the
line that contains `claim.raw_value`.

It has a second defect. It uses `sourceText.indexOf(claim.raw_value)`, so it binds
the first byte-identical occurrence in the whole agreement. It does not use the
candidate's evidence offsets, and it does not use `entry`. A repeated phrase can
therefore acquire the chapeau of a different occurrence.

Step 2Y-A must bind context from the candidate's verified evidence span. It must
then walk only the structural ancestor chain for that occurrence. A whole-section
or sibling-group window is unsafe as a corroboration input because a separate
sibling can contain the token needed to corroborate the wrong claim.

The plan also overstates the readiness of `structure_context`. In the committed
F28 fixture at the evidence commit, only 3 entries are `RESOLVED`; 37 are
`UNDETERMINED`. All 6 review entries and all 31 open-world entries are
`UNDETERMINED`, because those flattened rows carry no evidence span. The service
cannot recover held and open-world claims until their verified source span is
carried to placement.

Required order:

1. Preserve the exact evidence span on every held and open-world row.
2. Resolve a structural path from that span.
3. Build a typed context object with separate leaf, ancestors and siblings.
4. Let each corroborator request only the fields it needs.
5. Do not pass one concatenated text window to every regex.

Evidence:

- `lib/canonical-v2/native-producer/candidate-resolution.js:5615`
- Commit `7535782a`,
  `lib/canonical-v2/native-producer/structure-placement.js:91`
- Commit `7535782a`,
  `tests/fixtures/canonical-v2/f28-third-live-run/resolution.json`
- `docs/core/PLAN.md:3514`

Commands:

```sh
sed -n '5608,5645p' lib/canonical-v2/native-producer/candidate-resolution.js
rg -n "sourceParagraphForCandidate\\(" lib/canonical-v2/native-producer/candidate-resolution.js
git show 7535782a:tests/fixtures/canonical-v2/f28-third-live-run/resolution.json | jq '[.resolved[],.review_queue[],.open_world[] | .structure_context.status] | group_by(.) | map({status:.[0],count:length})'
git show 7535782a:tests/fixtures/canonical-v2/f28-third-live-run/resolution.json | jq '{review:([.review_queue[].structure_context.status]|group_by(.)|map({status:.[0],count:length})),open_world:([.open_world[].structure_context.status]|group_by(.)|map({status:.[0],count:length}))}'
```

### 4. High: the "91 with zero genuine conflicts" premise is false

The count of 91 occurrences is correct. The zero-conflict conclusion is not.

The diagnostic note measured only whether a short qualifier quote contained a
literal standard that differed from the model's code. A null derivation is not a
conflict, so that test found zero. It did not compare the model code with the
agreement's definition.

TopBuild demonstrates the missing test. Its definition applies the same standard
to both Company and Parent: "actual knowledge ... after due inquiry". Yet the
committed resolution file has five Parent qualifiers tagged `ACTUAL` and four
Company qualifiers tagged `AFTER_INQUIRY`. The same definition cannot justify
that party-based split. At least one model treatment is wrong or the three-value
enum cannot represent the composite definition.

This makes Step 2Y-D a prerequisite to Step 2Y-B for knowledge standards. Before
the model can be a fallback, the system must:

- resolve the agreement's own definition;
- define how composite standards such as actual knowledge after due inquiry map
  to the codebook;
- refuse when model output and the definition disagree; and
- test both parties against the same definition.

Do not use the 82-row null-derivation result as evidence that model deferral is
safe.

Evidence:

- `docs/codex-program/notes/stage-2y/diag-gap-reps-mae.md:49`
- `lib/canonical-v2/native-producer/candidate-resolution.js:2200`
- `lib/canonical-v2/native-producer/candidate-resolution.js:9635`
- Commit `7535782a`,
  `evidence/canonical-v2/topbuild-representations-20260809-2xk-r3-final/resolution.json`
- Commit `7535782a`,
  `evidence/canonical-v2/topbuild-representations-20260809-2xk-r3-final/adapter-result.json`

Commands:

```sh
sed -n '2188,2210p' lib/canonical-v2/native-producer/candidate-resolution.js
sed -n '9600,9665p' lib/canonical-v2/native-producer/candidate-resolution.js
git show 7535782a:evidence/canonical-v2/topbuild-representations-20260809-2xk-r3-final/resolution.json | jq -r '.open_world[] | select(.reason_code == "REPRESENTATION_KNOWLEDGE_STANDARD_UNCORROBORATED") | [.canonical_value,.raw_value] | @tsv' | sort | uniq -c
git show 7535782a:evidence/canonical-v2/topbuild-representations-20260809-2xk-r3-final/adapter-result.json | jq -r '.admitted_source_contexts[0].canonical_text.text' | rg -n -i 'actual knowledge.*after due inquiry'
```

### 5. High: the 4,241 arithmetic closes, but the diagnosis-completeness claim does not

The corpus arithmetic is correct:

- 4,141 cards.
- 5,002 claim rows.
- 4,241 reason-code occurrences.
- 762 HELD reason occurrences.
- 2,692 OPEN_WORLD reason occurrences.
- 787 RESOLVED-blocked reason occurrences.
- 106 distinct reason codes.

The 762 figure is not 762 held claims. The HTML contains 739 held claim rows,
some with more than one reason. This distinction matters when the plan estimates
recovery, adjudication cost or human workload.

The plan's first sentence says every one of the 4,241 occurrences was diagnosed
to a mechanism. Later it names about 73 occurrences that are not diagnosed to a
fix. The register correction says the 90 stale rows were "closed", while the
supporting notes preserve uncertain tails and one note is marked `IN PROGRESS`.
These statements cannot all be true.

Step 2Y-K is therefore a prerequisite to a final completeness claim, not a
cleanup step after the architecture and sweeps. Re-stamp the register with an
explicit status vocabulary such as `MECHANISM_CONFIRMED`, `LIKELY_MECHANISM`,
`CORRECT_ABSTENTION` and `UNDIAGNOSED`. Do not replace stale `UNDIAGNOSED` with a
single optimistic status.

Evidence:

- `docs/codex-program/notes/stage-2y/unresolved-register.json:2`
- `docs/core/PLAN.md:2867`
- `docs/core/PLAN.md:3084`
- `docs/core/PLAN.md:3889`
- `docs/codex-program/notes/stage-2y/diag-gap-reps-mae.md:4`

Commands:

```sh
jq '[.rows[].count] | {rows:length,sum:add}' docs/codex-program/notes/stage-2y/unresolved-register.json
jq '[.rows[] | {state,count}] | group_by(.state) | map({state:.[0].state,rows:length,occurrences:(map(.count)|add)})' docs/codex-program/notes/stage-2y/unresolved-register.json
jq '[.rows[] | select(.fix_class == "UNDIAGNOSED") | .count] | {rows:length,sum:add}' docs/codex-program/notes/stage-2y/unresolved-register.json
git show 7535782a:evidence/canonical-v2/corpus-review-20260809.html | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const by={};let reasons=0;for(const [,state,body] of s.matchAll(/<li data-state="([^"]+)">([\\s\\S]*?)<\\/li>/g)){by[state]=(by[state]||0)+1;const m=body.match(/<div class="reasons">([\\s\\S]*?)<\\/div>/);if(m)reasons+=m[1].replace(/<[^>]+>/g,"").trim().split(/\\s*[·,]\\s*/).filter(Boolean).length;}console.log({by,reasons});})'
```

### 6. High: the 707/713 result is correct, but its ownership is branch-specific

The corpus contains exactly 713 `UNMAPPED_GENERIC_CLAIM_KEY` occurrences. Exactly
707 carry `NATIVE_CAPITALISATION_LIMB_ASSERTION_CANDIDATE`. The remaining six are
four fraud-carveout, one wilful-breach and one independent-investigation key.

At evidence commit `7535782a`, the common limb key is minted by capitalisation,
MAE-definition and representations shapers. On the current branch, it is minted
by only capitalisation and representations shapers. The count is valid for the
evidence snapshot. The proposed code ownership is not valid until finding 1 is
resolved.

The deeper diagnosis is sound. One generic identity is being used as both a
structural limb carrier and a prospective semantic claim. Step 2Y-H should not
make the structural carrier itself mean "representation topic present". Preserve
the carrier, then derive a separate topic claim with its own identity and
provenance. This prevents a future structural consumer from depending on a
taxonomy choice.

Evidence:

- `docs/codex-program/notes/stage-2y/unresolved-register.json:27`
- `docs/codex-program/notes/stage-2y/diag-unmapped-lexical.md:44`
- Commit `7535782a`,
  `lib/canonical-v2/native-producer/anthropic-provider.js:2344`
- `lib/canonical-v2/native-producer/anthropic-provider.js:253`

Command:

```sh
git show 7535782a:evidence/canonical-v2/corpus-review-20260809.html | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const keys={};let total=0;for(const [,state,body] of s.matchAll(/<li data-state="([^"]+)">([\\s\\S]*?)<\\/li>/g)){const m=body.match(/<div class="reasons">([\\s\\S]*?)<\\/div>/);if(!m||!m[1].includes("UNMAPPED_GENERIC_CLAIM_KEY"))continue;total++;const k=(body.match(/<b>([^<]+)<\\/b>/)||[])[1];keys[k]=(keys[k]||0)+1;}console.log({total,keys});})'
```

### 7. High: the calibration artefact is not yet safe as a run-time authority

Step 2Y-0A proposes to turn the 2Y-0 sweep output into a run-time input. The plan
does not define the authority contract for that input.

A safe gate needs, at minimum:

- an immutable schema and version;
- the exact corpus, source, prompt, model, registry, resolver and adjudication
  rubric digests;
- the selected rung per family and mechanism;
- sample sizes, confidence intervals and expiry or drift rules;
- the identity and calibration score of each adjudicator;
- an explicit product-approved false-publication threshold;
- fail-closed handling for missing families, new claim kinds and stale digests;
- a per-family kill switch and rollback receipt; and
- a decision trace stored on each claim.

An adjudicator disagreement rate per family and mechanism is not a sufficient
claim-level risk score. Three models can agree because they share the same blind
spot. Queue priority must also use direct signals such as structural uncertainty,
definition ambiguity, novelty, unsupported model deferral, materiality and party
attribution.

The no-default product decision in Step 2Y-0A is a real stop. Resolver recovery
work can proceed inertly. Unattended activation cannot.

Evidence:

- `docs/core/PLAN.md:3207`
- `docs/core/PLAN.md:3454`

### 8. High: automatic open-world promotion is unsafe as described

Three deals can justify a promotion proposal. They cannot justify unattended
mutation of the active taxonomy.

Step 2Y-J mixes two operations:

1. detect a recurring concept; and
2. promote it into governed production language.

The first can run automatically. The second must create a versioned registry
change with adjudicated evidence, compatibility analysis and an activation
decision. Reversibility after bad claims have entered precedent search is not an
adequate safety control.

The acceptance condition should say that a new deal automatically produces a
promotion candidate. It should not require the new concept to become governed
without a registry approval.

Evidence:

- `docs/core/PLAN.md:3856`

### 9. Medium: ladder ownership and activation order are internally inconsistent

Step 2Y-0 says every step from 2Y-A through 2Y-J ships rung-selectable and
defaults to rung 0. The ladder table defines rungs only for A, B/C, D, E, F and
H. It defines no ladder for G, I or J. Duplicate suppression, qualifier-kind
dispatch and promotion are not ordinary looseness dials.

Define each as one of:

- a binary feature switch with its own acceptance test;
- a true ordinal ladder; or
- outside the joint rung configuration.

Do not let the joint gate silently omit three implemented mechanisms. Also run
Step 2Y-K before the final joint confirmation, because otherwise the final
denominator still contains an unresolved tail whose mechanism may overlap a
selected rung.

Evidence:

- `docs/core/PLAN.md:3225`
- `docs/core/PLAN.md:3257`
- `docs/core/PLAN.md:3756`
- `docs/core/PLAN.md:3822`
- `docs/core/PLAN.md:3856`

### 10. Medium: the registry lint promises more than a shell lint can prove

A lint can ban known local declarations and require imports from a registry. It
cannot generally prove that two different regular expressions or phrase lists
encode the same meaning. The current acceptance test, which reintroduces an
exact inline duplicate, proves only exact-pattern enforcement.

State the narrower guarantee. Add registry-consumption tests at resolver call
sites and near-miss corpus tests. Do not describe the lint as preventing semantic
duplication.

Evidence:

- `docs/core/PLAN.md:3608`

## Corrected execution order

1. Integrate the evidence code baseline and regenerate the corpus register.
2. Define the end-to-end resolution, review and publication state machine.
3. Finish Step 2Y-K and re-stamp the register with confidence levels.
4. Preserve evidence spans on held and open-world rows. Build the structural
   context service from those spans.
5. Build the calibration harness and its immutable authority contract.
6. Run a small corroboration vertical slice. Do not migrate tables before this
   answers whether they remain load-bearing.
7. Implement A through J inertly, with explicit ladder or binary ownership.
8. Resolve agreement definitions before enabling model fallback for knowledge or
   party semantics.
9. Run individual sweeps, joint confirmation and leave-one-out attribution.
10. Implement publication disposition at the write and serving boundary. Prove
    negative exclusion paths.
11. Run the prompt bump once.
12. Run the final ladder and blind re-score.
13. Activate one family only after the product false-publication threshold is
    explicit. Monitor and retain an immediate per-family kill switch.

## Arithmetic and spot-check disposition

| Item | Result |
|---|---|
| 4,241 reconciliation | Confirmed exactly as reason-code occurrences. Not 4,241 unique claims. |
| 91 knowledge-standard occurrences | Count confirmed. "Zero genuine conflicts" rejected because the test did not read definitions and TopBuild is internally inconsistent. |
| 707/713 identical limb key | Confirmed exactly for commit `7535782a`. Proposed minting ownership does not match the current branch. |
| `sourceParagraphForCandidate` line slice | Confirmed. Also uses the first global text match instead of the verified evidence occurrence. |
| Fundamental overall rewrite | Not required or desirable. A first-class, end-to-end publication-disposition boundary is required. |

---

## Comparison with Fable's review

This section was added after the independent report above was complete. The
independent findings were not changed.

### Agreement

Both reviews conclude that the claim identity model and the producer/resolver
split should remain. Both confirm the single-line context defect, the 4,241
arithmetic, the 707/713 common limb key, permanent false `auto_pass`, and the
need to resolve agreement-defined knowledge standards before model fallback.

Both also find that the corroboration sweep should precede wholesale registry
migration, and that the initial calibration design needed seeded errors,
confidence intervals, explicit denominators and leave-one-out attribution.

### Material disagreement

Fable says there is no unattended publication path because `auto_pass` is
permanently false. That conclusion does not follow from the code. The resolver
adds an entry to `resolved` before queue routing. The live runner sends all
resolved compiled candidates to the adapter. The adapter writes them, and
`triage` is not persisted. `auto_pass` controls review-queue duplication in this
path, not write eligibility.

This changes the structural answer. The missing component is not merely a way to
open the existing `auto_pass` gate. The missing component is a real publication
disposition consumed at the write, validation and serving boundary. Step 2Y-0A
must be rewritten around that boundary before implementation.

### Additional findings not in Fable

1. The current documentation branch diverged before the evidence commit. Its
   code lacks both the MAE limb shaper and structure-placement modules used by
   the plan. Fable treated the mismatch as line-number drift.
2. `sourceParagraphForCandidate` uses the first global `indexOf` match, not the
   verified occurrence. This can attach the wrong chapeau even after the line
   window is widened.
3. The committed structure fixture has 37 of 40 entries `UNDETERMINED`. Every
   review and open-world entry is undetermined because its flattened row lacks
   an evidence span.
4. TopBuild gives direct evidence beyond Fable's general caveat. The same
   composite definition yields `ACTUAL` for Parent and `AFTER_INQUIRY` for the
   Company. The model labels are internally inconsistent.
5. The 4,241 corpus was re-parsed. Fable expressly did not re-derive it. The
   exact reconciliation holds, with 739 held claims carrying 762 held reason
   occurrences.
6. The run-time calibration artefact lacks an authority and freshness contract.
7. Three-deal recurrence can create an automatic promotion proposal, but must
   not mutate the active taxonomy unattended.
8. Steps G, I and J are included in the claim that A through J are
   rung-selectable, but have no rungs in the ladder table.

### Process note

Before the independent report was written, one broad `rg` command used a
shell-expanded `*.md` path. It unintentionally returned isolated matching lines
from Fable's file despite the intended exclusion glob. The full Fable review was
not opened until after the independent report was saved. The accidental excerpts
were a clean-room protocol breach and are disclosed here. Every independent
finding above cites direct code, corpus or register evidence.
