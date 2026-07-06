const crypto = require('node:crypto');
const { computeCoverage, verifyDealQuotes } = require('./verification');
const { computeCanonicalRate } = require('../scripts/ingest-qa');
const { buildParserReview } = require('./parser-v2/structural');
const {
  buildUncodedSummary,
  classifyGapRegionWithContext,
  gapPreviewFromSource,
  gapTextFromSource,
  isReviewableGapRegion,
  normalizeForGapDisplay,
} = require('./gap-review');

const QUALITY_METRICS_TABLE = 'deal_quality_metrics';
const QUALITY_METRICS_VERSION = 1;
const PROVISION_PAGE_SIZE = 1000;
const SUMMARY_MAX_GAPS = 1000;

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

function numberOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function intOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function hashText(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function provisionFingerprint(provisions) {
  const h = crypto.createHash('sha256');
  const rows = [...(provisions || [])].sort((a, b) => String(a && a.id || '').localeCompare(String(b && b.id || '')));
  for (const p of rows) {
    h.update(String(p && p.id || ''));
    h.update('\0');
    h.update(String(p && (p.updated_at || p.created_at) || ''));
    h.update('\0');
    h.update(String(p && p.text_hash || hashText(p && p.full_text)));
    h.update('\0');
    h.update(String(p && p.type || ''));
    h.update('\0');
    h.update(String(p && p.category || ''));
    h.update('\0');
    h.update(stableJson((p && p.ai_metadata) || {}));
    h.update('\0\n');
  }
  return h.digest('hex');
}

function reviewableCoverageStats(coverage, reviewableGaps) {
  const sourceChars = Number(coverage && coverage.sourceChars) || 0;
  const excludedChars = Number(coverage && coverage.excludedChars) || 0;
  const effectiveChars = Math.max(1, sourceChars - excludedChars);
  const reviewableGapChars = (reviewableGaps || []).reduce((sum, item) => {
    return sum + Math.max(0, Number(item && item.gap && item.gap.length) || 0);
  }, 0);
  const coveredChars = Math.max(0, effectiveChars - reviewableGapChars);
  return {
    pct: Math.round((coveredChars / effectiveChars) * 1000) / 10,
    gapChars: reviewableGapChars,
    effectiveChars,
  };
}

async function fetchAllProvisions(sb, dealId) {
  const out = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await sb
      .from('provisions')
      .select('id, deal_id, type, category, full_text, ai_metadata, created_at, updated_at')
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

function summariseDealQuality(deal, provisions, latestIngest) {
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
  const displaySource = normalizeForGapDisplay(sourceText);
  const typedGaps = (coverage.gaps || []).map((gap) => {
    const start = Math.max(0, Number(gap && gap.start) || 0);
    const length = Math.max(0, Number(gap && gap.length) || 0);
    const fullText = gapTextFromSource(sourceText, gap);
    const regionType = classifyGapRegionWithContext(displaySource, start, start + length, fullText);
    return { gap, regionType, reviewable: isReviewableGapRegion(regionType) };
  });
  const reviewableGaps = typedGaps.filter((item) => item.reviewable);
  const reviewableCoverage = reviewableCoverageStats(coverage, reviewableGaps);
  const largestGap = (reviewableGaps[0] && reviewableGaps[0].gap) || null;
  const needsCodeSummary = buildUncodedSummary(provisions || []);
  const parserReview = sourceText ? buildParserReview(sourceText) : null;
  const parserSummary = parserReview ? parserReview.summary : {};

  return {
    deal_id: deal.id,
    acquirer: deal.acquirer || null,
    target: deal.target || null,
    coverage_pct: reviewableCoverage.pct,
    reviewable_coverage_pct: reviewableCoverage.pct,
    raw_coverage_pct: coverage.rawPct,
    reviewable_gap_chars: reviewableCoverage.gapChars,
    reviewable_effective_chars: reviewableCoverage.effectiveChars,
    canonical_rate: round(canonicalRate),
    unverified_quotes: verification.unverified,
    gap_count: reviewableGaps.length,
    ignored_gap_count: typedGaps.length - reviewableGaps.length,
    parser_structural_gap_count: parserSummary.structural_gap_count ?? null,
    definition_warning_count: parserSummary.definition_warning_count ?? null,
    data_model_flag_count: parserSummary.data_model_flag_count ?? null,
    needs_code_count: needsCodeSummary.count,
    needs_code_proposed_count: needsCodeSummary.proposed_count,
    needs_code_type_counts: needsCodeSummary.by_type,
    uncoded_count: needsCodeSummary.count,
    uncoded_proposed_count: needsCodeSummary.proposed_count,
    uncoded_type_counts: needsCodeSummary.by_type,
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
    source_text_hash: sourceText ? hashText(sourceText) : null,
    provisions_fingerprint: provisionFingerprint(provisions || []),
    quality_metrics_version: QUALITY_METRICS_VERSION,
    quality_metrics_source: 'computed',
    _coverage: coverage,
  };
}

function publicSummary(row) {
  const { _coverage, source_text_hash, provisions_fingerprint, ...publicRow } = row;
  return publicRow;
}

function qualityMetricsRowFromSummary(summary, now = new Date()) {
  return {
    deal_id: summary.deal_id,
    metrics_version: QUALITY_METRICS_VERSION,
    provision_count: intOrZero(summary.provision_count),
    source_chars: intOrZero(summary.source_chars),
    source_text_hash: summary.source_text_hash || null,
    provisions_fingerprint: summary.provisions_fingerprint || null,
    coverage_pct: numberOrNull(summary.coverage_pct),
    reviewable_coverage_pct: numberOrNull(summary.reviewable_coverage_pct),
    raw_coverage_pct: numberOrNull(summary.raw_coverage_pct),
    reviewable_gap_chars: intOrZero(summary.reviewable_gap_chars),
    reviewable_effective_chars: intOrZero(summary.reviewable_effective_chars),
    canonical_rate: numberOrNull(summary.canonical_rate),
    unverified_quotes: numberOrNull(summary.unverified_quotes),
    gap_count: intOrZero(summary.gap_count),
    ignored_gap_count: intOrZero(summary.ignored_gap_count),
    parser_structural_gap_count: numberOrNull(summary.parser_structural_gap_count),
    definition_warning_count: numberOrNull(summary.definition_warning_count),
    data_model_flag_count: numberOrNull(summary.data_model_flag_count),
    needs_code_count: intOrZero(summary.needs_code_count),
    needs_code_proposed_count: intOrZero(summary.needs_code_proposed_count),
    needs_code_type_counts: objectValue(summary.needs_code_type_counts),
    uncoded_count: intOrZero(summary.uncoded_count),
    uncoded_proposed_count: intOrZero(summary.uncoded_proposed_count),
    uncoded_type_counts: objectValue(summary.uncoded_type_counts),
    largest_gap_chars: intOrZero(summary.largest_gap_chars),
    largest_gap_preview: summary.largest_gap_preview || null,
    metadata: objectValue(summary.metadata),
    computed_at: now.toISOString(),
  };
}

function summaryFromStoredQualityMetrics(deal, row, latestIngest) {
  const metadata = objectValue(row && row.metadata);
  return {
    deal_id: deal.id,
    acquirer: deal.acquirer || null,
    target: deal.target || null,
    coverage_pct: numberOrNull(row.coverage_pct),
    reviewable_coverage_pct: numberOrNull(row.reviewable_coverage_pct),
    raw_coverage_pct: numberOrNull(row.raw_coverage_pct),
    reviewable_gap_chars: intOrZero(row.reviewable_gap_chars),
    reviewable_effective_chars: intOrZero(row.reviewable_effective_chars),
    canonical_rate: numberOrNull(row.canonical_rate),
    unverified_quotes: numberOrNull(row.unverified_quotes),
    gap_count: intOrZero(row.gap_count),
    ignored_gap_count: intOrZero(row.ignored_gap_count),
    parser_structural_gap_count: numberOrNull(row.parser_structural_gap_count),
    definition_warning_count: numberOrNull(row.definition_warning_count),
    data_model_flag_count: numberOrNull(row.data_model_flag_count),
    needs_code_count: intOrZero(row.needs_code_count),
    needs_code_proposed_count: intOrZero(row.needs_code_proposed_count),
    needs_code_type_counts: objectValue(row.needs_code_type_counts),
    uncoded_count: intOrZero(row.uncoded_count),
    uncoded_proposed_count: intOrZero(row.uncoded_proposed_count),
    uncoded_type_counts: objectValue(row.uncoded_type_counts),
    largest_gap_chars: intOrZero(row.largest_gap_chars),
    largest_gap_preview: row.largest_gap_preview || null,
    metadata,
    latest_ingest_run_id: latestIngest ? latestIngest.run_id || null : null,
    latest_ingest_candidate_id: latestIngest ? latestIngest.candidate_id || null : null,
    latest_ingest_run_status: latestIngest ? latestIngest.run_status || latestIngest.candidate_status || null : null,
    provision_count: intOrZero(row.provision_count),
    source_chars: intOrZero(row.source_chars),
    quality_metrics_version: Number(row.metrics_version) || null,
    quality_metrics_computed_at: row.computed_at || null,
    quality_metrics_source: 'stored',
  };
}

async function upsertDealQualityMetrics(sb, summary) {
  const payload = qualityMetricsRowFromSummary(summary);
  const { data, error } = await sb
    .from(QUALITY_METRICS_TABLE)
    .upsert(payload, { onConflict: 'deal_id' })
    .select()
    .single();

  return { data, error, payload };
}

async function computeAndUpsertDealQualityMetrics(sb, deal, latestIngest) {
  const provisions = await fetchAllProvisions(sb, deal.id);
  const summary = summariseDealQuality(deal, provisions, latestIngest);
  const upsert = await upsertDealQualityMetrics(sb, summary);
  return { summary, upsert };
}

module.exports = {
  QUALITY_METRICS_TABLE,
  QUALITY_METRICS_VERSION,
  PROVISION_PAGE_SIZE,
  SUMMARY_MAX_GAPS,
  fetchAllProvisions,
  hashText,
  metaOf,
  numberOrNull,
  provisionFingerprint,
  publicSummary,
  qualityMetricsRowFromSummary,
  reviewableCoverageStats,
  sourceTextOf,
  summaryFromStoredQualityMetrics,
  summariseDealQuality,
  upsertDealQualityMetrics,
  computeAndUpsertDealQualityMetrics,
};
