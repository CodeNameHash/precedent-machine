import { getServiceSupabase } from '../../../lib/supabase';
import { computeCoverage, verifyDealQuotes } from '../../../lib/verification';

const { computeCanonicalRate } = require('../../../scripts/ingest-qa');
const { buildGapDetails, gapPreviewFromSource } = require('../../../lib/gap-review');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROVISION_PAGE_SIZE = 1000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const SUMMARY_MAX_GAPS = 1000;

function fail(res, status, error, detail) {
  return res.status(status).json({ error, ...(detail ? { detail } : {}) });
}

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

function tableUnavailable(error) {
  if (!error) return null;
  const message = error.message || '';
  if (error.code === '42P01' || message.includes('does not exist') || message.includes('Could not find the table')) {
    return { message, code: error.code || 'TABLE_UNAVAILABLE' };
  }
  return null;
}

function optionalRefUnavailable(table, error) {
  if (!error) return null;
  const unavailable = tableUnavailable(error);
  return { table, ...(unavailable || { message: error.message || String(error), code: error.code || 'QUERY_UNAVAILABLE' }) };
}

function parseLimit(value) {
  const n = Number(Array.isArray(value) ? value[0] : value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.floor(n));
}

function parseOffset(value) {
  const n = Number(Array.isArray(value) ? value[0] : value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function parseMinCoverage(value) {
  if (value == null || value === '') return null;
  const n = Number(Array.isArray(value) ? value[0] : value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

function metaOf(deal) {
  const meta = deal && deal.metadata;
  return meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {};
}

function sourceTextOf(deal) {
  const meta = metaOf(deal);
  return typeof meta.full_text === 'string' ? meta.full_text : '';
}

function round(value, places = 3) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

async function fetchAllProvisions(sb, dealId) {
  const out = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await sb
      .from('provisions')
      .select('id, deal_id, type, category, full_text, ai_metadata, created_at')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: true })
      .range(offset, offset + PROVISION_PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < PROVISION_PAGE_SIZE) break;
    offset += PROVISION_PAGE_SIZE;
  }

  return out;
}

async function mapWithConcurrency(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

async function fetchLatestIngestRefs(sb, dealIds) {
  const byDeal = new Map();
  const unavailable = [];
  if (!dealIds.length) return { byDeal, unavailable };

  const { data: candidates, error: candidateError } = await sb
    .from('deal_candidates')
    .select('id, ingested_deal_id, status, discovered_at')
    .in('ingested_deal_id', dealIds)
    .order('discovered_at', { ascending: false })
    .limit(Math.min(500, Math.max(25, dealIds.length * 8)));

  const candidateUnavailable = optionalRefUnavailable('deal_candidates', candidateError);
  if (candidateUnavailable) unavailable.push(candidateUnavailable);

  for (const candidate of candidates || []) {
    if (!candidate.ingested_deal_id) continue;
    if (!byDeal.has(candidate.ingested_deal_id)) byDeal.set(candidate.ingested_deal_id, {});
    const current = byDeal.get(candidate.ingested_deal_id);
    if (!current.candidate_id) {
      current.candidate_id = candidate.id;
      current.candidate_status = candidate.status || null;
    }
  }

  const { data: jobs, error: jobError } = await sb
    .from('ingest_jobs')
    .select('run_id, deal_id, candidate_id, status, updated_at, completed_at')
    .in('deal_id', dealIds)
    .order('updated_at', { ascending: false })
    .limit(Math.min(500, Math.max(25, dealIds.length * 20)));

  const jobUnavailable = optionalRefUnavailable('ingest_jobs', jobError);
  if (jobUnavailable) unavailable.push(jobUnavailable);

  for (const job of jobs || []) {
    if (!job.deal_id) continue;
    if (!byDeal.has(job.deal_id)) byDeal.set(job.deal_id, {});
    const current = byDeal.get(job.deal_id);
    if (!current.run_id) {
      current.run_id = job.run_id || null;
      current.run_status = job.status || null;
      current.candidate_id = current.candidate_id || job.candidate_id || null;
    }
  }

  return { byDeal, unavailable };
}

function summariseDeal(deal, provisions, latestIngest) {
  const sourceText = sourceTextOf(deal);
  const meta = metaOf(deal);
  const coverage = computeCoverage(provisions || [], sourceText, {
    maxGaps: SUMMARY_MAX_GAPS,
    minGapChars: 400,
  });
  const verification = sourceText
    ? verifyDealQuotes(provisions || [], sourceText)
    : { unverified: null };
  const canonicalRate = computeCanonicalRate(provisions || []);
  const largestGap = (coverage.gaps || [])[0] || null;

  return {
    deal_id: deal.id,
    acquirer: deal.acquirer || null,
    target: deal.target || null,
    coverage_pct: coverage.pct,
    canonical_rate: round(canonicalRate),
    unverified_quotes: verification.unverified,
    gap_count: (coverage.gaps || []).length,
    largest_gap_chars: largestGap ? largestGap.length : 0,
    largest_gap_preview: largestGap ? gapPreviewFromSource(sourceText, largestGap, 240) : null,
    metadata: {
      ingest_status: meta.ingest_status || meta.ingestStatus || null,
    },
    latest_ingest_run_id: latestIngest ? latestIngest.run_id || null : null,
    latest_ingest_candidate_id: latestIngest ? latestIngest.candidate_id || null : null,
    latest_ingest_run_status: latestIngest ? latestIngest.run_status || latestIngest.candidate_status || null : null,
    provision_count: (provisions || []).length,
    source_chars: sourceText.length,
    _coverage: coverage,
  };
}

function publicSummary(row) {
  const { _coverage, ...publicRow } = row;
  return publicRow;
}

async function getDetail(req, res, sb, dealId) {
  if (!isUuid(dealId)) return fail(res, 400, 'Invalid deal_id');

  const [{ data: deal, error: dealError }, provisionsResult, ingestRefsResult] = await Promise.all([
    sb.from('deals').select('id, acquirer, target, metadata').eq('id', dealId).single(),
    fetchAllProvisions(sb, dealId).then((data) => ({ data })).catch((error) => ({ error })),
    fetchLatestIngestRefs(sb, [dealId]).catch((error) => ({ error })),
  ]);

  if (dealError) return fail(res, dealError.code === 'PGRST116' ? 404 : 500, dealError.message);
  if (provisionsResult.error) return fail(res, 500, provisionsResult.error.message || String(provisionsResult.error));
  if (ingestRefsResult.error) return fail(res, 500, ingestRefsResult.error.message || String(ingestRefsResult.error));

  const latestIngest = ingestRefsResult.byDeal.get(dealId) || null;
  const summary = summariseDeal(deal, provisionsResult.data || [], latestIngest);
  const gaps = buildGapDetails({
    coverage: summary._coverage,
    sourceText: sourceTextOf(deal),
    provisions: provisionsResult.data || [],
  });

  return res.status(200).json({
    summary: publicSummary(summary),
    gaps,
    coverage: {
      sourceChars: summary._coverage.sourceChars,
      coveredChars: summary._coverage.coveredChars,
      pct: summary._coverage.pct,
      rawPct: summary._coverage.rawPct,
      located: summary._coverage.located,
      unlocated: summary._coverage.unlocated,
      excludedChars: summary._coverage.excludedChars,
      excludedRegions: summary._coverage.excludedRegions,
    },
    ...(ingestRefsResult.unavailable && ingestRefsResult.unavailable.length ? { ingest_refs_unavailable: ingestRefsResult.unavailable } : {}),
  });
}

async function getSummary(req, res, sb) {
  const limit = parseLimit(req.query.limit);
  const offset = parseOffset(req.query.offset);
  const minCoverage = parseMinCoverage(req.query.min_coverage);

  const { data: deals, error, count } = await sb
    .from('deals')
    .select('id, acquirer, target, metadata', { count: 'exact' })
    .order('target', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) return fail(res, 500, error.message);

  const dealIds = (deals || []).map((deal) => deal.id).filter(Boolean);
  let ingestRefsResult;
  try {
    ingestRefsResult = await fetchLatestIngestRefs(sb, dealIds);
  } catch (err) {
    return fail(res, 500, err.message);
  }

  let rows;
  try {
    rows = await mapWithConcurrency(deals || [], 4, async (deal) => {
      const provisions = await fetchAllProvisions(sb, deal.id);
      return summariseDeal(deal, provisions, ingestRefsResult.byDeal.get(deal.id) || null);
    });
  } catch (err) {
    return fail(res, 500, err.message);
  }

  rows = rows
    .filter((row) => minCoverage == null || row.coverage_pct <= minCoverage)
    .sort((a, b) => {
      if (a.coverage_pct !== b.coverage_pct) return a.coverage_pct - b.coverage_pct;
      if (a.largest_gap_chars !== b.largest_gap_chars) return b.largest_gap_chars - a.largest_gap_chars;
      return String(a.target || '').localeCompare(String(b.target || ''));
    })
    .map(publicSummary);

  return res.status(200).json({
    rows,
    pagination: {
      limit,
      offset,
      total: count || 0,
      scanned: (deals || []).length,
      returned: rows.length,
      min_coverage: minCoverage,
    },
    ...(ingestRefsResult.unavailable && ingestRefsResult.unavailable.length ? { ingest_refs_unavailable: ingestRefsResult.unavailable } : {}),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return fail(res, 405, 'GET only');
  }

  const sb = getServiceSupabase();
  if (!sb) return fail(res, 500, 'Supabase not configured');

  const dealId = Array.isArray(req.query.deal_id) ? req.query.deal_id[0] : req.query.deal_id;
  if (dealId) return getDetail(req, res, sb, dealId);
  return getSummary(req, res, sb);
}
