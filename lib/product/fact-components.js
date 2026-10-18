'use strict';

// Validation and rendering helpers for FACT_COMPONENTS/V2, the layered fact
// model decided on 2026-09-12. Contract: contracts/product/fact-components.v2.json.
// Pure functions; no database or model access.

const contract = require('../../contracts/product/fact-components.v2.json');
const { hidePageFooters } = require('./source-display');

const KINDS = new Set(contract.component.component_kinds);
const KIND_SYNONYMS = Object.freeze({ PARTY: 'ACTOR', PARTIES: 'ACTOR', SUBJECT: 'ACTOR', LEGAL_STATUS: 'TERM', STATUS: 'TERM', VERB: 'OPERATION', OPERATIVE_VERB: 'OPERATION', CARVE_OUT: 'EXCEPTION', CARVEOUT: 'EXCEPTION', QUALIFICATION: 'QUALIFIER', QUALIFICATIONS: 'QUALIFIER', TIME: 'TRIGGER', TIMING: 'TRIGGER', EVENT: 'TRIGGER', LEGAL_ACTOR_OR_SUBJECT: 'ACTOR', LEGAL_OPERATION: 'OPERATION', OPERATIVE_OBJECT: 'OBJECT', TEMPORAL_OR_TRIGGER_SCOPE: 'TRIGGER' });
// A PERIOD, DATE or THRESHOLD may be descriptive ("on the second Business Day
// following the satisfaction of the conditions", "at least equal to the number
// of Parent Ordinary Shares subject to the Assumed RSUs"); it then carries
// value null. Money amounts and percentages always carry a number.
const DESCRIPTIVE_VALUE_KINDS = new Set(['PERIOD', 'DATE', 'THRESHOLD']);
const ORIGINS = new Set(contract.component.origins);
const VALUE_KINDS = new Set(['THRESHOLD', 'PERIOD', 'PERCENTAGE', 'DATE', 'AMOUNT']);
const FORBIDDEN_TEXT = /^(none|n\/a|not applicable|none stated)$/i;

function byteSlice(text, start, end) {
  const bytes = new TextEncoder().encode(text);
  return new TextDecoder().decode(bytes.slice(start, end));
}

// Walks the tree depth first, yielding [component, path, parent].
function* walk(components, path = [], parent = null) {
  for (let index = 0; index < (components || []).length; index += 1) {
    const component = components[index];
    const here = [...path, index];
    yield [component, here, parent];
    yield* walk(component.children, here, component);
  }
}

// Returns a list of problems; an empty list means the fact satisfies the
// contract. `sourceText` and `spans` (span_id -> {start_byte,end_byte,
// exact_text}) enable the byte checks of rule R1.
const EXTERNAL_REFERENCE = /\b(DGCL|U\.S\.C\.?|C\.F\.R\.?|Code|Act\b|Rule\s+\d|Regulation|Treasury|Statute|Law\b)/;
// Work package 19 (c) (NCS generation 5, 6.4; 2026-10-18): "this Article
// VI" resolves to the article node of the structure (agreement-draft.js
// resolveStructureReferences), as a Section reference resolves to its
// section; only the bare adverbs of reference ("hereof", "herein") have no
// node and need none.
const SELF_REFERENCE = /^(?:hereof|herein|hereunder|hereto|thereof|therein)$/i;
function isExternalReference(text) {
  return typeof text === 'string' && (EXTERNAL_REFERENCE.test(text) || SELF_REFERENCE.test(text.trim()));
}

// headline.summary (contract summary_rule; Ben, 2026-09-14, on the Other
// provisions table: "it needs to be a summary of the provision on the right
// etc - like in the normal course. Not just a sec ref...!"; asked whether
// the extractor should write a short summary per fact as part of the fact
// contract: "1. for now - yes"; standing rule: "everything to be driven by
// coding and not just a layer on top so all edits need to be repeatable
// across corpus"). One plain-English line of at most 15 words stating the
// provision's operative effect in the parties' defined names, no section
// reference, no quotation marks, no trailing period, no leading or trailing
// whitespace. Optional: older generations have none. A bad summary is a
// problem for review, never a crash, and never a held fact: legal content
// is not lost over a formatting slip in a one-line summary, so this checker
// is called by the extractor (which drops a malformed summary with a
// HEADLINE_SUMMARY_DROPPED note) and does not feed validateFactComponents.
// The extractor is asked for 15 words; the checker drops a summary only
// over 18 (Metsera generation 8, 2026-10-18, plan finding (52): three fair
// summaries of 16 words were dropped at the cap, 1.03's filing of the
// Certificate of Merger and the Article III introduction's two General
// Exceptions summaries; work package 5). The summary itself is Ben's
// request (2026-10-17: "1. for now - yes"); the rule text stays at 15 so
// the extractor keeps writing short, and the page shows what it wrote.
const HEADLINE_SUMMARY_ASKED_WORDS = 15;
const HEADLINE_SUMMARY_MAX_WORDS = 18;
const HEADLINE_SUMMARY_RULE = 'summary is one plain-English line of at most ' + HEADLINE_SUMMARY_ASKED_WORDS
  + ' words stating the provision\'s operative effect in the parties\' defined names (for example: Company files the Certificate of Merger with the Delaware Secretary of State), with no reference to a section of the agreement (say what the section provides instead; a statutory section such as Section 259 of the DGCL, a section of the Disclosure Letter, or an Article of the agreement may be named), no quotation marks and no trailing period.';
// A reference to one of the agreement's own sections ("Section 8.3"); a
// statutory section ("Section 259 of the DGCL", "Section 16 of the
// Exchange Act") and an Article are content (generation 7, 1.02 and 1.04:
// three fair summaries dropped).
// The agreement's own sections are numbered with a dot (Section 8.3,
// Section 5.02(b)); a bare number (Section 262, Section 16) is a statute's
// (generation 7, 2.01: "Section 262" appraisal summaries dropped).
const SUMMARY_SECTION_REFERENCE = /(\bSections?\s+\d+\.\d|§)/;
// A section of the Disclosure Letter ("Section 9.03(a) of the Company
// Disclosure Letter") names a schedule, not a section of the agreement:
// it is content (Metsera generation 7, 9.03: the scheduled-matters carve-out
// lost its summary and its row showed an empty provision cell).
const SUMMARY_DISCLOSURE_LETTER_SECTION = /\bSections?\s+\d+\.\d+(?:\([a-z0-9]+\))*\s+of\s+the\s+(?:Company|Parent)\s+Disclosure\s+(?:Letter|Schedule)s?\b/gi;
// The same schedule named the other way round ("Company Disclosure Letter
// Section 3.21"; generation 8 dropped 3.11's and 3.21's summaries for it).
const SUMMARY_DISCLOSURE_LETTER_SECTION_PREFIXED = /\b(?:Company|Parent)\s+Disclosure\s+(?:Letter|Schedule)s?\s+Sections?\s+\d+\.\d+(?:\([a-z0-9]+\))*/gi;
function summaryWithoutDisclosureLetterSections(summary) {
  return summary.replace(SUMMARY_DISCLOSURE_LETTER_SECTION, 'the Disclosure Letter')
    .replace(SUMMARY_DISCLOSURE_LETTER_SECTION_PREFIXED, 'the Disclosure Letter');
}
const SUMMARY_QUOTATION_MARK = /["“”]/; // a possessive apostrophe (Parent's) is not a quotation mark
// Letters of any script but Latin, with the symbols and marks every script
// shares (digits, punctuation, currency, combining accents).
const SUMMARY_FOREIGN_SCRIPT = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u;

function headlineSummaryProblems(summary) {
  if (summary === undefined || summary === null) return [];
  if (typeof summary !== 'string') return ['headline summary must be a string'];
  const problems = [];
  if (summary !== summary.trim()) problems.push('headline summary has leading or trailing whitespace');
  const words = summary.trim().split(/\s+/).filter(Boolean);
  if (!words.length) problems.push('headline summary empty');
  else if (words.length > HEADLINE_SUMMARY_MAX_WORDS) problems.push(`headline summary over ${HEADLINE_SUMMARY_MAX_WORDS} words (${words.length}; ${HEADLINE_SUMMARY_ASKED_WORDS} asked for)`);
  if (/[.]$/.test(summary.trim())) problems.push('headline summary ends with a period');
  if (SUMMARY_QUOTATION_MARK.test(summary)) problems.push('headline summary contains a quotation mark');
  if (SUMMARY_SECTION_REFERENCE.test(summaryWithoutDisclosureLetterSections(summary))) problems.push('headline summary contains a section reference');
  // Metsera generation 8, 9.03: the Rights Agent summary came back with
  // one Han character inside an English sentence ("Parent's选
  // alternative"), a decoding slip of the model, not the agreement's
  // words. A summary is written in the agreement's script: a letter from
  // another script drops the summary with a note and the fact keeps its
  // label-built term.
  const foreign = summary.match(SUMMARY_FOREIGN_SCRIPT);
  if (foreign) problems.push(`headline summary contains a character outside the agreement's script ("${foreign[0]}")`);
  return problems;
}

function validateFactComponents(fact, { sourceText = null, spansById = new Map() } = {}) {
  const problems = [];
  if (!fact || typeof fact !== 'object') return ['fact missing'];
  if (!fact.headline || typeof fact.headline.label !== 'string' || !fact.headline.label.trim()) {
    problems.push('headline label missing');
  }
  if (!Array.isArray(fact.components) || fact.components.length === 0) {
    problems.push('components missing');
    return problems;
  }
  const ids = new Map();
  for (const [component, path, parent] of walk(fact.components)) {
    const where = path.join('.');
    if (!component || typeof component !== 'object') { problems.push(`${where}: not an object`); continue; }
    if (!KINDS.has(component.kind)) problems.push(`${where}: unknown kind ${component.kind}`);
    if (!ORIGINS.has(component.origin)) problems.push(`${where}: unknown origin ${component.origin}`);
    if (typeof component.label !== 'string' || !component.label.trim()) problems.push(`${where}: label missing`);
    if (typeof component.text !== 'string' || !component.text.trim()) problems.push(`${where}: text missing`);
    else if (FORBIDDEN_TEXT.test(component.text.trim())) problems.push(`${where}: invented text "${component.text}"`);
    else if (/\.\.\.|…/.test(component.text)) problems.push(`${where}: text contains an ellipsis`);
    if (typeof component.component_id !== 'string' || !component.component_id) problems.push(`${where}: component_id missing`);
    else if (ids.has(component.component_id)) problems.push(`${where}: duplicate component_id`);
    else ids.set(component.component_id, component);
    if (component.kind === 'LITANY') {
      if (!Array.isArray(component.members) || component.members.length < 2) problems.push(`${where}: LITANY needs members`);
      if ((component.children || []).length) problems.push(`${where}: LITANY has children`);
    } else if (component.members !== undefined) problems.push(`${where}: members only on LITANY`);
    // Work package 19 (b) (NCS generation 5, 6.2; 2026-10-18): the bring-down
    // tiers list the representations they cover ("Section 3.9(c), Section
    // 3.20, Section 3.21") as a LIST of CROSS_REFERENCE children, each
    // resolved; a list of references or of defined terms is a list, its
    // children carrying the resolution a LIST_ELEMENT would not.
    const listChildren = component.children || [];
    const listOfReferences = listChildren.length > 0 && listChildren.every((child) => child.kind === 'CROSS_REFERENCE' || child.kind === 'DEFINED_TERM');
    if (component.kind === 'LIST' && !listOfReferences && !listChildren.some((child) => child.kind === 'LIST_ELEMENT')) {
      problems.push(`${where}: LIST without LIST_ELEMENT children`);
    }
    // A LIST_ELEMENT sits under a LIST or another LIST_ELEMENT, or at the
    // root of a fact that is itself one element of a list in the source
    // (each MAE carve-out is one element of the definition's exclusion
    // list; Metsera generation 3, 2026-09-14: ten carve-outs held for
    // "LIST_ELEMENT outside a LIST").
    if (component.kind === 'LIST_ELEMENT' && parent && !(parent.kind === 'LIST' || parent.kind === 'LIST_ELEMENT')) {
      problems.push(`${where}: LIST_ELEMENT outside a LIST`);
    }
    // An AMOUNT that is a formula over defined terms (work package 14)
    // carries { canonical: null, unit: null, form: 'FORMULA' } and no
    // problem; any other AMOUNT or PERCENTAGE needs its number.
    // A reference quantity (work package 18 (b)) is valued { canonical:
    // null, unit: null, form: 'REFERENCE' } the same way.
    const formula = component.kind === 'AMOUNT' && component.value && (component.value.form === 'FORMULA' || component.value.form === 'REFERENCE') && component.value.canonical === null;
    if (VALUE_KINDS.has(component.kind) && !DESCRIPTIVE_VALUE_KINDS.has(component.kind) && !formula
      && (!component.value || component.value.canonical === undefined || component.value.canonical === null)) {
      problems.push(`${where}: ${component.kind} needs a canonical value`);
    }
    if (DESCRIPTIVE_VALUE_KINDS.has(component.kind) && component.value !== null && component.value !== undefined
      && component.value.canonical === undefined) {
      problems.push(`${where}: ${component.kind} value must be parsed or null`);
    }
    if (['CHAPEAU', 'INTRO', 'DEFINITION'].includes(component.origin) && !component.origin_structure_node_id) {
      problems.push(`${where}: inherited component needs origin_structure_node_id`);
    }
    // A reference to a statute or rule outside the agreement ("Section 259
    // of the DGCL", "Rule 16b-3 under the Exchange Act") has nothing in the
    // structure to resolve to; only a reference into the agreement must
    // resolve (Metsera generation 5, 1.04).
    if (component.kind === 'CROSS_REFERENCE' && !(component.resolves_to && component.resolves_to.structure_node_id)
      && !isExternalReference(component.text)) {
      problems.push(`${where}: CROSS_REFERENCE must resolve`);
    }
    if (Number.isSafeInteger(component.start_byte) && Number.isSafeInteger(component.end_byte)) {
      if (component.end_byte <= component.start_byte) problems.push(`${where}: empty byte range`);
      else if (sourceText && byteSlice(sourceText, component.start_byte, component.end_byte) !== component.text) {
        problems.push(`${where}: text does not match canonical bytes`);
      }
      const span = spansById.get(component.source_span_id);
      if (span && (component.start_byte < span.start_byte || component.end_byte > span.end_byte)) {
        problems.push(`${where}: outside its source span`);
      }
    } else problems.push(`${where}: byte range missing`);
  }
  for (const id of fact.headline?.distinguishing_component_ids || []) {
    if (!ids.has(id)) problems.push(`headline: unknown distinguishing component ${id}`);
  }
  if (!(fact.headline?.distinguishing_component_ids || []).length) problems.push('headline: no distinguishing component');
  return problems;
}

// Layer 0 text: label plus the distinguishing components' verbatim words.
function renderHeadline(fact) {
  const byId = new Map([...walk(fact.components || [])].map(([component]) => [component.component_id, component]));
  const parts = (fact.headline?.distinguishing_component_ids || []).map((id) => byId.get(id)?.text).filter(Boolean);
  return parts.length ? `${fact.headline.label}: ${parts.join(' / ')}` : fact.headline?.label || '';
}

// Flattens one layer for display: siblings in order, with [...] markers.
function renderLayer(components) {
  return (components || []).map((component) => ({
    component_id: component.component_id,
    label: component.label || null,
    kind: component.kind,
    origin: component.origin,
    inherited: component.origin !== 'OWN',
    gap_before: component.gap_before === true,
    // Shown without the SEC page footers; the stored text keeps them.
    text: hidePageFooters(component.text),
    has_children: (component.children || []).length > 0,
    members: component.kind === 'LITANY' ? component.members : undefined,
    value: component.value || undefined,
    resolves_to: component.resolves_to || undefined,
  }));
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

// Rule R6: canonical values are parsed by code from the verbatim text.
// Returns { canonical, unit } or null when the text carries no parsable value.
//
// Work package 7 (manager, 2026-10-18; Metsera generation 8, 5.02(e)): the
// subsequent match period read 4 business days from "except that the
// references to four (4) business days will be deemed two (2) business
// days" because the parser took the first number. A text that states one
// value and then deems it another ("X ... deemed Y", "X ... shall be Y",
// "X ... will be Y") reads the deemed value, Y. Any other text naming two
// different values of the kind parses to nothing: the cell stays empty
// (the extractor leaves a VALUE_AMBIGUOUS_<KIND> note) and the row shows
// the summary alone rather than the wrong number. The same rule for
// AMOUNT, PERCENTAGE and DATE.
const DEEMING_WORDS = /\b(?:deemed(?:\s+to\s+be)?|shall\s+(?:instead\s+)?be(?:\s+deemed(?:\s+to\s+be)?)?|will\s+(?:instead\s+)?be(?:\s+deemed(?:\s+to\s+be)?)?|(?:shall|will)\s+be\s+reduced\s+to|replaced\s+(?:by|with))\b/gi;
// Work package 14 (manager, 2026-10-18, plan finding (81), NCS generation 5,
// 3.2 "no shares of Company Preferred Stock were issued and outstanding"
// and 4.2 "(ii) no Parent Ordinary Shares", both held on "AMOUNT needs a
// canonical value"): "a count component whose words are 'no'/'none'/'zero'
// of the counted thing is 0". The words open with the negation (after an
// enumerator) and carry no digit anywhere, so "no later than 10 days" and
// "not more than 10 shares" are untouched.
const NONE_OF_THE_COUNTED = /^\s*(?:\([a-z0-9]+\)\s*)?(?:no|none(?:\s+of)?|zero)\b/i;

function noneCount(text) {
  const value = String(text || '');
  return NONE_OF_THE_COUNTED.test(value) && !/[0-9]/.test(value) ? { canonical: 0, unit: 'COUNT' } : null;
}

// Work package 14 (finding (81), NCS 2.1 "“Cash Consideration” means cash
// in an amount equal to the product of (x) the Cash Exchange Ratio,
// multiplied by (y) the Parent Closing Price", held on the same problem):
// "an AMOUNT whose words define it as a product, sum or ratio of defined
// terms carries no canonical value and a note, and the fact stays VALID
// with its components". A formula names an arithmetic operation on at
// least two defined terms (capitalised phrases or quoted terms) and states
// no number of its own.
const FORMULA_OPERATION = /\b(?:product|sum|quotient|ratio|difference|excess|aggregate|total)\s+of\b|\bmultiplied\s+by\b|\bdivided\s+by\b|\btimes\b|\bplus\b|\bminus\b|\bless\s+the\b/i;
const DEFINED_TERM_WORDS = /[“"][^”"]+[”"]|\b[A-Z][A-Za-z&-]+(?:\s+(?:of\s+|the\s+)?[A-Z][A-Za-z&-]+)+\b|\b[A-Z]{2,}s?\b/g;
const FORMULA_VALUE = Object.freeze({ canonical: null, unit: null, form: 'FORMULA' });

function isFormulaValue(text) {
  const value = String(text || '');
  if (/[0-9]/.test(value) || !FORMULA_OPERATION.test(value)) return false;
  return (value.match(DEFINED_TERM_WORDS) || []).length >= 2;
}

// Work package 18 (b) (plan finding (91), NCS generation 5, 5.11; 2026-10-18):
// "the last aggregate annual premium paid by the Company prior to the date
// hereof" (the D&O tail premium cap) was held on "AMOUNT needs a canonical
// value". An AMOUNT whose words name a reference quantity and state no
// number of their own (the premium last paid; "the amount set forth in
// Section 5.11(b) of the Company Disclosure Letter") carries { canonical:
// null, unit: null, form: 'REFERENCE' } and a VALUE_IS_REFERENCE note, as
// the formula rule does; prose that is neither a number, a count in
// words, a formula nor a reference still holds. A reference names a
// quantity noun and either where it is set forth or the payment it was.
const REFERENCE_QUANTITY = /\b(?:amount|premium|price|fee|sum|cost|value|consideration|payment|expense|salary|compensation|rate|balance)s?\b/i;
const REFERENCE_LOCATOR = /\b(?:set\s+forth|specified|described|stated|provided|listed|reflected|identified|indicated)\s+(?:in|on|under)\b|\b(?:last|most\s+recent|then[-\s]current|current|existing|prior|previous|annual)\b[\s\S]{0,80}\b(?:paid|payable|in\s+effect|charged|incurred)\b/i;
// A section, schedule or rule citation is a locator, not a number.
const CITATION_NUMBERS = /\b(?:Section|Article|Schedule|Exhibit|Annex|Clause|Rule|Item)\s+[0-9][0-9A-Za-z().-]*/g;
const REFERENCE_VALUE = Object.freeze({ canonical: null, unit: null, form: 'REFERENCE' });

const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100 };
const spelledNumber = (words) => words.toLowerCase().split(/[-\s]+/).reduce((sum, word) => sum + (NUMBER_WORDS[word] || 0), 0);
const SPELLED_NUMBER = new RegExp(`\\b(?:${[...Object.keys(NUMBER_WORDS), 'thousand', 'million', 'billion'].join('|')})\\b`, 'i');

function isReferenceValue(text) {
  const value = String(text || '');
  const bare = value.replace(CITATION_NUMBERS, '');
  if (/[0-9]/.test(bare) || SPELLED_NUMBER.test(bare) || isFormulaValue(value)) return false;
  return REFERENCE_QUANTITY.test(bare) && REFERENCE_LOCATOR.test(bare);
}

// Every value of `kind` the text states, in order, with where it starts.
function componentValueMatches(kind, text) {
  const value = String(text || '');
  const all = (pattern, read) => [...value.matchAll(pattern)].map((match) => ({ ...read(match), index: match.index })).filter((entry) => entry.canonical !== null && entry.canonical !== undefined && !Number.isNaN(entry.canonical));
  if (kind === 'AMOUNT' || kind === 'THRESHOLD') {
    const money = all(/(?:US\s*)?\$\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*(million|billion|thousand)?/gi, (match) => {
      const scale = { million: 1e6, billion: 1e9, thousand: 1e3 }[(match[2] || '').toLowerCase()] || 1;
      return { canonical: Math.round(Number(match[1].replace(/,/g, '')) * scale * 100) / 100, unit: 'USD' };
    });
    if (money.length) return money;
    const percent = all(/([0-9]+(?:\.[0-9]+)?)\s*%/g, (match) => ({ canonical: Number(match[1]), unit: 'PERCENT' }));
    if (percent.length) return percent;
    // A threshold expressed as a period ("within five Business Days", "within 30 days").
    if (kind === 'THRESHOLD') {
      const period = componentValueMatches('PERIOD', value);
      if (period.length) return period;
    }
    const number = value.match(/\b([0-9][0-9,]*(?:\.[0-9]+)?)\b/);
    if (number && kind === 'THRESHOLD') return [{ canonical: Number(number[1].replace(/,/g, '')), unit: 'COUNT', index: number.index }];
    // A count of instruments ("one (1) CVR", "one (1) contractual contingent
    // value right", "two (2) shares"): the parenthetical digits, or the
    // number word, as a COUNT (Metsera, 2026-09-13: the CVR limb was held).
    const counted = value.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b\s*(?:\((\d+)\))?/i);
    if (counted) return [{ canonical: counted[2] ? Number(counted[2]) : NUMBER_WORDS[counted[1].toLowerCase()], unit: 'COUNT', index: counted.index }];
    if (number && kind === 'AMOUNT') return [{ canonical: Number(number[1].replace(/,/g, '')), unit: 'COUNT', index: number.index }];
    const none = noneCount(value);
    if (none) return [{ ...none, index: 0 }];
    return [];
  }
  if (kind === 'PERCENTAGE') {
    // "twenty percent (20)%", "twenty percent (20%)" and "twenty percent"
    // all read 20 (generation 6, 5.02: the takeover proposal threshold
    // was held on "(20)%").
    const percent = all(/([0-9]+(?:\.[0-9]+)?)\s*\)?\s*(?:%|percent)/gi, (match) => ({ canonical: Number(match[1]), unit: 'PERCENT' }));
    if (percent.length) return percent;
    return all(/\b((?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[-\s]+(?:one|two|three|four|five|six|seven|eight|nine))?|one hundred|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\s+percent\b/gi, (match) => {
      const number = spelledNumber(match[1]);
      return { canonical: number || null, unit: 'PERCENT' };
    });
  }
  if (kind === 'PERIOD') {
    // "forty-eight (48) hours": the parenthetical digits when the words
    // carry them, else the number words, compound ("forty-eight") included
    // (generation 6, 5.02: the notice period read "8 hours").
    return all(/\b(\d+|(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[-\s]+(?:one|two|three|four|five|six|seven|eight|nine))?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\s*(?:\((\d+)\)\s*)?(business days?|calendar days?|days?|months?|years?|hours?|weeks?)\b/gi, (match) => {
      const number = match[2] ? Number(match[2]) : (/^\d+$/.test(match[1]) ? Number(match[1]) : spelledNumber(match[1]));
      const unit = match[3].toLowerCase().replace(/s$/, '').replace(' ', '_').toUpperCase();
      return { canonical: number, unit };
    });
  }
  if (kind === 'DATE') {
    return all(new RegExp(`(${MONTHS.join('|')})\\s+(\\d{1,2}),\\s*(\\d{4})`, 'gi'), (match) => {
      const month = String(MONTHS.indexOf(match[1].toLowerCase()) + 1).padStart(2, '0');
      return { canonical: `${match[3]}-${month}-${String(match[2]).padStart(2, '0')}`, unit: 'ISO_DATE' };
    });
  }
  return [];
}

// One value from the matches: the only one; the deemed one when the text
// deems a stated value another; otherwise none (ambiguous).
function resolveValueMatches(matches, text) {
  const distinct = [];
  for (const match of matches) if (!distinct.some((entry) => entry.canonical === match.canonical && entry.unit === match.unit)) distinct.push(match);
  if (distinct.length === 0) return null;
  if (distinct.length === 1) return { canonical: distinct[0].canonical, unit: distinct[0].unit };
  const value = String(text || '');
  const first = Math.min(...matches.map((match) => match.index));
  const last = Math.max(...matches.map((match) => match.index));
  const deeming = [...value.matchAll(DEEMING_WORDS)].filter((match) => match.index > first && match.index < last).pop();
  if (!deeming) return null;
  const after = matches.filter((match) => match.index > deeming.index);
  if (after.length === 0 || after.some((match) => match.canonical !== after[0].canonical || match.unit !== after[0].unit)) return null;
  return { canonical: after[0].canonical, unit: after[0].unit };
}

function parseComponentValue(kind, text) {
  if (kind === 'COUNT') {
    const value = String(text || '');
    // A COUNT column (the capitalization table's authorised, issued and
    // reserved counts; Ben, 2026-09-14: "sure add a table"): the first plain
    // number of the cited words that is neither a money amount nor a
    // percentage ("800,000,000 shares of Company Common Stock"; "10,000,000
    // shares of preferred stock, par value $0.00001 per share" is ten
    // million, not the par value), else a number word with its digits.
    const plain = value.match(/(?:^|[^$0-9.,])([0-9][0-9,]*)(?![0-9,]*(?:\.[0-9]+)?\s*(?:%|percent))/);
    if (plain) return { canonical: Number(plain[1].replace(/,/g, '')), unit: 'COUNT' };
    const counted = value.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b\s*(?:\((\d+)\))?/i);
    if (counted) return { canonical: counted[2] ? Number(counted[2]) : NUMBER_WORDS[counted[1].toLowerCase()], unit: 'COUNT' };
    return noneCount(value);
  }
  return resolveValueMatches(componentValueMatches(kind, text), text);
}

// True when the text names two different values of the kind and no deeming
// form settles which one: the cell is left empty and noted.
function componentValueAmbiguous(kind, text) {
  const matches = componentValueMatches(kind, text);
  const distinct = new Set(matches.map((match) => `${match.canonical}|${match.unit}`));
  return distinct.size > 1 && resolveValueMatches(matches, text) === null;
}

// Builds a contract component tree from a model's proposed components.
// `resolve(component)` returns { span, context } for the quote (the caller
// supplies the byte resolution); `factId` seeds deterministic component ids.
function buildComponentTree({ modelComponents, resolve, factId, contentId }) {
  const problems = [];
  // The AMOUNT components whose words are a formula over defined terms
  // (work package 14): valued { canonical: null, unit: null, form:
  // 'FORMULA' }, reported by the caller as a note, never a hold.
  const formulas = [];
  // The AMOUNT components whose words name a reference quantity (work
  // package 18 (b)): valued { canonical: null, unit: null, form:
  // 'REFERENCE' }, reported by the caller as a note, never a hold.
  const references = [];
  function build(list, path, parentKind = null) {
    return (list || []).map((raw, index) => {
      const here = [...path, index];
      const where = here.join('.');
      const text = typeof raw?.quote === 'string' ? raw.quote : '';
      const resolved = text ? resolve(raw) : { span: null, context: { reason: 'EMPTY' } };
      if (!resolved.span) problems.push(`${where}: quote not found in source (${resolved.context?.reason || 'unknown'})`);
      // Model output sometimes names a kind by a near synonym (first V2 run,
      // 2026-09-12: PARTY, SUBJECT, LEGAL_STATUS). The unambiguous ones map
      // to the contract kind; anything else is still a problem.
      const givenKind = typeof raw?.kind === 'string' ? (KIND_SYNONYMS[raw.kind.toUpperCase()] || raw.kind.toUpperCase()) : raw?.kind;
      // A LIST_ELEMENT the model placed outside a LIST is an ordinary
      // operative term (generation 7, 3.18: one fact INVALID on two).
      const kind = KINDS.has(givenKind) ? (givenKind === 'LIST_ELEMENT' && parentKind !== 'LIST' ? 'TERM' : givenKind) : 'TERM';
      if (raw?.kind && !KINDS.has(givenKind)) problems.push(`${where}: unknown kind ${raw.kind}`);
      const origin = ORIGINS.has(raw?.origin) ? raw.origin : 'OWN';
      const component = {
        component_id: contentId('PRODUCT_FACT_COMPONENT/V2', { fact_id: factId, path: here, text, kind }),
        kind,
        label: typeof raw?.label === 'string' && raw.label.trim() ? raw.label.trim() : null,
        text,
        source_span_id: resolved.span?.source_span_id || raw?.source_span_id || null,
        start_byte: resolved.span?.start_byte ?? null,
        end_byte: resolved.span?.end_byte ?? null,
        origin,
        ...(origin !== 'OWN' ? { origin_structure_node_id: resolved.context?.component_structure_node_id || raw?.origin_structure_node_id || null } : {}),
        gap_before: raw?.gap_before === true,
        // A LITANY the model built with children and no members (generation
        // 6, 3.03, 3.15, 4.04) has its children's words as its members.
        ...(kind === 'LITANY' ? { members: Array.isArray(raw?.members) && raw.members.length ? raw.members.map(String)
          : (Array.isArray(raw?.children) ? raw.children.map((child) => String(child?.quote || child?.label || '')).filter(Boolean) : []) } : {}),
        ...(VALUE_KINDS.has(kind) ? { value: parseComponentValue(kind, text) ?? (kind === 'AMOUNT' && isFormulaValue(text) ? { ...FORMULA_VALUE } : kind === 'AMOUNT' && isReferenceValue(text) ? { ...REFERENCE_VALUE } : null) } : {}),
        ...(kind === 'CROSS_REFERENCE' || kind === 'DEFINED_TERM' ? { resolves_to: raw?.resolves_to || null } : {}),
        children: kind === 'LITANY' ? [] : build(raw?.children, here, kind),
      };
      if (VALUE_KINDS.has(kind) && !DESCRIPTIVE_VALUE_KINDS.has(kind) && !component.value) problems.push(`${where}: no parsable value in "${text}"`);
      if (component.value && component.value.form === 'FORMULA') formulas.push({ path: where, component_id: component.component_id, text });
      if (component.value && component.value.form === 'REFERENCE') references.push({ path: where, component_id: component.component_id, text });
      return component;
    });
  }
  const components = build(modelComponents, []);
  return { components: JSON.parse(JSON.stringify(components)), problems, formulas, references };
}

// Words of the fact's own operative text not covered by any OWN component
// (rule R9), as byte ranges relative to the canonical text.
function uncoveredRanges(fact, factStartByte, factEndByte) {
  const covered = [...walk(fact.components || [])]
    .map(([component]) => component)
    .filter((component) => component.origin === 'OWN' && Number.isSafeInteger(component.start_byte) && Number.isSafeInteger(component.end_byte))
    .map((component) => [component.start_byte, component.end_byte])
    .sort((left, right) => left[0] - right[0]);
  const gaps = [];
  let cursor = factStartByte;
  for (const [start, end] of covered) {
    if (start > cursor) gaps.push([cursor, start]);
    cursor = Math.max(cursor, end);
  }
  if (cursor < factEndByte) gaps.push([cursor, factEndByte]);
  return gaps;
}

module.exports = {
  contract, validateFactComponents, renderHeadline, renderLayer, uncoveredRanges, walk,
  parseComponentValue, componentValueAmbiguous, buildComponentTree, VALUE_KINDS, isFormulaValue, isReferenceValue, noneCount,
  headlineSummaryProblems, HEADLINE_SUMMARY_RULE, HEADLINE_SUMMARY_ASKED_WORDS, HEADLINE_SUMMARY_MAX_WORDS,
};
