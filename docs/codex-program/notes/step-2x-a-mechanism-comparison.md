# Step 2X-A — six-mechanism comparison (written before the service)

Date: 2026-08-08. Implements PLAN.md Step 2X-A's required comparison.
Code-read, not header-read. Converges **two of six** onto
`resolveGoverningStructure` over `segmentSubClauses`; keeps three separate;
treats `buildMarkerTree` as second input / section inventory, not the base.

Decision authority: Fable (`fable-review-step-2x.md` §1 and §6), re-confirmed
after the sixth mechanism was found.

---

## Per mechanism

### 1. `findTerminationLimbGrantContext` (structural half + semantic half)

- **File:** `lib/canonical-v2/native-producer/candidate-resolution.js`
  (`findTerminationLimbChapeau` + `parseTerminationLimbDirection`).
- **Real input:** section byte range + canonical text + `sectionReference`
  ("7.1") + `citationReference` ("7.1(c)(i)") + claimed party + party scope.
- **Real output:** `{ span }` of the limb's own chapeau head, or null.
- **Question:** "does THIS limb's chapeau grant the termination right to THIS
  party?"
- **Two fused halves:** structural locator (paragraph-initial `(c)`, bound at
  first `:`/`;`/newline, fail closed on 0 or >1) and semantic grammar (four
  party-grant patterns compared by resolved capacity).
- **Input where it differs from `segmentSubClauses`:** a leaf limb with an
  internal semicolon — the limb finder returns only the head up to the first
  `;`; the segmenter returns the whole limb to the next marker. A duplicate
  paragraph-initial `(b)` — the limb finder fails closed (`matches.length !==
  1`); the segmenter resolves by outline state.
- **2X-A disposition:** structural half adapts onto the service (adapter
  preserves head-bounding and ambiguous-letter refusal); semantic half stays.

### 2. `findIocChapeau`

- **File:** `candidate-resolution.js`.
- **Real input:** section byte range + canonical text + `beforeAbsoluteStart`
  + covenant side.
- **Real output:** nearest preceding `{ party, span, quote }` matching
  `/(company|parent|…) shall not/` bounded at the next `:`, or null.
- **Question:** "which negative-covenant chapeau binds the restriction at this
  byte, and which party?"
- **Input where it differs from `segmentSubClauses`:** a section with two
  "shall not" lists — IOC returns the nearest preceding chapeau of the
  requested side; the segmenter's colon CHILD-OPEN nests the second `(a)`
  under `(b)` (same-style mis-nest). Also a mid-limb "shall not" at no outline
  position — segmenter cannot see it.
- **2X-A disposition:** **KEEP SEPARATE.** The service is not a superset.

### 3. `qualifier-attachment.js`

- **Real input:** model-reported position + qualifier's own verbatim quote +
  sibling limb paths. **Takes no section text and no span.**
- **Real output:** `scope_reading` (ALL_ITEMS / THIS_ITEM_ONLY / AMBIGUOUS /
  — and under 2X-A1, NAMED_SUBSET).
- **Question:** "what scope does this qualifier's wording imply?"
- **Input where it differs:** TRAILING + "in each case…" → ALL_ITEMS. No other
  mechanism accepts this input shape.
- **2X-A disposition:** **KEEP SEPARATE.**

### 4. `limb-components.js`

- **Real input:** model-emitted `limb_path` arrays + byte-verified evidence +
  provision instance id.
- **Real output:** PATH/ASSERTION identity tree with content-derived ids.
- **Question:** "given paths the model already declared, mint stable
  identities and decide qualifier attachment."
- **Input where it differs from `segmentSubClauses`:** three assertions under
  one bare `["(ii)"]` — components mint three ASSERTION nodes; the segmenter
  cannot represent multiple assertions per leaf. Red Hat 3.02
  `limb_path: ["Corporate power and authority"]` — a descriptive heading the
  segmenter can never produce.
- **2X-A disposition:** **KEEP SEPARATE** (consumer / identity minting, not
  a rival discoverer). Flat families must not mint via derived structure.

### 5. `segmentSubClauses` (`lib/parser-v2/subclauses.js`)

- **Real input:** raw section text (UTF-16 string indices).
- **Real output:** leaf spans partitioning the text with dotted outline paths
  and explicit chapeau leaves (`marker: null`).
- **Question:** "what is the outline structure of this text?"
- **Input where it differs from all others:** QXO §5.2(a)(ii) inline
  comma-separated `(A)`–`(D)` — only this mechanism recovers them.
- **2X-A disposition:** **BASE of the service.** Convert to UTF-8 at the
  boundary via `canonical-bytes.js`; do not port this module to bytes.

### 6. `deterministic-sectionizer.js` `buildMarkerTree`

- **Real input:** whole-document (or section) text; markers via
  line-start-anchored `MARKER_PATTERN` (label width up to 9).
- **Real output:** nested marker tree with UTF-8 byte offsets into admitted
  text; also the live section inventory (`sectionizeAdmittedSource`).
- **Question:** "where do Section X.Y and its line-anchored sub-markers live
  in document bytes?"
- **Input where it differs from `segmentSubClauses`:** inline enumerations
  (QXO `(A)`–`(D)`) — sectionizer misses them; long labels like `(viii)` —
  sectionizer finds them, segmenter (`{1,3}`) cannot. Parentage on a
  restarting `(a)` — **both mis-nest the same way**, so agreement does not
  confirm parentage.
- **2X-A disposition:** **SECOND INPUT** for corroboration tiers and the
  all-sections inventory. Not the service base.

---

## Corroboration tiers (marker existence only)

| Tier | Meaning |
|---|---|
| `CORROBORATED` | Both detectors find a marker at the same start |
| `LINE_ANCHORED_ONLY` | Sectionizer only — union in (width/recall gap) |
| `PERMISSIVE_ONLY` | Segmenter only — risky; annotate with tier; no identity/absence without corroboration |

Same-style parent-child refusal is mandatory on top of tiers.

## Convergence summary

| Mechanism | Role after 2X-A |
|---|---|
| Termination structural half | Adapter onto service |
| 2X-I limb pre-pass | Consumer (deferred from this slice; not live re-extraction) |
| `findIocChapeau` | Keep separate |
| `qualifier-attachment.js` | Keep separate |
| `limb-components.js` | Keep separate |
| `segmentSubClauses` | Service base |
| `buildMarkerTree` | Second input + section inventory |
