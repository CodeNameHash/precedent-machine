# Step 2F, TopBuild fan-out — and the Modiv replay that preceded it

Working note, 2026-08-08. Written incrementally, phase by phase; a phase
below is complete evidence, not a plan.

**Capitalisation is parked** (`PLAN.md` Step 2D2, Ben, 2026-08-08, moved to
Step 9F). Every "all 25 families" statement in this note therefore means
**24 of 25**. `CAPITALISATION` was not run, not replayed and not
investigated on either document. That is a decision, not a failure.

---

## Phase 1 — Modiv, replayed in place, zero model calls

### What was replayed, and how

31 of the 32 importable run directories were replayed in place from the
recorded model responses already committed. Zero model calls; every run
reported `model_call_count: 0` and `REPLAY: n/n recorded call(s) used`.

The lineage for each target was **recovered from the evidence rather than
guessed**: every `run-receipt.json` records, per resolved section,
`producer_receipt.model_id` as `replay(<source dir>)` or
`claude-sonnet-5-via-claude-code-cli(sonnet)`. That gave the exact source
directory for each of the 31, including the two that had been replayed from
assembled pools (`modiv-consideration-fullpin-…`,
`modiv-key-defined-terms-fullpin-…`, each needing fixtures from two
directories) and `modiv-termination-fee-20260807-replay`, whose source is
`modiv-termination-fee-scope-correction-20260805` and not either of the two
more obvious candidates.

Mechanics: fixtures copied into a scratch pool, then
`node scripts/canonical-v2-live-extraction-run.mjs --deal <d> --family <F>
--section-refs <refs> --{no-,}follow-citations --replay-from-run <pool>
--out-dir <scratch>`, and the produced artefacts copied over the committed
directory **only after** the run exited 0 and wrote an
`adapter-result.json`. A failed replay therefore leaves the committed
evidence untouched rather than half-overwritten.

`CAPITALISATION` (`modiv-capitalisation-20260807-replay`) was skipped, per
the parking.

### Before / after

| Measure | Before (committed baseline at HEAD) | After replay |
|---|---|---|
| Run directories carrying output | 56 | 56 |
| **Importable runs** | **32** | **32** |
| Registered families with an importable run | 25 of 25 | 25 of 25 |
| **Families whose run publishes claims** | **19 of 25** | **19 of 25** |
| Claims / provisions / excerpts | **251 / 105 / 519** | **251 / 105 / 519** |
| Open-world entries across importable runs | 244 | 244 |
| Components | 10 | 10 |
| `incomplete` (families with no complete run) | 0 of 25 | 0 of 25 |
| Model calls spent | — | **0** |

**Nothing moved.** Not one run's `resolved`, `review_queue`, `open_world`,
`residuals` or `published` count changed, across all 32. The only two rows
that differed at all were `modiv-closing-conditions-fullpin-20260807-live`
and `modiv-mae-definition-20260807-live`, and the only field that differed
was `model_call_count` 4→0 and 1→0 — i.e. the replay overwrote the record
that those two directories were obtained by live calls. That is a loss of
provenance, not a gain, so **both were restored to their committed state**
after confirming the replay reproduced their counts exactly. The other 29
were already replay directories, so rewriting their manifests changes
nothing about what they claim to be.

### The correction this forces to the brief, and to PLAN.md section 2

Two separate things were expected to move and did not, for two different
reasons, and both are worth writing down.

**1. The committed baseline was already ahead of `PLAN.md`.** The brief and
`PLAN.md` section 2 both quote **28 importable runs, 203/86/181
claims/provisions/excerpts, 19 of 25 publishing**. The manifest committed at
`66a39eaf` already reads **32 / 251 / 105 / 519**, and `npm run gate:baseline`
passes against it unmodified at HEAD. So the "before" the replay was
measured against is not the number in the plan. **PLAN.md section 2's
after-Stage-3 table is stale by one regeneration**; the numbers to carry
forward are 32 / 251 / 105 / 519 / 244.

**2. None of today's five defect fixes touch what an evidence directory
contains.** This is the substantive finding of Phase 1, and it contradicts
the premise the replay was ordered on.

- The baseline manifest is re-derived by `importRunEvidence` **using current
  library code** over the committed `adapter-result.json`. `gate:baseline`
  passing at HEAD — with a manifest committed *before* commits `07f19fa6`,
  `68bd1fd9` and `5ab5f8f9` — already proved those three fixes change
  nothing on the import side.
- Replaying then proved the complementary half: they change nothing on the
  **production** side either. The same recorded responses, run through
  today's runner, produce **semantically identical** resolution and adapter
  output — identical, not byte-identical. See "The one field that did move"
  below, which is a separate and more serious finding.

Read together: the five fixes are **serving-layer and reader-layer fixes**,
not extraction fixes. Two families rendering cards where they rendered none,
`TAX_MATTERS` projecting instead of throwing, and the reader round-tripping
`party` / `section_reference` / `ioc_restriction_components` are all changes
to what a *product surface* does with an unchanged write set. They are real,
and they are invisible to the baseline manifest by construction, because the
manifest measures the write set and not the render.

The one exception claimed in the brief — that `TERMINATION`'s 12 claims were
being rolled back by the excerpt guard and now write — **was already true in
the committed baseline**: `modiv-termination-20260807-replay` published 12
claims before the replay and 12 after. Whatever the excerpt-guard fix
repaired, it was not a count that this manifest can see.

**Consequence for how the ladder is gated.** The rung gate's third condition
("still writes, and still serves") cannot be discharged by the baseline
manifest alone. The manifest is blind to precisely the layer four of the
five fixes live in.

### The one field that did move: `closure_id` is not stable across runs

**Measured, all 29 replayed Modiv directories.** Strip every `*_id` and
`*_digest` key from `resolution.json` and compare `resolved`,
`review_queue`, `open_world` and `residuals` as order-insensitive multisets:
**zero content differences, across all 29.** So the semantic claim above
stands without qualification.

What did change is identity, and it changed everywhere:
`adapter-result.json` (13 `closure_id`s in the antitrust run alone),
`validation.json`, `resolution.json`, `review-queue.json` and
`run-receipt.json` (`producer_receipt_id`, `closure_id`,
`extraction_provenance_id`, `run_receipt_id`). Nothing else moved except
wall-clock and commit provenance.

**It is not by design, and the design says so.** `closure_id` is
content-addressed at exactly one site,
`lib/canonical-v2/native-producer/candidate-proposal-compiler.js` (~246):

```
closureId = contentId(CANDIDATE_CLOSURE_DOMAIN, {
  producer_receipt_id, governed_scope_digest, kind, revision_id,
})
```

with the comment *"no two independently-produced candidates can collide here
unless they are, in fact, the same candidate."* That is a **stability**
claim, not a freshness claim. A closure is not a unit of work per run; it is
the quarantine-isolation identity of one candidate, and it is supposed to be
derived from what the candidate is.

**Root cause, proven directly.** `producer_receipt_id` is
`contentId(PRODUCER_RECEIPT_SCHEMA, { schema_version, provider_id,
model_id, prompt_digest, input_scope_digest, proposal_count,
evidence_residual_count })` (`native-producer/provider-interface.js`
~123-133). `model_id` is not content — it describes *how* the answer was
obtained — and for a replay `scripts/canonical-v2-live-extraction-run.mjs`
(~1166) sets it to ``replay(${config.replayPath || config.replayFromRunDir})``,
**a filesystem path**. On `modiv-antitrust-20260807-replay`:

| | before | after |
|---|---|---|
| `model_id` | `replay(evidence/canonical-v2/modiv-antitrust-20260806)` | `replay(/tmp/claude-0/…/work/pool-modiv-antitrust-20260807-replay)` |
| `producer_receipt_id` | `714c391a…` | `cce93b4a…` |
| `prompt_digest` | `20a5f2d8…` | `20a5f2d8…` (unchanged) |

Same prompt, same recorded answer, same governed scope, same compiled
revision — **different closure identity, because the directory the identical
bytes were read out of had a different path.** A colleague replaying this
evidence from a different checkout gets different closure ids for identical
content.

**This is the `IMMUTABLE_SOURCE_DOCUMENT/V2` failure shape again** (PLAN.md
Step 2B defect 2): an identity that varies with something that is not the
content, in that case a DEFLATE digest, here an absolute path.

**What joins on it, and how far this reaches.**

- *Within one write set* — nothing breaks. `validate-write-set.js`'s
  `quarantinedClosureIds` pass, and the open-world row family that shares
  the resolver's `closure_id` as its join key, only ever compare rows minted
  in the same run.
- *Within one stored deal* — nothing breaks.
  `local-staging-deal-reader.js`'s `readGovernedClaimsForDeal` (~453, ~655)
  fetches claim revisions `WHERE closure_id = ANY($1)` from the provisions'
  and components' own stored closure ids; both sides come out of the same
  write.
- *Across runs, into a database that already holds a previous one — this is
  where it bites.* `closure_id` is indexed on 16 `canonical_v2_staging`
  tables. `supabase/canonical-v2-foundation.sql` (~7541) joins an incoming
  write set's `closure_id` against already-persisted `stored_closure_id` and
  raises `DEAL_SCOPE_RUN persisted references overlap or extend stored
  closure identity`; and ~7560 takes
  `pg_advisory_xact_lock(hashtextextended(closure_id, 0))` over the same
  ids. **An unstable `closure_id` weakens both.** A re-import of the same
  evidence replayed from a different path presents as fresh closure
  identity: the overlap guard does not fire where it should, and two
  concurrent imports of the same content from different paths do not
  serialise against each other.

**Where this belongs in the record.** Today's reader work established
`claim_occurrence_id` as the stable cross-run join key and
`claim_revision_id` as explicitly not stable. **`closure_id` belongs in the
second column and is not currently listed there.** It is the more dangerous
of the two, because it *looks* stable — one derivation site, `contentId`,
a header asserting collision only for identical candidates — and is not.

**Not fixed here.** The minimal fix is to stop letting `model_id` carry a
path: a replay's producer receipt should record the model the recording was
served by (`call-telemetry.json` has carried `served_model` per call all
along) and record the replay source as provenance *beside* the receipt
rather than inside its content address. That is a change to a shared
identity contract and needs its own reviewed diff, not a fan-out ladder.

---

## Phase 2 — TopBuild, the full ladder

### Method, and the two inputs chosen before any call

- **Section references** come from `docs/codex-program/notes/step-2e-topbuild-mapping.md`
  verbatim, passed on the CLI as `--section-refs`.
  `DEAL_PINS.topbuild.default_section_refs_by_family` is `{}` at HEAD; 2E's
  own dry runs were confirmed the same way. Pinning is a separate edit,
  recorded at the end of this note.
- **`--agreement-date 2026-04-18`.** `DEAL_PINS.topbuild.agreement_date` is
  `null` with a comment saying to pass it explicitly. The date was read out
  of the committed raw HTML rather than taken from 2E's prose: the preamble
  reads "…and TOPBUILD CORP. Dated as of April 18, 2026". Without it,
  `parseMeasurementDate` cannot resolve the symbolic phrases ("the date of
  this Agreement") that several families' deadline claims depend on, so a
  null date would have manufactured false zeros.
- **`--no-follow-citations` throughout.** Citation follow-up is scoped to
  `TERMINATION_FEE` bare-citation fee triggers and is documented and
  verified INERT for every other family, so this changes nothing for 23 of
  the 24 — and for `TERMINATION_FEE` it matches the configuration Modiv's
  own baseline run (`modiv-termination-fee-20260807-replay`, `follow: false`)
  used, which is the run the comparison is against. It also keeps the call
  count exactly 2E's projection.
- **`--call-timeout-ms 1200000`** on every call, per the brief. Nothing hit
  it.
- **`--record <dir>/recording.json`** on every run, so all 66 calls are
  replayable at zero cost afterwards. Modiv's `-20260806` runs are only
  replayable through the weaker `ORDERED_SECTION_REFERENCE` keying; these
  are request-hash keyed.
- Run directories: `evidence/canonical-v2/topbuild-<family-slug>-20260808-rung<N>`.

**Gate per rung, all four conditions, checked after every rung:**

1. `incomplete` — a run directory that never wrote an `adapter-result.json`.
2. Every family's `resolved` count, against its own prior rung.
3. **Writes** — durably, through `public.canonical_v2_write` against a fresh
   local Postgres (`pm-pg-tb`, port 55440, `supabase/canonical-v2-foundation.sql`
   applied clean, exit 0), not only through the in-memory bridge.
4. **Serves** — read back out of that database through
   `readDealFromLocalCanonicalV2Staging` and passed to the real
   `*-product-projection.js` function, exactly as a serving source does.
   Step 2D's harness for this was never committed, so it was rebuilt
   (scratch only, not added to the repo).

---

### Rung 1 — `TERMINATION_FEE`, §6.5, one call

| | |
|---|---|
| Wall clock | 310 s for one 11,697-byte section |
| `incomplete` | 0 |
| `resolved` | 5 (Modiv's comparator: 7) |
| review queue / open world | 18 / 8 |
| Publishes | **2 claims, 3 provisions, 10 excerpts** |
| Writes | **`COMMITTED`**, `publishableObjectCount: 47`, `residualCount: 0`, JS and SQL receipt ids **identical** (`8465e63e…c76d71`) |
| Serves | **2 cards** from `projectTerminationFeeProductSurfaces` over read-back data |

The extraction is right: it found
`"Company Termination Fee" shall mean a cash amount equal to $600,000,000.`
at bytes 374,522–374,599 and the Parent-side equivalent, which is exactly
what 2E predicted §6.5 carries.

**Rung 1 passes all four conditions.** This is the first time any document
other than Modiv has gone extraction → durable SQL write → projection.

**Two things worth carrying forward from rung 1.**

- **`resolved` 5 but only 2 claims publish.** Three candidates are dropped
  as `UNKNOWN_COMPILER_REJECTION` with `section_reference: null` and
  `message: null` — a residual that names neither what was rejected nor why.
  The same 3-of-N gap exists on Modiv (`resolved` 7 → 4 claims), so this is
  **not** TopBuild-specific; it is a shared-layer blind spot the ladder has
  now hit on two documents. A residual whose reason code is literally
  `UNKNOWN` is not a triage.
- **A soft-invisible character in TopBuild's cross-references.** The one
  producer evidence residual is `FEE_TRIGGER_QUOTE_UNVERIFIED` on
  `"…pursuant to the provisions of Section ‎6.2(a) and…"` — the character
  before `6.2` is U+200E LEFT-TO-RIGHT MARK, which this filing puts in front
  of every internal cross-reference. Modiv's filing does not. Document-specific,
  and the kind of thing Step 2H exists to record.

### Rung 2 — `CONSIDERATION`, `KEY_DEFINED_TERMS`, `APPRAISAL_DISSENTERS_RIGHTS`

10 calls. `incomplete` = 0. All three write and all three serve.

| Family | Sections | Calls | Wall clock | Compiled | `resolved` | Review queue | Open world | Claims published | Writes | Renders |
|---|---|---|---|---|---|---|---|---|---|---|
| `CONSIDERATION` | 2.1–2.5 | 5 | 603 s | 48 | **2** | 4 | **44** | 2 | `COMMITTED`, 226 objects | **2 cards** |
| `KEY_DEFINED_TERMS` | 3.1, 4.3, 4.4, 6.5 | 4 | 1,172 s | 105 | **21** | 30 | 75 | 21 | `COMMITTED`, 433 objects | **21 records** |
| `APPRAISAL_DISSENTERS_RIGHTS` | 2.1 | 1 | 83 s | 5 | **2** | 2 | 3 | 2 | `COMMITTED`, 21 objects | **2 records** |
| `TERMINATION_FEE` (rung 1, re-checked) | 6.5 | — | — | — | 5 | 18 | 8 | 2 | already committed | 2 cards |

Every SQL receipt id matched its JS receipt id. Claim-revision rows in the
database went 2 → 4 → 25 → 27, i.e. deltas of exactly +2, +21, +2.

**Three results here matter more than the counts.**

**1. `APPRAISAL_DISSENTERS_RIGHTS` produces output on TopBuild, and that
retroactively validates Modiv's zero.** On Modiv it published zero, and
Step 2D judged that correct by design (§2.6 is a 119-byte denial). On
TopBuild §2.1(d) it finds `APPRAISAL_RIGHTS_STATUS`,
`APPRAISAL_SETTLEMENT_CONSENT` and `APPRAISAL_WITHDRAWAL_RECONVERSION`.
The family was quiet on Modiv because Modiv had nothing to say, exactly as
claimed. **This is the first time that reasoning has been tested against a
document that does have the content**, and it held.

**2. `KEY_DEFINED_TERMS` publishes 21 claims on TopBuild against 10 on
Modiv, and 2E's remapping is why.** The generator proposed §7.12, a
one-sentence pointer to an index annex. 2E replaced it with
`['3.1','4.3','4.4','6.5']`. Pinning the generator's proposal would have
produced a near-empty run — the exact failure Modiv's original §8.5 pin
produced. Hand-reviewing the mapping paid for itself here.

**3. `CONSIDERATION` compiles 48 candidates and governs 2 of them. 44 land
in open world.** On Modiv the same family was 2 resolved / 20 open world.
So TopBuild's consideration section is producing **more than twice** the
ungoverned evidence for the same governed yield. This is not a defect — the
open-world channel is doing its designed job — but it is the clearest single
signal so far that **the taxonomy is fitted to Modiv's vocabulary**, which
is precisely what Step 2F was built to detect. TopBuild is a stock-and-cash
two-step merger with an exchange fund, equity-award conversion, an
anti-dilution adjustment and a fractional-share cash-out; Modiv is a
straight cash REIT merger. Most of what §§2.1–2.5 say has no governed slot.

---

### Rung 3 — eight more families, and the first hard break

21 calls attempted. **Seven families completed. `REPRESENTATIONS` failed
and did not write an `adapter-result.json`, so `incomplete` = 1.**

| Family | Sections | Calls | Wall clock | Compiled | `resolved` | Review queue | Open world | Claims | Writes | Renders |
|---|---|---|---|---|---|---|---|---|---|---|
| `TERMINATION` | 6.1–6.4 | 4 | 354 s | 28 | 7 | 20 | 8 | 7 | `COMMITTED`, 59 | **5 cards** |
| `SPECIFIC_PERFORMANCE_REMEDIES` | 7.6 | 1 | 93 s | 1 | 1 | 1 | 0 | 1 | `COMMITTED`, 3 | **1** |
| `MATERIAL_CONTRACTS` | 3.1 | 1 | 259 s | 35 | 16 | 16 | 19 | 16 | `COMMITTED`, 115 | **1 card** |
| `GENERAL_COVENANTS` | 4.8–4.10, 4.18, 4.19, 4.21 | 6 | 175 s | 12 | 7 | 8 | 4 | 7 | `COMMITTED`, 41 | **7** |
| `TAX_MATTERS` | 4.23, 7.11 | 2 | 87 s | 9 | 5 | 5 | 4 | 5 | `COMMITTED`, 33 | **7** |
| `CLOSING_CONDITIONS` | 5.1–5.3 | 3 | 373 s | 26 | 9 | 16 | 10 | 9 | `COMMITTED`, 76 | **5 cards** |
| `INTERIM_OPERATING` | 4.1, 4.2 | 2 | 635 s | 85 | 29 | 75 | 49 | 29 (+29 components) | `COMMITTED`, 345 | **29** |
| `REPRESENTATIONS` | 3.1, 3.2 | **0 of 2** | 650 s | — | — | — | — | — | **no run** | **no run** |

Claim-revision rows went 27 → 101, deltas exactly +7, +1, +16, +7, +5, +9,
+29. Every SQL receipt id matched its JS receipt id, and `residualCount`
was 0 on all seven.

#### BREAK 1 — `REPRESENTATIONS` cannot extract TopBuild §3.1 at all

```
NativeProducerAnthropicError: native producer model call failed after
1 attempt(s): model response does not contain one complete, parseable
JSON object
```

**This is call 1 of 2, on §3.1, not a downstream call.**
`call-telemetry.json` records `call_index: 0, section_reference: "3.1",
failed: true`, `wall_clock_ms: 633788`, `total_cost_usd_cli: 2.0887`.

**Root cause, from the telemetry and the captured response — the model did
the work and the transport lost it.** TopBuild §3.1 is **83,756 bytes**, the
entire Company representations article as one section with 23 lettered
sub-clauses. The call produced **74,080 output tokens** against
`claude-sonnet-5`'s `maxOutputTokens: 64000`. Over the limit, the CLI split
the answer across assistant messages, and the harness only ever sees the
last one. That last message, captured verbatim in
`native-producer-recorded-response-3.1.json`, is 2,308 characters of
**prose**:

> "The extraction of Section 3.1 is complete. To summarize the output
> structure (the head — clauses (a) through (n) — was delivered in my
> previous message; the corrected tail — clauses (o) through (t) … is in the
> fixed file above): 19 `representation_instances` objects … 11
> `open_world_candidates` … **Both message halves together constitute the
> single complete JSON object requested.**"

So the extraction succeeded and was thrown away. 19 representation instances
and 11 open-world candidates were produced, and the parser saw a summary.

**Not sampling noise, and not retried.** The cause is arithmetic —
74,080 > 64,000 — so a retry buys another ten minutes and another $2.09 to
fail the same way. `--call-timeout-ms 1200000` was in force and was not the
limit; the run took 650 s of its 1,200 s budget. The runner already has a
distinct `RESPONSE_TOO_LARGE` code that stops without retrying, and it did
not fire, because from the harness's point of view the response was small
(2,308 chars) and merely unparseable.

**This is the third instance of one defect, and the first on a second
document.** The other two are `CAPITALISATION` §4.2 on Modiv (58 and 52
independent JSON objects in one response — the defect Ben parked with the
family on 2026-08-08) and `CLOSING_CONDITIONS` call 2 of 4 on Modiv (an
unparseable response, recorded in PLAN.md Step 2D and never root-caused).
All three are the same contract failing: **one section, one call, one
complete JSON object**. That contract does not survive a large section, and
**parking `CAPITALISATION` parked the family, not the parser.**

**Why TopBuild hits it and Modiv did not, structurally.** This is exactly
what 2E predicted and it is worth stating in the form 2H will need. Modiv's
Article III is granular — capitalisation at 3.2, employee matters at
3.11/3.12, material contracts at 3.17, no-other-reps at 3.25, each its own
numbered section, each a few kilobytes. **TopBuild's Article III is two
sections**, §3.1 at 83,756 bytes and §3.2 at 47,618. Every family whose
TopBuild content lives inside them must ask a question over an 84 KB span.
Narrow questions survive it — `MATERIAL_CONTRACTS` (35 candidates) and
`KEY_DEFINED_TERMS` (105 across four sections) both ran §3.1 successfully in
this same ladder. `REPRESENTATIONS` asks for **one object per sub-clause**
over all 23, and that is the ask that overflows.

**Consequence for the ladder, and why it continued.** Step 2F's rule is stop
at the rung where something breaks *unless the break is understood and
recorded*. It is understood, root-caused to a number, and recorded here, so
rung 4 proceeded. But note what this costs: **`REPRESENTATIONS` has no
TopBuild run, so 23 of 24 families is the honest figure**, not 24.

---

### Rung 4 — the remaining twelve

34 calls attempted. **Eleven completed, `NO_SHOP` failed.** `incomplete` = 2
(`REPRESENTATIONS` from rung 3, `NO_SHOP` here).

| Family | Sections | Calls | Compiled | `resolved` | Review queue | Open world | Claims | Writes | Renders |
|---|---|---|---|---|---|---|---|---|---|
| `ANTITRUST_REGULATORY` | 4.6 | 1 | 25 | 10 | 25 | 0 | 10 | `COMMITTED`, 27 | **8 cards** |
| `DIVIDENDS` | 4.1, 4.2 | 2 | **0** | **0** | 0 | **0** | 0 | `COMMITTED`, 0 | n/a (see BREAK 3) |
| `DNO_INDEMNIFICATION` | 4.13 | 1 | 14 | 3 | 9 | 5 | 3 | `COMMITTED`, 33 | **3** |
| `EMPLOYEE_MATTERS` | 3.1, 4.11 | 2 | 18 | 4 | 9 | 9 | 4 | `COMMITTED`, 54 | **3** |
| `FINANCING_COVENANTS` | 4.17 | 1 | 13 | 1 | 7 | 6 | 1 | `COMMITTED`, 33 | **1** |
| `GUARANTY_FINANCING_PARTY` | 7.16 | 1 | **0** | **0** | 0 | **0** | 0 | `COMMITTED`, 0 | n/a (see BREAK 2) |
| `MAE_DEFINITION` | 3.1, 3.2 | 2 | 44 | **38** | 42 | 2 | 38 | `COMMITTED`, 85 | **THROWS** (BREAK 5) |
| `MERGER_STRUCTURE_CLOSING` | 1.1–1.8 | 8 | 22 | 21 | 21 | 1 | 21 | `COMMITTED`, 55 | **no projection module** |
| `MISC_BOILERPLATE` | 7.1–7.15 (11) | 11 | 31 | 31 | 31 | 0 | 31 | `COMMITTED`, 71 | **10** |
| `NO_OTHER_REPS_FRAUD` | 3.1, 3.2 | 2 | 3 | 3 | 3 | 0 | 3 | `COMMITTED`, 8 | **THROWS** (BREAK 6) |
| `PROXY_MEETING` | 4.5 | 1 | 30 | 4 | 17 | 13 | 4 | `COMMITTED`, 73 | **1** |
| `NO_SHOP` | 4.3, 4.4 | **0 of 2** | — | — | — | — | — | **no run** | **no run** |

Claim-revision rows ended at **216**, every delta exact, every SQL receipt id
equal to its JS receipt id, `residualCount` 0 throughout. Read-back:
**216 governed claims, 260 open-world entries, 29 IOC restriction
components.**

#### BREAK 2 — `GUARANTY_FINANCING_PARTY` returns zero on TopBuild. PLAN.md's falsifiable prediction resolved, against the family.

Step 2F named this one by name: *"If it returns zero on a financed deal with
two dedicated financing sections, that reasoning was wrong and the family is
broken rather than correctly quiet. Write down which it was."*

**It returned zero. The family is broken. Here is the mechanism.**

The mapping was right and the resolution was right: §7.16 resolved to
`"Waiver of Claims Against Financing Sources"`, 2,287 bytes, exactly what 2E
pinned. The model was given that text and answered:

```json
{"guaranty_assertions":[],"financing_mechanics":[],"open_world_candidates":[]}
```

and then explained itself, verbatim from the recording:

> "Section 7.16 as given is the Financing Sources non-recourse/waiver clause
> … There is no guarantor, no guaranty instrument, no delivery event, and no
> in-effect status anywhere in this text, so no `guaranty_assertions` can be
> extracted without inferring facts not present. **None of the language
> constitutes guaranty delivery, a guaranty core term, or a financing-party
> protection tied to a guaranty (it's a lender-liability waiver, a distinct
> mechanism)**, so `financing_mechanics` is empty too rather than stretched
> to fit."

**Root cause: the producer prompt, not the mapping and not the resolver.**
`lib/canonical-v2/native-producer/guaranty-producer-prompt.js` is six lines.
Its instruction opens *"Extract quoted **positive guaranty facts only**"*,
and every surface in its response shape — including
`FINANCING_PARTY_PROTECTION` — sits under that framing. The model read
`FINANCING_PARTY_PROTECTION` as *a financing-party protection tied to a
guaranty*, which is a fair reading of the prompt it was given, and TopBuild's
§7.16 is a non-recourse waiver with no guaranty anywhere near it.

**The worst part is the third empty array.** `open_world_candidates` is also
`[]`. A textbook non-recourse/no-claims-against-lenders clause on a
$600,000,000 debt-financed acquisition produced **not one row of any kind**,
governed or ungoverned. The open-world channel exists precisely so that
content the taxonomy cannot express is still captured, and here it captured
nothing, because the prompt's own framing excluded the content before the
open-world question was ever reached.

**What 2E got right and what it missed.** 2E predicted the
`guaranty_assertions` half would be empty — QXO is a strategic acquirer
acting as Parent directly, with no SPV needing a sponsor guaranty — and it
was, correctly. What 2E did not predict, and could not without running it,
is that the `financing_mechanics` half would be empty too. That is the
finding.

**This is not a fix to make in a fan-out ladder.** Rewriting an extraction
prompt's scope is taxonomy work, reserved.

#### BREAK 3 — `DIVIDENDS` returns zero on text that plainly contains the covenant

Both calls returned `{"dividend_assertions":[],"mechanics":[],"open_world_candidates":[]}`.
Unlike BREAK 2 this one has no reasoning attached — just empty.

**The content is there, verified in the filed text.** TopBuild §4.1(vi)(A)
reads: *"declare, set aside or pay any dividend or other distribution,
whether payable in cash, stock or other property, with respect to its
capital stock, except for dividends by any wholly owned direct or indirect
Subsidiary of the Company to the Company…"*, and §4.2(iv)(A) is the Parent
mirror, carving out *"dividends required to be declared and paid pursuant to
the terms of the Convertible Perpetual Preferred Stock, Series B Preferred
Stock…"*. Two occurrences of `declare, set aside or pay` in the document,
both inside the two sections 2E pinned.

So: **mapping correct, content present, sections resolved, extraction empty,
open world empty.** A false zero, and a second family that publishes nothing
where it should publish something.

The structural reason is the same one that broke `REPRESENTATIONS`:
TopBuild's dividend restriction is not a section, it is sub-clause (vi)(A)
of a thirty-limb interim-operations covenant. The same two sections handed
to `INTERIM_OPERATING` yielded **29 claims and 29 components**, so the text
is demonstrably extractable — this family's producer simply does not find
its own content when the content is a limb rather than a section.

#### BREAK 4 — `NO_SHOP` cannot extract TopBuild §4.3

```
model response contains 5 independent JSON objects; expected exactly one
and cannot guess which is authoritative
```

Call 1 of 2, §4.3 (25,457 bytes), **65,210 output tokens** against
`claude-sonnet-5`'s 64,000 limit, 536 s, $1.54.

**This is BREAK 1 again with the other presentation.** Same cause — the
answer does not fit in one response — different symptom: where
`REPRESENTATIONS` overflowed into a prose summary, `NO_SHOP` overflowed into
five separate JSON objects.

**So the ladder has now produced four instances of one defect:**

| Instance | Document | Section | Output tokens | Presentation |
|---|---|---|---|---|
| `REPRESENTATIONS` | TopBuild | §3.1, 83,756 B | 74,080 | prose summary, no JSON |
| `NO_SHOP` | TopBuild | §4.3, 25,457 B | 65,210 | 5 independent JSON objects |
| `CAPITALISATION` | Modiv | §4.2 | — | 58 and 52 independent JSON objects |
| `CLOSING_CONDITIONS` | Modiv | call 2 of 4 | — | unparseable response |

**The record needs correcting on two points.**

1. **PLAN.md Step 2D2 attributes the multi-object parse to capitalisation's
   own nature.** It is not a capitalisation property. It is what happens to
   *any* family whose answer exceeds the model's output budget, and it has
   now happened to three other families across two documents. **Parking
   `CAPITALISATION` parked a symptom and left the defect live.** Two of
   TopBuild's 24 families are unextractable because of it.
2. **`RESPONSE_TOO_LARGE` never fires for this.** The runner has a dedicated
   oversized-response code that deliberately skips retries, and neither
   failure triggered it, because from the harness's side the *received*
   response is small (2,308 chars for `REPRESENTATIONS`) — it is the model's
   *generation* that overflowed, upstream of anything the harness measures.
   The diagnostic that would name this correctly is
   `usage.output_tokens ≥ maxOutputTokens`, which `call-telemetry.json`
   already records on every call and nothing reads.

Neither was retried: 74,080 > 64,000 and 65,210 > 64,000 are arithmetic, not
sampling. `--call-timeout-ms 1200000` was in force and was never the binding
constraint.

#### BREAK 5 — `MAE_DEFINITION`'s 38 claims write and cannot be served, and the validator that rejects them encodes Modiv's drafting style

`projectKeyTermsMaeClaims` throws
`INVALID_GOVERNED_ATTRIBUTES: Disproportionality relationships must retain
their exact labels and comparison baseline in the claim quote.`

**This is a regression the ladder caught exactly where it was supposed to.**
At rung 2 the same projection rendered 21 `KEY_DEFINED_TERMS` records
cleanly. Rung 4 added `MAE_DEFINITION`, and the module — which covers both
families — now throws for both.

**Root cause, isolated to a line.**
`lib/canonical-v2/key-terms-mae-product-projection.js` (~279-283) requires,
for `MAE_DISPROPORTIONALITY_CARVEBACK`, that `claim.raw_value` *contain*
every entry in `attributes.applies_to_clause_labels`. All ten of TopBuild's
carve-backs fail it. The `comparison_baseline_phrase` half of the same check
passes on all ten; **only the label containment fails.**

The reason is a drafting difference, and it is worth stating exactly:

- **Modiv** puts its disproportionality carve-back in **one trailing
  proviso that names the affected clauses inside its own text**: *"provided,
  further, that in the case of the foregoing clauses (a), (b), (c), (d), (g)
  or (k), except to the extent that such matters disproportionately…"*. The
  quote literally contains `(a)`, `(b)`, `(c)`… so the containment rule
  passes trivially.
- **TopBuild** puts a **separate disproportionality exception inside each
  lettered carve-out**. The claim's quote is the body of clause (A), or (B),
  or (D); the label `(A)` is the enumeration marker *preceding* it and is
  not part of the text. A correctly-extracted quote can never contain its
  own label.

So the validator **encodes Modiv's convention as a universal invariant**.
This is the single clearest instance of the thing Step 2F exists to detect,
and it was invisible for as long as the render check only ever ran against
Modiv.

**It is not new today, and it is already in the committed baseline.** The
same projection throws on `topbuild-mae-definition-20260807-replay` — one of
the 32 importable runs at HEAD, 19 entries, 5 carve-backs — and it has
thrown all along. Verified directly against three runs:

| Run | Entries | Carve-backs | `projectKeyTermsMaeClaims` |
|---|---|---|---|
| `modiv-mae-definition-20260807-live` | 10 | 2 | **OK** |
| `topbuild-mae-definition-20260807-replay` (committed baseline) | 19 | 5 | **THROWS** |
| `topbuild-mae-definition-20260808-rung4` (this run) | 38 | 10 | **THROWS** |

#### BREAK 6 — `NO_OTHER_REPS_FRAUD` has never been able to render, on either document

`projectNoOtherRepsFraudProduct` throws
`TypeError: canonical JSON does not support undefined`.

**Not a reader gap and not a harness artefact — proven by calling it on the
runs' own `resolution.json` files, bypassing the database entirely:**

```
TOPBUILD  THREW on the run's OWN resolution.json (3 entries)
MODIV     THREW on the run's OWN resolution.json (3 entries)
```

**Root cause.** The module reads four fields that the resolver has never
emitted: `item.resolution_id`, `item.evidence_only`, `claim.concept_key` and
`claim.owner_family`. None of them exists on a `resolution.json` `resolved[]`
entry (whose keys are `section_reference`, `source_citation`,
`citation_context`, `governing_context_quote`, `generic_claim_key`,
`resolved_claim_definition_key`, `concept_key`, `party`,
`party_source_span`, `provision_instance`, `claim`, `compiled_candidate`,
`triage`) — note `concept_key` sits on the **entry**, not on `claim`. All
four come back `undefined`, and `contentId`'s canonicaliser refuses
`undefined`.

**This is a shared-layer defect that predates TopBuild entirely.** It is the
same class as Step 2D1 defect 5 (the reader's reconstructed shape was
incomplete), except here the *source* shape was never right, so fixing the
reader would not have helped. It stayed invisible because Step 2D's render
check never called this module.

Worth noting where this family sits: `NO_OTHER_REPS_FRAUD` is the family
Step 4A used for the **first durable database write in the programme**. It
writes perfectly and has never rendered.

#### Not breaks, recorded so they are not re-derived

- **`REPRESENTATIONS`'s projection reports `INVALID_INPUT`** because the
  family has no TopBuild run at all (BREAK 1). A consequence, not a
  separate defect.
- **`MERGER_STRUCTURE_CLOSING` has no projection module.** 21 claims write
  and there is nothing to render them onto. Recorded by name per Step 2D's
  rule; building it is Stage 5's job.
- **Two false breaks were found in the render harness and fixed before
  reporting.** `projectNoOtherRepsFraudProduct` and
  `projectRepresentationClaims` do **not** filter their inputs internally —
  unlike the `{resolution, deal_id}` modules — so handing them all 216
  resolved entries and all 260 open-world entries made both throw for
  reasons that were mine, not the product's. Both were re-run against
  correctly filtered input before anything above was written down. Stated
  here because a harness artefact reported as a product defect is exactly
  the failure this repository keeps paying for.

---

## Phase 2 result

### TopBuild, measured, after `npm run generate:baseline`

| Measure | Value |
|---|---|
| Families attempted (24 of 25, capitalisation parked) | **24** |
| Families with a complete run | **22** |
| `incomplete` | **2** — `REPRESENTATIONS`, `NO_SHOP` |
| Families with an importable run | **22** |
| Families publishing claims | **20** (`DIVIDENDS` and `GUARANTY_FINANCING_PARTY` publish zero, both wrongly) |
| Model calls issued / succeeded | **64 / 62** (66 projected; the two failures died on call 1 so their second calls were never issued) |
| Claims / provisions / excerpts (TopBuild only) | **235 / 90 / 485** |
| Open-world entries (TopBuild only) | **262** |
| Governed claims durably written to SQL | **216 claim revisions**, every receipt `COMMITTED`, `residualCount` 0, JS receipt id == SQL receipt id every time |
| Families that render from the database | **18 of 22** |
| Longest single model call | **633,788 ms (10.6 min)**, `REPRESENTATIONS` §3.1 |
| Mean model call | 119,515 ms (~2.0 min) |

Whole-repository baseline after this step: **54 of 78 runs importable, 25
families, 467 claims / 194 provisions / 983 excerpts / 39 components.**
`npm run gate:baseline` passes; `bash scripts/lint/forbidden-patterns.sh`
exits 0 (`INVARIANT-4: PASS`).

### Latency, measured rather than assumed

The brief budgeted 9–11 minutes per dense-section call. **The mean is 2.0
minutes and the median is well under that**; only one of 64 calls exceeded 10
minutes. Section byte length predicts it better than anything else: §7.6
(1 call, small) took 93 s; §3.1 at 83,756 bytes took 634 s. Eight-way
parallelism held throughout with no contention.

### Every break, in one place

| # | What | Where | Root cause | Shared-layer or TopBuild-specific? |
|---|---|---|---|---|
| 1 | `REPRESENTATIONS` does not run | §3.1, call 1 of 2 | 74,080 output tokens vs a 64,000 limit; overflow answer arrives as a prose summary | **Shared** — the one-call/one-JSON-object contract |
| 2 | `GUARANTY_FINANCING_PARTY` publishes zero | §7.16 | `guaranty-producer-prompt.js` is framed "positive guaranty facts only", so a guaranty-less non-recourse waiver is excluded — including from open world | **Shared** (prompt), surfaced only by a financed deal |
| 3 | `DIVIDENDS` publishes zero | §4.1(vi)(A), §4.2(iv)(A) | producer returns empty on text that plainly contains the covenant; the restriction is a limb, not a section | **Shared** (prompt), surfaced by TopBuild's flat structure |
| 4 | `NO_SHOP` does not run | §4.3, call 1 of 2 | 65,210 output tokens vs 64,000; overflow arrives as 5 independent JSON objects | **Shared** — same defect as #1 |
| 5 | `MAE_DEFINITION`'s 38 claims write and cannot render | `key-terms-mae-product-projection.js` ~279-283 | requires the claim quote to contain its own clause label; true of Modiv's single trailing proviso, false of TopBuild's per-clause exceptions | **Shared**, and it encodes Modiv's drafting convention |
| 6 | `NO_OTHER_REPS_FRAUD` has never rendered, on either document | `no-other-reps-fraud-product-projection.js` | reads `resolution_id`, `evidence_only`, `claim.concept_key`, `claim.owner_family` — four fields the resolver has never emitted | **Shared**, and it predates TopBuild |
| 7 | `MERGER_STRUCTURE_CLOSING` has no product surface | — | no projection module exists; 21 claims write with nowhere to go | Known, Stage 5's job |
| — | `closure_id` moves when the content does not | `provider-interface.js` / `candidate-proposal-compiler.js` | `model_id` — a filesystem path on replay — is inside a content address | **Shared**, found in Phase 1 |

**Six of the seven are shared-layer.** The honest reading of Step 2F's
question — *does any of this generalise beyond one agreement?* — is that the
**extraction generalises and the surrounding contracts do not.** Every
family that ran produced legally sensible output on a document nobody tuned
anything against; what failed were a response-format contract, two producer
prompts, and two projection validators — and two of those five failures were
already broken on Modiv and simply never looked at.

### Which of today's five fixes held on a second document

| Fix (PLAN.md Step 2D1) | Verdict on TopBuild | Evidence |
|---|---|---|
| **1. `--call-timeout-ms` reaches the client** | **HELD, and proved by a call that needed it** | `REPRESENTATIONS` §3.1 ran **633,788 ms**. The old hardcoded default was 600,000 ms, so under the pre-fix behaviour that call would have been killed at ten minutes and misreported as a timeout instead of an overflow |
| **2. The excerpt identity guard** | **HELD** | `validation accepted: true, residuals: 0, quarantines: 0` on all 22 runs; `adapter residuals: 0` on 21 of 22. `TERMINATION` published 7 of 7 resolved claims with nothing rolled back |
| **3. Projection family coverage** | **HELD** | `projectRemediesMiscProductSurfaces` renders 10 surfaces covering both `SPECIFIC_PERFORMANCE_REMEDIES` and `MISC_BOILERPLATE` |
| **4. Four projections checking a dead schema version** | **HELD where exercised — 4 of the 7 named families** | Defect 4 listed six families as latent. TopBuild resolved provision-bound claims for `TAX_MATTERS` (renders 7), `FINANCING_COVENANTS` (1), `APPRAISAL_DISSENTERS_RIGHTS` (7) and `INTERIM_OPERATING` (29). `GUARANTY_FINANCING_PARTY` and `DIVIDENDS` stay latent because they resolved nothing (BREAKs 2 and 3); `REPRESENTATIONS` stays latent because it has no run (BREAK 1) |
| **5. The reader's reconstructed shape** | **PARTLY HELD — 3 of the 5 instances** | `party` **held** (`CONSIDERATION` renders 2 from the database, the exact case that failed in 2D). `ioc_restriction_components` **held** (`INTERIM_OPERATING` renders 29). `section_reference` **held**. But defect 5 also named `NO_OTHER_REPS_FRAUD` and `MAE_DEFINITION`'s MAE path, and **both are still broken (BREAKs 6 and 5)** — for causes that are not in the reader at all: one projection reads fields the resolver never emitted, the other validates against Modiv's drafting style. Fixing the reader could not have fixed either |

**And one fix from Step 4A1 held that nobody asked about.**
`STRUCTURAL_PROVISION_INSTANCE/V1` now appears **5 times** in
`supabase/canonical-v2-foundation.sql`, against the **zero** recorded in
PLAN.md section 2 — the largest single blocker on the import path at the
time. All 22 TopBuild families were accepted by `public.canonical_v2_write`,
including every one 4A1 said was rejected outright.

### The mapping is now pinned, and what that changed

`DEAL_PINS.topbuild` in `scripts/canonical-v2-live-extraction-run.mjs` now
carries all 24 reviewed section lists and `agreement_date: '2026-04-18'`, per
PLAN.md Step 2F's instruction to pin in the change that exercises them. All
24 dry-run from the pin alone with no `--section-refs`, totalling exactly
**66 projected calls** — 2E's 68 less capitalisation's 2.

Two tests in `tests/canonical-v2-general-extraction-runner.test.js` used
`topbuild` + `MAE_DEFINITION` as their example of an *unpinned* (deal,
family) pair, and that example no longer exists. Both were repointed at
`topbuild` + `CAPITALISATION`, which is now the only unpinned pair — so those
two tests also became the guard that **the capitalisation parking still
holds**: pinning that family would fail them rather than pass silently.

`CI=true node --test` on
`canonical-v2-general-extraction-runner`, `canonical-v2-modiv-family-pins`,
`canonical-v2-mae-definition-pin-review`,
`canonical-v2-admitted-source-chain-rebuild`,
`canonical-v2-evidence-to-write-set-bridge`,
`canonical-v2-run-projects-to-product-cards`,
`canonical-v2-modiv-no-other-reps-answer-provenance-replay`,
`canonical-v2-mae-specific-performance-replay` and
`canonical-v2-modiv-termination-fee-citation-following-replay`:
**96 tests, 96 pass, 0 fail.** The full suite was not run (one had just
passed at 8,250 and this step changed a data table and one test file).

### What this step did not do

- **Fixed nothing.** Six shared-layer defects are recorded and none is
  repaired. Two are producer-prompt scope questions (BREAKs 2 and 3), which
  `CLAUDE.md` reserves; one is a response-format contract that needs a design
  decision (BREAKs 1 and 4 — chunk the section, raise the budget, or accept
  multi-object responses and define accumulate-versus-supersede, which is the
  same question Step 2D2 parked); two are projection-validator repairs
  (BREAKs 5 and 6); one is an identity-stability contract (`closure_id`).
- **Did not re-run `REPRESENTATIONS` or `NO_SHOP`.** Both failures are
  arithmetic, not sampling, and a retry costs ~10 minutes and ~$2 to
  reproduce the same overflow.
- **Did not touch `CAPITALISATION`** on either document.
- **All 66 TopBuild responses are recorded** (`recording.json` per run
  directory, request-hash keyed), so every one of these findings is
  re-derivable at zero model cost — including the two failed runs, whose
  partial recordings and the §3.1 prose response are kept deliberately as the
  evidence for BREAK 1.
