// Intent resolver for the index "What's market?" entry point.
// Blank input requests a full corpus overview; recognized provision/feature
// phrases request a focused market summary. This module contains no React or
// fetch dependencies so the launcher and query executor can share it.

const PROVISION_INTENTS = [
  { key: 'ioc', provision_type: 'COVENANT_INTERIM_OPERATING', label: 'interim operating covenants', patterns: [/interim operating/, /ordinary course/, /\bioc\b/] },
  { key: 'nosol', provision_type: 'COVENANT_NO_SOLICITATION', label: 'no-shop and fiduciary-out provisions', patterns: [/no[ -]?shop/, /no[ -]?solicitation/, /fiduciary out/, /matching rights?/] },
  { key: 'termination-fee', provision_type: 'TERMINATION_FEE', label: 'termination fees', patterns: [/termination fees?/, /reverse termination fees?/, /company fees?/] },
  { key: 'regulatory', provision_type: 'ANTITRUST_REGULATORY', label: 'regulatory efforts and risk allocation', patterns: [/antitrust/, /regulatory/, /hell[- ]or[- ]high[- ]water/, /divestiture/] },
  { key: 'conditions', provision_type: 'CLOSING_CONDITION', label: 'closing conditions', patterns: [/closing conditions?/, /bringdown/, /mae condition/] },
  { key: 'mae', provision_type: 'MAE', label: 'material adverse effect provisions', patterns: [/\bmae\b/, /material adverse effect/] },
  { key: 'representations', provision_type: 'REPRESENTATION', label: 'representations and qualifiers', patterns: [/representations?/, /materiality scrape/, /knowledge qualifier/] },
  { key: 'appraisal', provision_type: 'CONSIDERATION', label: 'appraisal rights', field: 'appraisalRightsAvailable', patterns: [/appraisal rights?/] },
];

const FEATURE_INTENTS = [
  { provision_type: 'COVENANT_NO_SOLICITATION', field: 'forceTheVote', label: 'force-the-vote provisions', patterns: [/force[ -]?the[ -]?vote/, /\bftv\b/] },
  { provision_type: 'COVENANT_NO_SOLICITATION', field: 'goShopPresent', label: 'go-shop provisions', patterns: [/go[ -]?shop/] },
  { provision_type: 'COVENANT_NO_SOLICITATION', field: 'dontAskDontWaive', label: 'don’t-ask-don’t-waive provisions', patterns: [/don.?t[ -]?ask[ -]?don.?t[ -]?waive/, /\bdadw\b/] },
  { provision_type: 'ANTITRUST_REGULATORY', field: 'hellOrHighWater', label: 'hell-or-high-water obligations', patterns: [/hell[- ]or[- ]high[- ]water/, /\bhohw\b/] },
  { provision_type: 'REPRESENTATION', field: 'materialityScrape', label: 'materiality scrapes', patterns: [/materiality scrape/] },
  { provision_type: 'TERMINATION_FEE', field: 'companyTerminationFee', label: 'company termination fees', patterns: [/company termination fees?/] },
  { provision_type: 'TERMINATION_FEE', field: 'reverseTerminationFee', label: 'reverse termination fees', patterns: [/reverse termination fees?/] },
  { provision_type: 'COVENANT_INTERIM_OPERATING', field: 'permittedExceptions', label: 'interim operating covenant exceptions', patterns: [/ioc exceptions?/, /ordinary[- ]course exceptions?/, /prior written consent exceptions?/] },
];

function normalizeQuestion(input) {
  return String(input || '').trim().replace(/\s+/g, ' ');
}

function firstMatch(question, intents) {
  const normalized = question.toLowerCase();
  return intents.find((intent) => intent.patterns.some((pattern) => pattern.test(normalized))) || null;
}

function overviewIntent(question) {
  return {
    kind: 'MARKET_OVERVIEW',
    question: question || 'What’s market?',
    scope: 'corpus',
    title: 'M&A market overview',
    sections: [
      'CONSIDERATION',
      'TERMINATION_FEE',
      'COVENANT_NO_SOLICITATION',
      'COVENANT_INTERIM_OPERATING',
      'ANTITRUST_REGULATORY',
      'CLOSING_CONDITION',
      'TERMINATION_RIGHT',
      'REPRESENTATION',
      'MAE',
    ],
  };
}

export function resolveWhatsMarketIntent(input) {
  const question = normalizeQuestion(input);
  if (!question || /^(what(?:'|’)s|what is) market\??$/i.test(question)) return overviewIntent(question);

  const feature = firstMatch(question, FEATURE_INTENTS);
  if (feature) {
    return {
      kind: 'MARKET_TERM',
      question,
      title: `What’s market for ${feature.label}?`,
      provision_type: feature.provision_type,
      field: feature.field,
      marketKey: `feature.${feature.field}`,
    };
  }

  const provision = firstMatch(question, PROVISION_INTENTS);
  if (provision) {
    return {
      kind: 'MARKET_PROVISION',
      question,
      title: `What’s market for ${provision.label}?`,
      provision_type: provision.provision_type,
      ...(provision.field ? { field: provision.field, marketKey: `feature.${provision.field}` } : {}),
    };
  }

  return {
    kind: 'MARKET_SEARCH',
    question,
    title: `What’s market for “${question}”?`,
    query: question,
  };
}

export function whatsMarketPayload(input, dealFilter = null) {
  const intent = resolveWhatsMarketIntent(input);
  return {
    ...intent,
    ...(dealFilter && Object.keys(dealFilter).length ? { deal_filter: dealFilter } : {}),
  };
}

export { FEATURE_INTENTS, PROVISION_INTENTS, normalizeQuestion };
