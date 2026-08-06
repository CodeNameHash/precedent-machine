# WP-SCHEMA-PARITY-AUDIT Worklog

## 2026-07-08

- Confirmed the review page has explicit parity toggles: `?render=schema` and `?render=legacy`.
- Confirmed all 40 live deals have at least 40 `provision_cards`; minimum card count is 237.
- Added `scripts/audit/schema-parity.js` and ran the first authoritative corpus audit against live Supabase.
- Result: gated, 0/40 clean deals, 972 diffs.
- Wrote:
  - `docs/audit/parity-discovery.md`
  - `docs/schema-migration/phase-8-parity.md`
  - `docs/schema-migration/phase-8-parity-triage.md`
  - `docs/review-queue/m2-02-schema-parity-diffs.json`

Top diff categories:

| Category | Count | Notes |
|---|---:|---|
| `short_title_mismatch` | 480 | Schema cards expose `[PROPOSED]` labels that legacy user-mode strips. |
| `type_mismatch` | 285 | Includes `STRUCT` cards mapped to `MISC_BOILERPLATE`. |
| `missing_schema_card` | 145 | Visible legacy provisions lack matching schema cards. |
| `schema_only_card` | 62 | Schema cards include rows not visible in legacy user-mode, often uncovered-text coverage cards. |

Do not proceed to legacy renderer or vocab deletion until parity returns zero diffs.
