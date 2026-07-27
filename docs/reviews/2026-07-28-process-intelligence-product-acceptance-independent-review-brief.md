# Process Intelligence Product Acceptance Independent Review Brief

**Date:** 28 July 2026
**Requested reviewer:** Fable or an independent GPT-5.6 Sol reviewer using
extra-high reasoning
**Work class:** `specification_review`

## Review task

Review the Process Intelligence product acceptance specification
adversarially.

Assume that a plausible but legally incorrect answer is worse than no answer.

Do not write implementation code. Do not read deal filings. Do not extract
data. Do not amend the implementation plan.

Return `PASS` only if the exact reviewed specification is:

- legally safe;
- complete enough to guide later implementation planning;
- usable for a practising M&A lawyer;
- flexible when PM adds fields and legal terms;
- consistent with the two governing specifications; and
- testable without inventing product meaning during implementation.

## Exact review root

### Product acceptance specification

- path:
  `docs/superpowers/specs/2026-07-28-process-intelligence-product-acceptance-design.md`;
- SHA-256:
  `e13bf1594119e9bef23811dfeae5f462232e59c602a15f838a4b18340d29a7b6`.

### Governing Process specification

- path:
  `docs/superpowers/specs/2026-07-27-process-intelligence-design.md`;
- SHA-256:
  `1acbcafd211c1f90492164db655d1bda02faa0470ca29f3bd5f75bc8cf4cca15`.

### Governing shared-fact specification

- path:
  `docs/superpowers/specs/2026-07-27-shared-deal-facts-and-entity-authority-design.md`;
- SHA-256:
  `7dd9552c2634e4f64f0fc662f40002879fd6fca595a2394d8e3eb27baf35dbbe`.

### PM source baseline

- PM main commit:
  `c5737a59b01654d81380ff48771576d1f00e289f`;
- `lib/deals-index-columns.js` SHA-256:
  `3457984b065a277bc3aa18d34da62a7436325a7fe7ec0672ab0cbccd9473c1d3`;
- `lib/query/field-meta.js` SHA-256:
  `4b74cfa416a2a811b929d03851e7b9cdc91654dc754b6c74756be8f47988bbb5`;
  and
- `lib/query/serving-registry-v1.json` SHA-256:
  `83916dc4ad0ee02e6db7dfa8515f70dd0c39364feee1740c38c44dc684e3deb5`.

Stop with `ROOT_MISMATCH` if any reviewed file has a different SHA-256.

## Independence rule

Use a new review session.

Do not use the author’s conclusions as evidence. The existing advisory review
can identify topics, but it cannot satisfy independence.

Do not edit a reviewed file during the review.

If a change is necessary, return `REJECT` with the exact required correction.
Review the changed file only as a new exact root.

## Required checks

### 1. Product usefulness

Check whether a practising M&A lawyer can:

- ask for precedent language;
- browse by Domain, Topic and Pattern;
- refine the question without a wall of controls;
- understand the active filters;
- read the actual drafting;
- expand context repeatedly;
- find related discussions in the same proxy;
- copy and export exact passages; and
- understand coverage and failure messages.

Reject decorative complexity that does not help the legal research task.

### 2. PM field completeness

Independently verify:

- the exact 15 Deals-table fields;
- the current 331 distinct user-facing Agreement field keys;
- the treatment of aliases;
- the treatment of display-only legacy lawyer fields;
- the rule for fields with no supported result;
- the rule for new fields;
- the rule for new permitted values; and
- the rule for a new control type.

Check that complete field coverage does not create a 331-field wall.

Check that no field can disappear silently.

### 3. Legal question integrity

Check that:

- Ask and Browse select the same legal question;
- an unsupported question does not run a similar query;
- ambiguous language requires a choice;
- phrase results are verbatim;
- direct evidence and retold evidence remain distinct;
- zero results do not become a market-absence claim; and
- a language model cannot create a hidden legal conclusion.

### 4. Parties, structures and professionals

Check positive and negative behaviour for:

- conventional acquisitions;
- mergers of equals;
- reverse mergers;
- reverse Morris Trust transactions;
- share purchases;
- sponsor and consortium structures;
- bidder tracks;
- combination parties;
- selling shareholders;
- law firms;
- individual lawyers; and
- financial advisers.

Reject any rule that can:

- invent a buyer;
- move a professional to the wrong party or bidder track;
- combine separate share-purchase components; or
- treat missing disclosure as proof that no professional exists.

### 5. Shared PM facts

Check that Process Intelligence uses PM’s shared authority for:

- deal identity;
- parties;
- structure;
- consideration;
- equity value and value basis;
- sector;
- law firms;
- lawyers;
- financial advisers; and
- exact source evidence.

Check the press-release source rule for equity value.

Check that filters, result metadata, table view, export and source actions
cannot show different shared values.

### 6. Source reading

Check that:

- each result has an exact passage and citation;
- the selected evidence remains highlighted;
- repeated context expansion is bounded but repeat-clickable;
- paragraph order cannot change;
- related passages have checked relationship labels;
- actual drafting is always available; and
- the browser cannot invent related items by searching relationships one by one
  while it answers.

### 7. Field and navigation growth

Check that PM can add:

- a field;
- a permitted field value;
- a Pattern inside an existing Topic;
- a Topic;
- a field group; and
- a future domain such as CVR.

For each change, identify:

- what can appear without user-interface code;
- what requires product review;
- what requires new certification;
- what creates a catalogue difference; and
- what can affect old saved searches.

Reject silent meaning changes.

### 8. Saved searches, links, exports and corrections

Check that:

- old citations retain their original identity;
- inactive old links return `RELEASE_NOT_ACTIVE`;
- an explicit rerun creates a new query;
- an old saved search is not overwritten;
- export uses the same results as the screen; and
- a correction proposal cannot change active data.

### 9. Failure and security behaviour

Check that:

- invalid or unsupported requests fail clearly;
- one failed detail does not remove valid results;
- one malformed result does not remove valid sibling results;
- the product does not use a hidden legacy fallback;
- unauthorised correction controls do not become active; and
- internal identifiers do not appear on normal user screens.

### 10. Speed and accessibility

Check that the fixed response-time limits are:

- measurable;
- compatible with dynamic fields and values;
- compatible with related passages and repeated context; and
- not weakened by loading the full corpus into the browser before filtering.

Check keyboard, screen-reader, text-zoom, colour and mobile-source-reader
requirements.

### 11. Acceptance-test quality

Review all 76 acceptance tests.

Find:

- missing negative tests;
- tests that can pass without proving the claim;
- tests that depend on implementation detail instead of user behaviour;
- duplicated tests;
- untestable wording;
- missing approved PM data-version and catalogue identity;
- false pass conditions; and
- features described in prose but not tested.

### 12. Consistency and over-hardening

Compare the product specification with both governing specifications.

Find:

- contradictions;
- weaker restatements;
- duplicated authorities;
- a new parallel store or registry;
- requirements that make future fields need unnecessary code;
- requirements that make a simple legal research action too slow or complex;
- technical controls shown to users without benefit; and
- internal system language that is not explained.

Do not reject a stricter rule only because it is strict. Reject it when it adds
cost or complexity without reducing a real legal, evidence, security or
operational risk.

## Current gate state

`docs/certification/programme-gate-status-v2.json` is absent at this review
root.

The review can assess specifications. It cannot authorise implementation
planning, code, deal-file reading, data work or extraction.

Do not treat the historical V1 status file as current executable permission.

## Required output

Start with one result:

- `PASS`;
- `REJECT`; or
- `ROOT_MISMATCH`.

For each finding, give:

- identifier;
- severity;
- exact file and section;
- the defective rule;
- a concrete failure example;
- the minimum safe correction; and
- whether the correction changes legal meaning, product behaviour or only
  wording.

Use these severities:

- `BLOCKING`: implementation could produce an unsafe or materially incomplete
  product;
- `HIGH`: a likely legal, evidence, identity, coverage or product failure;
- `MEDIUM`: a bounded defect that should be fixed before implementation
  planning;
- `LOW`: a useful clarification that does not change the core design; and
- `NOTE`: a gate-bound carry-forward item, not a present specification defect.

End with:

- unresolved findings;
- accepted carry-forward items;
- exact reviewed SHA-256 values; and
- the result of the 15-field, 331-field and 76-test checks.
