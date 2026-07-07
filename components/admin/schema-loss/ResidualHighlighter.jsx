export default function ResidualHighlighter({ samples = [] }) {
  if (!samples.length) return <p className="text-sm text-inkLight">No sample Provisions available.</p>;
  return (
    <div className="space-y-3">
      {samples.map((sample, index) => (
        <div key={`${sample.provision_id || index}`} className="rounded border border-border bg-bg p-3">
          <div className="mb-2 font-ui text-xs uppercase text-inkFaint">{sample.section_anchor || sample.provision_id || 'Provision'}</div>
          <p className="text-sm leading-6 text-ink">{sample.text_excerpt}</p>
        </div>
      ))}
    </div>
  );
}
