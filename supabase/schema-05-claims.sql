-- WP-CLAIMS-LAYER-01 — persists the Claim node from
-- docs/schema-shape/provision-taxonomy-triple-model.md (Section 3).
-- Additive only. Safe to run more than once. No change to existing tables.
--
-- Source of truth for the backfill: docs/schema-shape/normalized-v1.json
-- `triples` array (71,576 rows as of the 2026-07-07 reconciled snapshot).
-- See PLAN-CLAIMS-LAYER.md and scripts/backfill/claims-from-normalized.js.
--
-- IDENTITY ANCHORING (load-bearing, see Phase 1 investigation report):
-- `provisions.id` is gen_random_uuid() and provisions are deleted and
-- reinserted wholesale on every re-ingest (store.js) — NOT a stable key.
-- `provisions.region_id` is NULL on 98.7% of rows in production, so the
-- triple.source_provision_id -> provisions.region_id -> provision_cards.region_id
-- chain the plan names as the primary path resolves only ~1.3% of triples.
-- The viable anchor (98.74% resolution, zero ambiguity across all 40 deals)
-- is: triple.source_provision_id -> provisions.full_text (verbatim, trimmed)
-- -> provision_cards.region_full_text (exact match, scoped by deal_id) ->
-- provision_cards.excerpt_id / region_id. provision_cards.excerpt_id and
-- provision_cards.provision_instance_id are the deterministic, re-ingest-
-- stable keys (unique indexes exist on both, schema-04). `claims.excerpt_id`
-- is therefore the durable anchor; `claims.source_provision_id` is kept as
-- unstable lineage only, never as a join key from the app.
--
-- The ~1.26% of triples that do not resolve to a card (141 source
-- provisions, mostly short inline "DEF" recital fragments dropped during
-- card materialisation) are NOT written here — they are reported by the
-- backfill script as orphaned-by-anchor and are a pre-existing card-build
-- gap, not something this migration or backfill can silently paper over.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.claims (
  id text PRIMARY KEY,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  excerpt_id text NOT NULL REFERENCES public.provision_cards(excerpt_id) ON DELETE CASCADE,
  provision_instance_id text,
  region_id uuid REFERENCES public.parser_regions(id),
  attribute text NOT NULL,
  verbatim text,
  evidence_quote text,
  canonical text,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_provision_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT claims_attribute_present CHECK (length(trim(attribute)) > 0),
  CONSTRAINT claims_provenance_object_check CHECK (jsonb_typeof(provenance) = 'object')
);

COMMENT ON TABLE public.claims IS
  'Claim node of the taxonomy (docs/schema-shape/provision-taxonomy-triple-model.md '
  'Section 3): (Attribute, Verbatim, Canonical, Provenance), anchored to the stable '
  'provision_cards.excerpt_id, not to the unstable provisions.id.';
COMMENT ON COLUMN public.claims.id IS
  'Triple id from docs/schema-shape/normalized-v1.json (not a uuid — hex/opaque id '
  'minted by the normaliser). A small number of ids collide across genuinely '
  'distinct claims in the source snapshot; the backfill script disambiguates '
  '(see claims-from-normalized.js DEDUPE_SUFFIX handling) rather than dropping rows.';
COMMENT ON COLUMN public.claims.excerpt_id IS
  'Stable anchor. Resolved at backfill time via provisions.full_text === '
  'provision_cards.region_full_text within the same deal_id, NOT via region_id '
  '(see file header). FK to provision_cards(excerpt_id).';
COMMENT ON COLUMN public.claims.verbatim IS
  'Claim.Verbatim per taxonomy Section 3 = the atomic value as written '
  '(triple.raw_value, e.g. "24", "$45,000,000"). For the 208 compensationItems '
  'triples raw_value is a structured object; it is stored here as compact JSON '
  'and the full object is also preserved in provenance.feature_value.';
COMMENT ON COLUMN public.claims.evidence_quote IS
  'The supporting source span for THIS claim (triple.evidence_quote, present on '
  '100% of triples). First-class column, not buried in provenance, because the '
  'render consumes it on every claim: lib/citable.js / '
  'components/review/primitives/ProvisionTablePrimitives.jsx use it as the hover '
  'citation and document-highlight target. Distinct from provision_cards.primary_quote '
  '(the Excerpt-level quote) — this is claim-level and finer-grained.';
COMMENT ON COLUMN public.claims.region_id IS
  'Convenience pointer to parser_regions for byte-offset joins ONLY. NOT an identity '
  'anchor: parser_regions.id is a gen_random_uuid, not deterministic across a DB '
  'rebuild. The stable anchors are excerpt_id and provision_instance_id (deterministic '
  'hashes, taxonomy G1/G2). App joins (incl. the Phase 3 render adapter in '
  'lib/queries/review-deal.js) MUST use excerpt_id, never region_id.';
COMMENT ON COLUMN public.claims.source_provision_id IS
  'Lineage only (triple.source_provision_id -> provisions.id). This id is NOT '
  'stable across re-ingests and must never be used as a join key by the app.';
COMMENT ON COLUMN public.claims.canonical IS
  'Nullable. NEVER fabricated — null means the normaliser left canonicalKey '
  'unresolved for this triple. Do not backfill a value here to satisfy a NOT NULL '
  'constraint; that would corrupt the closed vocabulary.';

CREATE INDEX IF NOT EXISTS claims_deal_idx
  ON public.claims(deal_id);

CREATE INDEX IF NOT EXISTS claims_attribute_idx
  ON public.claims(attribute);

CREATE INDEX IF NOT EXISTS claims_attribute_canonical_idx
  ON public.claims(attribute, canonical);

CREATE INDEX IF NOT EXISTS claims_excerpt_idx
  ON public.claims(excerpt_id);

CREATE INDEX IF NOT EXISTS claims_region_idx
  ON public.claims(region_id);

-- Not enabled here to match the schema-03/schema-04 convention (new tables
-- ship without RLS statements; RLS lockdown is swept separately — see
-- supabase/lockdown-rls.sql). Follow-up: add public.claims to that sweep
-- before this table is exposed to anything other than the service-role
-- backfill script and /api/* routes.
