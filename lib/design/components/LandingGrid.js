import { colors, radii, spacing, typeScale } from './styles';

export function LandingGrid({ tiles = [] }) {
  return (
    <div style={styles.grid}>
      {tiles.map((tile, index) => (
        <LandingTile key={tile.title} {...tile} large={index === 0} />
      ))}
    </div>
  );
}

export function LandingTile({ title, body, chip, large = false }) {
  return (
    <div style={{ ...styles.tile, ...(large ? styles.largeTile : null) }}>
      <div style={styles.tileTop}>
        <h3 style={styles.tileTitle}>{title}</h3>
        {chip ? <span style={styles.tileChip}>{chip}</span> : null}
      </div>
      <p style={styles.tileBody}>{body}</p>
    </div>
  );
}

export function EmptyTile({ title, body, chip = 'planned' }) {
  return <LandingTile title={title} body={body} chip={chip} />;
}

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: spacing[3],
  },
  tile: {
    border: `1px solid ${colors.border.strong}`,
    borderRadius: radii.lg,
    padding: spacing[4],
    background: colors.surface.raised,
  },
  largeTile: {
    gridColumn: '1 / -1',
  },
  tileTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: spacing[3],
    alignItems: 'flex-start',
  },
  tileTitle: {
    ...typeScale.h1,
    fontSize: '18px',
    lineHeight: '24px',
    margin: 0,
  },
  tileChip: {
    ...typeScale.caption,
    whiteSpace: 'nowrap',
    color: colors.accent.editorialDeep,
    background: colors.accent.soft,
    borderRadius: radii.sm,
    padding: `${spacing[1]} ${spacing[2]}`,
  },
  tileBody: {
    ...typeScale.body,
    color: colors.text.muted,
    margin: `${spacing[3]} 0 0`,
  },
};
