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
  hasTransactionFormationLanguage,
  hasPreExistingEntityLanguage,
  shouldPierceShell,
  buildNoticesExcerpt,
  extractLawFirms,
} = require('../lib/ingest/deal-metadata-prompt');

// Condensed real-shape Notices section, same fixture pattern as
// tests/notice-advisors.test.js's STANDARD fixture.
const NOTICES_FIXTURE = `
Section 9.2. Notices. All notices must be in writing, in each case to:
(i) if to Parent or Purchaser, to:

BuyerCo Inc.
1 Main Street
New York, NY 10001

Attention: General Counsel
with a copy (which shall not constitute notice) to:

Paul, Weiss, Rifkind, Wharton & Garrison LLP

1285 Avenue of the Americas

New York, New York 10019

Attention: Krishna Veeraraghavan; Benjamin Goodchild

(ii) if to the Company, to:

TargetCo Inc.
2 Side Street
Boston, MA 02110

Attention: Chief Executive Officer
with a copy (which shall not constitute notice) to:

Cooley LLP

55 Hudson Yards

New York, New York 10001

Attention: Kevin Cooper
`;

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

// ── shell-piercing rule (Ben, 2026-07-18): pierce ONLY deal-formed SPVs ─────

test('hasTransactionFormationLanguage matches the verbatim "formed solely" rep (verified against EWC/Superior agreements)', () => {
  const ewcRep = 'Each Buyer Party has been formed solely for the purpose of engaging in the Transactions, and, prior to the Effective Time, none of the Buyer Parties will have engaged in any other business activities.';
  const superiorRep = 'Merger Sub was formed solely for purposes of engaging in the transactions contemplated by this Agreement and has not conducted any business prior to the date of this Agreement.';
  assert.equal(hasTransactionFormationLanguage(ewcRep), true);
  assert.equal(hasTransactionFormationLanguage(superiorRep), true);
  assert.equal(hasTransactionFormationLanguage('An ordinary operating-company merger agreement with no formation rep.'), false);
});

test('hasPreExistingEntityLanguage recognizes a real/pre-existing operating company', () => {
  assert.equal(hasPreExistingEntityLanguage('Stanley Martin Homes, LLC is engaged in the business of homebuilding and has operated since 1966.'), true);
  assert.equal(hasPreExistingEntityLanguage('SH Residential Holdings, LLC, a Delaware limited liability company ("Parent")'), false);
});

test('shouldPierceShell: never pierces a name that is not shell-shaped', () => {
  assert.deepEqual(shouldPierceShell('Pfizer Inc.', 'anything'), { pierce: false, reason: 'not-shell-shaped' });
  assert.deepEqual(shouldPierceShell('Stanley Martin Homes, LLC', 'is engaged in the business of homebuilding'), { pierce: false, reason: 'not-shell-shaped' });
});

test('shouldPierceShell: never pierces when the text affirmatively describes a pre-existing entity, even if the name is shell-shaped', () => {
  // A hypothetical pre-existing holdco whose name happens to contain "Holdco".
  const result = shouldPierceShell('ABC Holdco, LLC', 'ABC Holdco, LLC is engaged in the business of manufacturing and has operated since 1998.');
  assert.equal(result.pierce, false);
  assert.equal(result.reason, 'pre-existing-entity-language');
});

test('shouldPierceShell: pierces with high confidence when the text states the entity was formed for the transaction (EWC/Superior case)', () => {
  const result = shouldPierceShell('Glow Midco, LLC', 'Each Buyer Party has been formed solely for the purpose of engaging in the Transactions.');
  assert.equal(result.pierce, true);
  assert.equal(result.reason, 'transaction-formed-language');
});

test('shouldPierceShell: falls back to the naming heuristic when neither signal is present (Envestnet/Endeavor case — sponsor SPV naming, unusual formation-rep wording)', () => {
  const result = shouldPierceShell('BCPE Pequod Buyer, Inc.', 'Notices shall be sent c/o Bain Capital Private Equity. No formation rep present in this excerpt.');
  assert.equal(result.pierce, true);
  assert.equal(result.reason, 'shell-name-heuristic (no formation/pre-existing language found in the checked text)');
});

test('shouldPierceShell: falls back to the naming heuristic when no text is available at all', () => {
  const result = shouldPierceShell('Hearts Parent, LLC', null);
  assert.equal(result.pierce, true);
  assert.equal(result.reason, 'shell-name-heuristic (no formation/pre-existing language found in the checked text)');
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

test('extractDealMetadata never pierces a shell-shaped name that the text confirms is a pre-existing entity, even if the LLM says buyer_is_shell', async () => {
  const baseResponse = JSON.stringify({
    acquirer: 'ABC Holdco, LLC',
    target: 'Target Inc.',
    buyer_is_shell: true, // model over-eager on the name pattern
    acquirer_display: null,
  });
  const client = makeClient([baseResponse]); // only ONE call — sponsor pass must be skipped
  const text = `${'x'.repeat(11000)} ABC Holdco, LLC is engaged in the business of manufacturing and has operated since 1998. The Guarantor hereby delivers this limited guarantee.`;
  const meta = await extractDealMetadata(client, text, {});
  assert.equal(meta.acquirer_display, null); // never overwritten with a sponsor name
  assert.equal(meta.shell_piercing_signal, 'pre-existing-entity-language');
  assert.equal(meta.buyer_profile, 'strategic'); // not financial despite guarantee language + buyer_is_shell
  assert.equal(client.calls.length, 1);
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

/* ── law firms (metadata.law_firms) ─────────────────────────────────────── */

test('buildNoticesExcerpt finds the Notices section and returns null when no "if to" header exists anywhere', () => {
  const excerpt = buildNoticesExcerpt(`${'x'.repeat(500)}${NOTICES_FIXTURE}${'y'.repeat(500)}`);
  assert.ok(excerpt);
  assert.match(excerpt, /if to Parent or Purchaser/);
  assert.equal(buildNoticesExcerpt('no notices section here at all'), null);
  assert.equal(buildNoticesExcerpt(''), null);
});

test('buildNoticesExcerpt skips an unrelated "notices" mention that has no nearby "if to" header', () => {
  const decoy = 'This Section requires prompt notices of any material adverse change.' + 'z'.repeat(4000);
  const text = decoy + NOTICES_FIXTURE;
  const excerpt = buildNoticesExcerpt(text);
  assert.ok(excerpt);
  assert.match(excerpt, /if to Parent or Purchaser/, 'must land on the real Notices section, not the decoy mention');
});

test('extractLawFirms pulls acquirer/target firm names out of the Notices excerpt via the shared deterministic parser', () => {
  const meta = { acquirer: 'BuyerCo Inc.', target: 'TargetCo Inc.' };
  const firms = extractLawFirms(NOTICES_FIXTURE, meta);
  assert.deepEqual(firms.acquirer, ['Paul, Weiss, Rifkind, Wharton & Garrison LLP']);
  assert.deepEqual(firms.target, ['Cooley LLP']);
});

test('extractLawFirms returns empty arrays (never throws) when the agreement has no locatable Notices section', () => {
  const firms = extractLawFirms('an agreement with no notices section', { acquirer: 'A', target: 'B' });
  assert.deepEqual(firms, { target: [], acquirer: [] });
});

test('extractDealMetadata persists metadata.law_firms = { target, acquirer } deterministically alongside the base pass', async () => {
  const baseResponse = JSON.stringify({
    acquirer: 'BuyerCo Inc.',
    target: 'TargetCo Inc.',
    buyer_is_shell: false,
    acquirer_display: 'BuyerCo',
  });
  const client = makeClient([baseResponse]); // no LLM call for law-firm extraction — deterministic only
  const text = `${NOTICES_FIXTURE}${'x'.repeat(11000)}`;
  const meta = await extractDealMetadata(client, text, {});
  assert.deepEqual(meta.law_firms.acquirer, ['Paul, Weiss, Rifkind, Wharton & Garrison LLP']);
  assert.deepEqual(meta.law_firms.target, ['Cooley LLP']);
  assert.equal(client.calls.length, 1, 'law-firm extraction must not consume an extra LLM call');
});

test('extractDealMetadata still sets metadata.law_firms = { target: [], acquirer: [] } when no Notices section is found', async () => {
  const baseResponse = JSON.stringify({ acquirer: 'A Inc.', target: 'B Inc.', buyer_is_shell: false });
  const client = makeClient([baseResponse]);
  const meta = await extractDealMetadata(client, 'x'.repeat(11000), {});
  assert.deepEqual(meta.law_firms, { target: [], acquirer: [] });
});
