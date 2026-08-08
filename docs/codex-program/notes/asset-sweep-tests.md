# Asset sweep: tests/ and __fixtures__/ as institutional memory

Status: IN PROGRESS

## 1. Summary

(to be filled at the end)

## 2. Reusable rules

| Rule | Test file / test name | Family / concept |
|---|---|---|
| Sub-clause segmentation must partition a section: leaves never overlap, are monotonic in offset, and account for ≥95% of section chars (only marker tokens and inter-leaf whitespace may be dropped, never substantive prose). | `tests/subclauses.test.js` — `assertLeavesPartition` helper used across all tests | Span accounting / sub-clause segmentation |
| A tiered rep bring-down condition (`(a)(i)`, `(a)(ii)(A-D)`, `(a)(iii)`, `(b)`) must segment into every tier as a distinct leaf with correct `depth`, and inline cross-references inside a tier (e.g. "Section 3.1(b)(i)") must NOT fragment the leaf or spawn spurious markers. | `tests/subclauses.test.js` — `'QXO Section 5.2: tiered COND-B rep bring-down segments into (a.i), (a.ii.A-D), (a.iii), (b)'` | Conditions / sub-clause depth (COND-B family) |
| A fully-claimed section (spans covering the whole text) has zero residual and is never flagged. | `tests/span-residual.test.js` — `'a fully-claimed section has zero residual and is not flagged'` | Span residual / completeness |
| An unclaimed leaf whose share of the section exceeds 25% of section length is flagged `EXTRACTION_INCOMPLETE`, with a drop entry naming the leaf's marker and a text preview. | `tests/span-residual.test.js` — `'an unclaimed leaf whose share of the section exceeds 25% is flagged EXTRACTION_INCOMPLETE'` | Span residual / completeness |
| A single unclaimed leaf over 1,500 chars flags EVEN IF the overall unclaimed ratio is under the 25% threshold — absolute size is an independent trigger, not just proportion. | `tests/span-residual.test.js` — `'a single unclaimed leaf over 1,500 chars flags even if the overall ratio is under 25%'` | Span residual / completeness |
| Leaves under 200 normalized chars are ignored for residual purposes even when fully unclaimed (floor exists to suppress boilerplate/marker noise). | `tests/span-residual.test.js` — `'leaves under 200 normalized chars are ignored even when fully unclaimed'` | Span residual / completeness |
| A benign chapeau/preamble leaf (pure boilerplate before the first lettered item) is excluded from residual accounting even when never explicitly claimed. | `tests/span-residual.test.js` — `'a benign chapeau leaf (pure preamble boilerplate) is excluded from residual'` | Span residual / chapeau handling |
| `span_residual` is only attached to the validation report when `opts.spanResidual === true` — the feature is inert (report-only, opt-in) by default. | `tests/span-residual.test.js` — `'validateProvisions does not attach span_residual without opts.spanResidual === true'` | Span residual / feature gating |
| An emitted item whose quoted text is located verbatim in the section gets `claimedSpans` covering exactly the right leaf marker (e.g. `a.ii.A`). | `tests/span-claims.test.js` — `'an emitted item whose quote is located verbatim gets claimedSpans covering the right leaf'` | Span claims |
| A quote that the model whitespace-rewrapped (closed up a hard line-wrap) still locates via a fuzzy whitespace-tolerant pass — no offset-mapping needed. | `tests/span-claims.test.js` — `'an emitted item quoting whitespace-rewrapped text still locates (no offset-mapping needed)'` | Span claims / whitespace tolerance |
| An item whose quoted text straddles two leaves claims BOTH leaf markers, not just one. | `tests/span-claims.test.js` — `'an item straddling two leaves claims both'` | Span claims |
| `textSpan` (the item's own location) must slice back to the item's own text exactly — proving the offsets are checkable, not decorative. | `tests/span-claims.test.js` — `'a located item records a textSpan that slices back to its own text'` | Span claims / offset integrity |
| A whitespace-rewrapped quote's `textSpan` slices back to the SOURCE's hard-wrapped text, not the model's rewrapped version — offsets always point at source, never at model output. | `tests/span-claims.test.js` — `'a whitespace-rewrapped quote records a textSpan that slices back to the SOURCE wrapping, not the model wrapping'` | Span claims / offset integrity |
| `textSpan` must sit inside the leaf's `claimedSpans` range — the two accounting mechanisms are consistent, never interchangeable. | `tests/span-claims.test.js` — `'the textSpan sits inside the leaf claimedSpans report — the two are consistent, not interchangeable'` | Span claims |
| Enumeration-marker classification: uppercase single letters are always `ALPHA_UPPER`; multi-letter lowercase roman numerals (`ii`,`iii`,`iv`,`ix`) are `ROMAN`; multi-letter lowercase non-roman tokens (`ab`,`the`) are not markers at all; single ambiguous lowercase letters (`i`,`v`,`x`) resolve `ROMAN` by a documented conservative rule (not `ALPHA_LOWER`); single unambiguous lowercase letters (`a`,`b`,`z`) resolve `ALPHA_LOWER`. | `tests/canonical-v2-limb-enumeration-scan.test.js` — `classifyToken` tests | Limb enumeration / marker classification |
| A party grant for a termination right can live entirely inside lettered limb heads far from the section chapeau (chapeau names no party at all) — resolvers must search limb-local context, not just document-wide chapeau proximity, and must not corroborate the wrong party when a widened-text substring check would match both parties named in the same limb. | `tests/canonical-v2-termination-limb-grant-context.test.js` (see header; fixes `TERMINATING_PARTY_REF_NOT_IN_QUOTE`) | Termination rights / party-scope inheritance from limb, not chapeau |
| A qualifier at `position: CHAPEAU` always implies `ALL_ITEMS` scope with a null `governs_path`; a qualifier at `position: ITEM` always implies `THIS_ITEM_ONLY` with `governs_path` set to the model-stated limb (or null if the model gave none — never guessed). | `tests/canonical-v2-qualifier-attachment.test.js` — CHAPEAU/ITEM tests | Qualifier attachment / scope |
| A `TRAILING` qualifier resolves deterministically by marker language: an explicit series marker ("in each case") → `ALL_ITEMS`; an explicit single-clause marker ("in the case of clause (iv)") → `THIS_ITEM_ONLY`; a bare trailing qualifier with neither marker is `AMBIGUOUS` and must carry BOTH `SERIES` and `LAST_ANTECEDENT` candidate readings for human resolution rather than picking one. | `tests/canonical-v2-qualifier-attachment.test.js` — TRAILING marker tests | Qualifier attachment / trailing-clause scope ambiguity |
| The deterministic qualifier-KIND lexicon must answer identically regardless of what the model's own classification said in different runs (a clause the model called ACCURACY in run 1 and THRESHOLD in run 2 must lexicon-classify THRESHOLD both times); a model/lexicon disagreement on the ACCURACY boundary routes to REVIEW rather than silently trusting either side. | `tests/canonical-v2-qualifier-kind-lexicon.test.js` — `'run-1/run-2 disagreement clause classifies THRESHOLD both times'` | Qualifier kind classification |
| An "except for X that are not material" clause stays ONE bound ACCURACY unit — a THRESHOLD marker ("material to") sitting inside a bound "except for" exception clause must never surface as a second, free-standing qualifier-kind family (no spurious SPLIT). | `tests/canonical-v2-qualifier-kind-lexicon.test.js` — exception-connective binding tests | Qualifier kind / exception-clause binding |
| Open-world (ungoverned) evidence rows and governed claim rows from the SAME extraction run must both land in the accepted write set but can never be confused: only open-world rows may carry `OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER`; a claim row is structurally unable to carry it; and a claim row TAMPERED to carry the marker is caught and quarantined by the real validator, not silently accepted. | `tests/canonical-v2-open-world-write-boundary.test.js` (DECISIONS.md decision 2) | Open-world vs governed claim / write-boundary integrity |
| At the SERVING boundary, open-world rows are honoured by their on-row marker alone (no other context needed), render into a structurally distinct "ungoverned evidence" card, and the serving layer REFUSES (does not silently render) a row of the wrong kind in either direction (open-world row through the governed-claim path, or vice versa). | `tests/canonical-v2-open-world-serving-boundary.test.js` (DECISIONS.md decision 2) | Open-world vs governed claim / serving-boundary integrity |
| A quote whose governing negation ("would not be reasonably expected to...") has been trimmed off its front must be refused at THREE independent layers — the ingestion gate (`lib/verification.js` / `sanitizeFeatureQuotes`), the resolver (`candidate-resolution.js`), and a preview bridge — each covered by its own hostile test, not just one shared check. | `tests/negation-boundary-guard.test.js`, `tests/canonical-v2-negation-boundary-resolver.test.js`, `tests/canonical-v2-representations-dark-bridge.test.js` | Negation boundary / meaning-inverting quote trimming |
| A quote that legitimately starts at its own negation ("would not...") is NOT flagged — `hasUnclosedNegationBeforeSpan` only ever looks strictly BEFORE the quote's own start, never inside it; a quote containing "not" well inside its own text (not trimmed off the front) must still pass. | `tests/negation-boundary-guard.test.js` — real-text TopBuild tests | Negation boundary |
| An umbrella reps section (one numbered section, e.g. "3.01", holding ALL company reps as titled lettered sub-clauses) must split into a preamble provision plus one child provision per lettered rep, each getting its own `sectionNumber` (e.g. `3.01(a)`); nested roman numerals inside a lettered rep (e.g. `(c)(i)/(ii)`) must NOT themselves become sub-clauses. | `tests/umbrella-reps.test.js`, `tests/umbrella-rep-split.test.js` | Umbrella reps / section-to-provision expansion |
| Titled sub-clause extraction is gap-tolerant in one direction only: a missing letter (e.g. no `(i)`) does not truncate the run — extraction continues past the gap — but a stray out-of-sequence jump (e.g. a `(z)` appearing mid-list from unrelated numbered content) is rejected and excluded. | `tests/umbrella-reps.test.js` — `'gap-tolerant sequence: a missing letter does not truncate the tail, a stray jump is rejected'` | Umbrella reps / sequence detection |
| In a "merger of equals" conduct-of-business section carrying BOTH parties' covenants under one heading (e.g. "(a) Conduct of Business by Starwood ... (b) Conduct of Business by Marriott ..."), the acquirer's sub-clause and everything nested under/after it must re-type from the target default (IOC-T) to IOC-B; the flip point is POSITIONAL (document order), never a lexicographic letter comparison, because the first party's own roman-numeral sub-items are emitted as top-level letters (`i`, `ii`, ...) that would wrongly compare as "after" the second party's letter `b`. | `tests/ioc-party-flip.test.js` — `detectIocPartyFlipLetter` tests | IOC / party-scope re-typing (mirrored bilateral covenants) |
| Splitting an IOC preamble's affirmative-obligation limb must stop at the semicolon before an interpretive proviso ("; provided that...") — the proviso must survive intact in the residual/shared-carve-outs bucket, not get swallowed mid-word into the limb or spliced apart. | `tests/ioc-preamble-split.test.js` | IOC / preamble-proviso boundary |
| A consent parenthetical's boilerplate ("which consent shall not be unreasonably withheld...") must never be lifted out as its own spurious "Other Affirmative Obligations" provision. | `tests/ioc-preamble-split.test.js` — `'no garbage Other-Affirmative from the consent parenthetical'` | IOC / preamble parsing |
| A termination sub-clause that bundles TWO distinct termination rights under one lettered limb via roman numerals (e.g. Metsera §8.01(b): (i) outside-date, (ii) legal-restraint) must split into separate provisions per roman limb — otherwise only one canonical code can attach and the review page falsely shows the second right as "Not present"; each split part must remain an exact verbatim substring of the source. | `tests/termr-legal-restraint-split.test.js` (documents a real defect: legal-restraint termination right showed "Not present" because it shared a limb with the outside-date right) | Termination rights / bundled-limb splitting |
| A joint-obligor string naming parties from BOTH sides of the deal at once (e.g. "Parent, Company Merger Sub, Parent OpCo, the Company and the Partnership each") must resolve to a distinct `JOINT_MULTI_PARTY_CAPACITY` marker, not silently pick the first-matching side's capacity and discard that the obligation binds the other side too. Grouping is by SIDE (TARGET/SELLER = sell-side vs BUYER/BUYER_AFFILIATE = buy-side), not by raw capacity label — a same-side multi-capacity string ("Each of Parent and Merger Sub") must still resolve the single ordinary capacity, not falsely flag as joint. | `tests/canonical-v2-party-capacity-lexicon.test.js` (documents a real defect where `resolvePartyCapacity` scanned the whole string and returned the first matching side, discarding that the obligation bound both sides) | Party capacity / joint-obligor scope |
| A knowledge qualifier can be scoped to the ENTIRE rep (qualifier opens the sentence, everything after it is knowledge-qualified) or to only PART of a multi-sentence rep (only one clause/sentence is knowledge-qualified) — the LLM must classify per-rep `knowledgeScopeType` (ENTIRE_REP / PARTIAL) as a distinct clause-scoped field, because the pre-existing article-wide knowledge boolean could only ever land on the shared preamble row, never on an individual rep. | `tests/knowledge-scope-type.test.js` (documents a real gap: extraction never emitted knowledgeScopeType so the UI's per-rep display.scope field was always empty) | Reps / knowledge-qualifier scope attachment |
| A provision family's `sectionRoot` drops sub-clause parenthetical suffixes but keeps the numeric path (`5.3(b)(ii)` → `5.3`); a bare Article-level or empty section number has no numeric root (`Article V` → null, `''` → null). Sibling provisions are grouped into one family by sharing a `sectionRoot`, in agreement document order, but never across different provision `type`s even when the section number matches. | `tests/provision-family.test.js` — `sectionRoot`, `buildProvisionFamily` tests | Provision family / section-root grouping, type-scoped |
| A contained (disabled) broad-corpus route returns a deterministic 503 with `ROUTE_CONTAINED` and `Cache-Control: private, no-store` (no `Retry-After`) on its one supported HTTP method, and 405 with an `Allow` header listing only the supported method(s) on every other verb — never a silent pass-through. | `tests/broad-corpus-containment.test.js` | Broad-corpus containment / route contract |

## 3. Fixture catalogue

Two fixture roots: `tests/fixtures/` (144 files, ~2.9 MB text-only, ~16.6 MB
including the raw `.htm` filings) and `__fixtures__/` (33 files, ~710 KB).
`tests/fixtures/canonical-v2/` is the dominant subtree — one directory per
real deal's "first/second/third live run" plus one per canonical-v2 family
pilot.

### Real filed merger agreements (raw SEC HTML, pinned by hash)

| Path | Size | Deal | Shape | Replayable? |
|---|---|---|---|---|
| `tests/fixtures/canonical-v2/mae-definition-family/modiv-raw-fetched.htm` | 879 KB | Modiv | Raw SEC EX-2.1 HTML, hash-pinned (also reused by termination-limb-grant-context and negation-boundary tests) | Yes — deterministic HTML→canonical-text pipeline, no model call |
| `tests/fixtures/canonical-v2/mae-definition-family/topbuild-raw-fetched.htm` | 733 KB | TopBuild | Raw SEC HTML, hash-pinned | Yes, same pipeline |
| `tests/fixtures/canonical-v2/skechers-first-live-run/skechers-raw-fetched.htm` | 605 KB | Skechers | Raw SEC HTML | Yes |
| `tests/fixtures/canonical-v2/skywater-first-live-run/skywater-raw-fetched.htm` | 590 KB | SkyWater | Raw SEC HTML | Yes |
| `tests/fixtures/canonical-v2/metsera-first-live-run/metsera-raw-fetched.htm` | 584 KB | Metsera | Raw SEC HTML | Yes |
| `tests/fixtures/canonical-v2/concho-first-live-run/concho-raw-fetched.htm` | 552 KB | Concho | Raw SEC HTML | Yes |
| `tests/fixtures/canonical-v2/redhat-first-live-run/redhat-raw-fetched.htm` | 465 KB | Red Hat | Raw SEC HTML | Yes |
| `__fixtures__/demo-deal/landos-abbvie-agreement.txt` | 394 KB | Landos Biopharma / AbbVie | Stripped plain text of a real 8-K EX-2.1 (SEC accession 0001193125-24-075991), byte-for-byte what the live ingest pipeline produces | Yes — used by `scripts/demo-dryrun.js` for the full parse/classify/extract/validate/store smoke test, no model call for ingestion itself |
| `__fixtures__/demo-deal/landos-abbvie-agreement.broken.txt` | 25 KB | Same deal, truncated | First 25,000 bytes only — recitals + partial Article I, deliberately missing REP-T/REP-B/DEF/COND articles | Yes — negative-path fixture; proves `ingest-qa.js` fails every count gate and teardown still runs |

### Recorded model responses (replayable extraction runs — zero model calls)

Each "first/second/third-live-run" directory is a full recorded run: raw
model response(s), the run receipt, resolution, adapter write-set, and
validation report, all pinned so the real pipeline (`runNativeExtraction`,
`resolveCandidates`, `buildNativeWriteSet`) can be replayed deterministically.

| Deal / run | Directory | Key files (all replayable) |
|---|---|---|
| Modiv, first live run | `tests/fixtures/canonical-v2/modiv-first-live-run/` | `native-producer-recorded-response.json` (31 KB, raw model text), `run-receipt.json` (243 KB), `resolution.json` (180 KB), `adapter-result.json` (439 KB), `validation.json`, `review-queue.json`, `section-location-scan.json`, `call-telemetry.json`, `intake-pin.json` |
| Skechers, first live run | `tests/fixtures/canonical-v2/skechers-first-live-run/` | Same shape: `native-producer-recorded-response.json` (20 KB), `run-receipt.json` (152 KB), `resolution.json` (119 KB), `adapter-result.json` (391 KB), `article-iii-canonical-excerpt.txt` (78 KB) |
| QXO/TopBuild §3.1(b), F28 live run (run 1) | `tests/fixtures/canonical-v2/f28-live-run/qxo-topbuild-3-1-b-live-response.json` | 21 KB raw model response |
| QXO/TopBuild §3.1(b), F28 second live run | `tests/fixtures/canonical-v2/f28-second-live-run/qxo-topbuild-3-1-b-live-response.json` | 13 KB raw model response — used directly by `tests/canonical-v2-limb-components.test.js` and `tests/canonical-v2-limb-enumeration-scan.test.js` |
| QXO/TopBuild §3.1(b), F28 third live run | `tests/fixtures/canonical-v2/f28-third-live-run/` | Full run: `qxo-topbuild-3-1-b-live-response.json` (17 KB), `run-receipt.json` (146 KB), `resolution.json` (170 KB), `adapter-result.json` (431 KB), `validation.json`, `limb-enumeration-scan.json`, `coverage-proxies.json`, `run-comparator-vs-run2.json`, `call-telemetry.json` |
| Modiv termination fee, review-parity case | `tests/fixtures/review-parity/cases/termination-fees/dfaa71fa-modiv.resolution.json` | 36 KB, full `resolved`/`review_queue`/`open_world`/`residuals`/`limb_component_trees`/`ioc_restriction_components`/`conditional_termination_fee_values` shape |

### V1→V2 comparator snapshots (real per-deal card sets, pre-canonical-v2)

| Path | Size | Deal | Shape |
|---|---|---|---|
| `tests/fixtures/canonical-v2/v1v2-comparator/modiv-v1-provision-snapshot.json` | 164 KB | Modiv | `{schema_version, deal_identity_bridge, deal_max_extraction_version, cards, deal, snapshot_id}` |
| `tests/fixtures/canonical-v2/v1v2-comparator/topbuild-v1-provision-snapshot.json` | 146 KB | TopBuild | Same shape |
| `tests/fixtures/canonical-v2/v1v2-comparator/skechers-v1-provision-snapshot.json` | 112 KB | Skechers | Same shape |

### Corpus card dumps (per-family, cross-deal — real extracted cards)

All share `{schema, family, source_spec, retrieval_date, source_table, resolved_prefix_dispositions, missing_prefixes, cards}`.

| Path | Size | Family | Card count |
|---|---|---|---|
| `tests/fixtures/canonical-v2/guaranty-fixtures/corpus-cards.json` | 93 KB | Guaranty | 31 |
| `tests/fixtures/canonical-v2/dno-fixtures/corpus-cards.json` | 213 KB | D&O indemnification | 27 |
| `tests/fixtures/canonical-v2/financing-covenants-fixtures/corpus-cards.json` | 95 KB | Financing covenants | 18 |
| `tests/fixtures/canonical-v2/employee-matters-fixtures/corpus-cards.json` | 137 KB | Employee matters | 16 |
| `tests/fixtures/canonical-v2/m3-v31-fixtures/corpus-cards.json` | 6 KB | M3 v31 pilot | 8 |
| `tests/fixtures/canonical-v2/appraisal-fixtures/corpus-cards.json`, `dividends-fixtures/corpus-cards.json`, `tax-matters-fixtures/corpus-cards.json` | <1 KB each | Appraisal / dividends / tax matters | 1 each — thin stub fixtures, not real corpora |

### Small, hand-pinned real-clause fixtures (used across many test files)

| Path | Size | Notes |
|---|---|---|
| `tests/fixtures/qxo-section-3-1-b.txt` | 4.7 KB | Real QXO capital-structure section, reused by limb-enumeration-scan and open-world-boundary tests |
| `tests/fixtures/qxo-section-5-2.js` | 3.2 KB | Exports `QXO_5_2_TEXT` — the tiered COND-B rep bring-down text also pinned inline in `tests/subclauses.test.js` |
| `tests/fixtures/canonical-v2/termination-rights-family/modiv-section-7.1.txt` | 9.7 KB | Modiv's real termination section |
| `tests/fixtures/canonical-v2/closing-conditions-fixtures/*.txt` (8 files) | ~150-300 bytes each | Small real closing-condition clause snippets, keyed by content hash, with a `party-capacity-context.json` sidecar and README |
| `tests/fixtures/canonical-v2/mae-definition-family/*-company/parent-mae-definition.txt` (4 deals) | 5-6 KB each | Real MAE definition text per deal (Modiv, TopBuild, Skechers) |

### Non-replayable / staging-only fixtures

The `qxo-no-shop-*-staging-attestation.json` files (18 files, 2.4 KB–504 KB,
in `tests/fixtures/canonical-v2/`) are staging-environment attestation
records (`authority`, `staging_execution`, `canonical_payload_digest`, etc.)
— they prove a specific staging run happened, and are consumed by tests that
mostly `t.skip` unless an env var / linked staging project is present (see
§5). Not model-call replays in the same sense as the recorded-response
fixtures above.



## 4. Documented past defects

- 

## 5. Skipped / pending tests

- 
