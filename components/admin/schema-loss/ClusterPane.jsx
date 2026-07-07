import ResidualHighlighter from './ResidualHighlighter';

export default function ClusterPane({ entry }) {
  if (!entry) return <div className="rounded border border-border bg-white p-6 text-sm text-inkLight">Select an uncovered-text cluster.</div>;
  return (
    <section className="rounded border border-border bg-white p-4">
      <h2 className="font-display text-lg text-ink">{entry.cluster_signature}</h2>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-inkFaint">
        <span>{entry.occurrence_count || 0} occurrences</span>
        <span>{entry.distinct_deals || 0} Deals</span>
        <span>{entry.suggested_routing || 'unrouted'}</span>
      </div>
      <div className="mt-4">
        <ResidualHighlighter samples={entry.sample_provisions || []} />
      </div>
    </section>
  );
}
