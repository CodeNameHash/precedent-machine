# Family — Consideration / exchange mechanics (CONS-*)

**Date:** 2026-08-02. **Status:** AUDIT-AMENDED — adversarial audit applied
(0 CRITICAL, 4 MATERIAL, 5 MINOR findings fixed; 0 parked for Fable); per
program convention (spec-detail → audit → build → review), ready for build.
**Parent:** `2026-08-02-openworld-promotion-program.md` (five-layer promotion
structure and cross-slice invariants apply verbatim).
**Template:** `2026-08-02-p1-captable-numerics-design.md` (slice shape,
typed-abstain parsers, corroboration tables, coverage-map anchored-overlap +
honesty pins); wave-one folded exemplars
`2026-08-02-family-termination-fee-design.md` and
`2026-08-02-family-termination-rights-design.md`. This spec dispatches
through the **producer-prompt-registry seam the termination-rights spec
defines (its section 3)** — a new registry entry, never a capitalisation
fallback, never a second dispatch mechanism.
**Lexicon authority:** `2026-08-02-lexical-disagreement-net-design.md`
(word boundaries, case-sensitive defined terms, deletion asymmetry, priced
blind spots; this family ships its lexicon additions in the same slice).
**Protocol authority:** docs/codex-program/EXECUTION-LEDGER.md — M3 review
protocol + extraction semantics rules 1–3. This spec may not amend them.
**Materiality:** existing rank 60 tier `CONSIDERATION`
(`candidate-resolution.js` ~454, `concept_key_prefixes: ['CONS-']`). This
slice adds NO materiality tier and NO override entries; a test pins rank 60.
The M3 queue ordering already places consideration and closing conditions
ahead of notices and administrative clauses (EXECUTION-LEDGER, Ben review
clause); the specific 60-vs-70 ordering between consideration and closing
conditions themselves comes from `MATERIALITY_TABLE`
(`candidate-resolution.js` ~454 vs ~455), not from the ledger.

## Corpus grounding (production Supabase, project `tzulhdasmioeechxapdy`;
evidence pack read 2026-08-02 — pack quotes are ground truth, cited by
provision_card id; three additional SELECT-only receipts run 2026-08-02 by
this spec's author are marked [RECEIPT])

v1 `provision_cards` with `provision_type = 'CONSIDERATION'`: 196 cards.
Subtypes (cards/deals): CONSID-EXCHANGE 62/33, CONSID-CONVERT 44/35,
CONSID-EQUITY 28/27, CONSID-WITHHOLD 22/22, null 14/6, CONSID-ADJUST 13/13,
CONSID-DISSENT 13/13. The rubric's Stage-2 codes CONSID-CVR, CONSID-COLLAR,
CONSID-TICKING, CONSID-EXCHANGE-RATIO and CONSID-WALKAWAY have **zero cards
under those subtype labels among `provision_type='CONSIDERATION'` cards**
(scoped claim — see correction below) — CVR/collar/election language lives
inside CONSID-CONVERT/CONSID-EXCHANGE cards (the Pfizer/Metsera CVR clause
is a CONSID-CONVERT card). Outside that type scope, production carries
three cards with `provision_subtype='CONSID-EXCHANGE-RATIO'` under
`provision_type='DEFINITION'`: Bridge Investment, card `f3091961…`
("Class A/Class B Exchange Ratio"), Modiv, card `8b4adafd…` (""Exchange
Ratio" means 1.975."), and Mr. Cooper, card `1e993185…`. The Modiv
DEFINITION card is exactly the pointer-form literal the `NO_RATIO_LITERAL`
abstain path (section 2b) is priced against, and the Bridge Investment card
is the corpus's real two-class ratio shape (see Test 5 below); both are
prior art for a future definitions-article cross-reference/relationship
slice, not evidence that ratio-labeled text is absent from the corpus. The
14 null-subtype cards are classification-pending pipeline stubs
(`short_title` prefixed "Unclassified — …" / "[PROPOSED] …"), filtered out
of every subtype-keyed pass, never treated as an eighth subtype.

Grounding quotes this spec builds on (every corroboration pattern, parser
grammar and lexicon entry below traces to one of these; nothing is
fabricated):

- Per-share cash, single-figure — M.D.C. Holdings/SH Residential, card
  `0ac02d19-c9b4-479e-b3f2-37df08b4afc5` §2.1: "each Share issued and
  outstanding immediately prior to the Effective Time … shall be converted
  automatically into the right to receive $63.00 per Share in cash, without
  interest (the "Merger Consideration")"; Prometheus/Merck, card
  `364a6072-80a9-449b-abdc-2e47c16e76b1` §2.7: "converted into the right to
  receive cash in an amount equal to $200.00 (the "Merger Consideration"),
  without interest"; Endeavor/Wildcat, card
  `b42f8447-ae34-4b69-aa21-391bc002d5aa` §3.01: "the right to receive $27.50
  in cash per Share, without interest (the "Company Merger Consideration")".
- Cash + CVR — Pfizer/Metsera, card
  `b0d49cea-2a4a-4d39-8825-6552b7187d3a` §2.01: "the right to receive
  (i) $47.50 in cash, without interest (the "Closing Amount"), plus (ii) one
  (1) contractual contingent value right per share … representing the right
  to receive the Milestone Payments as set forth in the CVR Agreement".
- Mixed cash+stock, decimal ratio, ONE compound sentence — [RECEIPT]
  Anadarko/Chevron, card `67c7b10e-1ed8-47b2-a101-bafdedbaf083` §1.4:
  "(x) $16.25 in cash, without interest (the "Per Share Cash Amount") and
  (y) 0.3869 of a share of validly issued, fully paid and non-assessable
  shares of Parent Common Stock (the "Exchange Ratio")." Also mixed
  cash+stock — Cooper Tire/Goodyear, card
  `c90905ab-a91d-4b3f-bcb8-ce2692efc70f` §2.1: "(i) $41.75 in cash, without
  interest, payable to the holder of each Share (the "Per Share Cash
  Consideration") and (ii) 0.907 of a share of validly issued…" — a second
  corpus mixed-deal decimal ratio (0.907); the earlier characterization of
  Cooper as an all-cash "per-share cash, single-figure" deal was a
  misleadingly truncated quote and is corrected here.
- All-stock, decimal ratio with defined term — [RECEIPT] Redfin/Rocket,
  card `b0051668-f7e2-4556-9713-78f2ef517572` §1.5: "shall be automatically
  converted into the right to receive 0.7926 shares of Parent Stock (the
  "Exchange Ratio") and the cash payable in lieu of fractional shares
  pursuant to Section 1.6 (collectively, the "Merger Consideration")".
- All-stock, ratio spelled as a WORD — Starwood/Marriott, card
  `15688f09-3c19-4fdc-8470-02e4f44f2bfa` §2.1: "converted into the right to
  receive one (the "Starwood Merger Exchange Ratio") fully paid and
  nonassessable share of Holdco Common Stock".
- Ratio as defined-term POINTER, no literal — [RECEIPT] SkyWater/IonQ,
  card `c77d0655-b888-4679-8263-f487d75bb56e` §1.4: "equal to $15.00 (the
  "Per Share Cash Consideration") and (2) such number of validly issued,
  fully paid and nonassessable shares of Parent Common Stock equal to the
  Exchange Ratio (the "Per Share Stock Consideration" …)".
- Election-gated per-share values (three dollar figures coexisting) —
  Skechers/3G, card `b258d66b-3fc1-44b3-94ee-ab33e971061a` §2.7: "(i) each
  share … with respect to which an election to receive only cash (a "Cash
  Election") … the right to receive cash in an amount equal to $63.00,
  without interest thereon (the "Cash Election Consideration"); (ii) …
  (1) an amount in cash equal to $57.00 (the "Mixed Election Cash
  Consideration") and (2) one Parent Unit"; proration formula, card
  `4212b798-5ed8-4b09-8742-755f2fa3e3e5` §2.9: "a fraction, the numerator of
  which is the Maximum Equity Election Cap and the denominator of which is
  the aggregate number of Mixed Election Shares" — a live algebraic fraction
  with NO literal numbers in the clause.
- Appraisal, standard DGCL — Superior Industries, card
  `4bf075bd-f8df-4eed-9b5a-b44597009cb7` §3.3: "any Dissenting Stockholder
  shall be entitled to receive only those rights provided by Section 262 of
  the DGCL". Appraisal, NEGATED (quoted PRESENT text with negative
  content) — Concho/ConocoPhillips, card
  `a8d7760a-3d7d-404e-a9bb-97b9130829e2` §3.4: "In accordance with the DGCL,
  no appraisal rights shall be available with respect to the Transactions.";
  Forest City, card `265ab7d4-a22f-4a95-adc9-82f44e8ede36` §4.5: "No
  dissenters' or appraisal rights will be available with respect to the
  Merger and the other Transactions, including any remedy under Sections
  3-201 et seq. of the MGCL."; Modiv, card
  `16e1358e-a1fb-4234-bb5e-fc121bafdac9` §2.6: "No dissenters' or appraisal
  rights shall be available with respect to the Mergers." Cayman variant —
  Theravance/Zymeworks, card `50946e9a-cb8d-4502-bfcd-0dc1154a7499` §2.4:
  "prompt notice of any written notice of exercise of Dissenter Rights …
  pursuant to Section 238 of the Cayman Companies Act".
- Par-value NOISE inside conversion clauses (the tokens a per-share parser
  must never capture): "par value $0.01 per share", "par value $0.001 per
  share", "par value $0.00001 per share" — boilerplate describing Merger
  Sub/Company stock inside CONSID-CONVERT quotes (pack §5; Starwood card
  `15688f09…` and [RECEIPT] Concho card
  `d542131e-5b89-4dec-b8f6-c8d66f70f873` §3.1 both carry "par value $0.01
  per share" adjacent to conversion text).
- Merger-Sub internal conversion (looks like a ratio, is NOT merger
  consideration) — [RECEIPT] Concho card `d542131e…` §3.1: "shall be
  converted into and shall represent one fully paid and nonassessable share
  of common stock, par value $0.01 per share, of the Surviving Corporation".

## Grounding corrections (verified against repo + production, 2026-08-02)

The family brief and v1 vocabulary contain four traps; building against any
of them is the plausible-but-wrong failure this programme exists to prevent:

1. **v1 `CONSID-*` keys do NOT prefix-match the materiality tier.** The
   resolver's rank-60 tier is `concept_key_prefixes: ['CONS-']`
   (`candidate-resolution.js` ~454). A v2 concept minted as `CONSID-…`
   fails the `CONS-` prefix match (the hyphen matters), silently ranks
   UNCLASSIFIED 99, and sorts consideration reviews BELOW notices —
   inverting the M3 queue for the family the ledger names explicitly.
   All v2 concepts in this family are therefore minted under `CONS-`;
   the v1↔v2 name difference is recorded for the FAMILY_MAPPING_TABLE
   edit (out of scope, Fable+Ben).
2. **Five rubric codes are dormant vocabulary within `CONSIDERATION`.**
   CONSID-CVR / -COLLAR / -TICKING / -EXCHANGE-RATIO / -WALKAWAY exist in
   `lib/rubric.js` with zero cards under `provision_type='CONSIDERATION'`.
   No v2 concept is minted for any of them this slice; their content
   (where it exists at all within CONSIDERATION) lives inside
   CONSID-CONVERT/-EXCHANGE text and stays open world. A design that
   filters on those subtypes WITHIN CONSIDERATION finds nothing — pinned
   so no downstream consumer assumes otherwise. This does not extend to
   `provision_type='DEFINITION'`: three DEFINITION cards carry
   `provision_subtype='CONSID-EXCHANGE-RATIO'` (Bridge Investment
   `f3091961…`, Modiv `8b4adafd…`, Mr. Cooper `1e993185…` — see Corpus
   grounding above), out of scope for this slice's CONSIDERATION-typed
   producer but relevant prior art for any future definitions-article
   slice.
3. **The four family DB tables are not the promotion target.**
   `consideration_treatments` (125 rows) and `consideration_equity_provisions`
   (35 rows) are populated and are read by the v1 serving path
   (`lib/parser-v2/store.js` writes them; `pages/api/provisions.js` ~50–65
   hydrates and serves them) — they are NOT unused, and this correction
   supersedes any earlier "unused" characterization to head off a future
   "drop the unused tables" cleanup against a live v1 serving table.
   `election_mechanisms` and `proration_rules` are genuinely empty (0 rows
   each; `election_mechanisms.provision_id` does not even FK to
   `provision_cards`). Regardless of which of the four are populated, none
   is the promotion target: the promotion is the five-layer code path
   (prompt → provider → registry → resolver → fixtures); this slice writes
   NOTHING to any of the four tables and takes no schema dependency on any
   of them.
4. **The ratio-type lint fingerprint governs output discipline here.**
   `scripts/lint/forbidden-patterns.sh` globalPatterns carries a
   bug-fingerprint for a duplicated exchange-ratio-type label row (the
   pattern at line 24 — the same label emitted twice, once per enum value,
   a past regression on the review surface). Two consequences, pinned:
   (a) no fixture or code in this slice may emit ratio-type label text in
   that duplicated shape outside the reviewed exemption routes
   (`RECORDED_LIVE_RUN_DIR` exempts verbatim SEC prose only — this label
   is UI text, so there is no legitimate collision); (b) more deeply, this
   slice does NOT promote a fixed-vs-floating ratio-type value AT ALL —
   see the registry ruling below.

## Deliverable (honest conversion semantics)

**No recorded native-producer runs exist over consideration sections** —
the producer today extracts capitalisation (and, per the wave-one specs
once built, termination) sections only. There is nothing to "convert": no
open-world fixture rows, no closure_ids to track. The deliverable is the
five-layer capability plus the pre-rerun harness:

1. Registry entries, resolver wiring, two value parsers, prompt module,
   provider key and lexicon entries land fully tested against a COVERAGE
   MAP of synthetic compiled candidates pinned to the REAL corpus quotes
   above, committed as fixture bytes with provenance (deal,
   provision_card id, retrieval date) — the P1 anchored-overlap rule
   applies: hand-enumerated split sub-quotes must be contiguous substrings
   of the committed canonical text and overlap the parent fixture quote at
   least on the full value token.
2. "The pipeline natively extracts consideration mechanics" may be claimed
   ONLY after dated post-merge live rerun handoffs (subscription CLI, one
   documented run per fixture deal). The P1 audit M-5 pins apply verbatim:
   no report before those handoffs may state family conversion, coverage
   or recall. Until then the honest claim is "the machinery exists and is
   proven on committed fixtures".

## 1. Registry (`contract-bundle.js` → next frozen input version)

Strictly additive spread of the head version at build time (V14 today; the
wave-one siblings each bind "V15" — frozen input versions are allocated at
build time in merge order, so every superset-diff acceptance test below is
written against CONTENT (sorted key sets), never the numeral. The
closing-conditions spec pins the same convention.)

**Concepts.** NO consideration concept is registered today (the
EXPECTED_CONCEPT_KEYS lists carry no `CONS-` key). Three new concepts,
version 1, `{concept_key, version}` shape only (the fixture-shape validator
at ~3255 rejects anything else), each FLAGGED FOR BEN in the PR body under
the 2026-07-23 concept-amendment convention — concept-key additions are
taxonomy decisions and this spec proposes rather than settles them:

- `CONS-PERSHARE` — per-share cash consideration payable on conversion.
  Grounded in 8 quoted deals above; the family's headline numeric.
- `CONS-RATIO` — stock exchange ratio (shares of acquirer stock per target
  share). Grounded: Anadarko `0.3869`, Cooper Tire `0.907`, Redfin
  `0.7926`, Starwood "one".
- `CONS-DISSENT` — dissenters'/appraisal-rights status for the
  transaction. Grounded in both variants (availability and quoted
  no-availability) across DGCL, MGCL and Cayman drafting.

NOT minted: concepts for CONSID-EXCHANGE (payment mechanics — exchange
agent/fund plumbing, no market-statistic value this slice),
CONSID-WITHHOLD (near-boilerplate; a withholding boolean is not worth a
rank-60 claim), CONSID-ADJUST (anti-dilution machinery — conditional
adjustment prose, no quote-local value), CONSID-EQUITY (see Out of scope —
the multi-regime treatment shapes are a rule-3 forcing trap), and the five
dormant Stage-2 codes (Grounding correction 2).

**Claim definitions** (three):

```
PER_SHARE_CASH_CONSIDERATION_CLAIM_DEFINITION_V1
  claim_definition_key: 'PER_SHARE_CASH_CONSIDERATION'
  version: 1
  canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING'   // existing type
  canonical_value_required_when_present: true

EXCHANGE_RATIO_VALUE_CLAIM_DEFINITION_V1
  claim_definition_key: 'EXCHANGE_RATIO_VALUE'
  version: 1
  canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING'
  canonical_value_required_when_present: true

APPRAISAL_RIGHTS_STATUS_CLAIM_DEFINITION_V1
  claim_definition_key: 'APPRAISAL_RIGHTS_STATUS'
  version: 1
  allowed_canonical_values: ['AVAILABLE', 'NOT_AVAILABLE']  // enum,
  canonical_value_required_when_present: true               // registry-hosted
```

No new canonical value types; no validator changes. The three definitions
grow the expected-claim-keys row (sorted superset, prior rows untouched
byte-for-byte, superset-diff tested — the TERMR audit m-4 convention).

**Three registry rulings, pinned as legal rulings:**

- **`NOT_AVAILABLE` is a quoted PRESENT claim, never a derived negative.**
  "No appraisal rights shall be available" (Concho), "No dissenters' or
  appraisal rights will be available" (Forest City/Modiv) are positive
  sentences the producer quotes byte-verifiably — the P1 zero-count / P3
  C2 precedent, and the exact "no legend/no restriction"-style drafting
  the ledger conventions require to be handled as quoted PRESENT claims
  only. A deal whose agreement is merely SILENT on appraisal never yields
  a NOT_AVAILABLE claim from the producer (M3 rule 1); silence stays with
  the future scope-closure machinery, forever.
- **Fixed-vs-floating ratio TYPE is NOT promoted.** VWAP/averaging text
  does exist in family cards — the Starwood fixture card `15688f09…`
  itself carries "the average of the volume weighted average price per
  share of Marriott Common Stock … five consecutive trading days" (the
  Marriott Per Share Fair Market Value), and CONSID-EXCHANGE cards for
  Cooper (`1c18a239…`), Concho (`5e9b9559…`) and Covance (`c8a9e4dd…`)
  carry VWAP pricing — but exclusively in fractional-share cash-out and
  valuation contexts, never applying a pricing period to the exchange
  ratio itself. No quote in the pack or in this spec's own receipts grounds
  a FLOATING exchange ratio, so a FLOATING corroboration pattern still
  cannot be grounded; and FIXED cannot be corroborated at all, because
  "fixed" is established by the ABSENCE of
  adjustment machinery — an absence claim, barred by M3 rule 1 at the
  producer and unprovable quote-locally at the resolver. A ratio-type
  enum shipped now would either publish uncorroborated labels or derive
  negatives; both are the corruption this family's own lint fingerprint
  (Grounding correction 4) memorializes. Ratio type stays with the
  (future) scope-closure/derived-classification machinery; any producer
  assertion of a type token routes open world, typed.
- **Election and proration mechanics are NOT flattened into attributes.**
  The Skechers proration rule is defined-term algebra with zero literal
  numbers; the election deadline is a relative day count anchored to an
  anticipated closing. Forcing either into this slice's claims would be
  rule-3 nearest-fit forcing. Election-gated CASH VALUES are still
  captured — as separate `PER_SHARE_CASH_CONSIDERATION` claims
  distinguished by `consideration_term_ref` (below); the election
  machinery itself stays open world, feeding the commonality report.

**Governed attributes (never in keys; all participate in claim
identity/closure so two same-section values never collide or dedupe):**

- `PER_SHARE_CASH_CONSIDERATION`: `consideration_term_ref` — the verbatim
  defined-term phrase naming the payment ("Merger Consideration", "Company
  Merger Consideration", "Closing Amount", "Per Share Cash Amount",
  "Per Share Cash Consideration", "Cash Election Consideration",
  "Mixed Election Cash Consideration" — all seven observed verbatim in the
  grounding quotes). REQUIRED, enforced as a verbatim substring of the
  byte-verified quote (P1 M-3 discipline); failure → review, typed
  `CONSIDERATION_TERM_NOT_IN_QUOTE`; an amount with no identifiable
  consideration term → review, typed `CONSIDERATION_TERM_UNIDENTIFIED`,
  never resolves. This gate is what stops a withholding amount, an
  exchange-fund figure or a par value publishing as the deal price — and
  it is what keeps Skechers' $63.00 and $57.00 as distinct, non-colliding,
  correctly-labeled claims. Cross-deal normalization of the term spellings
  is a Ben adjudication over observed values later (the share_class_ref
  precedent, verbatim). `currency`: fixed `'USD'` this slice, stamped by
  the parser only when the literal is `$`-prefixed; never
  producer-asserted.
- `EXCHANGE_RATIO_VALUE`: `ratio_term_ref` — verbatim defined-term phrase
  ("Exchange Ratio", "Starwood Merger Exchange Ratio"). REQUIRED,
  verbatim-substring-enforced, typed `RATIO_TERM_NOT_IN_QUOTE` /
  `RATIO_TERM_UNIDENTIFIED`. This is the gate that stops the Merger-Sub
  internal conversion ("one … share of common stock … of the Surviving
  Corporation", Concho §3.1 — a real corpus shape) from minting a ratio
  claim: that sentence carries no ratio defined term. `issuer_stock_ref` —
  verbatim phrase for the stock being issued ("Parent Common Stock",
  "Parent Stock", "Holdco Common Stock"). REQUIRED, verbatim-enforced,
  typed `ISSUER_STOCK_REF_NOT_IN_QUOTE`; a ratio with no identifiable
  issuing stock is not a market data point.
- `APPRAISAL_RIGHTS_STATUS`: `statute_ref` — OPTIONAL verbatim citation
  phrase ("Section 262 of the DGCL", "Sections 3-201 et seq. of the MGCL",
  "Section 238 of the Cayman Companies Act"). When supplied it is
  verbatim-substring-enforced (typed `STATUTE_REF_NOT_IN_QUOTE`); it is
  optional because the Modiv no-availability quote cites no statute at
  all. Jurisdiction is NOT an enum this slice — the corpus shows the
  defined terms themselves change per jurisdiction ("Dissenting Shares" /
  "Dissenter Rights"), and a jurisdiction vocabulary is a Ben adjudication
  over observed statute_ref values later.

## 2. Value parsers (two pure modules, `measurement-date-parse.js` contract
shape: typed `{outcome:'RESOLVED', …}` / `{outcome:'ABSTAIN', reason}` —
never a throw on prose, never arithmetic, never repair)

**The P1 inversion, handled explicitly (this family's defining numeric
discipline).** P1's share-count tokenizer EXCLUDED currency-prefixed
literals because dollars were noise around share counts. In this family
currency values ARE the value — so the exclusion class inverts, in both
directions, and the two parsers are exact complements:

- the per-share parser counts ONLY currency-prefixed literals and ignores
  every bare numeral;
- the ratio parser counts ONLY bare decimal literals and EXCLUDES every
  currency-prefixed literal.

The payoff is pinned as a design property: the corpus's dominant
mixed-consideration drafting (Anadarko §1.4 — "$16.25 in cash … and (y)
0.3869 of a share …") is ONE compound sentence, yet each parser sees
exactly one surviving candidate in it ($16.25 for cash; 0.3869 for the
ratio). A byte-identical quote can therefore ground BOTH claims without
the producer inventing sub-sentence splits — unlike the two-cash-leg
election drafting (Skechers), which still requires a per-limb split
because two `$` literals survive the cash parser.

### 2a. `per-share-cash-parse.js`

- Candidate token: `[$€£]` optionally followed by whitespace, then a
  maximal digit-comma-dot run (the TERMF `parseFeeAmount` grammar,
  inherited — including LTR-mark tolerance; matching runs against LITERAL
  committed fixture bytes, never retyped ASCII).
- **Pinned exclusions**, applied before counting:
  1. **Par-value spans — the family-specific exclusion class.** A currency
     literal inside a span matching the par-value grammar
     /par value \$\s*[\d.,]+ per share/i is excluded (grounded: "$0.01",
     "$0.001", "$0.00001" — pack §5 and the Concho/Starwood receipts; the
     variant with a comma'd class phrase, "preferred stock, par value
     $0.01 per share", is covered because the grammar anchors on
     "par value" and "per share", not on the class phrase).
  2. Section references, calendar dates, clock times — inherited from the
     P1 exclusion grammar (they classify bare numerals, which are already
     non-candidates here, but the inherited grammar also stops a
     pathological "$" adjacent to a date-shaped run from surviving).
- Exactly ONE surviving `$` literal with STRICT 3-digit grouping
  (`^\d{1,3}(,\d{3})*(\.\d+)?$` after `$`-strip) → RESOLVED. Canonical
  form: strip `$`, strip grouping commas, preserve any decimal AS-WRITTEN,
  no trailing-zero trimming (`'63.00'`, `'47.50'`, `'41.75'`, `'200.00'`,
  `'16.25'`) — must round-trip `canonicalValueAllowed`'s
  `NON_NEGATIVE_DECIMAL_STRING` regex; `currency: 'USD'`.
- Malformed grouping → ABSTAIN `MALFORMED_GROUPING` (no repair).
- `€`/`£` prefix → ABSTAIN `NON_USD_CURRENCY` (no FX, ever) → review.
- ≥2 surviving money literals → ABSTAIN `MULTIPLE_MONEY_LITERALS` (the
  Skechers §2.7 election quote: $63.00 + $57.00 are TWO claims; the
  producer splits per election limb; the parser never picks).
- Zero → ABSTAIN `NO_MONEY_LITERAL` (the Starwood all-stock conversion —
  the correct outcome: an all-stock deal HAS no per-share cash claim, and
  a producer that asserts one there queues rather than resolves).
- Spelled-out money → ABSTAIN `NON_LITERAL_MONEY`. Frozen detection
  grammar (detection-and-typing only, never a read): a spelled numeral
  (the same frozen word table one…ten used by the ratio parser, section
  2b) adjacent to /\bdollars?\b/ — e.g. "fifty dollars per Share" — types
  the abstain; outside that grammar a `$`-free clause simply yields zero
  candidates and ABSTAINs `NO_MONEY_LITERAL` instead, same as any other
  no-money quote.
- **NO zero-pattern table.** A genuine $0.00 per-share price is not
  corpus-attested. "Cancelled without consideration" / Excluded-Shares /
  Cancelled-Shares prose is share-treatment text, never a per-share zero —
  pinned so no implementer wires a zero shortcut; a producer asserting a
  zero routes through `NO_MONEY_LITERAL` review like anything else.
- Versioned `PER_SHARE_CASH_PARSE_VERSION`, threaded into the resolution
  receipt (P1 M-6 precedent).

### 2b. `exchange-ratio-parse.js`

- Candidate token: a bare decimal literal — digit run, single `.`, digit
  run (`^\d+\.\d{1,6}$` after extraction; the corpus attests 4-decimal
  ratios `0.3869`, `0.7926`; six places is headroom, not license — the
  bound exists so the static grammar stays finite, and any live form
  outside it ABSTAINs).
- **Pinned exclusions**, applied before counting:
  1. Currency-prefixed literals (the inversion: "$16.25" in the Anadarko
     compound quote and "$15.00" in SkyWater are excluded, and par values
     fall out with them since every corpus par value is `$`-prefixed);
  2. Section references, LTR-mark-tolerant (LOAD-BEARING here, not
     boilerplate: "pursuant to Section 1.6" in the committed Redfin bytes
     and "Sections 1.5(a)(i)" are decimal-shaped tokens that would
     otherwise survive as ratio candidates);
  3. Calendar dates, clock times, percentages (`\d+(\.\d+)?%`).
- Exactly ONE surviving decimal → RESOLVED. Canonical form: as-written,
  leading zero preserved, no trailing-zero trimming (`'0.3869'`,
  `'0.7926'`); round-trips `NON_NEGATIVE_DECIMAL_STRING`. The parser NEVER
  scales, inverts or interprets "of a share of" — "0.3869 of a share" and
  "0.7926 shares" both resolve the bare literal; the per-share semantics
  live in the claim definition, and the quote is the evidence.
- ≥2 survivors → ABSTAIN `MULTIPLE_RATIO_LITERALS` → review (a quote
  spanning two classes' ratios is two claims; the producer splits, the
  parser never picks).
- Zero survivors, with a spelled numeral (frozen word table one…ten —
  contradiction-and-detection only, the cure-period discipline: the table
  exists to TYPE the abstain, never to read numbers) adjacent to a share
  word → ABSTAIN `NON_LITERAL_NUMERAL` (the Starwood "one" — spelled-out,
  integer, embedded in a defined-term parenthetical; the pack's own
  warning that a `\d+\.\d+` assumption misses this form is honored by
  typing it to review, not by teaching the parser to read words).
- Zero survivors otherwise → ABSTAIN `NO_RATIO_LITERAL` (the SkyWater
  pointer form "equal to the Exchange Ratio" — the literal lives in the
  definitions article; resolving a cross-reference to its content is
  relationship machinery, not quote-local production).
- Versioned `EXCHANGE_RATIO_PARSE_VERSION`, threaded into the receipt.

No parser for `APPRAISAL_RIGHTS_STATUS` — the canonical value IS the enum
code; it resolves under corroboration only (section 4).

Neither parser ever computes: the CVR limb ("plus (ii) one (1) contractual
contingent value right per share") is legal text for the reviewer and the
open-world path — never an addend, never a second value.

## 3. Producer prompt + provider

- **New prompt module** `consideration-producer-prompt.js`, own
  `PROMPT_ID 'native-producer-consideration/v1'`, `PROMPT_VERSION 1`,
  bumped once per slice, never mid-slice. The capitalisation prompt is NOT
  edited (its PROMPT_VERSION does not move; its recorded fixtures replay
  byte-identically).
- **Dispatch: one new entry in `producer-prompt-registry.js`** (the seam
  the termination-rights spec builds — this spec writes against it and
  does NOT re-design it): `CONSIDERATION → buildConsiderationProducerPrompt`.
  Unknown family stays fail-closed (no prompt, no candidates, no silent
  capitalisation fallback), unchanged. Section-family classification uses
  the same two-stage classifier that spec defines: stage-1 title rules
  ported from and tested against the v1 `lib/parser-v2/classify.js`
  consideration title split (the "Conversion of Shares / Effect on Capital
  Stock", "Exchange of Certificates", "Treatment of … Awards",
  "Dissenting/Appraisal", "Withholding", "Adjustments" title family),
  validated against ALL deals' section titles before dispatch (the
  classify-rules safety check); stage-2 AI classification carries the
  flagged provenance and `SECTION_FAMILY_AI_UNVERIFIED` condition exactly
  per the Ben ruling recorded there. Note the scope is deliberately wider
  than the three promoted concepts: withholding/adjustment/exchange
  sections classify CONSIDERATION and reach this prompt, which asserts
  nothing typed from them — their content flows to
  `open_world_candidates`, which is correct and costless.
- Response shape: a `consideration_assertions` array — each element
  `{ section_reference, assertion_kind: 'PER_SHARE_CASH' |
  'EXCHANGE_RATIO' | 'APPRAISAL_STATUS', consideration_term
  (verbatim, PER_SHARE_CASH only), ratio_term and issuer_stock (verbatim,
  EXCHANGE_RATIO only), appraisal_status ('AVAILABLE'|'NOT_AVAILABLE') and
  statute (verbatim, optional; APPRAISAL_STATUS only), verbatim quote }`.
  One element per legal fact, with the compound-sentence rule pinned in
  the prompt: a mixed cash+stock conversion sentence is TWO assertions
  (cash + ratio) — which may legitimately share the same quote, per the
  parser-complement property of section 2; an election clause with N cash
  legs is N PER_SHARE_CASH assertions, each quoting its own limb (the
  Skechers rule — two `$` literals in one quote ABSTAIN).
- Prompt instructions pinned: NEVER assert the Merger-Sub/Surviving-
  Corporation internal share conversion as an exchange-ratio claim (the
  Concho §3.1 shape); NEVER emit a fixed/floating type token (ratio type
  is not in the vocabulary — anything shaped like it goes to
  `open_world_candidates`); CVR entitlements, collar mechanics, election
  forms, proration formulas, equity-award treatments, dividend
  equivalence and withholding rights all stay in `open_world_candidates`
  — PRESERVE-THE-NOVEL is retained verbatim; promotion narrows novelty,
  never forces fit. The producer never asserts a negative (M3 rule 1):
  `NOT_AVAILABLE` is asserted ONLY against a quoted no-availability
  sentence; "the agreement says nothing about appraisal" is never
  emitted.
- **Provider (`anthropic-provider.js`):** one new generic key
  `NATIVE_CONSIDERATION_CANDIDATE`, proposal_kind `CONSIDERATION`
  (≠ OPEN_WORLD). `consideration_assertions` is deliberately NOT added to
  `REQUIRED_RESPONSE_LISTS` — the share_count precedent at ~83–89
  verbatim: every recorded pre-existing response fixture predates the
  key; missing/non-array reads as empty list, never a schema failure.
  Quote byte-verification identical to existing proposals.
- Golden evals: recorded-response fixtures are never hand-edited to
  pretend old runs emitted the new shape; the new shape enters recordings
  only via fresh live runs (the dated handoffs of the Deliverable
  section).

## 4. Resolver wiring (`candidate-resolution.js`)

- **ONE resolution-table entry** (P1 audit M-2: `RESOLUTION_UNCONDITIONAL`
  is a Map keyed on generic_claim_key alone; multiple entries per key
  silently last-win): `NATIVE_CONSIDERATION_CANDIDATE`,
  deterministic_kind null, attachment_position null, `concept_key: null`,
  `registered_claim_definition_key: null` (the SHARE_COUNT precedent —
  the handler makes both splits; the table entry only distinguishes
  "route to handler" from "no entry, open world"), `party_field: null`,
  `party_role: null` — no party is minted in this family this slice: the
  holder of the right to receive is "each Share['s holder]", a class, not
  a resolvable principal party, and inventing a capacity for it is a
  vocabulary call this slice does not make (contrast TERMR's
  EITHER_PRINCIPAL_PARTY flag — that flag exists because the party IS the
  legal substance there; here the substance is the value).
  `MAPPING_TABLE_VERSION` bumped; table-validation test still asserts no
  duplicate generic keys.
- **Handler split, ordering pinned:** concept and definition both follow
  STRUCTURALLY from `assertion_kind` via a frozen map —
  `PER_SHARE_CASH → (CONS-PERSHARE, PER_SHARE_CASH_CONSIDERATION)`,
  `EXCHANGE_RATIO → (CONS-RATIO, EXCHANGE_RATIO_VALUE)`,
  `APPRAISAL_STATUS → (CONS-DISSENT, APPRAISAL_RIGHTS_STATUS)` — so the
  handler assigns the concept FIRST and every subsequent review item
  carries a real `CONS-` concept and rank 60 by the existing prefix
  match. No `-PENDING` routing token is needed in this family (the TERMF
  device existed because its concept DEPENDED on a corroborated
  attribute; here it depends only on the structural kind, and a mislabeled
  kind mis-ranks nothing — all three concepts share the tier).
  Out-of-enum `assertion_kind` → explicit `pushOpenWorld` with a typed
  reason (P1 C-4: the main loop's open-world routing keys on
  proposal_kind and will not catch it).
- **Corroboration tables (frozen resolver constants — label must bind to
  quote text; every pattern grounded in a committed fixture quote):**
  - `PER_SHARE_CASH`: the byte-verified quote must match
    /\bright to receive\b/i AND ( /\bin cash\b/i ∪ /\breceive cash\b/i ).
    Grounded in all eight cash fixtures ("converted … into the right to
    receive $63.00 per Share in cash"; "right to receive cash in an
    amount equal to $200.00"; "(x) $16.25 in cash"). Mismatch → review,
    typed `PER_SHARE_CONTEXT_UNCORROBORATED`. This is the second wall
    (after `consideration_term_ref`) against withholding dollars: the
    withholding fixtures say "deduct and withhold from the consideration
    otherwise payable" — no "right to receive".
  - `EXCHANGE_RATIO`: quote must match /\bshares? of\b/i (grounded:
    "0.3869 of a share of … Parent Common Stock", "0.7926 shares of
    Parent Stock", "share of Holdco Common Stock") AND contain the
    verbatim `issuer_stock_ref`. Mismatch → review, typed
    `RATIO_CONTEXT_UNCORROBORATED`.
  - `APPRAISAL_STATUS`, per canonical value, NEGATION CHECKED FIRST
    (ordering pin — the no-availability sentences contain the same
    vocabulary as the availability ones):
    1. NOT_AVAILABLE ↔ /\bno (dissenters['’]? or )?appraisal rights\b/i
       AND /\bavailable\b/i (grounded: Concho "no appraisal rights shall
       be available"; Forest City "No dissenters' or appraisal rights
       will be available"; Modiv "No dissenters' or appraisal rights
       shall be available" — the optional dissenters limb covers both
       drafting orders observed; the apostrophe class covers typographic
       and ASCII quotes in committed bytes).
    2. AVAILABLE ↔ the NOT_AVAILABLE pattern pair ABSENT, and at least
       one of: /\bSection 262\b/ (case-sensitive), /\bDissenting
       (Stockholder|Shares|Company Shares)\b/ (case-sensitive defined
       terms), /\bDissenter Rights\b/ (case-sensitive — the Cayman
       spelling, capital D, no apostrophe-s; a lowercase or
       possessive-keyed pattern misses it, the pack's jurisdiction
       warning honored). Grounded: Superior, Prometheus's Dissenting
       Company Shares carve-out, Theravance.
    3. An AVAILABLE label on a quote matching the NOT_AVAILABLE pair →
       review, typed `APPRAISAL_STATUS_CONTRADICTED`; neither pattern set
       matches → review, typed `APPRAISAL_STATUS_UNCORROBORATED`.
    **Legal ruling, FLAGGED FOR BEN in the PR body:** the Cayman fixture
    (Theravance §2.4) is a notice COVENANT that presupposes appraisal
    rights rather than a sentence granting or negating them. This spec
    rules that ANY quoted PRESUPPOSITION-ONLY corroboration — a quote
    where the NOT_AVAILABLE pattern pair is absent and the AVAILABLE
    vocabulary (`Section 262`, `Dissenting (Stockholder|Shares|Company
    Shares)`, `Dissenter Rights`) appears in text that presumes rather
    than grants or negates the right — corroborates AVAILABLE (the
    machinery only exists because the statutory right does). This is
    wider than the Cayman notice covenant alone: the same shape appears in
    a conversion-clause carve-out such as "other than … Dissenting
    Shares" (the MDC/Anadarko pattern), which corroborates AVAILABLE under
    the identical reading. That reading is a legal ruling, not a
    mechanical fact — Ben confirms or reverses it at PR review for ALL
    presupposition-only corroborations, not just the Cayman covenant
    shape; reversal moves every such shape to
    `APPRAISAL_STATUS_UNCORROBORATED` review with no other change.
- **Handler order** (the SHARE_COUNT/TEMPORAL pattern): concept/definition
  split on assertion_kind → context corroboration (table above) →
  attribute verbatim checks (`consideration_term_ref` / `ratio_term_ref` /
  `issuer_stock_ref` / optional `statute_ref`) → per-kind branch:
  PER_SHARE_CASH → `per-share-cash-parse.js`; EXCHANGE_RATIO →
  `exchange-ratio-parse.js`; APPRAISAL_STATUS → enum membership via
  `canonicalValueAllowed` (no parse — the value IS the code). Every
  ABSTAIN routes to review with the parser's typed reason; RESOLVED
  values still pass `canonicalValueAllowed` (a parser bug must not bypass
  the gate).
- **Materiality:** existing rank 60 tier via the `CONS-` prefix
  (Grounding correction 1). No new tier, no override entries; a test pins
  rank 60 on a resolved claim AND on a review item so a refactor cannot
  silently drop either.
- **Identity:** `consideration_term_ref`, `ratio_term_ref`,
  `issuer_stock_ref` and the appraisal canonical value participate in
  claim identity/closure — Skechers' Cash Election and Mixed Election
  cash claims, and a two-class deal's two ratios, mint distinct, stable,
  non-deduping claims; re-run is byte-stable.
- **Receipt:** `per_share_cash_parse_version` and
  `exchange_ratio_parse_version` thread into `receiptBody`, alongside the
  bumped `mapping_table_version` and the new frozen-version
  `contract_vocabulary_digest`.
- **Additivity re-pin, honest (P1 M-1 verbatim):** with no consideration
  input, resolution output must be byte-identical EXCEPT
  `mapping_table_version`, `contract_vocabulary_digest` (under the new
  frozen version), the two new parser-version fields, and the recomputed
  `resolution_receipt_id`; documented in the PR with a field-level diff.
  Skipping the version bump to keep old pins green is the named
  anti-pattern.

## 5. Lexicon additions (`LEXICAL_FAMILY_LEXICON` version bump; every edit
is a reviewed diff; keys MUST be registered concept keys — table-validation
enforces it, which is why the three CONS- concepts land in the SAME slice.
Boundary pin inherited from the TERMR audit m-2 finding: `scanBoundedRegex`
does not impose word boundaries, so every case-sensitive defined-term
pattern below carries explicit `\b` anchors; a boundary-free defined-term
literal is a table-validation failure.)

- `CONS-PERSHARE`: LITERAL_PHRASE "in cash, without interest" (grounded in
  six fixtures), "converted into the right to receive", "right to receive
  cash"; BOUNDED_REGEX /\bMerger Consideration\b/ (case-sensitive —
  lower-case "merger consideration" prose must not fire). **Priced
  cross-hit noise (the TERMR Outside-Date precedent, accepted):**
  "Merger Consideration" verifiably appears throughout CONSID-EXCHANGE
  payment-mechanics text and CONSID-EQUITY award formulas ("the excess,
  if any, of the Merger Consideration over the exercise price") — hits
  there sit outside PER_SHARE candidate evidence and will raise
  `LEXICAL_UNMATCHED_SIGNALS` → veto/queue. Accepted and recorded: the
  defined term is the family's strongest veto tell; deletion would widen
  auto-pass (deletion asymmetry); the live-run handoffs measure the queue
  rate, and any narrowing is a reviewed lexicon diff, never a silent
  deletion. Test 7 pins the Red Hat option-spread sentence as an EXPECTED
  unmatched-signal hit.
- `CONS-RATIO`: BOUNDED_REGEX /\bExchange Ratio\b/ (case-sensitive; also
  hits "Starwood Merger Exchange Ratio" by substring with boundaries
  intact); LITERAL_PHRASE "of a share of" (grounded: Anadarko),
  "in lieu of fractional shares" (grounded: Redfin — fractional-share
  cash-out text is the constant companion of a stock component and a
  strong veto against a careless all-cash ABSENT on the stock leg).
- `CONS-DISSENT`: LITERAL_PHRASE "appraisal rights" (fires on both
  "Appraisal Rights" and "no appraisal rights" — veto-only, so coverage
  of the negated form is a feature); BOUNDED_REGEX /\bDissenting
  (Stockholder|Shares|Company Shares)\b/ (case-sensitive — the alternation
  matches the resolver's own AVAILABLE corroboration pattern in section 4;
  without "Company Shares" the lexicon would not fire on Prometheus's
  "Dissenting Company Shares", an unrecorded blind spot inconsistent with
  the adjacent corroboration table), /\bDissenter Rights\b/
  (case-sensitive — the Cayman form; a possessive-normalized pattern
  would miss it and silently blind the net to Cayman deals).

Priced exclusions (deletion-asymmetry doc-comment applies; every one a
recorded blind spot; the veto-only design means a miss costs a missed
VETO, never a wrong claim):

- Naked "cash", "shares", "stock", "per share": ubiquitous across every
  article of every agreement; predictable noise floods pressure lexicon
  deletions, which widen auto-pass (the net spec's own argument).
- "par value": already a REP-T-CAP pattern; in consideration sections it
  marks the boilerplate this family's parsers exclude, and a CONS-keyed
  copy would fire on every conversion clause for zero discriminating
  power.
- "without interest" alone: appears in withholding and exchange-fund
  prose; only the full phrase "in cash, without interest" is a pattern.
- "Exchange Fund", "Exchange Agent", "Paying Agent", "letter of
  transmittal": CONSID-EXCHANGE plumbing with no registered concept this
  slice — no lexicon key may carry them (keys must be registered concept
  keys), and the blind spot is structural until an exchange-mechanics
  concept is adjudicated. Recorded.
- "Contingent Value Right", "CVR", "Collar", "Ticking Fee", "Election
  Form", "Proration": zero registered concepts (Grounding correction 2);
  grounded text exists for CVR/election inside CONVERT/EXCHANGE cards,
  but under the same-family reading an unmatched hit can only veto ITS
  OWN family's ABSENT — and these families do not exist yet. They stay
  with the open-world path; when Ben promotes them, their lexicon entries
  land in that slice (program invariant: lexicon coverage never lags the
  taxonomy, and never leads it either).

## 6. Acceptance tests (real-fixture-first; the pre-rerun harness honesty
pins from P1 audit M-5 apply VERBATIM — no recorded native runs exist for
this family, so every resolver/registry test drives synthetic compiled
candidates pinned to REAL corpus quotes, byte-verified against committed
fixture text, clearly labeled as the pre-rerun harness)

0. **Fixture commit:** consideration-section canonical text for at least
   five corpus deals committed as LITERAL bytes from production
   `region_full_text` / `primary_quote` (typographic quotes and any
   zero-width/LTR marks included — never retyped ASCII), with provenance
   headers (deal, provision_card id, retrieval date 2026-08-02), covering:
   a single-figure all-cash conversion (MDC `0ac02d19…` or Prometheus
   `364a6072…`), the compound mixed cash+ratio sentence (Anadarko
   `67c7b10e…`), the decimal ratio with section-reference noise (Redfin
   `b0051668…`), the spelled-"one" ratio (Starwood `15688f09…`), the
   ratio pointer (SkyWater `c77d0655…`), the election two-cash-leg quote
   (Skechers `b258d66b…`), the cash+CVR quote (Metsera `b0d49cea…`), a
   par-value-bearing conversion (Concho `d542131e…`), and all four
   appraisal variants (Superior `4bf075bd…`, Concho `a8d7760a…`, Forest
   City `265ab7d4…`, Modiv `16e1358e…`, Theravance `50946e9a…`). Every
   test quote is asserted to be a contiguous substring of the committed
   bytes.
1. **Cash parser, table-driven:** MDC → `'63.00'`; Prometheus →
   `'200.00'`; Cooper → `'41.75'`; Endeavor → `'27.50'`; Metsera →
   `'47.50'` (the bare "one (1)" CVR numerals are ignored — bare-numeral
   immunity asserted on the real quote); Anadarko compound → `'16.25'`
   (the 0.3869 is not a currency literal — the inversion property
   asserted, not assumed); Skechers two-leg → `MULTIPLE_MONEY_LITERALS`,
   and its two hand-enumerated split limbs (each a contiguous substring,
   P1 overlap rule) → `'63.00'` / `'57.00'`; Starwood → `NO_MONEY_LITERAL`;
   the par-value fixture → the `$0.01` token EXCLUDED (a synthetic quote
   whose ONLY dollar token is a par value ABSTAINs `NO_MONEY_LITERAL`,
   never resolves `'0.01'` — the family's headline corruption case as a
   permanent regression test); `MALFORMED_GROUPING`, `NON_USD_CURRENCY`,
   `NON_LITERAL_MONEY` each exercised.
2. **Ratio parser, table-driven:** Anadarko compound → `'0.3869'` (the
   $16.25 excluded); Redfin → `'0.7926'` with "Section 1.6" and
   "Sections 1.5(a)(i)" proven excluded on the literal bytes; Starwood →
   `NON_LITERAL_NUMERAL`; SkyWater pointer → `NO_RATIO_LITERAL`; a
   synthetic two-ratio quote → `MULTIPLE_RATIO_LITERALS`; a percentage
   and a date each proven non-candidates.
3. **Registry:** next frozen version compiles; prior version's arrays
   untouched byte-for-byte (superset-diff written against sorted content,
   not the numeral); all three definitions and three concepts validate
   with zero validator changes; expected-concept-keys and
   expected-claim-keys superset-diff tests.
4. **Resolution (pre-rerun harness):** synthetic candidates over committed
   bytes resolve end-to-end: correct concept+definition per
   assertion_kind; `consideration_term_ref` verbatim gate (a candidate
   whose term is not in the quote → `CONSIDERATION_TERM_NOT_IN_QUOTE`;
   the Skechers $57.00 limb resolves ONLY with term "Mixed Election Cash
   Consideration"); a withholding-section quote asserted as
   PER_SHARE_CASH → `PER_SHARE_CONTEXT_UNCORROBORATED` (no "right to
   receive"); the Concho Merger-Sub conversion asserted as
   EXCHANGE_RATIO → `RATIO_TERM_UNIDENTIFIED` (the inversion-of-substance
   regression: internal mechanics never mint a ratio); appraisal: all
   four variants resolve their correct enum value, an AVAILABLE label on
   the Modiv quote → `APPRAISAL_STATUS_CONTRADICTED`, a statute_ref not
   in quote → typed review, the Theravance covenant shape resolves
   AVAILABLE under the flagged ruling (one-line test comment citing the
   Ben flag); out-of-enum assertion_kind exercises explicit
   `pushOpenWorld`; materiality rank 60 asserted on a resolved claim AND
   a review item; every ABSTAIN class routes to review with its typed
   reason; additivity re-pin with documented field-level diff.
5. **Identity:** Skechers' two election cash claims mint distinct stable
   identities; a cash claim and a ratio claim sharing the Anadarko quote
   never collide or dedupe; two-class ratio claims (the Bridge Investment
   Class A/Class B shape) distinct on `ratio_term_ref` (the corpus's real
   two-class deal differs by ratio term, not issuer stock); re-run
   byte-stable.
6. **Provider + dispatch:** response missing `consideration_assertions` →
   empty list, not schema failure; recorded capitalisation fixtures
   replay byte-identically through the registry with the CONSIDERATION
   entry present; consideration fixture titles classify CONSIDERATION at
   stage 1, capitalisation and termination titles do NOT, validated
   against all deals' section titles; unknown family → no prompt, no
   candidates, typed record.
7. **Lexicon:** table validation (keys registered, explicit `\b` on every
   case-sensitive defined-term regex, static max ≤ 128, rationale per
   pattern, content hash re-pinned, version bump); anti-noise regression
   paragraph extended with "merger consideration" in lowercase prose,
   "consideration of the Board" (the non-payment sense of the word),
   "cash flow", and "dissenting view" — asserting zero hits; the Red Hat
   option-spread sentence ("the excess, if any, of the Merger
   Consideration over the exercise price") pinned as an EXPECTED
   CONS-PERSHARE unmatched-signal hit (the priced cross-hit cost,
   asserted so a future silent deletion breaks a test); each surviving
   pattern hits its own grounding quote in the committed fixtures.
8. Full suite + `npm run build` + forbidden-patterns (no fixture outside
   the reviewed exemption routes trips the ratio-type-duplication or
   consideration-label fingerprints); phase allowlist for the slice's
   files.

## Out of scope

- **Equity-award treatment (CONSID-EQUITY) promotion.** The corpus shape
  is instrument-keyed, multi-regime, and compound: Skechers §2.8 carries
  THREE mutually exclusive performance rules in one clause (rTSR → actual;
  EPS unended → target; EPS ended → actual), split payment tranches whose
  percentages describe TIMING not amount, and an interest rate that
  exists only as an external IRC §1274(d) reference. Every one of those
  is a rule-3 nearest-fit trap for a single-value claim. The
  option-spread formula ("Merger Consideration minus exercise price") is
  a FORMULA, and this program never does arithmetic. The whole subtype
  stays open world, feeding the commonality report toward a per-instrument
  design (the dormant `consideration_treatments` row shape is prior art
  for that future slice, not this one).
- CVR economics (per-share CVR counts, milestone payments — the value is
  deferred to a separate CVR Agreement, a cross-document resolution
  problem); collar, walkaway, ticking-fee shapes (zero corpus cards,
  Grounding correction 2).
- Election/proration mechanics beyond the per-term cash values captured
  above: election forms, deadlines, oversubscription treatment, the
  Maximum Equity Election Cap algebra — open world.
- Exchange-of-certificates mechanics (CONSID-EXCHANGE), withholding
  (CONSID-WITHHOLD), anti-dilution adjustments (CONSID-ADJUST): no
  registered concepts, no claims, no lexicon keys this slice.
- Fixed-vs-floating ratio classification (registry ruling above — a
  derived classification for scope-closure, never a produced label).
- Cross-deal canonicalization of `consideration_term_ref`,
  `ratio_term_ref`, `issuer_stock_ref`, `statute_ref` and any
  jurisdiction vocabulary (Ben adjudication over observed values, later).
- Aggregate-deal-value or blended-value derivation (arithmetic; the
  serving metric bindings own derived metrics, and nothing here feeds
  them without its own reviewed slice).
- The live re-extraction runs (each its own dated handoff; until they
  land, NO report may claim native consideration extraction — M-5).
- FAMILY_MAPPING_TABLE extension for v1 CONSID-* ↔ v2 CONS-* (separate
  Fable+Ben table edit with the wiring slice; the prefix trap in
  Grounding correction 1 makes this table Ben-reviewed, never
  implementer-inferred).
- The 14 null-subtype v1 cards (v1 hygiene, flagged to the ingest-QA
  owner, not this slice's input); any amendment to M3 protocol
  semantics; any scope-closure/ABSENT work.

## Known costs, stated up front

- **Spelled-out and pointer-form ratios queue.** Starwood's "one" ABSTAINs
  `NON_LITERAL_NUMERAL`; SkyWater's "equal to the Exchange Ratio" ABSTAINs
  `NO_RATIO_LITERAL`. Both are one-second Ben confirmations, priced
  against the alternatives (reading spelled numbers is one step from
  arithmetic; resolving pointers is relationship machinery). The live-run
  handoffs measure the rates.
- **Election deals produce N cash claims and the producer must split.**
  An unsplit Skechers-style quote queues `MULTIPLE_MONEY_LITERALS` — a
  queue item, never a wrong number, and never the $57.00-for-$63.00 swap
  the pack warns about, because `consideration_term_ref` participates in
  identity and corroboration.
- **CVR deals resolve only their cash leg.** Metsera resolves `'47.50'`
  under term "Closing Amount"; the CVR component is visible only in the
  quote evidence and the open-world lane until a CVR concept is
  adjudicated. A consumer reading PER_SHARE_CASH_CONSIDERATION as "the
  full deal price" would be wrong — the claim is named PER-SHARE CASH for
  exactly this reason, and the serving layer owes no aggregate this
  slice.
- **The "Merger Consideration" lexicon pattern will queue false vetoes**
  in exchange-mechanics and equity-award sections (the pinned Red Hat
  expectation). Accepted: deletion asymmetry; measured from queue data;
  remedies are reviewed lexicon diffs.
- **All-stock deals yield no PER_SHARE_CASH claim and cash-only deals no
  ratio claim** — and nothing in this slice may read those gaps as
  ABSENT; scope closure does not exist yet, and the lexicon's
  fractional-share and ratio patterns exist precisely to veto a careless
  future ABSENT on the stock leg.
- Case-sensitive defined-term patterns miss lowercase drafting variants;
  priced — the prose phrases cover the common shapes, and a miss costs a
  missed veto, never a wrong claim.
- The parsers refuse compound quotes beyond the one-candidate-per-parser
  inversion property; badly split producer output queues rather than
  resolves; two-strike escalation applies to prompt iteration, never to
  loosening the parsers.
