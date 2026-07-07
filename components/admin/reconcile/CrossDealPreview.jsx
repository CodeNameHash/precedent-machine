export default function CrossDealPreview({ entry }) {
  const count = entry?.occurrences?.length || 0;
  return (
    <div className="rounded border border-border bg-bg p-3 text-sm">
      This action will change {count} stored value{count === 1 ? '' : 's'} across the corpus.
    </div>
  );
}
