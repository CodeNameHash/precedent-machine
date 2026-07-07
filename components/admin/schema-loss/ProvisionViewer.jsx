export default function ProvisionViewer({ entry }) {
  if (!entry) return null;
  const excerpt = entry.evidence_quote || entry.source_excerpt || entry.cluster_signature || '';
  return (
    <section className="rounded border border-border bg-white p-4">
      <h3 className="mb-2 font-ui text-sm text-ink">Excerpt</h3>
      <p className="whitespace-pre-wrap text-sm leading-6 text-inkLight">{excerpt || 'No Excerpt available.'}</p>
      <dl className="mt-4 grid gap-2 text-xs text-inkFaint sm:grid-cols-2">
        <div>
          <dt className="font-ui uppercase">Deal</dt>
          <dd className="break-all text-inkLight">{entry.deal_id || 'n/a'}</dd>
        </div>
        <div>
          <dt className="font-ui uppercase">Provision</dt>
          <dd className="break-all text-inkLight">{entry.source_provision_id || 'n/a'}</dd>
        </div>
      </dl>
    </section>
  );
}
