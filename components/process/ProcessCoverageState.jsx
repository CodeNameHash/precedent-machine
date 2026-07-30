export default function ProcessCoverageState({ coverage, counts, emptyResult }) {
  if (emptyResult?.user_message) return <p role="status" className="rounded border border-border bg-bg px-4 py-3 text-sm text-ink">{emptyResult.user_message}</p>;
  if (!coverage) return null;
  const complete = coverage.coverage_certification_state === 'CERTIFIED_COMPLETE';
  return <p role="status" className={`text-xs ${complete ? 'text-inkLight' : 'text-amber-800'}`}>{complete ? 'Coverage is complete for the checked covered set.' : 'Coverage is incomplete for the checked covered set.'} {coverage.covered_deal_count} covered deal{coverage.covered_deal_count === 1 ? '' : 's'}. {counts?.failed_result_count ? `${counts.failed_result_count} result slot unavailable.` : ''}</p>;
}
