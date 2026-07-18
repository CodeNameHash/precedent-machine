# Multi-Agreement-Type Expansion Plan (Pilot: CVR Agreements)

**Status:** Proposal — not yet started
**Scope question:** How hard is it to make Precedent Machine work for agreement
types other than merger agreements, starting with CVR agreements?

---

## 1. Executive summary

**Verdict: moderately easy architecturally, moderately expensive in content —
and CVR agreements are the best possible pilot.**

The system today is a generic engine wearing a hardcoded merger-agreement
content set. The core mechanics — typeKey-driven classification, the
schema/feature registry, quote verification, coverage computation, the
precedent search and query engine — are already agreement-type-agnostic:
`provision_type` is a string, features declare which types/codes they apply
to, and `lib/search.js` / `lib/query/*` operate on whatever type strings
exist. Nothing in the pipeline's *shape* assumes mergers.

What does assume mergers is (a) every line of *content* riding on that shape
(the 277-code rubric, ~1,400 lines of taxonomy dictionaries, the 20k-line
generated feature registry, the golden eval corpus, the QA gate thresholds),
and (b) six hardcoded chokepoints that don't parametrize over agreement type
today:

1. SQL `CHECK` constraints on `provision_cards.provision_type` (17 hardcoded
   values) and the per-type child tables (`supabase/schema-03-card-model.sql`).
2. EDGAR search query + exhibit scoring in `lib/edgar-catalog.js`, biased
   toward Exhibit 2.1 / "agreement and plan of merger".
3. The deterministic classify rules and ~3,400 lines of bespoke structural
   post-processing in `lib/parser-v2/extract.js` tuned to merger clause shapes
   (IOC splitting, termination-right romans, clear-skies clauses, etc.).
4. Party vocabulary in `lib/party-scope.js` (buyer/seller/merger-sub only).
5. QA gates (`scripts/ingest-qa.js`) and golden evals (`scripts/eval.js`,
   `eval/goldens.json`) whose thresholds are meaningless outside mergers.
6. Review-UI skeleton: `lib/sidebar-groups.js` ordering and the hardcoded
   summary widgets in `pages/review/[id].js` (MAE summary, termination-fee
   trigger table).

None of these is a rewrite. Each is a "make the existing thing keyed by
agreement type" refactor plus new per-type content. The legacy schema even
has a vestigial `agreement_types` table (`supabase/schema.sql:14`, seeded
with merger/stock_purchase/asset_purchase) waiting to be revived.

**Why CVRs are the right pilot:**

- CVR agreements are *short* (typically 15–40 pages vs. 100+ for a merger
  agreement) with a highly stereotyped structure — roughly 10 provision
  families vs. ~20, and far less structural variance between deals.
- They arrive attached to deals we already ingest: the CVR agreement is
  filed with (or shortly after) the merger agreement, usually as an exhibit
  to the same 8-K/S-4 or as Exhibit 4.x / an annex to the merger agreement.
  Deal metadata (parties, dates, consideration) is already in the database.
- The rubric already has `CONSID-CVR` as a merger-consideration sub-code, so
  cross-document linkage (merger agreement's CVR consideration terms ↔ the
  CVR agreement's own milestone mechanics) is a natural, high-value feature
  no other tool offers.
- The biopharma vertical is where the corpus already lives, and CVRs are
  overwhelmingly a biopharma instrument — precedent search across CVR
  milestone/efforts terms is genuinely useful to the user base we have.

**Rough effort estimate** (in reviewed-and-merged work units, using the
routing model in CLAUDE.md):

| Phase | What | Size |
|---|---|---|
| 0 | Type plumbing (schema, registry, routing by `agreement_type`) | ~1–2 weeks of Codex work + Fable review |
| 1 | CVR rubric + taxonomy + feature registry (content authoring) | ~1 week, Fable-heavy (legal judgment) |
| 2 | Ingestion + classify + extract for CVR shape | ~1–1.5 weeks, mixed |
| 3 | QA gate profile + golden corpus (6–8 hand-audited CVR deals) | ~0.5–1 week |
| 4 | Review UI: CVR sidebar + summary widgets | ~1 week, spec-on-Fable / produce-on-Codex |
| 5 | Cross-type linkage + precedent search polish | ~0.5 week |

Total: on the order of **5–7 focused weeks** of pipeline work for the first
additional type — and critically, Phase 0 is paid **once**. Each subsequent
type (stock purchase and asset purchase are nearly free — mostly rubric
deltas; license agreements are a bigger content lift) costs only Phases 1–4,
and Phases 3–4 shrink as the widget/gate patterns get established.

---

## 2. What's already generic (leave alone)

- **Quote verification & coverage** (`lib/verification.js`) — verbatim
  substring checks and coverage math work on any (full_text, provisions)
  pair. This is the quality backstop and it transfers as-is.
- **Precedent search & query engine** (`lib/search.js`, `lib/query/*` with
  `FILTER_THEN_LIST`, `MARKET_RANGE`, `DEAL_COMPARE`, `DEAL_TO_MARKET`,
  `PROVISION_CROSS_CUT`) — operates on provisionType/featureKey parameters;
  new types flow through with zero changes. Only `market-baseline.js`
  benchmark families need new entries.
- **Schema-driven leaf rendering** (`lib/schema/formatters.js`,
  `card-model.js` helpers, `lib/schema/prompt.js`, `validation.js`,
  `coverage.js`) — feature-level prompt construction, validation, and
  rendering are driven by registry data.
- **`scripts/reprocess.js`** — already validates `--types` against whatever
  `rubric.js` exports; new provision types become valid automatically.
- **Segmentation** (`lib/parser-v2/structural.js`, `regions.js`) — mostly
  format-driven (articles/sections/definitions), largely transferable; CVR
  agreements follow the same article/section conventions.

## 3. Target architecture: `agreement_type` as a first-class dimension

One decision governs everything: **every piece of per-type content becomes a
keyed module under an `agreement_type` string**, and the pipeline resolves
the module set from the deal/document record at runtime.

```
lib/agreement-types/
  index.js            // registry: { merger, cvr, ... } → module set
  merger/             // extracted from today's hardcoded content
    rubric.js         // current lib/rubric.js PROVISION_TYPES + CODES
    taxonomy.js       // current lib/taxonomy.js dictionaries
    party-scope.js    // buyer/seller/merger-sub segments
    sidebar-groups.js
    classify-rules.js // deterministic title rules
    extract-post.js   // bespoke splitting/normalization passes
    qa-profile.js     // ingest-qa thresholds
    edgar-profile.js  // search query + exhibitScore weights
  cvr/
    ... same shape ...
```

`lib/rubric.js`, `lib/taxonomy.js`, `lib/party-scope.js`,
`lib/sidebar-groups.js` remain as thin re-exports of the merger module so
the existing 150+ test files and all call sites keep working — the refactor
is move-and-alias, not rewrite. New call sites take an `agreementType`
parameter and go through `lib/agreement-types/index.js`.

### 3a. Isolation principle: hard-split taxonomies, linkers added consciously later

**Decision (Ben, 2026-07-18): per-type taxonomies are fully independent —
no shared code dictionaries, no `common/` vocabulary module. Cross-type
equivalences are added later as explicit, reviewed linkers, never inherited
implicitly.**

The mechanism layer (parser, verification, QA runner, query engine, UI
components) is shared; the *semantic* layer (rubric families, sub-codes,
taxonomy dictionaries, synonyms/regexes, party vocabulary) is not. Each
agreement type owns its complete dictionary set, authored from that type's
own corpus, even where a concept looks identical across types (e.g. efforts
standards appear in both merger covenants and CVR diligence clauses — the
CVR module still gets its own `EFFORTS_STANDARDS` with its own codes and
synonyms).

Rationale — the cross-contamination vectors a shared dictionary opens:

1. **Prompt/classifier bleed.** Code dictionaries (labels, descriptions,
   synonym regexes) are fed to the LLM classifier and extraction prompts.
   A shared dictionary means merger-tuned synonyms silently shape how CVR
   clauses are coded — and worse, a later tweak made to fix a CVR edge case
   silently re-codes merger provisions across the whole corpus, invisibly
   to anyone not re-running merger evals.
2. **False equivalence in precedent data.** A shared code asserts "these
   mean the same thing" by construction. If a merger IOC efforts standard
   and a CVR diligence standard share `EFFORTS-CRE`, every cross-type query
   treats them as comparable whether or not that's legally sound. A wrong
   equivalence baked into search results reads as correct — the exact
   failure mode the routing rules exist to prevent.
3. **Coupled review surface.** With a split, a taxonomy diff touches
   exactly one agreement type and can be reviewed against that type's
   goldens alone. With sharing, every dictionary change requires re-running
   every type's eval harness to prove non-regression.

Consequences elsewhere in this plan:

- No `common/` taxonomy module. Duplication between type modules is
  accepted and is not a smell to be refactored away.
- **Namespaced codes everywhere**: all CVR codes carry the `CVR-` prefix
  (families and taxonomy codes alike), so no string can collide with or be
  mistaken for a merger code, and provenance is legible in raw data.
- **Linkers are a product feature, not plumbing** (Phase 5): a
  `taxonomy_crosswalk` table mapping code ↔ code across types, each row a
  deliberate, Fable-reviewed (and Ben-approved) legal-judgment call, with a
  rationale string. Cross-type queries route exclusively through the
  crosswalk; absence of a row means "not comparable," which is the safe
  default. Linkers are added only after both taxonomies have stabilized
  against their golden corpora.
- Shared *storage structures* (e.g. `provision_cards`, or reusing the
  `definition_components` table shape for Net Sales) are fine: rows are
  namespaced by document → agreement type, and a table schema carries no
  semantics into prompts or search. The split applies to meaning, not
  mechanics.

### Database changes (one migration)

1. Add `documents.agreement_type text NOT NULL DEFAULT 'merger'` (or on
   `deals` if we keep one document per deal — but CVR argues for a
   `documents` level: one *deal* can now own two agreements, the merger
   agreement and the CVR agreement, sharing deal-level metadata). Recommended:
   introduce `agreement_documents (id, deal_id, agreement_type, source_url,
   full_text, ...)` and point `provision_cards` at it; backfill existing rows
   as `merger`.
2. **Relax the `provision_type` CHECK constraint** on `provision_cards`.
   Options: (a) drop the CHECK and enforce in the app layer against the
   per-type rubric (validation already runs in `lib/parser-v2/validate.js`);
   (b) replace with a FK to a `provision_type_registry` table maintained by
   `generate-registry.js`. Recommend (b): keeps DB-level integrity without a
   migration per new code.
3. Same treatment for the enum CHECKs on child tables we reuse; CVR-specific
   structures get **new child tables** (see §5) rather than overloading
   merger ones.
4. Revive/replace the vestigial `agreement_types` lookup
   (`supabase/schema.sql:14`) as the canonical type list.

### Registry changes

`scripts/generate-registry.js` and `lib/schema/features.js` gain an
`agreementTypes` scope on each feature (default `['merger']` for all
existing entries). `buildFeatureInstructions` in `lib/parser-v2/extract.js`
filters by agreement type in addition to typeKey — a small change since the
filtering mechanism already exists for provisionTypes/provisionCodes.

---

## 4. Phase plan

### Phase 0 — Type plumbing (prerequisite, pays for all future types)

- The `lib/agreement-types/` module split with merger re-export aliases.
- The DB migration above (+ backfill script + rollback).
- Thread `agreementType` through: ingest endpoints (`pages/api/ingest/*`),
  `parser-v2/classify.js` (rubric injection point at line ~14),
  `extract.js` instruction builder, `store-cards.js` validation,
  `ingest-qa.js` (gate profile selection), review-page data loader.
- Acceptance criteria: full existing test suite green; `npm run build`
  green; re-run `scripts/eval.js` on all 11 golden merger deals with **zero
  diffs** vs. pre-refactor output (this is the real gate — the refactor must
  be behavior-preserving for mergers); quote verification stays at zero
  flags.
- Routing: pure mechanical refactor with a writable spec → **Codex
  produces, Fable specs and reviews**. The eval-diff gate makes this safe.

### Phase 1 — CVR content authoring (the legal-judgment core)

**Fable/Opus end to end** per CLAUDE.md — a plausible-but-wrong CVR taxonomy
reads as correct and corrupts precedent search.

Proposed CVR provision-type families (draft — to be validated against 6–8
real agreements before freezing):

| Key | Family | Notes |
|---|---|---|
| `CVR-DEF` | Definitions | Net Sales, Milestone, Diligent Efforts / CRE definitions are the heart of the instrument — first-class, not boilerplate |
| `CVR-CHAR` | CVR characteristics | Non-transferability (vs. listed/tradeable), book-entry/no certificates, no interest, no voting/dividend rights, unsecured-obligation status, no fiduciary duty to holders |
| `CVR-MILE` | Milestones & payment triggers | Regulatory (approval by outside date, by agency, by indication), sales-based (net-sales thresholds, measurement periods), development milestones; milestone deadlines |
| `CVR-PAY` | Payment mechanics | Milestone notice obligations, payment timing, per-CVR amount, rights-agent procedures, withholding, currency |
| `CVR-EFF` | Efforts / diligence covenant | Efforts standard (CRE vs. diligent-efforts vs. none), definitional carve-outs ("taking into account all relevant factors"), express business-discretion reservations, obligations on divestiture/abandonment of the product |
| `CVR-INFO` | Information & audit rights | Net-sales statements, milestone status reports, audit rights and who may exercise them |
| `CVR-XFER` | Transfer restrictions | Permitted-transfer categories, register mechanics |
| `CVR-AGENT` | Rights Agent provisions | Duties, liability limits, indemnity, resignation/replacement |
| `CVR-ENF` | Enforcement & holder rights | Acting Holders threshold (%, of outstanding), no-individual-suit clauses, third-party-beneficiary status, holder representative mechanics |
| `CVR-AMEND` | Amendments | With/without holder consent; consent threshold |
| `CVR-TERM` | Termination | Agreement termination triggers and tail obligations |
| `CVR-TAX` | Tax treatment | Open-transaction vs. installment characterization, §483 imputed interest, withholding |
| `CVR-MISC` | Boilerplate / other | Governing law, notices, disputes — the no-orphans catch-all, mirroring `OTHER` |

Taxonomy dictionaries to author (the `lib/taxonomy.js` equivalents):
CVR-native efforts-standard codes (authored fresh from CVR agreements — do
NOT reuse or extend the merger `EFFORTS_STANDARDS` dictionary; see the
isolation principle in §3a), milestone-trigger codes (regulatory agency ×
event × deadline structure), net-sales-definition components (deductions
list is highly stereotyped), transferability codes,
acting-holder-threshold buckets.

Party vocabulary module: `PARENT`, `RIGHTS_AGENT`, `HOLDERS` (+
`HOLDER_REP` / `ACTING_HOLDERS`); mutual/N-A as today.

High-value benchmark features for precedent search (the "what does the
market do" queries a biopharma lawyer actually asks): efforts standard and
its carve-outs; milestone outside dates vs. expected approval timelines;
acting-holders percentage; transferability; net-sales deduction sets; audit
rights; disposition-of-product obligations; per-CVR amount vs. milestone.

### Phase 2 — Ingestion, classification, extraction

- **EDGAR profile**: search query `"contingent value rights agreement"`
  (plus "CVR agreement"); exhibit scorer favoring `EX-4.x` / `EX-2.2` /
  `EX-10.x` and description matches on "contingent value right", penalizing
  the merger agreement itself. Also add a *same-filing companion pass*: when
  ingesting a merger agreement whose consideration classifies `CONSID-CVR`,
  scan the same filing index (and the deal's subsequent 8-Ks) for the CVR
  agreement and queue it. That companion pass, not open-ended search, will
  find most of the corpus.
- **Classify**: CVR agreements are short and stereotyped, so deterministic
  title rules cover more ground than in mergers ("Rights Agent",
  "Milestone", "Net Sales Statement" titles are near-unambiguous); LLM
  fallback against the CVR rubric handles the rest. New
  `cvr/classify-rules.js`.
- **Extract**: mostly registry-driven prompts (the generic path). Bespoke
  post-processing needs are far smaller than mergers' 3,400 lines — the two
  known structural quirks are milestone definitions living in tables/schedules
  (need a milestone-table splitter analogous to the transaction-steps
  detector) and net-sales definitions with long deduction lists (component
  splitting like `definition_components`). Budget one `cvr/extract-post.js`
  an order of magnitude smaller than the merger one, and let quote
  verification + QA catch what generic extraction misses before adding more.
- **Storage**: new child tables `cvr_milestones` (trigger kind, product,
  indication, agency, threshold amount, measurement period, outside date,
  per-CVR payment) and reuse of `definition_components` for Net Sales.
- Routing: EDGAR/scoring/companion-pass and storage are Codex-with-spec;
  extraction-prompt content is Fable; classify rules are
  spec-on-Fable/produce-on-cheap with the section-title safety check as the
  review, per the existing repo guide.

### Phase 3 — QA gates and golden corpus

- `cvr/qa-profile.js`: e.g. `CVR-MILE ≥ 1`, `CVR-PAY ≥ 1`, `CVR-EFF ≥ 1`
  (or an explicit none-found flag — some CVRs have no diligence covenant,
  which is itself a finding), `CVR-AGENT ≥ 1`, `CVR-DEF ≥ 10`, coverage
  ≥ 90% (short stereotyped documents should beat the merger 85% bar), zero
  unverified quotes.
- Golden corpus: 6–8 hand-audited CVR agreements spanning the structural
  space. Candidates: **BMS/Celgene** (listed, tradeable, sales+regulatory
  milestones — the famous miss), **Sanofi/Genzyme** (listed, multi-milestone),
  **Alexion/Achillion** (private-style regulatory milestones),
  **AstraZeneca/CinCor** (single regulatory milestone, non-transferable),
  **Ipsen/Albireo**, **Novartis/Chinook**, plus one older/atypical one for
  variance. Hand-audit is Fable + Ben spot-check, same as the merger goldens.
- Extend `scripts/eval.js` goldens format with an `agreementType` field
  (defaulting to merger for existing entries).

### Phase 4 — Review UI

- `cvr/sidebar-groups.js`: Characteristics → Milestones & Payments →
  Efforts/Diligence → Information & Audit → Transferability → Rights Agent →
  Enforcement & Amendments → Definitions → Other.
- Two new summary widgets (the CVR analogues of the MAE summary and
  termination-fee trigger table): a **Milestone table** (trigger / deadline /
  per-CVR amount / status of definitional conditions) and an
  **Efforts-standard card** (standard, carve-outs, discretion reservations —
  side-by-side quotable for precedent work).
- The review page's leaf rendering is already schema-driven; the work is
  skeleton + widgets. Spec-on-Fable, produce-on-Codex, live verification on
  the deployed page per the watchdog protocol.
- Deal page: show both documents of a deal (merger agreement + CVR
  agreement) with cross-links between `CONSID-CVR` cards and the CVR
  document's milestone cards.

### Phase 5 — Consciously-added linkers (the differentiator, and the last thing built)

Per the isolation principle (§3a), nothing in Phases 0–4 creates any
semantic connection between the merger and CVR taxonomies. Phase 5 adds
those connections explicitly, one reviewed decision at a time, only after
both taxonomies have stabilized against their golden corpora:

- **Document-level linker** (safe, semantic-free, can ship first): link
  `CONSID-CVR` provisions in merger agreements to the sibling CVR
  agreement's cards via the shared `deal_id` — this asserts only "these
  documents belong to the same deal," not that any codes are equivalent.
- **`taxonomy_crosswalk` table**: `(from_type, from_code, to_type, to_code,
  relationship, rationale, reviewed_by, reviewed_at)`. Each row is a
  deliberate legal-judgment call (Fable-drafted, Ben-approved). Cross-type
  queries route exclusively through this table; no row = not comparable.
  Candidate first rows: merger `EFFORTS-*` ↔ CVR efforts codes,
  `CONSID-CVR` sub-features ↔ `CVR-MILE`/`CVR-PAY` features.
- Market-baseline families for CVR features so `MARKET_RANGE` queries work
  within the CVR corpus ("what % of biopharma CVRs since 2020 are
  transferable?", "distribution of acting-holder thresholds") — this is
  single-type and needs no crosswalk.
- Compare view: cross-type deal comparison (a deal's merger + CVR terms as
  one column) — document-level join only; any feature-level alignment rows
  come from the crosswalk.

---

## 5. After CVRs: cost of further types

- **Stock purchase / asset purchase**: cheapest — ~80% rubric overlap with
  mergers; mostly code aliases + a handful of new families (purchase-price
  adjustments, indemnification, escrow). The vestigial `agreement_types`
  seed rows already anticipated these.
- **License agreements**: the big one for the biopharma vertical (field/
  territory grants, royalty tiers, milestone payments, CoC provisions,
  reversion). Roughly a full Phase 1–4 cycle again, but Phase 2's milestone
  and net-sales machinery from CVRs transfers almost wholesale — do CVRs
  first for exactly this reason. Ingestion is harder (license agreements are
  Exhibit 10.x material contracts, often redacted — confidential-treatment
  handling becomes a real issue).
- **Transition services / disclosure schedules / voting agreements**: judge
  demand after the first two.

## 6. Risks and mitigations

1. **Phase 0 regression risk on the merger pipeline** — mitigated by the
   zero-diff golden-eval gate; the refactor is not allowed to change merger
   output at all.
2. **Cross-contamination between type taxonomies** — the primary design
   risk, addressed structurally by the isolation principle (§3a): fully
   independent per-type dictionaries, namespaced codes, and cross-type
   equivalence only via explicit crosswalk rows added after stabilization.
   The residual risk is intentional duplication drifting *within* a type's
   own corpus semantics — acceptable, because each type is reviewed against
   its own goldens and the crosswalk (not shared labels) carries any
   cross-type claims.
3. **CVR corpus is small** (~10–20 well-known public agreements per recent
   5-year window) — that's fine; precedent value per document is high, and
   small corpus means the golden set covers a large fraction of it.
4. **Child-table proliferation** — resist adding a child table per feature;
   only genuinely relational structures (milestone rows) get tables, the
   rest stays in card features as today.
5. **Token spend during the conservation window** — Phase 0 and Phase 4 are
   Codex-shaped; Phase 1 is the one irreducibly Fable-heavy phase and it is
   short. Sequencing Phase 0 first (all Codex) front-loads the cheap work.

## 7. Suggested first milestone

Smallest end-to-end slice that proves the whole path: Phase 0 plumbing +
a hand-authored *minimal* CVR rubric (just `CVR-MILE`, `CVR-EFF`, `CVR-PAY`,
`CVR-MISC`) + manual ingestion (paste-URL, skip EDGAR discovery) of the
AstraZeneca/CinCor CVR agreement + generic extraction + review page with a
provisional sidebar. If that renders and quote-verifies cleanly, the
architecture bet is confirmed and Phases 1–5 proceed with confidence.
