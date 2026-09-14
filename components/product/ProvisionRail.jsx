import { useState } from 'react';

// The left rail in the Deal Storylines / Corpus style (Ben, 2026-09-13:
// "shift the page design to match this ... mainly thinking of the left hand
// side bar, page header and the right hand side bar"): a black column, the
// agreement's parties at the top, one white row for the active section,
// plain white rows for the rest, sub-sections indented under their group.
// Groups and order come from the table-shapes sections (decision 27).
//
// Ben, 2026-09-14, comparing this page with Deal Storylines: "also font etc
// doesn't match the deal storylines page. Also their pages are 'cleaner' in
// style". Measured from the Deal Storylines rail: a solid black column
// about 340px wide, 28px padding, the deal name in white bold at 34px on a
// tight leading, then nav rows of 18px regular text in white at 90%, 14px
// vertical and 18px left padding, 10px between rows, the active row a
// solid white block with a 4px radius and black bold text, sub-items
// indented 14px at 15px. The typeface comes from the page root (the
// provisions page sets --font-sans to Inter); the subtitle line is gone.
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

export default function ProvisionRail({ sections, title = null }) {
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
        className={`block rounded font-sans leading-snug ${sub ? 'text-[15px]' : 'text-[18px]'} ${isActive ? 'bg-white font-bold text-black' : 'font-normal text-white/90 hover:bg-white/10 hover:text-white'}`}
        style={{ padding: sub ? '8px 18px' : '14px 18px', marginLeft: sub ? 14 : 0 }}
      >
        {label}
      </a>
    );
  };
  return (
    <nav
      aria-label="Provision sections"
      className="sticky top-0 hidden h-screen max-h-screen shrink-0 self-start overflow-y-auto bg-black lg:block [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ width: 340, padding: 28 }}
      data-testid="provision-rail"
    >
      {title ? (
        <p className="mb-8 font-sans text-[34px] font-bold leading-[1.1] tracking-tight text-white" data-testid="provision-rail-title">{title}</p>
      ) : null}
      <div className="flex flex-col" style={{ gap: 10 }}>
        {groups.map((group) => (
          <div key={group.label} data-testid="provision-rail-group">
            {group.sections.length === 1
              ? item(group.sections[0].section_key, group.label)
              : (
                <>
                  {item(group.sections[0].section_key, group.label)}
                  <div className="flex flex-col" style={{ gap: 4, marginTop: 4 }}>
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
