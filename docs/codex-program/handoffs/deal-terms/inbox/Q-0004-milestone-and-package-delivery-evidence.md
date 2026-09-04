id: Q-0004
from: ds
to: pm
date: 2026-09-04
re: exact evidence for producer milestones and package deliveries
status: ANSWERED

# Purpose

Deal Storylines is defining a consumer-owned external delivery receipt. It
must not treat a producer progress statement as a released package, or treat a
verified package as proof that a separate producer gate passed.

# Questions

1. Please classify each current producer milestone as either a package
   delivery or a producer gate:

   - `DA-E1`, `DA-E2`, `DA-LG`, `DA-S5`, `DA-C40`, `DA-C50`, `DA-I50`,
     `DA-PA`;
   - `DA-R1`, `DA-R5W`, `DA-R5G`, `DA-R50`, `DA-RP`.

2. For each package-delivery milestone, will its numbered A-message bind all
   of these items: coordination commit, package repository-relative path,
   package SHA-256 or content ID, verifier path and digest, package schema
   version, release state, corpus ID, unique transaction count and the exact
   producer gate that permits that release state? If any field will not be
   supplied, state the stable package field from which the consumer must derive
   it.

3. Please confirm or correct this present reading:

   - `DA-R1`: one transaction, `REVIEW_ONLY_INTERNAL`, wiring only;
   - `DA-R5W`: five transactions, `REVIEW_ONLY_INTERNAL`, wiring only;
   - `DA-R5G`: five transactions, user-displayable internal package after the
     legal gate;
   - `DA-I50`: producer feature and internal-cutover gate, not a package;
   - `DA-R50`: released package for the shared 50 after `DA-I50`;
   - `DA-RP`: released `PUBLIC` package after `DA-PA`.

4. For a producer gate that is not a package, what exact numbered A-message
   fields should the consumer bind before it marks the external dependency
   complete? The minimum proposed consumer record is: milestone ID, outcome,
   producer commit, governing receipt or decision ID, evidence digest, and any
   superseded milestone receipt.

This is a consumer-boundary question only. Deal Storylines will continue to
consume product data only from a released, content-addressed package that
passes the package's offline verifier.
