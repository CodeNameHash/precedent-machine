# M2-00 Canonical Shapes

This evidence note supports the Review Queue entry "WP-M2-00 canonical schema: provision identity, provenance, kind, definitions".

## Context From M2-02 Discovery

PR #186 correctly found that M2-02 could not run because the schema-first card render path did not exist yet.

Discovery facts:

- `pages/review/[id].js` has no `provision_cards` card-backed branch to force for parity testing.
- Expected Phase 0 card artefacts are absent:
  - `lib/parser-v2/store-cards.js`
  - `components/review/ProvisionCardTable.jsx`
  - `lib/queries/review-deal.js`
- Live Supabase corpus at discovery:
  - `deals=40`
  - `provision_card_rows=0`
  - `deals_with_ge_40_cards=0`
  - Metsera `885edae5-49e8-464a-9f33-edd229119d7c` card count `0`

M2-00 fixes this by wiring the card path first, then M2-02 can audit a real schema-first renderer against the legacy renderer.

## A. Provision-Instance Identity

`provision_instance_id`: `<deal_id>:<section_path>:<span_hash>`

`span_hash`: `sha256(normalized_text)[:12]`

Properties:

- Stable across reingest of the same source span.
- Changes when the source text changes.
- Scoped by deal and section path so repeated boilerplate in different sections does not collide.

`excerpt_id`: `<provision_instance_id>:<excerpt_index>`

`excerpt_index` is a zero-based index into the ordered excerpts of the provision. It is stable per excerpt as long as the provision's ordered excerpts are stable.

## B. Provenance Bundle

Attached to every `provision_card` row.

```json
{
  "source_doc_id": "<deal doc uuid>",
  "source_doc_page": 1,
  "source_doc_offset_start": 100,
  "source_doc_offset_end": 250,
  "extractor_name": "<string>",
  "extractor_version": "<semver>",
  "model": "<string>",
  "prompt_hash": "<sha256>",
  "run_id": "<uuid>",
  "extracted_at": "<ISO>"
}
```

The renderer exposes this bundle in the card debug view.

## C. Provision.kind And Definitions

`kind`: enum with values:

- `standard`
- `definition`
- `cross-reference`

`standard`: a normal self-contained provision.

`definition`: a defined term from the Definitions section or an inline definition. Carries:

- `defined_term`
- `defined_value`

`cross-reference`: a provision that references a definition. Carries:

- `references[]`, an array of `provision_instance_id` values for the definition cards it points to.

Extractor pattern:

1. Pass 1 emits standard provisions.
2. Pass 2 walks Definitions, emits definition provisions, and rewrites consuming provisions with `kind=cross-reference` and `references[]`.

Renderer pattern:

- Cross-references hover-expand into definition cards.
- Definitions get a dedicated tab on `/review/[id]`.
