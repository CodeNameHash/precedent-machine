// GAP-E residual-capture plumbing (P7): read-only detail pane for dimension
// C ("Feature residuals"). Deliberately has no action buttons -- the P7
// scope line is a read path, not a new write requirement. Routing a
// residual onto a code (or minting a new one) stays a Freeze Gate decision;
// this pane only shows what the model left uncoded and why.
export default function FeatureResidualPane({ entry }) {
  if (!entry) {
    return (
      <div className="rounded border border-border bg-white p-6 text-sm text-inkLight">
        Select a feature residual.
      </div>
    );
  }
  return (
    <section className="rounded border border-border bg-white p-4">
      <h2 className="font-display text-lg text-ink">{entry.attribute}</h2>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-inkFaint">
        <span>{entry.codebook_kind === 'enum' ? 'enum codebook' : `tag family: ${entry.family}`}</span>
        {entry.deal_id ? <span>deal {entry.deal_id}</span> : null}
        <span>not force-mapped</span>
      </div>
      <div className="mt-4 rounded border border-border bg-bg p-3">
        <div className="mb-2 font-ui text-xs uppercase text-inkFaint">Verbatim (byte-preserved)</div>
        <p className="whitespace-pre-wrap text-sm leading-6 text-ink">{entry.verbatim}</p>
      </div>
      {entry.evidence_quote ? (
        <div className="mt-3 rounded border border-border bg-bg p-3">
          <div className="mb-2 font-ui text-xs uppercase text-inkFaint">Evidence quote</div>
          <p className="whitespace-pre-wrap text-sm leading-6 text-ink">{entry.evidence_quote}</p>
        </div>
      ) : null}
      <p className="mt-4 text-xs text-inkLight">
        This attribute has an allowlisted codebook, but no code matched. The claim is captured for review, never
        coerced onto the nearest code. Recurring residuals are the signal the vocabulary is missing something --
        see § 8.5 of provision-taxonomy-triple-model.md.
      </p>
    </section>
  );
}
