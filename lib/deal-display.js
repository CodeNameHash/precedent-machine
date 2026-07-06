export function getUltimateParentName(deal) {
  const meta = deal && deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
  const parties = meta.deal_facts && meta.deal_facts.parties && typeof meta.deal_facts.parties === 'object'
    ? meta.deal_facts.parties
    : {};
  return (
    parties.parent_entity ||
    meta.ultimateParent ||
    meta.ultimate_parent ||
    meta.parent_entity ||
    meta.acquirerUltimateParent ||
    meta.acquirer_ultimate_parent ||
    deal?.ultimateParent ||
    deal?.ultimate_parent ||
    deal?.parent_entity ||
    null
  );
}

export function getDisplayAcquirer(deal) {
  const meta = deal && deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
  const parties = meta.deal_facts && meta.deal_facts.parties && typeof meta.deal_facts.parties === 'object'
    ? meta.deal_facts.parties
    : {};
  return (
    getUltimateParentName(deal) ||
    parties.acquirer_display ||
    parties.acquirer ||
    meta.acquirer_display ||
    deal?.acquirer ||
    null
  );
}

export function getDisplayTarget(deal) {
  const meta = deal && deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
  const parties = meta.deal_facts && meta.deal_facts.parties && typeof meta.deal_facts.parties === 'object'
    ? meta.deal_facts.parties
    : {};
  return parties.target_display || parties.target_entity || meta.target_display || meta.target_entity || deal?.target || null;
}
