#!/usr/bin/env node
/**
 * WP-5 (M5-03) acceptance gate: sweep all deals' first 10 cards (ordered by
 * created_at, matching the review page's default fetch order) and count how
 * many spans SourceOverlay's resolve-source-span.js could NOT resolve
 * (status === 'unresolved'). Per the M4-M5 reconciled plan, >0 is a data
 * finding to report — not an auto-fail; Fable adjudicates.
 *
 * Read-only. Runs all Supabase queries strictly serially (concurrency 1 —
 * standing rule after the Disk IO incident): one deal fetched, its cards
 * fetched, resolved, then the next deal.
 *
 * Usage: node scripts/wp5-unresolved-sweep.js
 */
const { createClient } = require('@supabase/supabase-js');
const { resolveSourceSpan } = require('../lib/parser-v2/resolve-source-span');

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!url || !key) {
    console.error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
    process.exit(1);
  }
  const sb = createClient(url, key);

  const { data: deals, error: dealsErr } = await sb
    .from('deals')
    .select('id, target, metadata')
    .order('created_at', { ascending: true });
  if (dealsErr) throw dealsErr;

  let totalCards = 0;
  let unresolvedCount = 0;
  let noFullTextDeals = 0;
  const byStatus = { offset: 0, 'exact-quote': 0, 'exact-region': 0, unresolved: 0 };
  const unresolvedDetail = [];
  const perDeal = [];

  for (const deal of deals) {
    const fullText = (deal.metadata && deal.metadata.full_text) || '';
    if (!fullText) {
      noFullTextDeals += 1;
      perDeal.push({ deal: deal.target, id: deal.id, skipped: 'no full_text' });
      continue;
    }

    // First 10 cards for this deal, ordered by creation (stable, matches
    // what a user would see first).
    const { data: cards, error: cardsErr } = await sb
      .from('provision_cards')
      .select('id, provision_type, section_ref, primary_quote, primary_quote_start, primary_quote_end, region_full_text')
      .eq('deal_id', deal.id)
      .order('extracted_at', { ascending: true })
      .limit(10);
    if (cardsErr) {
      console.error(`Card fetch failed for ${deal.target} (${deal.id}): ${cardsErr.message}`);
      perDeal.push({ deal: deal.target, id: deal.id, error: cardsErr.message });
      continue;
    }

    let dealUnresolved = 0;
    for (const card of cards || []) {
      totalCards += 1;
      const resolved = resolveSourceSpan({
        fullText,
        quoteStart: card.primary_quote_start,
        quoteEnd: card.primary_quote_end,
        primaryQuote: card.primary_quote,
        regionFullText: card.region_full_text,
      });
      byStatus[resolved.status] = (byStatus[resolved.status] || 0) + 1;
      if (resolved.status === 'unresolved') {
        unresolvedCount += 1;
        dealUnresolved += 1;
        // Mirrors what SourceOverlay itself does on an unresolved card
        // (spec item 3: "log unresolved cards to console").
        console.log(`UNRESOLVED  deal="${deal.target}" card=${card.id} type=${card.provision_type} section="${card.section_ref}"`);
        unresolvedDetail.push({
          deal: deal.target,
          dealId: deal.id,
          cardId: card.id,
          provisionType: card.provision_type,
          sectionRef: card.section_ref,
        });
      }
    }
    perDeal.push({ deal: deal.target, id: deal.id, cards: (cards || []).length, unresolved: dealUnresolved });
  }

  console.log('\n=== WP-5 unresolved-span sweep ===');
  console.log(`Deals scanned: ${deals.length} (${noFullTextDeals} had no full_text, skipped)`);
  console.log(`Cards checked (first 10 per deal): ${totalCards}`);
  console.log(`Resolution breakdown: ${JSON.stringify(byStatus)}`);
  console.log(`Unresolved: ${unresolvedCount} of ${totalCards} (${totalCards ? ((unresolvedCount / totalCards) * 100).toFixed(1) : 0}%)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
