import React from 'react';
import { cardCode, cardFeatures, cardType, firstFeature, selectCards, textOf } from './card-utils.js';
import p0Routing from '../../../lib/canonical-v2/p0-product-surface-routing.js';
import { DARK_PREVIEW_MARKET_STATE, isCanonicalV2PreviewEnabled } from './canonical-v2-preview-lane.js';

const { isDedicatedFamilyCovenantCode, routeGeneralCovenantCode } = p0Routing;
const NATIVE_SOURCE = 'CANONICAL_V2_NATIVE_CLAIM';
const EVIDENCE_SOURCE = 'CANONICAL_V2_OPEN_WORLD_EVIDENCE';
const DARK_AUTHORITY_STATE = 'VALIDATED_NOT_SERVED';

// Dark Canonical V2 preview only -- see lib/canonical-v2/general-covenants-
// dark-bridge.js. A card only ever carries this when something upstream
// explicitly called mergeCanonicalV2CardsIntoReviewDeal (no route under
// pages/ does), so this is inert for every reviewDeal built by the live
// product today.
function isDarkV2Card(card) {
  return card?.authority_state === DARK_AUTHORITY_STATE;
}

// REBUILD-SPECS.md section 6: interim-operating-covenant content (ordinary
// course, negative-covenant restrictions, affirmative limbs) is owned
// entirely by ioc-exceptions.config.js's grouped covenant table. The 5
// curated ROWS below are the genuine COVENANT_OTHER concepts that live in
// THIS section (§6.01-6.11-style general covenants, not the §5.01 IOC list).
const ROWS = [
  ['efforts', 'General efforts standard', ['effortsStandard', 'reasonableBestEfforts']],
  ['access', 'Access / information rights', ['accessRights', 'informationAccess']],
  ['public-statements', 'Public statements', ['publicStatements', 'publicStatementExceptions']],
  ['insurance', 'D&O / insurance covenant', ['insuranceCap', 'insurancePeriod', 'doInsurance']],
];

const GENERAL_COVENANT_RENDERED_DEDICATED_CODES = new Set(['COV-DO']);

// FEEDBACK-2-PUNCHLIST.md #13/#31/#32: stockholders-meeting mechanics
// (COV-MEETING / COV-PROXY -- already owned by sec-meeting.config.js) and
// Parent's adoption of the merger agreement (COV-SHAPRV-PARENT, now
// rendered on votes-approvals-meeting.config.js as its own "Parent / Merger
// Sub approvals" row) belong in Votes / Approvals / SEC / Meeting, not here.
// Excluded up front so neither ever falls through to the per-clause
// fallback below and double-renders on both pages.
const VOTES_OWNED_CODES = new Set(['COV-MEETING', 'COV-PROXY', 'COV-SHAPRV-PARENT']);

// Deliberately excludes COVENANT_INTERIM_OPERATING / IOC-prefixed cards
// (ioc-exceptions.config.js owns those) and drops the old free-text regex
// fallback -- that fallback was matching the MISC_BOILERPLATE §9.01 "No
// Survival / Nonsurvival" card (its repsSurvivalExceptions clause contains
// the word "covenant") into this table as a bogus "No survival" row.
function isGeneralCovenant(card) {
  const type = cardType(card);
  const code = cardCode(card);
  if (type === 'COVENANT_INTERIM_OPERATING' || code.startsWith('IOC')) return false;
  if (VOTES_OWNED_CODES.has(code)) return false;
  if (isDedicatedFamilyCovenantCode(code) && !GENERAL_COVENANT_RENDERED_DEDICATED_CODES.has(code)) return false;
  return type === 'COVENANT_OTHER' || code.startsWith('COV');
}

function clauseLabel(card) {
  return card?.short_title || card?.defined_term || cardCode(card) || 'Covenant';
}

function trueFeature(key, label) {
  return {
    key,
    label,
    featureKeys: [key],
    kind: 'presence',
    presence: { strategy: 'feature_matches', featureKeys: [key], values: [true], missingState: 'absent' },
  };
}

function covenantTreatments(profile, featureKeys = ['mainConcept']) {
  return {
    key: 'treatments',
    label: 'Provision treatments',
    featureKeys,
    kind: 'multi_select',
    value: { strategy: 'feature_value', featureKeys, normalizer: 'covenant_treatments', profile },
  };
}

function generalCovenantMarket(card) {
  const code = cardCode(card);
  const features = cardFeatures(card);
  if (card?.canonical_v2_lineage?.source === NATIVE_SOURCE
    && routeGeneralCovenantCode(code).route_state === 'NARROW_FOLLOW_ON') {
    return { marketProvisionCodes: [code] };
  }
  const title = String(card?.short_title || '');
  const uncodedProfile = !code && /control of operations/i.test(title)
    ? { profile: 'controlOperations', rowKey: 'general-covenants-control-of-operations', shortTitleIncludes: 'Control of Operations' }
    : !code && /board appointment/i.test(title)
      ? { profile: 'boardAppointment', rowKey: 'general-covenants-parent-board-appointment', shortTitleIncludes: 'Board Appointment' }
      : null;
  let subterms = [];
  if (code === 'COV-DO') {
    subterms = [
      {
        key: 'tail-period',
        label: 'D&O protection period',
        featureKeys: ['indemnificationPeriod'],
        kind: 'duration',
        value: { strategy: 'feature_value', featureKeys: ['indemnificationPeriod'], normalizer: 'deadline_duration', unit: 'years', trigger: 'closing' },
        semantics: { unit: 'years', calendarBasis: 'elapsed', trigger: 'closing', requiredDimensions: ['unit'] },
      },
      {
        key: 'insurance-cap',
        label: 'Tail premium cap',
        featureKeys: ['insuranceCap'],
        kind: 'numeric',
        value: { strategy: 'feature_value', featureKeys: ['insuranceCap'], normalizer: 'insurance_cap_multiplier' },
        semantics: { unit: 'multiplier' },
      },
      trueFeature('advancementOfExpenses', 'Advancement of expenses'),
    ];
  } else if (code === 'COV-FINANCING') {
    subterms = [
      trueFeature('financingCooperationPresent', 'Financing cooperation required'),
      {
        key: 'scope',
        label: 'Financing cooperation scope',
        featureKeys: ['financingCooperationScope', 'mainConcept'],
        kind: 'multi_select',
        value: { strategy: 'feature_value', featureKeys: ['financingCooperationScope', 'mainConcept'], normalizer: 'financing_scope' },
      },
      trueFeature('financingCooperationBreachIsCondition', 'Breach is a closing condition'),
    ];
  } else if (code === 'COV-PUBLICITY') {
    subterms = [
      trueFeature('publicStatementsJointApproval', 'Joint approval required'),
      trueFeature('publicStatementsCarveoutCompany', 'Company announcement carve-out'),
      trueFeature('publicStatementsCarveoutParent', 'Parent announcement carve-out'),
    ];
  } else if (code === 'COV-EMPLOYEE') {
    const periodKeys = ['protectionPeriodMonths', 'employeeBenefitPeriod', 'protectionPeriod'];
    subterms = [
      {
        key: 'protection-period',
        label: 'Protection period',
        featureKeys: periodKeys,
        kind: 'duration',
        value: { strategy: 'feature_value', featureKeys: periodKeys, normalizer: 'employee_benefit_period' },
        semantics: { unit: 'months', calendarBasis: 'elapsed', trigger: 'closing', requiredDimensions: ['unit'] },
      },
      trueFeature('continuedService', 'Continued service credit'),
      trueFeature('eligibilityWaiver', 'Eligibility waiver'),
      {
        key: '401k-treatment',
        label: '401(k) treatment included',
        featureKeys: ['continued401k'],
        kind: 'presence',
        presence: { strategy: 'feature_non_empty', featureKeys: ['continued401k'], missingState: 'absent' },
      },
      {
        key: 'severance-protection',
        label: 'Severance protection included',
        featureKeys: ['severanceProtection'],
        kind: 'presence',
        presence: { strategy: 'feature_non_empty', featureKeys: ['severanceProtection'], missingState: 'absent' },
      },
    ];
  } else if (code === 'COV-ACCESS') {
    subterms = [{
      key: 'scope',
      label: 'Access scope',
      featureKeys: ['accessScope'],
      kind: 'categorical',
    }];
  } else if (uncodedProfile) {
    subterms = [covenantTreatments(uncodedProfile.profile)];
  } else {
    const profiles = {
      'COV-TAKEOVER': 'takeover',
      'COV-LITNOTIFY': 'litigation',
      'COV-16B': 'section16',
      'COV-FURTHER': 'further',
      'COV-NOTIFY': 'notification',
      'COV-TAXMATTERS': 'tax',
      'COV-DELIST': 'delisting',
      'COV-LIST': 'listing',
    };
    if (profiles[code]) subterms = [covenantTreatments(profiles[code])];
  }
  const usedKeys = new Set(subterms.flatMap((subterm) => subterm.featureKeys || []));
  const addStructured = (key, label, kind = 'categorical') => {
    if (!Object.prototype.hasOwnProperty.call(features, key) || usedKeys.has(key)) return;
    subterms.unshift(kind === 'presence' ? trueFeature(key, label) : {
      key,
      label,
      featureKeys: [key],
      kind,
    });
    usedKeys.add(key);
  };
  addStructured('effortsStandard', 'Efforts standard');
  addStructured('reasonableBestEfforts', 'Reasonable-best-efforts obligation', 'presence');
  addStructured('accessRights', 'Access rights');
  addStructured('informationAccess', 'Information access');
  addStructured('publicStatements', 'Public-statement treatment');
  addStructured('publicStatementExceptions', 'Public-statement exceptions', 'multi_select');
  addStructured('doInsurance', 'D&O insurance required', 'presence');
  if ((!code && !uncodedProfile) || !subterms.length) return {};
  return {
    featureKeys: [...new Set(subterms.flatMap((subterm) => subterm.featureKeys || []))],
    ...(code ? { marketProvisionCodes: [code] } : {
      marketProvisionCodes: [],
      marketProvisionFamily: 'COV',
      marketRowKey: uncodedProfile.rowKey,
      marketObservationScope: { shortTitleIncludes: uncodedProfile.shortTitleIncludes },
      marketPresence: {
        strategy: 'card_exists',
        shortTitleIncludes: uncodedProfile.shortTitleIncludes,
        missingState: 'absent',
      },
      marketPrevalenceCohort: { scope: 'all_deals', eligibility: 'all_deals' },
    }),
    marketSubterms: subterms,
  };
}

// FEEDBACK-2-PUNCHLIST.md #30/#33 (Ben: "I don't know why you've got this
// signals one here, it's weird"): General Covenants is a grab-bag of
// unrelated clause types (efforts standard, access rights, public
// statements, D&O insurance, financing cooperation, plus whatever other
// one-off COV cards a deal has) with no shared structured shape to
// summarize into a signals-pill grid -- the old grid was pulling
// efforts/consent/knowledge/deadline meta that frequently didn't apply to
// the row it sat next to. This is now "Other Covenants": every row is a
// LINK to its own provision (same pattern as consideration-hero.config.js's
// "Other provisions in this section" row) instead of a content summary --
// the table names the provision and carries its full evidence on hover;
// reading the clause happens through that, not a pill paraphrase.
// `evidenceOverride` covers curated rows whose card has no primary_quote /
// region_full_text of its own (textOf(card) empty) -- falls back to the
// matched feature's own resolved text (firstFeature's `.detail`) so the
// link's hover never comes up empty when the card-level quote is missing.
// Canonical V2 dark preview stamping, applied uniformly regardless of which
// branch below builds the row: label gets the "(Canonical V2 preview)"
// suffix (mirrors table-configs/material-contracts.config.js's
// darkPreviewRows), and market/comparison fields are force-overridden LAST
// so a dark row can never be counted, compared or fed into market stats even
// though generalCovenantMarket() above may have computed real-looking
// marketProvisionCodes for it.
function darkPreviewFields(card) {
  if (!isDarkV2Card(card)) return {};
  return {
    authorityState: DARK_AUTHORITY_STATE,
    comparisonState: 'NOT_ADMITTED',
    marketState: DARK_PREVIEW_MARKET_STATE,
    marketSkip: true,
    marketProvisionCodes: [],
  };
}

function linkRow(idSuffix, label, card, evidenceOverride) {
  if (!card) return null;
  const dark = isDarkV2Card(card);
  const rowLabel = dark ? `${label} (Canonical V2 preview)` : label;
  if (card?.canonical_v2_lineage?.source === EVIDENCE_SOURCE) {
    return {
      id: `general-covenants-${idSuffix}`,
      label: rowLabel,
      kind: 'Link',
      detail: label,
      isLink: true,
      evidence: textOf(card) || evidenceOverride || '',
      sourceCard: card,
      present: true,
      marketState: 'OPEN_NATIVE_FIELD',
      ...darkPreviewFields(card),
    };
  }
  const ownership = routeGeneralCovenantCode(cardCode(card));
  const evidenceOnly = card?.canonical_v2_lineage?.source === 'CANONICAL_V2_OPEN_WORLD_EVIDENCE';
  return {
    id: `general-covenants-${idSuffix}`,
    label: rowLabel,
    kind: 'Link',
    detail: label,
    isLink: true,
    evidence: textOf(card) || evidenceOverride || '',
    sourceCard: card,
    present: true,
    ownerFamily: ownership.owner_id,
    ownershipState: ownership.route_state,
    ...(evidenceOnly ? { marketState: 'OPEN_NATIVE_FIELD' } : {}),
    ...generalCovenantMarket(card),
    ...darkPreviewFields(card),
  };
}

// The 5 curated concepts above render as friendly-labelled links first, so
// a genuinely mapped clause (e.g. the efforts-standard covenant) shows a
// readable term instead of falling through to its raw clause title.
function curatedRows(cards) {
  const rows = [];
  const covered = new Set();
  for (const [id, label, keys] of ROWS) {
    const hit = firstFeature(cards, keys);
    if (!hit) continue;
    const row = linkRow(id, label, hit.card, hit.detail);
    if (!row) continue;
    rows.push(row);
    covered.add(hit.card);
  }
  return { rows, covered };
}

// Every OTHER genuine COVENANT_OTHER card not already covered by a curated
// row above gets its own link, keyed off the clause's own short title --
// never a duplicate of a card already surfaced via curatedRows().
function perClauseRows(cards, covered) {
  return cards
    .filter((card) => !covered.has(card))
    .map((card) => linkRow(`clause-${card.id}`, clauseLabel(card), card))
    .filter(Boolean);
}

function renderLink(row, ctx) {
  const EvidenceHoverSource = ctx?.primitives?.EvidenceHoverSource;
  const linkNode = React.createElement(
    'a',
    {
      href: '#',
      onClick: (event) => event.preventDefault(),
      className: 'inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-800',
    },
    row.detail,
    React.createElement('span', { 'aria-hidden': 'true' }, '→'),
  );
  if (!EvidenceHoverSource) return linkNode;
  return React.createElement(EvidenceHoverSource, { evidence: row.evidence, source: row.sourceCard, as: 'span' }, linkNode);
}

// FEEDBACK-2-PUNCHLIST.md #33: this section now sits at the VERY END of the
// page (see REVIEW_TABLE_CONFIGS order in pages/review/[id].js) -- it is
// deliberately the last thing a reviewer sees, a plain link index into
// whatever general-covenant clauses didn't already get a home elsewhere.
const generalCovenantsConfig = {
  id: 'general-covenants',
  title: 'Other Covenants',
  layoutSlot: 'covenants',
  selectRows(reviewDeal) {
    const allCards = reviewDeal?.cards || [];
    // Dark cards are excluded from the live pipeline UNCONDITIONALLY, not
    // only when the gate happens to be on -- isGeneralCovenant() has no
    // opinion on authority_state, so without this a dark card would
    // otherwise fall through perClauseRows()'s generic "every uncovered
    // card gets a link" fallback and render un-labelled even with the gate
    // off. Gate-off (the default, and always in production): no route
    // under pages/ ever merges dark cards in, so `hasDarkCards` is always
    // false there and `liveDeal` stays the exact same reviewDeal reference,
    // unfiltered -- behaviour is byte-identical to before this file learned
    // about dark cards at all.
    const hasDarkCards = allCards.some(isDarkV2Card);
    const liveDeal = hasDarkCards
      ? { ...reviewDeal, cards: allCards.filter((card) => !isDarkV2Card(card)) }
      : reviewDeal;
    const cards = selectCards(liveDeal, isGeneralCovenant);
    const { rows: curated, covered } = curatedRows(cards);
    const liveRows = [...curated, ...perClauseRows(cards, covered)];
    if (!isCanonicalV2PreviewEnabled(reviewDeal)) return liveRows;
    // Dark cards are partitioned out of `cards` above so they can never be
    // matched into a curated ROW or counted in `covered` -- they get their
    // own rows here, appended after the live table, each one routed through
    // the SAME linkRow() used everywhere else (now dark-aware; see
    // darkPreviewFields above) rather than a parallel rendering path.
    const darkCards = selectCards({ cards: allCards.filter(isDarkV2Card) }, isGeneralCovenant);
    const darkRows = darkCards
      .map((card) => linkRow(`dark-${card.id}`, clauseLabel(card), card))
      .filter(Boolean);
    return [...liveRows, ...darkRows];
  },
  columns: [
    { id: 'term', header: 'Provision', width: '20rem', renderCell: (row) => row.label },
    { id: 'detail', header: 'Link', renderCell: renderLink },
  ],
};

export { generalCovenantsConfig, linkRow, perClauseRows, renderLink };
