# Modiv breadth-run disagreement triage (2026-08-02)

**Status:** Triage complete (Sonnet-run, key verdict Fable-verified
against fixture text). Corrects one framing in
`BREADTH-RUNS-2026-08-01.md` and gates the limb-enumeration instrument.
Scope: the entire `modiv-first-live-run` fixture covers Section 3.2
(Capitalization) only — both open items are single-section findings.

## 1. The 3 citation disagreements — verdicts

All three are `NATIVE_CAPITALISATION_QUALIFIER_CANDIDATE` TEMPORAL
qualifiers in §3.2 (`run-receipt.json` compiled candidates 48, 52, 64).

| # | Model cite | Checker cite | Verdict | Class |
|---|---|---|---|---|
| idx 48 | 3.2(f) | 3.2(b) | **Model error** | Qualifier duplicated from (b)'s block into (f)'s during the extraction pass; the (f) copy has no basis in (f)'s text |
| idx 52 | 3.2(f) | 3.2(c) | **Model error** | Same duplication pattern — the model re-surfaces earlier "Capitalization Date" language while processing the long (f) paragraph |
| idx 64 | 3.2(g) | 3.2(f) | **Checker error** (Fable-verified) | "as of the Capitalization Date" appears 4× lowercase in §3.2; three sit in (f) BEFORE the true (g)(iii) occurrence at doc offset ~63512. The checker's derived citation matched an earlier repeat; the model's governs_path ["(iii)"], comma flags and the source text all confirm 3.2(g) |

**Correction of record:** the breadth handoff framed all three as
"model attachment misreads." Idx 64 is a checker defect — the
citation-derivation logic appears to first-match/nearest-match a
repeated phrase instead of resolving within the correct section span.
Same failure class as the documented converter-defect episode ("a
verification that derives its own answer can be wrong in the same
breath"). It will recur on any document where a phrase repeats
verbatim across adjacent paragraphs — i.e. routine capitalization
boilerplate — and must be fixed before the checker is trusted at
corpus scale.

**Known-defect registry candidates (both mechanical, neither needs a
legal ruling):**
1. Producer: "qualifier duplicated into a sibling section's block when
   near-identical measurement-date phrasing repeats" (idx 48, 52).
2. Checker: "derived citation resolves to the first occurrence of a
   repeated phrase rather than the occurrence inside the candidate's
   own section span" (idx 64).

## 2. The 21 limb-enumeration disagreements — verdict

All 21 are `MARKER_WITHOUT_LIMB` in §3.2 (zero `LIMB_WITHOUT_MARKER`).
All 21 were checked against source text (full census, not a sample).

**All 21 are instrument false positives.** Root cause: §3.2's limb
vocabulary (`proposed_tokens`) is roman-numeral only — the top-level
letters (a)–(g) are consumed as the section reference itself (e.g.
`3.2(f)`), never as limb-path elements — so every alpha-letter marker
the scanner finds is structurally incapable of matching, real limb or
not.

| Bucket | Pattern | Count |
|---|---|---|
| A | Top-level paragraph-opening letters (a)–(g), consumed as section references | 7 |
| B | Self-referential "except as set forth in Section 3.2(x) of the Company Disclosure Letter" (letter inside cross-reference prose, same paragraph) | 11 |
| C | Cross-paragraph "Section 3.2(x)" references | 3 |

Secondary defect found during the census: the scanner's marker-family
classifier tags `(c)` and `(d)` as `ROMAN` in every context (they are
roman-alphabet members, 100/500) while `(a)/(b)/(e)/(f)/(g)` tag
`ALPHA_LOWER` — the classifier keys on character membership, not
sequence context. Harmless to today's verdict; wrong on any document
where (c)/(d) genuinely sit in a roman run.

**Dispositions (all instrument refinement; all mechanical):**
1. Exclude markers that open a section_reference-defining paragraph
   from limb comparison (or compare against a two-class vocabulary:
   section-paragraph tokens AND limb tokens).
2. Filter markers inside `Section \d+\.\d+\([a-z]\)` cross-reference
   spans before comparison.
3. Fix the family classifier to use sequence context.
4. Registry entry: "limb-enumeration scan produces 100% false-positive
   MARKER_WITHOUT_LIMB on documents with bare-lettered top-level
   paragraphs" — the instrument's first real workload failed 21/21 and
   the scan is NOT trusted at corpus scale until filters 1–2 land.

## 3. Standing coordinate-frame reminder

Evidence offsets on these compiled claims are section-local; locating
quotes required text search, not stored offsets — the EXECUTION-LEDGER
"OPEN INTEGRATION HAZARD" remains live for any consumer that assumes
document-absolute frames. (The write-set adapter handles the shift
correctly; ad hoc consumers must not skip it.)

## Follow-on work queued

Instrument fixes 1–3 above: a small deterministic slice
(limb-enumeration-scan.js + tests, pinned against the Modiv fixture's
21 markers), spec-able for a cheap-model build after the lexical net
lands. Checker fix (registry candidate 2): same treatment,
citation-constructibility/checker module. Neither blocks anything
currently in flight.
