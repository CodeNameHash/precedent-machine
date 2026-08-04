'use strict';

const { buildStructuredPerShareCashValue } = require('./structured-per-share-cash-value');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function definitionCitation(sourceText, definitionStart) {
  const prefix = sourceText.slice(0, definitionStart);
  const headings = [...prefix.matchAll(/(?:^|\n)\s*Section\s+(\d+(?:\.\d+)*)\.?\s+Definitions\b/gi)];
  const heading = headings.at(-1);
  if (!heading) return null;
  const afterHeading = prefix.slice((heading.index || 0) + heading[0].length);
  const marker = /\(([a-z]{1,4})\)\s*$/i.exec(afterHeading);
  return marker ? `${heading[1]}(${marker[1]})` : null;
}

function uniqueDefinitionRecord(sourceText, term) {
  if (typeof sourceText !== 'string' || typeof term !== 'string' || !term) return null;
  const escaped = escapeRegExp(term);
  const matches = [...sourceText.matchAll(new RegExp(`(?:“|")${escaped}(?:”|")\\s+means\\s+([^;\\r\\n]+)`, 'g'))];
  if (matches.length !== 1) return null;
  const match = matches[0];
  const sourceCitation = definitionCitation(sourceText, match.index);
  if (!sourceCitation) return null;
  return Object.freeze({
    value: match[1].trim().replace(/\.$/, ''),
    quote: match[0].trim(),
    source_citation: sourceCitation,
  });
}

function uniqueDefinition(sourceText, term) {
  return uniqueDefinitionRecord(sourceText, term)?.value || null;
}

function resolveStructuredPerShareCashValue({
  source_text: sourceText,
  operative_quote: operativeQuote,
  operative_source_citation: operativeSourceCitation,
  consideration_term_ref: considerationTermRef,
} = {}) {
  if (typeof sourceText !== 'string' || typeof operativeQuote !== 'string'
    || typeof operativeSourceCitation !== 'string' || !operativeSourceCitation
    || typeof considerationTermRef !== 'string' || !considerationTermRef
    || /fractional shares/i.test(operativeQuote)) return null;

  const escapedAlias = escapeRegExp(considerationTermRef);
  const alias = new RegExp(`cash\\s+equal\\s+to\\s+the\\s+([A-Z][A-Za-z0-9’'&.\\- ]{1,100}?)\\s+\\(such\\s+amount,\\s+the\\s+(?:“|")${escapedAlias}(?:”|")\\)`, 'i').exec(operativeQuote);
  if (!alias) return null;

  const valueTerm = alias[1].trim();
  const definition = uniqueDefinitionRecord(sourceText, valueTerm);
  if (!definition) return null;
  const formula = definition.value;
  const parsed = /^an amount in cash equal to [A-Za-z-]+(?:\s+[A-Za-z-]+)* Dollars \(\$([0-9]+(?:\.[0-9]{1,2})?)\) plus (.+)$/i.exec(formula);
  if (!parsed) return null;

  return buildStructuredPerShareCashValue({
    consideration_term_ref: considerationTermRef,
    operator: 'BASE_PLUS_VARIABLE',
    base_amount: parsed[1],
    currency: 'USD',
    variable_component: parsed[2],
    defined_term_lineage: Object.freeze([considerationTermRef, valueTerm]),
    source_citations: Object.freeze([operativeSourceCitation, definition.source_citation]),
    operative_quote: operativeQuote,
    definition_quote: definition.quote,
    raw_formula: formula,
  });
}

module.exports = { uniqueDefinition, uniqueDefinitionRecord, resolveStructuredPerShareCashValue };
