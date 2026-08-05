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
      // NOTE: this used to also force-include the QXO termination-fee excerpt
      // for '/api/review/[id]/cards' (production incident, 2026-08-05: the
      // route read that .txt at REQUEST time via a runtime-assembled path,
      // which Next's tracer could not see). That entry was confirmed correctly
      // written and STILL failed to fix the route in production. The real fix
      // was to stop reading a file at request time at all -- see
      // lib/canonical-v2/termination-fee-serving-source.js's QXO_EXCERPTS_TEXT,
      // which now reaches the excerpt through an ordinary literal require() of
      // a generated module instead. No outputFileTracingIncludes entry is
      // needed for that route any more.
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
