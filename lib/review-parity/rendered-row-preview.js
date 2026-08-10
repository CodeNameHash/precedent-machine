'use strict';

/**
 * Headless review-row preview.
 *
 * A resolved Canonical V2 claim is projected through its real family product
 * projection, selected through the real Review V2 config, and rendered with
 * the real table primitives. The result contains plain, deterministic text
 * only. It does not read the database and cannot activate serving.
 */

const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { decodeNumericEntities } = require('../html-entities');
const {
  loadEsmModule,
  loadProjection,
  resolveRepoPath,
  toReviewDeal,
} = require('./views');
const { FAMILY_ROUTES, PREVIEW_SCHEMA } = require('./rendered-row-preview-contract');

const NAMED_ENTITIES = Object.freeze({
  amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"',
});
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

class RenderedRowPreviewError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'RenderedRowPreviewError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details) {
  throw new RenderedRowPreviewError(code, message, details);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function decodeHtmlText(value) {
  return decodeNumericEntities(String(value || '')).replace(/&([a-z]+);/gi, (entity, name) => (
    Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name.toLowerCase())
      ? NAMED_ENTITIES[name.toLowerCase()]
      : entity
  ));
}

function tagName(token) {
  const match = /^<\/?\s*([a-z0-9:-]+)/i.exec(token);
  return match ? match[1].toLowerCase() : null;
}

function tagIsHidden(token, name) {
  if (['script', 'style', 'template'].includes(name)) return true;
  if (/\shidden(?:\s|=|>|\/)/i.test(token)) return true;
  if (/\saria-hidden\s*=\s*["']?true(?:["'\s>])/i.test(token)) return true;
  const style = /\sstyle\s*=\s*(["'])(.*?)\1/is.exec(token)?.[2] || '';
  return /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\s*(?:;|$)/i.test(style);
}

function humanVisibleTextFromHtml(html) {
  const tokens = String(html || '').match(/<!--[\s\S]*?-->|<[^>]*>|[^<]+/g) || [];
  const stack = [];
  const text = [];
  let hiddenDepth = 0;
  for (const token of tokens) {
    if (token.startsWith('<!--')) continue;
    if (!token.startsWith('<')) {
      if (hiddenDepth === 0) text.push(decodeHtmlText(token));
      continue;
    }
    if (/^<\//.test(token)) {
      const name = tagName(token);
      let frame;
      do {
        frame = stack.pop();
        if (frame?.hidden) hiddenDepth -= 1;
      } while (frame && frame.name !== name);
      continue;
    }
    if (/^<!|^<\?/.test(token)) continue;
    const name = tagName(token);
    if (!name || VOID_TAGS.has(name) || /\/\s*>$/.test(token)) continue;
    const hidden = hiddenDepth > 0 || tagIsHidden(token, name);
    stack.push({ name, hidden });
    if (hidden) hiddenDepth += 1;
  }
  return text.join(' ').replace(/\s+/g, ' ').trim();
}

function renderNodeText(node) {
  if (node === null || node === undefined || node === false) return '';
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, node));
  return humanVisibleTextFromHtml(html);
}

let liveModules;
function loadLiveModules() {
  if (liveModules) return liveModules;
  const sectionList = loadEsmModule(resolveRepoPath('components/review-v2/sectionList.js'));
  const decorations = loadEsmModule(resolveRepoPath('components/review-v2/configDecorations.js'));
  const primitives = loadEsmModule(resolveRepoPath('components/review/primitives/ProvisionTablePrimitives.jsx'));
  const provisionTable = loadEsmModule(resolveRepoPath('components/review/ProvisionTable.jsx'));
  if (!Array.isArray(sectionList.REVIEW_V2_CONFIGS)
    || typeof decorations.decorateConfigForV2 !== 'function'
    || !primitives
    || !provisionTable.FULL_TEXT_COLUMNS) {
    fail('LIVE_REVIEW_MODULES_INVALID', 'The live Review V2 modules do not expose the required row-rendering surface.');
  }
  liveModules = {
    configs: sectionList.REVIEW_V2_CONFIGS,
    decorateConfigForV2: decorations.decorateConfigForV2,
    primitives,
    fullTextColumns: provisionTable.FULL_TEXT_COLUMNS,
  };
  return liveModules;
}

function visibleColumns(config, rows, fullTextColumns) {
  const override = typeof config.columnsFor === 'function' ? config.columnsFor(rows) : null;
  const all = Array.isArray(override) ? override : (Array.isArray(config.columns) ? config.columns : []);
  const hiddenIds = fullTextColumns[config.id] || [];
  return all.filter((column) => !hiddenIds.includes(column.id));
}

function previewReviewDealRow({ family_id: familyId, review_deal: reviewDeal, target_card_id: targetCardId, deal = {} } = {}) {
  const route = FAMILY_ROUTES[familyId];
  if (!route) fail('FAMILY_NOT_RENDERABLE', `${familyId || 'Unknown family'} has no approved claim-to-review-row route.`, { family_id: familyId || null });
  if (!reviewDeal || !Array.isArray(reviewDeal.cards)) fail('REVIEW_DEAL_INVALID', 'review_deal.cards must be an array.');
  const targetCard = reviewDeal.cards.find((card) => card && (card.id === targetCardId || card.provision_instance_id === targetCardId));
  if (!targetCard) fail('TARGET_CARD_NOT_FOUND', 'The target card is not present in review_deal.cards.', { target_card_id: targetCardId || null });

  const live = loadLiveModules();
  const baseConfig = live.configs.find((config) => config && config.id === route.configId);
  if (!baseConfig) fail('SECTION_CONFIG_NOT_FOUND', `Review V2 config ${route.configId} is missing.`);
  const agreementIso = deal.announce_date || deal.agreement_date || null;
  const config = live.decorateConfigForV2(baseConfig, { agreementIso });
  let rows;
  try {
    rows = config.selectRows(reviewDeal);
  } catch (error) {
    fail('SELECT_ROWS_FAILED', `Review V2 selectRows failed: ${error.message}`, { section_id: config.id });
  }
  if (!Array.isArray(rows)) fail('SELECT_ROWS_INVALID', 'Review V2 selectRows did not return an array.', { section_id: config.id });
  if (rows.length === 0) fail('CLAIM_RENDERED_NO_ROW', 'The projected claim produced no Review V2 row.', { section_id: config.id, target_card_id: targetCardId });
  if (rows.length !== 1) fail('CLAIM_RENDERED_AMBIGUOUS_ROWS', 'The claim-to-reviewDeal slice produced more than one top-level row.', { section_id: config.id, row_ids: rows.map((row) => row.id || null) });

  const row = rows[0];
  const columns = visibleColumns(config, rows, live.fullTextColumns);
  if (columns.length === 0) fail('CLAIM_RENDERED_NO_VISIBLE_CELLS', 'The Review V2 row has no visible cells.', { section_id: config.id });
  const ctx = {
    reviewDeal,
    config,
    primitives: live.primitives,
    isEdit: false,
    resolveCard: () => targetCard,
    onSelectCard: null,
    selectedCardId: null,
  };
  const cells = columns.map((column) => {
    let node;
    try {
      node = typeof column.renderCell === 'function' ? column.renderCell(row, ctx) : null;
    } catch (error) {
      fail('CELL_RENDER_FAILED', `Review V2 cell ${column.id} failed to render: ${error.message}`, { section_id: config.id, column_id: column.id });
    }
    return deepFreeze({ id: column.id, header: renderNodeText(column.header || ''), text: renderNodeText(node) });
  });
  return deepFreeze({
    schema_version: PREVIEW_SCHEMA,
    family_id: familyId,
    section: { id: config.id, title: renderNodeText(config.title || '') },
    row: {
      id: row.id || targetCard.id || targetCard.provision_instance_id,
      label: renderNodeText(row.label || targetCard.short_title || targetCard.title || row.id || ''),
      cells,
    },
  });
}

function entryProvisionId(entry) {
  return entry?.provision_instance?.provision_instance_id || null;
}

function resolutionSlice(resolution, provisionId) {
  const sameProvision = (entry) => entryProvisionId(entry) === provisionId;
  return {
    ...resolution,
    resolved: resolution.resolved.filter(sameProvision),
    open_world: Array.isArray(resolution.open_world) ? resolution.open_world.filter(sameProvision) : [],
    residuals: Array.isArray(resolution.residuals) ? resolution.residuals.filter(sameProvision) : [],
    review_queue: Array.isArray(resolution.review_queue) ? resolution.review_queue.filter(sameProvision) : [],
  };
}

function previewResolvedClaimRow({ run, resolved_entry: resolvedEntry, claim_revision_id: claimRevisionId, deal_id: dealId, deal = {} } = {}) {
  if (!run?.manifest || !run?.resolution || !Array.isArray(run.resolution.resolved)) {
    fail('RUN_INVALID', 'run must contain manifest and resolution.resolved.');
  }
  const familyId = run.manifest.section_family;
  const route = FAMILY_ROUTES[familyId];
  if (!route) fail('FAMILY_NOT_RENDERABLE', `${familyId || 'Unknown family'} has no approved claim-to-review-row route.`, { family_id: familyId || null });
  const suppliedId = resolvedEntry?.claim?.claim_revision_id || claimRevisionId;
  if (typeof suppliedId !== 'string' || !suppliedId) fail('CLAIM_IDENTITY_MISSING', 'resolved_entry or claim_revision_id is required.');
  if (resolvedEntry && claimRevisionId && resolvedEntry.claim?.claim_revision_id !== claimRevisionId) {
    fail('CLAIM_IDENTITY_CONFLICT', 'resolved_entry and claim_revision_id identify different claims.');
  }
  const matches = run.resolution.resolved.filter((entry) => entry?.claim?.claim_revision_id === suppliedId);
  if (matches.length !== 1) fail('CLAIM_NOT_UNIQUE', 'The claim must occur exactly once in run.resolution.resolved.', { claim_revision_id: suppliedId, occurrences: matches.length });
  if (resolvedEntry && resolvedEntry !== matches[0]
    && JSON.stringify(resolvedEntry) !== JSON.stringify(matches[0])) {
    fail('RESOLVED_ENTRY_NOT_IN_RUN', 'resolved_entry does not match the claim recorded in the run.', { claim_revision_id: suppliedId });
  }
  const provisionId = entryProvisionId(matches[0]);
  if (!provisionId) fail('PROVISION_IDENTITY_MISSING', 'The resolved claim has no provision_instance_id.', { claim_revision_id: suppliedId });
  const effectiveDealId = dealId || run.manifest.deal;
  if (typeof effectiveDealId !== 'string' || !effectiveDealId) fail('DEAL_IDENTITY_MISSING', 'The run has no deal identity.');

  const project = loadProjection(route.projectionModule, route.projectionExport);
  let projection;
  try {
    projection = project({ resolution: resolutionSlice(run.resolution, provisionId), deal_id: effectiveDealId });
  } catch (error) {
    fail('CLAIM_PROJECTION_FAILED', `The ${familyId} product projection failed: ${error.message}`, { claim_revision_id: suppliedId });
  }
  if (!projection || !Array.isArray(projection.cards)) fail('CLAIM_PROJECTION_INVALID', 'The family product projection returned no cards array.', { family_id: familyId });
  const cards = projection.cards.filter((card) => card?.canonical_v2_lineage?.claim_revision_ids?.includes(suppliedId));
  if (cards.length !== 1) fail('CLAIM_PROJECTED_CARD_NOT_UNIQUE', 'The claim must project to exactly one review card.', { claim_revision_id: suppliedId, cards: cards.length });
  const reviewDeal = toReviewDeal(effectiveDealId, cards);
  const preview = previewReviewDealRow({ family_id: familyId, review_deal: reviewDeal, target_card_id: cards[0].id, deal: { ...deal, agreement_date: run.manifest.agreement_date } });
  return deepFreeze({ ...preview, claim_revision_id: suppliedId, provision_instance_id: provisionId });
}

module.exports = {
  FAMILY_ROUTES,
  PREVIEW_SCHEMA,
  RenderedRowPreviewError,
  humanVisibleTextFromHtml,
  previewResolvedClaimRow,
  previewReviewDealRow,
  renderNodeText,
};
