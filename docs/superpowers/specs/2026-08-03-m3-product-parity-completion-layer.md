# M3 product-parity completion layer

## Decision

The parity register is the authority for rendered rows, query fields,
comparison fields, market fields, derived values, and side tables. A native
producer candidate, including open-world evidence, is not product semantic
completion.

## Machine check

`listM3ProductParityBlockers` returns every open family surface and every
unassigned surface with its exact family, source kind, path and locator. The
result is sorted and marks every blocker `semantic_completion: false`. Tests
also confirm every source path and locator exists.

## Remaining blockers

All current product surfaces remain follow-on work. The register has five
unassigned rendered surfaces: target representations, parent representations,
material contracts, no-other-representations/fraud, and general covenants.
No bounded serving change is safe while their family ownership is unresolved.

## Ben decisions

1. Assign the five unassigned review surfaces to a family, split them, or
   explicitly retire them.
2. For every open derived value, decide whether it is governed derivation or
   a display-only legacy value.
3. Choose the product semantics for comparison and market fields before any
   surface can move from `FOLLOW_ON_REQUIRED` to a terminal disposition.
