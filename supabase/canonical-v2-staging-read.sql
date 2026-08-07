-- supabase/canonical-v2-staging-read.sql
--
-- PLAN.md Step 2B2. Hosted read access to `canonical_v2_staging` for the
-- read half `lib/canonical-v2/local-staging-deal-reader.js` builds locally.
-- RULED 2026-08-07 by Fable, under Ben's delegation (DECISIONS.md, "Waiting
-- on Ben" item 1) -- Ben delegated the design, not the scrutiny: "just do
-- what you and Fable decide is best", and Fable's verdict is binding.
--
-- THE MECHANISM. `SECURITY DEFINER` functions in `public`, granted to a new
-- dedicated `NOLOGIN` role, `canonical_v2_staging_reader`. No table grants
-- on `canonical_v2_staging`, no RLS policies, no `FORCE ROW LEVEL SECURITY`.
-- This is additive and extends the schema's existing and ONLY access idiom
-- -- definer function plus dedicated role -- already used twice: the writer
-- (`public.canonical_v2_write`, `canonical_v2_writer`, this schema's own
-- `canonical-v2-foundation.sql`) and the Step 5A serving layer
-- (`public.canonical_v2_active_product_query_results` etc.,
-- `canonical_v2_serving`, `canonical-v2-serving.sql`). This file adds a
-- third role rather than the schema's first-ever policy or first-ever table
-- grant. Verified, not assumed: zero `CREATE POLICY` statements anywhere
-- under `supabase/`, zero occurrences of `FORCE ROW LEVEL SECURITY`.
--
-- WHY NOT GRANTS PLUS RLS. Three reasons, DECISIONS.md's own order of
-- weight, kept here because they explain every design choice below:
--   1. The governed/ungoverned distinction lives INSIDE `canonical_payload`
--      jsonb, not in a column a policy could gate on. A `SELECT` grant
--      exposes every row in arbitrary shapes; a policy narrow enough to
--      matter would reimplement `open-world-evidence-serving.js`'s
--      governance semantics a second time in SQL -- the duplicated-predicate
--      drift that produced the QXO false-"Governed claim" defect the same
--      day this ruling was made. So the functions carry the check instead,
--      see below, and a drift test keeps the two copies from separating.
--   2. It destroys a cheap audit. Today "is staging locked down?" is a
--      zero-row check (see the verification block at the end of this file).
--      Grants plus policies would make it "read these predicates and reason
--      about them" -- and this project's own documented failure mode is
--      confidently misreading its own artefacts.
--   3. The obvious grantee is the wrong one. The app's service-key routes
--      hold `service_role`, deliberately excluded from everything in
--      `canonical_v2_staging`. `canonical_v2_serving` is deliberately NOT
--      reused either: it means "may read activated corpus releases only"
--      (the Step 5A gate over ACTIVATED releases), and widening it to
--      pre-release staging reads would make that name a lie.
--
-- THE POSITIVE CHECK, and why it is positive. `open-world-evidence-
-- serving.js`'s `buildGovernedClaimSummaryCard` was broken by adversarial
-- review execution on 2026-08-07 while it asked only whether a row LACKED
-- the open-world marker: a QXO-era `NOVEL_CONCEPT_CANDIDATE/V1` row, which by
-- design never carries the marker because it predates it, passed the
-- marker-absence check and rendered as "Governed claim". Two grammars share
-- these tables -- rows that carry the marker, and QXO rows that never did --
-- so absence distinguishes nothing. The fix asks what a row IS:
-- `claimRow.schema_version !== CLAIM_REVISION_SCHEMA` is checked FIRST, and
-- only a `CLAIM_REVISION/V1` row is ever asked the open-world question.
-- These functions are the boundary now too, so they carry the same positive
-- check in SQL: `canonical_v2_staging_read_claim_revisions` returns only
-- rows with `canonical_payload->>'schema_version' = 'CLAIM_REVISION/V1'`;
-- the three open-world functions return only rows carrying
-- `evidence_governance = 'UNGOVERNED_OPEN_WORLD_EVIDENCE'`. A QXO-era
-- `NOVEL_CONCEPT_CANDIDATE/V1` row matches NEITHER predicate and is returned
-- by NEITHER function -- invisible, not mislabelled.
--
-- THE DRIFT TEST. `tests/canonical-v2-staging-read-sql-drift.test.js` reads
-- THIS FILE's own text and asserts its two literals
-- (`'CLAIM_REVISION/V1'`, `'UNGOVERNED_OPEN_WORLD_EVIDENCE'`) equal the real
-- JS constants (`open-world-evidence-serving.js`'s `CLAIM_REVISION_SCHEMA`,
-- `native-write-set-adapter.js`'s `OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER`),
-- not a hand-typed copy of them. If either constant moves without this file
-- moving with it, that test fails. Two copies of one predicate that can
-- drift apart is exactly what produced the defect this closes.
--
-- WHAT `canonical_payload` MEANS HERE. Every function below selects
-- `canonical_payload` verbatim -- never a reshaped projection -- because the
-- byte-identical `canonicalJson` round trip
-- (`lib/canonical-v2/canonical-bytes.js`) is a product requirement the
-- local reader's own tests already prove and this surface must not weaken.
--
-- BOUNDED RESULTS. Each function enforces its own row cap and byte cap
-- inside the function body, the same discipline
-- `lib/canonical-v2/serving-client.js`'s `boundedRpcData` applies on the JS
-- side of Step 5A's RPCs (row caps of 50-200, byte caps of 256KB-2MB
-- there). These reads are a single deal's governed/open-world data, so the
-- caps here are generous but real: a read that exceeds them fails loud
-- (`RAISE EXCEPTION`, ERRCODE 54000, "program limit exceeded") rather than
-- streaming an unbounded result. `lib/canonical-v2/local-staging-deal-
-- reader.js`'s hosted query interface applies the SAME caps again on the way
-- back into JS, mirroring `boundedRpcData`'s own defense-in-depth.
--
-- WHAT THIS DOES NOT AUTHORISE. Design only. Applying this file to a real
-- hosted database, creating or binding a LOGIN role, using any real
-- credential, and production activation are all separate acts needing their
-- own authorisation -- `OPERATING-RULES.md`'s authority boundary stands in
-- full. `isPermittedCanonicalV2Runtime` is unchanged by this file; it still
-- denies production outright at the JS layer regardless of what this SQL
-- grants.

-- ── The role. NOLOGIN, mirroring canonical_v2_writer/canonical_v2_serving:
-- a real login credential able to assume it is provisioned (if ever) outside
-- this repository, the same way the Supabase pooler users for the other two
-- roles are. ──
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'canonical_v2_staging_reader') THEN
    CREATE ROLE canonical_v2_staging_reader NOLOGIN;
  END IF;
END
$$;

-- ── Bounds shared by every function below. Row cap: generous for a single
-- deal's governed+open-world data (the largest real run in this project's
-- baseline is 170 claims across 25 families; 2,000 leaves headroom without
-- being unbounded). Byte cap: 4 MiB, double canonical-v2-serving.sql's
-- largest existing cap (MAX_REVIEW_RESULT_BYTES, 2 MiB) because these rows
-- are read whole (no field projection) and a provision/claim payload can
-- carry long quoted excerpt text. ──

CREATE OR REPLACE FUNCTION canonical_v2_staging.staging_read_document_hash(p_document_hash text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog
AS $$
BEGIN
  IF p_document_hash IS NULL OR p_document_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'document_hash must be a 64-hex-character SHA-256 digest' USING ERRCODE = '22023';
  END IF;
  RETURN p_document_hash;
END;
$$;

CREATE OR REPLACE FUNCTION canonical_v2_staging.staging_read_id_array(p_ids text[])
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog
AS $$
DECLARE
  ids text[] := coalesce(p_ids, '{}'::text[]);
BEGIN
  IF cardinality(ids) > 5000 THEN
    RAISE EXCEPTION 'too many identifiers in one staging read request' USING ERRCODE = '54000';
  END IF;
  RETURN ids;
END;
$$;

CREATE OR REPLACE FUNCTION canonical_v2_staging.staging_read_bound(p_payload jsonb, p_label text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog
AS $$
DECLARE
  result_bytes integer;
BEGIN
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'staging read result must be a jsonb array' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_payload) > 2000 THEN
    RAISE EXCEPTION '% exceeded its row ceiling', p_label USING ERRCODE = '54000';
  END IF;
  result_bytes := octet_length(p_payload::text);
  IF result_bytes > 4194304 THEN
    RAISE EXCEPTION '% exceeded its byte ceiling', p_label USING ERRCODE = '54000';
  END IF;
  RETURN p_payload;
END;
$$;

-- ── 1. Provision instances, by document_hash. Read by both the governed-
-- claims function's caller and the relationships function's caller (the
-- local prototype issues this exact query from both readGovernedClaimsForDeal
-- and readRelationshipsForDeal), so it is one RPC, not two. ──
CREATE OR REPLACE FUNCTION public.canonical_v2_staging_read_provision_instances(
  p_document_hash text
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, canonical_v2_staging
AS $$
  SELECT canonical_v2_staging.staging_read_bound(
    coalesce(jsonb_agg(row.canonical_payload ORDER BY row.provision_instance_id), '[]'::jsonb),
    'canonical_v2_staging_read_provision_instances'
  )
  FROM canonical_v2_staging.provision_instances row
  WHERE row.canonical_payload->>'document_hash'
    = canonical_v2_staging.staging_read_document_hash(p_document_hash);
$$;

-- ── 2. Provision components, by their parent provision_instance_id. ──
CREATE OR REPLACE FUNCTION public.canonical_v2_staging_read_provision_components(
  p_parent_provision_instance_ids text[]
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, canonical_v2_staging
AS $$
  SELECT canonical_v2_staging.staging_read_bound(
    coalesce(jsonb_agg(row.canonical_payload ORDER BY row.provision_component_id), '[]'::jsonb),
    'canonical_v2_staging_read_provision_components'
  )
  FROM canonical_v2_staging.provision_components row
  WHERE row.canonical_payload->>'parent_provision_instance_id'
    = ANY(canonical_v2_staging.staging_read_id_array(p_parent_provision_instance_ids));
$$;

-- ── 3. Claim revisions, by closure_id OR subject_occurrence_id (PLAN.md
-- Step 2B3: a claim's subject can be a provision COMPONENT, not only a
-- provision -- fetching by closure lets an unresolvable subject reach the
-- local reader's ORPHAN_CLAIM_REVISION guard instead of being silently
-- excluded by the query). THE POSITIVE GOVERNANCE PREDICATE: only rows
-- whose own schema_version is CLAIM_REVISION/V1 are ever returned -- see the
-- header comment above for why this must be positive, not an absence check.
-- ──
CREATE OR REPLACE FUNCTION public.canonical_v2_staging_read_claim_revisions(
  p_closure_ids text[],
  p_subject_occurrence_ids text[]
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, canonical_v2_staging
AS $$
  SELECT canonical_v2_staging.staging_read_bound(
    coalesce(jsonb_agg(row.canonical_payload ORDER BY row.claim_revision_id), '[]'::jsonb),
    'canonical_v2_staging_read_claim_revisions'
  )
  FROM canonical_v2_staging.claim_revisions row
  WHERE row.canonical_payload->>'schema_version' = 'CLAIM_REVISION/V1'
    AND (
      row.closure_id = ANY(canonical_v2_staging.staging_read_id_array(p_closure_ids))
      OR row.canonical_payload->>'subject_occurrence_id'
        = ANY(canonical_v2_staging.staging_read_id_array(p_subject_occurrence_ids))
    );
$$;

-- ── 4. Relationship revisions, by source_occurrence_id. ──
CREATE OR REPLACE FUNCTION public.canonical_v2_staging_read_relationship_revisions(
  p_source_occurrence_ids text[]
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, canonical_v2_staging
AS $$
  SELECT canonical_v2_staging.staging_read_bound(
    coalesce(jsonb_agg(row.canonical_payload ORDER BY row.relationship_revision_id), '[]'::jsonb),
    'canonical_v2_staging_read_relationship_revisions'
  )
  FROM canonical_v2_staging.relationship_revisions row
  WHERE row.canonical_payload->>'source_occurrence_id'
    = ANY(canonical_v2_staging.staging_read_id_array(p_source_occurrence_ids));
$$;

-- ── 5. Open-world candidates, by document_hash. THE POSITIVE GOVERNANCE
-- PREDICATE, the open-world side: only rows carrying
-- evidence_governance = 'UNGOVERNED_OPEN_WORLD_EVIDENCE' are returned. A
-- QXO-era NOVEL_CONCEPT_CANDIDATE/V1 row in this same table -- which by
-- design never carries this field, because it predates it -- matches
-- neither this predicate nor function 3's, and so is returned by neither:
-- invisible, not mislabelled. ──
CREATE OR REPLACE FUNCTION public.canonical_v2_staging_read_open_world_candidates(
  p_document_hash text
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, canonical_v2_staging
AS $$
  SELECT canonical_v2_staging.staging_read_bound(
    coalesce(jsonb_agg(row.canonical_payload ORDER BY row.candidate_id), '[]'::jsonb),
    'canonical_v2_staging_read_open_world_candidates'
  )
  FROM canonical_v2_staging.open_world_candidates row
  WHERE row.canonical_payload->>'document_hash'
    = canonical_v2_staging.staging_read_document_hash(p_document_hash)
    AND row.canonical_payload->>'evidence_governance' = 'UNGOVERNED_OPEN_WORLD_EVIDENCE';
$$;

-- ── 6. Open-world candidate occurrences, by candidate_id. Same positive
-- predicate. ──
CREATE OR REPLACE FUNCTION public.canonical_v2_staging_read_open_world_candidate_occurrences(
  p_candidate_ids text[]
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, canonical_v2_staging
AS $$
  SELECT canonical_v2_staging.staging_read_bound(
    coalesce(jsonb_agg(row.canonical_payload ORDER BY row.open_world_candidate_occurrence_id), '[]'::jsonb),
    'canonical_v2_staging_read_open_world_candidate_occurrences'
  )
  FROM canonical_v2_staging.open_world_candidate_occurrences row
  WHERE row.canonical_payload->>'candidate_id'
    = ANY(canonical_v2_staging.staging_read_id_array(p_candidate_ids))
    AND row.canonical_payload->>'evidence_governance' = 'UNGOVERNED_OPEN_WORLD_EVIDENCE';
$$;

-- ── 7. Open-world evidence references, by open_world_candidate_occurrence_id.
-- Same positive predicate. ──
CREATE OR REPLACE FUNCTION public.canonical_v2_staging_read_open_world_evidence_references(
  p_open_world_candidate_occurrence_ids text[]
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, canonical_v2_staging
AS $$
  SELECT canonical_v2_staging.staging_read_bound(
    coalesce(jsonb_agg(row.canonical_payload ORDER BY row.evidence_reference_id), '[]'::jsonb),
    'canonical_v2_staging_read_open_world_evidence_references'
  )
  FROM canonical_v2_staging.open_world_evidence_references row
  WHERE row.canonical_payload->>'open_world_candidate_occurrence_id'
    = ANY(canonical_v2_staging.staging_read_id_array(p_open_world_candidate_occurrence_ids))
    AND row.canonical_payload->>'evidence_governance' = 'UNGOVERNED_OPEN_WORLD_EVIDENCE';
$$;

-- ── 8. Conditional termination fee values (PLAN.md Step 2C1). Scoped by the
-- document_hash COLUMN -- a real column, not a jsonb ->> lookup, because
-- this kind's 11-key payload schema carries no document_hash field of its
-- own and its content-addressed id is computed over the payload alone (see
-- canonical-v2-foundation.sql's own comment on this table). Before Step
-- 2C1, the one prior reader of this table read it with no WHERE clause at
-- all, correct only because a single deal had ever written to it -- this
-- function must not repeat that. ──
CREATE OR REPLACE FUNCTION public.canonical_v2_staging_read_conditional_termination_fee_values(
  p_document_hash text
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, canonical_v2_staging
AS $$
  SELECT canonical_v2_staging.staging_read_bound(
    coalesce(jsonb_agg(row.canonical_payload ORDER BY row.conditional_termination_fee_value_id), '[]'::jsonb),
    'canonical_v2_staging_read_conditional_termination_fee_values'
  )
  FROM canonical_v2_staging.conditional_termination_fee_values row
  WHERE row.document_hash = canonical_v2_staging.staging_read_document_hash(p_document_hash);
$$;

-- ── Grants. EXECUTE revoked from PUBLIC, anon, authenticated, service_role,
-- canonical_v2_writer AND canonical_v2_serving on every function above --
-- canonical_v2_serving is deliberately excluded even though it is a reader
-- role elsewhere: it means "may read ACTIVATED corpus releases only", and
-- granting it staging reads would silently widen that meaning to pre-release
-- data. canonical_v2_staging_reader is the sole grantee. The three internal
-- helper functions (staging_read_document_hash / staging_read_id_array /
-- staging_read_bound) live in canonical_v2_staging, already covered by
-- canonical-v2-foundation.sql's blanket
-- `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA canonical_v2_staging`, and are never
-- granted to canonical_v2_staging_reader directly -- only reachable through
-- the SECURITY DEFINER functions in public, the same shape
-- canonical_v2_staging.payload_digest/canonical_json are reachable only
-- through public.canonical_v2_write. ──
REVOKE ALL ON FUNCTION public.canonical_v2_staging_read_provision_instances(text)
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_writer, canonical_v2_serving;
REVOKE ALL ON FUNCTION public.canonical_v2_staging_read_provision_components(text[])
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_writer, canonical_v2_serving;
REVOKE ALL ON FUNCTION public.canonical_v2_staging_read_claim_revisions(text[], text[])
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_writer, canonical_v2_serving;
REVOKE ALL ON FUNCTION public.canonical_v2_staging_read_relationship_revisions(text[])
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_writer, canonical_v2_serving;
REVOKE ALL ON FUNCTION public.canonical_v2_staging_read_open_world_candidates(text)
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_writer, canonical_v2_serving;
REVOKE ALL ON FUNCTION public.canonical_v2_staging_read_open_world_candidate_occurrences(text[])
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_writer, canonical_v2_serving;
REVOKE ALL ON FUNCTION public.canonical_v2_staging_read_open_world_evidence_references(text[])
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_writer, canonical_v2_serving;
REVOKE ALL ON FUNCTION public.canonical_v2_staging_read_conditional_termination_fee_values(text)
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_writer, canonical_v2_serving;

GRANT EXECUTE ON FUNCTION public.canonical_v2_staging_read_provision_instances(text)
  TO canonical_v2_staging_reader;
GRANT EXECUTE ON FUNCTION public.canonical_v2_staging_read_provision_components(text[])
  TO canonical_v2_staging_reader;
GRANT EXECUTE ON FUNCTION public.canonical_v2_staging_read_claim_revisions(text[], text[])
  TO canonical_v2_staging_reader;
GRANT EXECUTE ON FUNCTION public.canonical_v2_staging_read_relationship_revisions(text[])
  TO canonical_v2_staging_reader;
GRANT EXECUTE ON FUNCTION public.canonical_v2_staging_read_open_world_candidates(text)
  TO canonical_v2_staging_reader;
GRANT EXECUTE ON FUNCTION public.canonical_v2_staging_read_open_world_candidate_occurrences(text[])
  TO canonical_v2_staging_reader;
GRANT EXECUTE ON FUNCTION public.canonical_v2_staging_read_open_world_evidence_references(text[])
  TO canonical_v2_staging_reader;
GRANT EXECUTE ON FUNCTION public.canonical_v2_staging_read_conditional_termination_fee_values(text)
  TO canonical_v2_staging_reader;

-- ── Verification block. Kept mechanical on purpose -- decision 1's second
-- reason grants-plus-RLS was rejected is that it would turn "is staging
-- locked down?" from a zero-row check into "read these predicates and
-- reason about them". These three queries must all return zero rows /
-- exactly the listed grantee, forever:
--
--   -- 1. No RLS policy exists for canonical_v2_staging (this file adds
--   --    none, and none exist anywhere else -- must be 0 rows):
--   SELECT schemaname, tablename, policyname FROM pg_policies
--   WHERE schemaname = 'canonical_v2_staging';
--
--   -- 2. canonical_v2_staging_reader holds no table grant anywhere in
--   --    canonical_v2_staging -- must be 0 rows. (information_schema.
--   --    role_table_grants also reports the table OWNER's implicit,
--   --    unrevokable privileges on every table in the schema regardless of
--   --    this file, which is why the check is scoped to the new role by
--   --    name rather than to the schema as a whole -- an unscoped query
--   --    would show owner rows even in a correctly locked-down database and
--   --    could never mechanically read as "zero", which is the property
--   --    this check exists to keep.)
--   SELECT table_schema, table_name, grantee, privilege_type
--   FROM information_schema.role_table_grants
--   WHERE table_schema = 'canonical_v2_staging'
--     AND grantee = 'canonical_v2_staging_reader';
--
--   -- 3. Every function this file defines has EXACTLY ONE EXECUTE grantee
--   --    besides its own owner, canonical_v2_staging_reader (must return
--   --    exactly the 8 rows named above, each with
--   --    grantee = 'canonical_v2_staging_reader'). The function owner
--   --    always appears too (grantor = grantee = the owning role) --
--   --    Postgres grants the owner an implicit, unrevokable EXECUTE right
--   --    the same way it grants a table owner implicit table rights (see
--   --    check 2's comment) -- so the owner's self-grant row is excluded
--   --    here rather than treated as a second grantee:
--   SELECT routine_name, grantee, privilege_type
--   FROM information_schema.role_routine_grants
--   WHERE routine_schema = 'public'
--     AND routine_name LIKE 'canonical_v2_staging_read_%'
--     AND grantor <> grantee
--   ORDER BY routine_name, grantee;
