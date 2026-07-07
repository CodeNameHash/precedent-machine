# PLAN — Taxonomy gaps G1–G11

The 11 gaps identified in the taxonomy review. Each has an owner WP; each WP lives inside the milestone where it does the most good. This file is the cross-reference so nothing gets dropped.

| Gap | Description | Owner WP | Milestone | Classification |
|-----|-------------|----------|-----------|----------------|
| G1 | Provision-instance identity (stable ID across reingest) | WP-M3-01 (`wp/m3-01-provision-id`) | M3 | canonical |
| G2 | Excerpt IDs (stable per-excerpt ref) | WP-M3-01 (same WP as G1) | M3 | canonical |
| G3 | Normalizer manifest (per-ingest, per-normalizer version log) | WP-M3-02 (`wp/m3-02-normalizer-manifest`) | M3 | mechanical |
| G4 | Provenance bundle (source, page, offset, model, prompt hash) | WP-M3-03 (`wp/m3-03-provenance-bundle`) | M3 | canonical |
| G5 | Extractor stamp (extractor name + version on every card) | WP-M3-03 (same WP as G4) | M3 | canonical |
| G6 | Reconciliation log with typed events | WP-M4-01 (`wp/m4-01-reconciliation-tagged`) | M4 | mechanical |
| G7 | Ingest QA — normalizer check on fresh ingest | WP-M3-02 (same WP as G3; QA harness reads the manifest) | M3 | mechanical |
| G8 | Normalizer citation on query result cells | WP-M4-02 (`wp/m4-02-normalizer-citation`) | M4 | mechanical |
| G9 | DealProfile branch — admin flow surface | already exists as `/admin/processing-flow`; extended to `/admin/ingest` in WP-M3-05 | M3 | mechanical |
| G10 | Cross-Section definitions (definitions used across sections) | WP-M3-04 (`wp/m3-04-definitions-as-provisions`) | M3 | canonical |
| G11 | `Provision.kind` field (standard / definition / cross-reference) | WP-M3-04 (same WP as G10) | M3 | canonical |

## Notes

- G1 + G2 share a WP because the ID scheme has to be designed together.
- G4 + G5 share a WP because extractor stamp lives inside the provenance bundle.
- G7 folds into G3's WP because the QA harness's whole job is to check the manifest.
- G10 + G11 share a WP because `kind=definition|cross-reference` is what makes cross-section definitions expressible.
- G9's "surface" is `/admin/ingest`, which M3-05 builds — no separate WP.

## Ben's clicks attributable to gap-work

- G1/G2: 1 click (M3-01)
- G4/G5: 1 click (M3-03)
- G10/G11: 1 click (M3-04)

Three clicks handle all eight semantic gaps. Five gaps (G3, G6, G7, G8, G9) are purely mechanical.

## What happens if the gap-review turns up a new gap G12

Codex adds a row to this table in the PR that discovers it, slots the WP into the appropriate milestone, and classifies it. If it's canonical → new Queue entry. If mechanical → just proceed.

## Schema-deferred waitlist

175 reconciliation entries are on the waitlist waiting for M3 schema objects. See `PLAN-M3-ingest-seamless.md` for per-WP drain hooks and `/admin/reconciliation/deferred` for live status.
