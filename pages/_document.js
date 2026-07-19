import { Html, Head, Main, NextScript } from 'next/document';

// PERF FIX (Jul 2026, post-review): Hanken Grotesk / Spline Sans Mono (the
// Corpus rebrand's default type system, applied on every page via
// styles/globals.css's --font-serif/--font-sans/--font-mono) are self-
// hosted — see styles/mtx-fonts.css, imported globally in pages/_app.js.
// This used to load them from fonts.googleapis.com via an external
// <link rel="stylesheet"> here, render-blocking on EVERY page load; live
// Playwright measurement against a prod build found that request hanging
// ~12.7s before failing (net::ERR_CONNECTION_RESET) in a network-
// restricted environment, which dominated and was misattributed to an
// unrelated client-side computation during a perf-regression review.

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
