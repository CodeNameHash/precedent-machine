# Diagnosis: KEY_DEFINED_TERMS (MULTI_SPAN_COMPOSED, NESTED_OR_CROSS_REFERENCED_EVIDENCE) + MATERIAL_CONTRACTS gaps

Status: COMPLETE
Started: 2026-08-09

Branch under diagnosis: `origin/cursor/step-2x-free-phase-b641` @ `7535782a` (read-only, `git show`)
Corpus artifact: `evidence/canonical-v2/corpus-review-20260809.html` (same commit), parsed with node, never opened whole.
All code line numbers below verified against the actual fetched file content, not the register's guesses (which were themselves close, off by 0-4 lines).

---

## Part 1 — KEY_DEFINED_TERMS · MULTI_SPAN_COMPOSED (76) + NESTED_OR_CROSS_REFERENCED_EVIDENCE (76)

### Where raised, quoted

`lib/canonical-v2/native-producer/candidate-resolution.js`, inside `finalizeResolvedCandidate` (shared by every family that reaches a registered claim definition — not KEY_DEFINED_TERMS-specific code):

```js
// line 5885-5886
const multiSpan = rebuiltClaim.evidence.length > 1;
const nestedOrCrossReferenced = rebuiltClaim.evidence.some((edge) => edge.evidence_role !== 'OPERATIVE_TEXT');
...
// line 5909-5911
if (multiSpan) reasons.push('MULTI_SPAN_COMPOSED');
if (nestedOrCrossReferenced) reasons.push('NESTED_OR_CROSS_REFERENCED_EVIDENCE');
```

The module's own file header (lines 44-48) names this explicitly as one of the six M3 auto-pass conditions this stage can evaluate:

> "AUTO-PASS here requires: ... exactly one evidence span with role OPERATIVE_TEXT (the mechanical proxies for 'not multi-span/composed' and 'not a nested or cross-referenced definition')"

So the module's authors already knew and documented that these two booleans are **mechanical proxies for the same underlying condition** — the header treats them as one idea expressed as two checks, which is exactly what the data confirms below.

### One mechanism, not two — confirmed on the actual corpus

Parsed every KEY_DEFINED_TERMS card in `corpus-review-20260809.html`:

```
MULTI_SPAN_COMPOSED: 76   NESTED_OR_CROSS_REFERENCED_EVIDENCE: 76
both: 76   mscOnly: 0   nocrOnly: 0
```

**100% overlap, both directions.** Not a coincidence of counts — every single claim that carries one carries the other, and none carries only one. Spread across 6 deals (concho 23, metsera 12, redhat 4, skechers 6, skywater 9, topbuild 22) and 12 assertion kinds (ACQUISITION_PROPOSAL_THRESHOLD_PERCENT 16, SUPERIOR_PROPOSAL_QUALIFIER 14, INTERVENING_EVENT_EXCLUSION 12, etc.) — not one deal or one kind's artifact.

**Why they're coupled — traced to the producer.** `defined-terms-producer-prompt.js`'s response shape requires two separate quotes per assertion: `definition_head_quote` (where the term is defined — "X means...") and `limb_quote` (the specific fact-bearing clause — the percentage, the code, the standard). The prompt's own instruction: *"They may be identical only for a self-contained fact."* `anthropic-provider.js:shapeDefinedTermAssertion` (line 2721-2807) turns this into evidence:

```js
// line 2725-2726
const definitionEvidence = evidenceFromQuote(sourceBytes, definitionHeadQuote, 'DEFINITION');
const limbEvidence = evidenceFromQuote(sourceBytes, limbQuote);   // defaults to role 'OPERATIVE_TEXT'
...
// line 2776-2778
const evidence = definitionHeadQuote === limbQuote
  ? [limbEvidence]
  : [definitionEvidence, limbEvidence];
```

One binary condition — head equals limb, or not — controls both flags identically: when they differ (the norm for any non-self-contained definition, by the prompt's own design), evidence has 2 entries (`multiSpan`) and one of them is role `DEFINITION` (`nestedOrCrossReferenced`). When they're equal, evidence has 1 entry, role `OPERATIVE_TEXT`, and neither flag fires. `shapeDefinitionEnvelope` (the `RECORDED_DEFINITION` path, line 2821-2880) does the identical `head === body ? [bodyEvidence] : [headEvidence, bodyEvidence]` split. There is no code path in this family that produces `multiSpan` without `nestedOrCrossReferenced` or vice versa. **Verdict: one mechanism, not two — the second reason code is redundant given the first, for this family.**

### Is "multi-span" here the same problem as Ben's Exchange-Ratio complaint?

**No — narrower and already-solved, which is the important nuance.** Ben's complaint (§67 + §89, read together) is about composing evidence **across different provisions in different sections**. What's actually happening here is different: `definitionHeadQuote` and `limbQuote` are both drawn from the **same section-scoped `sourceText`** passed to one producer call for one governing section (confirmed: card #3406's example, both spans live in `§ Annex-A`). This is a single definition's own head clause and its own limb clause — e.g., the Intervening-Event-Exclusion head ("...shall not include the following (each, an 'Intervening Event')...") plus one specific exclusion item's text — not two different operative provisions elsewhere in the agreement. `NESTED_OR_CROSS_REFERENCED_EVIDENCE` is a misleading name for what is actually "two-part single-definition evidence, one edge role DEFINITION, one role OPERATIVE_TEXT, same section." The real cross-provision problem (Exchange Ratio defined in one section, multiplied against share count in another) is a different, unbuilt mechanism — confirmed absent: `handleConsiderationCandidate` never references `definition_cross_references`, and no other family composes evidence across sections either.

### Is this actually blocking publication today?

**Partially, and the "actually blocking" story is more precise than "auto-pass blocked."** `resolved.push(resolvedEntry)` (line 6011) happens unconditionally — the claim, with both evidence spans byte-verified and correctly typed, is always published into `resolved` regardless of these flags. The write path already carries the composition correctly: `rebuildEvidenceForClaim` (line 2054) preserves both edges verbatim, and `native-write-set-adapter.js`'s `expectedTextForEdge` (line 456-466) was fixed 2026-08-07 specifically because it *dropped* two-span defined-term claims outright — the fix comment records that "both edges shifted to real, correctly-located text." So **composition is not merely possible, it already happened and is already correctly persisted.**

What actually differs: whether `!autoPass` also enqueues the claim into `review_queue` (line 6010). Right now, `autoPass` requires `unevaluatedConditions.length === 0` (line 5975), and `unevaluatedConditions` unconditionally includes three PERMANENT entries (`V1_V2_COMPARATOR_ABSENT`, `LEXICAL_DISAGREEMENT_NET_ABSENT`, `SOURCE_SCOPE_CERTIFICATION_ABSENT`, lines 5963-5966) on **every** resolved claim in the **whole system**, regardless of family. So today, MULTI_SPAN_COMPOSED changes nothing — every claim is already routed to `review_queue` for unrelated, system-wide reasons. Its real cost is **future and permanent**: `gateFailureReasons` (line 5932) — which does NOT include the pending-machinery entries — is what `deterministic_gates_passed` reports, and once the pending nets eventually land and the three temporary conditions are removed, `deterministicGatesPassed` becomes load-bearing for `autoPass`. At that point these 76 claims (and every future KEY_DEFINED_TERMS claim with a non-self-contained definition — i.e. most of them) would be **permanently** stuck in review, forever, purely because of how the producer's own prompt shapes evidence — not because of any real ambiguity or risk.

### What composition would require — and whether the write path already carries it

Nothing new. The claim already carries: two role-typed, byte-verified evidence spans (`DEFINITION`, `OPERATIVE_TEXT`) on one claim occurrence, both from the same governing section, both correctly shifted and persisted. What's missing is only a resolver-side judgment that this specific shape — role `DEFINITION` paired with role `OPERATIVE_TEXT`, both from the same section-scoped extraction call — is not evidence of cross-provision composition risk; it's the designed, expected shape of a split-compound definition.

### Fix

**RESOLVER_SIDE**, `lib/canonical-v2/native-producer/candidate-resolution.js`, `finalizeResolvedCandidate` (~line 5885-5911): narrow `nestedOrCrossReferenced` to only fire on roles that denote a genuine cross-reference (`CROSS_REFERENCE`, `DERIVATION_INPUT` per `claims-relationships.js`'s `EVIDENCE_ROLES`), not `DEFINITION`/`EXCEPTION` — and correspondingly exempt `multiSpan` from firing when the only reason `evidence.length > 1` is a `DEFINITION` + `OPERATIVE_TEXT` pair from the same producer call. This touches only already-extracted, already-verified evidence and its triage classification — no re-extraction, no digest invalidation, no vocabulary change, fully replay-validatable against the existing recorded responses. Would retire both reason codes for this family (and stop them recurring for future KEY_DEFINED_TERMS runs) without loosening anything for a genuine future cross-section composition case, which would still show role `CROSS_REFERENCE`/`DERIVATION_INPUT` and still gate.

---

## Part 2 — MATERIAL_CONTRACTS · MATERIAL_CONTRACT_BUCKET_UNCORROBORATED (66)

### Where raised, quoted

`candidate-resolution.js`, `materialContractGroundingFailure(claim)` (line 4757-4824):

```js
// line 4760-4765
const bucketCode = attributes.bucket_code;
if (!MATERIAL_CONTRACT_BUCKET_KINDS.includes(bucketCode)) return 'MATERIAL_CONTRACT_BUCKET_UNSUPPORTED';
const meta = MATERIAL_CONTRACT_BUCKET_META[bucketCode];
if (!meta || !(meta.synonyms || []).some((pattern) => pattern.test(quote))) {
  return 'MATERIAL_CONTRACT_BUCKET_UNCORROBORATED';
}
```

The vocabulary IS fully wired end-to-end, as the brief flagged: `material-contracts-producer-prompt.js` derives the model's controlled `bucket_code` vocabulary directly from `MATERIAL_CONTRACT_BUCKET_CODES` (`lib/taxonomy.js`, itself `metaToDict(MATERIAL_CONTRACT_BUCKET_META)`) — the model chooses from exactly the same code set the resolver checks against. So every one of the 66 is a case where the model picked a **valid, in-vocabulary bucket code**, and the resolver's own regex synonym list for that bucket failed to match the model's own quote.

### First finding: the 66 is inflated 2x by construction, not by the failure itself

Every `material_contract_criteria` entry the producer emits is shaped into **two separate proposal claims** sharing the same `bucket_code` and quote: `NATIVE_MATERIAL_CONTRACT_BUCKET_CANDIDATE` and `NATIVE_MATERIAL_CONTRACT_THRESHOLD_CANDIDATE`. `materialContractGroundingFailure` runs the bucket-synonym check first regardless of which claim kind is being resolved, so one synonym miss produces two identical open-world rows. Verified directly against `resolution.json` for all 6 runs (concho, metsera, modiv, redhat, skywater, topbuild): **66 rows = 33 distinct criteria × 2.** Bucket distribution across the 33: AGGREGATE_PAYMENTS (5), IP_LICENSES_OUT/IN (4 each), SUPPLY (5), MA_AGREEMENTS (3), AFFILIATE_TRANSACTIONS (3), GOVERNMENT_CONTRACTS (2), SETTLEMENT (2), COLLABORATION, ROFR_ROFN, DISTRIBUTION, MA_ONGOING_OBLIGATIONS, EMPLOYEE_LOANS (1 each).

### Second finding: real quote text, checked against real regexes — genuine drafting-variation misses, not wrong bucket choices

Sampled and manually checked all 13 buckets' quotes against their own `MATERIAL_CONTRACT_BUCKET_META` synonym patterns in `lib/taxonomy.js`. Every miss traces to a synonym list that encodes one drafting convention and misses a legitimate variant — the "one drafter's habit" species named in the brief, at real scale here:

- **MA_AGREEMENTS** (3 criteria): regex requires `acquisition|merger|divestiture` within 30 chars of `agreement|transaction`. Real quotes describe M&A buckets as *"the pending acquisition or sale of ... assets"* / *"acquisition or disposition of ... interest[s]"* — SEC-Item-601-style drafting that never uses the word "agreement" or "transaction" near "acquisition" at all (the noun is already "Contract"). Zero of 3 real quotes carry either tail word.
- **SUPPLY** (5 of them): regex requires the bigram `supplier contracts?` or `supply agreement`. Real quotes say *"suppliers of goods, services and personnel"*, *"is with any Top Supplier"* — "supplier" present, "contracts" never adjacent to it.
- **GOVERNMENT_CONTRACTS** (2): regex requires `government(al) contract|federal contract|gwac`. Real quotes say *"each Contract with any Governmental Entity"* — the counterparty is a Governmental Entity; the phrase "government contract" never appears.
- **AFFILIATE_TRANSACTIONS** (3): regex requires `affiliate transaction|related-party|interested party transaction`. Real quotes cite *"Item 404 of Regulation S-K"* — the authoritative SEC citation for exactly this concept — without ever using the English words "affiliate" or "related party".
- **ROFR_ROFN**, **COLLABORATION**, **DISTRIBUTION**, **MA_ONGOING_OBLIGATIONS**: same shape — real phrase present in spirit ("rights of first or last offer, negotiation or refusal"; "joint development agreement...farmout, farmin"; "distribution of any Company Product"; "deferred or contingent purchase price obligations") but the exact bigram/adjacency the regex demands isn't.
- **IP_LICENSES_IN / IP_LICENSES_OUT** (4 each): both buckets' regexes require a direction word (`from/in` vs `to/out`) next to "licens-". Several real quotes are genuinely bidirectional — *"grants or receives from or to any third party any material license"* — and fail both directional patterns simultaneously since neither direction is textually anchored. This one is closer to a taxonomy gap than a drafting-variation miss: the IN/OUT split doesn't have a synonym for a single bidirectional grant clause.

**One confirmed instance of the audit's other recurring pattern** (corroborating detail outside the claim's own quote): the SETTLEMENT bucket's `"...pay consideration valued at more than $250,000 in the aggregate..."` quote (skywater §3.20) is sub-clause (B) of item (vi), whose own chapeau — *"provides for, relates to or constitutes **the settlement or other resolution** of any action..."* — carries the word "settlement" that corroborates the bucket. Verified directly against `tests/fixtures/canonical-v2/skywater-first-live-run/skywater-raw-fetched.htm`: the anchor word sits in the parent clause, one sub-item away from the narrowed quote the model (correctly, per its own "smallest contiguous clause" instruction) returned.

### Fix

**RESOLVER_SIDE / TAXONOMY_DESIGN** (regex-only change, no re-extraction, no digest invalidation): `lib/taxonomy.js`, `MATERIAL_CONTRACT_BUCKET_META`. Widen synonym lists using the same `[^.]{0,N}` same-sentence-co-occurrence technique the file's own comments show was already used to fix AGGREGATE_PAYMENTS/MA_AGREEMENTS/SETTLEMENT/REAL_ESTATE/NONCOMPETE against Modiv real drafting (PLAN.md Step 3G) — extend that same treatment to SUPPLY, GOVERNMENT_CONTRACTS, AFFILIATE_TRANSACTIONS (add an `Item\s+404` SEC-citation pattern, mirroring the SEC_ITEM_601 bucket's own `/item\s+601/i`), COLLABORATION, DISTRIBUTION, MA_ONGOING_OBLIGATIONS, ROFR_ROFN. For IP_LICENSES_IN/OUT specifically, add a bidirectional-grant pattern to both buckets' synonym lists (real drafting doesn't always pick a side). Expected recovery: up to 30 of 33 criteria (60 of 66 rows) on the drafting-variation evidence above; the SETTLEMENT sub-clause instance needs the "corroborate against the parent clause, not just the claim's own quote" mechanism the wider audit already recommends elsewhere — same fix class, shared across families, not specific to this bucket.

---

## Part 3 — MATERIAL_CONTRACTS · MATERIAL_CONTRACT_DEFINITION_REFERENCE_UNRESOLVED (15)

### Where raised, quoted

Same function, immediately after the bucket-synonym check passes:

```js
// line 4766-4769
if (Array.isArray(attributes.definition_cross_references)
  && attributes.definition_cross_references.length) {
  return 'MATERIAL_CONTRACT_DEFINITION_REFERENCE_UNRESOLVED';
}
```

Because this check runs strictly after the bucket-corroboration check and only on claims that already passed it, **every one of these 15 already has an independently-corroborated bucket.** Confirmed directly against `resolution.json`: 15 = 7 distinct criteria (concho ×2, modiv ×3, redhat ×1, skywater ×1) × ~2 for the bucket/threshold pairing (one is a singleton — metsera's criterion has no paired threshold candidate in this bucket, unexplained but immaterial to the diagnosis).

Two content shapes, both blocked identically:
- **External regulatory reference** (concho, metsera, redhat — 3 of 7 criteria): *`"material contract" (as such term is defined in Item 601(b)(10) of Regulation S-K)`*. `attributes.bucket_code = SEC_ITEM_601`, already matched by its own synonym `/item\s+601/i` — meaning the very citation to the SEC's own authoritative definition of "material contract" is being treated as a corroboration *failure* rather than the strongest possible corroboration available.
- **Internal agreement-defined term** (modiv, skywater — 4 of 7 criteria): *"Company Related Party Transaction"*, *"Company Space Lease, Ground Lease or Company Lease"*, *"Lease Agreement"*, an LLC/partnership/JV-agreement clause — each already bucket-corroborated (AFFILIATE_TRANSACTIONS, REAL_ESTATE) by its own quote text; the flag exists purely because the term's *precise* meaning depends on a definition elsewhere in the same agreement.

This matches the sibling-pass finding exactly, confirmed here at the code level: `definition_cross_references` is populated correctly by the producer (per its own prompt: *"List a defined term ... only when its unresolved meaning can change the selected bucket or threshold"*) and then used **only as a negative hold-trigger** — there is no lookup against KEY_DEFINED_TERMS' own resolved definitions anywhere in this function or file.

### Fix

**TAXONOMY_DESIGN** (needs a cross-family lookup that doesn't exist yet, not just a resolver tweak): for the SEC_ITEM_601 case specifically, a **RESOLVER_SIDE** carve-out is cheap and safe today — when `bucket_code === 'SEC_ITEM_601'` and the sole cross-reference is the Item-601(b)(10)/Regulation-S-K citation itself, that citation IS the bucket's own definition, not an unresolved external dependency; skip the hold. That alone recovers 3 of 7 criteria (6 of 15 rows) with no new machinery. The remaining internal-defined-term cases (4 of 7) are the real cross-provision composition problem the brief is centrally concerned with — the fix is the same one Part 1 shows is *already structurally supported* for KEY_DEFINED_TERMS' own head/limb split: extend that machinery to look up a MATERIAL_CONTRACTS claim's `definition_cross_references` against KEY_DEFINED_TERMS' resolved claims for the same deal, when available, and attach the resolved definition as a second, role-typed (`CROSS_REFERENCE`) evidence edge rather than refusing. This is genuinely new design work, not a mechanical change — hence TAXONOMY_DESIGN, not RESOLVER_SIDE, for this half.

---

## Part 4 — sweep of remaining KEY_DEFINED_TERMS / MATERIAL_CONTRACTS UNDIAGNOSED rows

Every KEY_DEFINED_TERMS/MATERIAL_CONTRACTS row in `undiagnosed.md`/`unresolved-register.json` is accounted for below. (MATERIAL_CONTRACTS has no further rows beyond Parts 2-3 — confirmed by grepping the full 90-row table.)

| Row | Reason | Count | State | Where | Diagnosis | Fix class |
|---|---|---|---|---|---|---|
| #24 | `DEFINED_TERM_REF_NOT_IN_HEAD` | 7 | HELD | `candidate-resolution.js:8773`, `handleDefinedTermCandidate` | `if (!term \|\| !head.includes(term))`. `term = attrs[map[2]]` (the kind-specific term-ref attribute, e.g. `host_term_ref` for THRESHOLD_SUBSTITUTION). Representative quote (#3441, a THRESHOLD_SUBSTITUTION clause) is itself just the substitution grammar; its `host_term_ref` names the definition it modifies, which the model did not restate inside this same `definition_head_quote`. Correctly HELD (fail-closed on a real attribute-verbatim gap), not a wrong resolution — needs producer-prompt guidance to keep `host_term_ref` and `definition_head_quote` consistent. | PROMPT_CHANGE |
| #62 | `STANDARD_CODE_OUT_OF_ENUM` | 2 | HELD | `candidate-resolution.js:8785` | `attrs.standard_code` (or `knowledge_party` for KNOWLEDGE_STANDARD) not in the controlled enum. Quote: *"the actual knowledge of"* — a fragment; the actual standard_code the model assigned is what's out-of-enum, unverifiable from the quote alone without the raw response. Correctly HELD. | Uncertain — would need the raw `native-producer-recorded-response` to see the offending code value; not investigated further given the 2-occurrence volume. |
| #63 | `NO_PERCENT_LITERAL` | 2 | HELD | `defined-term-threshold-parse.js:49`, via `parsePercentThreshold` | Traced to source (skywater raw doc): quote is *"the Company's and its Subsidiaries' consolidated assets"* — the real clause states the Superior-Proposal asset threshold qualitatively (*"a significant portion of the consolidated assets"*), never as a percent. `ACQ_THRESHOLD`/`SUPERIOR_THRESHOLD` assume a literal percent; this drafting convention has none. Correctly ABSTAIN — no percent exists to parse. The real gap is upstream: this clause should route to `open_world_candidates` per the prompt's own instruction, not be tagged as a THRESHOLD kind at all. | PROMPT_CHANGE |
| #64 | `RECORDED_DEFINITION_ENVELOPE_UNCORROBORATED` | 2 | HELD | `candidate-resolution.js:8736`, `recordedReview` inside the `RECORDED_DEFINITION` branch | Fires when `envelope.definition_body_quote !== quote` or the envelope/term identity checks fail (line 8727-8735) — a byte-exact structural mismatch between the producer's `definition_envelope` object and its own claim `raw_value`. Correctly HELD; a producer-side internal-consistency defect, not a resolver gap. | PROMPT_CHANGE |
| #65 | `MULTIPLE_PERCENT_LITERALS` | 2 | HELD | `defined-term-threshold-parse.js:52` | `if (tokens.length > 1) return abstain(...)` aborts on ANY second percent token, even when both are identical. Representative quote (topbuild): *"more than 80% of the outstanding Company Shares or more than 80% of the assets"* — the SAME 80% threshold stated twice (equity test and asset test), zero ambiguity about which value governs. Concrete, cheap bug: the guard should tolerate multiple tokens when all values match, and only abstain on genuinely different values. | **RESOLVER_SIDE** — `defined-term-threshold-parse.js:parsePercentThreshold`, dedupe by value before the length check. |
| #88 | `SUBSTITUTION_UNCORROBORATED` | 1 | HELD | `candidate-resolution.js:8779`, THRESHOLD_SUBSTITUTION branch, via `parseThresholdSubstitution` | Quote (skechers): *"all references to '15%' ... will be deemed to be references to '50%'"* embedded inside a longer sentence about a DIFFERENT term ("Acquisition Proposal") than the one whose definition it's substituting into ("Acquisition Transaction") — `parseThresholdSubstitution`'s pattern-matching found the percent pair but `attrs.substituted_term_ref`/`quote.includes(...)` cross-check at line 8779 failed on the term mismatch. Correctly HELD — single occurrence, not investigated further at this volume. | Uncertain, low volume. |

**Coverage check:** 76 + 76 + 66 + 15 + 7 + 2 + 2 + 2 + 2 + 1 = **249** occurrences across every KEY_DEFINED_TERMS/MATERIAL_CONTRACTS row in the 90-row undiagnosed table (KEY_DEFINED_TERMS: rows #2,3,24,62-65,88 = 168; MATERIAL_CONTRACTS: rows #4,11 = 81). Every row belonging to these two families in `undiagnosed.md` is addressed above — none skipped.

