/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'server',
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb'
    }
  }
};

export default nextConfig;
