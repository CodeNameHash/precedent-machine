# The plan

This document and `COMPLETED.md` are the whole picture. Nothing is in both.
A step lives here until it is closed, then it moves to `COMPLETED.md` carrying
the evidence that closed it. If a step is in neither file, it is not planned
and it has not happened.

It supersedes `ROADMAP.md` and `WORK-COMPLETED.md`.

It does **not** supersede `EXECUTION-LEDGER.md`, and a previous version of this
line claiming it did was false in both directions. That ledger was live,
actively maintained, and governed a separate ~200-hour programme (P0–P12) whose
P8 blocker was `ACTIVE` — and it held the only evidence that this system's
database write path has ever been executed at all. It is now **parked**, by
Ben's ruling on 2026-08-06, at
`docs/parked/process-intelligence/EXECUTION-LEDGER.md`, with a README recording
what was open when it was set aside. Parked is not superseded: the work was set
aside to be rebuilt, not absorbed into this document.

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
| Times that schema has been executed | at least several, against isolated staging, all rolled back | `docs/parked/process-intelligence/EXECUTION-LEDGER.md` P8 rows: `PM-METSERA-PERSISTENCE-01` used the existing `canonical_v2_write` entry point, `PM-P8-AGREEMENT-WRITER-STAGING-03` proved the generic writer against isolated staging, both COMPLETE. A previous version of this row said **0**, citing `grep -L "new Pool\|\.query(" tests/canonical-v2-writer-*-identity-sql.test.js` — which shows only that those tests pattern-match source text, and cannot show the schema was never executed anywhere. What is still unproven is a **durable, non-rolled-back** write. |
| API routes using the service key | 19 | `grep -rl getServiceSupabase pages/api/ \| wc -l` |
| Authentication | built, enforced, 101 real-request tests pass | `CI=true node --test tests/auth-route-enforcement.test.js` |

**Read this before you read anything else.** The extraction pipeline is proven
across 25 families on essentially one agreement — and four of those 25 runs did
not complete. Nothing has been imported durably into the product's database.
Nothing V2 renders on the live site, and that is by construction rather than by
oversight: `isPermittedCanonicalV2Runtime` (`lib/canonical-v2/feature-flags.js`)
permits a preview or local runtime and denies production outright. The import
schema has been executed against isolated staging and rolled back, never
durably. One family, termination fees, serves V2 data on a preview deployment,
and it does so from a hand-typed fixture file, not from a database.

A run's output is also, today, terminal: it is written to
`evidence/canonical-v2/<deal>-<family>-<date>/` and nothing functional reads it
back. Step 2B builds the bridge that changes this. Until it exists, a
successful extraction campaign of any size changes nothing a user can see —
see `CODEBASE-GUIDE.md` section 12.

The volume of work behind this is large and it has not yet reached a user.

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
| Which families exist | `lib/canonical-v2/native-producer/producer-prompt-registry.js` | `listRegisteredSectionFamilies()` line 162, `getProducerPromptModule()` line 153, the `REGISTRY` map line 117. A family not in here cannot be dispatched. |
| What the model is asked, per family | `lib/canonical-v2/native-producer/*-producer-prompt.js` | 28 files (`ls lib/canonical-v2/native-producer/*-producer-prompt.js \| wc -l`). Only 25 are wired into the registry. `employee-dno-`, `financing-guaranty-`, `key-terms-mae-follow-on-` and `tax-dividend-appraisal-` are not, and editing them changes nothing. |
| The resolver: what turns a model answer into a governed claim, or refuses to | `lib/canonical-v2/native-producer/candidate-resolution.js` | One file, 10,126 lines. There is no per-family resolver file. Entry point `resolveCandidates`. |
| **Corroboration vocabularies**, the word lists that decide whether a claim is proven by its own quote | `candidate-resolution.js`, 13 frozen tables | `PARTY_CAPACITY_LEXICON` (1032), `MATERIALITY_TABLE` (1094), `SHARE_COUNT_KIND_CORROBORATION_TABLE` (1843), `FEE_SIDE_CORROBORATION_TABLE` (1919), `FEE_TRIGGER_CORROBORATION_TABLE` (2002), `TERMINATION_TRIGGER_KIND_CORROBORATION_TABLE` (2668), four `NO_SHOP_*` tables (3012, 3053, 3079, 3179), `MAE_CARVEOUT_CORROBORATION_TABLE` (3277), `MAE_DEFINITION_PRONG_CORROBORATION_TABLE` (3326), `GENERIC_CLAIM_KEY_RESOLUTION_TABLE` (629). Re-derive rather than trusting these: `grep -nE 'const [A-Z_]+ *=' lib/canonical-v2/native-producer/candidate-resolution.js`. A 24-line insertion had silently invalidated every number in this row. |
| Concept synonym lists, the other place a vocabulary widening lands | `lib/taxonomy.js` | `synonyms:` arrays on concept entries. This is where the material-contracts widening in commit `34059a2f` went: 88 lines changed, seven lists. |
| Family-level marker words | `lib/canonical-v2/native-producer/lexical-disagreement-net.js` | `LEXICAL_FAMILY_LEXICON` line 686. |
| Qualifier marker words (knowledge, materiality, temporal, accuracy) | `lib/canonical-v2/native-producer/qualifier-kind-lexicon.js` | `KNOWLEDGE_PATTERNS` 131, `TEMPORAL_SYMBOLIC_DATES` 146, `ACCURACY_PATTERNS` 171, `THRESHOLD_PATTERNS` 178. |
| Two small per-family corroboration files | `guaranty-corroboration.js`, `ioc-corroboration.js` | Same directory. Regexes per assertion kind. |
| Claim definitions, the contract bundle | `lib/canonical-v2/contract-bundle.js` | A genuine new claim definition costs 11 edits here. Watch the dual numbering: input at V38, concept keys at V24. |
| The runner that dispatches a family at a deal | `scripts/canonical-v2-live-extraction-run.mjs` | 951 lines. Does **not** supply Ben's two M3 auto-pass conditions: `v1v2_comparison` and `lexical_disagreement` both grep to zero occurrences in this file, so a run through it evaluates neither. `scripts/nets-eligibility-report.mjs`, the reporting side, has been broken since `0d17ad00`. Flags: `--deal`, `--family`, `--raw-html`, `--section-refs`, `--out-dir`, `--agreement-date`, `--model`, `--follow-citations` / `--no-follow-citations`, `--call-timeout-ms`, `--dry-run`. Deal pins at line 226. |
| Where a run writes | `evidence/canonical-v2/<deal>-<family>-<date>/` | 28 directories today. Each holds `run-receipt.json`, `resolution.json`, `review-queue.json`, `adapter-result.json`, `validation.json`, `run-manifest.json`, `call-telemetry.json`. |
| Cure-period and number parsing | `lib/canonical-v2/native-producer/cure-period-parse.js` | `SPELLED_NUMBER_VALUES` line 88. |
| The classifier that assigns families to sections automatically | `lib/canonical-v2/native-producer/section-family-classifier.js` | Wired in, as the opt-in `section_family_classifier` parameter to `runNativeExtraction` (`native-extraction-run.js:576`), exercised by dozens of tests. 27 rules, 26 family labels, 25 with a registered producer. Stage 1 is deterministic title/heading matching, costs zero model calls, and carries **no** blocking flag. Only stage-2 model-assisted matches (`SECTION_FAMILY_AI_CLASSIFIED`) raise `SECTION_FAMILY_AI_UNVERIFIED` — see `sectionFamilyUnverifiedReason`, `candidate-resolution.js:3928-3932`. A previous version of this row said it was "deliberately not wired in" and always blocked; both halves were false, and Step 2A was designed around that error. |

### The write and serving path

| What | Where | Note |
|---|---|---|
| The write-set validator | `lib/canonical-v2/validate-write-set.js` | Splits a write-set into `publishableWriteSet`, `residuals`, `quarantines`. Only the first is importable. |
| The write orchestrator | `lib/canonical-v2/canonical-writer.js` | `WRITE_ORDER`, `OBJECT_ID_FIELDS`, and `InMemoryCanonicalRepository` at line 787. |
| A real Postgres client | `lib/canonical-v2/serving-client.js` | A genuine `pg` `Pool` client (`createPostgresServingClient`, line 198) against staging, with import scripts under `scripts/canonical-v2-staging-*.mjs` and SQL under `sql/optionA/`. A previous version of the row above ended "There is no persistent repository", which is false. It is accurate only in the narrow sense that this client is a separate hand-built per-deal pipeline (QXO), not something the general 25-family runner reaches — which is what Step 2B builds. |
| The database schema and SQL writer | `supabase/canonical-v2-foundation.sql` | 8,686 lines. `public.canonical_v2_write` at line 1167. Executed against isolated staging and rolled back (`docs/parked/process-intelligence/EXECUTION-LEDGER.md`, P8); never durably. A previous version of this row said "Never executed", contradicting the corrected row above. |
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
| `P9_STRUCTURED_CLAIMS` | no | **Rewritten** as Step 2D: every family produces resolved claims or a stated, checked reason why it does not. |
| `P9_PARTY_LINT` | no | **Rewritten** as Step 3F. |
| `P9_SHADOW_REEXTRACTION` | no | **Rewritten** as Step 2D: re-extract and diff against a pinned baseline. |
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

# Stage 2. Find out whether the whole chain generalises

Everything downstream assumes the extraction is good. That assumption rests on
one agreement. This stage is the cheapest way to find out whether it is true,
and it is question 3 of the five: where we do not know something works, how do
we test it.

**This stage was rewritten on 2026-08-06, and the rewrite changed its shape,
not just its steps.** The previous version dispatched all 25 families at a
document in one batch, twice, and stopped at extraction. Two things were wrong
with that.

First, a batch of 25 tells you something broke, not which change broke it, and
it repeats a defect 24 more times before anyone reads a directory. Every step
below is therefore a ladder: one, then a few, then all, re-running everything
proven earlier at each rung, with a gate that must pass before the next rung
adds anything.

Second, and more important: **proving extraction generalises while proving the
write path once is the same mistake one layer down.** A single validated
write-set proves the writer handles one family's shape from one deal. The
existing evidence for the write path is exactly that — QXO F28 and Metsera,
hand-built, per deal (`docs/parked/process-intelligence/EXECUTION-LEDGER.md`, P8). So each
rung here runs the *whole chain*:

```
extract -> validate write-set -> write -> serve -> confirm it renders
```

A rung that extracts cleanly and cannot be written, or writes and cannot be
served, has not passed. This finds a writer defect at family 1 rather than
after fifteen documents of extraction, and it costs almost nothing extra:
extraction is the expensive part, and the other four steps are fast.

## Prerequisite. Wire Ben's two M3 auto-pass conditions before rung 1

**Ben ruled this on 2026-08-06 and an earlier draft of this stage dropped it.**
It is restored here as a blocking prerequisite, not an aside.

`scripts/canonical-v2-live-extraction-run.mjs` supplies neither
`v1v2_comparison` nor `lexical_disagreement` to its `resolveCandidates(...)`
call — both grep to zero occurrences in that file — so every gate below
currently reports green without evaluating either condition. A rung that
skipped them looks identical, in its evidence directory, to a rung that ran
them. That is the specific failure this stage exists to prevent, so it cannot
be tolerated inside the stage itself.

**Change.** Rule on `lib/canonical-v2/v1v2-comparator.js` and
`lib/canonical-v2/lexical-disagreement-net.js` — both built, merged as
#471/#472, seven test files, and near-invisible in these documents — then
supply both conditions at the runner's `resolveCandidates(...)` call, and fix
`scripts/nets-eligibility-report.mjs`, broken since `0d17ad00`.

**Proves it is done.** A test asserts both condition names appear in the
runner's resolve call, so this cannot silently regress to the state that made
this prerequisite necessary. Every rung's evidence then records whether each
condition passed.

**If this is released rather than done, Ben releases it explicitly**, and every
rung below states in writing that the conditions were not evaluated. It does
not lapse by being forgotten a second time.

**What this stage does not do.** It does not turn Canonical V2 on in
production. Production is hard-off by construction and deliberately so — see
`CODEBASE-GUIDE.md` section 12.2. "Serve" below means a preview or local
runtime, which is where `isPermittedCanonicalV2Runtime` permits it.

## Step 2A. Recover the section lists, which are not lost

**What it is.** Each family is run against a named list of sections. Only one
of those lists is pinned in code.

**Why.** Nothing else in this stage can run without it. Worse, two families
produced almost nothing purely because they were pointed at the wrong sections,
and nobody could see that, because the lists were invisible.

```
node -e "const s=require('fs').readFileSync('scripts/canonical-v2-live-extraction-run.mjs','utf8');
console.log(s.match(/default_section_refs_by_family:\s*Object\.freeze\(\{[\s\S]{0,200}?\}\)/g).join('\n---\n'))"
```
shows `modiv` has exactly one entry, `TERMINATION_FEE: ['7.1','7.3','8.12']`, and
`topbuild` has none.

**The other 24 exist and are mechanically recoverable.** Twenty are in
`section_references` in each `evidence/canonical-v2/modiv-*-20260806/run-manifest.json`.
The remaining four have no manifest at all — `capitalisation`,
`closing-conditions`, `interim-operating`, `no-other-reps` — and their lists are
in `section-location-scan.json` under `requested_section_references` (verified:
capitalisation is `["3.2","4.2"]`). Harvest both shapes. Do not re-derive by
hand what is already committed.

**Two lists are wrong, both found by reading them.**

- **CONSIDERATION was pointed at 2.1, 2.2 and 2.3.** Modiv's statement that
  appraisal rights are not available is in section **2.6**, which was never
  requested *for this family* — the appraisal run did request `["2.6"]`, and
  its own prompt correctly declined to assert a negative from it. This is why Appraisal looks like a taxonomy gap and is not one. The
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
  into open world. The harvest will return 8.5 for this family: that is the
  error being corrected, not evidence against the correction.

**A generator, as a cross-check and for every document after this one.** Write
`scripts/canonical-v2-generate-family-section-refs.mjs`: sectionize with
`sectionizeAdmittedSource`, label each node with
`classifyDeterministicSectionFamilies`
(`lib/canonical-v2/native-producer/section-family-classifier.js:410`, stage 1
only — deterministic, unflagged, zero model calls), invert to
`family -> [section_references]`. Diff it against the harvest; read the
document wherever they disagree.

Three things are required by construction, and skipping any of them produces
wrong output that does not throw:

- **Inherit titles**, as a fallback rather than a hot path. Measured on
  Modiv: 362 of 471 referenced nodes carry no `heading`
  (`deterministic-sectionizer.js:327`), but all 101 *dispatchable* nodes do,
  because the filter below runs first. So the parent walk changes nothing on
  either pinned deal. It is kept because nothing guarantees that property
  holds for the next document and the failure mode is silent
  under-classification. An earlier version of this step called it required by
  construction; that is true of the precedent, which classifies a different
  node set, and not of this composition.
- **Filter to dispatchable nodes** before classifying, or a matching section
  drags its whole subtree into the family. Copy `dispatchableNodes`
  (`full-corpus-routing-prompt-cost-audit.js:258-276`).
- **Slice by bytes** (`utf8Slice`/`Buffer`), never `.slice()`/`indexOf`.

`buildAuditFromCaptureRecords` in the same file (function at 278, loop at
303-347) already does this composition and is a working template. It is not
exported and is scoped to a fixed cohort, so it cannot be called directly.
Note `article_context` is `null` in every live path today; do not rely on it.

`MAE_DEFINITION` has no Modiv run to harvest from, so it gets a full human read
regardless of whether the generator disagrees with anything.

**Change.** `scripts/canonical-v2-live-extraction-run.mjs`,
`DEAL_PINS.modiv.default_section_refs_by_family`: all 25 families, harvested,
cross-checked, and the two corrections above applied.

**Proves it is done.** A test asserting every registered family has a pinned
section list for `modiv`, and that invoking the runner with only `--deal`,
`--family` and `--out-dir` reproduces the **corrected** list for each — which
for CONSIDERATION and KEY_DEFINED_TERMS deliberately differs from the manifest,
because correcting those two is the point of this step. Every other family must
match its manifest exactly. Twenty-five entries, checked against the artefacts, not typed from
memory. The generator and its raw pre-correction output are both committed as
`docs/codex-program/notes/family-section-refs-modiv-<date>-generated.json`, so a
reader can see what was proposed against what a human corrected, and why.

## Step 2B. Build the bridge, both halves: run to writer, database to surface

**The bridge has two halves and both are missing.** The write half carries a
run's output into the database. The read half carries it back out to a
surface. Neither exists, and a rung of this ladder cannot be climbed without
both — 2C's "confirm it renders" is unachievable otherwise.

**The read half, stated plainly because it is easy to miss.** No serving
source reads from the database today. Grep every `lib/canonical-v2/*serving*.js`
for `serving-client` or `canonical_v2_staging`: nothing.
`termination-fee-serving-source.js`, the one family that serves V2 data on a
preview deployment, reads a static fixture
(`__fixtures__/canonical-v2/qxo-termination-fee-reviewed-excerpts.generated.js`,
line 42). So "one family serves V2" is true and does not mean what it sounds
like — it serves from a committed file, not from anything this stage writes.

This is Step 5A's module, pulled forward for the same reason the write half is
pulled forward from Stage 4: the ladder needs it per rung, not once at the end.
Build it here, generically — reading validated claims and relationships for a
given deal out of `canonical_v2_staging` in the shape the projection modules
already expect — and Step 5A becomes the product hardening around it rather
than its first construction.

### The write half

**What it is.** Today an extraction run writes JSON into
`evidence/canonical-v2/<deal>-<family>-<date>/` and stops. Nothing functional
reads it back: grep every output filename and the only non-comment consumer is
`scripts/nets-eligibility-report.mjs`, broken since `0d17ad00`.
`validate-write-set.js` produces a `publishableWriteSet` and the runner writes
it to `validation.json` and nowhere else. This step carries it into the writer.

**Why.** Without it every rung below ends in a file nobody reads, and this
stage would prove that extraction generalises into a void. This is the missing
stage named in `CODEBASE-GUIDE.md` section 12.1.

**Change.** A driver that takes a run's output directory, re-validates it,
and calls `canonical_v2_write` — the same entry point P8's staging proofs used
(`supabase/canonical-v2-foundation.sql:1167`), through
`lib/canonical-v2/serving-client.js`, against isolated staging. Two modes:
rollback (default) and durable (explicit flag). Rollback-only cannot serve, so
the rungs below need the durable mode; the flag exists so that proving the
write and proving the serving stay separable when one of them breaks.

Read P8's rows in `docs/parked/process-intelligence/EXECUTION-LEDGER.md` before writing this.
They record real runs of this function against isolated staging with replay
no-op, conflicting-replay rejection and RLS proofs, all COMPLETE. This step is
not discovering whether the writer works; it is making the general runner reach
it. Note also that `PLAN.md`'s own former claim that the schema had "never been
executed" rested on a command that only shows some tests pattern-match source
text — see `CODEBASE-GUIDE.md` section 9.

**RETRACTED 2026-08-07, same day.** An earlier version of this step recorded a
blocker here: that all 24 committed runs were rejected by the validator on
`definition_occurrences` and `source_references`, and that the producer and
validator had diverged. **That was wrong, and the error was in the bridge, not
in the system.**

`validate-write-set.js` enforces two different allow-lists for two different
write-set shapes: `WRITE_SET_KEYS` for the generic form, and
`DEAL_SCOPE_WRITE_SET_KEYS` for a `DEAL_SCOPE_RUN`. An extraction run is the
latter. The bridge called the generic validator, which correctly rejects a
deal-scope write-set. Called correctly — `validateResolvedCanonicalWriteSet`
with the run's `admitted_source_contexts` — **23 of 24 committed runs pass**.
The one failure is a specific claim in one run, not a structural divergence.

Recorded rather than quietly deleted because the retracted version was
committed and reported, and because it is the same failure this programme
keeps repeating: a confident structural claim built on one unchecked
assumption, here that there was only one validator.

**RESOLVED 2026-08-07, and two more layers behind it were opened and closed.**
Fable adjudicated the `write_set_origin` question: extend the writer's
permitted extras. The evidence is decisive. No stripper exists and none is
needed — the M3 staging path emits SQL calling `public.canonical_v2_write`
directly and never touches `canonical-writer.js` (zero references). The
validator does not merely tolerate the key, it **uses** it: at ~2102,
`answer_provenance` is required for claims only when
`write_set_origin === 'NATIVE_PRODUCER'`, so removing it upstream would
weaken validation rather than simplify anything. And the validator already
lists it beside `persisted_object_references` in an `optionalKeys` powerset
(line 507) — the writer simply never learned the key. Staleness, not a third
policy.

The writer's check now builds the same powerset instead of hand-listing one
optional key.

**Second layer, also closed.** The writer asks the *repository* to resolve
source references. Correct for a database-backed repository; wrong for an
import, because the repository has not seen this run yet — that is what
importing means. The bridge now decorates the repository with a resolver
backed by the run's own `admitted_source_contexts`, which are the authority
for that run and the ones the validator just checked.

**Third layer, CLOSED 2026-08-07 in `0993715`, and two further defects found
in the closing.** The write half is done: `modiv-antitrust-20260807-replay`
imports end to end through `canonical-writer.js`, publishing 10 excerpts, 13
provisions and 13 claims, with its admitted-source lineage rebuilt from the
committed raw HTML and verified rather than asserted. That is the first time
an extraction run has passed the writer.

The writer rebuilds each admitted-source context from primitives and checks
it equals the governed reference (`canonical-writer.js:383-397`). That is a
lineage integrity check, so it **cannot** be short-cut by handing it the
pre-built `admitted_source_contexts` the run already carries — which is
exactly what the previous resolver did. `admitted-source-chain-rebuild.js`
now rebuilds instead.

The resolver returns, per source reference, an object with four fields:

| Field | Where it comes from |
|---|---|
| `immutable_source_document` | `buildVerifiedSecSourceAdmission()` bundle |
| `source_admission_manifest` | same bundle |
| `semantic_extraction_input_envelope` | same bundle |
| `conversion` | `convertSecHtmlToCanonicalText(capture)` |

`buildVerifiedSecSourceAdmission({ capture, conversion, verification })`
(`lib/canonical-v2/sec-source-admission.js:87`) returns a bundle whose body
carries the first three by those exact names (~190-195). Its inputs:

- `capture` — `buildSecEdgarIntakeCapture()` over the pinned raw HTML, the
  same call `scripts/canonical-v2-generate-family-section-refs.mjs` already
  makes.
- `conversion` — `convertSecHtmlToCanonicalText(capture)`. **Verified: it
  emits exactly the 19 keys `CONVERSION_KEYS` requires, with
  `conversion_stage: CONVERSION_ONLY` and both statuses `NOT_ATTEMPTED`** —
  precisely what `validateConversion` demands. No adaptation needed.
- `verification` — `verifySecHtmlCanonicalText`, which
  `scripts/canonical-v2-live-extraction-run.mjs` already imports.

**Correction to a prior version of this step:** it claimed the run directory
does not carry the raw HTML path and that a deal → raw-HTML map would have to
be duplicated. False. `source-reference.json` carries
`reused_committed_raw_html` and `raw_bytes_sha256` in all 25 committed run
directories. No map was needed. The claim came from reading `run-manifest.json`
and stopping.

### Defect 1: the runner did not record its own retrieval timestamp

`loadAndVerifySource` passed `retrieved_at: new Date().toISOString()` while
reusing bytes fetched days earlier — a timestamp for a retrieval that never
happened — and wrote it nowhere. It feeds `intake_capture_receipt_id` →
`verification_manifest_id` → `immutable_source_document_id`, the identity the
writer compares. So **no run could rebuild its own chain**, and the reason was
invisible: the failure surfaced as an unexplained reference mismatch.

Fixed. `retrieved_at` is pinned per deal in `DEAL_PINS` to the pinning fetch's
actual timestamp (`2026-08-01T15:05:49.024Z` for Modiv, from
`tests/fixtures/canonical-v2/modiv-first-live-run/intake-pin.json`), the run
refuses to proceed without one, and `source-reference.json` now records every
capture input under `admitted_source_capture_inputs`.

### Defect 2: `IMMUTABLE_SOURCE_DOCUMENT/V2` is not content-addressed

**This is the more serious finding, and it is open.**

That schema includes `source_map_compressed_sha256` — a digest of *DEFLATE
output* (`sec-html-canonical-text.js:390`, carried into the identity by
`compactSourceMapLineage` at `sec-source-admission.js:76`). The compression
parameters are pinned; the **zlib build is not part of the contract**, and
different builds emit different bytes for identical input at identical
settings.

Measured on `modiv-antitrust-20260806`, not inferred:

| Quantity | Rebuilds? |
|---|---|
| Uncompressed source map, 6,902,109 bytes | identical |
| `source_map_digest` (contentId over the uncompressed structure) | identical |
| `canonical_text_id` | identical |
| `source_map_compressed_sha256` | **differs** |
| `immutable_source_document_id` | **differs, as a consequence** |

None of the 135 available `(level, memLevel, strategy)` combinations on this
Node's zlib reaches the committed digest. So the pre-2026-08-07 runs are
unimportable **in this environment by construction** — not for want of
anything the runs failed to record.

They are **refused, not repaired**. The available alternative — re-derive
`source_references` from the rebuild so the write-set agrees with itself —
would make every run import cleanly by editing the evidence until it passed,
which is precisely what the writer's comparison exists to prevent.

Recovery costs nothing: replay regenerates a run in the current environment
with zero model calls, and the regenerated directory rebuilds.

**The whole baseline is regenerated.** All 21 Modiv families replayed through
the current runner with zero model calls, committed as
`evidence/canonical-v2/modiv-*-20260807-replay/`, and **all 21 import**: 126
claims, 52 provisions, 117 excerpts. Four families gained rows against the
2026-08-06 originals — V38 gives candidates a governed home V34 did not —
and none lost any. The originals are kept: they are the record of what was
actually run.

So rungs 1 through 4 of the ladder have an importable baseline to compare
against, which they did not have this morning.

**RESOLVED 2026-08-07 in `636dd11`, and not the way this step first proposed.**
Rekeying the identity onto `source_map_digest` was rejected on blast radius:
it cascades into `source_occurrence_id`, which sits in every excerpt row and
is a key in `supabase/canonical-v2-foundation.sql`, where the contract is
*reimplemented in SQL*. See DECISIONS.md.

Instead: DEFLATE **de**compression is deterministic even though compression
is not, so a run now persists its compressed source map and a rebuild adopts
those bytes only after proving they inflate to the map it independently
derives from the document. Reproducible on any machine, with no contract
change — and, unlike recording the timestamp alone, it survives a Node
upgrade in place.

Runs made before 2026-08-07 still record neither, so the rule for them
stands: **regenerate by replay, never re-derive the reference.**

### Defect 3: the bridge imported a tenth of each run, and succeeded

The write-set inside `adapter-result.json` carries **no provisions**. The runner
composes what it validates at `canonical-v2-live-extraction-run.mjs:1114` as
`{...adapterResult.write_set, provisions: [...provisionsById.values()]}`,
reading the provision instances out of `resolution.resolved[]`. A claim whose
governing provision is absent is **dropped as non-publishable, not rejected**.

So importing `adapter-result.json` directly wrote 10 excerpts, lost all 13
claims, and reported `accepted: true`. A silent scope narrowing of exactly the
shape `CLAUDE.md` warns about, and no validator could have caught it.

Fixed twice over: `readRunEvidence` composes the same write-set the runner
validated, and `importRunEvidence` refuses a `PUBLISHABLE_SHORTFALL` — any
import that would publish fewer rows than the run itself did.

Found by a test asserting the import publishes *something*, not by anything
failing. Keep that assertion.

**Superseded note, kept for the reasoning it records.**
With validation passing, the writer refuses a `DEAL_SCOPE_RUN`:
"writeSet must match the closed reference-only semantic contract"
(`canonical-writer.js`, `assertDealScopeWriteSetShape`, ~293-314). That check
demands the key set **exactly equal** its list, permitting only
`persisted_object_references` as an extra.

Diffed: a run's write-set contains all 18 required keys **plus
`write_set_origin`**, and nothing else. That single key is the whole
difference.

**Three lists in three files disagree about it, and the writer is the
outlier.** `validate-write-set.js`'s deal-scope list permits it — which is
why 23 of 24 runs validate. `m3-staging-candidate-preflight.js` has its own
19-key list that **requires** it, and additionally asserts
`write_set_origin === 'NATIVE_PRODUCER'`. `canonical-writer.js`'s list is the
only one that excludes it.

**What is NOT established, and must be before anything changes.** The
plausible reading is that some step between preflight and write strips the
key, and that the M3 staging path therefore never hits this. Searched for it
and did not find it — but "I did not find it" is not "it does not exist",
and this document has already been wrong once this week by treating those as
the same. Establish which of these is true before touching any of the three
lists:

1. Something strips `write_set_origin` before the write, and the bridge
   should do the same. Cheapest, if it exists.
2. The writer's list should include it, matching the other two.
3. The producer should stop emitting it, and the preflight's requirement is
   the stale one.

Do not pick by majority. Two lists agreeing is not evidence when all three
were written at different times for different callers.

One thing this already proves: reading the write-set from
`validation.json`'s `publishableWriteSet` does not work. That is the
post-split publishable subset, and it lacks the five source-admission keys
the validator requires. `adapter-result.json` carries the complete
`write_set` plus `admitted_source_contexts`, and is the file to read.

**Proves it is done (write half).** One family's committed evidence directory
goes in, rows come out in staging, and a second identical invocation is a
no-op. Both proved by test, not by a screenshot. Blocked on the
closed-reference-only-semantic-contract refusal above.

### The read half

**What it is.** One module that reads validated claims and relationships for a
given deal out of `canonical_v2_staging` and returns them in the shape a
projection module already expects — the generic version of what
`termination-fee-serving-source.js` does today from a fixture.

**Why.** Without it nothing this stage writes can be looked at, and every rung
below stops one step short of the thing it claims to prove. It is also the
difference between "the row exists in staging" and "a person can see it",
which is the whole point of running the ladder vertically.

**Change.** A new module alongside the existing serving sources, taking its
connection from `lib/canonical-v2/serving-client.js`. It must fail closed the
way the existing serving gate does: `isPermittedCanonicalV2Runtime`
(`lib/canonical-v2/feature-flags.js`) denies production outright, and this
module must not become the exception that quietly changes that. Preview and
local only, deliberately.

**Reconnaissance, 2026-08-07. Three findings, and one of them blocks.**

**1. It is reassembly, not translation — the mapping layer this step assumed
is not needed.** `project()` in `termination-product-projection.js` (439-557)
reads exactly ten fields off a resolved entry, and the runner's
`resolution.json` entries are a **strict superset** of them: same names, same
paths, nothing to rename. The four tables the writer populates
(`excerpts`, `provision_instances`, `provision_components`, `claim_revisions`,
foundation.sql 402-450) are identically shaped — `id`, `closure_id`,
`canonical_payload jsonb`, digest — and `canonical_payload` is the write-set
item **verbatim**. So the rows coming back out are the same objects that went
in, and the reader reassembles the wrapper rather than converting anything.

Proven, not assumed: `tests/canonical-v2-run-projects-to-product-cards.test.js`
projects every importable run through both termination projections, and
`modiv-termination-fee-20260807-replay` yields ten real cards. That seam had
never been exercised — the one family serving V2 builds its cards from a
hand-encoded packet, so the runner's output and the projection's input had
never met.

**2. `document_hash` is the deal key, not `deal_key`.** `deal_key` is
per-(deal, family): the 21 committed Modiv runs carry 21 distinct ones
(`deal:modiv-termination-fee:...`, `deal:modiv-antitrust-regulatory:...`)
over a single `document_hash` (`659bcfaa…729968`). Nothing in the schema says
so; it was derived from the evidence. **Code that groups by `deal_key` will
silently render one family and look correct.** None of the four tables has a
deal column at all — the hash lives inside the jsonb, and `claim_revisions`
does not carry it, joining instead via
`claim.subject_occurrence_id = provision_instance.provision_instance_id`.

**3. THE BLOCKER: nothing can read those tables. Not even the writer.**
`foundation.sql:8662-8663` revokes all table privileges from `PUBLIC`, `anon`,
`authenticated`, `service_role` **and `canonical_v2_writer`**; RLS is enabled
on every table with **zero policies defined** anywhere in
`canonical-v2-foundation.sql`, `canonical-v2-serving.sql`, `lockdown-rls.sql`
or `rls-lockdown-2026-07.sql`. The only granted access is `EXECUTE` on
`canonical_v2_write` and two candidate-input functions. No view, RPC or
function joins claims to provisions to excerpts: grep every
`FROM canonical_v2_staging.{excerpts,claim_revisions,provision_instances,provision_components}`
and the only hits are idempotency-digest checks inside `canonical_v2_write`
itself (8200-8318).

So the read half is not "add a query". It needs either a new
`SECURITY DEFINER` function or explicit grants plus RLS policies — **a
deliberate change to the security surface those lockdown files exist to
police.** That is Ben's call, not a thing to slip in. It is the one piece of
Step 2B that is specified and not built.

**Do not build it against the wrong pipeline.** `serving-client.js`'s
`RPC_SPECS` (55-123) look like the answer and are not: every
`canonical_v2_active_*` RPC reads `shared_serving_rows` /
`deal_serving_directory` / `exact_detail_serving_packages`, populated only by
`canonical_v2_import_candidate_release` and gated on
`active_corpus_release_pointers` — which has **zero rows**. That is the Step
5A corpus-release layer, downstream of and separate from what the writer
populates. Building the read half there would produce a module that reads
nothing and blames the pointer.

**Two inputs the projection wants that the schema does not store**, so they
cannot come back out of the database at all as things stand:
`resolution.open_world[]` (the open-world tables exist but their payload shape
against `resolution.json`'s entries is unverified — read them before
assuming) and `resolution.conditional_termination_fee_values[]`, which has no
table anywhere. The second matters: Modiv's §7.3 conditional fee drives the
card headline through `conditionalFeeExtraGroups`. Either it gets a home or
the database-backed render omits that feature, deliberately and in writing.

**Proves it is done (read half).** The rows written by the write half come
back out through this module for the same deal and family, in the shape the
projection expects, and a request in a production-shaped environment is
refused. Both by test.

**Proves the step is done.** Both halves, plus one end-to-end pass: an evidence
directory in, rows in staging, the same claims back out through the read half.
That round trip is what Step 2C then exercises against a real surface.

## Step 2C. One family, end to end

**What it is.** `TERMINATION_FEE` on Modiv, through all five steps: extract,
validate, write durably to staging, serve, confirm it renders.

**Why.** It is the family with a real baseline and a known-correct section
list, so anything that fails here is a defect in the chain rather than in the
mapping. Everything after this is fan-out; this is the rung that establishes
the chain exists at all.

**Change.** Run it, diff the extraction against
`all-families-baseline-20260806.json`'s `TERMINATION_FEE` entry, write, serve
in a preview or local runtime, and look at it.

**One piece of wiring this needs, which 2B does not supply.** The only path
that attaches Canonical V2 as the served source is
`attachCanonicalTerminationFeeServing`, called from
`pages/api/review/[id]/cards.js:55`, and its registry is hardcoded to a single
deal id reading the committed fixture. 2B builds the database-backed reader as
a module; this step is where it is actually attached to that route, behind the
same server-only env var and the same production denial. An earlier draft said
"no new code beyond 2A and 2B", which was false: without this wiring there is
nothing to look at.

**Proves it is done.** The extraction matches the baseline; staging holds the
rows; the review surface renders the family for that deal in a permitted
runtime. A screenshot is not the proof — a test that reads the served payload
back is. The screenshot is for the human.

## Step 2D. Fan out the families on Modiv

**What it is.** 1 -> 4 -> 12 -> 25, each rung re-running every family proven
earlier, every rung full-depth through serving.

**Why.** So a defect is found once rather than 24 times, and so a fix that
breaks an earlier family is caught by the rung that introduced it.

**Change.** Same runner. One process per family, six to ten in parallel — the
runner is serial within a run (`native-extraction-run.js:635`) but the
processes are independent. Measured from the 20 committed `run-manifest.json` files that carry
`extraction_wall_clock_ms`, a family-run averages ~4.25 minutes (median ~3.4,
max ~18.3). A 42-run ladder is therefore about **3 hours per document run
serially, or roughly 25 minutes at eight-way**. Re-measure rather than trusting
these — the command is in `CODEBASE-GUIDE.md` section 12.4.

- **Rung 1 — one family.** `TERMINATION_FEE`, already done as 2C.
- **Rung 2 — four.** Add `CONSIDERATION` and `KEY_DEFINED_TERMS` — the two
  corrected in 2A, so this is the first real test of those corrections — and
  `APPRAISAL_DISSENTERS_RIGHTS`, whose zero output was judged correct by
  design: confirm it is still zero **for the same reason**, not because it
  silently broke.
- **Rung 3 — twelve.** Add `TERMINATION`, `SPECIFIC_PERFORMANCE_REMEDIES`,
  `MATERIAL_CONTRACTS`, `GENERAL_COVENANTS`, `REPRESENTATIONS`, `TAX_MATTERS`,
  `CLOSING_CONDITIONS`, `INTERIM_OPERATING` — the families named elsewhere in
  this plan as having known issues to watch.
- **Rung 4 — all 25.** Including `MAE_DEFINITION`, which has never run against
  Modiv, so it creates a first baseline rather than re-testing one, and
  `CAPITALISATION`, which needs `--call-timeout-ms` above the 600000 default:
  it ran 18.8 minutes last time and was killed.

Family names above are the registered identifiers; the runner rejects anything
else with `UNREGISTERED_FAMILY`.

**Proves it is done.** Checked after **every** rung, not only the last:

1. `incomplete` is 0 among families run so far. **It is 4 today** —
   capitalisation, closing conditions and interim operating failed at
   extraction or resolution, no-other-reps at validation. Commit `d261df30`
   fixed three crash causes and `ae8b12de` made the timeout configurable; this
   is the test of those claims. Closing conditions is only partly addressed:
   what was fixed is that a partial receipt is now kept, and the underlying
   unparseable response on call 2 of 4 persists, with sections 6.3 and 6.4
   never attempted. If it fails again, that is expected, and the finding is
   what the model returned.
2. No family's `resolved` count falls against its own most recent prior rung.
3. Every family run so far still writes. **And still serves, for those
   families that can be served at all** — there are 16
   `lib/canonical-v2/*-product-projection.js` modules against 25 families, so
   roughly nine have no product surface to render onto, and building those is
   Stage 5's job, not this one. For a family with a projection, the rung is not
   passed until it renders. For a family without one, the rung is passed at the
   write-and-read-back step, and the missing projection is **recorded by name**
   in that rung's regression table. Do not let "serves" quietly mean "returned
   a 200", and do not let a family with no surface silently count as one that
   serves.

A failed gate is a stop, not a note to fix at the end. Eleven of the twenty
complete Modiv runs currently resolve zero, so note that condition 2 is
**vacuously satisfied** by 0 -> 0: for every zero-resolving family, state why
zero is correct and what would make it wrong, or the gate is checking nothing.
`GUARANTY_FINANCING_PARTY` is the standing example of correct zero;
`REPRESENTATIONS`, `PROXY_MEETING` and `KEY_DEFINED_TERMS` show candidates
present with zero resolved, which looks like a resolver gap rather than absence.

Regenerate the baseline as `notes/all-families-baseline-<date>.json`, keep the
old one, and diff. This step also discharges `P9_SHADOW_REEXTRACTION` and
`P9_STRUCTURED_CLAIMS`.

**Re-runs are change-triggered, not blanket.** Re-run a (deal, family) pair
only when something it depends on changed since its last green receipt: code,
`prompt_version`, `contract_bundle_version`, or `section_references`. An
unchanged-input re-run against a live model is sampling noise, not a regression
check. **The runner change this needed is done** (2026-08-07). The manifest now
carries `code_provenance` (commit plus whether the working tree was clean, so
a dirty-tree run cannot be mistaken for one the commit describes) and
`resolved_models` (what the CLI reported actually serving each call, not the
alias the operator typed — a model swap behind an unchanged alias would
otherwise trigger no re-run at all).

One correction to an earlier draft of this step: it said the only model field
was a CLI alias. That was true of `run-manifest.json` and **false of
`call-telemetry.json`**, which has recorded `served_model` per call all along.
The manifest was the gap, not the runner.

**What is still undecided:** what counts as a family run's code footprint —
which paths, changing, should invalidate it. That is a judgement call, and
defaulting it to "any commit" would degrade this straight back to blanket
re-running. Accepted loss, stated rather than hidden: blanket re-running would
surface flakiness that a single receipt hides.

**Nondeterminism.** The runner makes live model calls with no `--replay` and no
pinned seed (a replay path exists only on the sibling
`canonical-v2-native-extract.mjs:70`). Two identical runs can differ. Before
rung 1, either build a replay path or write down the tolerance: what size of
`resolved` delta is noise, how many confirmations a red gate needs, and who
decides. Without that, the first flaky rung is resolved by whoever is at the
keyboard, which is the gate erosion this ladder exists to prevent.

## Step 2E. Map the families to TopBuild's sections, for nothing

**What it is.** Work out which sections of the TopBuild agreement each family
should be pointed at, without calling a model.

**Why.** TopBuild has 63 sections to Modiv's 99 and the articles do not align:
Modiv's termination sits at 7.1, TopBuild's boilerplate runs to 7.16. Modiv's
mapping must not be assumed. TopBuild has no run manifests, so 2A's generator is
the only source here — this is what it was built for.

**Change.** Run the generator with `--deal topbuild`, human-review every
family's proposed list against the actual text, then confirm with
`scripts/canonical-v2-live-extraction-run.mjs --dry-run --deal topbuild
--family <NAME>` for each of the 25. The runner prints `DRY RUN complete:
projected_model_call_count=N. Stopping before any model call.` Costs nothing.

**Proves it is done.** A committed mapping file listing, per family, the
resolved section references and the projected call count, with 25 entries and
zero model calls made. Any family resolving to zero sections is a finding to
record, not a family to skip — and specifically,
`GUARANTY_FINANCING_PARTY` resolving to zero *here* would mean the mapping is
wrong, before 2F ever runs. Check that by name.

**Decide what a correct-empty family looks like, here, before 2F needs it.**
`resolveRunConfig` throws on an empty section list (~357-363), and 2A's own
proof demands every registered family have a pinned list. So a TopBuild family
that genuinely has no matching sections can be recorded in the mapping and then
cannot be run, and the two requirements collide. Pick one and write it down: a
sentinel pinned value, an explicit `expected_empty` flag the runner honours, or
a runner escape hatch. Modiv papered over this by pinning `5.11` for guaranty
(resolved 0, COMPLETE); on a document where no such section exists there is
nothing to pin. This is a design decision, it is small, and leaving it to
whoever hits it first is how a gate gets quietly weakened.

## Step 2F. Fan out the families on TopBuild

**What it is.** The honesty check. Modiv is the controlled comparison; TopBuild
is the different drafter. Same four rungs as 2D, same gates, same depth through
serving.

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

**Change.** The same runner, `--deal topbuild`, with 2E's mapping.

**Proves it is done.** Run receipts under `evidence/canonical-v2/topbuild-*`
for every rung, the same three gate conditions as 2D, plus one falsifiable
prediction resolved either way:

**GUARANTY_FINANCING_PARTY must produce non-zero output on TopBuild.** It
returned zero on Modiv, and commit `ae8b12de` judged that correct on the grounds
that an unfinanced REIT merger has no financing-party protections to find. If it
returns zero on a financed deal with two dedicated financing sections, that
reasoning was wrong and the family is broken rather than correctly quiet. Write
down which it was.

## Step 2G. Fan out across documents, to ten or fifteen

**What it is.** The same ladder on the document axis, each new agreement run
alone first, then the whole accumulated set together.

**Why.** Two documents is two samples. The point of this stage is a claim about
generalisation, and that claim needs enough drafters to survive contact with a
third, fourth and tenth.

**Onboarding is the constraint, not the ladder.** Adding a document is not
routine today: the admin UI cannot save a deal in any of its three modes, the
only live ingest path (`scripts/ingest-local.js`) skips the amendment
classifier entirely, a freshly ingested deal renders an empty review page until
card-materialisation scripts are run by hand, and each `DEAL_PINS` entry is
hand-authored with two SHA256 hashes and ~600-900KB of raw HTML committed to
git. See `CODEBASE-GUIDE.md` section 12.3. Budget for that before budgeting for
model calls.

**Change.**

- **Round A — the base pair.** Modiv and TopBuild, all 25, both already proven.
  The baseline later rounds diff against, not new work.
- **Round B — one more document.** A different drafter from both, ideally a
  deal shape neither covers. All 25 families against it alone first; only once
  clean, re-run Modiv and TopBuild alongside it. A regression there would mean a
  fix for document 3 changed behaviour on 1 and 2, which should be structurally
  impossible and must therefore be checked rather than assumed.
- **Rounds C and D — five to ten more each, to 10-15 total.** Each new document
  individually first, then the full accumulated set as the regression check.
  Record every issue and fix or explicitly defer it, with a reason — no "needs
  more analysis", same discipline as Step 3H.

Ten to fifteen, not forty: the re-run cost grows with the accumulated set, and
ten to fifteen drafters establishes generalisation about as well as forty. The
remaining deals are covered by corpus certification, which is a different claim
— that the corpus is clean — and belongs in its own step.

**Proves it is done.** Run receipts for every deal x family pair executed, every
round kept rather than only the last, so the ladder is auditable afterwards. A
regression table per round: which families, which documents, incomplete count,
resolved deltas against the previous round for that pair. And each document
reaching the serving check, not only the extraction one.

## Step 2H. Say which fixes generalised and which were Modiv-only

**What it is.** One table. A row per fix landed since commit `bff5cd28`, with
its result on every document the ladder reached.

**Why.** Without it, 2F and 2G are directories nobody reads, and the next person
re-derives the same question.

**Change.** A new note, `docs/codex-program/notes/generalisation-<date>.md`,
with a column for which document round first exercised each fix and which later
rounds re-confirmed it, so a fix proven on two documents and one proven on
fifteen are visibly different confidence rather than both "pass".

**Proves it is done.** Every row cites an evidence directory and a reason-code
count from a `review-queue.json`, not a recollection. Any fix whose result
cannot be determined from the evidence is recorded as undetermined, not as a
pass.

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
`lib/canonical-v2/native-producer/candidate-resolution.js` line 2668. The four
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

**Change.** `lib/canonical-v2/native-producer/anthropic-provider.js`,
`isIncompleteSpecificPerformanceGrant` at 1188-1196.

**An earlier version of this step diagnosed it backwards, and following that
diagnosis would fix the wrong branch.** It said the filter "returns false when a
quote contains both premise patterns", implying that is the drop. It is the
opposite: returning `false` means *not incomplete*, so the assertion is
**kept**. It also proposed `operativeGrant` as the discriminator; that is
already the first condition of the drop, so it cannot discriminate anything.

Read the function as it is. It returns `true` — the reshape path — only when
all three hold: the quote contains an operative grant (`shall be entitled to`
near `injunction|specific performance|equitable relief`), **and** the source
text carries the operative premise, **and** the quote does *not* carry both
`irreparable harm would occur` and `money damages would not be an adequate
remedy`. So the real condition is a quote that grants the remedy while omitting
premises the surrounding source does contain — a quote-scope problem, not a
wording problem.

That points at the quote boundary rather than the predicate. Establish first
whether Modiv's zero-zero-zero is caused by this function at all: instrument or
replay one committed run and confirm the drop happens here before changing
anything. If it does, the fix is likely to be how much text the quote spans, or
allowing the premise to be satisfied from the source when the quote is a
faithful subset of it — not loosening the premise patterns.

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

**Change.** `PARTY_CAPACITY_LEXICON`, `candidate-resolution.js` line 1032. Two
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

## Step 3I. The P2 remainder: payment timing and the grounds-naming field

**What it is.** Two claim-definition widenings that `ROADMAP.md`'s P2 carried
and this plan did not: extracting **payment timing** (when a fee becomes
payable, as distinct from whether and how much), and a field that **names the
grounds** on which a right was exercised rather than only recording that it was.

**Why it is here.** `DECISIONS.md` items 4, 5 and 6 all cross-referenced "step
P2". When `ROADMAP.md` was archived, three live decisions would have pointed at
nothing. Grepping this plan for `payment timing` and `grounds` returned nothing
before this step existed — the work was not deferred, it was dropped without
anybody deciding to drop it.

**Change.** `lib/canonical-v2/contract-bundle.js`, as claim-definition work,
with the eleven-edit cost per genuine new claim definition that file's own
convention requires. Watch the dual numbering noted in this plan's knowledge
table: input at V38, concept keys at V24.

**Proves it is done.** Each of the two fields extracted on at least one real
agreement with a citation, and a stated reason recorded if either turns out to
be already covered by an existing definition under a different name — which is
worth checking before building, given how much of this programme's proposed
work has turned out to exist.

**Or defer it explicitly.** If Ben rules these out of scope for launch, that
ruling goes in `DECISIONS.md` and this step is deleted. What must not happen
again is the work having no home and no decision.

---

# Stage 4. Prove the write path durably, and harden it

**Rescoped 2026-08-06.** This stage previously opened "This stage is the
largest single unknown in the programme", on the premise that the schema had
never been executed. That premise is stale.
`docs/parked/process-intelligence/EXECUTION-LEDGER.md`'s P8 rows record real runs against
isolated Supabase staging through the existing `canonical_v2_write` entry
point, with exact-replay no-op, conflicting-replay rejection and RLS proofs,
all marked COMPLETE. The write path is not an unknown; it is proven on two
hand-built per-deal slices (QXO F28 and Metsera), every one of them rolled back.

So two real unknowns remain, and they are narrower and more specific than the
old framing:

1. **Does a durable, non-rolled-back write survive and serve?** Every existing
   proof ends in rollback by design.
2. **Does the writer generalise?** Two hand-built slices is the same sample
   size problem Stage 2 exists to solve for extraction. Stage 2 now runs each
   family end to end through the writer for exactly this reason, so the
   generalisation half of this question is answered *there*, not here.

What remains in this stage is the hardening that Stage 2's ladder does not
cover: idempotency and resume under interruption, refusal of what must never be
imported, row-level traceability, and backup and restore.

## Step 4A. Execute the schema against a real database, durably

**What it is.** `supabase/canonical-v2-foundation.sql` defines a
`canonical_v2_staging` schema with one table per write-set object kind, plus
`public.canonical_v2_write` at line 1167, a function that recomputes each
object's content-addressed identity inside the database before inserting it.
It has been run against isolated staging (see this stage's opening) but never
durably. Its nine tests read the file as a string and
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

## Step 4B. Harden the import driver

**Moved, not deleted.** Step 2B's write half now builds this driver, for the
same reason Step 5A's reader moved: the ladder needs it at every rung. What is
left here is hardening — the corpus-scale and failure-path work the ladder does
not exercise.

**What it is.** The driver Step 2B built, made safe for a real corpus rather
than for one rung at a time: batching, partial-failure behaviour, and the
receipt discipline Steps 4C to 4E build on.

**Why.** The ladder imports one family at a time under supervision. A corpus
import is unattended and larger, and the failure modes are different.

**The construction requirements below still apply, and belong to Step 2B now.**
They are kept here because they are the contract both steps share. The driver
must call
`validateCanonicalWriteSet` and `validateResolvedCanonicalWriteSet`
(`lib/canonical-v2/validate-write-set.js`) itself on whatever file it is given,
never trusting the file's own claim to be validated, and pass only
`publishableWriteSet` rows to the insert path.

Since `canonical_v2_write` is known to work against isolated staging (see this
stage's opening), the driver is thin: read, validate,
call the function once per deal, record the receipt. If a durable write turns
out to behave differently from the rolled-back proofs, add a
`PostgresCanonicalRepository` implementing the same method contract
`InMemoryCanonicalRepository` already implements at
`lib/canonical-v2/canonical-writer.js:787` (`getReceipt`, `transaction`,
`writeObject`, `writeDeal`, `writeReceipt`), so the already-tested orchestration
in `canonical-writer.js` stays unchanged. Either way no new orchestration logic
is written, only an adapter.

**Proves it is done.** A deal the ladder never imported goes through
unattended, every object id in the file is present in the database, matched by
id and counted by query — and an import interrupted partway leaves a state the
next run can resume from rather than a half-written deal. Step 2B's own proof
(one supervised family, round-tripped) does not discharge this.

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

**Boundary with Stage 2, set 2026-08-06.** Stage 2's ladder now runs each
family end to end — extract, validate, write, serve, confirm it renders — so
"does this family reach a surface at all" is answered there, per family, as the
ladder climbs. What stays here is everything that is about the *product*
rather than about generalisation: hardening the database-backed serving module
that Step 2B builds, rendering a second deal without
hand-writing a file for it, making runtime proof the progress measure, and
rolling the remaining families onto real product surfaces.

The two stages therefore overlap deliberately and are not redundant. Stage 2
proves the chain works for 25 families across 10-15 documents in a permitted
runtime. Stage 5 proves the product serves it. If Stage 2's serving check ever
starts feeling like it discharges Stage 5, that is a sign the check has been
weakened to a smoke test — it is meant to confirm a rendered surface, not a
200 response.

## Step 5A. Harden the database reader across families and deals

**Moved, not deleted.** This step used to build the database-backed reader from
scratch. Step 2B now builds it, because the vertical ladder needs it at every
rung rather than once at the end. What is left here is the hardening that the
ladder does not exercise.

**What it is.** Take the reader Step 2B built and make it production-shaped:
every family rather than the ones the ladder happened to reach, every deal in
the corpus rather than the 10-15 the ladder onboarded, and the failure
behaviour a real surface needs — a missing deal, a partially imported deal, a
deal whose claims exist but whose relationships do not.

**Why.** The ladder proves the reader works for what the ladder ran. That is a
sample, and the corpus is larger than the sample. This is the same distinction
Stage 2 draws everywhere else, applied to the reader itself.

**Change.** No new module. Extend the one from Step 2B. The 16
`lib/canonical-v2/*-product-projection.js` modules are not rebuilt; they are fed
from a different source.

**Proves it is done.** The reader returns, for a deal the ladder never touched,
an object the existing projection accepts without modification — asserted by
test. Plus a named, tested behaviour for each of the three partial states above,
rather than an unhandled throw.

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

**DONE — delete this step, it describes yesterday.** Commit `7042085`
(2026-08-05) added `isClaimedByAnotherFamily` guards to all four configs this
step lists as "Remaining" — `misc-boilerplate`, `antitrust-regulatory`,
`termination-rights`, `mae-definitions` — plus `advisers-fees-expenses`, a
sixth this step never named. The acceptance criteria below are already met by
per-table tests (`tests/misc-boilerplate-card-selection.test.js`,
`tests/termination-fee-card-selection.test.js`, and siblings).

This step was written into a plan dated 2026-08-06 describing the state of
2026-08-05. It is the house failure mode occurring inside the document that
warns about it, and it would have gone green with zero work done. Move it to
`COMPLETED.md` with commit `7042085` as its evidence; do not implement it.

**Original acceptance criteria, retained so the move can be checked:** a test
per table that a card another family owns is refused, and a test per table that
a genuine subtype-less card is still caught.

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

## Step 6D. Make the amendment warning reach a human, and close the bypass

**What it is.** The residue of amendment/restatement handling — the part that
is genuinely missing, as opposed to the part that already exists.

**What already exists, so nobody rebuilds it.**
`lib/agreement-revision-classifier.js` classifies `ORIGINAL` /
`AMENDED_AND_RESTATED` / `AMENDMENT` / `AMBIGUOUS`, and its stated design is
that "what it cannot place is AMBIGUOUS for a human, never a guess". It is
wired into `selectAgreementExhibit` (`lib/edgar-catalog.js:334`, `:514`), which
excludes amendments and stops on ambiguity. A previous version of this plan
proposed building this from scratch as its highest-priority item; that was
false, and it was the third capability this programme has asserted out of
existence.

**What is actually missing, both verified.**

1. **The warning reaches no human.** `needs_human_review` is set correctly
   (`edgar-catalog.js:341`, `:374`) and consumed by nothing a user sees: its
   only UI consumer, `pages/api/admin/candidates.js`, is a
   `createBroadCorpusContainedHandler(['GET','PATCH'])` — a 503.
2. **The live ingest path bypasses the classifier entirely.**
   `scripts/ingest-local.js`, which self-documents as the only live path to
   ingest a new deal, has **zero** references to `edgar-catalog` and therefore
   never calls `selectAgreementExhibit`. Whoever runs it must already know
   their URL is the original agreement.

**Why this gates launch.** `DECISIONS.md` rules that detection plus a visible
warning ships before go-live. Detection ships. The visible warning does not,
and the path most likely to be used skips detection altogether. Full amendment
*parsing* remains deferred to after launch, unchanged.

**Change.** Route `ingest-local.js` through `selectAgreementExhibit`, or give
it an explicit, logged override for the case where the caller has already
identified the exhibit. Then surface `needs_human_review` somewhere a person
looks — which depends on Step 7C's disposition of
`pages/api/admin/candidates.js`, so sequence it after that.

**Proves it is done.** Ingesting a known amended-and-restated agreement through
the live path produces a visible warning rather than silently proceeding, and
ingesting a known original does not. Both by test, plus one real run.

---

## Step 6E. Certify the corpus, once the mechanism is proven

**What it is.** Run all 25 families across all 40 deals and check the result at
scale, against the ingest-QA gates, quote verification at zero flags, and the
golden evaluation harness.

**Why it is not Stage 2.** Stage 2's ladder proves the *mechanism* generalises,
across 10-15 documents chosen for drafter variety. That is a different claim
from *this corpus is clean*, and conflating them is how a generalisation result
gets read as a quality result. This step is the second claim, and it can only
run after Stage 2 has proven the chain and Stage 4 has made import unattended.

**The before-picture, stated as stale.** As of 13 July 2026: 18 of 40 deals
fully clean, 66 coded provisions across 22 deals with no card, 13 deals failing
soft gates. Those numbers are a year-quarter old at time of writing, predate
every fix since, and must be re-measured rather than cited. They are recorded
only so the direction of travel is checkable.

**Why this step exists at all.** It was the second half of `ROADMAP.md`'s P6,
and when that document was archived it had no home in this plan. Without it,
this plan's scope silently stopped at "prove the mechanism twice" and never
said when the whole corpus gets re-run.

**Change.** No new product code. A run, plus a written result.

**Proves it is done.** A committed corpus report: per-deal pass/fail against
each named gate, the count of coded provisions with no card, and the deals
failing soft gates — each figure carrying the command that produced it. A deal
that cannot be certified is recorded with the reason, not omitted.

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

**Three corrections before anyone executes this.** (1) The route-inventory
assertion this step relies on fires only inside a test, never at module load —
`DECISIONS.md` item 1 states this correctly and this step implied otherwise.
(2) `saved-queries`' repaired handler lives in `lib/query/contained-routes/`,
not `lib/broad-corpus/`. (3) `saved-queries` is claimed by both this step and
Step 8C, with conflicting order: un-containing it here first would ship 8C's
known truncation defect. 8C goes first for that route, or this step explicitly
excludes it.

**And the scope is four of twenty-three.** There are 23 routes contained via
`createBroadCorpusContainedHandler`; this step repairs four, and roughly 18 of
the rest are owned by no step in this plan. That is not an argument for widening
this step — the other 19 may be correctly contained — but Stage 9 currently goes
live with ingest, admin and corrections routes permanently 503 and no recorded
decision saying so. Either give them a disposition or record the containment as
intentional, before go-live rather than after.

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

**DONE — delete this step, same commit as Step 6A.** `7042085` fixed the
shadowing through the generator, which is the method this step itself requires,
and added `tests/query/serving-registry-alias-shadowing.spec.js` asserting
`resolveKey(entry.key) === entry.key` across all entries — this step's exact
acceptance criterion. Measured at HEAD: **0 of 699 shadowed, not 104.** The test
passes (8 assertions).

Like Step 6A, this would have gone green with no work done. Move it to
`COMPLETED.md` citing `7042085`.

**One thing worth carrying forward rather than losing with the step:** the
reason it insisted on fixing through the generator — hand-editing
`lib/query/serving-registry-v1.json` passes a naive test and the next
regeneration reinstates every error — is a live constraint on anyone touching
that registry, and belongs in `CODEBASE-GUIDE.md` rather than in a deleted step.

## Step 8C. Search, in preview

**What it is.** Switch the search tools back on in the test environment.

**Why last.** It is a rewrite of seven routes, the load pattern that caused the
containment is unfixed, and the governing rule explicitly rejects the guard that
exists.

**Change.** Restore routes from `lib/query/contained-routes/`. Three query kinds
survive, not five.

**One blocker here is stale and one is live.** The import defect is fixed:
`saved-queries.js` loaded at `lib/lib/...` paths, was re-based in `2396bf5`
(2026-08-05), and requires cleanly at HEAD — verified by loading it. Its own
line 1 comment records the fix. **The truncation is real**: it still fetches
provisions unpaginated, cutting off at 1000 of roughly 12,600 rows. That is the
blocker to plan around, and it is also why this route must be repaired here
before Step 7C un-contains it — see the ordering note in 7C. Stage the reopening: `kinds`, `demo-set` and `field-options` without a
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

**That proof is not sufficient on its own and must not be accepted alone.**
Flipping the feature flag off produces exactly the same observable — no V2 field
in the payload — with the rollback never run. So the receipt must also show the
rollback executed against the database: the `--rollback` receipt id, the row
counts before and after, and evidence that the flag was *not* the mechanism.
Otherwise the last of Ben's five is discharged by a config change.

---

## Risks this plan carries and does not close

Named so they are not silently absent. Carried over from `ROADMAP.md` when it
was archived; that document tracked risks this one did not.

- **Risk 8: there is no monitoring.** Nothing alerts on a failed import, a
  serving error, a stalled extraction run, or a production regression. Every
  failure mode in this plan is currently discovered by someone looking. No step
  below closes this, and it is unscheduled rather than solved.
- **The nondeterminism the ladder depends on.** Stage 2's gates compare counts
  across live model runs. The replay path decided on 2026-08-06 is the mitigation;
  until it exists, every gate result carries sampling noise.
- **The branch is ahead of `origin/main` again.** `DECISIONS.md`'s D1 entry
  records that the merge was completed three times and has reopened in
  miniature since. Carried here from `ROADMAP.md` when it was archived, so it
  is not rediscovered as a surprise: check with `git log origin/main..HEAD
  --oneline` rather than against another document's account of it.
- **Onboarding is a research project, not an operation.** See
  `CODEBASE-GUIDE.md` section 12.3. Stage 2's document ladder assumes 10-15
  agreements can be onboarded; nothing in this plan has yet made that routine.

## When this plan is finished

`PLAN.md` has no steps left in it, and `COMPLETED.md` has all of them with the
evidence that closed each one. That is the whole completion criterion. There is
no attestation.
