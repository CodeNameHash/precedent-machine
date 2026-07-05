import { colors, radii, spacing, typeScale } from './styles';

export function Sidebar({ sections = [] }) {
  return (
    <aside style={styles.sidebar} aria-label="Review sections">
      {sections.map((section) => (
        <SidebarSection key={section.title} title={section.title} items={section.items} />
      ))}
    </aside>
  );
}

export function SidebarSection({ title, items = [] }) {
  return (
    <section style={styles.section}>
      <h3 style={styles.sectionTitle}>{title}</h3>
      <div style={styles.itemStack}>
        {items.map((item) => (
          <SidebarItem key={item.label} label={item.label} state={item.state} />
        ))}
      </div>
    </section>
  );
}

export function SidebarItem({ label, state }) {
  return (
    <button type="button" style={styles.sidebarItem}>
      <span>{label}</span>
      {state ? <span style={styles.sidebarState}>{state}</span> : null}
    </button>
  );
}

const styles = {
  sidebar: {
    display: 'grid',
    gap: spacing[4],
  },
  section: {
    display: 'grid',
    gap: spacing[2],
  },
  sectionTitle: {
    ...typeScale.h2,
    color: colors.text.muted,
    margin: 0,
  },
  itemStack: {
    display: 'grid',
    gap: spacing[2],
  },
  sidebarItem: {
    ...typeScale.body,
    width: '100%',
    textAlign: 'left',
    color: colors.text.primary,
    background: colors.surface.raised,
    border: `1px solid ${colors.border.strong}`,
    borderRadius: radii.md,
    padding: `${spacing[3]} ${spacing[3]}`,
    display: 'grid',
    gap: spacing[2],
    cursor: 'default',
  },
  sidebarState: {
    ...typeScale.caption,
    color: colors.text.muted,
  },
};
