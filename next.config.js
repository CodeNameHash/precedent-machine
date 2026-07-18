/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingIncludes: {
      '/api/admin/reconcile/queue': [
        './docs/schema-shape/reconciliation-queue.json',
        './docs/schema-shape/normalized-v1.json',
      ],
      '/api/admin/review-queue': [
        './docs/review-queue/*.json',
      ],
      '/api/admin/review-queue/[id]/resolve': [
        './docs/review-queue/*.json',
        './HANDOFF.md',
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
