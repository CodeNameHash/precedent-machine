import { getServiceSupabase } from '../../../lib/supabase';
const { sendBroadCorpusRouteContained } = require('../../../lib/broad-corpus-containment');

const { buildParserReview } = require('../../../lib/parser-v2/structural');
const {
  buildBoundaryAudit,
  buildGapDetails,
  buildUncodedDetails,
  formatGapId,
} = require('../../../lib/gap-review');
const {
  buildCodingTaskRow,
  findNeedsCodeItem,
  validateCodingTaskInput,
} = require('../../../lib/coding-tasks');
const {
  QUALITY_METRICS_TABLE,
  QUALITY_METRICS_VERSION,
  fetchAllProvisions,
  publicSummary,
  sourceTextOf,
  summaryFromStoredQualityMetrics,
  summariseDealQuality,
  upsertDealQualityMetrics,
} = require('../../../lib/deal-quality-metrics');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const QUALITY_METRICS_SELECT = [
  'deal_id',
  'metrics_version',
  'provision_count',
  'source_chars',
  'coverage_pct',
  'reviewable_coverage_pct',
  'raw_coverage_pct',
  'reviewable_gap_chars',
  'reviewable_effective_chars',
  'canonical_rate',
  'unverified_quotes',
  'gap_count',
  'ignored_gap_count',
  'parser_structural_gap_count',
  'definition_warning_count',
  'data_model_flag_count',
  'needs_code_count',
  'needs_code_proposed_count',
  'needs_code_type_counts',
  'uncoded_count',
  'uncoded_proposed_count',
  'uncoded_type_counts',
  'largest_gap_chars',
  'largest_gap_preview',
  'metadata',
  'computed_at',
].join(', ');

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

function parseBooleanFlag(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw == null || raw === '') return false;
  return ['1', 'true', 'yes', 'y', 'refresh'].includes(String(raw).toLowerCase());
}

function shouldRefreshMetrics(req) {
  return parseBooleanFlag(req.query.refresh_metrics) || parseBooleanFlag(req.query.refresh);
}

function qualityMetricsUnavailable(error) {
  const unavailable = tableUnavailable(error);
  return unavailable ? { table: QUALITY_METRICS_TABLE, ...unavailable } : null;
}

async function maybeUpsertQualityMetrics(sb, summary) {
  const upsert = await upsertDealQualityMetrics(sb, summary);
  const unavailable = qualityMetricsUnavailable(upsert.error);
  if (unavailable) return { unavailable };
  if (upsert.error) throw new Error(upsert.error.message || String(upsert.error));
  return {
    stored: true,
    computed_at: upsert.data ? upsert.data.computed_at || null : upsert.payload.computed_at,
  };
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

async function fetchStoredQualityMetrics(sb, dealIds) {
  const byDeal = new Map();
  if (!dealIds.length) return { byDeal, unavailable: null };

  const { data, error } = await sb
    .from(QUALITY_METRICS_TABLE)
    .select(QUALITY_METRICS_SELECT)
    .in('deal_id', dealIds);

  const unavailable = qualityMetricsUnavailable(error);
  if (unavailable) return { byDeal, unavailable };
  if (error) throw new Error(error.message || String(error));

  for (const row of data || []) {
    if (row && row.deal_id) byDeal.set(row.deal_id, row);
  }
  return { byDeal, unavailable: null };
}

async function fetchDealsForMetricCompute(sb, dealIds) {
  const byDeal = new Map();
  if (!dealIds.length) return byDeal;

  const { data, error } = await sb
    .from('deals')
    .select('id, acquirer, target, metadata')
    .in('id', dealIds);

  if (error) throw new Error(error.message || String(error));
  for (const deal of data || []) {
    if (deal && deal.id) byDeal.set(deal.id, deal);
  }
  return byDeal;
}

function storedMetricIsCurrent(row) {
  return row && Number(row.metrics_version) === QUALITY_METRICS_VERSION;
}

function coverageSortValue(row) {
  const n = Number(row && row.coverage_pct);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

function largestGapSortValue(row) {
  const n = Number(row && row.largest_gap_chars);
  return Number.isFinite(n) ? n : 0;
}

function pendingQualitySummary(deal, latestIngest, reason = 'metrics_pending') {
  return {
    deal_id: deal.id,
    acquirer: deal.acquirer || null,
    target: deal.target || null,
    coverage_pct: null,
    reviewable_coverage_pct: null,
    raw_coverage_pct: null,
    reviewable_gap_chars: null,
    reviewable_effective_chars: null,
    canonical_rate: null,
    unverified_quotes: null,
    gap_count: null,
    ignored_gap_count: null,
    parser_structural_gap_count: null,
    definition_warning_count: null,
    data_model_flag_count: null,
    needs_code_count: null,
    needs_code_proposed_count: null,
    needs_code_type_counts: {},
    uncoded_count: null,
    uncoded_proposed_count: null,
    uncoded_type_counts: {},
    largest_gap_chars: null,
    largest_gap_preview: null,
    metadata: {},
    latest_ingest_run_id: latestIngest ? latestIngest.run_id || null : null,
    latest_ingest_candidate_id: latestIngest ? latestIngest.candidate_id || null : null,
    latest_ingest_run_status: latestIngest ? latestIngest.run_status || latestIngest.candidate_status || null : null,
    provision_count: null,
    source_chars: null,
    quality_metrics_version: null,
    quality_metrics_computed_at: null,
    quality_metrics_source: reason,
  };
}

async function getDetail(req, res, sb, dealId) {
  if (!isUuid(dealId)) return fail(res, 400, 'Invalid deal_id');
  const refreshMetrics = shouldRefreshMetrics(req);

  const [{ data: deal, error: dealError }, provisionsResult, ingestRefsResult] = await Promise.all([
    sb.from('deals').select('id, acquirer, target, metadata').eq('id', dealId).single(),
    fetchAllProvisions(sb, dealId).then((data) => ({ data })).catch((error) => ({ error })),
    fetchLatestIngestRefs(sb, [dealId]).catch((error) => ({ error })),
  ]);

  if (dealError) return fail(res, dealError.code === 'PGRST116' ? 404 : 500, dealError.message);
  if (provisionsResult.error) return fail(res, 500, provisionsResult.error.message || String(provisionsResult.error));
  if (ingestRefsResult.error) return fail(res, 500, ingestRefsResult.error.message || String(ingestRefsResult.error));

  const latestIngest = ingestRefsResult.byDeal.get(dealId) || null;
  const summary = summariseDealQuality(deal, provisionsResult.data || [], latestIngest);
  let qualityMetrics = null;
  if (refreshMetrics) {
    try {
      qualityMetrics = await maybeUpsertQualityMetrics(sb, summary);
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }
  const gaps = buildGapDetails({
    coverage: summary._coverage,
    sourceText: sourceTextOf(deal),
    provisions: provisionsResult.data || [],
  });
  const reviewableGaps = gaps
    .filter((gap) => gap.reviewable_gap)
    .map((gap, index) => ({ ...gap, id: formatGapId(index + 1) }));
  const ignoredGaps = gaps.filter((gap) => !gap.reviewable_gap);
  const needsCode = buildUncodedDetails(provisionsResult.data || []);
  const parserReview = buildParserReview(sourceTextOf(deal));
  const boundaryAudit = buildBoundaryAudit({
    coverage: summary._coverage,
    sourceText: sourceTextOf(deal),
    provisions: provisionsResult.data || [],
  });

  return res.status(200).json({
    summary: publicSummary(summary),
    gaps: reviewableGaps,
    ignored_gaps: ignoredGaps,
    boundary_audit: boundaryAudit,
    needs_code: needsCode,
    uncoded: needsCode,
    parser_review: parserReview,
    definition_warnings: parserReview.definition_warnings,
    data_model_flags: parserReview.data_model_flags,
    structural_gaps: parserReview.structural_gaps,
    coverage: {
      sourceChars: summary._coverage.sourceChars,
      coveredChars: summary._coverage.coveredChars,
      pct: summary._coverage.pct,
      reviewablePct: summary.reviewable_coverage_pct,
      reviewableGapChars: summary.reviewable_gap_chars,
      reviewableEffectiveChars: summary.reviewable_effective_chars,
      rawPct: summary._coverage.rawPct,
      located: summary._coverage.located,
      unlocated: summary._coverage.unlocated,
      excludedChars: summary._coverage.excludedChars,
      excludedRegions: summary._coverage.excludedRegions,
      rawGapCount: gaps.length,
      reviewableGapCount: reviewableGaps.length,
      ignoredGapCount: ignoredGaps.length,
      parserStructuralGapCount: parserReview.summary.structural_gap_count,
      definitionWarningCount: parserReview.summary.definition_warning_count,
      dataModelFlagCount: parserReview.summary.data_model_flag_count,
    },
    ...(qualityMetrics ? { quality_metrics: qualityMetrics } : {}),
    ...(ingestRefsResult.unavailable && ingestRefsResult.unavailable.length ? { ingest_refs_unavailable: ingestRefsResult.unavailable } : {}),
  });
}

async function createCodingTask(req, res, sb) {
  const parsed = validateCodingTaskInput(req.body || {});
  if (!parsed.ok) return fail(res, 400, 'Invalid coding task request', parsed.errors);

  const input = parsed.value;
  const [{ data: deal, error: dealError }, provisionsResult] = await Promise.all([
    sb.from('deals').select('id, acquirer, target, metadata').eq('id', input.dealId).single(),
    fetchAllProvisions(sb, input.dealId).then((data) => ({ data })).catch((error) => ({ error })),
  ]);

  if (dealError) return fail(res, dealError.code === 'PGRST116' ? 404 : 500, dealError.message);
  if (provisionsResult.error) return fail(res, 500, provisionsResult.error.message || String(provisionsResult.error));

  const needsCode = buildUncodedDetails(provisionsResult.data || []);
  const item = findNeedsCodeItem(needsCode, {
    needsCodeId: input.needsCodeId,
    provisionId: input.provisionId,
  });
  if (!item) return fail(res, 404, 'Needs Code item not found for deal');

  const row = buildCodingTaskRow({
    deal,
    item,
    suggestedAction: input.suggestedAction,
    note: input.note,
    suggestedCode: input.suggestedCode,
  });

  const { data, error } = await sb
    .from('coding_tasks')
    .insert(row)
    .select()
    .single();

  const unavailable = tableUnavailable(error);
  if (unavailable) {
    return fail(res, 500, 'coding_tasks table unavailable; apply supabase/coding-tasks-schema.sql', unavailable);
  }
  if (error) return fail(res, 500, error.message);

  return res.status(201).json({ task: data, payload: data.payload });
}

async function getSummary(req, res, sb) {
  const limit = parseLimit(req.query.limit);
  const offset = parseOffset(req.query.offset);
  const minCoverage = parseMinCoverage(req.query.min_coverage);
  const refreshMetrics = shouldRefreshMetrics(req);

  const { data: deals, error, count } = await sb
    .from('deals')
    .select('id, acquirer, target', { count: 'exact' })
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

  let storedMetricsResult = { byDeal: new Map(), unavailable: null };
  if (!refreshMetrics) {
    try {
      storedMetricsResult = await fetchStoredQualityMetrics(sb, dealIds);
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }

  const rowsByDeal = new Map();
  const computeDealIds = [];
  let storedCount = 0;
  let staleCount = 0;

  for (const deal of deals || []) {
    const stored = storedMetricsResult.byDeal.get(deal.id);
    if (!refreshMetrics && storedMetricIsCurrent(stored)) {
      rowsByDeal.set(deal.id, summaryFromStoredQualityMetrics(deal, stored, ingestRefsResult.byDeal.get(deal.id) || null));
      storedCount += 1;
      continue;
    }
    if (stored && !storedMetricIsCurrent(stored)) staleCount += 1;
    if (refreshMetrics) {
      computeDealIds.push(deal.id);
    } else {
      rowsByDeal.set(
        deal.id,
        pendingQualitySummary(
          deal,
          ingestRefsResult.byDeal.get(deal.id) || null,
          stored ? 'metrics_stale' : 'metrics_pending',
        ),
      );
    }
  }

  let fullDealsById = new Map();
  if (computeDealIds.length > 0) {
    try {
      fullDealsById = await fetchDealsForMetricCompute(sb, computeDealIds);
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }

  let recomputedCount = 0;
  let storedWriteCount = 0;
  let qualityMetricsUnavailableInfo = storedMetricsResult.unavailable;
  try {
    await mapWithConcurrency(computeDealIds, 4, async (dealId) => {
      const deal = fullDealsById.get(dealId);
      if (!deal) throw new Error(`Deal not found while computing metrics: ${dealId}`);
      const provisions = await fetchAllProvisions(sb, deal.id);
      const summary = summariseDealQuality(deal, provisions, ingestRefsResult.byDeal.get(deal.id) || null);
      recomputedCount += 1;

      if (!qualityMetricsUnavailableInfo) {
        const write = await maybeUpsertQualityMetrics(sb, summary);
        if (write.unavailable) {
          qualityMetricsUnavailableInfo = write.unavailable;
        } else {
          storedWriteCount += 1;
        }
      }

      rowsByDeal.set(deal.id, summary);
    });
  } catch (err) {
    return fail(res, 500, err.message);
  }

  const rows = (deals || [])
    .map((deal) => rowsByDeal.get(deal.id))
    .filter(Boolean)
    .filter((row) => {
      if (minCoverage == null) return true;
      const coverage = Number(row.coverage_pct);
      return Number.isFinite(coverage) && coverage <= minCoverage;
    })
    .sort((a, b) => {
      const aCoverage = coverageSortValue(a);
      const bCoverage = coverageSortValue(b);
      if (aCoverage !== bCoverage) return aCoverage - bCoverage;
      if (a.largest_gap_chars !== b.largest_gap_chars) return largestGapSortValue(b) - largestGapSortValue(a);
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
    quality_metrics: {
      table: QUALITY_METRICS_TABLE,
      mode: refreshMetrics ? 'refresh' : 'stored_only',
      stored: storedCount,
      recomputed: recomputedCount,
      written: storedWriteCount,
      stale: staleCount,
      schema_available: !qualityMetricsUnavailableInfo,
    },
    ...(qualityMetricsUnavailableInfo ? { quality_metrics_unavailable: qualityMetricsUnavailableInfo } : {}),
    ...(ingestRefsResult.unavailable && ingestRefsResult.unavailable.length ? { ingest_refs_unavailable: ingestRefsResult.unavailable } : {}),
  });
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return fail(res, 405, 'GET or POST only');
  }

  if (req.method === 'POST' || shouldRefreshMetrics(req)) {
    return sendBroadCorpusRouteContained(res);
  }

  const sb = getServiceSupabase();
  if (!sb) return fail(res, 500, 'Supabase not configured');

  const dealId = Array.isArray(req.query.deal_id) ? req.query.deal_id[0] : req.query.deal_id;
  if (dealId) return getDetail(req, res, sb, dealId);
  return getSummary(req, res, sb);
}
