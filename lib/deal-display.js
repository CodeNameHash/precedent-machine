export function getUltimateParentName(deal) {
  const meta = deal && deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
  return (
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
  return (
    getUltimateParentName(deal) ||
    meta.acquirer_display ||
    deal?.acquirer ||
    null
  );
}

export function getDisplayTarget(deal) {
  const meta = deal && deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
  return meta.target_display || meta.target_entity || deal?.target || null;
}
