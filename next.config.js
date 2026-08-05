/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingIncludes: {
      '/api/admin/review-queue': [
        './docs/review-queue/*.json',
      ],
      '/api/admin/review-queue/[id]/resolve': [
        './docs/review-queue/*.json',
        './HANDOFF.md',
      ],
      // lib/canonical-v2/termination-fee-serving-source.js reads this pinned,
      // hash-verified excerpt file at REQUEST time via fs.readFileSync(path.join(
      // __dirname, ...)), not require()/import -- Next's static file tracer only
      // follows real module edges, so a path assembled at runtime is invisible to
      // it and the file was silently dropped from this route's Vercel bundle
      // (production incident, 2026-08-05: confirmed by diffing
      // .next/server/pages/api/review/[id]/cards.js.nft.json, which listed the
      // sibling __fixtures__/canonical-v2/preview/*.json files -- genuine static
      // imports elsewhere in the same route -- but not this one). The module
      // never throws on a missing/mismatched source, so without this entry the
      // read failure was indistinguishable from "this deal has no canonical
      // data": a false negative, not a missing feature. See the
      // QXO_EXCERPTS_RELATIVE_PATH comment in termination-fee-serving-source.js.
      '/api/review/[id]/cards': [
        './__fixtures__/canonical-v2/qxo-termination-fee-reviewed-excerpts.txt',
      ],
    },
  },
  async redirects() {
    return [
      { source: '/newhome', destination: '/', permanent: true },
      { source: '/newhome/library', destination: '/library', permanent: true },
      { source: '/newhome/query/:kind/:id', destination: '/query/:kind/:id', permanent: true },
      // pages/deals/index.js (legacy Tailwind deals index) is deleted —
      // DEALS-INDEX-SPEC-2026-07-18 item 0. `/` is the one canonical index.
      { source: '/deals', destination: '/', permanent: false },
    ];
  },
};

module.exports = nextConfig;
