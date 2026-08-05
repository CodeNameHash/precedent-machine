'use strict';
const PRODUCTION_REF = 'tzulhdasmioeechxapdy';
const GOVERNING_FIXTURE_DECISION = Object.freeze({
  ruling_id: 'db-apply',
  choice_id: 'fixture-go',
  source_path: 'lib/programme-decision-console.js',
});

function exactKeys(value, keys) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
}

function assertAuthorityBinding(args, operation) {
  if (!operation) return;
  if (!exactKeys(operation, ['apply', 'dealId'])
    || args.apply !== operation.apply || args.dealId !== operation.dealId) {
    const error = new Error('Production apply authority is not bound to the requested operation.');
    error.code = 'V1_APPLY_AUTHORITY_BINDING_REQUIRED';
    throw error;
  }
}

function hasExactProductionHost(env) {
  const value = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === `${PRODUCTION_REF}.supabase.co`;
  } catch {
    return false;
  }
}

function hasGoverningFixtureDecision(authorityEvidence) {
  return exactKeys(authorityEvidence, Object.keys(GOVERNING_FIXTURE_DECISION))
    && Object.entries(GOVERNING_FIXTURE_DECISION).every(([key, value]) => authorityEvidence[key] === value);
}

function assertProductionAuthority({ args = {}, env = {}, backupFileContents, authorityEvidence, operation } = {}) {
  assertAuthorityBinding(args, operation);
  if (args.apply !== true) return true;
  const missing = [];
  const dealId = args.dealId;
  if (!args.backup) missing.push('backup path');
  if (!backupFileContents || !Array.isArray(backupFileContents.dealIds) || !backupFileContents.dealIds.includes(dealId) || !Array.isArray(backupFileContents.provisions) || !Array.isArray(backupFileContents.provision_cards) || !Array.isArray(backupFileContents.claims) || typeof backupFileContents.dumpedAt !== 'string') missing.push('valid deal-scoped backup');
  if (args.confirmProduction !== dealId) missing.push('exact --confirm-production deal ID');
  if (!env.SUPABASE_SERVICE_ROLE_KEY) missing.push('service-role credentials');
  if (!hasExactProductionHost(env)) missing.push('verified production host');
  if (!hasGoverningFixtureDecision(authorityEvidence)) missing.push('structured governing fixture-first decision provenance');
  if (missing.length) { const error = new Error(`Production apply authority missing: ${missing.join('; ')}`); error.code = 'V1_APPLY_AUTHORITY_REQUIRED'; error.missing = missing; throw error; }
  return true;
}
module.exports = { GOVERNING_FIXTURE_DECISION, PRODUCTION_REF, assertProductionAuthority };
