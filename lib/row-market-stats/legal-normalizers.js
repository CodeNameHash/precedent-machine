function parseJson(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function payloadForClaim(claim) {
  return claim?.provenance?.feature_value
    ?? parseJson(claim?.verbatim)
    ?? claim?.canonical
    ?? claim?.verbatim
    ?? null;
}

function textOf(value) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join(' ');
  return Object.entries(value)
    .filter(([key]) => key !== 'quotes')
    .map(([, item]) => textOf(item))
    .filter(Boolean)
    .join(' ');
}

function contextText(raw, claim, linkedEvidence, peerClaims, attributes = null) {
  const allowed = attributes ? new Set(attributes) : null;
  const peers = (peerClaims || [])
    .filter((candidate) => !allowed || allowed.has(candidate.attribute))
    .flatMap((candidate) => [payloadForClaim(candidate), candidate.canonical, candidate.verbatim, candidate.evidence_quote]);
  return [raw, payloadForClaim(claim), claim?.canonical, claim?.verbatim, claim?.evidence_quote, linkedEvidence, ...peers]
    .map(textOf)
    .filter(Boolean)
    .join(' ');
}

function scalar(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of ['value', 'code', 'label', 'text']) {
      if (value[key] !== null && value[key] !== undefined && value[key] !== '') return scalar(value[key]);
    }
  }
  return value;
}

function truthy(value) {
  const candidate = scalar(value);
  if (candidate === true) return true;
  return /^(?:true|yes|present|included)$/i.test(String(candidate || '').trim());
}

function claimValue(peerClaims, attribute) {
  return (peerClaims || []).filter((claim) => claim.attribute === attribute).map(payloadForClaim);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function numberFrom(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const match = String(value || '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match && Number.isFinite(Number(match[0])) ? Number(match[0]) : null;
}

function nestedValues(value, keys) {
  const wanted = new Set(keys);
  const found = [];
  function visit(candidate) {
    if (!candidate || typeof candidate !== 'object') return;
    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }
    for (const [key, item] of Object.entries(candidate)) {
      if (wanted.has(key)) found.push(item);
      visit(item);
    }
  }
  visit(value);
  return found;
}

function goShopAvailability(raw, claim, linkedEvidence, peerClaims) {
  const presentValues = claimValue(peerClaims, 'goShopPresent');
  const periodValues = ['goShopPeriodDays', 'goShopWindow', 'extendedNegotiatingPeriodDays']
    .flatMap((attribute) => claimValue(peerClaims, attribute));
  const hasPeriod = periodValues.some((value) => numberFrom(scalar(value)) !== null);
  const explicitPresent = presentValues.some(truthy);
  const hasGoShopCard = (peerClaims || []).some((candidate) => String(candidate?.provenance?.code || '').toUpperCase() === 'NOSOL-GOSHOP');
  const text = contextText(raw, claim, linkedEvidence, peerClaims, ['goShopPresent', 'goShopPeriodDays', 'goShopWindow', 'extendedNegotiatingPeriodDays', 'mainConcept']);
  const described = /\bgo[- ]shop\b/i.test(text) && !/\bno\s+go[- ]shop\b/i.test(text);
  return [explicitPresent || hasPeriod || hasGoShopCard || described ? 'GO_SHOP' : 'NO_GO_SHOP'];
}

function goShopExcludedPartyTreatment(raw, claim, linkedEvidence, peerClaims) {
  const excluded = claimValue(peerClaims, 'goShopExcludedParties').flatMap((value) => Array.isArray(value) ? value : [value]);
  const text = contextText(raw, claim, linkedEvidence, peerClaims, ['goShopExcludedParties']);
  const specified = excluded.some((value) => textOf(value).trim()) || /excluded\s+(?:party|parties|bidder|bidders)/i.test(text);
  return [specified ? 'SPECIFIED_EXCLUDED_PARTIES' : 'NO_EXCLUDED_PARTIES_SPECIFIED'];
}

function ceaseDiscussionsAffiliateStandard(raw, claim, linkedEvidence, peerClaims) {
  const text = contextText(raw, claim, linkedEvidence, peerClaims, [
    'ceaseDiscussionsAffiliateStandard',
    'representativesStandard',
  ]);
  if (!text.trim()) return [];
  if (/\bRBE_NOT_TO\b|reasonable\s+best\s+efforts?[^.]{0,120}(?:cause|ensure)[^.]{0,100}representatives?/i.test(text)) {
    return ['REASONABLE_BEST_EFFORTS_TO_CAUSE_REPRESENTATIVES'];
  }
  if (/\bINSTRUCT_NOT_TO\b|(?:instruct|direct)[^.]{0,100}representatives?/i.test(text)) {
    return ['INSTRUCT_REPRESENTATIVES'];
  }
  if (/\bCAUSE_NOT_TO\b|shall[^.]{0,80}cause[^.]{0,100}(?:affiliates?|representatives?)/i.test(text)) {
    const affiliates = /affiliates?/i.test(text);
    const representatives = /representatives?/i.test(text);
    if (affiliates && representatives) return ['CAUSE_AFFILIATES_AND_REPRESENTATIVES'];
    if (representatives) return ['CAUSE_REPRESENTATIVES'];
    if (affiliates) return ['CAUSE_AFFILIATES'];
  }
  return ['OTHER_CAPTURED_REPRESENTATIVE_CONTROL_STANDARD'];
}

function ceaseDiscussionsLiabilityStandard(raw, claim, linkedEvidence, peerClaims) {
  const liabilityClaims = (peerClaims || []).filter((candidate) => candidate.attribute === 'ceaseDiscussionsLiability');
  const liabilityText = liabilityClaims
    .flatMap((candidate) => [payloadForClaim(candidate), candidate.canonical, candidate.verbatim, candidate.evidence_quote])
    .map(textOf)
    .filter(Boolean)
    .join(' ');
  if (/breach[^.]{0,120}representative[^.]{0,120}(?:deemed|considered|constitute)[^.]{0,80}breach[^.]{0,80}(?:company|party)|representative[^.]{0,120}breach[^.]{0,120}(?:deemed|considered)[^.]{0,80}(?:company|party)/i.test(liabilityText)) {
    return ['REPRESENTATIVE_BREACH_DEEMED_COMPANY_BREACH'];
  }
  if (/responsible|liable|liability|attribut(?:e|ed|able)/i.test(liabilityText)) {
    return ['OTHER_EXPRESS_REPRESENTATIVE_BREACH_ATTRIBUTION'];
  }
  if (liabilityText.trim()) return ['OTHER_CAPTURED_REPRESENTATIVE_BREACH_STANDARD'];
  const clauseText = contextText(raw, claim, linkedEvidence, peerClaims, [
    'ceaseDiscussionsAffiliateStandard',
    'representativesStandard',
    'mainConcept',
  ]);
  return clauseText.trim() ? ['NO_EXPRESS_REPRESENTATIVE_BREACH_ATTRIBUTION'] : [];
}

function fiduciaryFinalStandard(raw, claim, linkedEvidence, peerClaims) {
  const text = contextText(raw, claim, linkedEvidence, peerClaims, ['fiduciaryFinalStandard']);
  if (!text.trim()) return [];
  if (/(?:constitutes?|is|would\s+constitute|would\s+result\s+in)[^.]{0,80}(?:a\s+)?(?:company\s+|parent\s+)?superior\s+proposal/i.test(text)) {
    return ['CONSTITUTES_SUPERIOR_PROPOSAL'];
  }
  if (/reasonably\s+(?:likely|expected)[^.]{0,80}(?:become|result\s+in|lead\s+to)[^.]{0,80}superior\s+proposal/i.test(text)) {
    return ['REASONABLY_LIKELY_TO_RESULT_IN_SUPERIOR_PROPOSAL'];
  }
  return ['OTHER_CAPTURED_FINAL_DETERMINATION_STANDARD'];
}

function fiduciaryDutyChangeStandard(raw, claim, linkedEvidence, peerClaims) {
  const text = contextText(raw, claim, linkedEvidence, peerClaims, ['changeRecStandard']);
  if (!text.trim()) return [];
  if (/reasonably\s+(?:expected|likely)[^.]{0,100}inconsistent[^.]{0,100}fiduciary\s+dut/i.test(text)) {
    return ['FAILURE_TO_CHANGE_REASONABLY_EXPECTED_INCONSISTENT_WITH_FIDUCIARY_DUTIES'];
  }
  if (/inconsistent[^.]{0,100}fiduciary\s+dut/i.test(text)) {
    return ['FAILURE_TO_CHANGE_INCONSISTENT_WITH_FIDUCIARY_DUTIES'];
  }
  if (/reasonably\s+likely[^.]{0,100}breach[^.]{0,100}fiduciary\s+dut/i.test(text)) {
    return ['FAILURE_TO_CHANGE_REASONABLY_LIKELY_TO_BREACH_FIDUCIARY_DUTIES'];
  }
  if (/breach[^.]{0,100}fiduciary\s+dut/i.test(text)) return ['FAILURE_TO_CHANGE_WOULD_BREACH_FIDUCIARY_DUTIES'];
  return ['OTHER_CAPTURED_FIDUCIARY_DUTY_STANDARD'];
}

function preVoteOnly(raw, claim, linkedEvidence, peerClaims) {
  const values = claimValue(peerClaims, 'preVoteOnlyWindow');
  const text = contextText(raw, claim, linkedEvidence, peerClaims, ['preVoteOnlyWindow', 'mainConcept']);
  if (values.some(truthy) || /(?:prior\s+to|before)[^.]{0,100}(?:receipt|obtaining|approval)[^.]{0,100}stockholder\s+approval|before[^.]{0,100}stockholder\s+approval/i.test(text)) {
    return ['BEFORE_STOCKHOLDER_APPROVAL'];
  }
  if (values.some((value) => scalar(value) === false || /^(?:false|no)$/i.test(String(scalar(value) || '').trim()))) {
    return ['NOT_LIMITED_TO_PRE_VOTE_PERIOD'];
  }
  return text.trim() ? ['OTHER_CAPTURED_EXERCISE_WINDOW'] : [];
}

function stockholderVoteStandard(raw, claim) {
  const text = [raw, payloadForClaim(claim), claim?.canonical, claim?.verbatim]
    .map(textOf)
    .filter(Boolean)
    .join(' ');
  if (!text.trim() || /merger\s+sub[^.]{0,120}(?:stockholder|shareholder|member)|(?:stockholder|shareholder|member)[^.]{0,120}merger\s+sub/i.test(text)) return [];
  if (/majority[^.]{0,120}(?:outstanding|issued)[^.]{0,80}(?:shares?|stock)|affirmative\s+vote[^.]{0,160}majority[^.]{0,100}(?:outstanding|issued)/i.test(text)) {
    return ['MAJORITY_OF_OUTSTANDING_SHARES'];
  }
  if (/majority[^.]{0,120}(?:votes?\s+cast|voting\s+power\s+present)|votes?\s+cast[^.]{0,120}majority/i.test(text)) {
    return ['MAJORITY_OF_VOTES_CAST'];
  }
  if (/two[-\s]?thirds?|66\s*(?:2\/3)?\s*%/i.test(text)) return ['TWO_THIRDS_APPROVAL'];
  if (/unanimous|all\s+(?:holders|shares)/i.test(text)) return ['UNANIMOUS_APPROVAL'];
  return ['OTHER_CAPTURED_STOCKHOLDER_VOTE_STANDARD'];
}

function parentApprovalTiming(raw, claim, linkedEvidence, peerClaims) {
  const text = contextText(raw, claim, linkedEvidence, peerClaims, ['parentAdoptionTiming', 'mainConcept']);
  if (!text.trim()) return [];
  if (/immediately\s+(?:following|after)[^.]{0,80}(?:execution|signing|date\s+of\s+(?:this|the)\s+agreement)/i.test(text)) {
    return ['IMMEDIATELY_AFTER_SIGNING'];
  }
  if (/promptly\s+(?:following|after)[^.]{0,80}(?:execution|signing|date\s+of\s+(?:this|the)\s+agreement)/i.test(text)) {
    return ['PROMPTLY_AFTER_SIGNING'];
  }
  if (/(?:prior\s+to|before)[^.]{0,80}(?:closing|effective\s+time)/i.test(text)) return ['BEFORE_CLOSING'];
  return ['OTHER_CAPTURED_APPROVAL_TIMING'];
}

function superiorProposalTestFactors(raw, claim, linkedEvidence, peerClaims) {
  const text = contextText(raw, claim, linkedEvidence, peerClaims, ['superiorProposalTest', 'definitionText', 'mainConcept']);
  const factors = [];
  if (/more\s+favo[u]?rable[^.]{0,160}(?:financial|stockholder)|financial(?:ly|\s+point\s+of\s+view)[^.]{0,100}(?:superior|favo[u]?rable)|greater\s+(?:financial\s+)?value/i.test(text)) {
    factors.push('FINANCIALLY_MORE_FAVOURABLE');
  }
  if (/reasonably\s+likely\s+to\s+be\s+(?:completed|consummated)|reasonable\s+likelihood\s+of\s+(?:completion|consummation)/i.test(text)) {
    factors.push('REASONABLY_LIKELY_TO_COMPLETE');
  }
  if (/financial,?\s+legal,?\s+regulatory(?:\s+and)?\s+other\s+aspects|financial[^.]{0,50}legal[^.]{0,50}regulatory/i.test(text)) {
    factors.push('FINANCIAL_LEGAL_AND_REGULATORY_FACTORS');
  }
  if (/person\s+making\s+(?:(?:such|the)[^.]{0,80}(?:proposal|offer)|it\b)|identity[^.]{0,100}(?:bidder|proponent)|ability\s+of[^.]{0,80}(?:bidder|person)/i.test(text)) {
    factors.push('BIDDER_IDENTITY_OR_CAPABILITY');
  }
  if (/(?:does\s+not|not|no)\s+(?:contain|include|subject\s+to)?[^.]{0,50}financing\s+condition/i.test(text)) {
    factors.push('NO_FINANCING_CONDITION');
  }
  if (/(?:does\s+not|not|no)\s+(?:contain|include|subject\s+to)?[^.]{0,50}(?:due\s+diligence|diligence)(?:\s+or\s+financing)?\s+conditions?/i.test(text)) {
    factors.push('NO_DUE_DILIGENCE_CONDITION');
  }
  if (/changes?\s+to\s+(?:this|the)\s+agreement\s+proposed|revisions?\s+to\s+(?:this|the)\s+agreement/i.test(text)) {
    factors.push('AGREEMENT_REVISIONS_CONSIDERED');
  }
  if (/synerg(?:y|ies)|pro\s+forma\s+economics/i.test(text)) factors.push('SYNERGIES_OR_PRO_FORMA_ECONOMICS_CONSIDERED');
  return unique(factors);
}

function interveningEventRights(raw, claim, linkedEvidence, peerClaims) {
  const attributes = ['interveningEventProvision', 'boardChangeForInterveningEvent', 'interveningEventTermination', 'definitionText', 'interveningEventDefinition', 'mainConcept'];
  const text = contextText(raw, claim, linkedEvidence, peerClaims, attributes);
  const boardChange = claimValue(peerClaims, 'boardChangeForInterveningEvent').some(truthy)
    || /(?:may|permitted\s+to)[^.]{0,160}(?:change|withhold|withdraw|modify)[^.]{0,120}recommendation|intervening\s+event\s+recommendation\s+change/i.test(text);
  const noTermination = /no\s+(?:separate\s+)?termination\s+right|does\s+not[^.]{0,80}(?:create|grant|provide)[^.]{0,80}termination|only\s+permits?[^.]{0,100}recommendation\s+change/i.test(text);
  const termination = !noTermination && /(?:may|right\s+to|entitled\s+to)[^.]{0,100}terminat[^.]{0,140}intervening\s+event|intervening\s+event[^.]{0,140}(?:may|right\s+to|entitled\s+to)[^.]{0,100}terminat/i.test(text);
  const definition = /intervening\s+event\s+(?:means|definition)|\bdefinitionText\b/i.test(text)
    || claimValue(peerClaims, 'definitionText').some((value) => textOf(value).trim());
  return unique([
    boardChange ? 'BOARD_RECOMMENDATION_CHANGE_RIGHT' : null,
    termination ? 'EXPRESS_TERMINATION_RIGHT' : null,
    definition && !boardChange && !termination ? 'DEFINED_TERM_ONLY' : null,
  ]);
}

function interveningEventScope(raw, claim, linkedEvidence, peerClaims) {
  const text = contextText(raw, claim, linkedEvidence, peerClaims, ['interveningEventScope', 'interveningEventDefinition', 'definitionText']);
  const values = [];
  const expresslyPositiveOnly = /\bpositive\s+(?:material\s+)?(?:event|development|change)|value[- ]increasing/i.test(text);
  const neutralUnknownEvent = /(?:material\s+)?(?:event|development|occurrence|state\s+of\s+facts|change)[^.]{0,180}(?:not\s+(?:actually\s+)?known|not\s+reasonably\s+foreseeable|unknown)/i.test(text);
  if (expresslyPositiveOnly) values.push('IE_POSITIVE_ONLY');
  else if (/\bBOTH\b|positive\s+(?:or|and)\s+negative/i.test(text) || neutralUnknownEvent) values.push('IE_POSITIVE_OR_NEGATIVE');
  if (/not\s+(?:actually\s+)?known|not\s+reasonably\s+foreseeable|unknown\s+to/i.test(text)) values.push('UNKNOWN_OR_UNFORESEEABLE_AT_SIGNING');
  if (/(?:magnitude(?:\s+or\s+material\s+consequences?)?|material\s+consequences?)[^.]{0,100}(?:not\s+known|not\s+reasonably\s+foreseeable)/i.test(text)) {
    values.push('UNKNOWN_MAGNITUDE_OR_CONSEQUENCES');
  }
  if (/prior\s+to\s+(?:obtaining\s+)?(?:the\s+)?(?:company|parent)?\s*stockholder\s+approval|before\s+(?:the\s+)?(?:company|parent)?\s*stockholder\s+approval/i.test(text)) {
    values.push('DISCOVERED_BEFORE_STOCKHOLDER_APPROVAL');
  }
  if (/\bmaterial\s+(?:event|development|occurrence|state\s+of\s+facts|change)/i.test(text)) values.push('MATERIAL_EVENT_REQUIRED');
  return unique(values);
}

function interveningEventExceptions(raw, claim, linkedEvidence, peerClaims) {
  const text = contextText(raw, claim, linkedEvidence, peerClaims, ['interveningEventExceptions', 'carveOuts', 'interveningEventDefinition', 'definitionText']);
  const values = [];
  if (/ACQUISITION_PROPOSAL_RELATED|UNSOLICITED_PROPOSAL|(?:receipt|existence|terms)[^.]{0,140}(?:acquisition|takeover|superior)\s+proposal|(?:acquisition|takeover)\s+proposal[^.]{0,100}(?:shall\s+not|does\s+not|exclude)/i.test(text)) {
    values.push('ACQUISITION_PROPOSAL_RELATED');
  }
  if (/AGREEMENT_COMPLIANCE_ACTIONS|REQUIRED_BY_AGREEMENT|action[^.]{0,100}pursuant\s+to[^.]{0,80}(?:and\s+)?in\s+compliance\s+with[^.]{0,80}agreement/i.test(text)) {
    values.push('AGREEMENT_COMPLIANCE_ACTIONS');
  }
  if (/MEETS_EXCEEDS_PROJECTIONS|meets?\s+or\s+exceeds?[^.]{0,120}(?:projections|forecasts|guidance|milestones|budgets)/i.test(text)) {
    values.push('MEETS_EXCEEDS_PROJECTIONS');
  }
  if (/STOCK_PRICE_CHANGE|stock\s+price|trading\s+volume/i.test(text)) values.push('STOCK_PRICE_CHANGE');
  if (/CREDIT_RATING_CHANGE|credit\s+rating/i.test(text)) values.push('CREDIT_RATING_CHANGE');
  return unique(values);
}

function interveningEventTerminationTreatment(raw, claim, linkedEvidence, peerClaims) {
  const text = contextText(raw, claim, linkedEvidence, peerClaims, ['interveningEventTermination', 'boardChangeForInterveningEvent', 'interveningEventProvision', 'mainConcept']);
  const noTermination = /no\s+(?:separate\s+)?termination\s+right|does\s+not[^.]{0,80}(?:create|grant|provide)[^.]{0,80}termination|only\s+permits?[^.]{0,100}recommendation\s+change/i.test(text);
  const boardChange = claimValue(peerClaims, 'boardChangeForInterveningEvent').some(truthy)
    || /intervening\s+event\s+recommendation\s+change|(?:may|permitted\s+to)[^.]{0,160}(?:change|withhold|withdraw|modify)[^.]{0,100}recommendation/i.test(text);
  const termination = !noTermination && /(?:may|right\s+to|entitled\s+to)[^.]{0,100}terminat[^.]{0,140}intervening\s+event|intervening\s+event[^.]{0,140}(?:may|right\s+to|entitled\s+to)[^.]{0,100}terminat/i.test(text);
  if (termination) return ['EXPRESS_TERMINATION_RIGHT'];
  if (boardChange) return ['RECOMMENDATION_CHANGE_ONLY'];
  if (noTermination) return ['NO_SEPARATE_TERMINATION_RIGHT'];
  return [];
}

function latePaymentRateBasis(raw, claim, linkedEvidence, peerClaims) {
  const text = contextText(raw, claim, linkedEvidence, peerClaims, ['interestRateBasis', 'interestOnLatePayment']);
  const rules = [
    [/\bPRIME_WSJ\b|prime\s+rate[^.]{0,120}wall\s+street\s+journal/i, 'PRIME_WSJ'],
    [/\bPRIME_BANK\b|prime\s+rate[^.]{0,100}(?:bank|lender)/i, 'PRIME_BANK'],
    [/\bUS_TREASURY_6MO\b|six[- ]month|6[- ]month[^.]{0,60}(?:treasury|t-bill)|treasury[^.]{0,60}(?:six|6)[- ]month/i, 'US_TREASURY_6MO'],
    [/\bLIBOR\b/i, 'LIBOR'],
    [/\bSOFR\b/i, 'SOFR'],
    [/\bFIXED\b|fixed\s+rate/i, 'FIXED'],
    [/statutory\s+rate|maximum\s+rate\s+permitted\s+by\s+law/i, 'STATUTORY_OR_MAXIMUM_LAWFUL_RATE'],
  ];
  return [rules.find(([pattern]) => pattern.test(text))?.[1] || 'OTHER_REFERENCE_RATE'];
}

function latePaymentSpreadPercent(raw, claim, linkedEvidence, peerClaims) {
  const text = contextText(raw, claim, linkedEvidence, peerClaims, ['interestOnLatePayment']);
  const percent = text.match(/(?:\+|plus|in\s+excess\s+of)\s*(\d+(?:\.\d+)?)\s*(?:%|percent(?:age)?\s+points?)/i);
  if (percent) return [{ value: Number(percent[1]), unit: 'percent' }];
  const bps = text.match(/(?:\+|plus|in\s+excess\s+of)\s*(\d+(?:\.\d+)?)\s*basis\s+points?/i);
  return bps ? [{ value: Number(bps[1]) / 100, unit: 'percent' }] : [];
}

function latePaymentInterestBase(raw, claim, linkedEvidence, peerClaims) {
  const text = contextText(raw, claim, linkedEvidence, peerClaims, ['interestOnLatePayment']);
  if (/base[^.]{0,40}(?:termination|reverse termination|company termination|parent termination)\s+fee|interest[^.]{0,80}(?:termination|reverse termination|company termination|parent termination)\s+fee/i.test(text)) {
    return ['OVERDUE_TERMINATION_FEE'];
  }
  if (/collection\s+(?:costs?|expenses?)|fees?\s+of\s+counsel/i.test(text)) return ['OVERDUE_AMOUNT_AND_COLLECTION_COSTS'];
  if (/overdue\s+amount|amount\s+due|late\s+payment|such\s+amount/i.test(text)) return ['OVERDUE_AMOUNT'];
  return ['OTHER_PAYMENT_BASE'];
}

function tailWindowMonths(raw, claim) {
  const candidates = [
    ...nestedValues(raw, ['period_months', 'periodMonths', 'tailFeeWindowMonths', 'tailPeriod']),
    claim?.attribute === 'tailFeeWindowMonths' || claim?.attribute === 'tailPeriod' ? raw : null,
  ];
  for (const candidate of candidates) {
    const value = numberFrom(scalar(candidate));
    if (value !== null) return [{ value, unit: 'months', calendarBasis: 'elapsed', trigger: 'qualifying_termination' }];
  }
  return [];
}

function tailThresholdPercent(raw, claim) {
  const candidates = [
    ...nestedValues(raw, ['threshold_percentage', 'thresholdPercentage', 'tailFeeThresholdPct']),
    claim?.attribute === 'tailFeeThresholdPct' ? raw : null,
  ];
  for (const candidate of candidates) {
    const value = numberFrom(scalar(candidate));
    if (value !== null) return [{ value, unit: 'percent' }];
  }
  return [];
}

function tailArmingScenarios(raw, claim, linkedEvidence, peerClaims) {
  const text = contextText(raw, claim, linkedEvidence, peerClaims, ['tailProvision', 'tailFeeActivatingClauses']);
  const values = [];
  if (/outside\s+date|end\s+date|failure\s+to\s+close/i.test(text)) values.push('OUTSIDE_DATE_TERMINATION');
  if (/no[- ]vote|voted?\s+down|stockholders?[^.]{0,80}(?:fail|did\s+not)[^.]{0,60}(?:approve|approval)|failure\s+of[^.]{0,60}stockholder\s+approval/i.test(text)) {
    values.push('STOCKHOLDER_NO_VOTE_TERMINATION');
  }
  if (/no[- ]solicit(?:ation)?(?:\s*\/\s*(?:other\s+)?covenant)?\s+(?:breach|obligations?)|no[- ]solicit(?:ation)?\s+or\s+(?:any\s+)?other\s+covenant\s+breach|breach[^.]{0,100}no[- ]solicit/i.test(text)) values.push('NO_SOLICIT_BREACH_TERMINATION');
  if (/(?:other|any\s+other)\s+covenant[^.]{0,100}breach|breach[^.]{0,100}(?:other|any\s+other)\s+covenant/i.test(text)) {
    values.push('OTHER_COVENANT_BREACH_TERMINATION');
  }
  if (/recommendation[- ]change\s+termination|board[^.]{0,100}changes?[^.]{0,80}recommendation|adverse\s+recommendation\s+change/i.test(text)) {
    values.push('ADVERSE_RECOMMENDATION_CHANGE_TERMINATION');
  }
  if (/mutual\s+(?:agreement|consent)[^.]{0,80}terminat/i.test(text)) values.push('MUTUAL_TERMINATION');
  return unique(values);
}

function tailQualifyingTransactionScope(raw, claim, linkedEvidence, peerClaims) {
  const text = contextText(raw, claim, linkedEvidence, peerClaims, ['tailProvision', 'tailFeeRecognitionEvent', 'tailFeeSameProposalRequired']);
  const values = [];
  if (/enters?\s+into\s+(?:a\s+)?definitive\s+agreement|execut(?:e|es|ed|ion)\s+(?:of\s+)?(?:a\s+)?definitive\s+agreement|signed?[^.]{0,80}definitive\s+agreement/i.test(text)) {
    values.push('DEFINITIVE_AGREEMENT_WITHIN_TAIL_WINDOW');
  }
  if (/transactions?[^.]{0,100}(?:are|is)\s+(?:subsequently\s+)?consummated|consummat(?:e|es|ed|ion)[^.]{0,100}(?:within|before|prior\s+to)/i.test(text)) {
    values.push('CONSUMMATION_WITHIN_TAIL_WINDOW');
  }
  if (/subsequently\s+consummated[^.]{0,100}(?:during\s+or\s+after|whether\s+during\s+or\s+after)|consummat(?:e|ed|ion)[^.]{0,100}after[^.]{0,60}(?:tail|month|period)/i.test(text)) {
    values.push('CONSUMMATION_MAY_OCCUR_AFTER_TAIL_WINDOW');
  }
  if (/publicly\s+(?:announced|disclosed|made\s+known)[^.]{0,160}(?:before|prior\s+to|pendency|termination)|preceded\s+by[^.]{0,100}publicly\s+announced/i.test(text)) {
    values.push('PRE_TERMINATION_PUBLIC_ANNOUNCEMENT_REQUIRED');
  }
  const sameProposal = claimValue(peerClaims, 'tailFeeSameProposalRequired').some(truthy);
  if (sameProposal) values.push('SAME_PRE_TERMINATION_PROPOSAL_REQUIRED');
  else if (/\bany\s+(?:company|parent)?\s*(?:acquisition|takeover)\s+proposal\b/i.test(text)) values.push('ANY_QUALIFYING_TRANSACTION');
  return unique(values);
}

const NORMALIZERS = {
  go_shop_availability: goShopAvailability,
  go_shop_excluded_party_treatment: goShopExcludedPartyTreatment,
  cease_discussions_affiliate_standard: ceaseDiscussionsAffiliateStandard,
  cease_discussions_liability_standard: ceaseDiscussionsLiabilityStandard,
  fiduciary_final_standard: fiduciaryFinalStandard,
  fiduciary_duty_change_standard: fiduciaryDutyChangeStandard,
  pre_vote_only: preVoteOnly,
  stockholder_vote_standard: stockholderVoteStandard,
  parent_approval_timing: parentApprovalTiming,
  superior_proposal_test_factors: superiorProposalTestFactors,
  intervening_event_rights: interveningEventRights,
  intervening_event_scope: interveningEventScope,
  intervening_event_exceptions: interveningEventExceptions,
  intervening_event_termination_treatment: interveningEventTerminationTreatment,
  late_payment_rate_basis: latePaymentRateBasis,
  late_payment_spread_percent: latePaymentSpreadPercent,
  late_payment_interest_base: latePaymentInterestBase,
  tail_window_months: tailWindowMonths,
  tail_threshold_percent: tailThresholdPercent,
  tail_arming_scenarios: tailArmingScenarios,
  tail_qualifying_transaction_scope: tailQualifyingTransactionScope,
};

function normaliseLegalMarketValue(name, raw, claim, linkedEvidence, peerClaims) {
  const normalizer = NORMALIZERS[name];
  return normalizer ? normalizer(raw, claim, linkedEvidence, peerClaims) : null;
}

module.exports = {
  NORMALIZERS,
  normaliseLegalMarketValue,
};
