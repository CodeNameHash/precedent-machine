const { buildFeaturesForCard, groupClaimsByExcerpt } = require('./claims-adapter');

function parseReferences(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function sortKey(card) {
  const provenance = card.provenance && typeof card.provenance === 'object' ? card.provenance : {};
  const offset = Number.isFinite(Number(provenance.source_doc_offset_start))
    ? Number(provenance.source_doc_offset_start)
    : Number.MAX_SAFE_INTEGER;
  return [offset, card.section_ref || '', card.short_title || '', card.provision_instance_id || ''];
}

function compareCards(a, b) {
  const left = sortKey(a);
  const right = sortKey(b);
  for (let index = 0; index < left.length; index += 1) {
    if (typeof left[index] === 'number' || typeof right[index] === 'number') {
      const diff = Number(left[index]) - Number(right[index]);
      if (diff !== 0) return diff;
    } else {
      const diff = String(left[index]).localeCompare(String(right[index]));
      if (diff !== 0) return diff;
    }
  }
  return 0;
}

function stripProposedShortTitle(shortTitle) {
  return typeof shortTitle === 'string' ? shortTitle.replace(/^\[PROPOSED\] /, '') : shortTitle;
}

function normalizeDisplayRow(row, options = {}) {
  const mode = options.mode || options.renderMode || 'user';
  if (mode === 'admin') return row;
  return {
    ...row,
    short_title: stripProposedShortTitle(row.short_title),
  };
}

function isUncoveredTextCard(row) {
  const shortTitle = String(row && row.short_title ? row.short_title : '');
  const sectionRef = String(row && row.section_ref ? row.section_ref : '');
  return shortTitle.startsWith('Uncovered text') || sectionRef.includes('Uncovered text');
}

function filterRowsForMode(rows, options = {}) {
  const mode = options.mode || options.renderMode || 'user';
  const list = Array.isArray(rows) ? rows : [];
  if (mode === 'admin') return list;
  return list.filter((row) => !isUncoveredTextCard(row));
}

function normalizeCard(row, definitionsById, claimsByExcerpt) {
  const references = parseReferences(row.references);
  const resolvedReferences = references
    .map((id) => definitionsById.get(id))
    .filter(Boolean);
  const claims = (claimsByExcerpt && row.excerpt_id && claimsByExcerpt.get(row.excerpt_id)) || [];
  return {
    ...row,
    kind: row.kind || 'standard',
    references,
    resolvedReferences,
    unresolvedReferences: references.filter((id) => !definitionsById.has(id)),
    features: buildFeaturesForCard(claims),
  };
}

function groupRowsBySection(cards) {
  const groups = new Map();
  for (const card of cards) {
    const sectionRef = card.section_ref || 'Unspecified';
    if (!groups.has(sectionRef)) {
      groups.set(sectionRef, {
        sectionRef,
        title: sectionRef,
        cards: [],
      });
    }
    groups.get(sectionRef).cards.push(card);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    cards: group.cards.sort(compareCards),
  }));
}

function shapeReviewDealRows(dealId, rows = [], options = {}) {
  const sortedRows = [...filterRowsForMode(rows, options)].sort(compareCards);
  const displayRows = sortedRows.map((row) => normalizeDisplayRow(row, options));
  const rawDefinitions = displayRows.filter((row) => row.kind === 'definition');
  const definitionsById = new Map(rawDefinitions.map((row) => [row.provision_instance_id, row]));
  const claimsByExcerpt = groupClaimsByExcerpt(options.claims);
  const cards = displayRows.map((row) => normalizeCard(row, definitionsById, claimsByExcerpt));
  const definitions = cards.filter((card) => card.kind === 'definition');
  const sections = groupRowsBySection(cards);
  return {
    dealId,
    cardCount: cards.length,
    cards,
    definitions,
    sections,
  };
}

function isMissingTable(error, tableName) {
  const message = error && (error.message || String(error));
  return new RegExp(`${tableName}|schema cache|does not exist|Could not find`, 'i').test(message || '');
}

function isMissingProvisionCards(error) {
  return isMissingTable(error, 'provision_cards');
}

function isMissingClaims(error) {
  return isMissingTable(error, 'claims');
}

async function fetchDealClaims(dealId, sb) {
  const { data, error } = await sb
    .from('claims')
    .select('*')
    .eq('deal_id', dealId);
  if (error) {
    // The claims table is a newer, separately-backfilled addition. Degrade
    // to "no claims" rather than failing the whole review page when it's
    // not present yet in a given environment; any other error still throws.
    if (isMissingClaims(error)) return [];
    throw new Error(`Failed to read claims: ${error.message}`);
  }
  return data || [];
}

async function fetchReviewDealCards(dealId, sb, options = {}) {
  if (!dealId) throw new Error('dealId is required');
  if (!sb) throw new Error('Supabase client is required');
  const [cardsResult, claims] = await Promise.all([
    sb.from('provision_cards').select('*').eq('deal_id', dealId),
    fetchDealClaims(dealId, sb),
  ]);
  const { data, error } = cardsResult;
  if (error) {
    if (isMissingProvisionCards(error)) {
      throw new Error('provision_cards table missing; run schema-03 and schema-04 card migrations');
    }
    throw new Error(`Failed to read provision_cards: ${error.message}`);
  }
  return shapeReviewDealRows(dealId, data || [], { ...options, claims });
}

module.exports = {
  compareCards,
  fetchDealClaims,
  fetchReviewDealCards,
  groupRowsBySection,
  filterRowsForMode,
  isUncoveredTextCard,
  parseReferences,
  shapeReviewDealRows,
  stripProposedShortTitle,
};
