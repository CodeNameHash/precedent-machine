import { colors, radii, shadows, spacing, typeScale } from './styles';

export function FullDocOverlay({ title, body, anchor }) {
  return (
    <div style={styles.overlayShell}>
      <div style={styles.overlayBar}>
        <span>{title}</span>
        {anchor ? <span style={styles.anchor}>{anchor}</span> : null}
        <button type="button" style={styles.closeButton} aria-label="Close full document view">x</button>
      </div>
      <p style={styles.overlayBody}>{body}</p>
    </div>
  );
}

const styles = {
  overlayShell: {
    border: `1px solid ${colors.border.strong}`,
    borderRadius: radii.lg,
    overflow: 'hidden',
    boxShadow: shadows.raised,
  },
  overlayBar: {
    ...typeScale.caption,
    display: 'flex',
    justifyContent: 'space-between',
    gap: spacing[3],
    alignItems: 'center',
    padding: spacing[3],
    background: colors.surface.muted,
    color: colors.text.secondary,
  },
  anchor: {
    color: colors.text.faint,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    border: `1px solid ${colors.border.strong}`,
    background: colors.surface.raised,
    color: colors.text.primary,
  },
  overlayBody: {
    ...typeScale.body,
    color: colors.text.secondary,
    margin: 0,
    padding: spacing[4],
  },
};
