/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: isDev,
  register: true,
  skipWaiting: true,
  buildExcludes: [/app-build-manifest\.json$/],
});

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
};

module.exports = withPWA(nextConfig);
