const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isShellName,
  buildSponsorExcerpt,
  detectGuaranteeLanguage,
  classifyBuyerProfile,
  derivePerShareValue,
  buildValueProvenance,
  deriveValue,
  parseDealMetadataResponse,
  parseSponsorResponse,
  extractDealMetadata,
} = require('../lib/ingest/deal-metadata-prompt');

test('isShellName flags transaction-vehicle naming, not operating companies', () => {
  assert.equal(isShellName('BCPE Pequod Buyer, Inc.'), true); // spec's own Envestnet example — "Buyer" in the name is exactly the shell signal
  assert.equal(isShellName('Hearts Parent, LLC'), true);
  assert.equal(isShellName('Wildcat EGH Holdco, L.P.'), true);
  assert.equal(isShellName('Glow Midco, LLC'), true);
  assert.equal(isShellName('SUP Parent Holdings, LLC'), true);
  assert.equal(isShellName('Merger Sub Inc.'), true);
  assert.equal(isShellName('Bain Capital'), false);
  assert.equal(isShellName('Pfizer Inc.'), false);
});

test('parseDealMetadataResponse normalizes buyer_is_shell and the new per-share fields', () => {
  const meta = parseDealMetadataResponse(JSON.stringify({
    acquirer: 'Hearts Parent, LLC',
    target: 'HireRight Holdings Corporation',
    buyer_is_shell: true,
    per_share_value_usd: 14.35,
    fully_diluted_shares: 115000000,
  }));
  assert.equal(meta.buyer_is_shell, true);
  assert.equal(meta.per_share_value_usd, 14.35);
  assert.equal(meta.fully_diluted_shares, 115000000);
  // missing fields default safely
  const bare = parseDealMetadataResponse(JSON.stringify({ acquirer: 'A', target: 'B' }));
  assert.equal(bare.buyer_is_shell, false);
  assert.equal(bare.per_share_value_usd, null);
});

test('buildSponsorExcerpt finds guarantor/equity-investor recitals and returns null when absent', () => {
  const text = 'x'.repeat(1000) + 'The Guarantor hereby unconditionally guarantees the obligations of Parent.' + 'y'.repeat(1000);
  const excerpt = buildSponsorExcerpt(text);
  assert.ok(excerpt);
  assert.ok(excerpt.includes('Guarantor'));
  assert.equal(buildSponsorExcerpt('no relevant recitals here'), null);
  assert.equal(buildSponsorExcerpt(''), null);
});

test('buildSponsorExcerpt merges overlapping keyword windows and respects the cap', () => {
  const text = `Equity Investors shall mean Bain Capital Fund XIII. ${'z'.repeat(50)} Guarantor: Bain Capital Private Equity, L.P.`;
  const excerpt = buildSponsorExcerpt(text, { radius: 40, cap: 8000 });
  assert.ok(excerpt.includes('Bain Capital Fund XIII'));
  assert.ok(excerpt.includes('Guarantor'));
});

test('detectGuaranteeLanguage / classifyBuyerProfile: financial only when shell + fund recitals', () => {
  const guaranteeText = 'Parent has delivered a limited guarantee in favor of the Company.';
  assert.equal(detectGuaranteeLanguage(guaranteeText), true);
  assert.equal(detectGuaranteeLanguage('An ordinary operating-company merger agreement.'), false);

  assert.equal(classifyBuyerProfile({ buyerIsShell: true, hasGuaranteeLanguage: true }), 'financial');
  assert.equal(classifyBuyerProfile({ buyerIsShell: true, hasGuaranteeLanguage: false }), 'strategic');
  assert.equal(classifyBuyerProfile({ buyerIsShell: false, hasGuaranteeLanguage: true }), 'strategic');
  assert.equal(classifyBuyerProfile({ buyerIsShell: false, hasGuaranteeLanguage: false }), 'strategic');
});

test('derivePerShareValue multiplies only when both inputs are positive finite numbers', () => {
  assert.equal(derivePerShareValue({ perShareValueUsd: 14.35, fullyDilutedShares: 115_000_000 }), Math.round(14.35 * 115_000_000));
  assert.equal(derivePerShareValue({ perShareValueUsd: null, fullyDilutedShares: 100 }), null);
  assert.equal(derivePerShareValue({ perShareValueUsd: 10, fullyDilutedShares: null }), null);
  assert.equal(derivePerShareValue({ perShareValueUsd: -5, fullyDilutedShares: 100 }), null);
  assert.equal(derivePerShareValue({ perShareValueUsd: 0, fullyDilutedShares: 100 }), null);
});

test('buildValueProvenance shapes kind/set_at/set_by/source_url/note', () => {
  const p = buildValueProvenance('derived_per_share', { set_by: 'ingest_metadata', source_url: 'https://x', note: 'n' });
  assert.equal(p.kind, 'derived_per_share');
  assert.equal(p.set_by, 'ingest_metadata');
  assert.equal(p.source_url, 'https://x');
  assert.equal(p.note, 'n');
  assert.ok(p.set_at);
});

test('deriveValue ladder: stated value wins, then per-share derivation, then press release, then no_stated_value', async () => {
  const stated = await deriveValue({ value_usd: 5_000_000_000 });
  assert.equal(stated.value_usd, 5_000_000_000);
  assert.equal(stated.value_provenance.kind, 'stated_in_agreement');

  const derived = await deriveValue({ value_usd: null, per_share_value_usd: 10, fully_diluted_shares: 1_000_000 });
  assert.equal(derived.value_usd, 10_000_000);
  assert.equal(derived.value_provenance.kind, 'derived_per_share');

  const pressRelease = await deriveValue(
    { value_usd: null, per_share_value_usd: null, fully_diluted_shares: null },
    { fetchPressRelease: async () => ({ value_usd: 2_000_000_000, source_url: 'https://ex99', quote: 'approximately $2.0 billion' }) },
  );
  assert.equal(pressRelease.value_usd, 2_000_000_000);
  assert.equal(pressRelease.value_provenance.kind, 'press_release');
  assert.equal(pressRelease.value_provenance.quote, 'approximately $2.0 billion');

  const none = await deriveValue({ value_usd: null, per_share_value_usd: null, fully_diluted_shares: null });
  assert.equal(none.value_usd, null);
  assert.equal(none.value_provenance.kind, 'no_stated_value');

  // A press-release hook that throws must not blow up the ingest — falls through to no_stated_value.
  const failed = await deriveValue(
    { value_usd: null, per_share_value_usd: null, fully_diluted_shares: null },
    { fetchPressRelease: async () => { throw new Error('fetch failed'); } },
  );
  assert.equal(failed.value_usd, null);
  assert.equal(failed.value_provenance.kind, 'no_stated_value');
});

test('parseSponsorResponse tolerates a code-fenced response and null sponsor', () => {
  assert.deepEqual(parseSponsorResponse('```json\n{"sponsor_name": "Bain Capital"}\n```'), { sponsor_name: 'Bain Capital' });
  assert.deepEqual(parseSponsorResponse('{"sponsor_name": null}'), { sponsor_name: null });
});

// ── extractDealMetadata orchestration (mocked client) ──────────────────────

function makeClient(responses) {
  const calls = [];
  return {
    calls,
    messages: {
      create: async (req) => {
        const resp = responses[calls.length];
        calls.push(req);
        return { content: [{ text: typeof resp === 'function' ? resp(req) : resp }] };
      },
    },
  };
}

test('extractDealMetadata runs the sponsor second pass only when the base pass is a shell with no display name', async () => {
  const baseResponse = JSON.stringify({
    acquirer: 'Hearts Parent, LLC',
    target: 'HireRight Holdings Corporation',
    buyer_is_shell: true,
    acquirer_display: null,
  });
  const sponsorResponse = JSON.stringify({ sponsor_name: 'General Atlantic' });
  const client = makeClient([baseResponse, sponsorResponse]);
  const text = `${'x'.repeat(11000)} The Guarantor, General Atlantic Partners 100, L.P., hereby delivers this limited guarantee.`;

  const meta = await extractDealMetadata(client, text, {});
  assert.equal(meta.acquirer_display, 'General Atlantic');
  assert.equal(meta.ultimateParent, 'General Atlantic');
  assert.equal(meta.buyer_profile, 'financial'); // shell + guarantee language
  assert.equal(meta.sponsor_second_pass, true);
});

test('extractDealMetadata skips the sponsor pass when the base pass already resolved a non-shell display', async () => {
  const baseResponse = JSON.stringify({
    acquirer: 'Beach Acquisition Co Parent, LLC',
    target: 'Skechers U.S.A., Inc.',
    buyer_is_shell: true,
    acquirer_display: '3G Capital',
  });
  const client = makeClient([baseResponse]); // only ONE call expected — no sponsor pass
  const meta = await extractDealMetadata(client, 'x'.repeat(11000), {});
  assert.equal(meta.acquirer_display, '3G Capital');
  assert.equal(client.calls.length, 1); // only the base pass — no sponsor second pass
});

test('extractDealMetadata leaves strategic deals alone and marks buyer_profile strategic', async () => {
  const baseResponse = JSON.stringify({
    acquirer: 'Pfizer Inc.',
    target: 'Metsera, Inc.',
    buyer_is_shell: false,
    acquirer_display: 'Pfizer',
  });
  const client = makeClient([baseResponse]);
  const meta = await extractDealMetadata(client, 'ordinary operating-company merger agreement text', {});
  assert.equal(meta.buyer_profile, 'strategic');
  assert.equal(meta.sponsor_second_pass, undefined);
});

test('extractDealMetadata derives value_usd via the ladder when no stated value exists', async () => {
  const baseResponse = JSON.stringify({
    acquirer: 'Parent Inc.',
    target: 'Target Inc.',
    buyer_is_shell: false,
    value_usd: null,
    per_share_value_usd: 15,
    fully_diluted_shares: 10_000_000,
  });
  const client = makeClient([baseResponse]);
  const meta = await extractDealMetadata(client, 'x'.repeat(11000), {});
  assert.equal(meta.value_usd, 150_000_000);
  assert.equal(meta.value_provenance.kind, 'derived_per_share');
});
