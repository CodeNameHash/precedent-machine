/* lib/query/fixtures/demo-set-check.js
 *
 * Pure (no I/O) comparison logic between a live runQuery() result and the
 * `expected` block pinned in demo-set.json, per query kind. Shared by
 * scripts/query-demo-check.js (live) and tests/query/demo-set.test.js
 * (offline structural checks only — the live answer check is the script's
 * job, per WP-1 spec §2 deliverable 4).
 *
 * Deal-name matching always goes through the RAW `deal.acquirer`/`deal.target`
 * columns, not the computed display name in engine rows (lib/query/types.js
 * `dealName()` can diverge from the raw columns when deal_facts.parties
 * metadata disagrees with the ingested acquirer/target — matching raw avoids
 * that trap).
 */

function rawDealName(deal) {
  return `${(deal && deal.acquirer) || ''} / ${(deal && deal.target) || ''}`;
}

function dealNameMap(deals) {
  return new Map((deals || []).map((d) => [d.id, rawDealName(d)]));
}

function nonNullCells(row) {
  return (row.cells || []).some((c) => c.value !== null && c.value !== undefined && c.value !== '');
}

function checkFilterThenList(result, expected, deals) {
  const names = dealNameMap(deals);
  const details = [];
  let ok = true;
  if (typeof expected.total_matches === 'number' && result.total_matches !== expected.total_matches) {
    ok = false;
    details.push(`total_matches: expected ${expected.total_matches}, got ${result.total_matches}`);
  }
  const rowNames = (result.rows || []).map((r) => (names.get(r.deal_id) || r.deal_name || '').toLowerCase());
  for (const needle of expected.deal_names_contains || []) {
    if (!rowNames.some((n) => n.includes(String(needle).toLowerCase()))) {
      ok = false;
      details.push(`missing expected deal match: "${needle}"`);
    }
  }
  return { ok, details };
}

function checkMarketRange(result, expected) {
  const details = [];
  let ok = true;
  if (typeof expected.n === 'number' && result.n !== expected.n) {
    ok = false;
    details.push(`n: expected ${expected.n}, got ${result.n}`);
  }
  if (typeof expected.median === 'number') {
    const tol = expected.median_tolerance != null ? expected.median_tolerance : 0.5;
    const got = result.stats && result.stats.median;
    if (got == null || Math.abs(got - expected.median) > tol) {
      ok = false;
      details.push(`median: expected ~${expected.median} (±${tol}), got ${got}`);
    }
  }
  if (expected.top_value) {
    const dist = Array.isArray(result.distribution) ? result.distribution : [];
    const top = dist[0];
    if (!top || String(top.value) !== String(expected.top_value)) {
      ok = false;
      details.push(`top_value: expected "${expected.top_value}", got ${top ? `"${top.value}"` : 'none'}`);
    }
  }
  return { ok, details };
}

function checkProvisionCrossCut(result, expected) {
  const details = [];
  let ok = true;
  const nonNullRows = (result.rows || []).filter(nonNullCells).length;
  if (typeof expected.non_null_rows === 'number' && nonNullRows !== expected.non_null_rows) {
    ok = false;
    details.push(`non_null_rows: expected ${expected.non_null_rows}, got ${nonNullRows}`);
  }
  if (typeof expected.min_non_null_rows === 'number' && nonNullRows < expected.min_non_null_rows) {
    ok = false;
    details.push(`non_null_rows: expected >= ${expected.min_non_null_rows}, got ${nonNullRows}`);
  }
  return { ok, details };
}

function checkDealCompare(result, expected, deals) {
  const details = [];
  let ok = true;
  const names = dealNameMap(deals);
  if (typeof expected.row_count === 'number' && (result.rows || []).length !== expected.row_count) {
    ok = false;
    details.push(`row_count: expected ${expected.row_count}, got ${(result.rows || []).length}`);
  }
  const colNames = (result.columns || []).map((c) => (names.get(c.deal_id) || c.deal_name || '').toLowerCase());
  for (const needle of expected.deal_names_contains || []) {
    if (!colNames.some((n) => n.includes(String(needle).toLowerCase()))) {
      ok = false;
      details.push(`missing expected deal column: "${needle}"`);
    }
  }
  if (expected.cards_present) {
    const missing = (result.rows || []).some((row) => (row.cells || []).some((c) => !c.card_id));
    if (missing) {
      ok = false;
      details.push('one or more compare cells has no card_id');
    }
  }
  return { ok, details };
}

function checkDealToMarket(result, expected, deals) {
  const details = [];
  let ok = true;
  const names = dealNameMap(deals);
  const dealName = (names.get(result.deal_id) || result.deal_name || '').toLowerCase();
  if (expected.deal_name_contains && !dealName.includes(String(expected.deal_name_contains).toLowerCase())) {
    ok = false;
    details.push(`deal_name: expected to contain "${expected.deal_name_contains}", got "${dealName}"`);
  }
  if (typeof expected.min_scorecard === 'number' && (result.scorecard || []).length < expected.min_scorecard) {
    ok = false;
    details.push(`scorecard length: expected >= ${expected.min_scorecard}, got ${(result.scorecard || []).length}`);
  }
  return { ok, details };
}

function checkResult(kind, result, expected, deals) {
  if (kind === 'FILTER_THEN_LIST') return checkFilterThenList(result, expected || {}, deals);
  if (kind === 'MARKET_RANGE') return checkMarketRange(result, expected || {});
  if (kind === 'PROVISION_CROSS_CUT') return checkProvisionCrossCut(result, expected || {});
  if (kind === 'DEAL_COMPARE') return checkDealCompare(result, expected || {}, deals);
  if (kind === 'DEAL_TO_MARKET') return checkDealToMarket(result, expected || {}, deals);
  return { ok: false, details: [`unknown kind: ${kind}`] };
}

function computeExpected(kind, result, deals) {
  const names = dealNameMap(deals);
  if (kind === 'FILTER_THEN_LIST') {
    return {
      total_matches: result.total_matches,
      deal_names_contains: (result.rows || []).map((r) => names.get(r.deal_id) || r.deal_name).sort(),
    };
  }
  if (kind === 'MARKET_RANGE') {
    if (result.stats) {
      return { n: result.n, median: result.stats.median != null ? Math.round(result.stats.median * 100) / 100 : null };
    }
    const top = (result.distribution || [])[0];
    return { n: result.n, top_value: top ? top.value : null, top_count: top ? top.count : null };
  }
  if (kind === 'PROVISION_CROSS_CUT') {
    return { non_null_rows: (result.rows || []).filter(nonNullCells).length };
  }
  if (kind === 'DEAL_COMPARE') {
    return {
      row_count: (result.rows || []).length,
      deal_names_contains: (result.columns || []).map((c) => names.get(c.deal_id) || c.deal_name).sort(),
      cards_present: (result.rows || []).every((row) => (row.cells || []).every((c) => !!c.card_id)),
    };
  }
  if (kind === 'DEAL_TO_MARKET') {
    const dn = names.get(result.deal_id) || result.deal_name || '';
    return {
      deal_name_contains: dn.split(' / ')[1] || dn,
      min_scorecard: (result.scorecard || []).length,
    };
  }
  return {};
}

module.exports = { checkResult, computeExpected, rawDealName, dealNameMap };
