# Operator table (Q-0020)

Authority cells are copied from the repair plan §5.2 minimum vocabulary or the termination temporal Phase 1 overlay. Where those records do not specify a field, the cell is `UNDEFINED` for Ben. Examples are the first sha-verified occurrence of a connective phrase in the ten Work 3 canonical texts.

| Operator | Arity | Child roles / types | Precedence | Scope | Serialisation | Source | Example |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ALL_OF | UNDEFINED | UNDEFINED | UNDEFINED | UNDEFINED | ALL_OF(child, …) | plan §5.2 | `each of the following` 08fd217ea256 320505–320526 |
| ANY_OF | UNDEFINED | UNDEFINED | UNDEFINED | UNDEFINED | ANY_OF(child, …) | plan §5.2 | `any of the following` 06ec30164193 243754–243774 |
| NOT | UNDEFINED | UNDEFINED | UNDEFINED | UNDEFINED | NOT(child) | plan §5.2 | ` shall not ` 06ec30164193 17617–17628 |
| IF_THEN | UNDEFINED | UNDEFINED | UNDEFINED | UNDEFINED | IF_THEN(condition, consequent) | plan §5.2 | `If ` 06ec30164193 24211–24214 |
| EXCEPTION_TO | UNDEFINED | UNDEFINED | UNDEFINED | UNDEFINED | EXCEPTION_TO(base, exception) | plan §5.2 | `except as` 06ec30164193 31739–31748 |
| OVERRIDES | UNDEFINED | UNDEFINED | UNDEFINED | UNDEFINED | UNDEFINED | plan §5.2 | `notwithstanding` 08fd217ea256 180283–180298 |
| DEEMS_AS | UNDEFINED | UNDEFINED | UNDEFINED | UNDEFINED | UNDEFINED | plan §5.2 | `shall be deemed` 06ec30164193 23120–23135 |
| EARLIER_OF | UNDEFINED | UNDEFINED | UNDEFINED | UNDEFINED | EARLIER_OF(child, …) | phase-1 temporal | `earlier of` 06ec30164193 13615–13625 |
| LATER_OF | UNDEFINED | UNDEFINED | UNDEFINED | UNDEFINED | LATER_OF(child, …) | plan §5.2 | `later of` 08fd217ea256 31989–31997 |
| TO_EXTENT | UNDEFINED | UNDEFINED | UNDEFINED | UNDEFINED | UNDEFINED | plan §5.2 | `to the extent` 06ec30164193 9608–9621 |
| CONSEQUENCE_MODIFIER | UNDEFINED | UNDEFINED | UNDEFINED | UNDEFINED | UNDEFINED | plan §5.2 | — |
| BEFORE | 2 | SUBJECT_EVENT, TEMPORAL_BOUNDARY | UNDEFINED | result_kind=LOGICAL; relation=STRICT; ordered children | BEFORE(SUBJECT_EVENT, TEMPORAL_BOUNDARY) | phase-1 temporal | `prior to the Effective Time` 06ec30164193 11926–11953 |
| ON_OR_BEFORE | 2 | SUBJECT_EVENT, TEMPORAL_BOUNDARY | UNDEFINED | result_kind=LOGICAL; relation=INCLUSIVE; ordered children | ON_OR_BEFORE(SUBJECT_EVENT, TEMPORAL_BOUNDARY) | phase-1 temporal | `on or before` 06ec30164193 227227–227239 |
| OFFSET_AFTER | 2 | ANCHOR, OFFSET_AMOUNT | UNDEFINED | result_kind=TEMPORAL; ordered children | OFFSET_AFTER(ANCHOR, OFFSET_AMOUNT) | phase-1 temporal | `Business Days after` 06ec30164193 188320–188339 |
| OFFSET_BEFORE | 2 | ANCHOR, OFFSET_AMOUNT | UNDEFINED | result_kind=TEMPORAL; ordered children | OFFSET_BEFORE(ANCHOR, OFFSET_AMOUNT) | phase-1 temporal | `Business Days before` fb76ef57355b 240780–240800 |
| CAPABLE | 1 | TEST | UNDEFINED | result_kind=LOGICAL; ordered children | CAPABLE(TEST) | phase-1 temporal | `incapable of being cured` 06ec30164193 229374–229398 |

## Definitions copied from the authorities

- **ALL_OF**: Listed in the §5.2 minimum vocabulary. The plan states that each operator has fixed arity, child types, order, precedence, scope and serialisation, but does not specify those fields per operator.
- **ANY_OF**: Listed in the §5.2 minimum vocabulary. The plan states that each operator has fixed arity, child types, order, precedence, scope and serialisation, but does not specify those fields per operator.
- **NOT**: Listed in the §5.2 minimum vocabulary. The plan states that each operator has fixed arity, child types, order, precedence, scope and serialisation, but does not specify those fields per operator.
- **IF_THEN**: Listed in the §5.2 minimum vocabulary. The plan states that each operator has fixed arity, child types, order, precedence, scope and serialisation, but does not specify those fields per operator.
- **EXCEPTION_TO**: Listed in the §5.2 minimum vocabulary. The plan states that each operator has fixed arity, child types, order, precedence, scope and serialisation, but does not specify those fields per operator.
- **OVERRIDES**: Listed in the §5.2 minimum vocabulary. The plan states that each operator has fixed arity, child types, order, precedence, scope and serialisation, but does not specify those fields per operator.
- **DEEMS_AS**: Listed in the §5.2 minimum vocabulary. The plan states that each operator has fixed arity, child types, order, precedence, scope and serialisation, but does not specify those fields per operator.
- **EARLIER_OF**: Phase 1 extends allowed fact value kinds to DATE, DEFINED_TERM, DURATION, PERIOD, REFERENCE; otherwise byte semantics unchanged
- **LATER_OF**: Listed in the §5.2 minimum vocabulary. The plan states that each operator has fixed arity, child types, order, precedence, scope and serialisation, but does not specify those fields per operator.
- **TO_EXTENT**: Listed in the §5.2 minimum vocabulary. The plan states that each operator has fixed arity, child types, order, precedence, scope and serialisation, but does not specify those fields per operator.
- **CONSEQUENCE_MODIFIER**: Listed in the §5.2 minimum vocabulary. The plan states that each operator has fixed arity, child types, order, precedence, scope and serialisation, but does not specify those fields per operator.
- **BEFORE**: STRICT temporal relation
- **ON_OR_BEFORE**: INCLUSIVE temporal relation
- **OFFSET_AFTER**: UNDEFINED
- **OFFSET_BEFORE**: UNDEFINED
- **CAPABLE**: TRUE_IFF_THE_CHILD_TEMPORAL_TEST_IS_CAPABLE_OF_BEING_SATISFIED
