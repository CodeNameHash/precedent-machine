export default function CrossDealPreview({ entry }) {
  const count = entry?.count || entry?.occurrences?.length || 0;
  const deals = entry?.deal_count || 0;
  return (
    <div className="rounded border border-border bg-bg p-3 text-sm">
      This action will change {count} stored value{count === 1 ? '' : 's'}{deals ? ` across ${deals} deal${deals === 1 ? '' : 's'}` : ''}.
    </div>
  );
}
