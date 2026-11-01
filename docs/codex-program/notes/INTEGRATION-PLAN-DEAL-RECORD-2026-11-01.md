# Integration plan: one deal record across Corpus, Deal Storylines and the biopharma site (2026-11-01)

A dated architecture plan, commissioned in plan finding (312). It is not a plan authority: the executable checklist stays `docs/codex-program/notes/PRODUCT-LAUNCH-IMPLEMENTATION-PLAN-2026-09-04.md`, and nothing here edits it. Each work package below is written so a DeepSeek or Opus agent can execute it alone from the repository. Steps only Ben can do are marked **HUMAN REQUIRED** with the exact clicks or values.

## 0. Ben's request, and what this plan answers

> "an integrated product where for each deal there is one record page where I can navigate around, with the key information on the first page, e.g. the party names, advisers etc ... then I can go in and look at the timeline (and all of the other features of the deal storylines project) and also all of the details of merger agreement ... We'll also build out the ability to look at other things (e.g. the CVR agreement, the bankers opinion disclosure section, the projections etc) ... one source of truth for each deal ... a roadmap page of features to come ... edit pieces at a time ... leverage deepseek."

The answer in five lines:

1. **One host, two zones.** Corpus (`precedent-machine`, Vercel project `deal-corpus`) is the host and the only URL partners open. Deal Storylines stays its own repository and Vercel project and is mounted under the host at `/storylines/*` and `/api/storylines/*` by Next.js rewrites (a multi-zone). Nothing is merged into a monorepo; each project keeps its own branch cadence, tests and deploys.
2. **One deal record page** at `/deal/<deal_id>` in the host: overview first (parties, advisers by side and role, value, consideration, dates, status, press-release and filing sources), then a Storylines-style navy rail into Timeline, Proposals, Process, Board meetings, Documents, Advisers, Search (the Storylines zone), Merger agreement (the provisions page), Compare, Review, and placeholders for CVR agreement, Fairness opinion disclosure and Projections. `/roadmap` lists what is coming.
3. **One source of truth: a deal registry** in the product database (five small `deal_registry_*` tables, migrations in this repository, the host the only writer). Each module keeps its own records; the registry holds the deal's identity, the headline facts with their provenance, and the links into every module's records. Conflicts between modules are resolved by a fixed per-field precedence and surfaced on an admin page, never silently.
4. **One sign-in.** The host's existing `pm_session` cookie gates everything, including the Storylines zone (same origin, same cookie); the zone verifies the same HMAC with a shared `SESSION_SECRET` and opens its registered readers in production only to that session. Reviewer levels (work package 3) ride the same cookie.
5. **Sequenced around DeepSeek packages 2 and 3.** New files only until package 3 merges; the provisions page is pulled into the record shell afterwards. DeepSeek does the bulk coding; Opus/Fable does the data reconciliation, migration application, reviews and partner walkthrough.

## 1. What exists today (read 2026-11-01)

### 1.1 Corpus (`CodeNameHash/precedent-machine`, branch `codex/product-implementation-plan-20260904`)

- Next.js 14.2.21 pages router, npm, `node --test`. Vercel project `deal-corpus` (`prj_pseZ68ISXsxADzNcffHTO2NuGM8b`, team `team_Zu8dnrxhP3FY0BcfOZtQ4z71`). Domains: `deal-corpus.vercel.app` and `precedent-machine.vercel.app` (production, from `main`), `deal-corpus-preview.vercel.app` (branch domain for the product branch). CI `.github/workflows/ci.yml` runs on pushes to the product branch and `claude/festive-albattani-70cwn5`.
- Product database `sjumbznveyyiizhwvixj` (MICRO compute; the statement-timeout and disk incidents are findings (305) to (307)). Tables `product_*`; identity is `product_source_documents.source_document_id` (sha256 of the SEC exhibit) with `payload.parties` (`[{name, role: PARENT|COMPANY|MERGER_SUB}]`) and `payload.agreement_date`; runs are `product_analysis_runs.run_id`; releases are `product_agreement_releases` with `product_agreement_release_heads` as the current pointer. The legacy V1 project `tzulhdasmioeechxapdy` (never write) holds the 40-deal `deals` table (`id uuid, acquirer, target, value_usd, announce_date, sector, metadata`).
- Runs in the product database today: Apogee (`3a05728f...`, runs `5fcf3b0e` Sonnet READY and `03e04ede`, one release head, released with a warning), Skechers (`10fb2905...`, run `612ed714`, no release), QXO / TopBuild (`bbf9da55...`, run `24dbdaca`, no release). **Metsera is not in the product database**; its generations ran on the earlier stack and an ingestion hold stands until the site is release-ready (finding (302)).
- Auth: `middleware.js` + `lib/auth/gate.js` gate every page and route; `pm_session` is an HMAC-SHA256 cookie (Web Crypto, `SESSION_SECRET`), one owner credential (`AUTH_USERNAME`, `AUTH_PASSWORD`), an internal bearer `PRODUCT_INTERNAL_TOKEN` for `/api/product/*`. `/api/auth/session` answers `{authenticated, sub, admin}`.
- Design: `components/chrome/PwBar.jsx` (navy 58px bar, Inter Tight, pill links Index / Analysed / Compare / Review), `components/product/ProvisionRail.jsx` (navy 220px rail, the Storylines reference), the provisions page `pages/review/product/[id]/provisions.js`, the released deal page `pages/deals/v2/[id].js`, `pages/analysed/*` and `/api/product/compare/*` (DeepSeek package 1, merged).
- In flight: DeepSeek package 2 (compare in the page, sidebar block, Everything mode) and package 3 (review mode, feedback anywhere, `/admin/feedback`, reviewer levels, PwBar switcher). Package 3 owns `ProvisionTables.jsx`, `EvidenceSidebar.jsx`, `PublishedSummary.jsx`, `ReviewWorkspace.jsx`, `FocusedReview.jsx`, `ProvisionRail.jsx`, `PwBar.jsx`, `pages/review/product/[id].js`, `pages/review/product/[id]/provisions.js`, `pages/deals/v2/[id].js` and adds `supabase/migrations/<ts>_product_feedback.sql` with `product_feedback` and `product_reviewers`. **This plan touches none of those files until package 3 merges.**

### 1.2 Deal Storylines (`CodeNameHash/deal-storylines`)

- The local clone is `main` at `356b8ea` (2026-07-10) and is stale. The deployed app (Ben's URL, deployment `dpl_EmECdptRoD6W7oYhS7PXGfRMJteX`) is branch **`codex/baseline-audit-20260903`** at `5e3a43dd` (2026-11-01, "Ship completed deal library and precedent search"), deployed by CLI as previews (`target: null`). Production `deal-storylines.vercel.app` still points at the July build. Vercel project `prj_ewzZes5bs21bQi0A98Ze4WecdCIv`.
- Next.js 14.2.21 pages router, **pnpm**, `pnpm test` (`scripts/run-active-tests.js` with a no-network guard), `pnpm typecheck`, CI only on `main` and pull requests. 3,522 tracked files; `server-data/` is 111 MB of committed, hash-receipted reading packages (the readers are file-backed, not database-backed). Supabase project `ngbhshfsnghfwsoemshf` holds the v5 ledger (`actions`, `occurrences`, `deals_local` with the 12 V1 uuids, `deal_id_aliases`, and so on); `lib/server/env.js` refuses any other project ref.
- Routes: `/storylines/deals` (the deal index), `/storylines/deals/[dealId]?selection_kind=COMBINED_READING&registration_key=...&reading_revision=...&view=timeline|board|proposals|process|documents|advisers|background|search`, `/storylines/explore`, `/storylines/trust`, `/api/storylines/*`. Every product route already lives under `/storylines` or `/api/storylines`, which is what makes the multi-zone cheap.
- Identity: `transaction_id` is a 64-hex content id (TECHNICAL-SPEC: `contentId('PUBLIC_MA_DEAL/V1', {target_cik, announcement_source_key, announced_transaction_ordinal})`). Installed readings (`server-data/completed-reading-packages.json`, `completed-deal-catalogue.json`, `lib/server/current-private-readings.js`): Metsera / Pfizer `1cf52f32...` (key `metsera-board-detail-consolidated-local-20261027`, revision `353ca0d4...`), Momenta `40356c54...`, Omrix `a1ad1934...`, Intra-Cellular `690d0d98...`, Ambrx `35b1e601...`, Cougar `9a854a4c...`, Inphi `abfdb4f5...` (key `inphi-reviewed-connected-20261027`), SecureWorks (key `secureworks-prior-bid-reading-20261018`).
- Access: anonymous GET reads are allowed only when `VERCEL_ENV=preview` and the selection matches an installed reading exactly (`lib/server/public-combined-preview-read-access.js`); readers are closed in production; notes and writes need HTTP Basic reviewer auth from `STORYLINES_REVIEWER_CREDENTIALS_JSON` (`[{login, reviewer_id, secret}]`, `lib/server/phase1b-review-route.js`). No middleware. Design already uses the Paul, Weiss palette (`#03203D`, `#0B3D71`, `#5D7DA3`, `#B9C8DA`, `#F1F4F8`), Inter Tight and Source Serif 4 (self-hosted under `public/`).
- Rules the integration must respect (its CLAUDE.md and `docs/core`): Precedent Machine is read-only to that programme and no runtime code, database, CI or credential is shared; the deal is the shared object and "Deal Terms" is the product name for Corpus inside the combined product; `docs/PLAN.md` and `docs/core/DECISIONS.md` are its authorities; UI copy earns its place. More updates are coming from its own agents, so the zone must keep deploying on its own cadence.

### 1.3 Biopharma Intelligence (`CodeNameHash/biopharma-intelligence`)

- Static site (`dist/`, no server), Vercel project `pw-biopharma-intelligence` (`prj_wS0zCnOQ6qplhceRQG9sPsuykIIk`), aliases `pw-biopharma-intelligence.vercel.app` and `pw-biopharma.vercel.app`. Data is JSON under `dist/data/` (2,262 deals, 2,694 companies, firms, banks, bankers, people, `canonical-index.json` with stable keys such as `company:cik:2040807` for Metsera; deals are addressed by array index, not a stable id). A deal record carries `n` (name), `t` (type), `dt` (announced), `cd` (completed), `v` (value $m), `cn` (consideration text), `tc/ac` (target/acquirer counsel firm indexes), `tb/ab` (banks), `tl/al` (lawyers), `pw` (Paul, Weiss side), `su` (sources), `src`, `outcome`, `stc` (structure), `ta`. Metsera appears three times: Pfizer (index 63, 2025-09-22, $9,061m, Completed), Novo Nordisk (52, competing, Unsuccessful), Amneal licence (1,543). Supabase migrations exist in the repo but no project is created; `localStorage` holds user state. The per-transaction page (facts list: Announced, Completed, Outcome, Type, Value, Upfront, Target, Acquirer, counsel and banks by side, Paul, Weiss role, Structure; Lawyers; Sources) is the inspiration for the overview.

## 2. Architecture decision

### 2.1 Options weighed

| Option | Edit pieces at a time | Storylines keeps evolving | DeepSeek in parallel | One URL soon | Cost |
| --- | --- | --- | --- | --- | --- |
| Monorepo (merge both repos) | Poor: one tree, one CI, pnpm vs npm | Freezes it during the merge; 111 MB `server-data` and 3,500 files move | Collides with packages 2 and 3 | Weeks | High |
| One app absorbs the other | Poor | Same freeze | Collides | Weeks | High |
| New thin shell app (third repo) | Good | Good | Good | One more project, three deploys, PwBar duplicated, a third auth | Medium |
| **Multi-zone: Corpus hosts, Storylines mounted by rewrites** | Good: each repo edits its own pages | Good: the zone deploys on its own cadence; the host only pins its origin | Good: host changes are new files; zone changes are small and additive | Days | Low |
| Vercel Microfrontends product | As above | As above | As above | Days | Unverified plan availability and Pages-router `_next/data` behaviour; falls back to rewrites anyway |

**Recommendation: multi-zone with plain Next.js rewrites, host = Corpus.** Reasons: (a) the Storylines routes are already namespaced under `/storylines`, so no page moves; (b) a single origin gives a single cookie, which is the only way to get one sign-in across two apps on `vercel.app` (the public-suffix rule forbids a shared cookie across `deal-corpus.vercel.app` and `deal-storylines.vercel.app`); (c) the host already has the gate, the design system and the product database; (d) the zone remains independently deployable, so "more updates are coming" costs nothing. What it costs: an `assetPrefix` and a `public/` path move in Storylines, one verifier of the host session in Storylines, and a production promotion of the Storylines branch.

Why not the biopharma site as host or as a zone: it is static and its data is a read-only Notion copy. It becomes a **feed** into the registry (advisers, values, dates, sources, Paul, Weiss role) and a link target for company and adviser pages. No embedding.

### 2.2 The target product map

```
deal-corpus.vercel.app (host: precedent-machine)
├─ /                        index (existing) + "Deal record" link per row
├─ /deal                    deal list from the registry, module badges
├─ /deal/[dealId]           OVERVIEW (registry): parties, advisers, value, dates, status, sources, module status
├─ /deal/[dealId]/agreement MERGER AGREEMENT: the provisions page body in the record shell (after package 3)
├─ /deal/[dealId]/compare   Compare: /analysed/compare pre-selected (link in phase 1, embedded later)
├─ /deal/[dealId]/review    Review mode for the linked run (package 3's /review/product/[id])
├─ /deal/[dealId]/documents Sources and future documents: CVR, fairness opinion disclosure, projections (placeholders)
├─ /deal/by/[module]/[externalId]   resolver: redirects to /deal/[dealId] (used by the zone's back link)
├─ /roadmap                 features to come (data file, not code)
├─ /admin/registry          registry rows, conflicts, overrides, link verification
├─ /storylines/*            ZONE -> deal-storylines (Timeline, Proposals, Process, Board, Documents, Advisers, Search, Explore)
├─ /api/storylines/*        ZONE
└─ /storylines-assets/*, /storylines-public/*, /_next/data/:build/storylines/*   ZONE assets and data
```

The rail on every `/deal/[dealId]/*` page (and the "Deal record" link the zone shows) is the navigation Ben asked for: Overview · Timeline · Proposals · Process · Board meetings · Documents · Advisers · Search · Merger agreement · Compare · Review · CVR agreement (coming) · Fairness opinion (coming) · Projections (coming) · Roadmap. Storylines items are real links into the zone with the deal's registered selection (`selection_kind`, `registration_key`, `reading_revision`, `view`) taken from the registry's link row.

## 3. The deal registry (source of truth)

### 3.1 Where it lives and who writes it

Five tables with the prefix `deal_registry_` in the product database `sjumbznveyyiizhwvixj`, created by a migration in `supabase/migrations/` of this repository. The host is the only writer (admin page, backfill scripts, intake hook). Storylines reads nothing from it directly (its "no shared database" rule stands): it links to `/deal/by/storylines/<transaction_id>` and the host resolves. The biopharma site is a feed read by a backfill script from its repository clone. Load on MICRO compute is negligible: tens of rows, three indexed reads per page, cached in process for 60 s.

Why not a new Supabase project: a sixth project, a third credential set and a third migration path for tens of rows is not worth it; and if the product database is upgraded (finding (312), micro to small) the registry rides along. Why not the Storylines database: its env guard refuses other project refs and the Storylines programme treats Corpus as the deal-id authority (its `PLAN.md` non-negotiable 1), which this registry formalises.

### 3.2 Schema (`supabase/migrations/20261102000000_deal_registry.sql`)

```sql
create table deal_registry_deals (
  deal_id uuid primary key,                       -- reused from V1 deals.id where one exists; else gen_random_uuid()
  slug text not null unique,                      -- 'metsera-pfizer-2025'; lower-case, [a-z0-9-]
  target_name text not null,
  target_cik text,
  acquirer_name text,
  acquirer_cik text,
  announced_on date,
  signed_on date,                                 -- agreement date
  closed_on date,
  status text not null check (status in ('ANNOUNCED','PENDING','COMPLETED','TERMINATED','SUPERSEDED','UNKNOWN')),
  deal_type text,                                 -- 'Acquisition', 'Licence', ...
  structure text,                                 -- 'Reverse triangular merger, cash', tender offer, ...
  consideration_text text,                        -- the headline consideration sentence
  headline_value_usd numeric,                     -- aggregate, in dollars
  per_share_price numeric,
  has_cvr boolean,
  sector text,
  pw_role text,                                   -- 'Counsel to the target' | null
  partner_visible boolean not null default false, -- what partners may open
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
create table deal_registry_parties (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deal_registry_deals(deal_id) on delete cascade,
  side text not null check (side in ('TARGET','ACQUIRER','MERGER_SUB','COMPETING_BIDDER','GUARANTOR','OTHER')),
  name text not null,
  cik text, ticker text, role_detail text,
  ordinal int not null default 0,
  unique (deal_id, side, name)
);
create table deal_registry_advisers (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deal_registry_deals(deal_id) on delete cascade,
  side text not null check (side in ('TARGET','ACQUIRER','COMPETING_BIDDER','SPECIAL_COMMITTEE','OTHER')),
  kind text not null check (kind in ('LEGAL','FINANCIAL','OTHER')),
  firm_name text not null,
  firm_key text,                                  -- canonical key from the biopharma firms/banks registers when known
  role_detail text,                               -- 'M&A counsel', 'regular outside counsel', 'fairness opinion', ...
  named_people jsonb not null default '[]',
  unique (deal_id, side, kind, firm_name)
);
create table deal_registry_sources (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deal_registry_deals(deal_id) on delete cascade,
  kind text not null check (kind in ('PRESS_RELEASE','8K','MERGER_AGREEMENT','DEFM14A','PREM14A','SC14D9','SC_TO','DEFM14C','S4','CVR_AGREEMENT','FAIRNESS_OPINION','PROJECTIONS','OTHER')),
  url text not null,
  title text, filed_on date, accession text, sha256 text, note text,
  unique (deal_id, url)
);
create table deal_registry_links (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deal_registry_deals(deal_id) on delete cascade,
  module text not null check (module in ('CORPUS','STORYLINES','BIOPHARMA','V1')),
  kind text not null check (kind in ('SOURCE_DOCUMENT','RUN','RELEASE','READING','V1_DEAL','TRANSACTION','COMPANY')),
  external_id text not null,                      -- source_document_id | run_id | release_id | transaction_id | V1 uuid | biopharma stable id or fingerprint
  params jsonb not null default '{}',             -- STORYLINES READING: {selection_kind, registration_key, reading_revision}; CORPUS RUN: {status, provider}
  label text,
  is_primary boolean not null default false,      -- the run/reading the record page opens by default
  verified_at timestamptz,                        -- last time the target was confirmed to exist
  unique (module, kind, external_id)
);
create table deal_registry_field_sources (        -- provenance and conflicts per headline field
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deal_registry_deals(deal_id) on delete cascade,
  field text not null,                            -- 'target_name', 'announced_on', 'headline_value_usd', 'advisers', ...
  value_text text not null,
  module text not null check (module in ('CORPUS','STORYLINES','BIOPHARMA','V1','MANUAL')),
  source_ref text,                                -- the row or file the value came from
  chosen boolean not null default false,
  reason text,                                    -- why chosen or overridden
  recorded_at timestamptz not null default now(),
  recorded_by text
);
create index on deal_registry_links (deal_id);
create index on deal_registry_field_sources (deal_id, field);
alter table deal_registry_deals enable row level security;  -- same posture as product_* (service role only); repeat for each table
```

Only the service role reads or writes these tables (the host's `getProductSupabase`), exactly as the `product_*` tables.

### 3.3 Precedence: how a conflict between modules is resolved

A registry field has one chosen value and keeps every candidate in `deal_registry_field_sources`. The chooser is deterministic (`lib/registry/precedence.js`), and a `MANUAL` row always wins:

| Field | Order of preference | Why |
| --- | --- | --- |
| target_name, acquirer_name, merger sub, signed_on | CORPUS > STORYLINES > BIOPHARMA > V1 | Corpus reads them from the agreement's own cover and preamble with code checks (CODEBASE-GUIDE, work package C6) |
| announced_on, closed_on, status, headline_value_usd, per_share_price, consideration_text, has_cvr, deal_type, structure, pw_role | BIOPHARMA > STORYLINES > V1 > CORPUS | The biopharma data carries dated, sourced deal facts from Deal Point Data; Corpus only knows the agreement |
| advisers (legal, financial) | STORYLINES > BIOPHARMA > V1 | Storylines cites the filing's own adviser disclosure; biopharma lists firms and banks by side without a cited span |
| sources (press release, filings) | BIOPHARMA + STORYLINES + CORPUS, union | Sources are not in conflict; each is kept with its origin |
| sector, cik, ticker | BIOPHARMA > V1 > STORYLINES | The biopharma canonical index keys companies by CIK |

A differing candidate from a lower-ranked module is not an error; it is shown on `/admin/registry` as a conflict with both values and their sources, and Ben or a reviewer can pin a `MANUAL` value with a reason. Two candidates that differ only by normalisation (case, suffixes such as "Inc." and ", Inc", whitespace) are not conflicts; `lib/registry/normalise.js` defines the comparison and is tested.

### 3.4 Backfill and matching of existing records

`scripts/registry/backfill.js --corpus --v1 --storylines=<path to deal-storylines clone> --biopharma=<path to biopharma-intelligence clone> --write` reads:

- **Corpus**: `product_source_documents` (payload parties, agreement_date, retrieval_url), `product_analysis_runs`, `product_agreement_releases` and heads (product database).
- **V1**: `deals` from `tzulhdasmioeechxapdy` through the existing `getServiceSupabase` client (read only; this is the one read the host already makes for the V1 index).
- **Storylines**: the clone's committed `server-data/completed-reading-packages.json`, `server-data/completed-deal-catalogue.json` and `lib/server/current-private-readings.js` (no database, no credential); optionally its `deals_local` rows if `STORYLINES_SUPABASE_URL` and a read key are given locally (never on the deployment).
- **Biopharma**: the clone's `dist/data/deals.json`, `companies.json`, `firms.json`, `banks.json`, `canonical-index.json`.

Matching is by normalised target name plus a date within 45 days of the announced or agreement date, exactly as the Storylines resolver does today (`lib/resolve-deal.js`, `WINDOW_DAYS = 30`, widened because agreement and announcement dates differ by a day or two). An ambiguous match (two candidates) is written to the report, not to the database. The script prints a report (`docs/codex-program/notes/REGISTRY-BACKFILL-REPORT-<date>.md`, the one note the package may create) listing for every deal which module records it linked and every field conflict. Opus reviews the report before `--write` is run against the product database.

Expected result of the first backfill (from this session's reads):

| Deal | Registry id | Corpus | Storylines | Biopharma | V1 |
| --- | --- | --- | --- | --- | --- |
| Metsera / Pfizer | `885edae5-49e8-464a-9f33-edd229119d7c` (V1 reuse) | none (ingestion hold) | READING `1cf52f32...`, key `metsera-board-detail-consolidated-local-20261027`, revision `353ca0d4...` | deals.json 63 (Pfizer), 52 (Novo competing, `COMPETING_BIDDER` party), company `company:cik:2040807` | yes |
| Apogee / Andor | V1 reuse if present, else new | SOURCE_DOCUMENT `3a05728f...`, RUN `5fcf3b0e` (primary), RUN `03e04ede`, RELEASE (head) | none | backfill reports | backfill reports |
| Skechers / Beach Acquisition | as above | `10fb2905...`, RUN `612ed714` | none | likely none (not biopharma) | backfill reports |
| QXO / TopBuild | `7dc3a05f-b170-4d59-a255-b7103cca16e1` (V1 reuse) | `bbf9da55...`, RUN `24dbdaca` | V1_DEAL only (legacy deal-objects export, no registered reading) | none | yes |
| Momenta, Omrix, Intra-Cellular, Ambrx, Cougar (J&J), Inphi / Marvell, SecureWorks / Sophos | new (SecureWorks: V1 reuse `bf31d586...`) | none | READING each | backfill reports (J&J deals are in the biopharma data; Inphi is not) | SecureWorks yes |

Storylines' `deal_id_aliases` table exists for exactly this: when a Storylines deal later needs the registry id, the alias row `transaction_id -> registry deal_id` can be written by its own agents from `/api/registry/links` output. That is a Storylines-side choice and not required by this plan.

### 3.5 Keeping it true

- **Intake hook (Corpus)**: when `pages/api/product/intake.js` accepts a new source document, `lib/registry/upsert-from-source.js` creates or links the deal (match by parties + agreement date; otherwise a new deal with `partner_visible=false`). The hook is additive and wrapped in try/catch so an intake never fails because of the registry.
- **Links verified**: `/api/registry/verify` (admin) checks each CORPUS link against the product tables and each STORYLINES link by `HEAD` to the zone's catalogue (`/api/storylines/...` is not needed: the host reads the committed catalogue URL list it was given at backfill and re-checks `GET /storylines/deals/<id>?...` returns 200 through the zone). `verified_at` is set; a 404 shows as "link stale" on the record and the admin page.
- **Storylines updates**: a new reading revision for a deal is a new link row (`is_primary` moves), never an edit of the old one, mirroring Storylines' own immutability.

## 4. The deal record page

### 4.1 Overview (`/deal/[dealId]`)

Server-rendered (`getServerSideProps`) from the registry only (three reads: deal + parties + advisers + sources + links in one `Promise.all`; no `product_fact_*` reads). Layout in the Corpus language: `PwBar` (unchanged until package 3 merges; then `active="deals"`), the navy rail (`components/record/RecordRail.jsx`, built on the same measurements as `ProvisionRail`: 220 px, `#03203D`, the deal title in Inter Tight 700 22 px, 13 px / 500 items with 1 px hairlines, the active item a white block), the header exactly as the provisions page header (eyebrow, large title "Target / Acquirer", one metadata line, the 10 px mist rule), then:

1. **Transaction**: announced, signed, completed, status, type, structure, consideration (text), headline value, per-share price, CVR, sector, Paul, Weiss role. Each value carries a quiet provenance line (`Corpus · agreement cover`, `Biopharma · Deal Point Data`, `Manual · Ben, reason`) in the page's QUIET registry style (`font-ui text-[11px] text-[#6B7785]`).
2. **Parties**: target, acquirer, merger sub, competing bidders, with CIK and ticker; a link to the biopharma company page when a company key exists (`https://pw-biopharma.vercel.app/company.html?id=<token>`; opens in a new tab).
3. **Advisers**: a matrix with adviser kind as rows and parties as columns (the Storylines adviser matrix shape), named people under the firm.
4. **Sources**: press release, 8-K, merger agreement exhibit, proxy, CVR agreement, fairness opinion section, projections, each with the kind, date and link.
5. **Modules**: three cards, each stating what exists for this deal and linking in: *Storylines* (reading installed, revision, "Timeline" / "Process" / "Search"), *Merger agreement* (run state: Draft / Released / Released with warning / Not analysed; "Open provisions", "Compare", "Review"), *Market context* (biopharma transaction and company records; "Open"). Absence is typed, never blank: "Not analysed in Corpus yet" with the intake link for the owner.

Empty registry fields render as "Not recorded" (the biopharma site's own rule), never as an empty cell.

### 4.2 Tabs that leave the shell

Timeline, Proposals, Process, Board meetings, Documents, Advisers and Search are links into the zone: `/storylines/deals/<transaction_id>?selection_kind=COMBINED_READING&registration_key=<k>&reading_revision=<r>&view=<timeline|proposals|process|board|documents|advisers|search>`. The zone page shows its own header with a "Deal record" link back to `/deal/by/storylines/<transaction_id>` (work package I-3). That is the whole coupling: one URL each way.

### 4.3 Tabs inside the shell

- `/deal/[dealId]/agreement`: phase 1 redirects to the primary run's page (`/deals/v2/<source_document_id>` when a release head exists, else `/review/product/<run_id>/provisions`). Phase 4 renders the provisions body inside the record shell (the rail then lists the agreement's sections under "Merger agreement", the way `ProvisionRail` does today).
- `/deal/[dealId]/compare`: redirect to `/analysed/compare?runs=<primary run>` (package 1's picker) in phase 1; the in-page Compare toggle (package 2) already works on the provisions page.
- `/deal/[dealId]/review`: redirect to package 3's `/review/product/<run_id>` (review mode).
- `/deal/[dealId]/documents`: the sources list plus three placeholder panels (CVR agreement, Fairness opinion disclosure, Projections) each with: what it will show, what source it needs (a `deal_registry_sources` row of that kind), and a link to the roadmap item. When a source row of that kind exists, the panel shows the link and "Analysis not built yet".

### 4.4 Roadmap (`/roadmap`)

Data file `contracts/roadmap/roadmap.v1.json` (`[{key, title, status: 'LIVE'|'IN_PROGRESS'|'PLANNED'|'IDEA', module, summary, ben_words?, depends_on[], target?}]`), rendered as grouped lists in the page language. Seed items: compare in the page (IN_PROGRESS, package 2); review mode, feedback anywhere, reviewer levels (IN_PROGRESS, package 3); the deal record and registry (IN_PROGRESS, this plan); one sign-in across Storylines (IN_PROGRESS); CVR agreement analysis (PLANNED); fairness opinion disclosure (PLANNED); projections (PLANNED); Storylines explore across deals (LIVE in the zone); market context from the biopharma data (PLANNED); per-user accounts and audit (PLANNED); alerts on new filings (IDEA); exports (IDEA). Ben edits the JSON; a test validates the shape.

## 5. Auth and access

- **Partners sign in once** at the host `/login`. The host middleware gates every path, including `/storylines/*` and `/api/storylines/*`, so a partner never reaches the zone without a session. `/storylines-assets/` and `/storylines-public/` join `PUBLIC_PREFIXES` in `lib/auth/gate.js` (static files only; the test `tests/auth-gate.test.js` pins it).
- **The zone trusts the same cookie.** Storylines gets `lib/server/host-session.js`: a copy of the host's `lib/auth/session.js` verifier (Web Crypto HMAC-SHA256, two-part token, `sub` claim), using the zone's `SESSION_SECRET` (**HUMAN REQUIRED: the same value as the host's**). `resolveRegisteredCombinedReadingPage` and the registered-reading APIs accept a request when either (a) the existing Basic reviewer auth passes, (b) the existing preview anonymous rule passes, or (c) a valid host session is present. Rule (c) applies in production too, which replaces "registered readers remain closed in production" with "closed in production unless the request carries the host session". Direct visits to `deal-storylines.vercel.app` cannot carry that cookie (no login page there), so the zone stays closed on its own domain. Non-GET actions keep requiring Basic reviewer auth until Storylines maps reviewer identity to the host user (open question 6).
- **Reviewer levels** (package 3): the `Reviewing as` cookie set by the PwBar switcher is a host cookie; the record page's feedback control and `/admin/registry` read it through package 3's reader. The zone's notes keep their own `reviewer_id` for now.
- **Partner exposure of unreleased data**: `deal_registry_deals.partner_visible` and a host env `RECORD_PARTNER_MODE=true` hide from non-admin sessions every deal not marked visible, every Corpus run without a release head, and the owner-only controls. `/api/auth/session` already distinguishes `admin` (the owner login). With one shared partner credential (open question 2) the owner remains `ben`; partners sign in as a second username that `verifyCredentials` accepts from `AUTH_PARTNER_USERNAME` / `AUTH_PARTNER_PASSWORD` (work package I-6), `admin=false`.

## 6. Deploy

| Item | Host (`deal-corpus`) | Zone (`deal-storylines`) | Biopharma |
| --- | --- | --- | --- |
| Branch deployed | `codex/product-implementation-plan-20260904` (production branch switched to it, open question 1) | `codex/baseline-audit-20260903` promoted to production | `main`, unchanged |
| URL partners open | `https://deal-corpus.vercel.app` (one URL) | not opened directly | linked from the overview |
| Env vars (names only) | existing: `SESSION_SECRET`, `AUTH_USERNAME`, `AUTH_PASSWORD`, `PRODUCT_SUPABASE_URL`, `PRODUCT_SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PRODUCT_INTERNAL_TOKEN`; new: `STORYLINES_ORIGIN` (`https://deal-storylines.vercel.app`), `RECORD_PARTNER_MODE`, `AUTH_PARTNER_USERNAME`, `AUTH_PARTNER_PASSWORD`, `BIOPHARMA_ORIGIN` (`https://pw-biopharma.vercel.app`) | existing: `STORYLINES_REVIEWER_CREDENTIALS_JSON`, Supabase vars; new: `SESSION_SECRET` (same value as host), `HOST_ORIGIN` (`https://deal-corpus.vercel.app`, for absolute back links in emails later; the page uses relative links) | none |
| Deployment protection | Production public, app login in front | Production public by URL, app gate closes readers without the host session; previews keep Vercel Authentication | as is |
| Preview of the integration | the branch domain `deal-corpus-preview.vercel.app` keeps pointing at the product branch; a branch `deepseek/deal-record-*` gets its own preview URL, protected; the manager reads it with the Vercel MCP or the bypass secret | PR previews are protected and the host cannot proxy them; the host's `STORYLINES_ORIGIN` on preview may be pointed at a promoted staging alias (`deal-storylines-staging.vercel.app`, HUMAN REQUIRED to create if wanted) | n/a |

Host rewrites (`next.config.js`, additive):

```js
async rewrites() {
  const origin = (process.env.STORYLINES_ORIGIN || '').replace(/\/$/, '');
  if (!origin) return { beforeFiles: [] };
  return { beforeFiles: [
    { source: '/storylines', destination: `${origin}/storylines` },
    { source: '/storylines/:path*', destination: `${origin}/storylines/:path*` },
    { source: '/api/storylines/:path*', destination: `${origin}/api/storylines/:path*` },
    { source: '/storylines-assets/:path*', destination: `${origin}/storylines-assets/:path*` },
    { source: '/storylines-public/:path*', destination: `${origin}/storylines-public/:path*` },
    { source: '/_next/data/:build/storylines/:path*', destination: `${origin}/_next/data/:build/storylines/:path*` },
  ] };
}
```

Zone config (`next.config.js` in Storylines, additive): `assetPrefix: process.env.STORYLINES_ASSET_PREFIX || '/storylines-assets'` and every absolute reference to a `public/` file moved under `public/storylines-public/` (fonts, favicon). The `_next/data` rewrite keeps client-side navigation inside the zone soft; if Next refuses it for a foreign build id, the fallback is Next's own hard navigation, which still works (acceptance test I-3.6 records which).

## 7. Work packages

House rules for every package: branch from the named base; never force-push; plain commit messages, no model names; no secrets in the repository; product database only through `getProductSupabase` / the existing stores; never touch `tzulhdasmioeechxapdy` except the one read-only `deals` select the host already makes; no new status documents beyond the one note named in the package; one PR back to the base; the note and the PR description are the only reports. Tests: `node:test` + `assert/strict`, new files appended to `test:active` in `package.json` (host) or added to `scripts/run-active-tests.js` (zone). Screenshots at 1400 px and 390 px with Playwright installed outside the repository.

### I-0. Decisions and the reconciliation sheet (Opus or Fable, 0.5 day)

- Read this plan and the open questions; adopt the defaults for every question Ben has not answered and record them at the top of the note `docs/codex-program/notes/INTEGRATION-DECISIONS-2026-11-0X.md`.
- Produce the reconciliation sheet for the first backfill (section 3.4 table with every id filled from the live sources) so I-1's script has a fixture to assert against: `tests/fixtures/registry/first-backfill.v1.json`.
- Apply the registry migration to the product database with the Supabase MCP (`apply_migration`) once I-1's PR is green. **HUMAN REQUIRED fallback** if the manager has no MCP: Ben pastes the migration into the Supabase SQL editor for project `sjumbznveyyiizhwvixj` and runs it.

### I-1. Registry: schema, library, backfill (DeepSeek, 1.5 days)

- Branch `deepseek/deal-registry-20261102` off `codex/product-implementation-plan-20260904`. Note: `docs/codex-program/notes/DEEPSEEK-DEAL-REGISTRY-2026-11-02.md`.
- Files: `supabase/migrations/20261102000000_deal_registry.sql` (section 3.2, timestamp after the latest migration including package 3's); `contracts/registry/deal-record.v1.json` (the JSON shape the API returns: `{schema_version:'DEAL_RECORD/V1', deal, parties[], advisers[], sources[], links[], field_sources[]}`); `lib/registry/store.js` (`RegistryStore({client})`: `getDeal`, `getDealBySlug`, `listDeals({partnerOnly})`, `findByLink(module, kind, external_id)`, `upsertDeal`, `setLinks`, `recordFieldSource`, `chooseFields`); `lib/registry/normalise.js`; `lib/registry/precedence.js` (section 3.3 table as data); `lib/registry/match.js` (name + date window); `lib/registry/upsert-from-source.js` (the intake hook, called from `pages/api/product/intake.js` inside try/catch after a successful submission); `scripts/registry/backfill.js` (section 3.4, `--dry-run` default, `--write` to persist, writes the report note); `pages/api/registry/deals.js` (GET list), `pages/api/registry/deals/[dealId].js` (GET record; PATCH admin: manual field override with reason), `pages/api/registry/links.js` (GET by module/external id), `pages/api/registry/verify.js` (POST admin).
- Do not touch: anything package 2 or 3 owns; `lib/product/table-view.js`; `contracts/product/*`.
- Tests (`tests/registry-*.test.js`): normalise and match (Metsera, Inc. vs Metsera Inc; a 2-day date gap matches; a 60-day gap does not; two candidates is ambiguous), precedence (biopharma value beats Corpus for announced_on; Corpus beats all for parties; MANUAL beats all), backfill against the I-0 fixture with fake clients and the committed Storylines/biopharma JSON copied into `tests/fixtures/registry/` (every expected link row produced, every conflict reported, nothing written in dry run), API handlers 200/401/403/404/405, intake hook never throws.
- Acceptance: `npm run test:active` green apart from the two known failures; `node scripts/registry/backfill.js --dry-run ...` against the live product database prints the report with the Metsera, Apogee, Skechers, QXO rows of section 3.4; after I-0 applies the migration, `--write` runs once and `GET /api/registry/deals` on the preview returns those deals.

### I-2. The deal record, list, roadmap and admin pages (DeepSeek, 2 days)

- Branch `deepseek/deal-record-20261103` off the product branch with I-1 merged. Note: `docs/codex-program/notes/DEEPSEEK-DEAL-RECORD-2026-11-03.md`.
- Files: `pages/deal/index.js`, `pages/deal/[dealId]/index.js`, `pages/deal/[dealId]/agreement.js`, `compare.js`, `review.js`, `documents.js` (section 4), `pages/deal/by/[module]/[externalId].js` (302 to `/deal/<id>`; 404 page in the page language when unknown), `pages/roadmap.js` + `contracts/roadmap/roadmap.v1.json`, `pages/admin/registry.js` (owner only: table of deals, conflicts with both values, override form, verify button, partner_visible toggle), `components/record/{RecordShell,RecordRail,RecordHeader,FactList,AdviserMatrix,SourceList,ModuleCards,Provenance}.jsx`, `lib/registry/record-view.js` (pure: registry rows to the page model, including the Storylines hrefs built from link params and the module states), `pages/index.js` gets a "Deal record" link on each released row when a registry link exists (read through `lib/registry/store.js` in `getStaticProps`, try/catch, empty on failure).
- Style: the provisions page vocabulary only (white, `#DCE3E1` rules, `#03203D`, `#0B3D71`, `#6B7785`, Inter Tight; eyebrow 10.5 px uppercase; body 12.5 px); no cards, no shadows; the rail measurements of `ProvisionRail`; `PwBar` rendered as is with `active="index"` until I-4.
- Do not touch: package 2/3 files, `PwBar.jsx`, `ProvisionRail.jsx` (copy its measurements into `RecordRail`; the two are unified in I-4).
- Tests: `record-view` (module states: Not analysed / Draft / Released / Released with warning; Storylines href built exactly; partner mode hides drafts), static renders of the overview with the I-0 fixture (every section present, "Not recorded" for an empty field, provenance line per value), the resolver route (302 / 404), roadmap JSON validation, admin page 403 for non-admin.
- Acceptance: on the preview, `/deal/<metsera id>` renders parties, advisers, sources and the three module cards from the registry in under 1 s warm; `/deal/<apogee id>/agreement` redirects to the released page; `/roadmap` renders the seed; screenshots at 1400 and 390 with no horizontal overflow.

### I-3. The zone: mount Storylines under the host with one sign-in (DeepSeek in the Storylines repository, 1.5 days; a 0.5-day host half)

- Storylines branch `deepseek/host-zone-20261103` off **`codex/baseline-audit-20260903`** (the deployed branch, not `main`). PR back to that branch. Report: `docs/handoff/HOST-ZONE-2026-11-03.md` in that repository (its handoff convention). Follow its CLAUDE.md: pnpm, `pnpm test`, `pnpm typecheck`, UI copy rule, no new vocabulary, no Precedent Machine writes.
- Zone files: `next.config.js` (`assetPrefix`), `public/storylines-public/**` (move fonts and favicon; update every `url(/fonts/...)`, `href="/..."`, `src="/..."` found by `rg -n "url\(/|href=\"/|src=\"/" components lib pages styles public --glob '!**/*.json'` that points at `public/`), `lib/server/host-session.js` (verifier, Web Crypto, same token format as the host's `lib/auth/session.js`; tests with a token signed by a test secret), `lib/server/public-combined-preview-read-access.js` and `registered-combined-reading-page.js` / `-api.js` / `-search-api.js` / `completed-deal-search.js` (accept a valid host session as a read grant in any environment), `components/chrome/ProductNavigation.js` (a "Deal record" item linking to `/deal/by/storylines/<transaction_id>` when `dealId` is known, and the brand reading "Corpus · Deal Storylines"), `tests/host-session.test.js`, `tests/public-combined-preview-read-access.test.js` (extended).
- Host files (same package, branch `deepseek/host-zone-20261103` in precedent-machine): `next.config.js` rewrites (section 6), `lib/auth/gate.js` `PUBLIC_PREFIXES` += `/storylines-assets/`, `/storylines-public/`, `tests/auth-gate.test.js` extended, `lib/registry/record-view.js` hrefs confirmed relative.
- **HUMAN REQUIRED** (Vercel dashboard, team `codenamehashs-projects`): (1) project `deal-storylines` → Settings → Environment Variables → add `SESSION_SECRET` (Production and Preview) with the same value as `deal-corpus`'s `SESSION_SECRET`; (2) project `deal-storylines` → Settings → Git → Production Branch → `codex/baseline-audit-20260903`, then Deployments → latest of that branch → "Promote to Production" (or `vercel promote <deployment-url> --scope codenamehashs-projects`); (3) project `deal-corpus` → Environment Variables → add `STORYLINES_ORIGIN=https://deal-storylines.vercel.app` (Production and Preview). If the manager's Vercel token can edit project settings these can be done by the agent with `update_project` and `create_project_env`; the 2026-11-01 token could not list env vars (403), so assume Ben.
- Acceptance (curl against the host preview with a session cookie obtained from `/api/auth/login`): 1. `GET /storylines/deals` 200 with the catalogue HTML; 2. `GET /storylines/deals/1cf52f32...?selection_kind=COMBINED_READING&registration_key=metsera-board-detail-consolidated-local-20261027&reading_revision=353ca0d4...&view=timeline` 200; 3. the same without the cookie → 302 `/login`; 4. `GET https://deal-storylines.vercel.app/storylines/deals/1cf52f32...?...` (direct, production, no cookie) → 401/404 unchanged; 5. every `<script src>` and `<link href>` in the proxied HTML resolves 200 through the host; 6. in Playwright, clicking Timeline → Process inside the zone does not show the host 404 and records whether the navigation was soft or hard; 7. the "Deal record" link on the Metsera reading lands on `/deal/885edae5-...`; 8. `pnpm test`, `pnpm typecheck`, host `npm run test:active` green.

### I-4. After package 3 merges: the agreement inside the record shell (DeepSeek, 1 day)

- Branch `deepseek/record-agreement-20261105` off the product branch with package 3 merged. Note: `docs/codex-program/notes/DEEPSEEK-RECORD-AGREEMENT-2026-11-05.md`.
- Extract the body of `pages/review/product/[id]/provisions.js` (everything below the PwBar and rail: header, toolbar, `PublishedSummary`/`ProvisionTables`, sidebar) into `components/product/ProvisionsPageBody.jsx` with the page becoming a thin wrapper (byte-identical render pinned by the existing provisions tests). `pages/deal/[dealId]/agreement.js` renders `RecordShell` + `ProvisionsPageBody` for the primary run (released read when a head exists, draft read for the owner). `RecordRail` lists the agreement sections under "Merger agreement" using `railGroups` from `ProvisionRail` (the two rails become one component with a `mode`). `PwBar` gains `{ key: 'deals', href: '/deal', label: 'Deals' }` and the record pages pass `active="deals"`. `/deal/[dealId]/compare` embeds the Compare toggle state on (`localStorage` `pm-compare` set before render is not acceptable; pass `initialCompare` prop through `ProvisionsPageBody`). `/deal/[dealId]/review` renders package 3's review mode in the shell the same way.
- Tests: wrapper render equals the former page render for the fixtures in `tests/product-provision-tables.test.js`; the record agreement page renders the rail sections and the body; PwBar shows Deals.
- Acceptance: Apogee at `/deal/<id>/agreement` is pixel-equivalent to `/deals/v2/3a05728f...` below the header; the sidebar, Compare, Everything, Specifics, See reason and Feedback all work in the shell; 1400/390 screenshots.

### I-5. Documents and the future analyses (DeepSeek, 0.5 day, after I-2)

- Branch `deepseek/record-documents-20261104`. `pages/deal/[dealId]/documents.js` lists `deal_registry_sources` by kind and shows the three placeholder panels; `/admin/registry` gains an "Add source" form (kind, url, title, date) so Ben can attach the CVR agreement, the fairness opinion section URL (proxy page anchor) and the projections section for Metsera without code. Roadmap items link here. Tests for the panel states (no source / source attached / analysis live).

### I-6. Partner readiness (DeepSeek 0.5 day; Opus walkthrough 0.5 day)

- Branch `deepseek/partner-mode-20261106`. `lib/auth/credentials.js` accepts a second configured login (`AUTH_PARTNER_USERNAME`, `AUTH_PARTNER_PASSWORD`; the owner stays `AUTH_USERNAME`); `RECORD_PARTNER_MODE` hides non-visible deals and unreleased runs for non-admin sessions on `/deal`, `/deal/*`, `/` and `/analysed`; the `Reviewing as` switcher (package 3) is the identity partners pick after signing in; `/admin/registry` has the `partner_visible` toggle (I-2). Tests: non-admin session cannot read a hidden deal (404, not 403, so existence is not revealed).
- **HUMAN REQUIRED**: set `AUTH_PARTNER_USERNAME` and `AUTH_PARTNER_PASSWORD` on `deal-corpus` (Production); decide `partner_visible` per deal on `/admin/registry`; add the partners' names to `product_reviewers` (package 3) with their levels; set `RECORD_PARTNER_MODE=true` on Production only.
- Opus walkthrough: sign in as the partner credential, open each visible deal, every rail item, the zone views, the agreement, compare, review, feedback; record defects in the walkthrough note; nothing ships to partners until the note says clean.

### I-7. Metsera on the V2 stack (Opus manager, when Ben lifts the hold)

- Submit the Pfizer / Metsera merger agreement exhibit URL (from the V1 `deals.metadata` or SEC) through the existing intake on the Sonnet default; the intake hook links the run to the registry deal `885edae5-...`; release after the lawyer loop as the plan's own checklist requires. This makes Metsera the one deal with all three modules live and is the demo deal. Cost per the extraction cost ledger note; needs Ben's go (open question 3).

### Ordering and parallelism

```
I-0 ──► I-1 ──► I-2 ──► I-5
              └► I-3 (zone + host halves; independent of I-2 apart from the back link target)
package 3 merges ──► I-4 ──► I-6 ──► partner week
I-7 any time after I-1 and Ben's go
```

I-1, I-2 and I-3 touch disjoint files from packages 2 and 3 and may run in parallel with them in separate worktrees. I-4 is the only package that edits package-3-owned files and waits for that merge.

### Who does what

| Work | Agent | Why |
| --- | --- | --- |
| I-1, I-2, I-3, I-4, I-5, I-6 coding and tests | DeepSeek | Mechanical, well-specified, large surface; cheap |
| I-0 decisions, fixture, migration application; backfill report review; precedence disputes; every PR review; partner walkthrough; I-7 | Opus / Fable (the manager session) | Judgment on deal identity and legal copy; MCP access to Supabase and Vercel |
| Storylines-side review of I-3 | the Storylines programme's own reviewer lane if it is running; else Opus | Its CLAUDE.md requires one owner per workstream branch |

## 8. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Data drift between modules (a Storylines reading re-registered, a Corpus run re-published, biopharma JSON refreshed) | Links are append-only with `is_primary`; `verify` marks stale links; the backfill is idempotent and re-runnable (`--dry-run` shows the diff); field candidates are kept with provenance and the chooser is deterministic |
| A Storylines update breaks the mount (route rename, asset path change) | The host pins only an origin and five path prefixes; Storylines' CI adds a test that every page lives under `/storylines` or `/api/storylines` and every `public/` reference is under `/storylines-public/`; the host's `verify` and a weekly Playwright smoke (`scripts/registry/smoke-zone.js`) catch a break before partners do |
| `_next/data` across zones on Next 14 | The explicit rewrite; the fallback is a hard navigation, which still renders; recorded by I-3 acceptance 6; upgrade path is `basePath` in the zone once its agents are ready to drop the `/storylines` page folder |
| MICRO compute on the product database (timeouts, disk) | The record page reads registry rows only, never facts; in-process 60 s cache; `Cache-Control: private, no-store`; the upgrade to small is already on Ben's list (finding (312)) and should land before partner week |
| One shared cookie means a leaked host session opens the zone | Same risk as today for the host; one-week TTL stands; the zone only grants reads (writes still need Basic reviewer auth); rotate `SESSION_SECRET` in both projects together |
| Partners see unreleased or unreviewed data | `RECORD_PARTNER_MODE`, `partner_visible`, release-head-only runs for non-admins; Storylines pages state `NOT_REVIEWED` and `fact_acceptance: false` already; the Opus walkthrough is the gate |
| Collision with DeepSeek packages 2 and 3 | New files only until package 3 merges; I-4 is the single package that edits their files and starts after the merge; ownership stated in every package |
| The Storylines deployed branch is not `main` and its CI runs only on `main` and PRs | I-3's PR to `codex/baseline-audit-20260903` runs CI; the production promotion is explicit; the host never points at a preview URL |
| Biopharma deals have no stable id | Link `external_id` uses the canonical index stable id for companies and a fingerprint `deals.json:<name>|<dt>` for transactions, recomputed and re-verified on each backfill; a changed fingerprint is a reported conflict, not a silent re-link |
| Vercel token limits (the 2026-11-01 token cannot list env vars) | Every Vercel setting is written as a HUMAN REQUIRED click with its fallback CLI line |

## 9. Open questions for Ben (numbered, each with the default the work proceeds on)

1. **Partner URL.** Switch `deal-corpus`'s production branch to `codex/product-implementation-plan-20260904` so partners open `https://deal-corpus.vercel.app`? Default: yes (HUMAN REQUIRED: project `deal-corpus` → Settings → Git → Production Branch). A custom domain (`corpus.<firm domain>`) is a later step.
2. **Partner sign-in.** One shared partner credential plus the "Reviewing as" switcher for the first round, per-user accounts later? Default: yes; per-user accounts are a roadmap item (I-6 names the two env vars).
3. **Metsera on V2.** Lift the ingestion hold for the Pfizer / Metsera agreement only, on the Sonnet default, so the demo deal has all three modules? Default: yes once I-3 is live, cost per the extraction cost ledger, released only after the lawyer loop.
4. **Registry ids.** Reuse the V1 `deals.id` uuids for the 40 seed deals (so Storylines' `deals_local` and aliases keep working) and mint new uuids for everything else? Default: yes.
5. **Which deals partners see first.** Default: Metsera (Storylines + biopharma; Corpus after 3), Apogee (released Corpus), the five J&J deals, Inphi and SecureWorks (Storylines); Skechers and QXO stay hidden until released.
6. **Storylines reviewer identity.** Map the zone's `reviewer_id` to the host's reviewer switcher so notes and feedback share one identity? Default: not now; the zone keeps Basic auth for writes, and the record page's feedback uses package 3's identity.
7. **Database compute.** Upgrade `sjumbznveyyiizhwvixj` from micro to small before partner week? Default: yes (HUMAN REQUIRED: Supabase dashboard → project → Settings → Compute and Disk).
8. **Where the biopharma site goes next.** Keep it as a static feed and link target, with its Supabase schema left unused, or start its backend? Default: feed and link target; nothing else changes there.
9. **Rewrites or Vercel Microfrontends.** Default: rewrites (section 6); revisit if the `_next/data` fallback proves visible.
10. **Product name in the chrome.** Keep "Corpus · Precedent intelligence" on the host bar and "Corpus · Deal Storylines" on the zone bar? Default: yes.
11. **Roadmap editing.** A JSON file in the repository (Ben edits, a test validates) rather than a database table? Default: JSON.
12. **Metsera's record and the Novo Nordisk bid.** Show Novo as a competing bidder party with its own biopharma transaction link on the Metsera record, not as a second deal? Default: yes (one deal, two bidders; the Storylines Process view already carries both).

## 10. Summary of HUMAN REQUIRED steps

| When | Where | What |
| --- | --- | --- |
| After I-1 is green, if the manager has no Supabase MCP | Supabase → `sjumbznveyyiizhwvixj` → SQL editor | Run `supabase/migrations/20261102000000_deal_registry.sql` |
| Before I-3 acceptance | Vercel → `deal-storylines` → Settings → Environment Variables | Add `SESSION_SECRET` (Production, Preview) with the host's value |
| Before I-3 acceptance | Vercel → `deal-storylines` → Settings → Git; Deployments | Production Branch = `codex/baseline-audit-20260903`; promote the latest deployment of it |
| Before I-3 acceptance | Vercel → `deal-corpus` → Settings → Environment Variables | Add `STORYLINES_ORIGIN=https://deal-storylines.vercel.app` (Production, Preview) |
| Before partner week | Vercel → `deal-corpus` → Settings → Git | Production Branch = `codex/product-implementation-plan-20260904` (question 1) |
| Before partner week | Vercel → `deal-corpus` → Environment Variables | `AUTH_PARTNER_USERNAME`, `AUTH_PARTNER_PASSWORD`, `RECORD_PARTNER_MODE=true` (Production) |
| Before partner week | Supabase → project → Compute | Upgrade micro to small (question 7) |
| Before partner week | `https://deal-corpus.vercel.app/admin/registry` | Toggle `partner_visible` per deal; add partner names to `product_reviewers` on `/admin/feedback` (package 3) |
| When ready | reply to the manager | Lift the ingestion hold for Metsera (question 3) |

Everything else in this plan is executable by an agent with repository access and the manager's MCP tools.
