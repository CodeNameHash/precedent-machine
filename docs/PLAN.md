# PLAN — handoff-ready work packages (Codex agent team)

Last update: 2026-07-20, post PR #301 + the r19 build round. This doc is
written to be handed to a Codex (gpt-5.x) agent team COLD: each work
package below is self-contained — task, file paths, evidence, and
acceptance criteria — because Codex agents get no conversation history.
Copy a package verbatim into a `codex exec` prompt and it should stand
alone. Never include secrets (.env.local values) in any prompt.

## Repo primer (include with every handed-off package)

- Next.js app; Supabase Postgres; Vercel production tracks `main`.
- Gates before any push: `npm test` (node:test; ~1950+ tests, ALL must
  pass) and `npm run build`. `bash scripts/lint/forbidden-patterns.sh`
  must print `INVARIANT-4: PASS` — note it diffs HEAD^1..HEAD, so run it
  AFTER committing; genuine fixture literals get file-scoped exemptions
  in that script, never loosened patterns.
- Two data layers: `claims` (drives review-page cards via
  lib/queries/claims-adapter.js) and `provisions.ai_metadata.features`
  (drives the query engine via lib/query/). A field present in one layer
  only is invisible to the other — sync scripts exist (scripts/
  sync-claims-to-provisions.js).
- Review-page rows select cards by `provision_subtype`
  (components/review/table-configs/card-utils.js `cardCode()`); a card
  with null subtype is invisible to every configured row.
- DB scripts pattern (see scripts/restamp-ioc-restrictions.js as the
  template): .env.local self-loader, paginated reads via
  `fetchAllRows(query.range(...))` (Supabase silently caps at 1000
  rows), DRY-RUN DEFAULT printing a per-deal diff, `--apply` to write.
  Corpus writes run only on Ben's machine (.env.local lives there).
- Codebook delivery pattern (see scripts/code-intervening-event.js and
  commit ffcd8e9): taxonomy dict in lib/taxonomy.js + registry entry in
  lib/schema/features.js + regen (`node scripts/schema-inventory.js &&
  node scripts/generate-registry.js`) + docs/market-registry
  INVARIANT-10 row + a script embedding the HUMAN-REVIEWED per-deal
  classification table (never re-derived at runtime) + fixture-snapshot
  tests.
- Registry taste rules (non-negotiable): no machine codes or coder-speak
  in any user-facing string; never render "…" truncation (full text
  behind See provision expansions); never fabricate a value — null/
  UNRESOLVED beats a guess; wrong-but-plausible legal output is the
  worst failure class.
- Corpus data for offline analysis: regenerate a per-deal cards cache
  via the production API (`/api/review/<dealId>/cards`, deal ids from
  `/api/deals`) — prior sessions cached these as
  `cards-<dealId>.json` files; the cache is session-local, rebuild it.

## r19 round — LANDED (2026-07-20)

- [x] WP-A: numeric featureSummary entries (min/p25/median/p75/max +
      percentOfDeal + relative-period basis) in both corpus-stats
      endpoints; numeric market cells render median headlines; off-
      market rows (coded ≠ mode; numeric outside p25–p75) feed
      OffMarketSection with the commercial exclusion intact.
- [x] WP-B: nosol labels audited; the coded engagement-standard rows
      disambiguated ("Engagement standard (coded)"), contextually
      correct labels kept.
- [x] WP-C: appraisal-rights codebook shipped — 28 AVAILABLE, 5 express
      NOT_AVAILABLE, 7 UNRESOLVED-as-data-gaps, none forced SILENT;
      `scripts/code-appraisal-rights.js` awaits Ben review + --apply
      (step 7 of the runbook).

## Ben runbook (his machine; all dry-run first)

1. `node scripts/code-intervening-event.js` → review diff → `--apply`.
2. `node scripts/code-information-sharing.js` → `--apply`.
3. Four mass-null classify re-runs (AI-assisted, subscription CLI):
   `node scripts/reprocess.js --deal Summit --classify-only` → `--apply`;
   repeat for Catalent, Juniper, ENDRA (deal ids fc03e7e3 / bb5f062d /
   a1b07312 / 65a3e3c8).
4. `node scripts/canonicalize-duplicate-codes.js` → `--apply` (low
   urgency; display union already live).
5. Per-deal corrections from reports/query-field-conflicts.md.
6. Gilead/Pharmasset (ad35e712): verify cards serve and re-pull the
   cache for it.
7. (After WP-C lands) `node scripts/code-appraisal-rights.js` →
   `--apply`.

## Work packages — re-extract / data quality (Codex-ready)

Each package: hand the primer + the package text to the agent. Corpus
WRITES are Ben-run; Codex prepares code/scripts/diffs.

**WP-R1 — Summit termination-fee extraction (P0).**
Deal fc03e7e3 (Quikrete/Summit): its single TERMINATION_FEE provision
has `ai_metadata.features = {}` and quotes §10.02 (Effect of
Termination) only. The source agreement §11.04(b)(i) carries: "the
Company shall pay … $279,000,000 (… the 'Company Termination Fee')" on
Superior-Proposal/Adverse-Recommendation-Change termination;
§11.04(b)(ii) a 12-month tail ("within 12 months following such
termination … an Acquisition Proposal is consummated … pay … the
Company Termination Fee"); §11.04(c) sole-remedy/liquidated-damages.
Source text via production `/api/agreement-source?deal_id=fc03e7e3…`.
Task: a targeted re-extract of the TERMF family for this deal
(scripts/reprocess.js --deal Summit --types TERMF path, or a dedicated
dry-run-gated repair script stamping the fee object
{amount, triggers[], tail, sole_remedy} with verbatim quotes).
Acceptance: review page shows the $279M fee row with triggers and tail;
quote verification passes; no other deal touched.

**WP-R2 — Heinz/Kraft equity-award treatment (P1).**
Deal c7c16365: §6.04 "Kraft Stock Plan" (option adjustment into buyer
options, unvested-award conversion, ESPP termination 9/30/2015) is
captured only as a generic COV-EMPLOYEE card, so the equity-awards
table is empty on a $46B deal. Task: extract §6.04 into the
CONSID-EQUITY family (per-instrument rows: options, RSUs/unvested,
ESPP) with verbatim quotes. Acceptance: equity-awards table populated
for the deal; conversion mechanics visible; existing COV-EMPLOYEE card
untouched.

**WP-R3 — 15 intervening-event decks with no stored definition (P1).**
These deals carry `interveningEventProvision: true` but no stored
definition text, so the codebook script skips them: Silver
Lake/Endeavor, Apollo/Bridge, Sekisui/MDC, Lilly/Verve,
Sanofi/Bioverativ, Oaktree/Superior Industries, ConocoPhillips/Concho,
Stanley Martin/UHG, Rocket/Redfin, Novo/Catalent, AbbVie/Landos
("Change in Circumstance" drafting), Marriott/Starwood, Charter/Cox,
GNL/Modiv, Brookfield/Forest City. Task: pull each source
(`/api/agreement-source`), locate the intervening-event definition,
store `interveningEventDefinition` with the FULL text (no fixed-window
truncation), then extend scripts/code-intervening-event.js's CODING
table with graded calls (IE_POSITIVE_ONLY / IE_POSITIVE_OR_NEGATIVE
per lib/taxonomy.js INTERVENING_EVENT_TYPE) + exceptions
(INTERVENING_EVENT_EXCEPTION_CODES) for HUMAN REVIEW before any
--apply. Acceptance: per-deal table with key quotes; no grade without
quoted positivity-limiting (or absence-of) language.

**WP-R4 — Quote-capture repairs (P2).**
(a) Intervening-event family quotes stored as fixed-length excerpts
with literal edge "…" — re-capture full definitions.
(b) QXO (7dc3a05f) prorationMechanics.oversubscriptionTreatment stored
with a mid-string " ... " eliding the payment formulas — re-capture
complete (render-side unelide in lib/unelide-quote.js already
reconstructs it; data should converge).
(c) Skechers (3G deal): fiduciaryFinalStandard stored as a headless
mid-clause fragment; DEF-SUPERIOR card mislabeled (contains the Notice
Period definition) with primary_quote hard-cut at 164 chars.
Acceptance: stored quotes complete; tests/unelide-quote.test.js
fixture still passes; no other quotes regressed (spot-check sample).

**WP-R5 — Appraisal fold-ins + mis-familied cards (P2).**
(a) Heinz/Kraft §2.01(c) "No appraisal rights shall be available…"
sits inside the CONSID-CONVERT card with no CONSID-DISSENT row — mint
the dissent card. (b) ENDRA §3.5 same concept — populate
appraisalRightsAvailable on the existing card. (c) Mis-familied:
ENDRA §7.3 regulatory matters filed as COV-FURTHER (should be ANTI
family); Heinz shareholder-litigation + stock-exchange-listing
covenants under ANTITRUST_REGULATORY/null (should be COV-LITNOTIFY /
COV-LIST); Heinz "Publicity" §9.13 null-subtyped (should be
COV-PUBLICITY). (d) Heinz §5.02/§5.03 chapeau cards carry section_ref
"1.01 | General / Preamble" — repair to their real refs.
Acceptance: per-item diff, dry-run printed, quote verification clean.

**WP-R6 — short_title sentinel standardization (P1, ingestion-side).**
475/475 "Unclassified"-ish cards store bare 'Unclassified' while code
expected '[PROPOSED] Unclassified' (render side accepts both since
r18 — see ioc-exceptions.config.js's case-insensitive guard). Task:
standardize the sentinel at the ingestion/minting source (grep the
writers in lib/parser-v2/ + scripts/backfill/), migrate stored values
with a dry-run script, then tighten the render guard back to one
spelling. Acceptance: one sentinel corpus-wide; guard simplified;
tests updated.

**WP-R7 — Fold-in extraction-prompt revision (P2, prompt engineering —
FLAG FOR FABLE REVIEW before shipping; do not merge unreviewed).**
Recurring pattern: when an agreement combines concepts in one section,
extraction produces one card and sibling rows read absent (proxy prep
inside stockholders-meeting; jury waiver inside jurisdiction; appraisal
inside conversion; undisclosed liabilities inside the SEC rep; ENDRA's
CoR/match machinery inside COV-MEETING). Task: propose (as a diff, not
a merge) extraction-prompt/post-pass changes in lib/parser-v2/ that
mint the folded sibling cards, with a golden-eval run
(node scripts/eval.js) proving no regressions. Acceptance: Fable/Ben
sign-off gate documented in the PR body; eval green.

**WP-R8 — Information-sharing UNRESOLVED decks (P2).**
HireRight + GD/CSRA: receipt-notice paragraphs absent from stored
text; Bain/Envestnet: receipt notice absent (ARC-stage only stored).
Pull sources, capture the notice paragraphs, extend
scripts/code-information-sharing.js's CODING table for human review.
Acceptance: per-deal quotes; no default-guessing (engagementNotice
omitted where not established).

**WP-R9 — IOC taxonomy self-family codes (P3 — FABLE-TIER, do not hand
to Codex alone).** IOC_CATEGORY_META lacks DIVIDENDS/ISSUANCE/SPLITS/
CHARTER families so those rows carry no self-family tag (suppressed
pills accepted meanwhile). Extending the taxonomy is a legal-taxonomy
call; Codex may draft, Fable must review the family definitions.

**WP-R10 — IOC limb-title rubric rule order (P3, cosmetic).** Rule 8
(retain-officers) outranks rule 9 (preserve-organization); 5 compound
limbs opening with preserve-intact language title by their secondary
duty. Reorder-with-guard or add a compound-opener rule; corpus-validate
against ALL limbs via the pinned tests in
tests/provision-table-configs.test.js (zero title regressions allowed).

## Deferred / backlog (unchanged)

- Deal-to-market saved-search persistence (query_cache table) — judge
  after batch+edge caching beds in.
- Scope-granular cache invalidation — only if ingestion becomes
  daily-or-faster.
- Security client-auth story (branch wp/api-auth-middleware — Ben
  picks); numeric backfill (canonical_numeric column); Endeavor
  proposed-codes curation (112 codes); render-parity audit tool; #12
  structured-claims rework; #13 enforcement; #14 party-token lint.

## Standing rules (apply to every agent, Codex included)

- Watchdog protocol: spec-first → cheap production → Fable diff-review →
  mechanical gates → live verification. Never merge unreviewed delegate
  output. Dry-run before every corpus write; corpus writes are Ben-run.
- Legal-judgment work (taxonomy semantics, codebook values, extraction-
  prompt changes) is drafted-by-anyone, REVIEWED-BY-FABLE, decided-by-
  Ben. A plausible-but-wrong legal answer is worse than no output.
- Never `git stash` on a shared worktree (two incidents 2026-07-20).
- Treat agent completion notifications as claims — verify state (git,
  DB, tests) before acting on them.
