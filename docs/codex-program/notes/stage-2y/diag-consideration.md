# Diagnosis: 5 flagged CONSIDERATION cards

Branch: `origin/cursor/step-2x-free-phase-b641` (commit `7535782a`).
Method: read code at that ref via `git show <ref>:<path>`; reconstructed the
*real* canonical text for both fixtures by running the actual
`buildSecEdgarIntakeCapture` -> `convertSecHtmlToCanonicalText` pipeline
(`lib/canonical-v2/sec-edgar-intake-capture.js` + `.../sec-html-canonical-text.js`)
against the committed raw HTML fixtures, and verified the resulting
`canonical_text_sha256` against the value pinned in
`evidence/canonical-v2/concho-consideration-20260809-2xk-final/source-reference.json`
(`30d929c7...` — matched exactly). All regex tests below ran against that
verified text, not an approximation.

Core resolver file for all five cards: `lib/canonical-v2/native-producer/candidate-resolution.js`,
function `handleConsiderationCandidate` (~line 10480), dispatch table
`CONSIDERATION_RESOLUTION_MAP` (~line 601), corroboration helpers
`perShareContextCorroborated` / `exchangeRatioContextCorroborated` (~line 626).

---

## #55 — concho §3.1, EXCHANGE_RATIO_VALUE, ISSUER_STOCK_REF_NOT_IN_QUOTE

**Code path**: `handleConsiderationCandidate`, `assertionKind === 'EXCHANGE_RATIO'`
branch:
```js
const issuerStockRef = ... attrs.issuer_stock_ref ...
if (!issuerStockRef || !quote.includes(issuerStockRef)) {
  review('ISSUER_STOCK_REF_NOT_IN_QUOTE');
  return;
}
```
This fires and returns *before* the `parseExchangeRatio` / defined-term
fallback logic further down in the same branch is ever reached.

**Original text** (concho §3.1(b)(i), one paragraph, one clause):
> "...(such shares of Company Common Stock, the "Eligible Shares") shall be
> converted into the right to receive from Parent that number of
> fully-paid and nonassessable shares of Parent Common Stock equal to the
> Exchange Ratio (the "Merger Consideration"). As used in this Agreement,
> "Exchange Ratio" means 1.46."

The card's quote (`"Exchange Ratio" means 1.46.`) is only the second
sentence. The issuer-stock language ("shares of Parent Common Stock") is
in the immediately preceding sentence — same clause (i), same paragraph,
not even a different provision.

**Diagnosis**: the extractor captured a real span, but too narrowly — it
quoted only the trailing definitional sentence and dropped the operative
sentence one clause earlier that establishes what's being exchanged. The
check demands the issuer-stock reference *inside the quote itself*, and
this quote is definitionally never going to contain it (a `"Term" means
value` sentence has no shares language by construction). This is not
really "go find the operative provision elsewhere in the document" (Ben's
framing) so much as "the quote span excludes the very next clause of the
same sentence-pair" — an extraction/quoting-scope issue, but the practical
effect Ben describes (issuer-stock context lives outside this quote) is
correct.

**Fix — resolver-side, free**: `handleConsiderationCandidate`'s issuer-stock
check only looks at `quote` (`claim.raw_value`). The governing section's
full text is already available in this file (`sectionsByReference`,
`utf8Slice`, used elsewhere for marker/clause work). Change the
`ISSUER_STOCK_REF_NOT_IN_QUOTE` gate to also accept an issuer-stock
reference found anywhere in the *governing section text*, not just the
literal quote, when the quote itself matches the bare `"Term" means value`
definition pattern. No re-extraction needed; replay-validatable against
existing evidence.

---

## #56 — concho §3.2, EXCHANGE_RATIO_VALUE, NO_RATIO_LITERAL

**Code path**: same `EXCHANGE_RATIO` branch. `ratioTermRef` and
`issuerStockRef` checks pass (quote contains "Exchange Ratio" and "shares
of Parent Common Stock"). `parseExchangeRatio(quote)` fails to find a
numeral (quote only says "...multiplied by (ii) the Exchange Ratio"),
`parsed.outcome !== 'RESOLVED'`, reason `NO_RATIO_LITERAL`
(`lib/canonical-v2/native-producer/exchange-ratio-parse.js:45`). Code then
runs the existing fallback:
```js
const definition = uniqueQuotedDefinedTerm(admittedSourceContext, ratioTermRef);
if (definition && /^\d+(?:\.\d+)?$/.test(definition.value)) { ...finalize... }
review(parsed.reason); // falls through to here
```
`uniqueQuotedDefinedTerm` -> `uniqueDefinitionRecord` in
`lib/canonical-v2/native-producer/structured-per-share-cash-source-parser.js`:
```js
const matches = [...sourceText.matchAll(/(?:"|")TERM(?:"|")\s+means\s+([^;\r\n]+)/g)];
if (matches.length !== 1) return null;
const sourceCitation = definitionCitation(sourceText, match.index);
if (!sourceCitation) return null;   // <-- fires here
```
`definitionCitation` requires a *preceding* heading matching
`/Section\s+\d+(\.\d+)*\.?\s+Definitions/i`.

**Tested directly** against the verified canonical text: the `"Exchange
Ratio" means ...` pattern matches **exactly once** (`count: 1`) — the
fallback's uniqueness gate is satisfied. But `definitionCitation` returns
`null` because **no heading in the entire Concho document matches that
regex**: Concho's actual headings are "1.1 Certain Definitions" (no
"Section" token) and "ANNEX A / Certain Definitions" (no "Section N"
pattern, and it sits after the signature page — after §3.1 in document
order, and "Exchange Ratio" isn't even defined there). Verified with:
`[...text.matchAll(/Section\s+\d+(?:\.\d+)*\.?\s+Definitions/gi)]` → `[]`
(zero matches anywhere in the document).

**Diagnosis — Ben's specific sub-hypothesis tested and refuted**: #56's
failure does **not** depend on whether #55 was held. `uniqueDefinitionRecord`
re-scans the *entire canonical text* independently every time it's called
— it doesn't reuse or require any prior resolved claim from #55 or
anywhere else. It fails on its own, for a structural reason: its citation
step (`definitionCitation`) hard-codes one heading format
("Section N[.M] Definitions") that this document doesn't use anywhere,
so the whole fallback is silently disabled for Concho regardless of what
happened at #55. Ben's broader point — "there's an inheritance issue,
it's not going and reading the Exchange Ratio definition" — is correct in
effect, just not because #55 blocked it; the resolution mechanism that
exists never had a functioning path to a citation for this document at
all.

**Fix — resolver-side, free**: `definitionCitation` in
`structured-per-share-cash-source-parser.js` needs a heading regex (or a
fallback) that isn't tied to the literal string "Section N Definitions".
Options: (a) broaden the regex to also match "N.N Certain Definitions",
"ANNEX A"/"Certain Definitions" style headers; (b) when no qualifying
"Definitions" heading precedes the match, fall back to citing the nearest
preceding numbered section/clause marker (already computed elsewhere in
candidate-resolution.js for other families) instead of requiring a
Definitions-specific heading. Either is a regex/logic change inside
existing modules, no re-extraction, replay-validatable.

---

## #57 — concho §3.3, OPEN_WORLD_PROPOSITION

**Code path**: this candidate was never routed through
`handleConsiderationCandidate`'s HELD logic at all — it's a
`NATIVE_OPEN_WORLD_PROPOSAL`, meaning the CONSIDERATION producer prompt
itself (`open_world_candidates` bucket, `anthropic-provider.js`) proposed
this quote as not fitting any of the three closed assertion kinds
(`PER_SHARE_CASH`, `EXCHANGE_RATIO`, `APPRAISAL_STATUS`). There is no
resolver check to diagnose here — this is a model classification choice at
extraction time, not a deterministic hold.

**Original text checked**: quote is concho §3.3(g), "Distributions with
Respect to Unexchanged Shares of Parent Common Stock" — dividend
withholding-until-surrender boilerplate. I read the full surrounding
§3.3(g) paragraph in the verified canonical text: it states no per-share
cash amount, no exchange ratio, and contains **no `(x)`/`(y)` formula and
no CVR reference anywhere in it or nearby**. I also grepped the entire
canonical text for every `(x)`/`(y)` pair (18 hits) — none are within
§3.3 or relate to per-share consideration; they're all unrelated interim-
covenant carve-outs (Tax, dividends caps, indebtedness, etc.) elsewhere in
the agreement. Concho is a stock-for-stock deal (Exchange Ratio = 1.46
Parent shares per Company share, per #55/#56) with no CVR anywhere in the
document.

**Diagnosis — Ben's reading tested and does not fit this card**: Ben's
description ("the per-share is cash times shares times closing amount...
there's a Y here that's dropped... that's a CVR") exactly matches
**Metsera §2.02** (card #67 below — literal "(x) an amount of cash... (2)
the Closing Amount and (y) a number of CVRs..."), not Concho §3.3. Concho
has no Closing Amount, no CVR, and no `(x)/(y)` structure in or near §3.3.
This reads as Ben describing card #67/#89's structure while looking at
card #57's row — the two decks (concho stock deal, metsera cash+CVR deal)
appear to have been conflated. **No fix indicated for #57** — the
open-world classification looks correct: §3.3(g) states a payment-timing
mechanic, not a consideration amount, so it doesn't belong to any of the
three CONSIDERATION assertion kinds. Recommend flagging back to Ben that
his #57 note likely belongs with #67.

---

## #67 — metsera §2.02, PER_SHARE_CASH_CONSIDERATION, PER_SHARE_CONTEXT_UNCORROBORATED

## #89 — metsera §2.01, PER_SHARE_CASH_CONSIDERATION, PER_SHARE_CONTEXT_UNCORROBORATED

**Code path** (both): `handleConsiderationCandidate`,
`assertionKind === 'PER_SHARE_CASH'`, first gate:
```js
if (!perShareContextCorroborated(quote)) {
  review('PER_SHARE_CONTEXT_UNCORROBORATED');
  return;
}
```
```js
const PER_SHARE_CONTEXT_PATTERNS = {
  right_to_receive: /\bright to receive\b/i,
  cash: /\bin cash\b|\breceive cash\b/i,
};
function perShareContextCorroborated(quote) {
  return PATTERNS.right_to_receive.test(quote) && PATTERNS.cash.test(quote);
}
```
Both patterns must match **inside the single quote**. This fires first,
before `considerationTermRef`/`quote.includes`/`parsePerShareCash` are
ever reached — same shape of bug as #55/#56.

**Original text**, read together (this is a single continuous "Merger
Consideration" mechanism split across two sections):

- §2.01(c): "...shall be converted into the right to receive (i) $47.50 in
  cash, without interest (the "Closing Amount"), *plus* (ii) one (1)
  contractual contingent value right per share of Company Common Stock..."
- §2.02(b): "...the holder of such Certificate or Book-Entry Shares (as
  applicable) shall be **entitled to receive in exchange therefor** (x) an
  amount of cash equal to the product of (1) the number of shares of
  Company Common Stock theretofore represented by such Certificate or
  Book-Entry Shares and (2) the Closing Amount and (y) a number of CVRs
  equal to the number of shares..."

**Card #89's quote** (`$47.50 in cash, without interest (the "Closing
Amount")`) is truncated *before* "the right to receive (i)" — so it has
the cash pattern but not "right to receive," even though that exact phrase
is two words earlier in the same sentence of §2.01(c).

**Card #67's quote** (`(x) an amount of cash equal to the product of (1)...
and (2) the Closing Amount`) is drawn from §2.02(b), which uses "entitled
to receive... in exchange therefor" (not the literal string "right to
receive" — that phrase lives in §2.01(c), cross-referenced from §2.02(b)
via "Section 2.01(c)") and "an amount of cash equal to" (not "in cash" /
"receive cash" — so the `cash` pattern also fails on this fragment,
despite the word "cash" appearing twice).

**Diagnosis**: this is exactly Ben's hypothesis, confirmed on the text.
Legally this is one fact (Merger Consideration = $47.50 cash + 1 CVR per
share, mechanically paid per the §2.02 formula) split by the drafters
across a rights-granting section (§2.01) and a payment-mechanics section
(§2.02) that deliberately restates the formula using the defined term
"Closing Amount" instead of repeating "right to receive." Neither
individual quote alone satisfies `perShareContextCorroborated`'s literal
two-pattern gate, even though together — or with a slightly wider
quote in each case — they plainly do. This is also, independently of
cross-referencing, a real regex-brittleness problem: "entitled to receive
in exchange" and "an amount of cash equal to" are common, unremarkable
merger-agreement phrasings that a fixed two-literal regex doesn't cover.

**Fix — resolver-side, free, two parts**:
1. Broaden `PER_SHARE_CONTEXT_PATTERNS` to accept the phrasing variants
   actually seen here: `right_to_receive` should also match `/\bentitled to receive\b/i`
   (in addition to the narrower "converted into the right to receive"
   phrasing), and `cash` should also match `/\bamount of cash\b/i` (not just
   the literal "in cash"/"receive cash" substrings). This alone would very
   likely clear both #67 and #89 without touching extraction.
2. Structural fix matching Ben's "read them together" instruction directly:
   when a `PER_SHARE_CASH` candidate's own quote fails corroboration but
   its `consideration_term_ref` (e.g. "Closing Amount") is a defined term
   that resolves elsewhere in the document (via the existing
   `uniqueQuotedDefinedTerm` machinery, once #56's citation-heading bug
   is fixed) or the quote cites a specific cross-referenced section (e.g.
   "Section 2.01(c)") already known to the resolver, corroborate using the
   union of the quote and that referenced section's text rather than the
   quote alone. This is more work but stays inside
   `candidate-resolution.js`/`structured-per-share-cash-source-parser.js`
   — no prompt change, no digest invalidation.

---

## Cross-provision hypothesis — verdict: correct, and it explains most of the corpus's related holds

Ben's framing — that a definition (`"Exchange Ratio" means 1.46`, or a
Closing Amount established in one section) and the operative provision
that uses it are one legal fact routinely split across two locations, and
that checks demanding both halves inside a single quote will fail on
well-drafted agreements — is **directly confirmed** by #55/#56/#67/#89.
(#57 is a real miss but not evidence for this hypothesis — see above.)

**Corpus count** (7 deals' current/"-2xk-final" CONSIDERATION runs under
`evidence/canonical-v2/`: concho, metsera, modiv, redhat, skechers,
skywater, topbuild — counted directly from each `review-queue.json`):

| reason | count |
|---|---|
| `ISSUER_STOCK_REF_NOT_IN_QUOTE` | 1 |
| `NO_RATIO_LITERAL` | 4 |
| `PER_SHARE_CONTEXT_UNCORROBORATED` | 10 |
| **total** | **15** |

Total CONSIDERATION review-queue items across those same 7 runs: **30**.
So these three reasons alone account for **15/30 (50%)** of all
CONSIDERATION holds in the current corpus — this is not a two-card
anomaly, it is the dominant failure mode of the CONSIDERATION family right
now, present on 6 of 7 deals (only modiv shows zero on these three codes
in its latest run).

## Does a definition-resolution mechanism already exist, and can CONSIDERATION reach it?

Two separate things exist, and neither gives CONSIDERATION real
cross-provision resolution today:

1. **A private, narrow lookup local to CONSIDERATION/PER_SHARE_CASH**:
   `uniqueQuotedDefinedTerm` / `uniqueDefinitionRecord` in
   `lib/canonical-v2/native-producer/structured-per-share-cash-source-parser.js`.
   It re-scans the *entire* canonical text for a `"Term" means value`
   pattern on every call (no caching/reuse of any other family's output),
   requires a uniquely-matching occurrence, and additionally requires a
   citation derived from a hard-coded "Section N[.M] Definitions" heading
   regex. Verified this citation step fails on the entire Concho document
   because Concho's headings don't match that pattern (#56 above) — so
   this mechanism, though wired into the EXCHANGE_RATIO and PER_SHARE_CASH
   branches, is non-functional for at least one of the two fixture deals.

2. **`definition_cross_references`**, the field the KEY_DEFINED_TERMS
   producer prompt and two *other* families (`MATERIAL_CONTRACTS` via
   `materialContractGroundingFailure`, `GENERAL_COVENANTS` via
   `generalCovenantGroundingFailure`, both in `candidate-resolution.js`)
   read. In both places it is used only as a **negative** signal — "if the
   model flagged unresolved cross-references, hold the claim" — never as a
   positive resolution source that fetches a KEY_DEFINED_TERMS claim's
   resolved value and substitutes it in. `handleConsiderationCandidate`
   does not reference `definition_cross_references` or `definition_uses`
   at all — grep of the function and its call graph shows zero occurrences.

3. **KEY_DEFINED_TERMS itself never captured this specific fact for
   Concho anyway.** Checked
   `evidence/canonical-v2/concho-key-defined-terms-20260809-2xk-final/`:
   only one native-producer response file exists
   (`native-producer-recorded-response-Annex_A.json`) — the section
   classifier dispatched only Annex A to the KEY_DEFINED_TERMS family.
   "Exchange Ratio" is defined inline in §3.1, not in Annex A, so
   KEY_DEFINED_TERMS's own resolution.json has zero mentions of "Exchange
   Ratio." Even a hypothetically wired-up cross-family resolver would find
   nothing to borrow from for this specific fact, on this specific run.

**So: no general definition-resolution mechanism is being bypassed here —
none exists that CONSIDERATION could reach.** What exists is (a) a
narrow, currently-broken, CONSIDERATION-local fallback, and (b)
definition_cross_references, which is present elsewhere in the codebase
but wired as a pure hold-trigger, not a resolver, and not touched by
CONSIDERATION at all. Building real cross-family definition resolution
(CONSIDERATION reading a KEY_DEFINED_TERMS-resolved claim) would be new
work, not a rediscovery of dormant wiring — worth flagging given this
project's documented habit of rebuilding what already exists: this really
would be new, not a rebuild, but the section-classification gap (item 3)
should be fixed or at least understood before investing in it, since it
would otherwise starve the new mechanism of input on documents like
Concho.
