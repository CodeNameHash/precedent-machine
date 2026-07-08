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

function normalizeCard(row, definitionsById) {
  const references = parseReferences(row.references);
  const resolvedReferences = references
    .map((id) => definitionsById.get(id))
    .filter(Boolean);
  return {
    ...row,
    kind: row.kind || 'standard',
    references,
    resolvedReferences,
    unresolvedReferences: references.filter((id) => !definitionsById.has(id)),
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

function shapeReviewDealRows(dealId, rows = []) {
  const sortedRows = [...(rows || [])].sort(compareCards);
  const rawDefinitions = sortedRows.filter((row) => row.kind === 'definition');
  const definitionsById = new Map(rawDefinitions.map((row) => [row.provision_instance_id, row]));
  const cards = sortedRows.map((row) => normalizeCard(row, definitionsById));
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

function isMissingProvisionCards(error) {
  const message = error && (error.message || String(error));
  return /provision_cards|schema cache|does not exist|Could not find/i.test(message || '');
}

async function fetchReviewDealCards(dealId, sb) {
  if (!dealId) throw new Error('dealId is required');
  if (!sb) throw new Error('Supabase client is required');
  const { data, error } = await sb
    .from('provision_cards')
    .select('*')
    .eq('deal_id', dealId);
  if (error) {
    if (isMissingProvisionCards(error)) {
      throw new Error('provision_cards table missing; run schema-03 and schema-04 card migrations');
    }
    throw new Error(`Failed to read provision_cards: ${error.message}`);
  }
  return shapeReviewDealRows(dealId, data || []);
}

module.exports = {
  compareCards,
  fetchReviewDealCards,
  groupRowsBySection,
  parseReferences,
  shapeReviewDealRows,
};
