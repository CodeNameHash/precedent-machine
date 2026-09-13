// The provision rail: one link per table-shapes section, in shape order, so
// a reader can jump straight to (say) Termination Fees (mockup approved by
// Ben 2026-09-12/13). Shared by the Query page and the per-run lawyer
// preview.
export default function ProvisionRail({ sections }) {
  if (!sections.length) return null;
  return (
    <nav aria-label="Provision sections" className="hidden w-48 shrink-0 lg:block" data-testid="provision-rail">
      <p className="text-[10px] font-bold uppercase tracking-wide text-inkFaint">Jump to</p>
      <ul className="mt-2 space-y-1 text-xs">
        {sections.map((section) => (
          <li key={section.section_key}>
            <a href={`#provision-section-${section.section_key}`} className="text-inkMid hover:text-accent">{section.title}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
