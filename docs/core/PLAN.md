# The plan

This document and `COMPLETED.md` are the whole picture. Nothing is in both.
A step lives here until it is closed, then it moves to `COMPLETED.md` carrying
the evidence that closed it. If a step is in neither file, it is not planned
and it has not happened.

It supersedes `ROADMAP.md`, `WORK-COMPLETED.md` and `EXECUTION-LEDGER.md`.

**Every number below carries the command that produced it.** This project has
retracted several confident figures that came from plausible reasoning rather
than measurement. If you cannot re-run the command, do not trust the number,
and do not add a number of your own without one.

---

## 1. What we are building

A tool that reads merger agreements, pulls the negotiated terms out of them as
structured facts, and shows those facts on a review page so a lawyer can read
one deal properly and compare it against others.

There are two systems inside it.

**The old system, V1.** Live today at `precedent-machine.vercel.app`. It parses
40 filed agreements, classifies clauses and renders review tables. It works and
is what a user sees now.

**The new system, Canonical V2.** Built alongside V1 over months. It differs in
one way that matters legally: it never asserts a negative. It reports what it
found, with the exact quote that backs it, and "this deal has no such term" is
derived later from proven coverage rather than guessed by a model. It has 25
registered section families (a family is one subject area, for example
termination fees or the MAE definition), each with its own prompt, resolver and
projection into review-page rows.

**Completion is: V2 data, extracted from real agreements, stored in a database,
rendered on the review page next to V1, for every family worth showing, on a
site that requires a login.**

---

## 2. What is true today, measured

Run these yourself. They take seconds.

| Fact | Value | Command |
|---|---|---|
| Registered section families | 25 | `node -e "console.log(require('./lib/canonical-v2/native-producer/producer-prompt-registry.js').listRegisteredSectionFamilies().length)"` |
| Live extraction runs on disk | 25 directories | `ls -d evidence/canonical-v2/*20260806* \| wc -l` |
| Of those, run against Modiv | 24 | see section 3, run-provenance |
| Of those, run against TopBuild | 1 (MAE_DEFINITION only) | same |
| Claims resolved across all 25 runs | 108 | `docs/codex-program/notes/all-families-baseline-20260806.json`, `totals.resolved` |
| Claims queued for human review | 203 | same, `totals.queued` |
| Candidates with no governed slot at all | 193 | same, `totals.open_world` |
| Runs that did not finish | 4 | same, `incomplete` |
| Families that resolved zero claims | 11 of the 21 that finished | see section 3 |
| Rows of V2 data written to any database | 0 | `grep -rniE "INSERT INTO\|UPDATE .* SET" lib/canonical-v2/` returns nothing |
| Product surfaces the parity register still blocks | 102 of 143 | `node -e "const {CURRENT_M3_FAMILY_PARITY_REGISTER,listM3ProductParityBlockers}=require('./lib/canonical-v2/native-producer/m3-family-parity-register.js');console.log(listM3ProductParityBlockers(CURRENT_M3_FAMILY_PARITY_REGISTER).length)"` |
| Pre-production gates declared | 25, all OPEN | `node -e "const Y=require('yaml'),f=require('fs');console.log(Y.parse(f.readFileSync('docs/codex-program/programme-gates.yaml','utf8')).programme_gate_registry.preproduction_gates.length)"` |
| Of those, with any acceptance criteria | 5 | section 5 below |
| Mandatory adversarial tests, implemented | 7 of 289 | `node -e "const {MANDATORY_ADVERSARIAL_TEST_IDS,testExecutableState}=require('./lib/programme-gates/test-executable-registry.js');console.log(MANDATORY_ADVERSARIAL_TEST_IDS.filter(id=>testExecutableState(id)==='IMPLEMENTED').length)"` |
| Lines of database schema written | 8,686 | `wc -l supabase/canonical-v2-foundation.sql` |
| Times that schema has been executed | 0 | its nine tests pattern-match its source text: `grep -L "new Pool\|\.query(" tests/canonical-v2-writer-*-identity-sql.test.js` lists all of them |
| API routes using the service key | 19 | `grep -rl getServiceSupabase pages/api/ \| wc -l` |
| Authentication | built, enforced, 101 real-request tests pass | `CI=true node --test tests/auth-route-enforcement.test.js` |

**Read this before you read anything else.** The extraction pipeline is proven
across 25 families on essentially one agreement. Nothing has been imported into
the product's database. Nothing V2 renders on the live site. The schema for the
import exists and has never been executed. One family, termination fees, serves
V2 data on a preview deployment, and it does so from a hand-typed fixture file,
not from a database. The volume of work behind this is large and it has not yet
reached a user.

---

## 3. Two corrections this plan makes to the existing record

Both were measured while writing it. Neither appears in the notes or the
commits.

**The 25-family sweep was not 25 families against Modiv.** It was 24 against
Modiv and MAE_DEFINITION against TopBuild. `ROADMAP.md` says "Every registered
section family... was dispatched against Modiv in a single sweep". It was not.
MAE_DEFINITION has no Modiv baseline at all, so it has no controlled comparison
to re-run against.

```
node -e "const b=require('./docs/codex-program/notes/all-families-baseline-20260806.json');
console.log('modiv',b.per_family.filter(f=>f.dir.startsWith('modiv')).length,
'topbuild',b.per_family.filter(f=>f.dir.startsWith('topbuild')).length)"
```
gives `modiv 24 topbuild 1`.

**Authentication is built and shipped, and the roadmap says it is not.**
`ROADMAP.md` step S2 reads "No `middleware.js` at HEAD, no auth dependency in
`package.json`", and Part 6 lists "There is no authentication" as risk 3. There
is a `middleware.js` at HEAD, added in commit `2396bf50` on 5 August, with
`lib/auth/gate.js`, `lib/auth/session.js`, `lib/auth/cookies.js`,
`lib/auth/credentials.js`, `pages/login.js` and `pages/api/auth/{login,logout,session}.js`
behind it. It fails closed: no `SESSION_SECRET` means every request is refused.
`tests/auth-route-enforcement.test.js` starts a real Next server and makes real
HTTP requests; 101 tests, all passing. Verify with `ls middleware.js` and
`git log -1 --format='%h %ad %s' --date=short -- middleware.js`.

What is genuinely unknown is whether the deployed site has `AUTH_PASSWORD` and
`SESSION_SECRET` set, which is what makes the gate real rather than dormant.
That is Step 7A, and only Ben can answer it.

**A third figure worth having.** Of the 108 resolved claims, 34 belong to
Merger Structure (20) and Miscellaneous Boilerplate (14), the two families whose
projection modules `ROADMAP.md` section 2.3 calls dead code. Just under a third
of everything the sweep resolved cannot currently render anywhere.

```
node -e "const b=require('./docs/codex-program/notes/all-families-baseline-20260806.json');
const p=b.per_family.filter(f=>/merger-structure|misc-boilerplate/.test(f.dir));
console.log(p.map(f=>f.dir+'='+f.resolved).join(' '))"
```

---

## 4. Where knowledge is stored

When a step says "widen the vocabulary", this table says which file. Every path
below was opened and confirmed, not inferred from its name.

### The extraction pipeline (Canonical V2)

| What | Where | Note |
|---|---|---|
| Which families exist | `lib/canonical-v2/native-producer/producer-prompt-registry.js` | `listRegisteredSectionFamilies()` line 162, `getProducerPromptModule()` line 153, the `REGISTRY` map line 114. A family not in here cannot be dispatched. |
| What the model is asked, per family | `lib/canonical-v2/native-producer/*-producer-prompt.js` | 28 files (`ls lib/canonical-v2/native-producer/*-producer-prompt.js \| wc -l`). Only 25 are wired into the registry. `employee-dno-`, `financing-guaranty-`, `key-terms-mae-follow-on-` and `tax-dividend-appraisal-` are not, and editing them changes nothing. |
| The resolver: what turns a model answer into a governed claim, or refuses to | `lib/canonical-v2/native-producer/candidate-resolution.js` | One file, 10,126 lines. There is no per-family resolver file. Entry point `resolveCandidates`. |
| **Corroboration vocabularies**, the word lists that decide whether a claim is proven by its own quote | `candidate-resolution.js`, 13 frozen tables | `PARTY_CAPACITY_LEXICON` (1008), `MATERIALITY_TABLE` (1070), `SHARE_COUNT_KIND_CORROBORATION_TABLE` (1819), `FEE_SIDE_CORROBORATION_TABLE` (1895), `FEE_TRIGGER_CORROBORATION_TABLE` (1978), `TERMINATION_TRIGGER_KIND_CORROBORATION_TABLE` (2644), four `NO_SHOP_*` tables (2988, 3029, 3055, 3155), `MAE_CARVEOUT_CORROBORATION_TABLE` (3253), `MAE_DEFINITION_PRONG_CORROBORATION_TABLE` (3302), `GENERIC_CLAIM_KEY_RESOLUTION_TABLE` (605). |
| Concept synonym lists, the other place a vocabulary widening lands | `lib/taxonomy.js` | `synonyms:` arrays on concept entries. This is where the material-contracts widening in commit `34059a2f` went: 88 lines changed, seven lists. |
| Family-level marker words | `lib/canonical-v2/native-producer/lexical-disagreement-net.js` | `LEXICAL_FAMILY_LEXICON` line 686. |
| Qualifier marker words (knowledge, materiality, temporal, accuracy) | `lib/canonical-v2/native-producer/qualifier-kind-lexicon.js` | `KNOWLEDGE_PATTERNS` 131, `TEMPORAL_SYMBOLIC_DATES` 146, `ACCURACY_PATTERNS` 171, `THRESHOLD_PATTERNS` 178. |
| Two small per-family corroboration files | `guaranty-corroboration.js`, `ioc-corroboration.js` | Same directory. Regexes per assertion kind. |
| Claim definitions, the contract bundle | `lib/canonical-v2/contract-bundle.js` | A genuine new claim definition costs 11 edits here. Watch the dual numbering: input at V38, concept keys at V24. |
| The runner that dispatches a family at a deal | `scripts/canonical-v2-live-extraction-run.mjs` | 951 lines. Flags: `--deal`, `--family`, `--raw-html`, `--section-refs`, `--out-dir`, `--agreement-date`, `--model`, `--follow-citations` / `--no-follow-citations`, `--call-timeout-ms`, `--dry-run`. Deal pins at line 226. |
| Where a run writes | `evidence/canonical-v2/<deal>-<family>-<date>/` | 28 directories today. Each holds `run-receipt.json`, `resolution.json`, `review-queue.json`, `adapter-result.json`, `validation.json`, `run-manifest.json`, `call-telemetry.json`. |
| Cure-period and number parsing | `lib/canonical-v2/native-producer/cure-period-parse.js` | `SPELLED_NUMBER_VALUES` line 88. |
| The classifier that could assign families to sections automatically | `lib/canonical-v2/native-producer/section-family-classifier.js` | Exists, deliberately not wired in: anything it classifies carries a blocking unverified flag. |

### The write and serving path

| What | Where | Note |
|---|---|---|
| The write-set validator | `lib/canonical-v2/validate-write-set.js` | Splits a write-set into `publishableWriteSet`, `residuals`, `quarantines`. Only the first is importable. |
| The write orchestrator | `lib/canonical-v2/canonical-writer.js` | `WRITE_ORDER`, `OBJECT_ID_FIELDS`, and `InMemoryCanonicalRepository` at line 787. There is no persistent repository. |
| The database schema and SQL writer | `supabase/canonical-v2-foundation.sql` | 8,686 lines. `public.canonical_v2_write` at line 1167. Never executed. |
| The one family that serves V2 today | `lib/canonical-v2/termination-fee-serving-source.js` | Server side. Hand-typed fixture for QXO/TopBuild, hash verified. |
| The client-side switch for that family | `components/review/table-configs/termination-fees.config.js` | `selectRows()`, `isCanonicalTerminationFeeServingEnabled()`, `partitionTerminationFeeCards()`. |
| The route the data crosses on | `pages/api/review/[id]/cards.js` | Imports `attachCanonicalTerminationFeeServing`. This HTTP boundary is why static analysis cannot prove a user sees anything. |
| What turns claims into review rows | `lib/canonical-v2/*-product-projection.js` | 16 modules. |
| Review table configs | `components/review/table-configs/*.config.js` | 26 files. The other 7 `.js` files in that directory are shared helpers, not families. |
| Preview-only bridges into the legacy card shape | `general-covenants-dark-bridge.js`, `no-other-reps-fraud-dark-bridge.js`, `representations-dark-bridge.js`, `legacy-card-bridge.js` | All in `lib/canonical-v2/`. The fourth is Material Contracts despite the name; there is no `material-contracts-dark-bridge.js`. Gate: `dark-bridge-gate.js`. Aggregator: `review-preview-assembly.js`. |
| Feature flags | `lib/canonical-v2/feature-flags.js` | Every `CANONICAL_V2_*_ENABLED` is checked together with `isPermittedCanonicalV2Runtime()`, false on production regardless of the flag. |

### The old system, and the shared vocabulary

| What | Where |
|---|---|
| Provision rubric, the V1 taxonomy of provision types | `lib/rubric.js`, 5,386 lines |
| Canonical codes for exceptions, qualifiers, consent and efforts standards | `lib/taxonomy.js`, 1,767 lines |
| V1 extraction prompts | `lib/parser-v2/extract.js`, 8,429 lines |
| Quote acceptance at ingestion | `lib/verification.js` |
| Quote position recording, built and off by default | `lib/parser-v2/span-claims.js` |
| Search field registry, generated | `scripts/generate-query-serving-registry.js` writes `lib/query/serving-registry-v1.json` |

### Governance and measurement

| What | Where |
|---|---|
| The parity register, which re-derives its own status | `lib/canonical-v2/native-producer/m3-family-parity-register.js`. `liveProductVisibility` 1581, `listM3ProductParityBlockers` 1653. Declared facts in `docs/codex-program/m3-family-parity-register.json`; the answer is computed, never stored. |
| The gate registry reader | `lib/programme-gates/governing-registry.js`. `computePreproductionGateStatus()` from line 134. |
| The frozen gate file | `docs/codex-program/programme-gates.yaml`. Read by 14 files. `governing-registry.js:422` throws unless it deep-equals the hardcoded `CURRENT_V2_REGISTRY_CONTRACT` at line 204, so it cannot be edited alone. |
| Authority boundary, what is and is not permitted | `docs/core/OPERATING-RULES.md`, first section |
| Decisions already taken | `docs/core/DECISIONS.md` |
| A generator that re-derives the inventory above | `scripts/generate-codebase-inventory.js` into `docs/codex-program/generated/system-inventory.json` |

---

## 5. The old gates, disposed of

`docs/codex-program/programme-gates.yaml` declares 25 pre-production gates.
Twenty carry no acceptance criteria at all, just an identifier and the word
OPEN, so they can never be closed honestly and could be closed dishonestly by
anyone who felt finished. Verified:

```
node -e "const Y=require('yaml'),f=require('fs');
const g=Y.parse(f.readFileSync('docs/codex-program/programme-gates.yaml','utf8')).programme_gate_registry.preproduction_gates;
const w=g.filter(x=>Array.isArray(x.acceptance)&&x.acceptance.length);
console.log('total',g.length,'with criteria',w.length,'without',g.length-w.length)"
```
gives `total 25 with criteria 5 without 20`.

Two of the five that do have criteria compute their status live, from primary
sources, on every load. They are the model this plan follows.

```
node -e "const {createGoverningRegistryAuthority}=require('./lib/programme-gates/governing-registry.js');
const s=createGoverningRegistryAuthority().preproduction_gate_status;
console.log(Object.entries(s).filter(([,v])=>v.computed_state==='PASS').map(([k])=>k).join(','))"
```
gives `P1_CONTRACT_BUNDLE_COMPLETE,P1_VERTICAL_SLICE_PASS`. Every other gate
reports `OPEN` with reason `NO_MECHANICAL_VERIFIER_IMPLEMENTED`.

Each of the 25 is now either a step's acceptance criterion or retired. Nothing
is preserved because it exists.

| Gate | Had criteria | Disposition |
|---|---|---|
| `P1_CONTRACT_BUNDLE_COMPLETE` | yes, live | Closed. `COMPLETED.md` Step 0K. |
| `P1_VERTICAL_SLICE_PASS` | yes, live | Closed. `COMPLETED.md` Step 0K. |
| `P9_SCOPE_EXACT` | no | **Retired.** The identifier appears only in the registry itself. "Scope exact" names no measurement. |
| `P9_REGISTRY_DISPOSITIONS` | no | **Rewritten** as Step 5C. A family's serving disposition becomes a passing runtime test, not a word stored in a JSON file. |
| `P9_MKT_WORK` | no | **Rewritten** as Step 8A. |
| `P9_BEN_RUNBOOK` | no | **Rewritten** as Step 9B, which requires the exact commands to be recorded with their output. |
| `P9_NUMERIC` | no | **Rewritten** as Step 3B. |
| `P9_RENDER_PARITY` | no | **Replaced, measure known inadequate.** It leans on the parity register, whose entire proof chain is a static walk over one module graph. `notes/serving-path-proof.md` Part 4 item 1 states plainly that it cannot execute an HTTP request or observe a render, and V2 data reaches the browser only across that boundary. New criterion: Step 5C, a test that starts the server, fetches the route and asserts the value in the response. |
| `P9_STRUCTURED_CLAIMS` | no | **Rewritten** as Step 2B: every family produces resolved claims or a stated, checked reason why it does not. |
| `P9_PARTY_LINT` | no | **Rewritten** as Step 3F. |
| `P9_SHADOW_REEXTRACTION` | no | **Rewritten** as Step 2B: re-extract and diff against a pinned baseline. |
| `P9_IDENTITY_AND_DRIFT` | no | **Rewritten** as Step 4C (idempotent replay) and Step 6C (claim identity). |
| `P9_BROWSER_A11Y_PERFORMANCE` | no | **Retired.** One user, no customers, and no accessibility or performance target has ever been set. Reinstate it the day a target exists. |
| `P9_STAGING_SMOKE_AND_ROLLBACK` | no | **Rewritten** as Step 9A. |
| `P9_DATABASE_SOAK` | no | **Retired.** The registry's own Tier A controls forbid a load test against production, and there is one user. |
| `P9_BACKUP_RESTORE` | no | **Rewritten** as Step 4F, rehearsed offline, and Step 9B, done for real. |
| `P9_PREIMPORT_TRACEABILITY` | no | **Rewritten** as Step 4E: every imported row traces to a write-set file and an idempotency key, checked by query. |
| `P9_SECURITY_AUTH` | yes | **Kept**, as the criterion for Steps 7A to 7C. Its three clauses are real. Note the correction in section 3: the code exists; the deployed configuration is what is unproven. |
| `P9_DEPLOYMENT_PARITY` | yes | **Replaced, measure inadequate.** It names three adversarial tests and only one of the three is implemented. New criterion: Step 9D, fetch the same deal from the deployed site and from a local build and compare the served payloads. |
| `P9_IMPORT_PARITY` | no | **Rewritten** as Step 9C: field-by-field deep equality between imported rows and the source write-set, never a row count. |
| `P9_PROMOTION_ELIGIBILITY` | no | **Retired.** It governs `CandidatePromotionFence`, which is zero files. |
| `P9_CUTOVER_AUTHORISATION` | no | **Kept as a human act.** Step 9D needs Ben's one-use authorisation, dated, in his own words. No document can substitute. |
| `P9_POSTCUTOVER_SMOKE` | no | **Rewritten** as Step 9E. |
| `P9_TRACEABILITY` | no | **Merged** into `P9_PREIMPORT_TRACEABILITY`'s replacement, Step 4E. Two identifiers, one measurement. |
| `P9_PROGRAMME_COMPLETION_ATTESTATION` | yes | **Retired as an attestation.** Completion is `PLAN.md` having no steps left in it. An attestation adds a signature, not a fact. |

The 289-entry adversarial test catalogue in `adversarial-tests.md` stays as a
specification and is not built out. Seven are implemented. `ROADMAP.md` D3
checked the last five real defects fixed in this repository against all 289 and
none would have been caught by any of them; every one was caught by an ordinary
unit test against the module that broke. Do not present the 289 figure next to a
pass count.

---

## 6. How to read a step

Every step has four parts.

- **What it is**, in plain language, with any term of art glossed.
- **Why**, in one line.
- **Change**, with file paths and function names.
- **Proves it is done**, a command you can run or a measurement you can take.
  Never a judgement, never a signature.

Steps are ordered by dependency inside a stage. Stages 2 and 3 must precede
Stage 4, and Stage 4 must precede Stage 5. Stage 7 is independent and can run at
any time. Stage 9 needs everything.

Before any step: `CI=true npm test > /tmp/t.log 2>&1; echo "EXIT=$?"`. Read the
exit code off the `npm` command itself. Never pipe `npm test` into `tail` or
`head`: the pipeline returns the last command's status and will report a green
suite when it failed.

---

# Stage 1. Make the record unable to lie

## Step 1A. Bind every gate to a step, mechanically

**What it is.** A test that reads `docs/codex-program/programme-gates.yaml`,
takes every gate identifier in it, and fails unless that identifier appears in
either `PLAN.md` or `COMPLETED.md` next to a step label or the word "Retired".

**Why.** Twenty gates today can be closed by anybody who feels done. This makes
that impossible without changing a test, which is a visible act.

**Change.** New file `tests/programme-gates/gates-bound-to-plan.test.js`. Read
the YAML with the `yaml` package as `governing-registry.js` does. Do not edit
`programme-gates.yaml` itself: `lib/programme-gates/governing-registry.js:422`
throws unless the file deep-equals the hardcoded `CURRENT_V2_REGISTRY_CONTRACT`
at line 204, so any edit to the YAML requires an identical edit to that constant
in the same change, and 14 files read the YAML. Leaving the file frozen and
binding it from outside is cheaper and equally honest.

**Proves it is done.**
`CI=true node --test tests/programme-gates/gates-bound-to-plan.test.js` passes,
and deleting any one gate row from the disposition table in section 5 makes it
fail.

---

# Stage 2. Find out whether the extraction generalises

Everything in Stage 3 onwards assumes the extraction is good. That assumption
rests on one agreement. This stage is the cheapest way to find out whether it is
true, and it is question 3 of the five: where we do not know something works,
how do we test it.

## Step 2A. Recover the section lists, because 24 of the 25 exist nowhere reusable

**What it is.** Each family is run against a named list of sections of the
agreement. Only one of those lists is recorded in the code. The other 24 exist
only inside the run manifests of the one sweep that used them.

**Why.** Nothing else in this stage can run without it. Worse, two families
produced almost nothing purely because they were pointed at the wrong sections,
and nobody could see that, because the lists were invisible.

```
node -e "const s=require('fs').readFileSync('scripts/canonical-v2-live-extraction-run.mjs','utf8');
console.log(s.match(/default_section_refs_by_family:\s*Object\.freeze\(\{[\s\S]{0,200}?\}\)/g).join('\n---\n'))"
```
shows `modiv` has exactly one entry, `TERMINATION_FEE: ['7.1','7.3','8.12']`, and
`topbuild` has none.

**Two lists are wrong, both found by reading them.**

- **CONSIDERATION was pointed at 2.1, 2.2 and 2.3.** Modiv's statement that
  appraisal rights are not available is in section **2.6**, which was never
  requested. This is why Appraisal looks like a taxonomy gap and is not one. The
  Appraisal family's own prompt
  (`lib/canonical-v2/native-producer/appraisal-producer-prompt.js`) says in
  terms "Never assert a negative" and "Availability... remain with
  Consideration", so its zero output is correct by design. The slot exists
  already: `consideration-producer-prompt.js` declares
  `assertion_kind: APPRAISAL_STATUS` with `appraisal_status: AVAILABLE |
  NOT_AVAILABLE`, the resolver maps it to the claim definition
  `APPRAISAL_RIGHTS_STATUS` (`lib/canonical-v2/contract-bundle.js:3140`), and
  the corroboration pattern already matches Modiv's real sentence. Nothing needs
  designing. The section list needs fixing.
- **KEY_DEFINED_TERMS was pointed at 8.5 alone.** Modiv's definitions are in
  section **8.12**, which the runner's own header comment already says, because
  TERMINATION_FEE's pinned list includes it. All 15 of that family's output fell
  into open world.

Confirm both with
`node -e "console.log(require('./evidence/canonical-v2/modiv-consideration-20260806/run-manifest.json').section_references)"`
and the same for `modiv-key-defined-terms-20260806`.

**Change.** `scripts/canonical-v2-live-extraction-run.mjs`, `DEAL_PINS.modiv.default_section_refs_by_family`.
Read `section_references` out of each of the 25 run manifests, add all 25 as
pinned defaults, and correct the two above.

**Proves it is done.** A test asserting that every registered family has a
pinned section list for `modiv`, and that invoking the runner with only
`--deal`, `--family` and `--out-dir` reproduces the manifest's own
`section_references` for each. Twenty-five entries, checked against the
manifests, not typed from memory.

## Step 2B. Re-run the 25 families against Modiv and diff against the pinned baseline

**What it is.** Dispatch every registered family at the Modiv agreement again,
and compare the result to the snapshot taken before this week's fixes landed.

**Why.** Four families crashed and roughly a dozen fixes landed after the
baseline was pinned. Nobody has measured whether the fixes worked. The baseline
exists precisely so this can be a measurement rather than an impression.

**Change.** No code beyond Step 2A. Run
`scripts/canonical-v2-live-extraction-run.mjs`, one process per family, six to
ten in parallel. `--deal modiv`, `--family <NAME>`,
`--out-dir evidence/canonical-v2/modiv-<family>-<yyyymmdd>`. Capitalisation
needs `--call-timeout-ms` above the 600000 default: it ran 18.8 minutes last
time and was killed. Note that MAE_DEFINITION has never run against Modiv at
all, so this creates its first baseline rather than re-testing one.

Expect roughly 70 model calls and $25. Basis: the first sweep measured 58 calls
and $20.30 for 25 families, and citation-following is now on by default but
scoped to termination-fee bare-citation triggers, so it adds nothing elsewhere.

**Proves it is done.** Regenerate the baseline JSON in the same shape and diff
it against `docs/codex-program/notes/all-families-baseline-20260806.json`. Two
conditions, both mechanical:

1. `incomplete` is 0. It was 4: capitalisation and closing conditions and
   interim operating failed at extraction or resolution, no-other-reps failed at
   validation. Commit `d261df30` fixed three crash causes and `ae8b12de` made
   the timeout configurable. This is the test of those claims. Note that closing
   conditions is only partly addressed: what was fixed is that a partial receipt
   is now kept, and the underlying unparseable response on call 2 of 4 persists,
   with sections 6.3 and 6.4 never attempted. If it fails again, that is
   expected, and the finding is what the model returned.
2. No family's `resolved` count falls. A fall is a regression and must be
   explained before the stage continues.

Record the new file as `notes/all-families-baseline-<date>.json` and keep the old
one. This step also discharges `P9_SHADOW_REEXTRACTION` and `P9_STRUCTURED_CLAIMS`.

## Step 2C. Map the 25 families to TopBuild's sections, for nothing

**What it is.** Work out which sections of the TopBuild agreement each family
should be pointed at, without calling a model.

**Why.** TopBuild has 63 sections to Modiv's 99 and the articles do not align:
Modiv's termination sits at 7.1, TopBuild's boilerplate runs to 7.16. Modiv's
mapping must not be assumed.

**Change.** `scripts/canonical-v2-live-extraction-run.mjs --dry-run --deal
topbuild --family <NAME>` for each of the 25. The runner resolves sections and
prints `DRY RUN complete: projected_model_call_count=N. Stopping before any
model call.` Costs nothing.

**Proves it is done.** A committed mapping file listing, per family, the
resolved section references and the projected call count, with 25 entries and
zero model calls made. Any family resolving to zero sections is a finding to
record, not a family to skip.

## Step 2D. Run the 25 families against TopBuild

**What it is.** The honesty check. Modiv is the controlled comparison; TopBuild
is the different drafter.

**Why.** Almost every fix this week was tuned on Modiv's own language. The
synonym lists learned Modiv's vocabulary, the termination fix parses "from X to
Y" because that is how Modiv's limb heads read, and the party-capacity entry for
"the Partnership" exists because Modiv is an UPREIT. A different drafter breaks
different assumptions, and a sweep where every fix generalises perfectly on the
first differently drafted deal is a result to be suspicious of, not pleased by.

TopBuild is close to an ideal contrast rather than merely a second sample: it is
a financed deal where Modiv is not, with 39 mentions of Debt Financing against
Modiv's zero, a financing condition, and dedicated sections at 4.17 "Financing
Provisions" and 7.16 "Waiver of Claims Against Financing Sources".

**Change.** The same runner, `--deal topbuild`, with Step 2C's mapping.
Estimated 50 to 60 calls; that is an estimate, not a measurement.

**Proves it is done.** 25 run receipts under `evidence/canonical-v2/topbuild-*`,
plus one falsifiable prediction resolved either way:

**GUARANTY_FINANCING_PARTY must produce non-zero output on TopBuild.** It
returned zero on Modiv, and commit `ae8b12de` judged that correct on the grounds
that an unfinanced REIT merger has no financing-party protections to find. If it
returns zero on a financed deal with two dedicated financing sections, that
reasoning was wrong and the family is broken rather than correctly quiet. Write
down which it was.

## Step 2E. Say which fixes generalised and which were Modiv-only

**What it is.** One table. A row per fix landed since commit `bff5cd28`, with its
Modiv result and its TopBuild result.

**Why.** Without it, Step 2D is 25 directories nobody reads, and the next person
re-derives the same question.

**Change.** A new note, `docs/codex-program/notes/generalisation-<date>.md`.

**Proves it is done.** Every row cites an evidence directory and a reason-code
count from a `review-queue.json`, not a recollection. Any fix whose TopBuild
result cannot be determined from the evidence is recorded as undetermined, not
as a pass.

---

# Stage 3. Close the extraction gaps that are already named and located

Each of these was found, diagnosed and deliberately left. They are the reason
11 of the 21 finished runs resolved zero claims.

## Step 3A. Widen the termination trigger-kind vocabulary for the four phrasings that miss

**What it is.** When the resolver decides which event triggers a termination
right, it checks the model's answer against a table of phrases. Four real Modiv
phrasings match nothing in the table, so six legitimate termination grounds
queue for human review instead of resolving.

**Why.** Commit `fb7f1c64` took this family from 1 resolved claim to 8 by fixing
a different gate. Six of the twelve candidates it unblocked now stop here.

**Change.** `TERMINATION_TRIGGER_KIND_CORROBORATION_TABLE`,
`lib/canonical-v2/native-producer/candidate-resolution.js` line 2644. The four
gaps, each recorded verbatim in `notes/resolver-reference-fixes.md`:

- `VOTE_FAILURE` wants a literal `(?:stock|share)holder approval`. Modiv says
  "Company Requisite Vote" throughout and never says either.
- `RECOMMENDATION_CHANGE` wants the literal "Company **Board** Recommendation".
  Modiv's own text at 7.1(d)(ii) omits "Board".
- `RECOMMENDATION_CHANGE` has no pattern at all for "failed to publicly
  recommend against any tender offer".
- `NO_SOLICITATION_BREACH` wants "materially breaches its obligations under
  Section 4.4". Modiv's no-shop is section 5.6, and the ground's real trigger is
  structurally different: entering into an agreement, not breaching an
  obligation.

Two further candidates carry a `null` `trigger_kind` from the model itself.
Those are not vocabulary and must not be forced.

**Proves it is done.** Replay
`evidence/canonical-v2/modiv-termination-20260806/run-receipt.json` through the
real `resolveCandidates`, no reconstruction. `resolved` rises from 8 to at least
12. Plus a hostile test per widened pattern: a candidate carrying a deliberately
wrong `trigger_kind` for that quote must still queue, never resolve.

## Step 3B. Teach the number parser hyphenated compounds

**What it is.** "forty-five (45) days" fails a cross-check that compares the
spelled number against the digits, because the lookup table has no entry for
hyphenated compounds. A correctly drafted cure period is refused as a mismatch.

**Why.** It is a two-line fix blocking a real claim, and it is the whole content
of the retired `P9_NUMERIC` gate.

**Change.** `SPELLED_NUMBER_VALUES`,
`lib/canonical-v2/native-producer/cure-period-parse.js` line 88. It holds single
words up to "ninety" only.

**Proves it is done.** A unit test that "forty-five (45) days" parses to 45 with
no `SPELLED_DIGIT_MISMATCH`, and a replay in which Modiv 7.1(d)(i)'s
`CURE_PERIOD` candidate resolves. Include at least one compound above one
hundred if the corpus contains one; if it does not, say so rather than invent
one.

## Step 3C. Stop a filter throwing away Specific Performance's only answer

**What it is.** The Specific Performance and Remedies family returns nothing at
all on Modiv: zero resolved, zero queued, zero open-world. Not "found nothing
interesting", literally no output. A filter drops a correct extraction before it
is ever resolved.

**Why.** Zero-zero-zero is indistinguishable from a family that never ran, and
this is one of only two families in that state whose silence is not correct by
design. (The other, Appraisal, is correct by design and is fixed by Step 2A.)

**Change.** `lib/canonical-v2/native-producer/anthropic-provider.js`, lines 1191
to 1194. The filter returns false when a quote contains both
`/\birreparable harm would occur\b/i` and
`/\bmoney damages would not be an adequate remedy\b/i`. That is exactly how a
standard specific-performance clause reads, so the filter refuses the clause it
exists to find. Work out what it was written to exclude before changing it: the
answer is probably a recitals-style acknowledgement rather than an operative
grant, in which case the discriminator is `operativeGrant`, already computed one
line above, and not the quote's wording at all.

**Proves it is done.** A replay of the committed Modiv run through the corrected
provider yields at least one candidate reaching the resolver, and a hostile test
that a non-operative acknowledgement is still excluded. Both, or the fix has
traded a false negative for a false positive.

## Step 3D. Capture a quote's position before anything trims it

**What it is.** A quote can arrive already trimmed in a way that reverses its
legal meaning: "would not have a Material Adverse Effect" becomes "have a
Material Adverse Effect". That is now blocked at the ingestion gate. The
principled version, which records where a quote sits before any trim can happen
rather than re-deriving it afterwards, is specified and not built.

**Why.** It is the worst error class this product can produce: confidently
wrong, verbatim-looking, with no visible signal to the reader.

**Change.** `lib/canonical-v2/native-producer/candidate-resolution.js`. The
design is written out in `docs/codex-program/notes/negation-reversal.md`; it was
not implemented because that file was under another agent's edit at the time.

**Proves it is done.** A test that a quote whose governing negation has been
trimmed is refused at the resolver, not only at `lib/verification.js`. Build the
test against real filed text, not a synthetic string.

## Step 3E. Close the same negation gap in the third bridge

**What it is.** `lib/canonical-v2/no-other-reps-fraud-dark-bridge.js` rejected
the negation fix for a genuine reason. The false-positive shape is written up;
the fix was reverted rather than shipped half-right.

**Why.** Two of the four preview bridges are protected and one is not. That
asymmetry is a trap for whoever reads the code next.

**Change.** That file. The rejected attempt and why it failed are in
`notes/negation-reversal.md`.

**Proves it is done.** The same hostile negation case that
`representations-dark-bridge.js` now refuses is refused here too, and the
family's genuine cards still render, proven by the bridge's existing tests
staying green rather than by inspection.

## Step 3F. Decide what a joint obligation's party capacity is

**What it is.** The list that works out which side of the deal a party belongs
to assumes one party per string. The corpus contains joint obligations naming
five parties at once, where a single capacity is simply the wrong shape.

**Why.** It silently mis-attributes obligations, and mis-attribution reads as
correct.

**Change.** `PARTY_CAPACITY_LEXICON`, `candidate-resolution.js` line 1008. Two
traps recorded in commit `34059a2f` and both must survive the fix:

- The list is scanned in order and first match wins. Modiv has a Parent OpCo
  which is also a partnership, so "the Partnership" sits deliberately *after*
  the buyer patterns. Moving it earlier silently attributes the buyer's
  representations to the target.
- A merger sub named after the target matches the target pattern first. Wrong in
  principle, not currently reached by any single-party candidate.

**Proves it is done.** A test using a real joint-obligation string taken from
the corpus, resolving to a multi-party capacity rather than the first match; and
the existing ordering test, in which Parent OpCo still resolves buyer-side,
still passes. Both are needed: the second is what stops the fix creating the
worse bug.

## Step 3G. Four located resolver defects, each with a line number

**What it is.** An "open-world candidate" is a fact the model found and the
taxonomy has no governed slot for. It is kept as evidence rather than discarded.
The sweep produced 193. Commit `34059a2f` classified all of them and fixed 21.
Of the rest, four causes are diagnosed to a line and are ordinary bugs, not
design questions. Between them they account for 41 items.

**Why.** These are the cheapest remaining unblocks in the programme and each is
a defect, not a judgement. All four sit in
`lib/canonical-v2/native-producer/candidate-resolution.js`, which is 10,126 lines
and was outside the permitted scope of the work that found them.

**Change, in ascending order of line number.**

- **Material Contracts, 9 items, line 4047.** A chapeau or limb carrying
  `threshold_kind: 'ANY'` is refused unless the quote matches
  `/\bany\b[\s\S]{0,80}\bcontracts?\b/i` and the value is literally "any". Real
  drafting separates the two. Same shape as the synonym widening already done in
  `lib/taxonomy.js`.
- **General Covenants, 11 items, line 4057.** `generalCovenantGroundingFailure`
  corroborates a covenant code against `lib/rubric.js`'s display labels and
  aliases, which are the old system's *presentation* strings, not a corroboration
  vocabulary. It needs its own lexicon, in the shape of
  `ioc-corroboration.js`. This is why the family resolved zero and put all 12 of
  its findings in open world.
- **Representations, 9 items, lines 8644 to 8648.** For `ACCURACY` qualifiers,
  every outcome other than `CLASSIFIED` is pushed to open world as
  `REPRESENTATION_QUALIFIER_KIND_NOT_EXACT`, including `REVIEW`, which means the
  classifier deliberately declined to decide. Refusing and asking for review are
  different answers and must route differently.
- **Tax Matters, 5 items, lines 9386 to 9388.** `TAX_OPINION_COOPERATION` and
  `TRANSFER_COOPERATION` corroborate against regular expressions hardcoded in
  the resolver, including a literal `/tax opinion/i` bigram, rather than against
  a vocabulary file anyone can widen. Move them out to a lexicon in the same
  shape as the tables listed in section 4, then widen.

**Proves it is done.** Per defect, replay the relevant committed run through the
real resolver and record the open-world count before and after. Total open-world
across the four families falls by at least 30 of the 41. Each fix carries a
hostile test proving the widened path still refuses a genuinely wrong candidate,
because every one of these is a loosening and a loosening with no hostile test is
how a false positive gets shipped.

## Step 3H. Decide the open-world items that are not defects

**What it is.** The remainder of the 193 are not bugs. They are facts the
taxonomy could carry and does not, and each needs a decision rather than a fix.
The largest groups: Consideration 18 items and Financing Covenants 2, which are
a V1 feature never ported; Proxy and Meeting 8, of which 4 are claim types never
built; Termination Fee 20; Representations' temporal and threshold qualifiers,
already confirmed correctly routed; a REIT-status concept shared by Tax Matters
and Dividends.

**Why.** An unowned candidate is a fact the product found and cannot use. Left
unowned it is neither a bug nor a feature and nobody looks at it again.

**Change.** Nothing yet. Read
`docs/codex-program/notes/open-world-ownership.md`, which has the per-item
accounting, and give each remaining item exactly one of three dispositions: a
claim definition to add (`lib/canonical-v2/contract-bundle.js`, 11 edits each,
dual numbering, input at V38 and concept keys at V24), a vocabulary to widen
(named file from section 4), or a decision that the taxonomy should not carry
it. There is no fourth. "Needs more analysis" is not a disposition.

**These are legal-taxonomy calls and must not be produced cheaply.** A
plausible-but-wrong claim definition is worse than none, because it reads as
correct.

**Proves it is done.** Every one of the 193 has a disposition recorded against
its identifier, and the count with none is zero, computed from the note rather
than asserted.

---

# Stage 4. Find out whether the database write path works at all

This stage is the largest single unknown in the programme. It is answerable in a
day and nothing downstream is real until it is answered.

## Step 4A. Execute the 8,686 lines of SQL that have never been executed

**What it is.** `supabase/canonical-v2-foundation.sql` defines a
`canonical_v2_staging` schema with one table per write-set object kind, plus
`public.canonical_v2_write` at line 1167, a function that recomputes each
object's content-addressed identity inside the database before inserting it.
Nobody has ever run it. Its nine tests read the file as a string and
pattern-match fragments of it.

**Why.** Two thirds of the import plan assumes this works. It might, and it
might not, and finding out costs a container and an hour.

**Change.** No repository code yet. Stand up Postgres in a local container,
apply the file with `psql`, and call `canonical_v2_write` once with a real
validated write-set. `pg` is already a dependency (`package.json`, `^8.22.0`).
No credential of any kind is needed and no permission boundary applies: this
touches nothing real.

Record the exact commands in the step's evidence, so that someone with no
Supabase account can reproduce it from a clean checkout. No such local
convention exists in this repository today; this establishes one.

**Proves it is done.** The function returns a receipt, and
`SELECT count(*) FROM canonical_v2_staging.claim_revisions` equals the number of
claims in the write-set. If it fails, that is the finding this step exists to
produce, and the fallback is written into Step 4B.

## Step 4B. Build the import driver

**What it is.** A script that reads a write-set file from `evidence/`, validates
it, and writes it to the database.

**Why.** It is the missing connecting piece. Extraction writes JSON to disk; the
site reads Postgres; nothing joins them.

**Change.** A new script. It must call
`validateCanonicalWriteSet` and `validateResolvedCanonicalWriteSet`
(`lib/canonical-v2/validate-write-set.js`) itself on whatever file it is given,
never trusting the file's own claim to be validated, and pass only
`publishableWriteSet` rows to the insert path.

If Step 4A found `canonical_v2_write` works, the driver is thin: read, validate,
call the function once per deal, record the receipt. If it does not, add a
`PostgresCanonicalRepository` implementing the same method contract
`InMemoryCanonicalRepository` already implements at
`lib/canonical-v2/canonical-writer.js:787` (`getReceipt`, `transaction`,
`writeObject`, `writeDeal`, `writeReceipt`), so the already-tested orchestration
in `canonical-writer.js` stays unchanged. Either way no new orchestration logic
is written, only an adapter.

**Proves it is done.** One real deal's write-set imports, and every object id in
the file is present in the database, matched by id, counted by query.

## Step 4C. Prove that running it twice is safe, and that it resumes

**What it is.** Every object's id is content-addressed: the same fact extracted
the same way produces the same id every time. So re-running an import should be a
no-op rather than a duplicate, and a crashed batch should be restartable from the
top with no checkpoint file.

**Why.** The plan relies on this to avoid building a separate checkpoint
mechanism. It follows from the design and has never been proven against a real
database.

**Change.** Tests, not code, if the property holds.

**Proves it is done.** Three measurements. Importing the same write-set twice
leaves the row count unchanged and returns the original receipt. Importing a
different write-set under a reused idempotency key fails hard rather than
overwriting. A driver killed mid-batch and rerun from the top completes, with
the row count matching a clean single run.

## Step 4D. Refuse what must never be imported, and prove the refusal

**What it is.** Two categories must never reach the database: objects the
validator quarantined, and items sitting in the human review queue.

**Why.** Both are excluded by construction today, which is an argument, not a
test.

**Change.** Two hostile tests. First, hand-build a write-set with a quarantined
object spliced into its `claims` array and confirm the importer refuses it, not
silently drops it and not silently imports it. Second, where a sibling
`RESOLUTION_REVIEW_QUEUE/V1` artefact exists for the same run receipt
(`lib/canonical-v2/native-producer/review-queue-artifact.js`), confirm none of
its item identities appears among the write-set's claim ids, and refuse if one
does.

**Proves it is done.** Both tests pass, and both fail if the corresponding guard
is removed. A hostile test that passes with the guard deleted proves nothing.

## Step 4E. Make every imported row traceable to its source

**What it is.** For any row in the database, one query returns which write-set
file it came from and under which idempotency key.

**Why.** It is what makes an undo precise rather than a guess, and it is the
whole content of the two retired traceability gates.

**Change.** The receipt written by Step 4B must record the source file path, the
input digest and the idempotency key, in `canonical_v2_staging.write_receipts`.

**Proves it is done.** A query joining any claim row back to its receipt and its
source path, run and its output kept. Zero rows with no receipt.

## Step 4F. Rehearse backup and restore, where it costs nothing

**What it is.** Take a `pg_dump` before an import and prove `pg_restore` brings
back the exact pre-import state.

**Why.** This is the first of the five things Ben ruled are needed to go live,
and doing it on a throwaway database costs nothing and stops it being untested.

**Change.** No product code. A `--rollback` mode on the import driver, taking
the idempotency key the import used, dry run then apply then verify, following
the numbered convention already established in `sql/qxo-reverse-f3/generated/`
and `sql/qxo-reverse-f4/generated/` (`09-rollback-dry-run.sql`,
`10-rollback-apply.sql`, `11-verify-rollback.sql`).

**Proves it is done.** The restored database is byte-identical on the affected
tables to the pre-import dump, checked by diff, not by exit code. The rollback
mode is actually run, not merely written.

---

# Stage 5. Prove a user actually sees the data

The parity register cannot answer this and says so. This stage builds the
answer it cannot give.

## Step 5A. Read claims out of the database, for any deal

**What it is.** One new module that reads validated claims and relationships for
a given deal out of `canonical_v2_staging` and returns them in the shape a
projection module already expects.

**Why.** `lib/canonical-v2/termination-fee-serving-source.js` does exactly this
today for one deal, from a hand-typed file. Every family needs the same thing
from a database, once.

**Change.** A new module alongside `termination-fee-serving-source.js`,
deal-agnostic. The 16 `lib/canonical-v2/*-product-projection.js` modules are not
rebuilt; they are fed from a different source.

**Proves it is done.** The reader returns, for the deal imported in Step 4B, an
object that the existing termination-fee projection accepts without
modification, asserted by test.

## Step 5B. Render a second deal without hand-writing a file for it

**What it is.** Wire Modiv's termination fee data through Step 5A's reader and
render it on the review page beside QXO/TopBuild.

**Why.** This is the one piece of the proven family that has never been done.
QXO/TopBuild's serving file was hand-written. Until a second deal renders
without that, nothing has been shown to scale past one.

**Change.** `components/review/table-configs/termination-fees.config.js`
`selectRows()` reads from the new reader.
`evidence/canonical-v2/modiv-termination-fee-citation-following-20260806` is
real extracted data already in the repository; confirm its exact shape before
relying on it.

**Proves it is done.** Two deals render V2 termination-fee rows on the review
page, from the database, with no per-deal file. `scripts/review-parity-check.js`
exits 0 or 1, never 2, which means coverage incomplete.

## Step 5C. Prove it at runtime, and make that the progress measure

**What it is.** A test that starts the application, requests a real deal's cards
over HTTP, and asserts that the V2 value is in the response body and on the
rendered page.

**Why, and why the current measure is not enough.** The parity register decides
whether a surface is visible by walking the import graph: which file imports
which. V2 data reaches the browser across an HTTP response, which no import
graph can see. `notes/serving-path-proof.md` Part 4 says this in its own words:
the mechanism "cannot execute an HTTP request or observe a real render", and
proving a field name is stamped and read "proves the CHANNEL exists", not that
any value crossed it. The register can go green while proving nothing a user
would recognise. This is why `P9_RENDER_PARITY` is replaced rather than kept.

**Change.** A new test modelled on `tests/auth-route-enforcement.test.js`, which
already does the hard part: it builds a real Next handler and serves it through
`http.createServer` at line 60, then makes real `fetch` calls at line 36. Reuse
that shape. Fetch `/api/review/<deal id>/cards` and assert
`canonical_v2_termination_fee_cards` is present and non-empty, with values equal
to the write-set that was imported.

**Proves it is done.** That test passes, and it fails if the serving flag is
turned off. The count of families with a passing runtime test of this shape
becomes the programme's progress number, replacing the parity blocker count.
The register keeps its job, which is catching unwired modules cheaply; it stops
being the completion measure.

## Step 5D. Repeat for a second family

**What it is.** The same three pieces for one more family: reader, projection,
switch, runtime test.

**Why.** One family through a path proves the path exists. Two prove it is a
recipe. Choose Material Contracts: it already has a projection module, a review
config, and 5 resolved claims from the sweep.

**Change.** `lib/canonical-v2/material-contracts-product-projection.js` and
`components/review/table-configs/material-contracts.config.js`, plus a serving
source in the shape of `termination-fee-serving-source.js`.

**Proves it is done.** A second passing runtime test of Step 5C's shape, and a
written record of every step in the recipe that was not obvious from the first
family. That record is what makes Step 5E estimable.

## Step 5E. Roll the remaining families

**What it is.** Repeat the recipe. Not twenty separate efforts.

**Why.** The 102 blocked surfaces are six kinds of work, and 49 of them are the
identical mechanical wiring, one recipe repeated. A further 12 look like a stale
component name and are really the same wiring wearing the wrong label.

**Change.** Per family, following Step 5D's recipe. Four families need a
decision before they can join it at all, and each must be settled explicitly
rather than skipped:

- **Merger Structure** and **Miscellaneous Boilerplate** have projection modules
  that key on claim types which do not exist. Their tests pass because the tests
  build the missing vocabulary themselves. Between them they hold 34 of the 108
  resolved claims. Either fix the projections or delete them and stop extracting
  those families; do not leave them producing data nothing can render.
- **No-Shop** has no projection module and a separate pilot-era architecture. It
  resolved 42 claims, the most of any family. It needs an architectural decision
  before the recipe applies.
- **Capitalisation** is not in the parity register at all, despite having the
  largest extraction prompt in the repository. Add it.

**Proves it is done.** One passing runtime test per family that is meant to
serve, and, for each family that is not, a one-line recorded reason. The sum of
those two lists is 25.

---

# Stage 6. Fix the defects in the product surfaces themselves

These are live in V1 today and will be inherited by V2 unless fixed.

## Step 6A. Stop tables stealing each other's cards

**What it is.** Five review tables decide which cards belong to them partly by
searching the card's text for a phrase, which pulls other families' cards into
the wrong table.

**Why.** One real corpus card leaks today: a buyer financing representation
appears as the evidence behind a termination-fee row. A worse case is reachable:
a sole-remedy card landing in the fee table flips "Sole and exclusive remedy"
from No to Yes depending on card order.

**Change.** The unguarded `type || code || regex` shape. Fixed already in
`termination-fees.config.js:71`. Remaining, all in
`components/review/table-configs/`: `misc-boilerplate.config.js:176`,
`antitrust-regulatory.config.js:22`, `termination-rights.config.js:47`,
`mae-definitions.config.js:46`. Note `isTerminationRight` matches
`/superior proposal/i`, which will pull no-shop and fee cards. Narrow it; do not
delete it, because the fallback exists to catch genuine cards whose subtype was
never set.

**Proves it is done.** A test per table that a card another family owns is
refused, and a test per table that a genuine subtype-less card is still caught.
Both, or the fix has traded one defect for another.

## Step 6B. Record where every quotation came from

**What it is.** Store the exact byte position of every quote, not just its text.

**Why.** It catches a quote whose stored text is later changed while a stale
position is left beside it. It does **not** catch a meaning-reversing trim; that
is Step 3D, and this plan does not repeat the overstatement `ROADMAP.md` P5 had
to correct.

**Change.** `lib/parser-v2/span-claims.js` already does the job,
deterministically, with no model. Turning it on is one line each in
`scripts/ingest-local.js:214` and `lib/parser-v2/run-extract.js:181`, or the
environment variable `PM_SPAN_CLAIMS=1`.

**Before backfilling**: of 952 currently flagged sections, 470 are stale-offset
artefacts rather than hallucinations. Backfilling now labels them as fabricated
quotes. Fix the attribution first. Separately, the existing
`primary_quote_start` and `primary_quote_end` columns are populated and wrong;
null them or mark them untrustworthy in the same change.

**Proves it is done.** After a re-ingest of one deal, every quote carries a
position that resolves to the same bytes in the source, checked by re-slicing
the source and comparing. Beware the recurring error class: this pipeline slices
by UTF-8 bytes, and a JavaScript string index counts UTF-16 code units. Three
separate confident false findings in this project have come from that confusion.
A conversion helper exists; use it.

## Step 6C. Converge claim identity before any corpus run

**What it is.** Claim ids have been minted two different ways, so re-running a
previously backfilled deal creates duplicate rows instead of updating.

**Why.** A corpus-wide run is exactly the trigger. Doing it in this order means
not cleaning up afterwards.

**Change.** Future writes were converged onto one scheme. 128 cards may still
carry legacy-scheme rows; that is unconfirmed without database access. Ben ruled
identification first: the list comes back to him before anything is deleted
(`DECISIONS.md` item 7).

**Proves it is done.** Re-materialising a backfilled deal twice produces the same
row count and the same ids, measured by query. The list of affected cards is
produced and shown to Ben before any delete runs.

---

# Stage 7. Security

Independent of everything above. Nothing in Stages 2 to 6 waits on it. It gates
Stage 8 and Stage 9 only.

## Step 7A. Two things only Ben can check

**What it is.** Whether `precedent-machine.vercel.app` requires a login right
now, and whether the database service key exposed in a chat transcript in July
was rotated.

**Why.** Neither is answerable from the code, and the answer changes how urgent
the rest of this stage is. Fifteen minutes.

**Change.** None. Open the site in a private browser window. Check the key in
the Supabase dashboard.

**Proves it is done.** Two written answers, dated. Note that the code-side work
is already built (section 3): the gate exists and fails closed, so if the site
does not require a login, the likely cause is that `AUTH_PASSWORD` and
`SESSION_SECRET` are unset in the Vercel environment, not that the gate is
missing.

## Step 7B. Turn the gate on, and prove it from outside

**What it is.** Set the two environment variables in Vercel and confirm the
deployed site refuses an unauthenticated request.

**Why.** The gate is built and dormant. Setting two variables is the whole
remaining act.

**Change.** `AUTH_PASSWORD` and `SESSION_SECRET` in the Vercel project
`deal-corpus` (`prj_pseZ68ISXsxADzNcffHTO2NuGM8b`). If the site is open today,
also enable deployment protection covering production, not only previews: the
current setting is SSO scoped `all_except_custom_domains`, and there are no
custom domains, so confirm empirically rather than by reading the setting.

**Proves it is done.** `curl -sS -o /dev/null -w '%{http_code}'
https://precedent-machine.vercel.app/api/deals` returns 401, run against the
deployed site, not a local build. Keep the output.

## Step 7C. Un-contain the four repaired routes

**What it is.** Four routes a July security review graded critical were switched
off rather than fixed. They are still 503 stubs. Their repaired versions exist
and are dormant.

**Why.** A contained route is not a fixed route, and the repaired code is
untested in the live path.

**Change.** `pages/api/users.js` (read `is_admin` from the request body),
`pages/api/ingest/from-url.js` (unauthenticated SSRF),
`pages/api/admin/reprocess-cond.js` (unauthenticated destructive delete and
reinsert), `pages/api/saved-queries.js` (admin self-grant). The repaired
handlers sit at `lib/broad-corpus/contained-routes/`; see
`docs/API-ROUTE-CLASSIFICATION.md`. Note that
`lib/service-client-route-actions.js:235` throws at module load if any
public-mutation route is not hard-contained, so un-containing means editing that
declaration in the same change.

**Proves it is done.** Each of the four returns a real response for an
authenticated request and 401 for an unauthenticated one, proven by
`tests/auth-route-enforcement.test.js` extended to cover them, plus
`tests/auth-critical-routes-repair.test.js` still green.

---

# Stage 8. Comparison, market statistics and search

The parts of the product beyond a single deal's review page. All gated on Stage
7 reaching 7B, because all three un-contain routes.

## Step 8A. Market statistics, in preview

**What it is.** Switch the "what is market" comparisons back on in the test
environment, with the two-scope sidebar Ben asked for: whole corpus, or the
deals currently being compared.

**Why before search.** The machinery is more complete, the filters are already
built end to end, and the review page is where a user sees it.

**Change.** Three stubs: `pages/api/market-stats.js`,
`pages/api/corpus-stats.js` (641 lines, restore from `git show 8096bd6c^:`),
`pages/api/corpus-stats-batch.js`. Two gates each: the route file and
`lib/row-market-stats/handler.js:37` `enabled = false`.
`lib/service-client-route-actions.js:140` declares `/api/market-stats`
`ZERO_IMPORT` and line 235 enforces that this implies `HARD_CONTAIN`; both must
change together. Dual scope is nearly free: `calculateMarketStats` already takes
an arbitrary dataset, `normaliseFilters` already handles seven filters,
`buildMetricEntries` already accepts `allowedDealIds`. Add a `dealIds` filter,
roughly 10 lines, and a filter control on the review page.

**Do not rebuild `lib/canonical-v2/derived-comparison.js`.** It exists, passes 38
hostile tests, and is deliberately unconnected because a caller can hand it
self-authored trust records. Read `requireTrustFunction` before wiring it.

**Known risk.** The cohort logic, which decides which deals a lawyer may compare,
has never met real data, and its entire database reader has no test coverage:
the tests inject an empty object as the client. Instrument the first real run.

**Proves it is done.** Market statistics render on a preview deployment for a
real deal, under both scopes, and the cohort reader has a test against real
shaped data rather than an empty object.

## Step 8B. Fix the search field registry through its generator

**What it is.** 104 of 699 fields in the query registry resolve to a *different*
field than the one named, because an earlier entry's alias list shadows a later
entry's own key. Verified examples: the parent's public-statements carve-out
returns the company's, which is a party inversion; the fiduciary-out standard
returns the engagement standard, which is a different legal test; a
months-valued field is typed as US dollars.

**Why.** Latent while search is off. Live the moment it is on. One in seven.

**Change.** Fix it **through the generator**:
`scripts/generate-query-serving-registry.js` writes
`lib/query/serving-registry-v1.json`, and `scripts/process-intelligence-baseline.mjs`
hash-pins it. Hand-editing the output passes a naive acceptance test and the
next regeneration reinstates all 104 errors.

**Proves it is done.** Assert `resolveKey(entry.key) === entry.key` across all
entries, after regeneration, not before.

## Step 8C. Search, in preview

**What it is.** Switch the search tools back on in the test environment.

**Why last.** It is a rewrite of seven routes, the load pattern that caused the
containment is unfixed, and the governing rule explicitly rejects the guard that
exists.

**Change.** Restore routes from `lib/query/contained-routes/`. Three query kinds
survive, not five. **The archived `saved-queries.js` will not load**: its imports
were never re-based when it moved a directory deeper and resolve to `lib/lib/...`.
It also fetches provisions unpaginated, truncating at 1000 of roughly 12,600
rows. Stage the reopening: `kinds`, `demo-set` and `field-options` without a
field argument cost zero or trivial database work.

**Proves it is done.** Search returns results on a preview deployment for at
least one query of each surviving kind. The 18 pinned demo-set expectations are
baselined to a 19 July corpus and will fail for unrelated reasons; re-baselining
needs a human to read every changed expectation, and that reading is part of this
step, not a follow-up.

## Step 8D. The comparison view

**What it is.** Three things Ben ruled and nothing currently owns: choose which
terms appear rather than always showing everything, remove the three-deal limit
with horizontal scrolling, and show source-completeness as a column and a
banner.

**Change.** The limit is `MAX_COMPARED = 3` in
`components/review-v2/compareData.js`. Row identity for term selection already
exists as `unionRows` in `compareRowUnion.js`. The completeness state model is
built and committed; it needs a column and a banner, not a page. Export to Excel
and PDF is deferred until after launch, on Ben's instruction.

**Proves it is done.** Four deals compare side by side with a term selector, on
a preview deployment, with a completeness column populated from the existing
state model.

---

# Stage 9. Go live

Five steps, matching the five Ben ruled are needed (`DECISIONS.md` item 9),
against the documented twenty-five. Gated on Stage 4, Stage 5 and Stage 7.

## Step 9A. Rehearse the import against staging

**Blocked on an answer from Ben.** `OPERATING-RULES.md` permits importing
canonical data in principle since 6 August, and separately keeps production data
access and real credentials prohibited. Whether running Step 4B's tool against
the real staging project, which is not production, falls inside the first or the
second has not been ruled on. Ask; do not infer.

**What it is.** Run the import driver, unmodified, against the hosted staging
database, for one real deal, then undo it.

**Change.** Target `CANONICAL_V2_STAGING_DATABASE_URL`, the connection
`lib/canonical-v2/serving-client.js` already validates the shape of. No new
credential. Per `OPERATING-RULES.md` this only ever runs from Ben's machine.
Before importing, `pg_dump` the schema and restore it to a Supabase branch
created for the purpose and deleted afterwards, then diff the two.

**Proves it is done.** Four things, each by a command whose output is kept: a
backup exists and has been restored elsewhere and checked against the source; a
real write-set imported unchanged; imported rows compared field by field against
the source file by deep equality, never by row count; the import undone and the
tables verified back to their pre-import state, not assumed from the rollback's
exit code.

## Step 9B. The production backup and restore drill

**What it is.** The same drill as Step 4F and Step 9A, against production, for
real.

**Why.** No production restore has ever been exercised. It is the cheapest real
gate before anything is written.

**Change.** Nothing in code. A recorded procedure with its exact commands, which
is the whole content of the retired `P9_BEN_RUNBOOK` gate.

**Proves it is done.** A production backup restored to a separate location and
checked against the source, with every command and its output kept. Per this
programme's standing rule, a receipt that does not name its exact command is not
a receipt: eight historical test-count claims were re-run and only the two
recorded with their commands reproduced.

## Step 9C. Import to a namespace the live site is not reading

**What it is.** Load V2 data into production without switching to it.

**Why.** It separates the risk of loading from the risk of serving.

**Change.** Step 4B's driver, writing to `canonical_v2_staging` or a
same-shaped schema kept out of `public`. **Not** `public.provision_cards` or
`public.claims`: ADR-001 in `OPERATING-RULES.md` forbids that absolutely, in
those words, and it is a standing ruling, not a judgement to revisit here.

**Proves it is done.** Imported rows compared field by field against the source
write-set, deep equality on every field. Nothing a live route reads has changed,
proven by fetching a review page before and after and diffing the responses.

## Step 9D. Flip the switch

**What it is.** Turn V2 serving on in production for the families that passed
Stage 5.

**Change.** `lib/canonical-v2/feature-flags.js`: every `CANONICAL_V2_*_ENABLED`
flag is currently checked together with `isPermittedCanonicalV2Runtime()`, which
is false on Vercel production regardless of the flag. Both signals must change.
Per family, not all at once.

**Needs from Ben.** A one-use authorisation, dated, in his own words. This is the
kept form of `P9_CUTOVER_AUTHORISATION` and no document substitutes for it.

**Proves it is done.** Fetch the same deal from the deployed site and from a
local build of the same commit and compare the served payloads; they agree. This
is the replacement for `P9_DEPLOYMENT_PARITY`, whose own named tests are one of
three implemented.

## Step 9E. Roll back, for real, once

**What it is.** Run the rollback against production after the flip, deliberately,
and then flip forward again.

**Why.** A rollback that has only ever been written is not a rollback. This is
the fifth of Ben's five and the last thing that separates "it works" from "it is
safe".

**Change.** The `--rollback` mode from Step 4F, dry run then apply then verify.

**Proves it is done.** The site serves V1 again, checked by fetching a review
page and finding no V2 field in the payload; then serves V2 again after the
re-flip. Both by command, both kept.

---

## When this plan is finished

`PLAN.md` has no steps left in it, and `COMPLETED.md` has all of them with the
evidence that closed each one. That is the whole completion criterion. There is
no attestation.
