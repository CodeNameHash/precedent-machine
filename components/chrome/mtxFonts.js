// The Mergertrace (.mtx) font stack — Tinos (serif), Inter (sans), IBM Plex
// Mono — declared as CSS custom properties in MergertraceStyles.jsx but
// never actually fetched anywhere globally (_document.js only loads the
// Corpus rebrand's Hanken Grotesk). Every .mtx page must load this link
// itself or var(--mtx-sans) silently falls through to Arial/system-ui —
// that's the "system font fallback" bug: CSS said Inter, the browser never
// had it. pages/review/[id].js already did this per-page; this constant
// lets every other .mtx page (query surface included) do the same without
// re-typing the URL.
export const MTX_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Tinos:ital,wght@0,400;0,700;1,400;1,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap';

export function MtxFontLinks() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={MTX_FONTS_HREF} />
    </>
  );
}
