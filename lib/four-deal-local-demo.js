'use strict';

const snapshot = require('./generated/home-deal-directory-v1.json');
const { validateDealDirectorySnapshot } = require('./home-snapshot');

const DEMO_DEAL_IDS = Object.freeze([
  '7dc3a05f-b170-4d59-a255-b7103cca16e1',
  'af4940e1-a645-437c-acfa-4a53e8d9f7ac',
  'dfaa71fa-9723-4794-825d-bd5024aa0b5d',
  '885edae5-49e8-464a-9f33-edd229119d7c',
]);

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function getFourDealLocalDemo() {
  const directory = validateDealDirectorySnapshot(snapshot);
  const byId = new Map(directory.deals.map((deal) => [deal.id, deal]));
  const deals = DEMO_DEAL_IDS.map((id) => byId.get(id));
  if (deals.some((deal) => !deal)) throw new Error('four-deal local demo source is incomplete');
  return freeze({
    schema_version: 'FOUR_DEAL_LOCAL_DEMO/V1',
    source_schema_version: directory._meta.schema_version,
    source_digest: directory._meta.source_digest,
    write_authority: 'NONE',
    deals,
  });
}

function reviewDealFromDirectory(deal) {
  if (!deal || !DEMO_DEAL_IDS.includes(deal.id)) throw new Error('deal is outside the four-deal local demo');
  return freeze({
    id: deal.id,
    acquirer: deal.buyer_display,
    target: deal.target_display,
    value_usd: deal.value,
    announce_date: deal.signing_date,
    sector: deal.sector,
    metadata: {
      acquirer_display: deal.buyer_display,
      target_display: deal.target_display,
      headline_consideration_type: deal.consideration_type,
      merger_form: deal.merger_form,
    },
  });
}

module.exports = {
  DEMO_DEAL_IDS,
  getFourDealLocalDemo,
  reviewDealFromDirectory,
};
