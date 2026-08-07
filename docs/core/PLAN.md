# The plan

> **Picking this up after time away?** Start with
> `docs/codex-program/notes/handoff-2026-08-07.md`, which says what changed on
> that date, what is waiting on Ben, and what to do first. It is dated and will
> go stale; this document does not.


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
| Extraction run directories carrying output | 49 | `evidence/canonical-v2/baseline-manifest.json`, `run_count` (directories with an `adapter-result.json`. The folder holds 54 entries: these 49, the three 2026-08-06 runs that crashed before writing one — capitalisation, closing-conditions, interim-operating, all since recovered by replay into separate directories — plus `m3-pilot-20260804-fresh` and the `_admitted-source-map-payloads` store) |
| **Of those, importable** | **25** | `evidence/canonical-v2/baseline-manifest.json`, `importable_run_count` |
| Registered families with an importable run | 25 of 25 | same, `families_with_an_importable_run` |
| **Families whose importable run publishes claims** | **15 of 25** | same; ten publish zero, each triaged in Step 2B |
| Claims / provisions / excerpts across the importable baseline | 170 / 67 / 159 | same, `totals` |
| Candidates with no governed slot, in the evidence directories | 275 | `resolution.open_world` summed across importable runs |
| Candidates with no governed slot, written to any database | **0** | the adapter lists all five open-world collections in `EMPTY_COLLECTION_KEYS`; see Step 2B |
| Runs that did not finish | 0 among the importable set | three were recovered by replay on 2026-08-07; see Step 2B |
| Model calls spent producing the current baseline | 0 | every importable run is a replay of already-recorded responses |
| Rows of V2 data written to a real database, durably | **3 claim revisions**, one family, local container | Step 4A, 2026-08-07. `modiv-no-other-reps-20260807-replay` through `public.canonical_v2_write`, receipt `b3332c4d…5717baf` status `COMMITTED`, never rolled back, JS and SQL receipt identities identical, reproduced on a second fresh container. Commands in `docs/codex-program/notes/step-4a-durable-write.md`. The row above previously read **0** |
| Claim-publishing families the SQL writer can actually accept | **9 of 15** | Step 4A1. Six are rejected outright because `STRUCTURAL_PROVISION_INSTANCE/V1` appears **zero** times in the 8,686-line schema while four `lib/` files build it. This is the largest single blocker on the import path and it was invisible until the schema was executed |
| Product surfaces the parity register still blocks | 102 of 143 | `node -e "const {CURRENT_M3_FAMILY_PARITY_REGISTER,listM3ProductParityBlockers}=require('./lib/canonical-v2/native-producer/m3-family-parity-register.js');console.log(listM3ProductParityBlockers(CURRENT_M3_FAMILY_PARITY_REGISTER).length)"` |
| Pre-production gates declared | 25, all OPEN | `node -e "const Y=require('yaml'),f=require('fs');console.log(Y.parse(f.readFileSync('docs/codex-program/programme-gates.yaml','utf8')).programme_gate_registry.preproduction_gates.length)"` |
| Of those, with any acceptance criteria | 5 | section 5 below |
| Mandatory adversarial tests, implemented | 7 of 289 | `node -e "const {MANDATORY_ADVERSARIAL_TEST_IDS,testExecutableState}=require('./lib/programme-gates/test-executable-registry.js');console.log(MANDATORY_ADVERSARIAL_TEST_IDS.filter(id=>testExecutableState(id)==='IMPLEMENTED').length)"` |
| Lines of database schema written | 8,686 | `wc -l supabase/canonical-v2-foundation.sql` |
| Times that schema has been executed | at least several, against isolated staging, all rolled back | `docs/parked/process-intelligence/EXECUTION-LEDGER.md` P8 rows: `PM-METSERA-PERSISTENCE-01` used the existing `canonical_v2_write` entry point, `PM-P8-AGREEMENT-WRITER-STAGING-03` proved the generic writer against isolated staging, both COMPLETE. A previous version of this row said **0**, citing `grep -L "new Pool\|\.query(" tests/canonical-v2-writer-*-identity-sql.test.js` — which shows only that those tests pattern-match source text, and cannot show the schema was never executed anywhere. What is still unproven is a **durable, non-rolled-back** write. **Closed 2026-08-07 by Step 4A**: applied to `postgres:16-alpine` with no errors and written to durably. The schema needs scaffolding a vanilla Postgres lacks — an `extensions` schema with `pgcrypto`, and the `anon`/`authenticated`/`service_role` roles its REVOKE/GRANT block names — captured in `scripts/lib/canonical-v2-local-setup.sql`. |
| API routes using the service key | 19 | `grep -rl getServiceSupabase pages/api/ \| wc -l` |
| Authentication | built, enforced, 101 real-request tests pass | `CI=true node --test tests/auth-route-enforcement.test.js` |

**Read this before you read anything else.** The extraction pipeline is proven
across 25 families on essentially one agreement. Nothing has been imported
durably into the product's database. Nothing V2 renders on the live site, and
that is by construction rather than by oversight: `isPermittedCanonicalV2Runtime`
(`lib/canonical-v2/feature-flags.js`) permits a preview or local runtime and
denies production outright. One family, termination fees, serves V2 data on a
preview deployment, and it does so from a hand-typed fixture file, not from a
database.

**"The write half is done" means in memory.** Step 2B's write half is closed
and a run does pass the canonical writer end to end — but against
`InMemoryCanonicalRepository`, in process. `canonical_v2_write`, the 8,686-line
SQL reimplementation of the same contract, **has never received the general
runner's output**. The JS writer and the SQL writer have not been shown to
agree on this data. Step 4A is where that is settled, and it needs no decision
from anyone: a local Postgres container and `psql`.

Two numbers in the table above are the ones to hold on to. **25 families have
an importable run; 15 publish claims.** And of the ten cards a termination-fee
run projects onto a product surface, **four survive a round trip through the
database** as things stand — the rest are open-world evidence the adapter never
writes, or conditional-fee values with no table to write to. The headline
number and the honest number differ by a factor the headline invites you to
miss.

The volume of work behind this is large and it has not yet reached a user.

**The lesson of 2026-08-07, which is one lesson and not two.** Both of that
day's significant findings were green gates that had never run, and neither was
visible to any amount of reading.

- The lexical disagreement condition reported nothing wrong on
  `modiv-no-shop`'s 42 resolved claims. It had examined none of them: all 42
  carried `LEXICAL_DISAGREEMENT_NET_ABSENT`. Wiring it changed no headline
  count and changed the triage of every single claim.
- The SQL writer was believed to agree with the JS writer. Executing it showed
  it rejects six of the fifteen claim-publishing families outright, on an
  object kind it has never heard of, with an error message naming the wrong
  cause.

Neither was a subtle bug. Both were large, and both survived because the thing
in question had never been executed against real data — one because a
parameter was not passed, one because a schema had never been applied. This
programme's documented failure is forgetting what it has built; this is its
twin, **believing something works because it has never been run**. A count of
zero problems from a check that did not execute is indistinguishable, in every
artefact, from a clean run.

The practical rule: **before trusting any gate, prove it ran.** Not that it
passed — that it evaluated something. Every rung's evidence now records which
conditions were evaluated, for exactly this reason.

**The baseline was regenerated on 2026-08-07, after Stage 3's code work, and
the numbers below are measured rather than estimated.** All 25 committed
directories were replayed in place at zero model cost, three live runs were
added, and `npm run gate:baseline` passes.

| Measure | Before Stage 3 | After |
|---|---|---|
| Importable runs | 25 | **28** |
| Registered families with an importable run | 25 of 25 | 25 of 25 |
| **Families whose run publishes claims** | **15 of 25** | **18 of 25** |
| Claims / provisions / excerpts | 170 / 67 / 159 | **203 / 86 / 181** |
| Open-world entries | 275 | **244** |

The open-world fall is **exactly the 35 Step 3G predicted**, verified against
the pre-overwrite `resolution.json` for all 25 directories, with four more
added by the three new live runs' own findings. **No family's `resolved` count
fell anywhere**, checked directory by directory. Six improved. Representations
still resolves zero but moved 10 candidates out of open world into the review
queue, which is Step 3G's routing fix doing what it was meant to.

**The seven families still publishing zero**, so nobody has to re-derive the
list: `APPRAISAL_DISSENTERS_RIGHTS`, `DIVIDENDS`, `EMPLOYEE_MATTERS`,
`FINANCING_COVENANTS`, `GUARANTY_FINANCING_PARTY`, `KEY_DEFINED_TERMS`,
`REPRESENTATIONS`. **Some of those zeros are correct.** Guaranty finds nothing
on an unfinanced deal because the agreement has no such provisions, and
Appraisal is correct by design. Treating a correct zero as a bug means
inventing provisions the deal does not contain.

**A defect found by the live runs, and FIXED 2026-08-07 the same day.**
`KEY_DEFINED_TERMS` published zero claims even though its corrected §8.12 pin
resolved 10 real candidates. Step 2A's pin defect was genuinely fixed; a
second, narrower one sat behind it. All ten died in the adapter's post-shift
evidence re-verification as `EVIDENCE_SHIFT_TEXT_MISMATCH`, leaving five
provisions with no attached claim.

The cause was a stale header. `checkEvidenceScope` has a documented exception
— a defined-term claim's `DEFINITION` edge is checked against
`attributes.definition_head_quote`, not `raw_value`, which carries the
operative limb's text — and the adapter's `expectedTextForEdge` never carried
it, while its header asserted a simpler invariant that was silently false for
exactly this shape. **Publishable claims 0 to 10**, with open world and review
queue untouched. The shape occurs in exactly one of 52 evidence directories,
swept rather than assumed.

**So 18 of 25 families publishing claims is now 19**, and the counts in the
table above predate this fix. They are corrected when the baseline is next
regenerated, by replay, rather than adjusted by hand here.

---

## 3. Two corrections this plan makes to the existing record

Both were measured while writing it. Neither appears in the notes or the
commits.

**The 25-family sweep was not 25 families against Modiv.** It was 24 against
Modiv and MAE_DEFINITION against TopBuild. `ROADMAP.md` says "Every registered
section family... was dispatched against Modiv in a single sweep". It was not.
MAE_DEFINITION has no Modiv baseline at all, so it has no controlled comparison
to re-run against. **Still true on 2026-08-07**: that family now has an
importable run, but it is `topbuild-mae-definition-20260807-replay`. It has
never run against Modiv, and its Modiv pin — reviewed against the document in
Step 2A — has never been exercised.

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

**A third figure worth having.** 34 published claims belong to Merger
Structure (20) and Miscellaneous Boilerplate (14), the two families whose
projection modules `ROADMAP.md` section 2.3 calls dead code — so that much of
what the pipeline produces cannot currently render anywhere.

Re-derived against the current baseline on 2026-08-07: the two counts are
unchanged at 20 and 14, but the denominator moved from 108 to 170, so this is
**a fifth of what publishes, not a third**. The older phrasing came from the
pre-replay baseline.

```
node -e "const m=require('./evidence/canonical-v2/baseline-manifest.json');
const p=m.runs.filter(r=>r.importable && /MERGER_STRUCTURE|MISC_BOILERPLATE/.test(r.section_family||''));
console.log(p.map(r=>r.section_family+'='+r.published.claims).join(' '), 'of', m.totals.claims)"
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

**COMPLETE, 2026-08-07.** Its one step, 1A, is in `COMPLETED.md`. Every gate
identifier in `programme-gates.yaml` — all 32, across both lists — is now bound
by test to a step label or "Retired" in this document or that one, and
deleting any disposition row makes the test fail. A gate can no longer be
closed by anybody who feels done.

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

## Step 2A. Recover the section lists, which are not lost

**DONE for Modiv, 2026-08-07. All 25 families are pinned**, and
`tests/canonical-v2-modiv-family-pins.test.js` asserts it. The two corrections
this step exists to make — `CONSIDERATION` and `KEY_DEFINED_TERMS` — are both
applied, and `MAE_DEFINITION`'s generator-proposed list has been read against
the document. TopBuild is still unpinned; that is Step 2E. What follows is the
original statement of the problem, kept because it records how the lists were
recovered and why two of them were wrong.

**What it was.** Each family is run against a named list of sections. When
this step was written, only one of those lists was pinned in code.

**Why.** Nothing else in this stage can run without it. Worse, two families
produced almost nothing purely because they were pointed at the wrong sections,
and nobody could see that, because the lists were invisible. Both have since
been confirmed exactly that way: `KEY_DEFINED_TERMS` was aimed at the
interpretation conventions rather than the definitions, and `CONSIDERATION`
never requested the section carrying the appraisal negative.

```
node -e "const s=require('fs').readFileSync('scripts/canonical-v2-live-extraction-run.mjs','utf8');
console.log(s.match(/default_section_refs_by_family:\s*Object\.freeze\(\{[\s\S]{0,200}?\}\)/g).join('\n---\n'))"
```
showed, when this was written, that `modiv` had exactly one entry,
`TERMINATION_FEE: ['7.1','7.3','8.12']`, and `topbuild` had none. **Run today
it matches only `topbuild`'s still-empty block**, because Modiv's has grown
past the 200-character window the regex allows — which is the check having
served its purpose, not a broken command.

**The other 24 exist and are mechanically recoverable.** Twenty are in
`section_references` in each `evidence/canonical-v2/modiv-*-20260806/run-manifest.json`.
The remaining four have no manifest at all — `capitalisation`,
`closing-conditions`, `interim-operating`, `no-other-reps` — and their lists are
in `section-location-scan.json` under `requested_section_references` (verified:
capitalisation is `["3.2","4.2"]`). Harvest both shapes. Do not re-derive by
hand what is already committed.

**Two lists are wrong, both found by reading them.**

- **CONSIDERATION was pointed at 2.1, 2.2 and 2.3. CORRECTED 2026-08-07 to
  include 2.6**, which no previous sweep did — §2.6 reads, in full, *"No
  dissenters' or appraisal rights shall be available with respect to the
  Mergers."* (119 bytes, verified against the document and pinned by
  `tests/canonical-v2-mae-definition-pin-review.test.js`). **Not yet run:**
  there are no recorded responses for 2.6 under this family, so the corrected
  pin needs a live call before it produces anything, and the committed
  baseline entry still reflects the 2.1/2.2/2.3 run. The original diagnosis
  follows, because it is what makes the correction right. Modiv's statement
  that appraisal rights are not available is in section **2.6**, which was
  never requested *for this family* — the appraisal run did request `["2.6"]`, and
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

**A generator, as a cross-check and for every document after this one. BUILT
2026-08-07 — do not write it again.** `scripts/canonical-v2-generate-family-section-refs.mjs`
exists, and its raw output is committed for **both** pinned deals:
`docs/codex-program/notes/family-section-refs-modiv-20260807-generated.json`
and `...-topbuild-20260807-generated.json`. The TopBuild file is half of Step
2E, which was written before it existed and does not know. Run it with
`--compare` to see only the disagreements.

What it does, recorded because the construction constraints still matter:
sectionize with
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

**DONE 2026-08-07, and the generator was right.** Section 8.12 "Definitions"
spans bytes 360,030–414,712 of the Modiv canonical text and contains **both**
definition sites: `"Company Material Adverse Effect" means` at byte 367,819
and `"Parent Material Adverse Effect" means` at byte 387,682. Each appears
exactly once, and of the document's 77 mentions of the phrase, 75 are uses —
so the pin `['8.12']` is complete, not merely non-empty.

*(Corrected. Both offsets were first recorded as 366,186 and 385,847, which
were UTF-16 character indices labelled as bytes — off by 1,642 and 1,843
because the filing's curly quotes are multi-byte — in a paragraph that claimed
immunity to exactly that confusion. The verdict never depended on them: the
test used `Buffer.indexOf` throughout. It now asserts the numbers too.)*

Pinned mechanically by `tests/canonical-v2-mae-definition-pin-review.test.js`,
which re-derives the canonical text and re-locates both definitions rather
than trusting these numbers, so a sectionizer change that moved the boundary
fails loudly instead of silently narrowing the run.

One cost fact, recorded so it is not later mistaken for a mis-pin: 8.12 is the
whole definitions article at roughly 55 KB, so this family's run is a single
expensive call over a section mostly not about MAE. Narrowing needs evidence
about the producer's behaviour on a narrower anchor, and that does not exist
until the family has run once.

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

**STATE, 2026-08-07 — read this before the rest of the step, which was
written when both halves were missing.**

| Half | State |
|---|---|
| Write: a run's output into the database | **Done, in memory.** Proven against `InMemoryCanonicalRepository` only; `canonical_v2_write` has never received the runner's output. Closing that is Step 4A, which needs no decision — consider running it before 2C |
| Read: back out to a surface | **Not built.** Locally unblocked (no `FORCE ROW LEVEL SECURITY`, so a table-owner connection reads freely); the *hosted* access design is deferred, see the standing action below |

**RULED 2026-08-07, and it adds work to this step: open-world evidence is
written, with a flag.** Ben ruled on the question this step raised. 275
open-world entries across the baseline currently write zero rows, because the
adapter lists all five open-world collections in `EMPTY_COLLECTION_KEYS`. That
constant is no longer the answer.

**Added to the write half.** Emit the open-world rows, each carrying an
explicit marker that it is ungoverned evidence, not a governed claim. Three
constraints, from `DECISIONS.md` decision 2, none optional:

- The marker sits **on the row**, not inferred from the collection it arrived
  in. A reader must be able to tell what it is holding without knowing where it
  came from.
- **The projection and serving layers honour it.** Emitting these rows and then
  rendering them indistinguishably from claims is worse than not emitting them
  at all: it launders ungoverned model output into apparent findings. A card
  built from open-world evidence says so on the page.
- **A test proves the two cannot be confused**, at the write boundary and again
  at the serving boundary. Same risk class as negation reversal: confidently
  wrong, correct-looking, no visible signal to the reader.

**Effect.** Of the ten cards a termination-fee run projects, four survived a
round trip before this ruling. Four of the remaining six were open-world
evidence cards; this ruling recovers them. The last two are Step 4A2's table.

**STANDING ACTION, hosted read access. Delegated to Fable by Ben on
2026-08-07.** When the read half reads rows out of a local container, take the
hosted design — `SECURITY DEFINER` function versus grants plus policies — to
**Fable as an adversarial design review, with the local shape as evidence.
Fable's verdict is the ruling.** The work does not stop for Ben.

Two things this does not license. It is not permission to settle the question
by whoever is at the keyboard: it changed hands from Ben to Fable, not from
Ben to nobody. And it is not permission to touch a hosted database — the
design may be decided in advance, but deploying it is a separate act needing
its own authorisation.

Do not carry the local table-owner shortcut into a hosted environment by
default. It works locally only because the schema has no `FORCE ROW LEVEL
SECURITY`, which is an absence, not a design. Full terms in `DECISIONS.md`
decision 1.

Everything below is the original statement of the problem plus the record of
how each layer was closed. A rung of this ladder still cannot be climbed
without both halves — 2C's "confirm it renders" is unachievable otherwise.

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

**Second layer, also closed — but SUPERSEDED three paragraphs down, so do not
implement from this one.** The writer asks the *repository* to resolve source
references. Correct for a database-backed repository; wrong for an import,
because the repository has not seen this run yet — that is what importing
means. The bridge decorates the repository with its own resolver.

The first version of that resolver returned the run's own
`admitted_source_contexts`. **That was wrong** and is not what ships: the
writer does not accept a finished context, it rebuilds one from four
primitives and compares. See the third layer below.

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

**This was the more serious finding. RESOLVED the same day — the resolution
is under "The ten zeros, triaged" below, which is where it landed and not
where it belongs. Read the defect anyway: its shape is why every
pre-2026-08-07 run is refused.**

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

**The whole baseline is regenerated.** Every committed run with usable
recorded responses was replayed through the current runner with **zero model
calls**, and **all 25 import**: 170 claims, 67 provisions, 159 excerpts. Four
families gained rows against the 2026-08-06 originals — V38 gives candidates a
governed home V34 did not — and none lost any. The originals are kept: they
are the record of what was actually run.

**All 25 registered families now have an importable run. Read that precisely.**

- **24 are Modiv**, under `evidence/canonical-v2/modiv-*-20260807-replay/`.
  Three of those (`capitalisation`, `closing-conditions`, `interim-operating`)
  came from runs that crashed on 2026-08-06 leaving their recorded responses
  behind; replaying those responses through the current code completed them.
- **`MAE_DEFINITION` is TopBuild, not Modiv**
  (`topbuild-mae-definition-20260807-replay`, 19 claims). It has still never
  run against Modiv, so it has no Modiv baseline and rung 4 remains its first
  Modiv run — creating a baseline rather than checking one. The pin is now
  reviewed (above), which is the part that was blocking.
- **`CLOSING_CONDITIONS` is partial and says so in its name.**
  `modiv-closing-conditions-6.1-only-20260807-replay` covers section 6.1
  alone. Its 6.2 recorded response is not a model response at all — it is a
  captured CLI status message beginning "Written to evidence/..." — so 6.2
  needs a live call. The directory is named `-6.1-only-` so the partial
  coverage cannot be read as the family's baseline.
- **`TERMINATION_FEE` was replayed with `--no-follow-citations`**, matching the
  2026-08-05 run it replays, because the runner now follows citations by
  default and would otherwise issue calls that were never recorded. Its
  `run-manifest.json` records `follow_citations: false`. A rung-1 comparison
  against a citation-following run is therefore not like-for-like — and the
  direction matters: the strongest committed termination-fee output (the
  citation-following run, 9 resolved) is **not** the baseline entry, so a
  count gate for this family is anchored low. It is permissive, not strict.
  Do not read a rung-1 pass for TERMINATION_FEE as evidence of parity.

So rungs 1 through 4 have an importable baseline to compare against, which
they did not have this morning — with those four caveats attached to it rather
than lost.

### The ten zeros, triaged

**Ten of the 25 importable runs publish zero claims.** Fifteen produce data.
That is the number the ladder is actually built on, and "a family returning
zero can be correct" is true of some of these and not of others. Triaged
2026-08-07 by reading the resolver's own decline codes and, where the codes
were not decisive, the document.

| Family | Open-world | Decline codes | Verdict |
|---|---|---|---|
| `APPRAISAL_DISSENTERS_RIGHTS` | 0 | — | **Correct zero, proven** |
| `GUARANTY_FINANCING_PARTY` | 0 | — | **Correct zero**, the standing example |
| `KEY_DEFINED_TERMS` | 15 | `DEFINITION_ENVELOPE` ×15 | **Pin defect, fixed** |
| `REPRESENTATIONS` | 28 | `..._NOT_EXACT` ×10, `..._NOT_GOVERNED` ×9, prose ×9 | Vocabulary gap |
| `GENERAL_COVENANTS` | 12 | `GENERAL_COVENANT_CODE_UNCORROBORATED` ×11 | Vocabulary gap |
| `TAX_MATTERS` | 11 | `TAX_ASSERTION_OPEN_WORLD` ×7, `TAX_TREATMENT_KIND_UNCORROBORATED` ×3 | Mixed |
| `DIVIDENDS` | 3 | family-specific surface codes | Mixed |
| `EMPLOYEE_MATTERS` | 3 | `WARN_OR_CBA` ×2, `RETIREMENT_401K` ×1 | Mixed |
| `FINANCING_COVENANTS` | 2 | `LENDER_ARRANGEMENT` ×2 | Mixed |
| `SPECIFIC_PERFORMANCE_REMEDIES` | 0 | — | **Unexplained** |

**`APPRAISAL_DISSENTERS_RIGHTS` is a correct zero and now provably so.**
Section 2.6 reads, in full: *"No dissenters' or appraisal rights shall be
available with respect to the Mergers."* One sentence, 119 bytes. Extracting
anything would be inventing it. Pinned by
`tests/canonical-v2-mae-definition-pin-review.test.js`.

**`KEY_DEFINED_TERMS` was aimed at the wrong section, and that is why it found
nothing.** The harvested pin was `["8.5"]`. Section 8.5 is *"Interpretation;
Certain Definitions"* — 3,391 bytes of construction conventions. Section 8.12
is *"Definitions"*, 54,682 bytes, the actual defined terms. So the run
correctly proposed fifteen construction rules — `"include"`, `"hereof"`,
`"extent"`, `"dollars"`, `"or"`, `"shall"`, `"days"`, `"from"`,
`"to and until"`, `"through"` and five others — every one of which fell out as
an ungoverned `DEFINITION_ENVELOPE`.

The stage-1 generator proposed `["8.5","8.12"]` and was right; the harvest from
a previous sweep was wrong. **Pin corrected**; 8.5 kept because the baseline
run used it. It has not been re-run: there are no recorded responses for 8.12
under this family, so the corrected pin needs a live call before it produces
anything. The zero is explained, not yet fixed.

This one matters beyond itself. A mis-aimed pin and a broken resolver produce
**the same observable** — a family that finds nothing — and the ladder's gate
compares counts, so it cannot tell them apart. Every zero needs a reason
recorded beside it, which is what this table is.

**`SPECIFIC_PERFORMANCE_REMEDIES` was unexplained. It is now a located defect,
and it is the most product-affecting thing found today.**

The model answered correctly. Its recorded response for 8.8 carries a
well-formed `remedy_assertions` array with an `assertion_kind:
SPECIFIC_PERFORMANCE` and the full verbatim grant. The run recorded
`proposal_count: 0` and `evidence_residual_count: 1`. **The adapter discarded
it**, as `SPECIFIC_PERFORMANCE_OPERATIVE_PREMISE_UNVERIFIED`.

The cause is two predicates in `native-producer/anthropic-provider.js` that
test the same legal premise at two different strictnesses and disagree:

- `sourceHasSpecificPerformanceOperativePremise` (1182-1186) is **tolerant**:
  `harm|damage`, `money|monetary`, and up to 180 characters between "damages"
  and "not be an adequate remedy". It matches Modiv.
- `isIncompleteSpecificPerformanceGrant` (1193-1194) is **literal**: it
  demands the contiguous strings `irreparable harm would occur` **and**
  `money damages would not be an adequate remedy`.

Modiv §8.8 says: *"irreparable harm, **for which monetary damages (even if
available) would not be an adequate remedy**, would occur"*. The premise is
plainly there. It fails the literal test twice over — an intervening clause
splits "irreparable harm ... would occur", and the drafter wrote "monetary"
where the regex demands "money".

So the strict predicate is not testing whether the quote carries the premise.
It is testing whether the quote is drafted in one particular house style, and
it silently discards any deal that is not. Every agreement in the corpus using
"monetary damages" — which is at least as common as "money damages" — loses
its specific-performance grant, and the loss shows up as a family that found
nothing.

**Not changed here — but it is ordinary work, not a decision.** It was
briefly raised as one and withdrawn the same day. The fix is small and the
shape is obvious: make the quote predicate as tolerant as the source predicate
directly above it, which is what the two exist to check. That is **Step 3C**,
which carries the measurement and the required hostile test.
`OPERATING-RULES.md` reserves taxonomy values and codebook vocabularies to
Ben; a matching predicate is neither.

**The vocabulary gaps split in two, and only one half is Ben's.**
`REPRESENTATIONS` and `GENERAL_COVENANTS` fail on corroboration tables in
`native-producer/candidate-resolution.js` being narrower than what the
producers legitimately emit.

- **The structure is ordinary work**, and is already **Step 3G**: extract the
  General Covenants lexicon into its own file in the shape of
  `ioc-corroboration.js`, move the Tax Matters regexes out of the resolver,
  and route `REVIEW` separately from `NOT_EXACT` in the Representations
  classifier. Step 3G calls these "ordinary bugs, not design questions" and
  locates each to a line.
- **The words that go in those lexicons are Ben's**, because
  `OPERATING-RULES.md` puts codebook vocabularies with him. Build the file,
  then bring him the entries.

An earlier version of this paragraph called the whole thing "a material
taxonomy change… not mine to close", which parked the structural half that
Step 3G already owns.

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

**Superseded note. HISTORY ONLY — nothing below this line until the next
heading is an instruction.** It is kept because it records a real reasoning
trap, and because deleting a question that was asked and answered invites it
being asked again. Every question it poses has since been settled; the answers
are in the RESOLVED and closed-layer sections above, which were written later
despite appearing earlier.

> With validation passing, the writer refused a `DEAL_SCOPE_RUN`: "writeSet
> must match the closed reference-only semantic contract"
> (`canonical-writer.js`, `assertDealScopeWriteSetShape`). That check demanded
> the key set **exactly equal** its list, permitting only
> `persisted_object_references` as an extra.
>
> Diffed: a run's write-set contains all 18 required keys **plus
> `write_set_origin`**, and nothing else. That single key was the whole
> difference.
>
> **Three lists in three files disagreed about it, and the writer was the
> outlier.** `validate-write-set.js`'s deal-scope list permits it.
> `m3-staging-candidate-preflight.js` has its own 19-key list that **requires**
> it. `canonical-writer.js`'s list was the only one that excluded it.
>
> The question then open was which of three things to change, and the note
> warned against picking by majority, since two lists agreeing is not evidence
> when all three were written at different times for different callers.
>
> **Answered.** Fable adjudicated: extend the writer's permitted extras. No
> stripper exists; the validator does not merely tolerate the key but *uses*
> it (`answer_provenance` is required for claims only when
> `write_set_origin === 'NATIVE_PRODUCER'`); and the validator already listed
> it beside `persisted_object_references` in an optional-key powerset. The
> writer had simply never learned the key. Implemented; see the RESOLVED
> section above.

One thing that note established and which is still live guidance: **reading
the write-set from `validation.json`'s `publishableWriteSet` does not work.**
It is the post-split publishable subset and lacks the five source-admission
keys the validator requires. `adapter-result.json` carries the complete
`write_set` plus `admitted_source_contexts` — though see Defect 3 above, since
it is *also* not the write-set the run validated.

**Proves the write half is done — DISCHARGED 2026-08-07, with one part
outstanding.**

| Criterion | State |
|---|---|
| A committed evidence directory goes in and the writer accepts it | **Done.** `modiv-antitrust-20260807-replay`, 10 excerpts / 13 provisions / 13 claims |
| A second identical invocation is a no-op | **Done.** `tests/canonical-v2-evidence-to-write-set-bridge.test.js`, real write then replay |
| Proved by test, not by a screenshot | **Done.** 15 tests across two files |
| **Rows come out in *staging*** | **NOT done.** Everything above is against `InMemoryCanonicalRepository` |

**That last row is the honest gap and it is not small.** `canonical_v2_write`
is an 8,686-line SQL reimplementation of the same contract, and it has never
received the general runner's output. The JS writer and the SQL writer have
not been shown to agree on this data.

Closing it is **Step 4A**, which needs no decision, no credential and no
production access — a local Postgres container and `psql`. Consider running
4A before Step 2C rather than after: it is the difference between "the writer
accepts this" and "the database accepts this", and everything downstream
assumes the second.

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
`modiv-termination-fee-20260807-replay` yields ten cards.

**Ten, decomposed, because the bare number flatters it.** Four are governed
cards from resolved claims; two are conditional-fee cards seeded from
`resolution.conditional_termination_fee_values`; four are open-world
*evidence* cards, which render as "Deferred Evidence" rather than as extracted
provisions. So the seam carries all three kinds of output, which is the useful
finding — but "ten product cards" would read as ten extracted provisions, and
it is four. That seam had
never been exercised — the one family serving V2 builds its cards from a
hand-encoded packet, so the runner's output and the projection's input had
never met.

**2. `document_hash` is the deal key, not `deal_key`.** `deal_key` is
per-(deal, family): the 24 committed Modiv runs carry 24 distinct ones
(`deal:modiv-termination-fee:...`, `deal:modiv-antitrust-regulatory:...`)
over a single `document_hash` (`659bcfaa…729968`). Nothing in the schema says
so; it was derived from the evidence. **Code that groups by `deal_key` will
silently render one family and look correct.** None of the four tables has a
deal column at all — the hash lives inside the jsonb, and `claim_revisions`
does not carry it, joining instead via
`claim.subject_occurrence_id = provision_instance.provision_instance_id`.

**3. Nothing can read those tables in a HOSTED environment. Not even the
writer.** An earlier version of this called it "THE BLOCKER" and said the read
half could not start. **That was wrong, and the correction matters for
sequencing:** there is **no `FORCE ROW LEVEL SECURITY`** anywhere in the
schema, so a **table-owner connection** — which Step 4A's local Postgres
container gives you — reads freely. Build the read half locally first; the
hosted access design is Ben's and is not needed until something is served from
a deployment. See `DECISIONS.md`, "Waiting on Ben" item 1.
`foundation.sql:8662-8663` revokes all table privileges from `PUBLIC`, `anon`,
`authenticated`, `service_role` **and `canonical_v2_writer`**; RLS is enabled
on every table with **zero policies defined** anywhere in
`canonical-v2-foundation.sql`, `canonical-v2-serving.sql`, `lockdown-rls.sql`
or `rls-lockdown-2026-07.sql`. The only granted access is `EXECUTE` on
`canonical_v2_write` and two candidate-input functions. No view, RPC or
function joins claims to provisions to excerpts: grep every
`FROM canonical_v2_staging.{excerpts,claim_revisions,provision_instances,provision_components}`
and the only hits are idempotency and persisted-reference checks inside
`canonical_v2_write` itself (e.g. 3235, 3514, 3791, 4161), which never return
rows to a caller.

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

**Two inputs the projection wants that cannot come back out of the database.**

**1. Open-world evidence — and this is worse than "shape unverified".** The
five open-world tables exist and are correctly shaped. They are empty by
construction: `native-producer/native-write-set-adapter.js` lists all five in
`EMPTY_COLLECTION_KEYS` (~134), so the adapter emits none of them. Measured
across the 25 importable runs: **275 open-world entries in `resolution.json`,
zero open-world rows in any write-set.**

Every one of those is a model proposal the resolver deliberately kept, with
`why_unmapped`, `structured_mechanic` and a verbatim quote. They reach the
evidence directory and stop. So four of the ten cards the termination-fee
projection produces from a run — the "Deferred Evidence" cards — have **no
database-backed equivalent, and cannot have one** until the adapter emits
these rows.

It compounds the zero-claim triage above. Several of those ten families
produce output that is *entirely* open-world; through the write path they
write nothing at all, which is indistinguishable from a family that found
nothing. The adapter's header claimed "nothing here produces that kind of
row", which was true when written and has not been true for some time. Header
corrected; the behaviour is left alone, because emitting these rows changes
what the pipeline writes for every deal.

**Decision needed:** emit open-world rows, or accept that the
database-backed render shows governed claims only and says so on the page.
The second is defensible — open-world material is unreviewed by definition —
but it has to be chosen rather than inherited from an adapter constant.

**2. `resolution.conditional_termination_fee_values[]` has no table anywhere.**
This matters: Modiv's §7.3 conditional fee drives the card headline through
`conditionalFeeExtraGroups`, and two of the ten cards come from it. Either it
gets a home or the database-backed render omits that feature, deliberately and
in writing.

Between them: of the ten cards a run projects today, **four survive a
round-trip through the database** as things stand. That is the honest ceiling
on the read half until one of these two is decided.

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

**Change.** Run it, diff the extraction against the baseline, write, serve in
a preview or local runtime, and look at it.

**The baseline moved on 2026-08-07.** It is
`evidence/canonical-v2/baseline-manifest.json`, regenerated with
`npm run generate:baseline` and checked with `npm run gate:baseline` (a
required gate, see `OPERATING-RULES.md`). It records what each run *would
publish if imported*, which is not what the run claimed — a run whose
`validation.json` says thirteen claims and which imports zero is exactly the
defect that yardstick exists to catch. The older
`notes/all-families-baseline-20260806.json` describes the pre-replay world;
do not diff against it.

**And read Step 2B's caveat on TERMINATION_FEE before using its entry.** Its
importable baseline is the `--no-follow-citations` replay, not the stronger
citation-following run, so the count is anchored low. A rung-1 pass for this
family is permissive, not evidence of parity.

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

1. `incomplete` is 0 among families run so far. **It is 0 today, as of
   2026-08-07** — it was 4, and three of those (capitalisation, closing
   conditions, interim operating) were recovered by replaying the responses
   they had already recorded, with no-other-reps recovered earlier the same
   way. Commit `d261df30` fixed three crash causes and `ae8b12de` made the
   timeout configurable; the recoveries are the test of those claims, and they
   passed. Closing conditions is only partly addressed:
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

A failed gate is a stop, not a note to fix at the end. **Ten of the 25
importable runs publish zero claims**, so note that condition 2 is **vacuously
satisfied** by 0 -> 0: for every zero-publishing family, state why zero is
correct and what would make it wrong, or the gate is checking nothing. Step 2B
now carries a triage table doing exactly that for all ten: two proven correct
zeros, one pin defect, one located adapter defect, two vocabulary gaps, and
four mixed cases where part of the output is a designed open-world surface and
part is a gap. Start from that table rather than re-deriving it.
`GUARANTY_FINANCING_PARTY` is the standing example of correct zero, and
`APPRAISAL_DISSENTERS_RIGHTS` was proved to be a second one on 2026-08-07
(§2.6 is a 119-byte denial). `KEY_DEFINED_TERMS` turned out to be a *pin*
defect, not a resolver one. Do not re-derive any of this: Step 2B's triage
table has the cause for all ten zero-publishing families.

Regenerate with `npm run generate:baseline` and diff — the file is
`evidence/canonical-v2/baseline-manifest.json`, and `npm run gate:baseline`
does the diff for you, naming the run that moved rather than emitting a
two-thousand-line diff. Keep the previous committed version in git history
rather than beside it. This step also discharges `P9_SHADOW_REEXTRACTION` and
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

**Nondeterminism — RESOLVED 2026-08-07, and this paragraph used to say the
opposite.** It read: *"The runner makes live model calls with no `--replay` and
no pinned seed (a replay path exists only on the sibling
`canonical-v2-native-extract.mjs`)."* That is false at HEAD and was the
prerequisite this step named.

The live runner has `--record`, `--replay` and `--replay-from-run`
(`scripts/canonical-v2-live-extraction-run.mjs`, argument parsing ~430), keyed
by request hash for fresh recordings and by section reference for the legacy
per-section fixtures. **The entire current baseline was produced through it,
with zero model calls.** Ben's ruling of 2026-08-06 (recorded in `DECISIONS.md`, "Recently decided") was to build the replay
path rather than write a tolerance policy; it is built.

What still holds: a *live* re-run can still differ from a recorded one, and
replay proves the resolver, validator and write-set builder changed or did
not — it says nothing about whether the model would answer the same way today.
Use replay for the rung-to-rung diffs, and treat a live re-run as a separate
question.

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
**ten of the 25 importable runs publish zero claims** — see Step 2B's triage
table, which names the cause for each of the ten and says which of the steps
below addresses it. An earlier version of this line said "11 of the 21 finished
runs", which was the pre-replay count.

**"Ten" was measured on 2026-08-07 and is now SEVEN.** The baseline was
regenerated by replay after Stage 3's code work, at zero model cost, and the
figure came off `baseline-manifest.json` and the evidence directories rather
than from an estimate. Three families moved out of the zero-claim set:
`GENERAL_COVENANTS`, `SPECIFIC_PERFORMANCE_REMEDIES` and `TAX_MATTERS`.

The seven remaining are named in section 2, and **not all seven are defects**.
Guaranty finds nothing on an unfinanced deal, correctly, and Appraisal is
correct by design.

## Step 3J. Split payment timing into event and delay

**Ruled by Ben on 2026-08-07**, option B of the codebook question Step 3I
raised. Full reasoning in `DECISIONS.md` under decision 5.

**What it is.** `allowed_payment_timings` is a two-value enum
(`TWO_BUSINESS_DAYS_AFTER_TERMINATION`,
`UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION`) hand-curated from QXO. It becomes
two fields: **`payment_trigger_event`** (what starts the clock) and
**`payment_delay`** (how long after).

**Why.** The two codes conflate event and delay — the first encodes both, the
second encodes an event and implies zero. Modiv's real drafting has three
patterns and the middle one, "prior to or substantially concurrently with such
termination", is the same event as the second code with a different delay, so
it cannot be expressed at all. Adding a third code would leave the next novel
delay to reopen the question; splitting does not.

**Change.** `lib/canonical-v2/contract-bundle.js` (watch the dual numbering,
input at V38 and concept keys at V24 — a schema change costs several
coordinated edits) and `lib/canonical-v2/termination-fee-trigger-path.js:85`,
which enforces the enum. **Migrate QXO's two stored values into the new pair**
rather than leaving them as legacy strings beside it.

**The cross-check, which is the part not to skip.** Modiv's `7.3(b)(ii)` fee
is payable when the Company terminates under `7.1(c)(i)`, the superior-proposal
fiduciary out, concurrently with terminating. **That is decision 6's concept**,
already modelled on the termination-rights side as `feeRequired` on
`TERMR-SUPERIOR` — payment as a condition precedent to the fiduciary out,
which decision 6 records as a materially different negotiating position from
"a fee is payable". `payment_trigger_event = CONCURRENT_WITH_TERMINATION` and
`feeRequired` must agree, and a disagreement is a defect to surface, not a
preference to resolve quietly.

**Proves it is done.** All three Modiv patterns and both QXO patterns encode
without inventing a code beyond the ruled set; the Modiv branch (ii) row and
its `TERMR-SUPERIOR` `feeRequired` counterpart are asserted to agree, with a
test that fails if they diverge; and no stored QXO value remains in the old
single-field form. The Step 3I sidecar stays as the cited-text record — check
every branch's quote is still reachable before removing anything.

**BUILT 2026-08-07, NOT COMPLETE, and this step does not move to
`COMPLETED.md` until Step 3J1 closes.** V3 is additive beside a byte-identical
frozen V2 (verified by extracting the constant's text region from both
commits), the migration is derived rather than retyped, and all five real
patterns encode correctly against filed text — including the QXO "upon"
reading, which is not an assumption: QXO's filed 6.5(b) uses the word "upon"
where its sibling clauses say "within two (2) business days", so zero delay is
the faithful reading.

**Two corrections to this programme's own record, both mine.**

**The cross-check is tested, not enforced.** The commit that built this said
"enforced rather than assumed". That is false.
`assertPaymentTriggerEventAgreesWithFeeRequired` is defined at
`termination-product-projection.js:162` and exported at 754, and **called
nowhere outside its own test** — verified by grep across `lib/`, `pages/`,
`scripts/` and `tests/`. It cannot fire on any real path: every metric binding
pins `trigger_path_schema_version: 2`, V39 is unregistered in the fingerprint
maps, nothing emits a V3 effect, and `feeRequired` exists only in the live V1
database. **This step's own proof above is therefore not satisfied and cannot
be satisfied in-repo.** A guard that reads as protection and cannot fire is
worse than no guard, and this programme has now produced five of them in one
day.

**The delay axis is narrower than Ben ruled.** Decision 5 says
`payment_delay` is "zero, two business days, **or whatever the agreement
says**". The implementation froze `[NONE, TWO_BUSINESS_DAYS]` and dropped the
third limb.

## Step 3J1. Wire the cross-check, and widen what Step 3J narrowed

**Conditions 3, 4 and 5 of the adversarial review of `5bd831d4`.** Two further
conditions are codebook decisions and are recorded in `DECISIONS.md` for Ben.

**What it is.** Step 3J built a schema nothing can reach and a guard nothing
calls. This wires both, and fixes the one place the guard would be wrong if
called naively.

**Change.**

- **Wire the guard.** Call it on the fiduciary-out path against the real
  `feeRequired`, at import or serving time. Today it is unreachable.
- **Scope the pairing.** The function takes `(event, feeRequired)` with no
  path scoping, so applied naively to Modiv branch (iii)'s
  `EARLIER_OF_SIGNING_OR_CONSUMMATION` against the same deal's truthy
  `TERMR-SUPERIOR` `feeRequired`, it throws a **false** disagreement. The
  pairing discipline currently lives only in a comment.
- **Stop auto-truthing prose.** `feeRequiredIsTruthy` counts every non-empty
  string as "required". Decision 6 records that **5 of 28 stored values are
  prose**. A prose value meaning "no, the fee is payable after termination,
  not as a condition", paired with a miscoded concurrent event, passes
  **silently** — the one quadrant where this guard's failure is invisible
  rather than loud. Classify prose values or route them to review; never
  auto-truthy them.
- **Make V3 reachable, or record that it is not.** Three things must happen
  for V3 to serve: a binding declaring version 3, registration in
  `FIXTURE_CONTRACT_FINGERPRINTS` and `FIXTURE_CONTRACTS_BY_FINGERPRINT`, and
  a producer emitting V3-shaped effects. Withholding registration was the
  right call at build time — those sets define what serving code trusts, and
  the alternative was editing an unowned, exhaustively pinned test to smuggle
  scope. But **an unreachable schema that has been built is exactly the shape
  of thing this project forgets it built**, which is the failure `CLAUDE.md`
  opens with.

**Proves it is done.** The guard fires on a real path with a real
`feeRequired`, proven by a test that makes it throw on a genuine disagreement
rather than a synthetic one; Modiv branch (iii) does not throw a false
disagreement; a prose `feeRequired` that means "not a condition" is refused or
queued rather than read as agreement; and V3 either serves or its
unreachability is recorded in `GRAVEYARD.md` with what would make it serve.

## Step 3J2. Add the consummation event, and make the delay axis structured

**Ruled by Ben on 2026-08-07**, after adversarial review found Step 3J's new
vocabulary already broken by a third agreement sitting in this repository's
own fixtures. Full reasoning in `DECISIONS.md` decision 5.

**What it is.** Two changes to the payment-timing vocabulary Step 3J built.

**1. `CONSUMMATION` becomes a fourth `payment_trigger_event`.** Skechers
§8.3(b)(i) pays "concurrently with the consummation of such Acquisition
Transaction" — consummation alone, matching none of the three ruled codes.
Encoding it as `EARLIER_OF_SIGNING_OR_CONSUMMATION` inverts the term: under
QXO's tail the fee is owed at signing even if the later deal never closes,
under Skechers only at closing. **A signed-but-collapsed deal owes $339.9M
under one and nothing under the other.**

**2. `payment_delay` becomes `{count, unit, bound_type}` at V4**, not a wider
enum. `NONE` and `TWO_BUSINESS_DAYS` cannot express "within three Business
Days", which is in this repository's own financing corpus, and cannot record
whether a period is an outer bound or an exact term. Skechers writes "promptly
(and in any event within two Business Days)"; under the enum the promptness
covenant is silently lost and the outer bound is indistinguishable from an
exact two days.

**Adding a duration no longer needs Ben.** `OPERATING-RULES.md` reserves
taxonomy values and codebook vocabularies because they encode legal judgement.
A duration is a measurement — "three Business Days" requires no reading of the
agreement beyond counting. **Trigger events stay reserved; delays do not.**
This is the ruled scope of the pre-authorisation, and it does not extend to
inventing a new event.

**Change.** `lib/canonical-v2/contract-bundle.js` — a V4 trigger-path schema
beside the frozen V2 and V3, following V3's own discipline: additive, with
constraints derived by a named migration rather than retyped, and the dual
numbering respected. Whatever consumes the pair must handle the structured
delay.

**Proves it is done.** Skechers §8.3(b)(i) encodes as `CONSUMMATION` **from
filed text, not a typed string** — it is in
`tests/fixtures/canonical-v2/skechers-first-live-run/skechers-raw-fetched.htm`,
so read it the way Step 3J read Modiv's, through the repository's own
conversion. "Within three Business Days" encodes without a new ruling.
Skechers' "promptly (and in any event within two Business Days)" records its
bound type rather than flattening to an exact period. Every V3 pattern still
encodes, and V2 and V3 stay byte-identical.

**Do not treat this as the last word either.** The first vocabulary was
curated from one agreement and broke on the second; the second was curated
from two and broke on the third. Structuring the mechanical axis is what makes
the fourth agreement cheap, not a guarantee that the event axis is finished.

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

## Step 4A2. Give conditional termination fee values a table

**Ruled by Ben on 2026-08-07**, on the question raised in `DECISIONS.md`
decision 3. Numbered 4A2 rather than inserted as a new letter because it must
run immediately after Step 4A and renumbering the rest of the stage would
break every reference to it elsewhere in this document.

**What it is.** `conditional_termination_fee_values` is a write-set object kind
with no table in `supabase/canonical-v2-foundation.sql`. Two of the ten cards a
termination-fee run projects come from it, **including the Modiv headline
number** — the figure a user looks at first.

**Why.** A schema that cannot hold the headline number is not finished. Ben's
words: give it a table. The alternative on offer was an explicit omission, and
it was rejected.

**Change.** Add the table to `supabase/canonical-v2-foundation.sql` in the
shape the existing per-object-kind tables use, and teach
`public.canonical_v2_write` (line 1167) to write it, **with its identity
recomputed inside the database** like every other object kind. Do not special-
case it into the JS writer alone; the point of Step 4A is that the two writers
agree, and a kind only one of them knows about breaks that.

**Sequenced strictly after Step 4A**, and this is not a preference. Extending a
schema that has never been proven to execute durably means debugging two
unknowns at once: whether the extension is wrong, or whether the thing it
extends was already wrong. 4A is what makes this step's failures legible.

**Proves it is done.** A termination-fee write-set containing conditional fee
values goes through `canonical_v2_write` against the local container, and
`SELECT count(*)` on the new table equals the count in the write-set. Then the
Modiv headline number specifically survives a round trip: written, read back,
byte-identical to what the run produced. The count proves the table works; the
headline proves it holds the thing it was added for.

**DONE 2026-08-07 on the database side, and half of Ben's decision 3 remains.
See Step 4A3.**

Six real Modiv conditional fee values went through `canonical_v2_write`
durably; `SELECT count(*)` returned 6 from a fresh connection after the writer
exited; JS and SQL receipt identities matched. **The headline `$10,000,000`
SELLER 7.3(b)(i) row survived the round trip byte-identical**, compared
through this codebase's own `canonicalJson` rather than `JSON.stringify` — a
naive comparison first reported a false mismatch because Postgres `jsonb`
reorders object keys on output. That is documented `jsonb` behaviour, not
corruption, and it is written down so nobody later reads it as one.

Four hostile probes against the real committed write-set: a well-formed
control accepted; extra-key, missing-key and wrong-enum rows all refused with
`DEAL_SCOPE_RUN conditional termination fee value shape is invalid`, naming
the shape; a duplicate id refused separately. All three digest guards updated
and the governed extract regenerated.

## Step 2B1. Close what the open-world review found at the serving boundary

**Adversarial review of `899e9bc5`, `9eaaa663` and `73c6627b`, 2026-08-07.
Merge on all three with conditions. The first condition was a live defect and
is already fixed; the rest are open.**

**FIXED, and worth stating plainly because the commit message was wrong.**
`buildGovernedClaimSummaryCard` asked only whether a row *lacked* the
ungoverned marker. Review broke it by execution: a QXO-era
`NOVEL_CONCEPT_CANDIDATE/V1` row — which never carries the marker because it
predates it, and is the *legitimate* contents of the same five tables — was
accepted and rendered as **"Governed claim"** with its value. Uncorroborated
model output presented to a lawyer as a finding.

The commit claimed each constructor "refuses the other kind of row outright".
That held only for the marker-carrying half of the row universe. **Marker
absence distinguishes nothing when two grammars share a table.** The
constructor now asks what the row *is* — `schema_version === 'CLAIM_REVISION/V1'`
— and both attacks are pinned by tests. Note the marker sits *outside* the
content hash, so identity recomputation could never have caught a stripped
marker; only a positive check does.

**Still open, in order of exposure.**

1. **The lighter grammar never re-checks `raw_value` against excerpt text**,
   while the adapter byte-verifies it. A non-adapter producer could pass a
   fabricated string through validation, and the card displays it under the
   field name **`quote`**. Today the adapter is the only producer. Mirror the
   byte-equality check, or rename the field so it cannot read as verbatim
   filed text.
2. **Five provenance fields are silently dropped.** `pushOpenWorld` emits
   `citation_validation`, `answer_provenance`, `source_citation`,
   `extraction_provenance` and `section_family_ai_unverified`;
   `buildOpenWorldWriteRows` carries none of them. The resolver's own comment
   says an unvalidated citation "stays visibly flagged here too" — **the
   database row loses that flag**, so a card built from the database can never
   show whether the model's citation was checked. Carry them or record the
   decision, before any page renders these cards.
3. **`canonical_value` is exposed under that name on an ungoverned row.**
   "Canonical" reads as vocabulary-blessed to a reviewer.
4. **The fee table's CHECK constraints hard-code Modiv's clause numbers**
   (`7.3(b)(i)`…`7.3(c)`), `USD` and `LOWER_OF` into the global staging
   schema. The second deal with a formula fee needs a migration, and that
   CHECK is a fourth member of the three-place problem Step 4A3 named.

**Already done:** the synthetic probe row 4A2 left in `pm_step4a2_final` was
deleted, so the container holds 6 rows and matches both notes again. It had
been 7, indistinguishable at the column level, and 4A3 then reused that
database for its own proof.

**One scope correction to `899e9bc5`'s own title.** Its evidence stops at
`validateResolvedCanonicalWriteSet`: "244 rows" are write-set rows in memory.
No native open-world row went through the SQL writer in that commit. Nothing
blocks it — the trio was already declared from the QXO chain, verified rather
than assumed — but "reaches the database" was demonstrated to the validator,
not to the database.

## Step 4A3. Carry conditional fee values into the write-set

**Found by Step 4A2 itself, and disclosed rather than left to be discovered.**

**What it is.** The table exists and is proven. **Nothing sends it data.**
`lib/canonical-v2/native-producer/native-write-set-adapter.js` and
`lib/canonical-v2/validate-write-set.js` contain **zero** references to
`conditional_termination_fee_values` — checked by grep, not inferred — while
`termination-product-projection.js` reads
`resolution.conditional_termination_fee_values` and
`lib/four-deal-local-demo-preview.js` iterates it. So the resolver produces
these values and the projection consumes them, and the write-set never carries
them.

**Why this is the whole point of the step.** Ben's decision 3 was taken
because two of the ten cards a termination-fee run projects come from this
kind, **including the Modiv headline number**. A table nothing writes to
delivers none of that. Until this step lands, the honest statement is "the
database can hold the headline number", not "the headline number reaches the
database".

**Change.** Teach the adapter to carry the kind into a real `DEAL_SCOPE_RUN`
write-set, and `validate-write-set.js` to validate it. Follow the open-world
emission that landed the same day (`buildOpenWorldWriteRows`) as the pattern
for adding a kind the adapter did not previously emit.

**Proves it is done.** A real extraction run's own write-set — not a
hand-built harness input — carries conditional fee values through the bridge
into `canonical_v2_write`, and the Modiv headline arrives in the table. Step
4A2's harness proved the SQL; this proves the pipeline.

**Do not mark decision 3 satisfied before this.** A built-but-unreachable
mechanism is the exact shape of thing this programme forgets it built, and
this is the second one found today: Step 3J's cross-check guard is the other.

**DONE 2026-08-07. Ben's decision 3 is now satisfied end to end.**

A real extraction run's own write-set — `modiv-termination-fee-20260807-replay`,
re-derived by calling the real `buildNativeWriteSet` on its committed receipt
and resolution, **with no manual splicing of the fee values** — carried six
conditional fee values through both JS validators, through the canonical
writer, into `canonical_v2_write` on a local container. Six in the write-set,
six in the table, reconfirmed from a fresh connection. JS and SQL receipt
identities matched. The headline `$10,000,000` SELLER 7.3(b)(i) row round-trips
byte-identical, and its stored digest equals the one Step 4A2's hand-spliced
proof produced for the same content — so the harness and the pipeline agree.

**The wiring pin was verified to fail, not merely to exist.** Reverting the
adapter change alone takes the new test from 10 passing to 5 passing and 5
failing, and restoring it returns 10. That check was run rather than reasoned
about, because six times today this programme found a protection it believed
in that had never fired.

**A third shape gate had to be widened, and this is the finding worth
carrying.** `canonical-writer.js`'s `assertDealScopeWriteSetShape` runs its
own independent closed-key check **before** `validateResolvedCanonicalWriteSet`
ever runs, and rejected the new key with `INVALID_DEAL_SCOPE_WRITE_SET` until
it was widened too. Step 4A2's note predicted exactly this. Had it been
missed, the real bridge would have stayed silently blocked while every
targeted test passed.

So **an optional write-set key now needs updating in three places** — both JS
shape gates and the SQL — and **nothing keeps the trio in sync but tests**.
This is the same shape as the three digest guards over a schema edit, found
the same day, and it has the same character: the duplication is pre-existing
and documented in the file's own comment, dating to an earlier
`write_set_origin` bug, but nothing tells you at edit time that you are in a
place with three of something.

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
**Do not use `modiv-termination-fee-citation-following-20260806`**, which an
earlier version of this step named. Every pre-2026-08-07 run directory is
refused by the writer, permanently and by design — it records neither its
retrieval timestamp nor its compressed source map, so its identity cannot be
rebuilt. The importable data is
`evidence/canonical-v2/modiv-termination-fee-20260807-replay`, with the
anchored-low caveat in Step 2B. Confirm its exact shape before relying on
it.

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

## Step 7D. Disposition the seven deferred security gates, so they cannot be closed quietly

**Found by Step 1A, 2026-08-07.** `programme-gates.yaml` carries a second gate
list besides the 25 pre-production ones: `phase_12_security_gates`, seven
identifiers, every one of them `DEFERRED_POST_CUTOVER` with `blocks_cutover:
false`. **None of the seven appeared anywhere in `PLAN.md` or `COMPLETED.md`**
before this step, and each is a bare id and a state with **no acceptance
criteria of any kind**. That is exactly the condition Step 1A exists to
destroy: a gate anybody can close by feeling finished.

Step 1A's first implementation bound the 25 and disclosed that it had left
these seven out, on the ground that section 5 only ever claimed to disposition
25. The disclosure was right and the scope was too narrow — Step 1A says
*every* gate identifier. This step is the missing half, and it is written as a
step rather than a footnote so that the seven ids sit on lines carrying a step
label and bind under Step 1A's existing rule, **with no loosening of the
matching rule**. Loosening the rule to admit a bare "Deferred" would have
reopened the hole from the other side.

**What it is.** A disposition for each of the seven, recorded here.

| Gate | Disposition |
|---|---|
| `P10_SECURITY_01` | Deferred post-cutover. Step 7D holds it. Blocks nothing before Stage 9 |
| `ROUTE_ACTION_THREE_WAY_INVENTORY` | Deferred post-cutover. Step 7D. Overlaps Step 7C's route work; close it there if 7C's inventory turns out to satisfy it |
| `DEFAULT_DENY_FULL_PROBE_SUITE` | Deferred post-cutover. Step 7D. Related to Step 7B's outside proof |
| `EGRESS_DENY_BY_DEFAULT_CERTIFICATION` | Deferred post-cutover. Step 7D. No code in this programme addresses it today |
| `ACTION_AUTH_MATRIX_AND_WHOLE_TUPLE_REVOCATION` | Deferred post-cutover. Step 7D |
| `MALICIOUS_SOURCE_AND_SUBSTITUTION_SECURITY_SUITE` | Deferred post-cutover. Step 7D. Nearest live work is the admitted-source identity chain, which is a correctness mechanism and **must not be mistaken for a security control** |
| `SNAPSHOT_SECURITY_ATTESTATIONS` | Deferred post-cutover. Step 7D. An attestation, which `OPERATING-RULES.md` reserves to Ben |

**Why.** Not to do the security work — it is deferred, and Ben deferred it.
Purely so that the deferral is written down where the gate registry can be
checked against it, and so that closing one becomes a visible act rather than
an assumption. A deferred gate and a forgotten gate look identical from the
YAML.

**Change.** This table, and extending Step 1A's test to bind both gate lists
rather than only `preproduction_gates`.

**Proves it is done.**
`CI=true node --test tests/programme-gates/gates-bound-to-plan.test.js` passes
while checking **all 32** identifiers, and deleting any one row from either
this table or section 5's makes it fail. The matching rule is unchanged from
Step 1A: the identifier and a step label or "Retired", on one line.

**What this step does not do.** It does not certify, probe, or attest anything.
None of the seven is closed by this step; they are recorded as open and
deferred, which is what they are.

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
