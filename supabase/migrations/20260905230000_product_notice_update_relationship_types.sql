ALTER FUNCTION product_private.product_phase3_relationship_types(text, text)
  RENAME TO product_phase3_relationship_types_before_notice_update;

CREATE FUNCTION product_private.product_phase3_relationship_types(
  p_family_key text, p_subtype_key text
) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT CASE p_family_key || ':' || p_subtype_key
    WHEN 'NO_SHOP:NOTICE_UPDATE_OBLIGATION' THEN '["QUALIFIES","REQUIRES"]'::jsonb
    ELSE product_private.product_phase3_relationship_types_before_notice_update(
      p_family_key, p_subtype_key
    )
  END
$$;

REVOKE ALL ON FUNCTION product_private.product_phase3_relationship_types(text, text)
  FROM PUBLIC, anon, authenticated, service_role;
