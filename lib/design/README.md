# UX Shell Design Tokens

`lib/design/tokens.js` is the Phase 1 source of truth for shell typography, colour, spacing, radii, shadows, and motion.

## Type

The shell has five sizes: `display`, `h1`, `h2`, `body`, and `caption`.

There are two font families:

- `editorial`: the existing Hanken Grotesk face currently mapped to `--font-serif`.
- `sans`: the existing Hanken Grotesk body face currently mapped to `--font-sans`.

No new editorial webfont was added. Monospace is not exposed as a design token and is reserved for code blocks and diff views.

## Colour

Use semantic tokens only: `text.*`, `surface.*`, `border.*`, `signal.*`, `accent.*`, and `provisionType.*`.

Do not add raw colour values in shell code. Add or rename a token first.

## Scale

Spacing is fixed to `4, 8, 12, 16, 24, 32, 48, 64`.

Radii are fixed to `0, 4, 8, 12`.

Motion has two durations, `fast` and `base`, and one easing curve.

## Invariants

Context belongs in the frame. Data belongs in the body.

Shell bodies must not render section numbers or provision labels as body content. Phase 2 enforces this with `tests/design-lint-no-context-in-body.test.js`; extend the walk root when WP-UX-REVIEW rewires the card.

`/design` is the static fixture route for token and primitive review. It returns `notFound` in production.
