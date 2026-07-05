import { colors, radii, spacing, typeScale } from './styles';
import { Tooltip } from './Tooltip';

export function ReviewHeader({ title, subtitle, meta = [] }) {
  return (
    <header style={styles.reviewHeader}>
      <div>
        <h1 style={styles.reviewTitle}>{title}</h1>
        {subtitle ? (
          <p style={styles.reviewSubtitle}>
            <Tooltip label={subtitle}>{subtitle}</Tooltip>
          </p>
        ) : null}
      </div>
      <div style={styles.metaStrip}>
        {meta.map((item) => (
          <span key={item} style={styles.metaItem}>{item}</span>
        ))}
      </div>
    </header>
  );
}

const styles = {
  reviewHeader: {
    display: 'grid',
    gap: spacing[3],
  },
  reviewTitle: {
    ...typeScale.display,
    fontSize: '32px',
    lineHeight: '38px',
    margin: 0,
    color: colors.text.primary,
  },
  reviewSubtitle: {
    ...typeScale.caption,
    color: colors.text.muted,
    margin: `${spacing[1]} 0 0`,
  },
  metaStrip: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  metaItem: {
    ...typeScale.caption,
    color: colors.text.secondary,
    background: colors.surface.muted,
    borderRadius: radii.sm,
    padding: `${spacing[1]} ${spacing[2]}`,
  },
};
