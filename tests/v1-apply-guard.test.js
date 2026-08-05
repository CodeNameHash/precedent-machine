'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { assertProductionAuthority, GOVERNING_FIXTURE_DECISION, PRODUCTION_REF } = require('../scripts/reprocess/v1-apply-guard');
const id = '7dc3a05f-b170-4d59-a255-b7103cca16e1';
const good = () => ({ args: { apply: true, backup: 'reports/b.json', dealId: id, confirmProduction: id }, env: { SUPABASE_SERVICE_ROLE_KEY: 'x', SUPABASE_URL: `https://${PRODUCTION_REF}.supabase.co` }, backupFileContents: { dealIds: [id], provisions: [], provision_cards: [], claims: [], dumpedAt: '2026-08-04T00:00:00.000Z' }, authorityEvidence: GOVERNING_FIXTURE_DECISION });
test('production guard aggregates missing backup credentials production identity and authority', () => { assert.throws(() => assertProductionAuthority({ args: { apply: true, dealId: id } }), /backup path; valid deal-scoped backup; exact --confirm-production deal ID; service-role credentials; verified production host; structured governing fixture-first decision provenance/); assert.doesNotThrow(() => assertProductionAuthority(good())); assert.doesNotThrow(() => assertProductionAuthority({ args: { apply: false } })); });
test('production guard binds authority to the exact apply operation and rejects spoofable evidence', () => {
  assert.throws(() => assertProductionAuthority({ ...good(), operation: { apply: true, dealId: '00000000-0000-0000-0000-000000000000' } }), { code: 'V1_APPLY_AUTHORITY_BINDING_REQUIRED' });
  assert.throws(() => assertProductionAuthority({ ...good(), env: { SUPABASE_SERVICE_ROLE_KEY: 'x', SUPABASE_URL: `https://${PRODUCTION_REF}.supabase.co.evil.example` } }), /verified production host/);
  assert.throws(() => assertProductionAuthority({ ...good(), authorityEvidence: { ...GOVERNING_FIXTURE_DECISION, note: 'fixture-go' } }), /structured governing fixture-first decision provenance/);
});
