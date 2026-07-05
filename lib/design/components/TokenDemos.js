import { colors, motion, radii, spacing, typeScale } from './styles';

export function TypeScaleDemo({ samples = [] }) {
  return (
    <div style={styles.typeList}>
      {samples.map((sample) => (
        <div key={sample.token} style={styles.typeRow}>
          <div style={styles.tokenName}>{sample.token}</div>
          <div>
            <p style={{ ...typeScale[sample.token], margin: 0 }}>{sample.text}</p>
            <p style={styles.rule}>{sample.rule}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ColorSwatches({ palette = colors }) {
  return (
    <div style={styles.swatchGrid}>
      {flattenColors(palette).map((item) => (
        <div key={item.name} style={styles.swatch}>
          <div style={{ ...styles.swatchFill, background: item.value }} />
          <div style={styles.swatchText}>
            <span>{item.name}</span>
            <span style={styles.swatchValue}>{item.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SpacingRadiiMotionDemo() {
  return (
    <div style={styles.scaleGrid}>
      <div style={styles.scalePanel}>
        <h2 style={styles.panelTitle}>Spacing</h2>
        {Object.entries(spacing).map(([name, value]) => (
          <div key={name} style={styles.scaleRow}>
            <span style={styles.tokenName}>{name}</span>
            <span style={styles.scaleBarWrap}>
              <span style={{ ...styles.scaleBar, width: value }} />
            </span>
            <span style={styles.scaleValue}>{value}</span>
          </div>
        ))}
      </div>

      <div style={styles.scalePanel}>
        <h2 style={styles.panelTitle}>Radii</h2>
        <div style={styles.radiusGrid}>
          {Object.entries(radii).map(([name, value]) => (
            <div key={name} style={styles.radiusItem}>
              <div style={{ ...styles.radiusBox, borderRadius: value }} />
              <span>{name}</span>
              <span style={styles.scaleValue}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.scalePanel}>
        <h2 style={styles.panelTitle}>Motion</h2>
        <div style={styles.motionGrid}>
          {Object.entries(motion.duration).map(([name, value]) => (
            <span key={name} style={styles.motionPill}>
              {name}: {value}
            </span>
          ))}
          <span style={styles.motionPill}>{motion.easing.standard}</span>
        </div>
      </div>
    </div>
  );
}

function flattenColors(root) {
  return Object.entries(root).flatMap(([group, values]) =>
    Object.entries(values).map(([name, value]) => ({
      name: `${group}.${name}`,
      value,
    }))
  );
}

const styles = {
  typeList: {
    display: 'grid',
    gap: spacing[3],
  },
  typeRow: {
    display: 'grid',
    gridTemplateColumns: '120px minmax(0, 1fr)',
    gap: spacing[4],
    alignItems: 'baseline',
    padding: spacing[4],
    background: colors.surface.raised,
    border: `1px solid ${colors.border.strong}`,
    borderRadius: radii.lg,
  },
  tokenName: {
    ...typeScale.caption,
    color: colors.text.muted,
  },
  rule: {
    ...typeScale.caption,
    color: colors.text.muted,
    margin: `${spacing[1]} 0 0`,
  },
  swatchGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
    gap: spacing[3],
  },
  swatch: {
    display: 'grid',
    gridTemplateColumns: '48px minmax(0, 1fr)',
    gap: spacing[3],
    alignItems: 'center',
    padding: spacing[3],
    background: colors.surface.raised,
    border: `1px solid ${colors.border.strong}`,
    borderRadius: radii.md,
  },
  swatchFill: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    border: `1px solid ${colors.border.strong}`,
  },
  swatchText: {
    ...typeScale.caption,
    display: 'grid',
    gap: spacing[1],
    minWidth: 0,
  },
  swatchValue: {
    color: colors.text.faint,
    overflowWrap: 'anywhere',
  },
  scaleGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: spacing[4],
  },
  scalePanel: {
    background: colors.surface.raised,
    border: `1px solid ${colors.border.strong}`,
    borderRadius: radii.lg,
    padding: spacing[4],
  },
  panelTitle: {
    ...typeScale.h2,
    color: colors.text.secondary,
    margin: `0 0 ${spacing[3]}`,
  },
  scaleRow: {
    display: 'grid',
    gridTemplateColumns: '44px minmax(0, 1fr) 48px',
    gap: spacing[3],
    alignItems: 'center',
    marginTop: spacing[2],
  },
  scaleBarWrap: {
    height: 12,
    background: colors.surface.muted,
    borderRadius: radii.sm,
  },
  scaleBar: {
    display: 'block',
    height: 12,
    background: colors.accent.editorial,
    borderRadius: radii.sm,
  },
  scaleValue: {
    ...typeScale.caption,
    color: colors.text.faint,
  },
  radiusGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: spacing[3],
  },
  radiusItem: {
    ...typeScale.caption,
    display: 'grid',
    gap: spacing[2],
    color: colors.text.muted,
  },
  radiusBox: {
    width: '100%',
    height: 54,
    background: colors.accent.soft,
    border: `1px solid ${colors.border.strong}`,
  },
  motionGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  motionPill: {
    ...typeScale.caption,
    color: colors.text.secondary,
    background: colors.surface.muted,
    border: `1px solid ${colors.border.strong}`,
    borderRadius: radii.md,
    padding: `${spacing[2]} ${spacing[3]}`,
  },
};
