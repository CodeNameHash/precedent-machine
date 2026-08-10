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
const { FAMILY_ROUTES, PREVIEW_SCHEMA, SECTION_PREVIEW_SCHEMA } = require('./rendered-row-preview-contract');

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

function routeConfigId(route, targetCard) {
  if (!route.configIdByPartyCapacity) return route.configId;
  const capacity = targetCard?.party?.capacity;
  const configId = route.configIdByPartyCapacity[capacity];
  if (!configId) {
    fail('ROUTE_PARTY_CAPACITY_UNSUPPORTED', 'The governed card party cannot select a Review V2 section.', {
      party_capacity: capacity || null,
    });
  }
  return configId;
}

function routeForEntry(familyRoute, entry) {
  const definition = entry?.resolved_claim_definition_key
    || entry?.claim?.claim_definition_key
    || null;
  const concept = entry?.concept_key || null;
  const override = familyRoute?.claimRouteByClaimDefinition?.[definition]
    || familyRoute?.claimRouteByConceptKey?.[concept]
    || null;
  return override ? { ...familyRoute, ...override } : familyRoute;
}

function featureLineageRowMatches(row, featureKey, claimRevisionId) {
  const ownsFeature = row?.featureKey === featureKey
    || (Array.isArray(row?.featureKeys)
      && row.featureKeys.some((candidate) => candidate === featureKey));
  if (!ownsFeature) return false;
  if (typeof row.claimRevisionId === 'string' && row.claimRevisionId) {
    return row.claimRevisionId === claimRevisionId;
  }
  const sourceCard = row?.sourceCard || row?.source || null;
  const featureClaimIds = sourceCard?.canonical_v2_lineage
    ?.feature_claim_revision_ids?.[featureKey];
  return Array.isArray(featureClaimIds)
    && featureClaimIds.length === 1
    && featureClaimIds[0] === claimRevisionId;
}

function previewReviewDealRow({ family_id: familyId, review_deal: reviewDeal, target_card_id: targetCardId, target_feature_key: targetFeatureKey, target_claim_revision_id: targetClaimRevisionId, resolved_entry: resolvedEntry, deal = {} } = {}) {
  const familyRoute = FAMILY_ROUTES[familyId];
  if (!familyRoute) fail('FAMILY_NOT_RENDERABLE', `${familyId || 'Unknown family'} has no approved claim-to-review-row route.`, { family_id: familyId || null });
  const route = routeForEntry(familyRoute, resolvedEntry);
  if (!reviewDeal || !Array.isArray(reviewDeal.cards)) fail('REVIEW_DEAL_INVALID', 'review_deal.cards must be an array.');
  const targetCard = reviewDeal.cards.find((card) => card && (card.id === targetCardId || card.provision_instance_id === targetCardId));
  if (!targetCard) fail('TARGET_CARD_NOT_FOUND', 'The target card is not present in review_deal.cards.', { target_card_id: targetCardId || null });

  const live = loadLiveModules();
  const configId = routeConfigId(route, targetCard);
  const baseConfig = live.configs.find((config) => config && config.id === configId);
  if (!baseConfig) fail('SECTION_CONFIG_NOT_FOUND', `Review V2 config ${configId} is missing.`);
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
  const selectedRows = targetFeatureKey
    ? rows.filter((candidate) => featureLineageRowMatches(candidate, targetFeatureKey, targetClaimRevisionId))
    : route.rowMatch === 'SOURCE_CARD'
      ? rows.filter((candidate) => candidate?.sourceCard?.id === targetCard.id)
      : rows;
  if (selectedRows.length === 0) {
    fail('CLAIM_FEATURE_ROW_MISSING', 'The governed claim feature produced no Review V2 row.', {
      section_id: config.id,
      feature_key: targetFeatureKey,
    });
  }
  if (selectedRows.length !== 1) fail('CLAIM_RENDERED_AMBIGUOUS_ROWS', 'The claim-to-reviewDeal slice produced more than one matching row.', { section_id: config.id, row_ids: selectedRows.map((row) => row.id || null) });

  const row = selectedRows[0];
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
    ioc_restriction_components: Array.isArray(resolution.ioc_restriction_components)
      ? resolution.ioc_restriction_components.filter(
        (component) => component?.parent_provision_instance_id === provisionId,
      )
      : [],
    open_world: Array.isArray(resolution.open_world) ? resolution.open_world.filter(sameProvision) : [],
    residuals: Array.isArray(resolution.residuals) ? resolution.residuals.filter(sameProvision) : [],
    review_queue: Array.isArray(resolution.review_queue) ? resolution.review_queue.filter(sameProvision) : [],
  };
}

function cardsFromProjection(route, projection, familyId) {
  const cardArrayKey = route.cardArrayKey || 'cards';
  const cards = projection?.[cardArrayKey];
  if (!Array.isArray(cards)) {
    fail('CLAIM_PROJECTION_INVALID', `The ${familyId} product projection returned no ${cardArrayKey} array.`, {
      family_id: familyId,
      card_array_key: cardArrayKey,
    });
  }
  return cards;
}

function claimFeatureKey(route, entry, targetCard, claimRevisionId) {
  if (route.rowMatch !== 'FEATURE_LINEAGE' && route.validateFeatureLineage !== true) return null;
  const claimDefinitionKey = entry?.resolved_claim_definition_key
    || entry?.claim?.claim_definition_key
    || null;
  const assertionKind = entry?.claim?.attributes?.assertion_kind || null;
  const featureRoute = route.featureKeyByClaimDefinition?.[claimDefinitionKey]
    || route.featureKeyByAssertionKind?.[assertionKind];
  const featureKeys = Array.isArray(featureRoute) ? featureRoute : [featureRoute];
  if (!featureRoute || featureKeys.some((featureKey) => typeof featureKey !== 'string' || !featureKey)) {
    fail('CLAIM_FEATURE_ROUTE_MISSING', 'The governed claim definition has no Review V2 feature route.', {
      claim_revision_id: claimRevisionId,
      claim_definition_key: claimDefinitionKey,
      assertion_kind: assertionKind,
    });
  }
  const matchingFeatureKeys = featureKeys.filter((featureKey) => {
    const featureClaimIds = targetCard?.canonical_v2_lineage?.feature_claim_revision_ids?.[featureKey];
    return Array.isArray(featureClaimIds) && featureClaimIds.includes(claimRevisionId);
  });
  if (matchingFeatureKeys.length === 0) {
    fail('CLAIM_FEATURE_LINEAGE_MISSING', 'The projected card does not bind the claim to its governed Review V2 feature.', {
      claim_revision_id: claimRevisionId,
      feature_key: featureRoute,
    });
  }
  if (matchingFeatureKeys.length !== 1) {
    fail('CLAIM_FEATURE_LINEAGE_AMBIGUOUS', 'The projected card binds the claim to more than one allowed Review V2 feature.', {
      claim_revision_id: claimRevisionId,
      feature_keys: matchingFeatureKeys,
    });
  }
  const [featureKey] = matchingFeatureKeys;
  if (!Object.hasOwn(targetCard?.features || {}, featureKey)) {
    fail('CLAIM_FEATURE_VALUE_MISSING', 'The projected card lineage names a Review V2 feature with no value.', {
      claim_revision_id: claimRevisionId,
      feature_key: featureKey,
    });
  }
  return route.rowMatch === 'FEATURE_LINEAGE' ? featureKey : null;
}

function reviewDealForCards(route, dealId, cards) {
  const arrayFeature = route.reviewDealArrayFeature;
  const extra = route.reviewDealExtra ? { ...route.reviewDealExtra } : {};
  if (!arrayFeature) return toReviewDeal(dealId, cards, extra);
  const values = cards.flatMap((card) => {
    const value = card?.features?.[arrayFeature.feature];
    return Array.isArray(value) ? value : [];
  });
  return toReviewDeal(dealId, cards, { ...extra, [arrayFeature.field]: values });
}

function previewResolvedClaimRow({ run, resolved_entry: resolvedEntry, claim_revision_id: claimRevisionId, deal_id: dealId, deal = {} } = {}) {
  if (!run?.manifest || !run?.resolution || !Array.isArray(run.resolution.resolved)) {
    fail('RUN_INVALID', 'run must contain manifest and resolution.resolved.');
  }
  const familyId = run.manifest.section_family;
  const familyRoute = FAMILY_ROUTES[familyId];
  if (!familyRoute) fail('FAMILY_NOT_RENDERABLE', `${familyId || 'Unknown family'} has no approved claim-to-review-row route.`, { family_id: familyId || null });
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
  const route = routeForEntry(familyRoute, matches[0]);
  const provisionId = entryProvisionId(matches[0]);
  if (!provisionId) fail('PROVISION_IDENTITY_MISSING', 'The resolved claim has no provision_instance_id.', { claim_revision_id: suppliedId });
  const effectiveDealId = dealId || run.manifest.deal;
  if (typeof effectiveDealId !== 'string' || !effectiveDealId) fail('DEAL_IDENTITY_MISSING', 'The run has no deal identity.');

  const projection = projectClaimSlice(route, familyId, run.resolution, provisionId, effectiveDealId, suppliedId);
  const projectionCards = cardsFromProjection(route, projection, familyId);
  const cards = projectionCards.filter((card) => card?.canonical_v2_lineage?.claim_revision_ids?.includes(suppliedId));
  if (cards.length !== 1) fail('CLAIM_PROJECTED_CARD_NOT_UNIQUE', 'The claim must project to exactly one review card.', { claim_revision_id: suppliedId, cards: cards.length });
  const featureKey = claimFeatureKey(route, matches[0], cards[0], suppliedId);
  const reviewDeal = reviewDealForCards(route, effectiveDealId, cards);
  const preview = previewReviewDealRow({
    family_id: familyId,
    review_deal: reviewDeal,
    target_card_id: cards[0].id,
    target_feature_key: featureKey,
    target_claim_revision_id: suppliedId,
    resolved_entry: matches[0],
    deal: { ...deal, agreement_date: run.manifest.agreement_date },
  });
  return deepFreeze({ ...preview, claim_revision_id: suppliedId, provision_instance_id: provisionId });
}

// Two projection calling conventions exist and the export name tells you which:
// `...ProductSurfaces` takes `{ resolution, deal_id }`, `...Claims` takes
// `{ resolved_entries }`. A route declares the second with
// `projectionArgs: 'RESOLVED_ENTRIES'`.
function projectClaimSlice(route, familyId, resolution, provisionId, dealId, claimRevisionId) {
  const project = loadProjection(route.projectionModule, route.projectionExport);
  const slice = resolutionSlice(resolution, provisionId);
  const resolvedEntries = route.projectionScope === 'CLAIM'
    ? slice.resolved.filter((entry) => entry?.claim?.claim_revision_id === claimRevisionId)
    : slice.resolved;
  const scopedResolution = route.projectionScope === 'CLAIM'
    ? { ...slice, resolved: resolvedEntries }
    : slice;
  let projection;
  try {
    projection = route.projectionArgs === 'RESOLVED_ENTRIES'
      ? project({ resolved_entries: resolvedEntries })
      : project({ resolution: scopedResolution, deal_id: dealId });
  } catch (error) {
    fail('CLAIM_PROJECTION_FAILED', `The ${familyId} product projection failed: ${error.message}`, { claim_revision_id: claimRevisionId });
  }
  return projection;
}

// Section-level preview. `previewResolvedClaimRow` deliberately refuses when a
// claim's slice yields more than one top-level row, because a single-row
// contract cannot honestly pick between them. But several families are
// CATALOGUE-shaped: `selectRows` emits the section's whole fixed row set and a
// claim fills cells within it, so more-than-one is the normal case, not a
// defect. This returns every row the slice renders and marks the one row bound
// by the route's explicit bucket, feature, source-card, or scoped-row contract.
function previewClaimSection({ run, resolved_entry: resolvedEntry, claim_revision_id: claimRevisionId, deal_id: dealId, deal = {}, scope = 'CLAIM' } = {}) {
  if (!run?.manifest || !run?.resolution || !Array.isArray(run.resolution.resolved)) {
    fail('RUN_INVALID', 'run must contain manifest and resolution.resolved.');
  }
  const familyId = run.manifest.section_family;
  const familyRoute = FAMILY_ROUTES[familyId];
  if (!familyRoute) fail('FAMILY_NOT_RENDERABLE', `${familyId || 'Unknown family'} has no approved claim-to-review-row route.`, { family_id: familyId || null });
  const suppliedId = resolvedEntry?.claim?.claim_revision_id || claimRevisionId;
  if (typeof suppliedId !== 'string' || !suppliedId) fail('CLAIM_IDENTITY_MISSING', 'resolved_entry or claim_revision_id is required.');
  const matches = run.resolution.resolved.filter((entry) => entry?.claim?.claim_revision_id === suppliedId);
  if (matches.length !== 1) fail('CLAIM_NOT_UNIQUE', 'The claim must occur exactly once in run.resolution.resolved.', { claim_revision_id: suppliedId, occurrences: matches.length });
  const route = routeForEntry(familyRoute, matches[0]);
  const provisionId = entryProvisionId(matches[0]);
  if (!provisionId) fail('PROVISION_IDENTITY_MISSING', 'The resolved claim has no provision_instance_id.', { claim_revision_id: suppliedId });
  const effectiveDealId = dealId || run.manifest.deal;

  const projection = projectClaimSlice(route, familyId, run.resolution, provisionId, effectiveDealId, suppliedId);
  const projectionCards = cardsFromProjection(route, projection, familyId);
  const cards = projectionCards.filter((card) => card?.canonical_v2_lineage?.claim_revision_ids?.includes(suppliedId));
  if (cards.length === 0) fail('CLAIM_PROJECTED_NO_CARD', 'The claim projected to no review card.', { claim_revision_id: suppliedId });
  if (cards.length !== 1) fail('CLAIM_PROJECTED_CARD_NOT_UNIQUE', 'The claim must project to exactly one review card.', { claim_revision_id: suppliedId, cards: cards.length });
  const targetCard = cards[0];
  const featureKey = claimFeatureKey(route, matches[0], targetCard, suppliedId);
  // Build the view from the claim's lineage-bearing card. Catalogue families
  // can keep one provision card, but must carry an exact row-level lineage key.
  const scopedCards = scope === 'PROVISION' ? projectionCards : cards;
  const reviewDeal = reviewDealForCards(route, effectiveDealId, scopedCards);

  const live = loadLiveModules();
  const configId = routeConfigId(route, targetCard);
  const baseConfig = live.configs.find((config) => config && config.id === configId);
  if (!baseConfig) fail('SECTION_CONFIG_NOT_FOUND', `Review V2 config ${configId} is missing.`);
  const agreementIso = deal.announce_date || deal.agreement_date || run.manifest.agreement_date || null;
  const config = live.decorateConfigForV2(baseConfig, { agreementIso });
  let rows;
  try {
    rows = config.selectRows(reviewDeal);
  } catch (error) {
    fail('SELECT_ROWS_FAILED', `Review V2 selectRows failed: ${error.message}`, { section_id: config.id });
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    fail('CLAIM_RENDERED_NO_ROW', 'The projected claim produced no Review V2 row.', { section_id: config.id, claim_revision_id: suppliedId });
  }
  if (!route.rowMatch) {
    fail('CLAIM_EXACT_ROW_ROUTE_MISSING', 'The family route does not define an exact governed claim-to-row match.', {
      family_id: familyId,
      claim_revision_id: suppliedId,
    });
  }
  if (route.rowMatch === 'SINGLE_SCOPED_ROW' && rows.length !== 1) {
    fail('CLAIM_SCOPED_ROW_NOT_UNIQUE', 'The single lineage-bearing card must produce exactly one Review V2 row.', {
      claim_revision_id: suppliedId,
      row_ids: rows.map((row) => row?.id || null),
    });
  }
  const columns = visibleColumns(config, rows, live.fullTextColumns);
  const ctx = {
    reviewDeal,
    config,
    primitives: live.primitives,
    isEdit: false,
    resolveCard: () => targetCard,
    onSelectCard: null,
    selectedCardId: null,
  };
  const claimKey = matches[0]?.resolved_claim_definition_key
    || matches[0]?.claim?.resolved_claim_definition_key
    || null;
  const bucketCode = matches[0]?.claim?.attributes?.bucket_code || null;
  if (route.rowMatch === 'BUCKET_CODE') {
    const bucketLineage = targetCard?.canonical_v2_lineage?.bucket_claim_revision_ids?.[bucketCode];
    if (!Array.isArray(bucketLineage) || !bucketLineage.includes(suppliedId)) {
      fail('CLAIM_ROW_LINEAGE_MISSING', 'The Material Contracts claim is not bound to its bucket row.', {
        claim_revision_id: suppliedId,
        bucket_code: bucketCode,
      });
    }
  }
  const renderedRows = rows.map((row) => {
    const cells = columns.map((column) => {
      let node = null;
      try {
        node = typeof column.renderCell === 'function' ? column.renderCell(row, ctx) : null;
      } catch (error) {
        return deepFreeze({ id: column.id, header: renderNodeText(column.header || ''), text: null, render_error: error.message });
      }
      return deepFreeze({ id: column.id, header: renderNodeText(column.header || ''), text: renderNodeText(node) });
    });
    const rowId = row.id || null;
    return deepFreeze({
      id: rowId,
      label: renderNodeText(row.label || targetCard.short_title || targetCard.title || rowId || ''),
      matches_claim_key: route.rowMatch === 'BUCKET_CODE'
        ? Boolean(bucketCode) && (row.itemCode === bucketCode || row.code === bucketCode)
        : route.rowMatch === 'FEATURE_LINEAGE'
          ? featureLineageRowMatches(row, featureKey, suppliedId)
          : route.rowMatch === 'SOURCE_CARD'
            ? row.sourceCard?.id === targetCard.id
            : route.rowMatch === 'SINGLE_SCOPED_ROW'
              ? rows.length === 1
              : false,
      cells,
    });
  });
  if (route.rowMatch === 'BUCKET_CODE'
    && renderedRows.filter((row) => row.matches_claim_key).length !== 1) {
    fail('CLAIM_ROW_NOT_UNIQUE', 'The Material Contracts claim must match exactly one bucket row.', {
      claim_revision_id: suppliedId,
      bucket_code: bucketCode,
    });
  }
  if (route.rowMatch === 'FEATURE_LINEAGE'
    && renderedRows.filter((row) => row.matches_claim_key).length !== 1) {
    fail('CLAIM_FEATURE_ROW_NOT_UNIQUE', 'The governed claim must match exactly one Review V2 feature row.', {
      claim_revision_id: suppliedId,
      feature_key: featureKey,
    });
  }
  if (route.rowMatch === 'SOURCE_CARD'
    && renderedRows.filter((row) => row.matches_claim_key).length !== 1) {
    fail('CLAIM_SOURCE_CARD_ROW_NOT_UNIQUE', 'The governed claim must match exactly one source-card row.', {
      claim_revision_id: suppliedId,
      target_card_id: targetCard.id,
    });
  }
  if (route.rowMatch === 'SINGLE_SCOPED_ROW'
    && renderedRows.filter((row) => row.matches_claim_key).length !== 1) {
    fail('CLAIM_SCOPED_ROW_NOT_UNIQUE', 'The lineage-bearing card must match exactly one scoped Review V2 row.', {
      claim_revision_id: suppliedId,
    });
  }
  return deepFreeze({
    schema_version: SECTION_PREVIEW_SCHEMA,
    family_id: familyId,
    scope,
    claim_revision_id: suppliedId,
    provision_instance_id: provisionId,
    resolved_claim_definition_key: claimKey,
    section: { id: config.id, title: renderNodeText(config.title || '') },
    row_count: renderedRows.length,
    rows: renderedRows,
  });
}

module.exports = {
  FAMILY_ROUTES,
  PREVIEW_SCHEMA,
  SECTION_PREVIEW_SCHEMA,
  RenderedRowPreviewError,
  humanVisibleTextFromHtml,
  previewClaimSection,
  previewResolvedClaimRow,
  previewReviewDealRow,
  renderNodeText,
};
