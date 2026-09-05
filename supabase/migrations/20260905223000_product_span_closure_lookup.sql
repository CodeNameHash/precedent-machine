CREATE INDEX product_source_closure_spans_run_span_closure_idx
  ON public.product_source_closure_spans(run_id, span_id, source_closure_id);
