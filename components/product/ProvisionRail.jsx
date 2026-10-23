import { useState } from 'react';

// Ben, 2026-09-14, on the scaled page: "sidebar width now good but font
// size not good". Every width, padding, gap, band height and the page
// title stay; each font size scaled above is raised by 1.3.
// Ben, 2026-09-14, comparing the deployed page with Deal Storylines at the
// same browser zoom ("zoom level is the same"): the rail was 590 device px
// against the reference's 340, so "please fix relative sizes". Every px
// below is the first reading scaled by 0.58: width 197, padding 16, title
// 20, nav 10.5 with 8 / 10 padding and 6 gaps, sub-items 9 indented 8.
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
  const groups = railGroups(sections);
  const [active, setActive] = useState(groups[0]?.sections?.[0]?.section_key || null);
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
        className={`block font-serif leading-snug text-[#33475E] ${sub ? 'text-[11.5px]' : 'text-[13.5px]'} ${isActive ? 'bg-[#F1F4F8] font-semibold text-[#03203D]' : 'font-normal hover:bg-[#F1F4F8] hover:text-[#03203D]'}`}
        style={{ padding: sub ? '4.5px 10px' : '8px 10px', marginLeft: sub ? 8 : 0, borderLeft: isActive ? '3px solid #03203D' : '3px solid transparent' }}
      >
        {label}
      </a>
    );
  };
  return (
    <nav
      aria-label="Provision sections"
      className="sticky top-0 hidden h-screen max-h-screen shrink-0 self-start overflow-y-auto border-r border-[#DCE3E1] bg-white lg:block [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ width: 264, padding: 22 }}
      data-testid="provision-rail"
    >
      <div className="mb-[18px] flex items-center gap-[10px]" data-testid="provision-rail-brand">
        <span className="flex h-[34px] w-[34px] shrink-0 flex-col justify-center gap-[1px] bg-[#03203D] pl-[5px] font-sans text-[9.5px] font-extrabold leading-[.88] tracking-[-.03em] text-white" aria-hidden="true"><span>Paul,</span><span>Weiss</span></span>
        <span className="font-sans text-[16px] font-semibold tracking-[-.03em] text-[#03203D]">Corpus</span>
      </div>
      {title ? (
        <p className="mb-[18px] font-sans text-[21px] font-bold leading-[1.05] tracking-[-.035em] text-[#03203D]" data-testid="provision-rail-title">{title}</p>
      ) : null}
      <div className="flex flex-col" style={{ gap: 6 }}>
        {groups.map((group) => (
          <div key={group.label} data-testid="provision-rail-group">
            {group.sections.length === 1
              ? item(group.sections[0].section_key, group.label)
              : (
                <>
                  {item(group.sections[0].section_key, group.label)}
                  <div className="flex flex-col" style={{ gap: 2.5, marginTop: 2.5 }}>
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
