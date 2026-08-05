# D2 resolution: adviser/lawyer entity classes (evidence-based)

Ben's instruction (DECISIONS 2026-07-23): "posture both lawyer and firm
names — search the existing results vs the internet and figure out which
is which." Done; the answer is unambiguous.

## Findings

1. **Legacy fields are cleanly split, corpus-wide** (live read of all 40
   deals via the production deals API): `law_firm` holds 29 distinct
   values, every one a law firm (Wachtell, Skadden, Kirkland, Cravath,
   Paul Weiss, …, all LLP-suffixed or recognized BigLaw); `lawyer` holds
   143 distinct values, every one an individual attorney name (several
   verified as known M&A partners — Barshay/Paul Weiss, Saeed/Cravath,
   Emmerich & Norwitz/Wachtell, Profusek/Jones Day). Zero banks in either
   field. Source pipeline: `lib/parser-v2/notice-advisors.js` extracts
   outside counsel (firm + "Attention:" names) from the Notices
   boilerplate — by construction legal counsel only.
2. **The canonical dimensions' real content**, previously thought
   unpinned, is pinned by the frozen reviewed slice
   `lib/canonical-v2/reviewed-qxo-no-shop-slice.js:184-185`:
   `adviser_firms: ['Paul Weiss', 'Jones Day']` (LAW firms — the name
   `adviser_firms` is misleading), `lawyers: ['Scott Barshay', 'Robert
   Profusek']` (individuals). The structural validator
   (`serving-projection.js:202-229`) imposes string-array shape only.
3. **Financial advisers are a separate, dormant path**:
   `lib/parser-v2/advisors.js` tags banks `role:'financial'` into
   `metadata.advisors[]`, which today never reaches the `law_firm`
   filter (all 40 deals carry `advisors_v2`, which wins). Latent leak: a
   future deal without `advisors_v2` could surface a bank (e.g. Jefferies)
   through the legacy fallback, which ignores `role`. With exact-value
   cohort matching this yields a filter miss, not data corruption.

## Decision implemented (mapping both, per Ben's instruction)

- legacy `law_firm` → governed `adviser_either` (both sides hold law firm
  names);
- legacy `lawyer` → governed `lawyer_either` (both sides hold individual
  attorney names);
- same single-scalar/one-value rules as the other mapped filters;
  multi-select or empty stays legacy.

## Flags for Ben (no action required now)

- The canonical dimension NAME `adviser_firms` suggests financial
  advisers but the frozen content is law firms. If financial advisers
  ever become a cohort dimension, that needs a NEW dimension (the
  `role:'financial'` extractor already exists), not a reinterpretation of
  `adviser_firms` — renaming a frozen dimension is a contract change.
- The legacy fallback's role-blind firm handling
  (`lib/canonical-advisors.js:220-233`) is the place to fix the latent
  Jefferies-class leak if ingest ever produces a deal without
  `advisors_v2`.
