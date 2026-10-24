# Compare and market position: implementer task brief

Written 2026-10-23, in a parallel chat while the manager session runs. This is
a task brief, not a plan authority and not a status document. It assumes the
scoping note `COMPARISON-AND-MARKET-POSITION-SCOPE-2026-10-23.md` and turns it
into work an implementer can start from.

## Visual source

The visual source of truth is the **PW redesign comp**, not the earlier
black-rail mockups:

- `reports/mockups/corpus-pw/corpus-pw-compare-2026-10-23.png` — desktop comp.
- `reports/mockups/corpus-pw/corpus-pw-compare-mobile-2026-10-23.png` — phone comp.
- `reports/mockups/corpus-pw/corpus-pw-compare.html` and
  `corpus-pw-compare-mobile.html` — the comp sources.
- `reports/mockups/corpus-pw/DESIGN-NOTES.md` — the tokens, type and rules.

The integration states I added, using its classes and tokens:

- `reports/mockups/corpus-pw/integration/corpus-pw-compare-integration-2026-10-23.html`
- `reports/mockups/corpus-pw/integration/corpus-pw-integration-draft-2026-10-23.png`
- `reports/mockups/corpus-pw/integration/corpus-pw-integration-adjust-2026-10-23.png`
- `reports/mockups/corpus-pw/integration/COORDINATION-NOTE-2026-10-23.md`

Earlier functional mockups (superseded visually, retained for the interaction
states):

- `reports/mockups/corpus-pw/corpus-pw-compare-2026-10-23.png`
- `reports/mockups/corpus-pw/corpus-pw-compare.html`
- `reports/mockups/corpus-pw/DESIGN-NOTES.md`
- `reports/mockups/corpus-pw/integration/corpus-pw-compare-integration-2026-10-23.html`
- `reports/mockups/compare-market-mockup-2026-10-23.html` and `.png`
- `reports/mockups/compare-market-twodeals-2026-10-23.png`
- `reports/mockups/compare-market-draft-2026-10-23.png`
- `reports/mockups/compare-market-sidebar-2026-10-23.png`
- `reports/mockups/compare-market-sidebar-categorical-crop-2026-10-23.png`

The PW biopharma bundle is the source of the year/size adjustment pattern:
`/Users/bengoodchild/Downloads/pw-biopharma-market-bundle.zip`.

All deal names, numbers, clause text and reference-set counts in the mockup are
illustrative. They are not real deal data and not legal advice.

---

## 0. The one-paragraph brief

Build a read-only **comparison** of a deal against a reference set (or two
deals side by side) on the same provision table, and a **market position** for
the provision's cells, computed over that set. The deal side can be a
processed agreement or a **draft clause** the lawyer brings. Start from the
agreements' own bytes, structure, definitions and review trail — not from the
published summary or the coded cell alone. Every comparison point and every
market point must open on the exact source words. Always show `n`, the
composition and the range; do not hide the distribution or the label, do not
pool different units or vocabulary versions, and do not treat a missing fact
as a negative; no threshold decides whether to flag. The professional user is
an M&A partner or knowledge lawyer who will be cross-examined on the answer;
the product's job is to make the answer defensible in under two minutes, not
to give advice.

### 0.1 The primary unit: the provision

A **provision** is the clause or term the lawyer is looking at — "Company
termination fee", "Notice of superior proposal". It is the row, and the
primary unit of navigation and comparison.

A **fact** is one independently operative legal effect inside the provision.
A provision can have several. A **cell** is one coded attribute of a fact
(amount, trigger, payer, period). The market number is computed per cell, but
the cell never becomes the navigation: it is the detail under the provision.

The screen is provision-first: the provision column, the deal you are looking
at, how it compares, and the words. That is what "distribution first vs words
first" was trying to ask; the answer is neither — the provision comes first,
with its words and its comparison together.

### 0.2 The reference set is a first-class object

The lawyer picks the corpus to compare against. It is either:

- a **saved filter** over the corpus — "across the whole corpus", then size,
  industry, year, structure, public/private, sponsor/strategic; or
- a **hand-picked set** of deals; or
- **two deals** side by side.

A reference set has a name, a definition, an `n`, and a date. It can be saved
and reused. Every number on the screen is computed on the reference set, and
the screen says which one. The product ships prebuilt sets by industry ("Biotech"), by lawyer
("Barshay", meaning any deal with that lawyer) and by size ("$1bn+"), plus
"across the whole corpus" and "last three years"; the lawyer can refine,
adjust the bands and replace them.

---

## 1. The professional and the job

### 1.1 Who the product is for

**Primary: the M&A partner or counsel** at a top firm, and the **knowledge
lawyer / professional support lawyer (PSL)** who maintains the firm's
precedents and playbooks. The first use case is **precedent and research**:
finding provisions like the one being drafted, seeing how peers did it, and
getting ideas. The market position is the second read of the same comparison. They are accountable for the advice, they have used
every market-intelligence tool available, and they do not trust a black box.

**Secondary:** the associate drafting the first mark-up; the in-house legal
and corporate-development team checking a term; the client reading a board
paper (read-only, no editing).

**What "top" means here:** they are not looking for a summary. They are
looking for the smallest defensible answer to "is this term market, for deals
like this, and what are the alternatives?" — with the words, the sample and
the date attached.

### 1.2 The workflow the product has to fit

| Stage | What triggers the question | The question in their words | What they do today | What the product must do | What it must not do |
| --- | --- | --- | --- | --- | --- |
| Pitch / pre-mandate | A new deal or a sector pitch | "What's market in this sector at the moment?" | Partner memory, recent deals, Practical Law, a junior's research | A fast, sourced overview with a stated sample | Pretend a 5-deal sample is the market |
| Precedent selection | The first draft is being commissioned | "Which deals are comparable to this one?" | Search EDGAR / Intelligize / Deal Point Data, ask the PSL, pull the firm's precedent bank | A reference set the lawyer can choose and see: industry, lawyer/team, size, year, structure, public/private, sponsor/strategic | Force one reference set on everyone |
| First draft | The associate starts the clause, or brings a draft clause | "What is the starting position? How does my draft compare?" | Copy a recent precedent, adapt, ask the PSL | Paste or upload the draft, align it to the provision, show the range of formulations and the exact words | Generate or recommend clause text |
| Negotiation | The other side proposes a term | "Is this ask off-market? What is the fallback?" | Compare to a handful of deals, call the PSL, check the playbook | Position in the distribution, the peer formulations, the aggressive/conservative ends | Call something "off-market" on n=2 |
| Client / board advice | A memo, a board paper, a fairness discussion | "Can I cite this? What is the range and the sample?" | A table in Word, citations to deals, a footnote on methodology | A memo-ready table with sources, dates, n, exclusions and method | Hide the sample or the coding |
| Committee / execution | A condition, a fee, a termination right is being finalized | "Is this within range? What did comparable deals do?" | The same research, under time pressure | The same answer, faster, with the exact clause | Give legal advice or a recommendation |
| Knowledge capture | A deal closes | "Update the playbook; what changed?" | The PSL updates the bank manually | Save the reference set, annotate, export, compare over time | Silently overwrite the prior position |

### 1.3 What they actually want, ranked

1. **A defensible position for one provision**, with a reference set they
   chose and can see.
2. **The exact words and context** behind every point — clause, definitions,
   cross-references, provisos.
3. **A range and a distribution**, not a single "market" number.
4. **The alternatives**: what the aggressive end, the middle and the
   conservative end look like, in words.
5. **A citation-ready output**: a table or paragraph they can put in a memo
   with sources and a method note.
6. **Trust signals**: n, exclusions, coverage, date, coding protocol, who
   reviewed it.
7. **A reference set they can save, share and reuse** — the firm's playbook,
   not a generic market.
8. **Trend over time** — what changed after 2022, after a sector shock.
9. **Speed**: seconds to the first answer, under two minutes to a citable one.
10. **A way to find provisions like mine** and see the alternative
    formulations, not just a number.
11. **Confidentiality and auditability**: who saw what, when, and on which
    release.

### 1.4 What would make them reject it

- A "market" label on a sample of two or three with no `n` shown; a hidden
  sample or a hidden distribution.
- A summary with no words behind it.
- A comparison that pools a cash deal with a stock deal, or a 30-day period
  with a 30-day look-back, without saying so.
- A missing fact counted as "No".
- Stale data with no date.
- No export; a table they have to retype.
- A black-box score, or a recommendation ("you should accept this").
- A tool that is slower than calling the PSL.
- A tool that cannot say "I don't know" or "not enough data".

### 1.5 The limitation to design around

The product sees the **filed end-state** of a negotiation. It does not see the
counterparty's mark-ups, the client's risk appetite, the deal team's strategy,
the disclosure letter (often unfiled), or the firm's private precedent bank.
A top professional's "market" is informed by all of those.

So the product must say what it is: **the filed-agreement market**, a
descriptive baseline, not "what the market will accept". The best version of
the product helps the lawyer place the filed deals in context and then apply
their own judgment. It must never imply it has seen the negotiation.

### 1.6 Workflow questions to ask Ben (the short list)

These are the ones that change the build. The full questionnaire is in
section 6.

1. Walk me through the last time you answered "is this market?" — what
   triggered it, what did you do, how long did it take, what did you produce?
2. Which stage is the product for first: precedent/research, first draft,
   negotiation, client/board advice, or knowledge capture?
3. What makes a deal comparable to you? Rank: structure, size, sector,
   public/private, sponsor vs strategic, year, jurisdiction, the deal team.
4. When you start a new provision, what do you do first: search for
   precedents, read the clause, or look at a comparison table?
5. How should a thin sample read? The screen always shows `n` and the range;
   do you want a sentence such as "3 deals: read the range", or just the
   number?
6. What would you need to cite this in a client memo or board paper — and in
   what format (Word table, Excel, PDF, a paragraph)?
7. Who else uses it, and what do they need? (Associate, PSL, partner, client.)
8. What do you use today, and what is missing from it?
9. Which prebuilt reference sets do you want first — all, same industry,
   same size, same structure, last three years — and do you need to save
   your own?
10. Do you need negotiation posture (who proposed, what changed), and do you
    have it anywhere the product could see?
11. Word, Excel, or both for the export? What does the Word table look like
    in your memo today?

---

## 2. Start from the rawest material, not the digested layer

### 2.1 The principle

The rawest material is the filing, not the product. The published summary,
the coded cell, the table row and the vocabulary are a **digested index**. They are useful for filtering, counting and navigation.
They are not the source of truth. The coder starts from:

1. the agreement's bytes and canonical text;
2. its structure and exact spans;
3. the clause in its full context (chapeau, definitions, cross-references,
   provisos, exceptions);
4. the filing and deal context;
5. the lawyer's review trail;
6. the population the agreement was drawn from.

If the code and the words disagree, **the words win**. If the sample and the
claim disagree, **the sample wins**. If the summary and the clause disagree,
**the clause wins**.

### 2.2 The raw material inventory

| Layer | Raw material | Where it is | What it gives the coder | What the digested layer hides |
| --- | --- | --- | --- | --- |
| **Source bytes** | The SEC exhibit's raw response, canonical text, source map, hashes, retrieval and final URL | `product_source_documents.payload` (`raw_bytes_base64`, `canonical_text`, `source_map_payload_base64`, `raw_sha256`, `retrieval_url`, `final_url`, `response_headers`) | The only authoritative text; byte offsets; proof of identity | The summary is a paraphrase; the code is a label |
| **Structure** | Article/section/annex/exhibit nodes, authored order, spans | `product_agreement_structures.payload`; `product_source_spans` | The clause's home, its neighbours, its scope | The table row is a legal-shape abstraction |
| **Clause context** | Operative text, chapeau, definitions, transitive cross-references, full section span | `product_source_closures`; `lib/product/source-context.js` | The meaning a naked clause quote loses | The summary compresses the qualifiers away |
| **Facts and components** | The model's proposed fact: headline, components with byte offsets, origins (`OWN`, `CHAPEAU`, `DEFINITION`, `CROSS_REFERENCE`), children, validation status, issues | `product_proposals.payload`; `product_fact_components`; `product_fact_headlines` | The reading, with its evidence and its failures | A published fact hides the held/rejected siblings |
| **Conclusions** | `table_key`, `row_label`, `row_detail`, `cells` (code, value, text, present, component ids) | `product_fact_conclusions`; proposal payload (the only place `row_detail` survives) | The coded index and the link back to components | A cell looks like an answer; it is an index |
| **Review trail** | Decisions (accepted, edited, rejected), comments, revisions, who and when | `product_review_sessions`, `product_review_actions`, `product_draft_revisions` | What the lawyer changed and doubted; the closest thing to negotiation posture | A published release hides the debate |
| **Deal identity** | Parties, roles, agreement date, filing accession, exhibit filename, revision status | `product_source_documents.payload` (`parties`, `agreement_date`, `filing_accession`, `exhibit_filename`, `revision_status`) | A name and a date for the comparison, and the amendment/restatement question | The current read labels the deal by URL |
| **Notice section** | The Notices provision's party blocks: "if to Parent: … with a copy to: <firm>, Attention: <lawyer>" | The product's canonical text / Notices section; the legacy `deals.metadata.advisors_v2`; `lib/parser-v2/notice-advisors.js` | Each side's outside counsel and the lawyers named in the block | A summary hides who acted, and the current product does not store it |
| **Deal economics** | Value, per-share consideration, structure, premium, financing | **Not reliably in the product.** Use the 8-K/press release, the proxy, the tender offer documents, the agreement's own recitals | The denominator for money comparisons; the deal-type context | A raw dollar amount is meaningless without it |
| **Amendments / restatements** | Original, amendment, restatement, the changed clauses | `revision_status`; multiple `product_source_documents`; EDGAR filings | Which text is operative; what changed | A single "current" agreement hides the history |
| **Negative examples** | Agreements with no fact, no row, a residual pass, a coverage assertion, a held fact | `product_coverage_assertions`, `product_residual_passes`, `product_issues`, `product_proposals` (INVALID) | The difference between "not stated" and "not examined" | A missing row looks like "No" |
| **Corpus frame** | The population: all merger agreements filed in a period, the inclusion rule, the sample | **Outside the product**: SEC EDGAR full-text search and submissions API; the deal list; the firm's bank | The true denominator; the selection bias | The product's runs are a convenience sample, not the market |
| **Coding protocol** | Schema version, prompt bundle, model config, table-shapes version, instructions | `product_analysis_runs` (`schema_version`, `prompt_bundle_version`, `model_config`); `product_model_calls`; `contracts/product/*` | Reproducibility; what the code means | A code without its definition is not evidence |
| **Draft clause (new)** | The lawyer's paste, `.docx` or `.pdf`; canonical text; the original; a hash | The user's input, held under the user's account | The clause being drafted, as the "your deal" side | It is not a published fact and never enters the corpus |
| **Precedent mark-ups** | The firm's own prior mark-ups, the other side's drafts, the negotiation history | **Usually not available** — the firm's bank, the deal team, the client | The real "what changed and why" | The filed agreement is the end-state only |

### 2.3 What not to start from

- The published `headline.summary` alone. It is a reading, not the clause.
- The coded cell alone. It is an index, not the answer.
- The table shapes as if they were complete. They are a hypothesis about the
  market's axes; the raw clauses test them, and a row the shape lacks is a
  finding, not a gap to force.
- The two or three runs currently in the product as "the market". They are a
  convenience sample.
- The legacy `ai_metadata.features` registry. It is a different data model.
- The model's statement as the fact. The components and the bytes are the
  fact; the statement is a summary of them.

### 2.4 Five exercises to run before writing product code

These are cheap and they will change the design.

1. **Read five agreements end to end.** Mark every place a lawyer would ask
   "is this market?" Build the list of real questions from the text, not from
   the table shapes.
2. **Hand-code a gold set.** Twenty provision–deal observations (four per
   agreement across five agreements), coded twice by two people, with a
   written codebook. Measure agreement (Cohen's kappa)
   and the disagreements. Compare the hand codes to the extractor's.
3. **Build one population frame.** For one provision (say, the termination
   fee), list every merger agreement filed in a stated period from EDGAR,
   apply an inclusion rule, and count the true denominator. Compare it to the
   product's sample. The difference is the selection bias.
4. **Trace one cell to its bytes.** Take a published cell, open its
   `component_ids`, resolve each to `source_span_id` and byte range, and read
   the clause. Do this ten times. Every failure is a data-model defect.
5. **Sit with a lawyer for an hour.** Watch them answer one market question
   with their current tools. Time it. Note every tab, every copy-paste, every
   doubt. That is the workflow the product must beat.

---

## 3. The specific methods and tools

### 3.1 Legal research and coding methods

| Method | What it is | How to use it here | Tool / artefact |
| --- | --- | --- | --- |
| **Doctrinal coding protocol** | A written codebook: each field, its definition, inclusion/exclusion rules, examples, negative examples, edge cases | Derive from `table-shapes.v3` and the legal schema, then test against the raw clauses; version it | `codebook.v1.md`, `contracts/product/table-shapes.v3.json` |
| **Two-coder gold set** | Two independent coders code the same provisions; disagreements are adjudicated | 20 provision–deal observations (four per agreement across five agreements), each coded twice; measure percent agreement and Cohen's kappa; log every adjudication | `gold-set.json`, `adjudications.md` |
| **Sampling frame** | The defined population from which deals are drawn | EDGAR full-text search + submissions API; inclusion rule (form type, date, deal type, size); document exclusions | `frame.sql`, `frame.csv` |
| **Reference-set definition** | A named, reproducible selection: the filter, the dates, the `n`, the included and excluded agreements | The lawyer picks it; the product records it; every number carries it | `reference-set.json`, UI reference-set bar |
| **Stratification** | Split the reference set by deal type, size, sector, year before comparing | Never pool cash and stock, or a tender offer and a one-step merger, without a stratum | `reference-set.json`, UI reference-set line |
| **Sensitivity analysis** | Recompute with different reference sets, leave-one-out, alternative definitions | Show whether the label survives the reference-set change; if it flips, say so | `sensitivity.md` |
| **Comparability gates** | Explicit rules for when two observations may be pooled | Same table, row, column, unit, semantic basis, vocabulary version, applicability | `comparability.ts` / `.js` |
| **Absence taxonomy** | `PRESENT`, `ABSENT_CODED`, `NOT_APPLICABLE`, `NOT_STATED`, `UNKNOWN`, `HELD` | Every metric's denominator is the answering agreements only | `states.ts` / `.js` |
| **"Filed market" framing** | The product sees the filed end-state, not the negotiation | Say it in the UI and in every export; never imply "what the market will accept" | Method note in the UI |

### 3.2 Statistical methods

| Method | Use | Guardrail |
| --- | --- | --- |
| **Prevalence with Wilson interval** | "9 of 14 deals" with a confidence band | Show the count, the interval and the composition |
| **Median with bootstrap interval** | Numeric/period/percentage market position | 1,000 resamples, seeded; show the interval, not just the point |
| **Percentile rank** | "p42 of 14" | `(count below + 0.5 × count equal) / n`; show the counts |
| **Dot plot / histogram** | The distribution the lawyer reads | Every point labelled with its deal; no smoothed curve |
| **Sample-size line** | Always show `n`, the composition and the range; no threshold suppresses or flags the label | Every result carries `n`; the label is descriptive |
| **Leave-one-out** | Does the label depend on one deal? | If it flips, do not label |
| **Stratified comparison** | Cash vs stock, large vs small, sponsor vs strategic | Show the stratum sizes; no pooled label if the strata differ |
| **Money normalisation** | % of deal value or equity value | Same basis only; otherwise raw with a warning |
| **No causal claims** | "Deals after 2022 are more likely to…" is not causation | Descriptive language only |

Do **not** run a significance test and call the result "market". The sample
is a convenience sample of filed deals; the output is descriptive.

### 3.3 Text and NLP methods

| Method | Use | Tool |
| --- | --- | --- |
| **Byte-offset spans (UTF-8)** | Every quote resolves to a byte range in the canonical text | `lib/product/agreement-structure.js`, `lib/product/source-context.js`, `source_span_id` |
| **Exact substring + word-run matching** | Verify a component's quote against its span; relocate a quote only by the documented rule | `lib/product/fact-components.js`, `resolveEvidenceQuote` |
| **Clause segmentation** | Section, subsection, proviso, exception, definition | `deterministic-sectionizer`, `AgreementStructure` |
| **Draft parsing** | `.docx` text extraction, `.pdf` text layer, `.txt`, canonicalise, keep the original and a hash | `mammoth`, `pdfjs-dist` (already dependencies) |
| **Notice-block parsing** | Split "if to …" blocks; capture the firm and the "Attention:" lawyers per side; canonicalise the names | `lib/parser-v2/notice-advisors.js`, `lib/canonical-advisors.js` |
| **Definition / cross-reference graph** | Pull the defined terms and cross-references that change the clause's meaning | `source-context.js`, closure spans |
| **Word-level diff** | Compare two agreements' words exactly | `diff-match-patch` (or a small LCS implementation) |
| **Candidate retrieval (later)** | Find agreements that might have the provision | BM25/TF-IDF first; embeddings only with a gold-set check |
| **LLM extraction with span verification** | The existing extractor; never the final market number | `lib/product/agreement-draft.js`; reject a component with no byte span |
| **No semantic diff in v1** | Similarity is not equivalence | Deferred to precedent tracing |

### 3.4 Engineering tools

| Concern | Tool / pattern | Where it fits |
| --- | --- | --- |
| **API** | Next.js API routes, authenticated by session or `PRODUCT_INTERNAL_TOKEN` | `pages/api/product/compare.js`, `market.js` |
| **Store** | Supabase Postgres via `@supabase/supabase-js`; SQL views for the read | `lib/product/phase-3-store.js`, a new `comparison-store.js` |
| **Cell flattening** | A SQL view or a materialised `product_release_cells` (`run_id, proposal_id, table_key, row_label, column_id, code, canonical, unit, component_ids`) | At tens of deals, a view over `product_fact_conclusions` is enough; add a table at hundreds |
| **Indexing** | GIN on `cells` JSONB; B-tree on `(table_key, row_label)` | Only when the scan is measurable |
| **Validation** | Zod or Ajv for the API contracts; the existing JSON-schema validators | `contracts/product/*.json` |
| **UI** | React 18, Tailwind, the product's table grammar; TanStack Table only if sorting/filtering outgrows the current table | `pages/query/compare.js`, `components/product/*` |
| **Charts** | D3 or Recharts for the dot plot/histogram; SVG for the mini distribution | The market panel |
| **Tests** | `node --test`; fixture stores; page-body render tests like `tests/product-published-facts-query.test.js` | `tests/product-compare.test.js`, `tests/product-market.test.js` |
| **Browser check** | Chrome headless (`--headless=old`) or Playwright; one real flow | Per operating rules |
| **Offline analysis** | Python + pandas + DuckDB/Jupyter for the frame, the gold set, the sensitivity analysis | Before and beside the product code |
| **Source retrieval** | SEC EDGAR full-text search and submissions API; respect the SEC user-agent and rate limits | The frame and the deal metadata |
| **Versioning** | Git; the table-shapes version and metric-definition version in every result | Reproducibility |

### 3.5 Research and validation tools

| Method | What it answers | How |
| --- | --- | --- |
| **Contextual inquiry / shadowing** | What the workflow actually is | 5–8 lawyers, one hour each, on a live matter |
| **Diary study** | How often the question arises, how long it takes | Two weeks, 5–10 participants, a short form |
| **Concept testing** | Does the mockup answer the question? | 5–8 lawyers, task-based, think-aloud |
| **Time-on-task** | Is it faster than the workaround? | Measure the same three questions in both tools |
| **"Would you cite this?" test** | Is the output defensible? | Ask for a memo paragraph; review it |
| **Blind comparison** | Is it better than Practical Law / Intelligize / Deal Point Data / the firm's bank? | Same question, same time box, two tools |
| **Gold-set accuracy** | Is the extraction right? | Precision/recall against the hand-coded set |
| **Usability** | Can a new user succeed? | 5 users, 3 tasks, success rate and errors |

---

## 4. The build task, in work packages

Each package names what to start from, what to build, the tools, and how it is
accepted. The estimates assume one implementer who knows the product code.

**First day, before any product code.** Read the scoping note and this brief;
open the mockup; run the existing `/query/provisions` read on the preview
branch and note what is empty; build the frame script skeleton, define the first prebuilt reference sets
(all, industry, lawyer, size) and pick five agreements; write `codebook.v1.md`
from the table shapes; hand-code four observations. End of day: `frame.csv`, `codebook.v1.md`, and a four-row
`gold-set.json`. That is enough to know whether the axes are right.

### WP0 — Frame, gold set and protocol (3–5 days)

**Start from:** EDGAR, five real agreements, the table shapes as a hypothesis.
**Build:**

- a documented population frame for one provision (termination fee first);
- the first prebuilt reference sets (all, industry, lawyer, size) with their
  filter definitions;
- a hand-coded gold set of 20 provision–deal observations (four per agreement across five agreements), each coded twice;
- a codebook with inclusion/exclusion rules and negative examples;
- baseline timings for the three core questions.

**Tools:** EDGAR full-text search/submissions API, Python/pandas, a spreadsheet
or DuckDB, the codebook in Markdown.
**Accept:** the frame's denominator is reproducible from the script; the gold
set has a kappa and an adjudication log; the baseline shows where the time
goes.
**Do not:** use the product's two runs as the frame.

### WP0b — Deal metadata for the reference sets (2–3 days)

**Why:** the prebuilt sets are by industry, lawyer and size. The product has
no industry, deal value, structure or deal-lawyer field; a set cannot be
filtered by them without one.

**What the database has today.** The product tables do **not** store a lawyer.
The legacy `deals` table does: `metadata.advisors_v2` carries `buyer_firm`,
`buyer_lawyers`, `seller_firm`, `seller_lawyers`, `buyer_firms`,
`seller_firms` and `raw`, written by `scripts/backfill-advisors.js` from
`lib/parser-v2/notice-advisors.js`. The extractor reads the **Notices**
provision: each party's block, the "with a copy to:" firm, and the
"Attention:" lawyer names. If the product and dealstorylines share the same
Postgres, the product can read it by joining
`deals.metadata.source_url` to `product_source_documents.retrieval_url`.
That join is not built today. Where the legacy row is missing, run the
extractor on the product's Notices section.

**Start from:** the notice section for the lawyers (`notice-advisors.js`),
`product_source_documents.payload` for parties/date, the agreement's recitals
for value, and the shared `deals` row (source URL and `advisors_v2`).

**Build:**

- a `product_deal_lawyers` table: `source_document_id`, `side` (buyer /
  seller), `firm`, `lawyer`, `lawyer_key`, `source_span_id`, `raw`; or the
  same object in a JSONB column on the source document while the corpus is
  small;
- read the shared `deals.metadata.advisors_v2` where the source URL matches;
  otherwise run `notice-advisors.js` on the product's Notices section (find the
  node by its heading / the table-shape Notices row, and pass its closure
  text);
- canonicalise with `lib/canonical-advisors.js` (`canonicalLawyer`,
  `canonicalLawyerKey`) so spelling variants dedupe;
- index `lawyer_key` so "any deal from that lawyer" is one lookup;
- add the other fields: industry/sector, deal value and basis, structure,
  public/private, sponsor/strategic;
- first path for the non-lawyer fields: a short form at publication; later
  path: the firm's deal data.

**Accept:** a published agreement carries the notice-section lawyers per
side; `lawyer=Barshay` returns every deal where Barshay appears, whichever
firm and side; a missing notice block is `UNKNOWN`, never guessed; the
shared-DB row and a fresh extraction agree on the same deal.
**Do not:** infer the lawyer from the reviewer, or the industry from the
target's name without a rule. Do not overwrite a shared `advisors_v2` with a
weaker extraction.

### WP1 — The raw read model (4–6 days)

**Start from:** `product_source_documents.payload` (bytes, canonical text,
identity), `product_agreement_structures`, `product_source_spans`,
`product_source_closures`, `product_proposals`, `product_fact_conclusions`,
`product_review_*`.
**Build:**

- a `ComparisonUnit` per fact/cell: agreement id, parties, date, structure,
  table/row/column, code/value, summary, words, component ids, spans,
  section reference, review state, validation state;
- a loader that works for published releases and for READY drafts;
- a trace function from any cell to its bytes (the "words" path);
- no new database table unless the read is measured slow.

**Tools:** Supabase SQL, JSONB, a new `lib/product/comparison-read.js`,
fixtures.
**Accept:** ten sampled cells trace to exact bytes; a draft and a release
produce the same shape; a held fact is `HELD`, not `ABSENT`; a V8 fact is
`NO_READOUT`, not `NOT_STATED`.
**Do not:** read only `release.summary`; it has no conclusions.

### WP2 — Compare (5–7 days)

**Start from:** WP1's units; `buildTableView` per agreement; the fixed row
lists.
**Build:**

- the merge: `buildTableView` per agreement, aligned by `table_key` +
  `row_label` (and `row_detail` only when Q5 makes it canonical);
- the comparison grid: the provision column, the deal you are looking at, the
  reference set's comparison, and optionally one compare deal; exact
  code/value/words diff, `differs` markers, "only in" and "in all";
- the **two-deal mode**: the same grid with one compare deal and the
  reference column hidden, for a straight side-by-side;
- the **reference-set mode** (default): the deal you are looking at plus the
  visual distribution of the other options, with no second deal column;
- the summary view: facts grouped by family/subtype/fact_type, with
  "only in" and "in all";
- the evidence sidebar on any cell: in reference-set mode, the deal's words
  and the ranked options, with a click on an option showing an example clause
  from the set (deal and section reference); in two-deal mode, both deals'
  exact words side by side, each with its section reference and highlights;
- the "differences only" toggle and a count;
- the page body as a pure function (testable without a router).

**Tools:** React, Tailwind, the existing `ProvisionTables` / `EvidenceSidebar`
components, the existing table grammar, `node --test` page-body tests.
**Accept:** two agreements on Termination Fees and No-Shop; 100% of cells open
the right clause; in reference-set mode the sidebar shows your deal's text,
the distribution of other options, and an example clause behind any option; in two-deal mode it shows both deals'
text with the matched words highlighted; a row absent in one agreement reads `NOT_STATED` or
`NOT_APPLICABLE`, never blank; the summary view works where no table exists;
the two-deal mode and the reference-set mode share one component.
**Do not:** call two clauses "the same" because the codes match; show "as
drafted" without the words.

### WP2b — Draft clause intake and comparison (5–7 days)

**Start from:** the draft in any form (paste, `.docx`, `.pdf`, `.txt`), the table
shapes, the clause-level extractor, the reference set. The lawyer can name a
specific provision or ask for the full document.

**Build:**

- **intake:** paste a clause, paste the whole document, or upload `.docx`,
  `.pdf` or `.txt`; canonicalise the text; keep the original and a hash; no
  publication;
- **provision selection:** the lawyer picks a specific provision, names
  several, or asks for the full document; a model may suggest the provisions,
  the lawyer confirms;
- **clause-level extraction:** the same conclusions cells as a published fact
  (amount, timing, payer, trigger, and so on), each cell citing a span in the
  draft; the draft gets a `DRAFT_INPUT` state, not `PUBLISHED`; a full
  document is parsed into its sections first and every provision is compared;
- **the comparison:** the draft is the "your deal" side; the reference set is
  the corpus; the draft is never added to the set or counted in a market
  statistic;
- **the sidebar:** the draft's reading and words, plus the distribution of
  other options;
- **confidentiality:** the draft is stored under the user's account with a
  **delete action**; it is not published, not in the reference set, not in
  any aggregate; no service-role leak;
- if the draft is a full agreement, the same path needs the structure; defer
  that to a later step and build clause-level first.

**Accept:** paste a draft termination-fee clause, pick Termination fees, see
the draft's amount/timing/payer cells, the reference distribution and the
draft's evidence; a `.docx` upload works; a full document compares all its provisions; the draft never appears in the reference set or a market count;
the confidentiality notice is in the UI.
**Do not:** treat the draft as a published fact; auto-add it to the corpus;
store it without the user's action.

### WP3 — Market metrics (4–6 days)

**Start from:** WP1's units, the reference-set definition, the table shapes, the
legacy semantics (`lib/market-metrics/contract.js`,
`lib/query/market-baseline.js`, `lib/feature-compare.js`).
**Build:**

- pure functions: `prevalence`, `categorical`, `numeric`, `boolean`;
- the state machine (`ready`, `no_occurrences`, `unique`,
  `insufficient_data`, `not_comparable`, `unknown`, `error`);
- the denominator: answering agreements only, with exclusion counts;
- percentile rank, the band label, and the sample-size line (`n`, composition, range);
- the reference-set builder (published/draft, size, industry, year, structure);
- the wording generator (n, range, missing, not comparable);
- tests with three fixture agreements and a known distribution.

**Tools:** plain JavaScript, `node --test`, fixtures, the legacy `scoreValue`
bands, the sample-size line.
**Accept:** 100% of results carry `n` and the composition; 0 results hide the
distribution; no threshold suppresses or flags the label; 0 pooled units; 0
missing-as-negative; the same fixture gives the same `n`, median, percentile
and wording every time; a categorical one-code distribution reads "Company
in 3 of 3", not "MARKET".
**Do not:** port the V1 card/claim readers; do not compute a p-value and call
it market.

### WP4 — Trust, export and the reference set (3–4 days)

**Start from:** the result metadata, the review trail, the release summary.
**Build:**

- the reference-set bar and line: the chosen set, its filters, `n`, date
  range, exclusions, as-of, table-shape version, and a `Save this set`
  action; the lawyer filter holds every lawyer on the deal, so a name returns
  any deal from that lawyer;
- the method note ("same table, row, unit; answering deals only; `n` and
  composition");
- **Word (.docx)**: the comparison table as shown, then a **schedule of the
  full section text** for each deal (deal, section reference, full section,
  cited words highlighted);
- **Excel (.xlsx)**: a comparison sheet, a provisions sheet with the full
  clause text, and a reference-set sheet (filters, `n`, exclusions, as-of);
- **CSV**: one row per point, with the words and the source reference;
- `Copy table` for a quick paste;
- a saved reference set (later: shareable);
- the audit trail for a market result (which releases, which run, which
  table-shape version).

**Tools:** the browser clipboard API, CSV, `docx` and `xlsx` libraries (or
`python-docx` / `openpyxl` in a server export), the existing export patterns.
**Accept:** the Word export is the on-screen table plus a schedule with the
full section text for every deal, its section reference and the method note; the
Excel comparison sheet matches the on-screen table, the provisions sheet has
the full clause text, and the reference-set sheet has the filters, `n`,
exclusions and as-of; the CSV has one row per point with
`source_document_id`, `section_reference`, `words`, `released_at`, `n` and
the composition.
**Do not:** export a label without the n, the reference set and the composition.

### WP5 — Validation (2–3 days, overlaps)

**Start from:** the gold set, the mockup, five lawyers.
**Build:**

- five-user think-aloud on the three core questions;
- time-on-task vs the current workaround;
- blind review of ten outputs for defensibility;
- fix the top three failures;
- record the findings in a dated note.

**Tools:** the mockup/prototype, a timer, a short script, a spreadsheet.
**Accept:** 4 of 5 users complete the three tasks; the median time is under
two minutes; no user says "I wouldn't cite this" without a fixable reason.
**Do not:** count a demo as a usability test.

---

## 5. The visual source: the PW redesign comp

Read the redesign comp and its notes before writing UI code. It is the visual
source of truth:

- `reports/mockups/corpus-pw/corpus-pw-compare-2026-10-23.png`
- `reports/mockups/corpus-pw/corpus-pw-compare.html`
- `reports/mockups/corpus-pw/DESIGN-NOTES.md`

**Reuse exactly.** The masthead (`.top`, `.brand`, `.tile`, `.nav`, `.search`),
the context block (`.context`, `.crumb`, `h1`, `.sub`, `.meta`, `.actions`,
`.btn`), the 10px `.toprule`, the rail (`.rail`, `.railref`, `.railnote`), the
modes (`.modes`, `.mode`, `.check`), the set bar (`.setbar`, `.setbtn`,
`.filterbtn`, `.fselect`, `.fpill`, `.save`), the table (`.table`, `.thead`,
`.trow`, `.cell`, `.provname`, `.dealv`, `.dealsum`, `.words`, `.pill`,
`.mhead`, `.bar`, `.mnote`), and the right panel (`.panel`, `.stat`,
`.marketline`, `.dist`, `.block`, `.opt`, `.quote`, `.pactions`, `.method`).
Use the tokens: navy `#03203d`, blue `#0b3d71`, steel `#5d7da3`, mist
`#b9c8da`, wash `#f1f4f8`, rule `#dce3e1`, ink `#33475e`, grey `#6b7785`.
Inter Tight for structure, Source Serif 4 for reading. Square panels, no
shadows, no green, red or amber for legal meaning.

**What the comp already shows:** the masthead, the deal/provision context, the
reference-set rail, the three modes, the set bar, the provision-first table
with the deal's answer and the set's answer, the right market panel with the
big number, the distribution, the options in the set, the source quote and
the method note.

**What it does not show, and the integration adds** (same classes and tokens;
see `reports/mockups/corpus-pw/integration/`):

- **Draft a clause:** a 760px `.sheet` with Specific provisions / Full
  document, paste/upload, the provision, the reference set, the
  confidentiality note and "Compare this draft".
- **Adjust set:** a 440px `.drawer` with years, deal-value pills plus a custom
  minimum, industry, lawyer, structure, the set summary and Apply / Save as
  new set / Reset.
- **Export:** a small menu under the Export action: Word (table plus
  full-section schedule), Excel (comparison, provisions, reference set), CSV.
- **Two deals:** still undrawn. The mode pill exists; the second column and
  the both-text right panel are the open design question.

**The coordination note** `reports/mockups/corpus-pw/integration/COORDINATION-NOTE-2026-10-23.md`
lists the exact classes, the seven decisions for the redesign chat and the
content rules. I have not edited the redesign chat's files.

**Design choices worth keeping:** the provision name and its section on the
left; the deal's answer and the set's answer on one line; the right panel as
the reading, not a second sidebar; the distribution on one percentage scale
with the deal marked and the middle 50% banded; the quote as the door to every
point; the method note and the `n` always visible; the monochrome state pills.

**It leaves out:** the real data, the empty/loading/error states, the saved-set
flow, the actual export files, the mobile draft/adjust states, the
authentication, and the "not enough data" variant. Those are in the task, not
the picture.

## 6. Questions to finalize scope

Answer these in a sentence each; the recommendation is the default if you
agree.

### A. Workflow and user

1. **Who is the first user?** Partner, PSL/knowledge lawyer, associate, or
   in-house? *Recommend: the PSL/partner pair; the PSL builds the reference set, the
   partner uses it.*
2. **Which stage is first?** Precedent selection, first draft, negotiation,
   client/board advice, or knowledge capture? *Recommend: precedent/research
   and the first draft — finding provisions like mine and seeing how peers
   did it. The same screen then serves negotiation and client advice.*
3. **Walk me through the last "is this market?" question.** What triggered
   it, what did you open, how long did it take, what did you produce? *This
   is the single most useful answer in the list.*
4. **What makes a deal comparable?** Rank: industry, lawyer/team, size,
   structure, public/private, sponsor/strategic, year, jurisdiction.
   *Recommend: industry, lawyer and size first; year next; structure when the
   data is trusted.*
5. **What do you use today, and what is missing?** Practical Law, Intelligize,
   Deal Point Data, Chambers, the firm's bank, associates. *This sets the
   bar.*
6. **Who else uses it, and what do they need?** *Recommend: read-only for
   clients; edit/save for the deal team.*

### B. Comparison

7. **When you start a provision, what comes first: the precedent search, the
   clause, or the comparison table?** *Recommend: the provision row, with the
   words and the comparison together.*
8. **Agreements as columns or stacked groups?** *Recommend: columns for 2–4,
   stacked on narrow screens.*
9. **When you drill into a provision, do you want the coded attributes first
   or the full words first?** *Recommend: the coded attributes as the row
   detail, the words one click away; the primary unit is settled as the
   provision.*
10. **How do you want to handle a provision with limbs** (MAE carve-outs,
    reps bring-down)? Limb level now, or fixed row level until the limb names
    are canonical? *Recommend: fixed row level now; limb level after Q5.*
11. **What does "different" mean to you?** Different code, different words,
    or both? *Recommend: both are shown; the code diff and the words diff are
    separate.*
12. **Do you want "only in A / only in B" markers?** *Recommend: yes; they
    are often the most useful part.*

### C. Market and reference set

13. **Confirm no trigger:** the label, distribution and `n` always show;
    there is no n that hides or flags the comparison. *Is that right for every
    provision, or do you want a warning at a very low n?*
14. **What should the sample-size line say?** e.g. "14 deals · 8 cash · 5
    stock · 1 mixed · 2018–2026". *Recommend exactly that.*
15. **Which reference set is the default?** All published deals, a prebuilt
    set, or a peer set you choose? *Recommend: all published, with prebuilt
    and saved sets.*
16. **Which filters matter first?** Industry, lawyer, size, year, structure,
    public/private, sponsor/strategic. *Recommend: industry, lawyer and size
    (the precedent-search lens), then year and structure.*
17. **How should money be compared?** Raw, % of deal value, % of equity
    value, or all three? *Recommend: % of equity value where the deal states
    it; otherwise raw with a warning.*
18. **Do you need trend over time?** *Recommend: later; the sample is too thin
    now.*
19. **Do you need to save and share a reference set/playbook?** *Recommend: yes, after
    the first release; it is what makes it a firm tool, not a demo.*

### D. Output and trust

20. **What export do you need?** Word table, Excel, PDF, a memo paragraph,
    a slide? *Recommend: Word and Excel first; CSV as the data export.*
21. **What would you need to cite it?** Sources, dates, n, method note,
    reviewer, release version. *Recommend: all of them in the export.*
22. **What would make you distrust it?** *This is the acceptance test; write
    the top three down.*
23. **Do you need to see held/rejected facts?** *Recommend: no for market; a
    separate review view, yes.*
24. **Do you need an audit trail of who saw what?** *Recommend: yes for the
    firm; the release and the run id are the minimum.*

### E. Scope and timing

25. **Published first, or drafts marked as drafts?** *Recommend: if built
    before the first release, drafts marked; otherwise published only.*
26. **Is this one feature or two?** *Recommend: one read, two surfaces
    (compare and market); build them together.*
27. **Where does it live?** A new `/query/compare` page, or the existing
    `/query/provisions` page with modes? *Recommend: a new page that reuses
    the rail and the table grammar; keep the provisions page as the reader.*
28. **What is the first release's demo?** Two agreements, one provision
    table, one market strip, one export. *Recommend: exactly that.*

### F. Additional scope questions raised by the mockup

- **F1. Draft intake is in scope and in any form (Ben, 2026-10-23):** paste,
  `.docx`, `.pdf`, `.txt`; one or more named provisions, or the full document
  (all provisions). The lawyer names the provisions; a model may suggest. The
  draft is stored under the user's account with a delete action, never in the
  corpus.
- **F2. Reference-set mode shows the deal being looked at plus the visual
  distribution of other options (Ben, 2026-10-23).** The two-deal mode keeps
  the both-texts sidebar. Confirm that the sidebar in reference-set mode
  should show the deal's text and the option list, not a second deal.
- **F3. Size bands (agreed):** the PW pattern: preset pills `$500m+`,
  `$1bn+`, `$3bn+`, `$10bn+` plus a custom minimum, with an "Edit bands" panel
  for the boundaries.
- **F4. Word export (agreed):** the table plus a schedule of the **full
  section text** for each deal, its section reference and the deal name; the
  table is the one on screen.
- **F5. The lawyer field is the notice-section lawyers (Ben, 2026-10-23).**
  The extractor already exists (`lib/parser-v2/notice-advisors.js`) and the
  legacy path writes `deals.metadata.advisors_v2`; the product path does not
  store it today. The shared database may already hold it; the join is
  `deals.metadata.source_url` to
  `product_source_documents.retrieval_url`. *Still to confirm: should the
  filter include every firm's lawyers, or only Paul, Weiss's? Recommend every
  firm's lawyers, with a "Paul, Weiss only" toggle.*
- **F6. Does the reference set include drafts?** *Recommend: published by
  default; a draft is the "your deal" side, never part of the set.*
- **F7. Should the reference set be shareable with the deal team?** *Recommend:
  yes, after the first release; a saved set with a name and an owner.*

---

## 7. Acceptance criteria for the first release

A lawyer can:

1. pick a deal and a reference set (or two deals) and see them on one
   provision table;
2. see the deal's exact code, value and summary, with the reference
   distribution beside it and differences marked;
3. open any cell and read the clause, the component tree and the review
   trail;
4. see the market distribution for any cell, with `n`, the reference set, the
   exclusions and the date;
5. see a percentile and a label, with `n`, the composition and the range;
6. export Word, Excel and CSV with sources, the method note and `n`;
7. paste a draft clause, align it to the provision and see it against the
   reference set without the draft entering the corpus or a market count;
8. switch between reference-set mode (deal + distribution) and two-deal mode
   (both texts) without losing the selection;
9. choose a prebuilt set by industry, lawyer or size, adjust the size bands
   and the year, and save the set;
10. understand, without asking, that a missing answer is not a "No" and that
    two deals are not "the market";
11. see the screen in the PW redesign's system: the masthead, the white rail,
    the set bar, the square table, the right market panel, the monochrome
    pills, and no green, red or amber for legal meaning.

And the system:

- traces 100% of displayed cells to exact bytes;
- shows `n` and the composition on every result and never hides the distribution;
- pools 0 different units or vocabulary versions;
- counts 0 missing facts as negatives;
- returns in under two seconds for five agreements and under five seconds for
  fifty;
- records the table-shape version, the releases and the run ids behind every
  result;
- matches the PW comp at 1440 and 390, with the rail and the right panel
  collapsing on a phone.

---

## 8. What not to build

- Precedent tracing, source attribution or clause-level mark-up reuse. It is
  a separate deferred feature; similarity is not market.
- A semantic diff. Exact words only in v1.
- A recommendation or a "market standard" verdict. Descriptive only.
- A CVR product. Separate product.
- A full-text search engine. The cell query and the table are enough.
- A full draft agreement in v1. Draft clause intake is in scope; a whole
  draft agreement needs its own structure and is a later step.
- Editing or deciding from the comparison. Read-only.
- A new status document, authority or gate. This brief is a dated note.

---

## 9. Sources read

- `docs/codex-program/notes/COMPARISON-AND-MARKET-POSITION-SCOPE-2026-10-23.md`
- `docs/codex-program/notes/QUERY-ON-LAYERED-FACTS-DESIGN-2026-10-18.md`
- `docs/codex-program/notes/Q4-LEGACY-QUERY-COMPARE-EVIDENCE-2026-10-18.md`
- `docs/codex-program/notes/MANAGER-HANDOFF-2026-10-23.md`
- `docs/codex-program/notes/PRODUCT-LAUNCH-IMPLEMENTATION-PLAN-2026-09-04.md`
  (findings (121), (163), the future-feature list)
- `docs/core/{PLAN,OPERATING-RULES,LEGAL-RULES,CODEBASE-GUIDE}.md`
- `lib/product/{sec-intake,agreement-structure,source-context,review-state,phase-2-store,phase-3-store,table-view,fact-conclusions,provisions-preview}.js`
- `lib/market-metrics/{contract,adapter}.js`, `lib/row-market-stats/aggregate.js`,
  `lib/query/market-baseline.js`, `lib/feature-compare.js`
- `contracts/product/{fact-components.v2,fact-conclusions.v1,table-shapes.v3,legal-schema.v2}.json`
- `supabase/migrations/20260913020000_product_fact_conclusions.sql`,
  `supabase/migrations/20260905070000_product_phase_3_review.sql`
- `reports/mockups/corpus-pw/corpus-pw-compare-2026-10-23.png`
- `reports/mockups/corpus-pw/corpus-pw-compare.html`
- `reports/mockups/corpus-pw/DESIGN-NOTES.md`
- `reports/mockups/corpus-pw/integration/corpus-pw-compare-integration-2026-10-23.html`
- `reports/mockups/compare-market-mockup-2026-10-23.html`
- `reports/mockups/compare-market-twodeals-2026-10-23.png`
- `reports/mockups/compare-market-draft-2026-10-23.png`
- `/Users/bengoodchild/Downloads/pw-biopharma-market-bundle.zip` (the PW
  biopharma market site; `design-skill/pw-site-design/SKILL.md` for the
  adjustment pattern, `deckext/deck.js` for the year/size filters)
