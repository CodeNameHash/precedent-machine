'use strict';

// Shape rules for representation facts, read from a compiled fact's own
// components against the canonical bytes (work package 20 (c) and (d);
// implementer B's defects (6) and (7), finding (105); the manager's (168)).
// Both are rules of the one-effect rule in docs/core/OPERATING-RULES.md
// ("One fact states one independently operative legal effect") applied the
// same way on every deal: never a one-deal fix. Ben, 2026-09-14: "do you
// have an agent looking at all of our tweaks and seeing if they should be
// made systematically/throughout the code base back to extraction? I don't
// want to make surface level/one deal level fixes".

const { walk } = require('./fact-components');

function ownComponents(components) {
  return [...walk(components || [])].map(([component]) => component)
    .filter((component) => component && component.origin === 'OWN'
      && Number.isSafeInteger(component.start_byte) && Number.isSafeInteger(component.end_byte))
    .sort((left, right) => left.start_byte - right.start_byte);
}

function allComponents(components) {
  return [...walk(components || [])].map(([component]) => component)
    .filter((component) => component && Number.isSafeInteger(component.start_byte) && Number.isSafeInteger(component.end_byte))
    .sort((left, right) => left.start_byte - right.start_byte);
}

// (c) Two predicates of one subject joined by "or" or "nor" in one fact
// (NCS generation 5, 3.27 and 4.13: "has taken any action or knows of any
// fact ... that would reasonably be expected to prevent"): a reviewer note,
// never a hold, since the words are all there and the split is the
// extractor's to make on the next generation (the REPRESENTATIONS layer
// rule names it). The second predicate is an own component that opens on
// a finite verb and follows an own OPERATION with only "or" or "nor" (and
// a comma) between them in the source.
const FINITE_VERB_START = /^(?:knows?|has|have|had|is|are|was|were|does|do|did|will|would|shall|may|can|could)\b/i;
const OR_GAP = /^[\s,]*(?:or|nor)\s*$/i;
function fusedLimbs(components, sourceBytes) {
  const own = ownComponents(components);
  const pairs = [];
  for (const operation of own.filter((component) => component.kind === 'OPERATION')) {
    for (const other of own) {
      if (other === operation || other.start_byte < operation.end_byte) continue;
      if (!['OPERATION', 'QUALIFIER', 'TERM'].includes(other.kind) || !FINITE_VERB_START.test(other.text || '')) continue;
      const between = sourceBytes.subarray(operation.end_byte, other.start_byte).toString('utf8');
      if (!OR_GAP.test(between)) continue;
      pairs.push({ first: operation.text, second: other.text, joined_by: between.trim().replace(/^,\s*/, '') });
    }
  }
  return pairs;
}

// (d) A representation's enumerated exception cut as a fact of its own
// (NCS generation 5, 3.5(b) and 4.4(b): "no consent ... is required ...,
// except for (i) such filings ..., (ii) the filing of the Certificate of
// Merger ..., (iii) ..., (iv) ..." as four facts beside the representation).
// The representations table has one row per representation and no row per
// exception, so the exception is an EXCEPTION component of the
// representation (a LIST with a LIST_ELEMENT per item), never a fact. The
// fact is an exception and nothing else when: its exception words are an
// own EXCEPTION component that opens on an enumerator, "except for",
// "other than" or "save for" (never a disclosure exception, "except as set
// forth in ..."), or an own component that follows an EXCEPTION component
// ending in such an introducer with nothing but punctuation between; every
// own component before the exception words is shared verbatim with another
// proposal of the same extraction (the sentence they were all cut from);
// and no own component from the exception words on is an OPERATION, ACTOR,
// EFFORTS_STANDARD, TRIGGER or CONDITION. A disclosure exception at the head
// of a representation ("Except as set forth in Section 3.5(b) of the
// Company Disclosure Letter, no consent ... is required") is a component of
// that representation and never makes it an exception-only fact.
const ENUMERATED_EXCEPTION = /^(?:\(\s*(?:[ivx]+|[a-z]|\d{1,2})\s*\)|except\s+for\b|other\s+than\b|save\s+for\b)/i;
const EXCEPTION_INTRODUCER = /(?:\bexcept\s+for|\bother\s+than|\bsave\s+for|\bexcept)\s*[:,]?\s*$/i;
const OPERATIVE_KINDS = new Set(['OPERATION', 'ACTOR', 'EFFORTS_STANDARD', 'TRIGGER', 'CONDITION']);
const GENERIC_CONTEXT = /\brepresents?\s+and\s+warrants?\b|^as follows:?$/i;
function exceptionOnlyRepresentation(components, siblingComponentTexts) {
  const own = ownComponents(components);
  if (own.length === 0) return null;
  const all = allComponents(components);
  let exceptionStart = null;
  for (const component of own) {
    const text = (component.text || '').trim();
    if (component.kind === 'EXCEPTION' && ENUMERATED_EXCEPTION.test(text)) { exceptionStart = component; break; }
    // An introducer ("except for") earlier in the fact governs this own
    // component when it follows at once, or when it opens on an
    // enumerator ("(ii) the filing of the Certificate of Merger") with no
    // own operative words between the introducer and it.
    const introducers = all.filter((item) => item !== component && item.kind === 'EXCEPTION' && item.end_byte <= component.start_byte
      && EXCEPTION_INTRODUCER.test((item.text || '').trim()));
    const governed = introducers.some((item) => component.start_byte - item.end_byte <= 4
      || (ENUMERATED_EXCEPTION.test(text) && !own.some((between) => OPERATIVE_KINDS.has(between.kind) && between.start_byte >= item.end_byte && between.end_byte <= component.start_byte)));
    if (governed) { exceptionStart = component; break; }
  }
  if (!exceptionStart) return null;
  const preceding = own.filter((component) => component.start_byte < exceptionStart.start_byte);
  const fromException = own.filter((component) => component.start_byte >= exceptionStart.start_byte);
  if (fromException.some((component) => OPERATIVE_KINDS.has(component.kind))) return null;
  // A representation with its own verb before the exception is the
  // representation, whatever follows ("no consent ... is required ...,
  // except for (i) ..., (ii) ..." in one fact is the right shape).
  if (preceding.some((component) => component.kind === 'OPERATION' || component.kind === 'EFFORTS_STANDARD')) return null;
  const shared = (component) => siblingComponentTexts.has(component.text);
  if (!preceding.every(shared)) return null;
  // The exception belongs to a sentence other facts were cut from: at
  // least one component (own or inherited) other than the generic
  // "represents and warrants" words is shared with a sibling.
  const context = all.filter((component) => component.start_byte < exceptionStart.start_byte && !GENERIC_CONTEXT.test(component.text || ''));
  if (!context.some(shared)) return null;
  return {
    exception: fromException.map((component) => component.text).join(' ').slice(0, 240),
    shared_context: context.filter(shared).map((component) => component.text.slice(0, 120)),
  };
}

// The component texts of every other proposal of one extraction, for the
// sharing test above.
function siblingTexts(proposals, except) {
  const texts = new Set();
  for (const proposal of proposals || []) {
    if (proposal === except) continue;
    for (const [component] of walk(proposal.components || [])) {
      if (component && typeof component.text === 'string') texts.add(component.text);
      if (component && typeof component.quote === 'string') texts.add(component.quote);
    }
  }
  return texts;
}

module.exports = { fusedLimbs, exceptionOnlyRepresentation, siblingTexts, FINITE_VERB_START, ENUMERATED_EXCEPTION, EXCEPTION_INTRODUCER };
