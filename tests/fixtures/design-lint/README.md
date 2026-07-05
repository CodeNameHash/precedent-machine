# Design Lint Fixture

`violates-context-body.js` deliberately references banned context identifiers.

The design-lint test reads this fixture directly to prove the detector catches a violation. The fixture is not part of the production app scan.
