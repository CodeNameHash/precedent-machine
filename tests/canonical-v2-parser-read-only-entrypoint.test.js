const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { canonicalJson, contentId, utf8Slice } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const { buildSourceBackedProvisionProposalBatch } = require('../lib/canonical-v2/parser-proposal-adapter');
const { buildReadOnlyNoShopProposalBatch } = require('../lib/parser-v2/canonical-proposals');
const {
  buildFixtureSourceAdmission,
  buildImmutableSource,
} = require('../lib/canonical-v2/source-structure');

const LANDOS_SOURCE = fs.readFileSync('__fixtures__/demo-deal/landos-abbvie-agreement.txt', 'utf8');

function admittedFixture(sourceText, key) {
  const contract = compileFixtureContract();
  const dealKey = `deal:${key}`;
  const dealAdmissionId = contentId('DEAL_ADMISSION/V1', key);
  const source = buildImmutableSource({
    sourceBytes: sourceText,
    sourceOccurrenceKey: `${key}-source`,
  });
  const sourceAdmission = buildFixtureSourceAdmission({
    source,
    dealKey,
    dealAdmissionId,
    contractFingerprint: contract.fingerprint,
  });
  return { contract, dealKey, dealAdmissionId, source, sourceAdmission };
}

function buildFromCandidates(fixture, legacyProposals) {
  return buildSourceBackedProvisionProposalBatch({
    contract_bundle: fixture.contract,
    source: fixture.source,
    source_admission: fixture.sourceAdmission,
    governed_deal_key: fixture.dealKey,
    deal_admission_id: fixture.dealAdmissionId,
    legacy_proposals: legacyProposals,
  });
}

function buildReadOnly(fixture) {
  return buildReadOnlyNoShopProposalBatch({
    contract_bundle: fixture.contract,
    source: fixture.source,
    source_admission: fixture.sourceAdmission,
    governed_deal_key: fixture.dealKey,
    deal_admission_id: fixture.dealAdmissionId,
  });
}

function backToLegacyProposal(proposal) {
  return {
    proposal_kind: proposal.proposal_kind,
    detector_key: proposal.detector_key,
    legacy_provision_type_hint: proposal.legacy_provision_type_hint,
    legacy_confidence: proposal.legacy_confidence,
    section_number: proposal.section_number,
    section_title: proposal.section_title,
    article_number: proposal.article_number,
    article_title: proposal.article_title,
    clean_start: proposal.evidence_anchor.parser_clean_start,
    clean_end: proposal.evidence_anchor.parser_clean_end,
    parser_clean_text_digest: proposal.evidence_anchor.parser_clean_text_digest,
  };
}

function allKeys(value, found = new Set()) {
  if (!value || typeof value !== 'object') return found;
  if (Array.isArray(value)) {
    value.forEach((item) => allKeys(item, found));
    return found;
  }
  Object.entries(value).forEach(([key, child]) => {
    found.add(key);
    allKeys(child, found);
  });
  return found;
}

test('the real Landos no-shop parser path emits one exact admitted source proposal', () => {
  const fixture = admittedFixture(LANDOS_SOURCE, 'landos-parser-read-only');
  const batch = buildReadOnly(fixture);

  assert.deepEqual(batch.diagnostics, {
    legacy_proposal_count: 1,
    source_backed_proposal_count: 1,
    quarantined_proposal_count: 0,
    publication_blocked: false,
  });
  const proposal = batch.proposals[0];
  assert.deepEqual([
    proposal.section_number,
    proposal.section_title,
    proposal.legacy_provision_type_hint,
    proposal.legacy_confidence,
  ], ['5.3', 'No Solicitation; Change in Recommendation', 'NOSOL', 'high']);
  const anchor = proposal.evidence_anchor;
  assert.equal(
    utf8Slice(fixture.source.canonical_text.text, anchor.absolute_start, anchor.absolute_end),
    anchor.exact_text,
  );
  assert.match(anchor.exact_text, /^Section 5\.3 No Solicitation; Change in Recommendation\./);
  assert.match(anchor.parser_clean_text_digest, /^[a-f0-9]{64}$/);

  const keys = allKeys(batch);
  for (const forbidden of [
    'concept_key',
    'canonical_concept_key',
    'state',
    'canonical_value',
    'market_comparability',
    'party',
  ]) assert.equal(keys.has(forbidden), false);
});

test('source-backed output is deterministic regardless of legacy proposal insertion order', () => {
  const sourceText = `AGREEMENT AND PLAN OF MERGER

ARTICLE V
COVENANTS

Section 5.01 No Solicitation.
The Company shall not solicit any Acquisition Proposal.

Section 5.02 Mutual Non-Solicitation.
Neither party shall solicit an Acquisition Proposal.

  IN WITNESS WHEREOF, the parties have executed this Agreement.`;
  const fixture = admittedFixture(sourceText, 'ordered-no-shop-proposals');
  const proposals = buildReadOnly(fixture).proposals.map(backToLegacyProposal);
  assert.equal(proposals.length, 2);

  const forward = buildFromCandidates(fixture, proposals);
  const reverse = buildFromCandidates(fixture, [...proposals].reverse());

  assert.equal(canonicalJson(forward), canonicalJson(reverse));
  assert.deepEqual(forward.proposals.map((proposal) => proposal.section_number), ['5.01', '5.02']);
});

test('an unresolvable exact-evidence candidate is quarantined without suppressing a valid sibling', () => {
  const sourceText = `AGREEMENT AND PLAN OF MERGER

ARTICLE V
COVENANTS

Section 5.01 No Solicitation.
The Company shall not solicit any Acquisition Proposal.

Section 5.02 No Shop.
The Company shall not encourage an Acquisition Proposal.

  IN WITNESS WHEREOF, the parties have executed this Agreement.`;
  const fixture = admittedFixture(sourceText, 'quarantined-no-shop-proposal');
  const proposals = buildReadOnly(fixture).proposals.map(backToLegacyProposal);
  assert.equal(proposals.length, 2);
  const unresolved = {
    ...proposals[0],
    clean_end: fixture.source.canonical_text.text.length + 1,
  };

  const batch = buildFromCandidates(fixture, [proposals[1], unresolved]);

  assert.equal(batch.proposals.length, 1);
  assert.equal(batch.proposals[0].section_number, '5.02');
  assert.equal(batch.quarantined_proposals.length, 1);
  assert.equal(batch.quarantined_proposals[0].reason_code, 'EXACT_EVIDENCE_UNRESOLVED');
  assert.equal(batch.diagnostics.publication_blocked, true);
  assert.equal(Object.hasOwn(batch.quarantined_proposals[0], 'evidence_anchor'), false);
});

test('the parser entrypoint and adapter have no model or storage authority', () => {
  const source = [
    fs.readFileSync('lib/parser-v2/canonical-proposals.js', 'utf8'),
    fs.readFileSync('lib/canonical-v2/parser-proposal-adapter.js', 'utf8'),
  ].join('\n');
  assert.doesNotMatch(source, /store-cards|store-claims|parser-v2\/store|supabase|anthropic|claude|fetch\s*\(/i);
  assert.doesNotMatch(source, /\.from\s*\(|\.insert\s*\(|\.update\s*\(|\.delete\s*\(/);
});
