CREATE OR REPLACE FUNCTION public.product_phase1_renew_section_lease(
  p_run_id uuid, p_node_id text, p_worker_id text, p_attempt_token uuid, p_lease_seconds integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE work public.product_section_work;
BEGIN
  IF coalesce(p_worker_id, '') = '' OR p_lease_seconds < 1 OR p_lease_seconds > 3600 THEN
    RAISE EXCEPTION 'invalid section lease renewal input' USING ERRCODE = '22023';
  END IF;
  UPDATE public.product_section_work
  SET lease_expires_at = now() + make_interval(secs => p_lease_seconds)
  WHERE run_id = p_run_id AND node_id = p_node_id AND status = 'RUNNING'
    AND worker_id = p_worker_id AND attempt_token = p_attempt_token AND lease_expires_at > now()
  RETURNING * INTO work;
  IF NOT FOUND THEN RAISE EXCEPTION 'stale section attempt' USING ERRCODE = '40001'; END IF;
  RETURN to_jsonb(work);
END;
$$;

REVOKE ALL ON FUNCTION public.product_phase1_renew_section_lease(uuid,text,text,uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_phase1_renew_section_lease(uuid,text,text,uuid,integer) TO service_role;
