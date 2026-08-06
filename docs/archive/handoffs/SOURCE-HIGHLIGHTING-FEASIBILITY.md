# Source highlighting on the original EDGAR filing — feasibility

Read-only investigation. No production code changed.

## 1. The conversion chain — two chains exist, not one

**Production chain (what every real deal today goes through, `scripts/ingest-agreements.js`):**

1. `fetchUrl(edgarUrl)` — raw HTML string, bytes discarded after decode.
2. `stripHtml(html)` — regex tag/entity stripper (`.replace(/<[^>]+>/g,'')` etc). Not position-preserving: deletes bytes and never records where.
3. `extractAgreementSection(text)` — regex-finds "AGREEMENT AND PLAN OF MERGER" etc. and **slices out everything before/after**. This alone destroys any hope of a byte offset into the original filing — most of the document (cover, TOC, other exhibits) is thrown away before storage.
4. Result stored as `deals.metadata.full_text` (`pages/api/agreement-source.js`), plus later marker insertion (`[[REF]]`/`[[DEFINED]]` tags) and `lib/edgar-cleanup.js: cleanEdgarText()` / `lib/parser-v2/structural.js: normalizeBoundaryNoise()` at parse time (`structural.js:136-138`, applied in that order — `cleanEdgarText` then `normalizeBoundaryNoise`).

None of steps 2-4 is position-preserving. Original HTML bytes are **never stored**.

**canonical-v2 chain (`lib/canonical-v2/sec-*.js`, a separate, staging-only track):**

1. `sec-edgar-intake-capture.js` — captures the exact HTTP response bytes, hashes them, refuses redirects/non-200/non-`text/html`.
2. `sec-html-canonical-text.js: convertSecHtmlToCanonicalText()` — a real hand-written HTML lexer (`lexHtml`) + canonicaliser (`canonicalise`) that tracks a **UTF-8 byte index for every character** (`byteIndex()`), walks tags vs text, decodes entities, collapses whitespace per an explicit tag policy — and emits a compact, deflate-compressed **source map**: `input_regions` (byte ranges + tag kind in the original HTML) and `output_mappings` (byte ranges in canonical text ↔ byte ranges in original HTML). This step **is fully position-preserving** — every transformation is tracked.
3. `sec-html-canonical-text-verifier.js` — an independent re-implementation that must produce byte-identical output (defense against a single buggy implementation).
4. `sec-source-admission.js` — wraps the above into `ImmutableSourceDocument` / `SourceAdmissionManifest` records.

## 2. Does a source map exist? — Populated, but only in an isolated staging track

Definitive answer: **the source-map mechanism is fully built and correct** (`lib/canonical-v2/sec-html-canonical-text.js`), but it is **populated only inside `canonical_v2_staging`**, a separate Postgres *schema* (`supabase/canonical-v2-foundation.sql:4`, `CREATE SCHEMA IF NOT EXISTS canonical_v2_staging`) on a separate staging project (`sjumbznveyyiizhwvixj`), guarded to refuse running against production (`sec-edgar-intake-capture.js:102-110`, `PRODUCTION_PROJECT_REF` check). It has never written a row for the `public` schema (`deals`, `provision_cards`) that the live product actually serves — grep across the repo finds zero call sites wiring `lib/canonical-v2/sec-html-canonical-text.js` into `scripts/ingest-agreements.js` or any other real-ingestion path.

The one script that runs the full conversion end to end (`scripts/canonical-v2-staging-sec-conversion.mjs`) is pinned to **one specific fixture document** (hardcoded `retrieval_url_sha256`/`response_bytes_sha256` for a QXO filing), runs inside `BEGIN TRANSACTION READ ONLY`, and its own output literally reports `persistence_status: 'NOT_WRITTEN'`. This is a proof-of-mechanism harness, not a populated corpus.

So: not "absent" as a design — the code is real, tested, and correct — but **absent from every row a user has ever clicked on**. Treat it as an unfilled slot for product purposes.

## 3. text-layers.js — maps *within* our own reconstructed text, not to the original HTML

`lib/parser-v2/text-layers.js: buildLayers(rawText)` maps between its own further-normalized `cleanText` (strips zero-width chars, stray `|` artifacts, standalone page-number lines, rejoins hyphenated line-wraps, straightens smart quotes/nbsp) and the `rawText` it's given.

That `rawText` is **already** several lossy, non-invertible steps downstream of the original HTML: `structural.js:136-138` calls it as `normalizeBoundaryNoise(cleanEdgarText(text))`, where `text` is the marker-laden `full_text` produced by the production chain in §1. `mapCleanToRaw` therefore maps *normalized text ↔ our-own-already-stripped text* — it gets us **zero distance** toward the original HTML. It cannot be reused for this feature.

## 4. Exact-text search — quantified against real data

Queried production (`tzulhdasmioeechxapdy`, read-only) — 1,000 real `provision_cards.primary_quote` rows checked against their own deal's marker-stripped `deals.metadata.full_text` (the same literal→whitespace-normalized method `lib/parser-v2/resolve-source-span.js: findInStripped()` already uses in production today):

| Outcome | Count | Rate |
|---|---|---|
| Literal exact substring match | 452 | 45.2% |
| Required whitespace normalization to match | 534 | 53.4% |
| No match at all (even in our own text) | 14 | 1.4% |
| Ambiguous (matched >1 time) among literal hits | 0 / 452 | 0% |

This measures noise **internal to our own pipeline only** — it is a floor, not a ceiling, for searching the true original HTML. Real HTML introduces additional breakage this sample cannot show, because `extractAgreementSection()` already discarded everything outside the agreement body before this text existed:
- **Whitespace/line-break policy mismatch** (already the dominant factor — 53% needed normalization even against our own text): our `<br>`/`<p>`/`<div>`/`<tr>`/`<td>` → newline/tab convention will not exactly match how a real EDGAR document renders spacing.
- **Inline markup splitting a quote mid-run**: `<b>`, `<i>`, `<font>`, `<span>` landing inside a quote's character span — structurally the same problem our own `[[REF]]`/`[[DEFINED]]` markers created, which `resolve-source-span.js` had to build a whole stripped-offset-map to solve.
- **Entity/quote-character encoding**: curly vs straight quotes, `&nbsp;`, CP1252 numeric entities — partially handled today, not exhaustively.
- **Scope**: our stored text is one excerpt of a possibly multi-document filing; a TOC, defined-terms index, or repeated recitals in the full filing could reintroduce duplicate matches that never appear in our already-narrowed corpus. The measured 0% ambiguity is likely optimistic for that reason.

## 5. Recommendation

**Do (a) first: exact-text search + disambiguator, against the original filing.** No schema or ingestion changes; works retroactively across the whole existing corpus (every deal already has `source_url`). Reuse the literal→whitespace-normalized method already proven in `resolve-source-span.js`; require a unique-or-near-unique hit (occurrence index / leading-context tiebreak), and render **no highlight** rather than a wrong one when ambiguous. Given the measured 98.6% overall match rate (with 0% observed ambiguity) against text at least as noisy as what real HTML will produce, expect the large majority of citations to resolve. This is a best-effort, visually-verifiable feature — not a cryptographic guarantee.

**Treat (b) — wiring the canonical-v2 source map into production — as the long-term correctness upgrade, not the next step.** The map itself (`sec-html-canonical-text.js`) is already built and independently verified. But shipping it requires: storing original response bytes going forward (currently not stored at all, §6); a full corpus re-ingestion to backfill every existing deal (the map only exists for new captures); and — the harder blocker — **fixing that `primary_quote_start`/`primary_quote_end` are not reliably correct against our own canonical text today** (`resolve-source-span.js`'s own header: "raw offsets essentially never address the right span"). A perfect canonical→HTML byte map is not useful until the canonical-text-side offset is trustworthy; right now the product resolves citations by exact-text search *in spite of* broken offsets, not because of trustworthy ones. Don't read canonical-v2 as "almost done" for this feature — it solves a different, harder problem than the one blocking this feature today.

**(c) not recommended as an alternative**: fuzzy/embedding-based matching was considered and rejected — it would trade a measurable, auditable failure mode (no-match / ambiguous) for a silent, unverifiable one, in a legal-citation context where a wrong highlight is worse than no highlight.

## 6. Product constraint — original bytes are not available at render time

Confirmed: production schema (`supabase/schema-*.sql`) has no `raw_html`/`source_html`/`original_bytes` column anywhere. `deals.metadata` holds only `full_text` (already lossy, per §1) and `source_url`/`agreement_title` (`pages/api/agreement-source.js:34-46`). **The original filing is not stored by the product today.**

Implication: rendering a highlight on the original document means fetching from `sec.gov` live via `source_url` (approach (a) above needs this too — there is no shortcut). Consequences:
- **Latency**: one extra network hop to EDGAR on click, unless pre-fetched/cached.
- **Availability**: dependent on SEC EDGAR uptime and its fair-access/User-Agent policy (already respected in `scripts/ingest-agreements.js`'s `fetchUrl`).
- **Mitigation is cheap**: EDGAR filings are immutable once filed — a fetch-once-cache-forever model (store the fetched HTML in Supabase Storage or blob storage on first successful render, keyed by `source_url`) removes both the latency and availability risk after a cold start, with no staleness concern. This is a small addition to option (a), not a reason to prefer (b).
