/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Map legacy class names → Recital tokens so existing class
        // references (bg-bg, text-ink, border-border, etc.) keep working.
        bg: 'var(--paper)',
        paper: 'var(--paper)',
        paper2: 'var(--paper-2)',
        surface: 'var(--surface)',
        white: '#FFFFFF',
        ink: 'var(--ink)',
        inkMid: 'var(--ink-mid)',
        inkLight: 'var(--ink-light)',
        inkFaint: 'var(--ink-faint)',
        border: 'var(--line)',
        line: 'var(--line)',
        lineSoft: 'var(--line-soft)',
        accent: 'var(--accent)',
        accentDeep: 'var(--accent-deep)',
        accentDim: 'var(--accent-soft)',
        buyer: 'var(--buyer)',
        seller: 'var(--seller)',
        neutral: 'var(--neutral)',
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
