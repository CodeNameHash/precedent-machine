export default function SplitFlow({ entry }) {
  return (
    <section className="rounded border border-border bg-white p-4">
      <h3 className="font-display text-base text-ink">Split Flow</h3>
      <p className="mt-2 text-sm text-inkLight">
        {entry ? `Re-classify all stored values for ${entry.rawValue}.` : 'Select a queue entry to start.'}
      </p>
    </section>
  );
}
