# Deal Storylines consumer status

Updated: 2026-09-03

## Waiting on PM

- A-0003, the versioned released-package schema and synthetic example.
- Acceptance or correction of the proposed two-record corpus selection and
  admission split in Q-0001.
- A user-displayable five-deal package after the producer legal gate.
- Producer evidence before dates are assigned beyond the first real run.

## Consumer state

- No importer or production data path has been built.
- No PM internal file, field, database row or evidence path is a consumer
  dependency.
- The core product and Sale Process planning work continues independently.
- The combined roadmap treats the one-deal and first five-deal packages as
  wiring inputs only. They cannot satisfy a user-facing release gate while
  their release state is `REVIEW_ONLY_INTERNAL`.

## Current assumptions

- DS supplies the canonical deal ID through an approved corpus manifest.
- PM carries the DS deal ID, PM agreement ID and exact SEC source binding.
- Every package size uses the same schema and offline verification rules.
- Any field absent from the package schema is unavailable to the consumer.
