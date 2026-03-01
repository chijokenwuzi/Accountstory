/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb'
    }
  },
  async rewrites() {
    const target = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    const founderBackendTarget =
      process.env.FOUNDER_BACKEND_URL ||
      process.env.NEXT_PUBLIC_LEGACY_BACKEND_URL ||
      "http://127.0.0.1:9091";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${target}/api/v1/:path*`
      },
      {
        source: "/health",
        destination: `${target}/health`
      },
      {
        source: "/founderbackend",
        destination: `${founderBackendTarget}/index.html`
      },
      {
        source: "/founderbackend/:path*",
        destination: `${founderBackendTarget}/:path*`
      }
    ];
  }
};

export default nextConfig;
