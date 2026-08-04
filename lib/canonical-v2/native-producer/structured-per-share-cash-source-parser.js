'use strict';

const { buildStructuredPerShareCashValue } = require('./structured-per-share-cash-value');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function uniqueDefinition(sourceText, term) {
  const escaped = escapeRegExp(term);
  const matches = [...sourceText.matchAll(new RegExp(`(?:“|")${escaped}(?:”|")\\s+means\\s+([^;\\r\\n]+)`, 'g'))];
  return matches.length === 1 ? matches[0][1].trim().replace(/\.$/, '') : null;
}

function resolveStructuredPerShareCashValue({
  source_text: sourceText,
  operative_quote: operativeQuote,
  consideration_term_ref: considerationTermRef,
} = {}) {
  if (typeof sourceText !== 'string' || typeof operativeQuote !== 'string'
    || typeof considerationTermRef !== 'string' || !considerationTermRef
    || /fractional shares/i.test(operativeQuote)) return null;

  const escapedAlias = escapeRegExp(considerationTermRef);
  const alias = new RegExp(`cash\\s+equal\\s+to\\s+the\\s+([A-Z][A-Za-z0-9’'&.\\- ]{1,100}?)\\s+\\(such\\s+amount,\\s+the\\s+(?:“|")${escapedAlias}(?:”|")\\)`, 'i').exec(operativeQuote);
  if (!alias) return null;

  const valueTerm = alias[1].trim();
  const formula = uniqueDefinition(sourceText, valueTerm);
  if (!formula) return null;
  const parsed = /^an amount in cash equal to [A-Za-z-]+(?:\s+[A-Za-z-]+)* Dollars \(\$([0-9]+(?:\.[0-9]{1,2})?)\) plus (.+)$/i.exec(formula);
  if (!parsed) return null;

  return buildStructuredPerShareCashValue({
    consideration_term_ref: considerationTermRef,
    operator: 'BASE_PLUS_VARIABLE',
    base_amount: parsed[1],
    currency: 'USD',
    variable_component: parsed[2],
    defined_term_lineage: Object.freeze([considerationTermRef, valueTerm]),
    operative_quote: operativeQuote,
    raw_formula: formula,
  });
}

module.exports = { uniqueDefinition, resolveStructuredPerShareCashValue };
