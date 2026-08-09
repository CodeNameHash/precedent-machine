# DERIVED_LIMB/V1 — schema design (mint gated)

Status: **designed, not minting.** Ben ruled 2026-08-08 (DECISIONS.md §15):
annotation-only for now; design the identity model now; mint only after the
marker-start stability criterion passes. Fable specified the payload shape in
`derived-structure-identity.md`. This note is the schema contract.

## Schema name

**`DERIVED_LIMB/V1`**

A new content-addressed domain. **Do not bend `PROVISION_COMPONENT/V1`.**
That schema's identity hard-codes `parent_provision_instance_id`, both
offsets, `component_key`, and `ordinal` (`source-structure.js`
`buildProvisionComponent`). Parent extent or ordinal churn would cascade
re-mints through every child. Derived limbs need a start-anchored identity
that survives segmenter improvement; keeping the schemas distinct also keeps
attested vs inferred provenance queryable forever.

## Identity payload

Exactly two fields, plus the schema version for the same `contentId`
convention every other `/V1` row uses:

```js
contentId('DERIVED_LIMB/V1', {
  schema_version: 'DERIVED_LIMB/V1',
  canonical_text_id,   // SHA-256 hex of the admitted canonical text
  marker_start_byte,   // UTF-8 byte offset into that canonical text
})
```

`marker_start_byte` is the UTF-8 byte offset of the marker token's opening
`(` in the **document-absolute** canonical text (section start +
section-relative conversion at the `subclauses.js` string-index boundary).
A limb's beginning is a fact about the document; its extent is a fact about
our algorithm.

**Stub:** `lib/canonical-v2/derived-limb-identity.js` exports
`DERIVED_LIMB_SCHEMA` and `mintDerivedLimbId({ canonical_text_id,
marker_start_byte })`. It is **not wired** into the producer, writer, or
any live mint path.

## Not identity (attributes / edges only)

All re-derivable; none enter the `contentId` payload:

| Attribute | Role |
|---|---|
| `path` | Dotted outline path (`a`, `a.ii`, `a.ii.B`). Algorithm output — mis-nest fixes re-parent without re-minting. |
| `parent_derived_limb_id` | Component-to-component parent edge (see nesting). Not in identity. |
| `end_byte` / `extent_excerpt_id` | Leaf extent. Re-mints freely on segmenter change; attach as evidence, never as id. |
| `depth` | Outline depth (1-based). |
| `ordinal` | **Dropped.** Start byte totally orders limbs within a canonical text; do not stabilise or store as identity. Display order = sort by `marker_start_byte`. |
| `segmenter_version` | Stamp from `SEGMENTER_VERSION` in `subclauses.js`. Invalidates annotation on rule change; never part of id. |
| `corroboration_tier` | `CORROBORATED` / `LINE_ANCHORED_ONLY` / `PERMISSIVE_ONLY` (marker existence only). |
| `marker_token` / `label` | Checked attribute: a start whose token changes is a refused re-derivation, not a silent match. |
| `style` | Frame style that accepted the token (`alphaLower`, `romanLower`, …). |

## Nesting model (narrow → limb → clause)

Ben's card shape needs progressive depth: fact → limb → clause. Today's
`PROVISION_COMPONENT/V1` rows are flat under a provision instance — there is
no component-to-component parent (HANDOFF-2026-08-08 open item).

`DERIVED_LIMB/V1` models nesting as an **attribute edge**, not identity:

- Each derived limb is keyed only by `{canonical_text_id, marker_start_byte}`.
- `parent_derived_limb_id` points at the enclosing derived limb (the parent
  marker's id), or null for a top-level outline item under the section.
- The section / provision instance remains the outer container (annotation
  already carries section reference via structure_context); it is not folded
  into derived-limb identity.
- Re-parenting after a segmenter fix updates the edge and path attributes;
  the child's id is unchanged.

This is the only nesting the mint gate is designing for. Model-declared
`PROVISION_COMPONENT/V1` trees (capitalisation / representations
`limb-components.js`) stay on their own schema and parent-instance link.

## Mint gate — stability criterion

**Do not mint in production until** a corpus survey shows **zero
marker-start moves** across the agreed baseline after the three segmenter
changes (colon rule, `MAX_DEPTH` 3→5, `(x)/(y)/(z)`), over ~2,360 markers.

- Instrument: `scripts/canonical-v2-marker-start-stability.mjs`
- Results: `docs/codex-program/notes/step-2x-marker-start-stability.md`
- **Survey result (2026-08-08): PASS — 0 start moves.** Pre-three-changes
  baseline 1691 → current 2447 (1684 stable / 763 new / 7 dropped). Drops are
  recognition corrections (mid-prose false opens), not relocated limbs.
  Mis-nest: 9 sections / 88 markers. New markers are expected; moved starts
  are the gate failure — none observed.
- Until product wires minting: Step 2X-A `structure_context` annotation only;
  `mintDerivedLimbId` must not be called from producer / writer paths.

Minting before the gate would bake roughly 1% wrong content-addressed
identities (attestation residual on derived structure). Absence answers
built on derived limbs must still carry derivation provenance and must
never render as ground truth even after the gate opens.

## Coexistence with `PROVISION_COMPONENT/V1`

| | Model-declared limb | Derived limb |
|---|---|---|
| Schema | `PROVISION_COMPONENT/V1` | `DERIVED_LIMB/V1` |
| Who attests | Producer (capitalisation, representations, …) | Segmenter inference |
| Identity | parent instance + both offsets + key + ordinal | `{canonical_text_id, marker_start_byte}` |
| Families today | Limb-shaped model output | Flat-assertion families (annotation only until gate) |

Rules:

1. Never coerce a derived limb into `PROVISION_COMPONENT/V1` to "reuse"
   storage. Distinct schemas keep provenance queryable.
2. A claim may cite at most one limb subject; the cite is typed
   (`provision_component_id` vs `derived_limb_id`), not overloaded.
3. Excerpts attach extent evidence to either kind; excerpt identity still
   embeds both offsets and must not be mistaken for limb identity.
4. Derived structure may describe what the model said; it must never select
   what the model reads (Fable 2.1 / 2.3).

## Open after design

- Gate measurement: **0 start moves** (see stability survey note). Product
  mint wiring is still a separate step.
- Spot-audit of unflagged marker-bearing sections (98.9% is
  signature-clean, not verified-correct).
- Glance at the 6–7 dropped starts vs pre-depth/xyz before mint (xyz /
  colon interaction residuals — not moves).
- When minting is authorised: writer table / validate-write-set keys for
  `DERIVED_LIMB/V1`, and the typed claim→limb cite — separate step, not
  this design note.
