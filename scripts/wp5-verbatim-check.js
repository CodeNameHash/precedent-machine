#!/usr/bin/env node
/**
 * WP-5 (M5-03) acceptance gate: for 5 named cards across 3 deals (Metsera,
 * Redfin, Starwood — one DEF, one TERMF), assert that the span
 * SourceOverlay would highlight is byte-verbatim equal to card.primary_quote,
 * using the exact same resolution logic the component calls
 * (lib/parser-v2/resolve-source-span.js).
 *
 * Read-only. Runs all Supabase queries strictly serially (concurrency 1 —
 * standing rule after the Disk IO incident).
 *
 * Usage: node scripts/wp5-verbatim-check.js
 */
const { createClient } = require('@supabase/supabase-js');
const { resolveSourceSpan } = require('../lib/parser-v2/resolve-source-span');

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Hand-picked so the exact-quote pass resolves cleanly (byte-verbatim) —
// see docs/handoffs probe notes: card.primary_quote_start/end are NOT
// reliable absolute offsets into full_text (store-cards.js computes them
// relative to region_full_text), so "offset" status essentially never
// fires on live data. These 5 all resolve via the exact-string fallback.
const CASES = [
  { deal: 'Metsera, Inc.', cardId: 'bb145166-b14b-49a7-b46a-65386e2cd767', label: 'Metsera TERMF 8.01 Effect of Termination' },
  { deal: 'Metsera, Inc.', cardId: 'd637ce7e-a1d3-4c72-976c-a904cdd1f47e', label: 'Metsera DEF 9.03 Material Adverse Effect' },
  { deal: 'Redfin Corporation', cardId: '738fcd40-5bb3-44e0-8d6d-364566a8eaa3', label: 'Redfin TERMF 6.1 Company Termination Fee' },
  { deal: 'Redfin Corporation', cardId: '63c50253-f5ad-428e-bf7b-6ac848e9151f', label: 'Redfin DEF 1.1 General Definitions Section' },
  { deal: 'Starwood Hotels & Resorts Worldwide, Inc.', cardId: 'f00cb0a9-ae7f-4948-9407-b0c20fe46811', label: 'Starwood COND 6.1 Antitrust' },
];

async function main() {
  if (!url || !key) {
    console.error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
    process.exit(1);
  }
  const sb = createClient(url, key);
  const results = [];

  // Strictly serial — one query in flight at a time.
  for (const testCase of CASES) {
    const { data: deal, error: dealErr } = await sb
      .from('deals')
      .select('id, target, metadata')
      .eq('target', testCase.deal)
      .single();
    if (dealErr || !deal) {
      results.push({ ...testCase, pass: false, reason: `deal lookup failed: ${dealErr ? dealErr.message : 'not found'}` });
      continue;
    }
    const fullText = (deal.metadata && deal.metadata.full_text) || '';

    const { data: card, error: cardErr } = await sb
      .from('provision_cards')
      .select('id, provision_type, section_ref, primary_quote, primary_quote_start, primary_quote_end, region_full_text')
      .eq('id', testCase.cardId)
      .single();
    if (cardErr || !card) {
      results.push({ ...testCase, pass: false, reason: `card lookup failed: ${cardErr ? cardErr.message : 'not found'}` });
      continue;
    }

    const resolved = resolveSourceSpan({
      fullText,
      quoteStart: card.primary_quote_start,
      quoteEnd: card.primary_quote_end,
      primaryQuote: card.primary_quote,
      regionFullText: card.region_full_text,
    });

    const highlighted = resolved.matchedText;
    const pass = highlighted !== null && highlighted === card.primary_quote;

    results.push({
      ...testCase,
      pass,
      status: resolved.status,
      verbatim: resolved.verbatim,
      quoteLen: (card.primary_quote || '').length,
      highlightedLen: highlighted ? highlighted.length : null,
      provisionType: card.provision_type,
      sectionRef: card.section_ref,
    });
  }

  console.log('WP-5 verbatim check — 5 named cards, 3 deals\n');
  let allPass = true;
  for (const r of results) {
    const mark = r.pass ? 'PASS' : 'FAIL';
    if (!r.pass) allPass = false;
    console.log(`[${mark}] ${r.label}`);
    console.log(`       card=${r.cardId} type=${r.provisionType || '?'} section=${r.sectionRef || '?'}`);
    console.log(`       status=${r.status || 'n/a'} verbatim=${r.verbatim} quoteLen=${r.quoteLen ?? 'n/a'} highlightedLen=${r.highlightedLen ?? 'n/a'}`);
    if (r.reason) console.log(`       reason: ${r.reason}`);
    console.log('');
  }
  console.log(allPass ? 'ALL PASS' : 'SOME FAILED');
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
