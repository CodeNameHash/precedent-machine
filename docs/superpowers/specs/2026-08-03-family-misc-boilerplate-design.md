# Family — MISC boilerplate (ADMIN-*): governing law, forum, assignment, amendment, notices, entire agreement, no-3PB, severability, counterparts

**Date:** 2026-08-03. **Status:** AUDIT-AMENDED — 1 CRITICAL, 5 MATERIAL,
4 MINOR findings applied (0 parked for Fable); per program convention
(spec-detail → audit → build → review), next step is re-audit of C1's
rewritten bullet and the corrected receipts.
**Parent:** `2026-08-02-openworld-promotion-program.md` (five-layer promotion
structure and cross-slice invariants apply verbatim).
**Template:** `2026-08-02-p1-captable-numerics-design.md` (slice shape,
typed-abstain discipline, corroboration tables, coverage-map honesty pins).
**Wave exemplars bound:**
`2026-08-02-family-termination-fee-design.md` and the BUILT registry seam at
head (`producer-prompt-registry.js` carries CAPITALISATION, TERMINATION_FEE
and NO_SHOP entries — this slice adds ONE entry to the existing frozen Map in
its own reviewed diff; it never builds or re-designs the seam);
`2026-08-02-family-specific-performance-remedies-design.md` — **this family's
binding neighbour**: REM-JURY owns jury-trial waivers, REM-SP owns specific
performance, REM-NONRECOURSE owns no-recourse shields, all three cited here
and NEVER claimed (its boundary 6 reciprocally scoped "Governing law /
jurisdiction / forum / notices and the rest of the MISC block" to this
family), and its REM-CAP dispatch-vacuity ruling is applied twice below (the
notices-timing ruling in section 1 and the combined-heading collision flag in
Cross-family boundary 1);
`2026-08-02-family-closing-conditions-design.md` (presence-claim shape; "no
parser is a ruled decision"; pinned co-resolution pairs; M3-rule-1 ruling
that modifiers stay inside the quote as evidence);
`2026-08-03-family-dno-indemnification-design.md` (its boundary 3 assigned
"the MISC-side exception list" of the no-3PB provision to "a future MISC
family" — this is that family; heading-grounded classifier rules curing
stage-1 vacuity);
`2026-08-03-family-dividends-design.md` (small-family honesty; the
day-count/multi-literal vacuity device reused for notices timing);
`2026-08-02-family-financing-covenants-design.md` (the
`runStage1(title, article_context)` classifier signature, adopted with the
same build-order pin as the dividends and tax-matters specs: whichever
sibling slice lands first builds the signature extension per that spec's §3
and bumps `SECTION_FAMILY_CLASSIFIER_VERSION`; later slices add rules only).
**Protocol authority:** docs/codex-program/EXECUTION-LEDGER.md — M3 review
protocol + extraction semantics rules 1–3. This spec may not amend them.
**Lexicon authority:** `2026-08-02-lexical-disagreement-net-design.md` (word
boundaries, case-sensitive defined terms, deletion asymmetry, priced blind
spots; static max ≤ 128; explicit `\b` on every case-sensitive defined-term
regex; lexicon version re-checked at head at build time — sibling slices are
also bumping it, so this spec binds to "head version + 1 at this slice's
merge", content-diffed, never the numeral).
**Materiality:** the existing `MATERIALITY_TABLE`
(`lib/canonical-v2/native-producer/candidate-resolution.js:672`) already carries
`{ rank: 90, label: 'NOTICES_ADMINISTRATIVE', concept_key_prefixes:
['NOTICE-', 'ADMIN-'] }` — the ledger's own "notices and administrative
clauses" tier, currently matching NOTHING because no `NOTICE-`/`ADMIN-`
concept exists. This family's concepts adopt the `ADMIN-` prefix and inherit
rank 90 with ZERO materiality-table changes — the wave's only family that
adds no tier and creates no rank collision. One question FLAGGED FOR BEN in
section 4: whether governing law / forum selection deserve a better rank
than 90 (a Ben ordering call; this spec deliberately does not invent a
tier to pre-empt it).

## Corpus grounding — population honesty first

**This is the wave's widest, shallowest family: nine concepts, ten claim
definitions, ONE small parser, over 253 family-owned cards across up to 36
of the corpus's 40 deals.** Per the family brief, the value is breadth of
presence coverage — every concept below is a presence claim except the
governing-law state, which is the family's one enum. Nothing here is
low-N in the DIVD-SPECIAL sense; the honesty risk in this family is the
opposite one — near-universal presence claims carry little information per
claim, and the spec prices that squarely in Known costs rather than
dressing breadth up as depth.

Evidence pack read 2026-08-03 (pack quotes are ground truth, cited by
provision_card id); seven supplementary SELECT-only queries run 2026-08-03
by this spec's author against production Supabase (project
`tzulhdasmioeechxapdy`, `provision_cards`), receipts inline below.

v1 populations (pack §1, `provision_type='MISC_BOILERPLATE'` — NOT `MISC`;
rubric.js's `type:'MISC'` key maps to it, the remedies spec's grounding
correction restated):

| v1 subtype | cards | deals | claimed by |
|---|---|---|---|
| MISC-GOVLAW | 38 labeled / **32 true** (see Grounding correction 1) | 32 | this family |
| MISC-NOTICES | 36 | 36 | this family |
| MISC-SEVER | 35 | 35 | this family |
| MISC-COUNTER | 34 | 34 | this family |
| MISC-AMEND | 33 labeled / 32 true | 32 | this family |
| MISC-ASSIGN | 32 | 32 | this family |
| MISC-ENTIRE | 31 | 31 | this family |
| MISC-THIRDPARTY | 17 | 17 | this family (no-3PB only; D&O carve-outs cited; 3 cards are REM-NONRECOURSE-owned non-recourse/financing-source-waiver content flagged to ingest-QA as subtype pollution, see Grounding correction 7) |
| MISC-JURISD | 16 | 16 | this family (forum; SP-titled sections cede to REMEDIES) |
| MISC-JURY | 22 | 22 | **REM-JURY — remedies family. NOT claimed.** |
| MISC-SPECIFIC | 29 | — | **REM-SP — remedies family. NOT claimed.** |
| MISC-SURVIVAL / MISC-WAIVER / MISC-CONSTRUCT / MISC-EXPENSES | 35/17/50/26 | — | out of scope (below) |

**Query receipts (SELECT-only, `provision_cards`, run 2026-08-03 by this
spec's author):**

1. **Governing-law state distribution** (true MISC-GOVLAW rows,
   `provision_type='MISC_BOILERPLATE'`, N=32): state-name mentions —
   Delaware 30, New York 8, Maryland 3, Texas 1, Virginia 1, Nevada 1;
   zero hits for PA/CA/MA/WA/GA/OH/IN/MN/NJ. Distinct-state count per
   card: **22 cards mention exactly one state, 8 mention two, 2 mention
   three.** Of the 22 single-state cards: 21 Delaware, 1 Maryland, 0 New
   York — every New York mention lives in a MULTI-state card (financing-
   source carve-out provisos, e.g. card `c74e1ed8-3fc0-4208-a5c1-720ebffcb591`,
   deal `86a01770…`, §9.9: "…governed by the internal laws of the State of
   Delaware … provided, that, notwithstanding[…]" leading into a New York
   financing-claims proviso), and every mandatory-entity-law carve-out is
   multi-state by construction (card `16ede881-faac-4f61-a9ac-f942d38909a9`,
   deal `c7c16365…` Kraft, §9.08: "EXCEPT TO THE EXTENT THE LAWS OF THE
   COMMONWEALTH OF VIRGINIA ARE MANDATORILY APPLICABLE TO THE MERGER, THIS
   AGREEMENT SHALL BE GOVERNED BY … THE LAWS OF THE STATE OF DELAWARE";
   pack §4's `8192e746-4eba-430b-ab41-54c24f205f96` Maryland/Delaware twin,
   deal `c750afb9…`, §8.7). Sole solo-Maryland card:
   `faecd2b6-1879-4f98-9429-1e64b5cf99d4`. Card
   `79ded2c4-b0f0-4ebd-8f90-6f03a78ecef6` (deal `f9c61065…`, §10.5, the
   all-caps Maryland-governed deal) is NOT the solo-Maryland card — it
   mentions both Maryland and New York at full-card scope, its New York
   mention sitting in the (b) financing-suit limb, making it
   2-distinct-state at full-card scope but 1-state at the
   governing-law-sentence scope the producer quotes.
   `mandatorily applicable` fires on exactly 2 of 32 cards.
2. **Operative-phrase anchors, per subtype (true `MISC_BOILERPLATE` rows
   only):** GOVLAW `governed by` 32/32, `/governed by,? and
   (construed|interpreted)/i` 26/32; ASSIGN `prior written consent` 23/32,
   `/not (be )?assign/i` 4/32, `/successors and (permitted )?assigns/i`
   27/32; AMEND `/in writing|written (agreement|instrument)/i` **32/32**,
   `/signed|executed/i` 29/32; ENTIRE `/constitutes? the entire
   agreement/i` 29/31; SEVER `/invalid|unenforceab/i` **35/35**; COUNTER
   `/counterparts/i` **34/34**; THIRDPARTY `/third.party beneficiar/i`
   17/20, `/except|other than/i` 18/20; NOTICES `/notice/i` 36/36;
   `Court of Chancery` 23 cards within MISC-GOVLAW+MISC-JURISD, and
   appears in MISC_BOILERPLATE cards across **31 of 40 deals**.
3. **The combined-heading collision, sized against the literal shared
   constant `REMEDIES_COMBINED_TITLE_PATTERN =
   /waiver\s+of\s+jury|specific\s+(performance|enforcement)/i` (real
   in-document headings = first 120 chars of `primary_quote`; the DB
   `section_ref` label strips compound titles — `section_ref ILIKE
   '%jury%'` hits ZERO GOVLAW rows while the quote-leading headings hit
   11):** MISC-GOVLAW N=32 — heading contains "jury" 11, "specific
   performance|enforcement" 4, "venue|jurisdiction|forum" 10, matches the
   literal constant **10/32**; MISC-JURISD N=16 — jury 1, SP/enforcement
   1, literal-constant match **1/16**. The GOVLAW delta card is
   `7ec3c96d-5ced-4793-9e0c-b3a3a5092b16` ("Governing Law; Submission to
   Jurisdiction; Selection of Forum; Waiver of Trial by Jury") — its
   word-order variant "Waiver of Trial by Jury" matches neither this
   spec's constant nor remedies' `/waiver\s+of\s+jury/i`, so it dispatches
   HERE via `/\bgoverning law\b/` carrying jury content neither family's
   rules can claim (open-world); the JURISD delta card is the C1
   "Enforcement; Jurisdiction" heading. Grounded ceded-heading exemplars:
   "SECTION 8.7 GOVERNING LAW; WAIVER OF JURY TRIAL" (`8192e746…`),
   "10.5. GOVERNING LAW; VENUE; WAIVER OF JURY TRIAL; SPECIFIC
   PERFORMANCE" (`79ded2c4…`), "9.5. Governing Law and Venue; Waiver of
   Jury Trial; Specific Performance"
   (`bd63b718-11ac-451c-93fd-78782bcea772`, deal `2c143f44…`),
   "Section 9.7 Governing Law; Venue; Waiver of Jury Trial"
   (`b6eec9e1-bac7-4dea-a1d0-c28b1eb955c9`, deal `6369cc9c…`). This is
   Cross-family boundary 1's collision surface, flagged for Ben.
4. **No-3PB carve-out drafting (MISC-THIRDPARTY):** card
   `277f2a58-b8d9-4fa3-b7c1-39c17817fcc5` (deal `448e524f…`, §9.8): "No
   Third Party Beneficiaries. Except as provided in Section 6.9
   (Indemnification; Directors' and Officers' Insurance) only, … this
   Agreement is not intended to, and does not, confer upon any Pers[on]…";
   card `34e84436-c1a1-44fc-b61b-d98c434bf4f5` (deal `ce061fd0…`, §9.6):
   "Except as set forth in Section 6.9 and this Section 9.6…"; card
   `09dfcd6c-9a43-4297-8a6a-9a837a904e8a` (deal `eee4f270…`, §9.6):
   "…nothing in this Agreement, express or implied, is intended to confer
   upon any other Person any rights or remedies of any nature whatsoever …
   except (a) as set forth in … Section 6.8, (b)…"; card
   `37268e02-8db6-4a49-bc08-15f8b388950d` (deal `6369cc9c…`, §9.5) is the
   compound "Entire Understanding: No Third-Party Beneficiaries" heading —
   integration and no-3PB under one section id (pack warning 2's class).
   The D&O carve-out is a SECTION CROSS-REFERENCE in every receipt, not a
   restated indemnification right — Cross-family boundary 2.
5. **Assignment / amendment drafting:** card
   `ab3f7289-413d-44a0-b057-8585dc6cb335` (deal `a267309a…`, §9.9):
   "Neither this Agreement nor any of the rights, interests or obligations
   hereunder shall be assigned by any of the Parties (whether by operation
   of Law or otherwise) without the prior written consent of the other
   Party."; card `3d973b67-5de4-41cf-97a3-64db26de5bac` (deal `cf32899a…`,
   §9.9) adds "Any attempted assignment in violation of this Section 9.9
   shall be void, exce[pt]…" — void-plus-exceptions drafting. Amendment:
   card `0c05c8b4-b7da-41c2-97ff-5db9cedfc46e` (deal `ce061fd0…`, §8.4):
   "may be amended by the Parties at any time by execution of an
   instrument in writing signed on behalf of each of the Buyer Parties and
   the Company"; card `668c4779-523b-4cb3-92d7-a1844c671b40` (deal
   `bb5f062d…`, §9.01): the board-approval variant with the post-vote
   statutory limitation ("after the Required Company Stockholder Vote
   shall have been obtained, no such amendment shall be made that pursuant
   to applicable Law requires fu[rther approval]…").
6. **Notices timing multiplicity (the vacuity check, run BEFORE proposing
   any timing claim):** of 36 MISC-NOTICES cards, **19 contain "business
   day" two or more times, 12 contain a clock-time literal
   (`5:00 p.m.`-class), 20 contain one or the other** — and the pack's §7
   quotes show the sub-day mechanics are conditional cascades (four-branch
   delivery rules; the `af4940e1…` five-Business-Day address-change
   override layered on the primary rule). Under the inherited TERMF M-4
   precedence (multiplicity first, any unit), the majority of grounded
   quotes ABSTAIN `MULTIPLE_PERIOD_LITERALS`/`MULTIPLE_TIME_LITERALS` at
   birth — a notices-timing numeric claim is REM-CAP-class vacuity and
   does not ship (section 1 ruling).
7. **Forum cascade fixtures:** card
   `5c4c705f-9d53-48c1-86ba-e553200659ca` (deal
   `dc042001-b987-404f-bd02-41e1939fb914`, §10.8 "Jurisdiction; Venue" —
   the pack §7 3-tier nested fallback: "…may only be brought in the Court
   of Chancery of the State of Delaware (or, only if such court declines
   to accept jurisdiction over a particular matter, then in the United
   States District Court for the District of Delaware or, if jurisdiction
   is not then available … then in any court sitting of the State of
   Delaware in New Castle County)"); card
   `113809b4-4340-4be9-b793-4b2cf64e534c` (deal `ce061fd0…`, §9.10
   "Jurisdiction; Venue", same declines-to-accept cascade shape). The
   `af4940e1…` "Chosen Courts" defined-term variant (pack §7) is the third
   grounded cascade shape.

Clean single-concept fixture anchors (receipted above or fetched this
pass): solo-Delaware GOVLAW `c44d44c2-c435-4ee1-ba56-a2cb31e2cbdf` (deal
`ce061fd0…`, §9.9) and `d6f8861a-3c6f-40c8-9e41-370c19c69e5e` (deal
`eee4f270…`, §9.9); severability `d8f4334a-c8c9-48fa-ace7-e1adb669a50c`
(deal `ce061fd0…`, §9.7); counterparts
`a23462d7-de8a-4dd7-899b-fa868d11a31f` (deal `ce061fd0…`, §9.13); the
Abry-embedded entire-agreement card
`a6a33c14-3188-4d80-933c-b9464eb924a6` (deal `0a043659…`, §10.05 — pack
§5's quoted disclaimer); the assignment/no-3PB compound
`121f1ee7-8874-4689-b734-60617c290681` (deal `df393645…`, §9.3 "No
Assignment or Benefit to Third Parties", with the named-person carve-out
"Lewis shall be a third party beneficiary of Section 5.19" — pack
warning 5); notices `63d5ceb0-bd19-429d-a721-405da908bf4c` (deal
`0d38cc1f…`, §9.4) and `52426964-274c-4d57-a0ff-0bd25fa737bf` (deal
`1f80bec7…`, §11.1 — the two redaction conventions, pack §7).

## Grounding corrections (verified against repo + production DB, 2026-08-03)

1. **The MISC-GOVLAW and MISC-AMEND populations are polluted by
   DEFINITION-typed rows (pack §3):** 7 cards carry those subtypes with
   `provision_type='DEFINITION'` — six "Applicable Law" defined-term
   entries and one "Amendment" cross-reference stub. Every count, fixture
   and comparator surface in this spec gates on
   `provision_type='MISC_BOILERPLATE'` (38→32 GOVLAW, 33→32 AMEND).
   FLAGGED to ingest-QA, never absorbed: any consumer keying on
   `provision_subtype` alone will ingest the "Applicable Law" definiendum
   as a choice-of-law clause. The classifier-side half of the defense is
   the DEFINITIONS article_context decline (section 3).
2. **The family brief's code `MISC-NOTICE` does not exist** — the rubric
   and DB code is `MISC-NOTICES` (plural, rubric.js:2386; zero rows under
   the singular — pack §2). All references herein use the real code.
3. **v1 DOES carry field-level extraction for parts of this family** —
   unlike dividends/remedies: `FEATURES.MISC` (rubric.js 4523–4632)
   registers `governingLaw` (tagged), `jurisdictionExclusive` (boolean),
   `forumCourts` (list), `forumFallback` (text), plus assignment/amendment
   free-text fields. The v1↔v2 comparator therefore has a REAL field-level
   surface for GOVLAW and forum exclusivity — rare in this wave and stated
   so the comparator work is scoped honestly: v1's `governingLaw` tagged
   value is comparable to `GOVERNING_LAW_STATE` once both exist; the
   free-text fields are not comparable and are not promoted.
4. **rubric.js data-integrity defect, flagged not fixed (pack §6):**
   `MISC-EXPENSES` is defined twice in CODES (lines 2442 and 2490); the
   second literal silently overwrites the first. Already flagged by the
   remedies spec's grounding correction 3; restated here because
   MISC-EXPENSES is this family's nearest out-of-scope neighbour. A v1
   hygiene item for ingest-QA; this slice neither depends on nor repairs
   it.
5. **No registered v2 vocabulary exists for this family.** Verified: no
   `ADMIN-`, `NOTICE-`, or boilerplate-shaped concept key anywhere in
   `lib/canonical-v2/`. All nine concepts below are new and FLAGGED FOR
   BEN (the 2026-07-23 convention: this spec proposes, Ben settles).
6. **Bundle version numbering:** binds to "the next frozen version at this
   slice's merge"; every superset-diff acceptance test is written against
   CONTENT (sorted key sets), never the numeral.
7. **The MISC-THIRDPARTY v1 population (N=20) is polluted by three
   REM-NONRECOURSE-owned cards:** `2a2e1d40…` ("9.15 Non-Recourse"),
   `23a300a4…` ("Section 9.15 No Recourse"), `bd0fcca5…` ("7.16 Waiver of
   Claims Against Financing Sources") are non-recourse / financing-source
   waiver provisions, not no-3PB variants — remedies-family territory
   (boundaries 1/5), and the remedies spec's own non-recourse grounding
   is null-subtyped. True no-3PB population is **17 cards / 17 deals**.
   FLAGGED to ingest-QA as subtype pollution (same treatment as
   Grounding correction 1's DEFINITION rows); this family's ADMIN-TPB
   population, corroboration table and comparator figure all gate on the
   true 17/17.

## Cross-family boundaries (BINDING; duplication is an automatic audit
CRITICAL; each pin has a named acceptance test in section 6)

1. **REM-JURY / REM-SP — remedies family. Jury-trial waivers and specific
   performance are NEVER claimed here, in any section, under any heading —
   AND the combined-heading dispatch collision is FLAGGED FOR BEN, not
   resolved unilaterally.** The remedies spec registered `REM-JURY`
   (22/22 MISC-JURY cards, its query receipt 1) and `REM-SP`, and its
   stage-1 rules claim `/waiver\s+of\s+jury/i` and
   `/specific\s+(performance|enforcement)/i` titles. Receipt 3 sizes the
   overlap against the literal shared constant: **10/32 GOVLAW and 1/16
   JURISD sections carry a remedies stage-1 token in their REAL
   in-document heading** ("GOVERNING LAW;
   WAIVER OF JURY TRIAL" et al. — pack §4's 55% quote-level co-drafting,
   heading-level 13/48). Because dispatch is single-family and
   first-match-wins, whichever family's rule runs first takes the whole
   combined section, and the other family's content in it becomes
   typed under-coverage (open-world via PRESERVE-THE-NOVEL, or an
   undispatched miss). Neither the remedies spec (folded) nor this one may
   edit the other's classifier rules — that is a cross-family boundary
   renegotiation, i.e. a Ben call (the REM-CAP fold ruling's own logic).
   **This slice's mechanical position, pending Ben:** this family's title
   rules carry an explicit exclusion — any title matching the shared
   constant `REMEDIES_COMBINED_TITLE_PATTERN =
   /waiver\s+of\s+jury|specific\s+(performance|enforcement)/i` DECLINES
   every rule in this slice, so combined sections dispatch to REMEDIES
   under its own folded rules and no title is ever contested at runtime.
   Consequence, priced in Known costs: the governing-law state for 10 of
   32 GOVLAW sections (and the forum content of 1/16 JURISD sections,
   including `79ded2c4…`'s Maryland deal) is unreachable to this producer
   until Ben rules. The GOVLAW delta card `7ec3c96d-5ced-4793-9e0c-
   b3a3a5092b16` ("Governing Law; Submission to Jurisdiction; Selection
   of Forum; Waiver of Trial by Jury") is committed as a fifth boundary
   fixture pinned DISPATCH-HERE (test 4): it matches neither this
   constant nor remedies' `/waiver\s+of\s+jury/i`, so it dispatches to
   this family via `/\bgoverning law\b/` and its jury content is
   producer open-world, never claimed. Its "Waiver of Trial by Jury"
   word-order variant is added to the Ben collision flag as a candidate
   joint widening (`/waiver of (trial by )?jury|trial by jury/i`), a Ben
   call since it touches remedies' rules. Options put to Ben: (a) keep
   this cession and accept
   the GOVLAW coverage hole (remedies' jury claim resolves; governing-law
   content of those sections surfaces only as remedies-producer open-world
   candidates); (b) invert it — combined governing-law-led headings
   dispatch here, remedies' rules gain the mirror exclusion, and REM-JURY
   accepts the coverage hole on combined sections (larger: jury waivers
   co-draft into GOVLAW sections in 21/38 quotes, pack §4); (c) a
   multi-family dispatch seam amendment (the only complete fix; a program-
   level change neither slice may build). Whatever Ben rules, the
   no-double-claim invariant is enforced three-deep here: no jury/SP
   assertion kind exists in this family's response shape, the prompt names
   jury waivers and specific performance as NOT this family's assertions,
   and no corroboration pattern in section 4 matches jury/SP vocabulary.
   Test 4 pins all three. Related collision surface, also FLAGGED FOR BEN
   (not the same dispatch question — this one is not a decline): the
   "Enforcement; Jurisdiction" heading matches neither
   `REMEDIES_COMBINED_TITLE_PATTERN` nor remedies' own stage-1 title
   token, so it dispatches HERE via `/\bjurisdiction\b/` carrying SP-led
   content that this family's rules cannot claim; that content is
   producer open-world under the NOT-this-family list (section 3).
2. **D&O family — DNO-BENEF owns covered-person third-party-beneficiary
   rights; this family owns the agreement-wide no-3PB provision.** The
   D&O spec's boundary 3 ruled: `COVERED_PERSON_TPB_RIGHTS` grounds ONLY
   on D&O-section-internal TPB sentences, "the MISC-side exception list
   stays with a future MISC family", and its test 4 pins that a
   "Third-Party Beneficiaries"-titled section declines DNO dispatch. This
   spec closes the loop: `NO_THIRD_PARTY_BENEFICIARIES` grounds on the
   MISC-section quote (receipt 4), and the D&O carve-outs inside it
   ("Except as provided in Section 6.9 (Indemnification; Directors' and
   Officers' Insurance)") stay INSIDE the quote as reviewer evidence —
   never re-minted as a D&O claim, never enumerated into a beneficiary
   list (the rubric's `thirdPartyBeneficiaryExceptions` list field is NOT
   promoted; carve-out enumeration on this drafting is section-reference
   resolution, a cross-reference problem this slice does not own). The
   `121f1ee7…` named-person carve-out ("Lewis shall be a third party
   beneficiary of Section 5.19") is the same ruling from the other
   direction: quote evidence, or open world. Test 4.
3. **TERMF — fees/expenses.** `TERMF_TITLE_PATTERN` (the shared classifier
   constant at head) already claims fee/expense-reimbursement/
   effect-of-termination/sole-remedy titles FIRST; MISC-EXPENSES sections
   ("Fees and Expenses", 26 cards) are TERMF-adjacent territory and NO
   rule in this slice matches expense titles. The rubric's
   `feeExpenseAllocation` MISC field is not promoted. Test 4.
4. **Reps family (future) — Abry / anti-reliance embedded in Entire
   Agreement sections.** Pack §5: 6/31 MISC-ENTIRE cards carry
   no-other-reps/non-reliance disclaimers inline (`a6a33c14…` §10.05; the
   `c750afb9…` §8.6(b) "No Additional Representations" sub-clause), and
   rubric registers the Abry field family (`noOtherRepsPresent`,
   `nonRelianceClause`, `fraudCarveout`, …) on the generic MISC schema.
   The remedies spec's boundary 6 already ruled these fields stay with
   "the reps family's future slices"; adopted verbatim. This family's
   `ENTIRE_AGREEMENT_INTEGRATION` claim grounds on the integration
   sentence only; anti-reliance limbs are open-world candidates (typed,
   preserved), never a claim here, and no Abry vocabulary appears in this
   slice's corroboration tables or lexicon. Test 4.
5. **Financing-covenants family — financing-source law/forum carve-outs.**
   Every New York mention in the GOVLAW population rides a
   financing-source proviso (receipt 1); the `79ded2c4…` (b)-limb is a
   financing-suit forum carve-out. Those provisos stay inside quotes; the
   governing-law parser's multi-state ABSTAIN routes every such card to
   review by construction (section 2); no `Debt Financing`/`Financing
   Sources` vocabulary is patterned or lexiconed here. Non-recourse
   financing-source shields are REM-NONRECOURSE (remedies receipt 2),
   cited never claimed. Test 4.
6. **Adjacent MISC codes, out of scope by ruling:** MISC-SURVIVAL
   (nonsurvival of reps — reps-family adjacency, and the rubric's
   `repsSurvival*` fields stay unpromoted), MISC-CONSTRUCT (interpretive
   rules — no market-statistic value identified; open world),
   MISC-WAIVER (17 cards — the family brief says "amendment/waiver
   formalities" but the evidence pack's grounding list excludes
   MISC-WAIVER; waiver-formality text that lives INSIDE MISC-AMEND
   sections stays in the AMEND quote; a standalone waiver-mechanics
   concept is a FLAGGED family-brief deviation for Ben, extendable by its
   own receipted diff), MISC-SPECIFIC and MISC-JURY (boundary 1),
   MISC-EXPENSES (boundary 3).

## Deliverable (honest conversion semantics)

Governed, resolvable claims for: (a) the governing-law state as a parsed
enum claim; (b) forum selection as a presence claim with a verbatim
primary-forum attribute, plus forum exclusivity as a second, pinned
co-resolvable presence claim; (c)–(i) seven presence claims: assignment
consent restriction, amendment written-instrument formality, notices
provision, entire-agreement integration, no-third-party-beneficiaries,
severability, counterparts.

**No recorded native runs exist over Miscellaneous-article sections** —
there are no open-world fixture rows to convert and no closure_ids to
track. The deliverable is the five-layer capability plus a pre-rerun
harness: a COVERAGE MAP over committed corpus-quote fixtures (the cards
named in test 0), committed as LITERAL production bytes with provenance
headers (deal uuid, provision_card uuid, retrieval date,
provision_type/subtype — including the DEFINITION-typed pollution
exemplar's true home), each hand-enumerated with its expected outcome. The
P1 audit M-5 honesty pins apply verbatim: "the pipeline natively extracts
boilerplate provisions" may be claimed ONLY after dated post-merge
live-run handoffs; until then the honest claim is "the machinery exists
and is proven on committed fixtures".

**Fixture placement is load-bearing:** all committed fixtures live under
`tests/fixtures/canonical-v2/misc-boilerplate-live-run/` (the
forbidden-patterns PROSE_CLASS_FINGERPRINTS-exempt directory class).
Checked against `scripts/lint/forbidden-patterns.sh` globalPatterns: this
family's vocabulary ("governed by", "Court of Chancery", "prior written
consent", "counterparts", "third party beneficiaries", "entire
agreement") collides with no global or scoped fingerprint; no new
exemption entries are needed. Per the IOC lint pin, fixture headers carry
deal uuid + provision_card uuid + retrieval date ONLY — never v1
`section_ref` label strings (doubly load-bearing here: receipt 3 proves
the DB section_ref labels ERASE the compound headings this spec's
classifier reasoning depends on). **Notices fixtures carry PII-shaped
content** (named attorneys, addresses, partially redacted emails in two
conventions — `[***]` and `**********`, pack §7): committed verbatim as
recorded SEC-filing text (public-filing provenance), but NO test, module
or claim ever extracts, normalizes or asserts an address/email value —
the rubric's `noticesAddress` verbatim-block field is deliberately NOT
promoted.

## 1. Registry (`contract-bundle.js` → next frozen version)

Strictly additive spread of the head version at build time. **Nine new
concepts, all FLAGGED FOR BEN in the PR body**, `{concept_key, version}`
shape only. The `ADMIN-` prefix is chosen deliberately: it is the
materiality table's own existing (empty) prefix for this exact content
class (rank 90 `NOTICES_ADMINISTRATIVE`), and the v1 `MISC-` prefix is NOT
reproduced (the remedies precedent: "MISC" is a v1 filing bucket, not a
legal family; and reproducing it would collide with the v1 codes this
family deliberately does not claim — MISC-JURY, MISC-SPECIFIC).

- `ADMIN-GOVLAW` — choice of governing law. 32 true cards / 32-deal reach.
- `ADMIN-FORUM` — forum selection / submission to jurisdiction (the
  MISC-JURISD population plus forum limbs of GOVLAW sections; Chancery
  drafting in 31/40 deals, receipt 2).
- `ADMIN-ASSIGN` — assignment consent restriction. 32 cards / 32 deals.
- `ADMIN-AMEND` — amendment formalities. 32 true cards / 32 deals.
- `ADMIN-NOTICES` — notices provision. 36/36.
- `ADMIN-ENTIRE` — entire-agreement integration. 31/31.
- `ADMIN-TPB` — no-third-party-beneficiaries. 17/17.
- `ADMIN-SEVER` — severability. 35/35.
- `ADMIN-COUNTER` — counterparts/electronic execution. 34/34.

NOT added (each a legal ruling, not an omission):

- **A jury-waiver or specific-performance concept** — boundary 1. REM-JURY
  and REM-SP exist; double-claiming is the named automatic CRITICAL.
- **A notices-timing numeric claim.** Ruled out as REM-CAP-class vacuity
  AT DESIGN TIME on receipt 6: 20/36 grounded cards are multi-literal
  (2+ Business-Day counts and/or clock times in conditional cascades), so
  under the inherited TERMF M-4 precedence (multiplicity first, any unit)
  the majority of grounded quotes ABSTAIN at birth, and the pack §7
  address-change override shows single-pass extraction grabs the wrong
  branch on the rest. Timing mechanics stay inside the NOTICES_PROVISION
  quote as reviewer evidence. **Consequence: no day-count, clock-time or
  money parser exists in this slice** — the only parser is the
  governing-law state parser (section 2).
- **A notices address-block claim** — PII-shaped, dual redaction
  conventions (pack §7/warning 8); the rubric `noticesAddress` field is
  unpromoted. Never extracted.
- **A forum-fallback-cascade list claim.** The grounded cascades
  (`5c4c705f…`, `113809b4…`, the `af4940e1…` "Chosen Courts" chain) are
  3-tier nested conditionals in single sentences; promoting them to an
  ordered list would be fabricated structure the corpus drafts three
  different ways. The cascade stays inside the FORUM_SELECTION quote; the
  rubric's `forumFallback` text field is unpromoted.
- **A governing-law mandatory-carve-out concept** ("except to the extent
  Maryland/Virginia law is mandatorily applicable") — grounded on exactly
  2/32 cards (receipt 1); both route to review via the parser's
  multi-state ABSTAIN, which is the honest landing for a 2-card pattern.
  FLAGGED FOR BEN with the DIVD-SPECIAL low-N reasoning: if Ben wants the
  carve-out state captured, it returns as its own receipted qualifier-
  track (P2) or concept diff.
- **A third-party-beneficiary exceptions LIST claim** — boundary 2; the
  rubric list field is unpromoted; carve-outs are section cross-references
  (receipt 4) whose resolution is not this slice's machinery.
- **A waiver-mechanics concept** (MISC-WAIVER, 17 cards) — boundary 6;
  family-brief deviation FLAGGED FOR BEN.
- **`MISC-*` v1 codes as concepts** — the label-vs-semantics ruling above.

**Claim definitions** (ten; nine presence, one enum):

```
GOVERNING_LAW_STATE_CLAIM_DEFINITION_V1
  claim_definition_key: 'GOVERNING_LAW_STATE'
  version: 1
  allowed_canonical_values: US_GOVERNING_LAW_JURISDICTION_TOKENS_V1
    // the frozen 51-token table (50 states + DISTRICT_OF_COLUMBIA),
    // 'DELAWARE' | 'NEW_YORK' | 'MARYLAND' | … — shared as one exported
    // constant with governing-law-parse.js so registry gate and parser
    // token set can never drift (content-equality test 1). A full-table
    // enum, NOT observed-values-only: the state list is a closed real-
    // world set (the CALENDAR_DATE_PATTERN precedent — a deterministic
    // grammar over a finite domain is not speculation), and an
    // observed-only gate would send a future Texas-governed deal to
    // permanent review for no legal reason. Non-US governing law is NOT
    // in the table and ABSTAINs (section 2) — that IS the review-worthy
    // case. Breadth choice FLAGGED FOR BEN.
  canonical_value_required_when_present: true

FORUM_SELECTION_PROVISION_CLAIM_DEFINITION_V1
  claim_definition_key: 'FORUM_SELECTION_PROVISION'
  version: 1
  allowed_canonical_values: [true]          // presence claim, the
  canonical_value_required_when_present: true  // KNOWLEDGE_QUALIFIER shape

FORUM_EXCLUSIVE_CLAIM_DEFINITION_V1
  claim_definition_key: 'FORUM_EXCLUSIVE'
  version: 1
  allowed_canonical_values: [true]
  canonical_value_required_when_present: true

ASSIGNMENT_CONSENT_RESTRICTION_CLAIM_DEFINITION_V1   [true]
AMENDMENT_WRITTEN_INSTRUMENT_CLAIM_DEFINITION_V1     [true]
NOTICES_PROVISION_CLAIM_DEFINITION_V1                [true]
ENTIRE_AGREEMENT_INTEGRATION_CLAIM_DEFINITION_V1     [true]
NO_THIRD_PARTY_BENEFICIARIES_CLAIM_DEFINITION_V1     [true]
SEVERABILITY_PROVISION_CLAIM_DEFINITION_V1           [true]
COUNTERPARTS_EXECUTION_CLAIM_DEFINITION_V1           [true]
  // all version 1, allowed_canonical_values [true],
  // canonical_value_required_when_present true — the uniform presence
  // shape; written out in full in the build diff.
```

No new canonical value types; no validator changes (the enum rides
`allowed_canonical_values` membership, the existing gate). New concepts
and definitions grow the expected-keys rows as sorted supersets
(content-diffed tests; prior rows byte-untouched).

**Design decisions, pinned as legal rulings:**

- **The assignment restriction and the no-3PB provision are quoted
  PRESENT claims with negative content**,
  the P1/C2 and remedies bond-waiver precedent verbatim: "shall [not] be
  assigned … without the prior written consent" and "is not intended to,
  and does not, confer upon any Person any rights" are quoted positive
  sentences, not derived ABSENTs. M3 rule 1 is not implicated. The
  converse is never derived: a deal with NO assignment restriction or a
  free-assignment clause matches no corroboration pattern and goes to
  review/open world — fail closed, never a mislabeled restriction.
- **Forum presence and exclusivity are TWO claims, pinned co-resolvable**
  (the NO_MAE/CONTINUING device via the closing-conditions spec):
  `FORUM_SELECTION_PROVISION` on the submission/venue quote,
  `FORUM_EXCLUSIVE` ONLY when the quote carries exclusivity drafting
  ("may only be brought", "exclusive jurisdiction" — grounded
  `5c4c705f…`, `113809b4…`). A non-exclusive submission resolves presence
  alone; "non-exclusive" is never asserted (it would be a producer
  negative). v1's `jurisdictionExclusive` boolean's FALSE half is never
  derived here.
- **Consent standards, void-assignment sanctions, affiliate-assignment
  carve-outs, amendment board-approval variants and post-vote statutory
  limits stay INSIDE their claims' quotes** (receipt 5 shapes) — each is
  real legal texture, none has a grounded uniform shape across even half
  its population, and every one is the strength-gradation material the
  tax-matters spec ruled qualifier-track (P2 seam). No modality enums.
- **The governing-law claim is quote-scoped, and the producer is
  instructed to quote the OPERATIVE choice-of-law sentence** (through any
  mandatory-carve-out limb attached to it — the producer never
  sentence-splits a carve-out away, the remedies M2/pack-warning-2
  discipline). Where the operative sentence itself names two states (the
  2 mandatory-carve-out cards), the parser ABSTAINs and review sees the
  carve-out whole. Where a second state lives in a separate financing
  proviso sentence (the NY pattern, receipt 1), a correctly-scoped quote
  parses clean and the proviso is the FORUM/financing families' evidence
  or open world.

**Governed attributes (never in keys; participate in claim
identity/closure):**

- `FORUM_SELECTION_PROVISION`: `primary_forum_ref` — REQUIRED verbatim
  court phrase from the quote ("the Court of Chancery of the State of
  Delaware", "the Chosen Courts"), enforced as a verbatim substring of the
  byte-verified quote (P1 M-3); failure → review, typed
  `FORUM_REF_NOT_IN_QUOTE`; unidentifiable → review, typed
  `FORUM_REF_UNIDENTIFIED`, never resolves. This is the TERMF
  fee_term_ref gate transplanted: it stops a bare "submits to
  jurisdiction" recital resolving with no named forum. `FORUM_EXCLUSIVE`
  carries no attribute (it rides the same section's quote; identity
  separates on claim definition key).
- `GOVERNING_LAW_STATE`: no producer attribute — the parser's
  `matched_text` (the verbatim state phrase) travels in the resolution
  receipt; producer-asserted state labels are never trusted (corroboration
  is the parser itself).
- All seven other presence claims: no attributes beyond the quote. Party
  dimensioning on mutual boilerplate would be fabricated structure
  (the TAXM-FIRPTA/remedies REM-JURY ruling); no party tuple is minted
  anywhere in this slice.

M3 rule 1 restated for this family's tempting negatives: the producer
NEVER asserts "no jury waiver", "non-exclusive forum", "assignment
freely permitted", "no survival of representations", or "no third-party
beneficiaries exist" as a DERIVED fact — `NO_THIRD_PARTY_BENEFICIARIES`
resolves only on the quoted no-3PB sentence itself, and silence anywhere
remains the scope-closure machinery's job, forever.

## 2. Value parser: `governing-law-parse.js`

New pure module, `measurement-date-parse.js` contract shape: typed
`{outcome:'RESOLVED', canonical_value, matched_text}` or
`{outcome:'ABSTAIN', reason}` — never a throw on prose, never arithmetic,
never repair. `GOVERNING_LAW_PARSE_VERSION` threaded into the resolution
receipt (P1 M-6). ONE exported function plus the shared token table —
this family gets no other parser (section 1 rulings):

**`parseGoverningLawState(quote)`**

- `US_GOVERNING_LAW_JURISDICTION_TOKENS_V1`: frozen table of 51 entries,
  each `{token, pattern}` — pattern is the word-bounded state-name regex
  (`/\bDelaware\b/i`, `/\bNew York\b/i`, `/\bMaryland\b/i`, …;
  `/\bWashington\b/i` deliberately does NOT special-case "Washington,
  D.C." — the DISTRICT_OF_COLUMBIA pattern `/\bDistrict of Columbia\b/i`
  is checked as its own entry and a quote matching both is multi-state by
  the distinct-count rule below, ABSTAINing to review rather than
  guessing; a named blind spot, priced). Case-insensitive throughout —
  receipt 1's corpus mixes ALL-CAPS and title-case drafting of the same
  clause (pack warning 3), so case-sensitive matching would go blind on
  half the population (the remedies REM-JURY query-receipt-1 lesson).
- The parser counts DISTINCT tokens whose patterns match the
  byte-verified quote:
  - Exactly 1 distinct token → RESOLVED, `canonical_value` = the token,
    `matched_text` = the first pattern match's verbatim bytes. Repeated
    mentions of the SAME state never abstain — the conflict-of-laws
    parenthetical "(whether of the State of Delaware or any other
    jurisdiction)" (`bd63b718…`) and "Delaware General Corporation Law"
    references are same-token repeats and resolve DELAWARE cleanly.
  - 2+ distinct tokens → ABSTAIN `MULTIPLE_STATE_REFERENCES` → review.
    Grounded on the corpus's real shapes: the 2 mandatory-carve-out cards
    (`16ede881…` VA+DE, `8192e746…` MD+DE) and any full-section quote
    swallowing a NY financing proviso (receipt 1's 9 two-state cards).
    The producer owns quote-scoping; the parser never picks a "primary"
    state — picking would be the resolver deciding a legal question
    (which law "really" governs) that review must see whole.
  - 0 tokens → ABSTAIN `NO_STATE_REFERENCE` → review. The landing for
    non-US governing law, federal-law drafting, and misrouted quotes.
- No normalization beyond the token: "State of Delaware", "Delaware law",
  "the internal law of the State of Delaware" all resolve `'DELAWARE'`
  because the pattern keys on the state name alone; the surrounding
  formula stays in the quote.
- The exported token table is the SAME frozen constant the registry's
  `allowed_canonical_values` references (section 1) — content-equality
  pinned by test 1, so a RESOLVED value can never fail the
  `canonicalValueAllowed` membership gate by drift; the gate still runs
  (a parser bug must not bypass it).

## 3. Producer prompt + provider

- **New prompt module**
  `lib/canonical-v2/native-producer/misc-boilerplate-producer-prompt.js`.
  Existing prompt modules are NOT edited (their PROMPT_VERSIONs do not
  move; recorded capitalisation/termination-fee fixtures replay
  byte-identically). New `PROMPT_ID 'native-producer-misc-boilerplate/v1'`,
  `PROMPT_VERSION 1`, bumped once per slice, never mid-slice.
- **Dispatch through `producer-prompt-registry.js`, mandatorily.** The
  seam is BUILT at head (CAPITALISATION, TERMINATION_FEE, NO_SHOP;
  module-private frozen Map; fail-closed nulls). This slice adds ONE entry
  in its own reviewed diff: `MISC_BOILERPLATE →
  buildMiscBoilerplateProducerPrompt`. Unknown family → no prompt, no
  candidates, typed record — never a silent capitalisation fallback.
- **Section-family classifier extension**
  (`section-family-classifier.js`; this is this family's own reviewed
  diff; `runStage1(title, article_context)` signature per the
  financing-covenants spec with the standard build-order pin — if a
  sibling slice extending the signature has landed, the extension exists;
  if this slice lands first, it builds the extension exactly per that
  spec's §3 and bumps `SECTION_FAMILY_CLASSIFIER_VERSION`).
  **Shared exclusion constant, checked FIRST by every rule in this
  slice** (the TERMF_TITLE_PATTERN device — one pattern, one place):
  `REMEDIES_COMBINED_TITLE_PATTERN =
  /waiver\s+of\s+jury|specific\s+(performance|enforcement)/i` — any title
  matching it declines ALL MISC_BOILERPLATE rules (boundary 1; the
  combined "GOVERNING LAW; WAIVER OF JURY TRIAL" headings, receipt 3,
  cede to the remedies family's own folded rules pending Ben's collision
  ruling). Rules, each grounded in real in-document headings from
  receipts 3–5 and the pack:
  - `/\bgoverning law\b/i` — "Governing Law" (§9.9 ×2, §8.07, §9.08 …).
    Note `/\bapplicable law\b/i` is deliberately NOT a rule token: the
    "Applicable Laws; Jurisdiction; Specific Performance; Remedies"
    heading (`6c5b10c6…`) is a remedies-family fixture excluded by the
    shared constant anyway, and "Applicable Law" alone is the polluted
    DEFINITION term (Grounding correction 1).
  - `/\bjurisdiction\b|\bvenue\b|\bforum\b/i` — "Jurisdiction; Venue"
    (§10.8, §9.10). The "Enforcement; Jurisdiction" heading (pack
    warning 6) dispatches HERE via `/\bjurisdiction\b/` — it matches
    neither this slice's `REMEDIES_COMBINED_TITLE_PATTERN` nor remedies'
    own stage-1 title token, so it is not a remedies decline; its SP-led
    content is producer open-world under the NOT-this-family list
    (section 3), and this heading shape is added to the boundary-1 Ben
    collision flag.
  - `/\bassignment\b|\bsuccessors and assigns\b/i` — "Assignment" (§9.9),
    "Assignment; Successors", "No Assignment or Benefit to Third Parties"
    (§9.3, `121f1ee7…` — dispatches HERE, and its TPB carve-out limb is
    handled by this producer's own kind split).
  - `/\bamendment\b|\bmodification\b/i` — "Amendment" (§8.4), "Amendment;
    Modification" (§9.01). The DEFINITION-stub "Amendment" entry
    (Grounding correction 1) is stopped by the DEFINITIONS
    article_context decline, not by title.
  - `/\bnotices\b/i` — PLURAL ONLY, deliberately: "Notices" (§9.4,
    §11.1). The singular `/\bnotice of\b/i` class ("Notice of Certain
    Events"-shaped covenant headings) must never dispatch here; a
    dedicated negative test pins the singular decline.
  - `/\bentire agreement\b|\bentire understanding\b/i` — "Entire
    Agreement" (§10.05), "Entire Understanding: No Third-Party
    Beneficiaries" (§9.5, `37268e02…` — dispatches here; both its kinds
    are this family's).
  - `/\bseverability\b/i` — "Severability" (§9.7).
  - `/\bcounterparts\b/i` — "Counterparts" (§9.13), "Counterparts;
    Electronic Signatures" (rubric alias).
  - `/third[- ]party beneficiar/i` — "Third-Party Beneficiaries" (§9.8,
    §9.6 ×2). Reciprocal of the D&O spec's test-4 decline (boundary 2).
  - **Declines, pinned:** `article_context` of DEFINITIONS,
    REPRESENTATIONS or CONDITIONS → decline ALL rules (the
    "Applicable Law"/"Amendment" DEFINITION pollution, Grounding
    correction 1, must never dispatch; reps/conditions articles have no
    MISC boilerplate to claim). REMEDIES_COMBINED_TITLE_PATTERN → decline
    ALL rules (boundary 1). Vacuity check applied at design time
    (REM-CAP): every committed fixture's real heading matches a rule
    under a non-declining context EXCEPT the deliberately-ceded combined
    headings (`8192e746…`, `79ded2c4…`, `bd63b718…`, `b6eec9e1…`) — those
    four are committed as boundary fixtures pinned to DECLINE, the
    honesty pin that makes the coverage hole visible in tests rather than
    discovered live.
  - Stage 1 is validated against ALL deals' section titles before the
    prompt is ever dispatched (the repo classify-rules safety check) as a
    review-time script against live corpus data — never stubbed into
    `npm test` (the IOC test-5 discipline). Known collision surfaces to
    verify: "Notice of …" covenant headings (must not match the plural
    rule); "Fees and Expenses" (TERMF's, boundary 3); "Waiver" headings
    (out of scope — must not match any rule); "Survival"/"Rules of
    Construction" (no rule matches); D&O-article "Indemnification"
    headings (no rule matches); and the remedies-token combined headings
    (decline via shared constant).
  - Stage 2 (AI-assisted) applies unchanged with
    `SECTION_FAMILY_AI_CLASSIFIED` provenance and the
    `SECTION_FAMILY_AI_UNVERIFIED` auto-pass block.
- **Response shape:** a `misc_assertions` array — each element
  `{ section_reference, assertion_kind: 'GOVERNING_LAW' |
  'FORUM_SELECTION' | 'FORUM_EXCLUSIVE' | 'ASSIGNMENT_CONSENT' |
  'AMENDMENT_FORMALITY' | 'NOTICES' | 'ENTIRE_AGREEMENT' | 'NO_TPB' |
  'SEVERABILITY' | 'COUNTERPARTS', verbatim quote }`; FORUM_SELECTION
  additionally carries `primary_forum` (verbatim court phrase). One
  element per legal fact, split discipline pinned in the prompt:
  - A Miscellaneous-article section frequently grounds MULTIPLE
    assertions of DIFFERENT kinds (the `37268e02…` integration+no-3PB
    compound; a GOVLAW section with a distinct forum sentence grounds
    GOVERNING_LAW and FORUM_SELECTION each quoting its own sentence).
    Intra-family compounds are exactly why one producer owns all nine
    concepts.
  - A forum section with exclusivity drafting grounds TWO assertions —
    FORUM_SELECTION and FORUM_EXCLUSIVE — whose quotes may overlap on the
    shared sentence (the pinned co-resolution pair; `5c4c705f…` and
    `113809b4…` are this shape).
  - The GOVERNING_LAW quote is the operative choice-of-law sentence
    INCLUDING any attached mandatory-carve-out limb (never split away —
    section 1 ruling); separate financing provisos are separate sentences
    and stay out of it.
  - Named in the prompt as NOT this family's assertions: jury-trial
    waivers and specific-performance/equitable-relief grants (remedies
    family — boundary 1), anti-reliance/no-other-reps disclaimers inside
    Entire Agreement sections (open world — boundary 4), D&O
    covered-person indemnification rights referenced by no-3PB carve-outs
    (D&O family — boundary 2), fee/expense allocation (TERMF — boundary
    3), survival-of-reps sentences and waiver-mechanics sentences (open
    world — boundary 6), notices address blocks and timing values (never
    extracted — section 1 rulings). Open world or silence, never forced
    fit; PRESERVE-THE-NOVEL retained verbatim. The producer never asserts
    a negative (M3 rule 1).
- **Provider (`anthropic-provider.js`):** ONE new generic key,
  `NATIVE_MISC_BOILERPLATE_CANDIDATE`, proposal_kind `MISC_BOILERPLATE`
  (≠ OPEN_WORLD). `misc_assertions` is NOT added to
  `REQUIRED_RESPONSE_LISTS` (the share_count precedent verbatim: recorded
  responses predate the key; missing/non-array reads as empty list). Quote
  byte-verification identical to existing proposals. Golden evals:
  recorded responses are never hand-edited into the new shape; the first
  recordings are minted by the first live runs, each its own dated
  handoff.

## 4. Resolver wiring (`candidate-resolution.js`)

- **ONE new `RESOLUTION_UNCONDITIONAL` entry** (P1 M-2: the Map is keyed
  on generic_claim_key alone): `NATIVE_MISC_BOILERPLATE_CANDIDATE`,
  `deterministic_kind: null`, `attachment_position: null`,
  `registered_claim_definition_key: null`, `concept_key: null` (explicit,
  with the TERMR build-time check that nothing reads
  `mapping.concept_key` before the handler's kind map runs),
  `party_field: null` (no kind mints a party — section 1).
  `MAPPING_TABLE_VERSION` bumped; table-validation still asserts no
  duplicate generic keys.
- **Handler split on `assertion_kind`** via a frozen map:
  `GOVERNING_LAW → ADMIN-GOVLAW × GOVERNING_LAW_STATE`;
  `FORUM_SELECTION → ADMIN-FORUM × FORUM_SELECTION_PROVISION`;
  `FORUM_EXCLUSIVE → ADMIN-FORUM × FORUM_EXCLUSIVE`;
  `ASSIGNMENT_CONSENT → ADMIN-ASSIGN × ASSIGNMENT_CONSENT_RESTRICTION`;
  `AMENDMENT_FORMALITY → ADMIN-AMEND × AMENDMENT_WRITTEN_INSTRUMENT`;
  `NOTICES → ADMIN-NOTICES × NOTICES_PROVISION`;
  `ENTIRE_AGREEMENT → ADMIN-ENTIRE × ENTIRE_AGREEMENT_INTEGRATION`;
  `NO_TPB → ADMIN-TPB × NO_THIRD_PARTY_BENEFICIARIES`;
  `SEVERABILITY → ADMIN-SEVER × SEVERABILITY_PROVISION`;
  `COUNTERPARTS → ADMIN-COUNTER × COUNTERPARTS_EXECUTION`.
  Out-of-enum assertion_kind → explicit `pushOpenWorld`, typed reason
  (P1 C-4).
- **Full-table kind ambiguity rule (the TERMF C-3 device) with exactly
  ONE pinned co-resolution pair:** the handler runs ALL kinds'
  corroboration patterns over the assertion's single byte-verified quote.
  `{FORUM_SELECTION, FORUM_EXCLUSIVE}` is pinned co-resolvable (one
  sentence carries both, grounded). Every OTHER multi-kind match on one
  quote (an integration sentence quoted so wide it swallows the no-3PB
  sentence; a govlaw quote swallowing forum text) → review, typed
  `AMBIGUOUS_MISC_ASSERTION_KIND` — the producer owns splits; there is no
  resolver-side sub-quote search (the remedies M3 correction, adopted).
  Asserted-kind pattern mismatch → review, typed
  `MISC_KIND_UNCORROBORATED`.
- **Corroboration tables (frozen resolver constants; label must bind to
  quote text; every pattern grounded in a committed fixture quote):**
  - `GOVERNING_LAW` ↔ `/\bgoverned by\b/i` (receipt 2: 32/32) OR
    `/\bconstrued in accordance with\b/i` (26/32 pair form).
  - `FORUM_SELECTION` ↔ `/\bCourt of Chancery\b/i` (23 family cards; 31
    deals corpus-wide) OR `/\bsubmits?\b[\s\S]{0,60}\bjurisdiction\b/i`
    (bounded, static max under 128) OR `/\bChosen Courts\b/`
    (case-sensitive defined term, explicit `\b`; `af4940e1…`) OR
    `/\bbrought\b[\s\S]{0,60}\bcourts?\b/i` (grounded `5c4c705f…` "may
    only be brought in the Court of Chancery").
  - `FORUM_EXCLUSIVE` ↔ `/\bmay only be brought\b/i` (grounded
    `5c4c705f…`, `113809b4…`) OR `/\bexclusive jurisdiction\b/i`. By
    construction any FORUM_EXCLUSIVE-corroborating quote in the grounded
    set also corroborates FORUM_SELECTION — the pinned pair.
  - `ASSIGNMENT_CONSENT` ↔ `/\bassign/i` AND
    (`/\bwithout the prior written consent\b/i` (23/32) OR
    `/\bnot (be )?assign/i` (4/32)). The ~5-card residual drafted some
    third way queues `MISC_KIND_UNCORROBORATED` — priced.
  - `AMENDMENT_FORMALITY` ↔ `/\bamend(ed|ment)\b/i` AND
    (`/\bin writing\b/i` OR `/\bwritten (agreement|instrument)\b/i` OR
    `/\binstrument in writing\b/i`) (receipt 2: 32/32 — the family's
    tightest gate; the `668c4779…` board-approval variant also carries
    the writing formality in its full text).
  - `NOTICES` ↔ `/\bnotices?\b/i` AND
    (`/\bdelivered\b/i` OR `/\bemail\b/i` OR `/\bcourier\b/i` OR
    `/\breceipt\b/i`) — delivery vocabulary required so a stray
    "notice of termination" sentence never corroborates.
  - `ENTIRE_AGREEMENT` ↔ `/constitutes? the entire agreement/i` (29/31)
    OR `/\bentire agreement and understanding\b/i` (redundant-by-choice:
    its grounding card `37268e02…` already matches the first alternation;
    no other MISC-ENTIRE card matches it, so it adds zero incremental
    coverage over the 2-card residual — kept for direct-quote parity with
    the grounded drafting, not for coverage).
  - `NO_TPB` ↔ `/third[- ]party beneficiar/i` (17/17 — the term matches
    every true no-3PB card) OR `/confer upon any (other )?Person any
    rights\b/i` (grounded `09dfcd6c…`, `277f2a58…`; 8/17, all inside the
    term-matched population — redundant-by-choice, not incremental
    coverage).
  - `SEVERABILITY` ↔ `/\b(invalid|unenforceable)\b/i` AND
    `/\bprovisions?\b/i` (35/35).
  - `COUNTERPARTS` ↔ `/\bcounterparts\b/i` (34/34).
  - NO pattern in any table matches jury/SP vocabulary ("jury", "trial",
    "irreparable", "specific performance", "injunction") — asserted by
    grep-test (boundary 1's third layer).
- **Handler order per assertion:** full-table kind corroboration →
  `primary_forum_ref` verbatim-substring enforcement (FORUM_SELECTION
  only; `FORUM_REF_NOT_IN_QUOTE` / `FORUM_REF_UNIDENTIFIED`) →
  `governing-law-parse.js` (GOVERNING_LAW kind only) → concept assignment
  → gates. Every ABSTAIN routes to review with the parser's typed reason;
  RESOLVED values still pass `canonicalValueAllowed`; presence claims
  carry `buildMechanicalAnswerProvenance({ extraPins: { gate:
  'ALLOWED_VALUES_MEMBERSHIP' } })` (uniform tag-construction story; no
  auto-pass-block entry rides on it).
- **Materiality: NO new tier.** All nine concepts carry the `ADMIN-`
  prefix and inherit `{ rank: 90, label: 'NOTICES_ADMINISTRATIVE' }` —
  the ledger's own placement for "notices and administrative clauses",
  already in the frozen table, zero collisions with the wave siblings'
  contested 75/80/85 proposals. **FLAGGED FOR BEN:** whether ADMIN-GOVLAW
  and ADMIN-FORUM (real deal-litigation substance, and the family's only
  parsed value) deserve a better rank than 90 — if so, the
  financing-covenants exact-keys device is the mechanism (a named-keys
  tier above 90, never a prefix split), a one-line Ben-reviewed diff.
  **Pre-concept review routing (TERMF M-3):** review items minted before
  the kind map runs carry conceptFamily `'ADMIN-MISC-PENDING'` — a
  routing token only, never registered, never publishable — which
  startsWith-matches the `ADMIN-` prefix → rank 90 instead of
  UNCLASSIFIED 99.
- **Identity:** claim definition key + `primary_forum_ref` (where
  present) participate in claim identity/closure — FORUM_SELECTION and
  FORUM_EXCLUSIVE over one overlapping sentence never collide or dedupe;
  nine same-article presence claims mint distinct stable identities per
  definition key.
- **Receipt + additivity (honest form, P1 M-1):** with no
  misc-boilerplate input, resolution output must be byte-identical EXCEPT
  `mapping_table_version`, `contract_vocabulary_digest` (under the new
  bundle version), the new `governing_law_parse_version` field, the
  bumped `section_family_classifier_version`, and the recomputed
  `resolution_receipt_id`; documented in the PR as a field-level diff.

## 5. Lexicon additions (`LEXICAL_FAMILY_LEXICON` — head version + 1 at
build time, content-diffed; every edit a reviewed diff; keys MUST be
registered concept keys; explicit `\b` on every case-sensitive
defined-term regex; static max ≤ 128; rationale per pattern; veto-only —
a hit vetoes an ABSENT, never creates a PRESENT, M3 rule 2)

- `ADMIN-GOVLAW`: BOUNDED_REGEX `/governed by,? and (construed|interpreted)/i`
  (11/32 measured pair-form anchor — the bare literal "governed by and
  construed in accordance with" undercounts the corpus's comma-form
  drafting, "governed by, and construed…"); LITERAL_PHRASE
  "laws of the State of" (the state-formula stem, grounded across
  receipts 1's quotes).
- `ADMIN-FORUM`: LITERAL_PHRASE "Court of Chancery" (23 family cards;
  priced cross-hit below); BOUNDED_REGEX `/\bChosen Courts\b/`
  (case-sensitive defined term; `af4940e1…`).
- `ADMIN-ASSIGN`: LITERAL_PHRASE "successors and assigns" (27/32 —
  fires in TPB/benefit sentences too, priced); LITERAL_PHRASE
  "shall be assigned" (`ab3f7289…`, `3d973b67…`).
- `ADMIN-AMEND`: LITERAL_PHRASE "may be amended" (`0c05c8b4…`,
  `668c4779…`); LITERAL_PHRASE "instrument in writing" (`0c05c8b4…`).
- `ADMIN-NOTICES`: BOUNDED_REGEX
  `/\bnotices\b[\s\S]{0,60}\bother communications\b/i` (7/36 measured —
  the bare literal "notices and other communications" misses both
  committed notices fixtures, `63d5ceb0…` "notices, requests, claims,
  demands and other communications" and `52426964…` "notices, requests
  and other communications"; static max respected, second anchor: the
  `/\bnotice\b/i` corroboration-table token already covers the
  36/36 population, this lexicon entry is a veto-only refinement, not
  the sole coverage surface).
- `ADMIN-ENTIRE`: BOUNDED_REGEX `/constitutes? the entire agreement/i`
  (6/31 measured — the bare literal "constitutes the entire agreement"
  undercounts the corpus's dominant plural drafting, "constitute the
  entire agreement").
- `ADMIN-TPB`: LITERAL_PHRASE "third party beneficiaries" AND
  LITERAL_PHRASE "third-party beneficiary" as SEPARATE pattern_ids (the
  D&O spec's own device for the hyphenation split, adopted verbatim so
  the two families' entries stay parallel).
- `ADMIN-SEVER`: BOUNDED_REGEX `/invalid,? (or|void or) unenforceable/i`
  (11/35 measured — the bare literal "invalid or unenforceable"
  undercounts drafting variants such as `d8f4334a…`'s "illegal, void or
  unenforceable").
- `ADMIN-COUNTER`: BOUNDED_REGEX `/\bin (one or more )?counterparts\b/i`
  (3/34 measured for the bare literal "in counterparts" — the corpus's
  dominant drafting is "in one or more counterparts", which does not
  contain the bare literal).

**Priced cross-hit noise, stated (TERMR M-4 discipline):** "Court of
Chancery" fires in remedies/forum text corpus-wide (31 deals) including
REM-owned SP sections and TERMF fee sections that name enforcement venue —
expected `LEXICAL_UNMATCHED_SIGNALS` hits, and the strongest veto tell in
exactly those deals; deletion asymmetry applies. "third party
beneficiaries" fires in every D&O TPB sentence — the D&O spec ALREADY
prices the mirror hit (its §5: "fires in every MISC-THIRDPARTY no-3PB"
paragraph, with an expected-hit pin); this slice adds the reciprocal
expected-hit pin on a committed D&O-section fixture paragraph so both
families' tests break on a silent deletion. "successors and assigns"
fires in TPB and D&O successor-assumption text (D&O pack: successor
language under one quote) — priced. "may be amended" fires in charter/
bylaws reps and covenant text — priced, low volume.

**Priced exclusions** (each a recorded blind spot; a miss costs a missed
veto, never a wrong claim): bare "governed" / "law" / "consent" /
"notice" / "assign" (each floods multiple families — "prior written
consent" alone saturates every IOC card and is deliberately NOT an entry
despite being this family's best corroboration pattern; corroboration
and lexicon have different noise budgets); "jury" / "waiver" / "specific
performance" (REM-owned vocabulary — zero entries here, boundary 1);
"entire agreement" bare (fires in integration-clause cross-references
inside other sections); "counterpart" singular (execution-page prose).
Residual blind spot, named: a no-3PB clause drafted without either TPB
phrase or the confer-upon formula is invisible to this lexicon; the
v1↔v2 comparator covers the 17 v1-carded deals.

## 6. Acceptance tests (real-fixture-first; the P1 M-5 pre-rerun-harness
honesty pins apply VERBATIM; every resolver/registry test drives
synthetic compiled candidates pinned to REAL corpus quotes, byte-verified
against committed fixture bytes, clearly labeled as the pre-rerun
harness)

0. **Fixture commit** under
   `tests/fixtures/canonical-v2/misc-boilerplate-live-run/`, LITERAL
   production bytes, provenance headers (deal uuid + provision_card uuid
   + retrieval date + provision_type/subtype), NEVER v1 section_ref
   label strings: GOVLAW solo-state `c44d44c2…`, `d6f8861a…` (DE) and
   `79ded2c4…` (MD — also a ceded-heading boundary fixture); GOVLAW
   multi-state `16ede881…` (VA+DE mandatory carve-out) and `c74e1ed8…`
   (DE + NY financing proviso); ceded combined headings `8192e746…`,
   `bd63b718…`, `b6eec9e1…` (DECLINE pins); DISPATCH-HERE boundary
   fixture `7ec3c96d…` (jury content open-world, not a decline); forum
   cascades `5c4c705f…`,
   `113809b4…`; assignment `ab3f7289…`, `3d973b67…`, and the compound
   `121f1ee7…`; amendment `0c05c8b4…`, `668c4779…`; notices `63d5ceb0…`,
   `52426964…` (the two redaction conventions, committed verbatim, never
   value-extracted); entire agreement `a6a33c14…` (Abry-embedded) and
   compound `37268e02…`; TPB `277f2a58…`, `34e84436…`, `09dfcd6c…`;
   severability `d8f4334a…`; counterparts `a23462d7…`; one
   DEFINITION-typed pollution exemplar (`provision_type='DEFINITION'`,
   subtype MISC-GOVLAW, its TRUE home in the header — the pack §3 class)
   pinned so the comparator/fixture layer never regresses into
   subtype-only filtering. Every test quote asserted a contiguous
   substring of committed bytes.
1. **Registry:** next version compiles; prior arrays untouched
   byte-for-byte; nine concepts + ten definitions validate with zero
   validator changes; superset-diffs against sorted CONTENT;
   `US_GOVERNING_LAW_JURISDICTION_TOKENS_V1` content-equal between
   registry allowed-values and parser table; kind→(concept, definition)
   frozen map values all registered.
2. **Parser, table-driven over the coverage map:** `c44d44c2…`/
   `d6f8861a…` resolve `'DELAWARE'`; `79ded2c4…`'s (a)-limb operative
   sentence resolves `'MARYLAND'` while its FULL card bytes ABSTAIN
   `MULTIPLE_STATE_REFERENCES` (the quote-scoping pin, both directions);
   `16ede881…` ABSTAINs `MULTIPLE_STATE_REFERENCES` even at
   operative-sentence scope (the mandatory carve-out is one sentence —
   the designed review landing); the `bd63b718…` conflict-parenthetical
   sentence resolves `'DELAWARE'` (same-token repeat immunity); a
   committed non-US/no-state quote ABSTAINs `NO_STATE_REFERENCE`;
   case-insensitivity pinned on the ALL-CAPS `16ede881…` bytes; the
   Washington/District-of-Columbia distinct-count blind spot exercised
   with a labeled synthetic.
3. **Resolution (pre-rerun harness):** each fixture resolves its kind's
   claim; `5c4c705f…` and `113809b4…` each resolve BOTH forum claims from
   overlapping quotes (pinned pair; never `AMBIGUOUS_MISC_ASSERTION_KIND`)
   with `primary_forum_ref` substring-enforced ("Court of Chancery of the
   State of Delaware"), a corrupted ref → `FORUM_REF_NOT_IN_QUOTE`, a
   missing ref → `FORUM_REF_UNIDENTIFIED`; a FORUM_EXCLUSIVE assertion on
   a submission-only quote (no exclusivity drafting) →
   `MISC_KIND_UNCORROBORATED`; a GOVERNING_LAW assertion on the
   `d8f4334a…` severability quote → `MISC_KIND_UNCORROBORATED`; the
   `121f1ee7…` compound resolves ASSIGNMENT_CONSENT and NO_TPB as two
   assertions quoting their own limbs, and a single wide quote carrying
   both kinds' patterns → `AMBIGUOUS_MISC_ASSERTION_KIND`; every parser
   ABSTAIN routes to review typed; out-of-enum kind exercises
   `pushOpenWorld`; `answer_provenance.gate === 'ALLOWED_VALUES_MEMBERSHIP'`
   on every resolved presence claim; materiality rank 90 asserted on a
   resolved ADMIN-GOVLAW claim AND on an `'ADMIN-MISC-PENDING'` review
   item; additivity re-pin with documented field-level diff.
4. **Cross-family boundary pins:** (b-1, four layers) the four ceded
   combined-heading fixtures DECLINE classification via
   `REMEDIES_COMBINED_TITLE_PATTERN`; the `7ec3c96d…` fixture DISPATCHES
   HERE via `/\bgoverning law\b/` (its "Waiver of Trial by Jury" heading
   matches neither this constant nor remedies' `/waiver\s+of\s+jury/i`)
   with its jury content asserted producer open-world, never a claim;
   grep-test asserts zero jury/SP
   vocabulary ("jury", "irreparable", "specific performance",
   "injunction", "equitable relief") in this slice's prompt,
   corroboration tables and lexicon; no assertion_kind exists for
   jury/SP (enum membership test); (b-2) a D&O-article "Indemnification"
   heading matches no rule; the `277f2a58…` D&O carve-out cross-reference
   resolves ONLY `NO_THIRD_PARTY_BENEFICIARIES` (no D&O claim minted —
   grep asserts zero "Indemnified"/"D&O Insurance" vocabulary in tables/
   lexicon); the reciprocal expected-hit lexicon pin on a D&O-section
   fixture paragraph; (b-3) "Fees and Expenses"/"Expenses" headings match
   no rule (TERMF's ordered-first rule also pinned by the registry replay
   test); (b-4) the `a6a33c14…` Abry disclaimer limb asserted as
   ENTIRE_AGREEMENT with a disclaimer-only quote →
   `MISC_KIND_UNCORROBORATED` (the integration anchor is absent from the
   disclaimer bytes), and grep asserts zero Abry vocabulary
   ("no other representations", "non-reliance", "extra-contractual") in
   tables/lexicon; (b-5) grep asserts zero financing vocabulary ("Debt
   Financing", "Financing Sources") in tables/lexicon; the `c74e1ed8…`
   full-card quote ABSTAINs multi-state (the financing-proviso landing);
   (b-6) "Waiver", "Survival", "Interpretation", "Notice of Certain
   Events" headings each match no rule.
5. **Identity:** forum pair over one sentence mints distinct
   non-deduping identities; two synthetic same-section forum claims with
   different `primary_forum_ref` never collide; re-run byte-stable.
6. **Lexicon:** table validation (keys registered; `\b` on
   case-sensitive regexes; static max ≤ 128; rationale per pattern;
   content hash re-pinned; version bump content-diffed); anti-noise
   regression paragraph carrying an IOC "prior written consent" sentence,
   a REM SP/jury sentence and a TERMF fee-venue sentence — asserted zero
   hits under the exclusions; one EXPECTED unmatched-signal pinned per
   priced cross-hit ("Court of Chancery" in a non-family paragraph;
   "third party beneficiaries" in the D&O fixture paragraph);
   determinism permutation tests green.
7. Full suite + `npm run build` + forbidden-patterns (fixtures inside
   the exempt directory class; zero new exemption entries); phase
   allowlist; recorded capitalisation, termination-fee and no-shop
   fixtures replay byte-identically through the registry with the
   MISC_BOILERPLATE entry present; unknown family → no prompt, typed
   record; classifier fixtures per §3; the all-titles corpus validation
   runs as a review-time script (live Supabase; never stubbed into
   `npm test`).

## Out of scope

- Jury-trial waivers, specific performance, bond waivers, non-recourse,
  liability caps (remedies family — boundary 1; the combined-heading
  dispatch collision is FLAGGED FOR BEN, options (a)/(b)/(c) in
  boundary 1).
- D&O covered-person TPB rights and all carve-out re-minting (boundary
  2); TPB exception-list promotion.
- Fee/expense allocation (TERMF — boundary 3); Abry/anti-reliance and
  reps-survival fields (boundary 4); financing-source law/forum
  carve-outs as claims (boundary 5).
- MISC-WAIVER, MISC-SURVIVAL, MISC-CONSTRUCT, MISC-SPECIFIC,
  MISC-EXPENSES populations (boundary 6; MISC-WAIVER is the flagged
  family-brief deviation).
- Notices timing/address extraction (section 1 vacuity + PII rulings);
  forum-fallback cascade lists; governing-law mandatory-carve-out
  concept (2 cards — flagged); any qualifier promotion (P2 seam).
- `FAMILY_MAPPING_TABLE` extension for v1↔v2 subtype mapping (separate
  Fable+Ben table edit; the DEFINITION pollution makes subtype-only
  mapping actively unsafe — Grounding correction 1).
- The DEFINITION-typed pollution rows and the rubric MISC-EXPENSES
  duplicate key as cleanup targets (ingest-QA flags, never absorbed).
- Live re-extraction runs (dated handoffs; until they land, no report
  may claim native boilerplate extraction — M-5); any M3 amendment; any
  scope-closure/ABSENT work.

## Known costs, stated up front

- **Presence breadth is cheap and shallow by design.** Seven of ten
  claims are near-universal presence facts whose per-claim information
  is low; their value is (a) closing seven families' lexical-net
  coverage (uncovered families block auto-pass — program invariant),
  (b) feeding future scope-closure denominators, and (c) the two
  substantive payloads they escort: the governing-law state enum and
  forum exclusivity — the family's actual market statistics, both with
  v1 comparator surfaces (Grounding correction 3).
- **The combined-heading cession costs 10/32 GOVLAW and 1/16 JURISD
  sections** (receipt 3) until Ben rules on boundary 1 — including the
  corpus's one solo-Maryland governing-law deal (`79ded2c4…`). Typed,
  visible (DECLINE-pinned fixtures), measurable in live-run handoffs,
  and recoverable by a one-line ordering ruling — never silently
  patched here.
- **10/32 governing-law cards ABSTAIN multi-state at full-card scope**;
  correct quote-scoping by the producer recovers ~8 (the NY-proviso
  class), and the 2 mandatory-carve-out cards land in permanent review
  by design — they are the cards a lawyer must read whole.
- **Corroboration residuals:** ~5 ASSIGN cards, 2 ENTIRE cards and 3
  TPB cards draft outside the grounded patterns and queue
  `MISC_KIND_UNCORROBORATED`; coverage extends by receipted reviewed
  diff, never by loosening a gate in place.
- **No auto-pass at birth for the presence claims in practice:** v1
  carries no comparable field for seven of the nine concepts (the M3
  v1/v2-agreement leg cannot be satisfied), so every claim is
  Ben-reviewed at rank 90 until v2 history accumulates — at this
  family's volume (~250 claims per corpus pass at full conversion) the
  review load lands almost entirely in the lowest-materiality queue
  band, which is exactly where the ledger says it belongs; stated so
  nobody reads "resolves" as "publishes unreviewed".
- **The lexicon's strongest anchors fire cross-family by construction**
  ("Court of Chancery", "third party beneficiaries") — expected
  unmatched signals in remedies and D&O sections, deletion-proofed by
  pinned expected hits in both families' tests; deletion asymmetry
  applies.
