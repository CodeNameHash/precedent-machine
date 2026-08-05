# Family — D&O indemnification & insurance covenants (DNO-*)

**Date:** 2026-08-03. **Status:** AUDIT-AMENDED — 2 CRITICAL, 2 MATERIAL,
4 MINOR findings applied from the 2026-08-03 adversarial audit (0 parked
for Fable); program convention is spec-detail → audit → build → review,
and this spec has cleared audit → amend, awaiting build.
**Parent:** `2026-08-02-openworld-promotion-program.md` (five-layer promotion
structure and cross-slice invariants apply verbatim).
**Template:** `2026-08-02-p1-captable-numerics-design.md` (slice shape,
typed-abstain parser discipline, corroboration tables, coverage-map
anchored-overlap + honesty pins — this family ships TWO numeric parsers, so
the P1 discipline is load-bearing, not ceremonial).
**Wave exemplars bound:** `2026-08-02-family-termination-rights-design.md`
(the producer-prompt-registry seam — this family dispatches through it,
NEVER a capitalisation fallback; the seam is BUILT at head:
`lib/canonical-v2/native-producer/producer-prompt-registry.js` carries
CAPITALISATION and TERMINATION_FEE entries in a module-private frozen Map,
so this slice adds ONE entry to the existing Map in its own reviewed diff,
it does not build the seam);
`2026-08-02-family-termination-fee-design.md` (typed money/number-parse
discipline, pre-concept review routing; ALSO the sibling that already owns
the registered concept `TERMF-TAIL` — "tail" there is the no-shop TAIL
PERIOD fee, a wholly different legal object from tail INSURANCE; the
collision is priced in section 5);
`2026-08-02-family-closing-conditions-design.md` (presence-claim shape;
pinned co-resolution pairs; the definition-keyed revisit-pin pattern —
cited, not reused: no bring-down machinery exists in this family);
`2026-08-02-family-consideration-design.md` (the currency-exclusion
INVERSION precedent: an exclusion class in one family's tokenizer is the
candidate class in another's — applied here to PERCENT literals, which P1
never tokenized and the consideration ratio parser EXCLUDED; in this family
the percent literal IS the value);
`2026-08-02-family-ioc-design.md` (compound-limb splitting is producer
work; parsers and resolvers never pick; the fixture-header lint pin);
`2026-08-02-family-specific-performance-remedies-design.md` (the REM-CAP
vacuity ruling, applied at design time to every concept below: a concept
whose grounded text cannot reach its producer under this spec's own
dispatch rules is an automatic audit CRITICAL);
`2026-08-03-family-employee-matters-design.md` (the SIBLING spec this wave
whose test 5 already pins that "Indemnification of Directors and Officers"
/ "D&O Insurance" titles never classify EMPLOYEE_MATTERS — this spec is the
family those titles were being held for; the "no less favorable" lexicon
cross-hit is priced THERE and deliberately not double-keyed here);
`2026-08-02-family-financing-covenants-design.md` (the
`runStage1(title, article_context)` classifier signature and the
exact-keys materiality tier — both adopted; head's `runStage1(title)` is
extended once, to that spec's §3, by whichever wave family lands first).
**Protocol authority:** docs/codex-program/EXECUTION-LEDGER.md — M3 review
protocol + extraction semantics rules 1–3. This spec may not amend them.
Rule 1 is restated in section 1 because this family's drafting is the
corpus's most tempting negative-assertion surface ("uncapped" is NOT a
claim — see the 6c ruling).
**Lexicon authority:** `2026-08-02-lexical-disagreement-net-design.md`
(word boundaries, case-sensitive acronyms, deletion asymmetry, priced
blind spots; static max ≤ 128; multi-form entries expand to separate
pattern_ids; every case-sensitive defined-term regex below carries
explicit `\b`).
**Materiality:** no tier covers this family today (`MATERIALITY_TABLE`,
`candidate-resolution.js` ~523–534, carries no D&O or indemnification
prefix — a resolved DNO claim would rank UNCLASSIFIED 99, below notices).
Section 4 proposes ONE exact-keys tier, flagged for Ben.

## Corpus grounding (production Supabase, project `tzulhdasmioeechxapdy`;
evidence pack read 2026-08-02 — pack quotes are ground truth, cited by
provision_card id; four supplementary SELECT-only queries run 2026-08-03
by this spec's author, receipts inline below)

v1 population (pack §4): `COV-DO` × COVENANT_OTHER **38 cards / 38 deals**
(one card per deal — the family's defining granularity fact), plus 1 stray
`COV-DO` × DEFINITION noise row (qlen 61, id `620fa61a-e257-4bea-929c-
ee439bd33076` — excluded from every fixture, flagged to ingest-QA), plus 3
`COV-INDEMN` cards that are NOT this family at all (pack §5 — the
mislabeling trap, disposed of in Boundaries). Total real family corpus:
38 monolithic cards, median primary_quote ~7,800 chars, each bundling
indemnification scope, advancement, tail-insurance mechanics, survival,
successor-assumption and third-party-beneficiary language under ONE quote.
**There is no DB-level sub-provision granularity** (pack §4, §7-7): every
sub-clause taxonomy below is authored against raw quote text and proven on
committed fixture bytes — it does not pre-exist in any column.
`needs_review` is FALSE on 100% of these cards; `extracted_by = 'CODEX'`,
`extraction_version = 'm2-00-corpus-backfill-v1'` on all 42 — no reviewer
signal exists for any defect below.

Grounding quotes this spec builds on (every corroboration pattern, enum
code, parser rule and lexicon entry traces to one of these; nothing is
fabricated). Pack quotes cited by pack section; author-query quotes carry
inline receipts:

- **Tail premium cap, digit form (the 300% market standard)** — card
  `01d091dc-03b3-4e25-8551-0ca5ecea3a12`, §4.13 (pack §6a): "…nor shall
  Parent or the Forward Surviving Company be required to expend, in the
  aggregate for such policies an amount in excess of 300% of the annual
  premiums currently paid by the Company for such insurance; and provided,
  further, that if the annual premiums of such insurance coverage exceed
  such amount…". 30 of 38 cards carry the 300% figure (**AUDIT-AMENDED,
  m-1:** the originally-drafted "32 of 39" does not reproduce against a
  live count and the 39-card denominator is inconsistent with this spec's
  own pinned n=38 corpus; restated as 30/38, and every other denominator
  in this section normalized to 38 below).
- **Tail premium cap, spelled-with-parenthetical form** — card
  `e1bbd97e-6636-4752-8e5c-1c757f51d0a4`, §5.10 (pack §6a): "…that such
  \"tail\" insurance policies shall not require the payment of an
  aggregate premium in excess of three hundred percent (300%) of the
  aggregate annual premium most recently paid by the Company prior to the
  date hereof to maintain the D&O Insurance."
- **Non-300% caps** — `2189a30a-cab6-4b45-aff2-56b355872f86`, §6.10 (pack
  §6a): "…for a cost less than or equal to three hundred fifty percent
  (350%) of the Current Premium, the Company shall instead obtain as much
  comparable insurance as possible for an aggregate premium equal to three
  hundred fifty percent (350%) of the Current Premium."; and
  `12947306-83ac-41bf-805f-1499711139ec`, §6.08 (pack §6a): "…for the
  6-year period following the Closing and at an aggregate price not to
  exceed 225% (the \"Premium Limit\") of the amount per annum the Company
  paid or required to be paid for a 12-month period under the Current
  Policy…" — the cap value doubles as a DEFINED TERM ("Premium Limit").
- **TWO independent caps in one card** — `527c2062-318c-45a3-8953-
  5277794dcaa7`, §6.7 (pack §6a): primary cap "…Parent will not be
  required to pay annual premiums in excess of 300% of the last annual
  premium paid by the Company prior to the date hereof…" AND, later in the
  same card for a separate policy, "…the Company shall not pay an
  aggregate amount for such policy in excess of 450% of the current
  aggregate annual premium paid by the Company for the existing policy…".
- **The percent false positive** — `7d1e7f6e-a126-48ed-8fc3-417fdd6df281`
  (pack §6a warning): "…or transfers at least 50% of its properties and
  assets to any other Person, then in each such case proper provision
  shall be made…" — a successor-assumption clause, NOT a premium cap. Any
  percent machinery must fail this quote closed.
- **Cap off-agreement, via Disclosure Schedule** — `9b12cb2f-3c0d-4877-
  9aec-6b799866673d`, §6.3 (pack §6b): "…Cavalier may elect in its sole
  discretion, but shall not be required, to spend more than the amount set
  forth on Section 6.3 of the Maverick Disclosure Schedules (the \"Cap
  Amount\") for the six (6) years of coverage under such \"tail\"
  policy…"; identical structure in `c7f36323-a090-43b8-8ad5-5f65af36ad1f`
  §7.1 and `e4b70e97-d213-4c8f-92f4-b72bd65fa021` §6.3; hybrid
  `4052eaf1-d415-4615-963e-f628926b7d0b` §5.8 puts even the PERCENTAGE
  off-agreement ("the percentage set forth in Section 5.8(b) of the
  Company Disclosure Letter"). 4+/38 cards (AUDIT-AMENDED, m-1): the
  numeric value is unrecoverable from quote bytes by design of the
  agreement itself.
- **Uncapped tail** — `0f6fce9e-8ae9-49fa-aaa2-879e214185bb`, §7.9 (pack
  §6c): "six-year prepaid D&O tail policy… with terms, conditions,
  retentions and limits of liability that are no less favorable than the
  coverage provided under PubCo's existing policies", zero cap language;
  same in `9e16b52c-11b8-4492-8f4f-136e896ea63b` §7.04 ("…for the six year
  period", no cap).
- **Period surface forms** (pack §6d): "six-year", "six (6)-year",
  "six (6) year anniversary", "sixth (6th) anniversary", "6-year",
  "six years" — value 6 on essentially all 38 cards (AUDIT-AMENDED, m-1),
  zero deviations in
  this corpus. One alternate-trigger variant — `9b12cb2f…` §6.3(b): "…from
  the Maverick Effective Time and until the later of (x) six (6) year
  anniversary of the Maverick Effective Time or (y) the expiration of the
  statute of limitations applicable to such matters, Cavalier shall cause
  the organizational documents…" — a MAX(6-year date, SOL expiry) formula
  a naive year extractor would silently flatten.
- **Advancement day counts** (pack §6e): 10 days (`973e6b36-6c0b-4f35-
  a3d8-d66daac4460a` §6.9 "…promptly (and in any event within ten (10)
  days) after receipt by Parent or the Surviving Corporation of a written
  request for such advance…"; `4052eaf1…` §5.8), 15 days (`6848fc24-3dc2-
  4392-942f-ec0722f2ad54` §6.04; `c7f36323…` §7.1 "…within fifteen (15)
  days after receipt by the Surviving Company of a written request for
  such advance…"), 30 days (`9254f119-cd50-4344-bd27-0bc1100b93f6` §6.10);
  many cards impose advancement with NO day count at all ("to the fullest
  extent permitted under applicable Law", `9b12cb2f…`, `01d091dc…`).
- **Indemnification-continuation operative text** (author query receipt 2):
  `973e6b36…` §6.9: "…will (and Parent will cause the Surviving
  Corporation to) indemnify and hold harmless, to the fullest extent
  permitted by applicable law or pursuant to any indemnification
  agreements with the Company and any of its Subsidiaries in effect on the
  date hereof, each Indemnified Person from and against any costs, fees
  and expens…"; `41cc2470-9985-4101-9af7-b8d07254dc4e` §6.8: "…shall (and
  Parent shall cause the Surviving Corporation to) indemnify and hold
  harmless each Indemnified Person…"; `527c2062…` §6.7: "Parent shall, and
  shall cause the Surviving Corporation to, indemnify and hold harmless
  each present and former director or officer of the Company and its
  Subsidiaries, or any other Person that is or was serving at the request
  of the Company as a director, officer, employee or agent of another
  corporation or of a partnership,…"; rights-continuation form
  `6848fc24…` §6.04(a): "All rights to indemnification, advancement of
  expenses, and exculpation by the Company and Company Subsidiaries
  existing in favor of those Persons who are directors or officers of the
  Company or any Company Subsidiary as of the date o…".
- **Charter/bylaw protection continuation** (author query receipt 2):
  `973e6b36…` §6.9: "…[organizational] documents of the Surviving
  Corporation and its Subsidiaries to contain provisions with respect to
  indemnification, exculpation from liabilities and the advancement of
  expenses that are at least as favorable as the indemnification,
  exculpation and advancement of expenses provisions set forth in the
  Charter, the Bylaws and the other similar organizational…"; `41cc2470…`
  §6.8: "…the Surviving Corporation to contain provisions with respect to
  indemnification, exculpation and the advancement of expenses that are no
  less favorable to the Indemnified Persons than the indemnification,
  exculpation and advancement of expenses provisions contained in the
  certificate of incorporation an…"; the `9b12cb2f…` §6.3(b) "cause the
  organizational documents" quote above.
- **Survival forms** (author query receipt 3): `6848fc24…` §6.04: "…said
  Indemnified Persons (in effect as of the date of this Agreement and made
  available to Parent) shall survive the Merger and shall not be amended,
  repealed, or otherwise modified for a period of six (6) years from the
  Effective Time in any manner th…"; `41cc2470…` §6.8: "…then the
  obligations of Parent and the Surviving Corporation under this Section
  6.8 shall survive the sixth (6th) anniversary of the Effective Time
  until such time as such claim is fully and finally resolved."
  (pending-claim extension — open world, Out of scope); `edad0ad3-96f8-
  4320-9e7e-afba45a6a0a1` §5.26 (the RMT deal's TRUE D&O card): "…this
  Section 5.26 shall survive the Closing indefinitely and shall be
  binding, jointly and severally, on all successors and assigns of
  Columbus." — INDEFINITE survival, no year literal: a live abstain case,
  not a parser target.
- **Third-party-beneficiary rights for covered persons** (author query
  receipt 1 — the family brief's exception to the no-3PB pattern):
  `973e6b36…` §6.9: "…O Insurance or the \"tail\" policy referred to in
  Section 6.9(c) (and their heirs and representatives) are intended to be
  third party beneficiaries of this Section 6.9, with full rights of
  enforcement as if such person were a Party."; `527c2062…` §6.7: "…(it
  being expressly agreed that the Indemnified Parties to whom this Section
  6.7 applies will be third party beneficiaries of this Section 6.7).";
  `9e16b52c…` §7.04: "…hall be enforceable by, each Indemnified Party, and
  his or her heirs and legal representatives, each of whom shall be a
  third party beneficiary under this Section 7.04."
- **Real section headings embedded in quote bytes** (author query
  receipt 4 — v1 `section_ref` label strings are all the SAME normalized
  rubric label "D&O Indemnification and Insurance" on 38/38 cards, so
  stage-1 rules are authored from REAL headings recovered from
  primary_quote text, the employee-matters honest-dispatch discipline):
  "Section 6.04 Indemnification of Officers and Directors." (`6848fc24…`);
  "Section 6.7 Indemnification; Directors' and Officers' Insurance."
  (`527c2062…`); "Section 5.26 D&O Indemnification and Insurance."
  (`edad0ad3…`); "Section 6.3 Director and Officer Liability."
  (`219a2167-d344-4a91-99c3-060f6efb7ba1`).
  **AUDIT-AMENDED (per REM-CAP recall requirement):** the original four
  headings above are a non-representative sample — full recovery over all
  38 cards' quote bytes surfaces four additional shapes the v1-ported
  rules below did NOT match prior to this amendment: "Director and Officer
  Matters" (`0f6fce9e…` — the uncapped-tail grounding card); "Directors'
  and Officers' Exculpation, Indemnification and Insurance" (`973e6b36…`,
  `4f9cd857…`, `7146a9fb…`, `ce0cff88…` — `973e6b36…` is this spec's
  single most-cited grounding card); "Indemnification, Exculpation and
  Insurance" (`13353ed9…`, `2ca3c2c7…`, `c1a3dc0f…`); "Indemnification and
  Insurance" (`b27776a0…`). A tenth card, `cdf55b01…`, carries the bare
  title "Indemnification." — this is Boundary 2's pinned bare-
  indemnification DECLINE (unchanged; `cdf55b01…` is deliberately stage-2-
  only, never a stage-1 recall target). The rule set in section 3 is
  amended so all 38 recovered headings (minus the one pinned decline)
  classify DNO at stage 1; see the recall pin in test 4.

**Query receipts (SELECT-only, `provision_cards` restricted to
`provision_subtype='COV-DO' AND provision_type='COVENANT_OTHER'` (n=38),
run 2026-08-03):**

1. **TPB probe:** "third[- ]party beneficiar" 13 cards / 13 deals; "for
   the benefit of" 29 cards. Snippets pulled for `973e6b36…`,
   `527c2062…`, `9e16b52c…` (quoted above).
2. **Sub-clause phrase probes:** charter vocabulary (certificate of
   incorporation / organizational documents / bylaws) 37/37; "exculpation"
   37/37; "advancement of expenses" 36/36; "indemnify" 35 cards;
   "Indemnified Person|Party" 37/37; "indemnify and hold harmless"
   snippets pulled for `973e6b36…`, `41cc2470…`, `527c2062…` (quoted
   above); successor vocabulary ("successors and assigns"/"successor")
   38 cards — universal, which is exactly why bare successor language is
   NOT a concept tell (it hosts the 50% false positive).
3. **Survival probe:** "shall survive" 22 cards / 22 deals; "no less
   favorable" 30/30; case-sensitive `D&O Insurance` defined term 16
   cards; "run[- ]?off" 4 cards (no verbatim snippet pulled — run-off is
   therefore NOT a lexicon pattern this slice; section 5).
4. **Heading recovery:** embedded "Section N.NN Title." headings pulled
   from quote bytes (four quoted above); title-label column is useless
   for rule authoring (38/38 identical rubric label).

## Grounding corrections (verified against repo + production DB, 2026-08-03)

1. **No registered v2 vocabulary exists for this family.** Verified: grep
   of `lib/canonical-v2/contract-bundle.js` for `DNO`/`COV-DO`/`indemnif`
   returns zero hits. `TERMF-TAIL` IS registered — it is the termination-
   fee family's tail-PERIOD fee concept, not insurance; nothing here
   touches it. Every concept below is new and FLAGGED FOR BEN.
2. **Two v1 codes exist and are not equivalent** (pack §1): `COV-DO`
   (lib/rubric.js:2532) is the real family; `COV-INDEMN` (rubric:2215,
   "Indemnification; D&O Insurance") is a 3-card, 1-deal mislabeling trap
   — its cards are ordinary buyer/seller cross-indemnification in a
   Reverse-Morris-Trust separation (deal `df393645…` §§7.2/7.3/7.4:
   indemnitees, aggregate-loss baskets, a "Springing Indemnity
   Condition"), carrying "D&O Insurance" only via the shared Article VII
   heading. The TRUE D&O covenant in that same deal is the COV-DO card
   `edad0ad3…` §5.26. The 3 COV-INDEMN cards are flagged to ingest-QA as
   v1 label defects and never absorbed; Boundary 2 and the classifier
   declines dispose of the population.
3. **v1's only structured D&O fields are the COV-DO FEATURES block**
   (rubric.js:4744–4750: `mainConcept`, `insuranceCap` — typed free TEXT
   precisely because the cap is sometimes a percent, sometimes an
   off-agreement schedule reference, sometimes absent —
   `advancementOfExpenses` boolean, `notificationConsequences`,
   `additionalTerms`). None of these v1 fields is ever read, mapped or
   aliased by this slice: v2 claims come only from byte-verified quote
   text. The `insuranceCap` free-text typing is treated as EVIDENCE that a
   single numeric cap field is the wrong shape — this spec splits it into
   a typed percent claim and a typed off-agreement presence claim.
4. **The stray DEFINITION row** (`620fa61a…`, qlen 61) is excluded from
   all fixtures and flagged to ingest-QA (pack §7-8).
5. **`needs_review` carries zero signal** (0/42 family cards) — nothing in
   v1 flags the COV-INDEMN trap or the noise row. Flagged to the
   ingest-QA owner; never absorbed here.
6. **Bundle version numbering:** this spec binds to "the next frozen
   version at this slice's merge"; every superset-diff acceptance test is
   written against CONTENT (sorted key sets), never the numeral.

## Cross-family boundaries (BINDING; duplication is an automatic audit
CRITICAL; each pin has a named acceptance test in section 6)

1. **Employee-matters — the sibling spec this wave.** Its test 5 already
   pins that the COV-DO title fingerprint ("Indemnification of Directors
   and Officers" / "D&O Insurance" forms, `lib/parser-v2/classify.js:307`)
   never classifies EMPLOYEE_MATTERS; this spec is the reciprocal owner.
   Reciprocal pin here: "Employee Matters"-shaped titles never classify
   DNO (test 4). The shared drafting phrase "no less favorable" is that
   spec's lexicon entry and its priced D&O cross-hit; it is deliberately
   NOT added to this family's lexicon (section 5) — double-keying would
   flood both families' signals (the tax-matters IOC-phrase precedent).
   Indemnification of EMPLOYEES qua employees stays with employee/comp
   machinery; this family's covered persons are directors, officers and
   persons serving at the company's request (`527c2062…`).
2. **COV-INDEMN / general M&A cross-indemnification — nobody's promoted
   family, and NOT this one.** Grounding correction 2. The classifier has
   NO bare-"indemnification" rule (§3): "Indemnification by Cabot Parent"
   / "Certain Limitations" titles decline; and the resolver's
   INDEM_CONTINUATION corroboration requires director/officer covered-
   person vocabulary in the quote, so even a misdispatched general-
   indemnification quote queues rather than resolves. Test 4 pins both
   layers against the `df393645…` titles.
3. **MISC-THIRDPARTY — the agreement-wide no-3PB provision (rubric:2467,
   FEATURES "Third-Party Beneficiary Exceptions").** The Miscellaneous
   article's no-third-party-beneficiaries section routinely CARVES OUT the
   D&O covered persons — that carve-out text lives in a MISC section that
   never classifies DNO under this spec's dispatch rules, so minting a
   DNO claim from it would be REM-CAP vacuity (automatic CRITICAL).
   `COVERED_PERSON_TPB_RIGHTS` grounds ONLY on the D&O-section-internal
   TPB sentence (all three grounding quotes are in-section: query receipt
   1); the MISC-side exception list stays with a future MISC family.
   Test 4 pins that a "Third-Party Beneficiaries"-titled section declines.
4. **REP-T-INSURANCE (rubric:471) — insurance representations.** Rep-side
   insurance-policy disclosure ("Insurance"-titled rep sections) is reps
   territory; REPRESENTATIONS article_context declines every DNO rule
   (§3). Test 4.
5. **IOC family — interim insurance-maintenance restrictions.** Covenants
   not to let policies lapse during the interim period are interim-
   operating machinery; INTERIM_OPERATING sections dispatch to the IOC
   producer, never here. Test 4.
6. **TERMF-TAIL — the termination-fee family's registered tail-PERIOD
   concept.** Same token, different law: `/\btail\b/i` in a fee section
   means the post-termination fee window. This spec's lexicon keys the
   pattern to `DNO-TAIL` only; the expected cross-hit in TERMF sections is
   priced and pinned as an EXPECTED unmatched signal (section 5) — a veto
   miss there costs nothing (TERMF candidates cover their own sections).
7. **MISC-SURVIVAL (rubric:2378) — (non)survival of representations.**
   "shall survive" fires in every nonsurvival-of-reps section.
   INDEMNIFICATION_SURVIVAL_YEARS grounds only on D&O-section quotes;
   "survival" vocabulary is NOT a lexicon pattern (section 5 exclusions).

## Deliverable (honest conversion semantics)

Governed, resolvable claims for three workstreams: (a) indemnification
continuation — the post-closing indemnify-and-hold-harmless covenant,
charter/bylaw protection continuation, advancement of expenses (all
presence), and the survival period in years (numeric); (b) tail/runoff
insurance — the purchase obligation (presence), the coverage period in
years (numeric), and the premium cap as EITHER a typed percent-of-annual-
premium value (numeric) OR a typed off-agreement schedule-reference
presence claim — never conflated, never guessed; (c) covered-person
third-party-beneficiary rights (presence — the family brief's exception
to the no-3PB pattern).

**No recorded native runs exist over D&O sections** — the producer today
extracts capitalisation plus the wave families' committed harnesses. There
are no open-world fixture rows to convert and no closure_ids to track. The
deliverable is the five-layer capability plus a pre-rerun harness: a
COVERAGE MAP over committed corpus-quote fixtures (the cards named above,
committed as LITERAL production bytes with provenance headers — deal uuid,
provision_card uuid, retrieval date, provision_type and subtype), each
hand-enumerated sub-quote byte-verified as a contiguous substring of the
committed card text and anchored to its parent card per the P1 anchored-
overlap rule, each with its expected outcome (RESOLVED value, typed
ABSTAIN, or typed review reason). The P1 audit M-5 honesty pins apply
verbatim: "the pipeline natively extracts D&O covenants" may be claimed
ONLY after dated post-merge live-run handoffs (subscription CLI); until
then the honest claim is "the machinery exists and is proven on committed
fixtures".

**Fixture placement is load-bearing:** all committed fixtures live under
`tests/fixtures/canonical-v2/dno-fixtures/` (the forbidden-patterns
PROSE_CLASS_FINGERPRINTS-exempt directory class). Checked against
`scripts/lint/forbidden-patterns.sh`'s `PROSE_CLASS_FINGERPRINTS` and
`scopedPatterns` (AUDIT-AMENDED, m-4: corrected from the originally-drafted
"globalPatterns", which does not exist in the file): this family's
vocabulary ("300%", "tail", "Cap Amount", "advancement of expenses",
"indemnify and hold harmless", "third party beneficiaries", "no less
favorable") collides with no global or scoped fingerprint; no new
exemption entries are needed, and no spec prose, fixture or module in this
slice may introduce fingerprinted vocabulary outside the exempt fixture
directory. Per the IOC lint pin, fixture headers carry deal uuid +
provision_card uuid + retrieval date ONLY — never v1 `section_ref` label
strings.

## 1. Registry (`contract-bundle.js` → next frozen version)

Strictly additive spread of the head version at build time. **Three new
concepts, all FLAGGED FOR BEN in the PR body**, `{concept_key, version}`
shape only (the fixture-shape validator rejects anything else). The `DNO-`
prefix is new v2 vocabulary: v1's `COV-DO` is deliberately NOT reproduced
as a concept key — the corpus proves the v1 code is a one-card-per-deal
monolith bundling five or more distinct legal facts (pack §4, §7-7), and
promoting the monolith would fuse them (the tax-matters COV-TAXMATTERS
grab-bag ruling, verbatim). `COV-INDEMN` is never reproduced in any form
(Grounding correction 2).

- `DNO-INDEM` — post-closing indemnification of directors and officers:
  the indemnify-and-hold-harmless continuation, charter/bylaw protection
  continuation, advancement of expenses, and the survival period.
  Grounded: "indemnify and hold harmless" + covered persons across
  `973e6b36…`, `41cc2470…`, `527c2062…`, rights-continuation form
  `6848fc24…`; charter vocabulary 37/37 cards (query receipt 2);
  "advancement of expenses" 36/36; "shall survive" 22/22 (receipt 3).
- `DNO-TAIL` — tail/runoff D&O insurance: the purchase obligation, the
  coverage period, and the premium cap in both grounded forms. Grounded:
  tail vocabulary and cap quotes across `01d091dc…`, `e1bbd97e…`,
  `2189a30a…`, `12947306…`, `527c2062…`, `9b12cb2f…`, `c7f36323…`,
  `e4b70e97…`, `4052eaf1…`, `0f6fce9e…`, `9e16b52c…` (pack §6a–6c).
- `DNO-BENEF` — third-party-beneficiary/enforcement rights of covered
  persons under the D&O covenant itself. Grounded 13 cards / 13 deals
  (query receipt 1; three verbatim quotes above). Deliberately a separate
  concept from DNO-INDEM: TPB status is an enforcement-rights fact about
  WHO may sue, not a protection fact about what is owed — and it is the
  family brief's named exception to the market no-3PB pattern, which Ben
  will want queryable on its own axis.

NOT added (each a legal ruling, not an omission):

- **An "uncapped tail" concept or enum code.** The uncapped cards
  (`0f6fce9e…`, `9e16b52c…` — pack §6c) contain NO cap sentence to quote.
  Under M3 rule 1 the producer never asserts "no cap"; distinguishing
  genuinely-uncapped from cap-not-yet-found is exactly the scope-closure
  machinery's future job. Pack §7-5's warning (schedule-referenced caps
  and uncapped tails both look like "no number present" but mean different
  things) is answered structurally: the schedule case has POSITIVE quote
  text ("Cap Amount", "set forth on Section 6.3 of the … Disclosure
  Schedules") and is a presence claim; the uncapped case has nothing to
  quote and is producer silence, forever.
- **An advancement-timing (day-count) numeric.** Grounded surface exists
  (10/15/30 days, 5 cards/5 deals — pack §6e) but advancement timing is
  frequently qualitative ("promptly", "to the fullest extent permitted",
  no number — same pack section), so the numeric would cover a minority
  of the population while the presence claim covers 36/38 deals. Open
  world, with the five day-count cards recorded here as the candidate
  grounding set for a future reviewed diff; any future promotion ships
  its own typed-abstain day-count parser, never a widening of this
  slice's handlers.
- **A successor-assumption concept.** "Successors and assigns" vocabulary
  is universal (38/38 — query receipt 2) and hosts the corpus's worst
  percent false positive (`7d1e7f6e…`, the 50% asset-transfer trigger).
  Boilerplate-universal presence with a known trap surface is not worth a
  concept (the consideration family's withholding reasoning); open world.
- **A pending-claim survival-extension concept** ("until such time as
  such claim is fully and finally resolved", `41cc2470…`) and the
  indemnification-agreements-assumption shape ("pursuant to any
  indemnification agreements … in effect on the date hereof",
  `973e6b36…`) — qualifier-track material (P2 seam) living inside the
  host claims' quotes as reviewer evidence; open world.

**Claim definitions** (nine; six presence, three numeric —
**AUDIT-AMENDED, M-1:** the originally-drafted count of eight omitted
`COVERED_PERSON_TPB_RIGHTS`, which §4's frozen kind map and Boundary 3
already require; corrected here and the definition added below):

```
INDEMNIFICATION_CONTINUATION_CLAIM_DEFINITION_V1
  claim_definition_key: 'INDEMNIFICATION_CONTINUATION'
  version: 1
  allowed_canonical_values: [true]           // presence claim
  canonical_value_required_when_present: true

CHARTER_PROTECTION_CONTINUATION_CLAIM_DEFINITION_V1
  claim_definition_key: 'CHARTER_PROTECTION_CONTINUATION'
  version: 1
  allowed_canonical_values: [true]
  canonical_value_required_when_present: true

ADVANCEMENT_OF_EXPENSES_CLAIM_DEFINITION_V1
  claim_definition_key: 'ADVANCEMENT_OF_EXPENSES'
  version: 1
  allowed_canonical_values: [true]
  canonical_value_required_when_present: true

INDEMNIFICATION_SURVIVAL_YEARS_CLAIM_DEFINITION_V1
  claim_definition_key: 'INDEMNIFICATION_SURVIVAL_YEARS'
  version: 1
  canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING'   // existing type
  canonical_value_required_when_present: true

TAIL_POLICY_OBLIGATION_CLAIM_DEFINITION_V1
  claim_definition_key: 'TAIL_POLICY_OBLIGATION'
  version: 1
  allowed_canonical_values: [true]
  canonical_value_required_when_present: true

TAIL_POLICY_PERIOD_YEARS_CLAIM_DEFINITION_V1
  claim_definition_key: 'TAIL_POLICY_PERIOD_YEARS'
  version: 1
  canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING'
  canonical_value_required_when_present: true

TAIL_PREMIUM_CAP_PERCENT_CLAIM_DEFINITION_V1
  claim_definition_key: 'TAIL_PREMIUM_CAP_PERCENT'
  version: 1
  canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING'
  canonical_value_required_when_present: true
  // UNIT PINNED IN THE DEFINITION DOC-COMMENT: percent of the annual
  // premium base named by cap_basis_ref; canonical '300' means 300%.
  // Never a fraction, never normalized to 3.0.

TAIL_PREMIUM_CAP_OFF_AGREEMENT_CLAIM_DEFINITION_V1
  claim_definition_key: 'TAIL_PREMIUM_CAP_OFF_AGREEMENT'
  version: 1
  allowed_canonical_values: [true]
  // Meaning pinned: a premium cap EXISTS and its value is defined only
  // by a disclosure-schedule/letter reference the agreement body does
  // not state. NOT "uncapped", NOT "unknown" — a positive quoted fact.
  canonical_value_required_when_present: true

COVERED_PERSON_TPB_RIGHTS_CLAIM_DEFINITION_V1
  // AUDIT-AMENDED (M-1): added — this definition was consumed by §4's
  // frozen kind map (TPB_RIGHTS → DNO-BENEF × COVERED_PERSON_TPB_RIGHTS)
  // and Boundary 3 but never registered in the original draft.
  claim_definition_key: 'COVERED_PERSON_TPB_RIGHTS'
  version: 1
  allowed_canonical_values: [true]           // presence claim
  canonical_value_required_when_present: true
```

No new canonical value types; no validator changes. New concepts and
definitions grow the expected-keys rows as sorted supersets
(content-diffed tests; prior rows byte-untouched).

**Definition-split rulings, pinned as legal decisions:**

- **The percent cap and the off-agreement cap are TWO definitions, never
  one field.** v1's free-text `insuranceCap` (Grounding correction 3) is
  the cautionary exhibit: a single field forced 300%-percent values,
  "Cap Amount (see Schedule)" pointers and absence into one string. The
  two v2 shapes have different truth conditions (a number the agreement
  states vs. a cap the agreement delegates) and different downstream uses
  (market-percentile statistics vs. diligence flags). A quote that
  corroborates BOTH forms at once routes to review (section 4) — the
  resolver never picks.
- **Tail period and indemnification survival are TWO definitions,** even
  though both are "6" essentially corpus-wide: one is the coverage term
  of a purchased policy, the other the life of a contractual obligation,
  and the `9b12cb2f…` deal proves they can diverge structurally (fixed
  6-year tail purchase; MAX(6-year, SOL) survival trigger). Both consume
  the same parser module (section 2b).
- **TPB rights are presence-only.** The enforcement-mechanics gradations
  ("with full rights of enforcement as if such person were a Party",
  "and his or her heirs and legal representatives") stay inside the quote
  as reviewer evidence; grading them is qualifier-track material.

**Governed attributes (never in keys; all participate in claim
identity/closure so same-section claims never collide or dedupe):**

- `TAIL_PREMIUM_CAP_PERCENT`:
  - `cap_basis_ref`: REQUIRED verbatim phrase naming the premium base
    ("the annual premiums currently paid by the Company for such
    insurance", `01d091dc…`; "the aggregate annual premium most recently
    paid by the Company prior to the date hereof", `e1bbd97e…`; "the
    Current Premium", `2189a30a…`; "the last annual premium paid by the
    Company prior to the date hereof" and "the current aggregate annual
    premium paid by the Company for the existing policy" — the two
    DISTINCT bases inside `527c2062…`). Substring-enforced against the
    byte-verified quote (P1 M-3 discipline), typed
    `CAP_BASIS_REF_NOT_IN_QUOTE` on failure. Identity-bearing: it is what
    keeps the `527c2062…` 300%/450% pair as two claims that never dedupe.
  - `cap_term_ref`: OPTIONAL verbatim defined-term phrase ("Premium
    Limit", `12947306…`), substring-enforced when supplied
    (`CAP_TERM_REF_NOT_IN_QUOTE`). Evidence anchor only.
- `TAIL_PREMIUM_CAP_OFF_AGREEMENT`:
  - `schedule_ref`: REQUIRED verbatim phrase naming the off-agreement
    location ("Section 6.3 of the Maverick Disclosure Schedules",
    `9b12cb2f…`; "Section 7.1 of the Company Disclosure Schedules",
    `c7f36323…`; "Section 5.8(b) of the Company Disclosure Letter",
    `4052eaf1…`). Substring-enforced, typed
    `SCHEDULE_REF_NOT_IN_QUOTE`. The reference is a verbatim evidence
    anchor, never resolved to schedule content (schedules are not in the
    corpus — pack §6b; resolving them is relationship-layer work).
  - `cap_term_ref`: OPTIONAL verbatim ("Cap Amount"), substring-enforced.
- The five presence claims and the two period claims carry NO attributes
  beyond the quote. The indemnitor is near-uniformly "Parent and/or the
  Surviving Corporation"; no party is minted anywhere in this slice
  (flagged as a deliberate narrowing — a `DNO_INDEMNITOR` party role is a
  future reviewed diff once the commonality report shows variance worth
  dimensioning; the tax-matters FIRPTA no-party reasoning).

M3 rule 1 restated for this family, because its drafting is the corpus's
most tempting negative surface: the producer NEVER asserts "tail
uncapped", "no advancement obligation", "no third-party-beneficiary
rights", or "indemnification does not survive". The uncapped-tail cards
(`0f6fce9e…`, `9e16b52c…`) produce a TAIL_POLICY_OBLIGATION presence claim
and NOTHING about caps. Carve-out prose ("provided, further, that if the
annual premiums of such insurance coverage exceed such amount…",
`01d091dc…`) is exception text that stays inside the claim's quote as
evidence. Derived ABSENT belongs to the future scope-closure machinery,
forever.

## 2. Value parsers: TWO new pure modules (typed-abstain, the
`measurement-date-parse.js` contract shape: `{outcome:'RESOLVED',
canonical_value, matched_text}` or `{outcome:'ABSTAIN', reason}` — never a
throw on prose, never arithmetic, never repair, never reading spelled-out
words as numbers)

**The consideration-inversion applied (this family's defining numeric
discipline):** P1's share-count tokenizer had no percent class at all, and
the consideration ratio parser EXCLUDED `\d+(\.\d+)?%` as noise. In this
family the percent literal IS the value — the exclusion class inverts into
the candidate class. Conversely, bare numerals, currency literals and
dates are non-candidates in both modules below by construction of their
token grammars.

### 2a. `tail-premium-cap-parse.js`

- Candidate token: a percent literal — a maximal digit run with optional
  single decimal point immediately followed by `%`
  (`^\d{1,3}(\.\d+)?%$` after extraction). Grounded values: 225, 300,
  350, 450 (pack §6a). The spelled-with-parenthetical form
  ("three hundred percent (300%)", `e1bbd97e…`; "three hundred fifty
  percent (350%)", `2189a30a…`) resolves through its PARENTHETICAL DIGIT
  token — the spelled words are never read (pack §7-1 is satisfied
  without a word table).
- Exactly ONE surviving percent literal → RESOLVED. Canonical form: strip
  the `%`, preserve digits as written (`'300'`, `'225'`, `'350'`); must
  round-trip `canonicalValueAllowed`'s `NON_NEGATIVE_DECIMAL_STRING`
  regex.
- ≥2 surviving percent literals → ABSTAIN `MULTIPLE_PERCENT_LITERALS` →
  review. This is the `527c2062…` two-cap card unsplit (300% + 450% —
  pack §7-3): the two caps are TWO claims with different cap_basis_refs;
  the producer splits, the parser never picks (the IOC compound-limb
  rule). It is ALSO the `e1bbd97e…`-style repeated-value drafting when a
  quote repeats its own figure ("…(350%)… equal to three hundred fifty
  percent (350%)…", `2189a30a…`) — pinned: repeated IDENTICAL percent
  literals count as ONE candidate (exact string equality after
  extraction), so the `2189a30a…` sentence resolves 350 rather than
  abstaining on its own echo. Distinct values never merge.
- Zero percent literals, quote matching the off-agreement grammar
  (/set forth (on|in) Section \d+(\.\d+)*(\([a-z0-9]+\))?[^,;.]{0,40}
  Disclosure (Schedule|Letter)/i — bounded) → ABSTAIN
  `CAP_VALUE_OFF_AGREEMENT` — the typed signal that the assertion belongs
  under `TAIL_PREMIUM_CAP_OFF_AGREEMENT`, not the percent definition
  (grounded `9b12cb2f…`, `4052eaf1…`). **AUDIT-AMENDED (C-2):** the
  originally-drafted bounded class `[^.]{0,40}` cannot cross the decimal
  point inside the section number itself ("Section 6.3 of the … Disclosure
  Schedules" contains a `.` before 40 chars are exhausted), so it matched
  ZERO cards corpus-wide, including all four of this pattern's own
  grounding cards. The amended class explicitly admits a dotted/
  parenthetical section number (`\d+(\.\d+)*(\([a-z0-9]+\))?`) before
  falling back to a comma/semicolon-bounded (never period-bounded) tail;
  verified to match all four grounding quotes (`9b12cb2f…`, `c7f36323…`,
  `e4b70e97…`, `4052eaf1…`) on committed bytes.
- Zero percent literals otherwise → ABSTAIN `NO_PERCENT_LITERAL` (a
  producer asserting a percent cap on the uncapped `0f6fce9e…` text
  queues rather than resolves — the correct outcome).
- The parser does NOT decide whether a percent is a premium cap — that is
  the resolver's corroboration job (section 4), which is what stops the
  `7d1e7f6e…` "transfers at least 50% of its properties and assets"
  false positive (pack §7-2): that quote's percent survives the
  tokenizer, but the assertion dies `TAIL_CAP_UNCORROBORATED` because the
  quote carries no premium-cap sentence pattern. Division of labor
  pinned: tokenizer counts, corroboration binds label to text.
- Versioned `TAIL_PREMIUM_CAP_PARSE_VERSION`, threaded into the
  resolution receipt (P1 M-6 precedent).

### 2b. `dno-period-years-parse.js`

- Candidate token: a literal digit run of 1–2 digits, optionally wrapped
  in parentheses and optionally carrying an ordinal suffix
  (`(6)`, `6`, `6th`), that is ADJACENT (within a pinned 24-normalised-
  char window) to /\byears?\b/i or /\banniversary\b/i. The adjacency
  window is what makes "the 6-year period following the Closing"
  (`12947306…`) resolve while the SAME card's "a 12-month period under
  the Current Policy" contributes no candidate (month-anchored, not
  year-anchored — pinned by test).
- Grounded resolving forms: "six (6) years" / "six (6) years of coverage"
  (`9b12cb2f…`), "6-year period" (`12947306…`), "period of six (6) years
  from the Effective Time" (`6848fc24…`), "sixth (6th) anniversary"
  (`41cc2470…`), "six (6) year anniversary" (`9b12cb2f…` — but see the
  alternate-trigger guard below), "six (6)-year" (pack §6d).
- **Alternate-trigger guard (the pack §6d flattening trap):** a quote
  matching /later of/i AND /statute of limitations/i → typed ABSTAIN
  `ALTERNATE_TRIGGER_FORMULA`, checked BEFORE candidate counting — the
  `9b12cb2f…` §6.3(b) MAX(6-year, SOL) survival trigger must never
  flatten to canonical '6'. The formula is legal structure for the
  reviewer; a queued correct claim beats a silently truncated one.
  **AUDIT-AMENDED (m-3, explicit asymmetry justification):** the
  `41cc2470…` pending-claim extension ("shall survive the sixth (6th)
  anniversary … until such time as such claim is fully and finally
  resolved") is deliberately NOT routed through this guard and instead
  resolves '6' (test 2), even though both quotes describe a survival that
  can exceed the base year figure. The legal distinction: the alternate-
  trigger guard fires on a formula that redefines the BASE TERM itself
  (MAX of two competing dates, neither one primary) — flattening it would
  assert a wrong base term. The pending-claim extension instead states a
  fixed base term (6 years from the anniversary) with a claim-specific
  TOLLING provision layered on top for claims already asserted before
  expiry — a standard survival-clause feature that does not change what
  the base term IS, only how long an already-noticed claim remains live
  under it. '6' is therefore the correct base-term canonical value in
  both cases; the tolling text remains in the quote as reviewer evidence
  rather than being typed into a separate guard, since it does not change
  the numeric being resolved.
- **Indefinite guard:** a quote matching /\bindefinitely\b/i → typed
  ABSTAIN `INDEFINITE_PERIOD` (grounded `edad0ad3…` §5.26 "shall survive
  the Closing indefinitely") — indefinite survival is out of the numeric
  domain; the presence claims on that card still resolve.
- Exactly ONE surviving digit-year candidate → RESOLVED, canonical form
  the bare digits (`'6'`); round-trips `NON_NEGATIVE_DECIMAL_STRING`.
  Repeated identical literals count once (same pin as 2a).
- ≥2 distinct surviving candidates → ABSTAIN `MULTIPLE_YEAR_LITERALS` →
  review (a quote spanning the tail period AND the survival period is two
  claims; the producer splits).
- Zero candidates with a spelled year form — frozen detection grammar,
  detection-and-typing ONLY (the consideration-spec word-table
  discipline: the table exists to TYPE the abstain, never to read
  numbers): a spelled numeral word (one…ten) within the same 24-char
  window of /\byears?\b/i → ABSTAIN `NON_LITERAL_NUMERAL`. Grounded LIVE
  cases, priced in Known costs: "six-year prepaid D&O tail policy"
  (`0f6fce9e…`) and "for the six year period" (`9e16b52c…`) carry NO
  parenthetical digit and will queue — the parser never reads "six".
- Zero candidates otherwise → ABSTAIN `NO_YEAR_LITERAL`.
- Versioned `DNO_PERIOD_YEARS_PARSE_VERSION`, threaded into the receipt.

No day-count parser, no money parser (no in-agreement dollar cap exists —
every dollar-shaped cap in the corpus is an off-agreement schedule
reference, pack §6b), no parser for any presence claim (allowed-values
membership is the gate, the closing-conditions precedent). Every resolved
presence claim carries the honest
`buildMechanicalAnswerProvenance({ extraPins: { gate:
'ALLOWED_VALUES_MEMBERSHIP' } })` tag construction; resolved numeric
claims pin their parser versions instead.

## 3. Producer prompt + provider

- **New prompt module** `dno-producer-prompt.js`. The capitalisation
  prompt is NOT edited (PROMPT_VERSION unmoved; recorded fixtures replay
  byte-identically). New `PROMPT_ID 'native-producer-dno/v1'`,
  `PROMPT_VERSION 1`, bumped once per slice, never mid-slice.
- **Dispatch through `producer-prompt-registry.js`, mandatorily.** The
  seam exists at head (CAPITALISATION + TERMINATION_FEE entries;
  fail-closed nulls; module-private frozen Map). This slice adds ONE
  entry in its own reviewed diff, per the module's own header convention:
  `DNO → buildDnoProducerPrompt`. Unknown family → no prompt, no
  candidates, typed record — never a silent capitalisation fallback. The
  capitalisation and termination-fee byte-identical-replay tests guard
  the addition.
- **Section-family classifier extension** (`section-family-classifier.js`
  — stage-1 rules are added per family in that family's reviewed diff;
  this is that diff for DNO). Rules are authored from the v1 fingerprint
  (`lib/parser-v2/classify.js:307`, ported not re-derived) plus the four
  REAL headings recovered from quote bytes (query receipt 4), using the
  financing-covenants `runStage1(title, article_context)` signature
  (build-order pin: if a wave sibling has landed, the extended signature
  exists; if this slice lands first, it extends the signature exactly per
  that spec's §3 and bumps `SECTION_FAMILY_CLASSIFIER_VERSION` — the seam
  amendment is built once, to that spec, whichever family arrives first):
  - /indemnification\s+(?:of|and)\s+(?:directors|officers)/i — "D&O
    Indemnification"-form and "Indemnification of Officers and Directors"
    (`6848fc24…` §6.04; the classify.js alternation matches either noun
    order).
  - /d\s*&\s*o\s+(?:indemnification|insurance)/i — "D&O Indemnification
    and Insurance" (`edad0ad3…` §5.26).
  - /directors?['’]?\s+and\s+officers?['’]?\s+(?:exculpation,?\s+)?(?:indemnification|insurance|liability|matters)/i
    — "Indemnification; Directors' and Officers' Insurance" (`527c2062…`
    §6.7), "Director and Officer Liability" (`219a2167…` §6.3), "Director
    and Officer Matters" (`0f6fce9e…`), and "Directors' and Officers'
    Exculpation, Indemnification and Insurance" (`973e6b36…`, `4f9cd857…`,
    `7146a9fb…`, `ce0cff88…` — the interposed "Exculpation," tolerated by
    the optional non-capturing group). **This rule makes two extensions
    beyond the `classify.js:307` fingerprint, both declared here (audit
    M-2): the apostrophe-tolerance class `['’]?` on `directors?`/
    `officers?` (`classify.js:307` has no apostrophe tolerance at all —
    without it, most of the corpus's apostrophized headings, e.g.
    "Directors' and Officers' Insurance", fail to match), and the
    `liability|matters` alternation beyond the fingerprint's
    `indemnification|insurance` pair. "Ported not re-derived" describes
    the base alternation only; the apostrophe and `matters`/`liability`
    classes are this spec's additions, each grounded in a recovered real
    heading.**
  - /indemnification,?\s+(?:exculpation\s+and\s+)?(?:and\s+)?insurance/i
    — "Indemnification, Exculpation and Insurance" (`13353ed9…`,
    `2ca3c2c7…`, `c1a3dc0f…`) and "Indemnification and Insurance"
    (`b27776a0…`). CONDITIONS, DEFINITIONS and REPRESENTATIONS
    article_context decline this rule exactly as the other three
    (Boundary 4; see declines below) — this rule adds no new decline
    surface.
  - **Declines, pinned:** bare /indemnification/i is NEVER a rule — the
    COV-INDEMN trap (Boundary 2): "Indemnification by Cabot Parent",
    "Indemnification by Columbus", "Certain Limitations" (`df393645…`
    §§7.2–7.4) all decline stage 1. REPRESENTATIONS article_context
    declines all rules (rep-side "Insurance" and D&O-insurance disclosure
    reps — Boundary 4); CONDITIONS and DEFINITIONS article_context
    decline all rules; INTERIM_OPERATING sections are never claimed
    (Boundary 5 — no DNO rule matches interim titles, pinned by test).
    The bare-title card `cdf55b01…` ("Indemnification.") is a NAMED
    instance of this decline, not a gap: its grounded text is explicitly
    priced as the one stage-2-only case among the 38 recovered real
    headings (audit C-1) — it is intentionally excluded from the stage-1
    recall pin below because the bare-indemnification decline is kept.
  - **Known hazard, priced:** the `df393645…` ARTICLE-level heading
    "Indemnification; D&O Insurance" WOULD match rule 2 if a section
    under it carried no heading of its own (the classifier falls back to
    the nearest ancestor heading). All three trap sections carry their
    own headings, so the fallback never fires in the grounded corpus; if
    a future deal presents a headingless section under such an article,
    the resolver's covered-person corroboration (section 4) still
    prevents any wrong resolution — cost is a queue item, priced.
  - Stage 1 is validated against ALL deals' section titles before the
    prompt is ever dispatched (the repo classify-rules safety check) as a
    review-time script against live corpus data — never stubbed into
    fixtures or promoted into `npm test` (the IOC test-5 discipline). The
    known collision surface to verify: the `df393645…` general-
    indemnification titles, rep "Insurance" titles, and any
    "Liability"-titled sections outside the D&O context.
    **AUDIT-AMENDED — recall pin (REM-CAP standard, C-1):** the same
    review-time script asserts, in the positive direction, that all 38
    recovered real headings (grounding correction, §Real section headings)
    classify DNO at stage 1, `cdf55b01…`'s bare "Indemnification." title
    excepted by name (priced above as the one stage-2-only case). A
    grounded concept whose real heading fails every stage-1 rule is a
    script failure, not a silent stage-2 fallback.
  - Stage 2 (AI-assisted, Ben's 2026-08-02 ruling) applies unchanged with
    `SECTION_FAMILY_AI_CLASSIFIED` provenance and the
    `SECTION_FAMILY_AI_UNVERIFIED` auto-pass block.
- **Response shape:** a `dno_assertions` array — each element
  `{ section_reference, assertion_kind: 'INDEM_CONTINUATION' |
  'CHARTER_CONTINUATION' | 'ADVANCEMENT' | 'INDEM_SURVIVAL_PERIOD' |
  'TAIL_OBLIGATION' | 'TAIL_PERIOD' | 'TAIL_CAP_PERCENT' |
  'TAIL_CAP_OFF_AGREEMENT' | 'TPB_RIGHTS', verbatim quote }` plus
  per-kind fields: TAIL_CAP_PERCENT carries `cap_basis` (verbatim) and
  optional `cap_term` (verbatim); TAIL_CAP_OFF_AGREEMENT carries
  `schedule_reference_phrase` (verbatim) and optional `cap_term`. One
  element per legal fact, and the prompt owns the family's defining split
  discipline — this corpus is ONE monolithic card per deal, so splitting
  is not an edge case here, it is the entire job:
  - A median card yields SEVERAL assertions, each quoting the sub-span
    carrying its own operative words (the indemnify-and-hold-harmless
    sentence; the organizational-documents sentence; the advancement
    sentence; the tail sentence(s); the TPB sentence).
  - The `527c2062…` two-cap card is TWO TAIL_CAP_PERCENT assertions, each
    quoting its own cap sentence with its own cap_basis.
  - A single sentence bundling the protected-rights trio ("All rights to
    indemnification, advancement of expenses, and exculpation … shall
    survive", `6848fc24…`) legitimately grounds MULTIPLE presence
    assertions whose quotes overlap — the pinned co-resolution design in
    section 4 exists precisely for this drafting norm.
  - Quotes for TAIL_CAP_PERCENT must be the cap sentence, not the whole
    card: a whole-card quote dies `MULTIPLE_PERCENT_LITERALS` (or worse,
    drags in the `7d1e7f6e…`-style 50% boilerplate) by design.
  - PRESERVE-THE-NOVEL retained verbatim; when unsure of any kind, keep
    the assertion in `open_world_candidates` — successor-assumption
    clauses, pending-claim survival extensions, advancement day counts,
    fee-shifting/enforcement-cost clauses, notification/claims-handling
    consequences (v1's `notificationConsequences` surface) are all named
    in the prompt as open-world shapes, never forced fit. The producer
    never asserts a negative (M3 rule 1; "uncapped" is named in the
    prompt as the thing NOT to assert).
- **Provider (`anthropic-provider.js`):** ONE new generic key,
  `NATIVE_DNO_CANDIDATE`, proposal_kind `DNO` (≠ OPEN_WORLD).
  `dno_assertions` is NOT added to `REQUIRED_RESPONSE_LISTS` (the
  share_count precedent verbatim: recorded responses predate the key;
  missing/non-array reads as empty list, never a schema failure). Quote
  byte-verification identical to existing proposals. Golden evals:
  recorded responses are never hand-edited into the new shape; the first
  DNO recordings are minted by the first live runs, each its own dated
  handoff.

## 4. Resolver wiring (`candidate-resolution.js`)

- **ONE new `RESOLUTION_UNCONDITIONAL` entry** (P1 M-2: the Map is keyed
  on generic_claim_key alone): `NATIVE_DNO_CANDIDATE`,
  `deterministic_kind: null`, `attachment_position: null`,
  `registered_claim_definition_key: null`, `concept_key: null` (explicit,
  with the TERMR build-time check that nothing reads
  `mapping.concept_key` before the handler's kind map runs),
  `party_field: null` (no party is minted anywhere in this family this
  slice — section 1). `MAPPING_TABLE_VERSION` bumped; table-validation
  still asserts no duplicate generic keys.
- **Handler split on `assertion_kind`** via a frozen map:
  `INDEM_CONTINUATION → DNO-INDEM × INDEMNIFICATION_CONTINUATION`;
  `CHARTER_CONTINUATION → DNO-INDEM × CHARTER_PROTECTION_CONTINUATION`;
  `ADVANCEMENT → DNO-INDEM × ADVANCEMENT_OF_EXPENSES`;
  `INDEM_SURVIVAL_PERIOD → DNO-INDEM × INDEMNIFICATION_SURVIVAL_YEARS`;
  `TAIL_OBLIGATION → DNO-TAIL × TAIL_POLICY_OBLIGATION`;
  `TAIL_PERIOD → DNO-TAIL × TAIL_POLICY_PERIOD_YEARS`;
  `TAIL_CAP_PERCENT → DNO-TAIL × TAIL_PREMIUM_CAP_PERCENT`;
  `TAIL_CAP_OFF_AGREEMENT → DNO-TAIL × TAIL_PREMIUM_CAP_OFF_AGREEMENT`;
  `TPB_RIGHTS → DNO-BENEF × COVERED_PERSON_TPB_RIGHTS`.
  Out-of-enum assertion_kind → explicit `pushOpenWorld`, typed
  `DNO_ASSERTION_KIND_OUT_OF_VOCABULARY` (P1 C-4: the main loop's
  open-world routing keys on proposal_kind and will not catch it).
- **Kind ambiguity: ASSERTED-KIND CORROBORATION with pinned co-resolution
  — a NAMED DEVIATION from the tax/TERMF full-table reduction, ruled here
  with corpus grounds.** The full-table device (every multi-kind pattern
  match → `AMBIGUOUS_*` review) is correct where multi-kind vocabulary in
  one quote signals a producer split failure. In THIS family it would
  mark essentially every real quote ambiguous, because the drafting norm
  is the fixed collocation "indemnification, advancement of expenses, and
  exculpation" inside single sentences (grounded `973e6b36…`,
  `41cc2470…`, `6848fc24…` — query receipt 2): the charter-continuation
  sentence NAMES advancement; the rights-survival sentence NAMES all
  three protections plus the period. So the rule here is:
  - each assertion resolves iff ITS OWN kind's corroboration patterns
    match its own byte-verified quote — mismatch → review, typed
    `DNO_KIND_UNCORROBORATED`;
  - the four DNO-INDEM kinds plus TPB_RIGHTS are a pinned co-resolution
    SET: any of them may resolve from overlapping or identical quotes as
    distinct claims (the closing-conditions co-resolution device,
    generalized with grounds — identity never collides because
    definition keys differ);
  - the three tail kinds co-resolve with each other and with the set
    above the same way, with EXACTLY ONE pinned exclusivity pair:
    `TAIL_CAP_PERCENT` vs `TAIL_CAP_OFF_AGREEMENT` — one quote whose text
    corroborates BOTH forms (a surviving percent literal AND the
    off-agreement schedule grammar) → review, typed
    `AMBIGUOUS_TAIL_CAP_FORM`, never a resolution of either. The two cap
    forms are mutually exclusive truth claims about the same cap; the
    resolver never picks (grounded: `4052eaf1…` shows the forms can blur
    — its "percentage" IS the schedule reference).
  Per the remedies M3 correction, there is NO resolver-side sub-quote
  search: corroboration runs over the assertion's own quote; the producer
  owns splits; human review plus producer re-assertion is the
  narrow-quote path.
- **Corroboration tables (frozen resolver constants; label must bind to
  quote text; every pattern grounded in a committed fixture quote):**
  - `INDEM_CONTINUATION` ↔ (/indemnify and hold harmless/i OR
    /\bAll rights to indemnification\b/i) AND
    /\bdirectors?\b|\bofficers?\b/i — the covered-person conjunct is the
    anti-COV-INDEMN device: general buyer/seller indemnification text
    ("indemnify … Indemnitees", aggregate-loss baskets) fails it and
    queues instead of resolving (Boundary 2). Grounded `527c2062…` ("each
    present and former director or officer"), `6848fc24…` ("directors or
    officers of the Company"); the `973e6b36…`/`41cc2470…` defined-term
    drafting ("each Indemnified Person") corroborates only when the
    producer's quote span includes the section's covered-person language
    — the defined-term indirection queue class, priced in Known costs
    (the tax-matters `TREATMENT_KIND_UNCORROBORATED` analog).
  - `CHARTER_CONTINUATION` ↔ /certificate of incorporation|organizational
    documents|by-?laws/i AND /indemnification|exculpation/i — grounded
    `973e6b36…`, `41cc2470…`, `6848fc24…`, `9b12cb2f…` (37/37 cards carry
    the vocabulary, query receipt 2).
  - `ADVANCEMENT` ↔ /advancement of expenses/i OR /expense advancement/i
    OR /\bsuch advance\b/i — grounded `6848fc24…`, `973e6b36…`
    (both phrase and day-count forms), `41cc2470…` ("expense
    advancement"), `c7f36323…`.
  - `INDEM_SURVIVAL_PERIOD` ↔ /shall survive/i OR
    /shall not be amended, repealed,? or otherwise modified/i — grounded
    `6848fc24…`, `41cc2470…`, `edad0ad3…`.
  - `TAIL_OBLIGATION` ↔ /\btail\b/i OR /run[- ]?off/i OR
    /prepaid .{0,20}(D&O|directors)/i (bounded) — grounded `e1bbd97e…`
    ("\"tail\" insurance policies"), `9b12cb2f…` ("such \"tail\"
    policy"), `0f6fce9e…` ("six-year prepaid D&O tail policy"; the
    word-boundary rule makes the quoted-string drafting match, since `"`
    is a non-alphanumeric edge), and (AUDIT-AMENDED, m-2) `12947306…`
    ("\"tail\" or \"runoff\" office…") for the `/run[- ]?off/i` OR-arm,
    previously asserted ungrounded in error.
  - `TAIL_PERIOD` ↔ the TAIL_OBLIGATION patterns AND
    /\byears?\b|\banniversary\b/i — grounded `12947306…`, `9b12cb2f…`.
  - `TAIL_CAP_PERCENT` ↔ /\bpremiums?\b/i AND
    /in excess of|not to exceed|less than or equal to|equal to/i —
    grounded `01d091dc…`, `e1bbd97e…`, `2189a30a…`, `12947306…`,
    `527c2062…`. **This conjunction is what kills the pack §7-2 false
    positive:** the `7d1e7f6e…` "transfers at least 50% of its properties
    and assets" quote contains no premium vocabulary → a TAIL_CAP_PERCENT
    assertion on it dies `DNO_KIND_UNCORROBORATED`, never resolves 50 —
    pinned as a permanent regression fixture (test 2).
  - `TAIL_CAP_OFF_AGREEMENT` ↔ /\bCap Amount\b/ (case-sensitive defined
    term, explicit `\b`) OR /set forth (on|in) Section \d+(\.\d+)*
    (\([a-z0-9]+\))?[^,;.]{0,40}Disclosure (Schedule|Letter)/i (bounded;
    **AUDIT-AMENDED, C-2 — same dot-tolerant class as §2a, kept identical
    across both sites by construction**) — grounded `9b12cb2f…`,
    `c7f36323…`, `e4b70e97…`, `4052eaf1…`.
  - `TPB_RIGHTS` ↔ /third[- ]party beneficiar/i OR
    /enforceable by,? each Indemnified/i — grounded `973e6b36…`,
    `527c2062…`, `9e16b52c…`.
- **Value derivation:** TAIL_CAP_PERCENT → corroboration →
  attribute-verbatim checks (`CAP_BASIS_REF_NOT_IN_QUOTE` /
  `CAP_TERM_REF_NOT_IN_QUOTE`) → `tail-premium-cap-parse.js` → gates;
  a `CAP_VALUE_OFF_AGREEMENT` abstain routes to review with a pointer to
  re-assert under TAIL_CAP_OFF_AGREEMENT (review reason text carries the
  typed abstain; the resolver NEVER silently re-kinds the assertion —
  producer re-assertion is the path). TAIL_PERIOD and
  INDEM_SURVIVAL_PERIOD → corroboration → `dno-period-years-parse.js` →
  gates; every ABSTAIN (`ALTERNATE_TRIGGER_FORMULA`, `INDEFINITE_PERIOD`,
  `NON_LITERAL_NUMERAL`, `MULTIPLE_YEAR_LITERALS`, `NO_YEAR_LITERAL`)
  routes to review with the parser's typed reason. RESOLVED values still
  pass `canonicalValueAllowed` (a parser bug must not bypass the gate).
  Presence kinds gate through allowed-values membership.
- **Materiality: NEW tier proposed, flagged for Ben.** `{ rank: 85,
  label: 'DNO_INDEMNIFICATION', concept_key_prefixes: ['DNO-INDEM',
  'DNO-TAIL', 'DNO-BENEF'] }` — exact keys, deliberately never a bare
  `DNO-` prefix (the financing-covenants discipline). Rank 85 sits
  between CLOSING_CONDITIONS (70) and NOTICES_ADMINISTRATIVE (90) and
  collides with nothing at head — NOTE FOR BEN: the tax-matters and
  employee-matters sibling specs each propose rank 80; the relative
  ordering of the three wave families between 70 and 90 is a single Ben
  call at whichever PR lands last, and this spec's 85 (D&O below tax and
  employee matters — market-standard protective boilerplate, materially
  litigated less than deal-economics covenants) is a proposal, not a
  default. **Pre-concept review routing (TERMF M-3):** review items
  minted before the kind map runs carry conceptFamily
  `'DNO-INDEM-PENDING'` — a routing token only, never registered, never
  publishable — which startsWith-matches the `DNO-INDEM` tier key →
  rank 85 instead of UNCLASSIFIED 99.
- **Receipt + additivity (honest form, P1 M-1):** with no DNO input,
  resolution output must be byte-identical EXCEPT
  `mapping_table_version`, `contract_vocabulary_digest` (under the new
  bundle version), the bumped `section_family_classifier_version`, the
  two new parser-version fields (`tail_premium_cap_parse_version`,
  `dno_period_years_parse_version`), and the recomputed
  `resolution_receipt_id`; documented in the PR as a field-level diff.
  Skipping the version bump to keep old pins green is the named
  anti-pattern.

## 5. Lexicon additions (`LEXICAL_FAMILY_LEXICON` version bump; every edit
a reviewed diff; keys MUST be registered concept keys — which is why all
three concepts land in this same slice; explicit `\b` on every
case-sensitive regex; static max ≤ 128; multi-form entries as separate
pattern_ids; rationale per pattern)

- `DNO-INDEM`: LITERAL_PHRASE "indemnify and hold harmless"
  (`973e6b36…`, `41cc2470…`, `527c2062…`); LITERAL_PHRASE "advancement of
  expenses" (36/36 cards — `6848fc24…`, `973e6b36…`); LITERAL_PHRASE
  "exculpation" (37/37 cards, `973e6b36…`, `41cc2470…` — the family's
  most discriminating single token: exculpation vocabulary is
  DGCL-102(b)(7)-specific and near-absent outside D&O drafting).
- `DNO-TAIL`: BOUNDED_REGEX /\btail\b/i (`e1bbd97e…`, `9b12cb2f…`,
  `0f6fce9e…` — word-bounded, so "retail"/"detail" never fire);
  LITERAL_PHRASE "annual premium" (`01d091dc…`, `e1bbd97e…`,
  `527c2062…`).
- `DNO-BENEF`: LITERAL_PHRASE "third party beneficiaries" and
  LITERAL_PHRASE "third-party beneficiary" as SEPARATE pattern_ids (the
  multi-form rule; `973e6b36…`/`527c2062…` plural unhyphenated,
  `9e16b52c…` singular).

**Priced cross-hit noise, stated (the TERMR M-4 discipline; veto-only —
a false hit costs a queue item, never a wrong claim):**

- /\btail\b/i verifiably collides with the termination-fee family's
  registered `TERMF-TAIL` drafting ("Tail Period" fee windows) — expected
  `LEXICAL_UNMATCHED_SIGNALS` hits inside TERMF sections, where TERMF
  candidates cover their own family and the DNO hit is pure queue noise
  for future DNO-ABSENT derivation over those sections. Accepted and
  recorded; the anti-noise test pins one such hit as EXPECTED so a future
  silent deletion breaks a test (Boundary 6).
- "third party beneficiaries" fires in every MISC-THIRDPARTY no-3PB
  section corpus-wide (Boundary 3). Same treatment: one EXPECTED
  unmatched-signal pin on a committed MISC-shaped fixture paragraph.
- "indemnify and hold harmless" fires in general M&A indemnification
  (the `df393645…` COV-INDEMN population) and escrow/ancillary drafting.
  Accepted: it is the family's operative-verb tell (deletion asymmetry —
  removal widens auto-pass); those sections never carry DNO candidates,
  so hits surface only as ABSENT-veto noise, priced.

**Priced exclusions** (each a recorded blind spot; a miss costs a missed
VETO, never a wrong claim):

- "no less favorable": the employee-matters sibling already keys it (its
  §5 prices the D&O cross-hit explicitly); double-keying would flood both
  families. Excluded here by boundary agreement (Boundary 1).
- Bare "indemnification", bare "insurance", bare "premium", bare
  "survive"/"survival": corpus-wide noise (COV-INDEMN, REP-T-INSURANCE,
  MISC-SURVIVAL, escrow, insurance reps) — only the operative phrases
  above discriminate.
- "run-off"/"runoff": 4 cards attest the token (query receipt 3) but no
  verbatim snippet receipt was pulled for the LEXICON pattern; under the
  grounding rule a lexicon pattern without its own quoted grounding card
  does not ship. Recorded as the candidate next addition — its
  corroboration twin already exists in the resolver table (grounded there
  via `/run[- ]?off/` only as an OR-arm never load-bearing alone in any
  grounded quote). **AUDIT-AMENDED (m-2):** the resolver-table OR-arm's
  grounding DOES exist on committed bytes and should be cited rather than
  described as ungrounded — committed fixture card `12947306…` contains
  the verbatim run-off vocabulary ("\"tail\" or \"runoff\" office…"); §4's
  `TAIL_OBLIGATION` corroboration table is amended to cite `12947306…` as
  the run-off grounding quote alongside `e1bbd97e…` and `9b12cb2f…`.
- "D&O" as a LITERAL_ACRONYM: considered and deferred — the token
  appears in rep-side insurance disclosure and (as `D&O Insurance`, 16
  cards) inside defined terms this family's other patterns already
  blanket; adding it buys little veto and measurable rep-section noise.
  Recorded blind spot.
- "Cap Amount": deliberately NOT a lexicon pattern (it is a resolver
  corroboration pattern only) — as a section-wide veto signal it would
  fire on consideration/collar drafting ("Cap Price"-adjacent forms)
  without discriminating; the off-agreement claim's coverage is carried
  by the tail patterns that always co-occur in its grounded cards.

## 6. Acceptance tests (real-fixture-first; the P1 M-5 pre-rerun-harness
honesty pins apply VERBATIM — no recorded native runs exist for this
family; every resolver/registry test drives synthetic compiled candidates
pinned to REAL corpus quotes, byte-verified against committed fixture
bytes, clearly labeled as the pre-rerun harness)

0. **Fixture commit:** card text for `01d091dc…`, `e1bbd97e…`,
   `2189a30a…`, `12947306…`, `527c2062…`, `7d1e7f6e…`, `9b12cb2f…`,
   `c7f36323…`, `e4b70e97…`, `4052eaf1…`, `0f6fce9e…`, `9e16b52c…`,
   `973e6b36…`, `41cc2470…`, `6848fc24…`, `9254f119…`, `edad0ad3…`,
   `219a2167…` committed as LITERAL production bytes under
   `tests/fixtures/canonical-v2/dno-fixtures/`, provenance headers with
   deal uuid + provision_card uuid + retrieval date + provision_type/
   subtype — NEVER v1 `section_ref` label strings (the IOC lint pin; and
   here the labels are 38/38 identical rubric strings, so committing them
   would also be false provenance). The `620fa61a…` noise row is NOT
   committed. Every test quote asserted a contiguous substring of
   committed bytes.
1. **Registry:** next version compiles; prior arrays untouched
   byte-for-byte; three concepts + nine definitions (AUDIT-AMENDED, M-1)
   validate with zero
   validator changes; expected-concept-keys AND expected-claim-keys
   superset-diffs written against sorted CONTENT, never the numeral; a
   test asserts the kind→(concept, definition) frozen map's values are
   all registered keys.
2. **Parsers (table-driven over the coverage map's hand-enumerated
   sub-quotes, run on LITERAL committed bytes):**
   `tail-premium-cap-parse.js` — `01d091dc…` cap sentence → RESOLVED
   '300'; `e1bbd97e…` → RESOLVED '300' via the parenthetical digit;
   `2189a30a…` → RESOLVED '350' with the repeated-identical-literal pin
   exercised (its own echo does not abstain it); `12947306…` → RESOLVED
   '225'; the `527c2062…` card at full width → ABSTAIN
   `MULTIPLE_PERCENT_LITERALS`, and its two hand-enumerated cap-sentence
   sub-quotes → RESOLVED '300' and '450'; `9b12cb2f…` cap sentence →
   ABSTAIN `CAP_VALUE_OFF_AGREEMENT` (**AUDIT-AMENDED, C-2:** pinned only
   against the amended dot-tolerant off-agreement grammar — the originally
   drafted `[^.]{0,40}` class matches zero cards, including this one, and
   would have abstained `NO_PERCENT_LITERAL` instead); `0f6fce9e…` →
   ABSTAIN `NO_PERCENT_LITERAL`; **(new, C-2) the off-agreement grammar
   itself, table-driven over all four grounding cards' schedule sentences
   on committed bytes (`9b12cb2f…`, `c7f36323…`, `e4b70e97…`,
   `4052eaf1…`) → each asserted to MATCH the amended regex** (a
   regression fixture against the zero-match defect).
   `dno-period-years-parse.js` — `12947306…` "6-year period" → RESOLVED
   '6' AND the same card's "12-month period" contributes zero candidates
   (month-anchor pin); `9b12cb2f…` tail sentence ("six (6) years of
   coverage") → RESOLVED '6'; `9b12cb2f…` §6.3(b) survival sentence →
   ABSTAIN `ALTERNATE_TRIGGER_FORMULA` (the flattening trap as a
   permanent regression fixture); `6848fc24…` → RESOLVED '6';
   `41cc2470…` "sixth (6th) anniversary" → RESOLVED '6'; `edad0ad3…` →
   ABSTAIN `INDEFINITE_PERIOD`; `0f6fce9e…` "six-year prepaid" and
   `9e16b52c…` "six year period" → ABSTAIN `NON_LITERAL_NUMERAL` (the
   priced spelled-form queue class, deletion-proofed).
3. **Resolution (pre-rerun harness, synthetic candidates over committed
   bytes):** presence claims resolve for `973e6b36…`/`41cc2470…`/
   `527c2062…` (INDEM_CONTINUATION), `973e6b36…`/`41cc2470…`/`6848fc24…`
   (CHARTER_CONTINUATION), `6848fc24…`/`973e6b36…` (ADVANCEMENT),
   `e1bbd97e…`/`9b12cb2f…`/`0f6fce9e…` (TAIL_OBLIGATION),
   `973e6b36…`/`527c2062…`/`9e16b52c…` (TPB_RIGHTS), each with
   `answer_provenance.gate === 'ALLOWED_VALUES_MEMBERSHIP'`; the pinned
   co-resolution set proven on the `6848fc24…` §6.04(a) trio sentence
   (INDEM_CONTINUATION + ADVANCEMENT + INDEM_SURVIVAL_PERIOD from
   overlapping quotes, three distinct non-deduping claims, never an
   ambiguity reason); a TAIL_CAP_PERCENT assertion on the `7d1e7f6e…`
   50% quote → `DNO_KIND_UNCORROBORATED`, never a resolved 50 (the pack
   §7-2 pin); a TAIL_CAP_PERCENT assertion on the `9b12cb2f…` schedule
   quote → review via `CAP_VALUE_OFF_AGREEMENT`, and a
   TAIL_CAP_OFF_AGREEMENT assertion on the same quote → RESOLVED with
   schedule_ref substring-enforced (plus a deliberately corrupted
   schedule_ref → `SCHEDULE_REF_NOT_IN_QUOTE`); a synthetic quote
   carrying BOTH a surviving percent literal and the schedule grammar →
   `AMBIGUOUS_TAIL_CAP_FORM` (built by concatenating two committed
   grounded sentences — labeled synthetic, per the harness honesty
   rules); the `527c2062…` two-cap pair resolves as two claims whose
   identities differ on cap_basis_ref (never dedupe); an
   INDEM_CONTINUATION assertion quoting ONLY defined-term drafting with
   no director/officer words → `DNO_KIND_UNCORROBORATED` (the
   indirection queue class pinned); out-of-enum assertion_kind →
   explicit `pushOpenWorld`; materiality rank 85 asserted on a resolved
   claim AND a `DNO-INDEM-PENDING` review item; additivity re-pin with
   the documented field-level diff including both parser-version fields.
4. **Cross-family boundary pins (each named for its boundary):** (b-1)
   "Employee Matters"-shaped titles decline DNO classification, and the
   D&O fingerprint titles classify DNO — the exact reciprocal of the
   employee-matters spec's test 5; (b-2) "Indemnification by Cabot
   Parent" / "Certain Limitations" titles decline stage 1, and a
   general-indemnification quote (committed from the `df393645…`
   COV-INDEMN cards) fails INDEM_CONTINUATION corroboration; (b-3) a
   "Third-Party Beneficiaries"-titled section declines classification —
   no DNO prompt ever sees the MISC no-3PB carve-out; (b-4) a
   REPRESENTATIONS-article "Insurance" title declines; (b-5) an
   INTERIM_OPERATING-classified fixture section is never dispatched to
   the DNO prompt; (b-6) zero TERMF vocabulary in this slice's modules,
   and the recorded TERMF fixtures replay byte-identically with the DNO
   registry entry present; (b-7, **AUDIT-AMENDED recall pin, C-1**) each
   of the 38 recovered real headings — including "Director and Officer
   Matters" (`0f6fce9e…`), "Directors' and Officers' Exculpation,
   Indemnification and Insurance" (`973e6b36…`, `4f9cd857…`, `7146a9fb…`,
   `ce0cff88…`), "Indemnification, Exculpation and Insurance"
   (`13353ed9…`, `2ca3c2c7…`, `c1a3dc0f…`), and "Indemnification and
   Insurance" (`b27776a0…`) — classifies DNO at stage 1, and `cdf55b01…`'s
   bare "Indemnification." title declines (the one named stage-2-only
   exception).
5. **Provider + dispatch:** response missing `dno_assertions` → empty
   list, not schema failure; recorded capitalisation AND termination-fee
   fixtures replay byte-identically through the registry with the DNO
   entry present; unknown family → no prompt, typed record; classifier
   fixtures: the four originally-cited recovered real headings
   ("Indemnification of Officers and Directors", "Indemnification;
   Directors' and Officers' Insurance", "D&O Indemnification and
   Insurance", "Director and Officer Liability") classify DNO with
   `SECTION_FAMILY_RULE_CLASSIFIED`, **plus (AUDIT-AMENDED, C-1) the four
   additional recovered heading shapes** ("Director and Officer Matters",
   "Directors' and Officers' Exculpation, Indemnification and Insurance",
   "Indemnification, Exculpation and Insurance", "Indemnification and
   Insurance") also classify DNO with `SECTION_FAMILY_RULE_CLASSIFIED`,
   and `cdf55b01…`'s bare "Indemnification." title classifies via stage 2
   only (`SECTION_FAMILY_AI_CLASSIFIED`), never stage 1; the all-titles
   corpus validation runs as a review-time script (live Supabase; never
   stubbed into `npm test`).
6. **Lexicon:** table validation (keys registered — the three new
   concepts; multi-form entries as separate pattern_ids; static max ≤
   128; rationale per pattern; content hash re-pinned; version bump);
   anti-noise regression paragraph extended with "retail", "detailed",
   a rep-article insurance-disclosure sentence, a "no less favorable"
   employee-benefits sentence and a nonsurvival-of-reps sentence —
   asserted zero hits under the exclusions; one EXPECTED unmatched-signal
   pinned for /\btail\b/i inside a TERMF-section quote and one for
   "third party beneficiaries" inside a MISC no-3PB paragraph
   (deletion-proofed by test); each surviving pattern hits its own
   grounding quote in committed fixtures; determinism permutation tests
   green under the grown table.
7. Full suite + `npm run build` + forbidden-patterns (fixtures inside the
   exempt directory class; zero new exemption entries — any collision is
   fixed by restructuring the offending file, never by widening
   FILE_PATTERN_EXEMPTIONS); phase allowlist for the slice's files.

## Out of scope

- Advancement day-count numerics (open world; the five grounded cards —
  `973e6b36…`, `4052eaf1…`, `6848fc24…`, `c7f36323…`, `9254f119…` —
  recorded as the candidate grounding set; promotion is a future reviewed
  diff with its own typed-abstain day-count parser).
- Successor-assumption clauses (universal boilerplate hosting the 50%
  trap — open world), pending-claim survival extensions (`41cc2470…`),
  indemnification-agreement assumption, fee-shifting/enforcement-cost
  clauses, notification/claims-handling consequences (v1
  `notificationConsequences` surface) — all open world, named in the
  producer prompt as NOT this family's assertions.
- Any "uncapped" assertion or enum (M3 rule 1; the section 1 ruling);
  ANY scope-closure/ABSENT work; resolution of disclosure-schedule
  content behind `schedule_ref` (relationship layer, and the schedules
  are not in the corpus at all).
- The COV-INDEMN cards (`df393645…` §§7.2–7.4) and the `620fa61a…` noise
  row — ingest-QA hygiene, flagged, never absorbed.
- v1 machinery: the COV-DO FEATURES block (`insuranceCap`,
  `advancementOfExpenses` etc.) is never read, mapped or backfilled;
  `FAMILY_MAPPING_TABLE` extension for v1↔v2 subtype mapping is a
  separate Fable+Ben table edit (the monolith split makes it
  Ben-reviewed, never implementer-inferred).
- A `DNO_INDEMNITOR` party role (deliberate narrowing, section 1); any
  qualifier-kind work (P2 seam); cross-deal canonicalization of
  cap_basis_ref / schedule_ref verbatim phrases (Ben adjudication over
  observed values, later).
- Live re-extraction runs (dated handoffs; until they land, no report may
  claim native D&O extraction — M-5); any M3 amendment.

## Known costs, stated up front

- **The spelled-year queue class:** period drafting without a
  parenthetical digit ("six-year prepaid D&O tail policy", `0f6fce9e…`;
  "for the six year period", `9e16b52c…`) ABSTAINs
  `NON_LITERAL_NUMERAL` by the never-read-words rule. In a corpus where
  the value is 6 essentially always, the temptation to default is
  maximal and refused: a queued correct claim beats an unquoted
  constant. Live-run handoffs measure the queue rate; if it is material,
  the remedy is a Ben-reviewed spelled-numeral promotion with its own
  audit, never a silent parser widening.
- **The off-agreement cap class is permanent** (4+/38 deals,
  AUDIT-AMENDED m-1): those
  deals' cap VALUES are unrecoverable from agreement bytes by the
  agreement's own design; `TAIL_PREMIUM_CAP_OFF_AGREEMENT` presence plus
  the verbatim schedule_ref is the honest ceiling of quote-local
  extraction, and market-percentile cap statistics must exclude these
  deals (noted for the serving layer).
- **Monolithic cards mean unsplit producer output queues at volume**
  (`MULTIPLE_PERCENT_LITERALS`, `MULTIPLE_YEAR_LITERALS`,
  `DNO_KIND_UNCORROBORATED`) until producers split reliably — never a
  reason to loosen corroboration; two-strike escalation applies to
  prompt iteration.
- **The covered-person indirection queue class:** defined-term-only
  indemnification quotes ("each Indemnified Person" with the definition
  elsewhere in the section) fail the director/officer conjunct and
  queue. Priced deliberately — the conjunct is the wall between this
  family and general M&A indemnification (Boundary 2), and weakening it
  to raise recall would reopen the COV-INDEMN trap.
- **Co-resolution instead of full-table ambiguity is a wider auto-fit
  surface than the tax/TERMF device** — accepted with eyes open because
  the corpus proves multi-kind vocabulary in one sentence is this
  family's NORM, and the per-kind corroboration conjuncts carry the
  discrimination load instead. The named deviation is flagged for the
  adversarial audit as a specific target.
- **Lexicon cross-hits are guaranteed** (/\btail\b/i in TERMF sections;
  TPB phrases in MISC sections; "indemnify and hold harmless" in general
  indemnification) — veto-only queue noise, pinned as EXPECTED so
  deletions break tests; deletion asymmetry applies.
- **Rank 85 may collide with sibling-wave proposals at Ben's table**
  (tax 80, employee 80) — ordering is a single Ben call at the last
  landing PR, flagged in all three PR bodies.
