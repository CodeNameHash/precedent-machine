import React from 'react';
import taxonomy from '../../../lib/taxonomy.js';
import { cardCode, cardFeatures, cardType, selectCards, textOf, valueText } from './card-utils.js';
import { voteStandard } from './vote-standard.js';

const { labelForCode, taxonomyForFeatureKey } = taxonomy;

// Rebuilt to match the pre-schema legacy render (dc46bef parent, see
// TermrRebuiltSummary / TERMR_CANONICAL): ONE consolidated table grouped by
// which side may exercise the right (Mutual / Buyer / Target), each row a
// canonical termination right with a short bullet list of its key negotiated
// terms -- not a flat concept-by-concept grid with a redundant Kind column.
// r13 (featureKey threading parity): each spec's `featureKeys` names the ONE
// registry attribute that actually DEFINES the row -- not every field
// keyTermsForRight() happens to append as a secondary annotation. 'outside'
// pulls outsideDate/extension/months/conditions into one prose block, but
// outsideDate is the row's own headline field (the others are qualifiers on
// it); same logic for curePeriod on the breach rows. 'superior' and
// 'recommend' get none: their key facts are genuinely derived/multi-source
// (a boolean-driven sentence, a trigger drawn from either of two attribute
// names) with no single field that IS the row -- per the sidebar's rule,
// those get the quieter "doesn't map to a single comparable feature" state
// rather than a misleading single-field comparison.
const TERMR_CANONICAL = [
  { key: 'mutual', label: 'Mutual consent', codes: ['TERMR-MUTUAL'], family: 'mutual', featureKeys: ['executionMethod'] },
  { key: 'outside', label: 'Outside / End Date', codes: ['TERMR-OUTSIDE', 'TERMR-EXTENSION'], family: 'mutual', featureKeys: ['outsideDate'] },
  { key: 'legal', label: 'Legal restraint / order', codes: ['TERMR-LEGAL'], family: 'mutual', featureKeys: ['restraintFinality'] },
  { key: 'vote', label: 'Stockholder vote not obtained', codes: ['TERMR-VOTE', 'TERMR-NOVOTE'], family: 'mutual', featureKeys: ['voteThreshold'] },
  { key: 'breachT', label: 'Company (Target) breach', codes: ['TERMR-BREACH-T'], family: 'buyer', featureKeys: ['curePeriod'] },
  { key: 'recommend', label: 'Change of Recommendation', codes: ['TERMR-RECOMMEND'], family: 'buyer' },
  { key: 'breachB', label: 'Parent (Buyer) breach', codes: ['TERMR-BREACH-B'], family: 'target', featureKeys: ['curePeriod'] },
  // WS-G T6: the Company's right to terminate for a Superior Proposal
  // (TERMR-SUPERIOR) no longer renders as its own standalone row here -- it
  // now renders INSIDE the Superior Proposal box in the No-Solicitation
  // section (nosol-section.config.js's 'nosol-superior' group, sourced from
  // nosol-fiduciary-termination), so it isn't duplicated across two
  // sections. See nosol-section.config.js's GROUP_DEFS for the fold-in.
];

const FAMILY_LABELS = {
  mutual: 'Mutual / Either Party',
  buyer: 'Buyer / Parent May Terminate',
  target: 'Company / Target May Terminate',
};
const FAMILY_ORDER = ['mutual', 'buyer', 'target'];

// The title/quote fallback below exists for ONE case: a genuine termination-
// rights card the classifier never subtyped, which carries neither the
// TERMINATION_RIGHT provision_type nor a TERMR code and would otherwise be
// invisible to this table. It is NOT a classifier. Run unguarded it also nets
// every card of every OTHER family that merely MENTIONS "superior proposal"
// -- and clauses that mention it are common: a no-shop/fiduciary-out covenant
// (NOSOL-*) and a termination-fee trigger clause (TERMF-*) both routinely
// describe termination "to accept a Superior Proposal". Once such a card is
// selected, familyGroups()/cardForCodes() can hand a rights row a foreign
// clause as its evidence.
//
// So the fallback is narrowed, not removed (same fix as
// termination-fees.config.js#isTerminationFee applied here): it applies only
// to a card NO family has claimed. A card already carrying another family's
// provision_type or canonical code belongs to that family, and a word match
// in its quote must never re-home it here.
const TERMR_TEXT_RE = /termination right|outside date|superior proposal/i;

// cardType() reads provision_type first and falls back to `type`; canonical
// rights cards carry 'TERMINATION_RIGHT' on the former and 'TERMR' on the
// latter (lib/canonical-v2/termination-product-projection.js), so both
// spellings count as this family's own.
const TERMR_CARD_TYPES = new Set(['TERMINATION_RIGHT', 'TERMR']);

function isClaimedByAnotherFamily(card) {
  const type = cardType(card);
  if (type && !TERMR_CARD_TYPES.has(type)) return true;
  const code = cardCode(card);
  return Boolean(code) && !code.startsWith('TERMR');
}

function isTerminationRight(card) {
  if (cardType(card) === 'TERMINATION_RIGHT' || cardCode(card).startsWith('TERMR')) return true;
  if (isClaimedByAnotherFamily(card)) return false;
  return TERMR_TEXT_RE.test(`${card?.short_title || ''} ${textOf(card)}`);
}

function isBoilerplateCard(card) {
  return /amendment|waiver|expenses|effect\s+of\s+termination|fees\s+and\s+expenses/i.test(String(card?.short_title || ''));
}

// Prefer a non-boilerplate card carrying this code; TERMR codes occasionally
// land on an amendment/expenses clause that happens to share the same
// canonical code as the substantive right.
function cardForCodes(cards, codes) {
  const matches = cards.filter((card) => codes.includes(cardCode(card)));
  if (!matches.length) return null;
  const nonBoiler = matches.filter((card) => !isBoilerplateCard(card));
  return (nonBoiler.length ? nonBoiler : matches)[0];
}

function readableValue(key, value) {
  const rendered = valueText(value);
  if (!rendered) return null;
  const code = value?.code || value?.value || (typeof value === 'string' ? value : null);
  const dict = taxonomyForFeatureKey(key);
  return (dict && code && labelForCode(String(code), dict)) || rendered;
}

// Compose the short "key terms" bullet list for a canonical right from its
// card's features -- the legacy TermrRebuiltSummary's termrKeyTerms(),
// trimmed to the fields available on the claims-backed card model. This
// stays a flat list of short strings for `row.value` (used for hover-quote
// highlighting and covered by existing tests) -- the VISIBLE cell no longer
// renders these strings as a bullet dump; see keyTermsNode() below.
function keyTermsForRight(key, card) {
  if (!card) return [];
  const f = cardFeatures(card);
  const bits = [];
  if (key === 'outside') {
    const outsideDate = readableValue('outsideDate', f.outsideDate || f.outsideDateISO);
    if (outsideDate) bits.push(`Outside date: ${outsideDate}`);
    const months = readableValue('outsideDateMonthsPostSigning', f.outsideDateMonthsPostSigning || f.outsideDateMonths);
    if (months) bits.push(`Period from signing: ${months}`);
    const extensionAvail = readableValue('extensionAvailable', f.extensionAvailable);
    const extensionMonths = readableValue('extensionMonths', f.extensionMonths || f.extensionPeriod);
    if (extensionMonths) bits.push(`Extension: ${extensionMonths}`);
    else if (extensionAvail) bits.push(`Extension available: ${extensionAvail}`);
    const extensionConditions = readableValue('outsideDateExtensionConditions', f.outsideDateExtensionConditions || f.extensionConditions);
    if (extensionConditions) bits.push(`Extension terms: ${extensionConditions}`);
  } else if (key === 'legal') {
    const finality = readableValue('restraintFinality', f.restraintFinality);
    bits.push(finality || 'Legal restraint in effect');
  } else if (key === 'vote') {
    const threshold = readableValue('voteThreshold', f.voteThreshold);
    bits.push(threshold ? `Required vote: ${threshold}` : 'Required stockholder vote not obtained');
  } else if (key === 'breachT' || key === 'breachB') {
    const cure = readableValue('curePeriod', f.curePeriod);
    if (cure) bits.push(`Cure period: ${cure}`);
    const standard = readableValue('breachStandard', f.breachStandard) || readableValue('materialityStandard', f.materialityStandard);
    if (standard) bits.push(standard);
    const fault = readableValue('faultBasedExclusion', f.faultBasedExclusion);
    if (fault) bits.push(`Fault-based carve-out: ${fault}`);
  } else if (key === 'superior') {
    const fee = readableValue('feeRequired', f.feeRequired);
    bits.push(fee ? `Termination fee payable: ${fee}` : 'No fee specified');
  } else if (key === 'recommend') {
    const trigger = readableValue('triggerEvents', f.triggerEvents || f.recommendationChangeTermination);
    if (trigger) bits.push(trigger);
    const preVote = readableValue('preVoteOnlyWindow', f.preVoteOnlyWindow);
    if (preVote) bits.push(`Available pre-stockholder-vote only: ${preVote}`);
  }
  if (bits.length === 0) {
    const mainConcept = readableValue('mainConcept', f.mainConcept) || readableValue('terminationTriggers', f.terminationTriggers);
    if (mainConcept) bits.push(mainConcept);
  }
  return bits;
}

// ---------------------------------------------------------------------------
// Pill-based cell rendering (replaces the old prose-bullet dump). Each
// canonical right renders a row of short "mini-label + pill" fact blocks
// (matching the REBUILD-SPECS.md global rule: tiny grey uppercase mini-label
// above the value) for its enum/quantitative signals, with any full-sentence
// prose (extension conditions, materiality standards, vote-requirement text)
// collapsed behind an always-closed "see text" <details>, never dumped
// inline. Falls back to a plain '·'-joined text line when no PillCell
// primitive is supplied (matches the fallback convention used by
// termination-fees.config.js's renderSignals()).
// ---------------------------------------------------------------------------

// Punchlist #34: the mini-label + enum-code combination ("Restraint
// finality: final-and-nonappealable") read as legal jargon stacked on
// jargon. The enum value IS the fact -- render it as one plain sentence
// fragment ("Final and unappealable") with no separate label header (see
// keyTermsNode's 'legal' branch below, which now calls addFact(null, ...)).
// Covers every restraintFinality enum member (any/final/final-and-
// nonappealable/permanent), not just the strict one -- and normalizes
// space/hyphen variants of the same raw text to the same key so freeform
// extraction text ("final and non-appealable") maps the same as the
// canonical enum code.
const RESTRAINT_FINALITY_LABELS = {
  any: 'Any legal restraint (need not be final)',
  final: 'Order must be final',
  'final-and-nonappealable': 'Final and unappealable',
  permanent: 'Permanent injunction or order',
};

// Punchlist T2 (round 3): the row must read ONLY "Final and unappealable"
// (or one of the other three enum phrases) -- no trailing text. Real
// extraction occasionally lands the verbatim clause sentence in this field
// instead of the short enum code (legacy free-text vocab), and the old
// humanizeToken() fallback below dumped that whole sentence into the cell
// as "trailing text" after what looked like a label. Match by KEYWORD
// (not just an exact normalized string) so both the clean enum code and a
// free-text sentence containing the same signal resolve to the same short
// phrase; anything that matches no known signal returns null rather than
// ever echoing the raw value.
function restraintFinalityLabel(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  const normalized = text.toLowerCase().replace(/\s+/g, '-').replace(/final-and-non-appealable/, 'final-and-nonappealable');
  if (RESTRAINT_FINALITY_LABELS[normalized]) return RESTRAINT_FINALITY_LABELS[normalized];
  const lower = text.toLowerCase();
  // Free-text clause sentences punctuate between "final" and "non-appealable"
  // ("a final, non-appealable order...") so this checks for the
  // non/unappealable signal alone -- it's the distinguishing term; "final" by
  // itself is also checked below for the standalone (non-strict) case.
  if (/non[\s-]*appealable|unappealable/.test(lower)) {
    return RESTRAINT_FINALITY_LABELS['final-and-nonappealable'];
  }
  if (/\bpermanent(?:ly)?\b/.test(lower)) return RESTRAINT_FINALITY_LABELS.permanent;
  if (/\bfinal\b/.test(lower)) return RESTRAINT_FINALITY_LABELS.final;
  if (/\bany\b/.test(lower)) return RESTRAINT_FINALITY_LABELS.any;
  return null;
}

// Appends a unit word ("months"/"days") to a bare number, leaving a value
// that already spells out the unit untouched (curePeriod is sometimes
// stored as "30" and sometimes as "30 days" depending on extraction vintage).
function withUnit(raw, unit) {
  const s = valueText(raw);
  if (!s) return null;
  return new RegExp(unit, 'i').test(s) ? s : `${s} ${unit}${/^1(\s|$)/.test(s) ? '' : 's'}`;
}

function formatIsoDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

// Vote-standard sniff now shared via ./vote-standard.js (one definition across
// conditions, votes-approvals-meeting, and termination-rights). The sole call
// site guards with `threshold && ...`, so the dropped `!def` early-return in
// the former local copy never changed output.

function isTruthy(raw) {
  return raw === true || raw === 'true' || raw === 'TRUE';
}

// label is optional -- a fact whose value is already self-explanatory (e.g.
// the 'legal' restraint-finality fact, punchlist #34) skips the mini-label
// header entirely rather than stacking a jargon term on top of its own
// plain-English value.
function miniBlock(label, node) {
  if (!node) return null;
  return React.createElement(
    'div',
    { className: 'space-y-0.5' },
    label ? React.createElement('div', { className: 'text-[10px] font-medium uppercase tracking-wider text-inkFaint' }, label) : null,
    node,
  );
}

function pillRow(PillCell, chips) {
  const valid = (chips || []).filter((chip) => chip && chip.label);
  if (!valid.length) return null;
  if (!PillCell) return React.createElement('span', { className: 'text-[11px] text-ink' }, valid.map((chip) => chip.label).join(' · '));
  return React.createElement(
    'div',
    { className: 'flex flex-wrap gap-1' },
    valid.map((chip, index) => React.createElement(PillCell, {
      key: chip.key || index,
      label: chip.label,
      tone: chip.tone || 'neutral',
      evidence: chip.evidence,
      source: chip.source,
    })),
  );
}

// Always-collapsed "see text" affordance (never inlines regardless of
// length -- distinct from TruncatedWithSeeText, which inlines short prose;
// full-sentence fields here must never dump inline per REBUILD-SPECS.md).
function proseSeeText(label, text) {
  if (!text) return null;
  return React.createElement(
    'details',
    { className: 'mt-1' },
    React.createElement('summary', { className: 'term-cell-seetext', style: { listStyle: 'none' } }, label ? `see ${label.toLowerCase()}` : 'See provision'),
    React.createElement(
      'div',
      { className: 'mt-1 max-w-[42rem] whitespace-pre-wrap break-words text-[11px] leading-5 text-inkLight' },
      text,
    ),
  );
}

function keyTermsNode(key, card, PillCell) {
  if (!card) return React.createElement('span', { className: 'italic text-inkFaint' }, 'Not present in this agreement');
  const f = cardFeatures(card);
  const factBlocks = [];
  const proseBlocks = [];
  const addFact = (label, chip) => { if (chip && chip.label) factBlocks.push({ label, chip }); };
  const addProse = (label, text) => { if (text) proseBlocks.push([label, text]); };

  if (key === 'outside') {
    const outsideDate = readableValue('outsideDate', f.outsideDate || f.outsideDateISO) || formatIsoDate(f.outsideDateISO);
    addFact('Outside date', outsideDate && { label: outsideDate, tone: 'info' });
    // Ben (Mergertrace round 3): make explicit that reaching the outside
    // date does NOT terminate automatically — a party must elect. Who may
    // elect comes from the extracted partyWhoCanTerminate tag; the
    // fault-based exclusion (breaching party can't use it) rides along.
    const whoRaw = f.partyWhoCanTerminate;
    const whoCode = String(whoRaw?.code || whoRaw?.value || whoRaw || '').toUpperCase();
    const WHO_LABELS = {
      PARTY_MUTUAL: 'Either party may elect (not automatic)',
      PARTY_COMPANY: 'Company may elect (not automatic)',
      PARTY_PARENT: 'Parent may elect (not automatic)',
      PARTY_TARGET: 'Company may elect (not automatic)',
      PARTY_BUYER: 'Parent may elect (not automatic)',
    };
    const whoLabel = WHO_LABELS[whoCode]
      || (whoRaw?.label ? `${whoRaw.label} may elect (not automatic)` : null);
    addFact('Exercised by', whoLabel && { label: whoLabel, tone: 'neutral' });
    if (f.faultBasedExclusion === true || f.faultBasedExclusion === 'true') {
      addFact(null, { label: 'Not available to a party whose breach caused the delay', tone: 'warning' });
    }
    const periodFromSigning = withUnit(readableValue('outsideDateMonthsPostSigning', f.outsideDateMonthsPostSigning || f.outsideDateMonths), 'month');
    addFact('Period from signing', periodFromSigning && { label: periodFromSigning, tone: 'neutral' });
    const extensionMonths = withUnit(readableValue('extensionMonths', f.extensionMonths || f.extensionPeriod), 'month');
    if (extensionMonths) {
      addFact('Extension', { label: extensionMonths, tone: 'info' });
    } else {
      const extensionAvail = readableValue('extensionAvailable', f.extensionAvailable);
      addFact('Extension', extensionAvail && { label: extensionAvail, tone: 'neutral' });
    }
    // Ben (Mergertrace round 3): make the extension MECHANISM explicit —
    // automatic (conditions-triggered, no election) vs a party's option,
    // and whose option. Derived deterministically from the extension
    // clause's own wording (Metsera: "the Outside Date shall automatically
    // be extended to June 21, 2026"); no match → no chip, the prose stays
    // behind "see extension terms".
    const extensionProse = [
      valueText(f.outsideDateExtensionConditions),
      valueText(f.extensionConditions),
      valueText(f.outsideDateExtension),
      textOf(card),
    ].filter(Boolean).join(' ');
    let extensionBy = null;
    if (/shall\s+(?:automatically\s+be|be\s+automatically)\s+extended|shall\s+automatically\s+extend/i.test(extensionProse)) {
      extensionBy = 'Automatic (no election required)';
    } else if (/(?:either|each)\s+(?:party|of\s+Parent\s+or\s+the\s+Company)[^.]{0,80}?may[^.]{0,40}?extend/i.test(extensionProse)) {
      extensionBy = 'Either party may elect to extend';
    } else {
      const single = extensionProse.match(/(Parent|the\s+Company|Company)[^.]{0,60}?may[^.]{0,40}?extend/i);
      if (single) extensionBy = `${/parent/i.test(single[1]) ? 'Parent' : 'Company'} may elect to extend`;
    }
    addFact('Extension by', extensionBy && { label: extensionBy, tone: extensionBy.startsWith('Automatic') ? 'info' : 'neutral' });
    const extendedTo = readableValue('extendedOutsideDate', f.extendedOutsideDate) || formatIsoDate(f.extendedOutsideDateISO);
    addFact('Extended to', extendedTo && { label: extendedTo, tone: 'info' });
    const extensionConditions = readableValue('outsideDateExtensionConditions', f.outsideDateExtensionConditions)
      || readableValue('outsideDateExtension', f.outsideDateExtension)
      || readableValue('extensionConditions', f.extensionConditions);
    addProse('Extension terms', extensionConditions);
  } else if (key === 'legal') {
    // Punchlist #34: no "Restraint finality" mini-label -- the plain-English
    // value (e.g. "Final and unappealable") already says everything the
    // label would have. Punchlist T2 (round 3): the fact chip must be ONE
    // of the fixed short phrases, never the raw restraintFinality value --
    // when a value is present but unrecognized, fall back to a fixed
    // generic phrase instead of leaking raw clause text as trailing content.
    const rawFinality = valueText(f.restraintFinality);
    const finality = restraintFinalityLabel(rawFinality) || (rawFinality ? 'Legal restraint in effect' : null);
    addFact(null, finality && { label: finality, tone: 'info' });
  } else if (key === 'vote') {
    const threshold = valueText(f.voteThreshold);
    const parsed = threshold && voteStandard(threshold);
    addFact('Vote threshold', (parsed || threshold) && { label: parsed || 'Stockholder vote not obtained', tone: 'warning' });
    addProse('Vote requirement', threshold);
  } else if (key === 'breachT' || key === 'breachB') {
    const cure = withUnit(valueText(f.curePeriod), 'day');
    addFact('Cure period', cure && { label: cure, tone: 'info' });
    const standard = valueText(f.breachStandard) || valueText(f.materialityStandard);
    addProse('Materiality standard', standard);
    const fault = f.faultBasedExclusion;
    if (fault !== undefined && fault !== null && fault !== '') {
      addFact('Fault-based carve-out', { label: isTruthy(fault) ? 'Yes' : 'No', tone: isTruthy(fault) ? 'present' : 'neutral' });
    }
  } else if (key === 'superior') {
    const fee = f.feeRequired;
    if (fee !== undefined && fee !== null && fee !== '') {
      addFact('Fee on exercise', { label: isTruthy(fee) ? 'Fee payable' : 'No fee specified', tone: isTruthy(fee) ? 'warning' : 'neutral' });
    }
    addProse('Exercise conditions', valueText(f.executionConditions));
  } else if (key === 'recommend') {
    const trigger = valueText(f.triggerEvents) || valueText(f.recommendationChangeTermination);
    addFact('Trigger', trigger && { label: 'Adverse Recommendation Change', tone: 'warning' });
    addProse('Trigger detail', trigger);
    const preVote = f.preVoteOnlyWindow;
    addFact('Window', preVote && { label: 'Pre-stockholder-vote only', tone: 'neutral' });
  } else if (key === 'mutual') {
    const method = valueText(f.executionMethod);
    addFact('Execution', method && { label: method, tone: 'neutral' });
    const consent = f.writtenConsentRequired;
    if (typeof consent === 'boolean' || consent === 'true' || consent === 'false') {
      addFact('Written consent', { label: isTruthy(consent) ? 'Required' : 'Not required', tone: isTruthy(consent) ? 'present' : 'neutral' });
    }
  }

  if (!factBlocks.length && !proseBlocks.length) {
    // Last-resort detail (no bespoke fact/prose branch above fired): prefer
    // the real clause text over mainConcept's one-sentence AI summary --
    // mirrors the IOC fix (textOf(c) || valueText(mainObligation)). Falls
    // back to the summary/terminationTriggers only when no quote was ever
    // captured on this card.
    const detail = textOf(card) || valueText(f.mainConcept) || valueText(f.terminationTriggers);
    addProse('Detail', detail);
  }
  if (!factBlocks.length && !proseBlocks.length) {
    return React.createElement('span', { className: 'italic text-inkFaint' }, 'Present, detail not extracted');
  }

  return React.createElement(
    'div',
    { className: 'space-y-1.5' },
    factBlocks.length
      ? React.createElement(
          'div',
          { className: 'flex flex-wrap gap-3' },
          factBlocks.map((block, index) => React.createElement(
            React.Fragment,
            { key: `fact-${index}` },
            miniBlock(block.label, pillRow(PillCell, [block.chip])),
          )),
        )
      : null,
    proseBlocks.map(([label, text], index) => React.createElement(
      React.Fragment,
      { key: `prose-${index}` },
      proseSeeText(label, text),
    )),
  );
}

function durationSubterm(key, label, featureKeys, unit, trigger, normalizer = 'deadline_duration', missingState = null) {
  const semantics = unit === 'months' || unit === 'years'
    ? { unit, calendarBasis: 'elapsed', trigger, requiredDimensions: ['unit'] }
    : {
      unit: 'days_equivalent',
      calendarBasis: 'mixed',
      trigger,
      requiredDimensions: ['unit', 'calendarBasis'],
      normalisation: { type: 'duration_to_days', hoursPerDay: 24 },
    };
  return {
    key,
    label,
    featureKeys,
    kind: 'duration',
    role: 'metric',
    value: {
      strategy: 'feature_value',
      featureKeys,
      normalizer,
      unit,
      trigger,
    },
    semantics,
    ...(missingState ? { missingState } : {}),
  };
}

function categoricalSubterm(key, label, featureKeys, kind = 'categorical') {
  return { key, label, featureKeys, kind };
}

function stockholderVoteSubterm() {
  return {
    key: 'vote-threshold',
    label: 'Required vote',
    featureKeys: ['definitionText'],
    kind: 'multi_select',
    provisionCodes: [],
    cohort: {
      scope: 'provision_family',
      provisionFamily: 'DEFINITION',
      eligibility: 'family_present',
    },
    observationScope: { definedTermIncludes: 'stockholder approval' },
    value: {
      strategy: 'feature_value',
      featureKeys: ['definitionText'],
      normalizer: 'stockholder_vote_standard',
    },
  };
}

function marketSubtermsForRight(key) {
  const entries = {
    mutual: [categoricalSubterm('execution-method', 'Execution method', ['executionMethod'])],
    outside: [
      durationSubterm(
        'outside-date',
        'Outside date from signing',
        ['outsideDateMonthsPostSigning', 'outsideDateMonths', 'outsideDate', 'outsideDateISO'],
        'months',
        'signing_date',
        'forward_period_months',
      ),
      categoricalSubterm('exercised-by', 'Exercised by', ['partyWhoCanTerminate']),
      categoricalSubterm('fault-exclusion', 'Fault-based exclusion', ['faultBasedExclusion']),
      categoricalSubterm('extension-available', 'Extension available', ['extensionAvailable']),
      durationSubterm('extension-length', 'Extension length', ['extensionMonths', 'extensionPeriod'], 'months', 'outside_date', 'period_months', 'absent'),
    ],
    legal: [categoricalSubterm('finality', 'Finality standard', ['restraintFinality'])],
    vote: [stockholderVoteSubterm()],
    breachT: [
      durationSubterm('cure-period', 'Cure period', ['curePeriod'], 'days', 'breach_notice'),
      categoricalSubterm('breach-standard', 'Breach standard', ['breachStandard', 'materialityStandard']),
      categoricalSubterm('fault-exclusion', 'Fault-based exclusion', ['faultBasedExclusion']),
    ],
    breachB: [
      durationSubterm('cure-period', 'Cure period', ['curePeriod'], 'days', 'breach_notice'),
      categoricalSubterm('breach-standard', 'Breach standard', ['breachStandard', 'materialityStandard']),
      categoricalSubterm('fault-exclusion', 'Fault-based exclusion', ['faultBasedExclusion']),
    ],
    recommend: [
      categoricalSubterm('trigger-events', 'Trigger events', ['triggerEvents', 'recommendationChangeTermination'], 'multi_select'),
      {
        key: 'pre-vote-only',
        label: 'Available only before the vote',
        featureKeys: ['preVoteOnlyWindow', 'mainConcept'],
        kind: 'categorical',
        value: {
          strategy: 'feature_value',
          featureKeys: ['preVoteOnlyWindow', 'mainConcept'],
          normalizer: 'pre_vote_only',
        },
      },
    ],
  };
  return entries[key] || [];
}

function isNativeGovernedCard(card) {
  return card?.canonical_v2_lineage?.source === 'CANONICAL_V2_NATIVE_CLAIM';
}

function governedMarketSubtermsForRight(key) {
  if (key === 'outside') {
    return [
      durationSubterm(
        'outside-date',
        'Outside date from signing',
        ['outsideDate', 'outsideDateISO'],
        'months',
        'signing_date',
        'forward_period_months',
      ),
      categoricalSubterm('exercised-by', 'Exercised by', ['partyWhoCanTerminate']),
    ];
  }
  if (key === 'breachT' || key === 'breachB') {
    return [durationSubterm('cure-period', 'Cure period', ['curePeriod'], 'days', 'breach_notice')];
  }
  return [
    categoricalSubterm('trigger', 'Termination trigger', ['terminationTriggers']),
    categoricalSubterm('exercised-by', 'Exercised by', ['partyWhoCanTerminate']),
  ];
}

function governedHeadlineFeatureKeys(key) {
  if (key === 'outside') return ['outsideDate'];
  if (key === 'breachT' || key === 'breachB') return ['curePeriod'];
  if (key === 'mutual') return ['partyWhoCanTerminate'];
  return ['terminationTriggers'];
}

function rowForSpec(spec, cards, PillCell) {
  const card = cardForCodes(cards, spec.codes);
  const terms = keyTermsForRight(spec.key, card);
  const sourceText = card ? textOf(card) : null;
  return {
    id: `termination-rights-${spec.key}`,
    spec,
    label: spec.label,
    value: terms,
    evidence: sourceText,
    seeTextContent: sourceText,
    source: card,
    // Item 2 (r5): resolveRowCard reads card/sourceCard/sourceCards --
    // `source` above is the HoverSource-popover contract, this is the
    // ClauseSidebar click-through one.
    sourceCard: card,
    present: Boolean(card),
    marketProvisionCodes: spec.codes,
    marketSubterms: isNativeGovernedCard(card)
      ? governedMarketSubtermsForRight(spec.key)
      : marketSubtermsForRight(spec.key),
    // r13: see TERMR_CANONICAL's comment -- only threaded for specs whose
    // row is actually defined by one registry attribute.
    featureKeys: isNativeGovernedCard(card)
      ? governedHeadlineFeatureKeys(spec.key)
      : spec.featureKeys || null,
    children: keyTermsNode(spec.key, card, PillCell),
  };
}

// willfulBreachException / specificPerformanceMutual live on TERMF-* /
// MISC-* cards (not TERMR-*), so isTerminationRight() never selects their
// card and the 8 canonical TERMR_CANONICAL rows never see them --
// willfulBreachException already has a home under termination-fees, but
// neither attribute previously had one here. Search the UNFILTERED card
// list for these two cross-cutting remedy attributes and append them as
// their own group when present, rather than folding them into the
// code-matched TERMR_CANONICAL rows above.
//
// Owner ruling (2026-08-05): willfulBreachException is the SAME feature key
// on two cards that mean legally distinct things -- TERMF-EFFECT ("Willful
// Breach Carve-out", rubric.js ~3627) is a carve-out to the
// effect-of-termination survival rule (liability survives termination);
// TERMF-SOLE ("Willful Breach Carve-out to Sole Remedy", rubric.js ~3634)
// is a carve-out to the fee-as-damages cap. An agreement can carry either
// without the other, and they allocate different risk.
// termination-fees.config.js's SCALAR_ROWS split this into two rows earlier
// the same day ('willful-breach-effect' / 'willful-breach-sole'); this
// table's single row was, at the time, only narrowed to TERMF-SOLE -- the
// ruling had named the fee table's row specifically, and extending it to
// this differently-labelled row was not this fix's call to make. That
// narrowing traded a wrong answer (card order silently deciding which fact
// showed under a single label) for a gap (an EFFECT-only deal showed
// nothing in this group at all). Asked whether to extend the split here
// too, the owner ruled yes -- so the row below is split the same way,
// mirroring the fee table's mechanism exactly: each entry carries its own
// 4th tuple element (sourceCode), read by crossCuttingRow() below, which
// scopes the lookup to cards of that EXACT code before the first-match
// search runs, so neither row can ever read the other's card even though
// both share the willfulBreachException key.
//
// specific-performance-mutual carries no such split: rubric.js declares
// specificPerformanceMutual exactly once (~4597, no per-code variants), so an
// unscoped search carries no risk of silently reading the wrong of two
// distinct facts and is left as-is.
const CROSS_CUTTING_ROWS = [
  ['willful-breach-effect', 'Willful-breach carve-out', ['willfulBreachException'], 'TERMF-EFFECT'],
  ['willful-breach-sole', 'Willful-breach carve-out to sole remedy', ['willfulBreachException'], 'TERMF-SOLE'],
  ['specific-performance-mutual', 'Specific performance available to both parties', ['specificPerformanceMutual']],
];

// Owner ruling (2026-08-05): "Fee required to terminate" (feeRequired) moves
// here from termination-fees.config.js. It means payment is a condition
// precedent to exercising the fiduciary out, not that a fee is payable --
// lib/schema/features.js:6493 already scopes it to provisionTypes: ["TERMR"],
// provisionCodes: ["TERMR-SUPERIOR"], displayGroup: "Fiduciary out", so the
// registry always said it belonged here; only the display drifted.
//
// TERMR-SUPERIOR cards ARE selected by isTerminationRight() (code starts
// with TERMR), but WS-G T6 removed 'superior' from TERMR_CANONICAL -- that
// right's own narrative now renders inside the No-Solicitation section's
// Superior Proposal box (nosol-section.config.js), not here, so re-adding a
// 'superior' family row would duplicate it. And in practice today's stored
// feeRequired values sit on whatever card the extraction pipeline attached
// them to (frequently a TERMF-* fee card, per the old fee-table row this
// replaces) rather than reliably on a TERMR-SUPERIOR card -- the same
// cross-family drift willfulBreachException/specificPerformanceMutual have.
// So this is searched the same way: the UNFILTERED card list, via
// crossCuttingRow(), never folded into a TERMR_CANONICAL family row.
//
// terminationFeeRequired is carried over from the old fee-table row's alias
// list (components/review/table-configs/termination-fees.config.js's former
// SCALAR_ROWS 'required' entry) though nothing in the corpus writes it today.
const FIDUCIARY_OUT_CROSS_CUTTING_ROWS = [
  ['fee-required', 'Fee required to terminate', ['feeRequired', 'terminationFeeRequired']],
];

function firstCardWithFeature(cards, keys) {
  for (const card of cards || []) {
    const f = cardFeatures(card);
    for (const key of keys) {
      if (valueText(f[key]) !== null) return { card, key, raw: f[key] };
    }
  }
  return null;
}

function crossCuttingRow(id, label, allCards, keys, PillCell, sourceCode) {
  // sourceCode (see CROSS_CUTTING_ROWS' 'willful-breach' entry) scopes the
  // lookup to cards carrying that EXACT canonical code before the
  // first-match search runs, so a row backed by a code-ambiguous feature key
  // can never read a different code's card even though they share the key --
  // undefined for every spec that carries no such ambiguity, which keeps the
  // search exactly as unfiltered as before for those.
  const pool = sourceCode ? (allCards || []).filter((card) => cardCode(card) === sourceCode) : allCards;
  const hit = firstCardWithFeature(pool, keys);
  if (!hit) return { id: `termination-rights-${id}`, label, present: false };
  const detail = readableValue(hit.key, hit.raw);
  const terms = detail ? [detail] : [];
  const truthy = isTruthy(hit.raw);
  const sourceText = textOf(hit.card);
  const chip = detail ? { label: truthy ? 'Yes' : detail, tone: truthy ? 'present' : 'neutral', evidence: sourceText } : null;
  return {
    id: `termination-rights-${id}`,
    label,
    value: terms,
    evidence: sourceText,
    seeTextContent: sourceText,
    source: hit.card,
    sourceCard: hit.card,
    present: true,
    // r13: CROSS_CUTTING_ROWS' `keys` arg is a single-attribute lookup list
    // (willfulBreachException / specificPerformanceMutual) -- hit.key is
    // exactly the one registry attribute this row IS, so it's always a
    // clean 1:1 thread (unlike the family rows above, which need per-spec
    // curation).
    featureKeys: [hit.key],
    children: pillRow(PillCell, [chip]) || React.createElement('span', { className: 'italic text-inkFaint' }, 'Present, detail not extracted'),
  };
}

// Shared by every cross-reference group (remedies, fiduciary-out, ...): built
// from a spec list via crossCuttingRow(), filtered to what actually matched,
// collapsing to `null` (no group at all) rather than an empty one.
function crossReferenceGroup(id, label, allCards, specs, PillCell) {
  const rows = specs
    .map(([rowId, rowLabel, keys, sourceCode]) => crossCuttingRow(rowId, rowLabel, allCards, keys, PillCell, sourceCode))
    .filter((row) => row.present);
  if (!rows.length) return null;
  return { id, label, rows };
}

function crossCuttingGroup(reviewDeal, PillCell) {
  const allCards = reviewDeal?.cards || [];
  return crossReferenceGroup('remedies', 'Remedies (cross-reference)', allCards, CROSS_CUTTING_ROWS, PillCell);
}

// feeRequired's own group (not folded into "Remedies"): a condition
// precedent to the fiduciary out is not a remedy, and mislabelling it as one
// is exactly the kind of conflation this owner ruling is fixing elsewhere in
// this file -- see FIDUCIARY_OUT_CROSS_CUTTING_ROWS above.
function fiduciaryOutGroup(reviewDeal, PillCell) {
  const allCards = reviewDeal?.cards || [];
  return crossReferenceGroup('fiduciary-out', 'Fiduciary out (cross-reference)', allCards, FIDUCIARY_OUT_CROSS_CUTTING_ROWS, PillCell);
}

function familyGroups(cards, PillCell) {
  return FAMILY_ORDER
    .map((family) => ({
      id: family,
      label: FAMILY_LABELS[family],
      rows: TERMR_CANONICAL.filter((spec) => spec.family === family).map((spec) => rowForSpec(spec, cards, PillCell)),
    }))
    .filter((group) => group.rows.some((row) => row.present));
}

function deferredEvidenceGroup(cards) {
  const rows = cards
    .filter((card) => card?.canonical_v2_lineage?.source === 'CANONICAL_V2_OPEN_WORLD_EVIDENCE')
    .map((card, index) => {
      const evidence = cardFeatures(card).canonicalV2OpenWorldEvidence || {};
      const surface = String(evidence.surface || 'UNCLASSIFIED').replaceAll('_', ' ').toLowerCase();
      return {
        id: `termination-rights-deferred-${card.id || index}`,
        label: surface.charAt(0).toUpperCase() + surface.slice(1),
        value: evidence.detail ? [evidence.detail] : [],
        evidence: textOf(card),
        seeTextContent: textOf(card),
        source: card,
        sourceCard: card,
        present: true,
        children: React.createElement('span', { className: 'text-[11px] text-inkLight' }, evidence.detail || 'Evidence retained for later adjudication'),
      };
    });
  return rows.length ? { id: 'deferred-evidence', label: 'Deferred evidence', rows } : null;
}

function buildGroups(reviewDeal, cards, PillCell) {
  const groups = familyGroups(cards, PillCell);
  const remedies = crossCuttingGroup(reviewDeal, PillCell);
  if (remedies) groups.push(remedies);
  const fiduciaryOut = fiduciaryOutGroup(reviewDeal, PillCell);
  if (fiduciaryOut) groups.push(fiduciaryOut);
  const deferred = deferredEvidenceGroup(cards);
  if (deferred) groups.push(deferred);
  return groups;
}

const terminationRightsConfig = {
  id: 'termination-rights',
  title: 'Termination Rights',
  layoutSlot: 'termination',
  selectRows(reviewDeal) {
    const cards = selectCards(reviewDeal, isTerminationRight);
    const groups = buildGroups(reviewDeal, cards);
    if (!groups.length) return [];
    return [{ id: 'termination-rights-body', groups, cards, reviewDeal }];
  },
  columns: [
    {
      id: 'body',
      header: '',
      renderCell(row, ctx) {
        const GroupedSubRows = ctx?.primitives?.GroupedSubRows;
        if (!GroupedSubRows) return null;
        // Re-derive the groups with the live PillCell primitive so the cell
        // renders clean pills; selectRows() already computed row.groups
        // without a primitives context (it runs before ctx exists), so that
        // pre-built version is the fallback when no PillCell is supplied.
        const PillCell = ctx?.primitives?.PillCell;
        const groups = PillCell ? buildGroups(row.reviewDeal, row.cards, PillCell) : row.groups;
        // Item 2 (r5): same onSelectCard/resolveCard/selectedCardId wiring
        // as conditions.config.js/ioc-exceptions.config.js.
        return React.createElement(GroupedSubRows, {
          groups,
          emptyCopy: 'No termination rights found.',
          onSelectCard: ctx.onSelectCard,
          resolveCard: ctx.resolveCard,
          selectedCardId: ctx.selectedCardId,
        });
      },
    },
  ],
};

export {
  CROSS_CUTTING_ROWS,
  FAMILY_LABELS,
  FIDUCIARY_OUT_CROSS_CUTTING_ROWS,
  TERMR_CANONICAL,
  buildGroups,
  crossCuttingGroup,
  familyGroups,
  fiduciaryOutGroup,
  deferredEvidenceGroup,
  isTerminationRight,
  keyTermsForRight,
  rowForSpec,
  terminationRightsConfig,
};
