# Diagnosis: remaining undiagnosed (family, reason_code) pairs

Slice: everything UNDIAGNOSED in `unresolved-register.json` except
REPRESENTATIONS, MAE_DEFINITION, KEY_DEFINED_TERMS, MATERIAL_CONTRACTS
(sibling agents' slices).

Branch under diagnosis: `origin/cursor/step-2x-free-phase-b641` (read-only,
via `git show <ref>:<path>`). Corpus: `evidence/canonical-v2/corpus-review-
20260809.html` on that branch, parsed with a small node regex extractor
(scratchpad `myextract.js`) — never read whole. Cross-checked against the
per-deal `evidence/canonical-v2/<deal>-<family>-20260809-2xk-final/{review-
queue.json,native-producer-recorded-response-*.json}` for a subset of codes
to recover the model's *proposed* canonical value pre-corroboration (the
corpus HTML shows only the quote + failing reason, not the value tested).

Status: COMPLETE for the slice, at two depths — see "Coverage statement"
at the end.

## Register scope check

`node` filter of `unresolved-register.json` for `fix_class:"UNDIAGNOSED"`
excluding the four sibling families: **74 rows, 356 occurrences.**

One correction to the task brief: **all 8 CLOSING_CONDITIONS rows in this
slice are already fully diagnosed** by `diag-closing-conditions.md`
(status COMPLETE, 62/62 held items traced). Its per-code counts —
CONDITION_KIND_UNCORROBORATED 34, PARTY_UNRESOLVED 8, REP_SIDE_UNCORROBORATED
7, OBLIGOR_REF_UNCORROBORATED 5, MAE_PARTY_UNCORROBORATED 2,
APPROVAL_KIND_UNCORROBORATED 2, CERTIFIED_CONDITION_REF_NOT_IN_QUOTE 1,
SCRAPE_QUOTE_NOT_IN_QUOTE 1 — match my register rows for CLOSING_CONDITIONS
exactly (60 of the 62, the other 2 being LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE,
already RESOLVED-blocked). The register just hasn't been re-stamped. I did
not redo this work; see its file for the diagnosis. Effective slice after
removing it: **66 rows, 348 occurrences.**

Note also that ANTITRUST_REGULATORY's `OBLIGOR_REF_UNCORROBORATED` (2) and
`PARTY_UNRESOLVED` (1) carry a **register `code_location_guess` bug**: it
points at `handleClosingConditionCandidate` (:5014/:5076/:5135/:5137), which
is CLOSING_CONDITIONS' function, not ANTITRUST_REGULATORY's. The real sites,
confirmed by reading `handleRegulatoryEffortsCandidate`, are
`candidate-resolution.js:9269` (`OBLIGOR_REF_UNCORROBORATED`, via
`regulatoryObligorPositionCorroborated`) and :9265 (`PARTY_UNRESOLVED`, when
`resolveParty` fails on a `ONE_PARTY`-scope obligor). Diagnosed below under
the ANTITRUST_REGULATORY section, not skipped.

---

## TEMPLATE VERDICT 1 — `candidate-resolution.js:9318`, ANTITRUST_REGULATORY

The line itself:
```js
if (!regulatoryValueCorroborated(kind, proposedValue, quote, attrs)) {
  pushRegulatoryReview({ entry, claim, reason: `${kind}_UNCORROBORATED`, conceptFamily: kindMap.concept_key });
  return;
}
```
inside `handleRegulatoryEffortsCandidate`. **8 reason codes issue from this
exact line**: `NOTIFICATION_OBLIGATION_UNCORROBORATED` (5),
`CONSULTATION_RIGHT_UNCORROBORATED` (3), `INFORMATION_SHARING_OBLIGATION_
UNCORROBORATED` (3), `BURDEN_COMMITMENT_UNCORROBORATED` (3),
`LITIGATION_OBLIGATION_UNCORROBORATED` (2), `COOPERATION_OBLIGATION_
UNCORROBORATED` (1), `STRATEGY_CONTROL_UNCORROBORATED` (1), `NON_IMPEDIMENT_
COVENANT_UNCORROBORATED` (1). **19 occurrences.**

**Verdict: many fixes, not one.** The dispatch line is a trivial fan-out;
the real logic is `regulatoryValueCorroborated(kind, value, quote, attrs)`
at :3538–3625, a per-`kind` (and, for enum kinds, per-`value`) table of
independent regexes. I extracted this function verbatim into a standalone
harness and ran it against the actual (quote, proposed-value) pairs pulled
from `review-queue.json` + `native-producer-recorded-response-*.json` for
all 6 deals carrying these codes (concho, modiv, redhat, skechers, skywater,
topbuild) — every failing case reproduces `false` against its own asserted
value's pattern, confirming the register's reasons are not corpus-vs-register
drift.

Root causes, by code, all in :3538–3625 unless noted:

- **NOTIFICATION_OBLIGATION** (:3616-3617,
  `/\b(?:shall|will)\b[\s\S]{0,180}\b(?:notify|advise|keep .{0,40}
  informed)\b/i`): 2/5 fail because the corpus says "**keep... apprised**",
  a real synonym the pattern doesn't recognize; 1/5 fails because the corpus
  says "**give... notice**" (noun form) not "notify" (verb); 1/5 (modiv,
  redhat) fails because the enumerated (i)/(ii)/(iii) covenant puts "shall"
  and "keep the other parties informed" >180 chars apart. **RESOLVER_SIDE**:
  add "apprised" and "notice" synonyms, widen the window.
- **CONSULTATION_RIGHT** GOOD_FAITH_VIEWS (:3589): concho's quote reads
  "**give consideration to the views**" — real synonym for "consider... the
  views" the literal-adjacency regex misses (no "good faith" token at all,
  because the drafting states the standard elsewhere in the same sentence
  without those exact words). Skywater's quote is "consider in good faith
  **all reasonable** comments" — the extra words between "faith" and
  "comments" break the regex's rigid `(?:the )?` filler assumption.
  Skywater's PARTICIPATE-tagged quote ("...shall each promptly inform the
  other party... furnish the other party with copies...") contains **no**
  participate/opportunity language at all — this looks like a genuine
  extractor misclassification, not a corroboration gap.
  **RESOLVER_SIDE** for the first two (widen synonym + filler tolerance);
  **PROMPT_CHANGE** for the third (wrong `canonical_value` proposed).
- **INFORMATION_SHARING_OBLIGATION** (:3613-3614, needs
  furnish/supply/share/provide/deliver/"copies of"/advise within 180 chars
  of shall/will): modiv's enumerated-list quote again exceeds the 180-char
  window; redhat's quote ("may... reasonably designate... material...as
  'Antitrust Counsel Only Material'") isn't an information-sharing
  obligation at all — likely misclassified; skechers' "will use reasonable
  efforts to (A) cooperate... (B) promptly supply" is borderline on the
  window. **RESOLVER_SIDE** (window) for 2/3, **PROMPT_CHANGE** for redhat's.
- **BURDEN_COMMITMENT**: skechers' BURDENSOME_CONDITION fails because
  `attrs.burden_term_ref` must literally contain "Burdensome Condition" or
  "Detriment" — its quote does define a parenthetical "(a "Detriment")" but
  apparently not inside the extracted `burden_term_ref` attribute value
  itself (an extraction-shape issue, **PROMPT_CHANGE**). Skywater's
  EXPRESS_HOHW quote ("Parent... shall agree to any such Divestiture
  Remedies or Behavioral Remedies") doesn't match either EXPRESS_HOHW
  sub-pattern — this reads as a genuine misclassification (**PROMPT_CHANGE**).
- **LITIGATION_OBLIGATION** MANDATORY_DEFEND (:3557 `mandatory` regex,
  vigorously contest/oppose/defend-through-litigation/etc.): both concho
  quotes describe vacating/modifying an injunction or "avoid[ing], resist[ing]
  or resolv[ing]" a challenge — real litigation-defense obligations phrased
  without any of the mandatory-pattern's fixed verbs. **RESOLVER_SIDE**:
  add "vacate/modify/suspend... injunction" and "avoid, resist or resolve...
  action" as additional MANDATORY_DEFEND phrasings.
- **COOPERATION_OBLIGATION**, **STRATEGY_CONTROL**, **NON_IMPEDIMENT_
  COVENANT** (1 occurrence each): each fails its own single narrow regex on
  real but unanticipated phrasing ("provide... cooperation as may be
  reasonably requested", "have the right... to determine the nature and
  timing of any divestitures", "avoid the entry of... any judgment...that
  would prohibit... the Closing"). **RESOLVER_SIDE**, one regex widening
  each.

**Net for this template: ~6-7 of 8 codes are RESOLVER_SIDE regex-widening
fixes (distinct regexes, so distinct changes, but low-risk, replay-
validatable); 2-3 individual occurrences (not whole codes) look like
PROMPT_CHANGE-class extractor misclassification** where the proposed
`canonical_value` doesn't match the text under any reasonable reading.

Not from this template but same handler (`handleRegulatoryEffortsCandidate`),
diagnosed here since they share the function:
- **OBLIGOR_SCOPE_UNCORROBORATED** (8, :9265/9266 via
  `REGULATORY_MUTUAL_OBLIGOR_PATTERN` at :3483): the pattern hardcodes
  specific party-name pairs ("Parent and (the) Company", "Company and Buyer
  Parties", "neither X nor Y", "none of... shall"). Concho's MUTUAL-scope
  quote says "**Parent and Merger Sub** shall not..." — a real third-party
  pairing the pattern never enumerates. Modiv's quote is "**The Company
  shall... advise Parent, and Parent shall... advise the Company**" — a
  parallel two-clause construction, not the "X and Y shall" single-clause
  form the regex expects. **RESOLVER_SIDE**: derive the mutual-obligor
  check from the deal's actual party list instead of hardcoded literals, and
  accept the parallel-clause form.
- **FILING_REGIME_NOT_SINGLE_NAMED_REGIME** (4, :9280/9295 via
  `regulatoryFilingRegimeCorroborated` at :3627, which explicitly rejects a
  `filing_regime_ref` naming more than one regime): redhat's ref bundles
  "HSR Act **and** other applicable Antitrust Laws"; topbuild's bundles
  "foreign antitrust, foreign direct investment **or** competition Law".
  These genuinely are compound/generic regime references — the check is
  working as designed (CLAUDE.md: a rejection can be correct). The gap is
  upstream: the extractor proposed a single-regime filing-deadline claim
  for language that plainly names several regimes at once.
  **TAXONOMY_DESIGN** (no claim shape exists for a multi-regime filing
  covenant) or **PROMPT_CHANGE** (don't propose HSR_FILING_DEADLINE /
  REGULATORY_FILING_DEADLINE here) — not a resolver bug.
- Singletons — `OBLIGOR_REF_NOT_IN_QUOTE` (1), `PARTY_UNRESOLVED` (1),
  `INFORMATION_PROTECTION_UNCORROBORATED` (1),
  `WITHDRAWAL_EXCEPTION_PERIOD_UNCORROBORATED` (1),
  `FILING_OBLIGATION_UNCORROBORATED` (1): not individually re-verified
  against quotes given time budget; each is a one-line, self-contained
  check in the same function (:9263, :9265, :9365, :9396, :9297
  respectively) and, on register description alone, is the same shape as
  the template group (own-attribute exact-substring or single regex). Flag
  **uncertain — same family of fix as above, RESOLVER_SIDE most likely,
  not independently quote-verified.**

---

## TEMPLATE VERDICT 2 — `candidate-resolution.js:8643`, NO_SHOP wave-B

```js
if (!noShopWaveBValueCorroborated(assertionKind, canonicalValue, sourceContext)) {
  pushNoShopReview({ ..., reason: `${assertionKind}_UNCORROBORATED`, ... });
  return;
}
```
inside `handleNoShopWaveBCandidate`. **7 reason codes issue from this exact
line**: `RECOMMENDATION_CHANGE_ACTION_UNCORROBORATED` (13),
`FIDUCIARY_ENGAGEMENT_STANDARD_UNCORROBORATED` (4),
`STANDSTILL_ACTION_UNCORROBORATED` (4),
`RECOMMENDATION_CHANGE_TRIGGER_UNCORROBORATED` (2),
`RECOMMENDATION_SAFE_DISCLOSURE_UNCORROBORATED` (2),
`RECOMMENDATION_CHANGE_FIDUCIARY_STANDARD_UNCORROBORATED` (2),
`REPRESENTATIVE_CONTROL_STANDARD_UNCORROBORATED` (1). **28 occurrences.**
Plus `COVENANT_OBLIGOR_NOT_IN_QUOTE` (8) at :8649-8652, the *next* check in
the same handler, using the same `sourceContext`.

**Verdict: one dominant mechanism, not per-kind regex noise.** Unlike the
antitrust template, `noShopWaveBValueCorroborated` itself is a thin
dispatcher into `NO_SHOP_WAVE_B_CORROBORATION_TABLE` (:3845-3916, per-kind
per-value regexes) — genuinely many small patterns, as the register's "same
mechanism" hint implies. **But every quote I pulled for every wave-B code is
an extremely short clipped fragment** — "fail to publicly reaffirm the
Company Board Recommendation", "approve, endorse or recommend",
"48 hours", "engage in", "continue" — missing the sentence's subject, verb,
and object entirely. That is not noisy regexes; it is the **input** to the
regexes being systematically too narrow, and the mechanism is upstream of
the per-kind table:

`sourceContext = sourceParagraphForCandidate(entry, claim) || claim.raw_value`
(:8613, and identically at :8556 for `handleNoShopPeriodCandidate` and
:8517 for `handleNoShopExceptionPrerequisiteCandidate`).

`sourceParagraphForCandidate` (:5757-5767) slices `sourceText` from the last
`\n` before the quote to the next `\n` after it — i.e. **one line**, not a
paragraph. I confirmed in `lib/canonical-v2/sec-html-canonical-text.js`
(:18-24, `CONFIG.line_break_tags`) that `<p>` is a hard-line-break tag: every
`<P>` in the source HTML becomes its own `\n`-delimited line in
`canonical_text`. I confirmed directly in
`tests/fixtures/canonical-v2/concho-first-live-run/concho-raw-fetched.htm`
(line ~2720) that concho's no-shop covenant lists each enumerated item, e.g.
"(i) withhold, withdraw, qualify or modify...", in its **own `<P>` tag**,
separate from the chapeau `<P>` that reads "The Company Board shall not,
directly or indirectly:". So for every enumerated no-shop/recommendation
covenant — which is most of them, by drafting convention — the "paragraph"
handed to corroboration is the bare sub-clause, and the chapeau carrying the
covenant obligor's name and the "shall"/"will" auxiliary is on a different
line entirely, permanently excluded.

This single mechanism plausibly accounts for essentially all of:
- the 8 wave-B `*_UNCORROBORATED` codes above (28) — the regex needs
  context the line-slice never contains;
- `COVENANT_OBLIGOR_NOT_IN_QUOTE` (8) — the obligor's name lives in the
  excluded chapeau line;
- `NO_SHOP_PERIOD_ROLE_UNCORROBORATED` (19, :8556-8567,
  `handleNoShopPeriodCandidate`, same `sourceParagraphForCandidate` call) —
  quotes are bare numerals ("48 hours", "one (1) Business Day") whose
  *role* (NOTICE vs MATCH vs REMATCH) is named only in the chapeau
  ("...shall notify Parent within..." vs "...Company shall provide Parent
  the opportunity to match...");
- `NO_SHOP_PREREQUISITE_UNCORROBORATED` (19, :8507-8541,
  `handleNoShopExceptionPrerequisiteCandidate`, same call) — quotes like
  "after consultation with its outside legal counsel" are genuine
  prerequisite fragments whose introducing "unless"/"provided that" clause
  is a line away.

`NO_SHOP_ACTION_UNCORROBORATED` (11, :8447-8481, `handleNoShopActionCandidate`)
is a **related but distinct** variant: it tests `noShopActionCorroborated`
against `claim.raw_value` **directly**, with no `sourceParagraphForCandidate`
call at all — quotes like "engage in", "continue", "submit any Company
Competing Proposal to the vote of the stockholders" never even get the
one-line widening the other three handlers apply. Same root cause (clipped
extraction span), one step further downstream.

**Fix, RESOLVER_SIDE**: `sourceParagraphForCandidate` needs to walk backward
past sibling enumerator lines (`(i)`, `(ii)`, `(a)`, `(b)`, …) to the
governing chapeau, not stop at the first `\n`. The codebase already has the
shape of this fix nearby: `partyContextForCandidate` (:5769-5784) walks back
to a `\n\s*\(a\)\s` boundary and treats everything before it as "opening"
context for one special case (`EITHER_PRINCIPAL_PARTY`). Generalizing that
walk-back into `sourceParagraphForCandidate` itself, or reusing the
`structure_context`/`GOVERNING_STRUCTURE` segmenter already present in
`review-queue.json` rows (currently `status: "UNDETERMINED", reason:
"NO_EVIDENCE_SPAN"` on every row I sampled — i.e. computed but never
consulted here) is a **mechanism that already exists in the codebase and is
unreachable from this call site** — the same shape as the task's named
"vocabulary exists but unreachable" pattern, one level up from vocabulary.
`handleNoShopActionCandidate` additionally needs to gain the
`sourceParagraphForCandidate` call it currently lacks.

**This is the single most valuable finding in my slice**: 91 of NO_SHOP's
occurrences across 13 codes collapse to one upstream context-window bug,
not 13 independent regex problems.

---

## Everything else, grouped by shared mechanism

**GENERAL_COVENANTS `GENERAL_COVENANT_CODE_UNCORROBORATED`** (24, OPEN_WORLD,
:4867-4874) plus `GENERAL_COVENANT_DEFINITION_REFERENCE_UNRESOLVED` (1,
:4861) and `PARTY_UNRESOLVED` (3, mis-attributed by the register to
`handleClosingConditionCandidate`; GENERAL_COVENANTS' actual `PARTY_
UNRESOLVED` sites were not independently re-derived given time — flagged
uncertain). Two findings:
1. **Confirmed dead branch, RESOLVER_SIDE, one line**: `generalCovenant
   GroundingFailure` (:4869-4873) reads
   ```js
   return corroboration.reason === 'AMBIGUOUS_GENERAL_COVENANT_CODE'
     ? 'GENERAL_COVENANT_CODE_UNCORROBORATED'
     : 'GENERAL_COVENANT_CODE_UNCORROBORATED';
   ```
   — both ternary branches return the identical string. A quote that is
   *ambiguous between two codes* (a real, distinguishable failure mode) is
   indistinguishable from a *plain non-match* in every downstream artifact.
   Does not by itself resolve more claims, but is needed before the vocabulary
   fix below can be triaged by failure type.
2. **Vocabulary too narrow, RESOLVER_SIDE**, confirmed against
   `lib/canonical-v2/native-producer/general-covenant-corroboration.js`: the
   file's own header admits 14 of 18 codes' patterns are "narrow on
   purpose... no committed candidate to ground against yet." Confirmed on
   quotes: COV-NOTIFY's patterns miss "**keep the other apprised**" (same
   apprised/informed gap as the antitrust template above — this is a
   corpus-wide drafting idiom missed in at least two independent modules);
   COV-FURTHER's patterns miss the very common "efforts... to consummate and
   make effective... **necessary, proper or advisable**" boilerplate,
   entirely different phrasing from "further assurances."

**DNO_INDEMNIFICATION `DNO_KIND_UNCORROBORATED`** (18) + `PERCENT_UNRESOLVED`
(2) + `YEAR_COUNT_UNRESOLVED` (2), all `handleDnoCandidate` (:9880-9882): one
regex per `assertion_kind`, tested against `claim.raw_value` directly (no
paragraph widening, same as NO_SHOP_ACTION). Quotes confirm the same
clipped-fragment shape: "for a period of not less than six (6) years from
the OpCo Merger Effective Time" is tagged TAIL_PERIOD but contains neither
"tail" nor "runoff" nor "d&o insurance" — those words are in the chapeau
sentence ("Parent shall maintain... tail policy... for a period of...").
**RESOLVER_SIDE**, same family as the NO_SHOP fix: widen context or accept
numeric-only fragments when the assertion_kind's chapeau was already
confirmed once in the section (a weaker, section-scoped check would work
here since DNO covenants are single-paragraph, not enumerated lists).

**EMPLOYEE_MATTERS** `ITEM_OR_STANDARD_UNCORROBORATED` (12) +
`EMPLOYEE_KIND_UNCORROBORATED` (7) + `EMPLOYEE_ITEM_OR_STANDARD_OUT_OF_
VOCABULARY` (5) + `MONTH_COUNT_UNRESOLVED` (5), all `handleEmployeeMatters
Candidate` (:9873-9875): same clipped-fragment pattern (enumerated
compensation/benefits items list a common "no less favorable" standard once
in the chapeau, then list items in separate (i)/(ii)/(iii) lines that never
restate it) **plus** genuine vocabulary gaps ("target incentive
opportunities" vs the pattern's "target annual cash bonus|short-term
incentive|commission|incentive compensation target"; "retirement and welfare
benefits" vs "employee benefit plans|employee welfare|employee benefits").
`MONTH_COUNT_UNRESOLVED` has a second, distinct defect: `singleNumber(quote,
'months?')` only recognizes digit+"months", so "**For a period of one
year**" (spelled, and in years not months) never resolves — no year→month
conversion, no spelled-numeral fallback. **RESOLVER_SIDE** throughout.

**TERMINATION** `TRIGGER_KIND_UNCORROBORATED` (10) +
`TERMINATING_PARTY_REF_NOT_IN_QUOTE` (7) + `PERIOD_KIND_UNCORROBORATED` (5),
`pushTerminationReview` family (:10165-10333): same clipped-fragment shape —
"Parent provides at least one (1) Business Day advance written notice;" and
"The Company may terminate this Agreement pursuant to Section 8.01(f)" are
sub-clauses/cross-references, not self-contained trigger descriptions.
**RESOLVER_SIDE**, same context-window family as NO_SHOP/DNO/EMPLOYEE_MATTERS.
`NO_CALENDAR_DATE` (2, `termination-deadline-parse.js`) not independently
quote-verified; register describes it as an ABSTAIN parser outcome, same
species as the day-count parsers below — likely correct-abstention, flagged
uncertain.

**FINANCING_COVENANTS `ASSERTION_KIND_UNCORROBORATED`** (8) +
`FINANCING_SCOPE_UNCORROBORATED` (4), `handleFinancingCandidate`
(:9464-9487): **mixed mechanism, split roughly in half.** Two of the
OBTAIN_EFFORTS-tagged quotes ("...efforts to deliver... a draft payoff
letter", "...efforts to deliver Payoff Deliverables...") are really payoff
covenants (they'd pass `PAYOFF_LEAD_TIME`'s `/payoff/i` check instantly) —
**PROMPT_CHANGE**, wrong `assertion_kind` proposed. One OBTAIN_EFFORTS quote
("...efforts to... provide such cooperation... necessary in connection with
the Debt Financing") reads as COOPERATION_GRANT in disguise — same,
**PROMPT_CHANGE**. Two COOPERATION_GRANT-tagged quotes are enumerated
sub-items ("(A) as promptly as reasonably practicable, furnish Parent with
the Required Information") that never restate "cooperation" — the chapeau
does; **RESOLVER_SIDE**, same context-window family. `financingKind
Corroborated` (:9455-9462, `FINANCING_SCOPE_UNCORROBORATED`) not
independently quote-verified; same table shape as the antitrust
`financingKindCorroborated`-style checks, flagged uncertain.

**TAX_MATTERS `TAX_TREATMENT_KIND_UNCORROBORATED`** (7) +
`TAX_ASSERTION_OPEN_WORLD` (5): quotes are full, un-clipped sentences (not
the enumerated-list shape above) pushed straight to OPEN_WORLD — different
texture from the rest of the slice. Not traced to the specific per-kind
regex in the time available; **uncertain**, but the state (OPEN_WORLD, no
review-queue hold) and full-sentence quotes suggest either a genuinely
narrow per-kind vocabulary (RESOLVER_SIDE) or a taxonomy gap for
reorganization/355-distribution-style reps that don't map cleanly onto the
registered tax-treatment kinds (TAXONOMY_DESIGN). What would settle it: read
`TAX_TREATMENT_KIND`'s corroboration table directly (not done here).

**APPRAISAL_DISSENTERS_RIGHTS `APPRAISAL_ASSERTION_OPEN_WORLD`** (5): all 5
quotes are unilateral-settlement-consent covenants ("the Company shall not,
without... consent of Parent, make any payment... or settle... any such
[appraisal] demands"), the same shape across 3 deals — this is a real,
recurring covenant type with **no registered assertion_kind at all**, not a
corroboration failure. **TAXONOMY_DESIGN**: add an appraisal-settlement-
consent claim shape.

**TERMINATION_FEE `SOLE_REMEDY_FEE_CONTEXT_LINKED`** (5) +
`SOLE_REMEDY_CARVEOUT_QUOTE_UNCORROBORATED` (2), `sole-remedy-resolution.js`
(:197, :300) — separate module from `candidate-resolution.js`. Quotes are
full sole-and-exclusive-remedy sentences, present in 5+ deals, pushed to
OPEN_WORLD_PROPOSITION. Not traced into `sole-remedy-resolution.js` given
time budget; **uncertain**, same recommendation as TAX_MATTERS — read the
module directly next.

**INTERIM_OPERATING `IOC_ATTACHMENT_TARGET_ZERO_MATCHES`** (4,
`ioc-mechanic-resolution.js:115`, `limbAttachment()`): sibling of the
already-diagnosed `IOC_ATTACHMENT_TARGET_QUOTE_MISSING` (`diag-ioc.md`,
COMPLETE) in the same function, but not itself individually diagnosed there
(only appears in its ranking table, row 7). Confirmed by reading the
function: `target_restriction_quote` is present and *is* a substring of the
item's own quote (passes the two checks that produce the sibling code), but
then `components.filter(c => componentText(c, sourceText) === targetQuote)`
finds **zero** structural components whose text is byte-**identical** to
it — an exact-equality lookup into an independently-segmented component
index, not a text-presence check. This is the IOC "attachment host" pattern
named in the brief, one level removed: the corroborating detail (which
limb this restriction attaches to) is present in the document but not
byte-identical to how the structural-component segmenter split that same
text. **RESOLVER_SIDE**: loosen `===` to a normalized/substring match,
consistent with the "target_restriction_quote substring-fallback" fix
`diag-ioc.md` already recommends for the sibling code.

**PROXY_MEETING**: `NO_DAY_COUNT` (3) and the day-count-adjacent parser
ABSTAINs elsewhere in the slice (`FINANCING_COVENANTS MULTIPLE_DAY_COUNTS`
1, `TERMINATION_FEE NON_LITERAL_NUMERAL`/`ANNIVERSARY_PHRASE` 1+2,
`NO_SHOP NO_SHOP_PERIOD_HOUR_NOTICE_OPEN_WORLD` 3): read
`antitrust-regulatory-parse.js` (:37-71, `parseFilingDeadlineDays`/
`parseDivestitureCapAmount`) directly. **Two distinct verdicts here**:
- `NO_DAY_COUNT` on quotes like "As promptly as reasonably practicable
  following the date of this Agreement, the Company shall prepare and file
  with the SEC the preliminary Proxy Statement" is a **correct abstention**
  — there genuinely is no day count in the text (CLAUDE.md: a zero/abstain
  can be right). The gap is upstream: the extractor proposed a day-count
  claim for a qualitative "as promptly as practicable" timing standard.
  **TAXONOMY_DESIGN/PROMPT_CHANGE**, not a resolver bug.
- `MULTIPLE_DAY_COUNTS` (topbuild, "...two (2) business days... prior to...
  (with drafts being delivered at least five (5) business days... prior
  to...)") is also a **correct abstention** — genuinely two different day
  counts for two different obligations in the same quote.
  `TAXONOMY_DESIGN`, not resolver bug.

**NO_SHOP `NON_LITERAL_NUMERAL`** (3, plus `FINANCING_COVENANTS`'s and
`TERMINATION_FEE`'s 1 each from the same parser family):
`parseFilingDeadlineDays` computes a `spelled` value from words like "four"
but only accepts it when accompanied by a **parenthetical digit** ("four
(4)") — `if (spelled && !match[3]) return {outcome:'ABSTAIN', reason:
'NON_LITERAL_NUMERAL'}`, discarding the value it just parsed. Corpus quotes
— "at least **four** Business Days in advance", "a Match Period of **three**
Business Days" — are bare spelled numbers with no parenthetical digit at
all: a genuine drafter-habit gap (some deals always pair spelled+digit,
these don't). **This is the task's named "two-condition regex encoding one
drafter's habit" pattern, confirmed as a 5th instance** (the brief names
four others). **RESOLVER_SIDE**, low-risk: when spelled-only, return
`RESOLVED` with the already-computed `spelled` value instead of aborting.

**The remaining tail** — `PROXY_MEETING` `MEETING_REF_ABSENT` (3),
`ADJOURNMENT_REASON_NOT_DIRECTLY_GROUNDED` (2), `CONTROL_PARTY_REF_
UNCORROBORATED`/`_NOT_IN_QUOTE` (1 each), `DOCUMENT_REF_NOT_IN_QUOTE` (1);
`CONSIDERATION` `RATIO_CONTEXT_UNCORROBORATED` (1), `NO_MONEY_LITERAL` (1);
`GUARANTY_FINANCING_PARTY` `GTY_KIND_UNCORROBORATED` (1);
`MERGER_STRUCTURE_CLOSING` `MERGER_TRANSACTION_STEP_ENTITY_NOT_IN_QUOTE` (1)
— each is a single-purpose, self-contained check (own-attribute substring
test or one regex) at the register's cited location, none re-derived to
quote level given the time budget. Given the density of the same three
mechanisms elsewhere in this slice (clipped-fragment/chapeau-separation,
narrow-vocabulary regex, correct-abstention-masquerading-as-defect), the
most likely outcome per item is one of those three, but this is
**uncertain** and each should get its own 10-minute quote-pull before a fix
is written. What would settle it: the same `myextract.js` + register-cross-
reference method used above, applied one code at a time.

---

## The three named patterns, verdict for this slice

1. **Corroborating detail outside the claim's own quote — same shape, and
   dominant.** Confirmed as the majority mechanism across NO_SHOP (78 of 91
   occurrences via `sourceParagraphForCandidate`'s line-not-paragraph bug),
   DNO_INDEMNIFICATION, EMPLOYEE_MATTERS, TERMINATION, and part of
   FINANCING_COVENANTS — all share the SEC-filing convention of chapeau +
   enumerated (i)/(ii)/(iii) or (a)/(b)/(c) sub-clauses, where the chapeau
   carries the obligor, the auxiliary verb, and often the standard/threshold,
   and the sub-clause carries only the operative fragment.
2. **Two-condition regex encoding one drafter's habit — confirmed, 5th
   instance.** The day-count parser's spelled-number-requires-parenthetical-
   digit assumption (`NON_LITERAL_NUMERAL`, 5 occurrences across NO_SHOP/
   FINANCING_COVENANTS/TERMINATION_FEE).
3. **Vocabulary that exists but is unreachable.** Not found as literal
   dead-vocabulary in this slice, but a structural analogue: the
   `structure_context`/`GOVERNING_STRUCTURE` chapeau-segmenter machinery
   already exists (visible, computed, in every review-queue row) but isn't
   wired into `sourceParagraphForCandidate`, and `partyContextForCandidate`'s
   own chapeau walk-back (:5769-5784) isn't reused there either — the fix
   for pattern #1 already has a template sitting next to it in the same
   file.

## Coverage statement

All 66 non-CLOSING_CONDITIONS UNDIAGNOSED rows in my slice (348 occurrences)
are accounted for above, at one of three depths: (a) code-read + regex-
verified against actual quote/value pairs (ANTITRUST_REGULATORY template,
NO_SHOP template + period/prerequisite/action, GENERAL_COVENANTS,
DNO_INDEMNIFICATION, EMPLOYEE_MATTERS, TERMINATION, INTERIM_OPERATING
zero-matches, the day-count parser codes) — the large majority of
occurrences; (b) code-read, quotes pulled, mechanism characterized but not
individually regex-tested (FINANCING_COVENANTS, part of ANTITRUST_
REGULATORY's singletons); (c) register-location-only, explicitly flagged
**uncertain** and not diagnosed to a fix (TAX_MATTERS, TERMINATION_FEE
sole-remedy codes, the PROXY_MEETING/CONSIDERATION/GUARANTY_FINANCING_PARTY/
MERGER_STRUCTURE_CLOSING singleton tail, GENERAL_COVENANTS' `PARTY_
UNRESOLVED`, TERMINATION's `NO_CALENDAR_DATE`, FINANCING_COVENANTS'
`FINANCING_SCOPE_UNCORROBORATED`). Nothing in the slice was silently
dropped; category (c) is named explicitly rather than counted as diagnosed.
CLOSING_CONDITIONS is excluded entirely as already complete elsewhere.

