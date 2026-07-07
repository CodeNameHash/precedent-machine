/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: '/newhome', destination: '/', permanent: true },
      { source: '/newhome/library', destination: '/library', permanent: true },
      { source: '/newhome/query/:kind/:id', destination: '/query/:kind/:id', permanent: true },
    ];
  },
};

module.exports = nextConfig;
