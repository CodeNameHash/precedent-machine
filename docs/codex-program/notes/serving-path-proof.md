# Proving the server-to-client serving boundary, not just the import graph

Follow-on to `docs/codex-program/notes/family-rollout-mechanics.md` and
`docs/codex-program/notes/compare-locator-fix.md`. Both notes found the same gap and
neither built a fix: the parity register's entire proof chain is a static import-graph
walk over one module graph. Canonical V2 data for a family that actually serves crosses an
HTTP boundary that graph cannot see: a server-side `attachCanonicalXxxServing`-shaped
function stamps a field onto the object an API route serialises to JSON, and a client
module in a completely separate module graph reads that field name off the fetched
payload. `compare-locator-fix.md` Part 4 sketched a `server_stamped_field` evidence shape
and deliberately did not build it. This note builds it, tests it, applies it, and reports
what it does and does not prove.

**Pinned to:** commit `85bda8a2` on `codex/m3-production-phase1`, 2026-08-06. Working tree
carried other agents' concurrent, uncommitted edits to
`lib/canonical-v2/native-producer/candidate-resolution.js`,
`lib/canonical-v2/native-producer/termination-fee-parse.js`, a scope-correction script and
its replay test, and two new files under a `general-extraction-runner` name, none of which
this task opened, touched, or depends on. The full suite passed cleanly with all of it in
place (Verification, below), so there is nothing to flag about a collision this time,
unlike the collision `family-rollout-mechanics.md` had to record.

---

## Part 1: what the mechanism proves, and how

Three new functions in `lib/canonical-v2/native-producer/m3-family-parity-register.js`,
plus a new optional surface key, `server_stamped_field`:

```
server_stamped_field: {
  kind: 'server_stamped_field',
  wire_field: '<the exact JSON field name>',
  server_path: '<the server module that stamps it>',
  server_function: '<the function in server_path that stamps it>',
  server_route: '<the live pages/ route that reaches server_function>',
  client_function: '<the function in the surface's own source_path that reads it>',
}
```

`servingBoundaryProof(surface)` is `{ applicable: false }` when a surface names no such
evidence (every one of the 143 surfaces registered before this task; `liveProductVisibility`
must treat those exactly as before). When a surface does name it, both halves below must
independently prove the same literal, anchored to the one `wire_field` the surface
declares. There is no separate "extract the server's field, extract the client's field,
compare" step: each half is checked directly against the one value the register claims, so
a mismatch on either end fails the whole proof by construction, not by a comparison that
could itself be gamed.

**Server half (`serverStampsField`).** Reuses the register's own existing, already-audited
tools rather than inventing weaker ones:

1. `servedModules().has(server_route)`, the exact same live-route membership test every
   other surface's visibility already depends on. A `server_route` behind a 503 containment
   stub or the design route guard fails here.
2. `executedAdapterExportNames(server_route, server_path).has(server_function)`, ruling 2's
   exact bar, unweakened: the route must genuinely import `server_function` and reference it
   beyond the import line, not merely import the module.
3. `server_function`'s own reachable code (the same call-graph closure ruling 3 already
   builds, `reachableNames`) must genuinely evaluate the exact `wire_field` string. This is
   the one new capability: a one-hop constant fold. `termination-fee-serving-source.js`
   stamps the field via `[CANONICAL_V2_TERMINATION_FEE_CARDS_FIELD]: cards` where the
   bracketed name is a module-top-level `const ... = 'canonical_v2_termination_fee_cards'`,
   not the literal string directly, so the existing token-matching rule alone would miss it.
   `resolvedConstantString` follows exactly one hop from a reachable function's referenced
   identifiers to a `const NAME = '<literal>'` declared once at module scope (checked against
   `bindings.get(name) === 'VALUE'`, so a duplicated or shadowed name, already marked
   `AMBIGUOUS` by the existing machinery, is never folded). No deeper indirection is
   followed: a computed key, a template literal, or a value built from a function call fails
   closed rather than being guessed at.

**Client half (`clientReadsField`).** `client_function` must be a real top-level function
binding in the surface's own `source_path` (not a value, not an import), referenced beyond
its own declaration somewhere in that file, and its own reachable code must compute the
same `wire_field` literal via the identical one-hop fold. This is deliberately **not** the
same reachability bar as the server half. Every `*.config.js` in this repository dispatches
through a generic `config.selectRows(reviewDeal)` call the intra-module call graph cannot
see through (`family-rollout-mechanics.md` Part 2 already documents this exact limitation
for `marketSubterms`/`selectRows`; it is the identical shape for
`isCanonicalTerminationFeeServingEnabled`/`selectRows`). Requiring full reachability on the
client side would make the mechanism unable to prove anything for termination fee's real
architecture at all. So the client half anchors trust one notch short of full reachability,
recorded as a documented, tested limit rather than hidden. See Part 4.

Both halves are exported (`serverStampsField`, `clientReadsField`, `servingBoundaryProof`)
and directly unit-tested against the real repository files, not synthetic source, in the new
`tests/canonical-v2-parity-serving-boundary.test.js`.

`liveProductVisibility` wires this in as the last gate, after the existing consumer-proof and
locator-reachability gates, matching ruling 3's own placement rule: it only ever withdraws a
positive claim (`NATIVE_VISIBLE`/`DERIVED_VISIBLE` become `NATIVE_SERVING_BOUNDARY_UNVERIFIED`/
`DERIVED_SERVING_BOUNDARY_UNVERIFIED`), never promotes one, and only runs at all when
`surface.server_stamped_field` is present. A surface still blocked at an earlier gate keeps
its earlier, more specific reason; the new gate never even executes for it.

---

## Part 2: the hostile test, and the rest of the adversarial suite

The brief's explicit requirement: "tests including a hostile one where the two ends
disagree and the check must fail." `tests/canonical-v2-parity-serving-boundary.test.js`
carries several variants, all against real fields and real functions, never an invented
string, because a check that only rejects nonsense strings proves nothing about whether it
can catch a genuine, plausible-looking mismatch:

- **Real field, wrong server function.** `canonical_v2_preview_enabled` is a real wire
  field, genuinely stamped, by `attachCanonicalV2Preview` in a different module. Naming
  `attachCanonicalTerminationFeeServing` as the stamper of that field fails
  (`WIRE_FIELD_NOT_STAMPED_ON_REACHABLE_PATH`).
- **The two ends genuinely disagree, both real.** `attachCanonicalTerminationFeeServing`
  really does stamp `canonical_v2_termination_fee_serving_enabled` (the boolean switch, a
  different field from the cards array). The server half correctly proves true for that
  field. `partitionTerminationFeeCards` never reads that field, only the cards array, so the
  client half correctly fails (`WIRE_FIELD_NOT_READ_ON_REACHABLE_PATH`), and so does the
  combined proof. This is the exact "two real, individually true facts about opposite ends
  that do not correspond to each other" shape the brief named, confirmed against real code
  on both sides, not simulated.
- **Real, called, wrong field.** `isCanonicalTerminationFeeCompareEnabled` is real,
  exported, and genuinely called in `termination-fees.config.js`. It reads the compare and
  serving fields, not the cards field. Naming it as the reader of
  `canonical_v2_termination_fee_cards` fails the same way.
- **A rename on one side only.** A `wire_field` renamed to a string neither side actually
  uses (`canonical_v2_termination_fee_cards_v2`) fails on both halves independently.
- **Server function real but not executed by the named route**, **route real but
  contained**, **route real but design-guarded**: three variants of "the server-side call
  graph genuinely does not reach this," reusing the register's own existing containment and
  route-guard mechanics.
- **Client function names a real binding that is not a function** (a value constant) and
  **client function does not exist at all**: both rejected before any reachability question
  is even asked.

Plus a full validation-contract suite (missing key, extra key, wrong `kind` literal, a
`server_path`/`server_route` that does not exist, a `server_function`/`client_function` that
does not resolve, a `server_route` outside `pages/`), and `liveProductVisibility` wiring
tests confirming the gate is a genuine no-op for every surface that does not opt in, never
promotes a surface an earlier gate already rejected, and correctly produces the `_DERIVED_`
variant for an `APPROVED_DERIVED` surface rather than the `NATIVE_` one.

30 new tests in the dedicated file, 1 more in
`tests/programme-gates/m3-family-parity-register.spec.js` pinning the real register surface's
cleared state. All pass; see Verification.

---

## Part 3: applied to TERMINATION_FEE, honestly

**Short answer: one surface now traces through its real serving path with mechanical proof.
The one surface that was already `NATIVE_VISIBLE` before this task cannot honestly carry
this evidence at all, and that is itself the most important finding here, not a limitation
of the new mechanism.**

### termination-fee-query-fields: cannot be attached, and confirmed exhaustively, not by grep alone

`termination-fee-query-fields` (`source_path: components/review-v2/CompareColumn.jsx`,
`source_locator: UnifiedCompareSection`) is the one TERMINATION_FEE surface that was already
`NATIVE_VISIBLE` going into this task (`compare-locator-fix.md`, 2026-08-05). For
`server_stamped_field` to attach honestly, `CompareColumn.jsx` would need some function that
reads a termination-fee wire field. It has none. Checked exhaustively in
`tests/canonical-v2-parity-serving-boundary.test.js`, not sampled: every one of the file's 26
top-level functions' token sets, checked against all four termination-fee wire fields the
serving source stamps, and every top-level constant string in the file, checked against the
same four. Zero matches, either way. `UnifiedCompareSection` genuinely, only, dispatches
through `config.selectRows(reviewDeal)`/`column.renderCell(row, ctx)`, exactly as the
file's own header comment says it is designed to. This confirms, mechanically rather than by
argument, what `compare-locator-fix.md` Part 4 already suspected in prose: this surface's
`NATIVE_VISIBLE` answer has only ever meant "compare mode's rendering machinery is reached,"
never "V2 data crosses the HTTP boundary." There is no honest way to make this surface prove
the stronger claim without either changing what `CompareColumn.jsx` does (out of scope: this
task proves or refuses correspondences, it does not redesign the component) or attaching the
evidence to a surface whose file actually performs the read.

### termination-fee-rendered-rows: now traces through its real serving path

`termination-fee-rendered-rows` (`source_path: termination-fees.config.js`, the file that
genuinely hosts `isCanonicalTerminationFeeServingEnabled`/`partitionTerminationFeeCards`) was
blocked before this task, but not by anything this new mechanism is about: its
`evidence_paths` named only two test files, so `provingProductConsumers` returned null before
any locator or boundary question was ever reached (`family-rollout-mechanics.md` Part 2 had
already found and simulated this exact gap, and left it unapplied). Two independently
justified changes, made together, both attributed here rather than folded into one
undifferentiated edit:

1. **The pre-existing naming gap, closed.** `components/review-v2/sectionList.js` genuinely
   imports and uses `terminationFeesConfig` (`REVIEW_V2_CONFIGS`), and is itself a served
   module. Added to `evidence_paths`. Reconfirmed directly against the real, unmodified
   pre-task mechanism before touching anything (`consumerExecutesAdapter` returns true;
   `liveProductVisibility` on a clone with this one addition returns `NATIVE_VISIBLE`) --
   this alone was already sufficient under the OLD mechanism, exactly as Part 2 predicted.
2. **The new server_stamped_field evidence, added on top.** `wire_field:
   canonical_v2_termination_fee_cards`, `server_function: attachCanonicalTerminationFeeServing`
   (in `termination-fee-serving-source.js`, reached from the live, uncontained
   `pages/api/review/[id]/cards.js`), `client_function: partitionTerminationFeeCards` (in this
   surface's own `source_path`). Both halves prove true against the real files (Part 1).

With both changes in place, `liveProductVisibility('termination-fee-rendered-rows')` is
`NATIVE_VISIBLE`, and it is now the one surface in the entire 143-surface register whose
`NATIVE_VISIBLE` answer is backed by more than rendering-plumbing reachability: it is the
only surface naming `server_stamped_field` evidence at all
(`tests/canonical-v2-parity-serving-boundary.test.js`, "termination-fee-rendered-rows is the
one surface..."). Withdrawing the boundary evidence and re-running confirms the surface would
still read `NATIVE_VISIBLE` from the pre-existing mechanism alone (the naming-gap fix is
independently sufficient); the hostile-disagreement variant confirms the new gate is
load-bearing, not decorative, by making the SAME surface with a mismatched `wire_field`
correctly downgrade to `NATIVE_SERVING_BOUNDARY_UNVERIFIED`.

### The other TERMINATION_FEE surfaces, untouched, and why

`tail-fee-rendered-rows` shares `termination-fee-rendered-rows`'s exact naming-gap shape but
was left alone: fixing it would require the identical evidence-path correction repeated on a
different surface, which is real, available follow-on work, not something this task's brief
asked for, and doing it without a matching reason risks reading as chasing the count rather
than answering the question asked. `termination-fee-market-fields` additionally needs the
generic-dispatch problem (`marketSubterms` computed inside `selectRows`) solved first, a
different, already-named, already-deferred problem (`family-rollout-mechanics.md` Part 2).
`termination-fee-query-derived-values` is governed by a standing ruling (Query search
activation) unrelated to serving mechanics. The two `EVIDENCE_ONLY` wave-b surfaces are
untouched by design (that disposition bypasses consumer proof entirely).

---

## Part 4: an honest statement of what this mechanism still cannot prove

Four things, stated plainly rather than left implicit:

1. **It cannot execute an HTTP request or observe a real render.** Nothing in this register,
   before or after this task, calls the Next.js dev server, fetches `/api/review/[id]/cards`,
   or renders a page. If the question is "did a byte of V2 data appear in a browser for a
   real deal," the only sound answer is a runtime check: start the app, hit the route,
   inspect the response or the DOM. This mechanism proves something narrower and purely
   static: that the server-side code which WOULD stamp the field is reached and does compute
   it, and that the client-side code which WOULD read it is present, called from somewhere in
   its file, and does read the same literal. That is real, mechanical, non-trivial proof, and
   it is not the same claim as "verified live." Anyone reading `NATIVE_VISIBLE` plus a proven
   `server_stamped_field` should read it as "the wiring is genuinely there, statically," not
   "confirmed in production."

2. **The client half's reachability bar is deliberately weaker than the server half's, and
   this is exploitable, demonstrated, not merely theoretical.** Constructed directly against
   the real proof function: a file with `function deadCaller(reviewDeal) { return
   liveFieldReader(reviewDeal); }` where `deadCaller` is itself never called by anything, and
   `liveFieldReader` reads the claimed field. `clientReadsField` returns `proven: true`,
   because `liveFieldReader` is referenced beyond its own declaration (by `deadCaller`), and
   the check does not ask whether the caller is itself reachable from a served page. This was
   a deliberate design choice, not an oversight: the alternative (full transitive
   reachability from the surface's own locator) is defeated by the same generic
   `config.selectRows(reviewDeal)` dispatch pattern that makes the client-side field read
   invisible to the intra-module call graph in the first place, which would make the
   mechanism unable to prove ANYTHING for termination fee's real, working architecture. A
   register author who deliberately or carelessly names a `client_function` that is only
   ever called by dead code would pass this gate. This is a narrower version of exactly the
   gap ruling 3 exists to close for the ordinary locator rule; closing it fully for
   `server_stamped_field` too is real, identifiable follow-on work (either full reachability
   with a special case carved out for object-literal dispatch, or a second, complementary
   proof that `client_function`'s caller chain bottoms out in a locator ruling 3 already
   accepts), not done here.

3. **A field name is not a value.** Proving `canonical_v2_termination_fee_cards` is stamped
   and read proves the CHANNEL exists and is genuinely wired on both ends. It does not
   prove the cards array is non-empty for any given deal, that the card contents are
   correct, or that `isCanonicalTerminationFeeServingEnabled`'s gate is actually `true` in
   any environment a user reaches. All of that is runtime, per-deal, and per-environment
   information no static analysis of committed source can carry, and none of it is claimed
   here.

4. **It trusts the register author to name the RIGHT field for what the surface actually
   claims.** Nothing forces `wire_field` to be the most meaningful field for a `RENDERED_ROW`
   surface (the cards array) rather than a less central one (the boolean switch, or the
   source-status field) that would also technically pass. This task chose the cards field
   deliberately, as the closest thing to "the V2 value itself." A future surface could name a
   less meaningful field and still pass a proof that is technically sound but answers a
   weaker question than a reader might assume. This is a judgment call the register cannot
   make for its author, the same way it already cannot force a surface to choose the most
   meaningful `source_locator` today.

---

## Part 5: constraints, checked against what was actually done

- **Never changed a surface's recorded state to improve a count without a reason.** The one
  count-affecting change (`termination-fee-rendered-rows`, 103 to 102) is two named,
  independently-justified corrections to one real surface, both verified against the
  unmodified pre-task mechanism before being applied, exactly the discipline both prior
  notes used. No other surface's `state`, `disposition`, `source_locator`, or `source_path`
  was touched. `termination-fee-query-fields` was investigated for the same evidence shape
  and found genuinely unable to carry it; it was left exactly as it was, not force-fitted.
- **Existing gates keep working.** The full pre-existing register test suite (52 tests
  across `tests/canonical-v2-parity-serving-path.test.js` and
  `tests/programme-gates/m3-family-parity-register.spec.js`) passes unchanged in mechanism,
  with only the counts and lists that genuinely moved updated, each with an inline reason.
  `server_stamped_field` is opt-in: every surface that does not name it is provably
  unaffected (tested directly).
- **Fail closed.** Every new proof function's default, and every ambiguous or unreadable
  input's outcome, is `proven: false`. Nothing in the new code path can promote a surface an
  earlier gate rejected; the gate order in `liveProductVisibility` guarantees this
  structurally, not just by convention.

---

## Verification

Register-specific group, run directly after all changes:

```
CI=true node --test tests/canonical-v2-parity-serving-boundary.test.js tests/canonical-v2-parity-serving-path.test.js tests/programme-gates/m3-family-parity-register.spec.js tests/canonical-v2-m3-certification-control.test.js tests/canonical-v2-m3-certification-control-v2.test.js
-> tests 95, pass 95, fail 0
```

Full suite, exit code read directly off the `npm test` command itself, never piped into
`tail`/`head`, run twice, minutes apart, to bracket this task's own changes against the
concurrent multi-agent working tree:

```
CI=true npm test > /tmp/httpb.log 2>&1; echo "EXIT=$?"
-> EXIT=0 (tests 7622, pass 7580, fail 0, cancelled 0, skipped 42, todo 0)

... (more of other agents' concurrent work lands in the working tree) ...

CI=true npm test > /tmp/httpb_final.log 2>&1; echo "EXIT=$?"
-> EXIT=0 (tests 7633, pass 7591, fail 0, cancelled 0, skipped 42, todo 0)
```

Both runs exit 0 with zero failures; the 11-test difference between them is other agents'
own concurrent additions landing between the two runs, not this task's. Checked for the
collision class `family-rollout-mechanics.md` had to record (other agents' concurrent,
uncommitted files corrupting an unrelated test): `git status --porcelain` at the second run
shows `candidate-resolution.js`, `termination-fee-parse.js`, a scope-correction script and
its replay test, a `termination-fee-parse` test, and two new `general-extraction-runner`
files modified or added by other agents, none opened or depended on by this task. The full
suite passed with all of it in place, `fail 0`, both times, so there is nothing to attribute
here this task; the note is recorded to show the check was made, not assumed.

`node scripts/verify-codex-program-spec.mjs` (no `--write`) passes standalone after
`docs/codex-program/m3-family-parity-register.json` changed size (88429 to 88809 bytes);
regenerated via `node scripts/verify-codex-program-spec.mjs --write`, which touched only
`docs/codex-program/specification-manifest.json`'s one entry for that file (`byte_length` and
`sha256`), confirmed by diff, nothing else in the manifest or the other five governance files
moved.

## Files changed

- `lib/canonical-v2/native-producer/m3-family-parity-register.js`: the server-stamped-field
  proof (`validateServerStampedField`, `resolvedConstantString`,
  `evaluatesStringOnReachablePath`, `serverStampsField`, `clientReadsField`,
  `servingBoundaryProof`), a `constantStrings` field added to `analyseModuleSource`'s return
  value (additive, no existing consumer reads a fixed key set off that object), the optional
  `server_stamped_field` surface key wired into `validateSurface`, and the new gate wired
  into `liveProductVisibility` as the last, additive, opt-in check. No existing function's
  behaviour changed for a surface that does not name the new evidence.
- `docs/codex-program/m3-family-parity-register.json`: `termination-fee-rendered-rows` only.
  `sectionList.js` added to `evidence_paths`; `server_stamped_field` added.
- `docs/codex-program/specification-manifest.json`: regenerated by its own script, one
  entry's `byte_length`/`sha256` only.
- `tests/canonical-v2-parity-serving-boundary.test.js`: new. The proof mechanism's own test
  suite, including the required hostile disagreement tests, all against real repository
  files.
- `tests/canonical-v2-parity-serving-path.test.js`: exhaustive visible-surfaces list and
  pinned blocker count updated (103 to 102), both with the reason inline.
- `tests/programme-gates/m3-family-parity-register.spec.js`: `termination-fee-rendered-rows`
  removed from the hostile "omits a real consumer" list (it no longer does) with an
  explanatory note; a new test pinning its cleared, boundary-proven state, including
  confirming the naming-gap fix alone is independently sufficient; the adversarial "attacked"
  lower bound updated (99 to 98) with the reason inline.
- `tests/canonical-v2-m3-certification-control.test.js` and
  `tests/canonical-v2-m3-certification-control-v2.test.js`: pinned blocker count updated (103
  to 102), reason inline.
- `components/review-v2/CompareColumn.jsx`: not touched. Confirmed, not assumed, to have no
  candidate `client_function` for any termination-fee wire field (Part 3).
