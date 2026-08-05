# Family — Tax matters covenants & structure (TAXM-*)

**Date:** 2026-08-03. **Status:** AUDIT-AMENDED (2026-08-03) — 10 audit
findings folded (0 CRITICAL, 7 MATERIAL, 3 MINOR); 0 parked for Fable.
Per program convention (spec-detail → audit → build → review), next step
is build.
**Parent:** `2026-08-02-openworld-promotion-program.md` (five-layer promotion
structure and cross-slice invariants apply verbatim).
**Template:** `2026-08-02-p1-captable-numerics-design.md` (slice shape,
typed-abstain discipline, corroboration tables, coverage-map honesty pins).
**Wave exemplars bound:** `2026-08-02-family-termination-rights-design.md`
(the producer-prompt-registry seam — this family dispatches through it,
NEVER a capitalisation fallback; the seam is BUILT at head:
`lib/canonical-v2/native-producer/producer-prompt-registry.js` carries
CAPITALISATION and TERMINATION_FEE entries, so this slice adds ONE entry to
the existing frozen Map, it does not build the seam);
`2026-08-02-family-termination-fee-design.md` (full-table ambiguity
corroboration, pre-concept review routing);
`2026-08-02-family-closing-conditions-design.md` (presence-claim shape;
"no parser is a ruled decision"; pinned co-resolution/subsumption pairs;
the M3-rule-1 ruling that modifiers are second quoted PRESENT claims);
`2026-08-02-family-consideration-design.md` (currency-exclusion inversion —
cited, unused: this slice ships no money parser);
`2026-08-02-family-ioc-design.md` (compound-limb splitting is producer
work; parsers and resolvers never pick);
`2026-08-02-family-specific-performance-remedies-design.md` (the REM-CAP
vacuity ruling — applied twice in this spec, to withholding rights and to
condition-side tax opinions: a concept whose grounded text cannot reach its
producer under this spec's own dispatch rules is an automatic audit
CRITICAL, so neither ships here);
`2026-08-02-family-financing-covenants-design.md` (the
`runStage1(title, article_context)` classifier signature and the
exact-keys materiality tier — both adopted).
**Protocol authority:** docs/codex-program/EXECUTION-LEDGER.md — M3 review
protocol + extraction semantics rules 1–3. This spec may not amend them.
**Lexicon authority:** `2026-08-02-lexical-disagreement-net-design.md`
(word boundaries, case-sensitive defined terms/acronyms, deletion
asymmetry, priced blind spots; static max ≤ 128; every case-sensitive
defined-term regex below carries explicit `\b`).
**Materiality:** no tier covers this family today (`MATERIALITY_TABLE`,
`candidate-resolution.js` ~523–534, carries no tax prefix of any kind — a
resolved tax claim would rank UNCLASSIFIED 99, below notices). Section 4
proposes ONE exact-keys tier, flagged for Ben.

## Corpus grounding (production Supabase, project `tzulhdasmioeechxapdy`;
evidence pack read 2026-08-02 — pack quotes are ground truth, cited by
provision_card id; five supplementary SELECT-only queries run 2026-08-03
by this spec's author, receipts inline below)

v1 canonical tax population (pack §2): IOC-TAX 49 cards/34 deals (IOC
family's registered concept — not claimed here), COV-TAXMATTERS 23/18,
DEF-TAX 64/27 (+15 mislabelled as REP-T-TAX on DEFINITION rows — pack
§5(a)), DEF-TAXRETURN 37/33, REP-T-TAX 38/37, REP-B-TAX 11/11,
COND-TAXOPINION **0/0** (declared rubric vocabulary, zero corpus cards —
the closing-conditions spec already ruled it unregistrable on those
grounds). `needs_review` is FALSE on 100% of these cards — no reviewer
signal exists for any defect below. Shadow population (pack §5(c)):
**~40 unclassified cards across ≥18 deals** (best-effort reproduction;
the pack's exact filter is not restated here — treat the count as
approximate) with tax/REIT `[PROPOSED]`/`Unclassified` labels spread over
several provision_type buckets, several semantically wrong (transfer
taxes as MISC_BOILERPLATE, tax cooperation as ANTITRUST_REGULATORY, 368(a)
operative text as STRUCTURE_MECHANICS, REIT savings clauses as
TERMINATION_RIGHT) — a population comparable in size to the canonical
COV-TAXMATTERS+IOC-TAX population combined, though not as large as
originally stated. v1 labels are UNTRUSTED input; every corroboration
table below exists because the corpus demonstrates the drift.

Grounding quotes this spec builds on (every corroboration pattern and
lexicon entry traces to one of these; nothing is fabricated):

- **Intended-tax-treatment protection covenant (defined-term form)** —
  card in deal `13894e33…`, §7.4(a) (pack §3): "Neither Parent nor the
  Company shall, nor shall they permit their respective Subsidiaries to,
  take any action that would prevent or impede, or could reasonably be
  expected to prevent or impede, the Mergers from qualifying for the
  Intended Tax Treatment."; card `31209666-ec08-450f-ba14-3281cb3dbccb`
  (deal `af4940e1…`, §6.18(a), query receipt 3): same drafting, "…the
  Merger from qualifying for the Intended Tax Treatment; provided,
  however…".
- **Protection covenant with the 368(a) cite in the same sentence** — deal
  `8cd0787f…`, §7.4 (pack §3): "Neither Cavalier nor Maverick shall, nor
  shall they permit their respective Subsidiaries to, take any action that
  is not contemplated by this Agreement that would prevent or impede, or
  could reasonably be expected to prevent or impede, the Mergers, taken
  together, from qualifying as a \"reorganization\" within the meaning of
  Section 368(a) of the Code…".
- **Efforts-to-cause variant + tax representation letters** — card
  `2c7fb882-6e7a-4eff-a1e9-147d9e3c06fd` (deal `dfaa71fa…` — the REIT
  deal, §5.12, query receipt 3): "(a) Cooperation. Parent, the Company and
  their affiliates shall use their respective reasonable best efforts to
  cause the Mergers to qualify for the Intended Income Tax Treatment.
  (b) Tax Representation Letters. (i) The Company shall use reasonable
  best efforts to (A) deliver…" — note the variant defined term "Intended
  **Income** Tax Treatment".
- **351 treatment, component-scoped** — card
  `13a2312c-348b-4b97-bd72-df06db5f4596` (deal `af4940e1…`, §2.14
  "Intended Tax Treatment", STRUCTURE_MECHANICS/NULL — a shadow card,
  query receipt 4): "…(i) in the case of Company Stockholders who receive
  the Mixed Election Consideration in the Merger, the transfer of Company
  Common Stock to Parent … as a transaction described under Section
  351(a) of the Code and (ii) in the case of Company Stockholders who
  receive only Cash Election Consideration…"; card
  `59b5597f-34f4-4183-bda5-17eb3fb8954d` (deal `df393645…`, §5.21, query
  receipt 4): "…shall be treated as meeting the requirements of Section
  368(a)(1)(F) of the Code and (ii) the transaction described in Section
  5.16(b)(vi) shall be treated as meeting the requirements of Section 351
  of the Code." — one section, DIFFERENT treatments for different
  transaction steps.
- **Transfer taxes, borne by Parent** — card
  `6b49f790-9e56-4b62-95b8-e8d318ca19d9` (deal `bb5f062d…`, §9.12
  "Transfer Taxes", MISC_BOILERPLATE/NULL, query receipt 2): "…all
  transfer, documentary, sales, use, stamp, registration, value-added,
  and other similar Taxes, and fees … (collectively, \"Transfer Taxes\")
  shall be paid by Parent and Merger Sub when due."; card
  `327f9369-ff23-4557-9081-e085bffde206` (deal `c34415ed…`, §8.11): same
  shape; card `7f95a228-9aef-4510-8c31-d972253d1dde` (deal `f9c61065…`,
  §10.10, query receipt 5): "…will be paid by Parent, without reduction…".
- **Transfer taxes, split 50/50** — card
  `0fedb4c5-8d59-4ac3-afd1-300cbd05c81f` (deal `df393645…`, §5.6,
  COV-TAXMATTERS, query receipt 2): "Columbus Holdings shall be
  responsible for and pay one-half of all Transfer Taxes and one-half of
  any Sales Taxes, and Cabot Parent shall be responsible for and pay
  one-half of all Transfer Taxes and one-half of any Sales Taxes."
- **Transfer taxes, borne by the Surviving Corporation** — card
  `f6d488d9-9a34-41d9-b7b7-8f52415bfd18` (deal `6369cc9c…`, §9.10,
  MISC_BOILERPLATE/NULL): "All transfer, documentary, sales, use, stamp,
  registration and other such Taxes and fees (including penalties and
  interest) incurred by the Company in connection with the Merger shall
  be paid by the Surviving Corporation when due."
- **Transfer-tax cooperation (grounds an allocation limb too)** — card
  `9681d401-4a17-4210-aa65-fae6cd067856` (deal `0a043659…`, §7.08,
  COV-TAXMATTERS): "The parties shall reasonably cooperate in the
  preparation, execution and filing of all returns, questionnaires,
  applications or other documents regarding any sales, transfer, stamp,
  stock transfer, value added, use, real property transfer and any
  similar Taxes…". FACT CORRECTION (audit M-4, 2026-08-03): the same
  card's bytes continue past the cooperation sentence with an allocation
  limb — "…each of the Parent Entities and the Surviving Entities agrees
  to assume liability for and pay any Transfer Taxes…" — so this card is
  not bearer-free; it is a grounded allocation whose drafting ("assume
  liability for and pay") matches neither the shipped kind-verb pattern
  nor any bearer pattern. An ALLOCATION assertion quoting that limb
  therefore fails the kind gate before ever reaching bearer
  corroboration and queues `TAX_KIND_UNCORROBORATED` (priced in Known
  costs), never `TRANSFER_TAX_BEARER_UNCORROBORATED`.
- **FIRPTA certificate delivery** — card
  `effb1c28-b01a-431b-a6c0-cfd696974e05` (deal `13211d88…`, §6.20 "FIRPTA
  Affidavits", COV-TAXMATTERS; the pack §3 card): "At the Closing, the
  Company shall deliver a certificate, under penalty of perjury, stating
  that the Company is not and has not been during the relevant period
  specified in Section 897(c)(1)(ii) of the Code, a United States real
  property holding corporation…"; card
  `fe6ce201-a057-4318-bfe8-016218ea46a0` (deal `0a043659…`, §7.17(a),
  COVENANT_OTHER/NULL): "FIRPTA Certificate. The Company shall deliver to
  Holdco Parent at or prior to the Closing a certification … consistent
  and in accordance with the requirements of Treasury Regulation Sections
  1.897-2(g), (h) and 1.1445-2(c)…".
- **Mega-clause hazard** — card `a1dbc559-35d3-44b1-a1fd-0aebad8e93bf`
  (deal `1dfb11d5…`, §6.16, COV-TAXMATTERS; pack §3): eleven lettered
  sub-clauses (a)–(k) bundling §706 closing-of-the-books, return-prep
  review windows ("thirty (30) calendar days" / "twenty (20) calendar
  days"), §6226(a) push-out, §754 election, three 30-day dispute windows,
  and 368(a)/plan-of-reorganization boilerplate under ONE primary_quote.

**Query receipts (SELECT-only, `provision_cards`, run 2026-08-03):**

1. **Corpus-wide probes** (cards/deals): FIRPTA-or-USRPHC 9/9;
   "tax sharing" 44/34; "transfer tax" 59/28; "Intended Tax Treatment"
   27/8; "368(a)" 29/9; "Section 351" 2/2; "representation letter" 24/10;
   "deduct and withhold" 52/40.
2. **Transfer-tax homes**: CONSID-EXCHANGE 17 (exchange-agent mechanics —
   consideration territory), DEF-TAX 7, MISC_BOILERPLATE/NULL 7,
   DEF-GENERAL 6, COV-TAXMATTERS 5, MISC-EXPENSES 3, long tail. The
   standalone allocation sections are the COV-TAXMATTERS + MISC-null
   population quoted above.
3. **Tax-sharing breakdown**: REP-T-TAX 28 + REP/NULL 4 + REP-B-TAX 2
   (rep boilerplate "not party to any Tax sharing agreement"); IOC-TAX 3
   + IOC/NULL 1 (restrictions on ENTERING tax-sharing agreements — cards
   `e0b6adef…`, `4af13e10…`, `6624add2…` — IOC family territory);
   COV-TAXMATTERS 1 (the `a1dbc559…` mega-clause); DEF 4; STRUCTURE 1.
   **Zero grounded standalone tax-sharing-TERMINATION covenants** exist
   anywhere in the corpus.
4. **351 context pulls** for `13a2312c…` and `59b5597f…` (quoted above).
5. **Bearer context pull** for `7f95a228…` (quoted above).

## Grounding corrections (verified against repo + production DB, 2026-08-03)

1. **No registered v2 vocabulary exists for this family.** Verified: the
   `contract-bundle.js` EXPECTED_CONCEPT_KEYS rows carry no COV-TAXMATTERS,
   no TAXM-*, nothing tax-covenant-shaped. `IOC-TAX` IS registered (the
   IOC family slice) and is never touched here. Every concept below is new
   and FLAGGED FOR BEN (the 2026-07-23 convention: this spec proposes,
   Ben settles).
2. **The only structured tax fields in v1 are consideration-hosted.**
   `taxReorgIntended` (boolean) / `taxReorgText` (text) live in the
   generic CONSID FEATURES array (`lib/rubric.js` ~4056–4065) — 368(a)
   intent piggybacked on the consideration provision. The consideration
   family spec neither promoted nor mentioned them (grep receipt: zero
   hits for "reorg"/"368" in that spec). v2 intended-treatment claims are
   minted HERE from tax-section quote bytes; the v1 CONSID fields are
   never read, mapped, or aliased (Out of scope; boundary 5).
3. **COND-TAXOPINION is empty vocabulary** (0 cards; pack §2, §5(c)) and
   the closing-conditions spec already ruled it out of registration
   ("registering them would be vocabulary with no grounding text"). Every
   real tax-opinion text in the corpus — 368(a) opinions AND REIT
   opinions — sits unclassified under `[PROPOSED]` labels on
   CLOSING_CONDITION-typed cards inside conditions articles. Boundary 1
   below disposes of the whole population.
4. **`needs_review` carries zero signal** (0/197 canonical family cards;
   pack §2) — nothing in v1 flags the §5(a) DEF/REP mislabel, the §5(b)
   IOC transfer-tax collision, or the 44-card shadow. Flagged to the
   ingest-QA owner; never absorbed here.
5. **Bundle version numbering:** this spec binds to "the next frozen
   version at this slice's merge"; every superset-diff acceptance test is
   written against CONTENT (sorted key sets), never the numeral.

## Cross-family boundaries (BINDING; duplication is an automatic audit
CRITICAL; each pin has a named acceptance test in section 6)

1. **Condition-side tax opinions — closing-conditions family, and today
   nobody's.** The closing-conditions spec owns the conditions article and
   deliberately declined COND-TAXOPINION (zero corpus cards). The real
   tax-opinion conditions (deal `7dc3a05f…` §5.3(c) "Closing Tax Opinion";
   the `[PROPOSED] Tax Opinion Condition` shadow set, pack §5(c)) live in
   conditions articles, which classify CLOSING_CONDITIONS and dispatch to
   that family's producer — under this spec's own dispatch rules that
   text can NEVER reach the tax-matters producer, so any condition-side
   claim minted here would be REM-CAP vacuity (automatic CRITICAL). This
   producer never emits a closing-condition assertion; the classifier has
   no /tax opinion/i rule and declines CONDITIONS article_context (§3);
   the opinion-condition population stays with the closing-conditions
   family's follow-on slice. The COVENANT side (cooperation to obtain
   opinions, representation-letter delivery) is this family's brief — see
   the Registry section for why it nonetheless stays open world THIS
   slice (single grounded covenant card, REIT-deal-concentrated).
   Test 4 pins the no-condition-claim invariant.
2. **REIT machinery — P4 (`2026-08-02-openworld-promotion-program.md`
   §P4, Ben ruled: design now).** REIT qualification opinions
   (`70304036…`, `82d31007…`, `e4104e30…`), the §857(a) 100%-distribution
   covenant (deal `f9c61065…` §7.1(f)), and the REIT-qualification
   termination-fee savings clauses (`376de14a…` cluster) are P4/TERMF
   territory, cited never claimed. Pack warning 7 applies: REIT
   vocabulary is drawn from essentially one deal (`dfaa71fa…`) plus
   fragments of a second — no REIT pattern, concept, or lexicon entry
   ships here. The `2c7fb882…` grounding card comes from the REIT deal;
   it grounds ONLY the generic protection-covenant drafting ("efforts to
   cause the Mergers to qualify"), never anything REIT-specific. Test 4.
3. **IOC-TAX — IOC family's registered concept (design-state, not yet
   built at head).** Interim restrictions on tax elections/returns/
   settlements (49/34) are meant to resolve through the IOC slice per the
   IOC family's own design spec, which *proposes* keying /\bTax
   Returns?\b/, /\bTax election\b/ etc. to IOC-TAX and dispatching
   INTERIM_OPERATING sections to an IOC producer. Verified at head
   (2026-08-03): `LEXICAL_FAMILY_LEXICON` carries zero IOC entries (only
   REP-T-CAP and TERMF-* families); `producer-prompt-registry.js`
   registers only CAPITALISATION and TERMINATION_FEE; the classifier has
   no INTERIM_OPERATING family at all (`STAGE_1_TITLE_RULES` =
   TERMINATION_FEE + TERMINATION only). None of that machinery is built
   yet. This spec claims nothing from the IOC-TAX population regardless
   — including the two deal `f9c61065…` cards misfiled under IOC-TAX that
   are really transfer-tax/Prop-13 cooperation (`53eb7ff3…`, `21e6844a…`;
   pack §5(b)): flagged to ingest-QA as v1 label defects, never absorbed
   (their SECTIONS are intended to classify INTERIM_OPERATING and stay
   with the IOC producer once it exists; the recall loss is priced in
   Known costs). IOC-TAX's dollar materiality thresholds ($500,000 / $2M
   / $25M / $5M, pack §6) are IOC threshold machinery. **Build-order pin
   (financing-covenants precedent, applied here):** if the IOC slice
   lands first, its lexicon/dispatch/classifier entries exist as
   described above and test b-3 (below) asserts against them directly;
   if this slice lands first, INTERIM_OPERATING is not yet a classifier
   family, so test b-3 is written in a skip-or-alternate form — asserting
   only that no `/\btax matters\b/i`-family rule in this slice's own
   stage-1 additions fires on an INTERIM_OPERATING-titled fixture — and
   is upgraded to the full dispatch assertion in the IOC slice's own
   reviewed diff once that classifier family exists. Test 4.
4. **Withholding rights — consideration family territory; NOT promoted
   here despite the family brief.** FLAGGED FOR BEN as a deliberate
   deviation. The v1 code is CONSID-WITHHOLD (`lib/rubric.js` ~276,
   22 cards/22 deals; "deduct and withhold" hits 52 cards/40 deals —
   query receipt 1); the consideration spec explicitly declined to
   promote it ("near-boilerplate; a withholding boolean is not worth a
   concept") and its anti-noise machinery already treats withholding
   quotes as exclusion fixtures. Withholding clauses live in the
   consideration/exchange article, which classifies CONSIDERATION and
   dispatches to that family's producer — a withholding presence claim
   minted here could never reach its grounded text (REM-CAP vacuity),
   and minting it in the consideration family would reopen that spec's
   ruled decision. Either path is a Ben taxonomy call; until he makes
   it, withholding stays open world corpus-wide. Test 4 pins that no
   withholding claim, pattern, or lexicon entry exists in this slice.
5. **`taxReorgIntended`/`taxReorgText` — v1 CONSID features, never read**
   (Grounding correction 2). No mapping layer, no backfill, no alias: v2
   intended-treatment claims come only from byte-verified tax-section
   quotes.
6. **Rep-side tax content (REP-T-TAX 38/37, REP-B-TAX 11/11) —
   unpromoted reps-family territory.** Six of the nine FIRPTA corpus hits
   are REP-T-TAX representations ("is not a United States real property
   holding corporation" as a REP) — this family's FIRPTA claim is the
   delivery COVENANT only, and representations articles never classify
   to this family (§3). The Morris-Trust spin-off rep (deal `6369cc9c…`
   §5.7, 5% threshold) and the §3.29 "Reorganization" rep (deal
   `13894e33…`) stay with the reps track. Test 4.
7. **Definitions (DEF-TAX 64/27, DEF-TAXRETURN 37/33) — key-defined-terms
   family territory.** The §5(a) fifteen-card DEF/REP mislabel and the
   DEF-TAXRETURN procedural contamination (pack warning 5) are flagged to
   ingest-QA. No defined-term claim is minted here; the "Intended Tax
   Treatment" definition-resolution problem (pack warning 6) is priced as
   a review class, never solved by cross-reference lookup (Known costs).

## Deliverable (honest conversion semantics)

Governed, resolvable claims for three workstreams: (a) intended-tax-
treatment structure — the treatment kind as a registry-hosted enum plus
the no-impede/efforts-to-cause protection covenant as a presence claim;
(b) transfer-tax allocation (who bears — enum) and transfer-tax
cooperation (presence); (c) FIRPTA certificate delivery (presence).

**No recorded native runs exist over tax-matters sections** — the producer
today extracts capitalisation plus the wave families' committed harnesses.
There are no open-world fixture rows to convert and no closure_ids to
track. The deliverable is the five-layer capability plus a pre-rerun
harness: a COVERAGE MAP over committed corpus-quote fixtures (the cards
named above, committed as LITERAL production bytes with provenance
headers — deal uuid, provision_card uuid, retrieval date, provision_type
and subtype INCLUDING NULL and wrong-bucket homes where true: `13a2312c…`
is STRUCTURE_MECHANICS/NULL, `6b49f790…`/`f6d488d9…`/`327f9369…`/
`7f95a228…` are MISC_BOILERPLATE/NULL, `fe6ce201…` is COVENANT_OTHER/NULL
— the TERMF m-2 discipline), each hand-enumerated with its expected
outcome. The P1 audit M-5 honesty pins apply verbatim: "the pipeline
natively extracts tax matters covenants" may be claimed ONLY after dated
post-merge live-run handoffs (subscription CLI); until then the honest
claim is "the machinery exists and is proven on committed fixtures".

**Fixture placement is load-bearing:** all committed fixtures live under
`tests/fixtures/canonical-v2/tax-matters-fixtures/` (the forbidden-patterns
PROSE_CLASS_FINGERPRINTS-exempt directory class). Checked against
`scripts/lint/forbidden-patterns.sh` globalPatterns: this family's
vocabulary ("Transfer Taxes", "FIRPTA", "Intended Tax Treatment",
"Section 368(a)", "prevent or impede", "United States real property
holding corporation") collides with no global or scoped fingerprint; no
new exemption entries are needed, and no spec prose, fixture, or module in
this slice may introduce fingerprinted vocabulary outside the exempt
fixture directory. Per the IOC lint pin, fixture headers carry deal uuid +
provision_card uuid + retrieval date ONLY — never v1 `section_ref` label
strings (which embed `[PROPOSED]`/`Unclassified` label slots).

## 1. Registry (`contract-bundle.js` → next frozen version)

Strictly additive spread of the head version at build time. **Three new
concepts, all FLAGGED FOR BEN in the PR body**, `{concept_key, version}`
shape only (the fixture-shape validator rejects anything else). The
`TAXM-` prefix is new v2 vocabulary: v1's `COV-TAXMATTERS` is deliberately
NOT reproduced as a concept key — the corpus proves it is a filing
grab-bag (one 23-card bucket bundling 368(a) intent, FIRPTA, transfer
taxes, partnership allocation mechanics and return-prep procedure — pack
§3), and promoting the bucket would fuse distinct legal facts (the
IOC-COMMIT precedent; also the REM precedent that v1 bucket names are not
v2 semantics).

- `TAXM-TREATMENT` — intended-tax-treatment structure: the treatment-kind
  declaration and the protection covenant. Grounded across ≥7 deals
  (`13894e33…`, `8cd0787f…`, `af4940e1…` ×2 sections, `df393645…`,
  `dfaa71fa…`, `1dfb11d5…`, plus the STRUCTURE_MECHANICS shadow cards
  `02fb24c1…`/`2a24d752…`); "Intended Tax Treatment" 27 cards/8 deals,
  "368(a)" 29 cards/9 deals (query receipt 1).
- `TAXM-TRANSFER` — transfer-tax allocation and cooperation. Grounded
  standalone sections across 6 deals (`bb5f062d…`, `c34415ed…`,
  `6369cc9c…`, `f9c61065…`, `df393645…`, `0a043659…`) — the clause type
  the pack shows split across three classification states
  (COV-TAXMATTERS / IOC-TAX-in-spirit / null-MISC_BOILERPLATE; warning 2);
  promotion is what ends that split for v2. FACT CORRECTION (audit M-5,
  2026-08-03): `65a3e3c8…` was previously listed as a 7th grounding deal;
  removed. Its card `70384d8d…` (§7.10) reads "(collectively, 'Transfer
  Taxes') shall be borne equally by PubCo and Parent" — "borne" fails the
  shipped kind-verb pattern (`/\b(shall|will) be (paid|responsible)/i`)
  and "borne equally" fails `SPLIT_EVEN`'s
  `/one-half of all Transfer Taxes/` pattern, so this card cannot resolve
  under this slice's own tables. It is not counted as a grounding card;
  a `TRANSFER_TAX_ALLOCATION` assertion on its quote queues
  `TAX_KIND_UNCORROBORATED` and the miss is priced in Known costs (a
  corpus-attested EVEN split that this slice's patterns do not reach).
- `TAXM-FIRPTA` — FIRPTA certificate delivery covenant. Grounded 3
  covenant cards / 3 deals (`13211d88…`, `0a043659…`, `af4940e1…` — the
  `31209666…` card's §6.18 carries a FIRPTA limb beyond its quoted
  opening). LOW-N, flagged as such: 3 deals is the smallest grounding set
  in the wave; the shape is legally uniform (a Treas. Reg. §1.897-2(h) /
  §1.1445-2 certificate delivered at Closing) and presence-only, so the
  fabrication surface is minimal — but Ben may defer it, and the frozen
  maps shrink mechanically if he does.

NOT added (each a legal ruling, not an omission):

- **A tax-opinion-cooperation / representation-letters concept.**
  FACT CORRECTION (audit M-2, 2026-08-03): the earlier draft claimed
  "exactly ONE grounded covenant card exists"; the corpus in fact grounds
  THREE covenant-side cooperation/representation-letter cards across
  three deals: `2c7fb882…` (§5.12(b) "Tax Representation Letters",
  REIT deal `dfaa71fa…`); `31209666…` (§6.18, non-REIT deal `af4940e1…`
  — carries a "representation letter" limb, per the FIRPTA grounding
  bullet above); and `804fc9d2…` (§4.23 "Tax Matters", non-REIT deal
  `7dc3a05f…`, COV-TAXMATTERS — "(b) Tax Opinions. Each of Parent and
  the Company shall use its reasonable best efforts and cooperate with
  one another to obtain (i) any opinion required by the SEC… (the
  'SEC Tax Opinion')… and (ii) the Closing Tax Opinion" plus officer
  representation certificates — notably in the same deal cited for
  boundary 1's closing-condition example). Three cards/three deals meets
  the grounding bar this spec accepted for TAXM-FIRPTA (also 3/3). The
  deal `555579a6…` "Company Tax Representations"/"Parent Tax Counsel"
  material remains DEFINITION- and NOREP-rep-typed, not covenant text
  (query receipt: cards `0e9d510a…`, `8ab3ea71…`, `5910405b…`,
  `cb5965c6…`), and is unaffected by this correction. The open-world
  ruling below may still be the right call — REIT-adjacency and P4
  overlap are real considerations independent of the card count — but it
  was reasoned from a false premise. FLAGGED FOR BEN: re-decide
  open-world-vs-promote against the corrected three-card/three-deal
  count; until Ben re-rules, the shape stays open world and all three
  cards are recorded as candidate grounding cards feeding the
  commonality report.
- **A tax-sharing-agreement-termination concept.** The family brief names
  it; the corpus refutes it (query receipt 3): all 44 "tax sharing" hits
  are rep boilerplate (34), IOC restrictions on ENTERING such agreements
  (4 — IOC territory), definitions (4), and the `a1dbc559…` mega-clause.
  Zero standalone termination covenants. Declared vocabulary with no
  family-owned corpus existence does not ship (the COND-B-DISSENT
  precedent). Open world. FLAGGED FOR BEN as a family-brief deviation.
- **A withholding-rights concept** — boundary 4 (consideration family +
  REM-CAP vacuity). FLAGGED FOR BEN as a family-brief deviation.
- **COV-TAXMATTERS as a concept** — the grab-bag ruling above.
- Partnership-mechanics shapes (§706 closing-of-the-books, §754/§6226(a)
  elections, purchase-price allocation cascades, §752 borrowing windows —
  `a1dbc559…`, `59b5597f…`, `df393645…` §5.21(a)) — deal-structure-
  specific machinery concentrated in two UP-C/partnership deals; open
  world until the commonality report shows a cluster.

**Claim definitions** (five; two registry-hosted enums, three presence):

```
INTENDED_TAX_TREATMENT_KIND_CLAIM_DEFINITION_V1
  claim_definition_key: 'INTENDED_TAX_TREATMENT_KIND'
  version: 1
  allowed_canonical_values: ['REORG_368A', 'TRANSFER_351']
  canonical_value_required_when_present: true

TAX_TREATMENT_PROTECTION_COVENANT_CLAIM_DEFINITION_V1
  claim_definition_key: 'TAX_TREATMENT_PROTECTION_COVENANT'
  version: 1
  allowed_canonical_values: [true]          // presence claim, the
  canonical_value_required_when_present: true  // KNOWLEDGE_QUALIFIER shape

TRANSFER_TAX_ALLOCATION_CLAIM_DEFINITION_V1
  claim_definition_key: 'TRANSFER_TAX_ALLOCATION'
  version: 1
  allowed_canonical_values: ['PARENT', 'SPLIT_EVEN', 'SURVIVING_CORPORATION']
  canonical_value_required_when_present: true

TRANSFER_TAX_COOPERATION_CLAIM_DEFINITION_V1
  claim_definition_key: 'TRANSFER_TAX_COOPERATION'
  version: 1
  allowed_canonical_values: [true]
  canonical_value_required_when_present: true

FIRPTA_CERTIFICATE_DELIVERY_CLAIM_DEFINITION_V1
  claim_definition_key: 'FIRPTA_CERTIFICATE_DELIVERY'
  version: 1
  allowed_canonical_values: [true]
  canonical_value_required_when_present: true
```

No new canonical value types; no validator changes. New concepts and
definitions grow the expected-keys rows as sorted supersets
(content-diffed tests; prior rows byte-untouched).

**Enum decisions, pinned as legal rulings:**

- **`INTENDED_TAX_TREATMENT_KIND` ships TWO codes, both quote-grounded.**
  `REORG_368A` ("qualifying as a \"reorganization\" within the meaning of
  Section 368(a) of the Code", `8cd0787f…`; "Section 368(a)(1)(F)",
  `59b5597f…` — an F-reorg IS a 368(a) reorganization and resolves to
  this code); `TRANSFER_351` ("as a transaction described under Section
  351(a) of the Code", `13a2312c…`; "meeting the requirements of Section
  351 of the Code", `59b5597f…`). The brief's "351" half is grounded, but
  the corpus shape is a WARNING pinned here: both grounded 351 quotes are
  component-scoped inside multi-step/mixed-election structures — one deal
  can carry BOTH codes legitimately, for different transaction steps.
  That is why (i) the producer emits one assertion PER treatment
  statement, each quoting its own component span (`59b5597f…`'s single
  sentence carrying 368(a)(1)(F) AND 351 is TWO assertions), and (ii)
  `treatment_scope_ref` participates in identity so the two never
  collide or dedupe. Out-of-enum treatments (disregarded-entity
  treatments, §708 continuations, Rev. Proc. 2018-12 machinery — pack §6)
  → explicit `pushOpenWorld`, typed
  `TREATMENT_KIND_OUT_OF_VOCABULARY`; the enum grows only by reviewed
  diff with a corpus receipt.
- **The protection covenant is a presence claim, never paired with the
  treatment enum in one claim.** "No impede" drafting and "efforts to
  cause" drafting (both grounded) are ONE legal fact — the parties bound
  themselves to protect the treatment; the strength gradation
  (negative-only vs affirmative-efforts) is qualifier-track material
  (P2 seam) and stays inside the quote as reviewer evidence. And per M3
  rule 1 the producer never asserts "no protection covenant" — absence is
  future scope-closure.
- **`TRANSFER_TAX_ALLOCATION` ships the three GROUNDED bearers, not the
  brief's trio.** The brief proposed COMPANY/PARENT/SPLIT; the corpus
  grounds `PARENT` ("shall be paid by Parent and Merger Sub when due",
  `6b49f790…`, `327f9369…`; "will be paid by Parent", `7f95a228…`),
  `SPLIT_EVEN` ("one-half of all Transfer Taxes … and … one-half",
  `0fedb4c5…`) and `SURVIVING_CORPORATION` ("shall be paid by the
  Surviving Corporation when due", `f6d488d9…`). FACT CORRECTION (audit
  M-1, 2026-08-03): the earlier draft claimed this grounds "NO
  pre-closing-Company bearer anywhere"; that is false as a byte claim —
  card `2f306978…` (deal `a1b07312…`, §11.04(e), TERMINATION_FEE/NULL,
  inside receipt 2's "long tail"): "all transfer, documentary, stamp,
  registration and other similar Taxes imposed with respect to the
  Merger **shall be borne by the Company**." COMPANY bearer bytes DO
  exist in the corpus. The no-COMPANY ruling survives on the correct,
  narrower ground: `2f306978…` sits in an "Expenses"-titled general-
  provisions section under a different family's dispatch (TERMINATION
  territory, per its provision_type), which this family's classifier
  rules never reach — shipping COMPANY as a grounded TAXM-TRANSFER
  bearer from a quote this producer's own dispatch rules can never see
  would itself be REM-CAP vacuity. So `COMPANY` still cannot ship, but
  because no *reachable* pre-closing-Company bearer exists, not because
  no such bearer exists in the corpus at all. `COMPANY` remains
  unshipped; an out-of-enum bearer → explicit `pushOpenWorld`, typed
  `TRANSFER_TAX_BEARER_OUT_OF_VOCABULARY`. The `2f306978…` miss is priced
  in Known costs. `SURVIVING_CORPORATION` is
  deliberately NOT collapsed into either COMPANY or PARENT — the
  surviving corporation is a post-closing entity whose economics depend
  on deal structure; forcing it to a side is rule-3 nearest-fit. Uneven
  splits (60/40 etc.) are not corpus-attested; `SPLIT_EVEN` is pinned to
  the grounded "one-half … one-half" drafting only, and anything else
  routes out-of-vocabulary. FLAGGED FOR BEN (enum shape is a legal
  vocabulary ruling).
- **No numeric promotion anywhere in this family this slice.** The
  family's numerics (pack §6) are IOC-owned dollar thresholds, the 40%
  continuity-of-interest gate (`13894e33…` — a percentage embedded in
  Rev. Proc. 2018-12 machinery), day-count review/dispute windows
  bundled inside the `a1dbc559…` mega-clause, and Code-section citations
  acting as quasi-enums. None has the grounding a typed parser needs
  outside machinery ruled open world above. Consequence: **this slice
  ships NO value parser** — section 2.

**Governed attributes (never in keys; all participate in claim
identity/closure so same-section claims never collide or dedupe):**

- `INTENDED_TAX_TREATMENT_KIND`:
  - `treatment_scope_ref`: OPTIONAL verbatim phrase naming the
    transaction component the treatment covers ("in the case of Company
    Stockholders who receive the Mixed Election Consideration in the
    Merger", `13a2312c…`; "the transaction described in Section
    5.16(b)(vi)", `59b5597f…`). When supplied it is substring-enforced
    against the byte-verified quote (P1 M-3 discipline), typed
    `TREATMENT_SCOPE_REF_NOT_IN_QUOTE` on failure. Optional because the
    whole-transaction form ("the Mergers, taken together", `8cd0787f…`)
    names no component; identity-bearing because the 351/368 component
    pairs in one deal must never dedupe.
  - `treatment_term_ref`: OPTIONAL verbatim defined-term phrase
    ("Intended Tax Treatment", `13894e33…`; "Intended Income Tax
    Treatment", `2c7fb882…`), substring-enforced when supplied
    (`TREATMENT_TERM_REF_NOT_IN_QUOTE`). Evidence anchor only — never
    resolved through the definitions article (pack warning 6; Known
    costs).
- `TAX_TREATMENT_PROTECTION_COVENANT`: `treatment_term_ref` as above,
  optional, substring-enforced.
- `TRANSFER_TAX_ALLOCATION`:
  - `bearer_ref`: REQUIRED verbatim phrase naming who pays ("Parent and
    Merger Sub", "the Surviving Corporation", "Columbus Holdings … and
    Cabot Parent"), substring-enforced, typed
    `BEARER_REF_NOT_IN_QUOTE` on failure. Feeds
    `resolveParty` → new party role `TRANSFER_TAX_BEARER`; a
    two-party split bearer or an unresolvable post-closing entity →
    existing `PARTY_UNRESOLVED` review — priced, correct (the REM
    `LIABILITY_CAP_BEARER` shape). No counterparty tuple is minted (the
    TERMF payee ruling).
- `TRANSFER_TAX_COOPERATION` and `FIRPTA_CERTIFICATE_DELIVERY`: no
  attributes beyond the quote. The FIRPTA deliverer is uniformly "the
  Company" in all three grounding cards; party dimensioning on a 3-card
  set would be fabricated structure.

M3 rule 1 restated for this family, because its drafting invites the
violation: the producer NEVER asserts "this deal is not intended to be
tax-free", "no FIRPTA certificate required", or "transfer taxes
unallocated". Carve-out prose ("provided, however, the parties
acknowledge and agree, that if t…", `31209666…`; "Except as expressly
provided in Article II", `6b49f790…`) is exception text that stays inside
the claim's quote as evidence. Derived ABSENT belongs to the future
scope-closure machinery, forever.

## 2. Value parsers: NONE — a ruled decision, not an omission

Every canonical value this slice produces is a presence `true` or a
registry-hosted enum code gated by allowed-values membership (the
closing-conditions precedent verbatim). There is no money, date, share or
day-count value to parse: the family's numerics are ruled open world or
sibling-owned (Registry, final enum ruling). Consequence pins: no new
`*_PARSE_VERSION` receipt fields exist for this family; the additivity
re-pin (section 4) has one fewer moving part; any future numeric
promotion here (e.g. transfer-tax caps, return-review day counts) starts
with its own corpus receipt and its own typed-abstain parser module —
never by widening this slice's handlers. Every resolved presence/enum
claim carries the honest `buildMechanicalAnswerProvenance({ extraPins: {
gate: 'ALLOWED_VALUES_MEMBERSHIP' } })` tag construction (uniform, one
tag-construction story per family; NO auto-pass-block entry rides on it —
that block is the closing-conditions family's Ben-approved bring-down
scope, not a family-generic device).

## 3. Producer prompt + provider

- **New prompt module** `tax-matters-producer-prompt.js`. The
  capitalisation prompt is NOT edited (PROMPT_VERSION unmoved; recorded
  fixtures replay byte-identically). New `PROMPT_ID
  'native-producer-tax-matters/v1'`, `PROMPT_VERSION 1`, bumped once per
  slice, never mid-slice.
- **Dispatch through `producer-prompt-registry.js`, mandatorily.** The
  seam exists at head (CAPITALISATION + TERMINATION_FEE entries;
  fail-closed nulls; module-private frozen Map). This slice adds ONE
  entry in its own reviewed diff, per the module's own header convention:
  `TAX_MATTERS → buildTaxMattersProducerPrompt`. Unknown family → no
  prompt, no candidates, typed record — never a silent capitalisation
  fallback. The capitalisation and termination-fee byte-identical-replay
  tests guard the addition.
- **Section-family classifier extension** (`section-family-classifier.js`
  — stage-1 rules are added per family in that family's reviewed diff;
  this is that diff for TAX_MATTERS). Stage-1 rules authored FRESH from
  the grounded section titles, using the financing-covenants
  `runStage1(title, article_context)` signature (build-order pin: if the
  financing slice has landed, the extended signature exists; if this
  slice lands first, it extends the signature exactly per that spec's §3
  and bumps `SECTION_FAMILY_CLASSIFIER_VERSION` — the seam amendment is
  built once, to that spec, whichever family arrives first). Independent
  of that seam bump: adding TAX_MATTERS stage-1 rules itself bumps
  `SECTION_FAMILY_CLASSIFIER_VERSION` in BOTH branches, so §4's
  field-level diff is honest regardless of build order (audit m-3):
  - `/\btax matters\b/i` — "Tax Matters", "Certain Tax Matters" (§6.16,
    §6.18, §6.20-article, §7.17, §5.15, §7.10 homes above).
  - `/\btransfer taxes\b/i` — the §9.12/§9.10/§10.10/§8.11 standalone
    sections. NOT article-gated: the corpus files these in
    general-provisions articles (MISC_BOILERPLATE homes), and gating on a
    covenants article would make TAXM-TRANSFER's dominant grounded text
    unreachable — the REM-CAP vacuity check applied at design time.
  - `/\b(intended )?tax treatment\b/i` — "Tax Treatment" (§7.4 form),
    "Intended Tax Treatment" (§2.14, an ARTICLE-II home — again not
    article-gated, same vacuity reasoning), "Tax Treatment; Purchase
    Price Allocation" (§5.21).
  - `/\bFIRPTA\b/` (case-sensitive acronym) — "FIRPTA Affidavits"
    (§6.20), "FIRPTA Certificate".
  - Bare `/\btaxes\b/i` fires ONLY with `article_context === 'COVENANTS'`
    (the deal `dfaa71fa…` §5.12 "Taxes" covenant title) — without the
    gate it would dispatch every "Taxes; Tax Returns" REP section
    (37 deals) and the Annex-A definition entries.
  - **Declines, pinned:** `article_context === 'CONDITIONS'` → decline
    regardless of title (boundary 1 — tax-opinion conditions are the
    closing-conditions family's population); REPRESENTATIONS and
    DEFINITIONS article_context → decline for every rule except the
    never-gated three above? No — pinned the honest way: the four
    non-bare rules run ungated (their grounded homes span COVENANTS,
    GENERAL PROVISIONS and ARTICLE II), EXCEPT that CONDITIONS and
    REPRESENTATIONS article_context decline all of them (the §3.29
    "Reorganization" rep and "Taxes; Tax Returns" reps must not
    dispatch; rep-side FIRPTA reps must not dispatch — boundary 6).
    DEFINITIONS article_context declines all rules (DEF-TAX/DEF-TAXRETURN
    are the key-defined-terms family's).
  - Stage 1 is validated against ALL deals' section titles before the
    prompt is ever dispatched (the repo classify-rules safety check) as a
    review-time script against live corpus data — never stubbed into
    fixtures or promoted into `npm test` (the IOC test-5 discipline). The
    known collision surface to verify is the REAL one: "Tax Matters
    Agreement (TMA)" shadow definitions, "Taxes; Tax Returns" rep titles,
    "Tax Opinion" condition titles, and the antitrust-filed
    `[PROPOSED] Transaction Tax Cooperation` card (`92feaecb…`).
  - Stage 2 (AI-assisted, Ben's 2026-08-02 ruling) applies unchanged with
    `SECTION_FAMILY_AI_CLASSIFIED` provenance and the
    `SECTION_FAMILY_AI_UNVERIFIED` auto-pass block. Known hole, priced:
    the shadow population's wrong-bucket homes (tax cooperation filed
    under ANTITRUST_REGULATORY, `92feaecb…`/`bba389f1…`) reach this
    prompt only via stage 2 or not at all; live-run handoffs measure the
    miss rate.
- **Response shape:** a `tax_matters_assertions` array — each element
  `{ section_reference, assertion_kind: 'INTENDED_TREATMENT' |
  'TREATMENT_PROTECTION' | 'TRANSFER_TAX_ALLOCATION' |
  'TRANSFER_TAX_COOPERATION' | 'FIRPTA_CERTIFICATE', verbatim quote }`
  plus per-kind fields: INTENDED_TREATMENT carries `treatment_kind`
  (two-code vocabulary), optional `treatment_scope` (verbatim), optional
  `treatment_term` (verbatim); TREATMENT_PROTECTION carries optional
  `treatment_term`; TRANSFER_TAX_ALLOCATION carries `bearer` (three-code
  vocabulary) and `bearer_ref` (verbatim). One element per legal fact,
  and the prompt owns the family's defining split discipline:
  - The `a1dbc559…` mega-clause (eleven lettered sub-clauses) is N
    assertions, each quoting the sub-span carrying its own operative
    words; unsplit it fails the full-table check (section 4) by design.
  - The `59b5597f…` two-treatment sentence is TWO INTENDED_TREATMENT
    assertions (368(a)(1)(F) span; 351 span).
  - A protection covenant whose sentence embeds the 368(a) cite
    (`8cd0787f…`) is TWO assertions — TREATMENT_PROTECTION and
    INTENDED_TREATMENT — whose quotes may overlap on the shared sentence
    (the closing-conditions NO_MAE/CONTINUING co-resolution shape;
    section 4 pins the pair).
  - A split transfer-tax allocation (`0fedb4c5…`) is ONE assertion
    (`SPLIT_EVEN`) — the two one-half limbs are one legal fact.
  - PRESERVE-THE-NOVEL retained verbatim; when unsure of any enum, keep
    the assertion in `open_world_candidates` — REIT covenants,
    tax-sharing prose, withholding text, opinion-condition text,
    partnership mechanics are all named in the prompt as NOT this
    family's assertions (boundaries 1–4; open-world or silence, never
    forced fit). The producer never asserts a negative (M3 rule 1).
- **Provider (`anthropic-provider.js`):** ONE new generic key,
  `NATIVE_TAX_MATTERS_CANDIDATE`, proposal_kind `TAX_MATTERS`
  (≠ OPEN_WORLD). `tax_matters_assertions` is NOT added to
  `REQUIRED_RESPONSE_LISTS` (the share_count precedent verbatim: recorded
  responses predate the key; missing/non-array reads as empty list, never
  a schema failure). Quote byte-verification identical to existing
  proposals. Golden evals: recorded responses are never hand-edited into
  the new shape; the first tax-matters recordings are minted by the first
  live runs, each its own dated handoff.

## 4. Resolver wiring (`candidate-resolution.js`)

- **ONE new `RESOLUTION_UNCONDITIONAL` entry** (P1 M-2: the Map is keyed
  on generic_claim_key alone): `NATIVE_TAX_MATTERS_CANDIDATE`,
  `deterministic_kind: null`, `attachment_position: null`,
  `registered_claim_definition_key: null`, `concept_key: null` (explicit,
  with the TERMR build-time check that nothing reads
  `mapping.concept_key` before the handler's kind map runs),
  `party_field: null` (party is per-kind: only TRANSFER_TAX_ALLOCATION
  mints a party, so the handler mints it, not the table row).
  `MAPPING_TABLE_VERSION` bumped; table-validation still asserts no
  duplicate generic keys.
- **Handler split on `assertion_kind`** via a frozen map:
  `INTENDED_TREATMENT → TAXM-TREATMENT × INTENDED_TAX_TREATMENT_KIND`;
  `TREATMENT_PROTECTION → TAXM-TREATMENT ×
  TAX_TREATMENT_PROTECTION_COVENANT`;
  `TRANSFER_TAX_ALLOCATION → TAXM-TRANSFER × TRANSFER_TAX_ALLOCATION`;
  `TRANSFER_TAX_COOPERATION → TAXM-TRANSFER × TRANSFER_TAX_COOPERATION`;
  `FIRPTA_CERTIFICATE → TAXM-FIRPTA × FIRPTA_CERTIFICATE_DELIVERY`.
  Out-of-enum assertion_kind → explicit `pushOpenWorld`, typed reason
  (P1 C-4: the main loop's open-world routing keys on proposal_kind and
  will not catch it).
- **Full-table kind ambiguity rule (the TERMF C-3 / closing-conditions
  device — REQUIRED: this family's sections are compound as the NORM,
  the `a1dbc559…` mega-clause being the corpus's worst case):** the
  handler runs ALL kinds' corroboration patterns over the assertion's
  single byte-verified quote and reduces to the maximal matched-kind set
  with exactly ONE pinned co-resolution pair:
  `{TREATMENT_PROTECTION, INTENDED_TREATMENT}` — grounded necessity, not
  convenience: the corpus norm (`8cd0787f…`) puts the treatment cite
  INSIDE the protection sentence, so both kinds' patterns matching one
  quote is the drafting's ordinary shape; when both match, the ASSERTED
  kind resolves if its own patterns match, and each of the two
  assertions resolves independently (the NO_MAE/MAE_CONTINUING device,
  adapted: here neither pattern set subsumes the other, so the pair is
  pinned as co-resolvable rather than subsuming — a named, tested
  exception). Every OTHER multi-kind match (≥2 distinct, non-pinned
  kinds) → review, typed `AMBIGUOUS_TAX_ASSERTION_KIND`. Per the
  remedies M3 correction, there is NO resolver-side sub-quote search:
  corroboration runs over the assertion's own quote; the producer owns
  splits; a human review plus producer re-assertion is the narrow-quote
  path. Asserted-kind pattern mismatch → review, typed
  `TAX_KIND_UNCORROBORATED`.
- **Corroboration tables (frozen resolver constants; label must bind to
  quote text; every pattern grounded in a committed fixture quote):**
  - Kind patterns:
    - `INTENDED_TREATMENT` ↔ /\bSection 368\(a\)/ OR
      /\bSection 351(\(a\))? of the Code\b/ OR
      /qualif\w* (for|as)\b.{0,40}(reorganization|Intended (Income )?Tax
      Treatment)/i — grounded `8cd0787f…`, `13a2312c…`, `59b5597f…`,
      `13894e33…`.
    - `TREATMENT_PROTECTION` ↔ /\bprevent or impede\b/i OR
      /efforts to cause the Mergers? to qualify/i — grounded
      `13894e33…`, `8cd0787f…`, `31209666…`, `2c7fb882…`.
    - `TRANSFER_TAX_ALLOCATION` ↔ (/\bTransfer Taxes\b/ (case-sensitive
      defined term) OR /transfer, documentary, sales, use, stamp/i) AND
      /\b(shall|will) be (paid|responsible)/i — grounded `6b49f790…`,
      `0fedb4c5…`, `f6d488d9…`, `327f9369…`, `7f95a228…`.
    - `TRANSFER_TAX_COOPERATION` ↔ /cooperate in the preparation,
      execution and filing/i — grounded `9681d401…`. Deliberately narrow
      (one grounded form); a cooperation assertion whose quote drafts
      differently queues `TAX_KIND_UNCORROBORATED` — fail closed, priced.
    - `FIRPTA_CERTIFICATE` ↔ /\bFIRPTA\b/ (case-sensitive acronym) OR
      /United States real property holding corporation/ OR
      /\b1\.897-2\b/ — grounded `effb1c28…`, `fe6ce201…`.
  - **`treatment_kind` value corroboration** (against the assertion's
    quote): `REORG_368A` ↔ /\bSection 368\(a\)/ (grounded `8cd0787f…`,
    `59b5597f…`); `TRANSFER_351` ↔ /\bSection 351(\(a\))? of the Code\b/
    (grounded `13a2312c…`, `59b5597f…`). Asserted code's pattern absent →
    review, typed `TREATMENT_KIND_UNCORROBORATED` — **this catches the
    family's defining indirection trap (pack warning 6):** a quote
    reading only "qualifying for the Intended Tax Treatment" grounds the
    PROTECTION claim but can NEVER quote-locally corroborate a treatment
    code (the 368(a) language lives in a distant definition); such
    assertions queue for Ben rather than resolving on a defined-term
    guess. Resolving through the definitions article is cross-reference
    machinery (relationship layer), never done here. BOTH code patterns
    in one quote (`59b5597f…` unsplit) → review, typed
    `AMBIGUOUS_TREATMENT_KIND`; the producer splits.
  - **`bearer` value corroboration**: `PARENT` ↔
    /\b(shall|will) be paid by Parent( and Merger Sub)?\b/ (grounded
    `6b49f790…`, `327f9369…`, `7f95a228…`); `SPLIT_EVEN` ↔
    /one-half of all Transfer Taxes/ (grounded `0fedb4c5…`);
    `SURVIVING_CORPORATION` ↔ /paid by the Surviving Corporation/
    (grounded `f6d488d9…`). Asserted bearer's pattern absent → review,
    typed `TRANSFER_TAX_BEARER_UNCORROBORATED`; ≥2 bearer
    patterns → review, typed `AMBIGUOUS_TRANSFER_TAX_BEARER`. (Per audit
    M-3/M-4: a mislabelled cooperation-only quote does NOT land here by
    construction — it fails the kind gate first, per the
    `TRANSFER_TAX_ALLOCATION` kind-pattern rule above, and queues
    `TAX_KIND_UNCORROBORATED` instead; `TRANSFER_TAX_BEARER_UNCORROBORATED`
    fires only once a quote has already passed the kind gate but names no
    corroborated bearer.)
  - Enum membership: both enum definitions gate through
    `canonicalValueAllowed`; out-of-vocabulary codes → explicit
    `pushOpenWorld` with the typed reasons named in section 1 — never a
    bare review destination, never an alias.
- **Party:** TRANSFER_TAX_ALLOCATION's `bearer_ref` flows through
  `resolveParty` → new role `TRANSFER_TAX_BEARER`; unresolvable (split
  bearers naming two entities; "the Surviving Corporation") → existing
  `PARTY_UNRESOLVED` review — priced, correct. No other kind mints a
  party; no counterparty tuples anywhere (TERMF payee ruling).
- **Materiality: NEW tier proposed, flagged for Ben.** `{ rank: 80,
  label: 'TAX_MATTERS', concept_key_prefixes: ['TAXM-TREATMENT',
  'TAXM-TRANSFER', 'TAXM-FIRPTA'] }` — exact keys, deliberately never a
  bare `TAXM-` prefix (the financing-covenants Grounding-correction-3
  discipline: a bare prefix would silently sweep every future TAXM-*
  family into this tier without review). Rank 80 sits between
  CLOSING_CONDITIONS (70) and NOTICES_ADMINISTRATIVE (90) and collides
  with nothing at head (~523–534); the ledger's explicit M3 ordering
  names conditions ahead of notices and does not name tax matters — the
  placement is a Ben call, not an implementer default. **Pre-concept
  review routing (TERMF M-3):** review items minted before the kind map
  runs carry conceptFamily `'TAXM-TREATMENT-PENDING'` — a routing token
  only, never registered, never publishable — which startsWith-matches
  the `TAXM-TREATMENT` tier key → rank 80 instead of UNCLASSIFIED 99.
- **Receipt + additivity (honest form, P1 M-1):** with no tax-matters
  input, resolution output must be byte-identical EXCEPT
  `mapping_table_version`, `contract_vocabulary_digest` (under the new
  bundle version), the bumped `section_family_classifier_version`, and
  the recomputed `resolution_receipt_id`; documented in the PR as a
  field-level diff. No parser-version fields exist to add (section 2).
  Skipping the version bump to keep old pins green is the named
  anti-pattern.

## 5. Lexicon additions (`LEXICAL_FAMILY_LEXICON` version bump; every edit
a reviewed diff; keys MUST be registered concept keys — which is why all
three concepts land in this same slice; explicit `\b` on every
case-sensitive defined-term regex; static max ≤ 128; rationale per
pattern)

- `TAXM-TREATMENT`: BOUNDED_REGEX /\bIntended (Income )?Tax Treatment\b/
  (case-sensitive defined term; `13894e33…`, `31209666…`, `2c7fb882…` —
  the `(Income )?` alternative is the grounded `dfaa71fa…` variant);
  LITERAL_PHRASE "prevent or impede" (`13894e33…`, `8cd0787f…`);
  BOUNDED_REGEX /\bSection 368\(a\)/ (`8cd0787f…`, `59b5597f…`);
  LITERAL_PHRASE "plan of reorganization" (the Treas. Reg.
  §1.368-2(g)/§1.368-3(a) boilerplate inside `a1dbc559…`, pack §6).
- `TAXM-TRANSFER`: BOUNDED_REGEX /\bTransfer Taxes\b/ (case-sensitive
  defined term; `6b49f790…`, `0fedb4c5…`); LITERAL_PHRASE
  "transfer, documentary, sales, use, stamp" (`6b49f790…`, `f6d488d9…`,
  `327f9369…`).
- `TAXM-FIRPTA`: LITERAL_ACRONYM "FIRPTA" (`effb1c28…`, `fe6ce201…`);
  LITERAL_PHRASE "United States real property holding corporation"
  (`effb1c28…`).

**Priced cross-hit noise, stated (the TERMR M-4 discipline):**
/\bSection 368\(a\)/ verifiably fires inside REP-side "Reorganization"
reps (`13894e33…` §3.29), CONSID reorg recitals, and the conditions-
article tax-opinion text — expected `LEXICAL_UNMATCHED_SIGNALS` hits
outside TAXM candidate evidence. Accepted and recorded: the code cite is
the family's strongest veto tell; deletion asymmetry applies; the
anti-noise test pins one such hit as EXPECTED so a future silent deletion
breaks a test. Same for /\bTransfer Taxes\b/ inside CONSID-EXCHANGE
exchange-agent boilerplate (17 cards, query receipt 2) — a veto miss
there costs nothing (consideration candidates cover their own sections)
and the unmatched-signal hit is pinned as expected.

**Priced exclusions** (each a recorded blind spot; veto-only design means
a miss costs a missed VETO, never a wrong claim):

- Bare "Tax"/"Taxes"/"Tax Return(s)"/"Code": fire in DEF/REP/IOC/efforts
  sections corpus-wide; the IOC lexicon already keys the election/return
  phrases to IOC-TAX, and duplicating them here would flood both
  families' signals.
- "deduct and withhold" / "withholding": 52 cards/40 deals of
  consideration-article boilerplate (query receipt 1) — boundary 4;
  guaranteed noise flood and sibling territory besides.
- "tax sharing": 34 of 44 hits are rep boilerplate (query receipt 3); no
  registered concept consumes it (nothing promoted — not a
  `LEXICON_FAMILY_UNCOVERED` row; the shape is outside the registered
  domain until its own slice, named here so nobody reads absence as
  coverage).
- REIT vocabulary (REIT, "Qualifying Income", "REIT Requirements",
  §856/§857): P4 territory (boundary 2), one-deal-concentrated (pack
  warning 7).
- Bare "reorganization": fires in DGCL charter provisions, §3.29 rep
  titles, and bankruptcy boilerplate; only the §368(a) cite and the
  "plan of reorganization" phrase discriminate.
- Bare "certificate": officer's-certificate closing machinery
  corpus-wide; only the FIRPTA-specific phrases pattern.

## 6. Acceptance tests (real-fixture-first; the P1 M-5 pre-rerun-harness
honesty pins apply VERBATIM — no recorded native runs exist for this
family; every resolver/registry test drives synthetic compiled candidates
pinned to REAL corpus quotes, byte-verified against committed fixture
bytes, clearly labeled as the pre-rerun harness)

0. **Fixture commit:** section text for the named cards (`13894e33…`-§7.4
   pack quote, `8cd0787f…`-§7.4, `31209666…`, `13a2312c…`, `59b5597f…`,
   `2c7fb882…`, `6b49f790…`, `0fedb4c5…`, `f6d488d9…`, `327f9369…`,
   `7f95a228…`, `9681d401…`, `effb1c28…`, `fe6ce201…`, `a1dbc559…`)
   committed as LITERAL production bytes under
   `tests/fixtures/canonical-v2/tax-matters-fixtures/`, provenance
   headers with deal uuid + provision_card uuid + retrieval date +
   provision_type/subtype INCLUDING NULL and wrong-bucket homes where
   true — and NEVER v1 `section_ref` label strings (the IOC lint pin).
   Every test quote asserted a contiguous substring of committed bytes.
1. **Registry:** next version compiles; prior arrays untouched
   byte-for-byte; three concepts + five definitions validate with zero
   validator changes; expected-concept-keys AND expected-claim-keys
   superset-diffs written against sorted CONTENT, never the numeral; a
   test asserts the kind→(concept, definition) frozen map's values are
   all registered keys.
2. **Resolution (pre-rerun harness, synthetic candidates over committed
   bytes):** `8cd0787f…` — a TREATMENT_PROTECTION assertion and an
   INTENDED_TREATMENT/REORG_368A assertion BOTH resolve from the shared
   sentence (the pinned co-resolution pair; two claims, never
   `AMBIGUOUS_TAX_ASSERTION_KIND`); `13894e33…` — protection resolves,
   and an INTENDED_TREATMENT assertion on the same defined-term-only
   quote → `TREATMENT_KIND_UNCORROBORATED` (the pack-warning-6
   indirection trap as a permanent regression fixture); `59b5597f…`
   unsplit → `AMBIGUOUS_TREATMENT_KIND`, its two hand-enumerated
   component sub-quotes resolve REORG_368A and TRANSFER_351 as distinct
   non-deduping claims (treatment_scope_ref in identity); `13a2312c…`
   resolves TRANSFER_351 with scope-ref substring enforcement (and a
   deliberately corrupted scope ref → `TREATMENT_SCOPE_REF_NOT_IN_QUOTE`);
   bearer table — `6b49f790…`/`327f9369…`/`7f95a228…` → PARENT (audit
   m-2 note: `7f95a228…`'s operative sentence alone, in lowercase
   "taxes" and a word order that misses
   `/transfer, documentary, sales, use, stamp/i`, does NOT pass the kind
   gate on its own — the match comes from the quote's own heading, "10.10.
   Transfer Taxes.", via `/\bTransfer Taxes\b/`; the fixture's
   expected-outcome enumeration must include that heading span, not the
   operative sentence in isolation),
   `0fedb4c5…` → SPLIT_EVEN (one claim, not two), `f6d488d9…` →
   SURVIVING_CORPORATION, a COMPANY-coded assertion →
   `pushOpenWorld`/`TRANSFER_TAX_BEARER_OUT_OF_VOCABULARY`, a
   PARENT-coded assertion on the `f6d488d9…` quote →
   `TRANSFER_TAX_BEARER_UNCORROBORATED`, never a resolved swapped bearer;
   `9681d401…` resolves TRANSFER_TAX_COOPERATION on the cooperation
   sentence, and an ALLOCATION assertion on that same card's separate
   allocation limb ("assume liability for and pay any Transfer Taxes")
   → `TAX_KIND_UNCORROBORATED` (audit M-3/M-4 correction: the kind gate,
   not bearer corroboration, is where this fails);
   `effb1c28…`/`fe6ce201…` resolve FIRPTA presence; the `a1dbc559…`
   mega-clause at full width → `AMBIGUOUS_TAX_ASSERTION_KIND`;
   out-of-enum assertion_kind exercises explicit `pushOpenWorld`;
   `answer_provenance.gate === 'ALLOWED_VALUES_MEMBERSHIP'` asserted on
   every resolved claim; materiality rank 80 asserted on a resolved claim
   AND a `TAXM-TREATMENT-PENDING` review item; additivity re-pin with the
   documented field-level diff.
3. **Identity:** two same-section INTENDED_TREATMENT claims differing
   only in treatment_kind/scope mint distinct stable identities; a
   protection claim and a treatment claim over overlapping quotes never
   collide or dedupe; allocation and cooperation claims in one section
   never dedupe; re-run is byte-stable.
4. **Cross-family boundary pins (each named for its boundary):** (b-1)
   the response-shape enum contains no condition-side kind, and a
   conditions-article fixture title ("Conditions to the Obligations of
   Each Party") declines classification → no prompt, typed record; (b-2)
   zero REIT tokens in the compiled prompt text, corroboration tables and
   lexicon (asserted by grep over the slice's modules); (b-3, build-order
   pinned per boundary 3): if INTERIM_OPERATING is a classifier family at
   build time, an INTERIM_OPERATING-classified fixture section is never
   dispatched to the tax-matters prompt; if it is not yet a classifier
   family (this slice landing first), the test instead asserts that none
   of this slice's own stage-1 rules fire on an INTERIM_OPERATING-titled
   fixture, upgraded to the full dispatch assertion in the IOC slice's
   own reviewed diff once that classifier family exists; (b-4) zero
   withholding vocabulary anywhere in
   the slice's modules, and the `NATIVE_TAX_MATTERS_CANDIDATE` handler
   never resolves an assertion whose quote is the consideration
   withholding fixture (queues `TAX_KIND_UNCORROBORATED`); (b-6) a
   representations-article title ("Taxes; Tax Returns") declines
   classification.
5. **Provider + dispatch:** response missing `tax_matters_assertions` →
   empty list, not schema failure; recorded capitalisation AND
   termination-fee fixtures replay byte-identically through the registry
   with the TAX_MATTERS entry present; unknown family → no prompt, typed
   record; classifier fixtures: "Tax Matters"/"Certain Tax Matters"/
   "Transfer Taxes"/"Intended Tax Treatment"/"FIRPTA Affidavits" titles
   classify TAX_MATTERS; bare "Taxes" classifies ONLY under COVENANTS
   article_context; conditions/reps/definitions article fixtures decline;
   the all-titles corpus validation runs as a review-time script (live
   Supabase; never stubbed into `npm test`).
6. **Lexicon:** table validation (keys registered — the three new
   concepts; explicit `\b` on case-sensitive regexes; static max ≤ 128;
   rationale per pattern; content hash re-pinned; version bump);
   anti-noise regression paragraph extended with rep-article "Taxes; Tax
   Returns" prose, a "deduct and withhold" consideration quote, a "Tax
   sharing agreement" rep sentence and a REIT §856 sentence — asserted
   zero hits under the exclusions; one EXPECTED unmatched-signal pinned
   for /\bSection 368\(a\)/ inside a rep-article quote and one for
   /\bTransfer Taxes\b/ inside a CONSID-EXCHANGE quote (deletion-proofed
   by test); each surviving pattern hits its own grounding quote in
   committed fixtures; determinism permutation tests green under the
   grown table.
7. Full suite + `npm run build` + forbidden-patterns (fixtures inside the
   exempt directory class; zero new exemption entries — any collision is
   fixed by restructuring the offending file, never by widening
   FILE_PATTERN_EXEMPTIONS); phase allowlist for the slice's files.

## Out of scope

- Tax-opinion COOPERATION covenants / representation-letter delivery
  (one REIT-concentrated grounding card; open world with `2c7fb882…`
  recorded as the candidate grounding card — promotion is a follow-on
  reviewed diff once non-REIT grounding exists); ALL condition-side tax
  opinions (boundary 1); REIT anything (boundary 2).
- Tax-sharing-agreement termination (zero family-owned grounding — query
  receipt 3; open world; family-brief deviation flagged for Ben).
- Withholding rights (boundary 4; family-brief deviation flagged for
  Ben).
- IOC-TAX and every interim-operating tax restriction, including the
  misfiled `53eb7ff3…`/`21e6844a…` transfer-tax cards (flagged to
  ingest-QA, boundary 3).
- REP-T-TAX / REP-B-TAX / the spin-off tax rep / FIRPTA reps (boundary
  6); DEF-TAX / DEF-TAXRETURN and the §5(a) mislabel + warning-5
  contamination (boundary 7; ingest-QA).
- Partnership/UP-C mechanics (§706/§708/§741/§751/§754/§755/§1060/
  §6226(a)/§752, purchase-price allocation cascades, push-out elections),
  the Rev. Proc. 2018-12 continuity machinery and its 40% threshold, all
  day-count review/dispute windows, the depreciation-life enumeration —
  open world, named with their grounding in the pack (§3, §6).
- The 44-card `[PROPOSED]` shadow population as a backfill target — its
  six wrong-bucket homes are flagged to ingest-QA; v2 reaches the
  underlying TEXT through classification + live runs, never by absorbing
  v1 labels.
- `taxReorgIntended`/`taxReorgText` (boundary 5); `FAMILY_MAPPING_TABLE`
  extension for v1↔v2 subtype mapping (separate Fable+Ben table edit —
  the COV-TAXMATTERS grab-bag split makes this table Ben-reviewed, never
  implementer-inferred).
- Live re-extraction runs (dated handoffs; until they land, no report
  may claim native tax-matters extraction — M-5); any M3 amendment; any
  scope-closure/ABSENT work; cross-deal canonicalization of any verbatim
  phrase; defined-term resolution of "Intended Tax Treatment" through
  the definitions article (relationship layer).

## Known costs, stated up front

- **The defined-term indirection is the family's dominant designed review
  class:** 27 cards/8 deals reference "Intended Tax Treatment" without a
  local 368(a)/351 cite (pack warning 6), so INTENDED_TREATMENT
  assertions on those quotes queue `TREATMENT_KIND_UNCORROBORATED` until
  the relationship layer can resolve the defined term. A queued correct
  claim beats a defined-term guess; the protection-covenant claim still
  resolves on those deals, so presence coverage does not suffer.
- **Mega-clause bundling** (`a1dbc559…`) means unsplit producer output
  queues `AMBIGUOUS_TAX_ASSERTION_KIND` at material volume until
  producers split reliably — never a reason to loosen the full-table
  check; two-strike escalation applies to prompt iteration.
- **TAXM-FIRPTA is a 3-deal grounding set** — the smallest in the wave;
  if live runs surface variant drafting (e.g. 1445-only certificates
  without the FIRPTA acronym), coverage extends by reviewed diff, and
  misses until then cost typed queue items, never wrong claims.
- **The bearer enum has no COMPANY code** — a genuine
  pre-closing-Company-bears deal routes `pushOpenWorld` rather than
  resolving; correct under the grounding rule, and the commonality
  report is the promotion path. Corrected per audit M-1 (2026-08-03):
  COMPANY-bearer bytes DO exist in the corpus (`2f306978…`, deal
  `a1b07312…`, §11.04(e)) — but in a section this family's dispatch
  rules cannot reach (an "Expenses"-titled section, TERMINATION_FEE
  territory), so it is priced as an unreachable-grounding miss, not a
  corpus-unattested shape: `2f306978…` never surfaces to this producer
  at all, and a future COMPANY promotion would need its OWN reachable
  grounding, not this card.
- **The `65a3e3c8…`/`70384d8d…` EVEN-split miss** (audit M-5,
  2026-08-03): "shall be borne equally by PubCo and Parent" is a
  corpus-attested SPLIT_EVEN shape whose "borne"/"borne equally"
  drafting matches neither the shipped kind-verb pattern nor
  `SPLIT_EVEN`'s pattern; the card is not counted as TAXM-TRANSFER
  grounding this slice and a corroboration attempt on it queues
  `TAX_KIND_UNCORROBORATED`. Extending the verb/SPLIT_EVEN patterns to
  cover "borne"/"borne equally" is a candidate follow-on (its own
  corpus receipt, its own reviewed diff), not adopted this slice.
- **Wrong-bucket shadow content reaches this producer only via stage-2
  AI classification** (ANTITRUST_REGULATORY-filed tax cooperation) —
  typed, measurable under-coverage; the live-run handoffs measure it.
  FACT CORRECTION (audit M-7, 2026-08-03): the earlier draft claimed
  STRUCTURE_MECHANICS-filed treatment text is covered by the ungated
  stage-1 title rules; that is false for this spec's own cited grounding
  cards — `2a24d752…` (deal `dfaa71fa…`, §1.7 "Income Tax Consequences",
  cited in TAXM-TREATMENT's grounding list) and `4a471e66…` (deal
  `b57d0d65…`, §1.10 "Tax Reorganization", STRUCT-MERGER) both match no
  stage-1 rule (`/\b(intended )?tax treatment\b/i` does not match either
  title). Both reach this producer only via stage 2, same as the
  ANTITRUST_REGULATORY-filed cooperation text — a sanctioned path, but
  the sentence must not claim stage-1 coverage for them. (Candidate
  follow-on, not adopted this slice: `/\btax reorganization\b/i` and/or
  `/\bincome tax consequences\b/i` stage-1 rules with these two cards as
  receipts, subject to the all-titles collision check before shipping.)
- **The narrow TRANSFER_TAX_COOPERATION pattern** (one grounded form)
  will queue differently-drafted cooperation covenants; priced — fail
  closed beats a loose /cooperate/ pattern that would corroborate every
  efforts covenant in the corpus.
- Case-sensitive defined-term patterns (Transfer Taxes, Intended Tax
  Treatment, FIRPTA) miss lower-case drafting variants; the
  case-insensitive companion phrases cover most shapes, and a miss costs
  a missed veto, never a wrong claim.
