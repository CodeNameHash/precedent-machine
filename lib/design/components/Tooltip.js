import { colors, radii, spacing, typeScale } from './styles';

export function Tooltip({ label, children }) {
  return (
    <span style={styles.wrap}>
      <span title={label} style={styles.target}>{children}</span>
    </span>
  );
}

const styles = {
  wrap: {
    display: 'inline-flex',
    minWidth: 0,
  },
  target: {
    ...typeScale.caption,
    color: colors.text.secondary,
    borderBottom: `1px dotted ${colors.border.strong}`,
    borderRadius: radii.none,
    paddingBottom: spacing[1],
  },
};
