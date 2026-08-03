# Family — Merger structure & closing mechanics (STRUCT-*)

**Date:** 2026-08-03. **Status:** AUDIT-AMENDED — 2 CRITICAL, 4 MATERIAL, 5
MINOR findings applied from the 2026-08-03 adversarial audit; 0 parked for
Fable.
**Parent:** `2026-08-02-openworld-promotion-program.md` (five-layer promotion
structure and cross-slice invariants apply verbatim).
**Template:** `2026-08-02-p1-captable-numerics-design.md` (slice shape,
typed-abstain discipline, corroboration tables, coverage-map honesty pins).
**Wave exemplars bound:**
`2026-08-02-family-termination-rights-design.md` (the
producer-prompt-registry seam — this family dispatches through it, NEVER a
capitalisation fallback; the seam is BUILT at head:
`lib/canonical-v2/native-producer/producer-prompt-registry.js` carries
CAPITALISATION, TERMINATION_FEE and NO_SHOP entries, so this slice adds ONE
entry to the existing frozen Map, it does not build the seam);
`2026-08-02-family-termination-fee-design.md` (the built parser exemplar —
`termination-fee-parse.js` is the contract shape this family's day-count
parser mirrors: multiplicity-first precedence over period literals of ANY
unit (M-4), the F-2 digit-run pin, typed abstains, never repair; the
HYBRID_MAGNITUDE_MONEY lesson has no money analogue here because this
family parses NO money — see Boundary 1);
`2026-08-02-family-closing-conditions-design.md` (presence-claim shape; the
pinned subsumption co-resolution device (NO_MAE/MAE_CONTINUING) adopted for
the closing-timing pair; the rep_side negative-lookahead anti-spoof device
adopted for the merger-survivor pattern; the tender-offer-annex title hole
this spec inherits from the SAME v1 rules and re-flags);
`2026-08-02-family-specific-performance-remedies-design.md` (the REM-CAP
dispatch-vacuity ruling, applied at design time to every concept and every
numeric below — a claim whose grounded quotes cannot reach its producer, or
all abstain under its own parser, must not ship);
`2026-08-03-family-dno-indemnification-design.md` (heading-grounded stage-1
rules authored from REAL headings recovered from quote bytes, plus the
positive-direction recall pin; also this spec's most delicate boundary —
surviving-charter sections carry D&O charter-continuation content, Boundary
3);
`2026-08-03-family-dividends-design.md` (small-population honesty — offer
mechanics measured label-blind is a 4–9 deal population, stated as such,
never padded; the presence+number co-resolution split);
`2026-08-02-family-financing-covenants-design.md` (the
`runStage1(title, article_context)` classifier signature and the exact-keys
materiality tier — both adopted).
**Protocol authority:** docs/codex-program/EXECUTION-LEDGER.md — M3 review
protocol + extraction semantics rules 1–3. This spec may not amend them.
**Lexicon authority:** `2026-08-02-lexical-disagreement-net-design.md`
(word boundaries, case-sensitive defined terms, deletion asymmetry, priced
blind spots; static max ≤ 128; explicit `\b` on every case-sensitive
defined-term regex; `LEXICAL_FAMILY_LEXICON_VERSION` is 4 at head as of
2026-08-03 (MAE V4 landed, lexical-disagreement-net.js:181) — re-checked at
build time).
**Materiality:** no tier covers this family today (`MATERIALITY_TABLE`,
`candidate-resolution.js` ~658–673, carries no STRUCT prefix — a resolved
structure claim would rank UNCLASSIFIED 99, below notices). Section 4
proposes ONE exact-keys tier, flagged for Ben.

## Corpus grounding (production Supabase, project `tzulhdasmioeechxapdy`;
evidence pack read 2026-08-03 — pack quotes are ground truth, cited by
provision_card id; seven supplementary SELECT-only receipts run 2026-08-03
by this spec's author, inline below)

v1 population: `provision_type = 'STRUCTURE_MECHANICS'`, 278 cards / 40
deals. Subtypes (cards/deals): null 68/18, STRUCT-MERGER 44/35,
STRUCT-CHARTER 38/30, STRUCT-DIRECTORS 38/30, STRUCT-CLOSING 34/33,
STRUCT-EFFTIME 24/21, STRUCT-EFFECTS 23/22, STRUCT-ACTIONS 9/9,
**STRUCT-OFFER 0/0** — a `frequency: common` rubric code (lib/rubric.js:186)
with a 16-key v1 feature schema (rubric.js ~3977–3994, including
`mainConcept` boilerplate; 15 excluding it) and ZERO tagged cards.
The offer-mechanics content EXISTS but is filed under STRUCT-MERGER, null
subtype, and `[PROPOSED]`/`Unclassified` short_titles (pack §5, §9; receipt
E below measures the real homes). All 278 rows carry `needs_review=false` —
the gap is silent in v1. v1 labels are UNTRUSTED input throughout this spec.

Grounding cards this spec builds on (every corroboration pattern and
lexicon entry below traces to one of these; nothing is fabricated):

- **The Merger / survivor** — card `75209318-4b90-40ce-904b-ef172d74d72c`
  (deal `cf32899a…`, §1.1): "Merger Sub will be merged with and into the
  Company (the \"Merger\"), the separate corporate existence of Merger Sub
  will cease, and the Company will continue as the surviving corporation."
  Nevada/double-merger variant (open-world exemplar, never claimed): card
  `337b3421-0852-427b-b97c-f455dfd7c73d` (deal `6369cc9c…`, NRS, short-form
  merger, Top-Up Option).
- **251(h)** — card `5acd8a63-8bed-40a0-b08d-1d024169d656` (deal
  `320a3899…`, §2.6 "Merger Without a Vote of Stockholders"): "The Merger
  will be governed by and effected under Section 251(h) of the DGCL. …
  without a vote of the holders of the Shares in accordance with Section
  251(h) of the DGCL."; card `11f3ef36-3bf3-44c3-b6dd-5af0cb27de4c` (deal
  `555579a6…`): "The Merger shall be governed by and effected pursuant to
  Section 251(h) of the DGCL."
- **Closing timing, conditions-anchored** — card
  `9ac9e74c-2c21-47aa-aba7-41bfdec7dfda` (deal `00d49e6a…`, §1.02): "shall
  take place at 10:00 a.m. (New York City time) on the third Business Day
  following the satisfaction or waiver …" (SPELLED ordinal — no digit);
  card `a149469a-e809-4f1e-8f9d-50697ddf4030` (deal `a267309a…`, §2.1):
  "…is the second (2nd) Business Day immediately following the satisfaction
  or (to the extent permitted by applicable Law) waiver in accordance with
  this A…" (receipt G — belt-and-braces DIGIT ordinal, AND the
  "satisfaction … waiver" pair INTERPOLATED by a parenthetical, which
  shapes the anchor regex below).
- **Closing timing, offer-anchored** — card
  `c6254cb5-f62e-4ede-8106-ab443aa16522` (deal `555579a6…`): "will take
  place as soon as practicable after (but on the same day as) the
  consummation of the Offer …" — no Business-Day literal at all (pack §8
  item 5: 2 of 34 STRUCT-CLOSING cards have no BD phrasing).
- **Offer mechanics** — card `c1d9d287-f809-4b67-9542-af6976c97bd2` (deal
  `555579a6…`, §2.01 "[PROPOSED] The Offer", subtype NULL): commencement
  ("no event later than fifteen (15) Business Days"), "Offer Expiration
  Time" ("twentieth (20th) Business Day"), "consecutive increments of up to
  ten (10) Business Days each" (receipt F), guaranteed-delivery/251(h)
  tie-in — the family's pinned compound fixture; card
  `a3732b8b-cf2d-4952-a2cf-591c1b449e10` (deal `320a3899…`, subtype
  STRUCT-MERGER — mislabeled): CVR-linked offer, "extend the Offer for one
  (1) or more periods of time of up to five (5) Business Days per
  extension" AND a NO-LITERAL extension limb "increments of such duration
  as requested by the Company" (receipt F — both limbs in ONE card); card
  `0e05a711-fdc5-4e50-8df4-38416cfe6024` (deal `ad35e712…`, §1.1, subtype
  STRUCT-MERGER — mislabeled): "$137.00 per Share in cash", "twenty-five
  (25) Business Days … after the date on which the Offer was commenced",
  "(x) extend the Expiration Time for one or more consecutive increments of
  not more than ten (10) Business Days each" (receipt F); card
  `82576a71-4dd1-49c2-b41a-6fb588b961c6` (deal `ad35e712…`, "[PROPOSED]
  Company Actions (Schedule 14D-9 / Stockholder List)", subtype NULL):
  Schedule 14D-9 filing mechanics, stockholder-list covenant (deferred —
  Out of scope).
- **Effective time** — card `3a96ea09-e715-44c5-b459-c315e4e74a83` (deal
  `dfaa71fa…`, §1.4): Maryland SDAT articles of merger + Delaware DSOS
  certificate of merger, "not to exceed thirty (30) days after …
  acceptance for record"; card `ecfe2957-11ea-4dae-b1da-1aaef7aeb40f`
  (deal `c7c16365…`, §1.01): Virginia SCC + Delaware DLLCA dual filing;
  card `84aae11f-8483-4b7f-a638-3a4ecafd2f72` (deal `f9c61065…`): Maryland
  MGCL/SDAT, "not to exceed 30 days from the date the Articles of Merger
  are accepted for record".
- **Surviving-entity charter** — card
  `b621bd3b-70fb-41da-8178-5fd1fabce23f` (deal `bf31d586…`, §3.01,
  real embedded heading "Section 3.01. Certificate of Incorporation."):
  "the certificate of incorporation of the Company as in effect
  immediately prior to the Effective Time shall be amended and restated in
  its entirety as set forth on Exhibit B …"; LLC-form variant — card
  `fee7da2b-d5e9-4f58-b116-4af5d340cda2` (deal `dfaa71fa…`): "certificate
  of formation" / "limited liability company agreement" (pack §8 item 3 —
  the entity-vocabulary swap hazard).
- **Anti-noise / boundary negatives** — card `fe717a8d…` (deal
  `df393645…`): tagged STRUCT-CLOSING but is a "Closing Deliveries"
  checklist from a carve-out deal, no merger-timing content (pack §8 item
  6); card `f223776a-b58e-4ef0-ae6a-ca7df4008953` (deal `df393645…`,
  TERMR-OUTSIDE): "extend the End Date in increments of ninety (90) days"
  — the increments phrase in TERMINATION-RIGHTS territory (receipt F, the
  extension boundary's pinned negative).

**Query receipts (SELECT-only, `provision_cards`, run 2026-08-03):**

- **A — closing literal shapes (STRUCT-CLOSING, n=34):** digit-ordinal
  Business-Day literals (`(\d+)(st|nd|rd|th)`) 9 cards; spelled-only
  ordinals ("third Business Day" class) 17 cards; `satisfaction or/and
  waiver` (contiguous) 19; "consummation of the offer" 2. The market norm
  is SPELLED ordinals — load-bearing for the section-2 abstain pricing.
- **B — merger-survivor phrases (STRUCT-MERGER, n=44/35):** "merged with
  and into the Company" 28 cards / 28 deals; "continue as the surviving
  corporation" 14; "separate (corporate) existence" 34.
- **C — efftime/charter phrases:** STRUCT-EFFTIME (n=24): "certificate of
  merger" 19, "articles of merger" 6 (sum > n: dual-filing deals carry
  both), "become effective" 19. STRUCT-CHARTER (n=38): "amended and
  restated" 30, "certificate of incorporation|formation" 31,
  "bylaws|by-laws" 28.
- **D — offer phrases, corpus-wide (label-blind, because STRUCT-OFFER has
  zero tagged rows):** "commence the Offer" 6 cards / 3 deals; `Offer
  Expiration Time` (case-sensitive) 18 cards / 2 deals; "extend the Offer"
  6 cards / 3 deals; "increments of" 4 cards; `251(h)` 16 cards / 2 deals;
  `Schedule 14D-9` 33 cards / 9 deals. **The pack's "%tender offer% = 113
  cards / 38 deals" is the PHRASE population (reps, no-shop, definitions),
  not the two-step-deal population — the real two-step mechanics corpus is
  on the order of 3–9 deals.** Stated so the STRUCT-OFFER promotion is
  read as the low-N promotion it is.
- **E — closing anchors + offer homes:** STRUCT-CLOSING "shall take place"
  23/34; ANY of the three anchors (satisfaction-waiver contiguous /
  offer-consummation / shall-take-place) 29/34; digit-ordinal AND
  satisfaction-anchor 7. Offer-mechanics phrases inside STRUCTURE_MECHANICS
  (phrase set: "commence the Offer", "Offer Expiration Time", "extend the
  Offer", 251(h), "increments of", "Schedule 14D-9"): 14 cards / 4 deals —
  6 STRUCT-MERGER, 8 null-subtype, +1 STRUCT-DIRECTORS edge hit — the
  honest in-family offer population, low-N on every measurement.
- **F — extension-increment receipts (verbatim snippets, card ids
  above):** the three offer extension shapes (c1d9d287, a3732b8b ×2 limbs,
  0e05a711) plus the TERMR-OUTSIDE End-Date trap (f223776a).
- **G — a149469a anchor bytes** (the interpolated "satisfaction or (to the
  extent permitted by applicable Law) waiver") **+ 251(h) homes:** sampled
  251(h) rows in deal `555579a6…` spread across null-subtype,
  COND-M-STOCKHOLDER, REP-T-AUTH, STRUCT-MERGER and DEF-GENERAL homes —
  a priced deal-local lexicon cross-hit (§5) — including a new grounded
  heading "Section 6.03. Approval of Merger." (see the classifier's named
  stage-2-only exception, §3). The second 251(h) deal is `320a3899…` (its
  own grounding cards `5acd8a63…`/`a3732b8b…`); 251(h) spans 2 deals total.

## Grounding corrections (verified against repo + production DB, 2026-08-03)

1. **No registered v2 vocabulary exists for this family.** Verified: grep
   of `lib/canonical-v2/contract-bundle.js` for `STRUCT` returns only the
   unrelated PARSER_V2_STRUCTURAL adapter strings; no STRUCT concept key,
   no claim definition. Every concept below is new and FLAGGED FOR BEN
   (the 2026-07-23 convention: this spec proposes, Ben settles).
2. **v1's STRUCT features are mostly free text or never-populated.**
   `closingTiming`/`closingLocation`/`effectiveTimeShort`/
   `effectsOfMergerReference` are `type: 'text'`; `adsPresent`/
   `adsVotingMechanics` have a near-zero real population ("%American
   Depositary%" = 0 rows corpus-wide — pack §9; reported as near-null,
   never padded); the 16-key STRUCT-OFFER schema (15 excluding the
   `mainConcept` boilerplate key) has zero populated instances. Consequence: the v1↔v2 comparator has essentially
   card-level presence to disagree with in this family — no governed
   field-level comparator surface exists, so the M3 auto-pass
   v1/v2-agreement leg cannot be satisfied and EVERY claim this slice
   resolves is Ben-reviewed until v2 history accumulates. Stated so
   nobody reads "resolves" as "publishes unreviewed".
3. **v1 defect flags for ingest-QA, never absorbed here:** (a) the
   STRUCT-OFFER zero-subtype gap with offer mechanics filed under
   STRUCT-MERGER (`a3732b8b…`, `0e05a711…`) and null subtype
   (`c1d9d287…`, `82576a71…`) — receipt E; (b) the `fe717a8d…`
   closing-deliveries card mislabeled STRUCT-CLOSING; (c) 68 null-subtype
   rows and the `[PROPOSED]`/`Unclassified` backlog (pack §6) — real
   recurring content (Top-Up Option, Surrender and Payment, Lost
   Certificates, Dissenting Shares, Adjustments) with no STRUCT code,
   routed to the open-world commonality report, not regex-covered; (d)
   hazard 7 (pack §8): v1 `section_ref` labels disagree with the real
   in-quote clause numbers — which is why stage-1 rules are authored from
   REAL headings embedded in quote bytes (the D&O/employee-matters
   honest-dispatch discipline) and fixture headers never carry v1
   section_ref label strings.
4. **The family brief's ADS and SCHEME/ASSET vocabulary has no grounding
   population.** ADS: zero rows (correction 2). SCHEME: bare "%scheme%" =
   5 unconfirmed hits (pack §9 — not confirmed as scheme-of-arrangement
   structures). Neither ships; both FLAGGED FOR BEN as family-brief
   deviations.
5. **Bundle version numbering:** this spec binds to "the next frozen
   version at this slice's merge"; every superset-diff acceptance test is
   written against CONTENT (sorted key sets), never the numeral.

## Cross-family boundaries (BINDING; duplication is an automatic audit
CRITICAL; each pin has a named acceptance test in section 6)

1. **Consideration family (CONS) — offer PRICE, consideration form, and
   every per-share dollar. Cited, never claimed.** Grounding card
   `0e05a711…` carries "$137.00 per Share in cash" INSIDE the same §1.1
   that grounds the expiration claim. Pins: (a) this family parses NO
   money — the day-count parser's token grammar has no currency arm at
   all, so a money literal is structurally invisible to it; (b) no OFFER
   kind mints a price/consideration claim; the producer prompt names
   offer price, exchange ratios, CVR terms (`a3732b8b…` is CVR-linked),
   exchange-fund/surrender/lost-certificate mechanics, adjustments,
   appraisal/dissenters' rights and equity-award treatment as NOT this
   family's assertions (v1's own classify.js ~268 CONSID override list is
   the ported title-exclusion — §3); (c) grep-test: zero consideration
   vocabulary ("per Share", "Exchange Ratio", "CVR", "Exchange Fund",
   "surrender") in this slice's prompt, corroboration tables and lexicon.
   Test 4.
2. **Closing-conditions family (COND) — offer CONDITIONS and all closing
   conditions. Cited, never claimed.** The offer-conditions annex
   population is COND territory (v1 routes "Conditions to the Offer"
   annex titles to COND-B, classify.js ~250); the minimum condition
   (receipt G's COND-M-STOCKHOLDER 251(h)-citing card) is COND's; the
   "satisfaction or waiver" vocabulary this family uses as a
   closing-TIMING anchor is shared surface with conditions chapeaus —
   this family claims only the closing-DATE formula, never any
   condition's content, and the COND spec's rank-70 tier and concepts are
   never touched. The annex title-regex hole (pack §8 item 1: "Annex-A",
   "ANNEX-COND(i)" refs) is COND's flagged under-coverage AND this
   family's: neither family's stage-1 rules reach bare annex refs; typed
   undispatched records measure the miss (Known costs). Test 4.
3. **D&O indemnification family (DNO) — charter-continuation content
   inside surviving-charter sections.** The DNO spec owns every claim
   about indemnification/exculpation provisions carried in the surviving
   entity's organizational documents. This family's
   `SURVIVING_CHARTER_PROVISION` claims a DIFFERENT legal fact from the
   same neighborhood — the identity/treatment of the governing
   instruments at the effective time (amend-and-restate-per-exhibit,
   LLC-form instrument swap), never their indemnification content. Named
   explicitly because both families can legitimately mint claims near the
   same article: that is two facts, not one fact claimed twice. Pins: no
   /indemnif|exculpat/ vocabulary anywhere in this slice's modules
   (grep-test); DNO-titled sections (its own stage-1 rules) are never
   claimed by this family's title rules. Test 4.
4. **Proxy/meeting-covenants family — shareholder approval mechanics.**
   v1's `shareholderApprovalMethodCompany/Parent` enums are NOT promoted
   here; stockholders-meeting/written-consent machinery is that family's.
   The one v1 title collision is pinned by NOT porting a rule: v1 stamps
   /^approval\s+of\s+the\s+merger/ as COV-SHAPRV-PARENT (classify.js),
   while deal `555579a6…` titles its 251(h) section "Section 6.03.
   Approval of Merger." (receipt G) — an ambiguous title surface. This
   spec adds NO approval-of-merger stage-1 rule; that card is a NAMED
   stage-2-only case (§3), a priced queue cost, never a title claim.
5. **Termination-rights family (TERMR) — End-Date/Outside-Date extension
   mechanics.** "extend the End Date in increments of ninety (90) days"
   (`f223776a…`, receipt F) matches the increments vocabulary but is
   TERMR territory. The OFFER_EXTENSION_INCREMENT corroboration therefore
   REQUIRES an offer-context conjunct (/extend the Offer/ or /extend the
   Expiration Time/) alongside the increments phrase; the End-Date card
   is committed as the permanent boundary regression fixture. Test 4.
6. **Employee-matters / consideration — 14D-9-adjacent ESPP and equity
   award "[PROPOSED]" cards** (pack §6) route to their own families or
   open world; the Schedule 14D-9 filing covenant itself (`82576a71…`) is
   DEFERRED (not promoted this slice — Out of scope) and stays
   open-world.

## Deliverable (honest conversion semantics)

Governed, resolvable claims for: (a) the merger-survivor fact of the core
merger section; (b) 251(h) no-vote governance; (c) the closing-date
FORMULA — presence plus its Business-Day count as a parsed numeric,
formula-shaped, never a bare date; (d) two tender-offer numerics (initial
expiration, extension-increment maximum); (e) effective-time filing
mechanics; (f) surviving-entity charter/bylaw treatment presence.

**No recorded native runs exist over structure sections** — the producer
today extracts capitalisation plus the wave families' committed harnesses.
There are no open-world fixture rows to convert and no closure_ids to
track. The deliverable is the five-layer capability plus a pre-rerun
harness: a COVERAGE MAP over committed corpus-quote fixtures (the cards
named above, committed as LITERAL production bytes with provenance
headers: deal uuid, provision_card uuid, retrieval date,
provision_type/subtype including NULL and the two STRUCT-MERGER mislabels
where true — the TERMF m-2 discipline), each hand-enumerated with its
expected outcome. The P1 audit M-5 honesty pins apply verbatim: "the
pipeline natively extracts merger structure/closing mechanics" may be
claimed ONLY after dated post-merge live-run handoffs (subscription CLI);
until then the honest claim is "the machinery exists and is proven on
committed fixtures".

**Fixture placement is load-bearing:** all committed fixtures live under
`tests/fixtures/canonical-v2/merger-structure-live-run/` (the
forbidden-patterns PROSE_CLASS_FINGERPRINTS-exempt directory class).
Checked against `scripts/lint/forbidden-patterns.sh` globalPatterns: this
family's vocabulary ("merged with and into", "251(h)", "Business Day",
"Effective Time", "certificate of merger", "articles of merger",
"satisfaction or waiver", "Offer Expiration Time") collides with no
global or scoped fingerprint; no new exemption entries are needed, and no
spec prose, fixture, or module in this slice may introduce fingerprinted
vocabulary outside the exempt fixture directory. Fixture headers carry
deal uuid + provision_card uuid + retrieval date + type/subtype ONLY —
never v1 `section_ref` label strings (the IOC lint pin; this family's
"STRUCT | The Merger | …" label style is exactly the class that must stay
out of headers — grounding correction 3d).

## 1. Registry (`contract-bundle.js` → next frozen version)

Strictly additive spread of the head version at build time. **Five new
concepts, all FLAGGED FOR BEN in the PR body**, `{concept_key, version}`
shape only. The v1 `STRUCT-*` code names are reused as v2 concept keys
where the semantics carry 1:1 (the COND precedent — label-collapse is not
in play here the way it was for COV-DIVIDEND: each key below names one
legal fact family, and the corpus content matches the label). Reusing
`STRUCT-OFFER` despite its zero v1 population is deliberate: the rubric
code's semantics are exactly the promoted content, and minting a synonym
key would orphan the v1 vocabulary for no gain.

- `STRUCT-MERGER` — the core merger-effectuation fact: which entity
  survives. Grounded 28 cards / 28 deals on the exact operative phrase
  (receipt B).
- `STRUCT-OFFER` — two-step tender-offer mechanics: 251(h) governance,
  initial expiration, extension increments. **LOW-N, flagged as such: the
  honest two-step population is 3–9 deals (receipt D/E), and 251(h)
  specifically is 2 deals** — comparable to DIVD-SPECIAL's 2-deal ship,
  and flagged the same way. It ships anyway, for stated reasons Ben can
  reject: the family brief centers two-step mechanics; the value shapes
  are the cleanest belt-and-braces digit literals in the corpus
  ("twentieth (20th) Business Day", "ten (10) Business Days"); and the
  v1 side has a declared 16-key schema (15 excluding `mainConcept`
  boilerplate) with zero rows — this is the
  single largest label-coverage gap in the family and the promotion is
  what makes the gap measurable instead of silent. If Ben defers it, the
  frozen maps, lexicon and tests shrink mechanically and the other four
  concepts stand alone.
- `STRUCT-CLOSING` — the closing-date formula. Grounded 34 cards / 33
  deals; 29/34 carry a registered anchor phrase (receipt E).
- `STRUCT-EFFTIME` — effective-time filing mechanics (instrument +
  filing). Grounded 24 cards / 21 deals; the two corroboration phrases
  cover ~100% (receipt C, overlap = dual-filing deals).
- `STRUCT-CHARTER` — surviving-entity charter/bylaw treatment presence.
  Grounded 38 cards / 30 deals (receipt C), including the LLC-vocabulary
  variant (`fee7da2b…`).

NOT added (each a legal ruling, not an omission):

- **`STRUCT-DIRECTORS` (38/30), `STRUCT-EFFECTS` (23/22),
  `STRUCT-ACTIONS` (9/9)** — real corpus families, deliberately deferred
  to a follow-on slice with its own grounding pass (the COND deferral
  device: this slice holds to the family brief's named workstreams —
  two-step mechanics, 251(h), closing formulas, effective time, charter —
  so every layer stays reviewable). Their titles get NO stage-1 rules
  this slice; unregistered concepts get no dispatch surface.
- **An offer-commencement-deadline numeric.** One grounded card
  (`c1d9d287…` "fifteen (15) Business Days"); the pack's second variant
  ("ten (10) Business Days after the date hereof", §7) carries no card id
  and therefore cannot ground anything. One deal is not a grounding set
  (the REM-NONRECOURSE rule). The commencement sentence stays inside the
  quote/open world; FLAGGED FOR BEN with the STRUCT-OFFER low-N call.
- **An effective-time filing-cap numeric** ("not to exceed thirty (30)
  days after … acceptance for record" — `3a96ea09…`, `84aae11f…`).
  CALENDAR days, 2 deals, Maryland-specific; under this slice's own
  parser it would ABSTAIN `NON_BUSINESS_DAY_UNIT` on every grounded quote
  — REM-CAP vacuity at design time, so no claim exists to ship. The cap
  stays in the quote as reviewer evidence.
- **A closing-LOCATION claim.** v1's `closingLocation` is free text (firm
  names/addresses, pack §7); "remotely by exchange of documents"
  (`9ac9e74c…`) is displacing physical closings; no enum is honest on
  this drafting. Stays in the quote.
- **Top-Up Option, short-form/90% threshold, back-end merger mechanics**
  (`337b3421…`, `3f2af5fd…`, pack §6–7) — pre-251(h) legacy mechanics, ≤2
  deals each, open world; recorded for the commonality report.
- **`dealStructure` as a claim.** ONE_STEP vs TWO_STEP is a DEAL-level
  derivation over this family's section-level claims (the presence of
  offer-mechanics claims IS the two-step signal), which is serving-layer
  work, not a quote-local claim. Deriving it here would be an asserted
  conclusion with no single quote — exactly what M3 rule 1 exists to
  prevent on the negative side ("this deal has NO offer" is a derived
  ABSENT, forever out of the producer's mouth).
- **ADS fields, SCHEME/ASSET enums** — no grounding population
  (grounding correction 4).

**Claim definitions** (eight: five presence/enum, three numeric):

```
MERGER_SURVIVOR_CLAIM_DEFINITION_V1
  claim_definition_key: 'MERGER_SURVIVOR'
  version: 1
  allowed_canonical_values: ['TARGET_SURVIVES']   // one-code enum,
  canonical_value_required_when_present: true     // registry-hosted

SECTION_251H_GOVERNED_CLAIM_DEFINITION_V1
  claim_definition_key: 'SECTION_251H_GOVERNED'
  version: 1
  allowed_canonical_values: [true]                // presence claim,
  canonical_value_required_when_present: true     // KNOWLEDGE_QUALIFIER shape

CLOSING_TIMING_FORMULA_CLAIM_DEFINITION_V1
  claim_definition_key: 'CLOSING_TIMING_FORMULA'
  version: 1
  allowed_canonical_values: [true]
  canonical_value_required_when_present: true

CLOSING_TIMING_BUSINESS_DAY_COUNT_CLAIM_DEFINITION_V1
  claim_definition_key: 'CLOSING_TIMING_BUSINESS_DAY_COUNT'
  version: 1
  canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING'   // existing type
  canonical_value_required_when_present: true

OFFER_INITIAL_EXPIRATION_BUSINESS_DAYS_CLAIM_DEFINITION_V1
  claim_definition_key: 'OFFER_INITIAL_EXPIRATION_BUSINESS_DAYS'
  version: 1
  canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING'
  canonical_value_required_when_present: true

OFFER_EXTENSION_INCREMENT_MAX_BUSINESS_DAYS_CLAIM_DEFINITION_V1
  claim_definition_key: 'OFFER_EXTENSION_INCREMENT_MAX_BUSINESS_DAYS'
  version: 1
  canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING'
  canonical_value_required_when_present: true

EFFECTIVE_TIME_FILING_CLAIM_DEFINITION_V1
  claim_definition_key: 'EFFECTIVE_TIME_FILING'
  version: 1
  allowed_canonical_values: [true]
  canonical_value_required_when_present: true

SURVIVING_CHARTER_PROVISION_CLAIM_DEFINITION_V1
  claim_definition_key: 'SURVIVING_CHARTER_PROVISION'
  version: 1
  allowed_canonical_values: [true]
  canonical_value_required_when_present: true
```

No new canonical value types; no validator changes.
New concepts and definitions grow the expected-keys rows as sorted
supersets (content-diffed tests; prior rows byte-untouched).

**Design decisions, pinned as legal rulings:**

- **`MERGER_SURVIVOR` starts with ONE code.** Every grounded quote is the
  reverse-triangular shape (sub merges into target, target survives —
  receipt B, 28/28 deals on the operative phrase). Forward-merger
  drafting ("the Company shall be merged with and into Merger Sub") has
  ZERO grounded quote bytes in this corpus; under the grounding rule no
  `SUB_SURVIVES`/`PARENT_SURVIVES` code ships. Out-of-enum survivor codes
  route to explicit `pushOpenWorld`, typed
  `MERGER_SURVIVOR_OUT_OF_VOCABULARY` (the COND covenant-standard
  routing shape); the enum grows only by reviewed diff with a corpus
  receipt. The one-code enum is not decoration: the corroboration gate
  (§4) is what stops a forward merger from publishing as
  TARGET_SURVIVES — a wrong survivor is exactly the
  invisible-corruption shape that poisons every downstream
  surviving-entity rollup.
- **Formula and day count are TWO claims under STRUCT-CLOSING, pinned
  co-resolvable** (the DIVD declared/amount split + the COND
  NO_MAE/CONTINUING subsumption device — both adopted): both grounded
  digit-bearing quotes carry the anchor and the count in one sentence,
  so both kinds matching one quote is the drafting's ordinary shape. The
  split earns its keep at the failure boundary, and in this family the
  failure boundary is the MARKET NORM: 17/34 closing cards draft
  spelled-only ordinals (receipt A), whose day count ABSTAINs
  `NON_LITERAL_ORDINAL` — the formula presence claim still resolves and
  only the number queues. Coverage degrades to a queue item, never to
  silence and never to a guessed number.
- **Spelled ordinals are NOT converted. Ever.** "third Business Day"
  resolves no number this slice — the P1 rule ("spelled-out numbers
  route to review, not to arithmetic") applies verbatim; a frozen
  ordinal-word lookup (first→1 … tenth→10) is a plausible future
  promotion but it is a DEVIATION from the P1-pinned discipline and is
  therefore FLAGGED FOR BEN as a named follow-on decision, never
  implemented silently here. Until then the honest number population is
  the 9 digit-ordinal cards (receipt A) plus the offer numerics.
- **The extension value is the per-increment MAXIMUM, and "up to"/"not
  more than" semantics stay in the quote.** All three grounded extension
  quotes bound the increment ("up to ten (10)", "not more than ten
  (10)", "up to five (5) … per extension" — receipt F); the claim
  definition name carries `_MAX_` so no consumer misreads it as a
  mandatory duration. The no-literal limb ("increments of such duration
  as requested by the Company", `a3732b8b…`) ABSTAINs `NO_PERIOD_LITERAL`
  by design — a negotiated-duration extension has no number to claim.
- **251(h) is a quoted PRESENT claim under STRUCT-OFFER.** It is the
  two-step back-end mechanic (v1 houses `section251h` under STRUCT-OFFER
  features); the alternative home (STRUCT-MERGER, since the cited
  statute governs the MERGER) is defensible and NAMED FOR BEN — whichever
  he picks, the kind map (§4) changes one line. A deal without 251(h)
  language simply has no claim; "not a 251(h) deal" is scope-closure
  territory, forever (M3 rule 1).

**Governed attributes (never in keys; all participate in claim
identity/closure):**

- `SECTION_251H_GOVERNED`: `statute_cite_ref` — REQUIRED verbatim cite
  phrase from the quote ("Section 251(h) of the DGCL"; the cite-depth
  variants "251(h)(6)" / "251(h)(6)(f)" — pack §8 item 8 — are captured
  verbatim, never normalized), enforced as a verbatim substring of the
  byte-verified quote (P1 M-3); failure → review, typed
  `STATUTE_CITE_NOT_IN_QUOTE`.
- Both closing claims: `timing_anchor` — enum `CONDITIONS_SATISFACTION |
  OFFER_CONSUMMATION`, corroborated (§4), never trusted from the label;
  both patterns matching one quote → review, typed
  `AMBIGUOUS_TIMING_ANCHOR`. This is what keeps the "second Business Day
  after satisfaction of conditions" formula distinct from the
  same-day-as-Offer-consummation formula (`c6254cb5…`) — two different
  legal clocks that must never collapse into one number series.
- `EFFECTIVE_TIME_FILING`: `filing_instrument_ref` — REQUIRED verbatim
  ("certificate of merger", "articles of merger"), substring-enforced,
  typed `FILING_INSTRUMENT_NOT_IN_QUOTE`; `effective_time_term_ref` —
  REQUIRED verbatim defined-term phrase ("Effective Time", "Company
  Merger Effective Time"), substring-enforced, typed
  `EFFECTIVE_TIME_TERM_NOT_IN_QUOTE`. Identity-bearing BY DESIGN: the
  multi-merger deals (`0a043659…`, `dfaa71fa…`, `c750afb9…` — pack §8
  item 2) define multiple effective times in one section; two filings in
  one section must never dedupe, and a dual-jurisdiction filing
  (`3a96ea09…`: SDAT articles + DSOS certificate) is TWO claims, one per
  instrument.
- `SURVIVING_CHARTER_PROVISION`: `instrument_ref` — REQUIRED verbatim
  ("certificate of incorporation", "certificate of formation", "bylaws",
  "limited liability company agreement"), substring-enforced, typed
  `CHARTER_INSTRUMENT_NOT_IN_QUOTE`. Verbatim-from-quote, deliberately
  NOT an enum: the LLC vocabulary swap (pack §8 item 3) is exactly why a
  corporate-vocabulary enum would misfile real deals; cross-deal
  instrument canonicalization is a Ben adjudication over observed values
  later (the share_class_ref precedent verbatim).
- `MERGER_SURVIVOR`: no attributes beyond the quote — the one-code enum
  and the anchored pattern carry the fact; party structure here would be
  fabricated structure (the TAXM-FIRPTA ruling).
- **No party tuple is minted anywhere in this slice** — structural
  mechanics are the agreement's own machinery, not one party's right
  against another; asserting a beneficiary the quote does not name is an
  asserted party with no quote of its own (the TERMF payee ruling
  verbatim). `unit` on the numeric claims: fixed `'BUSINESS_DAYS'`,
  stamped by the parser only when the unit token matched, never
  producer-asserted (the TERMF currency rule transplanted).

M3 rule 1 restated for this family: the producer NEVER asserts "no
tender offer" / "one-step deal" (derived, scope-closure, forever), never
asserts "no 251(h)", never asserts a closing date CALCULATED from the
formula (the formula is the fact; the arithmetic is nobody's to do), and
never reads a conditions chapeau's "satisfaction or waiver" as a closing
claim — the anchor corroborates a closing-timing quote, it does not
convert conditions text into this family (the classifier declines
CONDITIONS contexts, §3, and dispatch and corroboration are independent
defenses).

## 2. Value parser: `business-day-count-parse.js`

New pure module, `termination-fee-parse.js` / `measurement-date-parse.js`
contract shape: typed `{outcome:'RESOLVED', canonical_value,
matched_text, unit}` or `{outcome:'ABSTAIN', reason, matched_text?}` —
never a throw on prose, never arithmetic, never repair.
`BUSINESS_DAY_COUNT_PARSE_VERSION` threaded into the resolution receipt
(P1 M-6). ONE exported function — this family gets no other parser (the
closing-conditions "no parser is a ruled decision" precedent applies to
everything else in the family):

**`parseBusinessDayCount(quote)`** — the TERMF `parseTailPeriodMonths`
discipline inherited whole, extended by exactly one grammar arm (ordinal
digit forms) and one unit gate:

- Candidate tokens: digit-bearing period literals of ANY unit, in either
  belt-and-braces form — `fifteen (15) Business Days`, `twentieth (20th)
  Business Day` (the parenthesized DIGIT, with optional ordinal suffix
  `st|nd|rd|th`, is the literal; the spelled word is matched but never
  trusted alone) — or bare form (`10 Business Days`, `2nd Business Day`).
  Grammar sketch: optional spelled word, then `\((\d{1,3})(?:st|nd|rd|th)?\)`
  or `\b(\d{1,3})(?:st|nd|rd|th)?\b`, then the unit word
  (`Business\s+Days?|days?|months?|years?`), global. The unit-word
  requirement is what makes clock times ("10:00 a.m.", "8:00 a.m." —
  both present in grounded closing bytes), section numbers, dollar
  figures and dates structurally invisible — there is no separate
  exclusion pass to write (the TERMF inversion note verbatim). The
  digit run must end on a digit (TERMF F-2 pin — a sentence comma is
  never swallowed).
- Precedence, pinned (TERMF M-4 inherited): `/anniversary/i` → ABSTAIN
  `ANNIVERSARY_PHRASE` first; then multiplicity across period literals
  of ANY unit — two or more → ABSTAIN `MULTIPLE_PERIOD_LITERALS` before
  any unit or resolution logic. The unsplit `c1d9d287…` §2.01 card (15
  BD commencement + 20th BD expiration + 10 BD increments in one
  section) ABSTAINs here by design; the producer owns the split.
- Exactly one literal, unit gate: `Business Day(s)` (case-insensitive)
  → RESOLVED, `canonical_value: String(Number(digits))` (e.g. `'2'`,
  `'20'`, `'25'`, `'10'`, `'5'`), `unit: 'BUSINESS_DAYS'`. Any other
  unit (calendar days, months, years) → ABSTAIN `NON_BUSINESS_DAY_UNIT`
  — the typed-abstain day-count discipline the family brief mandates:
  thirty CALENDAR days (the SDAT cap) must never publish as thirty
  business days, and no conversion exists in either direction.
- Zero digit-bearing literals: spelled ordinal/cardinal + unit present
  (`/(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|
  fifteenth|twentieth)\s+business\s+day/i` or the TERMF spelled-cardinal
  list) → ABSTAIN `NON_LITERAL_ORDINAL` (the 17/34 closing population,
  receipt A — the family's priced market-norm abstain); otherwise →
  ABSTAIN `NO_PERIOD_LITERAL` (the `c6254cb5…` same-day-as-Offer quote
  and the `a3732b8b…` negotiated-duration extension limb land here by
  construction).
- No money arm exists in the grammar at all (Boundary 1) — `$137.00`
  in `0e05a711…`'s bytes is not a candidate token, pinned by test on
  the committed literal bytes.

REM-CAP vacuity check, run at design time: grounded RESOLVED outcomes
exist for every numeric claim — CLOSING count: `a149469a…` → `'2'` (7–9
of 34 cards resolve, receipt A/E); OFFER expiration: `c1d9d287…` →
`'20'`, `0e05a711…` → `'25'`; OFFER extension: `c1d9d287…` → `'10'`,
`0e05a711…` → `'10'`, `a3732b8b…` limb → `'5'`. No claim ships whose
entire grounding abstains.

## 3. Producer prompt + provider

- **New prompt module**
  `lib/canonical-v2/native-producer/merger-structure-producer-prompt.js`.
  Existing prompts are NOT edited (PROMPT_VERSIONs do not move; recorded
  capitalisation/termination-fee/no-shop fixtures replay
  byte-identically). New `PROMPT_ID 'native-producer-merger-structure/v1'`,
  `PROMPT_VERSION 1`, bumped once per slice, never mid-slice.
- **Dispatch through `producer-prompt-registry.js`, mandatorily.** The
  seam exists at head (CAPITALISATION + TERMINATION_FEE + NO_SHOP;
  fail-closed nulls; module-private frozen Map). This slice adds ONE
  entry in its own reviewed diff, per the module's own header convention:
  `MERGER_STRUCTURE → buildMergerStructureProducerPrompt`. Unknown family
  → no prompt, no candidates, typed record — never a silent
  capitalisation fallback.
- **Section-family classifier extension**
  (`section-family-classifier.js` — stage-1 rules are added per family in
  that family's reviewed diff; this is that diff for MERGER_STRUCTURE).
  Rules ported from the v1 STRUCT rules where they exist and authored
  fresh from REAL headings embedded in committed quote bytes elsewhere
  (the D&O heading-grounded discipline — v1 `section_ref` labels are
  unusable, grounding correction 3d), using the financing-covenants
  `runStage1(title, article_context)` signature (build-order pin, adopted
  verbatim from the tax-matters/dividends specs: the head module still
  carries `runStage1(title)`; if a sibling slice extending the signature
  has landed, the extended signature exists; if this slice lands first,
  it extends the signature exactly per the financing spec's §3 and bumps
  `SECTION_FAMILY_CLASSIFIER_VERSION` — the seam amendment is built once,
  to that spec, whichever family arrives first):
  - **Shared exclusion constant FIRST — `CONSID_MECHANICS_TITLE_PATTERN`,
    ported VERBATIM from `lib/parser-v2/classify.js` ~268** (the
    consideration-mechanics override list: "Effect of the Merger on…",
    "Conversion of … Capital Stock", "Exchange of Certificates",
    "(Mixed|Cash|Stock) Election", "Lost, Stolen or Destroyed
    Certificates", "No Appraisal Rights", "No Dividends or
    Distributions", "Withholding Rights", "Merger Consideration", …).
    Any title matching it declines ALL MERGER_STRUCTURE rules — this is
    the v1-proven fix for the Skechers-class failure where an article
    titled "THE MERGER" folds the whole consideration package under a
    STRUCT heading (classify.js's own comment block). One pattern, one
    place, shared as a named constant so the claim rule and its
    exclusion can never drift apart (the TERMF_TITLE_PATTERN device,
    mandated for this wave).
  - `/^conditions?\s+to\s+the\s+offer\s*\.?\s*$/i` declines (COND
    territory — classify.js ~250; Boundary 2).
  - `/^(?:the\s+)?merger\s*\.?\s*$/i` — authored-with-modification from
    classify.js ~270 (adds `\.?\s*` to v1's
    `/^(?:the\s+)?merger\s*$/i` to cover period-bearing embedded
    headings — a justified widening, not a verbatim port; real headings
    "Section 1.1 The Merger." `75209318…`, "Section 2.04. The Merger."
    receipt G).
  - `/effective\s+time/i` — ported classify.js ~272 ("Effective Time"
    headings, `3a96ea09…`, `ecfe2957…`).
  - `/^(?:the\s+)?closing(?:\s+of\s+the\s+merger)?\s*\.?\s*$|^closing\s+date\b/i
    — authored from grounded headings ("SECTION 1.02. Closing."
    `9ac9e74c…`; "Section 2.03. The Closing." `c6254cb5…`; "2.2 Closing."
    `a149469a…`), with TWO exclusions checked first: `/deliver/i` (the
    `fe717a8d…` "Closing Deliveries" checklist — pack §8 item 6, the
    grounded title-exclusion case) and `/condition/i` ("Conditions to
    Closing" belongs to COND).
  - `/^(?:the\s+)?offer\b|^company\s+actions?\b|schedule\s+14d-9|stockholder\s+lists?/i
    — ported from classify.js ~291 (the v1 STRUCT-OFFER refinement rule;
    real headings "[PROPOSED] The Offer" §2.01 `c1d9d287…`, "Company
    Actions" `82576a71…`), AFTER the conditions-annex exclusion above.
  - `/merger\s+without\s+a\s+vote/i` — authored from the grounded §2.6
    heading "Merger Without a Vote of Stockholders" (`5acd8a63…`).
  - `/^certificate\s+of\s+(incorporation|formation)\b|^(?:the\s+)?by-?laws\s*\.?\s*$|organizational\s+documents\s+of\s+the\s+surviving|^governing\s+documents\b/i
    — authored from the grounded embedded heading "Section 3.01.
    Certificate of Incorporation." (`b621bd3b…`) plus the rubric's real
    alias headings. The formation arm's real dispatch surface is the
    fourth arm, `/^governing\s+documents\b/`: `fee7da2b…`'s real embedded
    heading is "Section 1.2 Governing Documents." — "Certificate of
    Incorporation / Bylaws" is the v1 `section_ref`/short_title label,
    banned from fixture headers (hazard 7), and matches none of the
    other three arms. Without this arm the LLC-variant grounding card
    fails every stage-1 rule and the recall pin (below) would fail on a
    named grounding card rather than a flagged exception.
  - **Declines, pinned:** REPRESENTATIONS, CONDITIONS and DEFINITIONS
    `article_context` decline ALL rules (organizational-documents reps,
    the 251(h) echoes in REP-T-AUTH/DEF-GENERAL homes — receipt G — and
    conditions articles must never dispatch here); INTERIM_OPERATING
    declines ALL rules; NO approval-of-merger rule exists (Boundary 4 —
    the `555579a6…` §6.03 "Approval of Merger." 251(h) card is the NAMED
    stage-2-only case, a priced queue cost); NO directors/effects/
    further-assurances rules exist (unregistered concepts, deferred).
  - **Known coverage hole, re-flagged honestly (the family brief's
    explicit ask):** tender-offer condition annexes carry refs like
    "Annex-A" / "ANNEX-COND(i)" and category labels like bare "COND-M"
    (pack §8 item 1). Those are COND-family content (Boundary 2), but
    the HOLE also bounds this family: an offer-mechanics body section is
    normally titled and classifies, while annex material fails every
    title rule in BOTH families → UNKNOWN → no prompt → typed
    `undispatched_sections` record. Two-step deals are under-covered at
    stage 1 this slice; the miss rate is measured by the live-run
    handoffs and by the review-time all-titles script, never silent.
  - **Recall pin (the REM-CAP/D&O standard):** the review-time
    all-titles script (live Supabase; never stubbed into `npm test` —
    the IOC test-5 discipline) asserts BOTH directions: no
    consideration/COND/D&O title classifies MERGER_STRUCTURE, AND every
    grounded fixture card's real embedded heading classifies
    MERGER_STRUCTURE at stage 1 — named exceptions only: `555579a6…`
    §6.03 (stage-2-only by Boundary-4 ruling) and any annex-ref'd
    material (the flagged hole). A grounded concept whose real heading
    fails every stage-1 rule is a script failure, not a silent stage-2
    fallback.
  - Stage 2 (AI-assisted) applies unchanged with
    `SECTION_FAMILY_AI_CLASSIFIED` provenance and the
    `SECTION_FAMILY_AI_UNVERIFIED` auto-pass block.
- **Response shape:** a `merger_structure_assertions` array — each
  element `{ section_reference, assertion_kind: 'MERGER_SURVIVOR' |
  'SECTION_251H' | 'CLOSING_TIMING_FORMULA' | 'CLOSING_TIMING_DAY_COUNT'
  | 'OFFER_EXPIRATION' | 'OFFER_EXTENSION_INCREMENT' |
  'EFFECTIVE_TIME_FILING' | 'SURVIVING_CHARTER', verbatim quote }` plus
  per-kind fields: MERGER_SURVIVOR carries `survivor` (the one-code
  vocabulary); SECTION_251H carries `statute_cite` (verbatim); both
  CLOSING kinds carry `timing_anchor`; EFFECTIVE_TIME_FILING carries
  `filing_instrument` and `effective_time_term` (verbatim);
  SURVIVING_CHARTER carries `instrument` (verbatim). One element per
  legal fact, split discipline pinned in the prompt:
  - A digit-bearing closing sentence grounds TWO assertions —
    CLOSING_TIMING_FORMULA and CLOSING_TIMING_DAY_COUNT — whose quotes
    may overlap on the shared sentence (the pinned co-resolution pair;
    `a149469a…` is this shape). A spelled-ordinal closing sentence
    grounds the FORMULA assertion alone (the day count would only
    abstain; the producer may still emit it, and it queues typed).
  - The compound §2.01 offer section (`c1d9d287…`) is at least THREE
    assertions (expiration, extension, plus open-world commencement),
    each quoting its own sub-clause — the P1 compound-sentence rule; the
    unsplit section ABSTAINs `MULTIPLE_PERIOD_LITERALS` by design.
  - A dual-jurisdiction effective-time section (`3a96ea09…`) is TWO
    EFFECTIVE_TIME_FILING assertions, one per filing instrument; a
    multi-merger section is one assertion per named effective time.
  - PRESERVE-THE-NOVEL retained verbatim; named in the prompt as NOT
    this family's assertions: offer price/consideration/CVR/exchange
    mechanics (Boundary 1), offer conditions and the minimum condition
    (Boundary 2), charter indemnification content (Boundary 3),
    shareholder-approval machinery (Boundary 4), End-Date extensions
    (Boundary 5), Top-Up Options, short-form thresholds, directors/
    officers succession, effects-of-merger vesting, further assurances
    (all open world or deferred). Open-world or silence, never forced
    fit. The producer never asserts a negative (M3 rule 1).
- **Provider (`anthropic-provider.js`):** ONE new generic key,
  `NATIVE_MERGER_STRUCTURE_CANDIDATE`, proposal_kind `MERGER_STRUCTURE`
  (≠ OPEN_WORLD). `merger_structure_assertions` is NOT added to
  `REQUIRED_RESPONSE_LISTS` (the share_count precedent verbatim:
  recorded responses predate the key; missing/non-array reads as empty
  list, never a schema failure). Quote byte-verification identical to
  existing proposals. Golden evals: recorded responses are never
  hand-edited into the new shape; the first merger-structure recordings
  are minted by the first live runs, each its own dated handoff.

## 4. Resolver wiring (`candidate-resolution.js`)

- **ONE new `RESOLUTION_UNCONDITIONAL` entry** (P1 M-2: the Map is keyed
  on generic_claim_key alone): `NATIVE_MERGER_STRUCTURE_CANDIDATE`,
  `deterministic_kind: null`, `attachment_position: null`,
  `registered_claim_definition_key: null`, `concept_key: null` (explicit,
  with the TERMR build-time check that nothing reads
  `mapping.concept_key` before the handler's kind map runs),
  `party_field: null` (no kind mints a party — section 1).
  `MAPPING_TABLE_VERSION` bumped; table-validation still asserts no
  duplicate generic keys.
- **Handler split on `assertion_kind`** via a frozen map:
  `MERGER_SURVIVOR → STRUCT-MERGER × MERGER_SURVIVOR`;
  `SECTION_251H → STRUCT-OFFER × SECTION_251H_GOVERNED`;
  `CLOSING_TIMING_FORMULA → STRUCT-CLOSING × CLOSING_TIMING_FORMULA`;
  `CLOSING_TIMING_DAY_COUNT → STRUCT-CLOSING ×
  CLOSING_TIMING_BUSINESS_DAY_COUNT`;
  `OFFER_EXPIRATION → STRUCT-OFFER × OFFER_INITIAL_EXPIRATION_BUSINESS_DAYS`;
  `OFFER_EXTENSION_INCREMENT → STRUCT-OFFER ×
  OFFER_EXTENSION_INCREMENT_MAX_BUSINESS_DAYS`;
  `EFFECTIVE_TIME_FILING → STRUCT-EFFTIME × EFFECTIVE_TIME_FILING`;
  `SURVIVING_CHARTER → STRUCT-CHARTER × SURVIVING_CHARTER_PROVISION`.
  Out-of-enum assertion_kind → explicit `pushOpenWorld`, typed reason
  (P1 C-4).
- **Full-table kind ambiguity rule (the TERMF C-3 device) with exactly
  ONE pinned subsumption pair:** the handler runs ALL kinds'
  corroboration patterns over the assertion's single byte-verified
  quote and reduces to the maximal matched-kind set.
  `CLOSING_TIMING_DAY_COUNT`'s patterns are BY CONSTRUCTION a strict
  superset of `CLOSING_TIMING_FORMULA`'s (the anchor pair AND
  `/\bBusiness Day/i`), so `{CLOSING_TIMING_FORMULA,
  CLOSING_TIMING_DAY_COUNT}` is the ONE subsumption/co-resolution
  exception this slice ships (the COND NO_MAE/MAE_CONTINUING pin
  verbatim): both may resolve from overlapping quotes, and a DAY_COUNT
  match never counts FORMULA as a competing kind. Every OTHER
  multi-kind match (e.g. a 251(h) cite inside a MERGER_SURVIVOR quote —
  the `555579a6…` §2.04 shape in receipt G is exactly this drafting) →
  review, typed `AMBIGUOUS_STRUCTURE_KIND` — UNLESS the producer quoted
  the narrower sub-clause in which exactly one kind's patterns match
  (the producer owns splits; per the remedies M3 correction there is NO
  resolver-side sub-quote search). Asserted-kind pattern mismatch →
  review, typed `STRUCTURE_KIND_UNCORROBORATED` (the `fe717a8d…`
  closing-deliveries bytes land here whenever asserted as any kind —
  the permanent mislabel regression fixture).
- **Corroboration tables (frozen resolver constants; label must bind to
  quote text; every pattern grounded in a committed fixture quote and
  validated against committed LITERAL bytes before freezing — the COND
  M3 discipline):**
  - `MERGER_SURVIVOR` ↔ /\bmerged with and into the
    Company(?!\s+Merger\s+Sub)\b/ (case-sensitive "Company"; grounded
    `75209318…`, receipt B 28/28 deals). The negative lookahead is the
    COND rep_side anti-spoof device: entity-soup drafting ("merged with
    and into the Company Merger Sub") must never corroborate
    TARGET_SURVIVES. Value gate: `canonicalValueAllowed` against the
    one-code enum; anything else → `pushOpenWorld`, typed
    `MERGER_SURVIVOR_OUT_OF_VOCABULARY`. Forward-merger drafting lands
    there mechanically — no grounded quote bytes corroborate
    TARGET_SURVIVES for a forward merger. The Nevada double-merger
    `337b3421…` does NOT land there mechanically: its bytes ("Merger Sub
    will be merged with and into the Company … NRS") pass the
    corroboration regex and the value gate exactly like a reverse-
    triangular quote, so a producer asserting TARGET_SURVIVES over it
    would resolve. Its open-world treatment is the PRESERVE-THE-NOVEL
    prompt instruction (§3) — a review-visible, non-mechanical defense —
    not a mechanical routing guarantee; the test-3 fixture proves the
    routing code by synthetically asserting an out-of-enum survivor, it
    does not prove the double-merger is mechanically excluded.
  - `SECTION_251H` ↔ /251\(h\)/ (literal; deliberately depth-agnostic so
    "251(h)", "251(h)(6)" and "251(h)(6)(f)" all corroborate — pack §8
    item 8; grounded `5acd8a63…`, `11f3ef36…`).
  - `CLOSING_TIMING_FORMULA` ↔ anchor patterns, which double as the
    `timing_anchor` corroboration: `CONDITIONS_SATISFACTION` ↔
    /\bsatisfaction\b[\s\S]{0,120}\bwaiver\b/i — the bounded gap exists
    BECAUSE of grounded drafting: `9ac9e74c…` is contiguous
    ("satisfaction or waiver") while `a149469a…` interpolates a
    parenthetical ("satisfaction or (to the extent permitted by
    applicable Law) waiver", receipt G); a contiguous-only pattern would
    queue a grounding card at birth. `OFFER_CONSUMMATION` ↔
    /consummation of the Offer/i (grounded `c6254cb5…`). Neither anchor
    → review, typed `CLOSING_ANCHOR_UNCORROBORATED` (the ~5/34
    no-anchor residual, receipt E — including the deliveries mislabel);
    both → `AMBIGUOUS_TIMING_ANCHOR`.
  - `CLOSING_TIMING_DAY_COUNT` ↔ the FORMULA anchors AND
    /\bBusiness Day/i (grounded `9ac9e74c…`, `a149469a…`) — the pinned
    superset.
  - `OFFER_EXPIRATION` ↔ /\bOffer Expiration Time\b/ (case-sensitive
    defined term; grounded `c1d9d287…`) ∪ /after the date on which the
    Offer was commenced/i (grounded `0e05a711…`) ∪
    /\bBusiness Day\b[\s\S]{0,80}following[\s\S]{0,80}commencement/i
    (grounded `c1d9d287…`/`a3732b8b…` "twentieth (20th) Business Day …
    following … commencement" — validated against committed bytes
    before freezing).
  - `OFFER_EXTENSION_INCREMENT` ↔ (/extend the Offer/i ∪ /extend the
    Expiration Time/i — grounded `c1d9d287…`, `a3732b8b…`, `0e05a711…`,
    receipt F) AND (/\bincrements? of\b/i ∪ /per extension/i — same
    receipts). The conjunction is Boundary 5's enforcement: the
    `f223776a…` End-Date quote matches the increments arm but never the
    offer-context arm → `STRUCTURE_KIND_UNCORROBORATED`, the permanent
    TERMR boundary fixture.
  - `EFFECTIVE_TIME_FILING` ↔ /certificate of merger/i ∪
    /articles of merger/i (grounded `3a96ea09…`, `84aae11f…`,
    `ecfe2957…`; receipt C shows ~full-population coverage). Non-filing
    effectiveness drafting (a pure "shall become effective upon…"
    section with no instrument) queues typed — priced, small (receipt
    C: ≤ 5 of 24 lack both phrases).
  - `SURVIVING_CHARTER` ↔ /certificate of (incorporation|formation)/i ∪
    /\bby-?laws\b/i ∪ /limited liability company agreement/i (grounded
    `b621bd3b…`, `fee7da2b…`; receipt C). Instrument-token disjunction
    ONLY, deliberately: requiring a treatment-verb conjunct
    ("amended and restated") would queue the LLC grounding card whose
    treatment drafting is not in evidence — the recall pin forbids
    designing a grounding card into permanent review. The residual
    (instrument tokens inside a misclassified section) is defended by
    the title gate + article-context declines, and costs review-time
    visibility at rank, never silent corruption.
- **Handler order per assertion:** full-table kind corroboration →
  verbatim-substring attribute enforcement (`statute_cite_ref`,
  `filing_instrument_ref`, `effective_time_term_ref`, `instrument_ref`;
  typed reasons per section 1) → `business-day-count-parse.js` (the two
  numeric kinds only) → enum/presence gates → concept assignment. Every
  ABSTAIN routes to review with the parser's typed reason; RESOLVED
  values still pass `canonicalValueAllowed` (a parser bug must not
  bypass the gate); presence/enum claims carry
  `buildMechanicalAnswerProvenance({ extraPins: { gate:
  'ALLOWED_VALUES_MEMBERSHIP' } })` (the tax-matters uniform
  tag-construction story; no auto-pass-block entry rides on it — the
  COND revisit block is keyed on REPRESENTATION_ACCURACY_STANDARD and
  does not extend here).
- **Materiality: NEW tier proposed, flagged for Ben.** `{ rank: 88,
  label: 'MERGER_STRUCTURE', concept_key_prefixes: ['STRUCT-MERGER',
  'STRUCT-OFFER', 'STRUCT-CLOSING', 'STRUCT-EFFTIME', 'STRUCT-CHARTER']
  }` — exact keys, deliberately never a bare `STRUCT-` prefix (the
  financing-covenants discipline: a bare prefix would silently sweep
  future STRUCT-DIRECTORS/EFFECTS/ACTIONS promotions into the tier
  without review). Rank placement is a Ben call inside a crowded band,
  named honestly: head carries 70 (CLOSING_CONDITIONS) and 90
  (NOTICES_ADMINISTRATIVE); unbuilt wave siblings propose 75 (FINANCING,
  GUARANTY — colliding), 80 (TAX, EMPLOYEE, PROXY_MEETING — colliding),
  85 (DIVIDENDS, DNO — colliding), and 88 (APPRAISAL_RIGHTS,
  `2026-08-03-family-appraisal-dissenters-rights-design.md:809` —
  colliding with THIS spec's own 88 pick). The 75–88 band carries at
  least EIGHT sibling proposals and FOUR collisions, including this
  spec's — not the collision-free placement earlier drafts of this
  section claimed. Named for Ben's single ordering pass (move to an
  uncontested value, e.g. 87, or resolve all four collisions together);
  the `'STRUCT-CLOSING-PENDING'` startsWith-routing is unaffected by
  wherever 88 lands.
- **Pre-concept review routing (TERMF M-3):** review items minted before
  the kind map runs (`AMBIGUOUS_STRUCTURE_KIND`,
  `STRUCTURE_KIND_UNCORROBORATED`) carry conceptFamily
  `'STRUCT-CLOSING-PENDING'` — a routing token only, never registered,
  never publishable — which startsWith-matches the `STRUCT-CLOSING`
  tier key → rank 88 instead of UNCLASSIFIED 99 (the dividends
  `DIVD-COORD-PENDING` device verbatim).
- **Identity:** assertion kind, timing_anchor, statute_cite_ref,
  filing_instrument_ref, effective_time_term_ref and instrument_ref all
  participate in claim identity/closure — the two closing claims over
  one overlapping sentence never collide or dedupe; a dual-filing
  effective-time section mints two distinct stable claims (one per
  instrument); a triple-merger section's per-effective-time claims
  (`0a043659…` shape) never dedupe across `effective_time_term_ref`
  values; charter + bylaws claims in one section stay distinct per
  `instrument_ref`.
- **Receipt + additivity (honest form, P1 M-1):** with no
  merger-structure input, resolution output must be byte-identical
  EXCEPT `mapping_table_version`, `contract_vocabulary_digest` (under
  the new bundle version), the new
  `business_day_count_parse_version` field, the bumped
  `section_family_classifier_version` (if this slice extends the
  signature — the build-order pin), and the recomputed
  `resolution_receipt_id`; documented in the PR as a field-level diff.
  Skipping the version bump to keep old pins green is the named
  anti-pattern.

## 5. Lexicon additions (`LEXICAL_FAMILY_LEXICON` V4 → next at head;
version re-checked at build time; every edit a reviewed diff; keys MUST
be registered concept keys — which is why all five concepts land in this
same slice; explicit `\b` on every case-sensitive defined-term regex;
static max ≤ 128; rationale per pattern)

- `STRUCT-MERGER`: LITERAL_PHRASE "merged with and into" (`75209318…`;
  receipt B — priced cross-hit: the phrase recurs in efftime/charter
  neighbors and multi-merger drafting deal-locally), "separate corporate
  existence" (`75209318…`; 34/44 in-subtype hits, receipt B).
- `STRUCT-OFFER`: BOUNDED_REGEX /\b251\(h\)/ (case-sensitive statutory
  cite; grounded `5acd8a63…`, `11f3ef36…`; **priced cross-hit, receipt
  G:** the cite verifiably appears in REP-T-AUTH, COND-M-STOCKHOLDER,
  DEF-GENERAL and null-subtype homes inside the two 251(h) deals —
  expected `LEXICAL_UNMATCHED_SIGNALS` concentrated in exactly the deals
  where the veto matters; deletion asymmetry applies; one hit pinned
  EXPECTED by test); LITERAL_PHRASE "Offer Expiration Time"
  (case-sensitive defined term as LITERAL_ACRONYM-style exact casing is
  not needed — the phrase is distinctive; `c1d9d287…`; 18 cards / 2
  deals, deal-local echoes priced), "extend the Offer" (`c1d9d287…`,
  `a3732b8b…`), "Schedule 14D-9" (`82576a71…`; 33 cards / 9 deals —
  fires in no-shop/reps/covenants of tender deals; priced: these hits
  are the strongest two-step veto tells in precisely those deals).
- `STRUCT-CLOSING`: LITERAL_PHRASE "satisfaction or waiver"
  (`9ac9e74c…`; priced cross-hit: conditions chapeaus and termination
  sections carry it corpus-wide — expected unmatched signals, one pinned
  EXPECTED; NOTE the lexicon literal intentionally does NOT cover the
  `a149469a…` interpolated form — a lexicon miss costs a missed VETO
  only, and the resolver-side anchor regex, which is not
  length-restricted, does cover it), "shall take place" (`9ac9e74c…`,
  23/34 receipt E; priced cross-hit: 56 cards corpus-wide vs 23
  in-closing, bounded to the same-family-within-section reading,
  deletion asymmetry applies).
- `STRUCT-EFFTIME`: LITERAL_PHRASE "certificate of merger"
  (`3a96ea09…`; 19/24 receipt C; **priced cross-hit:** 202 cards
  corpus-wide — 85 DEFINITION, 72 REPRESENTATION, 43 STRUCTURE_MECHANICS,
  2 MISC, i.e. ~157 out-of-family cards, the largest cross-hit in this
  slice's lexicon, an order of magnitude beyond the 251(h)/"satisfaction
  or waiver" cross-hits priced elsewhere in this section; bounded to the
  same-family-within-section reading, one pinned EXPECTED unmatched
  signal in a DEFINITION home, deletion asymmetry applies), "articles of
  merger" (`84aae11f…`; 6/24 — the Maryland/Virginia arm; priced
  cross-hit measured the same way, same-family-within-section bounding).
- `STRUCT-CHARTER`: LITERAL_PHRASE "amended and restated in its
  entirety" (`b621bd3b…` — deliberately the long form; bare "amended and
  restated" fires on "Amended and Restated …Agreement" defined terms
  corpus-wide), "certificate of formation" (`fee7da2b…` — the LLC
  vocabulary arm; priced cross-hit: 33 cards corpus-wide vs 1 grounding
  card, bounded to the same-family-within-section reading, deletion
  asymmetry applies).

**Priced exclusions** (each a recorded blind spot; veto-only design
means a miss costs a missed VETO, never a wrong claim):

- Bare "tender offer": 113 cards / 38 deals (pack §5) — reps, no-shop
  and definition noise across nearly the whole corpus.
- Bare "Effective Time", "Closing", "Closing Date", "Business Day":
  ubiquitous defined terms; classify.js's own header notes CONSID
  sections routinely mention "Effective Time".
- Bare "Surviving Corporation"/"surviving corporation": appears across
  consideration, charter, directors and D&O sections in every deal —
  zero family discrimination.
- Bare "certificate of incorporation" and "bylaws": the D&O family's
  own receipts show charter vocabulary in 37/37 COV-DO cards — keying
  them here would flood the D&O queue with STRUCT-CHARTER signals (the
  tax-matters IOC-overlap ruling verbatim); only the long-form
  amend-and-restate phrase and the LLC formation phrase are keyed.
- "waiting period", "HSR Act": COND-REG territory (its lexicon already
  keys them).
- Residual blind spot, named: a closing section drafted without
  "satisfaction or waiver"/"shall take place" contiguously (e.g. only
  the interpolated form) and an offer section drafted without the
  defined terms above are invisible to this lexicon; the v1↔v2
  comparator covers the carded deals and coverage extends by reviewed
  diff when live runs surface variants.

## 6. Acceptance tests (real-fixture-first; the P1 M-5
pre-rerun-harness honesty pins apply VERBATIM — no recorded native runs
exist for this family; every resolver/registry test drives synthetic
compiled candidates pinned to REAL corpus quotes, byte-verified against
committed fixture bytes, clearly labeled as the pre-rerun harness)

0. **Fixture commit:** cards `75209318…`, `337b3421…`, `5acd8a63…`,
   `11f3ef36…`, `9ac9e74c…`, `a149469a…`, `c6254cb5…`, `c1d9d287…`,
   `a3732b8b…`, `0e05a711…`, `82576a71…`, `3a96ea09…`, `84aae11f…`,
   `ecfe2957…`, `b621bd3b…`, `fee7da2b…`, plus the two boundary
   negatives `fe717a8d…` (STRUCT-CLOSING-mislabeled deliveries
   checklist) and `f223776a…` (TERMR-OUTSIDE End-Date increments) —
   committed as LITERAL production bytes under
   `tests/fixtures/canonical-v2/merger-structure-live-run/`, provenance
   headers with deal uuid + provision_card uuid + retrieval date +
   provision_type/subtype (including NULL on `c1d9d287…`/`82576a71…`,
   the STRUCT-MERGER mislabels on `a3732b8b…`/`0e05a711…`, and
   `f223776a…`'s TERMINATION_RIGHT/TERMR-OUTSIDE home — the TERMF m-2
   discipline), NEVER v1 section_ref label strings. Every test quote
   asserted a contiguous substring of committed bytes.
1. **Registry:** next version compiles; prior arrays untouched
   byte-for-byte; five concepts + eight definitions validate with zero
   validator changes; expected-concept-keys AND expected-claim-keys
   superset-diffs written against sorted CONTENT, never the numeral; a
   test asserts the kind→(concept, definition) frozen map's values are
   all registered keys.
2. **Parser, table-driven over the coverage map:** `a149469a…` resolves
   `'2'` (digit-ordinal "(2nd)" form) with clock-time immunity asserted
   on its own bytes; `9ac9e74c…` ABSTAINs `NON_LITERAL_ORDINAL`
   (spelled "third", with "10:00 a.m." immunity on the same bytes);
   `c6254cb5…` ABSTAINs `NO_PERIOD_LITERAL`; the `c1d9d287…` full
   section ABSTAINs `MULTIPLE_PERIOD_LITERALS` and its hand-enumerated
   expiration/extension sub-quotes resolve `'20'` and `'10'`;
   `0e05a711…` sub-quotes resolve `'25'` and `'10'` with money-immunity
   asserted on the "$137.00 per Share" bytes (no candidate token —
   Boundary 1's mechanical half); `a3732b8b…`'s per-extension limb
   resolves `'5'` and its negotiated-duration limb ABSTAINs
   `NO_PERIOD_LITERAL`; a Maryland cap sub-quote ("thirty (30) days")
   ABSTAINs `NON_BUSINESS_DAY_UNIT`; an /anniversary/ fixture ABSTAINs
   `ANNIVERSARY_PHRASE`; the F-2 sentence-comma case pinned.
3. **Resolution (pre-rerun harness, synthetic candidates over committed
   bytes):** `75209318…` resolves MERGER_SURVIVOR = TARGET_SURVIVES; a
   synthetic "merged with and into the Company Merger Sub" quote →
   `STRUCTURE_KIND_UNCORROBORATED` (the lookahead anti-spoof, labeled
   synthetic); `337b3421…` (Nevada double merger) exercises
   `pushOpenWorld` `MERGER_SURVIVOR_OUT_OF_VOCABULARY`; `5acd8a63…` and
   `11f3ef36…` resolve SECTION_251H_GOVERNED with `statute_cite_ref`
   substring-enforced and a corrupted cite →
   `STATUTE_CITE_NOT_IN_QUOTE`; `9ac9e74c…` resolves FORMULA
   (CONDITIONS_SATISFACTION) while its DAY_COUNT assertion queues on
   the parser ABSTAIN; `a149469a…` resolves BOTH closing claims from
   overlapping quotes (the pinned pair — never
   `AMBIGUOUS_STRUCTURE_KIND`), its interpolated anchor matching the
   bounded-gap regex; `c6254cb5…` resolves FORMULA with
   OFFER_CONSUMMATION anchor; a quote carrying both anchors (synthetic,
   labeled) → `AMBIGUOUS_TIMING_ANCHOR`; `fe717a8d…` asserted as ANY
   kind → `STRUCTURE_KIND_UNCORROBORATED` (permanent mislabel
   fixture); `f223776a…` asserted as OFFER_EXTENSION_INCREMENT →
   `STRUCTURE_KIND_UNCORROBORATED` (the Boundary-5 fixture);
   `3a96ea09…` resolves TWO EFFECTIVE_TIME_FILING claims (SDAT articles
   + DSOS certificate), instrument and effective-time-term refs
   substring-enforced with typed failures exercised; `b621bd3b…` and
   `fee7da2b…` each resolve SURVIVING_CHARTER_PROVISION with their
   respective instrument_refs (corporate and LLC vocabulary — the
   hazard-3 spread is the point); out-of-enum assertion_kind exercises
   explicit `pushOpenWorld`; `answer_provenance.gate ===
   'ALLOWED_VALUES_MEMBERSHIP'` asserted on every resolved
   presence/enum claim; materiality rank 88 asserted BOTH on a resolved
   claim AND on a `'STRUCT-CLOSING-PENDING'` review item; additivity
   re-pin with the documented field-level diff.
4. **Cross-family boundary pins (each named for its boundary):** (b-1)
   grep-test zero consideration vocabulary ("per Share", "Exchange
   Ratio", "CVR", "Exchange Fund", "surrender") in this slice's prompt,
   corroboration tables and lexicon; the `0e05a711…` money-immunity
   parser case stands as the mechanical half; a
   CONSID_MECHANICS_TITLE_PATTERN title ("Exchange of Certificates",
   "No Dividends or Distributions") declines classification — asserted
   against the ported shared constant; (b-2) "Conditions to the Offer"
   annex title declines; a CONDITIONS article_context fixture declines
   all rules; a bare annex-ref title ("ANNEX-COND(i)") classifies
   UNKNOWN → typed undispatched record (the flagged hole, measured
   never silent); (b-3) grep-test zero /indemnif|exculpat/ in this
   slice's modules; a D&O-titled heading ("Indemnification of Officers
   and Directors") does not classify MERGER_STRUCTURE; (b-4) the
   "Approval of Merger" title does NOT classify at stage 1 (the named
   stage-2-only exception, asserted by name); (b-5) the `f223776a…`
   resolver fixture from test 3.
5. **Identity:** the two closing claims over one overlapping sentence
   mint distinct, stable, non-deduping identities; the `3a96ea09…`
   dual-filing claims never collide; two synthetic same-section
   effective times with different `effective_time_term_ref` values
   ("Company Merger Effective Time" / "OpCo Merger Effective Time")
   never dedupe; charter + bylaws instrument claims stay distinct;
   re-run is byte-stable.
6. **Lexicon:** table validation (keys registered — the five new
   concepts; explicit `\b` on case-sensitive regexes; static max ≤ 128;
   rationale per pattern; content hash re-pinned; version bump);
   anti-noise regression paragraph extended with a conditions-chapeau
   sentence (asserting "satisfaction or waiver" hits there are
   EXPECTED unmatched signals, deletion-proofed), a rep-article
   organizational-documents sentence (bare charter vocabulary asserted
   ZERO hits — it never entered the table), and a no-shop "tender
   offer" sentence (zero hits — bare phrase excluded); one EXPECTED
   unmatched-signal pinned for /\b251\(h\)/ against a committed
   non-STRUCT home in deal `555579a6…` (receipt G;
   deletion-proofed); each surviving pattern hits its own grounding
   quote in committed fixtures; determinism permutation tests green
   under the grown table.
7. Full suite + `npm run build` + forbidden-patterns (fixtures inside
   the exempt directory class; zero new exemption entries — any
   collision is fixed by restructuring the offending file, never by
   widening FILE_PATTERN_EXEMPTIONS); phase allowlist for the slice's
   files; recorded capitalisation, termination-fee AND no-shop fixtures
   replay byte-identically through the registry with the
   MERGER_STRUCTURE entry present; unknown family → no prompt, typed
   record; classifier fixtures per §3; the all-titles corpus validation
   (including the positive recall pin) runs as a review-time script
   (live Supabase; never stubbed into `npm test`).

## Out of scope

- STRUCT-DIRECTORS, STRUCT-EFFECTS, STRUCT-ACTIONS promotion (real
  populations, follow-on slice with its own grounding pass).
- Offer-commencement-deadline, effective-time filing-cap,
  closing-location, Top-Up Option, short-form/90% mechanics,
  subsequent-offering-period, guaranteed-delivery mechanics,
  Schedule TO/14D-9 filing covenants and stockholder-list covenants
  (`82576a71…` recorded as the candidate grounding card),
  buyer-board-designation — all open world / deferred, each with the
  section-1 or receipt-cited reason; several FLAGGED FOR BEN as
  family-brief deviations.
- `dealStructure` derivation (serving-layer work over this family's
  claims — never a producer assertion).
- ADS fields and SCHEME/ASSET enum values (no grounding population —
  grounding correction 4).
- Every consideration-adjacent fact (Boundary 1), every condition
  (Boundary 2), charter indemnification content (Boundary 3),
  shareholder-approval machinery (Boundary 4), End-Date extensions
  (Boundary 5).
- A spelled-ordinal→digit lookup table (flagged Ben decision — a named
  deviation from the P1 discipline, not implemented here).
- The 68 null-subtype rows and `[PROPOSED]`/`Unclassified` backlog
  (ingest-QA flags + open-world commonality report, never absorbed).
- `FAMILY_MAPPING_TABLE` extension for v1↔v2 subtype mapping (separate
  Fable+Ben table edit — the STRUCT-OFFER zero-population gap makes
  this table Ben-reviewed, never implementer-inferred).
- Live re-extraction runs (dated handoffs; until they land, no report
  may claim native merger-structure extraction — M-5); any M3
  amendment; any scope-closure/ABSENT work; cross-deal
  canonicalization of any verbatim phrase.

## Known costs, stated up front

- **The closing day count abstains on the market norm.** 17/34
  STRUCT-CLOSING cards draft spelled ordinals (receipt A) and queue
  `NON_LITERAL_ORDINAL` by design; only ~7–9 resolve a number. The
  formula presence claim carries the family meanwhile; the remedy is
  the flagged ordinal-lookup Ben decision, never a silent parser
  widening.
- **STRUCT-OFFER rests on 2–4 deals of in-family mechanics** (receipts
  D/E) — this wave's second-smallest grounding set after DIVD-SPECIAL,
  flagged in section 1. Variant offer drafting queues on typed reasons;
  coverage extends by reviewed diff; Ben may defer the concept
  entirely.
- **The annex title hole is inherited, not fixed** (pack §8 item 1):
  offer-condition annexes and bare annex refs classify UNKNOWN → typed
  undispatched records. Two-step deals are under-covered at stage 1;
  live-run handoffs measure the rate.
- **Compound structural articles are the norm** — "The Merger" sections
  routinely carry survivor + 251(h) + effective-time language in one
  clause run (receipt G's §2.04 shape); until producers split reliably,
  `AMBIGUOUS_STRUCTURE_KIND` review volume will be material. The
  full-table check is the only compound defense — never loosened;
  two-strike escalation applies to prompt iteration.
- **The 251(h) and offer defined-term lexicon patterns fire
  deal-locally** across REP/COND/DEF homes in tender deals (receipt G)
  — a handful of one-second confirmations in exactly the deals where
  the veto matters most; deletion asymmetry applies.
- **The stage-2-only "Approval of Merger" exception** (Boundary 4)
  costs a queue path for one grounded 251(h) card; the alternative — a
  title rule colliding with v1's parent-adoption stamp — risks
  misrouting a whole covenant family, and the queue item is the cheaper
  error.
- **No auto-pass exists for this family for now:** v1's STRUCT fields
  are free text or unpopulated (grounding correction 2), so the M3
  v1/v2-agreement leg cannot be satisfied and every resolved claim is
  Ben-reviewed until v2 history accumulates — stated so nobody reads
  "resolves" as "publishes unreviewed".
