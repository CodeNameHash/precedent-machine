/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#F5F4F0',
        white: '#FFFFFF',
        ink: '#0A0A09',
        inkMid: '#2C2C2A',
        inkLight: '#6B6966',
        inkFaint: '#B0ADA8',
        border: '#E2DFD9',
        accent: '#C8922A',
        accentDim: '#E8B96A',
        buyer: '#1A5C35',
        seller: '#8B1A1A',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        ui: ['"DM Sans"', 'sans-serif'],
        body: ['"Libre Baskerville"', 'serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
