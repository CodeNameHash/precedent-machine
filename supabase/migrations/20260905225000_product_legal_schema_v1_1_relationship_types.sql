ALTER FUNCTION product_private.product_phase3_relationship_types(text, text)
  RENAME TO product_phase3_relationship_types_before_legal_schema_v1_1;

CREATE FUNCTION product_private.product_phase3_relationship_types(
  p_family_key text, p_subtype_key text
) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT CASE p_family_key || ':' || p_subtype_key
    WHEN 'CLOSING_CONDITIONS:GENERAL_CLOSING_CONDITION' THEN
      '["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"]'::jsonb
    WHEN 'SPECIFIC_PERFORMANCE_REMEDIES:PAID_FEE_EXCLUSIVE_REMEDY' THEN
      '["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"]'::jsonb
    ELSE product_private.product_phase3_relationship_types_before_legal_schema_v1_1(
      p_family_key, p_subtype_key
    )
  END
$$;

REVOKE ALL ON FUNCTION product_private.product_phase3_relationship_types(text, text)
  FROM PUBLIC, anon, authenticated, service_role;
