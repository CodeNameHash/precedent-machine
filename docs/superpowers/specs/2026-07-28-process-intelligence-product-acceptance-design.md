# Process Intelligence Product Acceptance Design

**Date:** 28 July 2026
**Status:** Approved design consolidation under `specification_review`
**Product:** Precedent Machine Process Intelligence

## Purpose

This document defines what a user must be able to do in Process Intelligence.

It covers:

- natural-language questions;
- guided Browse navigation;
- filters;
- phrase results;
- source reading;
- related passages;
- exports;
- saved searches;
- failure messages; and
- product acceptance tests.

It does not define implementation tasks. It does not permit code, data work,
deal-file reading or extraction.

## Governing documents

This document narrows the product requirements in:

- `docs/superpowers/specs/2026-07-27-process-intelligence-design.md`, SHA-256
  `1acbcafd211c1f90492164db655d1bda02faa0470ca29f3bd5f75bc8cf4cca15`;
  and
- `docs/superpowers/specs/2026-07-27-shared-deal-facts-and-entity-authority-design.md`,
  SHA-256
  `7dd9552c2634e4f64f0fc662f40002879fd6fca595a2394d8e3eb27baf35dbbe`.

Those documents control legal meaning, source evidence, identity, certification,
security and approved-data-version rules. This document cannot weaken them.

If this document conflicts with either governing document, the stricter rule
applies and the conflict blocks work until review resolves it.

## Terms

### Approved PM data version

An approved PM data version is a fixed set of checked data, rules, fields and
query capabilities that PM can show to users.

PM first records a proposed data version in a `CandidateReleaseManifest`. This
is a formal list of the proposed data, rules and checks. A separate activation
control must select that exact list before users can see it.

This document uses “approved PM data version” in explanatory text. It uses the
formal system name when exact system identity is necessary.

The active approved PM data version is the version that PM uses now.

This is not a software deployment. A deployment puts software on a server. An
approved PM data version controls which checked data and rules that software can
use.

### Manifest

A manifest is a fixed formal list. It records the exact items that belong to one
version.

### Digest

A digest is a computer-calculated fingerprint of exact file content. If the
content changes, the digest changes.

### Certification

Certification is recorded proof that one field, legal question or result type
passed its required checks.

### Product field catalogue

The product field catalogue is the exact list of fields that one approved PM
data version permits the product to show, filter, sort, group or export.

The formal system name in this document is `ProductFieldCatalogueManifest`.

### Field registry and catalogue generator

The field registry is PM’s internal list of fields and their meanings.

The catalogue generator is checked software that converts one exact field
registry into one product field catalogue.

### Navigation catalogue

The navigation catalogue is the exact approved list of Domains, Topics and
Patterns. It also records the checked legal question that each Pattern selects.

### Canonical

Canonical means that PM selected the value through its checked authority. The
browser must use that value. It must not calculate or guess a different value.

### Result

A result is one checked answer row. For the phrasebook, one result contains one
verbatim passage and its source details.

### Verbatim passage

A verbatim passage is the exact filing text. It is not a summary written by a
language model.

### Predicate

A predicate is one approved legal question that PM can answer. For example:
“The target granted exclusivity.”

## Product rule

Ask and Browse are two ways to create the same checked query.

They must return the same result rows when the legal question, filters, approved
PM data version and ordering are the same.

The browser must not:

- create facts;
- guess a legal meaning;
- join separate answers;
- replace an unsupported question with a similar question;
- treat no results as proof that no market example exists; or
- use a narrative language model to hide an unsupported question.

## Product field authority

Each approved PM data version that contains Process Intelligence must include
one `ProductFieldCatalogueManifest`.

The manifest fixes:

- approved PM data version identity;
- shared-deal-fact specification identity;
- Process specification identity;
- source PM field-registry identity and digest;
- catalogue generator identity and digest;
- each admitted field;
- each field version;
- user label;
- stable field group;
- data type;
- supported operators;
- permitted value vocabulary and its version, when the field uses fixed terms;
- supported domains;
- supported result types;
- same-deal, same-event, same-bidder-track or same-component scope;
- filter, sort, group, display and export capabilities;
- source and derivation requirements;
- completeness state;
- certification identity;
- unavailable reason;
- full catalogue digest; and
- difference from the prior admitted catalogue.

The user interface reads this manifest. It must not read an unpinned live field
registry.

## Flexible field growth

The user interface has stable field groups. PM supplies the fields inside each
group.

The initial groups are:

1. Deal and date.
2. Parties and bidder tracks.
3. Transaction structure.
4. Consideration and value.
5. Sector.
6. Law firms, lawyers and financial advisers.
7. Process event, phase, channel and outcome.
8. Agreement terms.
9. CVR terms, when that domain is added.
10. Source, evidence and certification.

A new PM field can enter an existing group without new user-interface code when
the product already supports its data type, control type and result display.

A field that needs a new control type or display requires product review and
user-interface work.

Existence in a database is not sufficient. A new field becomes an active
product control only when an approved PM data version fixes its:

- meaning;
- label;
- type;
- operators;
- scope;
- evidence;
- certification; and
- permitted product actions.

An unapproved field is not an active filter. It cannot produce a false zero.

A new field group requires product review because it changes navigation.

A new permitted value inside an existing field also creates a catalogue
difference. It cannot appear as an active choice until an approved PM data
version admits its meaning and label.

## Current PM field baseline

The current baseline is PM `origin/main` commit
`c5737a59b01654d81380ff48771576d1f00e289f`.

The observed source files are:

- `lib/deals-index-columns.js`, SHA-256
  `3457984b065a277bc3aa18d34da62a7436325a7fe7ec0672ab0cbccd9473c1d3`;
- `lib/query/field-meta.js`, SHA-256
  `4b74cfa416a2a811b929d03851e7b9cdc91654dc754b6c74756be8f47988bbb5`;
  and
- `lib/query/serving-registry-v1.json`, SHA-256
  `83916dc4ad0ee02e6db7dfa8515f70dd0c39364feee1740c38c44dc684e3deb5`.

These files are evidence of the present product. They are not the future
canonical field authority.

### Current Deals-table fields

The product must make all 15 current Deals-table fields available through
`More filters` or an equivalent searchable control.

| Current key | Current PM label | Required Process capability |
|---|---|---|
| `deal` | Deal | Search and exact deal selection |
| `signed` | Signed | Exact date, year and date range |
| `buyer` | Buyer | Canonical entity selection |
| `value` | Value | Governed value range and value basis |
| `type` | Consideration | Canonical consideration component |
| `structure` | Structure | Canonical transaction structure |
| `buyer_type` | Buyer type | Canonical buyer classification when applicable |
| `sector` | Sector | Canonical sector selection |
| `law_firm` | Law firm (either party) | Role-aware professional assignment |
| `lawyer` | Lawyer (either party) | Role-aware professional assignment |
| `law_firm_buyer` | Law firm (buyer) | Buyer-side professional assignment |
| `law_firm_target` | Law firm (target) | Target-side professional assignment |
| `lawyers_buyer` | Lawyers (buyer) | Buyer-side lawyer assignment |
| `lawyers_target` | Lawyers (target) | Target-side lawyer assignment |
| `merger_form` | Merger form | Canonical merger-form selection |

“Available” does not mean that every field is valid for every question. It
means that the field catalogue can expose the field when the selected domain,
result type and approved PM data version support it.

The current PM page treats some lawyer columns as display-only. Process
Intelligence must use the new role-aware professional-assignment contract when
it offers those fields as filters. It must not copy the old text-match
behaviour.

### Current Agreement query fields

The observed PM query layer produces 331 distinct user-facing Agreement field
keys across its current provision types.

This count is an audit baseline. It is not a fixed product limit.

The user interface must not display all 331 fields at the same time. It shows
only fields that are valid for the current domain, topic, pattern and result
type.

Before the catalogue becomes fixed for formal review, the catalogue generator
must:

- enumerate the exact eligible source field set;
- resolve aliases;
- reject duplicate active meanings;
- identify fields with no supported result type;
- identify fields with no certified data;
- produce an exact inclusion and exclusion report; and
- prove that no eligible user-facing field disappeared silently.

## Transaction structures

The product must not assume that every deal has one target and one buyer.

The field catalogue and filter behaviour must support:

- conventional acquisitions;
- mergers of equals;
- reverse mergers;
- reverse Morris Trust transactions;
- share purchases;
- asset purchases;
- schemes of arrangement;
- tender-offer structures;
- sponsor and consortium structures; and
- other approved structures.

For a merger of equals, the product uses combination parties and the checked
control outcome. It does not invent a buyer.

For a share purchase, one component binds:

- buyer;
- acquired entity;
- selling shareholder;
- class or interest;
- amount or percentage;
- ownership path;
- consideration;
- time; and
- evidence.

The product cannot combine values from separate components to create a false
transaction.

`Buyer type` can show “Not applicable” only when checked source evidence proves
that no buyer role applies.

## Shared deal facts

Process Intelligence reads shared deal facts from PM’s shared fact and entity
authority. It must not keep a second copy.

Shared facts include:

- deal identity;
- parties and transaction roles;
- transaction structure;
- consideration components;
- equity value and value basis;
- sector;
- law firms;
- lawyers;
- financial advisers; and
- the source for each fact.

The same shared fact value must appear in:

- filters;
- passage metadata;
- table view;
- export; and
- source actions.

If PM takes equity value from a press release, the product must offer the exact
press-release source action. It must not cite the proxy as the source of that
value.

If PM takes a professional name from a proxy, agreement or press release, the
product must preserve the represented party, professional role and exact
source.

If approved sources conflict, the product shows the checked conflict state. It
does not select a value in the browser.

## Entry mode 1: Ask

Ask accepts a natural-language legal question.

The first version uses checked mappings. It does not use narrative language
model output.

Example questions include:

- “How do targets refuse exclusivity?”
- “Show examples where exclusivity was granted after diligence.”
- “How do proxies describe an exclusivity extension?”
- “Show exclusivity grants in biopharma deals.”

For a supported question, Ask shows:

- the legal question that PM understood;
- the applied filters;
- the coverage statement;
- the result count; and
- the verbatim results.

For an ambiguous question, Ask requests a legal choice.

For an unsupported question, Ask gives a clear refusal and shows the nearest
supported concepts. It does not run a different query.

## Entry mode 2: Browse

Browse uses a dynamic three-level hierarchy:

`Domain -> Topic -> Pattern`

The selected item controls the next list.

Example:

`Process -> Exclusivity -> Requested, declined, granted, extended or ended`

If the user selects a different topic, the Pattern list changes. The interface
must not keep “Exclusivity patterns” as a fixed heading.

The hierarchy stops after Pattern. Further distinctions are filters.

The initial top-level domains are:

- Agreement; and
- Process.

CVR becomes another domain only after its own approved question set,
certification and approved PM data version exist.

Browse labels come from the same approved registry as Ask. A label that does
not create a real checked query is prohibited.

The browser does not contain a fixed Topic or Pattern list. It reads the
approved navigation catalogue for the active approved PM data version.

A new Pattern inside an existing Topic can appear without new user-interface
code after approval. A new hierarchy level requires product review.

An `All` view can list available domains. It does not combine Agreement and
Process answers into one result set.

## Filter interaction

The interface shows a small set of relevant filters first.

`More filters` opens a searchable field list. The list is grouped by the stable
field groups in this document.

The search must find every field that is valid for the current query.

The product must not show a large row of pills. It shows the active filters as
one short sentence.

Example:

> Exclusivity granted, biopharma deals, signed after 2020, target counsel is
> Wachtell.

The user can edit or clear any part of that sentence.

The product can use compact labels inside the filter editor when the label
helps selection. It must not use a field of decorative pills as the main
information structure.

### Filter operators

The interface uses practitioner language for filter operators.

Examples are:

- “is” and “is not” for one value;
- “before”, “after” and “between” for dates;
- “less than”, “more than” and “between” for numbers;
- “includes any” for at least one repeatable value;
- “includes all” for every selected repeatable value, with at least one real
  value; and
- “includes none” for no selected repeatable value.

The interface must not show raw database operators.

For a field with fixed permitted values, the options come from the active
approved PM data version. The product shows values that occur in the current
covered set after it applies the other active filters. A selected value stays
visible while the user edits its own filter.

An approved value that does not occur in the covered set is not an active
choice. If the user searches for it, the interface can explain that the value
has no admitted result in the covered set.

### Field relevance

A field is active only if the catalogue confirms that it works for the current:

- approved PM data version;
- domain;
- topic;
- pattern;
- result type; and
- output scope.

If the user searches for a known field that is not valid, the interface can
show the field name and a short reason. It must not show an active control.

Example:

> Buyer type is not available for this merger-of-equals result.

### Repeatable facts

Filters for parties, advisers, bidder tracks and share-purchase interests must
use one checked component.

For example, a query for “target counsel Wachtell” must bind Wachtell to the
target-side assignment. It cannot match Wachtell in any free-text adviser
field.

Filters must not create a cross-product between independent lists.

## Results

The default result view is answer-first.

It contains:

- the understood question;
- one short active-filter sentence;
- coverage and certification state;
- 8 to 12 diversified verbatim passages;
- exact source details;
- selected-result actions; and
- a persistent source reader on desktop.

Mobile uses a full-screen source reader.

The default result is the actual market language. A generated narrative answer
is out of scope.

### Passage card

Each passage card shows:

- the verbatim passage;
- target and buyer or applicable combination parties;
- equity value and value basis when admitted;
- counsel and advisers when admitted;
- filing type;
- filing date;
- the legal pattern;
- relevant event and bidder-track details;
- exact citation action;
- source-reading action; and
- coverage or certification warning when required.

The card must use practitioner language. It must not show internal IDs, hashes
or pipeline terms.

### Ordering

Direct evidence appears before contextual or retold evidence.

Results then follow the approved source order. Diversification prevents one
deal or bidder track from filling the first result page.

The browser does not create its own ranking.

### Table view

The user can switch to a table for dense research.

The table uses the same result rows and field catalogue as the passage view.
It is not a separate query.

## Source reader

Opening a result shows the actual filing text.

The matched text remains highlighted.

`Show more above` and `Show more below` are repeat-clickable. Each click adds
one checked paragraph unit. The user can click again to get more context.

The expansion must:

- keep the selected evidence visible;
- keep the exact source identity;
- keep paragraph order;
- stop at the approved context limit;
- reject an invalid cursor; and
- never replace the selected passage.

## Related passages

The source reader shows related Process discussions from the same proxy.

Examples include:

- an earlier exclusivity request;
- a later response;
- an extension;
- the end of exclusivity;
- a related confidentiality or diligence discussion; and
- a later retelling of the same event.

Each related item shows:

- a checked relationship label;
- a verbatim preview; and
- an action to open the actual drafting.

A short classification can help navigation. It cannot replace the actual text.

The browser must not search the document graph at runtime to invent related
items.

## Result actions

The first product actions are:

- open the source;
- copy the passage with its citation;
- copy a share link;
- show related passages in the same proxy;
- export selected results; and
- rerun a saved search against the active approved PM data version after an
  explicit warning.

An old citation keeps its original approved PM data version and field meaning.
If that version is no longer active, an old share link returns
`RELEASE_NOT_ACTIVE`. The product must not silently redirect it or show changed
results under the old citation.

An explicit rerun creates a new query. The new result can differ from the old
result.

## Saved searches

A user can save a checked Ask or Browse query.

The saved search records:

- the checked legal question;
- filters;
- requested fields;
- ordering;
- catalogue digest;
- approved PM data version;
- coverage identity; and
- user label.

If the same approved PM data version remains active, the saved search runs the
same checked query.

If a different version is active, the product does not change the saved search.
It explains that the saved version is not active and offers a separate rerun.

The rerun uses current approved fields and creates a new saved-search identity.
It does not overwrite the old search.

## Export

Export uses the same result rows and catalogue as the screen.

The first export must support selected results and must include:

- verbatim passage;
- citation;
- deal;
- relevant parties;
- filing type and date;
- pattern;
- active filters;
- approved PM data version; and
- coverage state.

An export must not add a field that was not part of the checked query result.

## Corrections

An authorised user can propose a correction from a result or source view.

The proposal records:

- the exact result;
- the exact approved PM data version;
- the exact source passage;
- the field to change;
- the proposed value; and
- the user’s reason.

The proposal does not change the result that users can see.

A correction becomes visible only through a later approved PM data version
after its required review and checks.

An unauthorised user does not receive an active correction control.

## Coverage and failure messages

The product uses these user states:

| State | Required product message |
|---|---|
| Supported result | Show checked results and coverage |
| Supported query with no results | “No results in the covered deals” |
| Unsupported question | Explain that PM cannot answer it yet |
| Ambiguous question | Ask the user to select the intended legal concept |
| Field not available | Explain why the field cannot be used |
| Field not examined | State that the field was not examined |
| Source detail failed | Keep other rows and show a source-reading error for this row |
| Result row failed | Withhold that row and keep valid rows |
| Coverage incomplete | State the exact covered set and exclusions |
| Old approved PM data version | Return `RELEASE_NOT_ACTIVE`, keep the citation identity and offer an explicit rerun |
| System or capacity failure | Fail closed and do not use the legacy product as a hidden fallback |

The product must not use blank text for a known missing value.

The product must not describe zero results as market absence unless an approved
absence-proof rule permits that statement.

## Speed

The product uses the existing Process speed requirements:

- warm query response p95 under 500 milliseconds;
- cold query response p95 under 1.5 seconds;
- local Browse and filter interaction p95 under 200 milliseconds; and
- cached or range-addressable context expansion p95 under 300 milliseconds.

One user action uses one required admission check and no more than one bounded
serving query.

The product must not load the full corpus before it applies filters.

`p95` means that at least 95 of 100 measured requests finish within the stated
time.

The admission check confirms that the request can use the exact approved PM
data version, fields and action.

## Accessibility and responsive behaviour

All Ask, Browse, filter, result and source actions must work with:

- keyboard navigation;
- visible focus;
- screen-reader labels;
- logical heading order;
- sufficient contrast;
- text zoom; and
- narrow screens.

Colour cannot be the only indication of evidence state, error or selection.

The mobile source reader must not compress a desktop split pane into unreadable
columns.

## Product acceptance tests

The product cannot pass acceptance unless all applicable tests pass against one
exact approved PM data version and one exact catalogue digest.

### Catalogue tests

1. The catalogue contains all 15 current PM Deals-table fields.
2. Every included source field has one admitted catalogue disposition.
3. Every excluded eligible source field has a reason.
4. Alias resolution does not create two active fields with the same meaning.
5. A source-registry change creates a catalogue difference.
6. An unreviewed field does not become an active control.
7. A newly admitted field appears without new user-interface code.
8. No unsupported field produces a false zero.

### Ask and Browse tests

9. Ask and Browse create the same checked query for the same legal question.
10. They return the same ordered result identities.
11. A changed Topic changes the Pattern list.
12. Browse has no display-only label.
13. An unsupported natural-language question does not run a similar query.
14. An ambiguous legal phrase requires a user choice.

### Filter tests

15. Every valid field is searchable in `More filters`.
16. Active filters appear as a short sentence.
17. The interface does not require a large row of pills.
18. Role-aware counsel filters bind the correct represented party.
19. Bidder-track filters do not mix separate tracks.
20. Share-purchase filters do not combine separate interest components.
21. Merger-of-equals results do not invent a buyer.
22. Reverse merger, reverse Morris Trust and share-purchase structures have
    positive and negative filter tests.
23. The same shared deal fact appears in filters, result metadata, table view
    and export.
24. An equity value from a press release opens the exact press release.
25. A professional filter preserves the represented party and professional
    role.

### Result tests

26. Each result contains one verbatim passage and one exact citation.
27. Direct evidence precedes contextual or retold evidence.
28. The first page is diversified by deal and bidder track.
29. Passage and table views use the same result identities.
30. A malformed row does not remove valid sibling rows.
31. A missing field is not shown as empty text.

### Source-reader tests

32. The selected evidence stays highlighted.
33. Each `Show more above` click adds one earlier paragraph.
34. Each `Show more below` click adds one later paragraph.
35. Repeated clicks continue until the approved limit.
36. Context expansion does not change the selected evidence.
37. Related items show checked relationship labels and verbatim text.
38. The user can open the actual drafting for each related item.

### Citation, saved-search and export tests

39. Copied citations bind the exact approved PM data version.
40. An old link for an inactive version returns `RELEASE_NOT_ACTIVE` and does
    not silently open changed results.
41. An explicit rerun creates a new query identity.
42. Export contains the same selected result identities as the screen.
43. Export does not add unrequested or unsupported fields.

### Failure and coverage tests

44. Zero results say “No results in the covered deals.”
45. Incomplete coverage names the covered set and exclusions.
46. A source-detail failure affects only that detail action.
47. A system failure does not use a hidden legacy fallback.
48. Internal IDs and pipeline terms do not appear on normal user screens.

### Speed and accessibility tests

49. Query, Browse, filter and context actions pass their fixed speed limits.
50. Keyboard users can complete every initial product action.
51. Screen readers receive clear labels and state changes.
52. Text zoom does not hide actions or evidence.
53. Mobile source reading uses a readable full-screen view.

### Saved-search and correction tests

54. A saved search records the exact catalogue and approved PM data version.
55. A saved search does not change when a new approved PM data version becomes
    active.
56. An explicit rerun creates a new saved-search identity.
57. A correction proposal binds the exact result, source and field.
58. A correction proposal does not change the active result.
59. An unauthorised user does not receive an active correction control.

### Natural-language and navigation boundary tests

60. Each supported Ask mapping has positive phrases, drafting synonyms,
    abbreviations, ordinary misspellings and legally adjacent negative phrases.
61. A new Pattern in an existing Topic appears without new user-interface code
    after approval.
62. The `All` view lists domains and does not combine their result rows.
63. A new field that needs an unsupported control type remains unavailable
    until product review and user-interface work pass.
64. A new permitted field value creates a catalogue difference before it
    becomes active.

### Visual and future-domain boundary tests

65. Final visual review confirms that Process uses PM’s approved typography,
    spacing, colours and controls. It does not copy the Fable layout.
66. An Ask result opens the answer-first passage view. The user does not need
    to open a Deals table before reading the precedent language.
67. CVR does not appear as an active domain until its checked legal questions,
    fields, certification and approved PM data version exist.
68. A new domain reuses PM’s source and entity authority, field registry, query
    engine and user-interface structure. It does not create parallel copies.

### Interaction detail tests

69. An active share link opens the exact same result and approved PM data
    version.
70. A copied passage contains the exact verbatim text and citation. It does not
    copy only the shortened on-screen preview.
71. The user can edit or clear each part of the active-filter sentence.
72. A fixed-value filter shows only admitted values that occur after the other
    active filters apply.
73. A selected filter value stays visible while the user edits that filter.
74. A field that was not examined shows “Not examined”. It does not show blank
    text or “No”.
75. A shared-fact source conflict shows the checked conflict state. The browser
    does not select a value.
76. An invalid context cursor fails only that context request. It does not
    change the selected passage or remove valid results.

## Metsera product acceptance

Metsera is the first Process test case.

It must prove:

- Pfizer and Novo bidder tracks remain separate;
- every exclusivity request, response, grant, change and end has the correct
  pattern;
- Ask and Browse return the same checked rows;
- party, adviser, economics and document filters use the pinned field
  catalogue;
- equity value, counsel and adviser facts use PM’s shared authority and exact
  source actions;
- related exclusivity discussions elsewhere in the proxy are available as
  verbatim passages;
- repeated context expansion keeps the selected evidence;
- actual drafting is always available;
- zero results use the correct coverage statement; and
- response-time limits pass.

This document does not authorise Metsera filing review or gold work. Gold work
means the independent human-reviewed answer set used for testing. Those actions
require a passing formal programme gate. A programme gate is the recorded
permission state for a class of work.

## Future domains

The same user interface can add:

- more Process topics;
- CVR drafting and milestone mechanics;
- proxy changes;
- shareholder support;
- financing; and
- other approved domains.

A new domain supplies:

- checked legal questions;
- Browse hierarchy;
- admitted fields;
- result types;
- source rules;
- certification;
- acceptance tests; and
- an approved PM data version.

It does not create a second field registry, source store, query engine or user
interface shell.

This document does not select the first CVR question set.

## Scope limits

This design fixes product behaviour and information structure.

It does not fix final colours, spacing, typography or component styling. Final
visual design must use PM’s design language and must preserve the behaviour in
this document.

It does not permit:

- implementation planning;
- user-interface code;
- query code;
- data work;
- public-deal reading;
- extraction;
- canonical writes;
- approved-data-version import;
- activation; or
- production changes.

The first permitted implementation-planning amendment must convert these
acceptance requirements into bounded tasks after `implementation_planning`
passes.
