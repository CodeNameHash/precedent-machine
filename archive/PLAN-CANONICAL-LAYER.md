# PLAN: Canonical layer — from Metsera bandaids to scale-safe coding

**Status: assessment + values worksheet. No code changes yet.**
**Owner: Fable (spec/audit) + Codex (mechanical deletes/wiring) + extraction reprocess.**
**Trigger: the round-4→6 render work fixed Metsera by hand; before scaling we need identical legal language to yield identical output across all deals.**

Source detail (raw agent reports, not in repo): `AUDIT-INVENTORY.md` (per-helper
verdicts), `AUDIT-PIPELINE.md` (extraction/schema/taxonomy map). This doc is the
integrated synthesis + the executable worksheet.

---

## 1. The finding, in one paragraph

The canonical **machinery already exists** — `lib/taxonomy.js` has ~40 `{CODE: label}`
dictionaries built via `metaToDict`, joined to feature keys by one function
`taxonomyForFeatureKey()`, resolved at render by `labelForCode(code, dict)`, and
embedded into the extraction LLM prompt by `formatDict()`. So the same taxonomy
drives *both* extraction and rendering by design. We are **not building a system;
we are populating and consuming it.** The round-4→6 render work bypassed it: of
~179 label helpers added/changed, **~60 are BANDAIDs, ~37 PARTIAL, ~82 SAFE** — the
bandaids run regex/keyword matches over verbatim clause prose calibrated to
Metsera's exact drafting, so a legally-identical clause drafted differently yields
a wrong label, a missing pill, or a silent fall-through to raw text.

## 2. Two canonicalization jobs (per Ben)

1. **Canonical INPUT code** — what concept/posture is this clause? (`divestitureCapDescription → ANTI_HOHW`). Mostly built + populated.
2. **Canonical OUTPUT result** — the rendered label/tone/color for that code. **This is the real gap.** The dict labels exist, but only **8 of 28 configs** consume them; the rest hand-roll local `*_LABELS` maps (`FIDUCIARY_STANDARD_LABELS` is defined **three times**; `voteStandard` copy-pasted in 3 files), and my bandaids invent yet another. Result: one code can render 3–4 different strings across the page, and a new deal's clause produces yet another.

## 2b. The code→render path is THREE layers, and the middle one leaks (discovered during Phase 0)

The path is **extraction assigns a code → assembly threads it into `card.features` → render reads it**. The middle layer is inconsistent:
- **Code reaches render** (assembled as `{code, label, text}`): `fiduciaryOutStandard`, `representativesStandard`, `antitrustEffortsStandard`, material-contract buckets, bring-down tiers. → true "delete-the-regex" Phase-0.
- **Code dropped at assembly** (arrives as bare `{text}` / string even though `claims.canonical` HAS the code): `divestitureCapDescription` (`ANTI_HOHW`), `pullRefile` (`MUTUAL_CONSENT`), `timingAgreementsProhibited` (`NOT_UNREASONABLY_WITHHELD`). → NOT a render delete; fix = thread the canonical into the feature value in the assembly layer (`lib/queries/claims-adapter.js` / `review-deal.js`), then delete the regex.

So Section A splits: **A1 code-present → delete regex now; A2 code-dropped-at-assembly → plumbing fix first.** The flagship divestiture is A2. Verify "does the code reach the render?" per concept before deleting.

## 3. Systemic cause (why bandaids proliferated — not 60 isolated mistakes)

Adding one coded feature today means editing **three disconnected places** with
nothing enforcing agreement: (a) the taxonomy dict + a `taxonomyForFeatureKey`
case; (b) the schema `features.generated.js` FeatureDef + `tags.generated.js`
(a second registry, currently out of sync with the taxonomy); (c) a hand-maintained
`if/else` codebook-selection chain in `extract.js`. The freeze-gate + CI invariants
that exist govern the market-registry/query fields, **not** taxonomy additions or
taxonomy↔schema consistency. So extraction under-populates codes the taxonomy
already defines → render bandaids fill the gap deal-specifically.

## 4. The model to copy (already in the repo)

- **Gold standard:** `exceptionEntries` (ioc-exceptions) — resolves an
  extraction-assigned code through `labelForCode` against a shared dict, degrades
  to the raw code, never guesses.
- **Exemplar refactor (same 24h diff):** `isGeneralCovenant` *deleted* a
  title-keyword regex and replaced it with a `provision_type`/`provision_subtype`
  code gate. That is the move for the other 60.
- **Reviewer rule (add to CI/lint):** if a render helper calls
  `.test/.match/.replace/.includes` on clause text to *produce a label*, it's a
  bandaid — the fix belongs in extraction (emit a code); the render helper should
  look like `exceptionEntries`.

## 5. Concept-shape taxonomy (not everything is an enum — Ben's "deal value" point)

Every audited concept classifies into one of four shapes; the remediation differs:

| Shape | Canonical output = | Examples |
|---|---|---|
| **ENUM** | code → display-bundle (dict + `labelForCode`) | divestiture posture, efforts standard, fiduciary-out standard, vote standard, no-shop acts |
| **SCALAR** | shared **formatter**, no enum | deal value, per-share price, $/% thresholds, day/month periods, dates |
| **ENTITY** | light **normalizer**, no enum | bank names (Bank of America), courts (Delaware Court of Chancery), section refs |
| **DECOMPOSABLE** | canonical **sub-structure** (limb set) | Superior-Proposal test = {value, deliverability, certainty}; MAE = {two-limb}; acquisition-proposal def = {trigger%, types[], exclusions[]} |

Mis-shaping a concept is its own bug (e.g. forcing "deal value" into an enum, or
treating the Superior-Proposal test as one code instead of a limb set).

## 6. THE VALUES WORKSHEET

### A. Already coded — DELETE the regex, read the dict (cheapest; no extraction; ship correct output now)

| Concept | Enum / feature key | State | Action |
|---|---|---|---|
| Divestiture posture | `BURDEN_COMMITMENT` / `divestitureCapDescription` | code `ANTI_HOHW` **populated** in Metsera; my `divestitureCapLabel` regex ignores it | delete regex → `labelForCode`; add term-of-art `displayLabel` "Anti-hell-or-high-water" to the code |
| Pull-refile / timing | `PULL_REFILE` / `TIMING_AGREEMENT` | codes populated (`MUTUAL_CONSENT`, `NOT_UNREASONABLY_WITHHELD`) | delete `consentGateLabel`; read dicts. **Also fix extraction**: same clause got two different codes — that inconsistency is the real "why do they differ" bug |
| Fiduciary-out standard | `fiduciaryOutStandard` codes | codes populated; `FIDUCIARY_STANDARD_LABELS` triplicated | delete the regex pre-pass in `fiduciaryStandardSummary`; collapse the ×3 maps into the dict |
| Board-change standard | `boardChangeStandard` | code populated | already SAFE via code map; move label into dict, drop the ×3 local copies |
| Reps control standard | `REPRESENTATIVES_STANDARDS` / `representativesStandard` | code `RBE_NOT_TO` populated | drop the `||` regex fallback in `representativesStandardLabel` |
| Per-rep bring-down | `MATERIALITY_CODES` via `bringDownTiers` | already reads structured tiers (SAFE) | keep; it's a model |
| Restraint finality | (enum if it exists) / `restraintFinality` | field "occasionally lands verbatim prose" | make extraction emit the enum reliably; delete `restraintFinalityLabel` regex |
| Material-contracts threshold | `resolveThreshold` already prefers `structuredThreshold` | extraction doesn't populate `structuredThreshold` | populate it in extraction → the 6 `$`/`%`/roman-numeral mining regexes become dead fallback |
| SEC-filings-excluded portions | `SEC_FILING_EXCLUSION_CODES` **exists**, schema row not tagged | verbatim stored | tag the feature + populate codes → delete `crispExcludedLabel` |

### B. Not yet coded — ADD the values (the real work; triangulate Metsera → corpus → terms-of-art → audit)

Each row: propose a code set (seeded from Metsera, completed from corpus, named by
terms of art), a `displayLabel` per code, then wire `taxonomyForFeatureKey` +
extraction. Concentrated in the no-sol family (19 bandaids).

| Concept | Shape | Proposed codes (seed — expand from corpus) | Replaces |
|---|---|---|---|
| Engagement standard | ENUM | `CONSTITUTES_SUPERIOR`, `COULD_LEAD_SUPERIOR`, `COULD_REASONABLY_LEAD_SUPERIOR` | `cleanEngageStandard` |
| Final-determination standard | ENUM | `INCONSISTENT_FIDUCIARY`, `WOULD_BREACH_FIDUCIARY` | `cleanFinalStandard` |
| No-shop prohibited acts | ENUM (list) | `SOLICIT`, `INITIATE`, `ENCOURAGE`, `FACILITATE`, `PROVIDE_INFO`, `ENGAGE_DISCUSSIONS`, `WAIVE_STANDSTILL` | `PROHIBITED_ACT_SPECS`, `summarizeProhibitedAct` |
| Change-of-rec items (A–E) | ENUM (list) | `WITHDRAW_MODIFY`, `FAIL_PROXY`, `APPROVE_RECOMMEND`, `FAIL_REJECT_DISCLOSED`, `FAIL_TENDER` | `COR_ITEM_SPECS` |
| Not-a-COR carve-outs | ENUM (list) | `14D9_COMPLIANCE`, `FACTUAL_DISCLOSURE`, `ROUTINE_COMMS` | `NOT_COR_SPECS` |
| Notice content | ENUM (list) | `IDENTITY`, `MATERIAL_TERMS`, `COPIES`, `DESCRIPTION_IF_ORAL`, `MODIFICATIONS` | `NOTICE_CONTENT_VOCAB` |
| No-shop exceptions | ENUM (list) | `CLARIFY_TERMS`, `FURNISH_UNDER_ACA`, `NEGOTIATE` | `EXCEPTION_SPECS` |
| Standstill / DADW | ENUM | `FIDUCIARY_WAIVE_ONLY`, `DONT_ASK_DONT_WAIVE`, `SILENT` | `summarizeStandstill` |
| Superior-proposal test | DECOMPOSABLE | limbs: `VALUE`, `DELIVERABILITY`, `CERTAINTY` | `superiorTestLimbs` |
| Superior-proposal determiner | ENUM | `BOARD_GF_COUNSEL_ADVISOR`, `BOARD_GF_COUNSEL` | `cleanDeterminer` |
| Acquisition-proposal definition | DECOMPOSABLE | `{ triggerPct, types[] (asset/equity/merger/tender/recap), exclusions[] }` | `acqProposal*`, `ACQ_TYPE_SPECS`, `extractPctTriggers`, `extractExclusionTail` |
| ACA terms | ENUM (list) | `CUSTOMARY`, `NO_LESS_FAVORABLE`, `STANDSTILL_NOT_REQUIRED` | `acaChips` |
| Company-terminate-for-superior | ENUM | `YES_CONCURRENT_SIGN`, `NO` | `terminationRow` hardcoded string |
| Vote standard | ENUM | `MAJORITY_OUTSTANDING`, `TWO_THIRDS`, `MAJORITY_CAST`, `PLURALITY` | `voteStandard` (copy-pasted ×3) |
| Consent party (adjournment/etc.) | ENUM | `PARENT`, `COMPANY`, `MUTUAL` | `consentPartyFromText` |
| Assignment posture | ENUM (list) | `WHOLLY_OWNED_SUB_OK`, `NO_ASSIGN_WITHOUT_CONSENT`, `COLLATERAL_CARVEOUT` | `buildAssignmentRow` canned sentences |
| Tail arming scenarios | ENUM (list) | `NO_VOTE`, `OUTSIDE_DATE`, `BREACH`, `COR` | `simplifyScenario` |
| Tail trigger scope | ENUM | `ANY_QUALIFYING`, `SAME_PROPOSAL_ONLY` | `formatTriggerScope` (discards `tailFeeSameProposalRequired`) |
| Table-membership gates | code gate | use `provision_type`/`provision_subtype` | `isAdvisersFeesCard`, `antitrustFilingFeeCard` (title regex) |

### C. Scalars / entities — formatter/normalizer, no enum (do NOT enumerate)

| Concept | Shape | Action |
|---|---|---|
| Deal value / per-share / $ / % / periods / dates | SCALAR | one shared formatter module (some done: `$47.50`, "4 business days"); `withBusinessDays` must honor calendar-day (currently hardcodes "business day") |
| Interest-rate basis | ENTITY+SCALAR | enum the basis (`PRIME`,`LIBOR`,`SOFR`,`FED_FUNDS`,`FIXED`) + carry the rate/bank as normalized entity; replaces `summarizeRate` |
| Forum | ENTITY | normalizer over the named court + fallback (NY/Cayman/arbitration must survive); replaces `forumLabel` |
| Bank / beneficiary / party names | ENTITY | normalizer; `normalizeBeneficiaryCore`/`factsForException` substring-matching is a bandaid — needs a structured join key from extraction |

## 7. Build methodology (per Ben — push/pull, multi-source)

For each B-row: **Metsera seed** (the concept + my hand label = one candidate
code) → **corpus mining** (run the concept across all deals to get the real
distribution → makes the enum MECE + complete; `BURDEN_COMMITMENT`'s 9 values are
the proof this was done for antitrust) → **terms of art / research** (name the
codes correctly, catch practitioner-expected variants the sample missed, supply
the crisp `displayLabel`) → **audit** (MECE + extraction assigns correctly across a
test-deal set).

## 8. Phased plan

- **Phase 0 — delete-the-regex (now; no extraction; pure correctness win).** Section A: swap bandaids for `labelForCode`; consolidate the ×3/×2 duplicated label maps into the dicts; add `displayLabel` term-of-art fields. Ships identical, correct output today for the already-coded concepts.
- **Phase 1 — wire the "dict exists, code not populated" cases.** Material-contracts `structuredThreshold`; SEC-exclusion tagging. Extraction change + reprocess; delete the mining regex.
- **Phase 2 — the missing enums (Section B).** Per concept: triangulate values → add to taxonomy (`metaToDict`) → register `taxonomyForFeatureKey` → extraction assigns → delete render bandaid → audit. Freeze-gate PR per concept. Start with the no-sol family (highest bandaid density).
- **Phase 3 — the output layer.** One code→display-bundle registry (`{displayLabel, tone, color}`) consumed by all configs via a shared helper; kill local `*_LABELS` maps.
- **Phase 4 — hardening (optional).** Collapse the three-place binding to one source of truth (generate schema `enumSet`/`tags` from `taxonomyForFeatureKey`); add CI: (i) every taxonomy dict has a matching schema enum + tag; (ii) lint fails a render helper that regexes clause text into a label.

## 9. Governance

New canonical values flow through the existing freeze-gate. Add the two CI
invariants above so the canonical layer gains a guardrail exactly where it lacks
one today. Extraction changes gated by golden eval + ingest-QA + quote verification
(per CLAUDE.md), reprocessed per-type not full re-ingest.
