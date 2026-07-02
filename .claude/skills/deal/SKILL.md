---
name: deal
description: Conversational review of a single deal's extracted provisions. Use when the user names a deal to review, asks questions about a deal's provisions ("what triggers the termination fee on Metsera?"), or wants to correct extracted data ("set materiality on the FDA rep to MAE-level"). Takes a target name or deal UUID as the argument.
allowed-tools: Bash, Read, Grep
---

# Deal review session

Load the deal named in `$ARGUMENTS` into context, then answer questions and
apply corrections conversationally.

## 1. Load the digest

```bash
node scripts/deal-context.js --deal "$ARGUMENTS"
```

Read the output fully. It contains the deal header (parties, value,
structure), every provision grouped by type — with provision id, category,
canonical code, favorability, and unwrapped feature values — plus a pointer
for computing the trust report (coverage / quote verification). Credentials
come from `.env.local`; the script never prints them, and neither should you.

If the deal name is ambiguous the script lists the candidates — ask the user
which one they mean, then rerun with the UUID.

## 2. Answer questions

Answer from the digest wherever possible. When you need more than the digest
shows, drill down narrowly instead of loading everything:

- One type group in depth: `node scripts/deal-context.js --deal <id> --type TERMF --full`
  (`--full` adds clause text; type groups expand automatically: TERMR →
  TERMR/-M/-B/-T, COND → COND/-M/-B/-S, IOC → IOC/-T/-B).
- Defined terms: the default digest lists DEF term names only; run
  `--type DEF` for the entries.
- Trust numbers: run the one-liner printed at the bottom of the digest.
- A single provision's full record:
  `curl -s "https://precedent-machine.vercel.app/api/provisions?id=<uuid>"`

Cite provision ids (or at least category + code) when answering so the user
can verify. If the digest doesn't support an answer, say so — do not guess at
clause content you haven't seen.

## 3. Apply edits

Edits go through the production API so the corrections log stays meaningful:

```bash
curl -s -X PATCH https://precedent-machine.vercel.app/api/provisions \
  -H 'Content-Type: application/json' \
  -d '{"id": "<uuid>", "<field>": <value>, "reason": "<why, per the user>"}'
```

Rules:

- **Field-level only.** Update the specific field the user asked about:
  `category`, `ai_favorability`, or `ai_metadata` (send
  `{"ai_metadata": {"features": {"<key>": <value>}}}` — the API merges
  features, so send only the keys being changed). Never rewrite `full_text`
  unless the user explicitly provides the replacement text.
- **Every edit gets a `reason`** — one sentence capturing the user's
  rationale, not "user requested".
- **Confirm before writing** if the user's instruction is ambiguous about
  which provision or field is meant.
- **Verify after writing:** re-fetch the provision
  (`curl -s "https://precedent-machine.vercel.app/api/provisions?id=<uuid>"`)
  and confirm the new value back to the user.
- `deal_id` is immutable; the API rejects it.

## Never

- Print, echo, or interpolate credentials (`SUPABASE_*`, keys from
  `.env.local`) into commands or output.
- Write to the database directly — reads via `scripts/deal-context.js`,
  writes only via the PATCH endpoint above.
