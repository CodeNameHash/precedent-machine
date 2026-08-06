# Adversarial blast-radius audit, 2026-08-05

Commissioned because the owner asked, of a night's work aimed at one family on
one deal, whether it was "creating a broader issue for other families or the
provenance of the data or for other agreement extractions".

Scope: commits `7a67e1a8`, `2022182b`, `6d8d453e`, plus the working tree.
Method: the pre-change sectionizer and provider were extracted from the parent
commit and run side by side with HEAD over every committed full agreement
(Modiv, TopBuild, Skechers, Landos, foundation fixture) and every recorded
model response under `tests/fixtures/` and `evidence/`.

The answer to the owner's question is yes, there is a broader issue, and it is
not the one anybody was looking for.

## 1. Sections vanish from agreements, and fabricated citations have already
   published. PROVED. Highest severity.

`INLINE_DECIMAL_HEADING_RE` in `deterministic-sectionizer.js` caps a section
heading's title at 78 characters. A heading whose title runs longer never
matches, so it never becomes a candidate. If that leaves fewer than two
candidates in an article, the inline pass does not fire at all and the article
chapeau keeps the entire article, minting phantom children in place of the
real sections.

On TopBuild this removes Sections 3.1 and 3.2, the whole representations
article, whose titles run to roughly 85 characters. `III-INTRO` is left
spanning about 131 KB. Sections 4.5 and 5.2 disappear mid-document the same
way, absorbed silently into 4.4 and 5.1.

This is not theoretical. Verified independently by the coordinator:
`tests/fixtures/canonical-v2/f28-third-live-run/resolution.json` contains three
RESOLVED claims whose `section_reference` is `III-INTRO(b)`, a node that
corresponds to nothing in the agreement. The committed pilot manifest pins a
TopBuild work item to the same phantom. A citation of this kind is worse than
a missing one for the product's actual reader: it is a reference a lawyer
would go looking for and fail to find.

Downstream, nothing stops it. A quote taken from Section 4.5 derives the
citation "4.4", which is wrong but entirely plausible, and citation
disagreement does not block resolution: the run records a residual and
continues, and `sourceDerivedCitation` falls back to the section pin.

**Why the tests missed it, which is the part worth internalising.** The
reconciliation that landed today asserts sibling sections tile exactly, no
overlaps and no gaps. That invariant is structurally blind to this failure.
When a heading is never recognised, its text is absorbed by the section
before it, producing neither an overlap nor a gap. The tree looks perfect and
is wrong. The cause is never recorded either: a heading that fails the regex
never becomes a candidate, so the rejection log is silent about it.

**Fairness to today's work.** This predates these commits; the old tree lacks
the same five sections. What the commits added was the claim that boundary
defects were "fixed at source", with tests and a commit message that gave the
tree a clean bill it had not earned on TopBuild. The reconciliation itself
survived every attack: no realistic false-positive run could be constructed,
the clip boundary is provably correct when a run is real, and the
remove-without-rebuild branch never fires on the corpus and fails loudly if it
ever does. Skechers and Modiv are genuinely complete, 112 of 112 on the TOC
cross-check.

Recommendation, now being implemented: raise or drop the 78-character cap, on
the reasoning that the terminal full stop, single-sentence shape and monotonic
article-digit run already carry the false-positive burden; and add the
tripwire the current invariant lacks, so that any line-start `N.M` inside a
matching article span which is neither a node nor a recorded rejection raises
a typed residual. The tripwire matters more than the immediate fix, because it
converts an invisible class of failure into a loud one for every future
agreement.

## 2. A wrong-limb sub-quote resolves confidently. PROVED, and the design
   note's stated mitigation was false.

A byte-verified `limb_amount_quote` naming the other limb's figure resolves
without complaint. The design note disclosed this and pinned it with a test,
which is to its credit, but its stated mitigation, "nothing here publishes
without human review", is contradicted by this branch's own history: resolved
means published. That sentence has been removed from the note rather than
softened.

The true bound is narrower and real. Until the grounds-to-amount mapping
exists, the published claim set is swap-invariant, because both limbs quote
the same sentence, so swapping the figures yields an identical set. Corruption
needs the model to return the same figure twice, or a defining sentence
carrying a dollar figure that is not a fee. Live exposure today is zero.

## 3. Provenance and identity stability. VERIFIED.

By construction and empirically. Content ids canonicalise with sorted keys,
the new field is omitted rather than nulled when unused, `claim_revision_id`'s
payload excludes `allowed_attributes`, and the prompt version bump feeds
nothing identity-bearing. Old and new shaping are byte-identical across every
pre-existing recording: Skechers 35 proposals, Modiv 48, f28/TopBuild 38, and
the Modiv fee recordings for 7.1 and 7.3. The single 8.12 difference is an
`allowed_attributes` list growing from four entries to five, carried on the
claim row and hashed nowhere.

No pre-existing `subject_occurrence_id` or `claim_revision_id` moves. The one
recorded outcome change is the already-disclosed Modiv 7.3(b)(iii) trigger
moving to review. Previously-reviewed decisions cannot silently detach from
their claims.

## 4. Trigger gate and the new nested-quote helper. SOUND.

Triggers have a single resolve path, requiring enum membership, exactly one
table match, and equality with the model's own assertion. Every other exit is
review or open-world. Fail-closed throughout, including the tail handler.
`evidenceForNestedSubQuote` has exactly one caller, is unreachable from other
families, dedupes ambiguous nesting correctly by failing closed, and its
evidence object is discarded after gating, so nothing leaks.

## 5. Fee-side widening. CLEAN on the corpus.

Scanned all four full agreements against the exact new expressions. The only
newly matching phrases anywhere are Modiv's "Company Base Amount" and "Parent
Base Amount", which are the intended terms. "Company Working Capital Amount",
all-capitals terms, "InterCompany" and pluralised "Base Amounts" are all
correctly rejected.

Plausible future drafting such as "Company Expense Amount" would corroborate,
but publishing still requires a model-asserted fee side, a `fee_term_ref`
appearing verbatim in the quote, and a single money literal. No end-to-end
false resolution could be constructed. Noted in passing: `feeSideFromFeeTermRef`
is close to inert for resolution, since `fee_term_ref` must already be a
substring of the quote and the patterns are unanchored, so anything the
fallback accepts would have corroborated directly. It mainly re-types review
reasons.
