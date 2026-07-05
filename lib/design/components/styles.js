import { colors, motion, radii, shadows, spacing, typeScale } from '../tokens';

export const shellStyles = {
  storyLabel: {
    ...typeScale.caption,
    color: colors.text.faint,
  },
  panelTitle: {
    ...typeScale.h2,
    color: colors.text.secondary,
    margin: `0 0 ${spacing[3]}`,
  },
  primitivePanel: {
    background: colors.surface.raised,
    border: `1px solid ${colors.border.strong}`,
    borderRadius: radii.lg,
    padding: spacing[4],
  },
  story: {
    display: 'grid',
    gap: spacing[2],
    paddingTop: spacing[3],
    borderTop: `1px solid ${colors.border.subtle}`,
  },
  storyStack: {
    display: 'grid',
    gap: spacing[3],
  },
  primitiveGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: spacing[4],
  },
  raisedShell: {
    background: colors.surface.raised,
    border: `1px solid ${colors.border.strong}`,
    borderRadius: radii.lg,
    boxShadow: shadows.raised,
  },
};

export { colors, motion, radii, shadows, spacing, typeScale };
