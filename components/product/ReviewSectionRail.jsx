import { useEffect, useState } from 'react';
import { displaySectionReference } from '../../lib/product/section-reference-display';

// PW redesign: the review workbench's left rail. It mirrors the section
// order of DraftReview and scrolls the main column; it does not own review
// state. Counts are the section's proposals plus its flagged review items.
export default function ReviewSectionRail({ sections = [], activeId, onSelect, pendingCount = 0, unresolvedCount = 0, heldCount = 0 }) {
  const [current, setCurrent] = useState(activeId || null);
  useEffect(() => { setCurrent(activeId || null); }, [activeId]);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.IntersectionObserver || !sections.length) return undefined;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];
      if (visible?.target?.id) setCurrent(visible.target.id.replace('section-', ''));
    }, { rootMargin: '-210px 0px -55% 0px', threshold: [0, 0.1] });
    for (const section of sections) {
      const element = document.getElementById(`section-${section.node.node_id}`);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [sections]);
  if (!sections.length) return null;
  return (
    <aside className="pw-review-rail hidden lg:block" data-testid="review-section-rail">
      <p className="pw-rail-kicker">The agreement</p>
      <nav aria-label="Review sections">
        {sections.map((section) => {
          const entries = [...(section.proposals || []), ...(section.review_items || [])];
          const pending = entries.filter((entry) => {
            const item = entry.review_item || entry.item || entry;
            return !item?.decision || item.decision === 'PENDING';
          }).length;
          const active = section.node.node_id === current;
          return (
            <a
              key={section.node.node_id}
              href={`#section-${section.node.node_id}`}
              className={`pw-rail-link${active ? ' is-on' : ''}`}
              data-active={active || undefined}
              onClick={() => { setCurrent(section.node.node_id); onSelect?.(section.node.node_id); }}
            >
              <span className="pw-rail-ref">{displaySectionReference(section.routing?.section_reference)}</span>
              <span className="pw-rail-name">{section.heading || 'Agreement section'}</span>
              <span className="pw-rail-count">{pending || entries.length}</span>
            </a>
          );
        })}
      </nav>
      <div className="pw-rail-progress">
        <p className="pw-rail-kicker">Review progress</p>
        <p className="pw-rail-big">{pendingCount}<span> pending</span></p>
        <p className="pw-rail-meta">{unresolvedCount} unresolved · {heldCount} held</p>
      </div>
    </aside>
  );
}
