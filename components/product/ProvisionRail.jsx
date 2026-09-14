import { useState } from 'react';

// The left rail in the Deal Storylines / Corpus style (Ben, 2026-09-13:
// "shift the page design to match this ... mainly thinking of the left hand
// side bar, page header and the right hand side bar"): a black column, the
// agreement's parties at the top, one white row for the active section,
// plain white rows for the rest, sub-sections indented under their group.
// Groups and order come from the table-shapes sections (decision 27).
export function railGroups(sections) {
  const groups = [];
  for (const section of sections || []) {
    const rail = section.rail || { group: section.title, label: section.title, hex: '#8A8782' };
    let group = groups[groups.length - 1];
    if (!group || group.label !== rail.group) {
      group = { label: rail.group, hex: rail.hex, sections: [] };
      groups.push(group);
    }
    group.sections.push({ section_key: section.section_key, label: rail.label, title: section.title });
  }
  return groups;
}

export default function ProvisionRail({ sections, title = null, subtitle = null }) {
  const [active, setActive] = useState(null);
  const groups = railGroups(sections);
  if (!groups.length) return null;
  const item = (sectionKey, label, { sub = false } = {}) => {
    const isActive = active === sectionKey;
    return (
      <a
        key={sectionKey}
        href={`#provision-section-${sectionKey}`}
        onClick={() => setActive(sectionKey)}
        data-testid="provision-rail-item"
        data-active={isActive || undefined}
        className={`block rounded-sm px-3 ${sub ? 'py-1.5 text-[13px]' : 'py-2.5 text-[15px]'} ${isActive ? 'bg-white font-semibold text-black' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
        style={sub ? { marginLeft: 14 } : undefined}
      >
        {label}
      </a>
    );
  };
  return (
    <nav
      aria-label="Provision sections"
      className="sticky top-0 hidden h-screen max-h-screen w-60 shrink-0 self-start overflow-y-auto bg-black lg:block"
      style={{ padding: '28px 14px 40px' }}
      data-testid="provision-rail"
    >
      {title ? (
        <div className="mb-8 px-3">
          <p className="font-sans text-2xl font-bold leading-tight tracking-tight text-white" data-testid="provision-rail-title">{title}</p>
          {subtitle ? <p className="mt-1 text-[11px] uppercase tracking-wide text-white/60">{subtitle}</p> : null}
        </div>
      ) : null}
      <div className="flex flex-col" style={{ gap: 2 }}>
        {groups.map((group) => (
          <div key={group.label} data-testid="provision-rail-group">
            {group.sections.length === 1
              ? item(group.sections[0].section_key, group.label)
              : (
                <>
                  {item(group.sections[0].section_key, group.label)}
                  <div className="mb-1 flex flex-col" style={{ gap: 1 }}>
                    {group.sections.map((section) => item(section.section_key, section.label, { sub: true }))}
                  </div>
                </>
              )}
          </div>
        ))}
      </div>
    </nav>
  );
}
