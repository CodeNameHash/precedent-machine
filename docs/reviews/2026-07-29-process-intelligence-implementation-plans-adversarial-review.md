# Process Intelligence implementation plans adversarial review

## Result

PASS for bounded implementation planning.

This is an advisory review. The plan author also performed this review. It does
not prove reviewer independence and it does not replace the exact-root cold
review before the successor freeze.

## Exact review root

| File | SHA-256 |
| --- | --- |
| `docs/superpowers/plans/2026-07-27-process-intelligence-plan.md` | `aacdf24be1de0f6a7974a0aeb48109b833fbbabaecf4f13160a97f837d336627` |
| `docs/superpowers/plans/2026-07-29-process-intelligence-execution-plan.md` | `a255661cd51ee121b2d66b9691bd7e55dd2bda44d22c074efe8856973f1d49b0` |
| `docs/superpowers/plans/2026-07-29-shared-deal-facts-and-entity-authority-plan.md` | `8fb83ae3ac2f71b00f9a951b87d0ce6882eeb18e6954ee027363bf96f79790bf` |

## Gate evidence

The review used:

- PM main
  `c920ce6e3b037cf2352d77f7d3534d5bc363819a`;
- protected publication
  `c6d751cfdf6c981d3ad515323a9b476399cc2587`;
- an exact two-file publication tree;
- valid status and publication-head schemas;
- valid Ed25519 signatures with the trusted public keys;
- valid status-to-head object and digest bindings;
- a valid registry and validator-executable binding; and
- `status.code_commit` equal to PM main.

The status permits planning and canonical work. It does not yet permit a
public-deal vertical slice, broad extraction, import or activation.

## Findings and dispositions

### R1. Baseline evidence was inside the contract input root

**Class:** UNSOUNDNESS

**Risk:** The canonical input compiler treats every JSON file under its root as
a contract member. A field or Storylines evidence inventory could enter the
canonical bundle by accident.

**Disposition:** Resolved.

Both plans now put baseline evidence under `evidence/`. Only authored contract
members remain under `contracts/canonical-v2/successor/`.

### R2. The plans could create two successor manifests

**Class:** UNSOUNDNESS

**Risk:** A shared root manifest and a nested Process manifest create competing
membership authorities. The existing compiler permits one closed root.

**Disposition:** Resolved.

The plans now require one generated root `manifest.json`. Shared and Process
members occupy separate folders under that one root.

### R3. The Process user interface named a redirected page as its entry point

**Class:** UNSOUNDNESS

**Risk:** `pages/query/index.js` redirects to `/`. Building only there would
produce no live product.

**Disposition:** Resolved.

The plan now names `pages/index.js`,
`components/query/QueryLaunchBox.jsx` and the canonical result page.

### R4. Metsera gold was scheduled after candidate extraction authority

**Class:** UNSOUNDNESS

**Risk:** Gold created after extractor work can be contaminated. The approved
programme permits independent gold reading after `canonical_work_start`.

**Disposition:** Resolved.

PE1 and S6 now run as isolated evidence lanes under the current permission.
They cannot use extractor output or write candidate data.

### R5. No permanent gate consumer existed

**Class:** UNSOUNDNESS

**Risk:** Later tasks could rely on prose or an invalid status file.

**Disposition:** Resolved.

P-1 now creates a permanent read-only verifier. It checks the special ref,
tree, schemas, signatures, bindings, code commit and recomputed work classes.
It computes validator bindings from the exact main tree, not an implementation
branch.

### R6. A merge makes the current status stale

**Class:** UNSOUNDNESS

**Risk:** After main changes, the signed status still names the old main commit.
Work could continue under stale authority.

**Disposition:** Resolved.

The Process plan now has a merge stop rule. Work stops after a main merge until
the protected publisher issues a valid successor status.

### R7. Work packages were too large for the repository allowlist model

**Class:** UNSOUNDNESS

**Risk:** One branch could combine contracts, evidence, extraction, user
interface and release changes.

**Disposition:** Resolved.

Both plans now require small `wp/<name>` execution units with an exact phase
allowlist, required work class, exact file set and focused tests.

### R8. Product field catalogue ownership was unclear

**Class:** UNSOUNDNESS

**Risk:** Process could become the owner of a second field registry.

**Disposition:** Resolved.

Process authors only its field definitions. The PM-wide catalogue generator
combines Agreement, shared and Process definitions into one released catalogue.

### R9. The Process slice gate lacked exact implementation files

**Class:** UNSOUNDNESS

**Risk:** The plan could describe `PROCESS_VERTICAL_SLICE_PASS` without adding
the executable registry, schema, predicate and test bindings.

**Disposition:** Resolved.

P1 now names the gate registry, schema registry, predicate registry, test
registry and required tests.

### R10. Shared facts remained an unplanned external dependency

**Class:** UNSOUNDNESS

**Risk:** WP2 and WP3A could proceed with legacy strings or an unknown upstream
delivery date.

**Disposition:** Resolved.

The shared authority has its own exact-file plan, estimates, owner decisions,
contract order, evidence lane and Process integration gate.

## Prior disposition regression

### Source-universe completeness

No regression.

The plan keeps one production acquisition path and an independent SEC oracle.
It requires exact accession membership and explicit non-SEC manifests.

### Temporal expression

No regression.

Exact source text and spans remain mandatory. Structured time nodes enter only
through admitted observed forms.

### Citation integrity

No regression.

Old citations keep their release identity. An active-release rerun creates a
new query and cannot replace the old citation.

### Containment and gate sequence

No regression.

The plan adds a permanent status verifier and a stop after each main merge.
The current state permits no vertical slice, extraction, import or activation.

### WP3A scope

No regression.

Each promised shared field must be present through a compatible projection or
be expressly removed before freeze.

### Shared authority boundary

No regression.

Process reads one pinned projection and cannot create entity, fact,
professional or field authority.

### Complex transaction structures

No regression.

The shared plan includes mergers of equals, reverse mergers, Reverse Morris
Trust transactions, share purchases and the full approved structure set. Each
requires positive and false-inference tests.

### Product interaction

No regression.

All 76 acceptance tests map to one or more implementation packages. The plan
keeps Ask, Browse, filters, passage view, table view, source reading, related
drafting, saved searches, exports and corrections on one released query and
field system.

### Future domains

No regression.

CVR can add domain definitions later. It must reuse the same shared authority,
field catalogue, Query IR, serving row, source reader and interface shell.

## Remaining non-blocking items

1. Fable or another independent reviewer can run a delta review of this exact
   plan root.
2. The full exact-root cold review remains mandatory before freeze.
3. Ben must decide the full or reduced first shared field and structure scope
   before freeze.
4. The independent evidence reader and holdout custodian must be named before
   PE1 or S6 records gold.

## Decision

The plans are detailed enough for the first bounded implementation units.

Start with P-1. Then run separate P0 field-baseline and P0 Storylines-evidence
units. Then implement the contract-only part of P1. Stop that sequence for
delta review before extractor or candidate-data work.
