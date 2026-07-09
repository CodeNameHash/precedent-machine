import React from 'react';
import taxonomy from '../../../lib/taxonomy.js';
import { cardCode, cardFeatures, cardType, selectCards, textOf, valueText } from './card-utils.js';

const { labelForCode, taxonomyForFeatureKey } = taxonomy;

// Rebuilt to match the pre-schema legacy render (dc46bef parent, see
// TermrRebuiltSummary / TERMR_CANONICAL): ONE consolidated table grouped by
// which side may exercise the right (Mutual / Buyer / Target), each row a
// canonical termination right with a short bullet list of its key negotiated
// terms -- not a flat concept-by-concept grid with a redundant Kind column.
const TERMR_CANONICAL = [
  { key: 'mutual', label: 'Mutual consent', codes: ['TERMR-MUTUAL'], family: 'mutual' },
  { key: 'outside', label: 'Outside / End Date', codes: ['TERMR-OUTSIDE', 'TERMR-EXTENSION'], family: 'mutual' },
  { key: 'legal', label: 'Legal restraint / order', codes: ['TERMR-LEGAL'], family: 'mutual' },
  { key: 'vote', label: 'Stockholder vote not obtained', codes: ['TERMR-VOTE'], family: 'mutual' },
  { key: 'breachT', label: 'Company (Target) breach', codes: ['TERMR-BREACH-T'], family: 'buyer' },
  { key: 'recommend', label: 'Change of Recommendation', codes: ['TERMR-RECOMMEND'], family: 'buyer' },
  { key: 'breachB', label: 'Parent (Buyer) breach', codes: ['TERMR-BREACH-B'], family: 'target' },
  { key: 'superior', label: 'Superior Proposal', codes: ['TERMR-SUPERIOR'], family: 'target' },
];

const FAMILY_LABELS = {
  mutual: 'Mutual / Either Party',
  buyer: 'Buyer / Parent May Terminate',
  target: 'Company / Target May Terminate',
};
const FAMILY_ORDER = ['mutual', 'buyer', 'target'];

function isTerminationRight(card) {
  return cardType(card) === 'TERMINATION_RIGHT' || cardCode(card).startsWith('TERMR') || /termination right|outside date|superior proposal/i.test(`${card?.short_title || ''} ${textOf(card)}`);
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
    bits.push(finality ? `Order must be final & non-appealable: ${finality}` : 'Legal restraint in effect');
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

const RESTRAINT_FINALITY_LABELS = {
  'final-and-nonappealable': 'Final & non-appealable',
  'final-and-non-appealable': 'Final & non-appealable',
};

function humanizeToken(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/\s/.test(s)) return s.replace(/^./, (c) => c.toUpperCase());
  return s.replace(/[_-]+/g, ' ').trim().replace(/^./, (c) => c.toUpperCase());
}

function restraintFinalityLabel(raw) {
  if (!raw) return null;
  const key = String(raw).toLowerCase();
  return RESTRAINT_FINALITY_LABELS[key] || humanizeToken(raw);
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

// Lightweight vote-standard sniff (mirrors conditions.config.js's local
// voteStandard() at a smaller scope -- that helper isn't exported, so this
// stays a local duplicate rather than a new cross-config dependency).
function parseVoteStandard(text) {
  const t = String(text || '').toLowerCase();
  if (/two-?thirds|2\/3|66\s*2\/3|sixty-?six and two-?thirds/.test(t)) return 'Two-thirds of outstanding shares';
  if (/majority of (the )?(issued and )?outstanding/.test(t)) return 'Majority of outstanding shares';
  if (/majority of[^.]*(votes? cast|voting power)/.test(t)) return 'Majority of voting power';
  if (/majority/.test(t)) return 'Majority stockholder approval';
  return null;
}

function isTruthy(raw) {
  return raw === true || raw === 'true' || raw === 'TRUE';
}

function miniBlock(label, node) {
  if (!node) return null;
  return React.createElement(
    'div',
    { className: 'space-y-0.5' },
    React.createElement('div', { className: 'text-[10px] font-medium uppercase tracking-wider text-inkFaint' }, label),
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
    React.createElement('summary', { className: 'term-cell-seetext', style: { listStyle: 'none' } }, label ? `see ${label.toLowerCase()}` : 'see text'),
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
    const periodFromSigning = withUnit(readableValue('outsideDateMonthsPostSigning', f.outsideDateMonthsPostSigning || f.outsideDateMonths), 'month');
    addFact('Period from signing', periodFromSigning && { label: periodFromSigning, tone: 'neutral' });
    const extensionMonths = withUnit(readableValue('extensionMonths', f.extensionMonths || f.extensionPeriod), 'month');
    if (extensionMonths) {
      addFact('Extension', { label: extensionMonths, tone: 'info' });
    } else {
      const extensionAvail = readableValue('extensionAvailable', f.extensionAvailable);
      addFact('Extension', extensionAvail && { label: extensionAvail, tone: 'neutral' });
    }
    const extendedTo = readableValue('extendedOutsideDate', f.extendedOutsideDate) || formatIsoDate(f.extendedOutsideDateISO);
    addFact('Extended to', extendedTo && { label: extendedTo, tone: 'info' });
    const extensionConditions = readableValue('outsideDateExtensionConditions', f.outsideDateExtensionConditions)
      || readableValue('outsideDateExtension', f.outsideDateExtension)
      || readableValue('extensionConditions', f.extensionConditions);
    addProse('Extension terms', extensionConditions);
  } else if (key === 'legal') {
    const finality = restraintFinalityLabel(valueText(f.restraintFinality));
    addFact('Restraint finality', finality && { label: finality, tone: 'info' });
  } else if (key === 'vote') {
    const threshold = valueText(f.voteThreshold);
    const parsed = threshold && parseVoteStandard(threshold);
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
    const mainConcept = valueText(f.mainConcept) || valueText(f.terminationTriggers);
    addProse('Detail', mainConcept);
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

function rowForSpec(spec, cards, PillCell) {
  const card = cardForCodes(cards, spec.codes);
  const terms = keyTermsForRight(spec.key, card);
  return {
    id: `termination-rights-${spec.key}`,
    spec,
    label: spec.label,
    value: terms,
    evidence: card ? textOf(card) : null,
    source: card,
    present: Boolean(card),
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
const CROSS_CUTTING_ROWS = [
  ['willful-breach', 'Willful-breach exception (to sole remedy / fee)', ['willfulBreachException']],
  ['specific-performance-mutual', 'Specific performance available to both parties', ['specificPerformanceMutual']],
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

function crossCuttingRow(id, label, allCards, keys, PillCell) {
  const hit = firstCardWithFeature(allCards, keys);
  if (!hit) return { id: `termination-rights-${id}`, label, present: false };
  const detail = readableValue(hit.key, hit.raw);
  const terms = detail ? [detail] : [];
  const truthy = isTruthy(hit.raw);
  const chip = detail ? { label: truthy ? 'Yes' : detail, tone: truthy ? 'present' : 'neutral', evidence: textOf(hit.card) } : null;
  return {
    id: `termination-rights-${id}`,
    label,
    value: terms,
    evidence: textOf(hit.card),
    source: hit.card,
    present: true,
    children: pillRow(PillCell, [chip]) || React.createElement('span', { className: 'italic text-inkFaint' }, 'Present, detail not extracted'),
  };
}

function crossCuttingGroup(reviewDeal, PillCell) {
  const allCards = reviewDeal?.cards || [];
  const rows = CROSS_CUTTING_ROWS
    .map(([id, label, keys]) => crossCuttingRow(id, label, allCards, keys, PillCell))
    .filter((row) => row.present);
  if (!rows.length) return null;
  return { id: 'remedies', label: 'Remedies (cross-reference)', rows };
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

function buildGroups(reviewDeal, cards, PillCell) {
  const groups = familyGroups(cards, PillCell);
  const remedies = crossCuttingGroup(reviewDeal, PillCell);
  if (remedies) groups.push(remedies);
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
        return React.createElement(GroupedSubRows, { groups, emptyCopy: 'No termination rights found.' });
      },
    },
  ],
};

export {
  CROSS_CUTTING_ROWS,
  FAMILY_LABELS,
  TERMR_CANONICAL,
  crossCuttingGroup,
  familyGroups,
  keyTermsForRight,
  rowForSpec,
  terminationRightsConfig,
};
