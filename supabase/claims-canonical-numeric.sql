-- WP-P3-NUMERIC — deterministic numeric-normalization canonical kind.
-- Additive only. Safe to run more than once. No change to any existing
-- column, constraint, or index on public.claims.
--
-- Storage decision (Fable, spec-p3-numeric.md — final): a new nullable
-- JSONB column, `canonical_numeric`, of shape { "value": <number>, "unit":
-- "<unit>" }. This is DELIBERATELY separate from `claims.canonical` (which
-- stays enum/taxonomy-code territory only, see schema-05-claims.sql) and
-- makes no decision about `concept_key`. Populated only by
-- scripts/backfill/normalize-numeric-claims.js, which never guesses: a
-- value it cannot parse-with-confidence is left null, not fabricated.
--
-- Unit vocabulary is closed (lib/normalize-numeric.js CLOSED_UNITS): USD,
-- percent, days, business_days, months, years, shares. Enforced at the
-- application layer (the backfill script), not by a DB CHECK constraint,
-- to keep this migration a pure additive no-op if re-run.

ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS canonical_numeric jsonb;

COMMENT ON COLUMN public.claims.canonical_numeric IS
  'Nullable. Deterministic numeric normalization of `verbatim` for a closed '
  'allowlist of attributes (see scripts/backfill/normalize-numeric-claims.js '
  'ATTRIBUTES), shape { "value": <number>, "unit": "<USD|percent|days|'
  'business_days|months|years|shares>" }. NEVER fabricated: null means the '
  'normalizer could not parse the value with confidence (ambiguous text, a '
  'range, conflicting numbers, or no unit in the closed vocabulary). Separate '
  'from `canonical` (enum/taxonomy-code territory, see that column''s '
  'comment) — this column is render-inert until a future work package wires '
  'it into the UI.';
