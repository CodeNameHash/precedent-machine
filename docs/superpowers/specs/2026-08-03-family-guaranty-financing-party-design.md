# Family — Guaranty & financing-party provisions (GTY-*)

**Date:** 2026-08-03. **Status:** AUDIT-AMENDED (3 CRITICAL + 1 MATERIAL +
3 MINOR fixes applied per 2026-08-03 adversarial audit; 0 parked for
Fable) (program convention: spec-detail → audit → build → review).
**Amendment note (2026-08-03 adversarial audit, AMEND verdict):** this
draft was amended in place per audit findings CRITICAL-1/-2/-3,
MATERIAL-1, and MINOR-1/-2/-3 before build; see the amended passages
throughout (GTY-PERF population 4→5, receipt corrections, stage-1 regex
widened, ingest-QA duplicate count 4→5, two repo line citations
corrected). No CRITICAL/MATERIAL finding was disputed or parked.
**Parent:** `2026-08-02-openworld-promotion-program.md` (five-layer promotion
structure and cross-slice invariants apply verbatim).
**Template:** `2026-08-02-p1-captable-numerics-design.md` (slice shape,
typed-abstain parser discipline, corroboration tables, coverage-map
anchored-overlap + honesty pins — this family ships ZERO parsers, so the
P1 discipline binds mostly through the corroboration tables and the
"no parser is a ruled decision" clause; see section 2).
**Wave exemplars bound:**
`2026-08-02-family-termination-fee-design.md` (BUILT AND COMMITTED at
e98695a — `producer-prompt-registry.js`, `section-family-classifier.js`,
`termination-fee-producer-prompt.js`, `termination-fee-parse.js` are the
real registry-dispatch exemplars this spec writes against; the registry
entry and the stage-1 title rule land in this family's own reviewed diff
per the registry module's own header convention; ALSO the BINDING owner
of all fee-amount machinery — guaranty caps keyed to termination-fee
amounts cite it, never rebuild it, section Boundaries 2);
`2026-08-02-family-specific-performance-remedies-design.md` (the
REM-NONRECOURSE / REM-JURY ownership this family is scoped around — its
Fable-ruled REM-CAP dispatch-vacuity standard is applied at design time to
every concept below, and its query receipt 2 + `bd837f1d…` candidate-card
ruling dispose of this family's entire financing-source shield
population — see Boundaries 1, the family's defining boundary);
`2026-08-02-family-closing-conditions-design.md` (presence-claim shape;
pinned co-resolution pairs; "no parser is a ruled decision");
`2026-08-03-family-dno-indemnification-design.md` (heading-grounded
stage-1 rules recovered from quote bytes because v1 `section_ref` labels
are untrusted — adopted verbatim, and this family carries a live
cross-hit INTO that family's sections, priced in section 5);
`2026-08-03-family-dividends-design.md` (small-family honesty: concept
count and slice weight scale to the real evidence — this family ships
TWO concepts and THREE presence definitions, nothing more);
`2026-08-02-family-financing-covenants-design.md` (the
`runStage1(title, article_context)` classifier signature — adopted, with
the build-order pin: head is still `runStage1(title)`
(`section-family-classifier.js:177`); whichever wave family lands first
extends the signature once, to that spec's §3, and bumps
`SECTION_FAMILY_CLASSIFIER_VERSION`; ALSO the owner of all Commitment
Letter / Debt Financing vocabulary — Boundaries 3);
`2026-08-02-family-ioc-design.md` (compound-limb splitting is producer
work; the fixture-header lint pin; ALSO the owner of guarantee-incurrence
restrictions and their dollar baskets — Boundaries 5).
**Protocol authority:** docs/codex-program/EXECUTION-LEDGER.md — M3 review
protocol + extraction semantics rules 1–3. This spec may not amend them.
Rule 1 is restated in section 1: guaranty-rep drafting ("There is no
default or breach under any Guarantee") is quoted-positive text with
negative content and is deliberately NOT promoted — see the no-default
ruling.
**Lexicon authority:** `2026-08-02-lexical-disagreement-net-design.md`
(word boundaries, case-sensitive defined terms via LITERAL_ACRONYM /
BOUNDED_REGEX with explicit `\b`, deletion asymmetry, priced blind spots;
static max ≤ 128; multi-form entries as separate pattern_ids).
**Materiality:** no tier covers this family today (`MATERIALITY_TABLE`,
`lib/canonical-v2/native-producer/candidate-resolution.js:658–672`,
carries ranks 10/20/30/40/50/52/55/60/70/90 and no guaranty-shaped
prefix — a resolved GTY claim would rank UNCLASSIFIED 99, below
notices). Section 4 proposes ONE exact-keys tier, flagged for Ben.

## Corpus grounding (production Supabase, project `tzulhdasmioeechxapdy`;
evidence pack read 2026-08-02/03 — pack quotes are ground truth, cited by
provision_card id; three supplementary SELECT-only queries run 2026-08-03
by this spec's author, receipts inline below)

**Population honesty first — this family is the corpus's largest
UNLABELED population.** No guaranty-shaped code or family exists
anywhere in `lib/rubric.js` — the only family-level `guarant` hit is
`IOC-DEBT`'s description, rubric:1150–1157, a different family
(`guarant` also incidentally hits rubric.js:2707, a comment, and
rubric.js:2863/2927/2980, "guaranteed-delivery" tender-offer
minimum-condition field labels — none of them a code or family, so the
no-competing-home conclusion stands) — or `lib/taxonomy.js` (whose
`THIRD_PARTY_OBLIGATIONS` entry at taxonomy:648–651 is an IOC sub-clause
tagger, not a card-level code). The extraction pipeline is SELF-FLAGGING
the gap: `[PROPOSED]`-stamped `section_ref` values on guaranty/financing-
source content cover **32 cards / 22 of 40 deals (55% of the corpus)**
(pack §2a, full verbatim table there; the exact label predicate behind
32/22 is pinned to that pack table only and is not independently
re-derivable from labels alone — reconstructions from the label set give
31–35 cards / 17–24 deals depending on which "Obligations of Parent"/
"Credit Support" labels are counted; total deals = 40 confirmed; treat
32/22 as pack-cited, re-run against the pack's own predicate, not
re-derived here), plus at least two more cards under
plain `Unclassified` section_refs (`58fe142a…` §4.9 "Guarantee",
`5921052e…` §5.14 "Guarantee" — pack §2a note), so any query keyed only
on `[PROPOSED]` undercounts. Label-blind `ilike '%guarant%'` hits 438
cards, dominated by OTHER families' legitimate homes (IOC-DEBT 37,
DEF-INDEBTEDNESS 35, REP-T-MATERIAL-CONTRACTS 29 — pack §2). Every
grounding set below was therefore assembled by CONTENT pattern, never by
subtype label — and the v1 label surface is demonstrably wrong in both
directions (receipt 1's `74ff9e77…`, labeled "[PROPOSED] Parent Guaranty
of Merger Sub", contains ZERO guarantee bytes).

**Discrepancy note, carried forward honestly (pack §0):** the open-world
commonality report (`docs/handoffs/OPEN-WORLD-COMMONALITY-2026-08-02.md`)
contains zero mentions of "guarant" — it is entirely capitalisation
candidates. This family's grounding link is NOT that report; it is the
`[PROPOSED]` self-flag population plus the content sweep above. No spec
sentence below claims commonality-report authority.

Grounding quotes this spec builds on (every corroboration pattern, enum
code and lexicon entry traces to one of these; nothing is fabricated):

- **Performance guaranty, Parent-for-Merger-Sub, "hereby guarantees"
  form** — card `bbb939ad-c258-42e2-92ec-50104b8c95fb` (deal `00d49e6a…`,
  §8.15, pack §3a): "SECTION 8.15. Performance Guaranty. Parent hereby
  guarantees the due, prompt and faithful performance and discharge by,
  and compliance with, all of the obligations, covenants, terms,
  conditions and undertakings of Merger Sub under this Agreement in
  accordance with the terms hereof…"; near-identical drafting for
  "Purchaser" as obligor in `98822967-cbb8-4f20-9cfb-b9beaced2d1c`
  (deal `320a3899…`, §9.11, pack §3a).
- **Performance guaranty, third-party Guarantor form** — card
  `eb4b9423-5a6e-471c-a141-37566b54dd81` (deal `c34415ed…`, §8.10, pack
  §3a): "Section 8.10 Guarantee of Guarantor. As a material inducement to
  the Company entering into this Agreement…, Guarantor hereby irrevocably
  and unconditionally guarantees to the Company the full and timely
  performance and satisfaction of Parent and Merger Sub's obligations as
  set forth in this Agreement…".
- **Performance guaranty, Holdco form with the payment-vs-collection
  flag** — card `2cac9a14-3621-4666-bfe3-6cb67e6f1f07` (deal `448e524f…`,
  §6.12, pack §3a): "6.12 Parent Holdco Guarantee. Parent Holdco
  irrevocably and unconditionally guarantees to the Company the due and
  punctual performance of the obligations of Parent and Merger Sub
  hereunder (the \"Guaranteed Obligations\")… This is a guarantee of
  payment and performance and not merely of collectability."
- **Performance guaranty, principal-not-surety form, `[PROPOSED]`
  mislabel** (audit CRITICAL-1) — card
  `d6b3b7ac-2a99-43e7-90f3-038301b911d9` (deal `1e4b7102…`, §9.15,
  MISC_BOILERPLATE, section_ref "[PROPOSED] Guaranty"): "Section 9.15.
  Guaranty. (a) To induce the Company to enter into this Agreement,
  Guarantor hereby absolutely, unconditionally and irrevocably
  guarantees, as principal and not as surety, to the Company, the
  Surviving Corporation and their successors and permitted assigns the
  due and punctual payment and performance of each of the covenant,
  obligation, debt, duty and liability…" — a fifth GTY-PERF member missed
  by receipt 1's original narrow regex because the drafting interposes
  "absolutely, unconditionally and irrevocably" between "hereby" and
  "guarantees"; also carries the one-card "as principal and not as
  surety" suretyship-waiver variant (candidate attribute, Flagged item
  3).
- **Limited-guaranty delivery rep, named-fund guarantor** — card
  `252c2296-e805-4cac-bf1d-0e03f82539f5` (deal `af4940e1…` Skechers,
  §4.13, pack §3b): "4.13 Guaranty. Concurrently with the execution of
  this Agreement, Parent and Merger Sub have delivered a duly executed
  guaranty from 3G Fund VI, L.P., a Cayman Islands exempted limited
  partnership (\"Guarantor\") to the Company. The Guaranty is in full
  force and effect and constitutes a valid and binding obligation of the
  Guarantor, enforceable against the Guarantor in accordance with its
  terms… No event has occurred which… could constitute or would
  reasonably be expected to constitute or result in a default…".
- **Delivery rep, plural-guarantor form** — card
  `253181ee-4104-4286-bf56-2191911faa2c` (deal `13211d88…`, §4.9, pack
  §3b): "4.9 Guarantees. Concurrently with the execution of this
  Agreement, each Guarantor has delivered to the Company a duly executed
  Guarantee. Each Guarantee is in full force and effect and constitutes
  a legal, valid and binding obligation of the applicable Guarantors…";
  singular twin `58fe142a-132d-46f2-b086-a8fae4ce3221` (deal `86a01770…`,
  §4.9, plain-`Unclassified` section_ref, pack §3b).
- **Delivery rep, furnished-copy variant** — card
  `5921052e-4c62-4695-bb39-608ca7c0e94c` (deal `0a043659…`, §5.14, pack
  §3b): "5.14 Guarantee. The Parent Entities have furnished the Company
  Entities with a true, complete and correct copy of a guarantee by
  Silver Lake Partners VI, L.P. and Silver Lake Partners VII, L.P. (the
  \"Guarantors\"…)…" — multi-sponsor club deal; 1..N guarantor
  cardinality is a corpus fact (pack §4).
- **Delivery rep, the one v1-SUBTYPED sibling** (author query receipt 2 —
  NOT in the pack): card `c8a7955c-4fb1-4d3b-8071-4d43c6cd4971` (deal
  `1f80bec7…`, §5.9, provision_subtype `REP-B-EQUITY`, v1 label "Equity
  Investment — Limited"): "Section 5.9 Limited Guarantees. Concurrently
  with the execution of this Agreement, each Guarantor has delivered to
  the Company a true, correct and complete copy of its respective Limited
  Guarantee, duly executed by such Guarantor in favor of the Company…" —
  proof that the rep population straddles null subtypes AND a mislabeled
  REP-B-EQUITY home; label-blind corroboration is mandatory.
- **The guaranty instrument is OFF-CORPUS by the agreements' own
  design** — card `c9e0767d-63a5-478d-96ef-cd022ae952a8` (deal
  `bb5f062d…`, §9.04, pack §3c): "This Agreement, Exhibit A, …, the
  Equity Commitment Letter, the Limited Guarantee and the Company
  Disclosure Schedule constitute the entire agreement…" — the Limited
  Guarantee is a separate exhibit/side letter; its own terms (cap
  amount, term, guaranteed-obligations enumeration) are not in the
  ingested merger-agreement text (pack §5-5). This single fact shapes
  the whole registry: see the cap ruling in section 1.
- **The label-is-not-content witness** (author query receipt 1): card
  `74ff9e77-bc67-4e3d-9759-c008dfc3f5a6` (deal `ad35e712…`, §8.8,
  section_ref "[PROPOSED] Obligations of Parent / Parent Guaranty of
  Merger Sub"): verified bytes (qlen 506) contain NO occurrence of any
  `guarant` token — the text is an undertaking-to-CAUSE ("such
  requirement shall be deemed to include an undertaking on the part of
  Parent to cause Merger Sub or such Subsidiary to take such action"),
  a legally distinct obligation-support shape (no secondary liability
  created). Pinned as this family's decline/queue witness: the real
  heading "Obligations of Parent." matches no stage-1 rule, and a
  producer assertion over these bytes fails every corroboration pattern.
- **The D&O cross-hit witness** (author query receipt 3): card
  `9675f138-5ac0-4867-949c-f03674064889` (deal `320a3899…`, §6.5,
  COV-DO): "…and Parent hereby guarantees the obligations of the
  Surviving Corporation pursuant to such agreements…" — a parent
  guarantee OF THE D&O COVENANT living inside a D&O section. DNO-family
  territory (its section title classifies DNO); priced here as the
  "hereby guarantees" lexicon cross-hit (section 5) and a boundary
  fixture (test 4).

**Query receipts (SELECT-only, run 2026-08-03 by this spec's author):**

1. **Operative-verb sweep (corrected per audit CRITICAL-1):** the
   original narrow regex `primary_quote ~* '(hereby |irrevocably and
   unconditionally )guarantees'` → 6 rows: the four GTY-PERF grounding
   cards above; ONE definitions-article duplicate row (`506f64b5-d64b-
   4e67-88f7-b751409d82ca`, DEF-GENERAL, deal `448e524f…` — byte-
   duplicates `2cac9a14…`'s operative text into a DEF card; flagged to
   ingest-QA, excluded from every fixture); and the `9675f138…` COV-DO
   cross-hit. **That regex is under-inclusive** — it misses drafting that
   interposes words between "hereby"/"irrevocably and unconditionally"
   and "guarantees". A widened sweep, `primary_quote ~*
   'hereby[a-z, ]{0,60}guarantees'`, surfaces a seventh row:
   `d6b3b7ac-2a99-43e7-90f3-038301b911d9` (deal `1e4b7102…`, §9.15,
   MISC_BOILERPLATE, "[PROPOSED] Guaranty" — "Guarantor hereby
   absolutely, unconditionally and irrevocably guarantees… as principal
   and not as surety… the due and punctual payment and performance…").
   GTY-PERF's real population: **5 cards / 5 deals**, with `74ff9e77…`
   as the labeled-but-empty sixth (recorded as a NON-member).
2. **Delivery-rep sweep (corrected per audit CRITICAL-3):**
   `(primary_quote ~* 'concurrently with the execution' and ~*
   'guarant')` plus the REPRESENTATION full-force-and-effect conjunct →
   the five delivery-rep grounding cards above (`252c2296…`, `253181ee…`,
   `58fe142a…`, `5921052e…`, `c8a7955c…`), plus recital-duplicate
   DEFINITION rows (`26e52528…` DEF-GENERAL dup of `252c2296…`;
   `1c2f232b…` DEF-CONTRACT / `170e1669…` DEF-PERSON, deal `86a01770…`,
   quoting the RECITAL form "Parent is entering into a limited guarantee
   (the \"Guarantee\")… with General Atlantic Partners 100 L.P. (the
   \"Guarantor\")") — all four flagged to ingest-QA as duplicate/recital
   noise, never absorbed; the recital shape itself stays open world.
   REP-B-FUNDS rows (`dd37da8c…`, `2afb3960…`, `174741b2…`) also match —
   they are financing-rep cards where the Guarantor is the ECL
   counterparty; Boundaries 3 disposes of them. **The sweep also returns
   a sixth row, previously undisclosed:** `5a4426d5-6b34-477c-a266-
   02696bd1e4e6` (deal `bb5f062d…`, REPRESENTATION, NULL subtype,
   section_ref "4.07 | Unclassified — Equity Financing"), limb (e):
   "Concurrently with the execution of this Agreement, Parent has
   delivered to the Company a true, correct, and complete copy of a duly
   executed the Limited Guarantee. The Limited Guarantee is (i) a legal,
   valid, and binding obligation of the Investor… (iii) in full force and
   effect…" — byte-for-byte this family's own delivery-plus-in-effect
   concept, sitting under a "Financing"-shaped title rather than a
   guaranty-shaped one. Under Boundary 3 and the stage-1 declines
   (section 3), a "Financing"-titled section never dispatches to
   GUARANTY at stage 1, so `5a4426d5…` is a NON-dispatchable
   delivery-rep population member: the true delivery-rep population is
   **≥6 cards / 6 deals**, of which 5 cards / 5 deals are dispatchable
   (the grounding set above, unchanged) and `5a4426d5…` is ceded, as a
   named and priced recall cost, to whichever future reps/financing-
   covenants slice promotes financing-titled homes for this rep shape
   (Boundary 3). The coverage-map completeness claim below is scoped to
   the dispatchable 5/5, never to the full population.
3. **Cross-hit verification:** substring pull on `9675f138…` (quoted
   above) and byte-length/absence check on `74ff9e77…` (guarant-token
   count: zero).

## Grounding corrections (verified against repo + production DB, 2026-08-03)

1. **No registered v2 vocabulary exists for this family.** Verified: grep
   of `lib/canonical-v2/contract-bundle.js` for `GTY`/`GUARANT` returns
   zero hits. Every concept below is new and FLAGGED FOR BEN.
2. **No v1 code exists either** — this family is pure open-world/null-
   subtype population (the label-coverage gap stated above). There is no
   v1 FEATURES block to read, map or alias; v2 claims come only from
   byte-verified quote text. The five DEFINITION-article duplicate rows
   (receipts 1–2, plus `935cdc91…` per audit MATERIAL-1) are ingest-QA
   flags, never fixtures.
3. **v1 `section_ref` labels are UNTRUSTED in both directions:**
   `74ff9e77…` carries a guaranty label over zero guaranty bytes;
   `c8a7955c…` carries an equity-investment label over a pure
   limited-guaranty rep; `58fe142a…`/`5921052e…` carry no label at all.
   Stage-1 rules (section 3) are authored from REAL headings embedded in
   quote bytes (the DNO discipline), and fixture headers never carry
   `section_ref` strings (the IOC lint pin).
4. **Bundle version numbering:** this spec binds to "the next frozen
   version at this slice's merge"; every superset-diff acceptance test is
   written against CONTENT (sorted key sets), never the numeral.
5. **Forbidden-patterns check** (`scripts/lint/forbidden-patterns.sh`):
   this family's vocabulary ("guaranty", "guarantee", "hereby
   guarantees", "duly executed", "full force and effect", "Limited
   Guarantee") collides with no entry in `globalPatterns`,
   `scopedPatterns`, or `PROSE_CLASS_FINGERPRINTS`; fixtures live under
   the `*-live-run` exempt directory class; zero new exemption entries.

## Cross-family boundaries (BINDING; double-claiming is an automatic
audit CRITICAL; each pin has a named acceptance test in section 6)

1. **REM-NONRECOURSE and REM-JURY — the specific-performance spec owns
   non-recourse shields and jury waivers. This is the family's defining
   boundary, and it is resolved by CESSION, not collision.** The remedies
   spec's query receipt 2 grounds `REM-NONRECOURSE` on exactly the cards
   this family's evidence pack re-surfaced (`32afce36…` §9.8 No Recourse,
   `da22d669…`/"[PROPOSED] Financing Source Protective Provisions",
   `f496f5f8…` §9.10, `2a2e1d40…`, `23a300a4…`), its `protected_class_kind
   = FINANCING_SOURCES` enum already dimensions the financing-source
   class, its Fable ruling records `bd837f1d…` ("Debt Financing Sources"
   §11.14) as the CANDIDATE fifth grounding card, and its lexicon owns
   /\bNon-Recourse\b/, /\bNo Recourse\b/, /\bFinancing Sources?\b/ and
   "recourse against". ACCORDINGLY, RULED HERE: **this family claims NO
   non-recourse concept, NO jury-waiver concept, NO forum concept, and no
   "Financing Source"/"recourse" vocabulary in any rule, table or lexicon
   entry.** The pack-§3d population that is non-recourse-shaped but not
   yet in REM's grounding set (`f2f7683d…` §10.12, `fa688b44…` §10.14,
   `f96615fd…` §11.14, `49a9f10d…`/`b9b7e891…` §9.14, `1f15d16c…` §9.16,
   `52ad96d8…`/`980a01a1…` §8.6 (TERMINATION_RIGHT-typed!), `571e453a…`
   §9.12, `32afce36…` §9.8's siblings) is RECORDED FOR THE REM SLICE as
   candidate grounding-set expansions, exactly the `bd837f1d…` device —
   adding any of them is a one-line reviewed diff in THAT slice after
   byte verification, never an absorption here. Test 4 pins that no
   GTY rule or pattern matches a "Non-Recourse"/"No Recourse"/"Financing
   Sources" title or quote.
2. **TERMF — fee amounts and everything keyed to them.** The family
   brief's "caps keyed to termination-fee amounts" machinery lives in two
   places, neither of them here: (a) the guaranty instrument's own cap —
   OFF-CORPUS (the `c9e0767d…` integration-clause receipt; the exhibit is
   not ingested); (b) in-agreement fee-keyed liability-cap prose ("an
   amount equal to… the Parent Termination Fee… (the \"Liability
   Limitation\")") — that text is corpus-verifiably `TERMINATION_FEE`/
   `TERMF-SOLE`-typed (the remedies spec's audit C2 disclosure for
   `22180602…`/`a2435fd0…`), and the remedies Fable ruling DEFERRED all
   liability caps to a future sole-remedy/TERMF-adjacent slice. This
   family inherits that deferral verbatim: **no money parser, no cap
   claim, no fee vocabulary ships here.** Where a guaranty quote
   references its off-agreement cap ("subject to the Liability
   Limitation and other limitations therein", `f2f7683d…` — itself a
   REM-boundary card), the reference stays inside whatever claim's quote
   carries it, as reviewer evidence. Test 4 greps zero TERMF-owned
   vocabulary in this slice's tables.
3. **Financing-covenants family — Commitment Letter machinery and
   financing reps.** Its lexicon owns /\bEquity Commitment Letter\b/,
   /\bDebt Commitment Letter\b/, /\bDebt Financing\b/, /\bEquity
   Financing\b/. The REP-B-FUNDS cards where the Guarantor appears as
   ECL counterparty (`dd37da8c…` "the Equity Commitment Letter from the
   Guarantor", `2afb3960…`, pack §3e) are financing-rep territory (that
   spec's boundary set already rules REP-B-FUNDS titles out of FINANCING
   dispatch; their promotion is a reps-family future slice either way) —
   this family never patterns Commitment Letter vocabulary and its
   stage-1 rules never match "Financing"/"Sufficient Funds" titles.
   Test 4.
4. **DNO — parent guarantees OF the D&O covenant.** The `9675f138…`
   limb ("Parent hereby guarantees the obligations of the Surviving
   Corporation pursuant to such agreements") lives in a D&O-titled
   section that classifies DNO at stage 1 under that spec's rules; it
   never reaches this family's producer, and this family's
   PERFORMANCE_GUARANTY corroboration (the `performance` conjunct,
   section 4) fails its bytes even if misdispatched. Priced as the
   "hereby guarantees" lexicon cross-hit (section 5). Test 4.
5. **IOC — guarantee-incurrence restrictions.** Negative covenants
   restricting the target (or buyer) from guaranteeing obligations,
   including their dollar baskets ("$10,000,000 in the aggregate"
   `5da4e630…`; "$250,000,000" `fa7585bb…`; the buyer-side
   investment-grade variant `be8cf8c6…` — pack §3h) are IOC-DEBT
   machinery (`taxonomy.js` THIRD_PARTY_OBLIGATIONS sub-clause tagging
   included). Never claimed; INTERIM_OPERATING sections never dispatch
   here. Test 4.
6. **MISC-boilerplate family — integration clauses naming the Limited
   Guarantee.** "Entire Agreement" sections enumerate the Limited
   Guarantee as a transaction document (`c9e0767d…`); that is the MISC
   family's ENTIRE_AGREEMENT claim's quote evidence, not a guaranty
   claim. The /\bLimited Guarantees?\b/ lexicon cross-hit into MISC
   sections is priced with an EXPECTED unmatched-signal pin (section 5).
   Test 4 pins that "Entire Agreement"-shaped titles decline GTY.
7. **Definitions family — Indebtedness-definition guaranty limbs and
   recital duplicates.** "guaranty or similar instrument" inside
   Indebtedness definitions (`34adc38d…`, pack §3i) and the recital-form
   DEF rows (receipt 2) are definitions-article content; DEFINITIONS
   article_context declines every GTY rule. Test 4.

## Deliverable (honest conversion semantics)

Governed, resolvable claims for two legal objects only: (a) the
IN-AGREEMENT parent/sponsor performance guaranty — the section of the
merger agreement body in which a parent, holdco or third-party guarantor
guarantees Merger Sub's (or Parent-and-Merger-Sub's) obligations under
the agreement itself; (b) the LIMITED-GUARANTY DELIVERY REP — the
buyer-side representation that a duly executed limited guaranty from a
named sponsor/fund guarantor has been delivered (or a true and complete
copy furnished) and is in full force and effect. Everything else the
evidence pack surfaced is either another family's (Boundaries 1–7) or
open world with a recorded candidate grounding set (Flagged for Ben,
below). Per the dividends small-family precedent, the slice is scaled
accordingly: two concepts, three presence definitions, zero parsers.

**No recorded native runs exist over guaranty sections.** There are no
open-world fixture rows to convert and no closure_ids to track. The
deliverable is the five-layer capability plus a pre-rerun harness: a
COVERAGE MAP over committed corpus-quote fixtures (the cards named
above, committed as LITERAL production bytes with provenance headers —
deal uuid, provision_card uuid, retrieval date, provision_type and
subtype INCLUDING NULL homes, which is most of this family), each
hand-enumerated sub-quote byte-verified as a contiguous substring of the
committed card text and anchored per the P1 anchored-overlap rule, each
with its expected outcome (RESOLVED presence, typed review reason, or
pinned decline). The P1 audit M-5 honesty pins apply verbatim: "the
pipeline natively extracts guaranty provisions" may be claimed ONLY
after dated post-merge live-run handoffs (subscription CLI); until then
the honest claim is "the machinery exists and is proven on committed
fixtures".

**Fixture placement:** `tests/fixtures/canonical-v2/guaranty-fixtures/`
(the forbidden-patterns exempt directory class). Fixture headers carry
deal uuid + provision_card uuid + retrieval date + provision_type/
subtype ONLY — never v1 `section_ref` label strings (the IOC lint pin;
here doubly load-bearing, because this family's `section_ref` labels
include a demonstrated false label, `74ff9e77…`).

## 1. Registry (`contract-bundle.js` → next frozen version)

Strictly additive spread of the head version at build time. **Two new
concepts, both FLAGGED FOR BEN in the PR body**, `{concept_key, version}`
shape only. The `GTY-` prefix is new v2 vocabulary; there is no v1 code
to reproduce or refuse — the family is born from the `[PROPOSED]` gap.

- `GTY-PERF` — in-agreement performance guaranty of Merger Sub/Purchaser
  obligations by Parent, a Holdco, or a named Guarantor. Grounded:
  `bbb939ad…`, `98822967…`, `eb4b9423…`, `2cac9a14…`, `d6b3b7ac…` (5 cards
  / 5 deals, receipt 1 corrected — audit CRITICAL-1).
- `GTY-DELIVERY` — limited-guaranty delivery/status representation.
  Grounded: `252c2296…`, `253181ee…`, `58fe142a…`, `5921052e…`,
  `c8a7955c…` (5 cards / 5 deals, receipt 2).

NOT added (each a legal ruling, not an omission):

- **A guaranty-cap or guaranteed-obligations-enumeration concept.** The
  cap and the enumeration live in the Limited Guaranty exhibit, which is
  off-corpus by the agreements' own design (`c9e0767d…`); in-agreement
  fee-keyed cap prose is TERMF/future-sole-remedy territory (Boundary
  2). A FEATURES field expecting guaranty TERMS would be unfillable
  from quote bytes — the honest ceiling is the delivery rep plus the
  performance-guaranty presence. Under M3 rule 1 the producer never
  asserts "uncapped" either.
- **A payment-vs-collection-form enum.** "This is a guarantee of payment
  and performance and not merely of collectability" (`2cac9a14…`) is
  legally material and grounded on ONE card — it stays inside the
  GTY-PERF claim's quote as reviewer evidence, recorded as the candidate
  future attribute (pack §4's drafting-variant warning).
- **A no-default-under-the-Guaranty claim.** "There is no default or
  breach under any Guarantee" (`253181ee…`) is a quoted positive with
  negative content (the P3 NONE_OUTSTANDING shape) — promotable in
  principle, deliberately deferred: it rides inside the delivery-rep
  quote on every grounded card, and splitting it out buys no market
  statistic Ben has asked for. Open world; named in the prompt as NOT
  to be forced fit.
- **Any financing-source concept** (Boundary 1 — ceded to REM), **any
  credit-support-disclosure concept** (`528d636d…` §5.19, 1 card/1 deal,
  pack §3f), **any guarantee-release concept** (`de62e6b7…` §5.16, 1
  card/1 deal RMT, pack §3g), **any undertaking-to-cause concept**
  (`74ff9e77…`, 1 card). All open world with recorded candidate
  grounding sets — see Flagged for Ben.

**Claim definitions (three; all presence):**

```
PARENT_PERFORMANCE_GUARANTY_CLAIM_DEFINITION_V1
  claim_definition_key: 'PARENT_PERFORMANCE_GUARANTY'
  version: 1
  allowed_canonical_values: [true]           // presence claim
  canonical_value_required_when_present: true

LIMITED_GUARANTY_DELIVERED_CLAIM_DEFINITION_V1
  claim_definition_key: 'LIMITED_GUARANTY_DELIVERED'
  version: 1
  allowed_canonical_values: [true]
  canonical_value_required_when_present: true

LIMITED_GUARANTY_IN_EFFECT_CLAIM_DEFINITION_V1
  claim_definition_key: 'LIMITED_GUARANTY_IN_EFFECT'
  version: 1
  allowed_canonical_values: [true]
  // Meaning pinned: the agreement REPRESENTS the delivered guaranty is
  // in full force and effect and valid/binding — a rep about an
  // off-corpus instrument's status, never a claim about the
  // instrument's own terms.
  canonical_value_required_when_present: true
```

No new canonical value types; no validator changes. New concepts and
definitions grow the expected-keys rows as sorted supersets
(content-diffed tests; prior rows byte-untouched).

**Governed attributes (never in keys; participate in claim
identity/closure):**

- ALL THREE definitions: `guarantor_ref` — REQUIRED verbatim phrase
  naming the guarantor as the quote states it ("Parent" `bbb939ad…`;
  "Parent Holdco" `2cac9a14…`; "Guarantor" `eb4b9423…`; "3G Fund VI,
  L.P." `252c2296…`; "each Guarantor" `253181ee…`, `c8a7955c…`;
  "Silver Lake Partners VI, L.P. and Silver Lake Partners VII, L.P."
  `5921052e…`). Substring-enforced against the byte-verified quote (P1
  M-3 discipline), typed `GUARANTOR_REF_NOT_IN_QUOTE` on failure.
  Identity-bearing — the 1..N guarantor cardinality (pack §5-6) is
  carried by the verbatim phrase AS QUOTED: a multi-sponsor deal whose
  producer splits per-guarantor mints distinct claims that never dedupe;
  a collective phrase mints one claim. The resolver never splits names
  (the IOC compound-limb rule); cross-deal canonicalization of
  guarantor_ref values is Ben adjudication later (the share_class_ref
  precedent). No party tuple is minted anywhere in this slice —
  guarantors are non-party fund entities outside `resolveParty`'s
  principal-party roles; a `GTY_GUARANTOR` party role is a future
  reviewed diff (the DNO no-party reasoning).
- `GTY-PERF` additionally: `obligor_ref` — OPTIONAL verbatim phrase
  naming whose obligations are guaranteed ("Merger Sub" `bbb939ad…`;
  "Purchaser" `98822967…`; "Parent and Merger Sub" `2cac9a14…`,
  `eb4b9423…`). Substring-enforced when supplied
  (`OBLIGOR_REF_NOT_IN_QUOTE`). Evidence anchor only this slice.

M3 rule 1 restated for this family: the producer NEVER asserts "no
guaranty delivered", "guaranty uncapped", "no default" (as a standalone
claim), or "guarantor has no further obligations". The no-default and
not-amended sentences stay inside the delivery-rep quote as evidence.
Derived ABSENT belongs to the future scope-closure machinery, forever.

## 2. Value parsers: NONE — a ruled decision

All three definitions are presence claims gated by allowed-values
membership + corroboration (the closing-conditions "no parser is a ruled
decision" precedent). No numeric exists in any family-owned grounded
quote: the dollar figures the pack surfaced live in IOC baskets
(Boundary 5) and the off-corpus guaranty instrument (Boundary 2). Every
resolved claim carries the honest
`buildMechanicalAnswerProvenance({ extraPins: { gate:
'ALLOWED_VALUES_MEMBERSHIP' } })` tag construction. If a future slice
promotes guaranty-cap numerics it ships its own typed-abstain parser
against the termination-fee parser's newest lessons
(`HYBRID_MAGNITUDE_MONEY`, the trailing-comma tokenizer pin —
`termination-fee-parse.js`), never a widening here.

## 3. Producer prompt + provider

- **New prompt module** `guaranty-producer-prompt.js`. Existing prompts
  are NOT edited (PROMPT_VERSIONs unmoved; recorded capitalisation,
  termination-fee and no-shop fixtures replay byte-identically). New
  `PROMPT_ID 'native-producer-guaranty/v1'`, `PROMPT_VERSION 1`, bumped
  once per slice, never mid-slice.
- **Dispatch through `producer-prompt-registry.js`, mandatorily.** The
  seam is BUILT at head (CAPITALISATION + TERMINATION_FEE + NO_SHOP in
  the module-private frozen Map; fail-closed null on unknown family).
  This slice adds ONE entry in its own reviewed diff, per the module's
  own header convention: `GUARANTY → buildGuarantyProducerPrompt`.
- **Section-family classifier extension**
  (`section-family-classifier.js` — stage-1 rules land per family in
  that family's reviewed diff; this is that diff for GUARANTY). Rules
  are authored from REAL headings recovered from quote bytes (grounding
  correction 3; the DNO discipline), using the financing-covenants
  `runStage1(title, article_context)` signature (build-order pin: head
  is `runStage1(title)` at line 170; whichever wave family lands first
  extends the signature once, to that spec's §3, and bumps
  `SECTION_FAMILY_CLASSIFIER_VERSION`):
  - /\bperformance\s+guarant(y|ee)\b/i — "Performance Guaranty"
    (`bbb939ad…` "SECTION 8.15. Performance Guaranty.", `98822967…`
    "Section 9.11. Performance Guaranty.").
  - /guarant(y|ee)s?\s+of\s+(the\s+)?guarantors?\b/i — "Guarantee of
    Guarantor" (`eb4b9423…` "Section 8.10 Guarantee of Guarantor.").
  - /\b(parent|holdco)\s+(holdco\s+)?guarant(y|ee)\b/i — "Parent Holdco
    Guarantee" (`2cac9a14…` "6.12 Parent Holdco Guarantee.").
  - Title-anchored bare form (widened per audit CRITICAL-2 — the
    numbering prefix is generic and optional, admitting both "Section N"
    and bare-numeral "N" forms, not only the literal word "section"):
    /^\s*((section|§)\s*)?[\d.()]*\s*[.:]?\s*(limited\s+)?guarant(y|ee|ees|ies)\s*\.?\s*$/i
    — "Guaranty" (`252c2296…` real heading "4.13 Guaranty.", bare-numeral;
    `d6b3b7ac…` real heading "Section 9.15. Guaranty."), "Guarantees"
    (`253181ee…` real heading "4.9 Guarantees.", bare-numeral),
    "Guarantee" (`58fe142a…`, `5921052e…` real heading "5.14 Guarantee.",
    bare-numeral), "Limited Guarantees" (`c8a7955c…`).
    REPRESENTATIONS article_context is ALLOWED for this rule (unlike the
    DNO declines): the delivery rep lives in the buyer-rep article by
    market convention, and four of five grounding headings sit there.
  - **Declines, pinned:** DEFINITIONS, CONDITIONS and INTERIM_OPERATING
    article_context decline all rules (the DEF duplicate rows; IOC
    sections — Boundaries 5, 7). Non-bare compound titles carrying other
    families' anchors decline by construction: "Credit Support;
    Guarantees" (`528d636d…`), "Pre-Closing Restructuring; Guarantee
    Releases" (`de62e6b7…`), "Entire Agreement" forms (`c9e0767d…`),
    "Material Contracts", "Indebtedness", "Financing"/"Sufficient
    Funds", and every "Non-Recourse"/"No Recourse"/"Financing Sources"
    title (Boundary 1 — those may classify REMEDIES under that spec's
    rules; never GUARANTY). "Obligations of Parent" (`74ff9e77…`'s REAL
    heading) matches no rule — the false `section_ref` label never
    enters classification (rules run on title bytes).
  - Stage 1 is validated against ALL deals' section titles before the
    prompt is ever dispatched (the repo classify-rules safety check), as
    a review-time script against live corpus data — never stubbed into
    fixtures or promoted into `npm test` (the IOC test-5 discipline).
    **Recall pin (REM-CAP standard, corrected per audit CRITICAL-2):**
    the script asserts all TEN grounding cards' real headings classify
    GUARANTY at stage 1 — including the bare-numeral headings verbatim,
    "4.13 Guaranty." (`252c2296…`), "4.9 Guarantees." (`253181ee…`), and
    "5.14 Guarantee." (`5921052e…`), which the widened numbering prefix
    above must admit — and the named declines above decline. A grounded
    concept whose real heading
    fails every stage-1 rule is a script failure, not a silent stage-2
    fallback. Known collision surface to verify: bare "Guarantee(s)"
    titles inside TARGET-rep articles (none exist in the grounded
    corpus; if a future deal presents one, the delivery-vocabulary
    corroboration is the second wall and the cost is a queue item,
    priced).
  - Stage 2 (AI-assisted, Ben's 2026-08-02 ruling) applies unchanged
    with `SECTION_FAMILY_AI_CLASSIFIED` provenance and the
    `SECTION_FAMILY_AI_UNVERIFIED` auto-pass block.
- **Response shape:** a `guaranty_assertions` array — each element
  `{ section_reference, assertion_kind: 'PERFORMANCE_GUARANTY' |
  'GUARANTY_DELIVERED' | 'GUARANTY_IN_EFFECT', verbatim quote,
  guarantor_ref (verbatim, required), obligor_ref (verbatim, optional,
  PERFORMANCE_GUARANTY only) }`. One element per legal fact; the prompt
  owns the split discipline:
  - A delivery-rep section is typically TWO assertions (the delivery
    sentence; the full-force-and-effect sentence) whose quotes may
    overlap — the pinned co-resolution pair in section 4 exists for this
    drafting norm.
  - Multi-guarantor drafting may be asserted per named guarantor or with
    the collective verbatim phrase; the producer decides, the resolver
    never splits (section 1).
  - PRESERVE-THE-NOVEL retained verbatim; the prompt NAMES as open-world
    shapes (never forced fit): no-default/not-amended sentences,
    payment-vs-collection language, undertaking-to-cause sections,
    credit-support disclosure lists, guarantee-release covenants,
    recital-form guaranty disclosures, and EVERY financing-source
    protective limb (non-recourse, jury, forum, third-party-beneficiary
    grants — Boundary 1: those are never guaranty assertions). The
    producer never asserts a negative (M3 rule 1).
- **Provider (`anthropic-provider.js`):** ONE new generic key,
  `NATIVE_GUARANTY_CANDIDATE`, proposal_kind `GUARANTY` (≠ OPEN_WORLD).
  `guaranty_assertions` is NOT added to `REQUIRED_RESPONSE_LISTS` (the
  share_count precedent verbatim: recorded responses predate the key;
  missing/non-array reads as empty list, never a schema failure). Quote
  byte-verification identical to existing proposals. Golden evals:
  recorded responses are never hand-edited into the new shape; the first
  GUARANTY recordings are minted by the first live runs, each its own
  dated handoff.

## 4. Resolver wiring (`candidate-resolution.js`)

- **ONE new `RESOLUTION_UNCONDITIONAL` entry** (P1 M-2: the Map is keyed
  on generic_claim_key alone): `NATIVE_GUARANTY_CANDIDATE`,
  `deterministic_kind: null`, `attachment_position: null`,
  `registered_claim_definition_key: null`, `concept_key: null`
  (explicit, with the TERMR build-time check), `party_field: null` (no
  party minted this slice — section 1). `MAPPING_TABLE_VERSION` bumped;
  table-validation still asserts no duplicate generic keys.
- **Handler split on `assertion_kind`** via a frozen map:
  `PERFORMANCE_GUARANTY → GTY-PERF × PARENT_PERFORMANCE_GUARANTY`;
  `GUARANTY_DELIVERED → GTY-DELIVERY × LIMITED_GUARANTY_DELIVERED`;
  `GUARANTY_IN_EFFECT → GTY-DELIVERY × LIMITED_GUARANTY_IN_EFFECT`.
  Out-of-enum assertion_kind → explicit `pushOpenWorld`, typed
  `GTY_ASSERTION_KIND_OUT_OF_VOCABULARY` (P1 C-4).
- **Kind ambiguity: asserted-kind corroboration with ONE pinned
  co-resolution pair and ONE pinned exclusivity pair** (the DNO
  named-deviation shape, with grounds):
  - each assertion resolves iff ITS OWN kind's corroboration patterns
    match its own byte-verified quote — mismatch → review, typed
    `GTY_KIND_UNCORROBORATED`;
  - `GUARANTY_DELIVERED` and `GUARANTY_IN_EFFECT` are a pinned
    co-resolution PAIR: they may resolve from overlapping or identical
    quotes as distinct claims (grounded drafting norm: the delivery and
    status sentences are adjacent in all five grounding cards; identity
    never collides because definition keys differ);
  - `PERFORMANCE_GUARANTY` vs either delivery kind is a pinned
    EXCLUSIVITY pair: one quote whose text corroborates BOTH an
    in-agreement operative guaranty AND a delivered-instrument rep →
    review, typed `AMBIGUOUS_GUARANTY_OBJECT`, never a resolution of
    either. They are claims about DIFFERENT legal objects (the agreement
    body's own covenant vs an off-corpus exhibit's status); the corpus
    never blurs them (zero cards corroborate both), so any blur is
    producer error or a novel shape for review. The resolver never
    picks; there is no resolver-side sub-quote search (the remedies M3
    correction); producer re-assertion after review is the narrow-quote
    path.
- **Corroboration tables (frozen resolver constants; label must bind to
  quote text; every pattern grounded in a committed fixture quote):**
  - `PERFORMANCE_GUARANTY` ↔ /\bguarantees\b/i AND /\bperformance\b/i
    AND /\bobligations?\b/i — grounded `bbb939ad…` ("guarantees the due,
    prompt and faithful performance… of the obligations…"),
    `98822967…`, `eb4b9423…` ("guarantees to the Company the full and
    timely performance and satisfaction of Parent and Merger Sub's
    obligations"), `2cac9a14…` ("guarantees to the Company the due and
    punctual performance of the obligations"), `d6b3b7ac…` ("guarantees…
    the due and punctual payment and performance of each of the
    covenant, obligation, debt, duty and liability" — audit CRITICAL-1).
    The `performance`
    conjunct is the anti-DNO device: the `9675f138…` D&O limb
    ("guarantees the obligations of the Surviving Corporation pursuant
    to such agreements") carries no performance token in its guaranty
    sentence and dies `GTY_KIND_UNCORROBORATED` even if misdispatched
    (test 4); the `74ff9e77…` undertaking bytes carry no `guarantees`
    token at all and die the same way (test 2).
  - `GUARANTY_DELIVERED` ↔ /\b(delivered|furnished)\b/i AND
    /guarant(y|ee)/i AND (/\bduly executed\b/i OR
    /true,? (complete and correct|correct and complete) copy/i) —
    grounded `252c2296…` ("have delivered a duly executed guaranty"),
    `253181ee…`/`58fe142a…` ("has delivered… a duly executed
    Guarantee"), `5921052e…` ("have furnished… a true, complete and
    correct copy of a guarantee"), `c8a7955c…` ("has delivered… a true,
    correct and complete copy of its respective Limited Guarantee, duly
    executed").
  - `GUARANTY_IN_EFFECT` ↔ /full force and effect/i AND /guarant(y|ee)/i
    AND /valid and binding/i — grounded `252c2296…` ("The Guaranty is in
    full force and effect and constitutes a valid and binding
    obligation"), `253181ee…`, `58fe142a…` ("legal, valid and binding
    obligation of the Guarantor"). NOT grounded on `5921052e…`/
    `c8a7955c…` full width (their status sentences were not pulled to
    receipt); a producer IN_EFFECT assertion on those cards resolves iff
    its own quote carries the pattern — otherwise it queues, priced.
- **Value derivation:** all kinds → corroboration → attribute-verbatim
  checks (`GUARANTOR_REF_NOT_IN_QUOTE` / `OBLIGOR_REF_NOT_IN_QUOTE`) →
  allowed-values membership. No parser stage exists.
- **Materiality: NEW tier proposed, flagged for Ben.** `{ rank: 75,
  label: 'GUARANTY_FINANCING_PARTY', concept_key_prefixes: ['GTY-PERF',
  'GTY-DELIVERY'] }` — exact keys, never a bare `GTY-` prefix (the
  financing-covenants discipline). Rank 75 sits between
  CLOSING_CONDITIONS (70) and NOTICES_ADMINISTRATIVE (90) and collides
  with nothing at head; NOTE FOR BEN: sibling wave specs propose 80
  (tax, employee) and 85 (DNO) in the same corridor — relative ordering
  of the wave families between 70 and 90 is a single Ben call at
  whichever PR lands last. Rationale for 75: the sponsor guaranty is the
  Company's real credit support for the reverse-termination-fee remedy —
  closer to deal-enforcement economics than D&O boilerplate, below
  closing conditions. A proposal, not a default. **Pre-concept review
  routing (TERMF M-3):** review items minted before the kind map runs
  carry conceptFamily `'GTY-PERF-PENDING'` — a routing token only, never
  registered, never publishable — which startsWith-matches the
  `GTY-PERF` tier key → rank 75 instead of UNCLASSIFIED 99.
- **Identity:** assertion kind, guarantor_ref and obligor_ref
  participate in claim identity/closure — per-guarantor split claims in
  a club deal never collide or dedupe; a DELIVERED and an IN_EFFECT
  claim over one section never collide.
- **Receipt + additivity (honest form, P1 M-1):** with no GUARANTY
  input, resolution output must be byte-identical EXCEPT
  `mapping_table_version`, `contract_vocabulary_digest` (under the new
  bundle version), the bumped `section_family_classifier_version`, and
  the recomputed `resolution_receipt_id` (no parser-version fields —
  none exist in this family); documented in the PR as a field-level
  diff. Skipping the version bump to keep old pins green is the named
  anti-pattern.

## 5. Lexicon additions (`LEXICAL_FAMILY_LEXICON` version bump; every
edit a reviewed diff; keys MUST be registered concept keys — which is
why both concepts land in this same slice; explicit `\b` on every
case-sensitive regex; static max ≤ 128; multi-form entries as separate
pattern_ids; rationale per pattern)

- `GTY-PERF`: LITERAL_PHRASE "hereby guarantees" (`bbb939ad…`,
  `98822967…` — the family's operative-verb tell); LITERAL_PHRASE
  "irrevocably and unconditionally guarantees" (`2cac9a14…`,
  `eb4b9423…`); LITERAL_PHRASE "guarantee of payment and performance"
  (`2cac9a14…` — the payment-vs-collection flag, kept as a veto signal
  so the one-card shape is never silently missed).
- `GTY-DELIVERY`: LITERAL_PHRASE "duly executed guaranty" and
  LITERAL_PHRASE "duly executed guarantee" as SEPARATE pattern_ids (the
  multi-form rule; `252c2296…` / `253181ee…`); BOUNDED_REGEX
  /\bLimited Guarantees?\b/ (case-sensitive defined term, explicit
  `\b`; `c8a7955c…` heading and body, `c9e0767d…` integration clause).

**Priced cross-hit noise, stated (veto-only — a false hit costs a queue
item, never a wrong claim):**

- "hereby guarantees" verifiably fires inside D&O covenants
  (`9675f138…`, receipt 3 — the parent-guarantees-the-D&O-obligations
  limb). Expected `LEXICAL_UNMATCHED_SIGNALS` hits in DNO sections,
  where DNO candidates cover their own family; the anti-noise test pins
  one such hit as EXPECTED so a future silent deletion breaks a test.
- /\bLimited Guarantees?\b/ fires in every entire-agreement/integration
  clause that enumerates the transaction documents (`c9e0767d…`,
  Boundary 6) and in TERMF/remedies sections referencing the Guaranty.
  Same treatment: one EXPECTED unmatched-signal pin on a committed
  MISC-shaped fixture paragraph.

**Priced exclusions** (each a recorded blind spot; a miss costs a missed
VETO, never a wrong claim):

- Bare "guarantee"/"guaranty"/"guarantees"/"guaranteed": 438-card
  corpus-wide noise (IOC-DEBT restrictions, Indebtedness definitions,
  material-contract reps, employee/JV covenants — pack §2) INCLUDING the
  notices false positive "courier guaranteeing overnight delivery"
  (`f7ca5d77…`, pack §5-3). Only the operative multiword phrases above
  discriminate.
- Bare "Guarantor"/"Guarantors": recital/definition-article noise
  (receipt 2's DEF rows) and REP-B-FUNDS ECL drafting (Boundary 3).
- "full force and effect": ubiquitous rep drafting corpus-wide (every
  contract-validity rep) — resolver corroboration pattern only, never a
  lexicon veto.
- "Financing Source(s)", "Non-Recourse", "No Recourse", "recourse
  against": REM-NONRECOURSE lexicon territory (Boundary 1) — patterning
  them here would double-key the disagreement net across families.
- "Equity Commitment Letter" and all Commitment Letter forms:
  financing-covenants lexicon territory (Boundary 3).
- Operative-guaranty drafting that interposes words between "hereby" (or
  "irrevocably and unconditionally") and "guarantees" — e.g. "hereby
  absolutely, unconditionally and irrevocably guarantees…, as principal
  and not as surety" (`d6b3b7ac…`, audit CRITICAL-1): neither
  `GTY-PERF` LITERAL_PHRASE fires on this drafting variant. This is a
  recorded blind spot INSIDE the family's own concept — a true GTY-PERF
  card can miss both of its own lexicon vetoes — priced rather than
  patched with an ungrounded regex; the resolver's corroboration table
  (section 4) is independent of the lexicon and still resolves the claim
  on this card's bytes, so the miss costs a lexicon-veto blind spot, not
  a wrong or missed claim.

## 6. Acceptance tests (real-fixture-first; the P1 M-5 pre-rerun-harness
honesty pins apply VERBATIM — no recorded native runs exist for this
family; every resolver/registry test drives synthetic compiled
candidates pinned to REAL corpus quotes, byte-verified against committed
fixture bytes, clearly labeled as the pre-rerun harness)

0. **Fixture commit:** card text for `bbb939ad…`, `98822967…`,
   `eb4b9423…`, `2cac9a14…`, `d6b3b7ac…`, `252c2296…`, `253181ee…`,
   `58fe142a…`, `5921052e…`, `c8a7955c…` (the ten grounding cards, per
   audit CRITICAL-1), plus the decline witnesses `74ff9e77…`
   (labeled-but-empty) and `9675f138…` (COV-DO cross-hit limb), the
   NON-dispatchable delivery-rep witness `5a4426d5…` (financing-titled
   home, audit CRITICAL-3), and the cross-hit paragraph from `c9e0767d…`,
   committed as LITERAL production bytes under
   `tests/fixtures/canonical-v2/guaranty-fixtures/`, provenance headers
   with deal uuid + provision_card uuid + retrieval date +
   provision_type/subtype (mostly NULL subtypes — recorded truthfully) —
   NEVER v1 `section_ref` label strings. The five DEF duplicate rows
   (including `935cdc91…`, audit MATERIAL-1) are NOT committed. Every
   test quote asserted a contiguous substring of committed bytes.
1. **Registry:** next version compiles; prior arrays untouched
   byte-for-byte; two concepts + three definitions validate with zero
   validator changes; expected-concept-keys AND expected-claim-keys
   superset-diffs written against sorted CONTENT, never the numeral; a
   test asserts the kind→(concept, definition) frozen map's values are
   all registered keys.
2. **Resolution (pre-rerun harness, synthetic candidates over committed
   bytes):** PERFORMANCE_GUARANTY resolves on all five GTY-PERF
   grounding quotes (audit CRITICAL-1 adds `d6b3b7ac…`) with
   guarantor_ref substring-enforced ("Parent", "Parent Holdco",
   "Guarantor" — exercised on both `eb4b9423…` and `d6b3b7ac…`) and
   obligor_ref exercised on `bbb939ad…` ("Merger Sub") and `2cac9a14…`
   ("Parent and Merger Sub");
   GUARANTY_DELIVERED resolves on all five delivery quotes including
   the furnished-copy form (`5921052e…`) and the Limited-Guarantee-copy
   form (`c8a7955c…`); GUARANTY_IN_EFFECT resolves on `252c2296…`,
   `253181ee…`, `58fe142a…`; the pinned co-resolution pair proven on
   `252c2296…` (DELIVERED + IN_EFFECT from overlapping quotes, two
   distinct non-deduping claims, never an ambiguity reason); a
   PERFORMANCE_GUARANTY assertion over the `74ff9e77…` undertaking bytes
   → `GTY_KIND_UNCORROBORATED` (zero guarantee tokens — the
   label-is-not-content regression pin); a PERFORMANCE_GUARANTY
   assertion over the `9675f138…` D&O limb → `GTY_KIND_UNCORROBORATED`
   (no performance conjunct); a synthetic quote concatenating a
   grounded operative-guaranty sentence and a grounded delivery
   sentence (labeled synthetic per harness honesty rules) →
   `AMBIGUOUS_GUARANTY_OBJECT`; a corrupted guarantor_ref →
   `GUARANTOR_REF_NOT_IN_QUOTE`; per-guarantor split claims on a
   `5921052e…`-shaped pair mint distinct identities (never dedupe);
   out-of-enum assertion_kind → explicit `pushOpenWorld`; materiality
   rank 75 asserted on a resolved claim AND a `GTY-PERF-PENDING` review
   item; `answer_provenance.gate === 'ALLOWED_VALUES_MEMBERSHIP'` on
   every resolved claim; additivity re-pin with the documented
   field-level diff (no parser-version fields).
3. **Provider + dispatch:** response missing `guaranty_assertions` →
   empty list, not schema failure; recorded capitalisation,
   termination-fee AND no-shop fixtures replay byte-identically through
   the registry with the GUARANTY entry present; unknown family → no
   prompt, typed record.
4. **Cross-family boundary pins (each named for its boundary):** (b-1)
   "Non-Recourse", "No Recourse", "Financing Sources", "Debt Financing
   Sources" titles decline GUARANTY classification, and a diff-level
   grep asserts zero "Financing Source"/"recourse"/"jury" vocabulary in
   this slice's tables and lexicon; (b-2) grep asserts zero fee
   vocabulary ("Termination Fee", "fee_side", money grammars) in this
   slice's modules; (b-3) "Financing"/"Sufficient Funds"-shaped titles
   decline, and grep asserts zero Commitment Letter vocabulary; (b-4)
   a D&O-titled fixture section is never dispatched to the GUARANTY
   prompt, and the `9675f138…` limb fails corroboration (pinned in
   test 2); (b-5) an INTERIM_OPERATING-classified fixture is never
   dispatched, and the `5da4e630…` IOC dollar-basket quote asserted as
   any GTY kind → `GTY_KIND_UNCORROBORATED` (no delivery/performance
   collocation); (b-6) "Entire Agreement"-shaped titles decline; (b-7)
   DEFINITIONS article_context declines all rules (the DEF duplicate
   rows never classify); (b-8, recall pin, corrected per audit
   CRITICAL-2) all ten grounding cards' REAL headings — including the
   bare-numeral forms "4.13 Guaranty.", "4.9 Guarantees.", and "5.14
   Guarantee." — classify GUARANTY at stage 1 via the review-time
   all-titles script (live Supabase, never stubbed into `npm test`), and
   "Obligations of Parent", "Credit Support; Guarantees", "Pre-Closing
   Restructuring; Guarantee Releases", and "4.07 Unclassified — Equity
   Financing" (`5a4426d5…`, audit CRITICAL-3, NON-dispatchable) decline
   by name.
5. **Lexicon:** table validation (keys registered — both new concepts;
   multi-form entries as separate pattern_ids; static max ≤ 128;
   rationale per pattern; content hash re-pinned; version bump);
   anti-noise regression paragraph extended with the `f7ca5d77…`
   courier sentence, an Indebtedness-definition guaranty limb
   (`34adc38d…` bytes), an IOC guarantee-restriction sentence and a
   REP-B-FUNDS ECL sentence — asserted zero hits under the exclusions;
   one EXPECTED unmatched-signal pinned for "hereby guarantees" inside
   the committed `9675f138…` D&O limb and one for
   /\bLimited Guarantees?\b/ inside the committed `c9e0767d…`
   integration paragraph (deletion-proofed by test); each surviving
   pattern hits its own grounding quote in committed fixtures;
   determinism permutation tests green under the grown table.
6. Full suite + `npm run build` + forbidden-patterns (fixtures inside
   the exempt directory class; zero new exemption entries — any
   collision is fixed by restructuring the offending file, never by
   widening FILE_PATTern exemptions); phase allowlist for the slice's
   files.

## Flagged for Ben (label-coverage-gap adjudication items — proposals,
not defaults; each with its recorded candidate grounding set)

1. **The two new codes this slice ships:** `GTY-PERF`, `GTY-DELIVERY`
   (+ three claim definitions + the rank-75 tier). Standard PR-body
   flag.
2. **The financing-source protective-trio residual — the family brief's
   named collision, flagged rather than claimed.** The lender-protective
   sections ("Financing Sources", "Debt Financing Sources", "Certain
   Financing Provisions", "Financing Source Protective Provisions" —
   12+ distinct label strings for one concept cluster, pack §5-2;
   ~20 cards across the §2a table) bundle (i) non-recourse shields —
   REM-NONRECOURSE's, with the pack's additional cards recorded in
   Boundary 1 as candidate grounding expansions for THAT slice; (ii)
   jury waivers — REM-JURY's; (iii) forum/governing-law carve-outs for
   financing-source suits — the misc-boilerplate spec's boundary 5
   rules these stay inside quotes, unowned; (iv) third-party-beneficiary
   grants to Financing Sources and no-amendment-without-consent limbs —
   owned by NOBODY. Items (iii)–(iv) are a real, recurring, unowned
   residual (grounded: `16bb5a15…` §9.16 — Manhattan federal forum + TPB
   grant over enumerated sections; `1bdddd29…` §9.15 — "Lender
   Protective Provisions" defined-term bundle; `b903ed81…`, `7580f059…`,
   `063e2030…`, `3e0c3a24…`, `1789878a…`, `571e453a…`; venue-phrasing
   variants pack §4). DECISION FOR BEN: promote a future FINSRC-residual
   family, or extend the REM family's vocabulary in a REM-slice reviewed
   diff. Not decided here; the whole cluster stays open world this
   slice, and the producer prompt names it as never-a-guaranty-assertion.
3. **Candidate future codes, one-card-each, open world with recorded
   grounding sets** (the dividends single-card discipline): target
   credit-support disclosure (`528d636d…`); pre-closing guarantee-release
   covenant with post-closing indemnity backstop (`de62e6b7…`);
   undertaking-to-cause / obligations-of-parent sections (`74ff9e77…`);
   recital-form guaranty disclosure (`1c2f232b…`/`170e1669…` source
   recital); the no-default-under-guaranty enum rep; the
   payment-vs-collection form attribute (`2cac9a14…`); the "as principal
   and not as surety" suretyship-waiver form attribute (`d6b3b7ac…`,
   audit CRITICAL-1).
4. **Ingest-QA flags (never absorbed here):** the five DEFINITION-article
   duplicate/recital rows (`506f64b5…`, `26e52528…`, `1c2f232b…`,
   `170e1669…`, and `935cdc91-0ad1-44c8-b95f-cb421800090a` — DEF-CONTRACT,
   deal `af4940e1…` Skechers, section_ref "2.1 | Contract", byte-
   duplicating `252c2296…`'s delivery-rep text; added per audit
   MATERIAL-1); the false `[PROPOSED]` label on `74ff9e77…`; the
   `c8a7955c…` REP-B-EQUITY mislabel; the ≥2 plain-`Unclassified`
   guaranty reps the `[PROPOSED]` count misses.
5. **FAMILY_MAPPING_TABLE / v1↔v2 mapping:** there is no v1 subtype to
   map — the table edit, when it comes, is a Fable+Ben decision over the
   null-subtype homes, never implementer-inferred.

## Out of scope

- Everything in Flagged-for-Ben items 2–3 (open world, typed,
  preserved); any guaranty-cap or fee-keyed amount machinery (Boundary
  2); any non-recourse/jury/forum claim (Boundary 1); any scope-closure/
  ABSENT work; any M3 amendment.
- Resolution of the Limited Guaranty instrument's own terms — the
  exhibit is not in the corpus; relationship-layer work if the exhibits
  are ever ingested.
- A `GTY_GUARANTOR` party role and cross-deal canonicalization of
  guarantor_ref values (Ben adjudication over observed values, later).
- Live re-extraction runs (dated handoffs; until they land, no report
  may claim native guaranty extraction — M-5).

## Known costs, stated up front

- **Corroboration-conjunct recall:** the `performance` conjunct on
  PERFORMANCE_GUARANTY would queue a pure payment-only guaranty ("hereby
  guarantees the payment obligations…") if a future deal drafts one —
  no grounded card does; the conjunct is the wall against the D&O
  cross-hit and general obligation-support prose, and it grows only by
  reviewed diff with a corpus receipt.
- **GUARANTY_IN_EFFECT is grounded on three of five delivery cards** —
  assertions over the other two resolve only if their own quotes carry
  the pattern; otherwise they queue. Priced: a queued correct claim
  beats a pattern widened without a receipt.
- **The bare-title stage-1 rule admits REPRESENTATIONS context**, so a
  hypothetical target-side "Guarantees" rep section would dispatch here
  and its assertions would queue at corroboration (no
  delivery/performance collocation). Cost is a queue item; the
  alternative (declining reps context) would orphan four of five
  delivery grounding cards.
- **Lexicon cross-hits are guaranteed** ("hereby guarantees" in DNO
  sections; "Limited Guarantee" in integration clauses) — veto-only
  queue noise, pinned as EXPECTED so deletions break tests; deletion
  asymmetry applies.
- **55% of the corpus carries `[PROPOSED]`/unclassified guaranty-family
  stamps, and this slice's two concepts cover only the guaranty subset
  (~13 of the 32+ cards, up from ~11 once the CRITICAL-1/-3 audit
  additions — `d6b3b7ac…` grounded, `5a4426d5…` recorded
  NON-dispatchable — are counted).** The financing-source remainder is
  Boundary
  1's cession plus Flagged-for-Ben item 2 — stated so nobody reads this
  slice as closing the whole gap.
- **Rank 75 may collide with sibling-wave proposals at Ben's table**
  (REM 25; tax/employee 80; DNO 85) — ordering is a single Ben call at
  the last landing PR, flagged in all PR bodies.
