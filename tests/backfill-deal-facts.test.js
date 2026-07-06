const test = require('node:test');
const assert = require('node:assert/strict');

const {
  indexCandidates,
  mergeCandidateFacts,
  matchCandidateForDeal,
  parseArgs,
  proposedPatch,
} = require('../scripts/backfill-deal-facts');

test('parseArgs requires an explicit bounded deal scope', () => {
  assert.throws(
    () => parseArgs(['node', 'script']),
    /Usage: node scripts\/backfill-deal-facts\.js/,
  );
  assert.deepEqual(parseArgs(['node', 'script', '--all']), { all: true, deal: null, apply: false });
  assert.deepEqual(parseArgs(['node', 'script', '--deal', 'Metsera', '--apply']), { all: false, deal: 'Metsera', apply: true });
});

test('matchCandidateForDeal accepts exact URL matches only when unambiguous', () => {
  const candidates = [
    { id: 'c1', agreement_exhibit_url: 'https://sec.example/a.htm', agreement_text_hash: 'hash-a' },
    { id: 'c2', agreement_exhibit_url: 'https://sec.example/b.htm', agreement_text_hash: 'hash-b' },
  ];
  const indexes = indexCandidates(candidates);
  const deal = {
    id: 'd1',
    metadata: { source_url: 'https://sec.example/a.htm#doc' },
  };

  const match = matchCandidateForDeal(deal, indexes);
  assert.equal(match.candidate.id, 'c1');
  assert.match(match.matched_source, /source_url:https:\/\/sec\.example\/a\.htm/);
});

test('matchCandidateForDeal skips conflicting exact matches', () => {
  const candidates = [
    { id: 'c1', agreement_exhibit_url: 'https://sec.example/a.htm', agreement_text_hash: 'hash-a' },
    { id: 'c2', agreement_exhibit_url: 'https://sec.example/b.htm', agreement_text_hash: 'hash-b' },
  ];
  const indexes = indexCandidates(candidates);
  const deal = {
    id: 'd1',
    metadata: {
      source_url: 'https://sec.example/a.htm',
      agreement_text_hash: 'hash-b',
    },
  };

  const match = matchCandidateForDeal(deal, indexes);
  assert.equal(match.candidate, null);
  assert.match(match.skipped_reason, /conflicting candidate matches/);
});

test('proposedPatch fills missing row value and deal facts without replacing reviewed fields', () => {
  const deal = {
    id: 'd1',
    acquirer: 'Merger Sub LLC',
    target: 'Target Inc.',
    value_usd: null,
    metadata: {
      deal_facts: {
        parties: {
          acquirer_display: 'Reviewed Buyer',
          source_label: 'Manual review',
        },
      },
    },
  };
  const candidate = {
    id: 'c1',
    acquirer_name: 'Public Buyer Inc.',
    target_name: 'Target',
    deal_value_usd: 1250000000,
    agreement_exhibit_url: 'https://sec.example/a.htm',
  };

  const patch = proposedPatch(deal, candidate, 'source_url:https://sec.example/a.htm');
  assert.equal(patch.update.value_usd, 1250000000);
  assert.equal(patch.update.metadata.deal_facts.value_usd.value, 1250000000);
  assert.equal(patch.update.metadata.deal_facts.parties.acquirer_display, 'Reviewed Buyer');
  assert.equal(patch.update.metadata.deal_facts.parties.target_display, 'Target');
  assert.equal(patch.update.metadata.deal_facts.parties.source_label, 'Manual review');
});

test('proposedPatch uses stored deal metadata and priority verification when candidate fields are sparse', () => {
  const deal = {
    id: 'd1',
    acquirer: 'Buyer Merger Sub LLC',
    target: 'Target Inc.',
    value_usd: null,
    metadata: {
      source_url: 'https://sec.example/agreement.htm',
      parent_entity: 'Public Buyer Inc.',
      target_entity: 'Target Inc.',
      acquirer_display: 'Public Buyer',
      target_display: 'Target',
      seed_ingest: {
        priority_verification: {
          value_usd: 14000000000,
          source_label: 'Company press release',
          source_url: 'https://example.com/release',
        },
      },
    },
  };
  const candidate = {
    id: 'c1',
    acquirer_name: null,
    target_name: null,
    deal_value_usd: null,
    agreement_exhibit_url: 'https://sec.example/agreement.htm',
  };

  const patch = proposedPatch(deal, candidate, 'source_url:https://sec.example/agreement.htm');
  assert.equal(patch.update.value_usd, 14000000000);
  assert.equal(patch.update.metadata.deal_facts.value_usd.source_label, 'Company press release');
  assert.equal(patch.update.metadata.deal_facts.parties.acquirer_display, 'Public Buyer');
  assert.equal(patch.update.metadata.deal_facts.parties.target_display, 'Target');
  assert.equal(patch.update.metadata.deal_facts.parties.source_label, 'Stored deal metadata');
});

test('mergeCandidateFacts fills verified value data from seed manifest rows', () => {
  const merged = mergeCandidateFacts([
    {
      id: 'c1',
      deal_value_usd: null,
      agreement_exhibit_url: 'https://sec.example/agreement.htm',
    },
  ], [
    {
      id: 'c1',
      effective_value_usd: 14000000000,
      agreement_exhibit_url: 'https://sec.example/agreement.htm',
      priority_verification: {
        value_usd: 14000000000,
        source_label: 'Company press release',
      },
    },
  ]);

  assert.equal(merged[0].effective_value_usd, 14000000000);
  assert.equal(merged[0].priority_verification.source_label, 'Company press release');
});

test('proposedPatch skips when all live facts already exist', () => {
  const deal = {
    id: 'd1',
    acquirer: 'Buyer Inc.',
    target: 'Target Inc.',
    value_usd: 1250000000,
    metadata: {
      deal_facts: {
        value_usd: { value: 1250000000, source_label: 'Manual review' },
        parties: {
          parent_entity: 'Buyer Inc.',
          target_entity: 'Target Inc.',
          acquirer_display: 'Buyer',
          target_display: 'Target',
          source_label: 'Manual review',
        },
      },
    },
  };
  const candidate = {
    id: 'c1',
    acquirer_name: 'Public Buyer Inc.',
    target_name: 'Target',
    deal_value_usd: 1250000000,
    agreement_exhibit_url: 'https://sec.example/a.htm',
  };

  const patch = proposedPatch(deal, candidate, 'candidate_id:c1');
  assert.deepEqual(patch.update, {});
  assert.match(patch.skipped_reason, /no missing fields to update/);
});
