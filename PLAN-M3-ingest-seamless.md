# M3 — Ingest is seamless

Goal: a brand-new deal (a document set Ben drops into the ingest folder or uploads via `/admin/ingest`) lands end-to-end and renders **identically to any existing deal in the corpus** with no manual steps. Two-pass definitions extraction works: definitions are surfaced as first-class Provisions and cross-referenced from the sections that use them.

Absorbs taxonomy gaps G8 (ingest QA normalizer check), G10 (cross-section definitions), G11 (Provision.kind field). See `PLAN-TAXONOMY-GAPS.md` for the full mapping.

## Exit criteria

- A test deal ingested via `/admin/ingest` renders on `/review/[id]` from the schema-first path with:
  - ≥40 provision cards
  - Definitions section populated with cross-references to consuming provisions
  - Normalizer manifest attached
  - Provenance bundle attached (see G4/G5 — WP-PROVENANCE-BUNDLE-01)
  - Extractor stamp visible in card metadata (G5)
- Zero manual steps between "documents dropped" and "renders correctly."
- Ingest QA harness (`scripts/ingest/qa-harness.js`) runs automatically post-ingest and fails ingest if any normalizer regressed.
- `provision.kind` field populated on every card ("standard" | "definition" | "cross-reference").

## WPs in M3

### WP-M3-01: Provision-instance identity (G1 + G2)

- Ships:
  - Defines `provision_instance_id` (stable across reingest for the same source span)
  - Defines `excerpt_id` (stable per-excerpt, referenced by cards)
  - Backfill migration for existing 40-deal corpus
- Requires: M2 complete (schema-first is the only render path, so identity has one place to live)
- Brief: `pm-wp-provision-id-01.codex.md` (to be authored during M3)
- Classification: **canonical** — one Queue entry: "Approve provision-instance identity scheme" with the ID shape + migration plan.
- Branch: `wp/m3-01-provision-id`

### WP-M3-02: Normalizer manifest (G3)

- Ships:
  - Each ingest produces `normalizer-manifest.json` listing every normalizer version invoked + input hash + output hash
  - Manifest surfaced on `/admin/ingest-runs/[id]`
  - Ingest QA harness (G8) reads the manifest and fails if any normalizer regressed vs. golden fixtures
- Classification: **mechanical**
- Branch: `wp/m3-02-normalizer-manifest`

### WP-M3-03: Provenance bundle + extractor stamp (G4 + G5)

- Ships:
  - Every provision card carries a `provenance` bundle (source doc, page, offset, extractor name + version, model + prompt hash, run_id)
  - Extractor stamp visible in card debug view
  - Provenance bundle is the audit source for parity/reconciliation
- Classification: **canonical** — one Queue entry: "Approve provenance bundle shape."
- Branch: `wp/m3-03-provenance-bundle`

### WP-M3-04: Definitions as Provisions (G10 + G11)

- Ships:
  - Adds `provision.kind` field (values: `standard`, `definition`, `cross-reference`)
  - Two-pass extractor: pass 1 extracts sections + provisions normally; pass 2 walks the Definitions section, emits one Provision per defined term with `kind=definition`, and rewrites consuming provisions with `kind=cross-reference` pointers back to the definition
  - Renderer collapses cross-refs into hover-cards; definitions get a dedicated "Definitions" tab on `/review/[id]`
- Classification: **canonical** — one Queue entry: "Approve definitions-as-provisions model" with example rendered card + JSON shape.
- Branch: `wp/m3-04-definitions-as-provisions`

### WP-M3-05: Ingest end-to-end smoke test + admin surface (G9)

- Ships:
  - `/admin/ingest` page (drag-drop or path input; kicks off pipeline; streams progress)
  - `/admin/ingest-runs/[id]` shows every stage, timing, artifacts (manifest, provenance, QA report)
  - Smoke test: ingest the Metsera-golden fixture end-to-end in CI; fail if any exit criterion breaks
- Classification: **mechanical**
- Branch: `wp/m3-05-ingest-smoke`

## Handoff to M4

M4 (query) starts once M3-04 merges: definitions-as-provisions unblocks the "MAE carve-outs referencing Material Adverse Effect definition" style cross-cutting queries M4 needs to serve.

M3-05 (smoke test) can run in parallel with M4 kickoff.

## Ben interruptions in M3

- ONE queue entry for M3-01 (provision-instance identity)
- ONE queue entry for M3-03 (provenance bundle shape)
- ONE queue entry for M3-04 (definitions-as-provisions model)

Three clicks. All canonical semantics — this is the "what does a Provision mean" pass that has to happen once, ever.
