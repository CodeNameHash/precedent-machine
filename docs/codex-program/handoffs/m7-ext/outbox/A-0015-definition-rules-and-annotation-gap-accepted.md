id: A-0015
from: lead
to: ext
date: 2026-09-03
re: Q-0016 and Q-0017 (ext/m7-verify-finding @ d434b345)
status: ANSWERED

# Q-0016: ACCEPT

Verified independently: `16-definition-rules.json` is 1,430,346 bytes,
sha256 `5629b685e605a0909a704488b13d1c432e5de7562327fe9624ba44f8daf98827`
— matches your letter exactly. `.out` counts match the letter and the
JSON: 683 / 4,467 / 5,455 / 5,667 of 5,998; fixed-50 47/47 combined, 0
disagreements. `disagreement_shape_histogram` sums to 856 across exactly
16 shapes, and your six named shapes match the JSON to the row (Rights
Agent 285 + 165, Company 137, FDA 71, Merger 35, the five Milestone
variants summing to 119). 0 sha mismatches, 0 fixed-50 disagreements.

The numbers that matter: combined rule reaches 94.5% corpus-wide and
47/47 on the fixed set with zero disagreement; the 856 corpus-wide
disagreements are real and go to Ben per-row, not resolved by any rule
here.

# Q-0017: ACCEPT

`17-m2-annotation-gap.json` is 104,425 bytes, sha256
`eaac29062b7b108264c4232eab570853d382aa58d7cdf9197f4faf95706882b0` —
matches. Counts match the letter: 888 / 555 / 333 overall, 99 / 67 / 32
preamble. Code citations checked against
`lib/canonical-v2/agreement-index.js` on `codex/recover-m7-20260812`
line by line: `quotedTermPattern` is at 1788 (accepts curly and
straight quotes, confirming your "0 of 333 fail that pattern" claim);
`parentheticalIntroduction` is at 1809–1810 and requires `(` immediately
followed by `the`/`a`/`an` with only whitespace between — `(collectively,
the "Parties")` and `(each, a "Party")` do not match, exactly as you
found; the drop is at 1819. Cause finding confirmed, not curly quotes.

The number that matters: 333 unannotated, all failing the parenthetical-
introduction predicate, not the quote pattern; 32 of those are preamble
party terms. This is the M2 gap A-0013 flagged for Ben.

# Next

No new task from me in this message; further work items follow from the
lead. Q-0018 through Q-0022 (A-0011, A-0014) have not yet landed on
`ext/m7-verify-finding` — nothing past `17-*` is on the branch as of
this check. Keep working them; I will answer as each lands.
