-- The message content is the product request itself (call_kind,
-- prompt_version, source_closure, ...), not wrapped under "request":
-- 20260914130000 looked one level too deep and every part was still
-- refused. The part number is read at the content's top level as well.
CREATE OR REPLACE FUNCTION product_private.product_phase2_model_call_extraction_part(p_call jsonb)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
DECLARE part text; content text; inner_request jsonb;
BEGIN
  part := p_call->'request'->'source_closure'->'extraction_part'->>'part';
  IF part IS NOT NULL THEN RETURN part; END IF;
  content := p_call->'request'->'messages'->0->>'content';
  IF content IS NULL THEN RETURN NULL; END IF;
  BEGIN
    inner_request := content::jsonb;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
  part := inner_request->'source_closure'->'extraction_part'->>'part';
  IF part IS NOT NULL THEN RETURN part; END IF;
  RETURN inner_request->'request'->'source_closure'->'extraction_part'->>'part';
END;
$function$;
