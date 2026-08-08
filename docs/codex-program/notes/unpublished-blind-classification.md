# Blind classification of unpublished candidates (96-item stratified sample)

**Date:** 2026-08-08
**Input:** `blind-sample.json` — 96 items, 8 apiece from the 12 largest failure
buckets, failure reasons removed. Judged cold, quote-by-quote, as a reviewing
M&A lawyer; the underlying agreements (raw fixture HTML, converted to text)
were consulted for every ambiguous quote. `resolution.json`, `blind-key.json`
and the resolver source were not read.
**Verdicts:** scratchpad `blind-verdicts.json` (all 96 ids, one verdict each).

## Counts

| Verdict | Count | Share |
|---|---|---|
| REAL | 58 | 60% |
| FRAGMENT | 32 | 33% |
| NOISE | 6 | 6% |
| UNSURE | 0 | 0% |

## Where the REAL items concentrate

By family (REAL / sampled):

- **MAE_DEFINITION 9/9.** Every sampled MAE carve-out is a complete,
  substantive carve-out (economic conditions, war/pandemic, GAAP changes,
  stock price, weather on an E&P deal). This is the paradigm content of the
  product and all of it was withheld.
- **CLOSING_CONDITIONS 13/14.** Bring-down standards (materiality scrape, de
  minimis capitalization standards, MAE-standard general bring-downs),
  no-MAE conditions including a reverse no-Parent-MAE condition, specified
  consents. Core conditionality terms.
- **TERMINATION 7/8.** Outside Date with the exact date, no-vote,
  recommendation-change, illegality/injunction triggers — all accurate
  standing alone. The one fragment (redhat breach termination) was clipped
  before its condition-failure/cure standard and overstates the right.
- **INTERIM_OPERATING (native IOC restrictions) 8/8.** Complete restricted
  actions: no charter amendments, no acquisitions, no issuances, no
  settlement of transaction litigation, no equity-award amendments.
- **DNO_INDEMNIFICATION 5/8**, **NO_SHOP 4/9**, **FINANCING_COVENANTS 4/8** —
  the REAL ones here are exactly the terms a deal-points survey tracks:
  six-year tail with a premium cap, advancement rights, four-business-day
  match negotiation, superior-proposal notice mechanics, comfort letters,
  50-day quarterly financials, credit-facility payoff at closing.
- **OPEN_WORLD_PROPOSITION 6/16.** The REAL ones are the carve-outs carrying
  negotiated economics: a $500K debt basket, a $50M acquisition basket, REIT
  dividend caps of $0.10/month common and $0.461/quarter preferred, and
  not-unreasonably-withheld consent standards.

Where the withholding is right: **REPRESENTATIONS qualifiers 0/8** (bare
"in all material respects" strings and severed MAE-qualifier lead-ins —
pure chaff, correctly held), plus generic exception preambles, bare
cross-references, and "after consultation with outside legal counsel".

## Read: is the withholding doing more good than harm?

**In these buckets, more harm than good, and it is not close.** Sixty percent
of the sampled held-back items are provisions a reviewing lawyer would want
surfaced, and they are not marginal ones — they are the Outside Date, the
bring-down standards, the entire MAE carve-out inventory, the match-right
mechanics. Extrapolated naively, roughly 750 of the 1,246 unpublished items
would be real provisions. Caveat: the sample is stratified 8-per-bucket, not
proportional, so the true share depends on bucket sizes; but with 9/9 MAE
carve-outs and 13/14 closing conditions withheld, no reweighting rescues the
result for those families.

The FRAGMENT third is mostly a **span problem, not a relevance problem**:
correct provisions clipped mid-clause — carve-outs severed from their
restriction, duration phrases severed from the obligation ("six years from
the Effective Time" without saying six years of *what*), "do so" and
"thereof" with the antecedent outside the quote. Widen the spans and much of
the fragment pile converts to REAL.

## Systematic mistakes worth fixing

1. **Whole high-value families withheld wholesale** (MAE carve-outs, closing
   conditions, IOC restrictions, termination triggers) while the quotes are
   complete and accurate. Whatever gate fires on these buckets is suppressing
   the product's core content.
2. **Span truncation that changes meaning.** Two dangerous cases: modiv's
   recommendation-inclusion covenant is quoted without its leading "Unless an
   Adverse Recommendation Change has been made", and redhat's breach
   termination is quoted without the condition-failure and cure limits. A
   clipped quote can overstate a right; span selection needs to keep leading
   conditions and trailing standards.
3. **Rep-qualifier candidates should probably not be generated at all** —
   0/8 usable; they are qualifier strings, not provisions.
4. **Duplicates reached the queue** (identical skywater MAE carve-out twice,
   identical modiv proxy quotes twice, identical redhat qualifier twice) —
   dedup upstream of resolution.
