# WP-EXTRACT-GAPS-01 — close the render-driven extraction gaps

**Status: SPEC (not started). Runs on Ben's go, after the design pass.**
**Owner: Fable (extraction-prompt engineering is Fable end-to-end per CLAUDE.md).**
**Why now:** the review-page redesign surfaced places where the render is correct only because a config-layer workaround (regex over quote text, or a text sniff) compensates for a missing/wrong structured field. Those workarounds render Metsera correctly today but will NOT generalise cleanly across the 40-deal corpus (M2 "schema deployed corpus-wide" / M3 "ingest seamless"). This WP moves them into structured extraction so every deal renders right without per-clause regex.

## Scope — five gaps (2 fragile-stopgaps + 3 data bugs)

### A. Material-Contracts per-bucket TRIGGER (dollar OR non-dollar)  [add structured field]
- Today: NO structured trigger on the material-contracts card. `material-contracts.config.js` regex-mines the $ figure per bucket from each bucket's `evidence_quote` (anchored to each clause). Works for Metsera's dollar-gated buckets, brittle elsewhere.
- Refined by round-4 probe: Metsera's `materialContractsBuckets` = 20 canonical buckets, and each bucket's trigger DIFFERS in kind — some are dollar-gated (INDEBTEDNESS, capex ~$2M), MANY are pure type-based with no dollar floor ("any" contract of that type — NONCOMPETE, ROFR_ROFN, SINGLE_SOURCE, JV_PARTNERSHIPS, exclusivity), some carry other quantitative tests (term length, top-N). So the field must capture a per-bucket trigger of any kind, not just a dollar amount.
- Fix: add a structured `materialContractTriggers` array — `{ bucketCode, triggerType: 'DOLLAR'|'ANY'|'OTHER', amount?, currency?, description? }` per bucket — to the material-contracts extraction (`lib/rubric.js` field def + `lib/parser-v2/extract.js` prompt). Render reads the field; keep the regex mine only as a last-resort fallback. (A config-layer stopgap doing exactly this per-bucket mine + "Any" fallback ships in WS-D of the round-4 render work.)
- Validate: golden eval on the material-contracts family; assert dollar buckets carry the $ figure and type-based buckets carry `ANY`.

### B. IOC materiality qualifier ("in all material respects")  [add structured field]
- Today: IOC-MAINTAIN carries "in all material respects" ONLY inside `positiveObligations.obligation` free text; `efforts_standard` is coded `FLAT`. `ioc-exceptions.config.js` sniffs the phrase from text.
- Fix: extract a structured materiality/performance-standard field on IOC affirmative covenants (distinct from `efforts_standard`), so "in all material respects" is a first-class value.
- Validate: re-extract Metsera IOC; IOC-MAINTAIN carries a structured `MAT_ALL_MATERIAL` (or equivalent) standard.

### C. IOC 5.01 unclassified sub-clauses  [fix classification coverage]
- Refined by round-4 probe: it's NOT just (k)/(l)/(o) — ALL EIGHT of 5.01(i),(ii),(j),(k),(l),(m),(n),(o) come through as cards with `provision_subtype=null` and `short_title='[PROPOSED] Unclassified'`. Only their `section_ref` (e.g. "5.01(k)") and `primary_quote` are populated; the classifier assigned no subtype. Meanings are unambiguous from the quotes: (i) indebtedness, (ii) debt-securities issuance, (j) capital expenditures, (k) tax elections/accounting, (l) Specified Contracts, (m) litigation settlements, (n) prepayment of indebtedness, (o) insurance maintenance.
- Fix: the IOC extraction/classifier must assign a canonical subtype + category + restrictionComponents to EVERY 5.01 sub-clause. Investigate why (a)–(h) classified but (i)–(o) fell through to `[PROPOSED] Unclassified`.
- Validate: re-extract Metsera IOC; every 5.01 sub-clause carries a subtype, none reduced to "[PROPOSED] Unclassified".
- Render stopgap already shipped: WS-E of the round-4 work names all 8 from their `section_ref` so no fragment renders while the extraction fix is pending.

### D. Third-party-beneficiary attribute mapping bug  [data bug + backfill]
- Today: **corpus-wide bug** — every third-party-beneficiary claim is stamped `attribute='thirdPartyBeneficiaryExceptions'`; `attribute='thirdPartyBeneficiaries'` (the beneficiary NAMES: Indemnified Persons/D&Os, Debt Financing Sources) has **zero rows across the entire claims table**. `misc-boilerplate.config.js` therefore can never populate the beneficiary-name half of the row.
- Fix: correct the extraction/normalisation attribute mapping so beneficiary names land under `thirdPartyBeneficiaries` (and exceptions stay under `…Exceptions`). Backfill/reprocess so existing deals get the split.
- Validate: `select count(*) from claims where attribute='thirdPartyBeneficiaries'` > 0; Metsera third-party-beneficiary row shows named parties.

### E. `effectiveTimeShort` corruption ("surviving corporation")  [re-extract]
- Today: some STRUCTURE_MECHANICS cards have `effectiveTimeShort = "Names the Company as the surviving corporation in the merger"` — that is the surviving-ENTITY fact, not the effective TIME. `structure-mechanics.config.js` guards against it (prefers the good "Upon filing of the Certificate of Merger…" value on another card).
- Fix: correct the effective-time extraction so `effectiveTimeShort` captures the effectiveness mechanic (filing of the certificate of merger), not the surviving-entity clause. Re-extract affected cards.
- Validate: `effectiveTimeShort` on the structure card(s) reads the filing mechanic; the config guard becomes redundant.

## Mechanics
- Changes live in `lib/rubric.js` (field/vocab defs), `lib/parser-v2/extract.js` (extraction prompts), and normalisation/attribute-mapping. Additive vocab may need a Freeze-Gate PR (canonical vocabulary is freeze-gated).
- Reprocess: prefer per-type `scripts/reprocess.js` refreshes over full re-ingests (token-conservation window). Run the affected families first on Metsera (golden fixture), validate, then across all 40 deals.
- Gates: golden eval harness for extraction-prompt changes; `scripts/ingest-qa.js`; quote verification stays at zero flags; `npm test` + `npm run build`.
- Classification (per PLAN.md autonomy rules): **canonical (Ben-review)** — this changes extraction semantics and adds vocabulary. Ben has pre-authorised running it (this WP), so it does not need to wait in the Review Queue, but any NEW canonical vocab value still goes through a Freeze-Gate PR.

## Sequencing
Independent track; slots into **M2/M3**. Does NOT block the review-page design work. Run after the current design pass, on Ben's go.
