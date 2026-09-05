# Operating rules

## Source safety

- Accept only approved SEC hosts and redirect targets.
- Preserve the raw response, headers, retrieval URL, final URL and source hash.
- Build canonical text and source locations deterministically from the preserved bytes.
- Validate every cited UTF-8 byte span against the canonical text.
- Never use synthetic facts on a real-document product path.

## Legal output

- AI proposes legal meaning. Code checks source identity, exact text, shape and schema completeness.
- One fact states one independently operative legal effect.
- A fact identifies the relevant party, action, trigger, condition, exception, threshold and timing rule.
- A source closure includes the operative unit, governing chapeau, relevant definitions and cross-references.
- Only a lawyer-accepted fact is final for the internal release.
- `NOT_RUN` and `UNRESOLVED` never appear as absence or completion.
- A published absence statement needs lawyer-confirmed coverage.
- Escalate only a genuine ambiguity in clause meaning, legal classification or compact omission.

## Product state

- Partial work has an unresolved count and never calls itself complete.
- Network retries use a client idempotency key. An intentional rerun creates a new generation.
- Proposals and fact revisions are immutable. A new decision creates a new revision.
- Autosave uses optimistic locking. This rejects a stale save rather than overwriting newer work.
- Publication changes one release pointer atomically. Prior releases remain recoverable.

## Security and release

- Require authentication on private product and mutation routes.
- Use least-privilege database roles.
- Never expose service credentials to browser code or logs.
- Test database migrations and rollback when database code changes.
- Back up and restore before production cutover. Test rollback before live use.

## Verification

- A leaf prompt or parser change runs its family fixtures.
- A router, provider, shared resolver, schema or context change runs all-family recorded fixtures.
- A user-interface change receives one browser check of the changed flow.
- A persistence change runs against an inactive local or staging database.
- Phase 0 and Phase 1 boundaries run the furthest real active product boundary
  that each phase owns.
- From Phase 2, each phase boundary runs the real SEC-source-to-review
  integration test.
- Repeat a failed check after a relevant fix. Do not repeat an unchanged pass.
