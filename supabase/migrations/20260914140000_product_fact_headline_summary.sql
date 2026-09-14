-- Phase 5B, headline.summary (Ben, 2026-09-14, on the Other provisions
-- table: "it needs to be a summary of the provision on the right etc - like
-- in the normal course. Not just a sec ref...!"; asked whether the extractor
-- should write a short summary per fact as part of the fact contract:
-- "1. for now - yes"; standing rule: "everything to be driven by coding and
-- not just a layer on top so all edits need to be repeatable across corpus").
--
-- product_fact_headlines gains a nullable `summary` column: the extractor's
-- one-line plain-English summary of the provision (FACT_COMPONENTS/V2
-- summary_rule), written in the same atomic section commit as the headline.
-- Older generations have none, so the column is nullable and existing rows
-- are untouched. The immutable trigger on the table forbids UPDATE, so the
-- commit RPC is extended additively: the prior function is renamed and
-- called with the headline rows removed from p_result, and this function
-- writes the headline rows itself with the summary.

ALTER TABLE public.product_fact_headlines ADD COLUMN IF NOT EXISTS summary text;

DO $$
BEGIN
  IF to_regprocedure('product_private.product_phase2_commit_section_pre_headline_summary(uuid,text,text,uuid,jsonb)') IS NULL THEN
    ALTER FUNCTION product_private.product_phase2_commit_section(uuid,text,text,uuid,jsonb)
      RENAME TO product_phase2_commit_section_pre_headline_summary;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION product_private.product_phase2_commit_section(
  p_run_id uuid, p_node_id text, p_worker_id text, p_attempt_token uuid, p_result jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  result jsonb;
  item jsonb;
BEGIN
  -- The prior function keeps every other write (proposals, components,
  -- conclusions, leases); the headline rows are written below instead.
  result := product_private.product_phase2_commit_section_pre_headline_summary(
    p_run_id, p_node_id, p_worker_id, p_attempt_token, p_result - 'fact_headline_rows'
  );

  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(p_result->'fact_headline_rows', '[]'::jsonb)) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.product_proposals p WHERE p.run_id = p_run_id AND p.proposal_id = item->>'proposal_id') THEN
      RAISE EXCEPTION 'fact headline proposal not found' USING ERRCODE = '23503';
    END IF;
    INSERT INTO public.product_fact_headlines(run_id, proposal_id, label, distinguishing_component_ids, summary, coverage_only)
    VALUES (p_run_id, item->>'proposal_id', item->>'label', item->'distinguishing_component_ids',
      nullif(btrim(item->>'summary'), ''),
      coalesce((item->>'coverage_only')::boolean, false))
    ON CONFLICT (run_id, proposal_id) DO NOTHING;
  END LOOP;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION product_private.product_phase2_commit_section(uuid,text,text,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION product_private.product_phase2_commit_section(uuid,text,text,uuid,jsonb) TO service_role;
REVOKE ALL ON FUNCTION product_private.product_phase2_commit_section_pre_headline_summary(uuid,text,text,uuid,jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.product_phase2_commit_section(uuid,text,text,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_phase2_commit_section(uuid,text,text,uuid,jsonb) TO service_role;
