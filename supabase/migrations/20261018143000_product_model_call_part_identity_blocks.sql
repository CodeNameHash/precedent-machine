-- The Anthropic API provider sends each request as two text blocks in one
-- user message (work package 10, plan finding (67)): the stable block under
-- the prompt-cache breakpoint and the section block holding source_closure.
-- The part reader read messages[0].content as one JSON string, so for a
-- split section on that provider the part number was never found, the
-- expected invocation identity was derived from the bare attempt token and
-- every part was refused ("invalid product model invocation identity":
-- NCS generation 5, 2026-10-18 13:45 UTC, two split sections, three
-- attempts each, after their routing, residual and extraction calls had
-- been paid for). The reader now also walks a content array: each text
-- block that parses as JSON is searched for source_closure.extraction_part
-- at its top level or under "request". A string content reads as before.
CREATE OR REPLACE FUNCTION product_private.product_phase2_model_call_extraction_part(p_call jsonb)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
DECLARE part text; content jsonb; block jsonb; inner_request jsonb;
BEGIN
  part := p_call->'request'->'source_closure'->'extraction_part'->>'part';
  IF part IS NOT NULL THEN RETURN part; END IF;
  content := p_call->'request'->'messages'->0->'content';
  IF content IS NULL THEN RETURN NULL; END IF;
  IF pg_catalog.jsonb_typeof(content) = 'string' THEN
    BEGIN
      inner_request := (content #>> '{}')::jsonb;
    EXCEPTION WHEN others THEN
      RETURN NULL;
    END;
    part := inner_request->'source_closure'->'extraction_part'->>'part';
    IF part IS NOT NULL THEN RETURN part; END IF;
    RETURN inner_request->'request'->'source_closure'->'extraction_part'->>'part';
  END IF;
  IF pg_catalog.jsonb_typeof(content) = 'array' THEN
    FOR block IN SELECT value FROM pg_catalog.jsonb_array_elements(content) LOOP
      IF block->>'type' IS DISTINCT FROM 'text' OR block->>'text' IS NULL THEN CONTINUE; END IF;
      BEGIN
        inner_request := (block->>'text')::jsonb;
      EXCEPTION WHEN others THEN
        CONTINUE;
      END;
      part := inner_request->'source_closure'->'extraction_part'->>'part';
      IF part IS NOT NULL THEN RETURN part; END IF;
      part := inner_request->'request'->'source_closure'->'extraction_part'->>'part';
      IF part IS NOT NULL THEN RETURN part; END IF;
    END LOOP;
  END IF;
  RETURN NULL;
END;
$function$;
