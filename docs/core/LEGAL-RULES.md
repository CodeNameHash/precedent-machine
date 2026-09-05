# Legal rules

## Fact unit

One independently operative authored unit is one proposition. Store its conditions, exceptions and timing as roles or linked facts. Do not create duplicate rows for coordinated parts of the same legal effect.

Each fact must state one legal effect and identify each material party, action, trigger, condition, exception, threshold and timing rule. Save a legal fact once under its proper family. Other families link to its stable identity.

An inferred value must be marked `INFERRED_PENDING_APPROVAL`. It is not a proven or publishable fact until a lawyer accepts it.

## Evidence and absence

Exact source words prove provenance. They do not prove legal meaning. A lawyer confirms legal meaning for the internal release.

A positive fact can be accepted without a whole-document coverage certificate when its meaning and evidence are confirmed. An absence statement needs reviewed family and document coverage. `NOT_RUN` and `UNRESOLVED` are never absence.

## Termination

- Store each termination right by terminating party and operative trigger.
- For breach rights, retain the breached obligation, closing-condition failure standard, incurability or cure period, notice mechanics, outside-date cap and any bar caused by the terminator's own breach.
- An outside-date extension is a linked child or role when it is part of the same grant. It is a separate proposition only when it is independently operative.
- A cross-family condition or fee remains owned by its proper family and is linked from the termination right.

## Termination fee

- A fee amount, payment trigger, tail test and remedy limitation are separate facts when each is independently operative.
- Store payer, payee, amount, currency, trigger and payment timing explicitly.
- Use the same fee fact types for reverse fees. Set the payer capacity to buyer and the payee capacity to seller.
- Link the payment trigger to the owning termination right. Do not restate that right as a fee fact.
- Exclude fee-linked sole-remedy language from the Termination Fee schema. Hold its final family ownership for legal review.

## No-Shop

- Store each prohibited action separately with its covenant obligor and covered representatives.
- Store each permitted-action exception with every prerequisite, proposal standard, fiduciary standard, adviser consultation and no-breach condition.
- Notice, initial match and subsequent match periods are distinct facts. A defined label such as “Notice Period” does not decide the legal role.
- Never infer that an action or exception is absent from a missing proposal.

The machine-readable contract is `contracts/product/legal-schema.v1.json`.
