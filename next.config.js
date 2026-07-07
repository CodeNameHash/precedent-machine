/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingIncludes: {
      '/api/admin/reconcile/queue': [
        './docs/schema-shape/reconciliation-queue.json',
        './docs/schema-shape/normalized-v1.json',
      ],
    },
  },
  async redirects() {
    return [
      { source: '/newhome', destination: '/', permanent: true },
      { source: '/newhome/library', destination: '/library', permanent: true },
      { source: '/newhome/query/:kind/:id', destination: '/query/:kind/:id', permanent: true },
    ];
  },
};

module.exports = nextConfig;
