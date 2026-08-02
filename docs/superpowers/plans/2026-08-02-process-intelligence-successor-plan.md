# Process Intelligence: pilot → corpus plan (revised 2026-08-02)

**Status:** DRAFT — BLOCKED pending reconciliation with the approved
Process execution plan (`precedent-machine-process-design/docs/
superpowers/plans/2026-07-29-process-intelligence-execution-plan.md`,
ledger-pinned SHA-256 `a255661c…f1d49b0`) and its companion design doc
(`2026-07-27-process-intelligence-design.md`), which live in a repo
not yet pushed from Ben's machine. This draft was written from the
ledger, contracts and evidence trees only; it must be reconciled
against the approved plan's P10/P11 structure (and superseded where
they conflict) BEFORE the Fable adversarial review runs. Do not build
from this document in its current state.
**Supersedes:** the implicit plan scattered across the P8 ledger rows,
the storylines inventory's successor_requirements, and the M3 basis
decision's process-side silence. **Requested by Ben:** "ASAP but as
reliable as possible," importing everything the native-extractor
program has proven since 2026-07-31.

## Where Process Intelligence actually stands

- **Storylines prototype:** sealed `PROTOTYPE_EVIDENCE_ONLY`
  (3 Fable rounds); its successor requirements are binding on this
  plan and each is discharged explicitly below.
- **Metsera pilot (P8):** COMPLETE through isolated staging with
  rollback proofs — sealed 9-filing source universe, dual independent
  source enumerations + reconciliation, one reviewed exclusivity-grant
  passage → typed Process sidecar → Product row (27 fields,
  `EXCLUSIVITY_GRANTED`) → four surfaces → persistence → combined
  candidate release → serving partition. All inactive; production
  authority NONE.
- **Not proven:** any model-driven extraction of process narrative.
  Every reviewed passage was hand-selected; the pilot proves the
  PLUMBING (identity, admission, persistence, serving), not process
  EXTRACTION. This is the same gap the M3 basis decision named for
  Agreement: reviewed-slice ≠ native extractor.
- **Standing debt (ledger, MANDATORY BEFORE CORPUS SCALE):** the
  16 MiB write-envelope exception — write sets must carry sources by
  digest against sealed immutable documents, not embedded bytes.

## What the Agreement program proved that this plan imports

1. **Spec → adversarial Fable audit → cheap-model build → Fable
   review, per slice.** Every audit this week caught critical
   fail-open holes pre-build (comparator: 2C/5M; lexical net: 4C/6M;
   P1: 4C/6M). Process slices get the identical treatment; no slice
   builds from an unaudited spec.
2. **Deterministic structure first, model second.** The sectionizer/
   limb precision Ben likes is a property of doing structure
   deterministically with byte offsets and letting the model only
   propose content inside governed scopes. Process narrative gets the
   same split: a deterministic NARRATIVE SECTIONIZER (see slice PI-2)
   before any producer call.
3. **The producer never asserts a negative; instruments veto,
   never create.** "No other bidders contacted" is a DERIVED
   conclusion, never a model emission. The lexical-net pattern
   (unmatched signal → cannot conclude absent → review) transfers
   directly to process tells.
4. **Typed fail-closed everything; a check never run must never look
   passed.** Auto-pass-style gating with explicit unevaluated
   conditions from day one.
5. **Open-world preservation + deterministic commonality clustering +
   Ben adjudication UI.** The event vocabulary will be wrong at first;
   the pipeline must bank novelty losslessly and grow the taxonomy
   through Ben's rulings, not force-fit. (The adjudication artifact
   loop from 2026-08-02 took hours, not days — reuse it.)
6. **Instrument first-workload gating.** The Modiv enumeration scan
   failed 21/21 on its first real workload. Every new process
   instrument ships gated UNTRUSTED until its first real-workload
   triage is documented (the storylines prototype's typed-refusal
   evidence counts as prior art here, not as certification).
7. **The checker-derives-its-own-answer defect class.** Two incidents
   now (QXO converter, Modiv citation checker). Process verification
   instruments must resolve within governed spans, never global
   first-match; and dual independent derivation + reconciliation
   (which the pilot's source enumeration already does) is the house
   pattern for anything identity-bearing.
8. **Recorded-fixture replay as the test substrate** — live runs are
   expensive and rate-limited; every slice pins recorded responses and
   replays them deterministically, with one documented fresh live run
   per slice.

## The slices (each: spec → audit → build → review; own branch/
worktree per the PM concurrency rule; ledger row per slice)

**PI-0 — Contract freeze + activation decision (BEN, blocking,
zero build).** The reserved exact-root contract freeze over the P8
bundle, then the reviewed activation of the Metsera candidate release.
Everything below stacks on frozen contracts; freezing first is the
ASAP move because it de-risks rework in every later slice.

**PI-1 — Envelope slimming (the M2 debt).** Write sets carry sources
by digest; staging cap returns to 4 MiB; the direct `--db-url`
transport exception retires. Mechanical, spec-able, cheap-build.
Acceptance: byte-identical pilot replay with digest-carried sources;
envelope ≤ 4 MiB on the full nine-source Metsera chain.

**PI-2 — Deterministic narrative sectionizer.** The process analog of
the Agreement sectionizer: split "Background of the Merger" (and
adjacent Reasons/Opinion sections) into DATE-ANCHORED narrative units
with exact byte offsets — paragraph-level segmentation keyed on the
section's own date leads ("On March 14, 2026, ..."), actor sentences,
and meeting/communication markers. Pure, no model calls, replayed on
the 9 sealed Metsera filings + the three Agreement deals' proxy
statements (public, seal-able). Acceptance: hand-verified unit
boundaries on Metsera's real Background section (the gold's passage
offsets must fall inside single units); dual-walker reconciliation on
unit boundaries (import lesson 7).

**PI-3 — Native process producer, first family = EXCLUSIVITY.**
Bounded provider (same seam contract as the Agreement producer):
governed narrative units in, typed proposals out — exclusivity
grants/denials/expiries, with party, date, byte-verified quote, and
the predicate slots the frozen exclusivity catalogue v2 defines.
Never a negative; unknown event shapes go to open-world candidates
verbatim. Golden eval from day one: `metsera-gold/exclusivity-gold.v1`
is the eval target — the native producer must reproduce the gold's
grant (same passage, same predicate outcomes) before anything else
runs. The blind completeness-challenge protocol (already frozen in
contracts) runs as the recall check.

**PI-4 — Process disagreement net (veto instrument).** Lexical tells
per event family over the narrative units (exclusivity: "exclusiv",
"standstill", "no-shop period", "negotiate solely"; later families
theirs), overlap-matched against producer proposals exactly like the
Agreement lexical net (same receipt conventions, same
uncovered-family blocking, same veto-only semantics). Ships gated
UNTRUSTED until its Metsera first-workload triage is documented
(lesson 6). Unmatched tell → the unit cannot be concluded
event-free → review.

**PI-5 — Review queue + adjudication loop.** Process candidates join
the SAME review-queue artifact and materiality conventions as
Agreement claims (one queue, ranked; process events rank below
Agreement money terms initially — flagged for Ben like every
materiality call). Open-world process candidates get the
deterministic commonality clustering + adjudication-artifact loop
verbatim from the Agreement side.

**PI-6 — Breadth: second and third deal.** Skechers and Modiv proxy
Background sections through PI-2..PI-5 (their agreement-side fixtures
already exist, so cross-referencing process events against agreement
facts — e.g. the exclusivity grant vs the no-shop covenant — becomes
the first cross-domain corroboration instrument; scoped read-only
this slice). New event families only via commonality adjudication,
never by implementer fiat.

**PI-7 — Certification + serving activation at family scale.**
The M3-protocol analog for process: auto-pass conditions defined
(producer/gold agreement on the family, disagreement net clean,
completeness challenge passed, not novel, not in a known-defect
group), sampling with blind reads, and Ben's activation of process
rows into the already-proven generic Product partition. Nothing
serves before this gate; the pilot's serving plumbing means this
slice is approval + certification work, not new machinery.

## Sequencing and the ASAP argument

PI-0 is Ben-only and unblocks everything. PI-1 and PI-2 are
independent of each other and of PI-0's outcome — they start
immediately and in parallel (PI-1 cheap-build; PI-2 is the
precision-critical piece and gets the full Fable treatment). PI-3
depends on PI-2; PI-4 on PI-3's proposal shape; PI-5 reuses existing
machinery (small); PI-6 is throughput; PI-7 is governance. Critical
path: PI-2 → PI-3 → PI-4 → PI-6 → PI-7, with the same
serialization discipline the Agreement side uses (shared files =
serialized; docs/spec work overlaps freely).

Reliability is not traded for speed anywhere: the speed comes from
(a) reusing proven machinery (sidecar, admission, writer, partition,
surfaces — all done), (b) the adjudication loop's demonstrated
turnaround, (c) parallel spec/audit pipelining while builds run —
not from skipping gates. Every storylines successor requirement is
discharged: per-candidate adjudication (PI-5), independently sealed
sources (PI-2/PI-6 seal each deal's proxy like Metsera's nine),
canonical PM facts as inputs only (PI-6 corroboration is read-only),
typed refusal preserved (PI-3/PI-4 fail-closed vocabulary), release
bound to contract+code+data+certification (PI-0/PI-7).

## What this plan refuses to do

No model calls inside identity/validation/writer code (M3 basis
decision, unchanged). No storylines-prototype row, repair rule,
vocabulary item or NLP result promoted by osmosis — evidence only.
No process row served before PI-7's certification gate. No new
serving/writer/release machinery — the generic partition is the
single path, or the plan is wrong.
