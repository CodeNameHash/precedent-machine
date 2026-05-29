/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Map legacy class names → Recital tokens. Colors use the
        // `rgb(var(--*-rgb) / <alpha-value>)` form so Tailwind's
        // /opacity modifiers (e.g. bg-buyer/10) keep working.
        bg:        'rgb(var(--paper-rgb) / <alpha-value>)',
        paper:     'rgb(var(--paper-rgb) / <alpha-value>)',
        paper2:    'rgb(var(--paper-2-rgb) / <alpha-value>)',
        surface:   'rgb(var(--surface-rgb) / <alpha-value>)',
        white:     '#FFFFFF',
        ink:       'rgb(var(--ink-rgb) / <alpha-value>)',
        inkMid:    'rgb(var(--ink-mid-rgb) / <alpha-value>)',
        inkLight:  'rgb(var(--ink-light-rgb) / <alpha-value>)',
        inkFaint:  'rgb(var(--ink-faint-rgb) / <alpha-value>)',
        border:    'rgb(var(--line-rgb) / <alpha-value>)',
        line:      'rgb(var(--line-rgb) / <alpha-value>)',
        lineSoft:  'rgb(var(--line-soft-rgb) / <alpha-value>)',
        accent:    'rgb(var(--accent-rgb) / <alpha-value>)',
        accentDeep:'rgb(var(--accent-deep-rgb) / <alpha-value>)',
        accentDim: 'var(--accent-soft)',
        buyer:     'rgb(var(--buyer-rgb) / <alpha-value>)',
        seller:    'rgb(var(--seller-rgb) / <alpha-value>)',
        neutral:   'rgb(var(--neutral-rgb) / <alpha-value>)',
      },
      fontFamily: {
        // 'display' and 'body' historically meant serif/legal-feel; in the
        // Modern direction both map to Hanken Grotesk via --font-serif.
        display: ['var(--font-serif)'],
        ui:      ['var(--font-sans)'],
        sans:    ['var(--font-sans)'],
        serif:   ['var(--font-serif)'],
        body:    ['var(--font-serif)'],
        mono:    ['var(--font-mono)'],
      },
      borderRadius: {
        card: '13px',
        pill: '999px',
      },
    },
  },
  plugins: [],
};
