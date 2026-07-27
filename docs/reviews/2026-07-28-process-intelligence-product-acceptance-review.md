# Process Intelligence Product Acceptance Review

**Date:** 28 July 2026
**Review type:** Advisory specification review
**Result:** PASS

## Authority limit

This is not an independent formal review.

The same reviewer helped write the product specification. This review can find
internal defects, but it cannot prove reviewer independence.

This review does not permit implementation planning, code, data work, filing
review or extraction.

## Reviewed files

Product acceptance specification:

- path:
  `docs/superpowers/specs/2026-07-28-process-intelligence-product-acceptance-design.md`;
- SHA-256:
  `0e686a2cc898fd68ff5f4915228e09edd47469f9b3ee0d824475ee90b1694ed7`.

Governing Process specification:

- path:
  `docs/superpowers/specs/2026-07-27-process-intelligence-design.md`;
- SHA-256:
  `1acbcafd211c1f90492164db655d1bda02faa0470ca29f3bd5f75bc8cf4cca15`.

Governing shared-fact specification:

- path:
  `docs/superpowers/specs/2026-07-27-shared-deal-facts-and-entity-authority-design.md`;
- SHA-256:
  `7dd9552c2634e4f64f0fc662f40002879fd6fca595a2394d8e3eb27baf35dbbe`.

PM main:

- commit:
  `c5737a59b01654d81380ff48771576d1f00e289f`.

## PM field evidence

The review checked these exact PM files:

| File | SHA-256 |
|---|---|
| `lib/deals-index-columns.js` | `3457984b065a277bc3aa18d34da62a7436325a7fe7ec0672ab0cbccd9473c1d3` |
| `lib/query/field-meta.js` | `4b74cfa416a2a811b929d03851e7b9cdc91654dc754b6c74756be8f47988bbb5` |
| `lib/query/serving-registry-v1.json` | `83916dc4ad0ee02e6db7dfa8515f70dd0c39364feee1740c38c44dc684e3deb5` |

The field check found:

- 15 Deals-table fields;
- all 15 exact keys and labels in the product specification;
- 331 distinct user-facing Agreement field keys in the present query layer;
- 64 sequential product acceptance tests; and
- no missing current Deals-table field.

The 331-field count is evidence of the present PM query layer. It is not a
fixed future limit.

## Adversarial findings

### A1. Field growth could silently change the product

**Result:** Resolved

The product uses one fixed field catalogue for each approved PM data version.
A source-registry change creates a catalogue difference. A new field or value
does not become active only because it exists in the database.

### A2. A fixed list of 331 fields would become stale

**Result:** Resolved

The user interface uses stable groups and generated fields. It shows only
fields that are valid for the current domain, topic, pattern and result type.

A field can appear without new user-interface code only when its control type
and display already exist.

### A3. All PM columns could create an unusable filter wall

**Result:** Resolved

All 15 current Deals-table fields are available through the searchable
`More filters` control. The default view shows only relevant filters. Active
filters appear as one short sentence.

The specification prohibits a large decorative field of pills.

### A4. Ask and Browse could answer different legal questions

**Result:** Resolved

Ask and Browse create the same checked query. Equal questions and filters must
return the same ordered result identities.

Unsupported or ambiguous questions do not run a similar query.

### A5. Browse navigation could become fixed to Exclusivity

**Result:** Resolved

Browse reads a fixed approved navigation catalogue. The selected Topic controls
the Pattern list.

A new Pattern can appear without new user-interface code after approval. A new
hierarchy level requires product review.

### A6. Search could return a language-model summary instead of precedents

**Result:** Resolved

The default output is a set of verbatim precedent passages. Narrative
language-model output is outside the first version.

### A7. The result could hide the actual drafting

**Result:** Resolved

Each result has one exact passage and source action. Related items have a
verbatim preview and an action to open the actual drafting.

`Show more above` and `Show more below` are repeat-clickable.

### A8. Deal facts could diverge from PM

**Result:** Resolved

Process Intelligence uses PM’s shared fact and entity authority.

Equity value, value basis, counsel, lawyers and advisers use their exact shared
values and source actions. A press-release value opens the exact press release.

### A9. Adviser filters could match the wrong party

**Result:** Resolved

Professional filters bind represented party, role and exact source. Legacy
free-text adviser arrays cannot satisfy the new filter.

### A10. Complex structures could create a false buyer or false component

**Result:** Resolved

The specification covers mergers of equals, reverse mergers, reverse Morris
Trust transactions and share purchases.

It prohibits an invented buyer and prohibits mixing values from separate
share-purchase components.

### A11. A zero result could be described as market absence

**Result:** Resolved

The required message is “No results in the covered deals.” A stronger absence
statement needs a separate approved proof rule.

### A12. Old links and saved searches could silently change

**Result:** Resolved

An old inactive link returns `RELEASE_NOT_ACTIVE`. An explicit rerun creates a
new query and saved-search identity. It does not overwrite the old search.

### A13. Export could contain different data from the screen

**Result:** Resolved

Export uses the same selected result identities and field catalogue as the
screen. It cannot add an unsupported field.

### A14. A correction could change active data

**Result:** Resolved

A correction is a proposal. It does not change the active result. A corrected
value needs later review, checks and an approved PM data version.

### A15. Flexibility could weaken speed

**Result:** Resolved

The specification keeps the existing query and context time limits. It also
prohibits loading the full corpus before filtering.

## Open carry-forward items

These items do not block the specification result:

1. The present `SEC_FILING_MEETING` query type produces zero user-facing
   fields. The future catalogue must record an explicit inclusion or exclusion
   reason. It cannot infer support from the type name.
2. Final visual styling is not fixed. A later visual design must use PM’s
   design language and must pass the behaviour in this specification.
3. The exact catalogue schema and generator belong in the implementation plan.
   That plan cannot change until the formal `implementation_planning` permission
   passes.
4. The first CVR legal question set remains deliberately unselected.
5. The formal independent review must examine the final exact specification
   root. This advisory review cannot replace it.

## Gate check

`docs/certification/programme-gate-status-v2.json` does not exist.

The V2 status file is the executable permission record. Its absence means that
the product specification can progress, but implementation planning, code,
data work and extraction remain blocked.

## Decision

The product acceptance specification passes this advisory review.

It gives complete current PM Deals-table coverage, controlled future field
growth, exact precedent output, checked source reading and clear acceptance
tests.

No implementation authority is claimed.
