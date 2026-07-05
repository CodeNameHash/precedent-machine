# WP-INGEST-SEED-50 selection manifest

Generate a repeatable seed manifest without running ingestion:

```sh
node scripts/select-seed-deals.js \
  --target-count 32 \
  --limit 250 \
  --status pending \
  --priority-file docs/ingest/seed-50-priority-deals.json \
  --out docs/ingest/seed-50-manifest.json
```

Dry-run the production batch runner against that manifest:

```sh
node scripts/ingest-seed-batch.js \
  --manifest docs/ingest/seed-50-manifest.json \
  --backend codex \
  --model gpt-5.5 \
  --dry-run
```

Run actual ingestion in small resumable batches:

```sh
node scripts/ingest-seed-batch.js \
  --manifest docs/ingest/seed-50-manifest.json \
  --backend codex \
  --model gpt-5.5 \
  --limit 2 \
  --concurrency 2 \
  --continue-on-error
```

The JSON manifest has this shape:

```json
{
  "generated_at": "2026-07-05T00:00:00.000Z",
  "dry_run": false,
  "status": "pending",
  "limit": 200,
  "target_count": 32,
  "scanned_count": 200,
  "duplicate_excluded_count": 0,
  "priority_file_count": 11,
  "selected_count": 32,
  "candidates": [
    {
      "candidate_id": "uuid",
      "filing_date": "YYYY-MM-DD",
      "parties": {
        "acquirer": "Buyer",
        "target": "Target",
        "filed_by": "Filer"
      },
      "value_usd": 10000000000,
      "effective_value_usd": 10000000000,
      "url": "https://www.sec.gov/Archives/...",
      "agreement_exhibit_url": "https://www.sec.gov/Archives/...",
      "agreement_text_hash": "sha256",
      "deal_key": "buyer-target-yyyy",
      "priority_reasons": ["Paul Weiss named in agreement text"],
      "paul_weiss_evidence_snippet": "...Paul, Weiss...",
      "priority_verification": {
        "value_usd": 14000000000,
        "value_metric": "equity value",
        "source_label": "Company press release",
        "source_url": "https://example.com/source",
        "note": "Externally verified transaction value."
      }
    }
  ]
}
```

Actual ingestion writes a JSONL run log to `docs/ingest/seed-50-ingest-run.jsonl`,
marks candidates `queued`, `ingested`, or `error`, and stamps deal/provision
metadata with `seedRunId`, `seedCandidateId`, `extractedBy`, and
`extractionModel`.
