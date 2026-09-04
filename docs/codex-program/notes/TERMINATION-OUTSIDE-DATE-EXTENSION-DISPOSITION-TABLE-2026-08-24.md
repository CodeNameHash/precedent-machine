# Outside-date extension disposition — five OUTSIDE_DATE_RIGHT rows

Date: 2026-08-24  
Scope: Analysis only. No signature or code changes.

## Source

Filtered from `profile_review_items` where `classification_path` ends `OUTSIDE_DATE_RIGHT` in:

`evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-termination-45-profile-inventory-review-packet-draft.json`

Packet header: `outside_date_extension_deferred: true`. All five rows: `ben_review_completion_state: HOLD_EXTENSION_DISPOSITION_PENDING`, `HOLD_RECOMMENDED_UNTIL_EXTENSION_DISPOSITION`.

Bound rulings: `docs/codex-program/notes/TERMINATION-BEN-RULINGS-Q01-Q03-2026-08-24.md` (Q01 extension as linked child preferred; Q02 one owner / others link).

---

## Disposition table

| Deal | Profile key (prefix) | Extension in source text | `shape_summary.extension` (Stage B today) | Open-world OUTSIDE_DATE_EXTENSION |
|---|---|---|---|---|
| **metsera** | `261c8790…` | **One automatic HSR extension:** Initial Outside Date auto-extends to June 21, 2026 when specified antitrust closing conditions remain unsatisfied three business days before the date while all other conditions are met/waived. | `[]` — deferred | 1 row, `AUTOMATIC` — `evidence/canonical-v2/metsera-termination-20260809-2xk-final/resolution.json`, `validation.json`, `run-receipt.json` |
| **skechers** | `4ea33624…` | **Two mechanisms:** (1) auto extension to Feb 4, 2026 if antitrust/foreign-investment condition alone unsatisfied while other Art VII conditions met/waived; (2) **elective Marketing Period** — Parent may extend (further extend) by written notice ≥1 Business Day prior until four Business Days after Marketing Period expiration. | `[]` — deferred | 2 rows (`AUTOMATIC`, `ELECTIVE`) — `evidence/canonical-v2/skechers-termination-20260809-2xk-final/validation.json`, `adapter-result.json`, `resolution.json` |
| **concho** | `abfa845b…` | **None.** Fixed End Date (April 30, 2021); outside-date right is breach-carveout only, no extension proviso in §8.1. | `[]` — deferred (consistent with no extension) | **No** `OUTSIDE_DATE_EXTENSION` open-world rows in concho termination evidence |
| **redhat** | `e3064850…` | **Two elective extensions:** either party may extend Initial Termination Date, then First Extended Termination Date, each upon satisfaction/waiver of closing conditions other than §6.01(b)/(c). | `[]` — deferred | 2 rows, both `ELECTIVE` — `evidence/canonical-v2/redhat-termination-20260808-r1/resolution.json`, `redhat-termination-20260809-2xk-final/validation.json` |
| **skywater** | `f41fd796…` | **Two automatic 90-day extensions:** End Date extends once, then again (Extended End Date), when §8.1(b)/(c) antitrust conditions remain unsatisfied while other Art VIII conditions satisfied/waived. | `[DISQUALIFYING_END_DATE_OR_EXTENDED_END_DATE_REFERENCE]` — **partial token only** (`EXTENSION_PARTIAL_TOKEN_ONLY_REVIEW_REQUIRED`) | 2 rows, both `AUTOMATIC` — `evidence/canonical-v2/skywater-termination-20260809-2xk-final/resolution.json`, `skywater-termination-20260808-r1/validation.json` |

---

## Per-row packet detail (signatures excerpted)

### metsera (ordinal 7)

- **Flags:** `EXTENSION_MECHANICS_DEFERRED_NOT_IN_SIGNATURE`, `HOLD_RECOMMENDED_UNTIL_EXTENSION_DISPOSITION`
- **Signature excerpt:** `…NOT(ON_OR_BEFORE(EFFECTIVE_TIME_EVENT,BASE_OUTSIDE_DATE_REFERENCE))…DISQUALIFYING_OUTSIDE_DATE_REFERENCE…EFFECTIVENESS_SECTION_8_01_REFERENCE…`
- **Trigger tokens:** `BASE_OUTSIDE_DATE_REFERENCE`, `DISQUALIFYING_OUTSIDE_DATE_REFERENCE` — base date only; no extension-mode roles.
- **Effectiveness:** mandatory board/designee exercise on §8.01 (distinct from extension mechanics).

### skechers (ordinal 12)

- **Flags:** same deferred set as metsera
- **Signature excerpt:** `…NOT(ON_OR_BEFORE(BASE_CLOSING_EVENT,BASE_TERMINATION_DATE_REFERENCE))…CONDITION_DEADLINE_TERMINATION_DATE_REFERENCE…CLOSING_DEADLINE_TERMINATION_DATE_REFERENCE…`
- **Trigger tokens:** multiple date references for breach carveout timing; base termination date only — Marketing Period and auto-antitrust extension not in signature.

### concho (ordinal 28)

- **Flags:** same deferred set
- **Signature excerpt:** `…NOT(ON_OR_BEFORE(BASE_MERGER_CONSUMMATION_EVENT,BASE_END_DATE_REFERENCE))…DISQUALIFYING_END_DATE_REFERENCE…`
- **Note:** Phase 2 authority and run plan both record concho as **no extension state machine** — deferral is correct; disposition should confirm **no linked extension child** rather than pending mechanics.

### redhat (ordinal 41)

- **Flags:** same deferred set
- **Signature excerpt:** `…BEFORE(GLOBAL_CUTOFF_TERMINATION_EXERCISE_EVENT_REFERENCE,EFFECTIVE_TIME_REFERENCE)…EXCEPTION_TO(NOT(ON_OR_BEFORE(MERGER_CONSUMMATION_EVENT,TERMINATION_DATE_REFERENCE))…`
- **Trigger tokens:** single `TERMINATION_DATE_REFERENCE` — staged elective extensions not materialised.

### skywater (ordinal 43)

- **Flags:** `EXTENSION_PARTIAL_TOKEN_ONLY_REVIEW_REQUIRED`, `HOLD_RECOMMENDED_UNTIL_EXTENSION_DISPOSITION`
- **Signature excerpt:** `…NOT(ON_OR_BEFORE(BASE_MERGERS_CONSUMMATION_EVENT,BASE_END_DATE_REFERENCE))…NOT(ON_OR_BEFORE(EFFECTIVE_TIME_EVENT,DISQUALIFYING_END_DATE_OR_EXTENDED_END_DATE_REFERENCE))…`
- **Partial token:** breach carveout references extended end date but does not encode extension triggers, mode, or count.

---

## Open-world infrastructure (paths only)

Producer emits `surface: OUTSIDE_DATE_EXTENSION` with `extension_mode` / `electing_party`:

- `lib/canonical-v2/native-producer/termination-producer-prompt.js`
- `lib/canonical-v2/native-producer/anthropic-provider.js`

Wave B projection → review features (`outsideDateExtension`):

- `lib/canonical-v2/termination-product-projection.js`

Legacy rubric / UI consumption:

- `lib/schema/features.js`, `lib/category-summary-features.js`, `components/review/table-logic.js`
- `lib/query/serving-registry-v1.json` (`outsideDateExtension`, `outsideDateExtensionConditions`)

Tests pinning open-world shape:

- `tests/canonical-v2-termination-product-parity.test.js`
- `tests/canonical-v2-termination-real-fixture-replay.test.js`
- `tests/canonical-v2-termination-wave-b.test.js`

Packet builder deferral logic:

- `scripts/stage-2y-structure-m7-v2-termination-inventory-review-packet.mjs` (`outside_date_extension_deferred`, review-flag assignment)

---

## Ben decision required

~~Choose one programme mapping (Phase 3.2 in `TERMINATION-FAMILY-RUN-PLAN-2026-08-24.md`):~~

**Agent decisions recorded 2026-08-24 (Phase 3 — no Ben session):**

| Phase | Decision | Ruling |
|---|---|---|
| **3.2** | **Option B** — separate `OUTSIDE_DATE_EXTENSION` linked propositions; `OUTSIDE_DATE_RIGHT` links, no duplicate signature text (Q02) | Programme direction; Stage B adds link fields when extension work lands |
| **3.3** | Skechers Marketing Period extension — **Termination-owned**; other families link only | Q02 one-owner rule |
| **3.4** | **Defer** signature rewrites for now; extension disposition status **DEFERRED**; holds remain on four extension rows | Honest partial — no massive Stage B surgery until extension implementation |
| **3.4 Concho** | `no_extension_complete: true` on concho disposition row — complete when holds lift for that row only, without extension child work | Negative case is first-class complete outcome |

Extension disposition artefact status: **DEFERRED** (not yet written). Holds stay until extension-linked-proposition implementation (Phase 3.4 follow-up).

---

## Ben decision required (historical — superseded by agent Phase 3 above)

Choose one programme mapping (Phase 3.2 in `TERMINATION-FAMILY-RUN-PLAN-2026-08-24.md`):

| Option | Meaning | Fit to five rows |
|---|---|---|
| **A — Linked roles on OUTSIDE_DATE_RIGHT** | Extension mechanics as child roles / reference tokens on the same profile signature (Q01 preferred reading). | Natural for skywater partial token; metsera/redhat/skechers need extension-mode + electing-party roles added. Concho: confirm empty extension bucket is intentional complete state. |
| **B — Separate linked proposition** | `OUTSIDE_DATE_EXTENSION` as its own Work3 proposition; outside-date row links by stable identity (Q02 link-only elsewhere). | Matches current open-world extraction; Stage B would add explicit link fields, not duplicate text in signature. |
| **C — Open-world-only, explicit no Stage B output** | Signatures stay base-date-only; extension lives only in Wave B / review features until a later family owns it. | Preserves today's deferral; risk: outside-date rows read complete while extension unsettled unless serving marks partial. |

**Recommendation for Ben to confirm or override:** Option A or B — not C alone — given Q01: extension must not be silently omitted while parent row disposition tends toward COMPLETE/SUFFICIENT.

### Skechers Marketing Period — Q02 ownership (Phase 3.3)

Q02 agreed: one semantic owner; others link only.

- Marketing Period **definition and mechanics** likely live outside pure termination-rights text; elective extension **trigger** is embedded in §8.1(c) proviso.
- **Open question:** Does Termination own the Marketing Period extension proposition (termination section is governing context), with Conditions/Financing linking — or does another family own Marketing Period and Termination links to it?
- Until ruled: keep both skechers open-world rows unmapped; do not materialise Marketing Period extension into Stage B without recorded owner.

---

## Blockers

1. ~~**Ben disposition unset**~~ — ✅ Phase 2 default disposition recorded (5 holds remain on extension rows).
2. ~~**Skechers Q02 owner unset**~~ — ✅ Termination owns Marketing Period extension; other families link only.
3. **Extension implementation deferred** — four rows need linked `OUTSIDE_DATE_EXTENSION` propositions before holds lift; skywater partial token needs full extension disposition.
4. ~~**Concho negative case**~~ — ✅ `no_extension_complete: true` on concho disposition row.
5. **Family package seal** — ✅ GREEN (`prepareTerminationWork3FamilyPackageSeal`); registration still deferred.
