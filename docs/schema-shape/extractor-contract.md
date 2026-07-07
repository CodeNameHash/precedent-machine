# Phase 0-C Extractor Contract

Phase 1 and later extractor runs must normalise enum-like values before storage:

- route enum and `vocab_ref` values through `lib/schema-shape/normalize-value.js`,
- enqueue unrecognised values in `docs/schema-shape/reconciliation-queue.json` with status `NEW`,
- block deal freeze while unresolved queue entries remain unless the reviewer accepts `FREEFORM`,
- cache extractor outputs per `(deal_id, provision_id, extractor_id, extractor_version)`,
- require `--force-reextract` for any live LLM rerun,
- read downstream artefacts from cache and normalised files, never directly from a live LLM call.

Primary pipeline rows use `extractor_id = codex`; parity analytics may read additional extractor rows from the same cache file.
