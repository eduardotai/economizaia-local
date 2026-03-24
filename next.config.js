/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: isDev,
  register: true,
  skipWaiting: true,
});

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
};

module.exports = withPWA(nextConfig);