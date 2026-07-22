const { buildSourceBackedProvisionProposalBatch } = require('../canonical-v2/parser-proposal-adapter');
const { sha256Hex } = require('../canonical-v2/canonical-bytes');
const { tryDeterministic } = require('./classify');
const { parseStructure } = require('./structural');
const { buildLayers } = require('./text-layers');

const NO_SHOP_TYPES = new Set(['NOSOL', 'NOSOL-T', 'NOSOL-B', 'NOSOL-M']);

function detectDeterministicNoShopProposals(sourceText) {
  const layers = buildLayers(sourceText);
  const parsed = parseStructure(layers.cleanText);
  return parsed.sections
    .map((section) => ({ section, classification: tryDeterministic(section, null) }))
    .filter(({ classification }) => classification && NO_SHOP_TYPES.has(classification.type))
    .map(({ section, classification }) => Object.freeze({
      proposal_kind: 'LEGACY_DETERMINISTIC_PROVISION_HINT',
      detector_key: 'PARSER_V2_TRY_DETERMINISTIC_NO_SHOP/V1',
      legacy_provision_type_hint: classification.type,
      legacy_confidence: classification.confidence,
      section_number: section.number || null,
      section_title: section.title || section.heading || null,
      article_number: section.articleNumber || null,
      article_title: section.articleTitle || null,
      clean_start: section.startChar,
      clean_end: section.endChar,
      parser_clean_text_digest: sha256Hex(layers.cleanText.slice(section.startChar, section.endChar)),
    }));
}

function buildReadOnlyNoShopProposalBatch({
  contract_bundle: contractBundle,
  source,
  source_admission: sourceAdmission,
  governed_deal_key: governedDealKey,
  deal_admission_id: dealAdmissionId,
} = {}) {
  if (!source || !source.canonical_text || typeof source.canonical_text.text !== 'string') {
    throw new TypeError('an immutable source with canonical text is required');
  }
  const legacyProposals = detectDeterministicNoShopProposals(source.canonical_text.text);
  return buildSourceBackedProvisionProposalBatch({
    contract_bundle: contractBundle,
    source,
    source_admission: sourceAdmission,
    governed_deal_key: governedDealKey,
    deal_admission_id: dealAdmissionId,
    legacy_proposals: legacyProposals,
  });
}

module.exports = {
  buildReadOnlyNoShopProposalBatch,
};
