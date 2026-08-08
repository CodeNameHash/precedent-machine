# Step 2X-C follow-up: collision report analysis

Source: branch `cursor/step-2x-free-phase-b641` (fetched, not checked out),
commit `a5c363bff835c10df3c05c33dfec9a4e0759f8e2` and branch HEAD `0076f460`.
Files read via `git show <branch>:<path>` — no working-tree checkout, no edits.

## 1. Is GENERAL_COVENANT_CODE_DOUBLE_FIRE general, or general-covenants-only?

**General-covenants-only.** Raised in exactly one place:
`lib/canonical-v2/native-producer/candidate-resolution.js`, inside the
`genericKey.startsWith('NATIVE_GENERAL_COVENANT_')` branch (~line 10728-10767),
via `generalCovenantDoubleFireCode(quote, ownCode)` (defined ~line 4782,
imports `GENERAL_COVENANT_FOLLOW_ON_OWNERS` from `p0-product-surface-routing.js`).
It scans every *other* general-covenant code whose `owner_id` differs from the
asserted code's owner and, if that other code's primary pattern also matches,
routes the claim to `review_queue` (`pushReviewUnresolved`) with reason
`GENERAL_COVENANT_CODE_DOUBLE_FIRE`. It runs unconditionally, every run, not
gated behind the report script.

**Tax-cooperation has no equivalent.** `handleTaxMattersCandidate` (same file,
~line 10454-10495) calls `recordCorroborationCollision('tax_cooperation', …)`
against `taxCooperationPrimaryMatchingKinds`, but `recordCorroborationCollision`
(~line 4716) is a no-op unless the caller passed a `corroborationCollisionReport`
object in — true only for `scripts/canonical-v2-corroboration-collision-report.mjs`.
In every real resolution run this call is a silent no-op; nothing downstream
reads its result. There is no `taxCooperationDoubleFireKind` or any live gate
paralleling `generalCovenantDoubleFireCode`. `handleTaxMattersCandidate`
proceeds straight to `taxOpinionCooperationCorroborated(q)` /
`transferCooperationCorroborated(q)` and resolves on the first match.

**Guaranty and IOC have their own, structurally different, equivalents, and
they run *inside* the corroboration function itself** (unlike general-covenants,
where the guard is bolted on downstream in the resolver):
- `guaranty-corroboration.js`: `corroborateGuarantyKind` calls
  `guarantyObjectAmbiguity(quote)` even on the branch where the asserted kind's
  own pattern already matched (line 65-68) — ambiguity is checked
  unconditionally, not only as a fallback.
- `ioc-corroboration.js`: `corroborateRestrictionCategory` computes
  `categoryMatches(quote)` first and refuses on `matches.length > 1`
  regardless of what the model asserted (line 142-145) — same
  always-check shape.

**General-covenants' *own* corroboration function does not have this shape.**
`corroborateGeneralCovenantCode` (general-covenant-corroboration.js line 188)
returns `RESOLVED` immediately at line 195-197 the moment the asserted code's
own pattern matches — it never calls `generalCovenantPrimaryMatchingCodes` on
that branch, so ambiguity is invisible from inside the function whenever the
model's own code corroborates. The real cross-code check for general-covenants
lives entirely in `generalCovenantDoubleFireCode`, downstream in the resolver,
and it is owner-scoped (same-owner code pairs, e.g. COV-DELIST/COV-LIST, are
deliberately excluded, per the comment at line 4779-4781).

**Tax-cooperation's `corroborateTaxOpinionCooperation` /
`corroborateTransferCooperation`** have the identical own-kind short-circuit
(tax-cooperation-corroboration.js line ~112 and ~146: return `RESOLVED`
immediately if the asserted kind's own pattern matches) — and, unlike
general-covenants, there is no second-stage check anywhere else that would
catch what the short-circuit misses.

**Conclusion on Q1:** general-covenants has a live safety net
(`generalCovenantDoubleFireCode`, different-owner-pairs only);
tax-cooperation has none — its "zero collisions" is a claim about a scan that
ran once, over the current corpus, not a claim about anything that would
catch a collision a future pattern edit introduces. This is not a zero that
proves absence; it is a zero that means "the report-only scanner did not find
one this time, and nothing else is watching."

## 2. Do the double-fire guard and a corroboration-time ambiguity guard produce the same outcome?

**No — they diverge, though only one of the two actually ran in production
for these four quotes.**

For all four held quotes, `generalCovenantPrimaryMatchingCodes(quote)` returns
2 codes (that is exactly what the report's "matches" column records), and in
every case the *asserted* code's own pattern is one of the two matches. That
means, walking `corroborateGeneralCovenantCode`:
- line 195-197 fires first (own code's pattern matches quote) →
  `RESOLVED` immediately, `generalCovenantGroundingFailure` returns `null`,
  and the ambiguity branch (`AMBIGUOUS_GENERAL_COVENANT_CODE`, only reachable
  when the own-code check *fails*) is **never evaluated**. A corroboration-time
  ambiguity guard shaped like guaranty's/IOC's (checks ambiguity even when the
  asserted kind matches) would fire here; the guard as literally implemented
  in `corroborateGeneralCovenantCode` does not, and structurally cannot, for
  these four rows.
- Only the separate, downstream `generalCovenantDoubleFireCode` catches them,
  because it does not short-circuit on the own-code match — it always checks
  the other-owner codes.

So for these four rows specifically, the double-fire guard is not redundant
with anything — it is the *only* mechanism that holds them. Nothing is
double-counted or double-enforced.

**Where they would diverge if a guaranty/IOC-style unconditional ambiguity
check were retrofitted onto general-covenants' own corroboration function**
(i.e. if the `AMBIGUOUS_GENERAL_COVENANT_CODE` branch ran even when the own
code matches): the outcome would still differ from double-fire, on two axes:
- **Reason code**: `generalCovenantGroundingFailure`'s ternary at line
  4752-4754 collapses `AMBIGUOUS_GENERAL_COVENANT_CODE` to
  `GENERAL_COVENANT_CODE_UNCORROBORATED` either way (both branches of the
  ternary return the identical string — worth flagging on its own: that
  ternary currently has no discriminating effect). vs. double-fire's own
  distinct `GENERAL_COVENANT_CODE_DOUBLE_FIRE`.
- **Routing**: a non-null `generalCovenantGroundingFailure` result is consumed
  by `pushOpenWorld` (line 10741-10745) — the claim lands in the `openWorld`
  bucket, tagged AI-provenance, and is **not** part of `review_queue`. The
  existing double-fire path instead calls `pushReviewUnresolved` — the claim
  lands in `review_queue`, the bucket a human actually adjudicates. Open-world
  and review-queue are different product surfaces (the collision report
  itself separates "resolved+open_world" counts from "held (review-queue)"
  counts in its summary table), and nothing in this codebase promotes an
  open-world item to review automatically. An ambiguity guard wired through
  the existing `generalCovenantGroundingFailure`/`pushOpenWorld` plumbing
  would therefore **silently discard** these four claims from the reviewed
  product surface instead of holding them for a human — a materially worse
  outcome than what double-fire actually does today, not an equivalent one.

## 3. Are these pairs semantic overlap, or accidental overlap?

### Pair 1 — NOTIFY ↔ LITNOTIFY: semantic overlap

Deciding text (concho, § 6.11): *"the Company or Parent, as applicable, shall
promptly notify the other Party of such Transaction Litigation and shall keep
the other Party reasonably informed with respect to the status thereof"*; and
(topbuild, § 4.18, independently drafted): *"The Company shall promptly
notify Parent of any stockholder demands, litigations, arbitrations or other
similar Action … (the "Transaction Litigation") … and keep Parent fully
informed on a prompt basis…"*.

`COV-NOTIFY`'s pattern is `/\bpromptly\s+notify\b/i` — a real, narrowly-drafted
verb phrase, independently confirmed against 7 Modiv candidates per the
file's own header comment (not an accidental catch-all). `COV-LITNOTIFY`'s
pattern is `/\b(?:stockholder|transaction|securityholder)\s+litigation\b/i` —
equally specific to its subject matter. Both fire because the clause **is**
both things at once: the operative mechanism is an ordinary "promptly notify"
covenant, and its subject is specifically Transaction Litigation. Two
independent deals (concho, topbuild) use the identical drafting shape
("promptly notify … of [litigation], … keep [counterparty] informed"), which
is evidence this is the standard form for this covenant, not a one-off
coincidence a tighter regex would dissolve.

**What follows:** this is a taxonomy/precedence question, not a pattern bug.
COV-LITNOTIFY reads as the more specific subtype of the general notification
family (lex specialis) — the drafting convention in M&A general-covenants
sections is that a dedicated litigation-notification clause is usually
treated as its own covenant type even though it borrows ordinary notify
verbs. I'd lean toward **precedence to the more specific code (LITNOTIFY)
when both fire**, but this is genuinely a taxonomy owner's call: it decides
whether COV-NOTIFY's aggregate corpus counts should include litigation-notice
clauses at all. Refusing on multi-match (the framing this task was checking)
would be the wrong fix here, per Ben's hypothesis — it declines a claim that
is legitimately dual-coded.

### Pair 2 — 16B ↔ MERGESUB: accidental overlap

Deciding text (concho, § 6.15): *"Parent, Merger Sub and the Company shall
take all such steps as may be required to cause any dispositions of equity
securities of the Company … to be exempt under Rule 16b-3 under the Exchange
Act."*

`COV-16B`'s pattern (`/\bRule\s+16b-3\b/i`) is exactly on-topic. `COV-MERGESUB`'s
pattern is `/\bMerger\s+Sub\b[^.]{0,80}\bshall\b/i` OR `/\bcause\s+Merger\s+Sub\s+to\b/i`
— it does not require Merger Sub to be the grammatical subject of "shall", or
the clause to be substantively about Merger Sub at all; it fires on *any*
sentence that merely names Merger Sub as one of several joint obligors within
80 characters of the word "shall". `rubric.js` defines COV-MERGESUB as
"Merger Sub Compliance" / "Obligations regarding merger sub" — a covenant
substantively about Merger Sub's own conduct (e.g. not conducting other
business, remaining a wholly-owned subsidiary) — not "any clause that lists
Merger Sub as a co-obligor". Because "Parent, Merger Sub and the Company
shall…" is the standard tri-party joint-obligor drafting form used across
nearly every general covenant in a merger agreement, this pattern will fire
on almost any covenant that happens to bind all three parties jointly,
regardless of subject matter. Unlike COV-NOTIFY/COV-PUBLICITY/COV-ACCESS,
COV-MERGESUB carries no "confirmed against a real quote" comment in the
file's header — it is one of the "other 14 codes [with] no committed
candidate to ground against yet," patterns written narrow-by-guess rather
than corpus-grounded (per the file's own header, lines ~32-36).

**What follows:** tighten the COV-MERGESUB pattern to require substantive
Merger-Sub-specific content (e.g. "Merger Sub shall not engage in any
business activities other than…", "cause Merger Sub to perform its
obligations", "Merger Sub shall have no assets or liabilities other than…"),
not mere co-obligor proximity to "shall". This is a regex-engineering fix,
not a legal judgment call — though the taxonomy owner should confirm the
intended scope of "Merger Sub Compliance" before the pattern is rewritten.

### Pair 3 — PUBLICITY ↔ MERGESUB: accidental overlap (same root cause as Pair 2)

Deciding text (metsera, § 6.06): *"Parent and Merger Sub, on the one hand,
and the Company, on the other hand, shall consult with each other before
issuing … any press release or other public statements …"*

`COV-PUBLICITY`'s pattern (`press releases?` / `public statements?` /
`publicity`) is squarely on-topic and independently grounded against real
Modiv candidates. `COV-MERGESUB` fires for the identical reason as Pair 2:
"Merger Sub" appears as a co-obligor ("Parent and Merger Sub … shall
consult") within 80 characters of "shall", with zero connection to Merger
Sub's own compliance. Same fix as Pair 2 — this is the same overbroad
pattern causing two independent false collisions, not two separate defects.

## Contradictions / things that don't fit the framing above

- **Step 2X-C commit `a5c363bf` cites "Per DECISIONS.md §15" as authority
  for "do not enforce primary multi-match refusal," but no §15 exists.**
  `docs/core/DECISIONS.md`, read at both the collision-report commit and at
  the branch's current HEAD (`0076f460`), tops out at "## 14. Structure,
  determinism and the shape of Step 2X: DECIDED 2026-08-08" — there is no
  decision 15 anywhere in the file's history on this branch. Decision #14
  does not mention collision handling, multi-match refusal, or general
  covenants/tax cooperation at all. This citation is unverifiable as written
  — either a decision was intended but never actually recorded, or the
  citation is simply wrong. Whoever owns this should either add the missing
  §15 with real reasoning, or correct the commit's citation — right now the
  policy of "do not enforce refusal on multi-match" rests on a citation to a
  document section that does not exist.
- The two general-covenant guard mechanisms are easy to conflate because
  they sound like restatements of each other (`generalCovenantPrimaryMatchingCodes`
  vs. `generalCovenantDoubleFireCode`) but check different things (all-codes
  vs. different-owner-only) from different call sites (report-only collision
  recorder vs. live resolver branch) — exactly the kind of distinction the
  project's own CLAUDE.md warns gets confused in both directions here.
- `generalCovenantGroundingFailure`'s reason-mapping ternary (line 4752-4754)
  returns the identical string on both branches of the condition — it reads
  as if it should discriminate `AMBIGUOUS_GENERAL_COVENANT_CODE` from other
  failures but currently cannot; worth a look independent of this task.
