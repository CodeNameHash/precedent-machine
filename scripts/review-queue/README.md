# Review Queue CLI helpers

These helpers let Codex create Ben-review entries and poll for resolved decisions.

## Create

```sh
node scripts/review-queue/create.js \
  --kind canonical \
  --title "Approve mapping" \
  --summary "Codex needs Ben to approve a canonical mapping before merging." \
  --pr 123
```

The command writes `docs/review-queue/<id>.json` and prints the created entry as JSON.

Useful flags:

- `--id <id>`: deterministic entry id.
- `--kind canonical|destructive|unfreeze|clarify`: queue kind.
- `--title <text>`: one-line title.
- `--summary <text>`: decision summary.
- `--pr <number>`: adds the GitHub PR evidence link and PR-specific default choices.
- `--evidence <label=url>`: repeatable evidence link.

## Poll

```sh
node scripts/review-queue/poll.js --pr 123
```

The command scans `HANDOFF.md` for `REVIEW_QUEUE_RESOLUTION` lines, prints matching resolutions as JSON, and exits `0` when a matching resolution exists. It exits `1` when no matching resolution exists for the requested PR or id.
