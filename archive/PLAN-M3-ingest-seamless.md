# M3 — Ingest is seamless

Goal: a brand-new deal (a document set Ben drops into the ingest folder or uploads via `/admin/ingest`) lands end-to-end and renders **identically to any existing deal in the corpus** with no manual steps. The schema-first provision-card path already exists from WP-M2-00; M3 makes fresh ingest produce the same artefacts automatically.

Absorbs taxonomy gap G3 (normalizer manifest) and preserves the WP-M2-00 card semantics for fresh ingest. See `PLAN-TAXONOMY-GAPS.md` for the full mapping.

## Exit criteria

- A test deal ingested via `/admin/ingest` renders on `/review/[id]` from the schema-first path with:
  - ≥40 provision cards
  - Definitions section populated with cross-references to consuming provisions
  - Normalizer manifest attached
  - Provenance bundle attached
  - Extractor stamp visible in card metadata
- Zero manual steps between "documents dropped" and "renders correctly."
- Ingest QA harness (`scripts/ingest/qa-harness.js`) runs automatically post-ingest and fails ingest if any normalizer regressed.
- `provision.kind` field populated on every card ("standard" | "definition" | "cross-reference").
- **Residual waitlist review:** At end of M3, any entries still on `schema-deferred-waitlist.jsonl` get a Review Queue entry: "N SCHEMA_DEFERRED entries have no matching schema after M3 — reclassify as MOVED_OR_DROPPED or extend schema?"

## WPs in M3

### WP-M3-02: Normalizer manifest (G3)

- Ships:
  - Each ingest produces `normalizer-manifest.json` listing every normalizer version invoked + input hash + output hash
  - Manifest surfaced on `/admin/ingest-runs/[id]`
  - Ingest QA harness (G8) reads the manifest and fails if any normalizer regressed vs. golden fixtures
- Classification: **mechanical**
- Branch: `wp/m3-02-normalizer-manifest`

### WP-M3-05: Ingest end-to-end smoke test + admin surface (G9)

- Ships:
  - `/admin/ingest` page (drag-drop or path input; kicks off pipeline; streams progress)
  - `/admin/ingest-runs/[id]` shows every stage, timing, artifacts (manifest, provenance, QA report)
  - Smoke test: ingest the Metsera-golden fixture end-to-end in CI; fail if any exit criterion breaks
- Classification: **mechanical**
- Branch: `wp/m3-05-ingest-smoke`

## Handoff to M4

M4 (query) can start once WP-M3-02 has the normalizer manifest and WP-M3-05 proves fresh ingest can produce the WP-M2-00 card-backed shape.

M3-05 (smoke test) can run in parallel with M4 kickoff.

## Ben interruptions in M3

No canonical queue entries are expected in M3 unless the residual waitlist review discovers a new schema decision. WP-M3-02 and WP-M3-05 are mechanical.
