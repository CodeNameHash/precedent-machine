import { colors, spacing, typeScale } from './styles';
import { Tooltip } from './Tooltip';

export function Breadcrumb({ crumbs = [] }) {
  return (
    <nav aria-label="Breadcrumb" style={styles.breadcrumb}>
      {crumbs.map((crumb, index) => (
        <span key={`${crumb}-${index}`} style={styles.crumb}>
          {index > 0 ? <span style={styles.crumbSep}>/</span> : null}
          {crumb.length > 42 ? <Tooltip label={crumb}>{shorten(crumb)}</Tooltip> : crumb}
        </span>
      ))}
    </nav>
  );
}

function shorten(value) {
  return value.length > 42 ? `${value.slice(0, 39)}...` : value;
}

const styles = {
  breadcrumb: {
    ...typeScale.caption,
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing[2],
    color: colors.text.secondary,
  },
  crumb: {
    display: 'inline-flex',
    gap: spacing[2],
    minWidth: 0,
  },
  crumbSep: {
    color: colors.text.faint,
  },
};
