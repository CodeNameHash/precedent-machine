export const typeScale = {
  display: {
    fontFamily: 'var(--font-serif)',
    fontSize: '44px',
    lineHeight: '48px',
    fontWeight: 400,
    letterSpacing: '0',
    usage: 'Review header acquirer to target line only.',
  },
  h1: {
    fontFamily: 'var(--font-serif)',
    fontSize: '24px',
    lineHeight: '32px',
    fontWeight: 500,
    letterSpacing: '0',
    usage: 'Page titles and major shell headings.',
  },
  h2: {
    fontFamily: 'var(--font-sans)',
    fontSize: '16px',
    lineHeight: '24px',
    fontWeight: 600,
    letterSpacing: '0',
    textTransform: 'uppercase',
    usage: 'Section headers and metadata labels.',
  },
  body: {
    fontFamily: 'var(--font-sans)',
    fontSize: '14px',
    lineHeight: '22px',
    fontWeight: 400,
    letterSpacing: '0',
    usage: 'Provision data, quotes, and cell content.',
  },
  caption: {
    fontFamily: 'var(--font-sans)',
    fontSize: '12px',
    lineHeight: '18px',
    fontWeight: 500,
    letterSpacing: '0',
    usage: 'Badges, chips, tag pills, breadcrumbs, and inline meta.',
  },
};

export const colors = {
  text: {
    primary: 'var(--ink)',
    secondary: 'var(--ink-mid)',
    muted: 'var(--ink-light)',
    faint: 'var(--ink-faint)',
  },
  surface: {
    base: 'var(--paper)',
    raised: 'var(--surface)',
    muted: 'var(--paper-2)',
    overlay: 'rgba(var(--ink-rgb) / 0.44)',
  },
  border: {
    subtle: 'var(--line-soft)',
    strong: 'var(--line)',
  },
  signal: {
    info: 'var(--accent)',
    warn: 'var(--type-ioc)',
    danger: 'var(--seller)',
    success: 'var(--buyer)',
  },
  accent: {
    editorial: 'var(--accent)',
    editorialDeep: 'var(--accent-deep)',
    soft: 'var(--accent-soft)',
  },
  provisionType: {
    structure: 'var(--type-struct)',
    consideration: 'var(--type-consid)',
    definitions: 'var(--type-def)',
    interimOperatingCovenants: 'var(--type-ioc)',
    noSolicitation: 'var(--type-nosol)',
    antitrust: 'var(--type-anti)',
    conditions: 'var(--type-cond)',
    terminationRights: 'var(--type-termr)',
    terminationFees: 'var(--type-termf)',
    representations: 'var(--type-rep)',
    covenants: 'var(--type-cov)',
    mae: 'var(--type-mae)',
    misc: 'var(--type-misc)',
  },
};

export const spacing = {
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  6: '24px',
  8: '32px',
  12: '48px',
  16: '64px',
};

export const radii = {
  none: '0',
  sm: '4px',
  md: '8px',
  lg: '12px',
};

export const motion = {
  duration: {
    fast: '150ms',
    base: '240ms',
  },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
  },
};

export const shadows = {
  focus: '0 0 0 3px var(--accent-soft)',
  raised: '0 10px 30px rgba(var(--ink-rgb) / 0.08)',
};

export const families = {
  editorial: 'var(--font-serif)',
  sans: 'var(--font-sans)',
};

export const tokens = {
  typeScale,
  colors,
  spacing,
  radii,
  motion,
  shadows,
  families,
};

export default tokens;
