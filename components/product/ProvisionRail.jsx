import { useEffect, useRef, useState } from 'react';

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

export default function ProvisionRail({ sections, title = null, topOffset = 0 }) {
  const groups = railGroups(sections);
  const [active, setActive] = useState(groups[0]?.sections?.[0]?.section_key || null);
  // The rail marks the topmost section in view as active. An observer
  // callback carries only the entries that changed, so the sections in view
  // are kept in a set across callbacks. The observer is a browser concern;
  // static renders keep the first section active.
  const inView = useRef(new Set());
  const sectionKeys = (sections || []).map((section) => section.section_key).join('|');
  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return undefined;
    const visible = inView.current;
    visible.clear();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target); else visible.delete(entry.target);
      }
      const topmost = [...visible]
        .map((element) => ({ element, top: element.getBoundingClientRect().top }))
        .sort((left, right) => left.top - right.top)[0];
      if (topmost?.element?.id) setActive(topmost.element.id.replace('provision-section-', ''));
    }, { rootMargin: '-70px 0px -55% 0px', threshold: 0 });
    for (const key of sectionKeys ? sectionKeys.split('|') : []) {
      const element = document.getElementById(`provision-section-${key}`);
      if (element) observer.observe(element);
    }
    return () => { observer.disconnect(); visible.clear(); };
  }, [sectionKeys]);
  if (!groups.length) return null;
  const jump = (event, sectionKey) => {
    setActive(sectionKey);
    if (typeof window === 'undefined') return;
    event.preventDefault();
    window.dispatchEvent(new CustomEvent('pm:open-section', { detail: { sectionKey } }));
    window.setTimeout(() => {
      const element = document.getElementById(`provision-section-${sectionKey}`);
      if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };
  const item = (sectionKey, label, { sub = false } = {}) => {
    const isActive = active === sectionKey;
    return (
      <a
        key={sectionKey}
        href={`#provision-section-${sectionKey}`}
        onClick={(event) => jump(event, sectionKey)}
        data-testid="provision-rail-item"
        data-active={isActive || undefined}
        className={`block rounded-[2px] font-sans leading-snug ${sub ? 'text-[12px]' : 'text-[13px]'} ${isActive ? 'bg-white font-semibold text-[#03203D]' : 'font-medium text-white hover:bg-white/10'}`}
        style={{ padding: '10px 10px', marginLeft: sub ? 10 : 0 }}
      >
        {label}
      </a>
    );
  };
  // Deal Storylines reference (owner's screenshot, 2026-11-01): a full-height
  // solid navy column 220px wide with 16px side padding, the deal title in
  // white Inter Tight 700 22px, nav items 13px / 500 white with 10px padding
  // split by 1px hairlines, the active item a solid white block.
  return (
    <nav
      aria-label="Provision sections"
      className="sticky hidden shrink-0 self-start overflow-y-auto bg-[#03203D] lg:block [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ top: topOffset, height: `calc(100vh - ${topOffset}px)`, width: 220, padding: '20px 16px' }}
      data-testid="provision-rail"
    >
      <p className="mb-[8px] font-sans text-[11px] font-semibold uppercase tracking-[.12em] text-[#B9C8DA]" data-testid="provision-rail-brand">Corpus</p>
      {title ? (
        <p className="mb-[18px] font-sans text-[22px] font-bold leading-[1.05] tracking-[-.03em] text-white" data-testid="provision-rail-title">{title}</p>
      ) : null}
      <div className="flex flex-col">
        {groups.map((group) => (
          <div key={group.label} data-testid="provision-rail-group" style={{ borderTop: '1px solid rgba(185,200,218,.28)' }}>
            {group.sections.length === 1
              ? item(group.sections[0].section_key, group.label)
              : (
                <>
                  {item(group.sections[0].section_key, group.label)}
                  <div className="flex flex-col">
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
