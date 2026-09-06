ALTER FUNCTION product_private.product_phase3_relationship_types(text, text)
  RENAME TO product_phase3_relationship_types_before_term_effect_v1_2;

CREATE FUNCTION product_private.product_phase3_relationship_types(
  p_family_key text, p_subtype_key text
) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT CASE p_family_key || ':' || p_subtype_key
    WHEN 'TERMINATION:TERMINATION_NOTICE' THEN '["QUALIFIES","REQUIRES"]'::jsonb
    WHEN 'TERMINATION:AGREEMENT_VOIDING' THEN '["QUALIFIES"]'::jsonb
    WHEN 'TERMINATION:PROVISION_SURVIVAL' THEN '["QUALIFIES","EXCEPTS"]'::jsonb
    WHEN 'TERMINATION:LIABILITY_RELEASE' THEN '["QUALIFIES"]'::jsonb
    WHEN 'TERMINATION:WILLFUL_MATERIAL_BREACH_CARVEOUT' THEN
      '["QUALIFIES","EXCEPTS","REQUIRES"]'::jsonb
    WHEN 'TERMINATION:REMEDY_ENTITLEMENT' THEN '["QUALIFIES","REQUIRES"]'::jsonb
    ELSE product_private.product_phase3_relationship_types_before_term_effect_v1_2(
      p_family_key, p_subtype_key
    )
  END
$$;

REVOKE ALL ON FUNCTION product_private.product_phase3_relationship_types(text, text)
  FROM PUBLIC, anon, authenticated, service_role;
