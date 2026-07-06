const ELECTION_SIGNAL_RE = /\b(?:Cash Election|Stock Election|Mixed Election|Non-Election Shares?|Election Deadline|Form of Election|may elect to receive|shall be entitled to elect|Maximum Cash Election|Maximum Stock Election|CVR election|with CVR|without CVR|proration|oversubscribed|Aggregate Cash Consideration|Aggregate Stock Consideration)\b/i;

function findSpan(text, patterns, fallbackRe = ELECTION_SIGNAL_RE) {
  const list = Array.isArray(patterns) ? patterns : [patterns || fallbackRe];
  for (const re of list) {
    const m = re.exec(text);
    if (!m) continue;
    const start = Math.max(0, m.index);
    let end = text.indexOf('. ', m.index + m[0].length);
    if (end < 0 || end - start > 1800) end = Math.min(text.length, start + 1200);
    else end += 1;
    return { start, end, quote: text.slice(start, end) };
  }
  const end = Math.min(text.length, 1200);
  return { start: 0, end, quote: text.slice(0, end) };
}

function numberFromMoney(text) {
  const m = /\$\s*([0-9][0-9,]*(?:\.[0-9]+)?)/.exec(text);
  if (!m) return null;
  return Number(m[1].replace(/,/g, ''));
}

function decimalFromRatio(text) {
  const m = /\b([0-9]+(?:\.[0-9]+)?)\s+(?:shares?|Parent shares?|Buyer shares?)/i.exec(text);
  return m ? Number(m[1]) : null;
}

function percentCap(text) {
  const m = /\b([0-9]+(?:\.[0-9]+)?)\s*%/.exec(text);
  return m ? `${m[1]}%` : null;
}

function detectElectionSignals(regionFullText) {
  return ELECTION_SIGNAL_RE.test(String(regionFullText || ''));
}

function optionSpan(text, type) {
  if (type === 'CASH_ELECTION') return findSpan(text, [/Cash Election[\s\S]{0,900}?(?:Stock Election|Mixed Election|$)/i, /Maximum Cash Election[\s\S]{0,900}?(?:Maximum Stock Election|$)/i]);
  if (type === 'STOCK_ELECTION') return findSpan(text, [/Stock Election[\s\S]{0,900}?(?:Cash Election|Mixed Election|$)/i, /Maximum Stock Election[\s\S]{0,900}?$/i]);
  if (type === 'MIXED_ELECTION') return findSpan(text, [/Mixed Election[\s\S]{0,900}?(?:Cash Election|Stock Election|$)/i]);
  if (type === 'CVR_INCLUDED') return findSpan(text, [/(?:with|including)\s+(?:a\s+)?CVR[\s\S]{0,700}/i, /CVR Included[\s\S]{0,700}/i]);
  if (type === 'CVR_EXCLUDED') return findSpan(text, [/(?:without|excluding)\s+(?:a\s+)?CVR[\s\S]{0,700}/i, /CVR Excluded[\s\S]{0,700}/i]);
  return findSpan(text, ELECTION_SIGNAL_RE);
}

function aggregateCap(type, quote) {
  const pct = percentCap(quote);
  const money = numberFromMoney(quote);
  const capTypeForPercent = /consideration/i.test(quote) ? 'PERCENTAGE_OF_CONSIDERATION' : 'PERCENTAGE_OF_SHARES';
  if (/maximum\s+cash|aggregate\s+cash|cash\s+pool/i.test(quote)) {
    if (money !== null) return { aggregateCapType: 'FIXED_DOLLAR_AMOUNT', aggregateCapValue: `$${money}`, aggregateCapFormula: quote };
    return { aggregateCapType: pct ? capTypeForPercent : 'OTHER', aggregateCapValue: pct || 'Cash cap described in source', aggregateCapFormula: quote };
  }
  if (/maximum\s+stock|aggregate\s+stock|stock\s+pool/i.test(quote)) {
    return { aggregateCapType: pct ? capTypeForPercent : 'OTHER', aggregateCapValue: pct || 'Stock cap described in source', aggregateCapFormula: quote };
  }
  return { aggregateCapType: 'NO_CAP', aggregateCapValue: 'No cap', aggregateCapFormula: null };
}

function buildOption(regionFullText, optionType, displayOrder) {
  const span = optionSpan(regionFullText, optionType);
  const cap = aggregateCap(optionType, span.quote);
  const isCash = optionType === 'CASH_ELECTION';
  const isStock = optionType === 'STOCK_ELECTION';
  const labels = {
    CASH_ELECTION: 'Cash Election',
    STOCK_ELECTION: 'Stock Election',
    MIXED_ELECTION: 'Mixed Election',
    CVR_INCLUDED: 'With CVR',
    CVR_EXCLUDED: 'Without CVR',
  };
  return {
    optionLabel: labels[optionType] || 'Election Option',
    optionType,
    cashPerShare: isCash ? numberFromMoney(span.quote) : null,
    cashPerShareFormula: isCash && numberFromMoney(span.quote) === null ? span.quote : null,
    stockPerShare: isStock ? decimalFromRatio(span.quote) : null,
    stockPerShareFormula: isStock && decimalFromRatio(span.quote) === null ? span.quote : null,
    cvrIncluded: optionType === 'CVR_INCLUDED' ? true : (optionType === 'CVR_EXCLUDED' ? false : null),
    cvrNote: /cvr|contingent value right/i.test(span.quote) ? span.quote : null,
    aggregateCapType: cap.aggregateCapType,
    aggregateCapValue: cap.aggregateCapValue,
    aggregateCapFormula: cap.aggregateCapFormula,
    sourceSpanStart: span.start,
    sourceSpanEnd: span.end,
    verbatimQuote: span.quote,
    displayOrder,
  };
}

function defaultTreatment(regionFullText) {
  if (/Non[-\s]?Election Shares?.{0,160}(?:Stock Election|stock consideration|stock)/i.test(regionFullText)) return 'NON_ELECTING_TREATED_AS_STOCK_ELECTION';
  if (/Non[-\s]?Election Shares?.{0,160}(?:Cash Election|cash consideration|cash)/i.test(regionFullText)) return 'NON_ELECTING_TREATED_AS_CASH_ELECTION';
  if (/non[-\s]?electing.{0,160}mixed/i.test(regionFullText)) return 'NON_ELECTING_GETS_MIXED';
  if (/non[-\s]?electing.{0,160}stock/i.test(regionFullText)) return 'NON_ELECTING_GETS_STOCK';
  if (/non[-\s]?electing.{0,160}cash/i.test(regionFullText)) return 'NON_ELECTING_GETS_CASH';
  return 'OTHER';
}

function deadline(regionFullText) {
  const span = findSpan(regionFullText, [/Election Deadline[\s\S]{0,500}/i, /deadline[\s\S]{0,500}(?:Election|Form of Election)/i]);
  if (!/deadline|Election Deadline/i.test(span.quote)) return { electionDeadlineRef: null, electionDeadlineQuote: null };
  const ref = /Section\s+[0-9]+(?:\.[0-9]+)*/i.exec(span.quote);
  return {
    electionDeadlineRef: ref ? ref[0] : null,
    electionDeadlineQuote: span.quote,
  };
}

function prorationRule(regionFullText) {
  if (!/\bproration|pro\s+rata|oversubscribed|oversubscription/i.test(regionFullText)) return null;
  const span = findSpan(regionFullText, [/proration[\s\S]{0,1400}/i, /oversubscrib[\s\S]{0,1400}/i, /pro\s+rata[\s\S]{0,1400}/i]);
  const cash = /cash/i.test(span.quote);
  const stock = /stock/i.test(span.quote);
  return {
    prorationTrigger: cash && stock ? 'OVERSUBSCRIBED_EITHER' : (cash ? 'OVERSUBSCRIBED_CASH' : (stock ? 'OVERSUBSCRIBED_STOCK' : 'ALWAYS')),
    prorationMethod: /pro\s+rata|prorat/i.test(span.quote) ? 'PRO_RATA_REDUCTION' : 'OTHER',
    capDefinitions: {
      ...(cash ? { cash_pool: 'Cash cap described in source quote' } : {}),
      ...(stock ? { stock_pool: 'Stock cap described in source quote' } : {}),
    },
    nonElectingTreatment: /non[-\s]?elect/i.test(span.quote) ? 'GET_DEFAULT_TREATMENT' : 'OTHER',
    sourceSpanStart: span.start,
    sourceSpanEnd: span.end,
    verbatimQuote: span.quote,
    prorationWalkthrough: prorationWalkthrough(span.quote),
  };
}

function prorationWalkthrough(quote) {
  if (/cash/i.test(quote) && /stock/i.test(quote) && /pro\s+rata|prorat/i.test(quote)) {
    return 'If an election side is oversubscribed, the oversubscribed choice is reduced pro rata and the balance is reallocated under the source proration mechanic.';
  }
  return 'Proration applies as described in the source proration quote.';
}

function buildElectionMechanism(extracted) {
  const regionFullText = String(extracted && extracted.regionFullText || '');
  if (!detectElectionSignals(regionFullText)) return null;
  const hasCash = /Cash Election|Maximum Cash Election|cash consideration/i.test(regionFullText);
  const hasStock = /Stock Election|Maximum Stock Election|stock consideration/i.test(regionFullText);
  const hasMixed = /Mixed Election/i.test(regionFullText);
  const hasCvr = /CVR|Contingent Value Right/i.test(regionFullText);
  const options = [];
  if (hasCvr && /with(?:out)?\s+(?:a\s+)?CVR|CVR Included|CVR Excluded/i.test(regionFullText)) {
    options.push(buildOption(regionFullText, 'CVR_INCLUDED', 1));
    options.push(buildOption(regionFullText, 'CVR_EXCLUDED', 2));
  } else {
    if (hasCash) options.push(buildOption(regionFullText, 'CASH_ELECTION', options.length + 1));
    if (hasStock) options.push(buildOption(regionFullText, 'STOCK_ELECTION', options.length + 1));
    if (hasMixed) options.push(buildOption(regionFullText, 'MIXED_ELECTION', options.length + 1));
  }
  if (options.length < 2) return null;
  const source = findSpan(regionFullText, ELECTION_SIGNAL_RE);
  const proration = prorationRule(regionFullText);
  const deadlineInfo = deadline(regionFullText);
  return {
    electionType: hasCvr && options.some((o) => o.optionType === 'CVR_INCLUDED')
      ? 'CVR_INCLUSION'
      : (hasCash && hasStock && hasMixed ? 'CASH_OR_STOCK_OR_MIXED' : (hasCash && hasStock ? 'CASH_OR_STOCK' : 'OTHER')),
    isProrated: Boolean(proration),
    defaultTreatment: defaultTreatment(regionFullText),
    electionDeadlineRef: deadlineInfo.electionDeadlineRef,
    electionDeadlineQuote: deadlineInfo.electionDeadlineQuote,
    prorationRule: proration,
    sourceSpanStart: source.start,
    sourceSpanEnd: source.end,
    verbatimQuote: source.quote,
    extractedBy: 'CODEX',
    options,
  };
}

function enforceElectionInvariants(election, regionFullText) {
  if (!election) return;
  if (!Array.isArray(election.options) || election.options.length < 2) {
    throw new Error('election invariant failed: at least two options required');
  }
  if (Boolean(election.isProrated) !== Boolean(election.prorationRule)) {
    throw new Error('election invariant failed: proration flag and proration rule mismatch');
  }
  const orders = election.options.map((o) => Number(o.displayOrder)).sort((a, b) => a - b);
  orders.forEach((order, idx) => {
    if (order !== idx + 1) throw new Error('election invariant failed: display_order values must be 1..N with no gaps');
  });
  const rows = [election, election.prorationRule, ...election.options].filter(Boolean);
  for (const row of rows) {
    const quote = regionFullText.slice(row.sourceSpanStart, row.sourceSpanEnd);
    if (quote !== row.verbatimQuote) throw new Error('election invariant failed: quote fidelity violation');
  }
  if (election.electionType === 'CASH_OR_STOCK') {
    const cashOptions = election.options.filter((o) => o.cashPerShare !== null || o.cashPerShareFormula);
    const stockOptions = election.options.filter((o) => o.stockPerShare !== null || o.stockPerShareFormula);
    if (cashOptions.length !== 1 || stockOptions.length !== 1) {
      throw new Error('election invariant failed: CASH_OR_STOCK requires one cash option and one stock option');
    }
  }
}

module.exports = {
  buildElectionMechanism,
  detectElectionSignals,
  enforceElectionInvariants,
};
