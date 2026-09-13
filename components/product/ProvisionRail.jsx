import { useState } from 'react';

// The provision rail: the old app's left sidebar (components/review/Sidebar.js,
// SIDEBAR_GROUPS order and the Corpus-style .rec-side-* items) over the
// table-shapes sections. One row per group with the group's colour dot; a
// group with several sections lists them indented beneath it. Every row is
// an anchor to its section on the page (Ben, 2026-09-13: "I'd use the
// ordering from the old app for the sections and the left hand side bar
// (and for the styling of that side bar)"). Shared by the Query page and
// the per-run lawyer preview.
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

export default function ProvisionRail({ sections }) {
  const [active, setActive] = useState(null);
  const groups = railGroups(sections);
  if (!groups.length) return null;
  const item = (sectionKey, label, extra = {}) => (
    <a
      href={`#provision-section-${sectionKey}`}
      onClick={() => setActive(sectionKey)}
      className={`rec-side-item${active === sectionKey ? ' active' : ''}`}
      data-testid="provision-rail-item"
      {...extra}
    >
      {extra.dot ? <span className="dot" style={{ background: extra.dot }} /> : null}
      <span className="rec-side-label">{label}</span>
    </a>
  );
  return (
    <nav
      aria-label="Provision sections"
      className="sticky top-4 hidden max-h-[calc(100vh-2rem)] w-64 shrink-0 self-start overflow-y-auto rounded-xl border border-border bg-white lg:block"
      style={{ padding: '18px 14px' }}
      data-testid="provision-rail"
    >
      <div style={{ padding: '0 8px 10px' }}><span className="rec-side-eyebrow">Provisions</span></div>
      <div className="flex flex-col" style={{ gap: 1 }}>
        {groups.map((group) => (
          <div key={group.label} data-testid="provision-rail-group">
            {group.sections.length === 1
              ? item(group.sections[0].section_key, group.label, { dot: group.hex })
              : (
                <>
                  {item(group.sections[0].section_key, group.label, { dot: group.hex, style: { fontWeight: 500 } })}
                  <div className="mt-0.5 flex flex-col" style={{ marginLeft: 18, gap: 1 }}>
                    {group.sections.map((section) => item(section.section_key, section.label, { key: section.section_key, style: { fontSize: 12.5, padding: '5px 10px' } }))}
                  </div>
                </>
              )}
          </div>
        ))}
      </div>
    </nav>
  );
}
